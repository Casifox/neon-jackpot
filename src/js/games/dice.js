/* ============================================================
   NEON JACKPOT — games/dice.js
   Dés : seuil au-dessus/en dessous, dés multiples, dés pipés
   ============================================================ */
(function () {
  "use strict";

  const App = window.App;
  const U = App.utils;
  const D = window.GAME_DATA;
  const CFG = D.balance.dice;

  const Game = {};
  let activeCleanup = null;

  Game.render = function (container) {
    if (activeCleanup) activeCleanup();
    const d = App.state.data;
    const g = d.games.dice;

    let rolling = false;
    let rollState = null;
    let timers = new Set();
    let autoTimer = null;
    let destroyed = false;
    let history = [];
    let lastResult = null;

    const maxDice = () => Math.min(CFG.maxDice, 1 + g.upgrades.multiDice);
    const diceCount = () => U.clamp(g.diceCount, 1, maxDice());
    const minSum = () => diceCount();
    const maxSum = () => diceCount() * 6;
    const betOptions = () => CFG.betSteps.slice(0, Math.min(CFG.betSteps.length, 3 + g.upgrades.maxBet));
    const currentBet = () => betOptions()[U.clamp(g.betIndex, 0, betOptions().length - 1)] || CFG.minBet;
    const clampThreshold = () => {
      if (g.direction === "over") g.threshold = U.clamp(g.threshold, minSum(), maxSum() - 1);
      else g.threshold = U.clamp(g.threshold, minSum() + 1, maxSum());
      return g.threshold;
    };
    const distribution = (n) => {
      let counts = [1];
      for (let i = 0; i < n; i++) {
        const next = new Array(counts.length + 6).fill(0);
        counts.forEach((c, s) => {
          for (let v = 1; v <= 6; v++) next[s + v] += c;
        });
        counts = next;
      }
      return counts;
    };
    const winChance = () => {
      clampThreshold();
      const counts = distribution(diceCount());
      const total = Math.pow(6, diceCount());
      let win = 0;
      for (let s = minSum(); s <= maxSum(); s++) {
        const ok = g.direction === "over" ? s > g.threshold : s < g.threshold;
        if (ok) win += counts[s];
      }
      return win / total;
    };
    const payoutMult = () => {
      const chance = winChance();
      return chance > 0 ? CFG.houseEdge / chance : 0;
    };
    const luckyReady = () => g.upgrades.lucky && Date.now() >= (g.luckyReady || 0);
    const luckyCooldown = () => Math.max(0, (g.luckyReady || 0) - Date.now());

    function later(fn, ms) {
      const id = setTimeout(() => {
        timers.delete(id);
        if (!destroyed) fn();
      }, ms);
      timers.add(id);
      return id;
    }

    function clearTimers() {
      timers.forEach(clearTimeout);
      timers.clear();
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = null;
    }

    function pipFace(pos, face) {
      let pips = "";
      for (let i = 1; i <= 9; i++) pips += `<span class="pip"></span>`;
      return `<div class="die-face face-${pos} f${face}">${pips}</div>`;
    }

    function dieHtml(value, index) {
      const faces = [
        ["front", 1], ["back", 6], ["right", 2],
        ["left", 5], ["top", 3], ["bottom", 4]
      ];
      return `<div class="die" data-die="${index}" data-value="${value}">
        ${faces.map(([pos, face]) => pipFace(pos, face)).join("")}
      </div>`;
    }

    const ORIENT = {
      1: [0, 0],
      2: [0, -90],
      3: [-90, 0],
      4: [90, 0],
      5: [0, 90],
      6: [0, 180]
    };

    function settleDice(values) {
      container.querySelectorAll(".die").forEach((die, i) => {
        die.classList.remove("rolling");
        const v = values[i] || 1;
        const [rx, ry] = ORIENT[v] || [0, 0];
        die.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
        die.classList.add("settled");
        setTimeout(() => die.classList.remove("settled"), 420);
      });
    }

    function generateNormal() {
      const arr = [];
      for (let i = 0; i < diceCount(); i++) arr.push(U.randInt(1, 6));
      return arr;
    }

    function generateWinning() {
      clampThreshold();
      const n = diceCount();
      const counts = distribution(n);
      const winningSums = [];
      let total = 0;
      for (let s = minSum(); s <= maxSum(); s++) {
        const ok = g.direction === "over" ? s > g.threshold : s < g.threshold;
        if (ok && counts[s]) {
          winningSums.push({ s, w: counts[s] });
          total += counts[s];
        }
      }
      if (!winningSums.length) return generateNormal();
      let roll = Math.random() * total;
      let target = winningSums[0].s;
      for (const item of winningSums) {
        roll -= item.w;
        if (roll <= 0) { target = item.s; break; }
      }
      const values = [];
      let remaining = target;
      for (let i = 0; i < n; i++) {
        const left = n - i - 1;
        const low = Math.max(1, remaining - left * 6);
        const high = Math.min(6, remaining - left);
        const v = U.randInt(low, high);
        values.push(v);
        remaining -= v;
      }
      return values;
    }

    function roll(useLucky) {
      if (rolling) return;
      if (destroyed) return;
      if (useLucky && !luckyReady()) {
        App.audio.play("error");
        App.ui.toast("Dés pipés en recharge", "Encore " + U.formatCountdown(luckyCooldown()) + ".", "🍀", "danger");
        return;
      }
      const bet = currentBet();
      if (!App.meta.canAfford("tokens", bet)) {
        App.audio.play("error");
        App.ui.toast("Jetons insuffisants", "Réduisez la mise.", "🪙", "danger");
        g.autoOn = false;
        renderStage();
        return;
      }
      if (!App.meta.bet(bet, "dice")) return;
      if (useLucky) g.luckyReady = Date.now() + 90000;
      clampThreshold();
      const values = useLucky ? generateWinning() : generateNormal();
      const total = values.reduce((a, b) => a + b, 0);
      const chance = winChance();
      const mult = useLucky ? Math.min(2, payoutMult()) : payoutMult();
      const win = g.direction === "over" ? total > g.threshold : total < g.threshold;
      rolling = true;
      lastResult = null;
      rollState = { values, total, win, bet, mult, chance, useLucky };
      App.audio.play("dice");
      container.querySelector("#dice-row").innerHTML = values.map((v, i) => dieHtml(v, i)).join("");
      const dice = container.querySelectorAll(".die");
      dice.forEach((die, i) => {
        die.style.animationDelay = (i * 60) + "ms";
        die.classList.add("rolling");
      });
      container.querySelector("#dice-total").textContent = "…";
      container.querySelector("#dice-total").className = "dice-total";
      container.querySelector("#dice-result-label").textContent = "Les dés roulent…";
      setRollControlsDisabled(true);
      renderControls();
      renderStageStats();
      const duration = 800 + diceCount() * 80;
      later(() => settleDice(values), duration);
      later(() => finishRoll(), duration + 350);
      App.state.saveSoon();
    }

    function finishRoll() {
      if (!rollState) return;
      const snap = rollState;
      rolling = false;
      rollState = null;
      settleDice(snap.values);
      const totalEl = container.querySelector("#dice-total");
      const label = container.querySelector("#dice-result-label");
      if (totalEl) {
        totalEl.textContent = String(snap.total);
        totalEl.className = "dice-total " + (snap.win ? "win" : "lose");
      }
      if (label) {
        label.textContent = snap.win ? "GAGNÉ · ×" + U.fmt(snap.mult) : "PERDU · la maison encaisse";
        label.style.animation = "none";
        void label.offsetWidth;
        label.style.animation = "";
      }
      history.unshift({ total: snap.total, win: snap.win });
      if (history.length > 12) history.length = 12;
      if (snap.win) {
        const payout = snap.bet * snap.mult;
        g.stats.streak += 1;
        if (g.stats.streak > (g.stats.bestStreak || 0)) g.stats.bestStreak = g.stats.streak;
        App.meta.payout(payout, "dice", { stake: snap.bet, mult: snap.mult, silent: true });
        App.audio.play(snap.mult >= 5 ? "bigwin" : "win");
        App.fx.coinBurst(window.innerWidth / 2, window.innerHeight / 2, payout);
        App.fx.floatingText("+" + U.fmt(payout), window.innerWidth / 2, window.innerHeight / 2 - 30, { className: "win", duration: 1.4, size: 24 });
        if (snap.mult >= 4) App.fx.confetti(45);
        if (g.stats.streak === 5) App.meta.triggerSynergy("dice_5_streak", { streak: 5 });
        App.state.log("🎲", "Gain — Dés", "+" + U.fmt(payout));
      } else {
        g.stats.streak = 0;
        App.meta.loss("dice", { silent: true });
        App.audio.play("lose");
        App.fx.shake(2, 180);
      }
      lastResult = snap;
      updateHeader();
      renderStageStats();
      setRollControlsDisabled(false);
      renderControls();
      renderSide();
      App.meta.checkAchievements();
      App.state.saveSoon();
      if (g.autoOn) scheduleAuto();
    }

    function scheduleAuto() {
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = null;
      if (!g.autoOn) return;
      autoTimer = setTimeout(() => {
        if (destroyed || rolling) return;
        if (!App.meta.canAfford("tokens", currentBet())) {
          g.autoOn = false;
          App.ui.toast("Auto-dés arrêté", "Solde insuffisant.", "🤖", "danger");
          renderStage();
          return;
        }
        roll(false);
      }, g.upgrades.auto ? 700 : 1300);
    }

    // ---------------- Rendu ----------------
    function renderStage() {
      const root = container.querySelector("#dice-root");
      if (!root) return;
      clampThreshold();
      const n = diceCount();
      const chance = winChance();
      const mult = payoutMult();
      const insight = g.upgrades.insight ? `<div class="dice-payout-row"><span>Probabilité de victoire <strong>${(chance * 100).toFixed(1)} %</strong></span><span>Paiement <strong>×${mult.toFixed(2)}</strong></span></div>` : `<div class="dice-payout-row"><span>Choisissez un seuil, la chance fait le reste.</span></div>`;
      root.innerHTML = `
        <div class="dice-arena">
          <div class="dice-row" id="dice-row">${Array.from({ length: n }, (_, i) => dieHtml(1, i)).join("")}</div>
          <div class="dice-result"><div class="dice-total" id="dice-total">—</div><div class="dice-result-label" id="dice-result-label">Lancez les dés</div></div>
          <div class="dice-config">
            <div class="dice-threshold-head">
              <div><div style="font-size:9px;color:var(--muted-2);text-transform:uppercase;letter-spacing:.12em">Seuil</div><strong id="dice-threshold-value">${g.direction === "over" ? ">" : "<"} ${g.threshold}</strong></div>
              <div class="segmented">
                <button class="seg-btn ${g.direction === "over" ? "active" : ""}" data-dice-dir="over" ${rolling ? "disabled" : ""}>Au-dessus</button>
                <button class="seg-btn ${g.direction === "under" ? "active" : ""}" data-dice-dir="under" ${rolling ? "disabled" : ""}>En dessous</button>
              </div>
            </div>
            <input type="range" id="dice-threshold" min="${g.direction === "over" ? minSum() : minSum() + 1}" max="${g.direction === "over" ? maxSum() - 1 : maxSum()}" value="${g.threshold}" ${rolling ? "disabled" : ""} />
            <div class="dice-prob-row"><span>${n} dé${n > 1 ? "s" : ""} · total de ${minSum()} à ${maxSum()}</span><span>Victoire <strong id="dice-chance">${(chance * 100).toFixed(1)} %</strong></span></div>
            ${insight}
            <div class="dice-payout-row">
              <span>Gain potentiel <strong id="dice-potential">🪙 ${U.fmt(currentBet() * mult)}</strong></span>
              <span>Paiement <strong id="dice-payout">×${mult.toFixed(2)}</strong></span>
            </div>
            <div class="dice-presets">
              ${[1, 2, 5, 10, 25, 50].map((v) => `<button data-dice-bet="${v}">${v}</button>`).join("")}
            </div>
          </div>
          <div class="dice-config" style="padding:12px 16px">
            <div class="bet-control" style="justify-content:center">
              <div class="bet-stepper"><button class="bet-step" data-dice-bet-step="-1" ${rolling ? "disabled" : ""}>−</button><button class="bet-step" data-dice-bet-step="1" ${rolling ? "disabled" : ""}>+</button></div>
              <div class="bet-display"><span class="chip-symbol">🪙</span><div><span class="bet-label">Mise</span><strong>${U.fmt(currentBet())}</strong></div></div>
              <button class="btn btn-primary" data-dice-roll ${rolling ? "disabled" : ""} style="min-width:140px">Lancer les dés</button>
              ${g.upgrades.lucky ? `<button class="btn ${luckyReady() ? "btn-green" : "btn-ghost"}" data-dice-lucky ${rolling || !luckyReady() ? "disabled" : ""}>🍀 ${luckyReady() ? "Pipés" : U.formatCountdown(luckyCooldown())}</button>` : ""}
              <button class="btn ${g.autoOn ? "btn-cyan" : "btn-ghost"}" data-dice-auto>${g.autoOn ? "⏸ Auto" : "▶ Auto"}</button>
            </div>
          </div>
          <div class="dice-payout-row" style="justify-content:center;gap:14px;flex-wrap:wrap">
            <span>Gain potentiel <strong>🪙 ${U.fmt(currentBet() * mult)}</strong></span>
            <span>Retour théorique <strong>${Math.round(CFG.houseEdge * 100)} %</strong></span>
            ${lastResult ? `<span>Dernier lancer <strong>${lastResult.total}</strong></span>` : ""}
          </div>
        </div>`;
      const slider = root.querySelector("#dice-threshold");
      if (slider) {
        slider.addEventListener("input", () => {
          if (rolling) return;
          g.threshold = parseInt(slider.value, 10);
          updateDiceConfigLabels();
          App.state.saveSoon();
        });
      }
      renderStageStats();
    }

    function updateDiceConfigLabels() {
      clampThreshold();
      const chance = winChance();
      const mult = payoutMult();
      const set = (id, value) => {
        const el = container.querySelector("#" + id);
        if (el) el.textContent = value;
      };
      set("dice-threshold-value", (g.direction === "over" ? ">" : "<") + " " + g.threshold);
      set("dice-chance", (chance * 100).toFixed(1) + " %");
      set("dice-payout", "×" + mult.toFixed(2));
      set("dice-potential", "🪙 " + U.fmt(currentBet() * mult));
    }

    function setRollControlsDisabled(disabled) {
      ["[data-dice-roll]", "[data-dice-lucky]", "[data-dice-dir]", "#dice-threshold", "[data-dice-bet-step]", "[data-dice-bet]", "[data-dice-auto]"].forEach((sel) => {
        container.querySelectorAll(sel).forEach((el) => { el.disabled = disabled; });
      });
      if (!disabled) {
        const lucky = container.querySelector("[data-dice-lucky]");
        if (lucky) lucky.disabled = !luckyReady();
      }
    }

    function renderStageStats() {
      const chance = winChance();
      const mult = payoutMult();
      const totalEl = container.querySelector("#dice-total");
      if (totalEl && !rolling && !lastResult) totalEl.textContent = "—";
      const side = container.querySelector("#dice-side");
      if (!side) return;
      const hist = history.length ? history.map((h) => `<span class="badge ${h.win ? "live" : "locked"}">${h.total}${h.win ? " ✓" : " ✗"}</span>`).join("") : `<span class="muted" style="font-size:9px">Aucun lancer.</span>`;
      const content = side.querySelector("#dice-side-info");
      if (content) {
        content.innerHTML = `<div class="panel"><div class="panel-head"><h3>🎲 Configuration</h3></div><div class="panel-body" style="padding:11px 12px">
          <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted)"><span>Dés</span><strong style="color:var(--text-soft)">${diceCount()} / ${maxDice()}</strong></div>
          <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Seuil</span><strong style="color:var(--gold)">${g.direction === "over" ? ">" : "<"} ${g.threshold}</strong></div>
          <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Chance</span><strong style="color:var(--cyan)">${(chance * 100).toFixed(1)} %</strong></div>
          <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Paiement</span><strong style="color:var(--green)">×${mult.toFixed(2)}</strong></div>
          <div class="divider" style="margin:9px 0"></div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">${hist}</div>
        </div></div>`;
      }
    }

    function renderControls() {
      // Les contrôles sont reconstruits avec renderStage, on met juste à jour l'état des boutons.
    }

    function updateHeader() {
      const plays = container.querySelector("#dice-plays");
      const wins = container.querySelector("#dice-wins");
      const best = container.querySelector("#dice-best");
      const streak = container.querySelector("#dice-streak");
      if (plays) plays.textContent = U.fmt(g.stats.plays);
      if (wins) wins.textContent = U.fmt(g.stats.wins);
      if (best) best.textContent = U.fmt(g.stats.bestWin);
      if (streak) streak.textContent = String(g.stats.streak || 0);
    }

    function renderSide() {
      const side = container.querySelector("#dice-side");
      if (!side) return;
      const rows = Object.keys(CFG.upgrades).map((key) => {
        const def = CFG.upgrades[key];
        const level = g.upgrades[key];
        const max = def.costs ? def.costs.length : (def.max || 1);
        const maxed = level >= max;
        const cost = maxed ? 0 : (def.costs ? def.costs[level] : (def.cost !== undefined ? def.cost : Math.ceil(def.base * Math.pow(def.growth, level))));
        let label = "";
        if (key === "maxBet") label = "Mise max " + U.fmt(betOptions()[betOptions().length - 1]);
        else if (key === "multiDice") label = maxDice() + " dés max";
        else if (key === "lucky") label = level ? (luckyReady() ? "Prêt" : U.formatCountdown(luckyCooldown())) : "Non";
        else if (key === "auto") label = level ? "Auto rapide" : "Auto de base offert";
        else if (key === "insight") label = level ? "Probabilités affichées" : "Non";
        return `<div class="upgrade-row ${maxed ? "maxed" : ""}">
          <span class="upgrade-icon">${def.icon}</span>
          <div class="upgrade-main"><div class="upgrade-name">${def.name}</div><div class="upgrade-desc">${def.desc}</div><div class="upgrade-meta"><span class="upgrade-level">${label}</span></div></div>
          <button class="btn btn-xs ${maxed ? "btn-ghost maxed" : "btn-ghost upgrade-buy"} ${!maxed && d.tokens >= cost ? "affordable" : ""}" data-dice-buy="${key}" ${maxed ? "disabled" : ""}>${maxed ? "MAX" : "🪙 " + U.fmt(cost)}</button>
        </div>`;
      }).join("");
      side.innerHTML = `<div class="panel"><div class="panel-head"><h3>⚡ Améliorations</h3><span class="panel-hint">Jetons</span></div><div class="panel-body" style="padding:10px"><div class="upgrade-list">${rows}</div></div></div>
        <div id="dice-side-info"></div>`;
      renderStageStats();
    }

    // ---------------- Init ----------------
    const gm = App.meta.gameMeta("dice");
    container.innerHTML = `
      <div class="game-header">
        <div class="game-title-wrap"><span class="game-title-icon">${gm.icon}</span><div><h1>Dés</h1><p>${gm.tagline}</p></div></div>
        <div class="game-header-stats">
          <span class="game-stat-chip">Lancers <strong id="dice-plays">${U.fmt(g.stats.plays)}</strong></span>
          <span class="game-stat-chip">Gains <strong id="dice-wins">${U.fmt(g.stats.wins)}</strong></span>
          <span class="game-stat-chip">Meilleur <strong id="dice-best">${U.fmt(g.stats.bestWin)}</strong></span>
          <span class="game-stat-chip">Série <strong id="dice-streak">${g.stats.streak || 0}</strong></span>
        </div>
      </div>
      <div class="game-layout wide-side">
        <section class="game-stage dice-stage"><div id="dice-root"></div></section>
        <aside class="game-side" id="dice-side"></aside>
      </div>`;

    renderStage();
    renderSide();
    updateHeader();

    const onClick = (e) => {
      if (e.target.closest("[data-dice-roll]")) {
        if (g.autoOn) { g.autoOn = false; }
        roll(false);
        return;
      }
      if (e.target.closest("[data-dice-lucky]")) {
        roll(true);
        return;
      }
      const dir = e.target.closest("[data-dice-dir]");
      if (dir && !rolling) {
        g.direction = dir.dataset.diceDir;
        clampThreshold();
        App.audio.play("click");
        renderStage();
        App.state.saveSoon();
        return;
      }
      const preset = e.target.closest("[data-dice-bet]");
      if (preset && !rolling) {
        const v = parseInt(preset.dataset.diceBet, 10);
        let idx = betOptions().findIndex((x) => x >= v);
        if (idx < 0) idx = betOptions().length - 1;
        g.betIndex = idx;
        renderStage();
        App.state.saveSoon();
        return;
      }
      const step = e.target.closest("[data-dice-bet-step]");
      if (step && !rolling) {
        g.betIndex = U.clamp(g.betIndex + parseInt(step.dataset.diceBetStep, 10), 0, betOptions().length - 1);
        renderStage();
        App.state.saveSoon();
        return;
      }
      if (e.target.closest("[data-dice-auto]")) {
        g.autoOn = !g.autoOn;
        App.audio.play("click");
        renderStage();
        if (g.autoOn) scheduleAuto();
        else if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
        App.state.saveSoon();
        return;
      }
      const buy = e.target.closest("[data-dice-buy]");
      if (buy) { buyUpgrade(buy.dataset.diceBuy); return; }
    };
    container.addEventListener("click", onClick);

    function buyUpgrade(key) {
      if (rolling) {
        App.audio.play("error");
        return;
      }
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
      if (key === "multiDice") {
        g.diceCount = maxDice();
        g.threshold = Math.floor((minSum() + maxSum()) / 2);
      }
      App.audio.play("purchase");
      App.fx.burst(window.innerWidth * 0.7, window.innerHeight * 0.4, { colors: ["#60a5fa", "#ff4fd8"], count: 16 });
      App.ui.toast("Amélioration achetée", def.name, def.icon, "gold");
      App.meta.checkAchievements();
      App.state.saveSoon();
      renderStage();
      renderSide();
      updateHeader();
    }

    // Recharge du cooldown affiché
    const timer = setInterval(() => {
      if (destroyed) return;
      if (g.upgrades.lucky) {
        const btn = container.querySelector("[data-dice-lucky]");
        if (btn) {
          const ready = luckyReady();
          btn.classList.toggle("btn-green", ready);
          btn.classList.toggle("btn-ghost", !ready);
          btn.textContent = "🍀 " + (ready ? "Pipés" : U.formatCountdown(luckyCooldown()));
          btn.disabled = rolling || !ready;
        }
      }
      updateHeader();
    }, 1000);
    timers.add(timer);

    const cleanup = () => {
      destroyed = true;
      clearTimers();
      clearInterval(timer);
      container.removeEventListener("click", onClick);
      if (rolling && rollState) {
        App.meta.refund(rollState.bet, "dice");
      }
      rolling = false;
      rollState = null;
      activeCleanup = null;
    };
    activeCleanup = cleanup;
    if (g.autoOn) scheduleAuto();
    return cleanup;
  };

  App.games = App.games || {};
  App.games.dice = Game;
})();
