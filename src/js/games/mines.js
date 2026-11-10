/* ============================================================
   NEON JACKPOT — games/mines.js
   Mines : grille, multiplicateur, radar, bouclier, auto
   ============================================================ */
(function () {
  "use strict";

  const App = window.App;
  const U = App.utils;
  const D = window.GAME_DATA;
  const CFG = D.balance.mines;

  const Game = {};
  let activeCleanup = null;

  Game.render = function (container) {
    if (activeCleanup) activeCleanup();
    const d = App.state.data;
    const g = d.games.mines;

    let active = false;
    let grid = [];
    let mines = new Set();
    let revealed = new Set();
    let shieldedCells = new Set();
    let radarHints = new Set();
    let safeCount = 0;
    let bet = 0;
    let mult = 1;
    let lastPop = -1;
    let activeBet = 0;
    let shieldLeft = 0;
    let radarBase = 0;
    let lastOutcome = null;
    let autoTimer = null;
    let timers = new Set();
    let destroyed = false;

    const size = () => {
      const allowed = allowedSizes();
      if (!allowed.includes(g.gridSize)) g.gridSize = allowed[allowed.length - 1];
      return g.gridSize;
    };
    const allowedSizes = () => {
      const sizes = [5];
      if (g.upgrades.size >= 1) sizes.push(6);
      if (g.upgrades.size >= 2) sizes.push(7);
      return sizes;
    };
    const totalCells = () => size() * size();
    const mineCount = () => {
      if (!g.upgrades.minesChoice) return CFG.defaultMines;
      return U.clamp(g.mines, 1, totalCells() - 1);
    };
    const betOptions = () => CFG.betSteps.slice(0, Math.min(CFG.betSteps.length, 3 + g.upgrades.maxBet));
    const currentBet = () => betOptions()[U.clamp(g.betIndex, 0, betOptions().length - 1)] || CFG.minBet;
    const currentMult = () => {
      if (!safeCount) return 1;
      const safe = totalCells() - mineCount();
      return CFG.houseEdge * (U.comb(totalCells(), safeCount) / Math.max(1e-9, U.comb(safe, safeCount)));
    };
    const potential = () => (activeBet || currentBet()) * (active ? currentMult() : 1);

    function later(fn, ms) {
      const id = setTimeout(() => {
        timers.delete(id);
        if (!destroyed) fn();
      }, ms);
      timers.add(id);
    }

    function beginGame() {
      if (active) return;
      const amount = currentBet();
      if (!App.meta.canAfford("tokens", amount)) {
        App.audio.play("error");
        App.ui.toast("Jetons insuffisants", "Réduisez la mise ou ouvrez le coffre de secours.", "🪙", "danger");
        return;
      }
      if (!App.meta.bet(amount, "mines")) return;
      active = true;
      activeBet = amount;
      bet = amount;
      grid = new Array(totalCells()).fill(null);
      mines = new Set();
      while (mines.size < mineCount()) mines.add(U.randInt(0, totalCells() - 1));
      revealed = new Set();
      shieldedCells = new Set();
      radarHints = new Set();
      safeCount = 0;
      mult = 1;
      lastPop = -1;
      lastOutcome = null;
      shieldLeft = g.upgrades.shield ? 1 : 0;
      radarBase = g.upgrades.radar ? 1 : 0;
      App.audio.play("deal");
      App.fx.burst(window.innerWidth / 2, window.innerHeight / 2, { colors: ["#f59e0b", "#ff4fd8"], count: 20 });
      draw();
      App.state.saveSoon();
    }

    function reveal(index) {
      if (!active || revealed.has(index)) return;
      const cellEl = container.querySelector(`[data-mine-cell="${index}"]`);
      const rect = cellEl ? cellEl.getBoundingClientRect() : null;
      const isMine = mines.has(index);
      radarHints.delete(index);
      if (isMine) {
        if (shieldLeft > 0) {
          shieldLeft--;
          revealed.add(index);
          shieldedCells.add(index);
          lastPop = index;
          App.audio.play("whoosh");
          App.fx.rings(rect ? rect.left + rect.width / 2 : window.innerWidth / 2, rect ? rect.top + rect.height / 2 : window.innerHeight / 2, { size: 10, grow: 100, color: "#22d3ee", life: 0.6 });
          App.ui.toast("Bouclier utilisé", "La mine est neutralisée. Continuez, mais prudemment.", "🛡️", "gold");
          draw();
          return;
        }
        bust(index);
        return;
      }
      revealed.add(index);
      safeCount++;
      mult = currentMult();
      if (mult > (g.stats.bestMult || 1)) g.stats.bestMult = mult;
      lastPop = index;
      App.audio.play("coin");
      if (rect) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        App.fx.burst(cx, cy, { colors: ["#4ade80", "#22d3ee", "#ffffff"], count: 18, maxSpeed: 160 });
        App.fx.floatingText(U.fmtMult(mult), cx, cy - 24, { className: "mult", duration: 0.9 });
      }
      if (g.upgrades.golden && Math.random() < 0.08) {
        const gems = U.randInt(1, 2);
        App.meta.grant("gems", gems, {});
        if (rect) App.fx.emojiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, "💎", 5);
        App.ui.toast("Mine d'or", "+" + gems + " gemme" + (gems > 1 ? "s" : ""), "💎", "gem");
      }
      draw();
      if (g.upgrades.autoCashout && currentMult() >= g.autoCashoutAt) {
        App.ui.toast("Encaissement auto", "Objectif ×" + g.autoCashoutAt + " atteint.", "🎯", "gold");
        later(() => cashout(true), 500);
      }
    }

    function bust(index) {
      active = false;
      lastPop = -1;
      lastOutcome = "bust";
      g.stats.busts += 1;
      App.meta.loss("mines", { silent: true });
      App.audio.play("explosion");
      App.fx.shake(9, 600);
      App.fx.flash("rgba(255,84,112,0.18)", 0.45);
      const cellEl = container.querySelector(`[data-mine-cell="${index}"]`);
      if (cellEl) {
        const rect = cellEl.getBoundingClientRect();
        App.fx.emojiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, "💥", 10);
        App.fx.rings(rect.left + rect.width / 2, rect.top + rect.height / 2, { size: 8, grow: 180, color: "#ff5470", life: 0.7 });
      }
      App.ui.toast("BOOM", "Vous avez perdu " + U.fmt(activeBet) + " jetons.", "💣", "danger");
      draw();
      App.meta.checkAchievements();
      App.state.saveSoon();
    }

    function cashout(auto) {
      if (!active || safeCount === 0) return;
      const payout = activeBet * currentMult();
      const multNow = currentMult();
      active = false;
      lastOutcome = "win";
      lastPop = -1;
      g.stats.cashouts += 1;
      g.stats.bestMult = Math.max(g.stats.bestMult || 1, multNow);
      App.meta.payout(payout, "mines", { stake: activeBet, mult: multNow, silent: true });
      App.audio.play("cashout");
      App.fx.coinBurst(window.innerWidth / 2, window.innerHeight / 2, payout);
      App.fx.confetti(multNow >= 10 ? 80 : 35);
      App.fx.floatingText("+" + U.fmt(payout), window.innerWidth / 2, window.innerHeight / 2 - 40, { className: "win", duration: 1.5, size: 26 });
      App.ui.toast(auto ? "Encaissement automatique" : "Encaissé !", "+" + U.fmt(payout) + " jetons · " + U.fmtMult(multNow), "💰", "gold");
      App.state.log("💣", "Gain — Mines", "+" + U.fmt(payout));
      if (multNow >= 10) App.meta.triggerSynergy("mines_cashout_10x", { mult: multNow });
      App.meta.checkAchievements();
      App.state.saveSoon();
      draw();
    }

    function useRadar() {
      if (!active) {
        App.audio.play("error");
        App.ui.toast("Partie non commencée", "Le radar s'utilise pendant une partie.", "📡", "danger");
        return;
      }
      const available = radarBase + (d.charges.radar || 0);
      if (available <= 0) {
        App.audio.play("error");
        App.ui.toast("Radar vide", "Rechargez-le avec une amélioration ou une synergie.", "📡", "danger");
        return;
      }
      const safeCells = [];
      for (let i = 0; i < totalCells(); i++) {
        if (!mines.has(i) && !revealed.has(i) && !radarHints.has(i)) safeCells.push(i);
      }
      if (!safeCells.length) return;
      const target = U.pick(safeCells);
      radarHints.add(target);
      if (radarBase > 0) radarBase--;
      else d.charges.radar = Math.max(0, d.charges.radar - 1);
      App.audio.play("unlock");
      App.fx.rings(
        window.innerWidth / 2, window.innerHeight / 2,
        { size: 10, grow: 300, color: "#22d3ee", life: 0.8 }
      );
      App.ui.toast("Radar", "Une case sûre est révélée par une onde cyan.", "📡", "gem");
      draw();
      App.state.saveSoon();
    }

    function autoReveal() {
      if (!active || !g.upgrades.auto) return;
      const safeCells = [];
      for (let i = 0; i < totalCells(); i++) {
        if (!mines.has(i) && !revealed.has(i)) safeCells.push(i);
      }
      if (!safeCells.length) return;
      reveal(U.pick(safeCells));
    }

    function scheduleMinesAuto(ms) {
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = setTimeout(() => {
        autoTimer = null;
        minesAutoStep();
      }, ms);
    }

    function minesAutoStep() {
      if (destroyed || !g.autoOn) return;
      if (!active) {
        if (!App.meta.canAfford("tokens", currentBet())) {
          g.autoOn = false;
          App.ui.toast("Auto-mines arrêté", "Votre solde ne permet plus la mise actuelle.", "🤖", "danger");
          draw();
          return;
        }
        beginGame();
        scheduleMinesAuto(700);
        return;
      }
      const targetMult = g.upgrades.autoCashout ? g.autoCashoutAt : 2;
      if (safeCount > 0 && currentMult() >= targetMult) {
        cashout(true);
        scheduleMinesAuto(1300);
        return;
      }
      const pool = [];
      for (let i = 0; i < totalCells(); i++) {
        if (revealed.has(i)) continue;
        if (g.upgrades.auto && mines.has(i)) continue;
        pool.push(i);
      }
      if (!pool.length) {
        if (safeCount > 0) cashout(true);
        scheduleMinesAuto(1000);
        return;
      }
      reveal(U.pick(pool));
      if (!active) scheduleMinesAuto(1500);
      else scheduleMinesAuto(620);
    }

    function toggleMinesAuto() {
      g.autoOn = !g.autoOn;
      App.audio.play("click");
      if (g.autoOn) {
        if (!active) beginGame();
        scheduleMinesAuto(500);
      } else if (autoTimer) {
        clearTimeout(autoTimer);
        autoTimer = null;
      }
      draw();
      App.state.saveSoon();
    }

    // ---------------- Rendu ----------------
    function draw() {
      const root = container.querySelector("#mines-root");
      const side = container.querySelector("#mines-side");
      if (!root || !side) return;
      const total = totalCells();
      const minesN = mineCount();
      const multNow = currentMult();
      const displayMult = active ? multNow : lastOutcome === "win" ? mult : 1;
      const canStart = !active;
      const revealMines = !active && (lastOutcome === "bust" || lastOutcome === "win");

      const tiles = [];
      for (let i = 0; i < total; i++) {
        const isRevealed = revealed.has(i);
        const isMine = mines.has(i);
        const isShielded = shieldedCells.has(i);
        const isHint = radarHints.has(i);
        let cls = "mine-tile";
        let content = "";
        if (isRevealed) {
          cls += " revealed";
          if (isShielded) { cls += " shielded safe"; content = "🛡️"; }
          else if (isMine) { cls += " mine"; content = "💥"; }
          else { cls += " safe"; content = "💎"; }
        } else if (revealMines && isMine) {
          cls += " revealed mine"; content = "💣";
        } else if (isHint) {
          cls += " radar-cell"; content = "•";
        }
        if (i === lastPop) cls += " pop";
        tiles.push(`<button class="${cls}" data-mine-cell="${i}" ${active && !isRevealed ? "" : "disabled"} aria-label="Case ${i + 1}">${content}</button>`);
      }

      root.innerHTML = `
        <div class="mines-grid-wrap">
          <div class="mines-grid" style="grid-template-columns:repeat(${size()},minmax(0,1fr))">${tiles.join("")}</div>
          <div class="mines-hud">
            <div><div class="mines-mult-label">Multiplicateur</div><div class="mines-mult">${U.fmtMult(displayMult)}</div></div>
            <div class="mines-count"><strong>${active ? safeCount : 0} / ${total - minesN}</strong>cases sûres · ${minesN} mines</div>
            <div style="text-align:right"><div class="mines-mult-label">Gain potentiel</div><div style="font-family:var(--mono);font-size:13px;color:var(--green)">🪙 ${U.fmt(active ? activeBet * multNow : potential())}</div></div>
          </div>
          <div class="mines-actions">
            <button class="btn btn-green" data-mines-cashout ${active && safeCount > 0 ? "" : "disabled"}>💰 Encaisser ${active && safeCount > 0 ? U.fmt(activeBet * multNow) : ""}</button>
            <button class="btn ${g.autoOn ? "btn-cyan" : "btn-ghost"}" data-mines-autoplay>🤖 ${g.autoOn ? "Auto actif" : "Auto"}</button>
            <button class="btn btn-ghost" data-mines-radar ${active ? "" : "disabled"}>📡 Radar (${radarBase + (d.charges.radar || 0)})</button>
            ${g.upgrades.auto ? `<button class="btn btn-cyan" data-mines-auto ${active ? "" : "disabled"}>🎯 Révéler</button>` : ""}
          </div>
          ${lastOutcome ? `<div class="bj-message ${lastOutcome === "win" ? "big" : ""}" style="min-height:22px"><strong>${lastOutcome === "win" ? "Encaissé à " + U.fmtMult(mult) : "Explosion à " + U.fmtMult(1)}</strong><span>${lastOutcome === "win" ? "+" + U.fmt(activeBet * mult) + " jetons" : "La prochaine sera la bonne."}</span></div>` : `<div class="bj-message" style="min-height:22px"><span>${active ? "Révélez une case, puis encaissez avant la mine." : "Lancez une partie pour commencer."}</span></div>`}
        </div>`;

      const rows = Object.keys(CFG.upgrades).map((key) => {
        const def = CFG.upgrades[key];
        const level = g.upgrades[key];
        const max = def.costs ? def.costs.length : (def.max || 1);
        const maxed = level >= max;
        const cost = maxed ? 0 : (def.costs ? def.costs[level] : (def.cost !== undefined ? def.cost : Math.ceil(def.base * Math.pow(def.growth, level))));
        let label = "";
        if (key === "maxBet") label = "Mise max " + U.fmt(betOptions()[betOptions().length - 1]);
        else if (key === "minesChoice") label = level ? "1 à " + (total - 1) + " mines" : "3 mines fixes";
        else if (key === "size") label = level ? allowedSizes().join(" / ") + "×" + allowedSizes()[allowedSizes().length - 1] : "5×5";
        else if (key === "autoCashout") label = level ? "Seuil ×" + g.autoCashoutAt : "Non";
        else if (key === "radar") label = level ? "1 charge / partie" : "Non";
        else if (key === "shield") label = level ? "1 bouclier / partie" : "Non";
        else if (key === "golden") label = level ? "Chance de gemmes" : "Non";
        else if (key === "auto") label = level ? "Cases sûres" : "Aléatoire";
        return `<div class="upgrade-row ${maxed ? "maxed" : ""}">
          <span class="upgrade-icon">${def.icon}</span>
          <div class="upgrade-main"><div class="upgrade-name">${def.name}</div><div class="upgrade-desc">${def.desc}</div><div class="upgrade-meta"><span class="upgrade-level">${label}</span></div></div>
          <button class="btn btn-xs ${maxed ? "btn-ghost maxed" : "btn-ghost upgrade-buy"} ${!maxed && d.tokens >= cost ? "affordable" : ""}" data-mines-buy="${key}" ${maxed ? "disabled" : ""}>${maxed ? "MAX" : "🪙 " + U.fmt(cost)}</button>
        </div>`;
      }).join("");

      side.innerHTML = `
        <div class="panel"><div class="panel-head"><h3>⛏️ Partie</h3><span class="panel-hint">${active ? "En cours" : "Prête"}</span></div><div class="panel-body" style="padding:11px">
          <div class="mines-setup-row"><span>Mise</span><div style="display:flex;gap:5px;align-items:center"><button class="bet-step" data-mines-bet="-1" ${active ? "disabled" : ""}>−</button><strong>🪙 ${U.fmt(activeBet || currentBet())}</strong><button class="bet-step" data-mines-bet="1" ${active ? "disabled" : ""}>+</button></div></div>
          <div class="mines-setup-row"><span>Grille</span><div class="segmented">${allowedSizes().map((s) => `<button class="seg-btn ${g.gridSize === s ? "active" : ""}" data-mines-size="${s}" ${active ? "disabled" : ""}>${s}×${s}</button>`).join("")}</div></div>
          <div class="mines-setup-row"><span>Mines</span><div style="display:flex;gap:5px;align-items:center"><button class="bet-step" data-mines-count="-1" ${active || !g.upgrades.minesChoice ? "disabled" : ""}>−</button><strong>${minesN}</strong><button class="bet-step" data-mines-count="1" ${active || !g.upgrades.minesChoice ? "disabled" : ""}>+</button></div></div>
          <div class="mines-setup-row"><span>Auto-cashout</span><div style="display:flex;gap:5px;align-items:center"><button class="bet-step" data-mines-target="-1" ${active || !g.upgrades.autoCashout ? "disabled" : ""}>−</button><strong>×${g.autoCashoutAt}</strong><button class="bet-step" data-mines-target="1" ${active || !g.upgrades.autoCashout ? "disabled" : ""}>+</button></div></div>
          <div class="mines-setup-row"><span>Bouclier</span><span class="badge ${shieldLeft ? "cyan" : "locked"}">${g.upgrades.shield ? shieldLeft + " / 1" : "Non débloqué"}</span></div>
          <div class="mines-setup-row"><span>Radar</span><span class="badge ${radarBase + (d.charges.radar || 0) > 0 ? "cyan" : "locked"}">${radarBase + (d.charges.radar || 0)} charge(s)</span></div>
          <button class="btn btn-primary btn-block" data-mines-start ${active ? "disabled" : ""} style="margin-top:9px">${active ? "Partie en cours…" : "Commencer · 🪙 " + U.fmt(currentBet())}</button>
        </div></div>
        <div class="panel"><div class="panel-head"><h3>⚡ Améliorations</h3><span class="panel-hint">Jetons</span></div><div class="panel-body" style="padding:10px"><div class="upgrade-list">${rows}</div></div></div>
        <div class="panel"><div class="panel-body" style="padding:10px 12px">
          <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted)"><span>Mines</span><strong style="color:var(--red)">${minesN}</strong></div>
          <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Cases</span><strong style="color:var(--text-soft)">${total}</strong></div>
          <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Meilleur multi</span><strong style="color:var(--gold)">${U.fmtMult(g.stats.bestMult || 1)}</strong></div>
        </div></div>`;
      updateHeader();
    }

    function updateHeader() {
      const plays = container.querySelector("#mines-plays");
      const wins = container.querySelector("#mines-wins");
      const best = container.querySelector("#mines-best");
      const busts = container.querySelector("#mines-busts");
      if (plays) plays.textContent = U.fmt(g.stats.plays);
      if (wins) wins.textContent = U.fmt(g.stats.cashouts);
      if (best) best.textContent = U.fmtMult(g.stats.bestMult || 1);
      if (busts) busts.textContent = U.fmt(g.stats.busts);
    }

    // ----- Init -----
    const gm = App.meta.gameMeta("mines");
    container.innerHTML = `
      <div class="game-header">
        <div class="game-title-wrap"><span class="game-title-icon">${gm.icon}</span><div><h1>Mines</h1><p>${gm.tagline}</p></div></div>
        <div class="game-header-stats">
          <span class="game-stat-chip">Parties <strong id="mines-plays">${U.fmt(g.stats.plays)}</strong></span>
          <span class="game-stat-chip">Encaissements <strong id="mines-wins">${U.fmt(g.stats.cashouts)}</strong></span>
          <span class="game-stat-chip">Meilleur <strong id="mines-best">${U.fmtMult(g.stats.bestMult || 1)}</strong></span>
          <span class="game-stat-chip">Busts <strong id="mines-busts">${U.fmt(g.stats.busts)}</strong></span>
        </div>
      </div>
      <div class="game-layout wide-side">
        <section class="game-stage mines-stage">
          <div id="mines-root"></div>
        </section>
        <aside class="game-side" id="mines-side"></aside>
      </div>`;
    draw();

    const onClick = (e) => {
      if (e.target.closest("[data-mines-start]")) { beginGame(); return; }
      if (e.target.closest("[data-mines-autoplay]")) { toggleMinesAuto(); return; }
      const cell = e.target.closest("[data-mine-cell]");
      if (cell) { reveal(parseInt(cell.dataset.mineCell, 10)); return; }
      if (e.target.closest("[data-mines-cashout]")) { cashout(false); return; }
      if (e.target.closest("[data-mines-radar]")) { useRadar(); return; }
      if (e.target.closest("[data-mines-auto]")) { autoReveal(); return; }
      const betBtn = e.target.closest("[data-mines-bet]");
      if (betBtn && !active) {
        const options = betOptions();
        g.betIndex = U.clamp(g.betIndex + parseInt(betBtn.dataset.minesBet, 10), 0, options.length - 1);
        App.audio.play("tick");
        draw();
        App.state.saveSoon();
        return;
      }
      const sizeBtn = e.target.closest("[data-mines-size]");
      if (sizeBtn && !active) {
        g.gridSize = parseInt(sizeBtn.dataset.minesSize, 10);
        g.mines = U.clamp(g.mines, 1, totalCells() - 1);
        App.audio.play("click");
        draw();
        App.state.saveSoon();
        return;
      }
      const countBtn = e.target.closest("[data-mines-count]");
      if (countBtn && !active) {
        g.mines = U.clamp(g.mines + parseInt(countBtn.dataset.minesCount, 10), 1, totalCells() - 1);
        App.audio.play("tick");
        draw();
        App.state.saveSoon();
        return;
      }
      const targetBtn = e.target.closest("[data-mines-target]");
      if (targetBtn && !active) {
        const steps = [2, 3, 5, 10, 25, 50, 100, 250];
        let idx = steps.findIndex((v) => v >= g.autoCashoutAt);
        if (idx < 0) idx = 0;
        idx = U.clamp(idx + parseInt(targetBtn.dataset.minesTarget, 10), 0, steps.length - 1);
        g.autoCashoutAt = steps[idx];
        App.audio.play("tick");
        draw();
        App.state.saveSoon();
        return;
      }
      const buy = e.target.closest("[data-mines-buy]");
      if (buy) { buyUpgrade(buy.dataset.minesBuy); return; }
    };
    container.addEventListener("click", onClick);

    function buyUpgrade(key) {
      if (active) {
        App.audio.play("error");
        App.ui.toast("Partie en cours", "Terminez la partie avant d'améliorer.", "⛏️", "danger");
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
      if (key === "minesChoice" && g.mines < 1) g.mines = 3;
      if (key === "size") g.gridSize = allowedSizes()[allowedSizes().length - 1];
      App.audio.play("purchase");
      App.fx.burst(window.innerWidth * 0.7, window.innerHeight * 0.4, { colors: ["#f59e0b", "#ff4fd8"], count: 15 });
      App.ui.toast("Amélioration achetée", def.name, def.icon, "gold");
      App.meta.checkAchievements();
      App.state.saveSoon();
      draw();
    }

    const cleanup = () => {
      destroyed = true;
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = null;
      timers.forEach(clearTimeout);
      timers.clear();
      container.removeEventListener("click", onClick);
      if (active) {
        if (safeCount > 0) {
          const payout = activeBet * currentMult();
          App.meta.payout(payout, "mines", { stake: activeBet, mult: currentMult(), silent: true });
          g.stats.cashouts += 1;
          g.stats.bestMult = Math.max(g.stats.bestMult || 1, currentMult());
        } else {
          App.meta.refund(activeBet, "mines");
        }
        active = false;
      }
      activeCleanup = null;
    };
    activeCleanup = cleanup;
    if (g.autoOn) scheduleMinesAuto(800);
    return cleanup;
  };

  App.games = App.games || {};
  App.games.mines = Game;
})();
