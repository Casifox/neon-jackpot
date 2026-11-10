/* ============================================================
   NEON JACKPOT — games/horses.js
   Courses de chevaux : écurie, cotes, tournois, animations
   ============================================================ */
(function () {
  "use strict";

  const App = window.App;
  const U = App.utils;
  const D = window.GAME_DATA;
  const CFG = D.balance.horses;

  const Game = {};
  let activeCleanup = null;

  Game.render = function (container) {
    if (activeCleanup) activeCleanup();
    const d = App.state.data;
    const g = d.games.horses;

    let phase = "idle"; // idle | racing | done
    let raceState = null;
    let raf = null;
    let raceTimer = null;
    let autoTimer = null;
    let destroyed = false;
    let wrap = null;
    let canvas = null;
    let ctx = null;
    let W = 0;
    let H = 0;
    let dpr = 1;
    let resizeObs = null;
    let lastTime = 0;
    let tournament = null;
    let lastResult = null;
    let activeTab = "upgrades";
    let tickAt = 0;

    const betOptions = () => CFG.betSteps.slice(0, Math.min(CFG.betSteps.length, 3 + g.upgrades.maxBet));
    const currentBet = () => betOptions()[U.clamp(g.betIndex, 0, betOptions().length - 1)] || CFG.minBet;
    const horses = () => CFG.horses;
    const selectedHorse = () => horses().find((h) => h.id === g.selected) || horses()[0];
    const statOf = (horse, key) => {
      const base = horse[key] || 0;
      const trained = (g.horses[horse.id] && g.horses[horse.id][key]) || 0;
      if (key === "speed") return (base + trained) * (1 + App.meta.collectionBonus("horseSpeed") + (g.upgrades.training || 0) * 0.02);
      if (key === "stamina") return base + trained + (g.upgrades.training || 0) * 0.7;
      return base + trained + (g.upgrades.training || 0) * 0.5;
    };
    const scoreOf = (horse) => statOf(horse, "speed") * 1.9 + statOf(horse, "stamina") * 1.05 + statOf(horse, "luck") * 0.9;
    const probabilities = () => {
      const scores = horses().map(scoreOf);
      const temp = 3.2;
      const exps = scores.map((s) => Math.exp(s / temp));
      const total = exps.reduce((a, b) => a + b, 0);
      let p = exps.map((e) => e / total);
      const min = 0.035;
      p = p.map((x) => Math.max(min, x));
      const sum = p.reduce((a, b) => a + b, 0);
      return p.map((x) => x / sum);
    };
    const oddsFor = (index) => {
      const p = probabilities()[index];
      return Math.max(1.05, CFG.houseEdge / p);
    };

    function resize() {
      if (!canvas || !wrap) return;
      const rect = wrap.getBoundingClientRect();
      W = Math.max(300, rect.width);
      H = Math.min(430, Math.max(280, W * 0.5));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now(), true);
    }

    function chooseWinner(probs) {
      let roll = Math.random();
      for (let i = 0; i < probs.length; i++) {
        roll -= probs[i];
        if (roll <= 0) return i;
      }
      return probs.length - 1;
    }

    function startRace(opts) {
      opts = opts || {};
      if (phase === "racing") return;
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
      const bet = tournament ? tournament.stake : currentBet();
      if (!opts.skipBet) {
        if (!App.meta.canAfford("tokens", bet)) {
          App.audio.play("error");
          App.ui.toast("Jetons insuffisants", "Réduisez la mise.", "🪙", "danger");
          g.autoOn = false;
          renderControls();
          return;
        }
        if (!App.meta.bet(bet, "horses")) return;
      }
      const probs = probabilities();
      const winner = chooseWinner(probs);
      const duration = CFG.raceDurationMs;
      const finishTimes = horses().map((h, i) => i === winner ? duration : duration * U.rand(1.025, 1.22));
      raceState = {
        start: performance.now(),
        duration,
        finishTimes,
        probs,
        odds: horses().map((h, i) => Math.max(1.05, CFG.houseEdge / probs[i])),
        winner,
        bet,
        selected: g.selected,
        tournament: !!tournament
      };
      phase = "racing";
      lastResult = null;
      tickAt = 0;
      App.audio.play("whoosh");
      setRaceBadge(tournament ? "🏆 Tournoi · course " + (4 - tournament.racesLeft) + " / 3" : "La course commence !");
      renderControls();
      renderHorsePanel();
      if (!raf) {
        lastTime = performance.now();
        raf = requestAnimationFrame(loop);
      }
      App.state.saveSoon();
    }

    function loop(now) {
      if (destroyed) return;
      const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
      lastTime = now;
      if (phase === "racing") {
        const elapsed = now - raceState.start;
        if (elapsed >= raceState.duration + 600) {
          finishRace();
          return;
        }
        if (now - tickAt > 620) {
          tickAt = now;
          App.audio.play("horse");
        }
      }
      draw(now, false);
      raf = requestAnimationFrame(loop);
    }

    function draw(now, idleSnap) {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      const lanes = horses().length;
      const padTop = 18;
      const padBottom = 16;
      const laneH = (H - padTop - padBottom) / lanes;
      const startX = 50;
      const finishX = W - 36;

      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "rgba(45,26,10,0.55)");
      bg.addColorStop(1, "rgba(8,7,8,0.92)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // piste
      for (let i = 0; i < lanes; i++) {
        const y = padTop + i * laneH;
        ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.012)";
        ctx.fillRect(0, y, W, laneH);
        ctx.strokeStyle = "rgba(255,255,255,0.045)";
        ctx.beginPath();
        ctx.moveTo(0, y + laneH);
        ctx.lineTo(W, y + laneH);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.font = "600 8px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText((i + 1) + " " + horses()[i].name.toUpperCase(), 8, y + laneH / 2 + 3);
      }

      // ligne d'arrivée
      ctx.save();
      for (let y = padTop; y < H - padBottom; y += 8) {
        ctx.fillStyle = ((y / 8) % 2) ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
        ctx.fillRect(finishX, y, 5, 4);
      }
      ctx.strokeStyle = "rgba(255,200,87,0.35)";
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(finishX, padTop);
      ctx.lineTo(finishX, H - padBottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.font = "13px 'Segoe UI Emoji', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🏁", finishX + 2, padTop - 4);

      const elapsed = phase === "racing" ? now - raceState.start : 0;
      horses().forEach((horse, i) => {
        let progress = 0;
        if (phase === "racing" && raceState) {
          progress = U.clamp(elapsed / raceState.finishTimes[i], 0, 1);
          // petit sursaut
          const jitter = Math.sin(elapsed * 0.012 + i * 1.7) * 0.008;
          progress = U.clamp(progress + jitter * (1 - progress), 0, 1);
        } else if (phase === "done" && raceState) {
          progress = i === raceState.winner ? 1 : U.clamp(1 / raceState.finishTimes[i] * raceState.duration, 0, 0.98);
        } else if (idleSnap) {
          progress = 0;
        }
        const y = padTop + i * laneH + laneH / 2;
        const x = startX + progress * (finishX - startX - 8);
        // ombre / poussière
        if (phase === "racing" && progress < 1) {
          ctx.beginPath();
          ctx.arc(x - 14, y + 7, 3 + Math.sin(elapsed * 0.02 + i) * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,200,87,0.14)";
          ctx.fill();
        }
        ctx.save();
        ctx.translate(x, y);
        const bob = phase === "racing" ? Math.sin(elapsed * 0.02 + i) * 2.5 : 0;
        ctx.translate(0, bob);
        ctx.font = "22px 'Segoe UI Emoji', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (phase === "done" && i === raceState.winner) {
          ctx.shadowColor = "rgba(255,200,87,0.8)";
          ctx.shadowBlur = 16;
        }
        ctx.fillText("🐎", 0, 0);
        ctx.restore();
        // cote
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.font = "7px 'JetBrains Mono', monospace";
        ctx.textAlign = "right";
        ctx.fillText("×" + (raceState ? raceState.odds[i] : oddsFor(i)).toFixed(1), finishX - 10, y + 3);
      });

      if (phase === "done" && raceState) {
        const w = horses()[raceState.winner];
        ctx.fillStyle = "rgba(255,200,87,0.9)";
        ctx.font = "600 11px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("🏆 " + w.name.toUpperCase() + " GAGNE", W / 2, H - 2);
      }
    }

    function finishRace() {
      if (!raceState) return;
      const snap = raceState;
      phase = "done";
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      draw(performance.now(), false);
      const winnerHorse = horses()[snap.winner];
      const selectedWin = snap.selected === winnerHorse.id;
      const odds = snap.odds[horses().findIndex((h) => h.id === snap.selected)];
      const bet = snap.bet;
      setRaceBadge("🏆 " + winnerHorse.name + " remporte la course");

      if (snap.tournament && tournament) {
        tournament.racesLeft -= 1;
        tournament.results.push({ winner: winnerHorse.id, win: selectedWin, odds });
        if (selectedWin) {
          tournament.wins += 1;
          App.audio.play("win");
        }
        if (tournament.racesLeft > 0) {
          renderControls();
          renderHorsePanel();
          raceTimer = setTimeout(() => {
            raceTimer = null;
            if (!destroyed && tournament) startRace({ skipBet: true });
          }, 2100);
          return;
        }
        // Fin du tournoi
        const t = tournament;
        tournament = null;
        let totalBase = 0;
        t.results.forEach((r) => { if (r.win) totalBase += t.stake * r.odds; });
        if (t.wins >= 2) totalBase += t.stake * 2;
        const global = App.meta.globalMult();
        const profit = Math.max(0, totalBase - t.totalStake);
        const finalAmount = totalBase + profit * (global - 1);
        if (totalBase > 0) {
          App.meta.credit(finalAmount, "horses", {
            stake: t.totalStake,
            mult: totalBase / t.totalStake,
            silent: true,
            countWin: totalBase > t.totalStake
          });
        }
        if (totalBase <= t.totalStake) App.meta.loss("horses", { silent: true });
        lastResult = { horse: winnerHorse, win: totalBase > t.totalStake, amount: finalAmount, tournament: true, wins: t.wins };
        if (totalBase > 0) {
          App.audio.play(t.wins >= 2 ? "jackpot" : "win");
          App.fx.coinBurst(window.innerWidth / 2, window.innerHeight / 2, finalAmount);
          App.fx.confetti(t.wins >= 2 ? 100 : 40);
          App.ui.toast("Tournoi terminé", t.wins + " victoire(s) · +" + U.fmt(finalAmount) + " jetons", "🏆", "gold");
          App.state.log("🏆", "Tournoi équestre", "+" + U.fmt(finalAmount));
        } else {
          App.audio.play("lose");
          App.ui.toast("Tournoi terminé", "Aucune victoire cette fois.", "🏆", "");
        }
        renderControls();
        renderHorsePanel();
        renderSide();
        updateHeader();
        App.meta.checkAchievements();
        App.state.saveSoon();
        return;
      }

      lastResult = { horse: winnerHorse, win: selectedWin, amount: 0, tournament: false };
      if (selectedWin) {
        const payout = bet * odds;
        g.stats.streak += 1;
        if (g.stats.streak > (g.stats.bestStreak || 0)) g.stats.bestStreak = g.stats.streak;
        App.meta.payout(payout, "horses", { stake: bet, mult: odds, silent: true });
        lastResult.amount = payout;
        App.audio.play(payout >= bet * 5 ? "jackpot" : "win");
        App.fx.coinBurst(window.innerWidth / 2, window.innerHeight / 2, payout);
        App.fx.floatingText("+" + U.fmt(payout), window.innerWidth / 2, window.innerHeight / 2 - 30, { className: "win", duration: 1.5, size: 25 });
        if (g.stats.streak === 3) App.meta.triggerSynergy("horses_3_streak", { streak: 3 });
        if (g.stats.streak >= 2) App.fx.confetti(55);
        App.state.log("🐎", "Gain — Course", "+" + U.fmt(payout));
        App.ui.toast("Victoire !", winnerHorse.name + " à ×" + odds.toFixed(2) + " · +" + U.fmt(payout), "🏆", "gold");
      } else {
        g.stats.streak = 0;
        App.meta.loss("horses", { silent: true });
        App.audio.play("lose");
        App.ui.toast("Course perdue", winnerHorse.name + " l'emporte. Votre cheval n'a pas suivi.", "🐎", "");
      }
      renderControls();
      renderHorsePanel();
      updateHeader();
      App.meta.checkAchievements();
      App.state.saveSoon();
      if (g.autoOn) scheduleAuto();
    }

    function scheduleAuto() {
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = null;
      if (!g.autoOn) return;
      autoTimer = setTimeout(() => {
        autoTimer = null;
        if (destroyed) return;
        if (!App.meta.canAfford("tokens", currentBet())) {
          g.autoOn = false;
          App.ui.toast("Auto-course arrêtée", "Solde insuffisant.", "🤖", "danger");
          renderControls();
          renderSide();
          return;
        }
        startRace();
      }, 2600);
    }

    function startTournament() {
      if (phase === "racing") return;
      if (!g.upgrades.tournament) {
        App.audio.play("error");
        App.ui.toast("Tournoi verrouillé", "Achetez l'amélioration Tournois.", "🏆", "danger");
        return;
      }
      if (tournament) return;
      const stake = currentBet();
      const total = stake * 3;
      if (!App.meta.canAfford("tokens", total)) {
        App.audio.play("error");
        App.ui.toast("Jetons insuffisants", "Le tournoi coûte 3 mises.", "🪙", "danger");
        return;
      }
      if (!App.meta.bet(total, "horses")) return;
      tournament = { racesLeft: 3, wins: 0, stake, totalStake: total, results: [] };
      App.audio.play("unlock");
      App.ui.toast("Tournoi équestre", "3 courses, 3 chances. Les vainqueurs cumulent les cotes.", "🏆", "gold");
      startRace({ skipBet: true });
    }

    function setRaceBadge(text) {
      const el = container.querySelector("#horse-race-badge");
      if (el) {
        el.textContent = text;
        el.classList.remove("hidden");
      }
    }

    // ---------------- Rendu ----------------
    function renderControls() {
      const el = container.querySelector("#horse-controls");
      if (!el) return;
      const racing = phase === "racing";
      const bet = currentBet();
      const selected = selectedHorse();
      el.innerHTML = `
        <div class="bet-stepper"><button class="bet-step" data-horse-bet="-1" ${racing ? "disabled" : ""}>−</button><button class="bet-step" data-horse-bet="1" ${racing ? "disabled" : ""}>+</button></div>
        <div class="bet-display" style="padding:6px 10px"><span class="chip-symbol">🐎</span><div><span class="bet-label">Mise · ${selected.name}</span><strong>${U.fmt(bet)}</strong></div></div>
        <button class="btn btn-primary" data-horse-start ${racing || tournament ? "disabled" : ""} style="flex:1;min-width:130px;min-height:44px">${racing ? "Course en cours…" : "Lancer la course · ×" + oddsFor(horses().indexOf(selected)).toFixed(2)}</button>
        ${g.upgrades.tournament ? `<button class="btn btn-gold" data-horse-tournament ${racing || tournament ? "disabled" : ""}>🏆 Tournoi ×3</button>` : ""}
        <button class="btn ${g.autoOn ? "btn-cyan" : "btn-ghost"}" data-horse-auto ${racing || tournament ? "disabled" : ""}>${g.autoOn ? "⏸ Auto" : "▶ Auto"}</button>`;
      if (lastResult && phase === "done") {
        el.innerHTML += `<div class="horse-race-badge" style="position:static;margin:0;font-size:10px">${lastResult.win ? "🏆 " + U.escapeHtml(lastResult.horse.name) + " · +" + U.fmt(lastResult.amount) : "🐎 " + U.escapeHtml(lastResult.horse.name) + " gagne"}</div>`;
      }
      const badge = container.querySelector("#horse-race-badge");
      if (badge) {
        if (phase === "racing") {
          badge.classList.remove("hidden");
          badge.textContent = tournament ? "🏆 Tournoi · course " + (4 - tournament.racesLeft) + " / 3" : "La course bat son plein…";
        } else if (phase === "done" && lastResult) {
          badge.classList.remove("hidden");
          badge.textContent = lastResult.win ? "🏆 " + lastResult.horse.name + " gagne" : "🏁 " + lastResult.horse.name + " l'emporte";
        } else if (!tournament) {
          badge.classList.add("hidden");
        }
      }
    }

    function renderHorsePanel() {
      const el = container.querySelector("#horse-panel");
      if (!el) return;
      const probs = probabilities();
      el.innerHTML = horses().map((horse, i) => {
        const selected = horse.id === g.selected;
        const p = probs[i];
        const odds = Math.max(1.05, CFG.houseEdge / p);
        return `<div class="horse-card ${selected ? "selected" : ""}" style="--horse-color:${horse.color}" data-horse-select="${horse.id}">
          <span class="horse-avatar">${horse.emoji}</span>
          <div class="horse-info">
            <div class="horse-name">${horse.name} ${g.favorite === horse.id ? "★" : ""}</div>
            <div class="horse-odds">${g.upgrades.odds ? (p * 100).toFixed(1) + " % · " : ""}cote ×${odds.toFixed(2)}</div>
            <div class="horse-stats"><span>⚡ ${statOf(horse, "speed").toFixed(1)}</span><span>🫁 ${statOf(horse, "stamina").toFixed(1)}</span><span>🍀 ${statOf(horse, "luck").toFixed(1)}</span></div>
          </div>
          <button class="horse-bet-btn ${selected ? "active" : ""}" data-horse-select="${horse.id}" ${phase === "racing" ? "disabled" : ""}>${selected ? "Choisi" : "Miser"}</button>
          <button class="train-btn" data-horse-fav="${horse.id}" title="Favori">★</button>
        </div>`;
      }).join("");
    }

    function updateHeader() {
      const plays = container.querySelector("#horses-plays");
      const wins = container.querySelector("#horses-wins");
      const best = container.querySelector("#horses-best");
      const streak = container.querySelector("#horses-streak");
      if (plays) plays.textContent = U.fmt(g.stats.plays);
      if (wins) wins.textContent = U.fmt(g.stats.wins);
      if (best) best.textContent = U.fmt(g.stats.bestWin);
      if (streak) streak.textContent = String(g.stats.streak || 0);
    }

    function renderSide() {
      const side = container.querySelector("#horses-side");
      if (!side) return;
      side.innerHTML = `<div class="tabs" style="margin-bottom:8px">
        <button class="tab ${activeTab === "upgrades" ? "active" : ""}" data-horse-tab="upgrades">Écurie</button>
        <button class="tab ${activeTab === "rules" ? "active" : ""}" data-horse-tab="rules">Aide</button>
      </div><div id="horse-side-content"></div>`;
      const content = side.querySelector("#horse-side-content");
      if (activeTab === "rules") {
        content.innerHTML = `<div class="panel"><div class="panel-head"><h3>🐎 Comment jouer</h3></div><div class="panel-body" style="font-size:10.5px;line-height:1.7;color:var(--muted)">
          <p>Choisissez un cheval, misez, puis regardez la course. Les statistiques (vitesse, endurance, chance) influencent les cotes et la performance.</p>
          <p style="margin-top:7px"><strong style="color:var(--text-soft)">Retour :</strong> ${Math.round(CFG.houseEdge * 100)} % théorique. Les cotes sont calculées à partir des statistiques de l'écurie.</p>
          <p style="margin-top:7px"><strong style="color:var(--text-soft)">Entraînement :</strong> améliore toutes les statistiques de l'écurie, ce qui augmente les cotes de vos favoris.</p>
          <p style="margin-top:7px"><strong style="color:var(--text-soft)">Tournoi :</strong> 3 courses, 3 mises. Une victoire paie sa cote ; 2 victoires ou plus offrent un bonus.</p>
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
          else if (key === "training") label = "Niv. " + level + " · +stats";
          else if (key === "tournament") label = level ? "Tournois ×3" : "Non";
          else if (key === "auto") label = level ? "Auto-course rapide" : "Auto de base offert";
          else if (key === "odds") label = level ? "Chances exactes" : "Non";
          return `<div class="upgrade-row ${maxed ? "maxed" : ""}">
            <span class="upgrade-icon">${def.icon}</span>
            <div class="upgrade-main"><div class="upgrade-name">${def.name}</div><div class="upgrade-desc">${def.desc}</div><div class="upgrade-meta"><span class="upgrade-level">${label}</span></div></div>
            <button class="btn btn-xs ${maxed ? "btn-ghost maxed" : "btn-ghost upgrade-buy"} ${!maxed && d.tokens >= cost ? "affordable" : ""}" data-horse-buy="${key}" ${maxed ? "disabled" : ""}>${maxed ? "MAX" : "🪙 " + U.fmt(cost)}</button>
          </div>`;
        }).join("");
        content.innerHTML = `<div class="panel"><div class="panel-head"><h3>🏋️ Écurie</h3><span class="panel-hint">Entraînement niv. ${g.upgrades.training}</span></div><div class="panel-body" style="padding:10px"><div class="upgrade-list">${rows}</div></div></div>
          <div class="panel"><div class="panel-body" style="padding:10px 12px">
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted)"><span>Victoires</span><strong style="color:var(--gold)">${g.stats.wins}</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Série</span><strong style="color:var(--pink-soft)">${g.stats.streak || 0}</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);margin-top:3px"><span>Favori</span><strong style="color:var(--cyan)">${(horses().find((h) => h.id === g.favorite) || {}).name || "—"}</strong></div>
          </div></div>`;
      }
      updateHeader();
    }

    // ---------------- Init ----------------
    const gm = App.meta.gameMeta("horses");
    container.innerHTML = `
      <div class="game-header">
        <div class="game-title-wrap"><span class="game-title-icon">${gm.icon}</span><div><h1>Courses de chevaux</h1><p>${gm.tagline}</p></div></div>
        <div class="game-header-stats">
          <span class="game-stat-chip">Courses <strong id="horses-plays">${U.fmt(g.stats.plays)}</strong></span>
          <span class="game-stat-chip">Victoires <strong id="horses-wins">${U.fmt(g.stats.wins)}</strong></span>
          <span class="game-stat-chip">Meilleur <strong id="horses-best">${U.fmt(g.stats.bestWin)}</strong></span>
          <span class="game-stat-chip">Série <strong id="horses-streak">${g.stats.streak || 0}</strong></span>
        </div>
      </div>
      <div class="game-layout wide-side">
        <section class="game-stage horses-stage">
          <div class="horse-canvas-wrap" id="horse-wrap">
            <canvas id="horse-canvas"></canvas>
            <div class="horse-race-overlay"><div class="horse-race-badge hidden" id="horse-race-badge"></div></div>
          </div>
          <div class="horse-controls" id="horse-controls"></div>
          <div class="horse-panel" id="horse-panel"></div>
        </section>
        <aside class="game-side" id="horses-side"></aside>
      </div>`;

    wrap = container.querySelector("#horse-wrap");
    canvas = container.querySelector("#horse-canvas");
    ctx = canvas.getContext("2d");
    resize();
    renderControls();
    renderHorsePanel();
    renderSide();
    updateHeader();

    resizeObs = new ResizeObserver(() => resize());
    resizeObs.observe(wrap);

    const onClick = (e) => {
      if (e.target.closest("[data-horse-start]")) {
        if (phase !== "racing" && !tournament) startRace();
        return;
      }
      if (e.target.closest("[data-horse-tournament]")) {
        startTournament();
        return;
      }
      const fav = e.target.closest("[data-horse-fav]");
      if (fav) {
        if (phase === "racing" || tournament) return;
        g.favorite = fav.dataset.horseFav;
        g.selected = g.favorite;
        App.audio.play("click");
        renderHorsePanel(); renderControls(); App.state.saveSoon();
        return;
      }
      const select = e.target.closest("[data-horse-select]");
      if (select) {
        if (phase === "racing" || tournament) return;
        g.selected = select.dataset.horseSelect;
        App.audio.play("click");
        renderHorsePanel(); renderControls(); App.state.saveSoon();
        return;
      }
      const bet = e.target.closest("[data-horse-bet]");
      if (bet && phase !== "racing" && !tournament) {
        g.betIndex = U.clamp(g.betIndex + parseInt(bet.dataset.horseBet, 10), 0, betOptions().length - 1);
        App.audio.play("tick");
        renderControls(); App.state.saveSoon();
        return;
      }
      if (e.target.closest("[data-horse-auto]")) {
        g.autoOn = !g.autoOn;
        App.audio.play("click");
        renderControls(); renderSide();
        if (g.autoOn) {
          if (phase === "done" || phase === "idle") scheduleAuto();
        } else if (autoTimer) {
          clearTimeout(autoTimer); autoTimer = null;
        }
        App.state.saveSoon();
        return;
      }
      const tab = e.target.closest("[data-horse-tab]");
      if (tab) { activeTab = tab.dataset.horseTab; renderSide(); return; }
      const buy = e.target.closest("[data-horse-buy]");
      if (buy) { buyUpgrade(buy.dataset.horseBuy); return; }
    };
    container.addEventListener("click", onClick);

    function buyUpgrade(key) {
      if (phase === "racing" || tournament) {
        App.audio.play("error");
        App.ui.toast("Course en cours", "Attendez la fin de la course.", "🐎", "danger");
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
      if (key === "training") {
        // Améliore toutes les stats de l'écurie
        horses().forEach((h) => {
          if (!g.horses[h.id]) g.horses[h.id] = { speed: 0, stamina: 0, luck: 0 };
          g.horses[h.id].speed += 0.5;
          g.horses[h.id].stamina += 0.3;
          g.horses[h.id].luck += 0.2;
        });
      }
      App.audio.play("purchase");
      App.fx.burst(window.innerWidth * 0.7, window.innerHeight * 0.4, { colors: ["#fb923c", "#ffc857"], count: 16 });
      App.ui.toast("Amélioration achetée", def.name, def.icon, "gold");
      App.meta.checkAchievements();
      App.state.saveSoon();
      renderHorsePanel(); renderControls(); renderSide();
    }

    const cleanup = () => {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      if (raceTimer) clearTimeout(raceTimer);
      if (autoTimer) clearTimeout(autoTimer);
      if (resizeObs) resizeObs.disconnect();
      container.removeEventListener("click", onClick);
      if (tournament) {
        App.meta.refund(tournament.totalStake, "horses");
        tournament = null;
      } else if (phase === "racing" && raceState) {
        App.meta.refund(raceState.bet, "horses");
      }
      phase = "idle";
      activeCleanup = null;
    };
    activeCleanup = cleanup;
    if (g.autoOn) scheduleAuto();
    return cleanup;
  };

  App.games = App.games || {};
  App.games.horses = Game;
})();
