/* ============================================================
   NEON JACKPOT — pages.js
   Accueil, quêtes, succès, collections, synergies, prestige,
   boutique, statistiques et réglages.
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
  const PREST = D.prestige;

  const h = U.escapeHtml;
  const fmt = U.fmt;

  const Pages = {};

  let achFilter = "all";
  let achCategory = "all";
  let achSearch = "";
  let achLimit = 60;

  const FEATURE_INFO = {
    plinkoShop: { name: "Boutique du Plinko", icon: "🛒", route: "plinko", desc: "Améliorez billes, rangées et multiplicateurs." },
    autoDrop: { name: "Auto-drop", icon: "🤖", route: "plinko", desc: "Le Plinko commence à jouer tout seul." },
    quests: { name: "Quêtes quotidiennes", icon: "📜", route: "quests", desc: "3 quêtes par jour et une hebdomadaire." },
    achievements: { name: "Succès", icon: "🏆", route: "achievements", desc: "Plus de 200 trophées et des bonus permanents." },
    stats: { name: "Statistiques détaillées", icon: "📊", route: "stats", desc: "Suivez chaque partie, chaque gain, chaque record." },
    gems: { name: "Gemmes & boutique", icon: "💎", route: "shop", desc: "Une monnaie rare pour les collections." },
    collections: { name: "Collections", icon: "🎴", route: "collections", desc: "Billes, cartes, tables, avatars et écurie." },
    synergies: { name: "Synergies", icon: "🔗", route: "synergies", desc: "Les jeux se mettent à coopérer." },
    secret: { name: "Salle des coffres", icon: "🗝️", route: "vault", desc: "Un jeu secret réservé aux habitués." },
    layer4: { name: "Prestige infini", icon: "♾️", route: "prestige", desc: "La quatrième couche et au-delà." },
    rebirth1: { name: "Premier Rebirth", icon: "⭐", route: "prestige", desc: "Renaître pour gagner des Étoiles." },
    rebirth2: { name: "Deuxième Rebirth", icon: "👑", route: "prestige", desc: "Les Couronnes vous attendent." },
    rebirth3: { name: "Troisième Rebirth", icon: "💠", route: "prestige", desc: "Les Diamants changent tout." }
  };

  function sectionHead(title, sub, link) {
    return `<div class="section-head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div>${link || ""}</div>`;
  }

  function progressBar(pct, cls) {
    return `<div class="progress ${cls || ""}"><i style="width:${U.clamp(pct * 100, 0, 100)}%"></i></div>`;
  }

  function objectiveCard(icon, label, title, pct, target, route) {
    return `<button class="objective-card" data-route="${route}" style="text-align:left">
      <span class="objective-icon">${icon}</span>
      <span class="objective-content">
        <small>${label}</small>
        <strong>${h(title)}</strong>
        ${progressBar(pct)}
        <span class="objective-target">${target}</span>
      </span>
    </button>`;
  }

  function nextUnlock() {
    const d = App.state.data;
    const candidates = [];
    App.meta.GAME_LIST.forEach((g) => {
      const req = App.meta.gameUnlockLevel(g.id);
      if (req > d.maxLevel) {
        candidates.push({ level: req, name: g.name, icon: g.icon, route: g.id, desc: g.tagline, type: "game" });
      }
    });
    Object.keys(FEATURE_INFO).forEach((key) => {
      const req = App.meta.featureLevel(key);
      if (req > d.maxLevel && req < 9000) {
        const f = FEATURE_INFO[key];
        candidates.push({ level: req, name: f.name, icon: f.icon, route: f.route, desc: f.desc, type: "feature" });
      }
    });
    candidates.sort((a, b) => a.level - b.level);
    return candidates[0] || null;
  }

  function closestAchievement() {
    const d = App.state.data;
    let best = null;
    let bestRatio = -1;
    App.meta.achievements.forEach((def) => {
      if (d.achievements[def.id]) return;
      let prog = 0;
      try { prog = def.progress(); } catch (_) { prog = 0; }
      const ratio = U.clamp(prog / def.target, 0, 1);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = { def, prog, ratio };
      }
    });
    return best;
  }

  function nextQuest() {
    const d = App.state.data;
    const all = (d.quests.daily || []).concat(d.quests.weekly ? [d.quests.weekly] : []);
    const unclaimed = all.filter((q) => !q.claimed);
    if (!unclaimed.length) return null;
    const ready = unclaimed.find((q) => App.meta.questComplete(q));
    if (ready) return { quest: ready, ready: true };
    let best = null;
    unclaimed.forEach((q) => {
      const ratio = App.meta.questProgress(q) / q.target;
      if (!best || ratio > best.ratio) best = { quest: q, ratio, ready: false };
    });
    return best;
  }

  function questLabel(quest) {
    return quest.label.replace("{n}", fmt(quest.target));
  }

  function gameCard(game) {
    const d = App.state.data;
    const locked = !App.meta.isGameUnlocked(game.id);
    const gs = d.games[game.id] ? d.games[game.id].stats : null;
    const req = App.meta.gameUnlockLevel(game.id);
    const progress = game.id === "vault"
      ? U.clamp(d.stats.totalWins / BAL.vault.unlockWins, 0, 1)
      : U.clamp(d.maxLevel / req, 0, 1);
    const stats = locked
      ? (game.id === "vault" ? `${fmt(d.stats.totalWins)} / ${fmt(BAL.vault.unlockWins)} victoires` : `Niveau ${d.maxLevel} / ${req}`)
      : `${fmt(gs.plays)} parties · ${fmt(gs.wins)} gains`;
    return `<article class="game-card ${locked ? "locked" : ""}" style="--accent:${game.color};--accent2:${game.color2}" data-route="${game.id}" tabindex="0" role="button" aria-label="${h(game.name)}${locked ? " (verrouillé)" : ""}">
      <div class="game-card-top">
        <span class="game-icon">${game.icon}</span>
        ${locked ? `<span class="badge locked">${game.id === "vault" ? "SECRET" : "NIV. " + req}</span>` : `<span class="badge live">OUVERT</span>`}
      </div>
      <h3>${game.name}</h3>
      <p class="game-tagline">${h(game.tagline)}</p>
      <p class="game-desc">${h(game.description)}</p>
      <div class="game-card-foot">
        <span class="game-card-play">${locked ? "Voir le déblocage" : "Jouer"} <span class="arrow">→</span></span>
        <span class="game-card-stats">${stats}</span>
      </div>
      ${locked ? `<div class="game-lock"><span class="lock-icon">${game.id === "vault" ? "🗝️" : "🔒"}</span><strong>${game.id === "vault" ? "Jeu secret" : "Verrouillé"}</strong><span>${game.id === "vault" ? "1000 victoires dans 5 jeux" : "Niveau " + req}</span><div class="mini-progress"><i style="width:${progress * 100}%"></i></div></div>` : ""}
    </article>`;
  }

  // ============================================================
  // ACCUEIL
  // ============================================================
  function renderHub(container) {
    const d = App.state.data;
    const unlock = nextUnlock();
    const ach = closestAchievement();
    const q = nextQuest();
    const title = App.meta.titleFor(d.maxLevel);
    const nextTitle = App.meta.TITLES.find((t) => t.min > d.maxLevel);
    const globalMult = App.meta.globalMult();
    const achievementsTotal = App.meta.achievements.length;
    const achCount = Object.keys(d.achievements).length;
    const collCount = App.meta.collectionOwnedCount();
    const collTotal = App.meta.collectionTotal();
    const synCount = Object.keys(d.synergies.unlocked).length;
    const playTime = U.formatDuration(d.stats.playTimeMs, true);
    const nextGame = App.meta.GAME_LIST.find((g) => App.meta.isGameUnlocked(g.id) && g.id !== "plinko") || App.meta.GAME_META.plinko;

    const journal = d.journal.slice(0, 7).map((j) => `<div class="journal-row">
      <span class="journal-icon">${j.icon}</span>
      <span class="journal-text">${h(j.text)}</span>
      <span class="journal-value">${h(j.value)}</span>
      <span class="journal-time">${U.timeAgo(j.at)}</span>
    </div>`).join("");

    const objectives = [];
    if (unlock) {
      objectives.push(objectiveCard(
        unlock.icon,
        unlock.type === "game" ? "Prochain jeu" : "Prochain déblocage",
        unlock.name,
        d.maxLevel / unlock.level,
        `Niveau ${d.maxLevel} / ${unlock.level}`,
        unlock.route
      ));
    }
    if (ach) {
      objectives.push(objectiveCard(
        ach.def.icon,
        "Succès le plus proche",
        ach.def.name,
        ach.ratio,
        `${fmt(ach.prog)} / ${fmt(ach.def.target)}`,
        "achievements"
      ));
    }
    if (q) {
      objectives.push(objectiveCard(
        q.quest.icon || "📜",
        q.ready ? "Quête prête" : "Quête en cours",
        questLabel(q.quest),
        q.ready ? 1 : App.meta.questProgress(q.quest) / q.quest.target,
        q.ready ? "Récompense à réclamer !" : `${fmt(App.meta.questProgress(q.quest))} / ${fmt(q.quest.target)}`,
        "quests"
      ));
    }
    if (objectives.length < 3) {
      objectives.push(objectiveCard("⭐", "Prestige", "Faire un Rebirth", U.clamp(d.level / 40, 0, 1), `Niveau ${d.level} / 40`, "prestige"));
    }

    const buffs = App.meta.activeBuffs();
    const buffsHtml = buffs.length
      ? buffs.map((b) => `<div class="journal-row"><span class="journal-icon">${b.icon || "✨"}</span><span class="journal-text"><strong>${h(b.label)}</strong></span><span class="journal-value">+${b.value} %</span><span class="journal-time">${U.formatCountdown(b.until - Date.now())}</span></div>`).join("")
      : `<div class="empty-state" style="padding:18px"><div class="empty-icon">🌙</div><span>Aucun effet temporaire actif. Débloquez des synergies pour en profiter.</span></div>`;

    container.innerHTML = `
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">Casino incrémental · 100 % virtuel</span>
          <h2 class="hero-title">Le casino<br><span class="line-2 gradient-text">qui ne dort jamais.</span></h2>
          <p class="hero-sub">Faites tomber les billes, domptez le croupier et transformez chaque jeton en une nouvelle machine à rêver. Aucun argent réel, que des sensations fortes.</p>
          <div class="hero-actions">
            <button class="btn btn-primary btn-lg" data-route="${nextGame.id}">${nextGame.icon} Jouer à ${nextGame.name}</button>
            <button class="btn btn-ghost btn-lg" data-route="quests">Voir les objectifs</button>
          </div>
          <div class="hero-stats">
            <div class="hero-stat"><strong>${fmt(d.totalEarned)}</strong><span>Jetons gagnés</span></div>
            <div class="hero-stat"><strong>${fmt(d.stats.biggestWin)}</strong><span>Meilleur gain</span></div>
            <div class="hero-stat"><strong>${U.fmtMult(d.stats.biggestMult)}</strong><span>Meilleur multi</span></div>
            <div class="hero-stat"><strong>${playTime}</strong><span>Temps de jeu</span></div>
          </div>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="hero-orb"><span class="hero-seven">7</span></div>
          <div class="hero-chip c1">🪙</div>
          <div class="hero-chip c2">💎</div>
          <div class="hero-chip c3">🎲</div>
          <div class="hero-chip c4">🍀</div>
          <div class="hero-card-mini red k1">A<span style="font-size:12px">♥</span></div>
          <div class="hero-card-mini k2">7<span style="font-size:12px">♠</span></div>
        </div>
      </section>

      <div class="objectives">${objectives.slice(0, 3).join("")}</div>

      ${sectionHead("Les jeux", "Chaque jeu a ses propres tables, améliorations et secrets.", `<span class="badge live">${App.meta.GAME_LIST.filter((g) => App.meta.isGameUnlocked(g.id)).length} / ${App.meta.GAME_LIST.length} ouverts</span>`)}
      <div class="game-grid">${App.meta.GAME_LIST.concat([App.meta.GAME_META.vault]).map(gameCard).join("")}</div>

      <div class="grid-2 hub-split" style="display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,0.85fr);gap:14px;margin-top:22px">
        <section class="panel">
          <div class="panel-head"><h3>📜 Journal récent</h3><span class="panel-hint">${d.journal.length} entrées</span></div>
          <div class="panel-body" style="padding-top:8px;padding-bottom:8px">
            ${journal || `<div class="empty-state" style="padding:22px"><div class="empty-icon">📖</div><strong>Le journal est vide</strong><span>Vos plus beaux gains et déblocages apparaîtront ici.</span></div>`}
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h3>📈 Votre progression</h3><span class="panel-hint">${title.name}</span></div>
          <div class="panel-body">
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:5px"><span>Niveau ${d.maxLevel}</span><span>${nextTitle ? "Prochain titre : " + nextTitle.name : "Titre maximal atteint"}</span></div>
            ${progressBar(nextTitle ? U.clamp((d.maxLevel - (App.meta.TITLES.find((t) => t.min <= d.maxLevel && (!nextTitle || t.min < nextTitle.min)) || { min: 0 }).min) / Math.max(1, nextTitle.min - (App.meta.TITLES.find((t) => t.min <= d.maxLevel) || { min: 0 }).min), 0, 1) : 1)}
            <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:9.5px;color:var(--muted)"><span>Multiplicateur global</span><strong style="color:var(--gold);font-family:var(--mono)">×${globalMult.toFixed(2)}</strong></div>
            <div class="journal-list" style="margin-top:8px">
              <div class="journal-row"><span class="journal-icon">🏆</span><span class="journal-text">Succès</span><span class="journal-value">${achCount} / ${achievementsTotal}</span></div>
              <div class="journal-row"><span class="journal-icon">🎴</span><span class="journal-text">Collection</span><span class="journal-value">${collCount} / ${collTotal}</span></div>
              <div class="journal-row"><span class="journal-icon">🔗</span><span class="journal-text">Synergies</span><span class="journal-value">${synCount} / 12</span></div>
              <div class="journal-row"><span class="journal-icon">💎</span><span class="journal-text">Gemmes</span><span class="journal-value">${fmt(d.gems)}</span></div>
              <div class="journal-row"><span class="journal-icon">⭐</span><span class="journal-text">Prestige</span><span class="journal-value">${d.highestRebirth > 0 ? "Couche " + d.highestRebirth : "Niv. 40"}</span></div>
            </div>
            <button class="btn btn-ghost btn-sm btn-block" data-route="stats" style="margin-top:10px">Voir toutes les statistiques →</button>
          </div>
        </section>
      </div>

      <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;margin-top:14px" class="hub-bottom hub-split">
        <section class="panel">
          <div class="panel-head"><h3>✨ Effets actifs</h3><span class="panel-hint">${buffs.length} actif${buffs.length > 1 ? "s" : ""}</span></div>
          <div class="panel-body" style="padding-top:8px;padding-bottom:8px">${buffsHtml}</div>
        </section>
        <section class="panel">
          <div class="panel-head"><h3>🎯 Le saviez-vous ?</h3><span class="panel-hint">Astuce</span></div>
          <div class="panel-body">
            <p style="font-size:11.5px;line-height:1.6;color:var(--muted)">Chaque succès accorde un bonus permanent. Les collections complètes ajoutent un bonus supplémentaire. Les synergies se déclenchent en jouant, pas en attendant.</p>
            <div class="reward-row" style="justify-content:flex-start;margin-top:10px">
              <span class="reward-pill">+${(App.meta.achievementBonus() * 100).toFixed(1)} % succès</span>
              <span class="reward-pill gem">+${(App.meta.collectionBonus("global") * 100).toFixed(1)} % collection</span>
            </div>
          </div>
        </section>
      </div>`;

    const onKey = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const card = e.target.closest(".game-card");
        if (card) {
          e.preventDefault();
          App.ui.navigate(card.dataset.route);
        }
      }
    };
    container.addEventListener("keydown", onKey);
    return () => container.removeEventListener("keydown", onKey);
  }

  // ============================================================
  // QUÊTES
  // ============================================================
  function renderQuests(container) {
    App.meta.ensureQuests(false);
    const controller = new AbortController();
    const signal = controller.signal;
    let timer = null;

    function questCard(quest, weekly) {
      const progress = App.meta.questProgress(quest);
      const ratio = U.clamp(progress / quest.target, 0, 1);
      const complete = App.meta.questComplete(quest);
      return `<div class="quest-card ${complete && !quest.claimed ? "ready" : ""} ${quest.claimed ? "claimed" : ""}">
        <span class="quest-icon">${quest.icon || "📜"}</span>
        <div class="quest-main">
          <div class="quest-title">${h(questLabel(quest))}</div>
          <div class="quest-rewards">
            <span class="quest-reward">🪙 +${fmt(quest.tokens)}</span>
            <span class="quest-reward gem">💎 +${quest.gems}</span>
            ${weekly ? `<span class="quest-reward" style="color:var(--pink-soft);background:rgba(255,79,216,.07);border-color:rgba(255,79,216,.2)">HEBDO</span>` : ""}
          </div>
          <div class="quest-progress">${progressBar(ratio, complete ? "green" : "")}
            <div class="quest-progress-label"><span>${fmt(progress)} / ${fmt(quest.target)}</span><span>${Math.floor(ratio * 100)} %</span></div>
          </div>
          <div style="margin-top:8px">
            ${quest.claimed ? `<span class="badge" style="color:var(--green);border-color:rgba(74,222,128,.25)">RÉCLAMÉE</span>`
              : complete ? `<button class="btn btn-green btn-sm" data-quest="${quest.id}">Réclamer</button>`
              : `<span class="badge locked">En cours</span>`}
          </div>
        </div>
      </div>`;
    }

    function draw() {
      const d = App.state.data;
      const daily = d.quests.daily || [];
      const weekly = d.quests.weekly;
      const ready = daily.filter((q) => !q.claimed && App.meta.questComplete(q)).length + (weekly && !weekly.claimed && App.meta.questComplete(weekly) ? 1 : 0);
      container.innerHTML = `
        ${sectionHead("📜 Quêtes", `${daily.length} quêtes quotidiennes + 1 quête hebdomadaire. Renouvellement dans <span id="quest-timer" style="color:var(--gold);font-family:var(--mono)">${U.formatCountdown(App.meta.nextDailyReset() - Date.now())}</span>.`, ready ? `<span class="badge gold">${ready} prête${ready > 1 ? "s" : ""}</span>` : "")}
        <div class="quest-grid">${daily.map((q) => questCard(q, false)).join("")}</div>
        ${sectionHead("🏆 Quête hebdomadaire", "Un objectif plus long, une récompense plus grosse.")}
        <div class="quest-grid">${weekly ? questCard(weekly, true) : ""}</div>
        <div class="panel panel-pad" style="margin-top:18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span style="font-size:22px">💡</span>
          <p class="muted" style="font-size:11px;flex:1;min-width:220px;margin:0">Les quêtes se cumulent avec les succès. Une quête « Gagner des jetons » compte tous vos gains, y compris les bonus et les gains hors-ligne.</p>
          <button class="btn btn-ghost btn-sm" data-route="achievements">Voir les succès</button>
        </div>`;
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        const el = container.querySelector("#quest-timer");
        if (el) el.textContent = U.formatCountdown(App.meta.nextDailyReset() - Date.now());
      }, 1000);
    }

    draw();

    container.addEventListener("click", (e) => {
      const claim = e.target.closest("[data-quest]");
      if (claim) {
        const ok = App.meta.claimQuest(claim.dataset.quest);
        if (ok) draw();
        else App.audio.play("error");
      }
    }, { signal });

    return () => {
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }

  // ============================================================
  // SUCCÈS
  // ============================================================
  function renderAchievements(container) {
    const controller = new AbortController();
    const signal = controller.signal;

    function draw() {
      const d = App.state.data;
      const unlockedCount = Object.keys(d.achievements).length;
      const categories = ["all"].concat(Object.keys(App.meta.categoryLabels));
      let defs = App.meta.achievements.slice();
      if (achCategory !== "all") defs = defs.filter((x) => x.category === achCategory);
      if (achFilter === "unlocked") defs = defs.filter((x) => d.achievements[x.id]);
      if (achFilter === "locked") defs = defs.filter((x) => !d.achievements[x.id]);
      if (achSearch) {
        const s = achSearch.toLowerCase();
        defs = defs.filter((x) => (x.name + " " + x.desc).toLowerCase().includes(s));
      }
      if (achFilter === "closest") {
        defs = defs.filter((x) => !d.achievements[x.id]).sort((a, b) => {
          let pa = 0, pb = 0;
          try { pa = a.progress() / a.target; } catch (_) {}
          try { pb = b.progress() / b.target; } catch (_) {}
          return pb - pa;
        });
      }
      const totalFiltered = defs.length;
      const visible = defs.slice(0, achLimit);
      const cards = visible.map((def) => {
        const unlocked = !!d.achievements[def.id];
        let prog = 0;
        try { prog = def.progress(); } catch (_) { prog = 0; }
        const ratio = U.clamp(prog / def.target, 0, 1);
        return `<div class="ach-card ${unlocked ? "unlocked" : ""}" title="${h(def.desc)}">
          <span class="ach-icon">${unlocked ? "✓" : def.icon}</span>
          <div class="ach-body">
            <div class="ach-name">${h(def.name)}</div>
            <div class="ach-desc">${h(def.desc)}</div>
            <div class="ach-progress">${progressBar(ratio, unlocked ? "gold" : "sm")}</div>
            <div class="ach-reward">💎 ${def.reward.gems} · +${(def.reward.bonus * 100).toFixed(1)} % permanent</div>
          </div>
        </div>`;
      }).join("");

      container.innerHTML = `
        ${sectionHead("🏆 Succès", "Chaque succès donne des gemmes et un bonus permanent de gains.", `<span class="badge gold">${unlockedCount} / ${App.meta.achievements.length}</span>`)}
        <div class="panel panel-pad" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:12px">
          <div style="flex:1;min-width:220px">
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:5px"><span>Progression globale</span><span>${Math.floor(unlockedCount / App.meta.achievements.length * 100)} %</span></div>
            ${progressBar(unlockedCount / App.meta.achievements.length, "gold")}
          </div>
          <div style="text-align:right"><div style="font-family:var(--mono);color:var(--gold);font-size:16px">+${(App.meta.achievementBonus() * 100).toFixed(1)} %</div><div style="font-size:9px;color:var(--muted-2);text-transform:uppercase;letter-spacing:.1em">Bonus permanent</div></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
          <div class="segmented">
            ${[["all", "Tous"], ["closest", "Proches"], ["unlocked", "Débloqués"], ["locked", "Verrouillés"]].map(([k, label]) => `<button class="seg-btn ${achFilter === k ? "active" : ""}" data-ach-filter="${k}">${label}</button>`).join("")}
          </div>
          <select class="input" id="ach-cat" style="width:auto;min-width:140px;min-height:34px;font-size:10.5px">
            ${categories.map((c) => `<option value="${c}" ${achCategory === c ? "selected" : ""}>${c === "all" ? "Toutes les catégories" : App.meta.categoryLabels[c].icon + " " + App.meta.categoryLabels[c].name}</option>`).join("")}
          </select>
          <input class="input" id="ach-search" placeholder="Rechercher un succès…" value="${h(achSearch)}" style="width:min(240px,100%);min-height:34px;font-size:10.5px" />
          <span class="muted" style="font-size:10px;margin-left:auto">${totalFiltered} résultat${totalFiltered > 1 ? "s" : ""}${totalFiltered > visible.length ? " · " + visible.length + " affichés" : ""}</span>
        </div>
        <div class="ach-grid">${cards || `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🔎</div><strong>Aucun succès ici</strong><span>Changez de filtre ou continuez à jouer.</span></div>`}</div>
        ${totalFiltered > visible.length ? `<div style="display:flex;justify-content:center;margin-top:14px"><button class="btn btn-ghost" data-ach-more>Afficher ${Math.min(60, totalFiltered - visible.length)} succès de plus</button></div>` : ""}`;
    }

    draw();

    container.addEventListener("click", (e) => {
      const f = e.target.closest("[data-ach-filter]");
      if (f) {
        achFilter = f.dataset.achFilter;
        achLimit = 60;
        draw();
        return;
      }
      if (e.target.closest("[data-ach-more]")) {
        achLimit += 60;
        draw();
      }
    }, { signal });
    container.addEventListener("change", (e) => {
      if (e.target.id === "ach-cat") {
        achCategory = e.target.value;
        achLimit = 60;
        draw();
      }
    }, { signal });
    container.addEventListener("input", (e) => {
      if (e.target.id === "ach-search") {
        achSearch = e.target.value;
        achLimit = 60;
        const pos = e.target.selectionStart;
        draw();
        const input = container.querySelector("#ach-search");
        if (input) {
          input.focus();
          input.setSelectionRange(pos, pos);
        }
      }
    }, { signal });

    return () => controller.abort();
  }

  // ============================================================
  // COLLECTIONS
  // ============================================================
  function itemVisual(item) {
    return item.emoji || item.setIcon || "🎴";
  }

  function renderCollections(container) {
    const controller = new AbortController();
    const signal = controller.signal;

    function draw() {
      const d = App.state.data;
      const owned = d.collections.owned;
      const total = App.meta.collectionTotal();
      const count = App.meta.collectionOwnedCount();
      const sets = App.meta.COLLECTION_SETS;

      const setsHtml = sets.map((set) => {
        const setCount = App.meta.setProgress(set);
        const complete = setCount === set.items.length;
        const items = set.items.map((item) => {
          const has = !!owned[item.id];
          const equipped = d.collections.equipped[setIdForItem(item)] === item.id;
          return `<button class="collectible rarity-${item.rarity} ${has ? "" : "locked"} ${equipped ? "equipped" : ""}" data-item="${item.id}" style="--item-color:${item.color || "#6d28d9"}" title="${h(item.name)} (${item.rarity})">
            <span class="collectible-visual">${itemVisual(item)}</span>
            <span class="collectible-name">${has ? h(item.name) : "???"}</span>
            ${has ? "" : `<span class="collectible-lock">🔒</span>`}
          </button>`;
        }).join("");
        return `<section class="collection-set">
          <div class="collection-set-head">
            <span class="set-icon">${set.icon}</span>
            <div><h3>${set.name}</h3><div class="set-bonus">${complete ? "✓ " : ""}${set.bonus.label}</div></div>
            <span class="set-progress">${setCount} / ${set.items.length}</span>
          </div>
          <div class="collection-grid">${items}</div>
        </section>`;
      }).join("");

      container.innerHTML = `
        ${sectionHead("🎴 Collections", "Chaque objet possède un bonus permanent minuscule. Complétez un set pour un bonus majeur.", `<span class="badge gold">${count} / ${total}</span>`)}
        <div class="panel panel-pad" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px">
          <div style="flex:1;min-width:220px">
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:5px"><span>Collection globale</span><span>${Math.floor(count / total * 100)} %</span></div>
            ${progressBar(count / total, "gold")}
            <div style="display:flex;gap:14px;margin-top:8px;font-size:9.5px;color:var(--muted)"><span>Bonus objets : <strong style="color:var(--gold)">+${(count * COLL.itemBonus * 100).toFixed(1)} %</strong></span><span>Sets complets : <strong style="color:var(--gold)">${App.meta.collectionCompleteCount()} / ${sets.length}</strong></span></div>
          </div>
          <div style="display:flex;gap:7px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" data-pack="1">🎁 Pack ×1 · ${COLL.packCost} 💎</button>
            <button class="btn btn-gold btn-sm" data-pack="10">🎁 Pack ×10 · ${COLL.packCost10} 💎</button>
          </div>
        </div>
        ${setsHtml}
        <div class="panel panel-pad" style="margin-top:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="font-size:20px">🛒</span>
          <p class="muted" style="font-size:11px;flex:1;min-width:200px;margin:0">Besoin de gemmes ? Les succès, quêtes et événements en donnent. La boutique propose aussi des packs et des bonus permanents.</p>
          <button class="btn btn-ghost btn-sm" data-route="shop">Ouvrir la boutique</button>
        </div>`;
    }

    function setIdForItem(item) {
      return item.setId;
    }

    draw();

    container.addEventListener("click", (e) => {
      const pack = e.target.closest("[data-pack]");
      if (pack) {
        const count = parseInt(pack.dataset.pack, 10);
        const results = App.meta.openPack(count);
        if (!results) {
          App.audio.play("error");
          App.ui.toast("Gemmes insuffisantes", "Ouvrez des packs avec vos gemmes.", "💎", "danger");
          return;
        }
        App.ui.packModal(results);
        draw();
        return;
      }
      const itemEl = e.target.closest("[data-item]");
      if (itemEl) {
        const itemId = itemEl.dataset.item;
        const item = App.meta.COLLECTION_ITEM[itemId];
        if (!item) return;
        const d = App.state.data;
        if (!d.collections.owned[itemId]) {
          App.audio.play("error");
          App.ui.toast("Objet verrouillé", "Ouvrez des packs pour le découvrir.", "🔒", "");
          return;
        }
        const equipable = item.setId === "balls" || item.setId === "cards";
        const isEquipped = d.collections.equipped[item.setId] === item.id;
        App.ui.modal({
          title: item.name,
          subtitle: item.setName + " · " + item.rarity,
          className: "modal-sm",
          body: `<div class="modal-center">
            <div class="collectible-visual" style="width:82px;height:82px;font-size:38px;margin:0 auto 12px;--item-color:${item.color || "#6d28d9"}">${itemVisual(item)}</div>
            <p class="muted" style="font-size:11px">Objet de collection ${item.rarity}.</p>
            <div class="reward-row"><span class="reward-pill">+${(COLL.itemBonus * 100).toFixed(2)} % de gains</span></div>
          </div>`,
          actions: equipable
            ? [
                { label: "Fermer", className: "btn-ghost" },
                {
                  label: isEquipped ? "Équipé ✓" : "Équiper",
                  className: "btn-primary",
                  onClick: () => {
                    if (isEquipped) return false;
                    App.meta.equipCollection(item.setId, item.id);
                    App.ui.toast("Équipé", item.name + " est maintenant actif.", item.setIcon || "🎴", "gold");
                    draw();
                  }
                }
              ]
            : [{ label: "Fermer", className: "btn-ghost" }]
        });
      }
    }, { signal });

    return () => controller.abort();
  }

  // ============================================================
  // SYNERGIES
  // ============================================================
  function renderSynergies(container) {
    const d = App.state.data;
    const unlocked = Object.keys(d.synergies.unlocked).length;
    const cards = App.meta.SYNERGIES.map((s) => {
      const has = !!d.synergies.unlocked[s.id];
      return `<div class="synergy-card ${has ? "unlocked" : ""}">
        <span class="synergy-icon">${s.icon}</span>
        <div class="synergy-body">
          <div class="synergy-name">${s.name}</div>
          <div class="synergy-cond">${s.condition}</div>
          <div class="synergy-desc">${s.desc}</div>
          ${has ? `<div style="margin-top:6px"><span class="badge live">DÉBLOQUÉE</span></div>` : `<div style="margin-top:6px"><span class="badge locked">À DÉCOUVRIR</span></div>`}
        </div>
      </div>`;
    }).join("");
    const buffs = App.meta.activeBuffs();
    container.innerHTML = `
      ${sectionHead("🔗 Synergies", "Jouez à plusieurs jeux pour déclencher des combinaisons secrètes.", `<span class="badge gold">${unlocked} / ${App.meta.SYNERGIES.length}</span>`)}
      <div class="panel panel-pad" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:14px">
        <div style="flex:1;min-width:200px"><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:5px"><span>Découvertes</span><span>${unlocked} / ${App.meta.SYNERGIES.length}</span></div>${progressBar(unlocked / App.meta.SYNERGIES.length)}</div>
        <span class="badge gold">+${(d.synergies.permanent || 0).toFixed(0)} % permanent</span>
      </div>
      <div class="synergy-grid">${cards}</div>
      ${buffs.length ? `<div class="panel" style="margin-top:14px"><div class="panel-head"><h3>✨ Effets temporaires actifs</h3></div><div class="panel-body" style="padding-top:8px;padding-bottom:8px">${buffs.map((b) => `<div class="journal-row"><span class="journal-icon">${b.icon || "✨"}</span><span class="journal-text"><strong>${h(b.label)}</strong></span><span class="journal-value">+${b.value} %</span><span class="journal-time">${U.formatCountdown(b.until - Date.now())}</span></div>`).join("")}</div></div>` : ""}`;
    return null;
  }

  // ============================================================
  // PRESTIGE
  // ============================================================
  function renderPrestige(container) {
    const controller = new AbortController();
    const signal = controller.signal;

    function draw() {
      const d = App.state.data;
      const globalMult = App.meta.globalMult();
      const resets = "Jetons, niveau de run, améliorations de jeux et mises. Vous conservez les gemmes, succès, collections, déblocages et billes spéciales.";
      const layerCards = PREST.layers.map((layer, i) => {
        const info = App.meta.rebirthGain(i);
        const unlockedLayer = d.highestRebirth >= i || (i === 0 && d.maxLevel >= 40);
        let desc = "";
        if (i === 0) desc = "Gagnez des Étoiles grâce à vos gains cumulés dans cette run. Chaque Étoile donne +5 % de gains permanents.";
        else if (i === 1) desc = "Consommez vos Étoiles pour obtenir des Couronnes. Chaque Couronne donne +15 % de gains permanents.";
        else if (i === 2) desc = "Consommez vos Couronnes pour obtenir des Diamants. Chaque Diamant donne +35 % de gains permanents.";
        else desc = "La boucle infinie. Consommez vos Diamants pour obtenir des Reliques. Chaque Relique donne +75 % de gains permanents.";
        return `<div class="layer-card ${i === 0 ? "active-layer" : ""} ${d.maxLevel < layer.level ? "locked-layer" : ""}">
          <div class="layer-top">
            <span class="layer-icon">${layer.icon}</span>
            <div><h3>Couche ${i + 1} · ${layer.name}</h3><div class="layer-sub">${layer.tagline}</div></div>
          </div>
          <p>${desc}</p>
          <div class="layer-req"><span>Niveau requis</span><strong style="color:${info.canLevel ? "var(--green)" : "var(--muted)"}">${d.level} / ${layer.level}</strong></div>
          ${progressBar(info.progress, info.canLevel ? "green" : "")}
          <div class="layer-rewards">
            <span class="prestige-currency">${layer.icon} +${info.amount} ${layer.name}</span>
            ${i > 0 ? `<span class="badge">${i === 1 ? "Consomme tes Étoiles" : i === 2 ? "Consomme tes Couronnes" : "Consomme tes Diamants"}</span>` : ""}
          </div>
          <button class="btn ${info.can ? "btn-gold" : "btn-ghost"} btn-sm btn-block" data-rebirth="${i}" ${info.can ? "" : "disabled"}>
            ${info.can ? "Effectuer le Rebirth" : (info.canLevel ? "Ressource insuffisante" : "Niveau " + layer.level + " requis")}
          </button>
        </div>`;
      }).join("");

      const shopPanels = PREST.layers.map((layer) => {
        const currency = layer.currency;
        const held = d[currency] || 0;
        const shop = layer.shop.map((item) => {
          const level = App.meta.prestigeShopLevel(currency, item.id);
          const maxed = level >= item.max;
          const cost = App.meta.prestigeShopCost(currency, item.id);
          return `<div class="shop-item">
            <span class="shop-icon">${item.icon || "✨"}</span>
            <div class="shop-main">
              <div class="shop-name">${item.name} <span class="shop-level">Niv. ${level} / ${item.max}</span></div>
              <div class="shop-desc">${item.desc}</div>
            </div>
            <button class="btn btn-${maxed ? "ghost" : "gold"} btn-xs" data-prestige-shop="${currency}" data-prestige-id="${item.id}" ${maxed || held < cost ? "disabled" : ""}>
              ${maxed ? "MAX" : cost + " " + layer.icon}
            </button>
          </div>`;
        }).join("");
        return `<section class="panel" style="margin-bottom:12px">
          <div class="panel-head"><h3>${layer.icon} Boutique ${layer.name}</h3><span class="panel-hint">${fmt(held)} ${layer.name}</span></div>
          <div class="panel-body"><div class="shop-grid">${shop}</div></div>
        </section>`;
      }).join("");

      container.innerHTML = `
        <section class="prestige-hero">
          <span class="eyebrow gold">Prestige</span>
          <h2>Mourir. Renaître. <span class="gradient-text">Encaisser.</span></h2>
          <p>Chaque Rebirth remet votre run à zéro mais vous donne une monnaie permanente. Plus vous attendez, plus la récompense est grande. Les gemmes, succès, collections et déblocages restent avec vous pour toujours.</p>
          <div class="prestige-stats">
            <div class="prestige-stat"><strong>${d.highestRebirth}</strong><span>Couche max</span></div>
            <div class="prestige-stat"><strong>×${globalMult.toFixed(2)}</strong><span>Multiplicateur global</span></div>
            <div class="prestige-stat"><strong>${fmt(d.runEarned)}</strong><span>Gains de la run</span></div>
            <div class="prestige-stat"><strong>${fmt(d.stars)}</strong><span>Étoiles</span></div>
            <div class="prestige-stat"><strong>${fmt(d.crowns)}</strong><span>Couronnes</span></div>
            <div class="prestige-stat"><strong>${fmt(d.diamonds)}</strong><span>Diamants</span></div>
            <div class="prestige-stat"><strong>${fmt(d.relics)}</strong><span>Reliques</span></div>
          </div>
        </section>

        ${sectionHead("Les couches", "Chaque couche multiplie la précédente et débloque de nouveaux arbres d'automatisation.")}
        <div class="layer-grid">${layerCards}</div>

        ${sectionHead("Boutiques de prestige", "Dépensez vos monnaies permanentes. Les achats ne sont jamais perdus.")}
        ${shopPanels}

        <div class="panel panel-pad" style="margin-top:8px;border-color:rgba(255,84,112,.18)">
          <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">
            <span style="font-size:22px">⚖️</span>
            <p class="muted" style="font-size:10.5px;line-height:1.6;margin:0;flex:1;min-width:220px"><strong style="color:var(--text-soft)">Ce qui se réinitialise :</strong> ${resets}<br><strong style="color:var(--text-soft)">Ce qui reste :</strong> gemmes, billes d'or, succès, quêtes réclamées, collections, synergies, statistiques, déblocages de jeux et boutique de prestige.</p>
          </div>
        </div>`;
    }

    function doRebirth(index) {
      const info = App.meta.rebirthGain(index);
      if (!info.can) {
        App.audio.play("error");
        return;
      }
      const layer = PREST.layers[index];
      App.ui.confirm({
        title: `Rebirth — Couche ${index + 1}`,
        subtitle: `Vous allez obtenir ${info.amount} ${layer.name}.`,
        message: "Toute la progression de la run sera remise à zéro : jetons, niveau actuel et améliorations de jeux. Vos gemmes, succès, collections et déblocages sont conservés.<br><br>Continuer ?",
        confirmLabel: "Renaître",
        danger: index > 0,
        onConfirm: () => {
          const gain = App.meta.doRebirth(index);
          if (gain) {
            setTimeout(() => {
              App.ui.modal({
                title: "Renaissance !",
                subtitle: "Le casino vous reconnaît.",
                className: "modal-sm",
                body: `<div class="modal-center"><div class="modal-hero-icon" style="font-size:32px">${layer.icon}</div><h3 style="font-size:26px;color:var(--gold)">+${gain.amount} ${layer.name}</h3><p class="muted" style="font-size:11px;margin-top:6px">Votre multiplicateur global augmente. Les premiers niveaux vont passer très vite.</p><div class="reward-row"><span class="reward-pill">×${App.meta.globalMult().toFixed(2)} de gains globaux</span></div></div>`,
                actions: [{ label: "Continuer", className: "btn-gold" }]
              });
              draw();
            }, 300);
          }
        }
      });
    }

    draw();

    container.addEventListener("click", (e) => {
      const rb = e.target.closest("[data-rebirth]");
      if (rb) {
        doRebirth(parseInt(rb.dataset.rebirth, 10));
        return;
      }
      const shop = e.target.closest("[data-prestige-shop]");
      if (shop) {
        const ok = App.meta.buyPrestigeUpgrade(shop.dataset.prestigeShop, shop.dataset.prestigeId);
        if (ok) draw();
        else App.audio.play("error");
      }
    }, { signal });

    return () => controller.abort();
  }

  // ============================================================
  // BOUTIQUE
  // ============================================================
  function renderShop(container) {
    const controller = new AbortController();
    const signal = controller.signal;

    function draw() {
      const d = App.state.data;
      const shop = BAL.gemShop || {};
      const items = Object.keys(shop).map((id) => {
        const item = shop[id];
        let level = 0;
        let maxed = false;
        if (item.max) {
          level = App.meta.gemShopLevel(id);
          maxed = level >= item.max;
        }
        const can = d.gems >= item.cost && !maxed;
        let effect = item.desc;
        if (id === "tokenChest") {
          const amount = Math.floor(item.base * Math.pow(item.growth, Math.max(0, d.level - 1)));
          effect = `Recevez ${fmt(amount)} jetons immédiatement.`;
        }
        return `<div class="shop-item">
          <span class="shop-icon">${item.icon}</span>
          <div class="shop-main">
            <div class="shop-name">${item.name}${item.max ? ` <span class="shop-level">Niv. ${level} / ${item.max}</span>` : ""}</div>
            <div class="shop-desc">${effect}</div>
          </div>
          <button class="btn btn-${maxed ? "ghost" : can ? "gold" : "ghost"} btn-xs" data-shop-item="${id}" ${can ? "" : "disabled"}>
            ${maxed ? "MAX" : item.cost + " 💎"}
          </button>
        </div>`;
      }).join("");

      const owned = App.meta.collectionOwnedCount();
      container.innerHTML = `
        ${sectionHead("🛒 Boutique", "Une seule monnaie rare : les gemmes. Elles s'obtiennent via les succès, quêtes, événements et coffres.", `<span class="badge cyan">${fmt(d.gems)} 💎</span>`)}
        <div class="panel panel-pad" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:14px">
          <span style="font-size:30px">🎁</span>
          <div style="flex:1;min-width:200px">
            <div style="font-weight:600;font-size:13px">Packs de collection</div>
            <div class="muted" style="font-size:10.5px">Billes, cartes, jetons, tables, avatars et chevaux. Les doublons sont convertis en gemmes.</div>
            <div class="muted" style="font-size:9.5px;margin-top:3px">Déjà possédé : ${owned} / ${App.meta.collectionTotal()} objets.</div>
          </div>
          <div style="display:flex;gap:7px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" data-shop-pack="1" ${d.gems < COLL.packCost ? "disabled" : ""}>Pack ×1 · ${COLL.packCost} 💎</button>
            <button class="btn btn-gold btn-sm" data-shop-pack="10" ${d.gems < COLL.packCost10 ? "disabled" : ""}>Pack ×10 · ${COLL.packCost10} 💎</button>
          </div>
        </div>

        ${sectionHead("Bonus permanents", "Des achats uniques ou améliorables qui boostent toutes vos runs.")}
        <div class="shop-grid">${items}</div>

        ${sectionHead("Billes d'or", "La monnaie premium du Plinko. Débloquez et améliorez les billes spéciales.")}
        <div class="panel panel-pad" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <span style="font-size:28px">🟡</span>
          <div style="flex:1;min-width:180px"><div style="font-weight:600;font-size:13px">${fmt(d.goldBalls)} billes d'or</div><div class="muted" style="font-size:10.5px">Gagnez-en avec les succès, les synergies et les gros multiplicateurs au Plinko.</div></div>
          <button class="btn btn-cyan btn-sm" data-route="plinko">Aller au Plinko</button>
        </div>

        ${sectionHead("Gemmes", "Comment en gagner ?")}
        <div class="panel panel-pad">
          <div class="journal-list">
            <div class="journal-row"><span class="journal-icon">🏆</span><span class="journal-text">Succès débloqués</span><span class="journal-value">+2 à +30 💎</span></div>
            <div class="journal-row"><span class="journal-icon">📜</span><span class="journal-text">Quêtes quotidiennes et hebdomadaires</span><span class="journal-value">+1 à +20 💎</span></div>
            <div class="journal-row"><span class="journal-icon">📈</span><span class="journal-text">Montée de niveau</span><span class="journal-value">+1 💎 / niveau</span></div>
            <div class="journal-row"><span class="journal-icon">🎉</span><span class="journal-text">Événements du casino</span><span class="journal-value">+8 💎</span></div>
            <div class="journal-row"><span class="journal-icon">🔗</span><span class="journal-text">Synergies découvertes</span><span class="journal-value">+1 à +25 💎</span></div>
          </div>
        </div>`;
    }

    draw();

    container.addEventListener("click", (e) => {
      const pack = e.target.closest("[data-shop-pack]");
      if (pack) {
        const count = parseInt(pack.dataset.shopPack, 10);
        const results = App.meta.openPack(count);
        if (results) {
          App.ui.packModal(results);
          draw();
        } else {
          App.audio.play("error");
        }
        return;
      }
      const buy = e.target.closest("[data-shop-item]");
      if (buy) {
        if (App.meta.buyGemShop(buy.dataset.shopItem)) draw();
      }
    }, { signal });

    return () => controller.abort();
  }

  // ============================================================
  // STATISTIQUES
  // ============================================================
  function renderStats(container) {
    const d = App.state.data;
    const s = d.stats;
    const winRate = s.totalBets > 0 ? (s.totalWins / s.totalBets * 100) : 0;
    const tiles = [
      ["Jetons gagnés", fmt(d.totalEarned), "depuis toujours"],
      ["Parties jouées", fmt(s.totalBets), "tous jeux confondus"],
      ["Victoires", fmt(s.totalWins), winRate.toFixed(1) + " % de réussite"],
      ["Meilleur gain", fmt(s.biggestWin), "en une seule fois"],
      ["Meilleure mise", fmt(s.biggestBet), "sur une partie"],
      ["Meilleur multi", U.fmtMult(s.biggestMult), "tous jeux"],
      ["Temps de jeu", U.formatDuration(s.playTimeMs, true), "temps actif estimé"],
      ["Niveau max", d.maxLevel, "record de la sauvegarde"],
      ["Rebirths", Object.values(d.rebirths).reduce((a, b) => a + b, 0), "toutes couches"],
      ["Succès", Object.keys(d.achievements).length, "sur " + App.meta.achievements.length],
      ["Collection", App.meta.collectionOwnedCount(), "sur " + App.meta.collectionTotal()],
      ["Synergies", Object.keys(d.synergies.unlocked).length, "sur 12"],
      ["Quêtes réclamées", s.questsClaimed, "récompenses"],
      ["Packs ouverts", d.collections.packsOpened, "objets découverts"],
      ["Événements", s.eventsSeen, "moments speciaux"],
      ["Coffres de secours", s.bailouts, "utilisés"],
      ["Sessions", d.stats.sessions, "ouvertures du jeu"]
    ];

    const gameRows = App.meta.GAME_LIST.map((g) => {
      const gs = d.games[g.id].stats;
      return `<tr>
        <td><span style="margin-right:5px">${g.icon}</span>${g.name}</td>
        <td class="mono">${fmt(gs.plays)}</td>
        <td class="mono">${fmt(gs.wins)}</td>
        <td class="mono">${fmt(gs.bestWin)}</td>
        <td class="mono">${U.fmtMult(gs.bestMult)}</td>
        <td class="mono">${gs.plays ? (gs.wins / gs.plays * 100).toFixed(1) + " %" : "—"}</td>
      </tr>`;
    }).join("");

    container.innerHTML = `
      ${sectionHead("📊 Statistiques", "Le casino se souvient de tout. Enfin, de presque tout.", `<button class="btn btn-ghost btn-sm" data-route="settings">Exporter</button>`)}
      <div class="stats-grid">${tiles.map(([label, value, sub]) => `<div class="stat-tile"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-sub">${sub}</div></div>`).join("")}</div>
      ${sectionHead("Par jeu", "Les performances de chaque table.")}
      <div class="panel" style="overflow:hidden">
        <div style="overflow-x:auto">
          <table class="stats-table">
            <thead><tr><th>Jeu</th><th>Parties</th><th>Victoires</th><th>Meilleur gain</th><th>Meilleur multi</th><th>Taux</th></tr></thead>
            <tbody>${gameRows}</tbody>
          </table>
        </div>
      </div>
      <div class="panel panel-pad" style="margin-top:14px;display:flex;gap:14px;flex-wrap:wrap;align-items:center">
        <div style="flex:1;min-width:220px"><div class="eyebrow">Progression du compte</div><div style="margin-top:7px;display:flex;justify-content:space-between;font-size:10px;color:var(--muted)"><span>Succès</span><span>${Object.keys(d.achievements).length} / ${App.meta.achievements.length}</span></div>${progressBar(Object.keys(d.achievements).length / App.meta.achievements.length, "gold")}<div style="margin-top:9px;display:flex;justify-content:space-between;font-size:10px;color:var(--muted)"><span>Collection</span><span>${App.meta.collectionOwnedCount()} / ${App.meta.collectionTotal()}</span></div>${progressBar(App.meta.collectionOwnedCount() / App.meta.collectionTotal())}</div>
        <div style="text-align:right"><div style="font-family:var(--mono);font-size:18px;color:var(--gold)">×${App.meta.globalMult().toFixed(2)}</div><div style="font-size:9px;color:var(--muted-2);text-transform:uppercase;letter-spacing:.1em">Multiplicateur global</div></div>
      </div>`;
    return null;
  }

  // ============================================================
  // RÉGLAGES
  // ============================================================
  function renderSettings(container) {
    const d = App.state.data;
    const s = d.settings;
    const autoBuyUnlocked = App.meta.autoBuyUnlocked();
    const managerUnlocked = App.meta.prestigeShopLevel("crowns", "manager") > 0;
    const switchRow = (key, title, desc, enabled, locked) => `<div class="settings-row">
      <div class="settings-main"><div class="settings-name">${title}</div><div class="settings-desc">${desc}</div></div>
      ${locked ? `<span class="badge locked">Verrouillé</span>` : `<button class="switch ${enabled ? "on" : ""}" data-setting="${key}" role="switch" aria-checked="${enabled}"></button>`}
    </div>`;

    container.innerHTML = `
      ${sectionHead("⚙️ Réglages", "Le confort avant tout. Toutes les options sont sauvegardées localement.", `<button class="btn btn-ghost btn-sm" data-route="stats">Voir mes stats</button>`)}
      <div style="display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,0.9fr);gap:14px" class="settings-grid">
        <section class="panel">
          <div class="panel-head"><h3>🎛️ Confort de jeu</h3></div>
          <div class="panel-body settings-list">
            ${switchRow("sound", "Son", "Effets sonores synthétisés, aucun fichier audio externe.", s.sound)}
            ${switchRow("reducedMotion", "Réduire les animations", "Diminue les particules, secousses et transitions.", s.reducedMotion)}
            ${switchRow("pauseReminder", "Rappel de pause", "Un message amical après 2 h de jeu continu.", s.pauseReminder)}
            ${switchRow("autoSave", "Sauvegarde périodique", "Sauvegarde toutes les 15 s. Les actions importantes restent sauvegardées.", s.autoSave)}
            <div class="settings-row">
              <div class="settings-main"><div class="settings-name">Qualité des particules</div><div class="settings-desc">Plus bas = plus fluide sur les petits appareils.</div></div>
              <select class="input" id="setting-quality" style="width:120px;min-height:34px;font-size:10.5px">
                ${[["high", "Élevée"], ["medium", "Moyenne"], ["low", "Basse"]].map(([v, l]) => `<option value="${v}" ${s.quality === v ? "selected" : ""}>${l}</option>`).join("")}
              </select>
            </div>
            <div class="settings-row">
              <div class="settings-main"><div class="settings-name">Volume</div><div class="settings-desc">${Math.round((s.volume || 0.55) * 100)} %</div></div>
              <input type="range" id="setting-volume" min="0" max="100" value="${Math.round((s.volume || 0.55) * 100)}" style="max-width:140px" />
            </div>
            ${switchRow("autoBuy", "Auto-achat Plinko", autoBuyUnlocked ? "Achète automatiquement les améliorations Plinko les moins chères." : "Achetez l'amélioration « Auto-achat » dans la boutique d'Étoiles.", s.autoBuy, !autoBuyUnlocked)}
            ${switchRow("autoManager", "Gérant virtuel", managerUnlocked ? "Active les automatisations disponibles dans les jeux." : "Débloqué avec une Couronne de prestige.", s.autoManager, !managerUnlocked)}
          </div>
        </section>

        <div style="display:flex;flex-direction:column;gap:14px">
          <section class="panel">
            <div class="panel-head"><h3>💾 Sauvegarde</h3><span class="panel-hint">Locale</span></div>
            <div class="panel-body">
              <p class="muted" style="font-size:10.5px;line-height:1.55">Votre progression est stockée dans ce navigateur. Exportez régulièrement pour ne rien perdre.</p>
              <div class="settings-actions">
                <button class="btn btn-ghost btn-sm" id="save-now">Sauvegarder</button>
                <button class="btn btn-ghost btn-sm" id="export-save">Exporter .json</button>
                <button class="btn btn-ghost btn-sm" id="copy-save">Copier</button>
                <button class="btn btn-ghost btn-sm" id="import-save">Importer</button>
              </div>
              <div class="divider"></div>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><span class="muted" style="font-size:9.5px">Dernière sauvegarde : ${App.state.lastSaved ? U.timeAgo(App.state.lastSaved) : "—"}</span><button class="btn btn-danger btn-sm" id="reset-save">Réinitialiser</button></div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-head"><h3>🎓 Aide & à propos</h3></div>
            <div class="panel-body">
              <div class="settings-actions" style="margin-top:0">
                <button class="btn btn-ghost btn-sm" id="show-help">Comment jouer</button>
                <button class="btn btn-ghost btn-sm" data-route="achievements">Succès</button>
              </div>
              <div class="divider"></div>
              <p class="muted" style="font-size:10px;line-height:1.6">Neon Jackpot v1.0.0 · jeu incrémental indépendant.<br>Toutes les monnaies sont virtuelles. Aucun argent réel, aucune publicité, aucun achat réel.<br><a href="${U.repoUrl()}" target="_blank" rel="noopener">Code source sur GitHub ↗</a></p>
            </div>
          </section>

          <section class="panel panel-pad" style="background:linear-gradient(145deg,rgba(255,79,216,.07),rgba(255,255,255,.01))">
            <div class="eyebrow">État du compte</div>
            <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:10px">
              <div><div style="font-family:var(--mono);font-size:18px;color:var(--gold)">${fmt(d.tokens)}</div><div style="font-size:8.5px;color:var(--muted-2);text-transform:uppercase;letter-spacing:.1em">Jetons</div></div>
              <div><div style="font-family:var(--mono);font-size:18px;color:var(--cyan)">${fmt(d.gems)}</div><div style="font-size:8.5px;color:var(--muted-2);text-transform:uppercase;letter-spacing:.1em">Gemmes</div></div>
              <div><div style="font-family:var(--mono);font-size:18px;color:var(--pink-soft)">${fmt(d.goldBalls)}</div><div style="font-size:8.5px;color:var(--muted-2);text-transform:uppercase;letter-spacing:.1em">Billes d'or</div></div>
              <div><div style="font-family:var(--mono);font-size:18px;color:var(--text)">${d.level}</div><div style="font-size:8.5px;color:var(--muted-2);text-transform:uppercase;letter-spacing:.1em">Niveau</div></div>
            </div>
            <p class="muted" style="font-size:9.5px;margin-top:12px">Sauvegarde créée le ${new Date(d.createdAt).toLocaleDateString("fr-FR")}. Session actuelle : ${U.formatDuration(Date.now() - d.sessionStart, true)}.</p>
          </section>
        </div>
      </div>`;

    container.querySelectorAll("[data-setting]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.setting;
        if (key === "autoBuy" && !autoBuyUnlocked) return;
        if (key === "autoManager" && !managerUnlocked) return;
        d.settings[key] = !d.settings[key];
        btn.classList.toggle("on", d.settings[key]);
        btn.setAttribute("aria-checked", d.settings[key]);
        App.ui.applySettings();
        App.audio.play("click");
        App.state.saveSoon();
      });
    });

    const quality = container.querySelector("#setting-quality");
    if (quality) {
      quality.addEventListener("change", () => {
        d.settings.quality = quality.value;
        App.ui.applySettings();
        App.state.saveSoon();
        App.ui.toast("Qualité mise à jour", "Les particules s'adaptent à votre choix.", "✨", "");
      });
    }
    const volume = container.querySelector("#setting-volume");
    if (volume) {
      volume.addEventListener("input", () => {
        d.settings.volume = parseInt(volume.value, 10) / 100;
        App.audio.setVolume(d.settings.volume);
        const label = volume.closest(".settings-row").querySelector(".settings-desc");
        if (label) label.textContent = Math.round(d.settings.volume * 100) + " %";
        App.state.saveSoon();
      });
    }
    const saveNow = container.querySelector("#save-now");
    if (saveNow) saveNow.addEventListener("click", () => {
      App.state.save(true);
      App.ui.toast("Sauvegardé", "Votre progression est en sécurité dans ce navigateur.", "💾", "success");
    });
    const exportBtn = container.querySelector("#export-save");
    if (exportBtn) exportBtn.addEventListener("click", () => {
      U.download("neon-jackpot-sauvegarde-" + new Date().toISOString().slice(0, 10) + ".json", App.state.export());
      App.ui.toast("Export lancé", "Le fichier de sauvegarde a été téléchargé.", "📤", "success");
    });
    const copyBtn = container.querySelector("#copy-save");
    if (copyBtn) copyBtn.addEventListener("click", async () => {
      const ok = await U.copy(App.state.export());
      App.ui.toast(ok ? "Copié" : "Impossible de copier", ok ? "La sauvegarde est dans le presse-papiers." : "Utilisez l'export .json.", "📋", ok ? "success" : "danger");
    });
    const importBtn = container.querySelector("#import-save");
    if (importBtn) importBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.addEventListener("change", async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          App.ui.confirm({
            title: "Importer la sauvegarde ?",
            message: "La sauvegarde actuelle sera remplacée et la page va se recharger. Cette action est irréversible.",
            confirmLabel: "Importer",
            danger: true,
            onConfirm: () => {
              try {
                App.state.import(text);
              } catch (err) {
                App.ui.toast("Import impossible", err.message, "⚠️", "danger");
              }
            }
          });
        } catch (err) {
          App.ui.toast("Lecture impossible", "Le fichier n'a pas pu être lu.", "⚠️", "danger");
        }
      });
      input.click();
    });
    const resetBtn = container.querySelector("#reset-save");
    if (resetBtn) resetBtn.addEventListener("click", () => {
      App.ui.confirm({
        title: "Tout réinitialiser ?",
        message: "Tout sera perdu : jetons, niveau, succès, collections, prestige. Cette action est définitive. Exportez votre sauvegarde avant si vous avez un doute.",
        confirmLabel: "Tout supprimer",
        danger: true,
        onConfirm: () => App.state.reset()
      });
    });
    const help = container.querySelector("#show-help");
    if (help) help.addEventListener("click", () => App.ui.helpModal());

    return null;
  }

  // ============================================================
  // ROUTEUR DE PAGES
  // ============================================================
  Pages.render = function (id, container) {
    switch (id) {
      case "hub": return renderHub(container);
      case "quests": return renderQuests(container);
      case "achievements": return renderAchievements(container);
      case "collections": return renderCollections(container);
      case "synergies": return renderSynergies(container);
      case "prestige": return renderPrestige(container);
      case "shop": return renderShop(container);
      case "stats": return renderStats(container);
      case "settings": return renderSettings(container);
      default: return renderHub(container);
    }
  };

  App.pages = Pages;
})();
