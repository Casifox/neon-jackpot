/* ============================================================
   NEON JACKPOT — games/plinko.js
   Plinko physique : gravité, collisions, guides, rendu néon
   ============================================================ */
(function () {
  "use strict";

  const App = window.App;
  const U = App.utils;
  const D = window.GAME_DATA;
  const CFG = D.balance.plinko;

  const Game = {};
  let activeCleanup = null;

  Game.render = function (container) {
    if (activeCleanup) activeCleanup();
    const d = App.state.data;
    const g = d.games.plinko;

    // ---------- état local ----------
    let canvas = null;
    let ctx = null;
    let wrap = null;
    let W = 0;
    let H = 0;
    let dpr = 1;
    let resizeObs = null;
    let lastObservedWidth = 0;

    let pegs = [];
    let bins = [];
    let board = { top: 80, pegGap: 40, rowGap: 30, binsTop: 500, binH: 46 };
    let profile = [];
    let balls = [];
    let particles = [];
    let motes = [];
    let binFlash = {};
    let destroyedPegs = new Set();
    let forcedNext = false;
    let luckStormUntil = 0;
    let lastTime = 0;
    let raf = null;
    let autoTimer = null;
    let uiTimer = null;
    let activeTab = "upgrades";
    let destroyed = false;
    let hiddenAt = 0;
    let sessionWon = g.sessionWon || 0;
    let bestSession = g.bestSessionMult || 1;

    // ---------- helpers ----------
    const betOptions = () => CFG.betSteps.slice(0, Math.min(CFG.betSteps.length, 3 + g.upgrades.bet));
    const currentBet = () => betOptions()[U.clamp(g.betIndex, 0, betOptions().length - 1)] || 1;
    const maxBalls = () => Math.min(CFG.maxBalls, CFG.baseBalls + g.upgrades.balls);
    const currentRows = () => Math.min(CFG.maxRows, CFG.baseRows + g.upgrades.rows);
    const tier = () => U.clamp(g.upgrades.mult, 0, CFG.tierEdges.length - 1);
    const table = () => CFG.tables.find((t) => t.id === g.table) || CFG.tables[0];
    const tableMods = () => table().mods || {};
    const autoInterval = () => g.upgrades.auto === 0 ? 2400 : (CFG.autoIntervalsMs[U.clamp(g.upgrades.auto - 1, 0, 3)] || 5000);
    const currentEdge = () => CFG.tierEdges[tier()];
    const theme = () => {
      const id = table().id;
      if (id === "neon") return { a: "#22d3ee", b: "#a855f7", c: "#ff4fd8" };
      if (id === "pyramid") return { a: "#ffc857", b: "#fb923c", c: "#ff4fd8" };
      if (id === "double") return { a: "#60a5fa", b: "#22d3ee", c: "#a78bfa" };
      return { a: "#ff4fd8", b: "#8b5cf6", c: "#22d3ee" };
    };

    function luckTotal() {
      let luck = g.upgrades.luck * CFG.luckPerLevel + App.meta.plinkoLuckBonus() + (tableMods().luck || 0);
      if (Date.now() < luckStormUntil) luck += 25;
      return U.clamp(luck, 0, 80);
    }

    // ---------- multiplicateurs ----------
    function computeProfile() {
      const rows = currentRows();
      const edge = currentEdge();
      const raw = [];
      for (let i = 0; i <= rows; i++) {
        const t = Math.abs(i - rows / 2) / (rows / 2 || 1);
        raw.push(0.52 + Math.pow(t, 2.15) * edge);
      }
      let ev = 0;
      for (let i = 0; i <= rows; i++) ev += U.binomProb(rows, i, 0.5) * raw[i];
      const target = CFG.tierEV[tier()] + (tableMods().payout || 0);
      const scale = target / Math.max(0.0001, ev);
      profile = raw.map((v) => v * scale);
    }

    function layout() {
      computeProfile();
      const rows = currentRows();
      const padX = Math.max(16, W * 0.032);
      const chuteTop = 44;
      board.top = Math.max(chuteTop + 34, H * 0.145);
      board.binH = U.clamp(H * 0.082, 34, 54);
      board.binsTop = H - board.binH - 16;
      const usableH = board.binsTop - board.top - 8;
      board.rowGap = usableH / Math.max(1, rows);
      board.pegGap = (W - 2 * padX) / (rows + 1);
      pegs = [];
      for (let r = 0; r < rows; r++) {
        const count = r + 3;
        const y = board.top + (r + 0.42) * board.rowGap;
        for (let j = 0; j < count; j++) {
          const x = W / 2 + (j - (count - 1) / 2) * board.pegGap;
          pegs.push({
            x, y, r, j,
            key: r + ":" + j,
            radius: r === rows - 1 ? 4.1 : 3.6,
            color: r % 2 === 0 ? theme().a : theme().b
          });
        }
      }
      bins = [];
      for (let i = 0; i <= rows; i++) {
        const x = padX + (i + 0.5) * board.pegGap;
        const w = Math.max(20, board.pegGap - 5);
        bins.push({ x, i, w, top: board.binsTop, h: board.binH, left: x - w / 2, right: x + w / 2 });
      }
      board.chuteTop = chuteTop;
      board.padX = padX;
      // particules d'ambiance
      if (!motes.length) {
        for (let i = 0; i < 26; i++) {
          motes.push({
            x: Math.random() * W,
            y: Math.random() * H,
            r: U.rand(0.6, 2.2),
            v: U.rand(3, 12),
            a: U.rand(0.05, 0.22),
            p: U.rand(0, Math.PI * 2)
          });
        }
      }
    }

    function binLabel(m) {
      if (m < 1) return m.toFixed(2).replace(/0$/, "0");
      if (m < 10) return U.fmtMult(m);
      return U.fmtMult(m);
    }

    function pickSpecial() {
      const lib = CFG.specials;
      const available = Object.keys(lib).filter((key) => g.specials[key] > 0);
      if (!available.length) return null;
      const weighted = available.map((key) => {
        const def = lib[key];
        return { key, weight: def.chance + (g.specials[key] - 1) * def.chancePerLevel };
      });
      const total = weighted.reduce((s, x) => s + x.weight, 0);
      if (Math.random() > total) return null;
      let roll = Math.random() * total;
      for (const item of weighted) {
        roll -= item.weight;
        if (roll <= 0) return item.key;
      }
      return weighted[0].key;
    }

    function pickBin(special) {
      const rows = currentRows();
      if (forcedNext || special === "magnet" || special === "rainbow") {
        return Math.random() < 0.5 ? 0 : rows;
      }
      const edgeChance = Math.min(0.18, (luckTotal() / 100) * 0.32);
      if (Math.random() < edgeChance) return Math.random() < 0.5 ? 0 : rows;
      return U.binomial(rows, 0.5);
    }

    // ---------- particules locales ----------
    function spawnParticle(x, y, opts) {
      opts = opts || {};
      const n = opts.count || 6;
      for (let i = 0; i < n; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = U.rand(opts.min || 30, opts.max || 220);
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (opts.up || 10),
          g: opts.g === undefined ? 480 : opts.g,
          life: U.rand(0.25, opts.life || 0.75),
          max: 0,
          size: U.rand(opts.sizeMin || 1, opts.sizeMax || 3.5),
          color: opts.color || theme().a
        });
      }
      particles.forEach((p) => { if (!p.max) p.max = p.life; });
    }

    function updateParticles(dt) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.vy += p.g * dt;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    // ---------- bille ----------
    function dropBall(opts) {
      opts = opts || {};
      if (!opts.force && balls.length >= maxBalls()) {
        if (!opts.silent) {
          App.audio.play("error");
          App.ui.toast("Plateau saturé", "Améliorez le nombre de billes simultanées.", "🔵", "danger");
        }
        return false;
      }
      let free = !!opts.free;
      if (!free && !opts.ignoreCost && d.charges.freePlinko > 0) {
        d.charges.freePlinko -= 1;
        free = true;
      }
      if (!free) {
        if (!App.meta.bet(currentBet(), "plinko")) {
          App.audio.play("error");
          if (!opts.silent) App.ui.toast("Jetons insuffisants", "Réduisez la mise ou ouvrez le coffre de secours.", "🪙", "danger");
          return false;
        }
      } else {
        App.meta.freeBet("plinko");
      }
      let special = opts.special || pickSpecial();
      if (forcedNext) {
        special = "magnet";
        forcedNext = false;
      }
      if (d.charges.rainbow > 0) {
        d.charges.rainbow -= 1;
        special = "rainbow";
      }
      const bin = pickBin(special);
      const color = special
        ? CFG.specials[special].color
        : (App.meta.equippedItem("balls") && App.meta.equippedItem("balls").color) || theme().a;
      const ball = {
        x: W / 2 + U.rand(-3, 3),
        y: board.top - 30,
        vx: U.rand(-28, 28),
        vy: U.rand(80, 130),
        r: 6.2,
        age: 0,
        targetBin: bin,
        targetX: bins[bin] ? bins[bin].x : W / 2,
        special: special || null,
        color,
        bet: currentBet(),
        free,
        trail: [],
        hit: new Set(),
        seed: Math.random() * 100,
        settled: false
      };
      balls.push(ball);
      App.audio.play(special ? "whoosh" : "click");
      if (special === "rainbow") {
        // éclat visuel à l'apparition
        spawnParticle(W / 2, board.top - 25, { count: 18, color: "#ff4fd8", max: 300, life: 0.9 });
      }
      updateHeader();
      updateActive();
      return true;
    }

    function stepBall(b, h) {
      if (b.settled) return;
      b.age += h;
      const progress = U.clamp((b.y - board.top) / Math.max(1, board.binsTop - board.top), 0, 1);
      const steer = b.special === "magnet" ? 28 : 4.8 + 18 * progress * progress;
      b.vx += (b.targetX - b.x) * steer * h;
      b.vx += Math.sin(b.age * 3.2 + b.seed) * 10 * h;
      b.vy += 1280 * h;
      b.vy = Math.min(b.vy, 980);
      b.vx = U.clamp(b.vx, -760, 760);
      b.x += b.vx * h;
      b.y += b.vy * h;

      const edge = b.r + 3;
      if (b.x < edge) {
        b.x = edge;
        b.vx = Math.abs(b.vx) * 0.42;
        spawnParticle(b.x, b.y, { count: 2, color: theme().c, max: 90 });
      } else if (b.x > W - edge) {
        b.x = W - edge;
        b.vx = -Math.abs(b.vx) * 0.42;
        spawnParticle(b.x, b.y, { count: 2, color: theme().c, max: 90 });
      }

      if (b.special !== "ghost") {
        for (let i = 0; i < pegs.length; i++) {
          const p = pegs[i];
          if (Math.abs(b.y - p.y) > b.r + p.radius + 2) continue;
          const dx = b.x - p.x;
          const dy = b.y - p.y;
          const dist = Math.hypot(dx, dy);
          const minDist = b.r + p.radius;
          if (dist > 0 && dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;
            b.x += nx * overlap;
            b.y += ny * overlap;
            const vn = b.vx * nx + b.vy * ny;
            if (vn < 0) {
              const restitution = 0.58;
              b.vx -= (1 + restitution) * vn * nx;
              b.vy -= (1 + restitution) * vn * ny;
              b.vx += U.rand(-32, 32);
              b.vy += U.rand(-14, 18);
            }
            if (!b.hit.has(p.key)) {
              b.hit.add(p.key);
              const col = b.special === "explosive" ? "#fb7185" : p.color;
              spawnParticle(p.x, p.y, { count: 5, color: col, max: 150, life: 0.45 });
              App.audio.play("tick");
              if (b.special === "explosive" && Math.random() < 0.35) {
                destroyedPegs.add(p.key);
                spawnParticle(p.x, p.y, { count: 18, color: "#fb7185", max: 320, life: 0.8, sizeMax: 5 });
                App.audio.play("explosion");
              }
            }
          }
        }
      }

      if (b.y > board.binsTop - 30) {
        b.vx += (b.targetX - b.x) * 58 * h;
        b.vx *= 0.94;
      }

      if (b.y >= board.binsTop + board.binH * 0.5 || b.age > 12) {
        settleBall(b);
      }
    }

    function updatePhysics(dt) {
      const steps = Math.max(1, Math.min(8, Math.ceil(dt / 0.008)));
      const h = dt / steps;
      for (let s = 0; s < steps; s++) {
        for (let i = balls.length - 1; i >= 0; i--) {
          const b = balls[i];
          stepBall(b, h);
          if (b.settled) {
            balls.splice(i, 1);
          }
        }
      }
      updateParticles(dt);
    }

    function settleBall(b) {
      if (b.settled) return;
      b.settled = true;
      const bin = bins[b.targetBin] || bins[0];
      if (!bin) return;
      let mult = profile[b.targetBin] || 1;
      if (b.special === "rainbow") mult = Math.max(bestSession || 1, profile[b.targetBin] || 1, 1.5);
      if (b.special === "golden") mult *= 2;
      if (b.special === "mother") mult *= 3;
      if (tableMods().doubleChance && Math.random() < tableMods().doubleChance) mult *= 2;
      const stake = b.free ? 0 : b.bet;
      const payout = b.bet * mult;
      binFlash[b.targetBin] = performance.now();
      spawnParticle(bin.x, bin.top + 8, {
        count: b.special || mult >= 10 ? 26 : 12,
        color: mult >= 10 ? "#ffc857" : theme().a,
        max: 300,
        life: 0.9,
        g: 260
      });
      if (mult > bestSession) bestSession = mult;
      g.bestSessionMult = bestSession;
      sessionWon += payout;
      g.sessionWon = sessionWon;
      App.meta.payout(payout, "plinko", { stake, mult, silent: true });
      if (mult >= 25) {
        const gold = mult >= 100 ? 3 : 1;
        App.meta.grant("goldBalls", gold, { silent: true });
        if (mult >= 100) {
          App.ui.toast("Bille d'or !", "+" + gold + " billes d'or pour ce multiplicateur.", "🟡", "gold");
          App.state.log("🟡", "Bille d'or gagnée", "+" + gold);
        }
      }
      if (mult >= 100) {
        App.meta.triggerSynergy("plinko_100x", { mult });
      }
      const rect = canvas.getBoundingClientRect();
      const px = rect.left + (bin.x / W) * rect.width;
      const py = rect.top + ((bin.top + 4) / H) * rect.height;
      App.fx.floatingText(binLabel(mult), px, py - 26, { className: "mult", duration: 1.15 });
      App.fx.floatingText("+" + U.fmt(payout), px, py - 54, { className: "win", color: "#ffc857", duration: 1.3 });
      if (mult >= 100) {
        App.audio.play("jackpot");
        App.fx.confetti(100);
        App.fx.shake(9, 550);
        App.fx.rings(px, py, { size: 8, grow: 340, color: "#ffc857", life: 0.9 });
      } else if (mult >= 10) {
        App.audio.play("bigwin");
        App.fx.shake(4, 320);
        App.fx.starBurst(px, py, 16);
        App.fx.coinBurst(px, py, payout);
      } else if (mult >= 3) {
        App.audio.play("win");
        App.fx.burst(px, py, { colors: [theme().a, theme().b, "#ffc857"], count: 20 });
        App.fx.coinBurst(px, py, payout);
      } else {
        App.audio.play("coin");
        App.fx.burst(px, py, { colors: [theme().a, theme().b], count: 9, maxSpeed: 150 });
      }
      if (payout > 0) App.fx.floatAt(container.querySelector("#plinko-won"), "+" + U.fmt(payout), { className: "win", color: "#ffc857" });
      updateHeader();
      updateActive();
      App.state.saveSoon();
    }

    // ---------- rendu canvas ----------
    function resize() {
      if (!canvas || !wrap) return;
      const rect = wrap.getBoundingClientRect();
      W = Math.max(280, rect.width);
      H = U.clamp(W * 0.62, 400, 560);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
      draw(performance.now(), 0);
    }

    function roundRect(c, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      c.beginPath();
      c.moveTo(x + rr, y);
      c.arcTo(x + w, y, x + w, y + h, rr);
      c.arcTo(x + w, y + h, x, y + h, rr);
      c.arcTo(x, y + h, x, y, rr);
      c.arcTo(x, y, x + w, y, rr);
      c.closePath();
    }

    function draw(now, dt) {
      if (!ctx) return;
      const th = theme();
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#120d24");
      bg.addColorStop(0.5, "#0b0918");
      bg.addColorStop(1, "#07060e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // halo supérieur
      const halo = ctx.createRadialGradient(W / 2, board.top - 15, 0, W / 2, board.top - 15, W * 0.55);
      halo.addColorStop(0, U.hexToRgba(th.b, 0.18));
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, W, H);

      // cadre
      const frame = ctx.createLinearGradient(0, 0, W, H);
      frame.addColorStop(0, U.hexToRgba(th.a, 0.45));
      frame.addColorStop(0.5, "rgba(255,255,255,0.08)");
      frame.addColorStop(1, U.hexToRgba(th.c, 0.35));
      roundRect(ctx, 5, 5, W - 10, H - 10, 22);
      ctx.strokeStyle = frame;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      roundRect(ctx, 8, 8, W - 16, H - 16, 19);
      ctx.strokeStyle = "rgba(255,255,255,0.035)";
      ctx.stroke();

      // grille de fond
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.026)";
      ctx.lineWidth = 1;
      for (let x = 20; x < W; x += 44) {
        ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, H - 20); ctx.stroke();
      }
      for (let y = 40; y < H; y += 44) {
        ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(W - 16, y); ctx.stroke();
      }
      ctx.restore();

      // poussière
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      motes.forEach((m) => {
        const y = ((m.y + now * 0.001 * m.v) % H);
        ctx.beginPath();
        ctx.arc(m.x, y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = U.hexToRgba(th.c, m.a);
        ctx.fill();
      });
      ctx.restore();

      // rails latéraux
      drawRails(now, th);

      // chute / entonnoir
      drawChute(now, th);

      // picots
      pegs.forEach((p) => drawPeg(p, now, th));

      // rails verticaux des cases
      bins.forEach((bin, i) => {
        const x = bin.left - 1.5;
        if (i > 0) {
          const gLine = ctx.createLinearGradient(0, bin.top, 0, H - 10);
          gLine.addColorStop(0, U.hexToRgba(th.c, 0.23));
          gLine.addColorStop(1, U.hexToRgba(th.a, 0.04));
          ctx.strokeStyle = gLine;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, bin.top - 10);
          ctx.lineTo(x, H - 9);
          ctx.stroke();
        }
      });

      // cases
      bins.forEach((bin, i) => drawBin(bin, i, now, th));

      // traînées + billes
      balls.forEach((b) => {
        drawTrail(b);
        if (b.special === "mother" && b.age > 0.45) {
          [-14, 14].forEach((off) => {
            ctx.beginPath();
            ctx.arc(b.x + off, b.y + 7, 4.2, 0, Math.PI * 2);
            ctx.fillStyle = U.hexToRgba("#34d399", 0.55);
            ctx.fill();
          });
        }
        drawBall(b, now);
      });

      // particules
      particles.forEach((p) => {
        const alpha = U.clamp(p.life / (p.max || p.life), 0, 1);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = U.hexToRgba(p.color, alpha);
        ctx.fill();
      });

      // texte d'ambiance
      ctx.save();
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(255,255,255,0.20)";
      ctx.font = "600 9px 'JetBrains Mono', monospace";
      ctx.fillText("LUCK " + Math.round(luckTotal()) + "%", 16, 18);
      ctx.textAlign = "right";
      ctx.fillStyle = U.hexToRgba(th.c, 0.32);
      ctx.fillText(currentRows() + " ROWS · " + U.fmtMult(currentEdge()) + " EDGE", W - 16, 18);
      ctx.restore();
    }

    function drawRails(now, th) {
      const left = board.padX - 7;
      const right = W - board.padX + 7;
      const top = board.top - 22;
      const bottom = board.binsTop + 3;
      const grad = ctx.createLinearGradient(0, top, 0, bottom);
      grad.addColorStop(0, U.hexToRgba(th.a, 0.04));
      grad.addColorStop(0.5, U.hexToRgba(th.a, 0.18));
      grad.addColorStop(1, U.hexToRgba(th.c, 0.22));
      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1;
      [left, right].forEach((x) => {
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
        for (let y = top + 20; y < bottom; y += 52) {
          const a = 0.2 + Math.sin(now * 0.002 + y * 0.1) * 0.12;
          ctx.beginPath();
          ctx.arc(x, y, 1.4, 0, Math.PI * 2);
          ctx.fillStyle = U.hexToRgba(th.c, a);
          ctx.fill();
        }
      });
      ctx.restore();
    }

    function drawTrail(b) {
      const pts = b.trail;
      if (pts.length < 2) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 1; i < pts.length; i++) {
        const a = (i / pts.length) * 0.28;
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = U.hexToRgba(b.color, a);
        ctx.lineWidth = b.r * (0.35 + i / pts.length * 0.6);
        ctx.lineCap = "round";
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawChute(now, th) {
      const cx = W / 2;
      const y = 28;
      const active = balls.length > 0;
      ctx.save();
      ctx.translate(cx, y);
      const w = 74;
      const h = 26;
      const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, h);
      grad.addColorStop(0, "rgba(24,18,45,0.95)");
      grad.addColorStop(1, "rgba(10,8,20,0.95)");
      roundRect(ctx, -w / 2, 0, w, h, 13);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = U.hexToRgba(active ? th.a : "#ffffff", active ? 0.55 : 0.12);
      ctx.lineWidth = 1.1;
      ctx.stroke();
      // lumières
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-18 + i * 18, 13, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = active ? U.hexToRgba(i === 1 ? th.c : th.a, 0.85) : "rgba(255,255,255,0.16)";
        if (active) {
          ctx.shadowColor = i === 1 ? th.c : th.a;
          ctx.shadowBlur = 8;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = "rgba(255,255,255,0.38)";
      ctx.font = "600 7px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("DROP", 0, 13);
      // cône
      ctx.beginPath();
      ctx.moveTo(-20, h);
      ctx.lineTo(20, h);
      ctx.lineTo(7, 31);
      ctx.lineTo(-7, 31);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      ctx.fill();
      ctx.restore();
    }

    function drawPeg(p, now, th) {
      if (destroyedPegs.has(p.key)) return;
      const pulse = 0.5 + Math.sin(now * 0.002 + p.x * 0.02 + p.y * 0.01) * 0.2;
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 13);
      glow.addColorStop(0, U.hexToRgba(p.color, 0.28 * pulse));
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
      ctx.fill();
      // sphère
      const sphere = ctx.createRadialGradient(p.x - 1, p.y - 1.5, 0.3, p.x, p.y, p.radius + 1);
      sphere.addColorStop(0, "#ffffff");
      sphere.addColorStop(0.35, U.hexToRgba(p.color, 0.95));
      sphere.addColorStop(1, U.hexToRgba(p.color, 0.15));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = sphere;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    function binColors(mult) {
      const max = Math.max(...profile, 1);
      const t = U.clamp(mult / max, 0, 1);
      if (t > 0.7) return { top: "rgba(255,200,87,0.9)", bottom: "rgba(120,60,8,0.95)", text: "#fff4c7", glow: "#ffc857" };
      if (t > 0.35) return { top: "rgba(168,85,247,0.8)", bottom: "rgba(55,19,90,0.95)", text: "#f3e8ff", glow: "#a855f7" };
      if (t > 0.08) return { top: "rgba(59,130,246,0.65)", bottom: "rgba(18,34,68,0.95)", text: "#dbeafe", glow: "#60a5fa" };
      return { top: "rgba(45,55,80,0.75)", bottom: "rgba(12,17,30,0.95)", text: "rgba(210,220,240,0.65)", glow: "#64748b" };
    }

    function drawBin(bin, i, now, th) {
      const m = profile[i] || 1;
      const colors = binColors(m);
      const flash = binFlash[i] ? U.clamp(1 - (now - binFlash[i]) / 520, 0, 1) : 0;
      const scale = 1 + flash * 0.09;
      const w = bin.w * scale;
      const h = bin.h * scale;
      const x = bin.x - w / 2;
      const y = bin.top - h / 2 + bin.h / 2;
      ctx.save();
      if (flash > 0) {
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 22;
      }
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, colors.top);
      grad.addColorStop(1, colors.bottom);
      roundRect(ctx, x, y, w, h, 8);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = flash > 0 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.12)";
      ctx.lineWidth = flash > 0 ? 1.6 : 0.9;
      ctx.stroke();
      // reflet supérieur
      ctx.beginPath();
      ctx.moveTo(x + 5, y + 4);
      ctx.lineTo(x + w - 5, y + 4);
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 1;
      ctx.stroke();
      // texte
      ctx.fillStyle = colors.text;
      ctx.font = `700 ${U.clamp(W / (bins.length * 5.2), 7.5, 12.5)}px "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(binLabel(m), bin.x, y + h / 2 + 1);
      if (m >= 10) {
        const cap = ctx.createRadialGradient(bin.x, y + 10, 0, bin.x, y + 10, w * 0.8);
        cap.addColorStop(0, U.hexToRgba(colors.glow, 0.22));
        cap.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = cap;
        ctx.fillRect(x, y, w, h);
      }
      if (flash > 0) {
        ctx.beginPath();
        ctx.arc(bin.x, y + h / 2, w * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = U.hexToRgba(colors.glow, flash * 0.7);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawBall(b, now) {
      const alpha = b.special === "ghost" ? 0.55 : 1;
      if (b.special === "rainbow") {
        const hue = (now * 0.25 + b.seed * 20) % 360;
        b.color = `hsl(${hue}, 100%, 65%)`;
      }
      const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 23);
      glow.addColorStop(0, U.hexToRgba(b.color, 0.38));
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 23, 0, Math.PI * 2);
      ctx.fill();
      // corps
      const sphere = ctx.createRadialGradient(b.x - 2, b.y - 2.5, 0.5, b.x, b.y, b.r + 1.5);
      sphere.addColorStop(0, "#ffffff");
      sphere.addColorStop(0.3, b.color);
      sphere.addColorStop(1, U.hexToRgba(b.color, 0.25));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = sphere;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(b.x - 2, b.y - 2.5, b.r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.7 * alpha})`;
      ctx.fill();
      // aura spéciale
      if (b.special) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 5 + Math.sin(now * 0.008 + b.seed) * 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = U.hexToRgba(b.color, 0.35);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // ---------- boucle ----------
    function loop(now) {
      if (destroyed) return;
      const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
      lastTime = now;
      if (balls.length) {
        updatePhysics(dt);
        if (balls.length === 0) updateActive();
      } else {
        updateParticles(dt);
      }
      Object.keys(binFlash).forEach((key) => {
        if (now - binFlash[key] > 900) delete binFlash[key];
      });
      // trails
      balls.forEach((b) => {
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 8) b.trail.shift();
      });
      draw(now, dt);
      const activeFx = balls.length || particles.length || Object.keys(binFlash).length;
      if (activeFx || !App.state.data.settings.reducedMotion) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = null;
        draw(performance.now(), 0);
      }
    }

    // ---------- HUD / interface ----------
    function updateHeader() {
      const plays = container.querySelector("#plinko-plays");
      const best = container.querySelector("#plinko-best");
      const won = container.querySelector("#plinko-won");
      const active = container.querySelector("#plinko-active");
      const luck = container.querySelector("#plinko-luck");
      if (plays) plays.textContent = U.fmt(g.stats.plays);
      if (best) best.textContent = U.fmtMult(bestSession || 1);
      if (won) won.textContent = U.fmt(sessionWon);
      const session = container.querySelector("#plinko-session");
      if (session) session.textContent = U.fmt(sessionWon);
      if (luck) luck.textContent = Math.round(luckTotal()) + " %";
      updateActive();
      updateFreeIndicator();
    }

    function updateActive() {
      const el = container.querySelector("#plinko-active");
      if (el) el.textContent = balls.length + " / " + maxBalls();
      const live = container.querySelector("#plinko-live-count");
      if (live) live.textContent = balls.length;
    }

    function updateFreeIndicator() {
      const el = container.querySelector("#plinko-free");
      if (!el) return;
      if (d.charges.freePlinko > 0) {
        el.classList.remove("hidden");
        el.innerHTML = `🎁 <strong>${d.charges.freePlinko}</strong> offerte${d.charges.freePlinko > 1 ? "s" : ""}`;
      } else {
        el.classList.add("hidden");
      }
    }

    function renderBetControl() {
      const el = container.querySelector("#plinko-bet");
      if (!el) return;
      const bet = currentBet();
      const options = betOptions();
      el.innerHTML = `
        <div class="bet-display">
          <span class="chip-symbol">🪙</span>
          <div><span class="bet-label">Mise</span><strong>${U.fmt(bet)}</strong></div>
        </div>
        <div class="bet-stepper">
          <button class="bet-step" data-bet-dir="-1" aria-label="Réduire la mise">−</button>
          <button class="bet-step" data-bet-dir="1" aria-label="Augmenter la mise">+</button>
        </div>
        <button class="btn btn-ghost btn-sm" data-bet-max>MAX</button>
        <span class="muted" style="font-size:9px">Max ${U.fmt(options[options.length - 1])}</span>`;
    }

    function costOf(key) {
      const def = CFG.upgrades[key];
      const level = g.upgrades[key];
      if (def.costs) return def.costs[level];
      return Math.ceil(def.base * Math.pow(def.growth, level));
    }

    function upgradeInfo(key) {
      const def = CFG.upgrades[key];
      const level = g.upgrades[key];
      const max = key === "mult" ? def.costs.length : def.max;
      const maxed = level >= max;
      let levelLabel = "Niv. " + level;
      if (key === "balls") levelLabel = maxBalls() + " max";
      else if (key === "rows") levelLabel = currentRows() + " rangées";
      else if (key === "mult") levelLabel = "Palier " + level + " · bord " + U.fmtMult(currentEdge());
      else if (key === "bet") levelLabel = "Max " + U.fmt(betOptions()[betOptions().length - 1]);
      else if (key === "luck") levelLabel = "+" + (level * CFG.luckPerLevel).toFixed(1) + " %";
      else if (key === "speed") levelLabel = level ? "Niv. " + level : "Normal";
      else if (key === "auto") levelLabel = level === 0 ? "Toutes les 2,4 s" : (autoInterval() / 1000).toFixed(1) + " s";
      return { def, level, maxed, levelLabel, cost: maxed ? 0 : costOf(key) };
    }

    function renderSide() {
      const side = container.querySelector("#plinko-side");
      if (!side) return;
      side.innerHTML = `
        <div class="plinko-tabs">
          ${[["upgrades", "Améliorations"], ["specials", "Billes"], ["powers", "Pouvoirs"], ["tables", "Tables"]].map(([id, label]) => `<button class="tab ${activeTab === id ? "active" : ""}" data-plinko-tab="${id}">${label}</button>`).join("")}
        </div>
        <div id="plinko-tab-content"></div>`;
      const content = side.querySelector("#plinko-tab-content");
      if (activeTab === "upgrades") {
        content.innerHTML = `
          <div class="panel"><div class="panel-head"><h3>⚡ Améliorations</h3><span class="panel-hint">Jetons</span></div><div class="panel-body" style="padding:10px"><div class="upgrade-list">
            ${["balls", "rows", "mult", "bet", "luck", "speed", "auto"].map((key) => {
              const info = upgradeInfo(key);
              return `<div class="upgrade-row ${info.maxed ? "maxed" : ""}">
                <span class="upgrade-icon">${info.def.icon}</span>
                <div class="upgrade-main">
                  <div class="upgrade-name">${info.def.name}</div>
                  <div class="upgrade-desc">${info.def.desc}</div>
                  <div class="upgrade-meta"><span class="upgrade-level">${info.levelLabel}</span></div>
                </div>
                <button class="btn btn-xs ${info.maxed ? "btn-ghost maxed" : "btn-ghost upgrade-buy"} ${!info.maxed && d.tokens >= info.cost ? "affordable" : ""}" data-buy="${key}" ${info.maxed ? "disabled" : ""}>
                  ${info.maxed ? "MAX" : `<span class="cost">🪙 ${U.fmt(info.cost)}</span>`}
                </button>
              </div>`;
            }).join("")}
          </div></div></div>
          <div class="panel"><div class="panel-body" style="padding:10px 12px;display:flex;gap:8px;align-items:center;justify-content:space-between">
            <div><div style="font-size:9px;color:var(--muted-2);text-transform:uppercase;letter-spacing:.1em">Chance</div><div style="font-family:var(--mono);font-size:15px;color:var(--cyan)">${Math.round(luckTotal())} %</div></div>
            <div style="text-align:right"><div style="font-size:9px;color:var(--muted-2);text-transform:uppercase;letter-spacing:.1em">Billes d'or</div><div style="font-family:var(--mono);font-size:15px;color:var(--gold)">🟡 ${U.fmt(d.goldBalls)}</div></div>
          </div></div>`;
      } else if (activeTab === "specials") {
        content.innerHTML = `<div class="panel"><div class="panel-head"><h3>🔮 Billes spéciales</h3><span class="panel-hint">🟡 ${U.fmt(d.goldBalls)}</span></div><div class="panel-body" style="padding:10px"><div class="special-grid">
          ${Object.keys(CFG.specials).map((key) => {
            const def = CFG.specials[key];
            const level = g.specials[key];
            const maxed = level >= def.maxLevel;
            const cost = level === 0 ? def.cost : def.cost * (level + 1);
            const chance = level === 0 ? 0 : (def.chance + (level - 1) * def.chancePerLevel) * 100;
            return `<div class="special-card ${level ? "unlocked" : "locked"}">
              <span class="special-icon">${def.icon}</span>
              <div style="min-width:0"><div class="special-name">${def.name}</div><div class="special-chance">${level ? "Niv. " + level + " · " + chance.toFixed(1) + " %" : "Verrouillée"}</div></div>
              ${maxed ? `<span class="special-buy">MAX</span>` : `<button class="special-buy ${d.goldBalls >= cost ? "can" : ""}" data-special="${key}">${cost} 🟡</button>`}
            </div>`;
          }).join("")}
        </div><p class="muted" style="font-size:9px;line-height:1.5;margin-top:9px">Une seule bille spéciale peut se déclencher par chute. Les billes d'or s'obtiennent avec les ×25, les succès et les synergies.</p></div></div>`;
      } else if (activeTab === "powers") {
        content.innerHTML = `<div class="panel"><div class="panel-head"><h3>⚡ Pouvoirs actifs</h3><span class="panel-hint">Cooldowns</span></div><div class="panel-body" style="padding:10px"><div class="power-grid">
          ${Object.keys(CFG.powers).map((key) => {
            const def = CFG.powers[key];
            const unlocked = !!g.powers[key];
            const remaining = Math.max(0, (g.powerReady[key] || 0) - Date.now());
            const ready = unlocked && remaining <= 0;
            return `<button class="power-btn ${unlocked ? "unlocked" : ""}" data-power="${key}" ${unlocked && remaining > 0 ? "disabled" : ""} title="${def.desc}">
              <span class="power-icon">${def.icon}</span>
              <span>${unlocked ? def.name : def.cost + " 🟡"}</span>
              ${unlocked && remaining > 0 ? `<span class="power-cd" style="--cd:${Math.min(100, remaining / def.cooldownMs * 100)}%"></span>` : ""}
              ${ready ? `<span class="power-ready"></span>` : ""}
            </button>`;
          }).join("")}
        </div><p class="muted" style="font-size:9px;line-height:1.5;margin-top:9px">Débloquez les pouvoirs avec des billes d'or. Ils se rechargent même hors-ligne.</p></div></div>`;
      } else {
        content.innerHTML = `<div class="panel"><div class="panel-head"><h3>🎴 Tables</h3><span class="panel-hint">Plateaux</span></div><div class="panel-body" style="padding:10px"><div class="table-list">
          ${CFG.tables.map((t) => {
            const unlocked = g.unlockedTables.includes(t.id);
            const active = g.table === t.id;
            return `<button class="table-option ${active ? "active" : ""}" data-table="${t.id}">
              <span class="table-icon">${t.icon}</span>
              <span class="table-info"><span class="table-name">${t.name}</span><span class="table-desc">${t.desc}</span></span>
              <span class="table-cost">${active ? "✓" : unlocked ? "" : t.currency === "gems" ? t.cost + " 💎" : "🪙 " + U.fmt(t.cost)}</span>
            </button>`;
          }).join("")}
        </div></div></div>`;
      }
      updatePowerButtons();
    }

    function updatePowerButtons() {
      if (activeTab !== "powers") return;
      container.querySelectorAll("[data-power]").forEach((btn) => {
        const key = btn.dataset.power;
        const def = CFG.powers[key];
        const unlocked = !!g.powers[key];
        const remaining = Math.max(0, (g.powerReady[key] || 0) - Date.now());
        const cd = btn.querySelector(".power-cd");
        if (unlocked && remaining > 0) {
          btn.disabled = true;
          if (cd) {
            cd.style.display = "block";
            cd.style.setProperty("--cd", Math.min(100, remaining / def.cooldownMs * 100) + "%");
          }
          let label = btn.querySelector(".power-label");
          if (!label) {
            label = document.createElement("span");
            label.className = "power-label";
            btn.appendChild(label);
          }
          label.textContent = U.formatCountdown(remaining);
        } else if (unlocked) {
          btn.disabled = false;
          if (cd) cd.style.display = "none";
          const label = btn.querySelector(".power-label");
          if (label) label.textContent = "Prêt";
        }
      });
    }

    // ---------- actions ----------
    function buyUpgrade(key) {
      const info = upgradeInfo(key);
      if (info.maxed) return;
      if (!App.meta.spend("tokens", info.cost)) {
        App.audio.play("error");
        App.ui.toast("Pas assez de jetons", "Il manque " + U.fmt(info.cost - d.tokens) + " jetons.", "🪙", "danger");
        return;
      }
      g.upgrades[key] = Math.min(g.upgrades[key] + 1, CFG.upgrades[key].max || (CFG.upgrades[key].costs ? CFG.upgrades[key].costs.length : 999));
      if (key === "rows") destroyedPegs = new Set();
      App.audio.play("purchase");
      App.fx.burst(window.innerWidth * 0.7, window.innerHeight * 0.4, { colors: [theme().a, "#ffc857"], count: 18 });
      App.ui.toast("Amélioration achetée", info.def.name, info.def.icon, "gold");
      App.state.saveSoon();
      layout();
      renderSide();
      renderBetControl();
      updateHeader();
      App.meta.checkAchievements();
    }

    function buySpecial(key) {
      const def = CFG.specials[key];
      const level = g.specials[key];
      if (level >= def.maxLevel) return;
      const cost = level === 0 ? def.cost : def.cost * (level + 1);
      if (!App.meta.spend("goldBalls", cost)) {
        App.audio.play("error");
        App.ui.toast("Billes d'or insuffisantes", "Il vous faut " + cost + " billes d'or.", "🟡", "danger");
        return;
      }
      g.specials[key] = level + 1;
      App.audio.play("unlock");
      App.fx.starBurst(window.innerWidth / 2, window.innerHeight / 2, 16);
      App.ui.toast(level === 0 ? "Bille spéciale débloquée" : "Bille améliorée", def.name + " · niveau " + (level + 1), def.icon, "gold");
      App.state.saveSoon();
      renderSide();
    }

    function usePower(key) {
      const def = CFG.powers[key];
      if (!g.powers[key]) {
        if (!App.meta.spend("goldBalls", def.cost)) {
          App.audio.play("error");
          App.ui.toast("Billes d'or insuffisantes", "Il vous faut " + def.cost + " billes d'or.", "🟡", "danger");
          return;
        }
        g.powers[key] = true;
        g.powerReady[key] = 0;
        App.audio.play("unlock");
        App.ui.toast("Pouvoir débloqué", def.name + " est prêt.", def.icon, "gold");
        App.state.saveSoon();
        renderSide();
        return;
      }
      if (Date.now() < (g.powerReady[key] || 0)) return;
      if (key === "rain") {
        g.powerReady[key] = Date.now() + def.cooldownMs;
        for (let i = 0; i < 10; i++) {
          setTimeout(() => {
            if (!destroyed) dropBall({ free: true, force: true, silent: true });
          }, i * 85);
        }
        App.ui.toast("Pluie de billes", "10 billes gratuites s'abattent sur le plateau.", "🌧️", "gold");
        App.fx.rain("🔵", 10);
        App.audio.play("whoosh");
      } else if (key === "luck") {
        g.powerReady[key] = Date.now() + def.cooldownMs;
        luckStormUntil = Date.now() + def.durationMs;
        App.meta.addBuff("plinkoLuck", def.bonus, def.durationMs, "Tempête de chance", "🌪️");
        App.ui.toast("Tempête de chance", "+25 % de chance de bords pendant 20 s.", "🌪️", "gold");
        App.fx.flash("rgba(34,211,238,0.12)", 0.4);
        App.audio.play("unlock");
      } else if (key === "jackpot") {
        g.powerReady[key] = Date.now() + def.cooldownMs;
        forcedNext = true;
        App.ui.toast("Jackpot forcé", "La prochaine bille vise le bord maximal.", "🎯", "gold");
        App.fx.rings(window.innerWidth / 2, window.innerHeight / 2, { size: 10, grow: 260, color: "#ffc857", life: 0.7 });
        App.audio.play("whoosh");
      }
      App.state.saveSoon();
      renderSide();
    }

    function chooseTable(id) {
      const t = CFG.tables.find((x) => x.id === id);
      if (!t) return;
      if (!g.unlockedTables.includes(id)) {
        if (t.cost > 0) {
          if (!App.meta.spend(t.currency, t.cost)) {
            App.audio.play("error");
            App.ui.toast("Fonds insuffisants", "Il vous faut " + U.fmt(t.cost) + " " + (t.currency === "gems" ? "gemmes" : "jetons") + ".", t.icon, "danger");
            return;
          }
          g.unlockedTables.push(id);
          App.ui.toast("Table débloquée", t.name + " rejoint votre collection.", t.icon, "gold");
        }
      }
      g.table = id;
      App.audio.play("purchase");
      App.fx.confetti(30);
      App.state.saveSoon();
      layout();
      renderSide();
      updateHeader();
    }

    function changeBet(dir) {
      const options = betOptions();
      let idx = U.clamp(g.betIndex, 0, options.length - 1);
      if (dir === "max") idx = options.length - 1;
      else idx = U.clamp(idx + dir, 0, options.length - 1);
      g.betIndex = idx;
      App.audio.play("tick");
      renderBetControl();
      App.state.saveSoon();
    }

    function toggleAuto() {
      g.autoOn = !g.autoOn;
      App.audio.play("click");
      setupAuto();
      const btn = container.querySelector("#plinko-auto");
      if (btn) {
        btn.classList.toggle("btn-primary", g.autoOn);
        btn.classList.toggle("btn-ghost", !g.autoOn);
        btn.innerHTML = g.autoOn ? "⏸ Auto actif" : "▶ Auto";
      }
      App.state.saveSoon();
    }

    function setupAuto() {
      if (autoTimer) clearInterval(autoTimer);
      autoTimer = null;
      if (!g.autoOn) return;
      autoTimer = setInterval(() => {
        if (document.hidden || !g.autoOn) return;
        if (balls.length >= maxBalls()) return;
        if (!App.meta.canAfford("tokens", currentBet()) && d.charges.freePlinko <= 0) {
          g.autoOn = false;
          setupAuto();
          App.ui.toast("Auto-drop arrêté", "Plus assez de jetons pour la mise actuelle.", "🤖", "danger");
          const btn = container.querySelector("#plinko-auto");
          if (btn) { btn.classList.remove("btn-primary"); btn.classList.add("btn-ghost"); btn.innerHTML = "▶ Auto"; }
          return;
        }
        dropBall({ silent: true });
        if (g.upgrades.auto >= 3 && Math.random() < 0.35) {
          for (let i = 0; i < 3 && balls.length < maxBalls(); i++) dropBall({ silent: true });
        }
      }, autoInterval());
    }

    // ---------- grosse interface ----------
    const gm = App.meta.gameMeta("plinko");
    container.innerHTML = `
      <div class="game-header">
        <div class="game-title-wrap">
          <span class="game-title-icon">${gm.icon}</span>
          <div><h1>Plinko</h1><p>${gm.tagline}</p></div>
        </div>
        <div class="game-header-stats">
          <span class="game-stat-chip">Parties <strong id="plinko-plays">${U.fmt(g.stats.plays)}</strong></span>
          <span class="game-stat-chip">Meilleur <strong id="plinko-best">${U.fmtMult(bestSession || 1)}</strong></span>
          <span class="game-stat-chip">Session <strong id="plinko-won">${U.fmt(sessionWon)}</strong></span>
          <span class="game-stat-chip">Billes <strong id="plinko-active">0 / ${maxBalls()}</strong></span>
          <span class="game-stat-chip">Chance <strong id="plinko-luck">${Math.round(luckTotal())} %</strong></span>
          <span class="game-stat-chip" style="color:var(--gold)">🟡 <strong>${U.fmt(d.goldBalls)}</strong></span>
        </div>
      </div>
      <div class="game-layout wide-side">
        <section class="game-stage plinko-stage">
          <div class="plinko-top">
            <div class="plinko-players">
              <span class="badge live"><span class="live-dot"></span> EN DIRECT</span>
              <span class="plinko-live"><span class="live-dot"></span> <span id="plinko-live-count">0</span> bille(s) en chute</span>
              <span id="plinko-free" class="hidden"></span>
            </div>
            <div class="plinko-session"><span>Gains de session</span><strong id="plinko-session">${U.fmt(sessionWon)}</strong></div>
          </div>
          <div class="plinko-canvas-wrap" id="plinko-canvas-wrap">
            <div class="plinko-canvas-glow"></div>
            <canvas id="plinko-canvas" aria-label="Plateau de Plinko"></canvas>
          </div>
          <div class="plinko-bottom">
            <div id="plinko-bet"></div>
            <button class="btn btn-primary plinko-drop-btn" id="plinko-drop">LÂCHER UNE BILLE</button>
            <button class="btn btn-ghost" id="plinko-auto" data-auto>${g.autoOn ? "⏸ Auto actif" : "▶ Auto"}</button>
          </div>
        </section>
        <aside class="game-side">
          <div id="plinko-side"></div>
          <div class="panel"><div class="panel-body" style="padding:11px 12px">
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted)"><span>Table</span><strong style="color:var(--text-soft)">${table().name}</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:4px"><span>Rangées</span><strong style="color:var(--text-soft)">${currentRows()}</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:4px"><span>Espérance</span><strong style="color:var(--green)">${Math.round((CFG.tierEV[tier()] + (tableMods().payout || 0)) * 100)} %</strong></div>
          </div></div>
        </aside>
      </div>`;

    wrap = container.querySelector("#plinko-canvas-wrap");
    canvas = container.querySelector("#plinko-canvas");
    ctx = canvas.getContext("2d");
    layout();
    resize();
    renderSide();
    renderBetControl();
    updateHeader();

    resizeObs = new ResizeObserver((entries) => {
      const w = entries[0] ? entries[0].contentRect.width : 0;
      if (Math.abs(w - lastObservedWidth) < 0.5) return;
      lastObservedWidth = w;
      if (!destroyed) {
        resize();
        draw(performance.now(), 0);
      }
    });
    resizeObs.observe(wrap);

    const onClick = (e) => {
      const tab = e.target.closest("[data-plinko-tab]");
      if (tab) { activeTab = tab.dataset.plinkoTab; renderSide(); return; }
      const buy = e.target.closest("[data-buy]");
      if (buy) { buyUpgrade(buy.dataset.buy); return; }
      const special = e.target.closest("[data-special]");
      if (special) { buySpecial(special.dataset.special); return; }
      const power = e.target.closest("[data-power]");
      if (power) { usePower(power.dataset.power); return; }
      const tableEl = e.target.closest("[data-table]");
      if (tableEl) { chooseTable(tableEl.dataset.table); return; }
      const betDir = e.target.closest("[data-bet-dir]");
      if (betDir) { changeBet(parseInt(betDir.dataset.betDir, 10)); return; }
      if (e.target.closest("[data-bet-max]")) { changeBet("max"); return; }
      if (e.target.closest("#plinko-drop")) {
        if (dropBall({})) {
          const btn = e.target.closest("#plinko-drop");
          if (btn) {
            btn.classList.remove("pulse-once");
            void btn.offsetWidth;
            btn.classList.add("pulse-once");
          }
        }
        return;
      }
      if (e.target.closest("#plinko-auto")) { toggleAuto(); return; }
    };
    container.addEventListener("click", onClick);

    uiTimer = setInterval(() => {
      if (activeTab === "powers") updatePowerButtons();
      updateHeader();
      const session = container.querySelector("#plinko-session");
      if (session) session.textContent = U.fmt(sessionWon);
    }, 1000);

    setupAuto();
    lastTime = performance.now();
    raf = requestAnimationFrame(loop);
    updateFreeIndicator();

    const onAutoBuy = () => {
      if (destroyed) return;
      layout();
      renderSide();
      renderBetControl();
      updateHeader();
      App.state.saveSoon();
    };
    App.bus.on("autobuy", onAutoBuy);

    const onVisibility = () => {
      if (destroyed) return;
      if (document.hidden) {
        hiddenAt = performance.now();
        return;
      }
      if (!hiddenAt) return;
      const away = Math.min(18000, performance.now() - hiddenAt);
      hiddenAt = 0;
      if (balls.length) {
        let remaining = away / 1000;
        let guard = 0;
        lastTime = performance.now();
        while (remaining > 0 && balls.length && guard < 400) {
          updatePhysics(0.05);
          remaining -= 0.05;
          guard++;
        }
        updateActive();
        updateHeader();
        draw(performance.now(), 0);
        App.state.saveSoon();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const cleanup = () => {
      destroyed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      App.bus.off("autobuy", onAutoBuy);
      if (autoTimer) clearInterval(autoTimer);
      if (uiTimer) clearInterval(uiTimer);
      if (raf) cancelAnimationFrame(raf);
      if (resizeObs) resizeObs.disconnect();
      container.removeEventListener("click", onClick);
      balls.forEach((b) => settleBall(b));
      balls = [];
      activeCleanup = null;
    };
    activeCleanup = cleanup;
    return cleanup;
  };

  App.games = App.games || {};
  App.games.plinko = Game;
})();
