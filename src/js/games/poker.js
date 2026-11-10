/* ============================================================
   NEON JACKPOT — games/poker.js
   Poker vidéo : Jacks or Better, Deuces Wild, mains royales
   ============================================================ */
(function () {
  "use strict";

  const App = window.App;
  const U = App.utils;
  const D = window.GAME_DATA;
  const CFG = D.balance.poker;

  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = [
    { value: 2, label: "2" }, { value: 3, label: "3" }, { value: 4, label: "4" },
    { value: 5, label: "5" }, { value: 6, label: "6" }, { value: 7, label: "7" },
    { value: 8, label: "8" }, { value: 9, label: "9" }, { value: 10, label: "10" },
    { value: 11, label: "J" }, { value: 12, label: "Q" }, { value: 13, label: "K" },
    { value: 14, label: "A" }
  ];

  const Game = {};
  let activeCleanup = null;

  Game.render = function (container) {
    if (activeCleanup) activeCleanup();
    const d = App.state.data;
    const g = d.games.poker;

    let phase = "bet"; // bet | holding | done
    let hand = [];
    let held = [false, false, false, false, false];
    let deck = [];
    let bet = 0;
    let lastCategory = null;
    let lastResult = null;
    let timers = new Set();
    let destroyed = false;
    let activeTab = "upgrades";
    let autoTimer = null;

    const betOptions = () => CFG.betSteps.slice(0, Math.min(CFG.betSteps.length, 3 + g.upgrades.maxBet));
    const currentBet = () => betOptions()[U.clamp(g.betIndex, 0, betOptions().length - 1)] || CFG.minBet;
    const mode = () => (g.mode === "deuces" && g.upgrades.deuces ? "deuces" : "jacks");
    const paytable = () => (mode() === "deuces" ? CFG.deucesPaytable : CFG.paytable);

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
    }

    function newDeck() {
      const cards = [];
      for (const suit of SUITS) {
        for (const r of RANKS) cards.push({ value: r.value, label: r.label, suit });
      }
      return U.shuffle(cards);
    }

    function cardLabel(c) {
      return c.value === 11 ? "J" : c.value === 12 ? "Q" : c.value === 13 ? "K" : c.value === 14 ? "A" : String(c.value);
    }

    function suitRed(s) { return s === "♥" || s === "♦"; }

    // ---------------- Évaluateurs ----------------
    function straightInfo(values) {
      const unique = Array.from(new Set(values)).sort((a, b) => a - b);
      if (unique.length !== 5) return { straight: false };
      if (unique[4] - unique[0] === 4) return { straight: true, royal: unique[0] === 10 && unique[4] === 14 };
      if (unique[0] === 2 && unique[1] === 3 && unique[2] === 4 && unique[3] === 5 && unique[4] === 14) return { straight: true, royal: false };
      return { straight: false };
    }

    function evaluateJacks(cards) {
      const values = cards.map((c) => c.value);
      const suits = cards.map((c) => c.suit);
      const flush = suits.every((s) => s === suits[0]);
      const st = straightInfo(values);
      const counts = {};
      values.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
      const groups = Object.values(counts).sort((a, b) => b - a);
      const pairs = Object.keys(counts).filter((v) => counts[v] === 2).map(Number);
      if (st.straight && st.royal && flush) return "royalFlush";
      if (st.straight && flush) return "straightFlush";
      if (groups[0] === 4) return "fourOfAKind";
      if (groups[0] === 3 && groups[1] === 2) return "fullHouse";
      if (flush) return "flush";
      if (st.straight) return "straight";
      if (groups[0] === 3) return "threeOfAKind";
      if (groups[0] === 2 && groups[1] === 2) return "twoPair";
      if (pairs.some((v) => v >= 11)) return "jacksOrBetter";
      return null;
    }

    function containsStraight(ranks) {
      if (new Set(ranks).size !== ranks.length) return false;
      const set = new Set(ranks);
      for (let low = 2; low <= 10; low++) {
        let ok = true;
        for (let r = low; r <= low + 4; r++) {
          if (!set.has(r)) { ok = false; break; }
        }
        if (ok) return true;
      }
      // roue A-2-3-4-5
      if ([14, 2, 3, 4, 5].every((r) => set.has(r))) return true;
      return false;
    }

    function canStraightWithWilds(ranks) {
      if (new Set(ranks).size !== ranks.length) return false;
      // Les jokers (2) complètent les rangs manquants d'une suite.
      if (ranks.length === 0) return false;
      for (let low = 2; low <= 10; low++) {
        let ok = true;
        for (const r of ranks) {
          if (r < low || r > low + 4) { ok = false; break; }
        }
        if (ok) return true;
      }
      if (ranks.every((r) => [14, 2, 3, 4, 5].includes(r))) return true;
      return false;
    }

    function canFullHouse(counts, wilds) {
      const ranks = Object.keys(counts).map(Number);
      for (const a of ranks) {
        for (const b of ranks) {
          if (a === b) continue;
          const need = Math.max(0, 3 - (counts[a] || 0)) + Math.max(0, 2 - (counts[b] || 0));
          if (need <= wilds) return true;
        }
      }
      return false;
    }

    function evaluateDeuces(cards) {
      const wilds = cards.filter((c) => c.value === 2).length;
      const non = cards.filter((c) => c.value !== 2);
      const nonRanks = non.map((c) => c.value);
      const counts = {};
      nonRanks.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
      const distinct = Array.from(new Set(nonRanks));
      const sameSuit = non.length === 0 || non.every((c) => c.suit === non[0].suit);
      const maxCount = Object.values(counts).length ? Math.max(...Object.values(counts)) : 0;
      if (wilds === 4) return "fourDeuces";
      if (wilds === 0) {
        const flush = sameSuit;
        const st = straightInfo(nonRanks);
        if (st.straight && st.royal && flush) return "naturalRoyal";
        if (st.straight && flush) return "straightFlush";
        if (Object.values(counts).includes(4)) return "fourOfAKind";
        if (Object.values(counts).includes(3) && Object.values(counts).includes(2)) return "fullHouse";
        if (flush) return "flush";
        if (st.straight) return "straight";
        if (Object.values(counts).includes(3)) return "threeOfAKind";
        return null;
      }
      if (non.length === 0) return "fourDeuces";
      if (distinct.length === 1 && non.length + wilds === 5) return "fiveOfAKind";
      if (sameSuit && non.every((c) => c.value >= 10) && distinct.length === non.length) return "wildRoyal";
      const straightPossible = canStraightWithWilds(nonRanks) && distinct.length === nonRanks.length;
      const flushPossible = sameSuit;
      if (flushPossible && straightPossible) return "straightFlush";
      if (maxCount + wilds >= 4) return "fourOfAKind";
      if (canFullHouse(counts, wilds)) return "fullHouse";
      if (flushPossible) return "flush";
      if (straightPossible) return "straight";
      if (maxCount + wilds >= 3) return "threeOfAKind";
      return null;
    }

    function evaluate() {
      return mode() === "deuces" ? evaluateDeuces(hand) : evaluateJacks(hand);
    }

    // ---------------- Holds ----------------
    function recommendedHolds() {
      const cards = hand;
      const isDeuces = mode() === "deuces";
      const hold = [false, false, false, false, false];
      if (isDeuces) {
        cards.forEach((c, i) => { if (c.value === 2) hold[i] = true; });
      }
      const counts = {};
      cards.forEach((c, i) => {
        if (isDeuces && c.value === 2) return;
        counts[c.value] = counts[c.value] || { count: 0, indices: [] };
        counts[c.value].count++;
        counts[c.value].indices.push(i);
      });
      // Quatre cartes d'une couleur
      const bySuit = {};
      cards.forEach((c, i) => {
        if (isDeuces && c.value === 2) return;
        bySuit[c.suit] = bySuit[c.suit] || [];
        bySuit[c.suit].push(i);
      });
      for (const suit of Object.keys(bySuit)) {
        if (bySuit[suit].length === 4) bySuit[suit].forEach((i) => { hold[i] = true; });
      }
      // Paires / brelans / carrés
      const groups = Object.values(counts).sort((a, b) => b.count - a.count);
      if (groups.length && groups[0].count >= 2) {
        groups[0].indices.forEach((i) => { hold[i] = true; });
        if (groups[1] && groups[1].count >= 2) groups[1].indices.forEach((i) => { hold[i] = true; });
      }
      // Quatre cartes d'une suite (approximation)
      const values = Array.from(new Set(cards.filter((c) => !(isDeuces && c.value === 2)).map((c) => c.value))).sort((a, b) => a - b);
      let bestRun = [];
      for (let i = 0; i < values.length; i++) {
        const run = [values[i]];
        for (let j = i + 1; j < values.length; j++) {
          if (values[j] === run[run.length - 1] + 1) run.push(values[j]);
          else break;
        }
        if (run.length > bestRun.length) bestRun = run;
      }
      if (bestRun.length === 4) {
        bestRun.forEach((v) => {
          const idx = cards.findIndex((c, i) => c.value === v && !hold[i] && !(isDeuces && c.value === 2));
          if (idx >= 0) hold[idx] = true;
        });
      }
      // Sinon, garder une carte haute
      if (!hold.some(Boolean)) {
        let best = -1;
        cards.forEach((c, i) => {
          if (c.value >= 11 && (best < 0 || c.value > cards[best].value)) best = i;
        });
        if (best >= 0) hold[best] = true;
      }
      // Avec des jokers 2, on garde toujours les 2
      if (isDeuces) cards.forEach((c, i) => { if (c.value === 2) hold[i] = true; });
      return hold;
    }

    function schedulePokerAuto(ms) {
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = null;
      if (!g.autoOn || destroyed) return;
      autoTimer = setTimeout(() => {
        autoTimer = null;
        if (!g.autoOn || destroyed) return;
        if (phase === "holding") {
          held = recommendedHolds();
          draw();
        } else if (phase === "bet" || phase === "done") {
          if (!App.meta.canAfford("tokens", currentBet())) {
            g.autoOn = false;
            App.ui.toast("Auto-poker arrêté", "Solde insuffisant pour la mise actuelle.", "🤖", "danger");
            renderStage(); renderSide();
            return;
          }
          deal();
        }
      }, ms || 500);
    }

    // ---------------- Actions ----------------
    function deal() {
      if (phase === "holding") return;
      bet = currentBet();
      if (!App.meta.canAfford("tokens", bet)) {
        App.audio.play("error");
        App.ui.toast("Jetons insuffisants", "Réduisez la mise.", "🪙", "danger");
        return;
      }
      if (!App.meta.bet(bet, "poker")) return;
      deck = newDeck();
      hand = deck.splice(0, 5);
      if (g.upgrades.jokers && U.chance(0.05)) {
        const idx = U.randInt(0, 4);
        const suit = hand[idx].suit;
        hand[idx] = { value: 14, label: "A", suit, joker: true };
      }
      held = [false, false, false, false, false];
      phase = "holding";
      lastCategory = null;
      lastResult = null;
      if (g.autoHold) {
        held = recommendedHolds();
        App.ui.toast("Auto-hold", "Les cartes conseillées sont gardées. Vous pouvez ajuster.", "🤖", "");
      }
      App.audio.play("deal");
      renderStage();
      renderSide();
      App.state.saveSoon();
      if (g.autoOn) schedulePokerAuto(900);
    }

    function toggleHold(index) {
      if (phase !== "holding") return;
      held[index] = !held[index];
      App.audio.play("flip");
      renderStage();
    }

    function draw() {
      if (phase !== "holding") return;
      for (let i = 0; i < 5; i++) {
        if (!held[i]) hand[i] = deck.pop();
      }
      phase = "done";
      const cat = evaluate();
      lastCategory = cat;
      const table = paytable();
      const def = cat ? table[cat] : null;
      let mult = def ? def.mult : 0;
      if (cat && g.upgrades.royal && ["royalFlush", "naturalRoyal", "wildRoyal", "fourOfAKind", "fourDeuces"].includes(cat)) {
        mult *= 1.2;
      }
      const payout = bet * mult;
      if (mult > 0) {
        App.meta.payout(payout, "poker", { stake: bet, mult, silent: true });
        if (["royalFlush", "naturalRoyal", "wildRoyal"].includes(cat)) {
          g.stats.royals += 1;
          App.meta.triggerSynergy("poker_royal", { category: cat });
          App.fx.jackpot();
          App.audio.play("jackpot");
          App.state.log("♠️", "Main royale !", "+" + U.fmt(payout));
        } else if (mult >= 9) {
          App.audio.play("bigwin");
          App.fx.confetti(80);
        } else {
          App.audio.play("win");
        }
        App.fx.coinBurst(window.innerWidth / 2, window.innerHeight / 2, payout);
        App.fx.floatingText("+" + U.fmt(payout), window.innerWidth / 2, window.innerHeight / 2 - 30, { className: "win", duration: 1.5, size: 25 });
      } else {
        App.meta.loss("poker", { silent: true });
        App.audio.play("lose");
      }
      lastResult = {
        name: def ? def.name : "Aucune combinaison",
        mult,
        payout,
        net: payout - bet,
        paid: mult > 0,
        won: payout > bet
      };
      renderStage();
      renderSide();
      updateHeader();
      App.meta.checkAchievements();
      App.state.saveSoon();
      if (g.autoOn) schedulePokerAuto(1100);
    }

    // ---------------- Rendu ----------------
    function cardHtml(card) {
      if (!card) return "";
      const red = suitRed(card.suit);
      const joker = !!card.joker;
      const classes = ["playing-card", red ? "red" : "black"];
      if (joker) classes.push("joker");
      const label = cardLabel(card);
      return `<div class="${classes.join(" ")}">
        <div class="card-corner"><span class="card-rank">${joker ? "JK" : label}</span><span class="card-suit-sm">${joker ? "★" : card.suit}</span></div>
        <div class="card-center">${joker ? "🃏" : card.suit}</div>
        <div class="card-corner-bottom"><span class="card-rank">${joker ? "JK" : label}</span><span class="card-suit-sm">${joker ? "★" : card.suit}</span></div>
      </div>`;
    }

    function renderStage() {
      const root = container.querySelector("#poker-root");
      if (!root) return;
      const table = paytable();
      const cards = hand.length
        ? hand.map((c, i) => `<button class="poker-card-slot ${held[i] ? "held" : ""}" data-poker-card="${i}" ${phase === "holding" ? "" : "disabled"}>
            ${cardHtml(c)}
          </button>`).join("")
        : [0, 1, 2, 3, 4].map(() => `<div class="poker-card-slot"><div class="playing-card card-back" style="--cw:inherit"></div></div>`).join("");
      const result = lastResult
        ? `<div class="poker-result"><strong>${lastResult.won ? lastResult.name : (lastResult.paid ? "Mise rendue" : "Perdu")}</strong><span>${lastResult.won ? "+" + U.fmt(lastResult.net) + " net · ×" + lastResult.mult.toFixed(2) : lastResult.paid ? "Retour de " + U.fmt(lastResult.payout) + " jetons · ×" + lastResult.mult.toFixed(2) : "Retentez votre chance."}</span></div>`
        : `<div class="poker-result">${phase === "holding" ? `<strong>Gardez vos cartes</strong><span>Cliquez sur les cartes à conserver, puis tirez.</span>` : phase === "bet" ? `<strong>Jacks or Better</strong><span>Misez et distribuez cinq cartes.</span>` : ""}</div>`;
      root.innerHTML = `
        <div class="poker-machine">
          <div class="poker-top">
            <div class="segmented poker-mode-switch">
              <button class="seg-btn ${mode() === "jacks" ? "active" : ""}" data-poker-mode="jacks" ${phase === "holding" ? "disabled" : ""}>Jacks or Better</button>
              <button class="seg-btn ${mode() === "deuces" ? "active" : ""}" data-poker-mode="deuces" ${phase === "holding" || !g.upgrades.deuces ? "disabled" : ""}>${g.upgrades.deuces ? "Deuces Wild" : "🔒 Deuces"}</button>
            </div>
            <span class="badge ${mode() === "deuces" ? "pink" : "cyan"}">${mode() === "deuces" ? "2 = JOKER" : "JACKS OU MIEUX"}</span>
          </div>
          <div class="poker-cards">${cards}</div>
          ${result}
          <div class="poker-actions">
            ${phase === "bet" || phase === "done"
              ? `<button class="btn btn-primary" data-poker-deal style="min-width:160px">${phase === "done" ? "Nouvelle main" : "Distribuer"} · 🪙 ${U.fmt(currentBet())}</button>`
              : `<button class="btn btn-gold" data-poker-draw style="min-width:160px">Tirer · ${held.filter(Boolean).length} gardée(s)</button>`}
            ${g.upgrades.auto ? `<button class="btn ${g.autoHold ? "btn-cyan" : "btn-ghost"}" data-poker-auto-hold>${g.autoHold ? "🤖 Auto-hold ON" : "🤖 Auto-hold"}</button>` : ""}
            <button class="btn ${g.autoOn ? "btn-cyan" : "btn-ghost"}" data-poker-auto>${g.autoOn ? "⏸ Auto" : "▶ Auto"}</button>
          </div>
          <div class="poker-actions" style="margin-top:2px">
            <div class="bet-stepper"><button class="bet-step" data-poker-bet="-1" ${phase === "holding" ? "disabled" : ""}>−</button><button class="bet-step" data-poker-bet="1" ${phase === "holding" ? "disabled" : ""}>+</button></div>
            <div class="bet-display" style="padding:5px 9px"><span class="chip-symbol">🪙</span><div><span class="bet-label">Mise</span><strong>${U.fmt(phase === "holding" || phase === "done" ? bet : currentBet())}</strong></div></div>
            ${g.upgrades.royal ? `<span class="badge gold">+20 % royales & carrés</span>` : ""}
          </div>
        </div>`;
    }

    function updateHeader() {
      const plays = container.querySelector("#poker-plays");
      const wins = container.querySelector("#poker-wins");
      const best = container.querySelector("#poker-best");
      const royals = container.querySelector("#poker-royals");
      if (plays) plays.textContent = U.fmt(g.stats.plays);
      if (wins) wins.textContent = U.fmt(g.stats.wins);
      if (best) best.textContent = U.fmt(g.stats.bestWin);
      if (royals) royals.textContent = String(g.stats.royals || 0);
    }

    function renderSide() {
      const side = container.querySelector("#poker-side");
      if (!side) return;
      side.innerHTML = `<div class="tabs" style="margin-bottom:8px">
        <button class="tab ${activeTab === "upgrades" ? "active" : ""}" data-poker-tab="upgrades">Améliorations</button>
        <button class="tab ${activeTab === "paytable" ? "active" : ""}" data-poker-tab="paytable">Gains</button>
      </div><div id="poker-side-content"></div>`;
      const content = side.querySelector("#poker-side-content");
      if (activeTab === "paytable") {
        const table = paytable();
        content.innerHTML = `<div class="panel"><div class="panel-head"><h3>💎 Table des gains</h3><span class="panel-hint">× mise</span></div><div class="panel-body">
          <div class="poker-paytable">
            ${Object.keys(table).map((key) => `<div class="pp-row ${lastCategory === key ? "active" : ""}" style="display:contents"><span class="pp-name">${table[key].name}</span><span class="pp-mult">×${table[key].mult}</span></div>`).join("")}
          </div>
          <div class="divider"></div>
          <p class="muted" style="font-size:9.5px;line-height:1.6">${mode() === "deuces" ? "Les 2 sont des jokers. Une main peut contenir plusieurs jokers ; le meilleur paiement est retenu." : "Une paire de Valets ou mieux paie. Le blackjack n'existe pas ici, seul le hasard des cartes."}</p>
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
          else if (key === "deuces") label = level ? "Deuces Wild" : "Non";
          else if (key === "jokers") label = level ? "Joker occasionnel" : "Non";
          else if (key === "auto") label = level ? (g.autoHold ? "Auto-hold ON" : "Auto-hold OFF") : "Auto de base offert";
          else if (key === "royal") label = level ? "+20 % royales/carrés" : "Non";
          return `<div class="upgrade-row ${maxed ? "maxed" : ""}">
            <span class="upgrade-icon">${def.icon}</span>
            <div class="upgrade-main"><div class="upgrade-name">${def.name}</div><div class="upgrade-desc">${def.desc}</div><div class="upgrade-meta"><span class="upgrade-level">${label}</span></div></div>
            <button class="btn btn-xs ${maxed ? "btn-ghost maxed" : "btn-ghost upgrade-buy"} ${!maxed && d.tokens >= cost ? "affordable" : ""}" data-poker-buy="${key}" ${maxed ? "disabled" : ""}>${maxed ? "MAX" : "🪙 " + U.fmt(cost)}</button>
          </div>`;
        }).join("");
        content.innerHTML = `<div class="panel"><div class="panel-head"><h3>⚡ Améliorations</h3><span class="panel-hint">Jetons</span></div><div class="panel-body" style="padding:10px"><div class="upgrade-list">${rows}</div></div></div>
          <div class="panel"><div class="panel-body" style="padding:10px 12px">
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted)"><span>Mode</span><strong style="color:var(--text-soft)">${mode() === "deuces" ? "Deuces Wild" : "Jacks or Better"}</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Royales</span><strong style="color:var(--gold)">${g.stats.royals || 0}</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Retour</span><strong style="color:var(--green)">≈ 99 %</strong></div>
          </div></div>`;
      }
      updateHeader();
    }

    // ---------------- Init ----------------
    const gm = App.meta.gameMeta("poker");
    container.innerHTML = `
      <div class="game-header">
        <div class="game-title-wrap"><span class="game-title-icon">${gm.icon}</span><div><h1>Poker vidéo</h1><p>${gm.tagline}</p></div></div>
        <div class="game-header-stats">
          <span class="game-stat-chip">Mains <strong id="poker-plays">${U.fmt(g.stats.plays)}</strong></span>
          <span class="game-stat-chip">Gains <strong id="poker-wins">${U.fmt(g.stats.wins)}</strong></span>
          <span class="game-stat-chip">Meilleur <strong id="poker-best">${U.fmt(g.stats.bestWin)}</strong></span>
          <span class="game-stat-chip">Royales <strong id="poker-royals">${g.stats.royals || 0}</strong></span>
        </div>
      </div>
      <div class="game-layout wide-side">
        <section class="game-stage poker-stage"><div id="poker-root"></div></section>
        <aside class="game-side" id="poker-side"></aside>
      </div>`;

    renderStage();
    renderSide();
    updateHeader();

    const onClick = (e) => {
      const card = e.target.closest("[data-poker-card]");
      if (card && phase === "holding") { toggleHold(parseInt(card.dataset.pokerCard, 10)); return; }
      if (e.target.closest("[data-poker-deal]")) { deal(); return; }
      if (e.target.closest("[data-poker-draw]")) { draw(); return; }
      if (e.target.closest("[data-poker-auto]")) {
        g.autoOn = !g.autoOn;
        App.audio.play("click");
        if (g.autoOn) {
          if (phase === "holding") { held = recommendedHolds(); renderStage(); schedulePokerAuto(700); }
          else schedulePokerAuto(500);
        } else if (autoTimer) {
          clearTimeout(autoTimer);
          autoTimer = null;
        }
        renderStage(); renderSide(); App.state.saveSoon();
        return;
      }
      if (e.target.closest("[data-poker-auto-hold]")) {
        if (!g.upgrades.auto) {
          App.audio.play("error");
          App.ui.toast("Auto-hold verrouillé", "Achetez l'amélioration Auto-hold.", "🤖", "danger");
          return;
        }
        g.autoHold = !g.autoHold;
        if (g.autoHold && phase === "holding") held = recommendedHolds();
        App.audio.play("click");
        renderStage(); renderSide(); App.state.saveSoon();
        return;
      }
      const modeBtn = e.target.closest("[data-poker-mode]");
      if (modeBtn) {
        if (phase === "holding") return;
        const next = modeBtn.dataset.pokerMode;
        if (next === "deuces" && !g.upgrades.deuces) {
          App.audio.play("error");
          App.ui.toast("Deuces Wild verrouillé", "Achetez l'amélioration Deuces Wild.", "🔒", "danger");
          return;
        }
        g.mode = next;
        hand = [];
        phase = "bet";
        lastCategory = null;
        lastResult = null;
        App.audio.play("click");
        renderStage(); renderSide(); App.state.saveSoon();
        return;
      }
      const betBtn = e.target.closest("[data-poker-bet]");
      if (betBtn && phase !== "holding") {
        g.betIndex = U.clamp(g.betIndex + parseInt(betBtn.dataset.pokerBet, 10), 0, betOptions().length - 1);
        App.audio.play("tick");
        renderStage(); App.state.saveSoon();
        return;
      }
      const tab = e.target.closest("[data-poker-tab]");
      if (tab) { activeTab = tab.dataset.pokerTab; renderSide(); return; }
      const buy = e.target.closest("[data-poker-buy]");
      if (buy) { buyUpgrade(buy.dataset.pokerBuy); return; }
    };
    container.addEventListener("click", onClick);

    function buyUpgrade(key) {
      if (phase === "holding") {
        App.audio.play("error");
        App.ui.toast("Main en cours", "Terminez la main avant d'améliorer la machine.", "♠️", "danger");
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
      if (key === "deuces") g.mode = "deuces";
      App.audio.play("purchase");
      App.fx.burst(window.innerWidth * 0.7, window.innerHeight * 0.4, { colors: ["#e879f9", "#ffc857"], count: 16 });
      App.ui.toast("Amélioration achetée", def.name, def.icon, "gold");
      App.meta.checkAchievements();
      App.state.saveSoon();
      renderStage(); renderSide();
    }

    const cleanup = () => {
      destroyed = true;
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = null;
      clearTimers();
      container.removeEventListener("click", onClick);
      if (phase === "holding") {
        App.meta.refund(bet, "poker");
      }
      phase = "bet";
      activeCleanup = null;
    };
    activeCleanup = cleanup;
    if (g.autoOn) schedulePokerAuto(800);
    return cleanup;
  };

  App.games = App.games || {};
  App.games.poker = Game;
})();
