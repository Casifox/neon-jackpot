/* ============================================================
   NEON JACKPOT — meta.js
   XP, déblocages, succès, quêtes, collections, synergies, prestige
   ============================================================ */
(function () {
  "use strict";

  const App = window.App;
  const U = App.utils;
  const D = window.GAME_DATA;
  const BAL = D.balance;
  const UNL = D.unlocks;
  const ACH = D.achievements;
  const COLL = D.collections;
  const QUEST = D.quests;
  const SYNERGY = D.synergies.synergies;
  const PREST = D.prestige;
  const EVENTS = D.events;

  const Meta = {};

  const GAME_META = {};
  UNL.gameMeta.forEach((g) => { GAME_META[g.id] = g; });
  const GAME_LIST = UNL.gameMeta.filter((g) => g.id !== "vault");
  const GAME_IDS = GAME_LIST.map((g) => g.id);

  Meta.GAME_META = GAME_META;
  Meta.GAME_LIST = GAME_LIST;
  Meta.GAME_IDS = GAME_IDS;
  Meta.gameMeta = (id) => GAME_META[id] || { id, name: id, icon: "🎮", color: "#8b5cf6", color2: "#ff4fd8" };
  Meta.gameName = (id) => Meta.gameMeta(id).name;

  Meta.TITLES = [
    { min: 0, name: "Novice" },
    { min: 10, name: "Joueur" },
    { min: 25, name: "Habitué" },
    { min: 40, name: "Requin" },
    { min: 75, name: "As du casino" },
    { min: 150, name: "Maître de table" },
    { min: 300, name: "Légende néon" },
    { min: 500, name: "Roi du jackpot" },
    { min: 750, name: "Gardien des coffres" },
    { min: 1000, name: "Entité du casino" }
  ];

  Meta.TITLE_AVATARS = ["🙂", "😎", "🦊", "🦈", "🎩", "🧙", "🐉", "👑", "🗝️", "🌟"];

  Meta.titleFor = function (level) {
    let title = Meta.TITLES[0].name;
    let index = 0;
    Meta.TITLES.forEach((t, i) => {
      if (level >= t.min) { title = t.name; index = i; }
    });
    return { name: title, avatar: Meta.TITLE_AVATARS[index] || "🙂", index };
  };

  function saveSoon() {
    if (App.state.saveSoon) App.state.saveSoon();
    else App.state.save();
  }
  Meta.saveSoon = saveSoon;

  function toast(title, desc, icon, type) {
    if (App.ui && App.ui.toast) App.ui.toast(title, desc, icon, type);
  }

  // ============================================================
  // Monnaies
  // ============================================================
  Meta.canAfford = function (currency, amount) {
    const d = App.state.data;
    return (d[currency] || 0) >= amount - 1e-9;
  };

  Meta.spend = function (currency, amount) {
    const d = App.state.data;
    if (!Meta.canAfford(currency, amount)) return false;
    d[currency] -= amount;
    if (currency === "tokens") d.stats.totalSpent += amount;
    App.bus.emit("currency:change", { key: currency, delta: -amount, value: d[currency] });
    saveSoon();
    return true;
  };

  Meta.grant = function (currency, amount, opts) {
    if (!amount) return;
    opts = opts || {};
    const d = App.state.data;
    if (currency === "gems" && opts.bonus) {
      amount = Math.ceil(amount * (1 + Meta.gemBonus()));
    }
    d[currency] = (d[currency] || 0) + amount;
    App.bus.emit("currency:change", { key: currency, delta: amount, value: d[currency] });
    if (!opts.silent) saveSoon();
    return amount;
  };

  Meta.gemBonus = function () {
    return Meta.prestigeShopLevel("stars", "gemBonus") * 0.1;
  };

  Meta.addGems = function (amount, opts) {
    return Meta.grant("gems", amount, Object.assign({ bonus: true }, opts || {}));
  };

  Meta.addGoldBalls = function (amount, opts) {
    return Meta.grant("goldBalls", amount, opts);
  };

  // ============================================================
  // XP & niveaux
  // ============================================================
  Meta.xpNeeded = function (level) {
    return App.state.xpNeeded(level);
  };

  Meta.xpMult = function () {
    let mult = 1;
    mult += Meta.collectionBonus("xp");
    mult += Meta.prestigeShopLevel("crowns", "xpBoost") * 0.25;
    mult += Meta.prestigeShopLevel("relics", "xpBoost") * 1;
    mult += (App.state.data.shopUpgrades.xpBoost || 0) * 0.1;
    return mult;
  };

  Meta.addXp = function (amount, opts) {
    opts = opts || {};
    if (!amount || amount <= 0) return;
    const d = App.state.data;
    amount *= Meta.xpMult();
    d.xp += amount;
    App.bus.emit("xp:gain", { amount, source: opts.source });
    let leveled = 0;
    let guard = 0;
    while (d.xp >= Meta.xpNeeded(d.level) && guard < 500) {
      guard++;
      const need = Meta.xpNeeded(d.level);
      d.xp -= need;
      d.level += 1;
      d.maxLevel = Math.max(d.maxLevel, d.level);
      leveled++;
      const gems = 1 + Math.floor(d.level / 25);
      Meta.grant("gems", gems, { silent: true });
      const tokenReward = Math.floor(60 * Math.pow(1.18, d.level - 1));
      Meta.bonus(tokenReward, { silent: true });
      if (d.xp < 0) d.xp = 0;
    }
    if (leveled > 0) {
      const info = App.ui && App.ui.refreshHud ? null : null;
      Meta.refreshUnlocks(false);
      Meta.checkAchievements();
      const level = d.level;
      App.bus.emit("levelup", { level, gained: leveled, gems: leveled + Math.floor(level / 25) });
      if (!opts.silent) {
        App.audio.play("levelup");
        App.fx.levelUp(level);
        toast("Niveau " + level + " !", leveled > 1 ? `${leveled} niveaux gagnés d'un coup.` : "Nouvelle progression débloquée.", "🌟", "gold");
        App.state.log("🌟", "Niveau atteint", "Niv. " + level);
      }
      Meta.saveSoon();
    }
    if (App.ui && App.ui.updateHud) App.ui.updateHud();
  };

  Meta.xpProgress = function () {
    return App.state.xpProgress();
  };

  // ============================================================
  // Déblocages
  // ============================================================
  Meta.featureLevel = function (key) {
    return UNL.features[key] || 99999;
  };

  Meta.canUseFeature = function (key) {
    return App.state.data.maxLevel >= Meta.featureLevel(key);
  };

  Meta.gameUnlockLevel = function (gameId) {
    return UNL.games[gameId] || 1;
  };

  Meta.isGameUnlocked = function (gameId) {
    const d = App.state.data;
    if (gameId === "vault") return !!d.unlockedGames.vault;
    if (d.unlockedGames[gameId]) return true;
    return d.maxLevel >= Meta.gameUnlockLevel(gameId);
  };

  Meta.gameProgress = function (gameId) {
    const d = App.state.data;
    const req = Meta.gameUnlockLevel(gameId);
    return U.clamp(d.maxLevel / req, 0, 1);
  };

  Meta.vaultEligible = function () {
    const d = App.state.data;
    const wins = d.stats.totalWins;
    const gamesWithWins = GAME_IDS.filter((id) => d.games[id].stats.wins > 0).length;
    return wins >= BAL.vault.unlockWins && gamesWithWins >= BAL.vault.unlockGames;
  };

  Meta.refreshUnlocks = function (silent) {
    const d = App.state.data;
    let changed = false;
    GAME_IDS.forEach((id) => {
      if (!d.unlockedGames[id] && d.maxLevel >= Meta.gameUnlockLevel(id)) {
        d.unlockedGames[id] = true;
        changed = true;
        App.bus.emit("game:unlocked", { game: Meta.gameMeta(id), level: d.maxLevel });
        if (!silent) {
          App.audio.play("unlock");
          if (App.ui && App.ui.unlockModal) {
            App.ui.unlockModal(Meta.gameMeta(id));
          } else {
            toast("Nouveau jeu débloqué : " + Meta.gameName(id), "Niveau " + d.maxLevel + " atteint.", Meta.gameMeta(id).icon, "gold");
          }
        }
        App.state.log(Meta.gameMeta(id).icon, "Jeu débloqué", Meta.gameName(id));
      }
    });
    if (!d.unlockedGames.vault && Meta.vaultEligible()) {
      d.unlockedGames.vault = true;
      changed = true;
      App.bus.emit("game:unlocked", { game: Meta.gameMeta("vault"), level: d.maxLevel });
      if (!silent) {
        App.audio.play("unlock");
        if (App.ui && App.ui.unlockModal) App.ui.unlockModal(Meta.gameMeta("vault"));
        toast("Salle des coffres débloquée", "Un secret de plus dans le casino.", "🗝️", "gold");
      }
    }
    const featureNotices = [
      ["quests", "Quêtes quotidiennes", "📜", "Les quêtes rapportent des jetons et des gemmes."],
      ["achievements", "Succès", "🏆", "Plus de 200 succès à collectionner."],
      ["stats", "Statistiques", "📊", "Toutes vos prouesses sont maintenant suivies."],
      ["gems", "Gemmes & boutique", "💎", "Une monnaie rare pour les collections et les boosters."],
      ["collections", "Collections", "🎴", "Billes, cartes, tables et avatars à collectionner."],
      ["synergies", "Synergies", "🔗", "Les jeux commencent à se répondre entre eux."],
      ["secret", "Jeux secrets", "🗝️", "Quelque chose se cache derrière le rideau."],
      ["layer4", "Prestige infini", "♾️", "La quatrième couche vous attend."]
    ];
    featureNotices.forEach(([key, name, icon, desc]) => {
      const marker = "feature:" + key;
      if (d.maxLevel >= Meta.featureLevel(key) && !d.seenUnlocks[marker]) {
        d.seenUnlocks[marker] = true;
        changed = true;
        if (!silent) {
          toast(name + " débloqué", desc, icon, "gold");
          App.audio.play("unlock");
        }
        App.state.log(icon, "Déblocage", name);
      }
    });
    if (changed) {
      Meta.checkAllGamesSynergy(silent);
      App.bus.emit("unlocks:changed");
      Meta.saveSoon();
    }
    if (App.ui && App.ui.updateNav) App.ui.updateNav();
    return changed;
  };

  // ============================================================
  // Multiplicateurs globaux
  // ============================================================
  Meta.prestigePassive = function () {
    const d = App.state.data;
    return d.stars * PREST.layers[0].grant +
      d.crowns * PREST.layers[1].grant +
      d.diamonds * PREST.layers[2].grant +
      d.relics * PREST.layers[3].grant;
  };

  Meta.prestigeShopLevel = function (currency, id) {
    const d = App.state.data;
    return (d.prestige.shop[currency] && d.prestige.shop[currency][id]) || 0;
  };

  Meta.prestigeShopGlobal = function () {
    return Meta.prestigeShopLevel("stars", "global") * 0.1 +
      Meta.prestigeShopLevel("crowns", "global") * 0.25 +
      Meta.prestigeShopLevel("diamonds", "global") * 0.5 +
      Meta.prestigeShopLevel("relics", "global") * 1;
  };

  Meta.collectionBonus = function (type) {
    const d = App.state.data;
    const owned = d.collections.owned;
    let bonus = 0;
    if (type === "global") {
      const count = Object.keys(owned).length;
      bonus += count * COLL.itemBonus;
    }
    COLL.sets.forEach((set) => {
      const complete = set.items.every((it) => owned[it.id]);
      if (!complete) return;
      if (set.bonus && set.bonus[type]) bonus += set.bonus[type];
    });
    return bonus;
  };

  let achBonusCache = null;

  Meta.achievementBonus = function () {
    if (achBonusCache !== null) return achBonusCache;
    const d = App.state.data;
    let bonus = 0;
    Object.keys(d.achievements).forEach((id) => {
      const def = Meta.achievementById[id];
      if (def) bonus += def.reward.bonus;
    });
    achBonusCache = bonus;
    return bonus;
  };

  Meta.buffValue = function (key) {
    const now = Date.now();
    return App.state.data.buffs.reduce((sum, b) => {
      if (b.until <= now) return sum;
      return b.buff === key ? sum + b.value : sum;
    }, 0);
  };

  Meta.activeEventMult = function () {
    const e = App.state.data.events.active;
    if (!e || !e.until || e.until <= Date.now()) return 1;
    return 1 + (e.global || 0) / 100;
  };

  Meta.globalMult = function () {
    let mult = 1;
    mult += Meta.prestigePassive();
    mult += Meta.prestigeShopGlobal();
    mult += Meta.achievementBonus();
    mult += Meta.collectionBonus("global");
    mult += Meta.collectionBonus("tokens");
    mult += Meta.collectionBonus("tables");
    mult += (App.state.data.shopUpgrades.globalBoost || 0) * 0.05;
    mult += (App.state.data.synergies.permanent || 0) / 100;
    mult += Meta.buffValue("global") / 100;
    mult *= Meta.activeEventMult();
    return mult;
  };

  Meta.gameBonus = function (gameId) {
    if (gameId === "blackjack") return Meta.collectionBonus("blackjackWin") + Meta.buffValue("blackjackWin") / 100;
    if (gameId === "dice") return Meta.buffValue("diceWin") / 100;
    if (gameId === "horses") return Meta.collectionBonus("horseSpeed");
    if (gameId === "plinko") return Meta.buffValue("plinkoWin") / 100;
    return 0;
  };

  Meta.plinkoLuckBonus = function () {
    return Meta.prestigeShopLevel("stars", "plinkoLuck") * 2 +
      Meta.collectionBonus("plinkoLuck") * 100 +
      Meta.buffValue("plinkoLuck") +
      (App.state.data.shopUpgrades.plinkoLuck || 0) * 5 +
      Meta.prestigeShopLevel("crowns", "allLuck") * 5 +
      Meta.prestigeShopLevel("diamonds", "allLuck") * 5;
  };

  // ============================================================
  // Paris & récompenses
  // ============================================================
  Meta.bet = function (amount, gameId) {
    const d = App.state.data;
    if (amount <= 0 || !Meta.canAfford("tokens", amount)) return false;
    d.tokens -= amount;
    d.stats.totalBets += 1;
    d.stats.totalSpent += amount;
    if (amount > d.stats.biggestBet) d.stats.biggestBet = amount;
    if (d.games[gameId]) {
      d.games[gameId].stats.plays += 1;
    }
    Meta.addXp(BAL.meta.xp.perBet, { silent: true, source: gameId });
    App.bus.emit("currency:change", { key: "tokens", delta: -amount, value: d.tokens });
    App.bus.emit("bet", { game: gameId, amount });
    saveSoon();
    Meta.queueCheck();
    return true;
  };

  Meta.freeBet = function (gameId) {
    const d = App.state.data;
    d.stats.totalBets += 1;
    if (d.games[gameId]) d.games[gameId].stats.plays += 1;
    Meta.addXp(BAL.meta.xp.perBet, { silent: true, source: gameId });
    App.bus.emit("bet", { game: gameId, amount: 0, free: true });
    saveSoon();
    Meta.queueCheck();
  };

  Meta.xpFromMult = function (mult) {
    return Math.max(0, Math.round(Math.log2(Math.max(1, mult)) * BAL.meta.xp.multiplierBonusFactor));
  };

  Meta.credit = function (amount, gameId, opts) {
    opts = opts || {};
    if (!(amount > 0)) return 0;
    const d = App.state.data;
    const stake = opts.stake || 0;
    d.tokens += amount;
    d.totalEarned += amount;
    d.runEarned += amount;
    d.stats.totalEarned += amount;
    if (gameId && d.games[gameId]) {
      const gs = d.games[gameId].stats;
      gs.totalWon += amount;
      if (amount > gs.bestWin) gs.bestWin = amount;
      if (opts.countWin !== false && amount > stake) gs.wins += 1;
    }
    if (amount > d.stats.biggestWin) d.stats.biggestWin = amount;
    if (opts.countWin !== false && amount > stake) d.stats.totalWins += 1;
    if (opts.mult && opts.mult > d.stats.biggestMult) d.stats.biggestMult = opts.mult;
    if (opts.mult && gameId && d.games[gameId] && opts.mult > d.games[gameId].stats.bestMult) {
      d.games[gameId].stats.bestMult = opts.mult;
    }
    const xp = opts.xp === undefined ? Meta.xpFromMult(opts.mult || 1) : opts.xp;
    if (xp > 0) Meta.addXp(xp, { silent: true, source: gameId });
    App.bus.emit("currency:change", { key: "tokens", delta: amount, value: d.tokens });
    App.bus.emit("win", { game: gameId, amount, mult: opts.mult, profit: amount - stake });
    if (!opts.silent) {
      const profit = Math.max(0, amount - stake);
      if (opts.origin) {
        App.fx.floatAt(opts.origin, "+" + U.fmt(amount), { className: "win", color: "#ffc857" });
        if (profit > 0) App.fx.coinBurst(
          opts.origin.getBoundingClientRect().left + opts.origin.getBoundingClientRect().width / 2,
          opts.origin.getBoundingClientRect().top + opts.origin.getBoundingClientRect().height / 2,
          amount
        );
      }
      if (opts.mult >= 25 || amount >= stake * 20) {
        App.audio.play("bigwin");
      } else if (opts.mult >= 5 || amount >= stake * 5) {
        App.audio.play("win");
      } else {
        App.audio.play("coin");
      }
      if (amount >= 1000 || (opts.mult || 0) >= 25) {
        App.state.log("💰", "Gain — " + (gameId ? Meta.gameName(gameId) : "Bonus"), "+" + U.fmt(amount));
      }
    }
    saveSoon();
    Meta.queueCheck();
    return amount;
  };

  Meta.payout = function (baseAmount, gameId, opts) {
    opts = opts || {};
    if (baseAmount <= 0) return 0;
    const stake = opts.stake || 0;
    const profit = Math.max(0, baseAmount - stake);
    const mult = opts.global === false ? 1 : Meta.globalMult();
    const gameMult = opts.gameMult === undefined ? 1 + Meta.gameBonus(gameId) : opts.gameMult;
    const finalAmount = stake + profit * mult * gameMult;
    return Meta.credit(finalAmount, gameId, Object.assign({}, opts, { stake }));
  };

  Meta.refund = function (amount, gameId) {
    if (!(amount > 0)) return;
    const d = App.state.data;
    d.tokens += amount;
    App.bus.emit("currency:change", { key: "tokens", delta: amount, value: d.tokens });
    App.bus.emit("refund", { game: gameId, amount });
    saveSoon();
  };

  Meta.loss = function (gameId, opts) {
    const d = App.state.data;
    if (gameId && d.games[gameId]) d.games[gameId].stats.losses += 1;
    App.bus.emit("loss", { game: gameId });
    if (!opts || !opts.silent) saveSoon();
    Meta.queueCheck();
  };

  Meta.bonus = function (amount, opts) {
    opts = opts || {};
    if (!(amount > 0)) return;
    return Meta.credit(amount, null, Object.assign({ stake: 0, countWin: false, xp: opts.xp || 0 }, opts));
  };

  // ============================================================
  // Bourse de secours
  // ============================================================
  Meta.bailoutReady = function () {
    const d = App.state.data;
    return d.tokens < BAL.meta.bailout.threshold &&
      Date.now() - d.bailoutAt > BAL.meta.bailout.cooldownSeconds * 1000;
  };

  Meta.claimBailout = function () {
    const d = App.state.data;
    if (!Meta.bailoutReady()) return false;
    const amount = Math.max(BAL.meta.bailout.amount, d.level * 120);
    d.bailoutAt = Date.now();
    d.stats.bailouts += 1;
    Meta.bonus(amount, { silent: true });
    toast("Coffre de secours", "Voici " + U.fmt(amount) + " jetons pour repartir.", "🆘", "gold");
    App.audio.play("chest");
    App.fx.confetti(40);
    App.state.log("🆘", "Coffre de secours", "+" + U.fmt(amount));
    saveSoon();
    return amount;
  };

  // ============================================================
  // SUCCÈS
  // ============================================================
  Meta.achievements = [];
  Meta.achievementById = {};
  Meta.categoryLabels = {
    parties: { name: "Parties", icon: "🎮" },
    gains: { name: "Gains", icon: "💰" },
    multiplicateurs: { name: "Multiplicateurs", icon: "✨" },
    niveaux: { name: "Niveaux", icon: "📈" },
    prestige: { name: "Prestige", icon: "⭐" },
    quetes: { name: "Quêtes", icon: "📜" },
    synergies: { name: "Synergies", icon: "🔗" },
    series: { name: "Séries", icon: "🔥" },
    collections: { name: "Collections", icon: "🎴" },
    temps: { name: "Temps de jeu", icon: "⏳" },
    evenements: { name: "Événements", icon: "🎉" },
    secrets: { name: "Secrets", icon: "🗝️" },
    mises: { name: "Mises", icon: "🎫" }
  };

  function tierOf(index) {
    return ["bronze", "silver", "gold", "mythic"][Math.min(3, index)] || "bronze";
  }

  function addAch(def) {
    const tier = def.tier || "bronze";
    const reward = ACH.rewards[tier] || ACH.rewards.bronze;
    def.reward = { gems: reward.gems, bonus: reward.bonus };
    if (!def.icon) def.icon = "🏆";
    def.tier = tier;
    if (!def.progress) def.progress = () => 0;
    Meta.achievements.push(def);
    Meta.achievementById[def.id] = def;
  }

  Meta.buildAchievements = function () {
    Meta.achievements = [];
    Meta.achievementById = {};

    const playWord = ["Premiers pas", "Habitué", "Vétéran", "Légende"];
    const winWord = ["Première victoire", "Sérieux", "Machine à gagner", "Invincible"];
    const gainWord = ["Petit pactole", "Gros coup", "Fortune", "Banque centrale"];
    const playThresholds = ACH.playThresholds;
    const winThresholds = ACH.winThresholds;
    const gainThresholds = ACH.winAmountThresholds;

    GAME_IDS.forEach((gameId) => {
      const gm = Meta.gameMeta(gameId);
      const gs = () => App.state.data.games[gameId].stats;
      playThresholds.forEach((n, i) => {
        addAch({
          id: `plays_${gameId}_${n}`,
          name: `${playWord[i]} · ${gm.name}`,
          desc: `Jouer ${U.fmt(n)} parties à ${gm.name}.`,
          icon: gm.icon,
          category: "parties",
          tier: tierOf(i),
          target: n,
          progress: () => gs().plays
        });
      });
      winThresholds.forEach((n, i) => {
        addAch({
          id: `wins_${gameId}_${n}`,
          name: `${winWord[i]} · ${gm.name}`,
          desc: `Gagner ${U.fmt(n)} parties à ${gm.name}.`,
          icon: gm.icon,
          category: "gains",
          tier: tierOf(i),
          target: n,
          progress: () => gs().wins
        });
      });
      gainThresholds.forEach((n, i) => {
        addAch({
          id: `best_${gameId}_${n}`,
          name: `${gainWord[i]} · ${gm.name}`,
          desc: `Gagner ${U.fmt(n)} jetons en une seule fois à ${gm.name}.`,
          icon: gm.icon,
          category: "gains",
          tier: tierOf(i),
          target: n,
          progress: () => gs().bestWin
        });
      });
    });

    ACH.earnThresholds.forEach((n, i) => {
      addAch({
        id: `total_earned_${n}`,
        name: "Fortune cumulée " + U.fmt(n),
        desc: `Gagner ${U.fmt(n)} jetons au total.`,
        icon: "💎",
        category: "gains",
        tier: tierOf(Math.min(3, Math.floor(i / 2))),
        target: n,
        progress: () => App.state.data.totalEarned
      });
    });

    ACH.multThresholds.forEach((n, i) => {
      addAch({
        id: `mult_${n}`,
        name: "Multiplicateur ×" + U.fmt(n),
        desc: `Atteindre un multiplicateur de ×${U.fmt(n)}.`,
        icon: "✨",
        category: "multiplicateurs",
        tier: tierOf(Math.min(3, Math.floor(i * 0.6))),
        target: n,
        progress: () => App.state.data.stats.biggestMult
      });
    });

    ACH.levelThresholds.forEach((n, i) => {
      addAch({
        id: `level_${n}`,
        name: "Niveau " + n,
        desc: `Atteindre le niveau ${n}.`,
        icon: "📈",
        category: "niveaux",
        tier: tierOf(Math.min(3, Math.floor(i / 2))),
        target: n,
        progress: () => App.state.data.maxLevel
      });
    });

    ACH.prestigeCounts.forEach((n, i) => {
      addAch({
        id: `rebirths_${n}`,
        name: "Renaissance " + n,
        desc: `Effectuer ${n} rebirths, toutes couches confondues.`,
        icon: "⭐",
        category: "prestige",
        tier: tierOf(i),
        target: n,
        progress: () => {
          const r = App.state.data.rebirths;
          return r.r1 + r.r2 + r.r3 + r.r4;
        }
      });
    });

    [
      ["r1", "Première étoile", "Effectuer votre premier Rebirth.", "⭐"],
      ["r2", "Première couronne", "Effectuer votre premier Rebirth de couche 2.", "👑"],
      ["r3", "Premier diamant", "Effectuer votre premier Rebirth de couche 3.", "💠"],
      ["r4", "Première relique", "Atteindre la couche de prestige infinie.", "🔮"]
    ].forEach(([key, name, desc, icon], i) => {
      addAch({
        id: "layer_" + key,
        name,
        desc,
        icon,
        category: "prestige",
        tier: tierOf(i + 2),
        target: 1,
        progress: () => App.state.data.rebirths[key]
      });
    });

    ACH.questCounts.forEach((n, i) => {
      addAch({
        id: `quests_${n}`,
        name: "Chasseur de quêtes " + U.fmt(n),
        desc: `Réclamer ${n} récompenses de quête.`,
        icon: "📜",
        category: "quetes",
        tier: tierOf(i),
        target: n,
        progress: () => App.state.data.stats.questsClaimed
      });
    });

    ACH.synergyCounts.forEach((n, i) => {
      addAch({
        id: `synergies_${n}`,
        name: "Synergie " + U.fmt(n),
        desc: `Découvrir ${n} synergies entre jeux.`,
        icon: "🔗",
        category: "synergies",
        tier: tierOf(i),
        target: n,
        progress: () => Object.keys(App.state.data.synergies.unlocked).length
      });
    });

    [
      ["blackjack", "blackjack", "Blackjack"],
      ["dice", "dice", "Dés"],
      ["horses", "horses", "Courses"]
    ].forEach(([gameId, statKey, label]) => {
      ACH.streakThresholds.forEach((n, i) => {
        addAch({
          id: `streak_${statKey}_${n}`,
          name: `Série de ${n} · ${label}`,
          desc: `Atteindre ${n} victoires consécutives (${label}).`,
          icon: gameId === "blackjack" ? "🃏" : gameId === "dice" ? "🎲" : "🐎",
          category: "series",
          tier: tierOf(i),
          target: n,
          progress: () => App.state.data.games[gameId].stats.bestStreak
        });
      });
    });

    const ownedCount = () => Object.keys(App.state.data.collections.owned).length;
    const totalItems = COLL.sets.reduce((s, set) => s + set.items.length, 0);
    [5, 15, 30, 45, totalItems].forEach((n, i) => {
      addAch({
        id: `collection_items_${n}`,
        name: "Collectionneur · " + n + " pièces",
        desc: `Posséder ${n} objets de collection.`,
        icon: "🎴",
        category: "collections",
        tier: tierOf(Math.min(3, i - 1)),
        target: n,
        progress: ownedCount
      });
    });
    COLL.sets.forEach((set, i) => {
      addAch({
        id: `collection_set_${set.id}`,
        name: "Collection complète · " + set.name,
        desc: `Compléter la collection ${set.name}.`,
        icon: set.icon,
        category: "collections",
        tier: tierOf(Math.min(3, Math.floor(i / 2))),
        target: set.items.length,
        progress: () => set.items.filter((it) => App.state.data.collections.owned[it.id]).length
      });
    });

    ACH.timeThresholdsHours.forEach((h, i) => {
      addAch({
        id: `time_${h}h`,
        name: "Marathon de " + h + " h",
        desc: `Jouer pendant ${h} heures.`,
        icon: "⏳",
        category: "temps",
        tier: tierOf(i),
        target: h * 3600000,
        progress: () => App.state.data.stats.playTimeMs
      });
    });

    [1, 10, 50].forEach((n, i) => {
      addAch({
        id: `events_${n}`,
        name: "Fêtard " + n,
        desc: `Voir ${n} événements du casino.`,
        icon: "🎉",
        category: "evenements",
        tier: tierOf(i),
        target: n,
        progress: () => App.state.data.stats.eventsSeen
      });
    });

    [1, 10].forEach((n, i) => {
      addAch({
        id: `vault_${n}`,
        name: "Gardien des coffres " + n,
        desc: `Ouvrir ${n} coffres dans la salle secrète.`,
        icon: "🗝️",
        category: "secrets",
        tier: tierOf(i + 2),
        target: n,
        progress: () => App.state.data.games.vault.stats.wins
      });
    });

    ACH.betThresholds.forEach((n, i) => {
      addAch({
        id: `bigbet_${n}`,
        name: "Grosse mise " + U.fmt(n),
        desc: `Miser ${U.fmt(n)} jetons sur une seule mise.`,
        icon: "🎫",
        category: "mises",
        tier: tierOf(i),
        target: n,
        progress: () => App.state.data.stats.biggestBet
      });
    });

    [100, 1000, 10000, 100000].forEach((n, i) => {
      addAch({
        id: `total_bets_${n}`,
        name: "Parieur " + U.fmt(n),
        desc: `Jouer ${U.fmt(n)} parties.`,
        icon: "🎯",
        category: "parties",
        tier: tierOf(i),
        target: n,
        progress: () => App.state.data.stats.totalBets
      });
      addAch({
        id: `total_wins_${n}`,
        name: "Gagnant " + U.fmt(n),
        desc: `Gagner ${U.fmt(n)} parties.`,
        icon: "🏅",
        category: "gains",
        tier: tierOf(i),
        target: n,
        progress: () => App.state.data.stats.totalWins
      });
    });

    [3, 5, 7, 10].forEach((n, i) => {
      addAch({
        id: `games_${n}`,
        name: "Touche-à-tout " + n,
        desc: `Débloquer ${n} jeux.`,
        icon: "🌐",
        category: "secrets",
        tier: tierOf(i),
        target: n,
        progress: () => GAME_IDS.filter((id) => Meta.isGameUnlocked(id)).length
      });
    });

    [10, 50, 100, 150, 200].forEach((n, i) => {
      addAch({
        id: `ach_${n}`,
        name: "Succès " + n,
        desc: `Débloquer ${n} succès.`,
        icon: "🏆",
        category: "secrets",
        tier: tierOf(Math.min(3, Math.floor(i / 2))),
        target: n,
        progress: () => Object.keys(App.state.data.achievements).length
      });
    });

    achBonusCache = null;
  };

  Meta.checkAchievements = function (silent) {
    if (!Meta.achievements.length) return [];
    const d = App.state.data;
    const unlocked = [];
    for (const def of Meta.achievements) {
      if (d.achievements[def.id]) continue;
      let prog = 0;
      try { prog = def.progress(); } catch (_) { prog = 0; }
      if (prog >= def.target) {
        d.achievements[def.id] = { at: Date.now(), tier: def.tier };
        d.stats.achievementsUnlocked = Object.keys(d.achievements).length;
        Meta.grant("gems", def.reward.gems, { silent: true });
        unlocked.push(def);
      }
    }
    if (unlocked.length) {
      achBonusCache = null;
      const totalGems = unlocked.reduce((s, def) => s + def.reward.gems, 0);
      if (!silent) {
        if (unlocked.length <= 3) {
          unlocked.forEach((def, i) => {
            setTimeout(() => {
              App.audio.play("unlock");
              toast("Succès débloqué", def.name + " · +" + def.reward.gems + " gemmes", "🏆", "gold");
            }, i * 450);
          });
        } else {
          toast(unlocked.length + " succès débloqués", "+" + totalGems + " gemmes au total.", "🏆", "gold");
        }
        App.fx.starBurst(window.innerWidth - 100, 110, 16);
        App.state.log("🏆", unlocked.length + " succès débloqué" + (unlocked.length > 1 ? "s" : ""), "+" + totalGems + " gemmes");
      }
      App.bus.emit("achievement:unlock", unlocked);
      App.bus.emit("currency:change", { key: "gems", value: d.gems });
      Meta.saveSoon();
    }
    return unlocked;
  };

  Meta.queueCheck = function () {
    if (Meta._checkTimer) return;
    Meta._checkTimer = setTimeout(() => {
      Meta._checkTimer = null;
      Meta.checkAchievements(false);
    }, 500);
  };

  // ============================================================
  // QUÊTES
  // ============================================================
  Meta.statValue = function (stat) {
    const d = App.state.data;
    if (!stat) return 0;
    if (stat === "biggestMult") return d.stats.biggestMult;
    const v = U.getPath(d, stat);
    return typeof v === "number" ? v : 0;
  };

  Meta.questTarget = function (template, weekly) {
    const d = App.state.data;
    let target;
    if (template.id === "mult") {
      const base = template.base + template.perLevel * Math.max(1, d.level);
      target = Math.max(base, d.stats.biggestMult * 1.3);
      target = Math.ceil(target * 2) / 2;
    } else if (template.growth) {
      target = Math.ceil(template.base * Math.pow(template.growth, Math.max(0, d.level - 1)));
      const current = Meta.statValue(template.stat);
      target = Math.max(target, Math.floor(current * 0.03) + template.base);
    } else {
      target = Math.ceil(template.base + template.perLevel * Math.max(0, d.level - 1));
    }
    if (weekly) target = Math.ceil(target * 3.2);
    if (template.id === "mult") target = Math.round(target * 10) / 10;
    else target = Math.ceil(target);
    return target;
  };

  Meta.generateQuest = function (template, weekly, now) {
    const target = Meta.questTarget(template, weekly);
    const absolute = !!template.absolute;
    const baseline = absolute ? 0 : Meta.statValue(template.stat);
    const baseTokens = 120 * Math.pow(1.32, Math.max(0, App.state.data.level - 1));
    let tokens = Math.floor(baseTokens * template.rewardMult);
    if (template.id === "earn") tokens = Math.floor(Math.max(target * 0.6, baseTokens * template.rewardMult));
    let gems = template.rewardGems || 1;
    if (weekly) { gems *= 3; tokens *= 4; }
    return {
      id: U.uid("q"),
      templateId: template.id,
      label: template.label,
      icon: template.icon,
      stat: template.stat,
      target,
      baseline,
      absolute,
      tokens,
      gems,
      weekly: !!weekly,
      createdAt: now,
      claimed: false
    };
  };

  Meta.ensureQuests = function (force) {
    const d = App.state.data;
    const now = Date.now();
    const day = 24 * 3600 * 1000;
    const week = 7 * day;
    if (force || !d.quests.dailyAt || now - d.quests.dailyAt >= day || !d.quests.daily || d.quests.daily.length !== QUEST.dailyCount) {
      d.quests.dailyAt = now;
      const pool = U.shuffle(QUEST.templates);
      d.quests.daily = pool.slice(0, QUEST.dailyCount).map((tpl) => Meta.generateQuest(tpl, false, now));
    }
    if (force || !d.quests.weeklyAt || now - d.quests.weeklyAt >= week || !d.quests.weekly) {
      d.quests.weeklyAt = now;
      const tpl = U.pick(QUEST.templates);
      d.quests.weekly = Meta.generateQuest(tpl, true, now);
    }
  };

  Meta.questProgress = function (quest) {
    if (!quest) return 0;
    const current = Meta.statValue(quest.stat);
    if (quest.absolute) return Math.min(current, quest.target);
    return U.clamp(current - quest.baseline, 0, quest.target);
  };

  Meta.questComplete = function (quest) {
    return Meta.questProgress(quest) >= quest.target;
  };

  Meta.claimQuest = function (questId) {
    const d = App.state.data;
    const quest = (d.quests.daily || []).find((q) => q.id === questId) || (d.quests.weekly && d.quests.weekly.id === questId ? d.quests.weekly : null);
    if (!quest || quest.claimed || !Meta.questComplete(quest)) return false;
    quest.claimed = true;
    d.stats.questsClaimed += 1;
    Meta.bonus(quest.tokens, { silent: true });
    Meta.grant("gems", quest.gems, { silent: true });
    App.audio.play("chest");
    App.fx.starBurst(window.innerWidth / 2, window.innerHeight / 2, 18);
    App.fx.confetti(40);
    toast("Quête terminée", "+" + U.fmt(quest.tokens) + " jetons · +" + quest.gems + " gemmes", "📜", "gold");
    App.state.log("📜", "Quête réclamée", "+" + U.fmt(quest.tokens));
    App.bus.emit("quest:claim", quest);
    Meta.checkAchievements();
    Meta.saveSoon();
    return true;
  };

  Meta.nextDailyReset = function () {
    return (App.state.data.quests.dailyAt || Date.now()) + 24 * 3600 * 1000;
  };

  // ============================================================
  // COLLECTIONS
  // ============================================================
  const ITEM_INDEX = {};
  COLL.sets.forEach((set) => {
    set.items.forEach((item) => {
      ITEM_INDEX[item.id] = Object.assign({ setId: set.id, setName: set.name, setIcon: set.icon }, item);
    });
  });
  Meta.COLLECTION_SETS = COLL.sets;
  Meta.COLLECTION_ITEM = ITEM_INDEX;

  Meta.collectionTotal = function () {
    return Object.keys(ITEM_INDEX).length;
  };

  Meta.collectionOwnedCount = function () {
    return Object.keys(App.state.data.collections.owned).length;
  };

  Meta.setProgress = function (set) {
    return set.items.filter((it) => App.state.data.collections.owned[it.id]).length;
  };

  Meta.collectionCompleteCount = function () {
    return COLL.sets.filter((set) => Meta.setProgress(set) === set.items.length).length;
  };

  Meta.rarityOf = function (item) {
    return item.rarity || "common";
  };

  Meta.randomCollectionItem = function (avoidDuplicates) {
    let pool = Object.values(ITEM_INDEX);
    if (avoidDuplicates) {
      const unowned = pool.filter((it) => !App.state.data.collections.owned[it.id]);
      if (unowned.length) pool = unowned;
    }
    const weighted = pool.map((item) => ({
      item,
      weight: COLL.rarityWeights[Meta.rarityOf(item)] || 10
    }));
    return U.weightedPick(weighted, "weight").item;
  };

  Meta.grantCollectionItem = function (itemId, opts) {
    opts = opts || {};
    const d = App.state.data;
    const item = itemId ? ITEM_INDEX[itemId] : Meta.randomCollectionItem(opts.avoidDuplicates);
    if (!item) return null;
    if (d.collections.owned[item.id]) {
      const gems = COLL.duplicateGems[Meta.rarityOf(item)] || 2;
      Meta.grant("gems", gems, { silent: true });
      if (!opts.silent) {
        toast("Doublon converti", item.name + " · +" + gems + " gemmes", "💎", "gem");
      }
      return { item, duplicate: true, gems };
    }
    d.collections.owned[item.id] = true;
    const total = Meta.collectionOwnedCount();
    if (!opts.silent) {
      App.audio.play(Meta.rarityOf(item) === "mythic" || Meta.rarityOf(item) === "legendary" ? "jackpot" : "gem");
      toast("Nouvel objet : " + item.name, "Collection " + item.setName + " · " + Meta.rarityOf(item), item.setIcon || "🎴", Meta.rarityOf(item) === "legendary" || Meta.rarityOf(item) === "mythic" ? "gold" : "gem");
      if (Meta.rarityOf(item) === "epic" || Meta.rarityOf(item) === "legendary" || Meta.rarityOf(item) === "mythic") {
        App.fx.starBurst(window.innerWidth / 2, window.innerHeight / 2, 18);
      }
      App.state.log(item.setIcon || "🎴", "Collection : " + item.name, Meta.rarityOf(item));
    }
    const set = COLL.sets.find((s) => s.id === item.setId);
    if (set && Meta.setProgress(set) === set.items.length) {
      const bonusGems = 15;
      Meta.grant("gems", bonusGems, { silent: true });
      if (!opts.silent) {
        toast("Collection complète : " + set.name, set.bonus.label + " · +" + bonusGems + " gemmes", "🏆", "gold");
        App.audio.play("jackpot");
        App.fx.confetti(70);
        App.state.log("🏆", "Collection complète", set.name);
      }
    }
    if (!opts.noSave) {
      Meta.checkAchievements();
      Meta.saveSoon();
    }
    App.bus.emit("collection:unlock", { item, total });
    return { item, duplicate: false };
  };

  Meta.openPack = function (count) {
    const d = App.state.data;
    const cost = count >= 10 ? COLL.packCost10 : COLL.packCost;
    if (!Meta.canAfford("gems", cost)) return null;
    Meta.spend("gems", cost);
    d.collections.packsOpened += count;
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(Meta.grantCollectionItem(null, { silent: true, avoidDuplicates: true, noSave: true }));
    }
    Meta.checkAchievements();
    Meta.saveSoon();
    App.audio.play("gem");
    App.bus.emit("collection:pack", { results });
    return results;
  };

  Meta.equipCollection = function (setId, itemId) {
    const d = App.state.data;
    if (!d.collections.owned[itemId]) return false;
    const item = ITEM_INDEX[itemId];
    if (!item || item.setId !== setId) return false;
    if (setId !== "balls" && setId !== "cards") return false;
    d.collections.equipped[setId] = itemId;
    Meta.saveSoon();
    App.bus.emit("collection:equip", { setId, itemId });
    return true;
  };

  Meta.equippedItem = function (setId) {
    const id = App.state.data.collections.equipped[setId];
    return id ? ITEM_INDEX[id] : null;
  };

  // ============================================================
  // SYNERGIES
  // ============================================================
  Meta.SYNERGIES = SYNERGY;

  Meta.synergyById = function (id) {
    return SYNERGY.find((s) => s.id === id);
  };

  Meta.checkAllGamesSynergy = function (silent) {
    const all = GAME_IDS.every((id) => Meta.isGameUnlocked(id));
    if (all && Meta.isGameUnlocked("vault") !== undefined) {
      Meta.triggerSynergy("all_games_unlocked", { silent });
    }
  };

  Meta.triggerSynergy = function (event, payload) {
    payload = payload || {};
    const defs = SYNERGY.filter((s) => s.event === event);
    if (!defs.length) return [];
    const d = App.state.data;
    const applied = [];
    defs.forEach((def) => {
      const already = !!d.synergies.unlocked[def.id];
      if (already && Date.now() - (d.synergies.lastTrigger[def.id] || 0) < 45000) return;
      const effect = def.effect || {};
      if (already && effect.type !== "buff") return;
      d.synergies.lastTrigger[def.id] = Date.now();
      if (!already) {
        d.synergies.unlocked[def.id] = Date.now();
        d.stats.synergiesUnlocked = Object.keys(d.synergies.unlocked).length;
        if (!payload.silent) {
          toast("Synergie découverte : " + def.name, def.desc, def.icon, "gold");
          App.audio.play("unlock");
          App.fx.confetti(60);
          App.state.log(def.icon, "Synergie : " + def.name, "");
        }
        App.bus.emit("synergy:unlock", def);
      }
      if (effect.type === "buff") {
        Meta.addBuff(effect.buff, effect.value, effect.duration, effect.label || def.name, def.icon);
      } else if (effect.type === "permanent") {
        d.synergies.permanent = (d.synergies.permanent || 0) + effect.value;
      } else if (effect.type === "radar") {
        d.charges.radar = (d.charges.radar || 0) + (effect.amount || 1);
      } else if (effect.type === "crashSafety") {
        d.charges.crashSafety = (d.charges.crashSafety || 0) + (effect.amount || 1);
      } else if (effect.type === "goldenCard") {
        d.charges.goldenCard = (d.charges.goldenCard || 0) + (effect.amount || 1);
      } else if (effect.type === "rainbow") {
        d.charges.rainbow = (d.charges.rainbow || 0) + (effect.amount || 1);
      }
      if (effect.gems) Meta.grant("gems", effect.gems, { silent: true });
      if (effect.goldBalls) Meta.grant("goldBalls", effect.goldBalls, { silent: true });
      if (effect.tokens) Meta.bonus(effect.tokens, { silent: true });
      if (!payload.silent && !already) {
        App.bus.emit("currency:change", { key: "gems", value: d.gems });
      }
      applied.push(def);
    });
    if (applied.length) {
      Meta.saveSoon();
      Meta.checkAchievements();
      App.bus.emit("synergy:trigger", applied);
    }
    return applied;
  };

  Meta.addBuff = function (buff, value, duration, label, icon) {
    const d = App.state.data;
    const now = Date.now();
    d.buffs = d.buffs.filter((b) => b.until > now && !(b.buff === buff && b.label === label));
    d.buffs.push({
      buff,
      value,
      label: label || buff,
      icon: icon || "✨",
      until: now + duration
    });
    while (d.buffs.length > BAL.meta.buffs.maxActive) d.buffs.shift();
    App.bus.emit("buff:change");
    saveSoon();
  };

  Meta.cleanupBuffs = function () {
    const d = App.state.data;
    const now = Date.now();
    const before = d.buffs.length;
    d.buffs = d.buffs.filter((b) => b.until > now);
    if (d.buffs.length !== before) {
      App.bus.emit("buff:change");
      Meta.saveSoon();
    }
  };

  Meta.activeBuffs = function () {
    const now = Date.now();
    return App.state.data.buffs.filter((b) => b.until > now);
  };

  // ============================================================
  // PRESTIGE
  // ============================================================
  Meta.PRESTIGE_LAYERS = PREST.layers;

  Meta.layerCurrency = function (index) {
    return PREST.layers[index] ? PREST.layers[index].currency : "stars";
  };

  Meta.rebirthGain = function (index) {
    const d = App.state.data;
    const layer = PREST.layers[index];
    if (!layer) return { amount: 0, can: false, req: 99999, currency: "stars" };
    const req = layer.level;
    let amount = 0;
    if (index === 0) {
      const base = Math.floor(Math.sqrt(Math.max(0, d.runEarned) / BAL.meta.rebirth.divisor));
      amount = Math.max(1, base + Math.floor(d.level / 20));
    } else if (index === 1) {
      amount = Math.max(1, Math.floor(d.stars / 5) + Math.floor(d.level / 75));
    } else if (index === 2) {
      amount = Math.max(1, Math.floor(d.crowns / 4) + Math.floor(d.level / 250));
    } else {
      amount = Math.max(1, Math.floor(d.diamonds / 3) + Math.floor(d.level / 500));
    }
    const canLevel = d.level >= req;
    const canCurrency = index === 0 || (index === 1 ? d.stars > 0 : index === 2 ? d.crowns > 0 : d.diamonds > 0);
    return {
      index,
      currency: layer.currency,
      icon: layer.icon,
      name: layer.name,
      amount,
      req,
      canLevel,
      canCurrency,
      can: canLevel && canCurrency,
      progress: U.clamp(d.level / req, 0, 1)
    };
  };

  Meta.startingTokens = function () {
    return BAL.meta.startingTokens + Meta.prestigeShopLevel("stars", "startTokens") * 10000;
  };

  Meta.startingLevel = function () {
    return 1 + Meta.prestigeShopLevel("crowns", "startLevel") * 5 + Meta.prestigeShopLevel("diamonds", "startLevel") * 10;
  };

  Meta.doRebirth = function (index) {
    const d = App.state.data;
    const gain = Meta.rebirthGain(index);
    if (!gain.can) return false;
    const layer = PREST.layers[index];
    // Ajouter la monnaie
    d[layer.currency] = (d[layer.currency] || 0) + gain.amount;
    d.prestige["total" + layer.currency.charAt(0).toUpperCase() + layer.currency.slice(1) + "Earned"] =
      (d.prestige["total" + layer.currency.charAt(0).toUpperCase() + layer.currency.slice(1) + "Earned"] || 0) + gain.amount;
    // Consommer la monnaie inférieure
    if (index === 1) d.stars = 0;
    if (index === 2) d.crowns = 0;
    if (index === 3) d.diamonds = 0;
    d.rebirths["r" + (index + 1)] += 1;
    d.highestRebirth = Math.max(d.highestRebirth, index + 1);

    // Reset de la run
    GAME_IDS.concat(["vault"]).forEach((id) => {
      const game = d.games[id];
      if (!game) return;
      if (game.upgrades) {
        Object.keys(game.upgrades).forEach((k) => { game.upgrades[k] = 0; });
      }
      if (game.betIndex !== undefined) game.betIndex = 0;
      if (game.autoOn !== undefined) game.autoOn = false;
      if (game.autoSpins !== undefined) game.autoSpins = 0;
      if (game.freeSpinsLeft !== undefined) game.freeSpinsLeft = 0;
      if (game.streak !== undefined) game.streak = 0;
      if (game.winsTowardBoss !== undefined) game.winsTowardBoss = 0;
      if (game.radarCharges !== undefined) game.radarCharges = 0;
      if (game.shields !== undefined) game.shields = 0;
      if (game.safetyCharges !== undefined) game.safetyCharges = 0;
      if (game.luckyReady !== undefined) game.luckyReady = 0;
    });
    d.tokens = Meta.startingTokens();
    d.level = Meta.startingLevel();
    d.xp = 0;
    d.maxLevel = Math.max(d.maxLevel, d.level);
    d.runEarned = 0;
    d.buffs = [];
    d.events.active = null;
    d.charges.crashSafety = 0;
    d.charges.goldenCard = 0;
    d.charges.rainbow = 0;
    d.charges.freePlinko = 0;
    d.stats.playTimeMs = d.stats.playTimeMs || 0;
    Meta.refreshUnlocks(true);
    Meta.ensureQuests(false);
    Meta.checkAchievements(true);
    App.bus.emit("rebirth:done", { index, gain });
    App.bus.emit("currency:change", { key: layer.currency, value: d[layer.currency] });
    App.state.log(layer.icon, "Rebirth " + (index + 1), "+" + gain.amount + " " + layer.name);
    App.audio.play("jackpot");
    App.fx.jackpot();
    Meta.saveSoon();
    return gain;
  };

  Meta.prestigeShopCost = function (currency, id) {
    const layer = PREST.layers.find((l) => l.currency === currency);
    if (!layer) return 0;
    const item = layer.shop.find((s) => s.id === id);
    if (!item) return 0;
    const level = Meta.prestigeShopLevel(currency, id);
    return Math.ceil(item.base + (item.growth || 0) * level);
  };

  Meta.buyPrestigeUpgrade = function (currency, id) {
    const d = App.state.data;
    const layer = PREST.layers.find((l) => l.currency === currency);
    if (!layer) return false;
    const item = layer.shop.find((s) => s.id === id);
    if (!item) return false;
    const level = Meta.prestigeShopLevel(currency, id);
    if (level >= item.max) return false;
    const cost = Meta.prestigeShopCost(currency, id);
    if (!Meta.canAfford(currency, cost)) return false;
    d[currency] -= cost;
    if (!d.prestige.shop[currency]) d.prestige.shop[currency] = {};
    d.prestige.shop[currency][id] = level + 1;
    App.bus.emit("currency:change", { key: currency, value: d[currency] });
    toast("Amélioration de prestige", item.name + " · niveau " + (level + 1), item.icon || "⭐", "gold");
    App.audio.play("purchase");
    App.fx.starBurst(window.innerWidth / 2, window.innerHeight / 2, 12);
    Meta.saveSoon();
    return true;
  };

  Meta.prestigeUpgradeUnlocked = function (currency, id) {
    const level = Meta.prestigeShopLevel(currency, id);
    if (level <= 0) return false;
    if (id === "manager" || id === "automation") return true;
    return true;
  };

  // ============================================================
  // BOUTIQUE DE GEMMES
  // ============================================================
  Meta.gemShopLevel = function (id) {
    const d = App.state.data;
    if (id === "plinkoLuck" || id === "xpBoost" || id === "globalBoost") {
      return (d.shopUpgrades && d.shopUpgrades[id]) || 0;
    }
    return 0;
  };

  Meta.buyGemShop = function (id) {
    const shop = BAL.gemShop || {};
    const item = shop[id];
    if (!item) return false;
    const d = App.state.data;
    const level = Meta.gemShopLevel(id);
    if (item.max && level >= item.max) return false;
    if (!Meta.canAfford("gems", item.cost)) {
      App.audio.play("error");
      toast("Gemmes insuffisantes", "Il vous manque des gemmes pour cet achat.", "💎", "danger");
      return false;
    }
    Meta.spend("gems", item.cost);
    if (id === "goldBalls") {
      Meta.grant("goldBalls", item.amount, { silent: true });
      toast("Billes d'or achetées", "+" + item.amount + " billes d'or", "🟡", "gold");
    } else if (id === "tokenChest") {
      const amount = Math.floor(item.base * Math.pow(item.growth, Math.max(0, d.level - 1)));
      Meta.bonus(amount, { silent: true });
      toast("Coffre de jetons", "+" + U.fmt(amount) + " jetons", "🪙", "gold");
      App.fx.coinBurst(window.innerWidth / 2, window.innerHeight / 2, amount);
    } else {
      d.shopUpgrades[id] = level + 1;
      toast("Amélioration permanente", item.name + " · niveau " + (level + 1), item.icon, "gem");
      App.fx.starBurst(window.innerWidth / 2, window.innerHeight / 2, 14);
    }
    App.audio.play("purchase");
    App.bus.emit("currency:change", { key: "gems", value: d.gems });
    Meta.saveSoon();
    return true;
  };

  // ============================================================
  // HORS-LIGNE
  // ============================================================
  Meta.offlineCapHours = function () {
    return Math.min(BAL.meta.offline.maxCapHours, BAL.meta.offline.baseCapHours + Meta.prestigeShopLevel("stars", "offline") * 2);
  };

  Meta.estimateRatePerHour = function () {
    const d = App.state.data;
    const hours = d.stats.playTimeMs / 3600000;
    let rate = 0;
    if (hours > 0.15 && d.totalEarned > 0) {
      rate = d.totalEarned / hours;
    }
    const fallback = (150 + d.level * 90) * Math.pow(1.1, Math.min(100, d.maxLevel / 10));
    rate = Math.max(fallback, rate * 0.7);
    return Math.min(rate, 5e9);
  };

  Meta.offlineGains = function () {
    const d = App.state.data;
    const elapsed = App.state.offlineElapsed || 0;
    if (elapsed < BAL.meta.offline.minSeconds * 1000) return null;
    const capMs = Meta.offlineCapHours() * 3600000;
    const effective = Math.min(elapsed, capMs);
    const rate = Meta.estimateRatePerHour();
    let tokens = Math.floor((effective / 3600000) * rate * BAL.meta.offline.efficiency * Meta.globalMult());
    tokens = Math.max(0, tokens);
    return {
      elapsed,
      capped: elapsed > capMs,
      hours: effective / 3600000,
      capHours: Meta.offlineCapHours(),
      tokens
    };
  };

  Meta.claimOffline = function (gain) {
    if (!gain || !gain.tokens) return;
    Meta.bonus(gain.tokens, { silent: true });
    App.audio.play("chest");
    App.fx.coinBurst(window.innerWidth / 2, window.innerHeight * 0.45, gain.tokens);
    App.state.log("🌙", "Gains hors-ligne", "+" + U.fmt(gain.tokens));
    Meta.saveSoon();
  };

  // ============================================================
  // ÉVÉNEMENTS ALÉATOIRES
  // ============================================================
  Meta.scheduleNextEvent = function () {
    const d = App.state.data;
    const range = BAL.meta.buffs.goldenHourEveryMs;
    d.events.nextAt = Date.now() + U.randInt(range[0], range[1]);
  };

  Meta.checkEvents = function () {
    const d = App.state.data;
    if (!d.events.nextAt) Meta.scheduleNextEvent();
    if (d.events.nextAt && Date.now() >= d.events.nextAt && (!App.ui || !App.ui.currentModal)) {
      Meta.startRandomEvent();
    }
    const active = d.events.active;
    if (active && active.until && active.until <= Date.now()) {
      d.events.active = null;
      App.bus.emit("event:end", active);
      if (App.ui) toast("Événement terminé", active.name, active.icon || "🎉", "");
      Meta.saveSoon();
    }
    if (App.ui && App.ui.updateEventBanner) App.ui.updateEventBanner();
  };

  Meta.startRandomEvent = function () {
    const d = App.state.data;
    const def = U.weightedPick(EVENTS.events, "weight");
    Meta.scheduleNextEvent();
    d.stats.eventsSeen += 1;
    if (def.choice) {
      App.bus.emit("event:mystery", def);
      d.events.active = { id: def.id, name: def.name, icon: def.icon, desc: def.desc, until: Date.now() + 30000, global: 0 };
      if (App.ui) App.ui.mysteryModal(def);
      return def;
    }
    if (def.global) {
      d.events.active = {
        id: def.id,
        name: def.name,
        icon: def.icon,
        desc: def.desc,
        global: def.global,
        until: Date.now() + (def.duration || 120000)
      };
      toast(def.name, def.desc, def.icon, "gold");
      App.audio.play("unlock");
      App.state.log(def.icon, "Événement : " + def.name, "");
    } else if (def.freePlinko) {
      d.charges.freePlinko = (d.charges.freePlinko || 0) + def.freePlinko;
      toast(def.name, def.freePlinko + " billes gratuites vous attendent au Plinko.", def.icon, "gold");
      App.audio.play("coin");
    } else if (def.gems) {
      Meta.grant("gems", def.gems, {});
      toast(def.name, "+" + def.gems + " gemmes !", def.icon, "gem");
      App.audio.play("gem");
    }
    App.bus.emit("event:start", def);
    Meta.saveSoon();
    Meta.checkAchievements();
    return def;
  };

  Meta.chooseMystery = function (choiceId) {
    const d = App.state.data;
    const choice = EVENTS.mysteryChoices.find((c) => c.id === choiceId);
    if (!choice) return;
    d.events.active = null;
    if (choice.tokens) {
      Meta.bonus(choice.tokens, { silent: true });
      toast("Visiteur mystérieux", "+" + U.fmt(choice.tokens) + " jetons", choice.icon, "gold");
      App.fx.coinBurst(window.innerWidth / 2, window.innerHeight / 2, choice.tokens);
    } else if (choice.gems) {
      Meta.grant("gems", choice.gems, {});
      toast("Visiteur mystérieux", "+" + choice.gems + " gemmes", choice.icon, "gem");
      App.fx.emojiBurst(window.innerWidth / 2, window.innerHeight / 2, "💎", 10);
    } else if (choice.buff) {
      Meta.addBuff(choice.buff.buff, choice.buff.value, choice.buff.duration, choice.buff.label, choice.icon);
      toast("Visiteur mystérieux", choice.buff.label, choice.icon, "gold");
    }
    App.audio.play("chest");
    App.bus.emit("event:end", { id: "mystery_visitor", name: "Visiteur mystérieux", icon: "🕵️" });
    Meta.saveSoon();
  };

  Meta.activeEvent = function () {
    const e = App.state.data.events.active;
    if (!e) return null;
    if (e.until && e.until <= Date.now()) return null;
    return e;
  };

  // ============================================================
  // AUTO-ACHAT (boutique d'étoiles)
  // ============================================================
  Meta.autoBuyUnlocked = function () {
    return Meta.prestigeShopLevel("stars", "autoBuy") > 0;
  };

  Meta.autoBuyTick = function () {
    if (!Meta.autoBuyUnlocked() || !App.state.data.settings.autoBuy) return;
    const d = App.state.data;
    const game = d.games.plinko;
    const plinko = BAL.plinko;
    const budget = d.tokens * 0.15;
    const candidates = [];
    const levelCost = (def, level) => Math.ceil(def.base * Math.pow(def.growth, level));
    if (game.upgrades.balls < plinko.upgrades.balls.max) {
      candidates.push({ key: "balls", cost: levelCost(plinko.upgrades.balls, game.upgrades.balls) });
    }
    if (game.upgrades.rows < plinko.upgrades.rows.max) {
      candidates.push({ key: "rows", cost: levelCost(plinko.upgrades.rows, game.upgrades.rows) });
    }
    if (game.upgrades.speed < plinko.upgrades.speed.max) {
      candidates.push({ key: "speed", cost: levelCost(plinko.upgrades.speed, game.upgrades.speed) });
    }
    if (game.upgrades.mult < plinko.upgrades.mult.costs.length) {
      candidates.push({ key: "mult", cost: plinko.upgrades.mult.costs[game.upgrades.mult] });
    }
    candidates.sort((a, b) => a.cost - b.cost);
    const pickOne = candidates.find((c) => c.cost <= budget && c.cost <= d.tokens);
    if (pickOne) {
      Meta.spend("tokens", pickOne.cost);
      game.upgrades[pickOne.key] += 1;
      App.bus.emit("autobuy", { key: pickOne.key });
      Meta.saveSoon();
    }
  };

  // ============================================================
  // INITIALISATION
  // ============================================================
  Meta.init = function () {
    const d = App.state.data;
    Meta.buildAchievements();
    achBonusCache = null;
    Meta.ensureQuests(false);
    Meta.refreshUnlocks(true);
    Meta.cleanupBuffs();
    Meta.checkAllGamesSynergy(true);
    Meta.checkAchievements(true);
    if (!d.events.nextAt) Meta.scheduleNextEvent();
    d.stats.sessions = (d.stats.sessions || 0) + 1;
    if (d.journal && d.journal.length > 40) d.journal.length = 40;
  };

  App.meta = Meta;
})();
