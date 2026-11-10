/* ============================================================
   NEON JACKPOT — games/vault.js
   Salle des coffres : récompense secrète quotidienne
   ============================================================ */
(function () {
  "use strict";

  const App = window.App;
  const U = App.utils;
  const D = window.GAME_DATA;
  const CFG = D.balance.vault;

  const Game = {};
  let activeCleanup = null;

  Game.render = function (container) {
    if (activeCleanup) activeCleanup();
    const d = App.state.data;
    const g = d.games.vault;

    let revealed = false;
    let chosen = -1;
    let lastReward = null;
    let destroyed = false;
    let timer = null;
    let autoOn = false;
    let autoTimer = null;

    const cooldownMs = CFG.cooldownHours * 3600 * 1000;
    const remaining = () => Math.max(0, (g.lastOpen || 0) + cooldownMs - Date.now());
    const ready = () => remaining() <= 0;

    function render() {
      const root = container.querySelector("#vault-root");
      if (!root) return;
      const can = ready();
      root.innerHTML = `
        <div class="vault-stage">
          <div class="eyebrow gold">Salle des coffres · Jeu secret</div>
          <h2 class="vault-title" style="font-size:clamp(24px,4vw,36px);margin-top:6px">Trois coffres. <span class="gradient-text">Un seul élu.</span></h2>
          <p class="vault-sub">Une clé par jour, offerte aux habitués du casino. Choisissez bien.</p>
          <div class="chest-grid">
            ${[0, 1, 2].map((i) => `<button class="chest ${revealed ? "opened" : ""}" data-vault-chest="${i}" ${!can || revealed ? "disabled" : ""}>
              <span class="chest-emoji">${revealed && chosen === i ? "✨" : "🎁"}</span>
              <span class="chest-label">Coffre ${i + 1}</span>
              <span class="chest-shine"></span>
            </button>`).join("")}
          </div>
          <div class="vault-reward">
            ${lastReward ? `<strong>${lastReward.icon} ${lastReward.title}</strong><span>${lastReward.desc}</span>` : can ? `<span class="badge gold">Clé disponible</span>` : `<span class="vault-cooldown">⏳ Prochaine clé dans <strong>${U.formatCountdown(remaining())}</strong></span>`}
          </div>
          <div style="display:flex;justify-content:center;gap:8px;margin-top:14px;flex-wrap:wrap">
            <button class="btn ${autoOn ? "btn-cyan" : "btn-ghost"} btn-sm" data-vault-auto>🤖 ${autoOn ? "Auto actif" : "Auto (coffre aléatoire)"}</button>
          </div>
          <div style="max-width:520px;margin:26px auto 0;padding:14px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.02)">
            <p class="muted" style="font-size:10px;line-height:1.7;margin:0">« Les coffres ne contiennent pas d'argent. Ils contiennent des possibilités. » — Le Croupier.<br><br>La salle se recharge toutes les ${CFG.cooldownHours} heures. Chaque ouverture augmente votre collection secrète.</p>
          </div>
        </div>`;
    }

    function chooseChest(index) {
      if (!ready() || revealed) {
        App.audio.play("error");
        return;
      }
      chosen = index;
      revealed = true;
      autoOn = false;
      g.lastOpen = Date.now();
      g.stats.wins += 1;
      g.stats.plays += 1;
      const rewardWeights = Object.keys(CFG.rewards).map((k) => ({ key: k, weight: CFG.rewards[k].weight || 1 }));
      const rewardKey = U.weightedPick(rewardWeights, "weight").key;
      const def = CFG.rewards[rewardKey];
      let reward;
      if (rewardKey === "tokens") {
        const amount = Math.floor(U.rand(def.min, def.max) * (1 + d.level * 0.35));
        App.meta.bonus(amount, { silent: true });
        reward = { icon: "🪙", title: "Bourse de jetons", desc: "+" + U.fmt(amount) + " jetons" };
      } else if (rewardKey === "gems") {
        const amount = Math.floor(U.rand(def.min, def.max));
        App.meta.grant("gems", amount, {});
        reward = { icon: "💎", title: "Écrin de gemmes", desc: "+" + amount + " gemmes" };
      } else if (rewardKey === "goldBalls") {
        const amount = Math.floor(U.rand(def.min, def.max));
        App.meta.grant("goldBalls", amount, {});
        reward = { icon: "🟡", title: "Billes d'or", desc: "+" + amount + " billes d'or" };
      } else {
        const res = App.meta.grantCollectionItem(null, { avoidDuplicates: true });
        reward = res && res.item ? { icon: res.item.setIcon || "🎴", title: res.item.name, desc: res.duplicate ? "Doublon converti en gemmes" : "Objet de collection" } : { icon: "🎴", title: "Objet de collection", desc: "Un doublon converti en gemmes" };
      }
      lastReward = reward;
      App.audio.play("chest");
      App.fx.confetti(100);
      App.fx.jackpot();
      App.state.log("🗝️", "Salle des coffres", reward.title);
      App.state.saveSoon();
      render();
      const status = container.querySelector("#vault-status");
      if (status) status.textContent = "Recharge";
      const opens = container.querySelector("#vault-opens");
      if (opens) opens.textContent = String(g.stats.plays);
      App.ui.modal({
        title: "Le coffre s'ouvre…",
        subtitle: "Le Croupier vous observe.",
        className: "modal-sm",
        body: `<div class="modal-center"><div class="modal-hero-icon" style="font-size:34px">${reward.icon}</div><h3 style="font-size:24px;color:var(--gold);margin-top:4px">${U.escapeHtml(reward.title)}</h3><p class="muted" style="font-size:11.5px;margin-top:5px">${U.escapeHtml(reward.desc)}</p><div class="reward-row"><span class="reward-pill">Prochaine clé dans ${CFG.cooldownHours} h</span></div></div>`,
        actions: [{ label: "Refermer le coffre", className: "btn-gold" }]
      });
      App.meta.checkAchievements();
    }

    // Init
    const gm = App.meta.gameMeta("vault");
    container.innerHTML = `
      <div class="game-header">
        <div class="game-title-wrap"><span class="game-title-icon">${gm.icon}</span><div><h1>Salle des coffres</h1><p>${gm.tagline}</p></div></div>
        <div class="game-header-stats">
          <span class="game-stat-chip">Ouvertures <strong id="vault-opens">${g.stats.plays}</strong></span>
          <span class="game-stat-chip">Butin <strong>${g.stats.wins}</strong></span>
          <span class="game-stat-chip">Statut <strong id="vault-status">${ready() ? "Prêt" : "Recharge"}</strong></span>
        </div>
      </div>
      <section class="game-stage"><div id="vault-root"></div></section>`;
    render();

    container.addEventListener("click", (e) => {
      const auto = e.target.closest("[data-vault-auto]");
      if (auto) {
        autoOn = !autoOn;
        App.audio.play("click");
        if (autoOn) {
          if (ready()) {
            if (autoTimer) clearTimeout(autoTimer);
            autoTimer = setTimeout(() => {
              autoTimer = null;
              if (!destroyed && !revealed && ready()) chooseChest(Math.floor(Math.random() * 3));
            }, 700);
          } else {
            autoOn = false;
            App.ui.toast("Auto-coffre", "La clé n'est pas encore rechargée. Revenez dans " + U.formatCountdown(remaining()) + ".", "🗝️", "");
          }
        } else if (autoTimer) {
          clearTimeout(autoTimer);
          autoTimer = null;
        }
        render();
        return;
      }
      const chest = e.target.closest("[data-vault-chest]");
      if (chest) chooseChest(parseInt(chest.dataset.vaultChest, 10));
    });

    timer = setInterval(() => {
      if (destroyed) return;
      render();
    }, 1000);

    const cleanup = () => {
      destroyed = true;
      if (timer) clearInterval(timer);
      if (autoTimer) clearTimeout(autoTimer);
      timer = null;
      autoTimer = null;
      activeCleanup = null;
    };
    activeCleanup = cleanup;
    return cleanup;
  };

  App.games = App.games || {};
  App.games.vault = Game;
})();
