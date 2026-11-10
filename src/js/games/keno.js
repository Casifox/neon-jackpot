/* ============================================================
   NEON JACKPOT — games/keno.js
   Keno : 80 numéros, 20 boules, numéros chanceux, multi-cartes
   ============================================================ */
(function () {
  "use strict";

  const App = window.App;
  const U = App.utils;
  const D = window.GAME_DATA;
  const CFG = D.balance.keno;

  const Game = {};
  let activeCleanup = null;

  Game.render = function (container) {
    if (activeCleanup) activeCleanup();
    const d = App.state.data;
    const g = d.games.keno;

    let drawing = false;
    let drawState = null;
    let currentDrawn = new Set();
    let lastBalls = [];
    let lastResult = null;
    let timers = new Set();
    let autoTimer = null;
    let destroyed = false;
    let activeTab = "upgrades";

    const betOptions = () => CFG.betSteps.slice(0, Math.min(CFG.betSteps.length, 3 + g.upgrades.maxBet));
    const currentBet = () => betOptions()[U.clamp(g.betIndex, 0, betOptions().length - 1)] || CFG.minBet;
    const cards = () => 1 + g.upgrades.multiCard;
    const picks = () => Array.from(new Set(g.picks)).filter((n) => n >= 1 && n <= 80).sort((a, b) => a - b);
    const picksCount = () => picks().length;
    const intervalMs = () => (g.upgrades.fastDraw ? 75 : 145);

    function normalizedPayouts(pickCount) {
      const shape = CFG.payoutShapes[String(pickCount)];
      if (!shape) return [];
      let ev = 0;
      const probs = [];
      for (let h = 0; h <= pickCount; h++) {
        const p = U.hypergeometric(80, pickCount, CFG.drawCount, h);
        probs.push(p);
        ev += p * (shape[h] || 0);
      }
      const scale = ev > 0 ? CFG.houseEdge / ev : 0;
      const out = [];
      for (let h = 0; h <= pickCount; h++) out.push((shape[h] || 0) * scale);
      return out;
    }

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

    // ---------------- Tirage ----------------
    function startDraw() {
      if (drawing) return;
      const chosen = picks();
      if (!chosen.length) {
        App.audio.play("error");
        App.ui.toast("Aucun numéro", "Choisissez au moins un numéro avant de lancer.", "🔢", "danger");
        return;
      }
      const nCards = cards();
      const stake = currentBet() * nCards;
      if (!App.meta.canAfford("tokens", stake)) {
        App.audio.play("error");
        App.ui.toast("Jetons insuffisants", "Réduisez la mise ou désactivez les cartes multiples.", "🪙", "danger");
        g.autoOn = false;
        renderStage();
        return;
      }
      if (!App.meta.bet(stake, "keno")) return;
      g.lastPicks = chosen.slice();
      const draws = [];
      for (let c = 0; c < nCards; c++) {
        const pool = Array.from({ length: 80 }, (_, i) => i + 1);
        draws.push(U.shuffle(pool).slice(0, CFG.drawCount));
      }
      currentDrawn = new Set();
      lastBalls = [];
      lastResult = null;
      drawing = true;
      drawState = {
        stake,
        cards: draws,
        picks: chosen,
        index: 0,
        fast: !!g.upgrades.fastDraw
      };
      App.audio.play("spin");
      renderStage();
      later(stepDraw, 280);
    }

    function stepDraw() {
      if (!drawState) return;
      if (drawState.index >= CFG.drawCount) {
        finishDraw();
        return;
      }
      const n = drawState.cards[0][drawState.index];
      currentDrawn.add(n);
      lastBalls.push(n);
      drawState.index += 1;
      App.audio.play("tick");
      paintBoard();
      paintBallStrip();
      if (drawState.index >= CFG.drawCount) {
        later(finishDraw, 350);
      } else {
        later(stepDraw, intervalMs());
      }
    }

    function finishDraw() {
      if (!drawState) return;
      const snap = drawState;
      drawState = null;
      drawing = false;
      const results = snap.cards.map((draw, i) => {
        const drawSet = new Set(draw);
        const hits = snap.picks.filter((n) => drawSet.has(n)).length;
        return { card: i, hits, win: false, payout: 0, luckyMatches: 0 };
      });
      const payouts = normalizedPayouts(snap.picks.length);
      let totalBase = 0;
      let bestHits = 0;
      let luckyMatchesTotal = 0;
      results.forEach((res) => {
        const drawSet = new Set(snap.cards[res.card]);
        const luckyMatches = snap.picks.filter((n) => (g.lucky || []).includes(n) && drawSet.has(n)).length;
        const luckMult = g.upgrades.luckyNumbers ? 1 + Math.min(0.2, luckyMatches * 0.02) : 1;
        res.luckyMatches = luckyMatches;
        luckyMatchesTotal += luckyMatches;
        const mult = (payouts[res.hits] || 0) * luckMult;
        res.payout = snap.stake / snap.cards.length * mult;
        res.win = res.payout > 0;
        totalBase += res.payout;
        bestHits = Math.max(bestHits, res.hits);
      });
      const global = App.meta.globalMult();
      const profit = Math.max(0, totalBase - snap.stake);
      const finalAmount = totalBase + profit * (global - 1);
      if (totalBase > 0) {
        App.meta.credit(finalAmount, "keno", {
          stake: snap.stake,
          mult: totalBase / snap.stake,
          silent: true,
          countWin: totalBase > snap.stake
        });
      }
      if (totalBase <= snap.stake) {
        App.meta.loss("keno", { silent: true });
      }
      g.stats.bestHits = Math.max(g.stats.bestHits || 0, bestHits);
      lastResult = { results, total: finalAmount, bestHits, base: totalBase, stake: snap.stake };
      if (totalBase > snap.stake) {
        App.audio.play(bestHits >= 7 ? "jackpot" : bestHits >= 4 ? "bigwin" : "win");
        App.fx.coinBurst(window.innerWidth / 2, window.innerHeight / 2, finalAmount);
        App.fx.floatingText("+" + U.fmt(finalAmount), window.innerWidth / 2, window.innerHeight / 2 - 30, { className: "win", duration: 1.5, size: 25 });
        if (bestHits >= 5) App.fx.confetti(70);
        if (bestHits >= 7) {
          App.fx.shake(5, 350);
          App.meta.triggerSynergy("keno_7_hits", { hits: bestHits });
        }
        App.state.log("🔢", "Gain — Keno", "+" + U.fmt(finalAmount));
      } else if (totalBase > 0) {
        App.audio.play("coin");
      } else {
        App.audio.play("lose");
      }
      renderStage();
      renderSide();
      updateHeader();
      App.meta.checkAchievements();
      App.state.saveSoon();
      if (g.autoOn) scheduleAuto();
    }

    function scheduleAuto() {
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = null;
      if (!g.autoOn || drawing) return;
      autoTimer = setTimeout(() => {
        autoTimer = null;
        if (destroyed) return;
        if (!picks().length) {
          g.autoOn = false;
          App.ui.toast("Auto-keno arrêté", "Choisissez des numéros.", "🤖", "danger");
          renderStage();
          return;
        }
        if (!App.meta.canAfford("tokens", currentBet() * cards())) {
          g.autoOn = false;
          App.ui.toast("Auto-keno arrêté", "Solde insuffisant.", "🤖", "danger");
          renderStage();
          return;
        }
        startDraw();
      }, 1500);
    }

    // ---------------- Rendu ----------------
    function paintBoard() {
      const board = container.querySelector("#keno-board");
      if (!board) return;
      const chosen = new Set(g.picks || []);
      const lucky = new Set(g.lucky || []);
      board.querySelectorAll("[data-keno-num]").forEach((cell) => {
        const n = parseInt(cell.dataset.kenoNum, 10);
        cell.className = "keno-number";
        if (lucky.has(n)) cell.classList.add("lucky");
        if (chosen.has(n)) cell.classList.add("picked");
        if (currentDrawn.has(n)) cell.classList.add("drawn");
      });
    }

    function paintBallStrip() {
      const el = container.querySelector("#keno-ball-strip");
      if (!el) return;
      const chosen = new Set(g.picks || []);
      el.innerHTML = lastBalls.map((n) => `<span class="keno-draw-ball ${chosen.has(n) ? "hit" : ""}">${n}</span>`).join("");
    }

    function renderStage() {
      const root = container.querySelector("#keno-root");
      if (!root) return;
      const chosen = picks();
      const board = [];
      const lucky = new Set(g.lucky || []);
      for (let n = 1; n <= 80; n++) {
        const cls = ["keno-number"];
        if (lucky.has(n)) cls.push("lucky");
        if (g.picks.includes(n)) cls.push("picked");
        if (currentDrawn.has(n)) cls.push("drawn");
        board.push(`<button class="${cls.join(" ")}" data-keno-num="${n}" ${drawing ? "disabled" : ""}>${n}</button>`);
      }
      const payouts = normalizedPayouts(chosen.length || 1);
      const chance = chosen.length ? "" : "";
      const nCards = cards();
      const totalStake = currentBet() * nCards;
      const resultsHtml = lastResult ? `<div class="panel" style="margin-top:10px"><div class="panel-head"><h3>🎯 Dernier tirage</h3><span class="panel-hint">${lastResult.bestHits} numéro${lastResult.bestHits > 1 ? "s" : ""} trouvé${lastResult.bestHits > 1 ? "s" : ""}</span></div><div class="panel-body" style="padding:9px 12px">
        ${lastResult.results.map((r, i) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 0;font-size:10px;color:var(--muted);border-bottom:1px solid rgba(255,255,255,.045)"><span>Grille ${i + 1}</span><span>${r.hits} / ${chosen.length} numéros · ${r.luckyMatches} chanceux</span><strong style="font-family:var(--mono);color:${r.payout > 0 ? "var(--gold)" : "var(--muted-2)"}">${r.payout > 0 ? "+" + U.fmt(r.payout) : "—"}</strong></div>`).join("")}
        <div style="display:flex;justify-content:space-between;padding-top:7px;font-size:11px"><span>Total</span><strong style="font-family:var(--mono);color:${lastResult.total > 0 ? "var(--green)" : "var(--red)"}">${lastResult.total > 0 ? "+" + U.fmt(lastResult.total) : "Perdu"}</strong></div>
      </div></div>` : "";
      root.innerHTML = `
        <div class="keno-layout">
          <div>
            <div class="keno-board" id="keno-board">${board.join("")}</div>
            <div class="keno-draw-strip" id="keno-ball-strip">${lastBalls.map((n) => `<span class="keno-draw-ball ${g.picks.includes(n) ? "hit" : ""}">${n}</span>`).join("")}</div>
            ${resultsHtml}
          </div>
          <div class="keno-side">
            <div class="panel"><div class="panel-head"><h3>🎟️ Votre grille</h3><span class="panel-hint">${chosen.length} / ${CFG.maxPicks}</span></div><div class="panel-body" style="padding:11px">
              <div class="keno-picks">${chosen.length ? chosen.map((n) => `<span class="keno-pick-chip">${n}${(g.lucky || []).includes(n) ? " ★" : ""}</span>`).join("") : `<span class="muted" style="font-size:9.5px">Aucun numéro sélectionné.</span>`}</div>
              <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px">
                <button class="btn btn-ghost btn-sm" data-keno-quick ${drawing ? "disabled" : ""}>⚡ Rapide</button>
                <button class="btn btn-ghost btn-sm" data-keno-clear ${drawing ? "disabled" : ""}>Effacer</button>
                ${g.upgrades.luckyNumbers ? `<button class="btn btn-ghost btn-sm" data-keno-lucky ${drawing ? "disabled" : ""} ${chosen.length ? "" : "disabled"}>★ Chanceux</button>` : ""}
              </div>
              <div class="dice-prob-row" style="margin-top:8px"><span>Cartes</span><strong>${nCards}</strong></div>
              <div class="dice-payout-row"><span>Mise totale <strong>🪙 ${U.fmt(totalStake)}</strong></span><span>${g.upgrades.multiCard ? "Multi-cartes" : "1 carte"}</span></div>
            </div></div>
            <div class="panel"><div class="panel-body" style="padding:11px">
              <div class="bet-control" style="justify-content:center">
                <div class="bet-stepper"><button class="bet-step" data-keno-bet="-1" ${drawing ? "disabled" : ""}>−</button><button class="bet-step" data-keno-bet="1" ${drawing ? "disabled" : ""}>+</button></div>
                <div class="bet-display"><span class="chip-symbol">🪙</span><div><span class="bet-label">Mise / carte</span><strong>${U.fmt(currentBet())}</strong></div></div>
              </div>
              <button class="btn btn-primary btn-block" data-keno-start ${drawing ? "disabled" : ""} style="margin-top:8px;min-height:44px">${drawing ? "Tirage en cours…" : "Lancer le tirage · 🪙 " + U.fmt(totalStake)}</button>
              <button class="btn ${g.autoOn ? "btn-cyan" : "btn-ghost"} btn-sm btn-block" data-keno-auto style="margin-top:6px">${g.autoOn ? "⏸ Auto-keno actif" : "▶ Auto-keno"}</button>
            </div></div>
            <div class="panel"><div class="panel-head"><h3>💰 Gains</h3><span class="panel-hint">par carte</span></div><div class="panel-body" style="padding:9px 12px">
              <div class="keno-paytable">${payouts.map((m, h) => m > 0 ? `<span class="kh">${h} numéro${h > 1 ? "s" : ""}</span><span class="kv">×${m.toFixed(2)}</span>` : "").join("") || `<span class="kh" style="grid-column:1/-1">Choisissez des numéros pour voir les gains.</span>`}</div>
              ${g.upgrades.luckyNumbers ? `<p class="muted" style="font-size:9px;line-height:1.5;margin-top:7px">★ Chaque numéro chanceux touché ajoute 2 % (max 20 %). Les numéros chanceux se mémorisent avec le bouton Chanceux.</p>` : ""}
            </div></div>
          </div>
        </div>`;
      paintBallStrip();
    }

    function updateHeader() {
      const plays = container.querySelector("#keno-plays");
      const wins = container.querySelector("#keno-wins");
      const best = container.querySelector("#keno-best");
      const hits = container.querySelector("#keno-hits");
      if (plays) plays.textContent = U.fmt(g.stats.plays);
      if (wins) wins.textContent = U.fmt(g.stats.wins);
      if (best) best.textContent = U.fmt(g.stats.bestWin);
      if (hits) hits.textContent = String(g.stats.bestHits || 0);
    }

    function renderSide() {
      const side = container.querySelector("#keno-side");
      if (!side) return;
      side.innerHTML = `<div class="tabs" style="margin-bottom:8px">
        <button class="tab ${activeTab === "upgrades" ? "active" : ""}" data-keno-tab="upgrades">Améliorations</button>
        <button class="tab ${activeTab === "rules" ? "active" : ""}" data-keno-tab="rules">Aide</button>
      </div><div id="keno-side-content"></div>`;
      const content = side.querySelector("#keno-side-content");
      if (activeTab === "rules") {
        content.innerHTML = `<div class="panel"><div class="panel-head"><h3>📖 Règles du Keno</h3></div><div class="panel-body" style="font-size:10.5px;line-height:1.7;color:var(--muted)">
          <p>Choisissez jusqu'à <strong style="color:var(--text-soft)">10 numéros</strong> entre 1 et 80. 20 boules sont tirées. Plus vous trouvez de numéros, plus le gain est grand.</p>
          <p style="margin-top:7px">Le retour théorique est de <strong style="color:var(--green)">${Math.round(CFG.houseEdge * 100)} %</strong>.</p>
          <p style="margin-top:7px">Avec Multi-cartes, chaque carte possède son propre tirage. La mise est multipliée par le nombre de cartes.</p>
          <p style="margin-top:7px">Les numéros chanceux sont mémorisés et donnent un petit bonus quand ils sortent.</p>
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
          else if (key === "fastDraw") label = level ? "Tirage rapide" : "Non";
          else if (key === "luckyNumbers") label = level ? (g.lucky || []).length + " numéro(s) chanceux" : "Non";
          else if (key === "auto") label = level ? "Auto rapide" : "Auto de base offert";
          else if (key === "multiCard") label = cards() + " cartes";
          return `<div class="upgrade-row ${maxed ? "maxed" : ""}">
            <span class="upgrade-icon">${def.icon}</span>
            <div class="upgrade-main"><div class="upgrade-name">${def.name}</div><div class="upgrade-desc">${def.desc}</div><div class="upgrade-meta"><span class="upgrade-level">${label}</span></div></div>
            <button class="btn btn-xs ${maxed ? "btn-ghost maxed" : "btn-ghost upgrade-buy"} ${!maxed && d.tokens >= cost ? "affordable" : ""}" data-keno-buy="${key}" ${maxed ? "disabled" : ""}>${maxed ? "MAX" : "🪙 " + U.fmt(cost)}</button>
          </div>`;
        }).join("");
        content.innerHTML = `<div class="panel"><div class="panel-head"><h3>⚡ Améliorations</h3><span class="panel-hint">Jetons</span></div><div class="panel-body" style="padding:10px"><div class="upgrade-list">${rows}</div></div></div>
          <div class="panel"><div class="panel-body" style="padding:10px 12px">
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted)"><span>Numéros</span><strong style="color:var(--cyan)">${picksCount()} / ${CFG.maxPicks}</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Cartes</span><strong style="color:var(--text-soft)">${cards()}</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Meilleur tirage</span><strong style="color:var(--gold)">${g.stats.bestHits || 0} numéros</strong></div>
          </div></div>`;
      }
      updateHeader();
    }

    // ---------------- Init ----------------
    const gm = App.meta.gameMeta("keno");
    container.innerHTML = `
      <div class="game-header">
        <div class="game-title-wrap"><span class="game-title-icon">${gm.icon}</span><div><h1>Keno</h1><p>${gm.tagline}</p></div></div>
        <div class="game-header-stats">
          <span class="game-stat-chip">Tirages <strong id="keno-plays">${U.fmt(g.stats.plays)}</strong></span>
          <span class="game-stat-chip">Gains <strong id="keno-wins">${U.fmt(g.stats.wins)}</strong></span>
          <span class="game-stat-chip">Meilleur <strong id="keno-best">${U.fmt(g.stats.bestWin)}</strong></span>
          <span class="game-stat-chip">Record <strong id="keno-hits">${g.stats.bestHits || 0}</strong></span>
        </div>
      </div>
      <div class="game-layout wide-side">
        <section class="game-stage keno-stage"><div id="keno-root"></div></section>
        <aside class="game-side" id="keno-side"></aside>
      </div>`;

    g.picks = picks();
    g.lucky = (g.lucky || []).filter((n) => n >= 1 && n <= 80);
    renderStage();
    renderSide();
    updateHeader();

    const onClick = (e) => {
      if (e.target.closest("[data-keno-start]")) { startDraw(); return; }
      if (e.target.closest("[data-keno-quick]")) {
        if (drawing) return;
        const pool = Array.from({ length: 80 }, (_, i) => i + 1);
        g.picks = U.shuffle(pool).slice(0, CFG.maxPicks);
        currentDrawn = new Set(); lastBalls = []; lastResult = null;
        App.audio.play("click");
        renderStage(); renderSide(); App.state.saveSoon();
        return;
      }
      if (e.target.closest("[data-keno-clear]")) {
        if (drawing) return;
        g.picks = [];
        currentDrawn = new Set(); lastBalls = []; lastResult = null;
        App.audio.play("click");
        renderStage(); renderSide(); App.state.saveSoon();
        return;
      }
      if (e.target.closest("[data-keno-lucky]")) {
        if (!g.upgrades.luckyNumbers || drawing) return;
        if (!picksCount()) {
          App.audio.play("error");
          return;
        }
        g.lucky = picks().slice();
        App.audio.play("unlock");
        App.ui.toast("Numéros chanceux", "Vos numéros sont mémorisés et brilleront sur la grille.", "🍀", "gold");
        renderStage(); renderSide(); App.state.saveSoon();
        return;
      }
      const num = e.target.closest("[data-keno-num]");
      if (num) {
        if (drawing) return;
        const n = parseInt(num.dataset.kenoNum, 10);
        if (g.picks.includes(n)) g.picks = g.picks.filter((x) => x !== n);
        else if (g.picks.length >= CFG.maxPicks) {
          App.audio.play("error");
          App.ui.toast("Maximum atteint", "Vous pouvez choisir jusqu'à " + CFG.maxPicks + " numéros.", "🔢", "danger");
          return;
        } else g.picks.push(n);
        currentDrawn = new Set();
        lastBalls = [];
        lastResult = null;
        App.audio.play("tick");
        renderStage();
        renderSide();
        App.state.saveSoon();
        return;
      }
      const bet = e.target.closest("[data-keno-bet]");
      if (bet && !drawing) {
        g.betIndex = U.clamp(g.betIndex + parseInt(bet.dataset.kenoBet, 10), 0, betOptions().length - 1);
        App.audio.play("tick");
        renderStage(); App.state.saveSoon();
        return;
      }
      if (e.target.closest("[data-keno-auto]")) {
        g.autoOn = !g.autoOn;
        if (g.autoOn && !picks().length) {
          const pool = Array.from({ length: 80 }, (_, i) => i + 1);
          g.picks = U.shuffle(pool).slice(0, CFG.maxPicks);
          currentDrawn = new Set(); lastBalls = []; lastResult = null;
        }
        App.audio.play("click");
        renderStage();
        if (g.autoOn) scheduleAuto();
        else if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
        App.state.saveSoon();
        return;
      }
      const tab = e.target.closest("[data-keno-tab]");
      if (tab) { activeTab = tab.dataset.kenoTab; renderSide(); return; }
      const buy = e.target.closest("[data-keno-buy]");
      if (buy) { buyUpgrade(buy.dataset.kenoBuy); return; }
    };
    container.addEventListener("click", onClick);

    function buyUpgrade(key) {
      if (drawing) {
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
      if (key === "luckyNumbers" && !(g.lucky || []).length) g.lucky = picks().slice();
      App.audio.play("purchase");
      App.fx.burst(window.innerWidth * 0.7, window.innerHeight * 0.4, { colors: ["#4ade80", "#ffc857"], count: 16 });
      App.ui.toast("Amélioration achetée", def.name, def.icon, "gold");
      App.meta.checkAchievements();
      App.state.saveSoon();
      renderStage(); renderSide();
    }

    const cleanup = () => {
      destroyed = true;
      clearTimers();
      container.removeEventListener("click", onClick);
      if (drawing && drawState) {
        App.meta.refund(drawState.stake, "keno");
      }
      drawing = false;
      drawState = null;
      activeCleanup = null;
    };
    activeCleanup = cleanup;
    if (g.autoOn && picks().length) scheduleAuto();
    return cleanup;
  };

  App.games = App.games || {};
  App.games.keno = Game;
})();
