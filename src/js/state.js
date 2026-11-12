/* ============================================================
   NEON JACKPOT — state.js
   État du jeu, sauvegarde locale, formules de niveau
   ============================================================ */
(function () {
  "use strict";

  const App = window.App;
  const U = App.utils;
  const D = window.GAME_DATA;
  const BAL = D.balance;
  const SAVE_KEY = "neon_jackpot_save_v1";
  const LEGACY_KEYS = ["neonJackpotSave"];

  function zeroMap(keys) {
    const o = {};
    keys.forEach((k) => { o[k] = 0; });
    return o;
  }

  const HORSE_IDS = BAL.horses.horses.map((h) => h.id);

  function gameStats(extra) {
    return Object.assign({
      plays: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      totalWon: 0,
      bestWin: 0,
      bestMult: 1,
      cashouts: 0,
      busts: 0,
      blackjacks: 0,
      jackpots: 0,
      freeSpinRounds: 0,
      straightHits: 0,
      bestHits: 0,
      royals: 0,
      bestStreak: 0,
      streak: 0,
      crashes: 0
    }, extra || {});
  }

  function horseStats() {
    const o = {};
    HORSE_IDS.forEach((id) => { o[id] = { speed: 0, stamina: 0, luck: 0 }; });
    return o;
  }

  function defaultState() {
    const now = Date.now();
    return {
      version: BAL.meta.saveVersion,
      createdAt: now,
      lastSeen: now,
      tokens: BAL.meta.startingTokens,
      gems: BAL.meta.startingGems,
      goldBalls: BAL.meta.startingGoldBalls,
      level: 1,
      xp: 0,
      maxLevel: 1,
      totalEarned: 0,
      runEarned: 0,
      totalSpent: 0,
      stars: 0,
      crowns: 0,
      diamonds: 0,
      relics: 0,
      rebirths: { r1: 0, r2: 0, r3: 0, r4: 0 },
      highestRebirth: 0,
      unlockedGames: { plinko: true },
      seenUnlocks: {},
      games: {
        plinko: {
          upgrades: zeroMap(["balls", "rows", "mult", "bet", "luck", "speed", "auto"]),
          specials: zeroMap(["golden", "explosive", "magnet", "ghost", "rainbow", "mother"]),
          powers: { rain: false, luck: false, jackpot: false },
          powerReady: { rain: 0, luck: 0, jackpot: 0 },
          table: "classic",
          unlockedTables: ["classic"],
          autoOn: false,
          betIndex: 0,
          sessionWon: 0,
          bestSessionMult: 1,
          stats: gameStats()
        },
        blackjack: {
          upgrades: zeroMap(["maxBet", "bjBonus", "insurance", "peek", "counter", "split", "multiHand", "auto", "specials", "vip", "streak"]),
          betIndex: 0,
          autoOn: false,
          streak: 0,
          bestStreak: 0,
          bossWins: 0,
          winsTowardBoss: 0,
          bossPending: false,
          stats: gameStats()
        },
        roulette: {
          upgrades: zeroMap(["maxBet", "outside", "straight", "neighbors", "goldenWheel", "multiBall", "auto", "fetish"]),
          chip: 1,
          betIndex: 0,
          lastBets: null,
          favorite: null,
          fetishBonus: 0,
          autoOn: false,
          history: [],
          stats: gameStats()
        },
        slots: {
          upgrades: zeroMap(["maxBet", "wild", "freeSpins", "bonus", "jackpot", "autospin", "lock", "reels", "lines"]),
          betIndex: 0,
          machine: "fruits",
          jackpot: BAL.slots.jackpotBase,
          freeSpinsLeft: 0,
          freeSpinBet: 0,
          autoSpins: 0,
          stats: gameStats()
        },
        mines: {
          upgrades: zeroMap(["maxBet", "minesChoice", "size", "autoCashout", "radar", "shield", "golden", "auto"]),
          betIndex: 0,
          gridSize: 5,
          mines: 3,
          autoCashoutAt: 5,
          radarCharges: 0,
          shields: 0,
          autoOn: false,
          stats: gameStats()
        },
        crash: {
          upgrades: zeroMap(["maxBet", "autoCashout", "double", "safety", "prediction", "curves", "autobet"]),
          betIndex: 0,
          autoTarget: 2,
          autoCashoutOn: false,
          doubleBet: false,
          autoBet: false,
          autoMode: false,
          safetyCharges: 0,
          history: [],
          stats: gameStats()
        },
        dice: {
          upgrades: zeroMap(["maxBet", "multiDice", "lucky", "auto", "insight"]),
          betIndex: 0,
          diceCount: 1,
          threshold: 3,
          direction: "over",
          luckyReady: 0,
          autoOn: false,
          stats: gameStats()
        },
        keno: {
          upgrades: zeroMap(["maxBet", "fastDraw", "luckyNumbers", "auto", "multiCard"]),
          betIndex: 0,
          picks: [],
          lucky: [],
          lastPicks: [],
          autoOn: false,
          stats: gameStats()
        },
        poker: {
          upgrades: zeroMap(["maxBet", "deuces", "jokers", "auto", "royal"]),
          betIndex: 0,
          mode: "jacks",
          autoHold: false,
          autoOn: false,
          stats: gameStats()
        },
        horses: {
          upgrades: zeroMap(["maxBet", "training", "tournament", "auto", "odds"]),
          betIndex: 0,
          selected: "eclair",
          favorite: "eclair",
          horses: horseStats(),
          autoOn: false,
          stats: gameStats()
        },
        vault: {
          lastOpen: 0,
          stats: gameStats()
        }
      },
      stats: {
        totalBets: 0,
        totalWins: 0,
        totalEarned: 0,
        totalSpent: 0,
        biggestWin: 0,
        biggestBet: 0,
        biggestMult: 1,
        playTimeMs: 0,
        questsClaimed: 0,
        achievementsUnlocked: 0,
        synergiesUnlocked: 0,
        eventsSeen: 0,
        sessions: 0,
        bailouts: 0
      },
      achievements: {},
      quests: { generatedAt: 0, dailyAt: 0, weeklyAt: 0, daily: [], weekly: null },
      collections: {
        owned: { ball_neon: true },
        equipped: { balls: "ball_neon", cards: null },
        packsOpened: 0
      },
      shopUpgrades: { plinkoLuck: 0, xpBoost: 0, globalBoost: 0 },
      synergies: { unlocked: {}, lastTrigger: {}, permanent: 0 },
      challenges: {},
      challengeBonus: 0,
      croupier: { lastRun: 0, lastChoice: null, visits: 0 },
      buffs: [],
      charges: { radar: 0, crashSafety: 0, goldenCard: 0, rainbow: 0, freePlinko: 0 },
      prestige: {
        shop: { stars: {}, crowns: {}, diamonds: {}, relics: {} },
        totalStarsEarned: 0,
        totalCrownsEarned: 0,
        totalDiamondsEarned: 0,
        totalRelicsEarned: 0
      },
      settings: {
        sound: true,
        volume: 0.55,
        reducedMotion: false,
        quality: "high",
        showFloating: true,
        pauseReminder: true,
        autoSave: true,
        showTutorial: true,
        autoBuy: false,
        autoManager: false
      },
      journal: [],
      lastSeen: now,
      sessionStart: now,
      playTime: 0,
      events: { nextAt: 0, active: null, seen: 0 },
      bailoutAt: 0,
      tutorialSeen: {}
    };
  }

  const State = {};
  let saveWarned = false;

  State.defaultState = defaultState;

  function backupCorrupted(raw) {
    if (typeof raw !== "string" || !raw) return null;
    const key = SAVE_KEY + ".backup." + Date.now();
    try {
      localStorage.setItem(key, raw);
      console.warn("[state] sauvegarde illisible conservée sous " + key);
      return key;
    } catch (err) {
      console.warn("[state] copie de secours impossible", err);
      return null;
    }
  }

  function finiteOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function safeString(value, max) {
    return typeof value === "string" ? value.slice(0, max) : "";
  }

  // Recopie uniquement des valeurs contrôlées pour les champs affichés en HTML.
  State.sanitize = function (raw) {
    const base = defaultState();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
    const merged = U.deepMerge(base, raw);
    merged.tokens = finiteOr(merged.tokens, base.tokens);
    merged.gems = finiteOr(merged.gems, base.gems);
    merged.goldBalls = finiteOr(merged.goldBalls, base.goldBalls);
    merged.level = Math.max(1, Math.floor(finiteOr(merged.level, 1)));
    merged.xp = Math.max(0, finiteOr(merged.xp, 0));
    merged.journal = Array.isArray(merged.journal)
      ? merged.journal.slice(0, 40).map((item) => ({
          icon: safeString(item && item.icon, 16),
          text: safeString(item && item.text, 240),
          value: safeString(item && item.value, 80),
          at: finiteOr(item && item.at, Date.now())
        }))
      : [];
    merged.buffs = Array.isArray(merged.buffs)
      ? merged.buffs.slice(0, 20).map((buff) => ({
          id: safeString(buff && buff.id, 40),
          label: safeString(buff && buff.label, 80),
          icon: safeString(buff && buff.icon, 16),
          value: finiteOr(buff && buff.value, 0),
          until: finiteOr(buff && buff.until, 0)
        }))
      : [];
    return merged;
  };

  State.load = function () {
    let raw = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        for (const key of LEGACY_KEYS) {
          raw = localStorage.getItem(key);
          if (raw) break;
        }
      }
    } catch (err) {
      console.warn("[state] localStorage indisponible", err);
    }
    if (!raw) {
      State.data = defaultState();
      State.isNew = true;
      return State.data;
    }
    let saved;
    try {
      saved = JSON.parse(raw);
    } catch (err) {
      console.warn("[state] sauvegarde corrompue, nouvelle partie", err);
      backupCorrupted(raw);
      State.data = defaultState();
      State.isNew = true;
      return State.data;
    }
    State.data = State.sanitize(saved);
    State.isNew = false;
    State.offlineElapsed = Math.max(0, Date.now() - (saved.lastSeen || Date.now()));
    // Anti-exploit : si l'horloge recule, on ignore.
    if (State.offlineElapsed > 1000 * 60 * 60 * 24 * 365) State.offlineElapsed = 0;
    return State.data;
  };

  State.save = function (force) {
    if (!State.data) return;
    try {
      State.data.lastSeen = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(State.data));
      State.lastSaved = Date.now();
    } catch (err) {
      if (!saveWarned) {
        saveWarned = true;
        console.warn("[state] impossible de sauvegarder", err);
        if (App.ui && App.ui.toast) {
          App.ui.toast("Sauvegarde impossible", "Le stockage local est plein ou désactivé.", "⚠️", "danger");
        }
      }
    }
  };

  State.saveSoon = function () {
    if (State._saveTimer) return;
    State._saveTimer = setTimeout(() => {
      State._saveTimer = null;
      State.save();
    }, 700);
  };

  State.reset = function () {
    try {
      localStorage.removeItem(SAVE_KEY);
      LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
      sessionStorage.setItem("neon_jackpot_welcome_pending", "1");
    } catch (_) { /* ignore */ }
    State.data = defaultState();
    State.isNew = true;
    location.reload();
  };

  State.export = function () {
    return JSON.stringify(State.data, null, 2);
  };

  State.import = function (json) {
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch (err) {
      throw new Error("Fichier JSON invalide");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || typeof parsed.tokens !== "number") {
      throw new Error("Format de sauvegarde invalide");
    }
    State.data = State.sanitize(parsed);
    State.save(true);
    location.reload();
  };

  State.xpNeeded = function (level) {
    const xp = BAL.meta.xp;
    const n = Math.max(1, level);
    if (n <= xp.softCapLevel) {
      return Math.round(xp.base * Math.pow(xp.growth, n - 1));
    }
    const capValue = xp.base * Math.pow(xp.growth, xp.softCapLevel - 1);
    return Math.round(capValue * Math.pow(xp.growthAfterCap, n - xp.softCapLevel));
  };

  State.xpProgress = function () {
    const d = State.data;
    const need = State.xpNeeded(d.level);
    return { current: d.xp, need, pct: U.clamp(d.xp / need, 0, 1) };
  };

  State.prestigeCurrency = function () {
    const d = State.data;
    if (d.relics > 0 || d.highestRebirth >= 4) return { key: "relics", value: d.relics, name: "Reliques", icon: "🔮" };
    if (d.diamonds > 0 || d.highestRebirth >= 3) return { key: "diamonds", value: d.diamonds, name: "Diamants", icon: "💠" };
    if (d.crowns > 0 || d.highestRebirth >= 2) return { key: "crowns", value: d.crowns, name: "Couronnes", icon: "👑" };
    return { key: "stars", value: d.stars, name: "Étoiles", icon: "⭐" };
  };

  State.gameStat = function (gameId) {
    return State.data.games[gameId] ? State.data.games[gameId].stats : null;
  };

  State.log = function (icon, text, value) {
    const d = State.data;
    d.journal.unshift({
      icon, text, value: value || "",
      at: Date.now()
    });
    if (d.journal.length > 40) d.journal.length = 40;
    App.bus.emit("journal:add", d.journal[0]);
  };

  App.state = State;
})();
