/* ============================================================
   NEON JACKPOT — games/crash.js
   Crash : multiplicateur croissant, fusée, filet de sécurité
   ============================================================ */
(function () {
  "use strict";

  const App = window.App;
  const U = App.utils;
  const D = window.GAME_DATA;
  const CFG = D.balance.crash;

  const Game = {};
  let activeCleanup = null;

  Game.render = function (container) {
    if (activeCleanup) activeCleanup();
    const d = App.state.data;
    const g = d.games.crash;

    let phase = "idle"; // idle | countdown | running | crashed | cashed
    let stake = 0;
    let crashPoint = 0;
    let currentMult = 1;
    let startTime = 0;
    let countdownEnd = 0;
    let points = [];
    let cashedAt = 0;
    let safetyBase = 0;
    let autoNextTimer = null;
    let countdownTimer = null;
    let raf = null;
    let canvas = null;
    let ctx = null;
    let wrap = null;
    let W = 0;
    let H = 0;
    let dpr = 1;
    let lastFrame = 0;
    let tickAt = 0;
    let destroyed = false;
    let resizeObs = null;
    let activeTab = "upgrades";
    let autoMode = !!g.autoMode;

    const betOptions = () => CFG.betSteps.slice(0, Math.min(CFG.betSteps.length, 3 + g.upgrades.maxBet));
    const currentBet = () => betOptions()[U.clamp(g.betIndex, 0, betOptions().length - 1)] || CFG.minBet;
    const effectiveStake = () => currentBet() * (g.upgrades.double && g.doubleBet ? 2 : 1);
    const targetSteps = [1.5, 2, 3, 5, 10, 25, 50, 100, 250];
    const safetyAvailable = () => (g.upgrades.safety ? safetyBase : 0) + (d.charges.crashSafety || 0);

    function resize() {
      if (!canvas || !wrap) return;
      const rect = wrap.getBoundingClientRect();
      W = Math.max(280, rect.width);
      H = Math.min(470, Math.max(300, W * 0.54));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    }

    function startRound() {
      if (phase === "running" || phase === "countdown") return;
      if (autoNextTimer) { clearTimeout(autoNextTimer); autoNextTimer = null; }
      const bet = effectiveStake();
      if (!App.meta.canAfford("tokens", bet)) {
        App.audio.play("error");
        App.ui.toast("Jetons insuffisants", "Réduisez la mise ou désactivez le double.", "🪙", "danger");
        g.autoBet = false;
        autoMode = false;
        renderControls();
        renderSide();
        return;
      }
      if (!App.meta.bet(bet, "crash")) return;
      stake = bet;
      currentMult = 1;
      cashedAt = 0;
      points = [{ t: 0, m: 1 }];
      safetyBase = g.upgrades.safety ? 1 : 0;
      const u = Math.random();
      const raw = CFG.houseEdge / Math.max(1e-6, 1 - u);
      crashPoint = U.clamp(Math.floor(raw * 100) / 100, 1.01, CFG.maxMultiplier);
      phase = "countdown";
      countdownEnd = performance.now() + 3000;
      lastFrame = performance.now();
      tickAt = 0;
      App.audio.play("whoosh");
      updateOverlay();
      renderControls();
      renderSide();
      if (countdownTimer) clearInterval(countdownTimer);
      countdownTimer = setInterval(() => {
        if (destroyed) return;
        if (phase === "countdown" && performance.now() >= countdownEnd) {
          clearInterval(countdownTimer);
          countdownTimer = null;
          phase = "running";
          startTime = performance.now();
          lastFrame = startTime;
          updateOverlay();
          renderControls();
        } else if (phase === "countdown") {
          updateOverlay();
        }
      }, 120);
      if (!raf) {
        lastFrame = performance.now();
        raf = requestAnimationFrame(loop);
      }
      App.state.saveSoon();
    }

    function loop(now) {
      if (destroyed) return;
      const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
      lastFrame = now;
      if (phase === "running") {
        const elapsed = (now - startTime) / 1000;
        currentMult = Math.exp(CFG.growthRate * elapsed);
        if (!points.length || elapsed - points[points.length - 1].t > 0.045) {
          points.push({ t: elapsed, m: currentMult });
          if (points.length > 2500) points.shift();
        }
        if ((g.autoCashoutOn || autoMode) && currentMult >= g.autoTarget && currentMult < crashPoint) {
          cashout(true);
        } else if (currentMult >= crashPoint) {
          crash();
        } else if (now - tickAt > 500) {
          tickAt = now;
          App.audio.play("tick");
        }
        updateOverlay();
      }
      draw(now);
      raf = requestAnimationFrame(loop);
    }

    function crash() {
      if (phase !== "running") return;
      phase = "crashed";
      currentMult = crashPoint;
      points.push({ t: Math.max(0, (performance.now() - startTime) / 1000), m: crashPoint });
      g.stats.crashes += 1;
      g.history.unshift(crashPoint);
      if (g.history.length > 14) g.history.length = 14;
      App.meta.loss("crash", { silent: true });
      App.audio.play("explosion");
      App.fx.shake(8, 550);
      App.fx.flash("rgba(255,84,112,0.2)", 0.5);
      let safetyText = "";
      if (safetyAvailable() > 0) {
        const refund = Math.floor(stake * 0.2);
        if (d.charges.crashSafety > 0) d.charges.crashSafety -= 1;
        else safetyBase = Math.max(0, safetyBase - 1);
        App.meta.refund(refund, "crash");
        safetyText = " · filet de sécurité : +" + U.fmt(refund);
        App.fx.floatingText("+" + U.fmt(refund), window.innerWidth / 2, window.innerHeight / 2, { className: "gem", duration: 1.3 });
      }
      App.ui.toast("Crash à " + U.fmtMult(crashPoint), "La fusée a explosé" + safetyText + ".", "💥", "danger");
      updateOverlay();
      updateHistory();
      renderControls();
      renderSide();
      App.meta.checkAchievements();
      App.state.saveSoon();
      scheduleAutoBet();
    }

    function cashout(auto) {
      if (phase !== "running") return;
      const mult = currentMult;
      phase = "cashed";
      cashedAt = mult;
      const payout = stake * mult;
      if (mult > (g.stats.bestMult || 1)) g.stats.bestMult = mult;
      const gameMult = 1 + (g.upgrades.curves ? 0.05 : 0);
      App.meta.payout(payout, "crash", { stake, mult, gameMult, silent: true });
      App.audio.play("cashout");
      App.fx.coinBurst(window.innerWidth / 2, window.innerHeight / 2, payout);
      App.fx.floatingText("+" + U.fmt(payout), window.innerWidth / 2, window.innerHeight / 2 - 36, { className: "win", duration: 1.5, size: 25 });
      if (mult >= 10) App.fx.confetti(70);
      if (mult >= 3) App.fx.shake(3, 220);
      if (mult >= 20) App.meta.triggerSynergy("crash_cashout_20x", { mult });
      App.ui.toast(auto ? "Encaissement auto" : "Encaissé !", "+" + U.fmt(payout) + " jetons à " + U.fmtMult(mult), "💸", "gold");
      App.state.log("🚀", "Gain — Crash", "+" + U.fmt(payout));
      updateOverlay();
      updateHistory();
      renderControls();
      renderSide();
      App.meta.checkAchievements();
      App.state.saveSoon();
      scheduleAutoBet();
    }

    function scheduleAutoBet() {
      if (autoNextTimer) { clearTimeout(autoNextTimer); autoNextTimer = null; }
      if (!autoMode && !(g.autoBet && g.upgrades.autobet)) return;
      if (destroyed) return;
      autoNextTimer = setTimeout(() => {
        autoNextTimer = null;
        if (destroyed || phase === "running" || phase === "countdown") return;
        if (!App.meta.canAfford("tokens", effectiveStake())) {
          autoMode = false;
          g.autoBet = false;
          App.ui.toast("Auto-mise arrêtée", "Solde insuffisant pour la mise actuelle.", "🤖", "danger");
          renderControls();
          renderSide();
          return;
        }
        startRound();
      }, 2300);
    }

    function updateOverlay() {
      const multEl = container.querySelector("#crash-multiplier");
      const subEl = container.querySelector("#crash-sub");
      const badgeEl = container.querySelector("#crash-badge");
      if (!multEl || !subEl) return;
      multEl.classList.remove("hot", "crashed");
      if (phase === "countdown") {
        const remaining = Math.max(0, countdownEnd - performance.now());
        multEl.textContent = String(Math.ceil(remaining / 1000));
        multEl.classList.add("hot");
        subEl.textContent = "Décollage imminent";
        if (badgeEl) badgeEl.textContent = "MISE : 🪙 " + U.fmt(stake) + (g.doubleBet && g.upgrades.double ? " · DOUBLE" : "");
      } else if (phase === "running") {
        multEl.textContent = U.fmtMult(currentMult);
        if (currentMult >= 5) multEl.classList.add("hot");
        subEl.textContent = g.autoCashout && g.autoCashoutOn ? "Encaissement auto à " + U.fmtMult(g.autoTarget) : "Cliquez pour encaisser";
        const btn = container.querySelector("[data-crash-cashout]");
        if (btn) btn.innerHTML = `💰 Encaisser · ${U.fmtMult(currentMult)}`;
        if (badgeEl) badgeEl.textContent = "GAIN ACTUEL : 🪙 " + U.fmt(stake * currentMult);
      } else if (phase === "crashed") {
        multEl.textContent = "CRASH ×" + U.fmt(crashPoint);
        multEl.classList.add("crashed");
        subEl.textContent = "La maison rafle la mise";
        if (badgeEl) badgeEl.textContent = "Fin de manche";
      } else if (phase === "cashed") {
        multEl.textContent = U.fmtMult(cashedAt);
        multEl.classList.add("hot");
        subEl.textContent = "Encaissé · +" + U.fmt(stake * cashedAt) + " jetons";
        if (badgeEl) badgeEl.textContent = "✓ SUCCÈS";
      } else {
        multEl.textContent = "×1.00";
        subEl.textContent = "Prêt à décoller";
        if (badgeEl) badgeEl.textContent = "Mise : 🪙 " + U.fmt(effectiveStake());
      }
    }

    function updateHistory() {
      const el = container.querySelector("#crash-history");
      if (!el) return;
      el.innerHTML = g.history.slice(0, 12).map((m) => {
        const cls = m >= 10 ? "high" : m >= 2 ? "mid" : "low";
        return `<span class="h-dot ${cls}">${U.fmtMult(m)}</span>`;
      }).join("");
    }

    // ---------------- Canvas ----------------
    function draw(now) {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      const padL = 44;
      const padR = 18;
      const padT = 20;
      const padB = 30;
      const plotW = W - padL - padR;
      const plotH = H - padT - padB;
      const bottom = padT + plotH;
      const elapsed = phase === "running" ? (now - startTime) / 1000 : phase === "crashed" || phase === "cashed" ? points[points.length - 1].t : 0;
      const maxT = Math.max(6, elapsed * 1.12);
      const maxM = Math.max(2, (phase === "running" ? currentMult : phase === "crashed" || phase === "cashed" ? Math.max(currentMult, 2) : 1.5) * 1.25);
      const logMax = Math.log(maxM);

      // fond
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "rgba(7,26,25,0.5)");
      bg.addColorStop(1, "rgba(5,9,12,0.9)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // grille
      ctx.strokeStyle = "rgba(74,222,128,0.08)";
      ctx.lineWidth = 1;
      for (let t = 0; t <= maxT; t += Math.max(1, Math.ceil(maxT / 8))) {
        const x = padL + (t / maxT) * plotW;
        ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, bottom); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.font = "8px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(t + "s", x, bottom + 16);
      }
      const marks = [1, 1.5, 2, 3, 5, 10, 25, 50, 100, 250, 1000];
      marks.forEach((m) => {
        if (m > maxM) return;
        const y = bottom - (Math.log(m) / logMax) * plotH;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.textAlign = "right";
        ctx.fillText(U.fmtMult(m), padL - 7, y + 3);
      });

      if (points.length < 2) {
        ctx.fillStyle = "rgba(255,255,255,0.16)";
        ctx.font = "600 11px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("EN ATTENTE DU DÉCOLLAGE", W / 2, H / 2);
        ctx.fillStyle = "rgba(167,139,250,0.1)";
        ctx.beginPath();
        ctx.arc(W * 0.7 + Math.sin(now * 0.001) * 8, H * 0.32, 22, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      const xFor = (t) => padL + (Math.min(t, maxT) / maxT) * plotW;
      const yFor = (m) => bottom - (Math.log(Math.max(1, m)) / logMax) * plotH;

      // aire
      ctx.beginPath();
      ctx.moveTo(xFor(points[0].t), bottom);
      points.forEach((p) => ctx.lineTo(xFor(p.t), yFor(p.m)));
      ctx.lineTo(xFor(points[points.length - 1].t), bottom);
      ctx.closePath();
      const area = ctx.createLinearGradient(0, padT, 0, bottom);
      if (phase === "crashed") {
        area.addColorStop(0, "rgba(255,84,112,0.22)");
        area.addColorStop(1, "rgba(255,84,112,0.01)");
      } else if (phase === "cashed") {
        area.addColorStop(0, "rgba(255,200,87,0.24)");
        area.addColorStop(1, "rgba(255,200,87,0.01)");
      } else {
        area.addColorStop(0, "rgba(52,211,153,0.24)");
        area.addColorStop(1, "rgba(34,211,238,0.01)");
      }
      ctx.fillStyle = area;
      ctx.fill();

      // courbe
      ctx.beginPath();
      points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(xFor(p.t), yFor(p.m));
        else ctx.lineTo(xFor(p.t), yFor(p.m));
      });
      const stroke = phase === "crashed" ? "#ff5470" : phase === "cashed" ? "#ffc857" : "#34d399";
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = stroke;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;

      const last = points[points.length - 1];
      const lx = xFor(last.t);
      const ly = yFor(last.m);
      if (phase === "crashed") {
        ctx.fillStyle = "rgba(255,84,112,0.25)";
        ctx.beginPath(); ctx.arc(lx, ly, 18 + Math.sin(now * 0.02) * 4, 0, Math.PI * 2); ctx.fill();
        ctx.font = "22px 'Segoe UI Emoji', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("💥", lx, ly + 7);
      } else if (phase === "cashed") {
        ctx.beginPath();
        ctx.arc(lx, ly, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffc857";
        ctx.shadowColor = "#ffc857"; ctx.shadowBlur = 18;
        ctx.fill(); ctx.shadowBlur = 0;
        ctx.font = "20px 'Segoe UI Emoji', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("💸", lx, ly - 15);
      } else {
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(-Math.PI / 4);
        ctx.font = "22px 'Segoe UI Emoji', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🚀", 0, 6);
        ctx.restore();
        // traînée
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(lx - (i + 1) * 8, ly + (i + 1) * 5, 2 + i * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(52,211,153,${0.3 - i * 0.06})`;
          ctx.fill();
        }
      }
    }

    // ---------------- UI ----------------
    function renderControls() {
      const el = container.querySelector("#crash-controls");
      if (!el) return;
      if (phase === "running") {
        el.innerHTML = `<button class="btn crash-cashout" data-crash-cashout>💰 Encaisser · ${U.fmtMult(currentMult)}</button>
          <span class="badge gold">Gain : 🪙 ${U.fmt(stake * currentMult)}</span>${autoMode ? '<span class="badge cyan">🤖 Auto</span>' : ""}`;
      } else if (phase === "countdown") {
        el.innerHTML = `<button class="btn btn-ghost" disabled>Décollage dans quelques instants…</button>`;
      } else {
        const autoTarget = g.upgrades.autoCashout
          ? `<div class="crash-prediction" style="margin-top:6px">🎯 Auto-cashout <strong>${g.autoCashoutOn ? "ON" : "OFF"}</strong> à ${U.fmtMult(g.autoTarget)}${g.upgrades.prediction ? ` · probabilité <strong>${(Math.min(99, 0.97 / g.autoTarget * 100)).toFixed(1)} %</strong>` : ""}</div>`
          : "";
        const safety = safetyAvailable() > 0 ? `<span class="badge cyan">🛡️ ${safetyAvailable()} filet(s)</span>` : "";
        el.innerHTML = `
          <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;width:100%">
            <div class="bet-stepper"><button class="bet-step" data-crash-bet="-1" ${phase === "countdown" ? "disabled" : ""}>−</button><button class="bet-step" data-crash-bet="1">+</button></div>
            <div class="bet-display" style="padding:5px 9px"><span class="chip-symbol">🪙</span><div><span class="bet-label">Mise</span><strong>${U.fmt(effectiveStake())}</strong></div></div>
            ${g.upgrades.double ? `<button class="btn btn-xs ${g.doubleBet ? "btn-cyan" : "btn-ghost"}" data-crash-double>×2</button>` : ""}
            <span style="flex:1"></span>
            ${safety}
          </div>
          <button class="btn btn-primary btn-lg" data-crash-start style="width:100%;min-height:48px">🚀 Décoller · 🪙 ${U.fmt(effectiveStake())}</button>
          ${g.upgrades.autoCashout ? `<button class="btn btn-xs ${g.autoCashoutOn ? "btn-cyan" : "btn-ghost"}" data-crash-auto-cash>${g.autoCashoutOn ? "⏸ Auto-cashout ON" : "▶ Auto-cashout OFF"}</button><button class="bet-step" data-crash-target="-1">−</button><span style="font-family:var(--mono);font-size:10px;color:var(--gold)">×${g.autoTarget}</span><button class="bet-step" data-crash-target="1">+</button>` : ""}
          ${g.upgrades.autobet ? `<button class="btn btn-xs ${g.autoBet ? "btn-cyan" : "btn-ghost"}" data-crash-autobet>${g.autoBet ? "⏸ Auto-mise ON" : "▶ Auto-mise OFF"}</button>` : ""}
          <button class="btn btn-xs ${autoMode ? "btn-cyan" : "btn-ghost"}" data-crash-auto>🤖 ${autoMode ? "Auto ON" : "Auto complet"}</button>
          ${autoTarget}`;
      }
    }

    function updateHeader() {
      const plays = container.querySelector("#crash-plays");
      const wins = container.querySelector("#crash-wins");
      const best = container.querySelector("#crash-best");
      const crashes = container.querySelector("#crash-crashes");
      if (plays) plays.textContent = U.fmt(g.stats.plays);
      if (wins) wins.textContent = U.fmt(g.stats.wins);
      if (best) best.textContent = U.fmtMult(g.stats.bestMult || 1);
      if (crashes) crashes.textContent = U.fmt(g.stats.crashes);
    }

    function renderSide() {
      const side = container.querySelector("#crash-side");
      if (!side) return;
      side.innerHTML = `<div class="tabs" style="margin-bottom:8px">
        <button class="tab ${activeTab === "upgrades" ? "active" : ""}" data-crash-tab="upgrades">Améliorations</button>
        <button class="tab ${activeTab === "rules" ? "active" : ""}" data-crash-tab="rules">Aide</button>
      </div><div id="crash-side-content"></div>`;
      const content = side.querySelector("#crash-side-content");
      if (activeTab === "rules") {
        content.innerHTML = `<div class="panel"><div class="panel-head"><h3>🚀 Comment jouer</h3></div><div class="panel-body" style="font-size:10.5px;line-height:1.7;color:var(--muted)">
          <p>La fusée décolle, le multiplicateur grimpe. Encaissez avant le crash pour sécuriser votre gain.</p>
          <p style="margin-top:7px"><strong style="color:var(--text-soft)">Retour :</strong> ${Math.round(CFG.houseEdge * 100)} % théorique · croissance ${Math.round((Math.exp(CFG.growthRate) - 1) * 100)} %/s au début.</p>
          <p style="margin-top:7px"><strong style="color:var(--text-soft)">Filet :</strong> 20 % de la mise récupérés en cas de crash (une fois par manche avec l'amélioration).</p>
          <p style="margin-top:7px"><strong style="color:var(--text-soft)">Auto :</strong> activez auto-cashout pour encaisser à un seuil, auto-mise pour relancer.</p>
          <p style="margin-top:7px"><strong style="color:var(--text-soft)">Courbes :</strong> l'amélioration Courbes spéciales ajoute +5 % de gains.</p>
        </div></div>`;
      } else {
        const rows = Object.keys(CFG.upgrades).map((key) => {
          const def = CFG.upgrades[key];
          const level = g.upgrades[key];
          const max = def.costs ? def.costs.length : (def.max || 1);
          const maxed = level >= max;
          const cost = maxed ? 0 : (def.costs ? def.costs[level] : (def.cost !== undefined ? def.cost : Math.ceil(def.base * Math.pow(def.growth, level))));
          let label = "";
          if (key === "maxBet") label = "Mise max " + U.fmt(betOptions()[betOptions().length - 1]);
          else if (key === "autoCashout") label = level ? "Seuil ×" + g.autoTarget : "Non";
          else if (key === "double") label = level ? "×2 disponible" : "Non";
          else if (key === "safety") label = level ? "20 % de retour" : "Non";
          else if (key === "prediction") label = level ? "Probabilités affichées" : "Non";
          else if (key === "curves") label = level ? "+5 % de gains" : "Non";
          else if (key === "autobet") label = level ? "Auto-mise" : "Non";
          return `<div class="upgrade-row ${maxed ? "maxed" : ""}">
            <span class="upgrade-icon">${def.icon}</span>
            <div class="upgrade-main"><div class="upgrade-name">${def.name}</div><div class="upgrade-desc">${def.desc}</div><div class="upgrade-meta"><span class="upgrade-level">${label}</span></div></div>
            <button class="btn btn-xs ${maxed ? "btn-ghost maxed" : "btn-ghost upgrade-buy"} ${!maxed && d.tokens >= cost ? "affordable" : ""}" data-crash-buy="${key}" ${maxed ? "disabled" : ""}>${maxed ? "MAX" : "🪙 " + U.fmt(cost)}</button>
          </div>`;
        }).join("");
        content.innerHTML = `<div class="panel"><div class="panel-head"><h3>⚡ Améliorations</h3><span class="panel-hint">Jetons</span></div><div class="panel-body" style="padding:10px"><div class="upgrade-list">${rows}</div></div></div>
          <div class="panel"><div class="panel-body" style="padding:10px 12px">
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted)"><span>Auto-cashout</span><strong style="color:${g.autoCashoutOn ? "var(--green)" : "var(--muted)"}">${g.autoCashoutOn ? "×" + g.autoTarget : "Inactif"}</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Filets</span><strong style="color:var(--cyan)">${safetyAvailable()}</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Auto-mise</span><strong style="color:${g.autoBet ? "var(--green)" : "var(--muted)"}">${g.autoBet ? "Active" : "Inactive"}</strong></div>
          </div></div>`;
      }
      updateHeader();
    }

    // ---------------- Init ----------------
    const gm = App.meta.gameMeta("crash");
    container.innerHTML = `
      <div class="game-header">
        <div class="game-title-wrap"><span class="game-title-icon">${gm.icon}</span><div><h1>Crash</h1><p>${gm.tagline}</p></div></div>
        <div class="game-header-stats">
          <span class="game-stat-chip">Manches <strong id="crash-plays">${U.fmt(g.stats.plays)}</strong></span>
          <span class="game-stat-chip">Encaissements <strong id="crash-wins">${U.fmt(g.stats.wins)}</strong></span>
          <span class="game-stat-chip">Meilleur <strong id="crash-best">${U.fmtMult(g.stats.bestMult || 1)}</strong></span>
          <span class="game-stat-chip">Crashes <strong id="crash-crashes">${U.fmt(g.stats.crashes)}</strong></span>
        </div>
      </div>
      <div class="game-layout wide-side">
        <section class="game-stage crash-stage">
          <div class="crash-canvas-wrap" id="crash-wrap">
            <canvas id="crash-canvas"></canvas>
            <div class="crash-overlay">
              <div class="crash-multiplier" id="crash-multiplier">×1.00</div>
              <div class="crash-sub" id="crash-sub">Prêt à décoller</div>
              <div class="crash-badge" id="crash-badge">Mise : 🪙 ${U.fmt(effectiveStake())}</div>
            </div>
          </div>
          <div class="crash-history" id="crash-history"></div>
          <div class="crash-controls" id="crash-controls"></div>
        </section>
        <aside class="game-side" id="crash-side"></aside>
      </div>`;

    wrap = container.querySelector("#crash-wrap");
    canvas = container.querySelector("#crash-canvas");
    ctx = canvas.getContext("2d");
    resize();
    renderControls();
    renderSide();
    updateHistory();
    updateOverlay();
    updateHeader();

    resizeObs = new ResizeObserver(() => resize());
    resizeObs.observe(wrap);

    const onClick = (e) => {
      if (e.target.closest("[data-crash-start]")) { startRound(); return; }
      if (e.target.closest("[data-crash-cashout]")) { cashout(false); return; }
      const betBtn = e.target.closest("[data-crash-bet]");
      if (betBtn) {
        if (phase === "running" || phase === "countdown") return;
        const options = betOptions();
        g.betIndex = U.clamp(g.betIndex + parseInt(betBtn.dataset.crashBet, 10), 0, options.length - 1);
        App.audio.play("tick");
        updateOverlay(); renderControls(); App.state.saveSoon();
        return;
      }
      if (e.target.closest("[data-crash-double]")) {
        if (phase === "running" || phase === "countdown" || !g.upgrades.double) return;
        g.doubleBet = !g.doubleBet;
        App.audio.play("click");
        updateOverlay(); renderControls(); App.state.saveSoon();
        return;
      }
      if (e.target.closest("[data-crash-auto-cash]")) {
        if (!g.upgrades.autoCashout) return;
        g.autoCashoutOn = !g.autoCashoutOn;
        App.audio.play("click");
        renderControls(); renderSide(); App.state.saveSoon();
        return;
      }
      const targetBtn = e.target.closest("[data-crash-target]");
      if (targetBtn) {
        if (!g.upgrades.autoCashout || phase === "running" || phase === "countdown") return;
        let idx = targetSteps.findIndex((v) => v >= g.autoTarget);
        if (idx < 0) idx = 0;
        idx = U.clamp(idx + parseInt(targetBtn.dataset.crashTarget, 10), 0, targetSteps.length - 1);
        g.autoTarget = targetSteps[idx];
        App.audio.play("tick");
        renderControls(); renderSide(); App.state.saveSoon();
        return;
      }
      if (e.target.closest("[data-crash-autobet]")) {
        if (!g.upgrades.autobet) return;
        g.autoBet = !g.autoBet;
        App.audio.play("click");
        if (g.autoBet && (phase === "idle" || phase === "crashed" || phase === "cashed")) {
          if (App.meta.canAfford("tokens", effectiveStake())) startRound();
        } else if (!g.autoBet && autoNextTimer) {
          clearTimeout(autoNextTimer); autoNextTimer = null;
        }
        renderControls(); renderSide(); App.state.saveSoon();
        return;
      }
      if (e.target.closest("[data-crash-auto]")) {
        autoMode = !autoMode;
        g.autoMode = autoMode;
        App.audio.play("click");
        if (autoMode) {
          if (!g.autoTarget || g.autoTarget < 1.5) g.autoTarget = 2;
          if (phase === "idle" || phase === "crashed" || phase === "cashed") {
            if (App.meta.canAfford("tokens", effectiveStake())) startRound();
            else {
              autoMode = false;
              App.ui.toast("Auto-crash arrêté", "Solde insuffisant.", "🤖", "danger");
            }
          } else if (phase === "running" && !autoNextTimer) {
            // l'auto-cashout prendra le relais
          }
        } else if (autoNextTimer) {
          clearTimeout(autoNextTimer);
          autoNextTimer = null;
        }
        renderControls(); renderSide(); App.state.saveSoon();
        return;
      }
      const tab = e.target.closest("[data-crash-tab]");
      if (tab) { activeTab = tab.dataset.crashTab; renderSide(); return; }
      const buy = e.target.closest("[data-crash-buy]");
      if (buy) { buyUpgrade(buy.dataset.crashBuy); return; }
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
      App.audio.play("purchase");
      App.fx.burst(window.innerWidth * 0.7, window.innerHeight * 0.4, { colors: ["#34d399", "#ffc857"], count: 16 });
      App.ui.toast("Amélioration achetée", def.name, def.icon, "gold");
      App.meta.checkAchievements();
      App.state.saveSoon();
      renderControls(); renderSide(); updateOverlay();
    }

    if (g.upgrades.autoCashout && g.autoCashoutOn) {
      // la cible est déjà active
    }

    const cleanup = () => {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      if (countdownTimer) clearInterval(countdownTimer);
      if (autoNextTimer) clearTimeout(autoNextTimer);
      container.removeEventListener("click", onClick);
      if (resizeObs) resizeObs.disconnect();
      if (phase === "running") {
        App.meta.payout(stake * currentMult, "crash", { stake, mult: currentMult, silent: true });
        if (currentMult > (g.stats.bestMult || 1)) g.stats.bestMult = currentMult;
      } else if (phase === "countdown") {
        App.meta.refund(stake, "crash");
      }
      phase = "idle";
      activeCleanup = null;
    };
    activeCleanup = cleanup;
    raf = requestAnimationFrame(loop);
    if (autoMode) scheduleAutoBet();
    return cleanup;
  };

  App.games = App.games || {};
  App.games.crash = Game;
})();
