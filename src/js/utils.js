/* ============================================================
   NEON JACKPOT — utils.js
   Helpers, formatage des grands nombres, bus d'événements
   ============================================================ */
(function () {
  "use strict";

  window.App = window.App || {};

  const U = {};

  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const SUFFIXES = [
    { v: 1e3, s: "K" },
    { v: 1e6, s: "M" },
    { v: 1e9, s: "B" },
    { v: 1e12, s: "T" },
    { v: 1e15, s: "Qa" },
    { v: 1e18, s: "Qi" },
    { v: 1e21, s: "Sx" },
    { v: 1e24, s: "Sp" },
    { v: 1e27, s: "Oc" },
    { v: 1e30, s: "No" },
    { v: 1e33, s: "Dc" },
    { v: 1e36, s: "UDc" },
    { v: 1e39, s: "DDc" },
    { v: 1e42, s: "TDc" },
    { v: 1e45, s: "QaDc" },
    { v: 1e48, s: "QiDc" },
    { v: 1e51, s: "SxDc" },
    { v: 1e54, s: "SpDc" },
    { v: 1e57, s: "OcDc" },
    { v: 1e60, s: "NoDc" },
    { v: 1e63, s: "Vg" }
  ];

  U.fmt = function (n, decimals) {
    if (n === Infinity) return "∞";
    if (n === -Infinity) return "-∞";
    if (Number.isNaN(n) || n === null || n === undefined) return "0";
    const neg = n < 0;
    n = Math.abs(n);
    let out;
    if (n < 1e3) {
      if (n === 0) out = "0";
      else if (n < 0.01) out = n.toFixed(3);
      else if (n < 1) out = n.toFixed(2);
      else if (Number.isInteger(n)) out = String(n);
      else if (n < 100) out = trimZeros(n.toFixed(decimals === undefined ? 2 : decimals));
      else out = trimZeros(n.toFixed(decimals === undefined ? 1 : decimals));
    } else {
      let suf = SUFFIXES[SUFFIXES.length - 1];
      for (let i = SUFFIXES.length - 1; i >= 0; i--) {
        if (n >= SUFFIXES[i].v) {
          suf = SUFFIXES[i];
          break;
        }
      }
      const v = n / suf.v;
      out = (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + suf.s;
    }
    return neg ? "-" + out : out;
  };

  U.fmtInt = function (n) {
    if (!isFinite(n)) return U.fmt(n);
    return Math.floor(n).toLocaleString("fr-FR");
  };

  U.fmtMult = function (n) {
    if (!isFinite(n)) return "×∞";
    if (n >= 1000) return "×" + U.fmt(n);
    if (n >= 100) return "×" + Math.round(n);
    if (n >= 10) return "×" + U.fmt(n, 1);
    return "×" + (Math.round(n * 100) / 100);
  };

  U.fmtPct = function (n, digits) {
    return (Math.round(n * Math.pow(10, digits === undefined ? 1 : digits)) / Math.pow(10, digits === undefined ? 1 : digits)) + " %";
  };

  U.fmtXp = U.fmt;

  function trimZeros(str) {
    return str.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  }

  U.plural = function (n, singular, plural) {
    return n > 1 ? (plural || singular + "s") : singular;
  };

  U.clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (min, max) => Math.random() * (max - min) + min;
  U.randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.chance = (p) => Math.random() < p;
  U.sum = (arr) => arr.reduce((a, b) => a + b, 0);

  U.shuffle = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  U.weightedPick = function (items, weightKey) {
    const key = weightKey || "weight";
    const total = items.reduce((s, item) => s + (item[key] || 1), 0);
    let roll = Math.random() * total;
    for (const item of items) {
      roll -= item[key] || 1;
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  };

  U.binomial = function (n, p) {
    // Retourne un entier 0..n distribué binômially.
    let k = 0;
    for (let i = 0; i < n; i++) if (Math.random() < p) k++;
    return k;
  };

  U.binomProb = function (n, k, p) {
    const c = U.comb(n, k);
    return c * Math.pow(p, k) * Math.pow(1 - p, n - k);
  };

  U.comb = function (n, k) {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    k = Math.min(k, n - k);
    let r = 1;
    for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return r;
  };

  U.hypergeometric = function (population, successes, draws, hits) {
    return (U.comb(successes, hits) * U.comb(population - successes, draws - hits)) / U.comb(population, draws);
  };

  U.deepMerge = function (base, override) {
    if (Array.isArray(base)) {
      return Array.isArray(override) ? override : base;
    }
    if (typeof base === "object" && base !== null) {
      const out = {};
      const keys = new Set([...Object.keys(base), ...Object.keys(override || {})]);
      keys.forEach((k) => {
        if (override && Object.prototype.hasOwnProperty.call(override, k)) {
          out[k] = U.deepMerge(base[k], override[k]);
        } else {
          out[k] = U.deepMerge(base[k], undefined);
        }
      });
      return out;
    }
    return override === undefined ? base : override;
  };

  U.clone = function (obj) {
    if (typeof structuredClone === "function") {
      try { return structuredClone(obj); } catch (_) { /* fallback */ }
    }
    return JSON.parse(JSON.stringify(obj));
  };

  U.debounce = function (fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  };

  U.throttle = function (fn, wait) {
    let last = 0;
    let timer;
    return function (...args) {
      const now = Date.now();
      const remaining = wait - (now - last);
      if (remaining <= 0) {
        clearTimeout(timer);
        last = now;
        fn.apply(this, args);
      } else if (!timer) {
        timer = setTimeout(() => {
          last = Date.now();
          timer = null;
          fn.apply(this, args);
        }, remaining);
      }
    };
  };

  U.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  U.easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
  U.easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  U.tween = function (from, to, duration, onUpdate, onDone, ease) {
    const start = performance.now();
    const easing = ease || U.easeOutCubic;
    let raf;
    function step(now) {
      const t = U.clamp((now - start) / duration, 0, 1);
      onUpdate(U.lerp(from, to, easing(t)), t);
      if (t < 1) raf = requestAnimationFrame(step);
      else if (onDone) onDone();
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  };

  U.formatDuration = function (ms, short) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (short) {
      if (h > 0) return h + " h " + (m > 0 ? m + " min" : "");
      if (m > 0) return m + " min " + (s > 0 ? s + " s" : "");
      return s + " s";
    }
    if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
    if (m > 0) return `${m} min ${String(s).padStart(2, "0")} s`;
    return `${s} s`;
  };

  U.formatCountdown = function (ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  U.timeAgo = function (ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return "à l'instant";
    if (diff < 3600000) return Math.floor(diff / 60000) + " min";
    if (diff < 86400000) return Math.floor(diff / 3600000) + " h";
    return Math.floor(diff / 86400000) + " j";
  };

  U.escapeHtml = function (str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  U.escapeAttr = function (str) {
    return U.escapeHtml(str).replace(/`/g, "&#096;");
  };

  U.hexToRgba = function (hex, alpha) {
    if (!hex) return `rgba(255,255,255,${alpha})`;
    if (hex.startsWith("rgb")) return hex;
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  U.uid = function (prefix) {
    return (prefix || "id") + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  };

  U.download = function (filename, text, type) {
    const blob = new Blob([text], { type: type || "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  U.copy = async function (text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (__) { ok = false; }
      ta.remove();
      return ok;
    }
  };

  U.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  U.isGithubPages = function () {
    return /\.github\.io$/i.test(location.hostname);
  };

  U.repoUrl = function () {
    // Détecte automatiquement https://user.github.io/repo/ → https://github.com/user/repo
    if (U.isGithubPages()) {
      const user = location.hostname.split(".")[0];
      const parts = location.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        return `https://github.com/${user}/${parts[0]}`;
      }
      return `https://github.com/${user}`;
    }
    return "https://github.com/";
  };

  U.animateNumber = function (el, from, to, duration, formatter) {
    if (!el) return;
    const fmt = formatter || U.fmt;
    if (from === to) {
      el.textContent = fmt(to);
      return;
    }
    U.tween(from, to, duration || 500, (v) => {
      el.textContent = fmt(v);
    });
  };

  U.wiggle = function (el, className, duration) {
    if (!el) return;
    const cls = className || "shake";
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), duration || 600);
  };

  U.cssEscape = function (value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  };

  U.getPath = function (obj, path) {
    return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  };

  U.setPath = function (obj, path, value) {
    const parts = path.split(".");
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (o[parts[i]] == null) o[parts[i]] = {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = value;
  };

  U.relativeLevels = function (unlockLevel, currentLevel) {
    return Math.max(0, unlockLevel - currentLevel);
  };

  // ----- Bus d'événements -----
  const listeners = new Map();
  App.bus = {
    on(evt, fn) {
      if (!listeners.has(evt)) listeners.set(evt, new Set());
      listeners.get(evt).add(fn);
      return () => App.bus.off(evt, fn);
    },
    off(evt, fn) {
      if (listeners.has(evt)) listeners.get(evt).delete(fn);
    },
    emit(evt, payload) {
      const set = listeners.get(evt);
      if (set) {
        set.forEach((fn) => {
          try { fn(payload); } catch (err) { console.error("[bus]", evt, err); }
        });
      }
      const all = listeners.get("*");
      if (all) {
        all.forEach((fn) => {
          try { fn(evt, payload); } catch (err) { console.error("[bus:*]", err); }
        });
      }
    }
  };

  App.utils = U;
})();
