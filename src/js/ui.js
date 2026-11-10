/* ============================================================
   NEON JACKPOT — ui.js
   Navigation, HUD, modales, toasts, effets d'interface
   ============================================================ */
(function () {
  "use strict";

  const App = window.App;
  const U = App.utils;
  const D = window.GAME_DATA;
  const UNL = D.unlocks;
  const BAL = D.balance;

  const UI = {};

  const PAGES = {
    hub: { name: "Accueil", sub: "Bienvenue dans la lumière.", icon: "🏠", feature: null },
    quests: { name: "Quêtes", sub: "Des objectifs courts, des récompenses réelles.", icon: "📜", feature: "quests" },
    achievements: { name: "Succès", sub: "Plus de 200 trophées à décrocher.", icon: "🏆", feature: "achievements" },
    collections: { name: "Collections", sub: "Billes, cartes, tables, avatars et écurie.", icon: "🎴", feature: "collections" },
    synergies: { name: "Synergies", sub: "Quand les jeux se répondent entre eux.", icon: "🔗", feature: "synergies" },
    prestige: { name: "Prestige", sub: "Renaître plus fort, encore et encore.", icon: "⭐", feature: null },
    shop: { name: "Boutique", sub: "Dépensez vos gemmes et vos billes d'or.", icon: "🛒", feature: "gems" },
    stats: { name: "Statistiques", sub: "Tout ce que le casino sait de vous.", icon: "📊", feature: "stats" },
    settings: { name: "Réglages", sub: "Son, animations, sauvegarde et confort.", icon: "⚙️", feature: null }
  };

  const NAV_META_ORDER = ["quests", "achievements", "collections", "shop", "synergies", "prestige", "stats", "settings"];

  UI.PAGES = PAGES;
  UI.activeRoute = null;
  UI.currentModal = null;
  UI._unlockQueue = [];
  UI._toasts = [];
  UI._tokenTween = null;
  UI._gemsTween = null;
  UI._tokensShown = null;
  UI._gemsShown = null;
  UI._lastBailout = null;

  UI.init = function () {
    UI.els = {
      sidebar: document.getElementById("sidebar"),
      backdrop: document.getElementById("sidebar-backdrop"),
      menuBtn: document.getElementById("menu-btn"),
      closeBtn: document.getElementById("sidebar-close"),
      navGames: document.getElementById("nav-games"),
      navMeta: document.getElementById("nav-meta"),
      view: document.getElementById("view"),
      pageTitle: document.getElementById("page-title"),
      pageSub: document.getElementById("page-sub"),
      tokens: document.getElementById("hud-tokens-value"),
      gems: document.getElementById("hud-gems-value"),
      prestige: document.getElementById("hud-prestige"),
      prestigeValue: document.getElementById("hud-prestige-value"),
      prestigeIcon: document.getElementById("hud-prestige-icon"),
      level: document.getElementById("hud-level"),
      xpFill: document.getElementById("hud-xp-fill"),
      xpLabel: document.getElementById("hud-xp-label"),
      sound: document.getElementById("btn-sound"),
      avatar: document.getElementById("hud-avatar"),
      profileName: document.getElementById("profile-name"),
      profileTitle: document.getElementById("profile-title"),
      buffBar: document.getElementById("buff-bar"),
      eventBanner: document.getElementById("event-banner"),
      bailout: document.getElementById("bailout-fab"),
      modalRoot: document.getElementById("modal-root"),
      toastRoot: document.getElementById("toast-root"),
      repoLink: document.getElementById("repo-link"),
      repoLink2: document.getElementById("repo-link-2"),
      version: document.getElementById("footer-version")
    };

    buildNav();
    bindEvents();
    applySettings();
    updateRepoLinks();
    UI.updateHud(true);
    UI.updateBuffs();
    UI.updateEventBanner();
    UI.updateBailout();

    App.bus.on("currency:change", () => { UI.updateHud(); UI.updateBailout(); });
    App.bus.on("levelup", () => { UI.updateHud(); UI.updateNav(); });
    App.bus.on("xp:gain", () => UI.updateHud());
    App.bus.on("game:unlocked", () => UI.updateNav());
    App.bus.on("unlocks:changed", () => UI.updateNav());
    App.bus.on("achievement:unlock", () => UI.updateNav());
    App.bus.on("quest:claim", () => UI.updateNav());
    App.bus.on("buff:change", () => UI.updateBuffs());
    App.bus.on("event:start", () => UI.updateEventBanner());
    App.bus.on("event:end", () => UI.updateEventBanner());
    App.bus.on("synergy:unlock", () => UI.updateHud());
    App.bus.on("rebirth:done", () => { UI.updateHud(true); UI.updateNav(); UI.refreshPage(); });
    App.bus.on("autobuy", () => UI.updateHud());

    if (UI.els.version) UI.els.version.textContent = "v1.4.1";
  };

  function buildNav() {
    const d = App.state.data;
    UI.els.navGames.innerHTML = App.meta.GAME_LIST.concat([App.meta.GAME_META.vault]).map((game) => {
      const locked = !App.meta.isGameUnlocked(game.id);
      const req = App.meta.gameUnlockLevel(game.id);
      const badge = locked ? `<span class="nav-badge">Niv. ${game.id === "vault" ? "??" : req}</span>` : "";
      return `<button class="nav-item ${locked ? "locked" : ""}" data-route="${game.id}" data-game-nav="${game.id}">
        <span class="nav-icon">${game.icon}</span>
        <span class="nav-name">${game.name}</span>
        ${badge}
      </button>`;
    }).join("");

    UI.els.navMeta.innerHTML = NAV_META_ORDER.map((id) => {
      const page = PAGES[id];
      const locked = page.feature ? !App.meta.canUseFeature(page.feature) : false;
      const req = page.feature ? App.meta.featureLevel(page.feature) : 0;
      const badge = locked ? `<span class="nav-badge">Niv. ${req}</span>` : "";
      return `<button class="nav-item ${locked ? "locked" : ""}" data-route="${id}" data-meta-nav="${id}">
        <span class="nav-icon">${page.icon}</span>
        <span class="nav-name">${page.name}</span>
        ${badge}
      </button>`;
    }).join("");
  }

  function bindEvents() {
    document.addEventListener("click", (e) => {
      const routeEl = e.target.closest("[data-route]");
      if (routeEl) {
        e.preventDefault();
        UI.navigate(routeEl.getAttribute("data-route"));
        return;
      }
      const closeEl = e.target.closest("[data-close-modal]");
      if (closeEl) {
        UI.closeModal();
      }
    });

    if (UI.els.menuBtn) UI.els.menuBtn.addEventListener("click", openSidebar);
    if (UI.els.closeBtn) UI.els.closeBtn.addEventListener("click", closeSidebar);
    if (UI.els.backdrop) UI.els.backdrop.addEventListener("click", closeSidebar);

    if (UI.els.sound) {
      UI.els.sound.addEventListener("click", () => {
        const d = App.state.data;
        d.settings.sound = !d.settings.sound;
        applySettings();
        App.audio.setEnabled(d.settings.sound);
        if (d.settings.sound) App.audio.play("notification");
        toast(d.settings.sound ? "Son activé" : "Son coupé", d.settings.sound ? "Les effets sonores sont de retour." : "Le casino tourne en silence.", d.settings.sound ? "🔊" : "🔇", "");
        App.state.saveSoon();
      });
    }

    if (UI.els.bailout) {
      UI.els.bailout.addEventListener("click", () => {
        const amount = App.meta.claimBailout();
        if (amount) {
          UI.updateHud();
          UI.updateBailout();
        } else {
          App.audio.play("error");
          toast("Coffre indisponible", "Il faut attendre un peu avant de pouvoir le rouvrir.", "🆘", "danger");
        }
      });
    }

    window.addEventListener("hashchange", () => {
      const id = currentHash();
      if (id && id !== UI.activeRoute) UI.route(id);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (UI.currentModal) UI.closeModal();
        else closeSidebar();
      }
    });

    // Ripple + son de clic
    document.addEventListener("pointerdown", (e) => {
      const interactive = e.target.closest("button, a, .game-card, .nav-item, .r-cell, .r-outside-btn, .tab, .bet-chip");
      if (!interactive || interactive.disabled || interactive.classList.contains("no-sound")) return;
      if (interactive.tagName === "A" && interactive.getAttribute("href") === "#") return;
      App.audio.play("click");
      if (interactive.matches(".btn, .game-card, .nav-item, .tab, .bet-chip, .r-cell, .r-outside-btn")) {
        const rect = interactive.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 1.3;
        const ripple = document.createElement("span");
        ripple.className = "ripple";
        ripple.style.width = ripple.style.height = size + "px";
        ripple.style.left = (e.clientX - rect.left - size / 2) + "px";
        ripple.style.top = (e.clientY - rect.top - size / 2) + "px";
        interactive.appendChild(ripple);
        setTimeout(() => ripple.remove(), 650);
      }
    }, { passive: true });

    // Petit son de survol sur les cartes de jeu
    document.addEventListener("pointerover", (e) => {
      const card = e.target.closest(".game-card");
      if (card && !card.dataset.hovered) {
        card.dataset.hovered = "1";
        App.audio.play("hover");
        setTimeout(() => { delete card.dataset.hovered; }, 400);
      }
    }, { passive: true });
  }

  UI.applySettings = applySettings;
  function applySettings() {
    const s = App.state.data.settings;
    document.body.classList.toggle("reduce-motion", !!s.reducedMotion);
    if (App.fx) {
      App.fx.setReducedMotion(!!s.reducedMotion);
      App.fx.setQuality(s.quality || "high");
    }
    App.audio.setEnabled(!!s.sound);
    App.audio.setVolume(s.volume === undefined ? 0.55 : s.volume);
    if (UI.els.sound) {
      UI.els.sound.textContent = s.sound ? "🔊" : "🔇";
      UI.els.sound.setAttribute("aria-label", s.sound ? "Couper le son" : "Activer le son");
    }
  }

  function updateRepoLinks() {
    const url = U.repoUrl();
    if (UI.els.repoLink) UI.els.repoLink.href = url;
    if (UI.els.repoLink2) UI.els.repoLink2.href = url;
    if (url === "https://github.com/") {
      if (UI.els.repoLink) UI.els.repoLink.textContent = "GitHub ↗";
      if (UI.els.repoLink2) UI.els.repoLink2.textContent = "GitHub";
    }
  }

  UI.repoUrl = U.repoUrl;

  function openSidebar() {
    UI.els.sidebar.classList.add("open");
    UI.els.backdrop.classList.add("on");
  }
  function closeSidebar() {
    UI.els.sidebar.classList.remove("open");
    UI.els.backdrop.classList.remove("on");
  }

  function currentHash() {
    return (location.hash || "").replace(/^#\/?/, "").trim();
  }

  UI.navigate = function (id) {
    closeSidebar();
    if (!id) id = "hub";
    if (currentHash() === id) {
      UI.route(id, true);
    } else {
      location.hash = id;
    }
  };

  UI.route = function (id, force) {
    id = id || "hub";
    const isGame = !!App.meta.GAME_META[id];
    const isPage = !!PAGES[id];
    if (!isGame && !isPage) id = "hub";
    const d = App.state.data;

    if (UI.activeCleanup) {
      try { UI.activeCleanup(); } catch (err) { console.warn("[cleanup]", err); }
      UI.activeCleanup = null;
    }
    UI.activeRoute = id;
    UI.els.view.innerHTML = "";
    UI.els.view.classList.remove("view-enter");
    void UI.els.view.offsetWidth;
    UI.els.view.classList.add("view-enter");

    let title = "Accueil";
    let sub = PAGES.hub.sub;

    if (isGame) {
      const gm = App.meta.gameMeta(id);
      title = gm.name;
      sub = gm.tagline;
      if (!App.meta.isGameUnlocked(id)) {
        UI.renderLockedGame(id);
      } else if (App.games[id] && typeof App.games[id].render === "function") {
        try {
          UI.activeCleanup = App.games[id].render(UI.els.view) || null;
        } catch (err) {
          console.error("[game]", id, err);
          UI.els.view.innerHTML = `<div class="panel panel-pad"><div class="empty-state"><div class="empty-icon">🛠️</div><strong>Ce jeu a eu un souci</strong><span>${U.escapeHtml(err.message)}</span><button class="btn btn-ghost" data-route="hub">Retour à l'accueil</button></div></div>`;
        }
      } else {
        UI.els.view.innerHTML = `<div class="panel panel-pad"><div class="empty-state"><div class="empty-icon">🚧</div><strong>Bientôt disponible</strong><span>Ce jeu est en préparation.</span></div></div>`;
      }
    } else {
      const page = PAGES[id];
      title = page.name;
      sub = page.sub;
      if (page.feature && !App.meta.canUseFeature(page.feature)) {
        UI.renderLockedPage(id);
      } else if (App.pages && typeof App.pages.render === "function") {
        try {
          UI.activeCleanup = App.pages.render(id, UI.els.view) || null;
        } catch (err) {
          console.error("[page]", id, err);
          UI.els.view.innerHTML = `<div class="panel panel-pad"><div class="empty-state"><div class="empty-icon">🛠️</div><strong>Page indisponible</strong><span>${U.escapeHtml(err.message)}</span></div></div>`;
        }
      }
    }

    UI.els.pageTitle.textContent = title;
    UI.els.pageSub.textContent = sub;
    document.title = `${title} · Neon Jackpot`;
    UI.updateNav();
    UI.updateHud();
    UI.updateBuffs();
    UI.updateEventBanner();
    window.scrollTo({ top: 0, behavior: d.settings.reducedMotion ? "auto" : "smooth" });
    App.state.saveSoon();
  };

  UI.refreshPage = function () {
    if (UI.activeRoute) UI.route(UI.activeRoute, true);
  };

  UI.renderLockedGame = function (id) {
    const gm = App.meta.gameMeta(id);
    const req = App.meta.gameUnlockLevel(id);
    const d = App.state.data;
    let condition = "";
    if (id === "vault") {
      condition = `Atteindre ${U.fmt(BAL.vault.unlockWins)} victoires et gagner dans au moins ${BAL.vault.unlockGames} jeux différents.`;
    } else {
      condition = `Atteindre le niveau ${req}.`;
    }
    const pct = id === "vault" ? U.clamp(d.stats.totalWins / BAL.vault.unlockWins, 0, 1) : U.clamp(d.maxLevel / req, 0, 1);
    UI.els.view.innerHTML = `
      <div class="panel panel-pad" style="max-width:680px;margin:40px auto;text-align:center">
        <div class="modal-hero-icon" style="width:88px;height:88px;font-size:42px;margin-bottom:18px">${gm.icon}</div>
        <span class="eyebrow">Jeu verrouillé</span>
        <h2 style="font-size:28px;margin:8px 0 4px">${gm.name}</h2>
        <p class="muted" style="font-size:12px;max-width:440px;margin:0 auto 18px">${gm.description}</p>
        <div class="progress" style="max-width:360px;margin:0 auto"><i style="width:${pct * 100}%"></i></div>
        <p class="muted" style="font-size:11px;margin-top:8px">${condition}</p>
        <p style="font-family:var(--mono);color:var(--gold);font-size:13px;margin-top:4px">${id === "vault" ? d.stats.totalWins + " / " + BAL.vault.unlockWins + " victoires" : "Niveau " + d.maxLevel + " / " + req}</p>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:22px;flex-wrap:wrap">
          <button class="btn btn-primary" data-route="hub">Retour à l'accueil</button>
          <button class="btn btn-ghost" data-route="quests">Voir les quêtes</button>
        </div>
      </div>`;
  };

  UI.renderLockedPage = function (id) {
    const page = PAGES[id];
    const req = App.meta.featureLevel(page.feature);
    const d = App.state.data;
    UI.els.view.innerHTML = `
      <div class="panel panel-pad" style="max-width:620px;margin:40px auto;text-align:center">
        <div class="modal-hero-icon" style="font-size:30px">${page.icon}</div>
        <span class="eyebrow">Déblocage</span>
        <h2 style="margin:8px 0 4px">${page.name}</h2>
        <p class="muted" style="font-size:12px">Disponible au niveau ${req}.</p>
        <div class="progress" style="max-width:320px;margin:16px auto 6px"><i style="width:${U.clamp(d.maxLevel / req, 0, 1) * 100}%"></i></div>
        <p style="font-family:var(--mono);color:var(--gold);font-size:12px">Niveau ${d.maxLevel} / ${req}</p>
        <button class="btn btn-primary" data-route="hub" style="margin-top:18px">Retour à l'accueil</button>
      </div>`;
  };

  // ---------------- HUD ----------------
  UI.updateHud = function (instant) {
    if (!UI.els || !App.state.data) return;
    const d = App.state.data;
    const fmt = U.fmt;

    if (UI.els.tokens) {
      if (instant || UI._tokensShown === null) {
        UI.els.tokens.textContent = fmt(d.tokens);
        UI._tokensShown = d.tokens;
      } else if (Math.abs(UI._tokensShown - d.tokens) > 0.01) {
        if (UI._tokenTween) UI._tokenTween();
        const from = UI._tokensShown;
        const to = d.tokens;
        UI._tokenTween = U.tween(from, to, 420, (v) => {
          UI.els.tokens.textContent = fmt(v);
          UI._tokensShown = v;
        }, () => { UI._tokensShown = to; UI.els.tokens.textContent = fmt(to); });
      }
    }
    if (UI.els.gems) {
      if (instant || UI._gemsShown === null) {
        UI.els.gems.textContent = fmt(d.gems);
        UI._gemsShown = d.gems;
      } else if (d.gems !== UI._gemsShown) {
        if (UI._gemsTween) UI._gemsTween();
        const from = UI._gemsShown;
        UI._gemsTween = U.tween(from, d.gems, 420, (v) => {
          UI.els.gems.textContent = fmt(v);
          UI._gemsShown = v;
        }, () => { UI._gemsShown = d.gems; });
      }
    }
    if (UI.els.level) UI.els.level.textContent = d.level;
    const xp = App.state.xpProgress();
    if (UI.els.xpFill) UI.els.xpFill.style.width = (xp.pct * 100).toFixed(2) + "%";
    if (UI.els.xpLabel) UI.els.xpLabel.textContent = U.fmt(xp.current) + " / " + U.fmt(xp.need) + " XP";

    const pc = App.state.prestigeCurrency();
    if (UI.els.prestige) {
      const show = pc.value > 0 || d.highestRebirth > 0;
      UI.els.prestige.classList.toggle("hidden", !show);
      if (UI.els.prestigeValue) UI.els.prestigeValue.textContent = fmt(pc.value);
      if (UI.els.prestigeIcon) UI.els.prestigeIcon.textContent = pc.icon;
      if (UI.els.prestige) UI.els.prestige.title = pc.name;
    }

    const title = App.meta.titleFor(d.maxLevel);
    if (UI.els.profileTitle) UI.els.profileTitle.textContent = title.name;
    if (UI.els.profileName) UI.els.profileName.textContent = "Joueur";
    if (UI.els.avatar) UI.els.avatar.textContent = title.avatar;

    UI.updateBailout();
  };

  UI.updateBailout = function () {
    if (!UI.els || !UI.els.bailout) return;
    const ready = App.meta.bailoutReady ? App.meta.bailoutReady() : false;
    UI.els.bailout.classList.toggle("hidden", !ready);
  };

  UI.updateNav = function () {
    if (!UI.els) return;
    const d = App.state.data;
    App.meta.GAME_LIST.concat([App.meta.GAME_META.vault]).forEach((game) => {
      const el = UI.els.navGames.querySelector(`[data-game-nav="${game.id}"]`);
      if (!el) return;
      const unlocked = App.meta.isGameUnlocked(game.id);
      el.classList.toggle("locked", !unlocked);
      el.classList.toggle("active", UI.activeRoute === game.id);
      const badge = el.querySelector(".nav-badge");
      if (unlocked) {
        if (badge) badge.remove();
      } else if (!badge) {
        const b = document.createElement("span");
        b.className = "nav-badge";
        b.textContent = game.id === "vault" ? "??" : "Niv. " + App.meta.gameUnlockLevel(game.id);
        el.appendChild(b);
      }
    });
    NAV_META_ORDER.forEach((id) => {
      const el = UI.els.navMeta.querySelector(`[data-meta-nav="${id}"]`);
      if (!el) return;
      const page = PAGES[id];
      const unlocked = !page.feature || App.meta.canUseFeature(page.feature);
      el.classList.toggle("locked", !unlocked);
      el.classList.toggle("active", UI.activeRoute === id);
      let badge = el.querySelector(".nav-badge");
      if (!unlocked) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "nav-badge";
          el.appendChild(badge);
        }
        badge.textContent = "Niv. " + App.meta.featureLevel(page.feature);
        badge.classList.remove("unlocked");
      } else if (id === "quests") {
        const ready = (d.quests.daily || []).filter((q) => !q.claimed && App.meta.questComplete(q)).length +
          (d.quests.weekly && !d.quests.weekly.claimed && App.meta.questComplete(d.quests.weekly) ? 1 : 0);
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "nav-badge";
          el.appendChild(badge);
        }
        badge.textContent = ready > 0 ? String(ready) : "";
        badge.classList.toggle("dot", ready > 0);
        badge.classList.remove("unlocked");
        if (!ready) badge.remove();
      } else if (badge) {
        badge.remove();
      }
    });
  };

  UI.updateBuffs = function () {
    if (!UI.els || !UI.els.buffBar) return;
    const buffs = App.meta.activeBuffs();
    if (!buffs.length) {
      UI.els.buffBar.classList.add("hidden");
      UI.els.buffBar.innerHTML = "";
      return;
    }
    UI.els.buffBar.classList.remove("hidden");
    UI.els.buffBar.innerHTML = buffs.map((b) => {
      const remaining = U.formatCountdown(b.until - Date.now());
      return `<div class="buff-pill">
        <span class="buff-icon">${b.icon || "✨"}</span>
        <span>${U.escapeHtml(b.label)}</span>
        <span class="buff-time">${remaining}</span>
      </div>`;
    }).join("");
  };

  UI.updateEventBanner = function () {
    if (!UI.els || !UI.els.eventBanner) return;
    const event = App.meta.activeEvent();
    if (!event) {
      UI.els.eventBanner.classList.add("hidden");
      UI.els.eventBanner.innerHTML = "";
      return;
    }
    UI.els.eventBanner.classList.remove("hidden");
    const remaining = event.until ? U.formatCountdown(event.until - Date.now()) : "en cours";
    UI.els.eventBanner.innerHTML = `
      <span class="event-icon">${event.icon || "🎉"}</span>
      <div><strong>${U.escapeHtml(event.name)}</strong> <span class="event-desc">${U.escapeHtml(event.desc || "")}</span></div>
      <span class="event-time">${remaining}</span>`;
  };

  UI.tick = function () {
    UI.updateBuffs();
    UI.updateEventBanner();
    UI.updateBailout();
    UI.updateNav();
  };

  // ---------------- Toasts ----------------
  UI.toast = function (title, desc, icon, type) {
    if (!UI.els || !UI.els.toastRoot) return;
    const el = document.createElement("div");
    el.className = "toast " + (type || "");
    el.innerHTML = `
      <span class="toast-icon">${icon || "✨"}</span>
      <div class="toast-content"><strong>${U.escapeHtml(title)}</strong>${desc ? `<span>${U.escapeHtml(desc)}</span>` : ""}</div>
      <div class="toast-progress"></div>`;
    UI.els.toastRoot.appendChild(el);
    UI._toasts.push(el);
    while (UI._toasts.length > 4) {
      const old = UI._toasts.shift();
      old.remove();
    }
    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      el.classList.add("out");
      setTimeout(() => el.remove(), 350);
      UI._toasts = UI._toasts.filter((x) => x !== el);
    };
    const timer = setTimeout(remove, 4200);
    el.addEventListener("click", () => {
      clearTimeout(timer);
      remove();
    });
  };

  UI.toastReward = function (title, rewards, type) {
    const parts = [];
    if (rewards.tokens) parts.push("+" + U.fmt(rewards.tokens) + " jetons");
    if (rewards.gems) parts.push("+" + rewards.gems + " gemmes");
    if (rewards.goldBalls) parts.push("+" + rewards.goldBalls + " billes d'or");
    UI.toast(title, parts.join(" · "), type === "gem" ? "💎" : "🎁", type || "gold");
  };

  // ---------------- Modales ----------------
  UI.modal = function (opts) {
    opts = opts || {};
    const root = UI.els.modalRoot;
    if (!root) return null;
    if (UI.currentModal) {
      const old = UI.currentModal;
      old.close(true);
      root.querySelectorAll(".modal, .modal-backdrop").forEach((node) => node.remove());
      UI.currentModal = null;
      root.classList.remove("open");
      document.body.classList.remove("modal-open");
    }
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    const modal = document.createElement("div");
    modal.className = "modal " + (opts.className || "");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    const actionsHtml = (opts.actions || []).map((a, i) =>
      `<button class="btn ${a.className || "btn-ghost"}" data-modal-action="${i}">${a.label}</button>`
    ).join("");
    modal.innerHTML = `
      <div class="modal-head">
        <div>
          <h2>${opts.title || ""}</h2>
          ${opts.subtitle ? `<p>${opts.subtitle}</p>` : ""}
        </div>
        ${opts.closable === false ? "" : `<button class="modal-close" aria-label="Fermer" data-close-modal>✕</button>`}
      </div>
      <div class="modal-body">${opts.body || ""}</div>
      ${actionsHtml ? `<div class="modal-actions">${actionsHtml}</div>` : ""}`;
    root.appendChild(wrap);
    root.appendChild(modal);
    root.classList.add("open");
    document.body.classList.add("modal-open");

    let closed = false;
    const close = function (silent) {
      if (closed) return;
      closed = true;
      if (UI.currentModal && UI.currentModal.wrap === wrap) {
        UI.currentModal = null;
      }
      root.classList.remove("open");
      wrap.style.opacity = "0";
      modal.style.opacity = "0";
      modal.style.transform = "translateY(10px) scale(0.97)";
      setTimeout(() => {
        wrap.remove();
        modal.remove();
        if (!UI.currentModal) {
          root.classList.remove("open");
          document.body.classList.remove("modal-open");
        }
      }, 220);
      document.removeEventListener("keydown", onKey);
      if (!silent && opts.onClose) {
        try { opts.onClose(); } catch (err) { console.warn("[modal close]", err); }
      }
      if (!silent) UI._processUnlockQueue();
    };

    const onKey = (e) => {
      if (e.key === "Escape" && opts.closable !== false) close();
    };
    document.addEventListener("keydown", onKey);
    if (opts.closable !== false) {
      wrap.addEventListener("click", () => close());
    }

    (opts.actions || []).forEach((action, i) => {
      const btn = modal.querySelector(`[data-modal-action="${i}"]`);
      if (!btn) return;
      btn.addEventListener("click", (e) => {
        App.audio.play("click");
        let result;
        if (action.onClick) result = action.onClick(e, close);
        if (result !== false && action.close !== false) close();
      });
    });

    // Fermeture via data-close-modal dans le corps
    modal.querySelectorAll("[data-close-modal]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        close();
      });
    });

    UI.currentModal = { wrap, modal, close, opts };
    if (opts.onMount) {
      try { opts.onMount(modal, close); } catch (err) { console.error("[modal mount]", err); }
    }
    return { root: modal, close };
  };

  UI.closeModal = function (silent) {
    if (!UI.currentModal) return;
    UI.currentModal.close(silent);
  };

  UI.confirm = function (opts) {
    return UI.modal({
      title: opts.title || "Confirmer",
      subtitle: opts.subtitle || "",
      className: "modal-sm",
      body: `<p style="font-size:12.5px;line-height:1.6;color:var(--muted)">${opts.message || ""}</p>`,
      actions: [
        { label: opts.cancelLabel || "Annuler", className: "btn-ghost" },
        {
          label: opts.confirmLabel || "Confirmer",
          className: opts.danger ? "btn-danger" : "btn-primary",
          onClick: () => { if (opts.onConfirm) opts.onConfirm(); }
        }
      ]
    });
  };

  UI._processUnlockQueue = function () {
    if (UI.currentModal || !UI._unlockQueue.length) return;
    const game = UI._unlockQueue.shift();
    UI._showUnlockModal(game);
  };

  UI.unlockModal = function (game) {
    if (!game) return;
    UI._unlockQueue.push(game);
    UI._processUnlockQueue();
  };

  UI._showUnlockModal = function (game) {
    App.audio.play("unlock");
    App.fx.confetti(80);
    UI.modal({
      title: "Nouveau jeu débloqué",
      subtitle: "Le casino s'agrandit.",
      className: "modal-sm",
      body: `
        <div class="modal-center">
          <div class="modal-hero-icon" style="box-shadow:0 0 50px ${U.hexToRgba(game.color, 0.25)}">${game.icon}</div>
          <h3 style="font-size:24px;font-weight:800;letter-spacing:-0.03em">${game.name}</h3>
          <p style="margin-top:5px;font-size:12px;color:var(--muted)">${game.tagline || ""}</p>
          <p style="margin-top:9px;font-size:11px;color:var(--muted-2);line-height:1.55">${game.description || ""}</p>
          <div class="reward-row"><span class="reward-pill">+10 gemmes de bienvenue</span></div>
        </div>`,
      actions: [
        { label: "Plus tard", className: "btn-ghost" },
        { label: "Jouer maintenant", className: "btn-primary", onClick: () => { App.meta.grant("gems", 10, { silent: true }); UI.navigate(game.id); } }
      ],
      onClose: () => {
        // Donner les gemmes même si le joueur choisit "Plus tard"
        if (!UI._unlockGiftGiven) UI._unlockGiftGiven = {};
        if (!UI._unlockGiftGiven[game.id]) {
          UI._unlockGiftGiven[game.id] = true;
          App.meta.grant("gems", 10, {});
        }
        UI._processUnlockQueue();
      }
    });
  };

  UI.mysteryModal = function (def) {
    const choices = D.events.mysteryChoices || [];
    const body = `
      <div class="modal-center">
        <div class="modal-hero-icon" style="font-size:30px">🕵️</div>
        <p style="font-size:12.5px;color:var(--muted);margin-bottom:16px">« Approchez, approchez. Choisissez votre bénédiction, et ne dites rien au croupier. »</p>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${choices.map((c) => `<button class="btn btn-ghost" data-mystery="${c.id}" style="justify-content:flex-start;min-height:56px;font-size:12px">
            <span style="font-size:22px">${c.icon}</span>
            <span style="text-align:left"><strong style="display:block">${c.label}</strong><span style="font-size:9.5px;color:var(--muted)">${c.id === "tokens" ? U.fmt(c.tokens) + " jetons" : c.id === "gems" ? c.gems + " gemmes" : "+20 % de chance au Plinko pendant 10 min"}</span></span>
          </button>`).join("")}
        </div>
      </div>`;
    const m = UI.modal({
      title: "Visiteur mystérieux",
      subtitle: "Un choix, trois destins.",
      className: "modal-sm",
      body,
      actions: [],
      onMount: (root, close) => {
        root.querySelectorAll("[data-mystery]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = btn.dataset.mystery;
            App.meta.chooseMystery(id);
            close();
          });
        });
      },
      onClose: () => {
        const active = App.state.data.events.active;
        if (active && active.id === "mystery_visitor") App.state.data.events.active = null;
        UI.updateEventBanner();
      }
    });
    return m;
  };

  UI.offlineModal = function (gain) {
    if (!gain || gain.tokens <= 0) return;
    let claimed = false;
    const claim = () => {
      if (claimed) return;
      claimed = true;
      App.meta.claimOffline(gain);
      App.state.offlineElapsed = 0;
      UI.updateHud();
    };
    UI.modal({
      title: "Bon retour au casino",
      subtitle: "Le casino a tourné pendant votre absence.",
      className: "modal-sm",
      body: `
        <div class="modal-center">
          <div class="modal-hero-icon" style="font-size:30px">🌙</div>
          <p class="muted" style="font-size:11.5px">Absence : ${U.formatDuration(gain.elapsed, true)}${gain.capped ? " (plafonné à " + gain.capHours + " h)" : ""}</p>
          <div class="reward-row"><span class="reward-pill">🪙 +${U.fmt(gain.tokens)} jetons</span></div>
          <p class="muted" style="font-size:10px;margin-top:8px">Gains hors-ligne : ${Math.round(BAL.meta.offline.efficiency * 100)} % de votre rythme actif, plafond ${gain.capHours} h.</p>
        </div>`,
      actions: [{ label: "Récupérer", className: "btn-gold", onClick: claim }],
      closable: false,
      onClose: claim
    });
  };

  UI.pauseModal = function () {
    UI.modal({
      title: "Une petite pause ?",
      subtitle: "Le casino ne va pas s'envoler.",
      className: "modal-sm",
      body: `<div class="modal-center"><div class="modal-hero-icon">☕</div><p class="muted" style="font-size:12px;line-height:1.6">Vous jouez depuis 2 heures. Pensez à vous étirer, boire un verre d'eau et reposer vos yeux. Ce rappel est purement cosmétique et peut être désactivé dans les réglages.</p></div>`,
      actions: [
        { label: "Continuer", className: "btn-ghost" },
        { label: "Faire une pause", className: "btn-primary", onClick: () => { location.reload(); } }
      ]
    });
  };

  UI.helpModal = function () {
    UI.modal({
      title: "Comment jouer",
      subtitle: "Le b.a.-ba du casino incrémental.",
      className: "modal-lg",
      body: `
        <div style="display:grid;gap:12px;font-size:12px;line-height:1.6;color:var(--muted)">
          <p><strong style="color:var(--text)">1. Misez, gagnez, améliorez.</strong> Chaque partie rapporte de l'XP. Les gains achètent des améliorations qui débloquent de nouveaux paliers.</p>
          <p><strong style="color:var(--text)">2. Débloquez les 10 jeux.</strong> Plinko dès le niveau 1, puis Blackjack (10), Roulette (20), Machines à sous (30), Mines (60), Crash (75), Dés (90), Keno (100), Poker vidéo (200) et Courses (300).</p>
          <p><strong style="color:var(--text)">3. Collectionnez.</strong> Succès, quêtes, collections et synergies offrent des bonus permanents. Ouvrez des packs avec vos gemmes.</p>
          <p><strong style="color:var(--text)">4. Renaissance.</strong> Au niveau 40, effectuez un Rebirth pour gagner des Étoiles. Vous repartez plus fort, avec des bonus permanents. Les couches 2, 3 et l'infini vous attendent.</p>
          <p><strong style="color:var(--text)">5. Aucun argent réel.</strong> Toutes les monnaies sont virtuelles. Ce jeu est un jouet, pas un casino.</p>
        </div>`,
      actions: [{ label: "C'est parti", className: "btn-primary" }]
    });
  };

  UI.packModal = function (results) {
    if (!results || !results.length) return;
    const cards = results.map((res) => {
      if (!res) return "";
      const item = res.item;
      const color = item.color || (res.item.setId === "avatars" ? "#8b5cf6" : "#6d28d9");
      const visual = item.emoji || item.setIcon || "🎴";
      return `<div class="collectible rarity-${item.rarity}" style="--item-color:${color}">
        <div class="collectible-visual">${visual}</div>
        <span class="collectible-name">${item.name}</span>
        ${res.duplicate ? `<span style="font-size:7px;color:var(--cyan)">+${res.gems} 💎</span>` : ""}
      </div>`;
    }).join("");
    UI.modal({
      title: "Ouverture de packs",
      subtitle: results.length + " objets découverts.",
      className: "modal-lg",
      body: `<div class="collection-grid" style="gap:8px">${cards}</div>`,
      actions: [{ label: "Fermer", className: "btn-primary" }]
    });
    App.fx.confetti(50);
  };

  UI.collectionItemModal = function (item) {
    const color = item.color || "#8b5cf6";
    UI.modal({
      title: item.name,
      subtitle: item.setName + " · " + item.rarity,
      className: "modal-sm",
      body: `<div class="modal-center">
        <div class="collectible-visual" style="width:76px;height:76px;font-size:34px;margin:0 auto 12px;--item-color:${color}">${item.emoji || item.setIcon || "🎴"}</div>
        <p class="muted" style="font-size:11px">Objet de collection ${item.rarity}.</p>
        <div class="reward-row"><span class="reward-pill">+${(D.collections.itemBonus * 100).toFixed(2)} % de gains</span></div>
      </div>`,
      actions: [{ label: "Fermer", className: "btn-ghost" }]
    });
  };

  App.ui = UI;
})();
