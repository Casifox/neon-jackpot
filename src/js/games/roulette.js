/* ============================================================
   NEON JACKPOT — games/roulette.js
   Roulette européenne, roue dorée, multi-billes, auto-roulette
   ============================================================ */
(function () {
  "use strict";

  const App = window.App;
  const U = App.utils;
  const D = window.GAME_DATA;
  const CFG = D.balance.roulette;

  const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const SECTOR = (Math.PI * 2) / 37;
  const NEIGHBORS = new Set([0, 2, 3, 25, 26]);

  const Game = {};
  let activeCleanup = null;

  function isRed(n) { return RED.has(n); }
  function colorOf(n) { return n === 0 ? "green" : isRed(n) ? "red" : "black"; }
  function colorName(n) { return n === 0 ? "Vert" : isRed(n) ? "Rouge" : "Noir"; }

  Game.render = function (container) {
    if (activeCleanup) activeCleanup();
    const d = App.state.data;
    const g = d.games.roulette;
    let bets = g.lastBets ? Object.assign({}, g.lastBets) : {};
    let undoStack = [];
    let chip = g.chip || CFG.betSteps[0];
    let spinning = false;
    let spinState = null;
    let raf = null;
    let autoTimer = null;
    let lastWinners = [];
    let lastWinKeys = [];
    let lastResult = null;
    let wheelRotation = 0;
    let canvas = null;
    let ctx = null;
    let W = 0;
    let H = 0;
    let dpr = 1;
    let wrap = null;
    let resizeObs = null;
    let tickAt = 0;
    let activeTab = "upgrades";

    const chipOptions = () => CFG.betSteps.slice(0, Math.min(CFG.betSteps.length, 3 + g.upgrades.maxBet));
    const ballsCount = () => (g.upgrades.multiBall ? 2 : 1);
    const totalBets = () => Object.values(bets).reduce((s, v) => s + v, 0);
    const totalStake = () => totalBets() * ballsCount();
    const maxChip = () => chipOptions()[chipOptions().length - 1];

    // ---------------- Canvas roue ----------------
    function resize() {
      if (!canvas || !wrap) return;
      const rect = wrap.getBoundingClientRect();
      const size = Math.max(220, Math.min(360, rect.width));
      W = size;
      H = size;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(size * dpr);
      canvas.height = Math.floor(size * dpr);
      canvas.style.width = size + "px";
      canvas.style.height = size + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawWheel(wheelRotation, idleBalls(), null);
    }

    function idleBalls() {
      if (spinning || !lastWinners.length) return [];
      if (lastWinners.length === 1) {
        return [{ angle: -Math.PI / 2, radius: 0.76 }];
      }
      const positions = lastWinners.map((n) => WHEEL.indexOf(n));
      const local0 = (positions[0] + 0.5) * SECTOR;
      const local1 = (positions[1] + 0.5) * SECTOR;
      return [
        { angle: -Math.PI / 2, radius: 0.76 },
        { angle: -Math.PI / 2 + (local1 - local0), radius: 0.76 }
      ];
    }

    function drawWheel(rotation, balls, spin) {
      if (!ctx) return;
      const cx = W / 2;
      const cy = H / 2;
      const R = W * 0.46;
      ctx.clearRect(0, 0, W, H);

      // halo
      const halo = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.2);
      halo.addColorStop(0, "rgba(244,63,94,0.12)");
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.2, 0, Math.PI * 2);
      ctx.fill();

      // jante
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.98, 0, Math.PI * 2);
      const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      if (g.upgrades.goldenWheel) {
        rim.addColorStop(0, "#fde68a");
        rim.addColorStop(0.35, "#f59e0b");
        rim.addColorStop(0.65, "#ffc857");
        rim.addColorStop(1, "#92400e");
        ctx.shadowColor = "rgba(255,200,87,0.35)";
        ctx.shadowBlur = 24;
      } else {
        rim.addColorStop(0, "#4c1d95");
        rim.addColorStop(0.5, "#1e1030");
        rim.addColorStop(1, "#0b0714");
      }
      ctx.fillStyle = rim;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      // cases
      for (let i = 0; i < 37; i++) {
        const n = WHEEL[i];
        const start = rotation + i * SECTOR - Math.PI / 2;
        const end = start + SECTOR;
        const inner = R * 0.6;
        const outer = R * 0.9;
        ctx.beginPath();
        ctx.arc(cx, cy, outer, start, end);
        ctx.arc(cx, cy, inner, end, start, true);
        ctx.closePath();
        let fill = "#18181b";
        if (n === 0) fill = "#15803d";
        else if (isRed(n)) fill = "#b91c1c";
        const isWinner = lastWinners.includes(n) && !spinning;
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = isWinner ? "rgba(255,200,87,0.9)" : "rgba(255,255,255,0.08)";
        ctx.lineWidth = isWinner ? 2 : 0.8;
        ctx.stroke();
        if (isWinner) {
          ctx.save();
          ctx.globalAlpha = 0.35 + Math.sin(performance.now() * 0.008) * 0.15;
          ctx.fillStyle = "rgba(255,200,87,0.5)";
          ctx.fill();
          ctx.restore();
        }
        // numéro
        const mid = start + SECTOR / 2;
        ctx.save();
        ctx.translate(cx + Math.cos(mid) * R * 0.75, cy + Math.sin(mid) * R * 0.75);
        ctx.rotate(mid + Math.PI / 2);
        ctx.fillStyle = "#fff";
        ctx.font = `600 ${Math.max(7, W * 0.027)}px "JetBrains Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(n), 0, 0);
        ctx.restore();
      }

      // moyeu
      const hub = ctx.createRadialGradient(cx - R * 0.12, cy - R * 0.15, R * 0.05, cx, cy, R * 0.58);
      hub.addColorStop(0, "rgba(255,255,255,0.16)");
      hub.addColorStop(0.4, "rgba(49,25,80,0.92)");
      hub.addColorStop(1, "rgba(8,6,16,0.98)");
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = hub;
      ctx.fill();
      ctx.strokeStyle = g.upgrades.goldenWheel ? "rgba(255,200,87,0.45)" : "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.stroke();
      ctx.fillStyle = g.upgrades.goldenWheel ? "#ffc857" : "rgba(255,255,255,0.5)";
      ctx.font = `800 ${Math.max(16, W * 0.07)}px Outfit, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("7", cx, cy + 1);

      // pointeur
      ctx.beginPath();
      ctx.moveTo(cx, cy - R * 0.99);
      ctx.lineTo(cx - 6, cy - R * 0.88);
      ctx.lineTo(cx + 6, cy - R * 0.88);
      ctx.closePath();
      ctx.fillStyle = "#ffc857";
      ctx.shadowColor = "rgba(255,200,87,0.6)";
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      // billes
      (balls || []).forEach((b, i) => {
        const radius = R * b.radius;
        const x = cx + Math.cos(b.angle) * radius;
        const y = cy + Math.sin(b.angle) * radius;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(3.5, W * 0.014), 0, Math.PI * 2);
        const bg = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 8);
        bg.addColorStop(0, "#ffffff");
        bg.addColorStop(0.55, i === 0 ? "#f8fafc" : "#fde68a");
        bg.addColorStop(1, i === 0 ? "rgba(148,163,184,0.25)" : "rgba(245,158,11,0.3)");
        ctx.fillStyle = bg;
        ctx.shadowColor = "rgba(255,255,255,0.8)";
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // petit logo "GOLDEN" si débloqué
      if (g.upgrades.goldenWheel) {
        ctx.fillStyle = "rgba(255,200,87,0.5)";
        ctx.font = `600 ${Math.max(6, W * 0.02)}px "JetBrains Mono", monospace`;
        ctx.textAlign = "center";
        ctx.fillText("ROUE DORÉE", cx, cy + R * 0.43);
      }
    }

    function animate() {
      if (!spinState) { raf = null; return; }
      const now = performance.now();
      const t = U.clamp((now - spinState.start) / spinState.duration, 0, 1);
      const eased = U.easeOutExpo(t);
      const rot = U.lerp(spinState.rotStart, spinState.rotEnd, eased);
      const balls = spinState.balls.map((b) => ({
        angle: U.lerp(b.startAngle, b.endAngle, eased),
        radius: U.lerp(1.03, 0.76, Math.pow(t, 3))
      }));
      drawWheel(rot, balls, spinState);
      if (now - tickAt > 90 && t < 0.92) {
        tickAt = now;
        App.audio.play("tick");
      }
      if (t < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        wheelRotation = spinState.rotEnd;
        drawWheel(wheelRotation, idleBalls(), null);
        raf = null;
        finishSpin();
      }
    }

    // ---------------- Paris ----------------
    function ratioFor(key) {
      if (key.startsWith("n:")) return CFG.payouts.straight;
      if (key === "neighbors") return 6;
      if (key.startsWith("dozen") || key.startsWith("col")) return CFG.payouts.dozen;
      return 1;
    }

    function betWins(key, n) {
      if (key.startsWith("n:")) return parseInt(key.slice(2), 10) === n;
      if (key === "red") return n !== 0 && isRed(n);
      if (key === "black") return n !== 0 && !isRed(n);
      if (key === "even") return n !== 0 && n % 2 === 0;
      if (key === "odd") return n !== 0 && n % 2 === 1;
      if (key === "low") return n >= 1 && n <= 18;
      if (key === "high") return n >= 19 && n <= 36;
      if (key === "dozen1") return n >= 1 && n <= 12;
      if (key === "dozen2") return n >= 13 && n <= 24;
      if (key === "dozen3") return n >= 25 && n <= 36;
      if (key === "col1") return n > 0 && n % 3 === 1;
      if (key === "col2") return n > 0 && n % 3 === 2;
      if (key === "col3") return n > 0 && n % 3 === 0;
      if (key === "neighbors") return NEIGHBORS.has(n);
      return false;
    }

    function placeBet(key) {
      if (spinning) return;
      if (key.startsWith("n:") && !g.upgrades.straight) {
        App.audio.play("error");
        App.ui.toast("Numéros verrouillés", "Achetez l'amélioration Numéros pleins.", "🔒", "danger");
        return;
      }
      if (["even", "odd", "low", "high", "dozen1", "dozen2", "dozen3", "col1", "col2", "col3"].includes(key) && !g.upgrades.outside) {
        App.audio.play("error");
        App.ui.toast("Mises extérieures verrouillées", "Achetez l'amélioration Mises extérieures.", "🔒", "danger");
        return;
      }
      if (key === "neighbors" && !g.upgrades.neighbors) {
        App.audio.play("error");
        App.ui.toast("Voisins verrouillés", "Achetez l'amélioration Voisins du zéro.", "🔒", "danger");
        return;
      }
      if (totalBets() + chip > d.tokens) {
        App.audio.play("error");
        App.ui.toast("Mise trop élevée", "Votre solde ne couvre pas ce jeton.", "🪙", "danger");
        return;
      }
      bets[key] = (bets[key] || 0) + chip;
      undoStack.push({ key, amount: chip });
      App.audio.play("tick");
      renderBoardArea();
      renderChips();
      updateStatus();
      if (g.autoOn) scheduleAuto();
    }

    function undo() {
      if (spinning) return;
      const last = undoStack.pop();
      if (!last) return;
      bets[last.key] = (bets[last.key] || 0) - last.amount;
      if (bets[last.key] <= 0) delete bets[last.key];
      App.audio.play("tick");
      renderBoardArea();
      renderChips();
      updateStatus();
    }

    function clearBets() {
      if (spinning) return;
      bets = {};
      undoStack = [];
      lastWinners = [];
      lastWinKeys = [];
      App.audio.play("click");
      renderBoardArea();
      renderChips();
      updateStatus();
      drawWheel(wheelRotation, [], null);
    }

    function repeatBets() {
      if (spinning || !g.lastBets) return;
      const sum = Object.values(g.lastBets).reduce((s, v) => s + v, 0);
      if (sum * ballsCount() > d.tokens) {
        App.audio.play("error");
        App.ui.toast("Jetons insuffisants", "Impossible de répéter cette mise.", "🪙", "danger");
        return;
      }
      bets = Object.assign({}, g.lastBets);
      undoStack = [];
      App.audio.play("click");
      renderBoardArea();
      renderChips();
      updateStatus();
    }

    function saveFavorite() {
      if (!g.upgrades.auto) {
        App.audio.play("error");
        App.ui.toast("Favori verrouillé", "Débloquez l'auto-roulette pour sauvegarder un schéma.", "🤖", "danger");
        return;
      }
      if (!totalBets()) {
        App.audio.play("error");
        return;
      }
      g.favorite = Object.assign({}, bets);
      App.ui.toast("Schéma enregistré", "Votre mise fétiche est sauvegardée.", "💾", "gold");
      App.state.saveSoon();
      renderBoardArea();
    }

    function loadFavorite() {
      if (!g.favorite) {
        App.audio.play("error");
        return;
      }
      bets = Object.assign({}, g.favorite);
      App.audio.play("click");
      renderBoardArea();
      renderChips();
      updateStatus();
    }

    // ---------------- Tour de roue ----------------
    function spin() {
      if (spinning) return;
      const stake = totalStake();
      if (!stake) {
        App.audio.play("error");
        App.ui.toast("Aucune mise", "Placez au moins un jeton sur le plateau.", "🎡", "danger");
        return;
      }
      if (!App.meta.canAfford("tokens", stake)) {
        App.audio.play("error");
        App.ui.toast("Jetons insuffisants", "Il vous manque " + U.fmt(stake - d.tokens) + " jetons.", "🪙", "danger");
        g.autoOn = false;
        renderBoardArea();
        return;
      }
      if (!App.meta.bet(stake, "roulette")) return;
      g.lastBets = Object.assign({}, bets);
      g.chip = chip;
      lastWinners = [];
      lastWinKeys = [];
      lastResult = null;
      spinning = true;

      const winners = [];
      for (let i = 0; i < ballsCount(); i++) {
        winners.push(WHEEL[Math.floor(Math.random() * WHEEL.length)]);
      }
      const pos0 = WHEEL.indexOf(winners[0]);
      const local0 = (pos0 + 0.5) * SECTOR;
      const targetRot = -local0;
      const current = wheelRotation;
      let delta = ((targetRot - current) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      delta += Math.PI * 2 * 6;
      const rotEnd = current + delta;

      const balls = winners.map((num, i) => {
        const pos = WHEEL.indexOf(num);
        const local = (pos + 0.5) * SECTOR;
        const endAngle = i === 0 ? -Math.PI / 2 : -Math.PI / 2 + (local - local0);
        return {
          number: num,
          startAngle: endAngle + Math.PI * 2 * (6 + i * 2),
          endAngle
        };
      });

      spinState = {
        start: performance.now(),
        duration: 5200,
        rotStart: current,
        rotEnd,
        balls,
        winners,
        stake,
        bets: Object.assign({}, bets)
      };
      App.audio.play("spin");
      renderBoardArea();
      renderChips();
      updateStatus();
      updateHistory();
      if (!raf) raf = requestAnimationFrame(animate);
    }

    function evaluateBall(number, betMap) {
      let winStake = 0;
      let profit = 0;
      let maxRatio = 0;
      const keys = [];
      Object.keys(betMap).forEach((key) => {
        const amount = betMap[key];
        if (!amount) return;
        if (betWins(key, number)) {
          const ratio = ratioFor(key);
          winStake += amount;
          profit += amount * ratio;
          maxRatio = Math.max(maxRatio, ratio);
          keys.push(key);
        }
      });
      return { winStake, profit, maxRatio, keys };
    }

    function finishSpin() {
      if (!spinState) return;
      const stateSnap = spinState;
      spinning = false;
      spinState = null;
      const winners = stateSnap.winners;
      let winStake = 0;
      let baseProfit = 0;
      let maxRatio = 0;
      const keys = new Set();
      let straightHit = false;
      winners.forEach((n) => {
        const res = evaluateBall(n, stateSnap.bets);
        winStake += res.winStake;
        baseProfit += res.profit;
        maxRatio = Math.max(maxRatio, res.maxRatio);
        res.keys.forEach((k) => keys.add(k));
        if (res.keys.some((k) => k.startsWith("n:"))) straightHit = true;
      });
      const golden = g.upgrades.goldenWheel ? CFG.goldenBonus : 0;
      const fetish = g.upgrades.fetish ? (g.fetishBonus || 0) : 0;
      const profitMult = App.meta.globalMult() * (1 + golden + fetish);
      const finalAmount = winStake + baseProfit * profitMult;
      const net = finalAmount - stateSnap.stake;

      lastWinners = winners;
      lastWinKeys = Array.from(keys);
      g.history.unshift(...winners);
      if (g.history.length > 14) g.history.length = 14;

      if (baseProfit > 0) {
        const mult = maxRatio + 1;
        App.meta.credit(finalAmount, "roulette", { stake: winStake, mult, silent: true });
        if (g.upgrades.fetish) {
          g.fetishBonus = Math.min(0.25, (g.fetishBonus || 0) + 0.01);
        }
        if (straightHit) {
          g.stats.straightHits += 1;
          App.meta.triggerSynergy("roulette_win_35", { number: winners[0] });
        }
        lastResult = {
          win: true,
          title: winners.map((n) => n + " " + colorName(n)).join(" · "),
          sub: "+" + U.fmt(finalAmount) + " jetons · " + U.fmtMult(mult),
          net
        };
        const wrapRect = wrap.getBoundingClientRect();
        const cx = wrapRect.left + wrapRect.width / 2;
        const cy = wrapRect.top + wrapRect.height / 2;
        App.fx.coinBurst(cx, cy, Math.max(60, finalAmount));
        App.fx.floatingText("+" + U.fmt(finalAmount), cx, cy - 30, { className: "win", duration: 1.5, size: 24 });
        if (mult >= 12 || net >= stateSnap.stake * 3) {
          App.fx.confetti(100);
          App.fx.shake(7, 500);
          App.audio.play("jackpot");
        } else {
          App.audio.play("win");
          App.fx.burst(cx, cy, { colors: ["#ffc857", "#ff8ae2", "#22d3ee"], count: 28 });
        }
        App.state.log("🎡", "Gain — Roulette", "+" + U.fmt(finalAmount));
      } else {
        g.fetishBonus = 0;
        App.meta.loss("roulette", { silent: true });
        lastResult = {
          win: false,
          title: winners.map((n) => n + " " + colorName(n)).join(" · "),
          sub: "La maison rafle " + U.fmt(stateSnap.stake) + " jetons.",
          net
        };
        App.audio.play("lose");
        App.fx.shake(3, 250);
        App.fx.floatingText("-" + U.fmt(stateSnap.stake), window.innerWidth / 2, window.innerHeight / 2, { className: "lose", duration: 1.2 });
      }

      drawWheel(wheelRotation, idleBalls(), null);
      updateStatus();
      updateHistory();
      renderBoardArea();
      renderChips();
      updateHeader();
      App.meta.checkAchievements();
      App.state.saveSoon();

      if (g.autoOn) scheduleAuto();
    }

    function scheduleAuto() {
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = null;
      if (!g.autoOn || spinning) return;
      autoTimer = setTimeout(() => {
        autoTimer = null;
        if (!g.autoOn) return;
        if (!totalBets()) {
          g.autoOn = false;
          renderBoardArea();
          App.ui.toast("Auto-roulette arrêtée", "Aucune mise à répéter.", "🤖", "danger");
          return;
        }
        if (!App.meta.canAfford("tokens", totalStake())) {
          g.autoOn = false;
          renderBoardArea();
          App.ui.toast("Auto-roulette arrêtée", "Solde insuffisant.", "🤖", "danger");
          return;
        }
        spin();
      }, 2400);
    }

    // ---------------- Rendu ----------------
    function chipBadge(key) {
      const amount = bets[key] || 0;
      if (!amount) return "";
      return `<span class="r-chip">${U.fmt(amount)}</span>`;
    }

    function numCell(n) {
      const locked = !g.upgrades.straight;
      const isWinner = lastWinners.includes(n);
      const col = Math.ceil(n / 3);
      const row = 3 - ((n - 1) % 3);
      const cls = ["r-cell", colorOf(n), isWinner ? "win" : "", locked ? "locked-cell" : ""].join(" ");
      return `<button class="${cls}" ${locked ? `data-need="straight"` : `data-bet="n:${n}"`} style="grid-column:${col};grid-row:${row}" aria-label="${n} ${colorName(n)}">${n}${chipBadge("n:" + n)}</button>`;
    }

    function outsideBtn(key, label, extraClass) {
      const unlocked = key === "neighbors" ? g.upgrades.neighbors :
        ["even", "odd", "low", "high"].includes(key) ? g.upgrades.outside : true;
      const cls = ["r-outside-btn", extraClass || "", lastWinKeys.includes(key) ? "win" : ""].join(" ");
      return `<button class="${cls}" ${unlocked ? `data-bet="${key}"` : `data-need="${key === "neighbors" ? "neighbors" : "outside"}"`}>${label}${chipBadge(key)}</button>`;
    }

    function renderBoardArea() {
      const area = container.querySelector("#roulette-board-area");
      if (!area) return;
      const lockedNumbers = !g.upgrades.straight;
      const numGrid = lockedNumbers
        ? `<div class="panel panel-pad" style="padding:18px;text-align:center;border-style:dashed;opacity:.8"><div style="font-size:22px;margin-bottom:5px">🔒</div><div style="font-size:11px;font-weight:600">Numéros pleins verrouillés</div><div class="muted" style="font-size:9.5px;margin-top:2px">Débloquez-les dans les améliorations pour miser sur un numéro (35:1).</div></div>`
        : `<div class="roulette-board">
            <button class="r-zero ${lastWinners.includes(0) ? "win" : ""}" ${lockedNumbers ? `data-need="straight"` : `data-bet="n:0"`}>0${chipBadge("n:0")}</button>
            <div class="r-number-grid">${Array.from({ length: 36 }, (_, i) => numCell(i + 1)).join("")}</div>
          </div>`;
      const outside = `
        <div class="r-outside">
          ${outsideBtn("red", "ROUGE", "red-bet")}
          ${outsideBtn("black", "NOIR", "black-bet")}
          ${g.upgrades.outside ? outsideBtn("even", "PAIR") : ""}
          ${g.upgrades.outside ? outsideBtn("odd", "IMPAIR") : ""}
          ${g.upgrades.outside ? outsideBtn("low", "1–18") : ""}
          ${g.upgrades.outside ? outsideBtn("high", "19–36") : ""}
          ${g.upgrades.outside ? outsideBtn("dozen1", "1re 12") : ""}
          ${g.upgrades.outside ? outsideBtn("dozen2", "2e 12") : ""}
          ${g.upgrades.outside ? outsideBtn("dozen3", "3e 12") : ""}
          ${g.upgrades.outside ? outsideBtn("col1", "COL. 1") : ""}
          ${g.upgrades.outside ? outsideBtn("col2", "COL. 2") : ""}
          ${g.upgrades.outside ? outsideBtn("col3", "COL. 3") : ""}
          ${g.upgrades.neighbors ? outsideBtn("neighbors", "VOISINS 0") : ""}
        </div>`;
      const autoBtn = `<button class="btn ${g.autoOn ? "btn-cyan" : "btn-ghost"} btn-sm" data-roulette-auto>${g.autoOn ? "⏸ Auto actif" : "▶ Auto"}</button>`;
      area.innerHTML = `
        <div class="roulette-chip-row">
          <span class="muted" style="font-size:9px;text-transform:uppercase;letter-spacing:.1em">Jeton</span>
          ${chipOptions().map((v) => `<button class="r-chip-choice ${chip === v ? "active" : ""}" data-chip="${v}">${U.fmt(v)}</button>`).join("")}
          <div class="roulette-total">Total engagé <strong>🪙 ${U.fmt(totalStake())}</strong>${ballsCount() > 1 ? `<span class="badge cyan">×${ballsCount()} billes</span>` : ""}</div>
        </div>
        <div class="roulette-board-scroll"><div class="roulette-board-inner">
          ${numGrid}
          ${outside}
        </div></div>
        <div class="roulette-controls">
          <button class="btn btn-ghost btn-sm" data-roulette-undo ${undoStack.length ? "" : "disabled"}>↶ Annuler</button>
          <button class="btn btn-ghost btn-sm" data-roulette-clear ${totalBets() ? "" : "disabled"}>Effacer</button>
          <button class="btn btn-ghost btn-sm" data-roulette-repeat ${g.lastBets ? "" : "disabled"}>Répéter</button>
          ${g.upgrades.auto ? `<button class="btn btn-ghost btn-sm" data-roulette-save-fav>${g.favorite ? "★ Favori" : "☆ Sauver"}</button>${g.favorite ? `<button class="btn btn-ghost btn-sm" data-roulette-load-fav>Charger</button>` : ""}` : ""}
          <button class="btn btn-primary" data-roulette-spin style="flex:2;min-width:150px" ${spinning ? "disabled" : ""}>${spinning ? "La bille tourne…" : "Lancer la bille"} · 🪙 ${U.fmt(totalStake())}</button>
          ${autoBtn}
        </div>`;
    }

    function renderChips() {
      renderBoardArea();
    }

    function updateStatus() {
      const el = container.querySelector("#roulette-status");
      if (!el) return;
      let title = "Placez vos jetons";
      let sub = "Rouge ou noir pour commencer. Les numéros pleins arrivent vite.";
      if (spinning) {
        title = "La bille tourne…";
        sub = "Le suspense est total.";
      } else if (lastResult) {
        title = lastResult.title;
        sub = lastResult.sub;
      } else if (totalBets()) {
        title = "Mise prête";
        sub = "Total engagé : " + U.fmt(totalStake()) + " jetons" + (ballsCount() > 1 ? " · " + ballsCount() + " billes" : "") + ".";
      }
      el.innerHTML = `<strong>${U.escapeHtml(title)}</strong><span>${U.escapeHtml(sub || "")}</span>`;
    }

    function updateHistory() {
      const el = container.querySelector("#roulette-history");
      if (!el) return;
      el.innerHTML = g.history.slice(0, 14).map((n) => `<span class="history-dot ${colorOf(n)}">${n}</span>`).join("");
    }

    function updateHeader() {
      const plays = container.querySelector("#roulette-plays");
      const wins = container.querySelector("#roulette-wins");
      const best = container.querySelector("#roulette-best");
      const fetish = container.querySelector("#roulette-fetish");
      if (plays) plays.textContent = U.fmt(g.stats.plays);
      if (wins) wins.textContent = U.fmt(g.stats.wins);
      if (best) best.textContent = U.fmt(g.stats.bestWin);
      if (fetish) fetish.textContent = g.upgrades.fetish ? "+" + Math.round((g.fetishBonus || 0) * 100) + " %" : "—";
    }

    function renderSide() {
      const side = container.querySelector("#roulette-side");
      if (!side) return;
      const rows = Object.keys(CFG.upgrades).map((key) => {
        const def = CFG.upgrades[key];
        const level = g.upgrades[key];
        const max = def.costs ? def.costs.length : (def.max || 1);
        const maxed = level >= max;
        const cost = maxed ? 0 : (def.costs ? def.costs[level] : (def.cost !== undefined ? def.cost : Math.ceil(def.base * Math.pow(def.growth, level))));
        let label = "";
        if (key === "maxBet") label = "Jeton max " + U.fmt(maxChip());
        else if (key === "outside") label = level ? "Pair, douzaines, colonnes" : "Rouge / noir uniquement";
        else if (key === "straight") label = level ? "Numéros 35:1" : "Verrouillé";
        else if (key === "neighbors") label = level ? "5 voisins du zéro" : "Verrouillé";
        else if (key === "goldenWheel") label = level ? "+10 % de gains" : "Non";
        else if (key === "multiBall") label = level ? "2 billes" : "1 bille";
        else if (key === "auto") label = level ? "Schémas & favoris" : "Répétition offerte";
        else if (key === "fetish") label = level ? "+" + Math.round((g.fetishBonus || 0) * 100) + " % fétiche" : "Non";
        return `<div class="upgrade-row ${maxed ? "maxed" : ""}">
          <span class="upgrade-icon">${def.icon}</span>
          <div class="upgrade-main">
            <div class="upgrade-name">${def.name}</div>
            <div class="upgrade-desc">${def.desc}</div>
            <div class="upgrade-meta"><span class="upgrade-level">${label}</span></div>
          </div>
          <button class="btn btn-xs ${maxed ? "btn-ghost maxed" : "btn-ghost upgrade-buy"} ${!maxed && d.tokens >= cost ? "affordable" : ""}" data-roulette-buy="${key}" ${maxed ? "disabled" : ""}>
            ${maxed ? "MAX" : `<span class="cost">🪙 ${U.fmt(cost)}</span>`}
          </button>
        </div>`;
      }).join("");
      side.innerHTML = `
        <div class="panel"><div class="panel-head"><h3>🎡 Améliorations</h3><span class="panel-hint">Jetons</span></div><div class="panel-body" style="padding:10px"><div class="upgrade-list">${rows}</div></div></div>
        <div class="panel"><div class="panel-body" style="padding:10px 12px">
          <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted)"><span>Roue</span><strong style="color:${g.upgrades.goldenWheel ? "var(--gold)" : "var(--text-soft)"}">${g.upgrades.goldenWheel ? "Dorée" : "Classique"}</strong></div>
          <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Billes par lancer</span><strong style="color:var(--cyan)">${ballsCount()}</strong></div>
          <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Mise fétiche</span><strong style="color:var(--pink-soft)">+${Math.round((g.fetishBonus || 0) * 100)} %</strong></div>
        </div></div>`;
    }

    // ---------------- Init ----------------
    const gm = App.meta.gameMeta("roulette");
    container.innerHTML = `
      <div class="game-header">
        <div class="game-title-wrap"><span class="game-title-icon">${gm.icon}</span><div><h1>Roulette</h1><p>${gm.tagline}</p></div></div>
        <div class="game-header-stats">
          <span class="game-stat-chip">Lancers <strong id="roulette-plays">${U.fmt(g.stats.plays)}</strong></span>
          <span class="game-stat-chip">Gains <strong id="roulette-wins">${U.fmt(g.stats.wins)}</strong></span>
          <span class="game-stat-chip">Meilleur <strong id="roulette-best">${U.fmt(g.stats.bestWin)}</strong></span>
          <span class="game-stat-chip">Fétiche <strong id="roulette-fetish">${g.upgrades.fetish ? "+" + Math.round((g.fetishBonus || 0) * 100) + " %" : "—"}</strong></span>
        </div>
      </div>
      <div class="game-layout wide-side">
        <section class="game-stage roulette-stage">
          <div class="roulette-layout">
            <div class="roulette-wheel-col">
              <div class="roulette-canvas-wrap" id="roulette-wrap"><canvas id="roulette-canvas"></canvas></div>
              <div class="roulette-status" id="roulette-status"></div>
              <div class="roulette-history" id="roulette-history"></div>
            </div>
            <div class="roulette-table-col" id="roulette-board-area"></div>
          </div>
        </section>
        <aside class="game-side" id="roulette-side"></aside>
      </div>`;

    wrap = container.querySelector("#roulette-wrap");
    canvas = container.querySelector("#roulette-canvas");
    ctx = canvas.getContext("2d");
    resize();
    renderBoardArea();
    renderSide();
    updateStatus();
    updateHistory();
    updateHeader();

    resizeObs = new ResizeObserver((entries) => {
      const w = entries[0] ? entries[0].contentRect.width : 0;
      if (Math.abs(w - (resizeObs._lastW || 0)) < 0.5) return;
      resizeObs._lastW = w;
      resize();
    });
    resizeObs.observe(wrap);

    const onClick = (e) => {
      if (e.target.closest("[data-roulette-need]")) {
        App.audio.play("error");
        App.ui.toast("Amélioration requise", "Achetez l'auto-roulette dans le panneau de droite.", "🔒", "danger");
        return;
      }
      const need = e.target.closest("[data-need]");
      if (need) {
        App.audio.play("error");
        App.ui.toast("Mise verrouillée", "Achetez l'amélioration correspondante dans le panneau de droite.", "🔒", "danger");
        return;
      }
      const chipEl = e.target.closest("[data-chip]");
      if (chipEl) {
        chip = parseInt(chipEl.dataset.chip, 10);
        g.chip = chip;
        App.audio.play("tick");
        renderBoardArea();
        updateStatus();
        App.state.saveSoon();
        return;
      }
      const betEl = e.target.closest("[data-bet]");
      if (betEl) { placeBet(betEl.dataset.bet); return; }
      if (e.target.closest("[data-roulette-undo]")) { undo(); return; }
      if (e.target.closest("[data-roulette-clear]")) { clearBets(); return; }
      if (e.target.closest("[data-roulette-repeat]")) { repeatBets(); return; }
      if (e.target.closest("[data-roulette-save-fav]")) { saveFavorite(); return; }
      if (e.target.closest("[data-roulette-load-fav]")) { loadFavorite(); return; }
      if (e.target.closest("[data-roulette-spin]")) { spin(); return; }
      const autoBtn = e.target.closest("[data-roulette-auto]");
      if (autoBtn) {
        g.autoOn = !g.autoOn;
        App.audio.play("click");
        renderBoardArea();
        if (g.autoOn) {
          if (!totalBets()) {
            App.ui.toast("Auto-roulette", "Placez d'abord une mise ou chargez un favori.", "🤖", "");
          } else {
            scheduleAuto();
          }
        } else if (autoTimer) {
          clearTimeout(autoTimer);
          autoTimer = null;
        }
        App.state.saveSoon();
        return;
      }
      const buy = e.target.closest("[data-roulette-buy]");
      if (buy) { buyUpgrade(buy.dataset.rouletteBuy); return; }
    };
    container.addEventListener("click", onClick);

    function buyUpgrade(key) {
      const def = CFG.upgrades[key];
      const level = g.upgrades[key];
      const max = def.costs ? def.costs.length : (def.max || 1);
      if (level >= max) return;
      const cost = def.costs ? def.costs[level] : (def.cost !== undefined ? def.cost : Math.ceil(def.base * Math.pow(def.growth, level)));
      if (!App.meta.spend("tokens", cost)) {
        App.audio.play("error");
        App.ui.toast("Pas assez de jetons", "Il manque " + U.fmt(cost - d.tokens) + " jetons.", "🪙", "danger");
        return;
      }
      g.upgrades[key] = level + 1;
      if (key === "maxBet") {
        chip = Math.min(chip, maxChip());
        g.chip = chip;
      }
      App.audio.play("purchase");
      App.fx.burst(window.innerWidth * 0.7, window.innerHeight * 0.45, { colors: ["#ff4fd8", "#ffc857"], count: 16 });
      App.ui.toast("Amélioration achetée", def.name, def.icon, "gold");
      App.meta.checkAchievements();
      App.state.saveSoon();
      renderSide();
      renderBoardArea();
      updateHeader();
    }

    updateHeader();

    const cleanup = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = null;
      if (resizeObs) resizeObs.disconnect();
      container.removeEventListener("click", onClick);
      if (spinning && spinState) {
        App.meta.refund(spinState.stake, "roulette");
        spinning = false;
        spinState = null;
      }
      activeCleanup = null;
    };
    activeCleanup = cleanup;
    if (g.autoOn && totalBets()) scheduleAuto();
    return cleanup;
  };

  App.games = App.games || {};
  App.games.roulette = Game;
})();
