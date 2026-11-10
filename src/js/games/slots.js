/* ============================================================
   NEON JACKPOT — games/slots.js
   Machines à sous : rouleaux, lignes, wilds, tours gratuits, jackpot
   ============================================================ */
(function () {
  "use strict";

  const App = window.App;
  const U = App.utils;
  const D = window.GAME_DATA;
  const CFG = D.balance.slots;

  const Game = {};
  let activeCleanup = null;

  const PATTERNS_3 = [
    [1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0],
    [0, 0, 1], [2, 2, 1], [1, 2, 2], [1, 0, 0], [0, 1, 1],
    [2, 1, 1], [1, 0, 1], [1, 2, 1], [0, 1, 0], [2, 1, 2], [0, 2, 0]
  ];
  const PATTERNS_5 = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 0, 0],
    [2, 2, 1, 2, 2], [1, 2, 2, 2, 1], [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0], [2, 1, 1, 1, 2], [1, 0, 1, 0, 1],
    [1, 2, 1, 2, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2],
    [0, 2, 0, 2, 0], [2, 0, 2, 0, 2], [0, 0, 2, 0, 0],
    [2, 2, 0, 2, 2], [0, 2, 2, 2, 0], [2, 0, 0, 0, 2],
    [0, 1, 2, 2, 1], [2, 1, 0, 0, 1], [1, 2, 0, 1, 2], [1, 0, 2, 1, 0]
  ];

  const WEIGHTS = { cherry: 22, lemon: 17, star: 12, bell: 9, diamond: 6, seven: 4, wild: 1.8, scatter: 2.8 };

  Game.render = function (container) {
    if (activeCleanup) activeCleanup();
    const d = App.state.data;
    const g = d.games.slots;
    let spinning = false;
    let spinState = null;
    let spinTimer = null;
    let laterTimers = new Set();
    let lockedReels = [];
    let activeTab = "upgrades";
    let destroyed = false;
    let bonusOpen = false;
    let winBannerTimer = null;
    let grid = [];
    let lastHitSet = new Set();

    const machine = () => CFG.machines.find((m) => m.id === g.machine) || CFG.machines[0];
    const upgrades = () => g.upgrades;
    const reels = () => (g.upgrades.reels ? 5 : 3);
    const patterns = () => (reels() === 5 ? PATTERNS_5 : PATTERNS_3);
    const lineCount = () => Math.min(patterns().length, (reels() === 5 ? 5 : 1) + g.upgrades.lines * 5);
    const betOptions = () => CFG.betSteps.slice(0, Math.min(CFG.betSteps.length, 3 + g.upgrades.maxBet));
    const currentBet = () => betOptions()[U.clamp(g.betIndex, 0, betOptions().length - 1)] || 1;
    const lineBet = (bet) => bet / Math.max(1, lineCount());
    const iconFor = (id) => {
      const icons = machine().icons || {};
      return icons[id] || (id === "wild" ? "🃏" : id === "scatter" ? "🎁" : "❔");
    };

    function later(fn, ms) {
      const id = setTimeout(() => {
        laterTimers.delete(id);
        if (!destroyed) fn();
      }, ms);
      laterTimers.add(id);
      return id;
    }

    function clearTimers() {
      laterTimers.forEach((id) => clearTimeout(id));
      laterTimers.clear();
      if (spinTimer) clearInterval(spinTimer);
      spinTimer = null;
      if (winBannerTimer) clearTimeout(winBannerTimer);
      winBannerTimer = null;
    }

    function eligibleSymbols() {
      const list = CFG.symbols.filter((id) => id !== "wild");
      if (g.upgrades.wild) list.push("wild");
      if (g.upgrades.freeSpins) list.push("scatter");
      return list;
    }

    function randomSymbol() {
      const ids = eligibleSymbols();
      const weights = ids.map((id) => WEIGHTS[id] || 1);
      const total = weights.reduce((a, b) => a + b, 0);
      let roll = Math.random() * total;
      for (let i = 0; i < ids.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return ids[i];
      }
      return ids[ids.length - 1];
    }

    function randomColumn() {
      return [randomSymbol(), randomSymbol(), randomSymbol()];
    }

    // ---------- Normalisation des gains ----------
    // Le paiement d'une ligne est ajusté pour viser un retour proche de 92 % (3 rouleaux)
    // ou 82 % (5 rouleaux) hors scatters / tours gratuits de l'upgrade.
    let payScaleCache = new Map();

    function rawLinePay(symbols) {
      if (symbols[0] === "scatter") return 0;
      let target = null;
      for (const s of symbols) {
        if (s !== "wild" && s !== "scatter") { target = s; break; }
      }
      if (!target) target = "wild";
      let count = 0;
      for (const s of symbols) {
        if (s === target || (s === "wild" && target !== "wild")) count++;
        else break;
      }
      if (count < 3) return 0;
      return CFG.paytable[target]?.pay[String(count)] || 0;
    }

    function lineRawEV(n) {
      const key = n + ":" + (g.upgrades.wild ? 1 : 0) + ":" + (g.upgrades.freeSpins ? 1 : 0);
      if (payScaleCache.has(key)) return payScaleCache.get(key);
      const ids = eligibleSymbols();
      const weights = ids.map((id) => WEIGHTS[id] || 1);
      const total = weights.reduce((a, b) => a + b, 0);
      let ev = 0;
      const seq = [];
      const walk = (depth, prob) => {
        if (depth === n) {
          ev += prob * rawLinePay(seq);
          return;
        }
        for (let i = 0; i < ids.length; i++) {
          seq.push(ids[i]);
          walk(depth + 1, prob * weights[i] / total);
          seq.pop();
        }
      };
      walk(0, 1);
      payScaleCache.set(key, ev);
      return ev;
    }

    function lineScale() {
      const target = CFG.lineRTP?.[String(reels())] || (reels() === 3 ? 0.92 : 0.82);
      const ev = lineRawEV(reels());
      return ev > 0 ? target / ev : 1;
    }

    function payFor(target, count) {
      const raw = CFG.paytable[target]?.pay[String(count)] || 0;
      return raw * lineScale();
    }

    function generateGrid(keepLocked) {
      const n = reels();
      const out = [];
      for (let i = 0; i < n; i++) {
        if (keepLocked && lockedReels[i] && grid[i]) out.push(grid[i].slice());
        else out.push(randomColumn());
      }
      return out;
    }

    function ensureGrid() {
      if (!grid.length || grid.length !== reels()) {
        grid = generateGrid(false);
        lockedReels = new Array(reels()).fill(false);
      }
      while (lockedReels.length < reels()) lockedReels.push(false);
    }

    // ---------------- Rendu machine ----------------
    function renderStage() {
      const root = container.querySelector("#slots-root");
      if (!root) return;
      ensureGrid();
      const n = reels();
      const m = machine();
      const free = g.freeSpinsLeft > 0;
      const jackpotUnlocked = !!g.upgrades.jackpot;
      const autoUnlocked = !!g.upgrades.autospin;
      const lockUnlocked = !!g.upgrades.lock;
      root.innerHTML = `
        <div class="slot-cabinet" style="box-shadow:0 30px 80px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.12), 0 0 50px ${U.hexToRgba(m.accent, 0.12)}">
          <div class="slot-top">
            <div class="slot-jackpot">💰 JACKPOT <strong>${jackpotUnlocked ? U.fmt(g.jackpot) : "🔒"}</strong></div>
            <div class="slot-themes">
              ${CFG.machines.map((mc) => {
                const unlocked = d.maxLevel >= mc.unlock;
                return `<button class="slot-theme-btn ${g.machine === mc.id ? "active" : ""} ${unlocked ? "" : "locked"}" data-machine="${mc.id}">${mc.icon} ${mc.name}${unlocked ? "" : " · Niv. " + mc.unlock}</button>`;
              }).join("")}
            </div>
          </div>
          <div class="slot-reels-wrap">
            <div class="slot-reels" id="slot-reels" style="grid-template-columns:repeat(${n},minmax(0,1fr))"></div>
            <div class="slot-win-banner" id="slot-win-banner"></div>
          </div>
          ${free ? `<div class="free-spins-banner">🌀 Tours gratuits restants : <strong>${g.freeSpinsLeft}</strong> · multiplicateur ×${CFG.freeSpins.multiplier}</div>` : ""}
          <div class="slot-controls">
            <div class="bet-stepper">
              <button class="bet-step" data-slot-bet="-1">−</button>
              <button class="bet-step" data-slot-bet="1">+</button>
            </div>
            <div class="bet-display" style="padding:6px 10px"><span class="chip-symbol">🪙</span><div><span class="bet-label">Mise totale</span><strong>${U.fmt(free ? (g.freeSpinBet || currentBet()) : currentBet())}</strong></div></div>
            <button class="btn btn-primary slot-spin-btn" data-slot-spin ${spinning ? "disabled" : ""}>${free ? "Tour gratuit (" + g.freeSpinsLeft + ")" : "Lancer"}</button>
            ${g.autoSpins > 0
              ? `<button class="btn btn-cyan btn-sm" data-slot-stop-auto>⏸ Auto ${g.autoSpins}</button>`
              : `<button class="btn btn-ghost btn-sm" data-slot-auto="10">▶ 10</button>${g.upgrades.autospin ? `<button class="btn btn-ghost btn-sm" data-slot-auto="25">▶ 25</button><button class="btn btn-ghost btn-sm" data-slot-auto="50">▶ 50</button>` : ""}`}
          </div>
          <div class="slot-info-row">
            <span>🎯 ${lineCount()} ligne${lineCount() > 1 ? "s" : ""} · mise/ligne 🪙 ${U.fmt(lineBet(currentBet()))}</span>
            <span>${lockUnlocked ? "🔒 Cliquez un rouleau pour le verrouiller" : ""}</span>
            <span>${m.name}</span>
          </div>
        </div>`;
      paintReels(lastHitSet, false);
    }

    function paintReels(hitSet, animateStop) {
      const el = container.querySelector("#slot-reels");
      if (!el) return;
      const n = reels();
      el.style.gridTemplateColumns = `repeat(${n}, minmax(0,1fr))`;
      let html = "";
      for (let i = 0; i < n; i++) {
        if (!grid[i]) grid[i] = randomColumn();
        const locked = lockedReels[i];
        html += `<div class="slot-reel ${locked ? "locked" : ""} ${spinning ? "spinning" : ""}" data-lock-reel="${i}">
          ${locked ? `<span class="slot-lock-badge">🔒</span>` : ""}
          ${grid[i].map((sym, r) => `<div class="slot-symbol ${sym === "wild" ? "wild" : ""} ${sym === "scatter" ? "scatter" : ""} ${hitSet && hitSet.has(i + ":" + r) ? "hit" : ""}">${iconFor(sym)}</div>`).join("")}
        </div>`;
      }
      el.innerHTML = html;
    }

    function paintColumn(i, symbols, stopped) {
      const el = container.querySelector("#slot-reels");
      if (!el) return;
      const col = el.children[i];
      if (!col) return;
      const locked = lockedReels[i];
      col.className = "slot-reel" + (locked ? " locked" : "") + (stopped ? " stopped" : " spinning");
      col.innerHTML = `${locked ? `<span class="slot-lock-badge">🔒</span>` : ""}${symbols.map((sym) => `<div class="slot-symbol ${sym === "wild" ? "wild" : ""} ${sym === "scatter" ? "scatter" : ""}">${iconFor(sym)}</div>`).join("")}`;
      if (stopped) {
        col.querySelectorAll(".slot-symbol").forEach((s, i) => {
          s.style.animationDelay = (i * 35) + "ms";
        });
      }
    }

    // ---------------- Logique de gain ----------------
    function evaluateLine(rowPattern, bet, freeMult) {
      const symbols = [];
      for (let r = 0; r < reels(); r++) {
        const row = rowPattern[r];
        symbols.push(grid[r][row]);
      }
      if (symbols[0] === "scatter") return null;
      let target = null;
      for (const s of symbols) {
        if (s !== "wild" && s !== "scatter") { target = s; break; }
      }
      if (!target) target = "wild";
      let count = 0;
      for (let i = 0; i < symbols.length; i++) {
        const s = symbols[i];
        if (s === target || (s === "wild" && target !== "wild")) count++;
        else break;
      }
      if (count < 3) return null;
      const paytable = CFG.paytable[target];
      if (!paytable) return null;
      const pay = payFor(target, count);
      if (!pay) return null;
      const amount = lineBet(bet) * pay * freeMult;
      return { target, count, amount, cells: Array.from({ length: count }, (_, i) => i + ":" + rowPattern[i]) };
    }

    function evaluateSpin(bet, freeMult) {
      let totalWin = 0;
      const wins = [];
      const hitSet = new Set();
      let jackpotTriggered = false;
      const pats = patterns();
      const lines = lineCount();
      for (let i = 0; i < lines; i++) {
        const res = evaluateLine(pats[i], bet, freeMult);
        if (res) {
          wins.push(res);
          totalWin += res.amount;
          res.cells.forEach((c) => hitSet.add(c));
          if (res.count === 5 && g.upgrades.jackpot && !jackpotTriggered) {
            jackpotTriggered = true;
          }
        }
      }
      let scatterCount = 0;
      for (let r = 0; r < reels(); r++) {
        for (let row = 0; row < 3; row++) {
          if (grid[r][row] === "scatter") scatterCount++;
        }
      }
      let scatterPay = 0;
      if (scatterCount >= 3) {
        const pays = CFG.scatterPays || { 3: 2, 4: 4, 5: 8 };
        scatterPay = bet * (pays[String(Math.min(5, scatterCount))] || 8) * freeMult;
        totalWin += scatterPay;
      }
      let jackpotAmount = 0;
      if (jackpotTriggered) {
        jackpotAmount = g.jackpot;
        totalWin += jackpotAmount;
        g.jackpot = CFG.jackpotBase;
        g.stats.jackpots += 1;
      }
      return { totalWin, wins, hitSet, scatterCount, scatterPay, jackpotTriggered, jackpotAmount };
    }

    function showWinBanner(total, bonusText) {
      const el = container.querySelector("#slot-win-banner");
      if (!el) return;
      el.innerHTML = `<strong>+${U.fmt(total)}</strong><span>${bonusText || "JETONS GAGNÉS"}</span>`;
      el.classList.add("on");
      if (winBannerTimer) clearTimeout(winBannerTimer);
      winBannerTimer = setTimeout(() => el.classList.remove("on"), 2200);
    }

    // ---------------- Tour ----------------
    function spin() {
      if (spinning || destroyed) return;
      const free = g.freeSpinsLeft > 0;
      const bet = free ? (g.freeSpinBet || currentBet()) : currentBet();
      if (!free && !App.meta.canAfford("tokens", bet)) {
        App.audio.play("error");
        App.ui.toast("Jetons insuffisants", "Réduisez la mise ou ouvrez le coffre de secours.", "🪙", "danger");
        g.autoSpins = 0;
        renderStage();
        return;
      }
      if (free) {
        g.freeSpinsLeft -= 1;
        App.meta.freeBet("slots");
      } else {
        if (!App.meta.bet(bet, "slots")) return;
        if (g.autoSpins > 0) g.autoSpins -= 1;
      }
      if (g.upgrades.jackpot) {
        g.jackpot += bet * CFG.jackpotContribution;
      }

      const n = reels();
      ensureGrid();
      const finals = [];
      for (let i = 0; i < n; i++) {
        if (lockedReels[i] && grid[i]) finals.push(grid[i].slice());
        else finals.push(randomColumn());
      }
      lockedReels = new Array(n).fill(false);
      spinning = true;
      const start = performance.now();
      const stopTimes = Array.from({ length: n }, (_, i) => 720 + i * (n === 5 ? 180 : 240) + U.rand(0, 140));
      spinState = {
        finals,
        bet,
        free,
        paidStake: free ? 0 : bet,
        start,
        stopTimes,
        locked: new Array(n).fill(false)
      };
      lastHitSet = new Set();
      App.audio.play("spin");
      renderStage();
      // Remet les rouleaux en mode rotation
      container.querySelectorAll(".slot-reel").forEach((el) => el.classList.add("spinning"));
      const reelsEl = container.querySelector("#slot-reels");
      if (reelsEl) reelsEl.style.gridTemplateColumns = `repeat(${n}, minmax(0,1fr))`;
      if (spinTimer) clearInterval(spinTimer);
      spinTimer = setInterval(() => {
        if (destroyed || !spinState) return;
        const elapsed = performance.now() - spinState.start;
        for (let i = 0; i < n; i++) {
          if (spinState.locked[i]) continue;
          if (elapsed >= spinState.stopTimes[i]) {
            spinState.locked[i] = true;
            paintColumn(i, spinState.finals[i], true);
            App.audio.play("stop");
          } else {
            paintColumn(i, randomColumn(), false);
          }
        }
        if (spinState.locked.every(Boolean)) {
          clearInterval(spinTimer);
          spinTimer = null;
          finishSpin();
        }
      }, 70);
    }

    function finishSpin() {
      if (!spinState) return;
      const snap = spinState;
      spinState = null;
      spinning = false;
      grid = snap.finals;
      const freeMult = snap.free ? CFG.freeSpins.multiplier : 1;
      const res = evaluateSpin(snap.bet, freeMult);
      const total = res.totalWin;
      const global = App.meta.globalMult();
      let finalAmount = 0;
      if (total > 0) {
        if (snap.paidStake > 0) {
          const profit = Math.max(0, total - snap.paidStake);
          finalAmount = total + profit * (global - 1);
        } else {
          finalAmount = total * global;
        }
        const mult = snap.paidStake > 0 ? total / snap.paidStake : total / Math.max(1, snap.bet);
        App.meta.credit(finalAmount, "slots", {
          stake: snap.paidStake,
          mult,
          silent: true,
          countWin: total > snap.paidStake
        });
      }
      if (total < snap.paidStake || (snap.free && total === 0)) {
        App.meta.loss("slots", { silent: true });
      }

      const freeTriggered = res.scatterCount >= 3 && g.upgrades.freeSpins;
      if (freeTriggered) {
        g.freeSpinsLeft += CFG.freeSpins.count;
        g.freeSpinBet = snap.bet;
        g.stats.freeSpinRounds += 1;
      }
      if (res.jackpotTriggered) {
        App.meta.triggerSynergy("slots_jackpot", { amount: res.jackpotAmount });
        App.audio.play("jackpot");
        App.fx.jackpot();
        App.state.log("💰", "Jackpot progressif", "+" + U.fmt(res.jackpotAmount));
        App.ui.toast("JACKPOT !", "+" + U.fmt(res.jackpotAmount) + " jetons. La machine a parlé.", "💰", "gold");
      }

      lastHitSet = res.hitSet;
      renderStage();
      paintReels(res.hitSet, false);

      if (total > 0) {
        showWinBanner(finalAmount, freeTriggered ? "TOURS GRATUITS DÉBLOQUÉS" : res.jackpotTriggered ? "JACKPOT !" : "JETONS GAGNÉS");
        const root = container.querySelector(".slot-reels-wrap");
        if (root) {
          const rect = root.getBoundingClientRect();
          App.fx.coinBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, Math.max(40, finalAmount));
        }
        if (res.jackpotTriggered) {
          App.audio.play("jackpot");
        } else if (total >= snap.bet * 10) {
          App.audio.play("bigwin");
          App.fx.confetti(70);
          App.fx.shake(5, 350);
        } else {
          App.audio.play("win");
        }
        App.state.log("🎰", "Gain — Machines à sous", "+" + U.fmt(finalAmount));
      } else {
        App.audio.play("lose");
      }
      if (freeTriggered) {
        App.audio.play("unlock");
        App.ui.toast("Tours gratuits !", CFG.freeSpins.count + " tours gratuits ×" + CFG.freeSpins.multiplier + ".", "🌀", "gold");
        App.fx.confetti(50);
      }
      updateHeader();
      updateJackpot();
      App.meta.checkAchievements();
      App.state.saveSoon();

      // Mini-jeu bonus
      const bonusTrigger = g.upgrades.bonus && !bonusOpen && total >= snap.bet * 12 && Math.random() < 0.4;
      if (bonusTrigger) {
        openBonus(snap.bet);
      }

      if (!bonusOpen) scheduleNext();
    }

    function scheduleNext() {
      if (destroyed || spinning) return;
      if (g.freeSpinsLeft > 0) {
        renderStage();
        later(() => spin(), 950);
        return;
      }
      if (g.autoSpins > 0) {
        if (!App.meta.canAfford("tokens", currentBet())) {
          g.autoSpins = 0;
          App.ui.toast("Auto-spin arrêté", "Votre solde ne permet plus la mise actuelle.", "🤖", "danger");
          renderStage();
          return;
        }
        renderStage();
        later(() => spin(), 950);
      }
    }

    function openBonus(bet) {
      bonusOpen = true;
      const rewards = [];
      for (let i = 0; i < 3; i++) {
        const tokens = Math.floor(Math.max(500, bet * U.rand(4, 14)));
        const gems = U.chance(0.25) ? U.randInt(1, 3) : 0;
        rewards.push({ tokens, gems });
      }
      App.ui.modal({
        title: "Coffre bonus",
        subtitle: "Choisissez un coffre. Un seul vous sourira.",
        className: "modal-sm",
        body: `<div class="modal-center"><p class="muted" style="font-size:11.5px;margin-bottom:16px">Une ligne exceptionnelle a réveillé le coffre. Trois choix, trois destins.</p>
          <div class="chest-grid" style="margin:8px 0 0;gap:12px">
            ${[0, 1, 2].map((i) => `<button class="chest" data-bonus-chest="${i}" style="width:100px;min-height:120px"><span class="chest-emoji">🎁</span><span class="chest-label">Coffre ${i + 1}</span><span class="chest-shine"></span></button>`).join("")}
          </div></div>`,
        actions: [],
        onMount: (modal, close) => {
          modal.querySelectorAll("[data-bonus-chest]").forEach((btn) => {
            btn.addEventListener("click", () => {
              if (btn.disabled) return;
              modal.querySelectorAll("[data-bonus-chest]").forEach((b) => { b.disabled = true; b.style.pointerEvents = "none"; });
              const reward = rewards[parseInt(btn.dataset.bonusChest, 10)];
              btn.classList.add("opened");
              btn.querySelector(".chest-emoji").textContent = "✨";
              App.audio.play("chest");
              App.fx.starBurst(window.innerWidth / 2, window.innerHeight / 2, 20);
              App.meta.bonus(reward.tokens, { silent: true });
              if (reward.gems) App.meta.grant("gems", reward.gems, {});
              const body = modal.querySelector(".modal-body");
              if (body) {
                body.innerHTML = `<div class="modal-center"><div class="modal-hero-icon">🎁</div><h3 style="color:var(--gold);font-size:24px">+${U.fmt(reward.tokens)} jetons</h3>${reward.gems ? `<p style="color:var(--cyan);font-size:12px;margin-top:3px">+${reward.gems} gemmes</p>` : ""}<p class="muted" style="font-size:11px;margin-top:6px">Le coffre a parlé. Bien joué.</p></div>`;
              }
              setTimeout(() => close(), 1400);
            });
          });
        },
        onClose: () => {
          bonusOpen = false;
          if (!destroyed) scheduleNext();
        }
      });
    }

    // ---------------- Header / side ----------------
    function updateHeader() {
      const plays = container.querySelector("#slots-plays");
      const wins = container.querySelector("#slots-wins");
      const best = container.querySelector("#slots-best");
      const jackpots = container.querySelector("#slots-jackpots");
      if (plays) plays.textContent = U.fmt(g.stats.plays);
      if (wins) wins.textContent = U.fmt(g.stats.wins);
      if (best) best.textContent = U.fmt(g.stats.bestWin);
      if (jackpots) jackpots.textContent = String(g.stats.jackpots);
    }

    function updateJackpot() {
      const el = container.querySelector(".slot-jackpot strong");
      if (el) el.textContent = g.upgrades.jackpot ? U.fmt(g.jackpot) : "🔒";
    }

    function renderSide() {
      const side = container.querySelector("#slots-side");
      if (!side) return;
      side.innerHTML = `
        <div class="tabs" style="margin-bottom:8px">
          <button class="tab ${activeTab === "upgrades" ? "active" : ""}" data-slot-tab="upgrades">Améliorations</button>
          <button class="tab ${activeTab === "paytable" ? "active" : ""}" data-slot-tab="paytable">Gains</button>
        </div>
        <div id="slots-side-content"></div>`;
      const content = side.querySelector("#slots-side-content");
      if (activeTab === "upgrades") {
        const rows = Object.keys(CFG.upgrades).map((key) => {
          const def = CFG.upgrades[key];
          const level = g.upgrades[key];
          const max = def.costs ? def.costs.length : (def.max || 1);
          const maxed = level >= max;
          const cost = maxed ? 0 : (def.costs ? def.costs[level] : (def.cost !== undefined ? def.cost : Math.ceil(def.base * Math.pow(def.growth, level))));
          let label = "";
          if (key === "maxBet") label = "Mise max " + U.fmt(betOptions()[betOptions().length - 1]);
          else if (key === "wild") label = level ? "Actif" : "Non";
          else if (key === "freeSpins") label = level ? "3 scatters → " + CFG.freeSpins.count + " tours ×" + CFG.freeSpins.multiplier : "Non";
          else if (key === "bonus") label = level ? "Coffres bonus" : "Non";
          else if (key === "jackpot") label = level ? "Actif · " + U.fmt(g.jackpot) : "Non";
          else if (key === "autospin") label = level ? "25 / 50 tours" : "10 tours (inclus)";
          else if (key === "lock") label = level ? "Rouleaux verrouillables" : "Non";
          else if (key === "reels") label = level ? "5 rouleaux" : "3 rouleaux";
          else if (key === "lines") label = lineCount() + " lignes";
          return `<div class="upgrade-row ${maxed ? "maxed" : ""}">
            <span class="upgrade-icon">${def.icon}</span>
            <div class="upgrade-main">
              <div class="upgrade-name">${def.name}</div>
              <div class="upgrade-desc">${def.desc}</div>
              <div class="upgrade-meta"><span class="upgrade-level">${label}</span></div>
            </div>
            <button class="btn btn-xs ${maxed ? "btn-ghost maxed" : "btn-ghost upgrade-buy"} ${!maxed && d.tokens >= cost ? "affordable" : ""}" data-slot-buy="${key}" ${maxed ? "disabled" : ""}>
              ${maxed ? "MAX" : `<span class="cost">🪙 ${U.fmt(cost)}</span>`}
            </button>
          </div>`;
        }).join("");
        content.innerHTML = `<div class="panel"><div class="panel-head"><h3>🎰 Améliorations</h3><span class="panel-hint">Jetons</span></div><div class="panel-body" style="padding:10px"><div class="upgrade-list">${rows}</div></div></div>
          <div class="panel"><div class="panel-body" style="padding:10px 12px">
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted)"><span>Machine</span><strong style="color:var(--text-soft)">${machine().name}</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Lignes</span><strong style="color:var(--cyan)">${lineCount()}</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Jackpot</span><strong style="color:var(--gold)">${g.upgrades.jackpot ? U.fmt(g.jackpot) : "🔒"}</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Tours gratuits</span><strong style="color:var(--pink-soft)">${g.freeSpinsLeft}</strong></div>
          </div></div>`;
      } else {
        const rows = Object.keys(CFG.paytable).map((id) => {
          const def = CFG.paytable[id];
          const icon = iconFor(id);
          const p3 = payFor(id, 3);
          const p4 = payFor(id, 4);
          const p5 = payFor(id, 5);
          const fmtPay = (v) => v > 0 ? (v >= 10 ? Math.round(v) : v.toFixed(1)) : "—";
          return `<div class="paytable"><span class="pt-name">${icon} ${def.name}</span><span class="pt-mult">3× ${fmtPay(p3)} · 4× ${fmtPay(p4)} · 5× ${fmtPay(p5)}</span></div>`;
        }).join("");
        content.innerHTML = `<div class="panel"><div class="panel-head"><h3>💎 Table des gains</h3><span class="panel-hint">× mise/ligne</span></div><div class="panel-body">${rows}
          <div class="divider"></div>
          <p class="muted" style="font-size:9.5px;line-height:1.6"><strong style="color:var(--gold)">Valeurs ajustées :</strong> le retour de ligne vise ${Math.round((CFG.lineRTP?.[String(reels())] || (reels() === 3 ? 0.92 : 0.82)) * 100)} % hors free spins. Les scatters ajoutent 2× / 4× / 8× la mise totale et déclenchent ${CFG.freeSpins.count} tours gratuits ×${CFG.freeSpins.multiplier}.</p>
          <p class="muted" style="font-size:9.5px;line-height:1.6;margin-top:5px"><strong style="color:var(--gold)">Jackpot :</strong> 5 symboles identiques sur une ligne (jokers inclus). Le jackpot grossit de 1,5 % de chaque mise.</p>
        </div></div>`;
      }
    }

    // ---------------- Init ----------------
    ensureGrid();
    const gm = App.meta.gameMeta("slots");
    container.innerHTML = `
      <div class="game-header">
        <div class="game-title-wrap"><span class="game-title-icon">${gm.icon}</span><div><h1>Machines à sous</h1><p>${gm.tagline}</p></div></div>
        <div class="game-header-stats">
          <span class="game-stat-chip">Tours <strong id="slots-plays">${U.fmt(g.stats.plays)}</strong></span>
          <span class="game-stat-chip">Gains <strong id="slots-wins">${U.fmt(g.stats.wins)}</strong></span>
          <span class="game-stat-chip">Meilleur <strong id="slots-best">${U.fmt(g.stats.bestWin)}</strong></span>
          <span class="game-stat-chip">Jackpots <strong id="slots-jackpots">${g.stats.jackpots}</strong></span>
        </div>
      </div>
      <div class="game-layout wide-side">
        <section class="game-stage slots-stage"><div id="slots-root"></div></section>
        <aside class="game-side" id="slots-side"></aside>
      </div>`;

    renderStage();
    renderSide();
    updateHeader();

    const onClick = (e) => {
      if (e.target.closest("[data-slot-need]")) {
        App.audio.play("error");
        App.ui.toast("Amélioration requise", "Achetez l'auto-spin dans le panneau de droite.", "🔒", "danger");
        return;
      }
      const machineBtn = e.target.closest("[data-machine]");
      if (machineBtn) {
        const mc = CFG.machines.find((x) => x.id === machineBtn.dataset.machine);
        if (!mc) return;
        if (d.maxLevel < mc.unlock) {
          App.audio.play("error");
          App.ui.toast("Machine verrouillée", "Disponible au niveau " + mc.unlock + ".", "🔒", "danger");
          return;
        }
        g.machine = mc.id;
        grid = generateGrid(false);
        lockedReels = new Array(reels()).fill(false);
        lastHitSet = new Set();
        App.audio.play("click");
        App.fx.burst(window.innerWidth / 2, window.innerHeight * 0.4, { colors: [mc.accent, "#ffc857"], count: 18 });
        renderStage();
        renderSide();
        App.state.saveSoon();
        return;
      }
      const betBtn = e.target.closest("[data-slot-bet]");
      if (betBtn) {
        if (spinning) return;
        const options = betOptions();
        g.betIndex = U.clamp(g.betIndex + parseInt(betBtn.dataset.slotBet, 10), 0, options.length - 1);
        App.audio.play("tick");
        renderStage();
        App.state.saveSoon();
        return;
      }
      if (e.target.closest("[data-slot-spin]")) { spin(); return; }
      const auto = e.target.closest("[data-slot-auto]");
      if (auto) {
        if (spinning) return;
        g.autoSpins = parseInt(auto.dataset.slotAuto, 10);
        App.audio.play("click");
        renderStage();
        spin();
        return;
      }
      if (e.target.closest("[data-slot-stop-auto]")) {
        g.autoSpins = 0;
        App.audio.play("click");
        renderStage();
        return;
      }
      const lock = e.target.closest("[data-lock-reel]");
      if (lock) {
        if (spinning) return;
        if (!g.upgrades.lock) {
          App.audio.play("error");
          App.ui.toast("Verrouillage verrouillé", "Achetez l'amélioration Verrouillage.", "🔒", "danger");
          return;
        }
        const i = parseInt(lock.dataset.lockReel, 10);
        lockedReels[i] = !lockedReels[i];
        App.audio.play("click");
        paintReels(lastHitSet, false);
        return;
      }
      const tab = e.target.closest("[data-slot-tab]");
      if (tab) { activeTab = tab.dataset.slotTab; renderSide(); return; }
      const buy = e.target.closest("[data-slot-buy]");
      if (buy) { buyUpgrade(buy.dataset.slotBuy); return; }
    };
    container.addEventListener("click", onClick);

    function buyUpgrade(key) {
      if (spinning) {
        App.audio.play("error");
        App.ui.toast("Tour en cours", "Attendez la fin du tour pour améliorer la machine.", "🎰", "danger");
        return;
      }
      const def = CFG.upgrades[key];
      const level = g.upgrades[key];
      const max = def.costs ? def.costs.length : (def.max || 1);
      if (level >= max) return;
      if (key === "lines" && lineCount() >= patterns().length) {
        App.audio.play("error");
        App.ui.toast("Maximum de lignes", "Toutes les lignes de cette machine sont déjà actives.", "📏", "");
        return;
      }
      const cost = def.costs ? def.costs[level] : (def.cost !== undefined ? def.cost : Math.ceil(def.base * Math.pow(def.growth, level)));
      if (!App.meta.spend("tokens", cost)) {
        App.audio.play("error");
        App.ui.toast("Pas assez de jetons", "Il manque " + U.fmt(cost - d.tokens) + " jetons.", "🪙", "danger");
        return;
      }
      g.upgrades[key] = level + 1;
      if (key === "reels") {
        grid = generateGrid(false);
        lockedReels = new Array(reels()).fill(false);
      }
      App.audio.play("purchase");
      App.fx.burst(window.innerWidth * 0.7, window.innerHeight * 0.45, { colors: ["#a855f7", "#ffc857"], count: 18 });
      App.ui.toast("Amélioration achetée", def.name, def.icon, "gold");
      App.meta.checkAchievements();
      App.state.saveSoon();
      renderStage();
      renderSide();
      updateHeader();
    }

    // free spins / auto continuent après un changement de page uniquement si la page est active
    if (g.freeSpinsLeft > 0 || g.autoSpins > 0) {
      // Ne lance pas automatiquement au chargement : l'utilisateur clique sur le bouton.
    }

    const cleanup = () => {
      destroyed = true;
      clearTimers();
      container.removeEventListener("click", onClick);
      if (spinning && spinState && spinState.paidStake > 0) {
        App.meta.refund(spinState.paidStake, "slots");
      }
      spinning = false;
      spinState = null;
      activeCleanup = null;
    };
    activeCleanup = cleanup;
    if (g.autoSpins > 0 || g.freeSpinsLeft > 0) scheduleNext();
    return cleanup;
  };

  App.games = App.games || {};
  App.games.slots = Game;
})();
