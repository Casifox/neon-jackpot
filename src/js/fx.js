/* ============================================================
   NEON JACKPOT — fx.js
   Particules, confettis, secousses, textes flottants, fond animé
   ============================================================ */
(function () {
  "use strict";

  const App = window.App;
  const U = App.utils;

  const FX = {};

  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let W = 0;
  let H = 0;
  let particles = [];
  let raf = null;
  let lastTime = 0;
  let shakeUntil = 0;
  let quality = "high";
  let reduced = false;
  let bgCanvas = null;
  let bgCtx = null;
  let bgParticles = [];
  let bgRaf = null;
  let bgLast = 0;
  let shooting = null;
  let shootingTimer = 8;
  let hudPulseAt = 0;

  const COLORS = {
    pink: "#e2543a",
    violet: "#8e2f3c",
    cyan: "#7fcbb0",
    gold: "#ffc857",
    green: "#4ade80",
    red: "#ff5470",
    white: "#ffffff",
    blue: "#60a5fa"
  };

  FX.colors = COLORS;

  FX.init = function () {
    canvas = document.getElementById("fx-canvas");
    if (canvas) {
      ctx = canvas.getContext("2d");
      resize();
      window.addEventListener("resize", resize, { passive: true });
      loop(performance.now());
    }
    bgCanvas = document.getElementById("bg-canvas");
    if (bgCanvas) {
      bgCtx = bgCanvas.getContext("2d");
      resizeBg();
      window.addEventListener("resize", resizeBg, { passive: true });
      buildBg();
      bgLoop(performance.now());
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        if (bgRaf) cancelAnimationFrame(bgRaf);
        bgRaf = null;
      } else {
        if (!raf && canvas) loop(performance.now());
        if (!bgRaf && bgCanvas) bgLoop(performance.now());
      }
    });
    FX.setReducedMotion(!!(App.state && App.state.settings && App.state.settings.reducedMotion));
  };

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, quality === "high" ? 2 : 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resizeBg() {
    if (!bgCanvas) return;
    const bgDpr = Math.min(window.devicePixelRatio || 1, 1.5);
    bgCanvas.width = Math.floor(window.innerWidth * bgDpr);
    bgCanvas.height = Math.floor(window.innerHeight * bgDpr);
    bgCanvas.style.width = window.innerWidth + "px";
    bgCanvas.style.height = window.innerHeight + "px";
    bgCtx.setTransform(bgDpr, 0, 0, bgDpr, 0, 0);
  }

  FX.setQuality = function (q) {
    quality = q || "high";
    resize();
    buildBg();
  };

  FX.setReducedMotion = function (on) {
    reduced = !!on;
    if (bgCanvas) {
      buildBg();
      drawBgFrame(performance.now(), true);
    }
  };

  // ---------- Fond ----------
  function buildBg() {
    if (!bgCtx) return;
    const count = reduced ? 18 : quality === "low" ? 24 : quality === "medium" ? 42 : 64;
    bgParticles = [];
    for (let i = 0; i < count; i++) {
      bgParticles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.8 + 0.5,
        speed: Math.random() * 8 + 3,
        drift: Math.random() * 10 - 5,
        alpha: Math.random() * 0.35 + 0.08,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() < 0.45 ? COLORS.pink : Math.random() < 0.5 ? COLORS.cyan : COLORS.violet
      });
    }
    drawBgFrame(performance.now(), true);
  }

  function bgLoop(t) {
    if (!bgCtx) return;
    bgLoop._last = bgLoop._last || t;
    const dt = Math.min((t - bgLoop._last) / 1000, 0.05);
    bgLoop._last = t;
    if (!reduced) updateBg(dt);
    drawBgFrame(t, false);
    bgRaf = requestAnimationFrame(bgLoop);
  }

  function updateBg(dt) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const p of bgParticles) {
      p.y -= p.speed * dt;
      p.x += Math.sin(p.phase + p.y * 0.005) * p.drift * dt;
      if (p.y < -10) {
        p.y = h + 10;
        p.x = Math.random() * w;
      }
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
    }
    shootingTimer -= dt;
    if (!shooting && shootingTimer <= 0) {
      shootingTimer = U.rand(9, 20);
      shooting = {
        x: U.rand(w * 0.15, w * 0.8),
        y: U.rand(0, h * 0.4),
        vx: U.rand(240, 420),
        vy: U.rand(90, 180),
        life: 0,
        max: 1.1
      };
    }
    if (shooting) {
      shooting.x += shooting.vx * dt;
      shooting.y += shooting.vy * dt;
      shooting.life += dt;
      if (shooting.life > shooting.max) shooting = null;
    }
  }

  function drawBgFrame(t, staticFrame) {
    if (!bgCtx) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    bgCtx.clearRect(0, 0, w, h);
    bgCtx.globalCompositeOperation = "lighter";
    for (const p of bgParticles) {
      const twinkle = reduced ? 1 : 0.6 + Math.sin(t * 0.001 + p.phase) * 0.4;
      bgCtx.beginPath();
      bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      bgCtx.fillStyle = U.hexToRgba(p.color, p.alpha * twinkle);
      bgCtx.fill();
    }
    if (shooting && !reduced) {
      const prog = shooting.life / shooting.max;
      const grad = bgCtx.createLinearGradient(
        shooting.x, shooting.y,
        shooting.x - shooting.vx * 0.18, shooting.y - shooting.vy * 0.18
      );
      grad.addColorStop(0, `rgba(255,255,255,${0.55 * (1 - prog)})`);
      grad.addColorStop(0.3, `rgba(255,138,231,${0.25 * (1 - prog)})`);
      grad.addColorStop(1, "rgba(255,79,216,0)");
      bgCtx.strokeStyle = grad;
      bgCtx.lineWidth = 1.8;
      bgCtx.beginPath();
      bgCtx.moveTo(shooting.x, shooting.y);
      bgCtx.lineTo(shooting.x - shooting.vx * 0.18, shooting.y - shooting.vy * 0.18);
      bgCtx.stroke();
    }
    bgCtx.globalCompositeOperation = "source-over";
  }

  // ---------- Particules ----------
  const MAX_PARTICLES = 900;

  function add(p) {
    if (particles.length > MAX_PARTICLES) particles.splice(0, 40);
    p.age = 0;
    p.maxLife = p.life || 1;
    p.rot = p.rot || 0;
    p.vr = p.vr || 0;
    p.g = p.g === undefined ? 700 : p.g;
    p.drag = p.drag === undefined ? 0.995 : p.drag;
    p.type = p.type || "spark";
    particles.push(p);
  }

  FX.burst = function (x, y, opts) {
    opts = opts || {};
    const count = Math.round((opts.count || 26) * (quality === "low" ? 0.45 : quality === "medium" ? 0.75 : 1));
    const colors = opts.colors || [COLORS.pink, COLORS.violet, COLORS.cyan];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = U.rand(opts.minSpeed || 60, opts.maxSpeed || 320);
      add({
        type: "spark",
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (opts.up || 0),
        size: U.rand(1.5, 4),
        color: colors[Math.floor(Math.random() * colors.length)],
        life: U.rand(0.4, opts.life || 0.9),
        g: opts.g === undefined ? 500 : opts.g,
        drag: 0.985
      });
    }
  };

  FX.rings = function (x, y, opts) {
    opts = opts || {};
    add({
      type: "ring",
      x, y,
      vx: 0, vy: 0, g: 0, drag: 1,
      size: opts.size || 8,
      grow: opts.grow || 180,
      color: opts.color || COLORS.gold,
      life: opts.life || 0.6,
      maxLife: opts.life || 0.6,
      width: opts.width || 2
    });
  };

  FX.confetti = function (count) {
    const n = Math.round((count || 80) * (quality === "low" ? 0.4 : quality === "medium" ? 0.7 : 1));
    for (let i = 0; i < n; i++) {
      const colors = [COLORS.pink, COLORS.violet, COLORS.cyan, COLORS.gold, COLORS.green, "#ffffff"];
      add({
        type: "confetti",
        x: Math.random() * W,
        y: -20 - Math.random() * 120,
        vx: U.rand(-60, 60),
        vy: U.rand(80, 260),
        size: U.rand(3, 7),
        w: U.rand(4, 9),
        h: U.rand(2, 5),
        color: colors[Math.floor(Math.random() * colors.length)],
        life: U.rand(2.4, 4.2),
        g: 120,
        drag: 0.995,
        rot: Math.random() * Math.PI,
        vr: U.rand(-6, 6),
        sway: U.rand(0.5, 2),
        phase: Math.random() * Math.PI * 2
      });
    }
  };

  FX.coinBurst = function (x, y, amount, opts) {
    opts = opts || {};
    const count = Math.min(42, Math.max(8, Math.round((opts.count || Math.log10(Math.max(10, amount)) * 6) * (quality === "low" ? 0.5 : 1))));
    const hud = document.getElementById("hud-tokens");
    let tx = window.innerWidth - 120, ty = 46;
    if (hud) {
      const r = hud.getBoundingClientRect();
      tx = r.left + r.width / 2;
      ty = r.top + r.height / 2;
    }
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = U.rand(120, 420);
      add({
        type: "coin",
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - U.rand(60, 220),
        size: U.rand(4, 8),
        color: i % 6 === 0 ? COLORS.gold : (i % 4 === 0 ? "#ffe9a8" : COLORS.gold),
        life: U.rand(0.8, 1.35),
        g: 900,
        drag: 0.99,
        target: { x: tx, y: ty },
        homing: true,
        beginHoming: U.rand(0.25, 0.55)
      });
    }
  };

  FX.starBurst = function (x, y, count) {
    for (let i = 0; i < (count || 14); i++) {
      add({
        type: "star",
        x, y,
        vx: U.rand(-260, 260),
        vy: U.rand(-320, 80),
        size: U.rand(3, 8),
        color: [COLORS.gold, "#fff7d6", COLORS.pink][Math.floor(Math.random() * 3)],
        life: U.rand(0.6, 1.2),
        g: 380,
        drag: 0.985,
        rot: Math.random() * Math.PI,
        vr: U.rand(-5, 5)
      });
    }
  };

  FX.emojiBurst = function (x, y, emoji, count) {
    for (let i = 0; i < (count || 8); i++) {
      add({
        type: "emoji",
        x, y,
        vx: U.rand(-180, 180),
        vy: U.rand(-280, -40),
        size: U.rand(14, 28),
        color: "#fff",
        emoji: emoji,
        life: U.rand(0.7, 1.3),
        g: 600,
        drag: 0.99,
        rot: U.rand(-0.4, 0.4),
        vr: U.rand(-4, 4)
      });
    }
  };

  FX.floatingText = function (text, x, y, opts) {
    opts = opts || {};
    const layer = document.getElementById("float-layer");
    if (!layer) return;
    if (layer.childElementCount > 24) layer.firstElementChild.remove();
    const el = document.createElement("div");
    el.className = "float-text " + (opts.className || "");
    el.textContent = text;
    el.style.left = Math.round(x) + "px";
    el.style.top = Math.round(y) + "px";
    if (opts.color) el.style.color = opts.color;
    if (opts.size) el.style.fontSize = opts.size + "px";
    el.style.animationDuration = (opts.duration || 1.2) + "s";
    layer.appendChild(el);
    setTimeout(() => el.remove(), (opts.duration || 1.2) * 1000 + 100);
  };

  FX.floatAt = function (el, text, opts) {
    if (!el) {
      FX.floatingText(text, W / 2, H / 2, opts);
      return;
    }
    const r = el.getBoundingClientRect();
    FX.floatingText(text, r.left + r.width / 2, r.top + r.height / 2, opts);
  };

  FX.flash = function (color, duration) {
    if (reduced) return;
    const div = document.createElement("div");
    div.className = "screen-flash";
    div.style.background = color || "rgba(255,255,255,0.35)";
    div.style.animationDuration = (duration || 0.4) + "s";
    document.body.appendChild(div);
    setTimeout(() => div.remove(), (duration || 0.4) * 1000 + 50);
  };

  FX.shake = function (intensity, duration) {
    if (reduced) return;
    const app = document.getElementById("app");
    if (!app) return;
    const i = intensity || 6;
    const d = duration || 400;
    const frames = [];
    const steps = 8;
    for (let s = 0; s <= steps; s++) {
      const decay = 1 - s / steps;
      frames.push({
        transform: `translate(${U.rand(-i, i) * decay}px, ${U.rand(-i * 0.6, i * 0.6) * decay}px)`
      });
    }
    frames.push({ transform: "translate(0,0)" });
    try {
      app.animate(frames, { duration: d, easing: "ease-out" });
    } catch (_) {
      document.body.classList.add("shake");
      setTimeout(() => document.body.classList.remove("shake"), d);
    }
  };

  FX.hudPulse = function () {
    const now = performance.now();
    if (now - hudPulseAt < 120) return;
    hudPulseAt = now;
    const el = document.getElementById("hud-tokens");
    if (!el) return;
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
    setTimeout(() => el.classList.remove("bump"), 400);
    const pulse = document.getElementById("tokens-pulse");
    if (pulse) {
      pulse.classList.remove("on");
      void pulse.offsetWidth;
      pulse.classList.add("on");
      setTimeout(() => pulse.classList.remove("on"), 750);
    }
  };

  FX.reward = function (el, type, amount) {
    const r = el ? el.getBoundingClientRect() : { left: W / 2 - 20, top: H / 2, width: 40, height: 40 };
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (type === "gems") {
      FX.emojiBurst(x, y, "💎", 8);
      FX.burst(x, y, { colors: [COLORS.cyan, COLORS.blue, "#a5f3fc"], count: 20 });
    } else if (type === "gold") {
      FX.starBurst(x, y, 16);
      FX.burst(x, y, { colors: [COLORS.gold, "#fff7d6", "#f59e0b"], count: 24 });
    } else {
      FX.coinBurst(x, y, amount || 100);
    }
  };

  FX.levelUp = function (level) {
    FX.confetti(110);
    FX.flash("rgba(255, 200, 87, 0.22)", 0.55);
    FX.shake(4, 300);
    const x = W / 2;
    const y = H * 0.36;
    FX.rings(x, y, { size: 20, grow: 500, color: COLORS.gold, life: 1, width: 3 });
    FX.rings(x, y, { size: 10, grow: 320, color: COLORS.pink, life: 0.8, width: 2 });
    FX.floatingText("NIVEAU " + level, x, y, {
      className: "big gold",
      duration: 1.8,
      size: 36
    });
  };

  FX.jackpot = function () {
    FX.confetti(180);
    FX.flash("rgba(255, 200, 87, 0.3)", 0.8);
    FX.shake(9, 650);
    for (let i = 0; i < 4; i++) {
      FX.rings(W / 2, H / 2, { size: 10, grow: 600 + i * 180, color: i % 2 ? COLORS.pink : COLORS.gold, life: 1.2 });
    }
  };

  FX.flyIcon = function (fromEl, toEl, icon, opts) {
    if (!fromEl || !toEl) return;
    const from = fromEl.getBoundingClientRect();
    const to = toEl.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "fly-icon";
    el.textContent = icon || "🪙";
    el.style.left = (from.left + from.width / 2) + "px";
    el.style.top = (from.top + from.height / 2) + "px";
    document.getElementById("float-layer").appendChild(el);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    try {
      const anim = el.animate([
        { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.4}px), calc(-50% + ${dy * 0.2 - 40}px)) scale(1.25)`, opacity: 1, offset: 0.5 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.4)`, opacity: 0 }
      ], { duration: (opts && opts.duration) || 650, easing: "cubic-bezier(.4,0,.2,1)" });
      anim.onfinish = () => {
        el.remove();
        FX.hudPulse();
      };
    } catch (_) {
      el.remove();
    }
  };

  FX.rain = function (emoji, count) {
    const layer = document.getElementById("float-layer");
    if (!layer) return;
    for (let i = 0; i < (count || 10); i++) {
      const el = document.createElement("div");
      el.className = "rain-emoji";
      el.textContent = emoji || "🔵";
      el.style.left = U.rand(10, 90) + "vw";
      el.style.animationDelay = U.rand(0, 0.6) + "s";
      el.style.animationDuration = U.rand(1.2, 2.2) + "s";
      el.style.fontSize = U.rand(16, 30) + "px";
      layer.appendChild(el);
      setTimeout(() => el.remove(), 3200);
    }
  };

  FX.pulseElement = function (el) {
    if (!el) return;
    el.classList.remove("pulse-once");
    void el.offsetWidth;
    el.classList.add("pulse-once");
    setTimeout(() => el.classList.remove("pulse-once"), 600);
  };

  // ---------- Boucle canvas ----------
  function loop(t) {
    if (!ctx) return;
    const dt = Math.min((t - (lastTime || t)) / 1000, 0.04);
    lastTime = t;
    update(dt);
    draw();
    if (particles.length > 0) {
      raf = requestAnimationFrame(loop);
    } else {
      raf = null;
      ctx.clearRect(0, 0, W, H);
    }
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.maxLife) {
        particles.splice(i, 1);
        continue;
      }
      if (p.type === "ring") {
        p.size += p.grow * dt;
        continue;
      }
      if (p.type === "confetti") {
        p.vy += p.g * dt;
        p.vx += Math.sin(p.age * 3 + p.phase) * p.sway * 30 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        continue;
      }
      if (p.type === "coin" && p.homing && p.age > p.beginHoming) {
        const tx = p.target.x;
        const ty = p.target.y;
        const dx = tx - p.x;
        const dy = ty - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        const pull = 2600;
        p.vx += (dx / dist) * pull * dt;
        p.vy += (dy / dist) * pull * dt;
        if (dist < 24) {
          particles.splice(i, 1);
          FX.hudPulse();
          continue;
        }
      }
      p.vy += p.g * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    for (const p of particles) {
      const lifeT = p.age / p.maxLife;
      const alpha = Math.min(1, (1 - lifeT) * 2.4);
      if (p.type === "ring") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.strokeStyle = U.hexToRgba(p.color, alpha * 0.8);
        ctx.lineWidth = p.width;
        ctx.stroke();
        continue;
      }
      if (p.type === "spark") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - lifeT * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = U.hexToRgba(p.color, alpha);
        ctx.fill();
        continue;
      }
      if (p.type === "coin") {
        const s = p.size;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot + p.age * 6);
        ctx.beginPath();
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        ctx.fillStyle = U.hexToRgba("#ffc857", alpha);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-s * 0.25, -s * 0.25, s * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = U.hexToRgba("#fff7d6", alpha * 0.8);
        ctx.fill();
        ctx.restore();
        continue;
      }
      if (p.type === "confetti") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = U.hexToRgba(p.color, alpha);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
        continue;
      }
      if (p.type === "star") {
        drawStar(ctx, p.x, p.y, p.size, p.rot, U.hexToRgba(p.color, alpha));
        continue;
      }
      if (p.type === "emoji") {
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.font = `${p.size}px "Segoe UI Emoji", system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.emoji, 0, 0);
        ctx.restore();
        continue;
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawStar(c, x, y, r, rot, color) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fillStyle = color;
    c.fill();
    c.restore();
  }

  App.fx = FX;
})();
