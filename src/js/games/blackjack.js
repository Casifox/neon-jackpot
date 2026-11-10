/* ============================================================
   NEON JACKPOT — games/blackjack.js
   Blackjack : croupier, splits, cartes spéciales, boss de table
   ============================================================ */
(function () {
  "use strict";

  const App = window.App;
  const U = App.utils;
  const D = window.GAME_DATA;
  const CFG = D.balance.blackjack;

  const Game = {};
  let activeCleanup = null;

  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = [
    { rank: "A", value: 11 },
    { rank: "2", value: 2 },
    { rank: "3", value: 3 },
    { rank: "4", value: 4 },
    { rank: "5", value: 5 },
    { rank: "6", value: 6 },
    { rank: "7", value: 7 },
    { rank: "8", value: 8 },
    { rank: "9", value: 9 },
    { rank: "10", value: 10 },
    { rank: "J", value: 10 },
    { rank: "Q", value: 10 },
    { rank: "K", value: 10 }
  ];

  Game.render = function (container) {
    if (activeCleanup) activeCleanup();
    const d = App.state.data;
    const g = d.games.blackjack;
    let timers = new Set();
    let autoTimer = null;
    let busy = false;
    let activeTab = "upgrades";
    let table = null;
    let generation = 0;

    const betOptions = () => CFG.betSteps.slice(0, Math.min(CFG.betSteps.length, 3 + g.upgrades.maxBet));
    const currentBet = () => betOptions()[U.clamp(g.betIndex, 0, betOptions().length - 1)] || CFG.minBet;
    const maxHands = () => Math.min(5, 1 + (g.upgrades.split ? 1 : 0) + g.upgrades.multiHand * 2);
    const bjRatio = () => [1.5, 2, 3][Math.min(2, g.upgrades.bjBonus)] || 1.5;
    const gameBonus = () => App.meta.gameBonus("blackjack") + (g.upgrades.vip ? 0.1 : 0);

    function later(fn, ms) {
      const token = generation;
      const id = setTimeout(() => {
        timers.delete(id);
        if (token === generation) fn();
      }, ms);
      timers.add(id);
      return id;
    }

    function cancelAuto() {
      if (autoTimer) {
        clearTimeout(autoTimer);
        autoTimer = null;
      }
    }

    function clearTimers() {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      cancelAuto();
    }

    function newShoe() {
      const shoe = [];
      for (let deck = 0; deck < CFG.decks; deck++) {
        for (const suit of SUITS) {
          for (const r of RANKS) {
            shoe.push({ rank: r.rank, value: r.value, suit });
          }
        }
      }
      return U.shuffle(shoe);
    }

    function ensureShoe() {
      if (!table.shoe || table.shoe.length < 25) {
        table.shoe = newShoe();
        table.runningCount = 0;
      }
    }

    function countCard(card) {
      const v = card.value;
      if (v >= 2 && v <= 6) table.runningCount += 1;
      else if (v >= 10) table.runningCount -= 1;
    }

    function drawCard(forPlayer) {
      ensureShoe();
      let card = table.shoe.pop();
      card = Object.assign({}, card);
      countCard(card);
      if (forPlayer && g.upgrades.specials) {
        const chances = CFG.specialChances;
        const roll = Math.random();
        let acc = chances.joker;
        if (roll < acc) {
          card.joker = true;
          card.rank = "JOKER";
          card.suit = "★";
          card.value = 11;
        } else {
          acc += chances.golden;
          if (roll < acc) card.golden = true;
          else {
            acc += chances.fire;
            if (roll < acc) card.fire = true;
          }
        }
      }
      card._anim = true;
      return card;
    }

    function handValue(cards) {
      let total = 0;
      let flexible = 0;
      for (const c of cards) {
        if (c.rank === "A" || c.joker) {
          total += 11;
          flexible++;
        } else {
          total += c.value;
        }
      }
      while (total > 21 && flexible > 0) {
        total -= 10;
        flexible--;
      }
      return { total, soft: flexible > 0, bust: total > 21 };
    }

    function isBlackjack(hand) {
      return hand.cards.length === 2 && handValue(hand.cards).total === 21 && !hand.split;
    }

    function pairValue(card) {
      if (card.joker) return "joker";
      return card.value;
    }

    function dealerUpValue() {
      const card = table.dealer[0];
      if (!card) return 0;
      if (card.rank === "A") return 11;
      return card.value;
    }

    function canSplit(hand) {
      if (!g.upgrades.split || hand.cards.length !== 2 || table.hands.length >= maxHands()) return false;
      if (!d.tokens && d.tokens !== 0) return false;
      if (d.tokens < hand.bet) return false;
      return pairValue(hand.cards[0]) === pairValue(hand.cards[1]);
    }

    function canDouble(hand) {
      return hand.cards.length === 2 && !hand.done && d.tokens >= hand.bet;
    }

    function startRound() {
      if (!table || (table.phase !== "bet" && table.phase !== "done")) return;
      if (busy) return;
      const bet = currentBet();
      if (!App.meta.canAfford("tokens", bet)) {
        App.audio.play("error");
        App.ui.toast("Jetons insuffisants", "Réduisez la mise ou ouvrez le coffre de secours.", "🪙", "danger");
        g.autoOn = false;
        cancelAuto();
        renderTable();
        return;
      }
      generation++;
      const shoe = table.shoe || newShoe();
      const isBoss = !!g.bossPending;
      if (isBoss) g.bossPending = false;
      table = {
        shoe,
        runningCount: table.runningCount || 0,
        dealer: [],
        hands: [{ cards: [], bet, done: false, split: false, result: null, fireUsed: false, _anim: true }],
        active: 0,
        phase: "dealing",
        message: null,
        boss: isBoss,
        insurance: false,
        insuranceOffered: false,
        insuranceBet: 0,
        peekChecked: false,
        roundBets: bet,
        settled: false
      };
      App.meta.bet(bet, "blackjack");
      const hand = table.hands[0];
      hand.cards.push(drawCard(true));
      hand.cards.push(drawCard(true));
      table.dealer.push(drawCard(false));
      table.dealer.push(drawCard(false));
      table.dealer[1].hidden = true;
      table.insuranceBet = Math.floor(bet / 2);

      const playerBJ = isBlackjack(hand);
      const dealerBJ = handValue(table.dealer).total === 21 && table.dealer.length === 2;
      if (playerBJ) {
        table.message = { title: dealerBJ ? "Push — deux blackjacks" : "Blackjack naturel !", sub: dealerBJ ? "Égalité parfaite." : "Paiement " + bjRatio() + ":1" };
        resolveImmediately();
        return;
      }
      if (g.upgrades.peek && dealerBJ) {
        table.peekChecked = true;
        table.message = { title: "Le croupier a un blackjack", sub: "Pas de chance. La maison rafle la mise." };
        resolveImmediately();
        return;
      }
      if (g.upgrades.insurance && dealerUpValue() === 11 && !table.peekChecked) {
        table.insuranceOffered = true;
      }
      table.phase = "player";
      busy = true;
      renderTable();
      scheduleAuto();
      later(() => {
        busy = false;
        if (table && table.phase === "player") renderTable();
      }, 380);
    }

    function resolveImmediately() {
      table.dealer.forEach((c) => { c.hidden = false; });
      table.phase = "dealer";
      busy = true;
      renderTable();
      later(() => settle(), 750);
    }

    function addCardToHand(hand) {
      const card = drawCard(true);
      hand.cards.push(card);
      let val = handValue(hand.cards);
      if (val.bust) {
        const hasFire = hand.cards.some((c) => c.fire);
        if (hasFire && !hand.fireUsed) {
          hand.fireUsed = true;
          const removed = hand.cards.pop();
          table.message = { title: "Carte de feu !", sub: "La carte " + removed.rank + " est consumée. Une seconde chance." };
          App.audio.play("whoosh");
          const replacement = drawCard(true);
          hand.cards.push(replacement);
          val = handValue(hand.cards);
        }
      }
      return val;
    }

    function activeHand() {
      return table && table.hands[table.active];
    }

    function advanceHand() {
      if (!table) return;
      while (table.active < table.hands.length && table.hands[table.active].done) table.active++;
      if (table.active >= table.hands.length) {
        dealerTurn();
      } else {
        table.message = null;
        scheduleAuto();
      }
    }

    function act(action) {
      if (!table || busy) return;
      if (action === "new") {
        startRound();
        return;
      }
      if (table.phase !== "player") return;
      const hand = activeHand();
      if (!hand || hand.done) return;
      const val = handValue(hand.cards);
      if (action === "hit") {
        busy = true;
        const newVal = addCardToHand(hand);
        App.audio.play(newVal.bust ? "lose" : "deal");
        if (newVal.bust) {
          hand.done = true;
          hand.result = "lose";
          table.message = { title: "Bust à " + newVal.total, sub: "Trop, c'est trop." };
          later(() => {
            busy = false;
            advanceHand();
            renderTable();
          }, 400);
        } else if (newVal.total === 21) {
          hand.done = true;
          table.message = { title: "21 !", sub: "La main parfaite." };
          later(() => {
            busy = false;
            advanceHand();
            renderTable();
          }, 400);
        } else {
          busy = false;
          renderTable();
          scheduleAuto();
        }
      } else if (action === "stand") {
        hand.done = true;
        table.message = { title: "Vous restez à " + val.total, sub: "Au croupier de jouer." };
        App.audio.play("click");
        advanceHand();
        renderTable();
      } else if (action === "double") {
        if (!canDouble(hand)) return;
        if (!App.meta.spend("tokens", hand.bet)) {
          App.audio.play("error");
          return;
        }
        hand.bet *= 2;
        table.roundBets += hand.bet / 2;
        hand.doubled = true;
        busy = true;
        const newVal = addCardToHand(hand);
        hand.done = true;
        App.audio.play(newVal.bust ? "lose" : "deal");
        table.message = { title: newVal.bust ? "Bust à " + newVal.total : "Doublement à " + newVal.total, sub: "Une seule carte, tous les risques." };
        later(() => {
          busy = false;
          advanceHand();
          renderTable();
        }, 500);
      } else if (action === "split") {
        if (!canSplit(hand)) return;
        if (!App.meta.spend("tokens", hand.bet)) {
          App.audio.play("error");
          return;
        }
        table.roundBets += hand.bet;
        const moved = hand.cards.pop();
        const newHand = {
          cards: [moved],
          bet: hand.bet,
          done: false,
          split: true,
          result: null,
          fireUsed: false
        };
        hand.split = true;
        hand.cards.push(drawCard(true));
        newHand.cards.push(drawCard(true));
        if (handValue(hand.cards).bust) {
          hand.done = true;
          hand.result = "lose";
        }
        if (handValue(newHand.cards).bust) {
          newHand.done = true;
          newHand.result = "lose";
        }
        table.hands.splice(table.active + 1, 0, newHand);
        table.message = { title: "Split !", sub: "Deux mains, deux chances." };
        App.audio.play("flip");
        App.fx.burst(window.innerWidth / 2, window.innerHeight / 2, { colors: ["#22d3ee", "#ff4fd8"], count: 20 });
        renderTable();
        if (hand.done) {
          advanceHand();
          renderTable();
        } else {
          scheduleAuto();
        }
      } else if (action === "insurance") {
        if (!table.insuranceOffered) return;
        table.insurance = true;
        table.insuranceOffered = false;
        table.message = { title: "Assurance activée", sub: "Gratuite, offerte par la maison." };
        App.audio.play("click");
        renderTable();
      } else if (action === "new") {
        startRound();
      }
      App.state.saveSoon();
    }

    function dealerTurn() {
      if (!table) return;
      table.phase = "dealer";
      table.dealer.forEach((c) => { c.hidden = false; });
      busy = true;
      renderTable();
      later(() => dealerStep(), 500);
    }

    function dealerStep() {
      if (!table) return;
      const val = handValue(table.dealer);
      const allBust = table.hands.every((h) => handValue(h.cards).bust);
      if (allBust) {
        later(() => settle(), 350);
        return;
      }
      const hitSoft17 = table.boss && val.soft && val.total === 17;
      if (val.total < 17 || hitSoft17) {
        table.dealer.push(drawCard(false));
        App.audio.play("deal");
        renderTable();
        later(() => dealerStep(), 620);
      } else {
        later(() => settle(), 400);
      }
    }

    function settle() {
      if (!table || table.settled) return;
      table.settled = true;
      table.phase = "done";
      busy = false;
      const previousMessage = table.message;
      table.message = null;
      const dealerVal = handValue(table.dealer);
      const dealerBJ = table.dealer.length === 2 && dealerVal.total === 21;
      const ratio = bjRatio();
      const streakMult = 1 + (g.upgrades.streak ? Math.min(CFG.streakCap, g.streak) * CFG.streakBonusPerWin : 0);
      const gMult = Math.max(0.1, 1 + gameBonus() + (g.upgrades.streak ? streakMult - 1 : 0));
      let returns = 0;
      let bets = 0;
      let anyWin = false;
      let insuranceBonus = 0;

      if (table.insurance && dealerBJ) {
        insuranceBonus = table.insuranceBet * 2;
        App.meta.bonus(insuranceBonus, { silent: true });
        returns += insuranceBonus;
      }

      table.hands.forEach((hand) => {
        const val = handValue(hand.cards);
        bets += hand.bet;
        if (val.bust) {
          hand.result = "lose";
          App.meta.loss("blackjack", { silent: true });
          return;
        }
        const bj = isBlackjack(hand);
        if (dealerBJ && !bj) {
          hand.result = "lose";
          App.meta.loss("blackjack", { silent: true });
          return;
        }
        if (dealerBJ && bj) {
          hand.result = "push";
          App.meta.refund(hand.bet, "blackjack");
          returns += hand.bet;
          return;
        }
        if (dealerVal.bust || val.total > dealerVal.total || bj) {
          const goldenCount = hand.cards.filter((c) => c.golden).length;
          const goldenMult = Math.pow(2, goldenCount);
          let profit = bj ? hand.bet * ratio : hand.bet;
          profit *= goldenMult;
          if (hand.doubled) profit = profit; // déjà inclus dans la mise doublée
          const base = hand.bet + profit;
          const mult = base / hand.bet;
          App.meta.payout(base, "blackjack", { stake: hand.bet, mult, gameMult: gMult, silent: true });
          returns += base;
          anyWin = true;
          hand.result = bj ? "blackjack" : "win";
          if (bj) {
            g.stats.blackjacks += 1;
            if (goldenCount) hand.result = "blackjack";
          }
        } else if (val.total === dealerVal.total) {
          hand.result = "push";
          App.meta.refund(hand.bet, "blackjack");
          returns += hand.bet;
        } else {
          hand.result = "lose";
          App.meta.loss("blackjack", { silent: true });
        }
      });

      const net = returns - bets;
      if (net > 0) {
        g.streak += 1;
        if (g.streak > (g.bestStreak || 0)) g.bestStreak = g.streak;
        g.stats.streak = g.streak;
        g.stats.bestStreak = Math.max(g.stats.bestStreak || 0, g.bestStreak);
        if (g.streak > 0 && g.streak % 5 === 0) {
          App.meta.triggerSynergy("bj_streak_5", { streak: g.streak });
        }
        if (table.boss) {
          g.bossWins += 1;
          const bonus = Math.floor(table.roundBets * 2);
          App.meta.bonus(bonus, { silent: true });
          returns += bonus;
          table.message = {
            title: "Croupier légendaire vaincu !",
            sub: "+" + U.fmt(bonus) + " jetons de prime. Séries et gloire.",
            big: true
          };
          App.fx.jackpot();
          App.audio.play("jackpot");
        }
      } else if (net < 0) {
        g.streak = 0;
        g.stats.streak = 0;
      }

      if (net > 0 && !table.boss) {
        g.winsTowardBoss += 1;
        if (g.winsTowardBoss >= CFG.bossEvery) {
          g.winsTowardBoss = 0;
          g.bossPending = true;
          App.ui.toast("Croupier légendaire", "Votre prochaine main sera un boss de table. Préparez-vous.", "🎩", "gold");
        }
      }

      if (!table.message) {
        if (anyWin) {
          const totalWin = Math.max(0, net + insuranceBonus);
          table.message = {
            title: "Victoire !",
            sub: "+" + U.fmt(totalWin) + " jetons · série " + g.streak,
            big: net >= table.roundBets * 1.5
          };
        } else if (net < 0) {
          table.message = { title: "La maison gagne", sub: "Le croupier encaisse. La revanche arrive." };
        } else {
          table.message = { title: "Push", sub: "Vos mises sont rendues." };
        }
      }
      if (previousMessage && table.hands.some((h) => h.result === "blackjack")) {
        table.message = previousMessage;
      }

      const stage = container.querySelector(".bj-table");
      if (stage) {
        const rect = stage.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height * 0.58;
        if (net > 0) {
          App.fx.coinBurst(cx, cy, Math.max(50, net));
          App.fx.floatingText("+" + U.fmt(net + insuranceBonus), cx, cy - 40, { className: "win", color: "#4ade80", duration: 1.5, size: 26 });
          App.audio.play(net >= table.roundBets * 3 || table.boss ? "jackpot" : net >= table.roundBets ? "bigwin" : "win");
          if (net >= table.roundBets * 3) {
            App.fx.confetti(100);
            App.fx.shake(7, 500);
          }
        } else if (net < 0) {
          App.audio.play("lose");
          App.fx.floatingText("-" + U.fmt(-net), cx, cy - 40, { className: "lose", color: "#ff5470", duration: 1.2, size: 22 });
          App.fx.shake(3, 250);
        } else {
          App.audio.play("click");
        }
      }
      App.meta.checkAchievements();
      App.state.saveSoon();
      renderTable();
      scheduleAuto();
    }

    // ---------------- Stratégie automatique ----------------
    function basicStrategy() {
      const hand = activeHand();
      if (!hand) return "stand";
      const val = handValue(hand.cards);
      const up = dealerUpValue();
      if (canSplit(hand)) {
        const pv = pairValue(hand.cards[0]);
        if (pv === 11 || pv === 8) return "split";
        if ([2, 3, 7].includes(pv) && up >= 2 && up <= 7) return "split";
        if (pv === 6 && up >= 2 && up <= 6) return "split";
        if (pv === 9 && up !== 7 && up <= 9) return "split";
        if (pv === 4 && (up === 5 || up === 6)) return "split";
      }
      const canD = canDouble(hand);
      if (val.soft) {
        if (val.total >= 19) return "stand";
        if (val.total === 18) return up >= 9 ? "hit" : "stand";
        if (canD && val.total >= 15 && up >= 4 && up <= 6) return "double";
        return "hit";
      }
      if (val.total >= 17) return "stand";
      if (val.total >= 13) return up <= 6 ? "stand" : "hit";
      if (val.total === 12) return up >= 4 && up <= 6 ? "stand" : "hit";
      if (val.total === 11) return canD ? "double" : "hit";
      if (val.total === 10) return canD && up <= 9 ? "double" : "hit";
      if (val.total === 9) return canD && up >= 3 && up <= 6 ? "double" : "hit";
      return "hit";
    }

    function autoTick() {
      if (!g.autoOn) return;
      if (!table) return;
      if (table.phase === "bet" || table.phase === "done") {
        if (!App.meta.canAfford("tokens", currentBet())) {
          g.autoOn = false;
          App.ui.toast("Auto-jeu arrêté", "Votre bankroll ne permet plus la mise actuelle.", "🤖", "danger");
          renderTable();
          return;
        }
        later(() => startRound(), 500);
        return;
      }
      if (table.phase === "player" && !busy) {
        if (table.insuranceOffered) {
          table.insurance = true;
          table.insuranceOffered = false;
          renderTable();
        }
        const action = basicStrategy();
        act(action);
      }
    }

    function scheduleAuto() {
      cancelAuto();
      if (!g.autoOn) return;
      autoTimer = setTimeout(() => {
        autoTimer = null;
        autoTick();
      }, table && table.phase === "done" ? 1300 : 650);
    }

    // ---------------- Rendu ----------------
    function cardHtml(card, hidden, index) {
      if (hidden) {
        return `<div class="playing-card card-back ${card && card._anim ? "dealt" : ""}" style="--card-rot:${(index || 0) % 2 ? 1.5 : -1.5}deg"></div>`;
      }
      if (!card) return "";
      const red = card.suit === "♥" || card.suit === "♦";
      const classes = ["playing-card", red ? "red" : "black"];
      if (card.golden) classes.push("golden");
      if (card.fire) classes.push("fire");
      if (card.joker) classes.push("joker");
      if (card._anim) classes.push("dealt");
      const center = card.joker ? "🃏" : card.suit;
      const rank = card.joker ? "JK" : card.rank;
      return `<div class="${classes.join(" ")}" style="--card-rot:${(index || 0) % 2 ? 1.5 : -1.5}deg">
        <div class="card-corner"><span class="card-rank">${rank}</span><span class="card-suit-sm">${card.joker ? "★" : card.suit}</span></div>
        <div class="card-center">${center}</div>
        <div class="card-corner-bottom"><span class="card-rank">${rank}</span><span class="card-suit-sm">${card.joker ? "★" : card.suit}</span></div>
      </div>`;
    }

    function renderTable() {
      const root = container.querySelector("#bj-root");
      if (!root || !table) return;
      const phase = table.phase;
      const dealerHidden = table.dealer.some((c) => c.hidden);
      const visibleDealer = table.dealer.filter((c) => !c.hidden);
      const dealerVal = visibleDealer.length ? handValue(visibleDealer) : { total: 0 };
      const dealerAllVal = handValue(table.dealer);
      const dealerScore = dealerHidden ? "?" : dealerAllVal.total;
      const shoeCount = table.shoe ? table.shoe.length : 0;
      const up = dealerUpValue();
      const bustChance = { 2: 35, 3: 37, 4: 40, 5: 42, 6: 42, 7: 26, 8: 24, 9: 23, 10: 21, 11: 11 }[up] || 0;

      const dealerCards = table.dealer.map((c, i) => cardHtml(c, c.hidden, i)).join("");
      const handsHtml = table.hands.map((hand, i) => {
        const val = handValue(hand.cards);
        const active = phase === "player" && i === table.active && !hand.done;
        const resultClass = hand.result ? "result-" + (hand.result === "blackjack" ? "win" : hand.result) : "";
        const badge = hand.result
          ? `<span class="bj-result-badge ${hand.result === "blackjack" ? "bj" : hand.result}">${hand.result === "blackjack" ? "BLACKJACK" : hand.result === "win" ? "GAGNÉ" : hand.result === "push" ? "PUSH" : "PERDU"}</span>`
          : "";
        return `<div class="bj-hand ${active ? "active" : ""} ${resultClass}">
          ${badge}
          <div class="bj-hand-cards">${hand.cards.map((c, ci) => cardHtml(c, false, ci)).join("")}</div>
          <div class="bj-hand-info">
            <span class="bj-score ${val.soft ? "soft" : ""} ${val.bust ? "bust" : ""}">${val.total}${val.soft ? " souple" : ""}${val.bust ? " · bust" : ""}</span>
            <span class="bet-tag">🪙 ${U.fmt(hand.bet)}${hand.doubled ? " ×2" : ""}</span>
            ${isBlackjack(hand) ? `<span class="badge gold">BJ</span>` : ""}
          </div>
        </div>`;
      }).join("");

      let controls = "";
      let insurance = "";
      if (phase === "bet" || phase === "done") {
        const bet = currentBet();
        const options = betOptions();
        controls = `<div class="bj-controls">
          <button class="btn btn-primary btn-lg" data-bj-action="new" style="min-width:180px">${phase === "done" ? "Nouvelle main" : "Distribuer"} · 🪙 ${U.fmt(bet)}</button>
          <button class="btn btn-ghost" data-bj-auto>${g.autoOn ? "⏸ Auto actif" : "▶ Auto"}</button>
        </div>
        <div class="bj-bet-row">
          <button class="bet-step" data-bj-bet="-1">−</button>
          <div class="bet-display" style="padding:5px 10px"><span class="chip-symbol">🪙</span><div><span class="bet-label">Mise</span><strong>${U.fmt(bet)}</strong></div></div>
          <button class="bet-step" data-bj-bet="1">+</button>
          <button class="bet-chip" data-bj-bet="max">MAX</button>
          <span class="muted" style="font-size:9px">Max ${U.fmt(options[options.length - 1])} · BJ ${bjRatio()}:1</span>
        </div>`;
      } else if (phase === "player") {
        const hand = activeHand();
        const val = hand ? handValue(hand.cards) : { total: 0 };
        controls = `<div class="bj-controls">
          <button class="btn btn-ghost" data-bj-action="hit" ${busy ? "disabled" : ""}>Tirer</button>
          <button class="btn btn-ghost" data-bj-action="stand" ${busy ? "disabled" : ""}>Rester</button>
          <button class="btn btn-gold" data-bj-action="double" ${busy || !canDouble(hand) ? "disabled" : ""}>Doubler</button>
          <button class="btn btn-cyan" data-bj-action="split" ${busy || !canSplit(hand) ? "disabled" : ""}>Split</button>
          <button class="btn btn-ghost btn-sm" data-bj-auto>${g.autoOn ? "⏸" : "▶ Auto"}</button>
        </div>
        <div class="bj-bet-row"><span class="badge">Main ${table.active + 1} / ${table.hands.length} · ${val.total}${val.soft ? " souple" : ""}</span><span class="muted" style="font-size:9px">Série ${g.streak}${g.upgrades.streak ? " · bonus ×" + (1 + Math.min(CFG.streakCap, g.streak) * 0.05).toFixed(2) : ""}</span></div>`;
        if (table.insuranceOffered) {
          insurance = `<button class="btn btn-outline btn-sm" data-bj-action="insurance">🛡️ Assurance gratuite</button>`;
        }
      } else if (phase === "dealing" || phase === "dealer") {
        controls = `<div class="bj-controls"><span class="badge live"><span class="live-dot"></span> ${phase === "dealing" ? "Distribution…" : "Le croupier joue…"}</span></div>`;
      }

      const streakBadge = g.streak > 0 ? `<div class="bj-streak ${g.streak >= 3 ? "hot" : ""}">🔥 Série ${g.streak}${g.upgrades.streak ? " · +" + Math.round(Math.min(CFG.streakCap, g.streak) * 5) + "%" : ""}</div>` : "";
      const bossBadge = table.boss ? `<div style="position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:3" class="badge gold">🎩 CROUPIER LÉGENDAIRE · gains doublés</div>` : "";
      const counter = g.upgrades.counter && phase !== "bet" ? `<span class="game-stat-chip">Compteur <strong>${table.runningCount >= 0 ? "+" : ""}${table.runningCount}</strong></span><span class="game-stat-chip">Bust croupier <strong>${bustChance} %</strong></span>` : "";
      const msg = table.message
        ? `<div class="bj-message ${table.message.big ? "big" : ""}"><strong>${hSafe(table.message.title)}</strong><span>${hSafe(table.message.sub || "")}</span></div>`
        : `<div class="bj-message">${phase === "bet" ? "<span>Placez votre mise et défiez le croupier.</span>" : phase === "player" ? "<span>À vous de jouer. Cartes, courage et un peu de chance.</span>" : "<span>&nbsp;</span>"}</div>`;

      root.innerHTML = `
        <div class="bj-table">
          ${streakBadge}
          ${bossBadge}
          <div class="bj-shoe"><div class="bj-shoe-stack"><i></i><i></i><i></i></div><span>${shoeCount} cartes</span></div>
          <div class="bj-dealer">
            <div class="bj-label">Croupier ${table.boss ? "· LÉGENDAIRE" : ""} <span class="bj-score ${dealerAllVal.bust && !dealerHidden ? "bust" : ""}">${dealerScore}</span></div>
            <div class="bj-hand-cards">${dealerCards}</div>
          </div>
          <div class="bj-hands">${handsHtml || `<div class="empty-state" style="min-height:130px"><div class="empty-icon">🃏</div><span>Votre main apparaîtra ici.</span></div>`}</div>
          ${msg}
          ${insurance}
          ${controls}
          ${counter ? `<div class="game-header-stats" style="justify-content:center;margin-top:6px">${counter}</div>` : ""}
        </div>`;
      table.dealer.forEach((c) => { c._anim = false; });
      table.hands.forEach((h) => h.cards.forEach((c) => { c._anim = false; }));
      updateHeader();
    }

    function hSafe(s) {
      return U.escapeHtml(String(s || ""));
    }

    function renderSide() {
      const side = container.querySelector("#bj-side");
      if (!side) return;
      const ratio = bjRatio();
      side.innerHTML = `
        <div class="tabs" style="margin-bottom:8px">
          <button class="tab ${activeTab === "upgrades" ? "active" : ""}" data-bj-tab="upgrades">Améliorations</button>
          <button class="tab ${activeTab === "rules" ? "active" : ""}" data-bj-tab="rules">Règles</button>
        </div>
        <div id="bj-side-content"></div>`;
      const content = side.querySelector("#bj-side-content");
      if (activeTab === "upgrades") {
        const rows = Object.keys(CFG.upgrades).map((key) => {
          const def = CFG.upgrades[key];
          const level = g.upgrades[key];
          const max = def.costs ? def.costs.length : (def.max || 1);
          const maxed = level >= max;
          const cost = maxed ? 0 : (def.costs ? def.costs[level] : (def.cost !== undefined ? def.cost : Math.ceil(def.base * Math.pow(def.growth, level))));
          let levelText = "";
          if (key === "maxBet") levelText = "Max " + U.fmt(betOptions()[betOptions().length - 1]);
          else if (key === "bjBonus") levelText = "Blackjack " + ratio + ":1";
          else if (key === "insurance") levelText = level ? "Gratuite" : "Non";
          else if (key === "peek") levelText = level ? "Active" : "Non";
          else if (key === "counter") levelText = level ? "Compteur actif" : "Non";
          else if (key === "split") levelText = level ? "Actif" : "Non";
          else if (key === "multiHand") levelText = maxHands() + " mains max";
          else if (key === "auto") levelText = level ? "Stratégie active" : "Auto de base offert";
          else if (key === "specials") levelText = level ? "Joker / Or / Feu" : "Non";
          else if (key === "vip") levelText = level ? "+10 % de gains" : "Non";
          else if (key === "streak") levelText = level ? "+5 % / victoire" : "Non";
          if (maxed && key !== "maxBet" && key !== "multiHand" && key !== "bjBonus") levelText = "Possédé";
          return `<div class="upgrade-row ${maxed ? "maxed" : ""}">
            <span class="upgrade-icon">${def.icon}</span>
            <div class="upgrade-main">
              <div class="upgrade-name">${def.name}</div>
              <div class="upgrade-desc">${def.desc}</div>
              <div class="upgrade-meta"><span class="upgrade-level">${levelText}</span>${key === "multiHand" || key === "bjBonus" ? `<span class="upgrade-level">Niv. ${level}/${max}</span>` : ""}</div>
            </div>
            <button class="btn btn-xs ${maxed ? "btn-ghost maxed" : "btn-ghost upgrade-buy"} ${!maxed && d.tokens >= cost ? "affordable" : ""}" data-bj-buy="${key}" ${maxed ? "disabled" : ""}>
              ${maxed ? "MAX" : `<span class="cost">🪙 ${U.fmt(cost)}</span>`}
            </button>
          </div>`;
        }).join("");
        content.innerHTML = `<div class="panel"><div class="panel-head"><h3>🃏 Améliorations</h3><span class="panel-hint">Jetons</span></div><div class="panel-body" style="padding:10px"><div class="upgrade-list">${rows}</div></div></div>
          <div class="panel"><div class="panel-body" style="padding:10px 12px">
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted)"><span>Ratio blackjack</span><strong style="color:var(--gold)">${ratio}:1</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Bonus de table</span><strong style="color:var(--green)">+${Math.round(gameBonus() * 100)} %</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Boss dans</span><strong style="color:var(--pink-soft)">${Math.max(0, CFG.bossEvery - g.winsTowardBoss)} gains</strong></div>
          </div></div>`;
      } else {
        content.innerHTML = `<div class="panel"><div class="panel-head"><h3>📖 Règles de la table</h3></div><div class="panel-body" style="font-size:10.5px;line-height:1.65;color:var(--muted)">
          <p><strong style="color:var(--text-soft)">Objectif :</strong> battre la main du croupier sans dépasser 21.</p>
          <p style="margin-top:7px"><strong style="color:var(--text-soft)">Paiements :</strong> victoire 1:1, blackjack ${ratio}:1, assurance gratuite si disponible, push = mise rendue.</p>
          <p style="margin-top:7px"><strong style="color:var(--text-soft)">Croupier :</strong> reste à 17. Le croupier légendaire tire sur un 17 souple et offre une prime de ×2 sur la mise totale.</p>
          <p style="margin-top:7px"><strong style="color:var(--text-soft)">Boss :</strong> tous les ${CFG.bossEvery} gains, la prochaine main est un boss.</p>
          <p style="margin-top:7px"><strong style="color:var(--text-soft)">Séries :</strong> ${g.upgrades.streak ? "actives, +5 % par victoire consécutive (max +50 %)." : "amélioration non achetée."}</p>
          <p style="margin-top:7px"><strong style="color:var(--text-soft)">Cartes spéciales :</strong> ${g.upgrades.specials ? "Joker (vaut 1 ou 11), carte dorée (gain ×2), carte de feu (annule un bust une fois)." : "débloquées avec l'amélioration Cartes spéciales."}</p>
          <p style="margin-top:7px"><strong style="color:var(--text-soft)">Stratégie auto :</strong> ${g.upgrades.auto ? "la stratégie de base est disponible." : "débloquée avec l'amélioration Auto-jeu."}</p>
        </div></div>`;
      }
    }

    function updateHeader() {
      const plays = container.querySelector("#bj-plays");
      const wins = container.querySelector("#bj-wins");
      const streak = container.querySelector("#bj-streak");
      const blackjacks = container.querySelector("#bj-blackjacks");
      if (plays) plays.textContent = U.fmt(g.stats.plays);
      if (wins) wins.textContent = U.fmt(g.stats.wins);
      if (streak) streak.textContent = String(g.streak);
      if (blackjacks) blackjacks.textContent = U.fmt(g.stats.blackjacks);
    }

    // ----- Init -----
    const gm = App.meta.gameMeta("blackjack");
    container.innerHTML = `
      <div class="game-header">
        <div class="game-title-wrap"><span class="game-title-icon">${gm.icon}</span><div><h1>Blackjack</h1><p>${gm.tagline}</p></div></div>
        <div class="game-header-stats">
          <span class="game-stat-chip">Mains <strong id="bj-plays">${U.fmt(g.stats.plays)}</strong></span>
          <span class="game-stat-chip">Victoires <strong id="bj-wins">${U.fmt(g.stats.wins)}</strong></span>
          <span class="game-stat-chip">Série <strong id="bj-streak">${g.streak}</strong></span>
          <span class="game-stat-chip">Blackjacks <strong id="bj-blackjacks">${U.fmt(g.stats.blackjacks)}</strong></span>
          <span class="game-stat-chip">Boss <strong>${g.bossWins}</strong></span>
        </div>
      </div>
      <div class="game-layout wide-side">
        <section class="game-stage bj-stage">
          <div id="bj-root"></div>
        </section>
        <aside class="game-side" id="bj-side"></aside>
      </div>`;

    table = {
      shoe: newShoe(),
      runningCount: 0,
      dealer: [],
      hands: [],
      active: 0,
      phase: "bet",
      message: null,
      boss: false,
      insurance: false,
      insuranceOffered: false,
      insuranceBet: 0,
      peekChecked: false,
      roundBets: 0,
      settled: false
    };

    renderTable();
    renderSide();

    const onClick = (e) => {
      const tab = e.target.closest("[data-bj-tab]");
      if (tab) {
        activeTab = tab.dataset.bjTab;
        renderSide();
        return;
      }
      const buy = e.target.closest("[data-bj-buy]");
      if (buy) {
        buyUpgrade(buy.dataset.bjBuy);
        return;
      }
      const bet = e.target.closest("[data-bj-bet]");
      if (bet) {
        changeBet(bet.dataset.bjBet);
        return;
      }
      if (e.target.closest("[data-bj-auto]")) {
        toggleAuto();
        return;
      }
      const actEl = e.target.closest("[data-bj-action]");
      if (actEl) {
        act(actEl.dataset.bjAction);
        return;
      }
    };
    container.addEventListener("click", onClick);

    function changeBet(dir) {
      if (table.phase !== "bet" && table.phase !== "done") return;
      const options = betOptions();
      let idx = U.clamp(g.betIndex, 0, options.length - 1);
      if (dir === "max") idx = options.length - 1;
      else idx = U.clamp(idx + parseInt(dir, 10), 0, options.length - 1);
      g.betIndex = idx;
      App.audio.play("tick");
      renderTable();
      App.state.saveSoon();
    }

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
        const options = betOptions();
        g.betIndex = U.clamp(g.betIndex, 0, options.length - 1);
      }
      App.audio.play("purchase");
      App.fx.burst(window.innerWidth * 0.7, window.innerHeight * 0.4, { colors: ["#22d3ee", "#ffc857"], count: 16 });
      App.ui.toast("Amélioration achetée", def.name + " · niveau " + (level + 1), def.icon, "gold");
      App.meta.checkAchievements();
      App.state.saveSoon();
      renderSide();
      renderTable();
    }

    function toggleAuto() {
      g.autoOn = !g.autoOn;
      App.audio.play("click");
      renderTable();
      if (g.autoOn) scheduleAuto();
      else cancelAuto();
      App.state.saveSoon();
    }

    // Annule les animations en attente lorsque la page change.
    const cleanup = () => {
      generation++;
      clearTimers();
      container.removeEventListener("click", onClick);
      if (table && (table.phase === "player" || table.phase === "dealer" || table.phase === "dealing") && !table.settled) {
        const refund = table.hands.reduce((s, h) => s + h.bet, 0);
        if (refund > 0) App.meta.refund(refund, "blackjack");
      }
      table = null;
      activeCleanup = null;
    };
    activeCleanup = cleanup;

    if (g.autoOn) scheduleAuto();
    return cleanup;
  };

  App.games = App.games || {};
  App.games.blackjack = Game;
})();
