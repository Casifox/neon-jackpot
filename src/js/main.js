/* ============================================================
   NEON JACKPOT — main.js
   Initialisation, boucle de jeu, sauvegarde, événements
   ============================================================ */
(function () {
  "use strict";

  const App = window.App;

  function boot() {
    if (!window.GAME_DATA) {
      const splash = document.getElementById("splash");
      if (splash) splash.remove();
      document.body.insertAdjacentHTML("beforeend", '<div style="position:fixed;inset:0;display:grid;place-content:center;background:#07070f;color:#fff;font-family:sans-serif;text-align:center;padding:30px"><h1>Données introuvables</h1><p>Lancez <code>npm run build:data</code> pour générer le bundle.</p></div>');
      return;
    }
    const U = App.utils;
    App.state.load();
    const d = App.state.data;
    d.sessionStart = Date.now();
    d.lastSeen = Date.now();

    // Sécurité : aucune automatisation ne doit reprendre toute seule après un rechargement.
    let hadActiveAuto = false;
    Object.keys(d.games).forEach((id) => {
      const g = d.games[id];
      if (!g) return;
      if (g.autoOn) { g.autoOn = false; hadActiveAuto = true; }
      if (g.autoSpins > 0) { g.autoSpins = 0; hadActiveAuto = true; }
      if (g.autoMode) { g.autoMode = false; hadActiveAuto = true; }
      if (g.autoBet) { g.autoBet = false; hadActiveAuto = true; }
    });
    App.state.saveSoon();

    App.fx.init();
    App.audio.setEnabled(!!d.settings.sound);
    App.audio.setVolume(d.settings.volume === undefined ? 0.55 : d.settings.volume);
    App.meta.init();
    App.ui.init();
    App.ui.route((location.hash || "").replace(/^#\/?/, "").trim() || "hub");

    if (d.settings.reducedMotion) document.body.classList.add("reduce-motion");
    App.fx.setReducedMotion(!!d.settings.reducedMotion);

    // Splash
    const splash = document.getElementById("splash");
    if (splash) {
      setTimeout(() => {
        splash.classList.add("done");
        setTimeout(() => splash.remove(), 750);
      }, 550);
    }

    if (hadActiveAuto) {
      setTimeout(() => {
        App.ui.toast("Automatisations arrêtées", "Par sécurité, l'auto ne reprend pas après un rechargement. Relancez-le quand vous voulez.", "🤖", "");
      }, 1400);
    }

    // Modale de bienvenue / hors-ligne
    setTimeout(() => {
      const welcomePending = (() => {
        try {
          const v = sessionStorage.getItem("neon_jackpot_welcome_pending") === "1";
          if (v) sessionStorage.removeItem("neon_jackpot_welcome_pending");
          return v;
        } catch (_) { return false; }
      })();
      const offline = App.meta.offlineGains();
      if (offline && offline.tokens > 0) {
        App.ui.offlineModal(offline);
      } else if ((App.state.isNew || welcomePending) && d.settings.showTutorial) {
        App.ui.modal({
          title: "Bienvenue au Neon Jackpot",
          subtitle: "Un casino incrémental, 100 % virtuel.",
          className: "modal-lg",
          body: `<div class="modal-center" style="text-align:left">
            <div class="modal-hero-icon" style="margin-left:0">🎰</div>
            <p style="font-size:12px;line-height:1.7;color:var(--muted)">Lâchez des billes, misez sur le noir et laissez les rouleaux tourner. Chaque partie vous rapporte de l'XP, chaque niveau débloque de nouveaux jeux, et chaque prestige rend le casino plus fou.</p>
            <div style="display:grid;gap:7px;margin-top:14px;font-size:11.5px">
              <div style="display:flex;gap:8px"><span>🔻</span><span><strong style="color:var(--text)">Commencez par le Plinko.</strong> Améliorez vos billes et visez les bords.</span></div>
              <div style="display:flex;gap:8px"><span>📜</span><span><strong style="color:var(--text)">Suivez les objectifs.</strong> Les quêtes et succès donnent des gemmes et des bonus permanents.</span></div>
              <div style="display:flex;gap:8px"><span>⭐</span><span><strong style="color:var(--text)">Au niveau 40, renaissez.</strong> Le prestige accélère chaque boucle.</span></div>
            </div>
            <p class="muted" style="font-size:9.5px;margin-top:14px">Toutes les monnaies sont virtuelles. Aucun argent réel, aucune boutique payante.</p>
          </div>`,
          actions: [
            { label: "Voir le guide", className: "btn-ghost", onClick: () => App.ui.helpModal() },
            { label: "Jouer au Plinko", className: "btn-primary", onClick: () => App.ui.navigate("plinko") }
          ],
          onClose: () => {
            d.tutorialSeen.welcome = true;
            App.state.saveSoon();
          }
        });
      }
    }, 900);

    // Boucle principale
    let lastSecond = performance.now();
    let lastSave = performance.now();
    let lastSlow = 0;
    let lastEvent = 0;
    let lastAuto = 0;
    let pauseShown = false;

    setInterval(() => {
      const now = performance.now();
      const delta = Math.min(5000, now - lastSecond);
      lastSecond = now;
      if (document.hidden) return;
      d.stats.playTimeMs = (d.stats.playTimeMs || 0) + delta;
      d.playTime = (d.playTime || 0) + delta;
      App.ui.tick();
      const sessionMs = Date.now() - d.sessionStart;
      if (d.settings.pauseReminder && !pauseShown && sessionMs > 2 * 3600 * 1000) {
        pauseShown = true;
        App.ui.pauseModal();
      }
      if (now - lastSave > 15000 && d.settings.autoSave) {
        lastSave = now;
        App.state.save();
      }
      if (now - lastSlow > 8000) {
        lastSlow = now;
        App.meta.cleanupBuffs();
        App.meta.checkAchievements();
      }
      if (now - lastEvent > 8000) {
        lastEvent = now;
        App.meta.checkEvents();
      }
      if (now - lastAuto > 4000) {
        lastAuto = now;
        App.meta.autoBuyTick();
        if (App.ui.updateHud) App.ui.updateHud();
      }
    }, 1000);

    // Sauvegarde à la sortie / au changement d'onglet
    window.addEventListener("beforeunload", () => {
      d.lastSeen = Date.now();
      App.state.save();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        d.lastSeen = Date.now();
        App.state.save();
      }
    });

    // Repère les erreurs d'exécution sans bloquer le jeu
    window.addEventListener("error", (e) => {
      const msg = String(e.message || (e.error && e.error.message) || "");
      if (msg.includes("ResizeObserver loop")) return;
      console.error("[neon]", e.error || e.message);
    });

    // API de secours pour les curieux / tests
    window.NEON = {
      state: App.state,
      meta: App.meta,
      ui: App.ui,
      fx: App.fx,
      audio: App.audio,
      save: () => App.state.save(true),
      reset: () => App.state.reset()
    };

    App.ready = true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
