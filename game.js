(() => {
  "use strict";
  /* Escala da Salvação: 1 ponto antigo de vida = 10 pontos (herói de 10 → 100). */
  const HPS = 10;
  /* Limites de empilhamento: aplicados por último em recalc(), depois de runas, dons, árvores e herói.
     Valores relativos ao herói usam a base dele (ex.: velocidade 1,6 = no máximo +60% da velocidade do herói). */
  const STACK_CAPS = Object.freeze({
    dmg: 3, //        dano total: máx. ×3 do dano-base do herói
    xp: 2, //         Fé ganha: máx. ×2 do valor-base do herói
    speed: 1.6, //    velocidade de movimento: máx. ×1,6 da velocidade do herói
    pickup: 3, //     alcance de coleta: máx. ×3 do alcance-base do herói
    cdMin: 0.5, //    recarga mínima das armas (cadência máxima ×2)
    crit: 0.6, //     chance de crítico máxima (herói + runas + árvores)
    critMul: 3, //    multiplicador máximo do crítico
    regenMin: 4, //   regeneração: no mínimo 4 s entre curas
    invT: 1.2, //     invulnerabilidade após ser atingido: máx. 1,2 s
    exec: 0.5, //     Julgamento: bônus máximo contra inimigos quase mortos
    guil: 0.1, //     Juízo Súbito: chance máxima de execução
  });
  const FE_CONTENT = window.FE_SURVIVOR_CONTENT;
  if (!FE_CONTENT || FE_CONTENT.schemaVersion !== 3)
    throw new Error(
      "[Content] Content Registry v3 was not loaded before game.js.",
    );
  const FE_CONTENT_ERRORS =
    typeof FE_CONTENT.validate === "function"
      ? FE_CONTENT.validate()
      : ["Missing content validator"];
  if (FE_CONTENT_ERRORS.length)
    throw new Error(
      "[Content] Invalid content registry:\n" + FE_CONTENT_ERRORS.join("\n"),
    );
  const HOME_VERSES = window.FE_SURVIVOR_HOME_VERSES || Object.freeze([]);
  let homeVerseIndex = -1;
  let homeVerseLastChange = 0;
  let homeVerseWasHidden = false;
  function showRandomHomeVerse() {
    const textNode = document.getElementById("homeVerseText");
    const refNode = document.getElementById("homeVerseRef");
    if (!textNode || !refNode || !HOME_VERSES.length) return;
    let next = homeVerseIndex;
    if (HOME_VERSES.length > 1) {
      let attempts = 0;
      while (next === homeVerseIndex && attempts++ < 12)
        next = Math.floor(Math.random() * HOME_VERSES.length);
      if (next === homeVerseIndex)
        next = (homeVerseIndex + 1) % HOME_VERSES.length;
    } else next = 0;
    homeVerseIndex = next;
    textNode.textContent = HOME_VERSES[next].text;
    refNode.textContent = HOME_VERSES[next].ref;
    homeVerseLastChange = Date.now();
  }
  function refreshHomeVerseOnReturn() {
    if (Date.now() - homeVerseLastChange < 1400) return;
    showRandomHomeVerse();
  }
  showRandomHomeVerse();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) homeVerseWasHidden = true;
    else if (homeVerseWasHidden) {
      homeVerseWasHidden = false;
      refreshHomeVerseOnReturn();
    }
  });
  window.addEventListener("pagehide", () => {
    homeVerseWasHidden = true;
  });
  window.addEventListener("pageshow", () => {
    if (homeVerseWasHidden) {
      homeVerseWasHidden = false;
      refreshHomeVerseOnReturn();
    }
  });
  try {
    const cap = window.Capacitor;
    if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
      const appPlugin =
        (cap.Plugins && cap.Plugins.App) ||
        (cap.registerPlugin && cap.registerPlugin("App"));
      if (appPlugin && typeof appPlugin.addListener === "function") {
        const listener = appPlugin.addListener("resume", () => {
          homeVerseWasHidden = false;
          refreshHomeVerseOnReturn();
        });
        if (listener && typeof listener.catch === "function")
          listener.catch(() => { });
      }
    }
  } catch (e) {
    console.warn("[homeVerse] resume listener", e);
  }

  const newsModal = document.getElementById("newsModal");
  const newsBtn = document.getElementById("newsBtn");
  function newsIsUnread() {
    return save.newsVer !== APP_VER;
  }
  function syncNewsBadge() {
    if (newsBtn) newsBtn.classList.toggle("is-unread", newsIsUnread());
  }
  function renderNewsBody() {
    const body = document.getElementById("newsBody");
    const title = document.getElementById("newsT");
    if (title)
      title.textContent = (NEWS.title || "Notas da Versão") + " " + APP_VER;
    if (!body) return;
    let html = "";
    if (NEWS.lead)
      html += '<p class="news-lead">' + NEWS.lead + "</p>";
    (NEWS.sections || []).forEach((sec) => {
      html += '<div class="news-section">';
      if (sec.tag)
        html += '<div class="news-tag">✦ ' + sec.tag + "</div>";
      if (sec.items && sec.items.length)
        html +=
          "<ul>" +
          sec.items.map((item) => "<li>" + item + "</li>").join("") +
          "</ul>";
      else if (sec.text) html += "<p>" + sec.text + "</p>";
      html += "</div>";
    });
    body.innerHTML =
      html || '<p class="news-lead">Nenhuma nota nesta versão.</p>';
  }
  function openNewsModal() {
    if (!newsModal) return;
    renderNewsBody();
    newsModal.hidden = false;
    const back = document.getElementById("newsBack");
    if (back) back.focus({ preventScroll: true });
  }
  function closeNewsModal() {
    if (!newsModal || newsModal.hidden) return;
    newsModal.hidden = true;
    if (save.newsVer !== APP_VER) {
      save.newsVer = APP_VER;
      persist();
    }
    syncNewsBadge();
    if (newsBtn) newsBtn.focus({ preventScroll: true });
    try {
      profWelcomeMaybe();
    } catch (e) { }
  }
  if (newsBtn) newsBtn.addEventListener("click", openNewsModal);
  const newsBackBtn = document.getElementById("newsBack");
  if (newsBackBtn) newsBackBtn.addEventListener("click", closeNewsModal);
  if (newsModal)
    newsModal.addEventListener("click", (event) => {
      if (event.target === newsModal) closeNewsModal();
    });
  addEventListener("keydown", (event) => {
    if (!newsModal || newsModal.hidden) return;
    if (event.key === "Escape") {
      closeNewsModal();
      event.preventDefault();
      event.stopPropagation();
    }
  });

  /* ================= util ================= */
  const $ = (s) => document.querySelector(s);
  const TUT = {
    on: false,
  }; /* partida de introdução: o módulo completo fica no fim do arquivo */
  /* v0.27: RNG separado. _rg = jogabilidade (spawns, drops, cartas, chefes); _rf = só efeitos visuais.
     Assim a mesma semente dá a mesma partida, com efeitos ligados ou não. __dbg.seed(n) fixa os dois. */
  let _balanceDebugSeed = null,
    _rg = Math.random,
    _rf = Math.random;
  const rng = () => _rg(),
    rngFx = () => _rf();
  const rnd = (a, b) => a + rng() * (b - a),
    rndFx = (a, b) => a + rngFx() * (b - a);
  /* v0.26: interface de toque (celular/tablet ou app nativo) */
  const TOUCH_UI =
    matchMedia("(pointer:coarse)").matches ||
    !!(
      window.Capacitor &&
      Capacitor.isNativePlatform &&
      Capacitor.isNativePlatform()
    );
  const rint = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const fmt = (s) => {
    s = Math.max(0, Math.floor(s));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  };
  function wpick(items) {
    let t = 0;
    for (const i of items) t += i.w;
    let r = rng() * t;
    for (const i of items) {
      r -= i.w;
      if (r <= 0) return i;
    }
    return items[items.length - 1];
  }
  function hash(x, y, s) {
    let h =
      (Math.imul(x | 0, 374761393) +
        Math.imul(y | 0, 668265263) +
        Math.imul((s || 0) + 1, 1442695041)) |
      0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y) {
    const xi = Math.floor(x),
      yi = Math.floor(y),
      xf = x - xi,
      yf = y - yi;
    const u = xf * xf * (3 - 2 * xf),
      v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, 1),
      b = hash(xi + 1, yi, 1),
      c = hash(xi, yi + 1, 1),
      d = hash(xi + 1, yi + 1, 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  const SAVE_KEY = "fe-survivor-v1";
  /* ===== VERSÃO DO JOGO (manual) =====
     Altere APP_VER abaixo para atualizar a versão na tela inicial e nas Configurações.
     (Ponto único de verdade — não fica no HTML.) */
  const APP_VER = "0.67"; // Perfil do jogador: títulos, molduras e boas-vindas (anterior: 0.64)
  /* ===== NOTÍCIAS / NOTAS DA VERSÃO =====
     Como atualizar em cada release:
       1) Suba APP_VER (ex.: '0.48').
       2) Edite os textos em português na constante NEWS abaixo.
       3) Ao abrir o app, se save.newsVer !== APP_VER o modal abre sozinho.
  */
  const NEWS = FE_CONTENT.news; /* conteúdo em registry.js → news */

  let save = { coins: 0, best: 0, runs: 0, hero: "davi" };
  /* ===== ECONOMIA: todos os números de moedas ficam aqui ===== (ver Economia_auditoria_v0.58.md)
     Heróis: HU (preços em moedas). Pacotes: PRODUCTS (IAP). Mundos: WORLDS.
     Cálculo de moedas da partida: bloco "Economia central" (coinMul, runCoins, ecoGain, vigFactor). */
  const ECO = Object.freeze({
    /* anúncios recompensados de MOEDAS: limite diário COMPARTILHADO entre a Loja e a tela final */
    AD_GOLD: 30, // moedas por anúncio concluído
    AD_GOLD_MAX_DAY: 5, // anúncios de moedas por dia (Loja + tela final)
    AD_GOLD_MAX_RUN: 1, // na tela final: no máximo 1 por partida
    /* Desafio do Dia: bônus fixo (NÃO recebe multiplicadores de runas ou mapas) */
    DAILY_BASE: 30, // participação válida (partida concluída, não abandonada)
    DAILY_WIN: 70, // adicional pela vitória
    DAILY_STREAK_STEP: 10, // por dia consecutivo após o primeiro
    DAILY_STREAK_MAX_STEPS: 5, // teto: +50
    HERO_COST: FE_CONTENT.heroShopPrices, // preços únicos vêm do Content Registry
    /* fontes de moedas na partida */
    OFFER_BASE: 15, // bênção "Oferta": base × multiplicador de raridade; valor fixo, fora dos multiplicadores
    HARVEST_CHANCE: 0.03, // runa Colheita: chance por abate
    HARVEST_CAP: 30, // runa Colheita: moedas-base máximas por partida (antes dos multiplicadores)
    /* multiplicadores (aditivos: 1 + runas + Bolsa) × mapa; limites defensivos */
    BOLSA_MAX: 0.4,
    COIN_BONUS_MAX: 0.7, // Graça 0,1 + Dízimo 0,2 + Bolsa 0,4
    MAP_COIN_MAX: 1.75,
    /* Vigília Eterna: proteção contra inflação */
    VIG_FULL_S: 600, // até aqui, rendimento integral
    VIG_RAMP_S: 1200, // queda linear até o piso (30 min)
    VIG_MIN: 0.25, // piso do fator temporal
    VIG_CAP: 600, // teto de moedas creditadas por partida de Vigília
    /* Pular: não dá moedas; dá XP = fração da barra do nível atual */
    SKIP_XP_BASE: 0.03,
    SKIP_XP_PER_LVL: 0.01,
    SKIP_XP_MAX: 0.35,
    RUNE_COST: { key: 150, t1: 150, t2: 260, t3: 250 },
    RUNE_RESPEC: 200,
    ICON_COST: {
      demon: 200,
      legiao: 300,
      belzebu: 600,
      abadom: 1000,
      leviata: 1600,
      dragao: 2500,
    }, // ícones de perfil: todos os demônios custam 'demon'; chefes do mais barato (Legião) ao mais caro (O Dragão)
  });
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (s) save = Object.assign(save, s);
  } catch (e) { }
  function persist() {
    if (window.__wiping || TUT.on) return;
    if (save.paid > save.coins) save.paid = save.coins;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (e) { }
  }
  /* ID numérico único por dispositivo (12 dígitos), gerado na 1ª abertura e persistido em save.pid */
  function ensurePlayerId() {
    if (save.pid && /^\d{10,14}$/.test(String(save.pid)))
      return String(save.pid);
    let id = "";
    try {
      const a = new Uint32Array(2);
      crypto.getRandomValues(a);
      id =
        String(a[0] % 1e9).padStart(9, "0") +
        String(a[1] % 1e3).padStart(3, "0");
    } catch (e) {
      id =
        String(Date.now()).slice(-10) +
        String(Math.floor(Math.random() * 100)).padStart(2, "0");
    }
    save.pid = id;
    persist();
    return id;
  }
  function refreshBuildInfo() {
    const ver = document.getElementById("buildVer");
    const idEl = document.getElementById("buildId");
    /* Texto da versão no idioma-base do jogo. */
    if (ver) ver.textContent = "versão: " + APP_VER;
    if (idEl) idEl.textContent = "id: " + ensurePlayerId();
  }

  /* ================= áudio ================= */
  /* Variação máxima de pitch (±) por som. Só sons repetitivos de combate; melodias (level, win, lose, boss...) ficam fixas. */
  const SFX_JITTER = {
    hit: 0.07,
    kill: 0.06,
    sling: 0.05,
    coin: 0.04,
    pick: 0.03,
    hurt: 0.04,
    block: 0.05,
    zap: 0.05,
    fire: 0.05,
    dash: 0.04,
  };
  const SFX = {
    ctx: null,
    on: true,
    last: {},
    vol: 1,
    mg() {
      if (!this._m) {
        this._m = this.ctx.createGain();
        this._m.connect(this.ctx.destination);
      }
      this._m.gain.value = this.vol;
      return this._m;
    },
    init() {
      if (!this.ctx) {
        try {
          const A = window.AudioContext || window.webkitAudioContext;
          this.ctx = new A();
        } catch (e) { }
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    },
    tone(f, d, type, v, slide, delay) {
      if (!this.ctx || !this.on) return;
      /* Game feel: pitch aleatório por disparo (só sons repetitivos, ver SFX_JITTER).
         Escala frequência e deslize juntos para manter o contorno do som. */
      const pj = this._pj || 1;
      f *= pj;
      if (slide) slide *= pj;
      const c = this.ctx,
        t = c.currentTime + (delay || 0),
        o = c.createOscillator(),
        g = c.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(f, t);
      if (slide)
        o.frequency.exponentialRampToValueAtTime(
          Math.max(30, f + slide),
          t + d,
        );
      g.gain.setValueAtTime(v || 0.04, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g);
      g.connect(this.mg());
      o.start(t);
      o.stop(t + d + 0.03);
    },
    play(n) {
      if (!this.ctx || !this.on) return;
      const now = performance.now(),
        gap =
          { hit: 60, kill: 50, pick: 40, coin: 50, sling: 90, hurt: 150 }[n] ||
          80;
      if (this.last[n] && now - this.last[n] < gap) return;
      this.last[n] = now;
      /* Usa o RNG de efeitos (rndFx), nunca o de jogabilidade: não mexe na semente do Desafio do Dia. */
      const jit = SFX_JITTER[n];
      this._pj = jit ? 1 + rndFx(-jit, jit) : 1;
      queueMicrotask(() => {
        this._pj = 1;
      });
      if (SFXF[n]) {
        SFXF[n]();
        return;
      }
      switch (n) {
        case "hit":
          this.tone(180, 0.05, "square", 0.02, -60);
          break;
        case "kill":
          this.tone(260, 0.09, "triangle", 0.03, -160);
          break;
        case "sling":
          this.tone(520, 0.06, "square", 0.015, -200);
          break;
        case "pick":
          this.tone(740, 0.06, "triangle", 0.025, 300);
          break;
        case "coin":
          this.tone(1100, 0.05, "square", 0.02);
          this.tone(1560, 0.08, "square", 0.02, 0, 0.05);
          break;
        case "hurt":
          this.tone(140, 0.22, "sawtooth", 0.06, -90);
          break;
        case "block":
          this.tone(900, 0.08, "triangle", 0.04, -300);
          break;
        case "heal":
          this.tone(520, 0.1, "triangle", 0.04, 0);
          this.tone(780, 0.14, "triangle", 0.04, 0, 0.09);
          break;
        case "level":
          [523, 659, 784, 1046].forEach((f, i) =>
            this.tone(f, 0.14, "square", 0.035, 0, i * 0.08),
          );
          break;
        case "boom":
          this.tone(120, 0.6, "sawtooth", 0.08, -90);
          this.tone(60, 0.7, "square", 0.06, -20);
          break;
        case "boss":
          this.tone(70, 0.9, "sawtooth", 0.08, -20);
          this.tone(105, 0.9, "sawtooth", 0.05, -30, 0.1);
          break;
        case "trumpet":
          this.tone(330, 0.3, "sawtooth", 0.04, 90);
          break;
        case "fire":
          this.tone(300, 0.25, "sawtooth", 0.03, -180);
          break;
        case "zap":
          this.tone(1200, 0.1, "sawtooth", 0.03, -900);
          this.tone(300, 0.15, "square", 0.02, -100, 0.02);
          break;
        case "dash":
          this.tone(260, 0.14, "sawtooth", 0.03, 500);
          break;
        case "ui":
          this.tone(660, 0.035, "square", 0.012);
          break;
        case "deny":
          this.tone(200, 0.12, "sawtooth", 0.035, -70);
          break;
        case "warn":
          this.tone(330, 0.12, "triangle", 0.05);
          this.tone(247, 0.18, "triangle", 0.05, 0, 0.12);
          break;
        case "beat":
          this.tone(80, 0.1, "sine", 0.08, -20);
          this.tone(70, 0.12, "sine", 0.06, -20, 0.14);
          break;
        case "win":
          [523, 659, 784, 1046, 1318].forEach((f, i) =>
            this.tone(f, 0.22, "triangle", 0.05, 0, i * 0.12),
          );
          break;
        case "lose":
          [392, 330, 262, 196].forEach((f, i) =>
            this.tone(f, 0.3, "triangle", 0.05, 0, i * 0.18),
          );
          break;
        case "thunder": {
          /* trovão procedural: estrondo grave + cauda */
          const c = this.ctx,
            t0 = c.currentTime,
            dest = this.mg();
          const mkN = (dur) => {
            const n = Math.max(1, Math.floor(c.sampleRate * dur)),
              buf = c.createBuffer(1, n, c.sampleRate),
              d = buf.getChannelData(0);
            for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
            return buf;
          };
          const src = c.createBufferSource();
          src.buffer = mkN(1.4);
          const bp = c.createBiquadFilter();
          bp.type = "lowpass";
          bp.frequency.setValueAtTime(180, t0);
          bp.frequency.exponentialRampToValueAtTime(60, t0 + 1.2);
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(0.22 * this.vol, t0 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.35);
          src.connect(bp);
          bp.connect(g);
          g.connect(dest);
          src.start(t0);
          src.stop(t0 + 1.4);
          this.tone(55, 0.5, "sine", 0.05, -20);
          this.tone(40, 0.7, "sine", 0.04, -10, 0.08);
          break;
        }
      }
    },
  };

  /* ================= sprites (pixel art feita por código) ================= */
  function R(g, c, x, y, w, h) {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  }
  function buildSprite(rows, pal, outline) {
    const h = rows.length,
      w = rows[0].length;
    const base = document.createElement("canvas");
    base.width = w;
    base.height = h;
    const bg = base.getContext("2d");
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        if (ch && ch !== "." && pal[ch]) {
          bg.fillStyle = pal[ch];
          bg.fillRect(x, y, 1, 1);
        }
      }
    const c = document.createElement("canvas");
    c.width = w + 2;
    c.height = h + 2;
    const g = c.getContext("2d");
    if (outline !== false) {
      const sil = document.createElement("canvas");
      sil.width = w;
      sil.height = h;
      const sg = sil.getContext("2d");
      sg.drawImage(base, 0, 0);
      sg.globalCompositeOperation = "source-in";
      sg.fillStyle = outline || "#140b22";
      sg.fillRect(0, 0, w, h);
      for (const d of [
        [0, 1],
        [2, 1],
        [1, 0],
        [1, 2],
      ])
        g.drawImage(sil, d[0], d[1]);
    }
    g.drawImage(base, 1, 1);
    const f = document.createElement("canvas");
    f.width = c.width;
    f.height = c.height;
    const fg = f.getContext("2d");
    fg.drawImage(c, 0, 0);
    fg.globalCompositeOperation = "source-in";
    fg.fillStyle = "#fff";
    fg.fillRect(0, 0, f.width, f.height);
    return { c, f, w: c.width, h: c.height };
  }
  function mk(w, h, fn) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    fn(c.getContext("2d"));
    return c;
  }

  const TPL = {
    hero: [
      "....HHHH....",
      "...HHHHHH...",
      "..HHHHHHHH..",
      "..HHSSSSHH..",
      "..HSSSSSSH..",
      "..SSESSESS..",
      "...SSSSSS...",
      "....SSSS....",
      "..CCTTTTCC..",
      "..TTTTTTTT..",
      ".STTCCCCTTS.",
      ".STTTTTTTTS.",
      "..TTTTTTTT..",
      "..TTTTTTTT..",
      "...BB..BB...",
      "...BB..BB...",
    ],
    heroB: [
      "....HHHH....",
      "...HHHHHH...",
      "..HHHHHHHH..",
      "..HHSSSSHH..",
      "..HSSSSSSH..",
      "..SSESSESS..",
      "...SSSSSS...",
      "....SSSS....",
      "..CCTTTTCC..",
      "..TTTTTTTT..",
      ".STTCCCCTTS.",
      ".STTTTTTTTS.",
      "..TTTTTTTT..",
      "..TTTTTTTT..",
      "..BB....BB..",
      "..BB....BB..",
    ],
    imp: [
      "H........H",
      "HR......RH",
      ".RRRRRRRR.",
      ".RRYRRYRR.",
      ".RRRRRRRR.",
      "..RRKKRR..",
      ".rRRRRRRr.",
      ".rRRRRRRr.",
      "..RR..RR..",
      "..rr..rr..",
    ],
    shade: [
      "...PPPPPP...",
      "..PPPPPPPP..",
      ".PPPPPPPPPP.",
      ".PPKKPPKKPP.",
      ".PPKWPPKWPP.",
      ".PPPPPPPPPP.",
      ".PPPPKKPPPP.",
      ".PPPPPPPPPP.",
      "PPPPPPPPPPPP",
      "PPPPPPPPPPPP",
      "PP.PPP.PPP.P",
      "P...PP.PP..P",
    ],
    bat: [
      "B..........B",
      "BB........BB",
      "BBB..BB..BBB",
      "BBBBBBBBBBBB",
      ".BBBRBBRBBB.",
      "..BBBBBBBB..",
      "...B.BB.B...",
    ],
    brute: [
      "H............H",
      "HH..RRRRRR..HH",
      ".HRRRRRRRRRRH.",
      "..RRYRRRRYRR..",
      "..RRRRRRRRRR..",
      "..RRKKKKKKRR..",
      ".RRRRRRRRRRRR.",
      "RRRrRRRRRRrRRR",
      "RRRrRRRRRRrRRR",
      "RR.rRRRRRRr.RR",
      "...RRRRRRRR...",
      "...RR....RR...",
      "..rrr....rrr..",
    ],
    faith: ["..W..", ".WCC.", ".CCC.", "CCWCC", "CCCCC", ".CCD.", "..D.."],
    coin: [".DDDD.", "DGGGGD", "DGYYGD", "DGYYGD", "DGGGGD", ".DDDD."],
    bread: [
      "..BBBBB..",
      ".BLBLBLB.",
      "BBBBBBBBB",
      "BDDDDDDDB",
      "BBBBBBBBB",
      ".BBBBBBB.",
    ],
    mana: [
      "....GG....",
      "....GG....",
      "...GYYG...",
      "GGGGYYGGGG",
      ".GYYYYYYG.",
      "..GYYYYG..",
      "..GYYYYG..",
      ".GYYGGYYG.",
      ".GYG..GYG.",
      "GG......GG",
    ],
    fire: [
      "....OO..",
      "...OOO..",
      "..OORRO.",
      "..ORYRO.",
      ".OORYYRO",
      ".ORYYYRO",
      ".ORYYYRO",
      "..ORYRO.",
      "..OORRO.",
      "...OOO..",
    ],
    shieldI: [
      "BBBBBBBBB",
      "BWWWWWWWB",
      "BWWWCWWWB",
      "BWCCCCCWB",
      "BWWWCWWWB",
      "BWWWCWWWB",
      ".BWWCWWB.",
      "..BWWWB..",
      "...BWB...",
      "....B....",
    ],
    ark: [
      "..DDDDDDDDDD..",
      ".DGGGGGGGGGGD.",
      "DGYYYYYYYYYYGD",
      "DDDDDDDDDDDDDD",
      "DGGGGGYYGGGGGD",
      "DGGGGGYYGGGGGD",
      "DGGGGGGGGGGGGD",
      "DGGGGGGGGGGGGD",
      "DDDDDDDDDDDDDD",
    ],
    dove1: [
      "W......W",
      "WW....WW",
      ".WWWWWW.",
      "..WWWWWO",
      "...WWW..",
      "........",
    ],
    dove2: [
      "........",
      "..WWWWW.",
      ".WWWWWWO",
      "WW.WWW..",
      "W..WW...",
      "...W....",
    ],
    /* Corvo Negro: 11x8 (13x10 com contorno), um pouco maior que a pomba (8x6) */
    raven1: [
      "..H........",
      ".HPH...KK..",
      "HPPPKKKKKK.",
      ".PPKBBBBBR.",
      "KKKBBBBBBYY",
      "..KKBBBBB..",
      "...K.KK....",
      "...........",
    ],
    raven2: [
      "...........",
      "...........",
      "....KKKK...",
      "KKKKBBBBBR.",
      ".KBBBBBBBYY",
      "..HPPPKKK..",
      "..HPPPK....",
      "...HH......",
    ],
    cross: [
      "..GGG..",
      "..GYG..",
      "GGGYGGG",
      "GYYYYYG",
      "GGGYGGG",
      "..GYG..",
      "..GYG..",
      "..GYG..",
      "..GYG..",
      "..GGG..",
    ],
  };
  const S = {};
  const HEROES = FE_CONTENT.heroes;
  const heroPowerBehavior = (id) =>
    (FE_CONTENT.heroPowers[id] && FE_CONTENT.heroPowers[id].behavior) || "";
  const activeHeroPowerBehavior = () => G && heroPowerBehavior(G.hk);
  const EPAL = FE_CONTENT.demonPalettes;
  const FAITH_PAL = [
    { C: "#5fc8ff", W: "#e8faff", D: "#2a7fc4" },
    { C: "#b58cff", W: "#f0e6ff", D: "#6a3fc4" },
    { C: "#fff1b0", W: "#ffffff", D: "#f0b43a" },
  ];
  function buildAll() {
    S.hero = {};
    for (const k in HEROES)
      S.hero[k] = [
        buildSprite(TPL.hero, HEROES[k].pal),
        buildSprite(TPL.heroB, HEROES[k].pal),
      ];
    S.imp = buildSprite(TPL.imp, EPAL.imp);
    S.bomber = buildSprite(TPL.imp, EPAL.bomber);
    S.shade = buildSprite(TPL.shade, EPAL.shade);
    S.bat = buildSprite(TPL.bat, EPAL.bat);
    S.brute = buildSprite(TPL.brute, EPAL.brute);
    S.elite = buildSprite(TPL.brute, EPAL.elite);
    S.legiao = buildSprite(TPL.shade, EPAL.legiao);
    S.belzebu = buildSprite(TPL.bat, EPAL.belzebu);
    S.abadom = buildSprite(TPL.brute, EPAL.abadom);
    S.leviata = buildSprite(TPL.shade, EPAL.leviata);
    S.dragao = buildSprite(TPL.brute, EPAL.dragao);
    S.f1 = buildSprite(TPL.faith, FAITH_PAL[0]);
    S.f2 = buildSprite(TPL.faith, FAITH_PAL[1]);
    S.f3 = buildSprite(TPL.faith, FAITH_PAL[2]);
    S.coin = buildSprite(TPL.coin, {
      D: "#a86b14",
      G: "#f2c14e",
      Y: "#fff0a8",
    });
    S.bread = buildSprite(TPL.bread, {
      B: "#d9a05b",
      L: "#f0c27f",
      D: "#b57a35",
    });
    S.mana = buildSprite(TPL.mana, { G: "#e0a82e", Y: "#fff3b0" });
    S.fire = buildSprite(TPL.fire, {
      O: "#ff7a1a",
      R: "#e63b1a",
      Y: "#ffe27a",
    });
    S.shieldI = buildSprite(TPL.shieldI, {
      B: "#2a5fb0",
      W: "#8fc4ff",
      C: "#ffffff",
    });
    S.shield = S.shieldI;
    S.ark = buildSprite(TPL.ark, { D: "#5a3308", G: "#e0a82e", Y: "#fff0a8" });
    S.dove = [
      buildSprite(TPL.dove1, { W: "#ffffff", O: "#f2a63a" }, "#4a5a7a"),
      buildSprite(TPL.dove2, { W: "#ffffff", O: "#f2a63a" }, "#4a5a7a"),
    ];
    const RAVEN_PAL = {
      B: "#2a2044",
      P: "#463a78",
      H: "#8070d0",
      K: "#14101f",
      Y: "#f0b040",
      R: "#ff5a4a",
    };
    S.raven = [
      buildSprite(TPL.raven1, RAVEN_PAL, "#0e0a18"),
      buildSprite(TPL.raven2, RAVEN_PAL, "#0e0a18"),
    ];
    S.cross = buildSprite(TPL.cross, { G: "#a8741f", Y: "#f2c14e" }, false);
    // cenário
    S.tiles = { g1: [], g2: [], dirt: [] };
    S.tilesDay = { g1: [], g2: [], dirt: [] };
    const tile = (base, fl, seed) =>
      mk(16, 16, (g) => {
        R(g, base, 0, 0, 16, 16);
        let s = seed;
        const r = () =>
          (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
        for (let i = 0; i < 12; i++) {
          R(
            g,
            fl[Math.floor(r() * fl.length)],
            Math.floor(r() * 16),
            Math.floor(r() * 16),
            r() < 0.4 ? 2 : 1,
            1,
          );
        }
      });
    for (let i = 0; i < 4; i++) {
      S.tilesDay.g1.push(
        tile("#4a9442", ["#5cae4d", "#3f853a", "#6bbb58"], 11 + i * 7),
      );
      S.tiles.g1.push(
        tile("#2d4a3c", ["#365a46", "#27412f", "#3f6a52"], 11 + i * 7),
      );
      S.tilesDay.g2.push(
        tile("#38793b", ["#2f6a33", "#44894a", "#2a5e2e"], 31 + i * 5),
      );
      S.tiles.g2.push(
        tile("#22392f", ["#1c2f27", "#2b4a3a", "#18281f"], 31 + i * 5),
      );
    }
    for (let i = 0; i < 3; i++) {
      S.tilesDay.dirt.push(
        tile("#8a6a42", ["#9c7a4e", "#6f5232", "#a89478"], 51 + i * 9),
      );
      S.tiles.dirt.push(
        tile("#4f3d33", ["#5e4a3d", "#3d2e26", "#6f5a4b"], 51 + i * 9),
      );
    }
    const outl = (c, col) =>
      mk(c.width + 2, c.height + 2, (g) => {
        const sil = mk(c.width, c.height, (h) => {
          h.drawImage(c, 0, 0);
          h.globalCompositeOperation = "source-in";
          h.fillStyle = col || "#0b0816";
          h.fillRect(0, 0, c.width, c.height);
        });
        for (const d of [
          [0, 1],
          [2, 1],
          [1, 0],
          [1, 2],
        ])
          g.drawImage(sil, d[0], d[1]);
        g.drawImage(c, 1, 1);
      });
    const rowsC = (rows, pal) => buildSprite(rows, pal).c;
    const ST = "#6f6c80",
      SL = "#9a97ab",
      SD = "#3e3b4d",
      MO = "#3f6a52",
      BN = { B: "#d8d2bc", K: "#140b22", S: "#a8a28c" };
    const line = (g, c, x0, y0, x1, y1) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++)
        R(
          g,
          c,
          Math.round(x0 + ((x1 - x0) * i) / n),
          Math.round(y0 + ((y1 - y0) * i) / n),
          1,
          1,
        );
    };
    S.decor = {
      tuftDead: mk(7, 5, (g) => {
        R(g, "#3a4a3a", 0, 2, 1, 3);
        R(g, "#4a5a48", 2, 0, 1, 5);
        R(g, "#5a6a55", 3, 1, 1, 4);
        R(g, "#3a4a3a", 5, 2, 1, 3);
        R(g, "#4a5a48", 4, 2, 1, 3);
      }),
      bush: outl(
        mk(14, 10, (g) => {
          R(g, "#1d2d26", 1, 3, 12, 7);
          R(g, "#1d2d26", 3, 1, 8, 3);
          R(g, "#2a4036", 3, 3, 8, 4);
          R(g, "#2a4036", 4, 1, 4, 2);
          R(g, "#3a5a4a", 5, 2, 3, 2);
          R(g, "#3a5a4a", 8, 5, 2, 2);
        }),
      ),
      rock: outl(
        mk(10, 7, (g) => {
          R(g, SD, 1, 2, 8, 5);
          R(g, SD, 3, 0, 5, 3);
          R(g, ST, 3, 1, 4, 2);
          R(g, SL, 4, 1, 2, 1);
          R(g, "#2a2838", 1, 6, 8, 1);
          R(g, MO, 1, 3, 2, 2);
        }),
      ),
      skull: rowsC(
        [
          "..BBBB..",
          ".BBBBBB.",
          "BBBBBBBB",
          "BKKBBKKB",
          "BKKBBKKB",
          "BBBKKBBB",
          ".BBBBBB.",
          "..BSBS..",
        ],
        BN,
      ),
      skullH: rowsC(
        [
          "B..........B",
          "BB........BB",
          ".BB.BBBB.BB.",
          "..BBBBBBBB..",
          "..BKKBBKKB..",
          "..BKKBBKKB..",
          "...BBKKBB...",
          "...BBBBBB...",
          "....BSBS....",
        ],
        BN,
      ),
      bones: rowsC(
        [
          "...B.....B.",
          "B.BBB.BBBBB",
          "BBBSBBBSBB.",
          ".BBBBBBBBBB",
          "BB.SBB.BS.B",
          ".B.......B.",
        ],
        BN,
      ),
      candle: rowsC(["..Y..", ".YFY.", ".WWW.", ".WLW.", ".WWW.", "DDDDD"], {
        Y: "#fff3a0",
        F: "#ff9a2a",
        W: "#e8dcc0",
        L: "#b8a888",
        D: "#3a2a22",
      }),
      tombA: outl(
        mk(10, 14, (g) => {
          R(g, ST, 1, 3, 8, 11);
          R(g, ST, 2, 1, 6, 3);
          R(g, ST, 3, 0, 4, 2);
          R(g, SL, 2, 2, 1, 11);
          R(g, SL, 3, 1, 3, 1);
          R(g, SD, 8, 3, 1, 11);
          R(g, SD, 1, 13, 8, 1);
          R(g, MO, 1, 11, 3, 2);
          R(g, MO, 6, 12, 3, 1);
          R(g, SD, 4, 4, 2, 6);
          R(g, SD, 3, 5, 4, 1);
        }),
      ),
      tombB: outl(
        mk(11, 18, (g) => {
          R(g, ST, 4, 0, 3, 15);
          R(g, ST, 0, 4, 11, 3);
          R(g, ST, 1, 15, 9, 3);
          R(g, SL, 4, 0, 1, 15);
          R(g, SL, 0, 4, 11, 1);
          R(g, SD, 6, 0, 1, 15);
          R(g, SD, 0, 6, 11, 1);
          R(g, SD, 1, 17, 9, 1);
          R(g, MO, 2, 15, 3, 2);
        }),
      ),
      cross: outl(
        mk(9, 16, (g) => {
          R(g, "#5a3a22", 4, 1, 2, 13);
          R(g, "#5a3a22", 1, 4, 8, 2);
          R(g, "#8a5e38", 4, 1, 1, 13);
          R(g, "#8a5e38", 1, 4, 8, 1);
          R(g, SD, 1, 13, 8, 3);
          R(g, ST, 2, 13, 5, 1);
        }),
      ),
      invCross: outl(
        mk(9, 16, (g) => {
          R(g, "#4a2e22", 4, 1, 2, 13);
          R(g, "#4a2e22", 1, 8, 8, 2);
          R(g, "#6e4630", 4, 1, 1, 13);
          R(g, "#6e4630", 1, 8, 8, 1);
          R(g, "#2a1a1a", 1, 13, 8, 3);
          R(g, "#7d1f2a", 3, 13, 3, 1);
        }),
      ),
      angel: outl(
        mk(12, 24, (g) => {
          R(g, SD, 0, 21, 12, 3);
          R(g, ST, 1, 20, 10, 2);
          R(g, ST, 3, 9, 6, 11);
          R(g, SL, 3, 9, 1, 11);
          R(g, SD, 8, 9, 1, 11);
          R(g, ST, 4, 3, 4, 4);
          R(g, SL, 4, 3, 1, 4);
          R(g, "#c8b86a", 3, 1, 6, 1);
          R(g, ST, 0, 8, 3, 9);
          R(g, ST, 9, 8, 3, 9);
          R(g, SL, 0, 8, 1, 8);
          R(g, SD, 11, 9, 1, 8);
          R(g, SL, 5, 11, 2, 3);
          R(g, MO, 1, 21, 3, 1);
        }),
      ),
      gargoyle: outl(
        mk(14, 22, (g) => {
          R(g, SD, 0, 19, 14, 3);
          R(g, ST, 1, 18, 12, 2);
          R(g, ST, 3, 9, 8, 9);
          R(g, SL, 3, 9, 1, 9);
          R(g, SD, 10, 9, 1, 9);
          R(g, ST, 4, 3, 6, 6);
          R(g, ST, 2, 0, 2, 4);
          R(g, ST, 10, 0, 2, 4);
          R(g, SL, 2, 0, 1, 3);
          R(g, ST, 0, 8, 3, 8);
          R(g, ST, 11, 8, 3, 8);
          R(g, SL, 0, 8, 1, 7);
          R(g, "#ff3b3b", 5, 5, 1, 1);
          R(g, "#ff3b3b", 8, 5, 1, 1);
          R(g, "#140b22", 6, 7, 2, 1);
        }),
      ),
      deadTree: outl(
        mk(24, 30, (g) => {
          const c = "#2e2420",
            h = "#4a3a30";
          R(g, "#1a1410", 8, 28, 9, 2);
          R(g, c, 10, 10, 4, 19);
          R(g, h, 10, 10, 1, 19);
          R(g, c, 8, 26, 8, 3);
          R(g, c, 11, 3, 2, 8);
          R(g, c, 10, 5, 2, 3);
          R(g, c, 6, 11, 5, 2);
          R(g, c, 4, 8, 3, 4);
          R(g, c, 3, 5, 2, 4);
          R(g, c, 1, 4, 2, 2);
          R(g, c, 13, 8, 5, 2);
          R(g, c, 17, 5, 3, 4);
          R(g, c, 19, 2, 2, 4);
          R(g, c, 21, 3, 2, 2);
          R(g, h, 4, 8, 1, 3);
          R(g, h, 17, 5, 1, 4);
        }),
      ),
      coffin: outl(
        mk(18, 12, (g) => {
          const a = "#2a180f",
            b = "#4a2e1e",
            l = "#6b4630";
          R(g, a, 4, 0, 10, 1);
          R(g, a, 2, 1, 14, 1);
          R(g, a, 1, 2, 16, 1);
          R(g, a, 0, 3, 18, 6);
          R(g, a, 1, 9, 16, 1);
          R(g, a, 3, 10, 12, 1);
          R(g, b, 4, 1, 10, 1);
          R(g, b, 2, 2, 14, 1);
          R(g, b, 1, 3, 16, 6);
          R(g, b, 3, 9, 12, 1);
          R(g, l, 3, 3, 12, 1);
          R(g, "#c8a85a", 8, 3, 2, 6);
          R(g, "#c8a85a", 6, 5, 6, 1);
        }),
      ),
      fence: outl(
        mk(14, 10, (g) => {
          const c = "#2a2838",
            h = "#4a475c";
          for (const x of [1, 5, 9, 12]) {
            R(g, c, x, 2, 1, 8);
            R(g, h, x, 1, 1, 1);
          }
          R(g, c, 0, 4, 14, 1);
          R(g, c, 0, 7, 14, 1);
        }),
      ),
      blood: mk(14, 7, (g) => {
        const c = "#4a1020",
          d = "#7d1f2a";
        R(g, c, 4, 0, 6, 1);
        R(g, c, 2, 1, 10, 1);
        R(g, c, 1, 2, 12, 3);
        R(g, c, 2, 5, 9, 1);
        R(g, c, 5, 6, 4, 1);
        R(g, d, 4, 2, 5, 2);
        R(g, "#a02538", 5, 2, 2, 1);
      }),
      pent: mk(22, 22, (g) => {
        const c = "rgba(170,36,60,.8)",
          Q = [];
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          Q.push([11 + Math.cos(a) * 9, 11 + Math.sin(a) * 9]);
        }
        for (let i = 0; i < 5; i++) {
          const A = Q[i],
            B = Q[(i + 2) % 5];
          line(g, c, A[0], A[1], B[0], B[1]);
        }
        for (let a = 0; a < 6.283; a += 0.08)
          R(
            g,
            c,
            Math.round(11 + Math.cos(a) * 10),
            Math.round(11 + Math.sin(a) * 10),
            1,
            1,
          );
      }),
    };
  }

  /* ================= dados do jogo ================= */
  const TS = 16;
  const ET = FE_CONTENT.demonDefinitions;
  const BOSS_DEFS = FE_CONTENT.bossDefinitions;
  const BOSS_T = BOSS_DEFS.map((b) => b.schedule);
  const BOSSES = BOSS_DEFS.map(
    ({ id, schedule, patterns, tip, profileOrder, profileName, ...boss }) =>
      boss,
  );
  const WIN_T = 600;
  /* Modo Vigília Eterna: chefes seguem a mesma linha do tempo e depois voltam a cada 90 s, sem amanhecer. */
  const bossTime = (i) =>
    i < BOSS_T.length
      ? BOSS_T[i]
      : BOSS_T[BOSS_T.length - 1] + (i - BOSS_T.length + 1) * 90;
  const WEAPONS = FE_CONTENT.weapons;
  const PASSIVES = FE_CONTENT.passives;
  const MAXW = 6,
    MAXP = 5,
    SNUB_N = 5;
  /* Vigília Eterna: 6 armas + 6 dons + 3 habilidades ativas (Amanhecer: 4 + 4 + 2) */
  const INF_SLOTS_W = 6,
    INF_SLOTS_P = 6,
    INF_ACTIVES = 3;
  let SLOT_W = 4,
    SLOT_P = 4; /* Vigília Eterna libera todos os slots */ /* 4 armas + 4 dons + até 3 ativas; carta ignorada some por 5 sorteios */
  const passiveMaxLevel = (id) =>
    Math.max(
      1,
      Math.min(
        MAXP,
        Math.floor(Number(PASSIVES[id] && PASSIVES[id].maxLevel) || MAXP),
      ),
    );
  const passivePickWeight = (id) =>
    Math.max(
      0.1,
      Math.min(1.5, Number(PASSIVES[id] && PASSIVES[id].pickWeight) || 1),
    );
  const amountBonus = (mods) =>
    Math.max(0, Math.min(2, Math.floor(Number(mods && mods.amount) || 0)));
  function roundGameplayValue(value) {
    if (!Number.isFinite(value)) return value;
    const sign = value < 0 ? -1 : 1,
      tenths = Math.round(Math.abs(value) * 10);
    const whole = Math.floor(tenths / 10),
      digit = tenths % 10;
    return sign * (whole + (digit <= 3 ? 0 : digit <= 6 ? 0.5 : 1));
  }
  const CAT = FE_CONTENT.categories;
  /* Árvore-piloto: desbloqueia ao elevar a Funda de Davi ao nível máximo. Cada partida escolhe apenas um caminho. */
  const SLING_TREE = FE_CONTENT.slingTree;

  /* Árvores adicionais: cada arma, dom ou ativa oferece três rotas no nível máximo.
     A carta de maestria do caminho escolhido volta a aparecer nas escolhas seguintes. */
  const EVOLUTION_TREES = FE_CONTENT.evolutionTrees;
  const cardKey = (c) =>
    c.kind + ":" + (c.ownerId ? c.ownerId + ":" : "") + (c.id || "");
  function applyContentStatOperations(stats, operations) {
    for (const operation of operations || []) {
      const key = operation.key,
        value = operation.value;
      if (operation.op === "add")
        stats[key] = (Number(stats[key]) || 0) + value;
      else if (operation.op === "multiply") stats[key] = stats[key] * value;
      else if (operation.op === "set") stats[key] = value;
      else
        throw new Error(
          "[Content] Unsupported stat operation: " + operation.op,
        );
    }
    return stats;
  }
  function statsFor(id, lvl) {
    const W = WEAPONS[id];
    if (!W) throw new Error("[Content] Unknown weapon: " + id);
    const s = Object.assign({}, W.base);
    for (let i = 0; i < lvl - 1; i++)
      applyContentStatOperations(s, W.up[i].ops);
    return s;
  }
  const needFor = (l) =>
    Math.floor((5 + 4 * l + 0.35 * l * l) * (G && G.inf ? 1.35 : 1));

  const END_VERSES = window.FE_SURVIVOR_END_VERSES;

  /* ================= ícones da interface ================= */
  const ICONS = {},
    ICON_DRAW = {};
  function img(g, spr, x, y, w, h) {
    g.imageSmoothingEnabled = false;
    g.drawImage(spr.c, x, y, w, h);
  }
  function initIcons() {
    Object.assign(ICON_DRAW, {
      sling(g) {
        R(g, "#6b3f1d", 3, 19, 4, 4);
        g.strokeStyle = "#c9923a";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(5, 20);
        g.lineTo(9, 14);
        g.lineTo(14, 10);
        g.stroke();
        R(g, "#8a8f9c", 13, 3, 8, 8);
        R(g, "#c4c9d4", 14, 4, 3, 3);
        R(g, "#5b606c", 13, 10, 8, 1);
      },
      covenant_bow(g) {
        g.strokeStyle = "#9b6336";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(17, 3);
        g.quadraticCurveTo(8, 12, 17, 21);
        g.stroke();
        g.strokeStyle = "#f2d9a0";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(17, 3);
        g.lineTo(17, 21);
        g.stroke();
        g.strokeStyle = "#f2c14e";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(4, 12);
        g.lineTo(15, 12);
        g.moveTo(4, 12);
        g.lineTo(8, 9);
        g.moveTo(4, 12);
        g.lineTo(8, 15);
        g.stroke();
      },
      raven(g) {
        R(g, "#7a6cc0", 2, 1, 1, 1);
        R(g, "#7a6cc0", 5, 1, 1, 1);
        R(g, "#7a6cc0", 8, 1, 1, 1);
        R(g, "#f2c14e", 20, 1, 1, 1);
        R(g, "#1a1426", 2, 2, 2, 1);
        R(g, "#1a1426", 5, 2, 2, 1);
        R(g, "#1a1426", 8, 2, 2, 1);
        R(g, "#f2c14e", 19, 2, 3, 1);
        R(g, "#1a1426", 2, 3, 1, 1);
        R(g, "#2f2650", 3, 3, 1, 1);
        R(g, "#1a1426", 4, 3, 2, 1);
        R(g, "#2f2650", 6, 3, 1, 1);
        R(g, "#1a1426", 7, 3, 1, 1);
        R(g, "#2f2650", 8, 3, 1, 1);
        R(g, "#1a1426", 9, 3, 1, 1);
        R(g, "#f2c14e", 20, 3, 1, 1);
        R(g, "#1a1426", 3, 4, 1, 1);
        R(g, "#2f2650", 4, 4, 2, 1);
        R(g, "#1a1426", 6, 4, 1, 1);
        R(g, "#2f2650", 7, 4, 2, 1);
        R(g, "#1a1426", 9, 4, 2, 1);
        R(g, "#1a1426", 3, 5, 1, 1);
        R(g, "#2f2650", 4, 5, 6, 1);
        R(g, "#1a1426", 10, 5, 2, 1);
        R(g, "#1a1426", 17, 5, 4, 1);
        R(g, "#1a1426", 4, 6, 1, 1);
        R(g, "#2f2650", 5, 6, 6, 1);
        R(g, "#1a1426", 11, 6, 2, 1);
        R(g, "#1a1426", 16, 6, 6, 1);
        R(g, "#1a1426", 4, 7, 1, 1);
        R(g, "#2f2650", 5, 7, 7, 1);
        R(g, "#1a1426", 12, 7, 2, 1);
        R(g, "#1a1426", 15, 7, 3, 1);
        R(g, "#ffffff", 18, 7, 1, 1);
        R(g, "#ff5a4a", 19, 7, 1, 1);
        R(g, "#1a1426", 20, 7, 2, 1);
        R(g, "#e8a23a", 22, 7, 2, 1);
        R(g, "#1a1426", 5, 8, 1, 1);
        R(g, "#2f2650", 6, 8, 6, 1);
        R(g, "#1a1426", 12, 8, 9, 1);
        R(g, "#e8a23a", 21, 8, 3, 1);
        R(g, "#1a1426", 5, 9, 1, 1);
        R(g, "#2f2650", 6, 9, 5, 1);
        R(g, "#1a1426", 11, 9, 10, 1);
        R(g, "#e8a23a", 21, 9, 2, 1);
        R(g, "#1a1426", 6, 10, 2, 1);
        R(g, "#2f2650", 8, 10, 2, 1);
        R(g, "#1a1426", 10, 10, 11, 1);
        R(g, "#1a1426", 3, 11, 2, 1);
        R(g, "#1a1426", 7, 11, 14, 1);
        R(g, "#1a1426", 2, 12, 4, 1);
        R(g, "#1a1426", 7, 12, 13, 1);
        R(g, "#1a1426", 1, 13, 3, 1);
        R(g, "#2f2650", 4, 13, 2, 1);
        R(g, "#1a1426", 6, 13, 13, 1);
        R(g, "#1a1426", 2, 14, 4, 1);
        R(g, "#2f2650", 6, 14, 1, 1);
        R(g, "#1a1426", 7, 14, 4, 1);
        R(g, "#2f2650", 11, 14, 3, 1);
        R(g, "#1a1426", 14, 14, 4, 1);
        R(g, "#1a1426", 3, 15, 9, 1);
        R(g, "#7a6cc0", 12, 15, 2, 1);
        R(g, "#1a1426", 14, 15, 3, 1);
        R(g, "#1a1426", 5, 16, 11, 1);
        R(g, "#1a1426", 7, 17, 3, 1);
        R(g, "#c9923a", 11, 17, 2, 1);
        R(g, "#c9923a", 14, 17, 2, 1);
        R(g, "#c9923a", 10, 18, 1, 1);
        R(g, "#c9923a", 13, 18, 1, 1);
        R(g, "#c9923a", 16, 18, 1, 1);
      },
      sword(g) {
        for (let i = 0; i <= 12; i++) R(g, "#e4ecf8", 8 + i, 16 - i, 2, 2);
        for (let i = 0; i <= 10; i++) R(g, "#ffffff", 9 + i, 15 - i, 1, 1);
        for (let i = -3; i <= 3; i++) R(g, "#f2c14e", 7 + i, 17 + i, 2, 2);
        R(g, "#6b3f1d", 3, 20, 3, 3);
        R(g, "#8a5a2a", 5, 19, 2, 2);
      },
      aura(g) {
        g.lineWidth = 2;
        g.strokeStyle = "#f2c14e";
        g.beginPath();
        g.arc(12, 12, 9, 0, 6.3);
        g.stroke();
        g.strokeStyle = "#9fe0ff";
        g.beginPath();
        g.arc(12, 12, 5, 0, 6.3);
        g.stroke();
        R(g, "#fff", 11, 11, 2, 2);
      },
      shield(g) {
        img(g, S.shieldI, 2, 1, 20, 22);
      },
      dove(g) {
        img(g, S.dove[0], 0, 3, 24, 18);
      },
      trumpet(g) {
        g.lineWidth = 2;
        for (const [r, c] of [
          [4, "#fff3b0"],
          [8, "#f2c14e"],
          [11, "#a8741f"],
        ]) {
          g.strokeStyle = c;
          g.beginPath();
          g.arc(6, 12, r, -1, 1);
          g.stroke();
        }
        R(g, "#f2c14e", 2, 10, 6, 4);
        R(g, "#fff3b0", 2, 10, 6, 1);
      },
      fire(g) {
        img(g, S.fire, 3, 0, 18, 24);
      },
      angels(g) {
        /* anjo pixel 24x24 */
        R(g, "#f0e6c0", 10, 10, 4, 8);
        R(g, "#ffe8b0", 10, 6, 4, 4);
        g.strokeStyle = "#f2c14e";
        g.lineWidth = 1;
        g.beginPath();
        g.arc(12, 5, 3, 0, 6.3);
        g.stroke();
        R(g, "#fff8e0", 4, 10, 5, 3);
        R(g, "#fff8e0", 3, 12, 4, 2);
        R(g, "#fff8e0", 15, 10, 5, 3);
        R(g, "#fff8e0", 17, 12, 4, 2);
        R(g, "#fff", 16, 5, 1, 1);
      },
      helmet(g) {
        R(g, "#c8ccd8", 5, 6, 14, 10);
        R(g, "#e8ecf5", 7, 4, 10, 4);
        R(g, "#9da3b4", 5, 14, 14, 4);
        R(g, "#f2c14e", 11, 1, 2, 4);
        R(g, "#2b2f45", 8, 10, 8, 3);
      },
      belt(g) {
        R(g, "#7a4a1d", 2, 9, 20, 6);
        R(g, "#a8681f", 2, 9, 20, 2);
        R(g, "#f2c14e", 9, 7, 6, 10);
        R(g, "#7a4a1d", 11, 10, 2, 4);
      },
      breast(g) {
        R(g, "#b8bfd0", 5, 4, 14, 16);
        R(g, "#d8deeb", 7, 6, 10, 6);
        R(g, "#9aa2b5", 2, 4, 5, 5);
        R(g, "#9aa2b5", 17, 4, 5, 5);
        R(g, "#f2c14e", 11, 8, 2, 9);
        R(g, "#f2c14e", 8, 11, 8, 2);
      },
      boots(g) {
        R(g, "#6b4a2a", 4, 4, 6, 11);
        R(g, "#8a6038", 4, 14, 10, 5);
        R(g, "#6b4a2a", 14, 4, 6, 11);
        R(g, "#8a6038", 12, 14, 10, 5);
        R(g, "#2b1a0b", 4, 18, 10, 1);
        R(g, "#2b1a0b", 12, 18, 10, 1);
      },
      grace(g) {
        img(g, S.mana, 1, 1, 22, 22);
      },
      hope(g) {
        R(g, "#9fe0ff", 11, 6, 2, 13);
        g.lineWidth = 2;
        g.strokeStyle = "#9fe0ff";
        g.beginPath();
        g.arc(12, 4, 2.5, 0, 6.3);
        g.stroke();
        R(g, "#9fe0ff", 7, 8, 10, 2);
        g.beginPath();
        g.arc(12, 12, 8, 0.25 * Math.PI, 0.75 * Math.PI);
        g.stroke();
      },
      wisdom(g) {
        R(g, "#5c2a1a", 3, 5, 18, 15);
        R(g, "#f1e4c3", 5, 6, 14, 13);
        R(g, "#3a1a0f", 11, 5, 2, 15);
        R(g, "#c0392b", 8, 8, 2, 8);
        R(g, "#c0392b", 6, 10, 6, 2);
        R(g, "#b9a67a", 14, 9, 4, 1);
        R(g, "#b9a67a", 14, 12, 4, 1);
        R(g, "#b9a67a", 14, 15, 4, 1);
      },
      fasting(g) {
        R(g, "#f2c14e", 5, 2, 14, 3);
        R(g, "#f2c14e", 5, 19, 14, 3);
        g.fillStyle = "#bfe9ff";
        g.beginPath();
        g.moveTo(7, 5);
        g.lineTo(17, 5);
        g.lineTo(12, 12);
        g.fill();
        g.beginPath();
        g.moveTo(12, 12);
        g.lineTo(17, 19);
        g.lineTo(7, 19);
        g.fill();
        g.fillStyle = "#f2c14e";
        g.beginPath();
        g.moveTo(9, 17);
        g.lineTo(15, 17);
        g.lineTo(12, 13);
        g.fill();
      },
      heal(g) {
        img(g, S.bread, 1, 5, 22, 14);
      },
      coins(g) {
        img(g, S.coin, 4, 4, 16, 16);
      },
    });
  }
  Object.assign(ICON_DRAW, {
    armadura(g) {
      R(g, "#9da9c2", 4, 3, 16, 18);
      R(g, "#dbe3f2", 7, 5, 10, 3);
      R(g, "#596b87", 7, 9, 10, 9);
      R(g, "#f2c14e", 10, 10, 4, 6);
    },
    coracao(g) {
      g.fillStyle = "#a52f50";
      g.beginPath();
      g.moveTo(12, 21);
      g.bezierCurveTo(2, 14, 2, 7, 7, 5);
      g.bezierCurveTo(10, 4, 12, 7, 12, 8);
      g.bezierCurveTo(15, 3, 22, 5, 21, 11);
      g.bezierCurveTo(21, 15, 16, 19, 12, 21);
      g.fill();
      R(g, "#ffc3d3", 9, 8, 2, 2);
    },
    incenso(g) {
      R(g, "#9a643c", 6, 17, 12, 4);
      R(g, "#c28d56", 8, 14, 8, 3);
      g.strokeStyle = "#d8b7ff";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(11, 14);
      g.quadraticCurveTo(4, 9, 10, 5);
      g.moveTo(14, 14);
      g.quadraticCurveTo(21, 9, 14, 3);
      g.stroke();
    },
    uncao(g) {
      g.fillStyle = "#f2c14e";
      g.beginPath();
      g.moveTo(12, 2);
      g.quadraticCurveTo(4, 12, 7, 17);
      g.quadraticCurveTo(12, 24, 17, 17);
      g.quadraticCurveTo(20, 12, 12, 2);
      g.fill();
      R(g, "#fff0a3", 10, 13, 4, 6);
    },
    paes(g) {
      R(g, "#9a643c", 3, 12, 18, 8);
      R(g, "#c58b4a", 4, 9, 16, 9);
      R(g, "#ffe3b0", 7, 11, 2, 1);
      R(g, "#ffe3b0", 12, 10, 2, 1);
      R(g, "#ffe3b0", 17, 11, 2, 1);
    },
    alegria(g) {
      g.fillStyle = "#df9d39";
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5,
          r = i % 2 ? 5 : 10,
          x = 12 + Math.cos(a) * r,
          y = 12 + Math.sin(a) * r;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
      g.fill();
      R(g, "#fff0a3", 11, 8, 2, 8);
    },
    provisao(g) {
      R(g, "#83502c", 4, 6, 16, 15);
      R(g, "#c58b4a", 6, 8, 12, 11);
      R(g, "#f2c14e", 10, 9, 4, 9);
      R(g, "#fff0a3", 11, 11, 2, 5);
    },
    provacao(g) {
      R(g, "#6b3341", 4, 5, 16, 15);
      R(g, "#e4a3a8", 6, 7, 12, 11);
      R(g, "#6b3341", 9, 9, 6, 7);
      R(g, "#fff0a3", 11, 10, 2, 5);
    },
    manto(g) {
      R(g, "#5f4b87", 7, 3, 10, 4);
      g.beginPath();
      g.fillStyle = "#8a72b5";
      g.moveTo(7, 6);
      g.lineTo(3, 21);
      g.lineTo(21, 21);
      g.lineTo(17, 6);
      g.closePath();
      g.fill();
      R(g, "#fff0a3", 11, 8, 2, 10);
      R(g, "#fff0a3", 8, 12, 8, 2);
    },
    coroa(g) {
      g.fillStyle = "#d8a72f";
      g.beginPath();
      g.moveTo(3, 7);
      g.lineTo(8, 11);
      g.lineTo(11, 3);
      g.lineTo(14, 11);
      g.lineTo(20, 6);
      g.lineTo(18, 19);
      g.lineTo(5, 19);
      g.closePath();
      g.fill();
      R(g, "#fff0a3", 5, 20, 14, 2);
    },
  });

  /* Fallback vetorial sem recursos externos: funciona mesmo quando imagens vindas de assets
     contaminam um canvas no WebView e tornam toDataURL() indisponível. */
  function safeIconSVG(id, accent, path, mastery) {
    accent = accent || "#f2c14e";
    const glyphs = {
      sling:
        '<path d="M8 6L12 4L16 6L14 10L10 10Z" fill="#d4b38a" stroke="#fff0c7" stroke-width="1"/><path d="M9 12L5 21M15 12L20 21" stroke="#c58a4c" stroke-width="2"/><circle cx="12" cy="13" r="2" fill="#f2c14e"/>',
      sword:
        '<path d="M16 4L18 5L12 18L10 16Z" fill="#d9e7ff" stroke="#fff"/><path d="M7 17L14 10M7 17L5 20M6 16L9 19" stroke="#f2c14e" stroke-width="2"/>',
      aura: '<circle cx="12" cy="12" r="8" fill="none" stroke="#f2c14e" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="#9fe0ff" stroke-width="2"/><circle cx="12" cy="12" r="1.5" fill="#fff"/>',
      shield:
        '<path d="M12 3L20 6V12Q19 18 12 22Q5 18 4 12V6Z" fill="#4169a8" stroke="#d9e7ff" stroke-width="1.5"/><path d="M12 6V18M8 11H16" stroke="#f2c14e" stroke-width="2"/>',
      angels:
        '<circle cx="12" cy="7" r="3" fill="#ffe8b0" stroke="#f2c14e" stroke-width="1"/><path d="M6 10L3 14L6 13L5 18H9L8 13L12 12L16 13L15 18H19L18 13L21 14L18 10L12 12Z" fill="#f0e6c0" stroke="#fff0a3" stroke-width="1"/><path d="M4 9Q8 4 12 9Q16 4 20 9" fill="none" stroke="#fff" stroke-width="1.5"/>',
      raven:
        '<path d="M3 17L9 13L7 5L12 9L14 4L16 9L21 9L22 11L17 12L16 16L9 17L6 21Z" fill="#2a2144" stroke="#9a8ee0" stroke-width="1"/><circle cx="17" cy="10" r="1" fill="#ff5a4a"/><path d="M20 9L23 10L20 11Z" fill="#e8a23a"/>',
      dove: '<path d="M3 15L10 10L9 5L14 9L21 7L17 13L20 17L13 15L8 20Z" fill="#d9e7ff" stroke="#fff" stroke-width="1"/><circle cx="16" cy="11" r="1" fill="#2b1a0b"/>',
      trumpet:
        '<path d="M4 10H10L20 5V19L10 14H4Z" fill="#f2c14e" stroke="#fff0a3" stroke-width="1.2"/><path d="M7 14L8 19H11L10 14" fill="#c58a4c"/>',
      whip:
        '<path d="M4 20Q8 14 11 13Q15 11 15 7Q17 4 21 3" fill="none" stroke="#a8743a" stroke-width="2.2" stroke-linecap="round"/><path d="M4 20Q8 14 11 13Q15 11 15 7Q17 4 21 3" fill="none" stroke="#f0d49a" stroke-width="0.8"/><path d="M20 2L22 5M22 3L19 5" stroke="#ffe27a" stroke-width="1.2"/><rect x="3" y="19" width="4" height="3" fill="#4a2a12"/>',
      firewall:
        '<circle cx="12" cy="12" r="8" fill="none" stroke="#ff6a1a" stroke-width="3"/><circle cx="12" cy="12" r="8" fill="none" stroke="#ffe27a" stroke-width="1"/><path d="M12 1L14 5H10ZM12 23L14 19H10ZM1 12L5 10V14ZM23 12L19 10V14Z" fill="#ffb43a"/><path d="M12 9L15 13L12 16L9 13Z" fill="#fff0a3"/>',
      fire: '<path d="M12 3L15 9L19 7L18 13L21 16L16 22H8L4 17L8 11L9 14Z" fill="#ff8d3a" stroke="#ffe3a0" stroke-width="1"/><path d="M12 12L15 16L12 20L9 17Z" fill="#fff0a3"/>',
      helmet:
        '<path d="M4 13A8 8 0 0 1 20 13V17H4Z" fill="#9da9c2" stroke="#edf2ff" stroke-width="1.5"/><path d="M12 4V15M6 15H18" stroke="#f2c14e" stroke-width="2"/>',
      belt: '<rect x="3" y="9" width="18" height="7" rx="1" fill="#98602e" stroke="#dca65d"/><rect x="9" y="7" width="6" height="11" rx="1" fill="#f2c14e" stroke="#fff0a3"/><rect x="11" y="10" width="2" height="5" fill="#4d2c15"/>',
      breast:
        '<path d="M7 4L12 7L17 4L21 9L18 21H6L3 9Z" fill="#9da9c2" stroke="#edf2ff" stroke-width="1.5"/><path d="M12 8V18M8 13H16" stroke="#f2c14e" stroke-width="2"/>',
      boots:
        '<path d="M6 4H12V14L19 17V21H4V16L6 14Z" fill="#8a6038" stroke="#e8c18c" stroke-width="1.5"/><path d="M6 17H17" stroke="#f2c14e" stroke-width="2"/>',
      grace:
        '<circle cx="12" cy="12" r="8" fill="none" stroke="#f2c14e" stroke-width="2"/><path d="M12 5V19M5 12H19" stroke="#fff0a3" stroke-width="2"/>',
      hope: '<path d="M12 3L14 10L21 12L14 14L12 21L10 14L3 12L10 10Z" fill="#9fe0ff" stroke="#fff" stroke-width="1"/>',
      wisdom:
        '<path d="M4 5Q8 3 12 6Q16 3 20 5V20Q16 18 12 21Q8 18 4 20Z" fill="#f1e4c3" stroke="#b89452" stroke-width="1.5"/><path d="M12 6V20M6 9H10M14 9H18M6 13H10M14 13H18" stroke="#754a26"/>',
      fasting:
        '<path d="M6 4H18L13 11L18 20H6L11 11Z" fill="#9fe0ff" stroke="#f2c14e" stroke-width="1.5"/><path d="M8 6H16M8 18H16" stroke="#fff"/>',
      watch:
        '<path d="M2 12Q12 2 22 12Q12 22 2 12Z" fill="#3b4774" stroke="#9fe0ff" stroke-width="1.5"/><circle cx="12" cy="12" r="4" fill="#f2c14e"/><circle cx="12" cy="12" r="1.5" fill="#17112b"/>',
      eagle:
        '<path d="M12 18L3 8L10 11L12 5L14 11L21 8Z" fill="#c58aff" stroke="#f1dcff" stroke-width="1.5"/><path d="M12 8V21" stroke="#f2c14e" stroke-width="2"/>',
      judgment:
        '<path d="M13 2L5 14H11L9 22L19 9H13Z" fill="#f2c14e" stroke="#fff0a3" stroke-width="1.5"/>',
      refuge:
        '<path d="M12 3L20 6V12Q19 18 12 22Q5 18 4 12V6Z" fill="#385c91" stroke="#9fe0ff" stroke-width="1.5"/><path d="M12 7V17M7 12H17" stroke="#fff" stroke-width="2"/>',
      shepherd:
        '<path d="M6 5Q12 1 18 5V17Q12 21 6 17Z" fill="#d6b16e" stroke="#fff0c7" stroke-width="1.5"/><path d="M8 9H16M8 12H16M8 15H14" stroke="#8a6038" stroke-width="1.5"/>',
      sunstop:
        '<circle cx="12" cy="12" r="6" fill="#ffe08a" stroke="#e0a82e" stroke-width="1.5"/><path d="M12 2V5M12 19V22M2 12H5M19 12H22M5 5L7 7M17 17L19 19M19 5L17 7M7 17L5 19" stroke="#fff0a3" stroke-width="1.5"/><path d="M12 8V12H15" stroke="#7a4b12" stroke-width="1.5" fill="none"/>',
      handsbattle:
        '<path d="M7 22L8 11M17 22L16 11" stroke="#f2c14e" stroke-width="3" stroke-linecap="round"/><circle cx="8" cy="8" r="3" fill="#ffe0b0"/><circle cx="16" cy="8" r="3" fill="#ffe0b0"/><path d="M12 2V6M3 3L5 6M21 3L19 6" stroke="#fff3b0" stroke-width="1"/>',
      coins:
        '<circle cx="12" cy="12" r="8" fill="#f2c14e" stroke="#fff0a3" stroke-width="1.5"/><path d="M12 7V17M15 9Q12 6 9 9Q8 11 12 12Q16 13 15 15Q12 18 9 15" fill="none" stroke="#8a5a13" stroke-width="1.5"/>',
      heal: '<path d="M4 8Q4 4 8 4H16Q20 4 20 8V17H4Z" fill="#d6b16e" stroke="#fff0c7" stroke-width="1.5"/><path d="M8 12H16" stroke="#8a6038" stroke-width="1.5"/>',
    };
    const glyph =
      glyphs[id] ||
      '<path d="M12 3L15 9L21 12L15 15L12 21L9 15L3 12L9 9Z" fill="#f2c14e" stroke="#fff0a3" stroke-width="1"/>';
    const bg = mastery ? "#563b13" : "#211534";
    const badge = mastery
      ? '<path d="M25 21L27 24L30 24L28 27L29 30L25 28L22 30L23 27L21 24L24 24Z" fill="#fff0a3" stroke="#f2c14e" stroke-width=".7"/>'
      : '<rect x="22" y="22" width="7" height="7" fill="#171027" stroke="' +
      accent +
      '" stroke-width="1"/><path d="M23 25.5H28M25.5 23V28" stroke="' +
      accent +
      '" stroke-width="1"/>';
    const border = mastery ? "#ffe08a" : accent;
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges"><rect width="32" height="32" fill="#05030b"/><rect x="2" y="2" width="28" height="28" fill="' +
      bg +
      '" stroke="' +
      border +
      '" stroke-width="2"/><path d="M4 5H28M4 27H28" stroke="' +
      (mastery ? "#fff0a3" : accent) +
      '" stroke-width="1"/>' +
      glyph +
      badge +
      (mastery
        ? '<path d="M5 5L7 7M27 5L25 7" stroke="#fff0a3" stroke-width="2"/>'
        : "") +
      "</svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function iconURL(id) {
    if (ICONS[id]) return ICONS[id];
    try {
      if (typeof ICON_DRAW[id] !== "function")
        return safeIconSVG(id, "#f2c14e", "", false);
      const c = mk(24, 24, (g) => {
        g.imageSmoothingEnabled = false;
        ICON_DRAW[id](g);
      });
      ICONS[id] = c.toDataURL();
    } catch (err) {
      /* Alguns assets são imagens não exportáveis no WebView. Não deixe isso quebrar a biblioteca. */
      ICONS[id] = safeIconSVG(id, "#f2c14e", "", false);
    }
    return ICONS[id];
  }
  /* Ícones próprios das árvores: tentamos o sprite original; caso o canvas esteja contaminado,
     retornamos um SVG autossuficiente, sem imagens externas e seguro para <img src>. */
  const EVOLUTION_ICONS = Object.create(null);
  /* Imagens de assets/icons/<id>.png já carregadas: usadas como base dos ícones de evolução/maestria. */
  const ICON_IMG = Object.create(null);
  function evoAccent(ownerId, path, mastery) {
    if (mastery) return "#f2c14e";
    const palette = [
      "#ff9a2a",
      "#9fe0ff",
      "#c58aff",
      "#83df9c",
      "#ff6f83",
      "#f2c14e",
      "#61d9d2",
    ];
    const seed = String(ownerId || "") + ":" + String(path || "");
    let h = 0;
    for (let i = 0; i < seed.length; i++)
      h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }
  function evolutionIconURL(ownerId, path, mastery) {
    const key = ownerId + ":" + path + ":" + (mastery ? "mastery" : "path");
    if (EVOLUTION_ICONS[key]) return EVOLUTION_ICONS[key];
    const accent = evoAccent(ownerId, path, !!mastery),
      drawBase = ICON_DRAW[ownerId];
    if (!drawBase && !ICON_IMG[ownerId])
      return (EVOLUTION_ICONS[key] = safeIconSVG(
        ownerId,
        accent,
        path,
        !!mastery,
      ));
    const buildEvoIcon = (useFile) => mk(32, 32, (g) => {
      g.imageSmoothingEnabled = false;
      R(g, "#05030b", 0, 0, 32, 32);
      R(g, mastery ? "#563b13" : "#211534", 1, 1, 30, 30);
      R(g, accent, 2, 2, 28, 2);
      R(g, accent, 2, 28, 28, 2);
      R(g, accent, 2, 4, 2, 24);
      R(g, accent, 28, 4, 2, 24);
      R(g, mastery ? "#fff0a3" : "#e8d9ff", 4, 4, 24, 1);
      g.save();
      g.translate(4, 4);
      if (useFile) g.drawImage(ICON_IMG[ownerId], 0, 0, 24, 24);
      else drawBase(g);
      g.restore();
      R(g, "#05030b", 21, 21, 9, 9);
      R(g, accent, 22, 22, 7, 7);
      R(g, "#171027", 23, 23, 5, 5);
      if (mastery) {
        R(g, "#fff2ad", 24, 23, 3, 2);
        R(g, "#f2c14e", 23, 25, 2, 3);
        R(g, "#f2c14e", 26, 25, 2, 3);
        R(g, "#fff2ad", 24, 27, 3, 1);
        R(g, "#fff2ad", 4, 4, 2, 2);
        R(g, "#fff2ad", 26, 4, 2, 2);
      } else {
        const p = String(path).toLowerCase();
        if (
          /pierc|spear|cleave|snip|arrow|aim|target|seek|precision/.test(p)
        ) {
          R(g, accent, 24, 24, 1, 5);
          R(g, accent, 22, 26, 5, 1);
          R(g, "#fff", 24, 25, 1, 3);
        } else if (
          /shield|bastion|fortress|sanctuary|ward|guard|refuge/.test(p)
        ) {
          R(g, accent, 23, 24, 5, 1);
          R(g, accent, 24, 25, 3, 2);
          R(g, accent, 25, 27, 1, 1);
        } else if (/echo|pulse|storm|chain|flock|orbit|wave|ring/.test(p)) {
          R(g, accent, 24, 23, 1, 6);
          R(g, accent, 22, 25, 5, 1);
          R(g, accent, 23, 24, 3, 3);
        } else {
          R(g, accent, 24, 23, 3, 1);
          R(g, accent, 23, 24, 1, 3);
          R(g, accent, 26, 24, 1, 3);
          R(g, accent, 24, 27, 3, 1);
        }
      }
      R(g, "#fff8", 3, 3, 4, 1);
    });
    try {
      let url = null;
      /* 1º: ícone da pasta assets/icons; 2º (fallback): ícone desenhado via código */
      if (ICON_IMG[ownerId]) {
        try {
          url = buildEvoIcon(true).toDataURL();
        } catch (e) {
          url = null; /* canvas não exportável: cai para o desenho do código */
        }
      }
      if (!url && drawBase) url = buildEvoIcon(false).toDataURL();
      if (!url) throw new Error("evolution icon unavailable");
      EVOLUTION_ICONS[key] = url;
    } catch (err) {
      /* Fallback local para o próprio ícone: nunca propagar SecurityError de canvas contaminado. */
      EVOLUTION_ICONS[key] = safeIconSVG(ownerId, accent, path, !!mastery);
    }
    return EVOLUTION_ICONS[key];
  }

  /* ================= estado ================= */
  const gameEl = $("#game"),
    cv = $("#c"),
    ctx = cv.getContext("2d");
  /* v0.46: fontes do canvas e opção "Fonte sem serifa" (as fontes de HTML vêm de --f-title/--f-body no CSS).
     v0.53: a opção usa a Inter embutida em fonts/ (igual em todos os aparelhos); mesma pilha no CSS (html.sysfont). */
  const CF = {
    body: '"Pixelify Sans",monospace',
    title: '"Press Start 2P","Pixelify Sans",monospace',
  };
  const SYS_STACK = "Inter,Verdana,Tahoma,Arial,Helvetica,sans-serif";
  function applyFont() {
    const sys = !!(save && save.set && save.set.sysfont);
    document.documentElement.classList.toggle("sysfont", sys);
    if (sys && document.fonts && document.fonts.load) {
      try {
        document.fonts.load("16px Inter");
      } catch (e) { }
    }
    CF.body = sys ? SYS_STACK : '"Pixelify Sans",monospace';
    CF.title = sys ? SYS_STACK : '"Press Start 2P","Pixelify Sans",monospace';
  }
  let VW = 480,
    VH = 270,
    camx = 0,
    camy = 0,
    G = null,
    state = "menu",
    selHero = HEROES[save.hero] ? save.hero : "davi",
    vign = null;
  const keys = {},
    stick = { on: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
  function selectedEvolution(id, group) {
    if (!G) return null;
    if (group === "weapon")
      return id === "sling" ? G.slingTree : G.weaponTrees && G.weaponTrees[id];
    if (group === "passive") return G.passiveTrees && G.passiveTrees[id];
    if (group === "active") return G.activeTrees && G.activeTrees[id];
    return null;
  }
  function gameIconURL(id, group) {
    const ev = selectedEvolution(id, group);
    return ev ? evolutionIconURL(id, ev.path, !!ev.tier) : iconURL(id);
  }

  /* ================= Balance Lab: telemetria local, sem envio de rede =================
     Guarda apenas dados da partida para análise de balanceamento. Nada é enviado automaticamente.
     O jogador exporta os arquivos manualmente pelo menu ou pela tela de fim de partida. */
  const BALANCE_STORE_KEY = "fe-survivor-balance-runs-v1";
  const BALANCE_SCHEMA_VERSION = 2,
    BALANCE_TELEMETRY_VERSION = 6,
    BALANCE_MAX_RUNS = 100,
    BALANCE_MAX_EVENTS = 600,
    BALANCE_MAX_CHOICES = 300,
    BALANCE_MAX_SNAPSHOTS = 120,
    BALANCE_MAX_MINUTE_BUCKETS = 600;
  function balanceEnsureRun(run) {
    if (!run || typeof run !== "object") return run;
    if (run.schemaVersion && run.schemaVersion < BALANCE_SCHEMA_VERSION) {
      run.sourceSchemaVersion = run.schemaVersion;
      run.schemaVersion = BALANCE_SCHEMA_VERSION;
    }
    if (!run.truncation)
      run.truncation = {
        any: false,
        discarded: { events: 0, choices: 0, snapshots: 0, minuteBuckets: 0 },
        storageFailures: 0,
      };
    if (!run.truncation.discarded)
      run.truncation.discarded = {
        events: 0,
        choices: 0,
        snapshots: 0,
        minuteBuckets: 0,
      };
    for (const section of ["events", "choices", "snapshots", "minuteBuckets"])
      run.truncation.discarded[section] =
        Number(run.truncation.discarded[section]) || 0;
    run.truncation.storageFailures =
      Number(run.truncation.storageFailures) || 0;
    if (run.truncation.any == null)
      run.truncation.any = Object.values(run.truncation.discarded).some(
        (count) => count > 0,
      );
    run.metrics = run.metrics || {};
    run.metrics.drops = run.metrics.drops || {
      generated: 0,
      placed: 0,
      collected: 0,
      expired: 0,
      convertedToXp: 0,
      expiredByReason: {},
      byType: {},
    };
    run.metrics.drops.expiredByReason =
      run.metrics.drops.expiredByReason || {};
    run.metrics.drops.byType = run.metrics.drops.byType || {};
    run.choiceTools = run.choiceTools || {
      upgrades: {},
      adBonus: false,
      banish: { max: 0, used: 0, remaining: 0 },
      skip: { max: 0, used: 0, remaining: 0 },
      rerolls: 0,
    };
    run.minuteBuckets = Array.isArray(run.minuteBuckets)
      ? run.minuteBuckets
      : [];
    run.choices = Array.isArray(run.choices) ? run.choices : [];
    run.events = Array.isArray(run.events) ? run.events : [];
    run.snapshots = Array.isArray(run.snapshots) ? run.snapshots : [];
    return run;
  }
  function balanceReadStore() {
    try {
      const raw = JSON.parse(localStorage.getItem(BALANCE_STORE_KEY) || "null");
      if (!raw || !Array.isArray(raw.runs)) {
        if (raw != null)
          console.warn("[balance] histórico local inválido; gravação bloqueada para evitar sobrescrita.");
        return {
          schemaVersion: BALANCE_SCHEMA_VERSION,
          runs: [],
          active: null,
          historyDiscardedRuns: 0,
          readOnly: raw != null,
        };
      }
      if (raw.schemaVersion > BALANCE_SCHEMA_VERSION) {
        console.warn(
          "[balance] schema de histórico mais novo que o jogo; dados carregados em modo leitura.",
          raw.schemaVersion,
        );
        return { ...raw, readOnly: true };
      }
      const store = {
        ...raw,
        schemaVersion: BALANCE_SCHEMA_VERSION,
        runs: raw.runs.map(balanceEnsureRun),
        active: balanceEnsureRun(raw.active),
        historyDiscardedRuns: Number(raw.historyDiscardedRuns) || 0,
      };
      if (raw.schemaVersion !== BALANCE_SCHEMA_VERSION)
        console.info("[balance] histórico migrado aditivamente para schema 2.");
      return store;
    } catch (e) {
      console.warn("[balance] não foi possível ler o histórico local.", e);
      return {
        schemaVersion: BALANCE_SCHEMA_VERSION,
        runs: [],
        active: null,
        historyDiscardedRuns: 0,
        readOnly: true,
      };
    }
  }
  const BTL = {
    data: balanceReadStore(),
    current: null,
    lastPersistGameT: 0,
    nextSampleAt: 0,
    nextAliveSampleAt: 1,
    aliveSampleCount: 0,
    activeChoiceSessionId: null,
    pendingRerollFrom: null,
    minuteBucketCache: null,
    lastDiscardedMinute: null,
    storageFull: false,
    safeNum(v) {
      return Number.isFinite(Number(v)) ? Number(v) : 0;
    },
    clone(v) {
      try {
        return JSON.parse(JSON.stringify(v));
      } catch (e) {
        return null;
      }
    },
    mode(g) {
      return g && g.inf
        ? "infinite"
        : RUN.daily
          ? "daily"
          : RUN.mode || "standard";
    },
    selectedRunes() {
      return this.clone(save.rt || {});
    },
    primitiveModifiers(mods) {
      const out = {};
      for (const [key, value] of Object.entries(mods || {}))
        if (
          typeof value === "boolean" ||
          typeof value === "string" ||
          (typeof value === "number" && Number.isFinite(value))
        )
          out[key] = value;
      return out;
    },
    minuteBucket(time) {
      const r = this.current;
      if (!r) return null;
      const minute = Math.floor(Math.max(0, this.safeNum(time)) / 60);
      if (
        this.minuteBucketCache &&
        this.minuteBucketCache.run === r &&
        this.minuteBucketCache.minute === minute
      )
        return this.minuteBucketCache.bucket;
      let bucket = r.minuteBuckets.find((item) => item.minute === minute);
      if (bucket) {
        this.minuteBucketCache = { run: r, minute, bucket };
        return bucket;
      }
      if (minute >= BALANCE_MAX_MINUTE_BUCKETS) {
        r.truncation.any = true;
        if (this.lastDiscardedMinute !== minute) {
          r.truncation.discarded.minuteBuckets++;
          this.lastDiscardedMinute = minute;
        }
        return null;
      }
      bucket = {
        minute,
        activeSeconds: 0,
        enemyAliveSeconds: 0,
        averageEnemiesAlive: 0,
        hpRatioSeconds: 0,
        averageHpRatio: 0,
        mitigatedDamage: 0,
        enemySpawnsByType: {},
        killsByType: {},
        damageBySource: {},
        drops: {
          generated: 0,
          placed: 0,
          collected: 0,
          expired: 0,
          convertedToXp: 0,
          expiredByReason: {},
          byType: {},
        },
        damageDealt: 0,
        damageToBosses: 0,
        damageToElites: 0,
        damageTaken: 0,
        hitsTaken: 0,
        blockedHits: 0,
        healingReceived: 0,
        xpRaw: 0,
        xpEffective: 0,
        coinsCollected: 0,
        bossesSpawned: 0,
        bossesDefeated: 0,
        eliteKills: 0,
        activeUses: {},
        levelsGained: 0,
        choicesMade: 0,
      };
      r.minuteBuckets.push(bucket);
      this.minuteBucketCache = { run: r, minute, bucket };
      return bucket;
    },
    addCount(map, key, amount) {
      if (!map) return;
      const id = key || "unknown";
      map[id] = (map[id] || 0) + (amount == null ? 1 : amount);
    },
    syncChoiceTools() {
      const r = this.current,
        tools = G && G.choiceTools;
      if (!r || !tools) return;
      const used = {
        banish: tools.banishUsed || 0,
        skip: tools.skipUsed || 0,
      };
      r.choiceTools = {
        upgrades: this.clone(save.choiceToolUpgrades || {}),
        adBonus: !!tools.adBonus,
        banish: {
          max: (tools.max && tools.max.banish) || 0,
          used: used.banish,
          remaining: Math.max(0, (tools.max && tools.max.banish) - used.banish),
        },
        skip: {
          max: (tools.max && tools.max.skip) || 0,
          used: used.skip,
          remaining: Math.max(0, (tools.max && tools.max.skip) - used.skip),
        },
        rerolls: r.choiceTools ? r.choiceTools.rerolls || 0 : 0,
      };
    },
    persist() {
      if (this.data.readOnly) {
        this.storageFull = true;
        if (this.current) {
          this.current.truncation.any = true;
          this.current.truncation.storageFailures++;
        }
        if (!this.readOnlyWarned) {
          console.warn(
            "[balance] persistência bloqueada para preservar um histórico de schema mais novo.",
          );
          this.readOnlyWarned = true;
        }
        return false;
      }
      try {
        this.data.active =
          this.current && this.current.status === "in_progress"
            ? this.current
            : null;
        const excess = Math.max(0, this.data.runs.length - BALANCE_MAX_RUNS);
        if (excess) {
          this.data.historyDiscardedRuns =
            (this.data.historyDiscardedRuns || 0) + excess;
          this.data.runs = this.data.runs.slice(-BALANCE_MAX_RUNS);
        }
        localStorage.setItem(BALANCE_STORE_KEY, JSON.stringify(this.data));
        this.storageFull = false;
        return true;
      } catch (e) {
        // Armazenamento cheio: descarta partidas antigas de forma contabilizada, sem interromper o jogo.
        this.storageFull = true;
        this.data.storagePressureEvents =
          (this.data.storagePressureEvents || 0) + 1;
        console.warn(
          "[balance] armazenamento local cheio; tentando reduzir o histórico antigo.",
          e,
        );
        try {
          while (this.data.runs.length > 1) {
            this.data.runs.shift();
            this.data.historyDiscardedRuns =
              (this.data.historyDiscardedRuns || 0) + 1;
            try {
              localStorage.setItem(
                BALANCE_STORE_KEY,
                JSON.stringify(this.data),
              );
              this.storageFull = false;
              return true;
            } catch (e2) {
              e = e2;
            }
          }
        } catch (e3) {
          e = e3;
        }
        const affected =
          this.current || this.data.runs[this.data.runs.length - 1];
        if (affected) {
          affected.truncation.any = true;
          affected.truncation.storageFailures++;
        }
        console.warn("[balance] falha ao persistir telemetria local.", e);
        return false;
      }
    },
    event(type, payload) {
      const r = this.current;
      if (!r) return;
      if (r.events.length >= BALANCE_MAX_EVENTS) {
        r.eventTruncated = true;
        r.truncation.any = true;
        r.truncation.discarded.events++;
        return;
      }
      r.events.push(
        Object.assign(
          payload || {},
          { type, t: Math.round(((G && G.t) || 0) * 10) / 10 },
        ),
      );
    },
    start(g) {
      // O tutorial é roteirizado e o jogo promete que ele não conta como partida nem salva progresso.
      if (TUT.on) return;
      if (this.data.active && this.data.active.status === "in_progress") {
        this.markInterrupted(this.data.active, "page_reload_or_new_run");
        this.data.runs.push(this.data.active);
      }
      const H = g.hero || {};
      const attempt = Math.max(
        Number(this.data.nextAttempt) || 1,
        ...this.data.runs.map((run) => (Number(run.attempt) || 0) + 1),
      );
      this.data.nextAttempt = attempt + 1;
      const worldIndex = RUN.world ? WORLDS.indexOf(RUN.world) : -1,
        world = worldIndex >= 0 ? RUN.world : null,
        modeId = this.mode(g),
        content = window.FE_SURVIVOR_CONTENT || {};
      this.current = {
        schemaVersion: BALANCE_SCHEMA_VERSION,
        telemetryVersion: BALANCE_TELEMETRY_VERSION,
        attempt,
        id:
          "fs-" +
          Date.now().toString(36) +
          "-" +
          Math.random().toString(36).slice(2, 8),
        gameVersion: APP_VER,
        telemetryStartedAt: new Date().toISOString(),
        patch: "Balance Lab Patch 0.5",
        status: "in_progress",
        startedAt: new Date().toISOString(),
        endedAt: null,
        truncation: {
          any: false,
          discarded: {
            events: 0,
            choices: 0,
            snapshots: 0,
            minuteBuckets: 0,
          },
          storageFailures: 0,
        },
        limits: {
          events: BALANCE_MAX_EVENTS,
          choices: BALANCE_MAX_CHOICES,
          snapshots: BALANCE_MAX_SNAPSHOTS,
          minuteBuckets: BALANCE_MAX_MINUTE_BUCKETS,
          historyRuns: BALANCE_MAX_RUNS,
        },
        config: {
          mode: modeId,
          modeLabel:
            {
              infinite: "Vigília Eterna",
              daily: "Desafio Diário",
              std: "Amanhecer",
              standard: "Amanhecer",
            }[modeId] || modeId,
          world: world ? world.key || "world" + worldIndex : null,
          worldIndex: world ? worldIndex : null,
          worldName: world ? world.n : null,
          worldModifiers: world
            ? {
              hp: world.hp || 1,
              speed: world.spd || 1,
              spawn: world.spawn || 1,
              coin: world.coin || 1,
            }
            : null,
          runModifiers: {
            ...this.primitiveModifiers(RUN),
            effectiveSpawn: world ? world.spawn || 1 : 1,
            effectiveCoin: world ? world.coin || 1 : 1,
          },
          dailyChallenge: RUN.daily ? RUN.daily.k || true : false,
          rng: {
            seed: RUN.daily && Number.isFinite(RUN.daily.seed)
              ? RUN.daily.seed
              : Number.isFinite(_balanceDebugSeed)
                ? _balanceDebugSeed
                : null,
            source: RUN.daily
              ? "daily"
              : Number.isFinite(_balanceDebugSeed)
                ? "debug"
                : null,
          },
          dailySeed:
            RUN.daily && Number.isFinite(RUN.daily.seed)
              ? RUN.daily.seed
              : null,
          tutorial: !!TUT.on,
          hero: {
            id: g.hk,
            name: H.name || g.hk,
            hp: H.hp,
            spd: H.spd,
            dmg: H.dmg,
            attackSpeed: H.attackSpeed || 1,
            attackRange: HRNG[g.hk] || null,
            xp: H.xp,
            pickup: H.pickup,
            crit: H.crit || 0,
            luck: H.luck || 0,
            startWeapon: H.start,
            startWeaponLevel: H.startLvl || 1,
          },
          hpScale: HPS,
          slots: {
            weapons: SLOT_W,
            passives: SLOT_P,
            actives: Number.isFinite(activeSkillLimit(g))
              ? activeSkillLimit(g)
              : null,
          },
          contentFingerprint: this.contentFingerprint(),
          permanentRunes: this.selectedRunes(),
          permanentMeta: {
            purchasedRunes: Object.values(save.rt || {}).reduce(
              (n, cat) => n + Object.keys(cat || {}).length,
              0,
            ),
            runCountBeforeThisRun: save.runs || 0,
          },
          registry: {
            schemaVersion: content.schemaVersion || null,
            heroIds: Object.keys(content.heroes || {}),
            weaponIds: Object.keys(content.weapons || {}),
            passiveIds: Object.keys(content.passives || {}),
            activeIds: Object.keys(content.actives || {}),
            demonIds: Object.keys(content.demons || {}),
            bossIds: (content.bossDefinitions || []).map(
              (boss, index) => boss.id || boss.key || "boss" + index,
            ),
          },
        },
        result: null,
        metrics: {
          kills: 0,
          killsByType: {},
          damageByWeapon: {},
          enemiesSpawned: 0,
          enemiesSpawnedByType: {},
          damageDealt: 0,
          damageToBosses: 0,
          damageToElites: 0,
          damageTaken: 0,
          hitsTaken: 0,
          blockedHits: 0,
          healingReceived: 0,
          timeBelow30Hp: 0,
          timeBelow15Hp: 0,
          xpRaw: 0,
          xpEffective: 0,
          levelUps: 0,
          choicesMade: 0,
          choicesSkipped: 0,
          banishedOptions: 0,
          rerolls: 0,
          bossesSpawned: 0,
          bossesDefeated: 0,
          eliteKills: 0,
          coinsAtStart: save.coins || 0,
          coinsCollected: 0,
          coinsEarnedDuringRun: 0,
          maxEnemiesAlive: 0,
          maxLevel: g.lvl || 1,
          drops: {
            generated: 0,
            placed: 0,
            collected: 0,
            expired: 0,
            convertedToXp: 0,
            expiredByReason: {},
            byType: {},
          },
          enemyAliveSeconds: 0,
          activeSeconds: 0,
          averageEnemiesAlive: 0,
        },
        bossFights: [],
        choices: [],
        snapshots: [],
        minuteBuckets: [],
        events: [],
        eventTruncated: false,
      };
      // newRun() cria sete inimigos iniciais antes da coleta começar; contabilizamos esse estado inicial.
      for (const e of g.enemies || []) this.spawn(e, true);
      this.current.metrics.maxEnemiesAlive = (g.enemies || []).filter(
        (e) => !e.dead,
      ).length;
      this.lastPersistGameT = 0;
      this.nextSampleAt = 15;
      this.nextAliveSampleAt = 1;
      this.aliveSampleCount = this.current.metrics.maxEnemiesAlive;
      this.lastTickGameT = 0;
      this.activeChoiceSessionId = null;
      this.pendingRerollFrom = null;
      this.minuteBucketCache = null;
      this.lastDiscardedMinute = null;
      this.lastTreesJson = null;
      this.recentHits = [];
      this.syncChoiceTools();
      BTL.src = null;
      this.event("run_start", { initialEnemies: (g.enemies || []).length });
      this.snapshot(g, true);
      this.persist();
    },
    spawn(e, initial) {
      const r = this.current;
      if (!r || !e) return;
      const type = e.boss ? "boss" : e.t || "unknown";
      r.metrics.enemiesSpawnedByType[type] =
        (r.metrics.enemiesSpawnedByType[type] || 0) + 1;
      r.metrics.enemiesSpawned++;
      e._bornT = G ? G.t : 0;
      const ssAll = (r.metrics.spawnStats = r.metrics.spawnStats || {});
      const ss = (ssAll[type] = ssAll[type] || { n: 0, hp: 0, dmg: 0, spd: 0 });
      ss.n++;
      ss.hp += this.safeNum(e.mhp);
      ss.dmg += this.safeNum(e.dmg);
      ss.spd += this.safeNum(e.spd);
      if (e.elite && !initial)
        r.metrics.elitesSpawned = (r.metrics.elitesSpawned || 0) + 1;
      this.addCount(this.minuteBucket(G && G.t)?.enemySpawnsByType, type);
    },
    bossSpawn(e, def) {
      const r = this.current;
      if (!r) return;
      r.metrics.bossesSpawned++;
      r.metrics.enemiesSpawned++;
      r.metrics.enemiesSpawnedByType.boss =
        (r.metrics.enemiesSpawnedByType.boss || 0) + 1;
      const fight = {
        name: (def && def.name) || "Boss " + (e.idx + 1),
        index: e.idx,
        cycle: Math.floor((G.bossIdx || 0) / Math.max(1, BOSSES.length)),
        spawnedAt: G.t,
        hpMax: e.mhp,
        playerLevelAtSpawn: G.lvl,
        killsAtSpawn: G.kills,
        playerHpRatioAtSpawn:
          G.mods && G.mods.maxhp
            ? Math.round((G.p.hp / G.mods.maxhp) * 1000) / 1000
            : null,
        playerMaxHpAtSpawn: G.mods ? G.mods.maxhp : null,
        enemyDmg: this.safeNum(e.dmg),
        enemySpeed: this.safeNum(e.spd),
        damageToPlayer: 0,
        hitsOnPlayer: 0,
        patterns: {},
        damageDealt: 0,
        defeated: false,
        defeatedAt: null,
        secondsAlive: null,
      };
      r.bossFights.push(fight);
      e._balanceFightIndex = r.bossFights.length - 1;
      const bucket = this.minuteBucket(G && G.t);
      if (bucket) {
        bucket.bossesSpawned++;
        this.addCount(bucket.enemySpawnsByType, "boss");
      }
      this.event("boss_spawn", {
        name: fight.name,
        index: fight.index,
        hpMax: fight.hpMax,
        playerLevel: G.lvl,
        world: r.config.world,
      });
    },
    bossPattern(e, name) {
      const r = this.current;
      if (!r || !e) return;
      const f = e._balanceFightIndex != null ? r.bossFights[e._balanceFightIndex] : null;
      if (f) {
        f.patterns = f.patterns || {};
        f.patterns[name] = (f.patterns[name] || 0) + 1;
      }
    },
    bossKill(e) {
      const r = this.current;
      if (!r) return;
      r.metrics.bossesDefeated++;
      const ix = e && e._balanceFightIndex,
        fight = ix != null ? r.bossFights[ix] : null;
      if (fight) {
        fight.defeated = true;
        fight.defeatedAt = G.t;
        fight.secondsAlive = Math.round((G.t - fight.spawnedAt) * 10) / 10;
        fight.playerLevelAtKill = G.lvl;
        fight.playerHpRatioAtEnd =
          G.mods && G.mods.maxhp
            ? Math.round((G.p.hp / G.mods.maxhp) * 1000) / 1000
            : null;
        fight.playerDps = fight.secondsAlive
          ? Math.round((fight.damageDealt / fight.secondsAlive) * 10) / 10
          : null;
      }
      const bucket = this.minuteBucket(G && G.t);
      if (bucket) bucket.bossesDefeated++;
      this.event("boss_defeated", {
        name: (fight && fight.name) || "boss",
        secondsAlive: fight ? fight.secondsAlive : null,
        playerLevel: G.lvl,
      });
    },
    damage(amount, e, source, extra) {
      const r = this.current;
      if (!r || !(amount > 0)) return;
      const d = amount,
        m = r.metrics,
        ttype = e ? (e.boss ? "boss" : e.t || "unknown") : "unknown";
      m.damageDealt += d;
      m.damageByTargetType = m.damageByTargetType || {};
      m.damageByTargetType[ttype] = (m.damageByTargetType[ttype] || 0) + d;
      m.hitsByWeapon = m.hitsByWeapon || {};
      m.hitsByWeapon[source || "other"] =
        (m.hitsByWeapon[source || "other"] || 0) + 1;
      if (extra) {
        if (extra.crit) {
          m.crits = (m.crits || 0) + 1;
          m.critDamage = (m.critDamage || 0) + d;
          m.critsByWeapon = m.critsByWeapon || {};
          m.critsByWeapon[source || "other"] =
            (m.critsByWeapon[source || "other"] || 0) + 1;
        }
        if (extra.overkill > 0)
          m.overkillDamage = (m.overkillDamage || 0) + extra.overkill;
      }
      if (e && e.boss) {
        r.metrics.damageToBosses += d;
        const ix = e._balanceFightIndex,
          fight = ix != null ? r.bossFights[ix] : null;
        if (fight) fight.damageDealt += d;
      }
      if (e && e.elite) r.metrics.damageToElites += d;
      const key = source || "other",
        dbw = (r.metrics.damageByWeapon = r.metrics.damageByWeapon || {});
      dbw[key] = (dbw[key] || 0) + d;
      const bucket = this.minuteBucket(G && G.t);
      if (bucket) {
        bucket.damageDealt += d;
        this.addCount(bucket.damageBySource, key, d);
        if (e && e.boss) bucket.damageToBosses += d;
        if (e && e.elite) bucket.damageToElites += d;
      }
      if (source === "execution")
        r.metrics.executionDamage = (r.metrics.executionDamage || 0) + d;
    },
    killed(e) {
      const r = this.current;
      if (!r || !e) return;
      r.metrics.kills++;
      const type = e.boss ? "boss" : e.t || "unknown";
      r.metrics.killsByType[type] = (r.metrics.killsByType[type] || 0) + 1;
      const bucket = this.minuteBucket(G && G.t);
      if (bucket) {
        this.addCount(bucket.killsByType, type);
        if (e.elite) bucket.eliteKills++;
      }
      if (e.elite) r.metrics.eliteKills++;
      const m = r.metrics,
        kw = BTL.src || "other";
      m.killsByWeapon = m.killsByWeapon || {};
      m.killsByWeapon[kw] = (m.killsByWeapon[kw] || 0) + 1;
      if (e._bornT != null && G) {
        const life = Math.max(0, G.t - e._bornT);
        m.lifetimeByType = m.lifetimeByType || {};
        const lf = (m.lifetimeByType[type] = m.lifetimeByType[type] || {
          n: 0,
          sum: 0,
          max: 0,
        });
        lf.n++;
        lf.sum += life;
        lf.max = Math.max(lf.max, life);
      }
      if (e.boss) this.bossKill(e);
    },
    playerDamage(amount, source, raw) {
      const r = this.current;
      if (!r || !(amount > 0)) return;
      const m = r.metrics,
        rawHit = this.safeNum(raw) || amount,
        name = srcName(source) || String((source && source.t) || "unknown");
      m.damageTaken += amount;
      m.hitsTaken++;
      m.rawDamageTaken = (m.rawDamageTaken || 0) + rawHit;
      m.mitigatedDamage = (m.mitigatedDamage || 0) + Math.max(0, rawHit - amount);
      m.maxHit = Math.max(m.maxHit || 0, amount);
      m.damageSources = m.damageSources || {};
      m.damageSources[name] = (m.damageSources[name] || 0) + amount;
      m.hitsBySource = m.hitsBySource || {};
      m.hitsBySource[name] = (m.hitsBySource[name] || 0) + 1;
      const bucket = this.minuteBucket(G && G.t);
      if (bucket) {
        bucket.damageTaken += amount;
        bucket.hitsTaken++;
        bucket.mitigatedDamage =
          (bucket.mitigatedDamage || 0) + Math.max(0, rawHit - amount);
      }
      /* causa da morte: últimos golpes recebidos */
      this.recentHits = this.recentHits || [];
      this.recentHits.push({
        t: Math.round(((G && G.t) || 0) * 10) / 10,
        source: name,
        damage: Math.round(amount * 10) / 10,
        raw: Math.round(rawHit * 10) / 10,
        hpAfter: Math.round(((G && G.p && G.p.hp) || 0) * 10) / 10,
      });
      if (this.recentHits.length > 8) this.recentHits.shift();
      /* dano causado por chefe ao herói, por luta */
      const bs = source && (source.boss ? source : source.src && source.src.boss ? source.src : null);
      if (bs && bs._balanceFightIndex != null) {
        const f = r.bossFights[bs._balanceFightIndex];
        if (f) {
          f.damageToPlayer = (f.damageToPlayer || 0) + amount;
          f.hitsOnPlayer = (f.hitsOnPlayer || 0) + 1;
        }
      }
    },
    blockedHit(raw) {
      if (this.current) {
        this.current.metrics.blockedHits++;
        this.current.metrics.blockedDamage =
          (this.current.metrics.blockedDamage || 0) + this.safeNum(raw);
        const bucket = this.minuteBucket(G && G.t);
        if (bucket) bucket.blockedHits++;
      }
    },
    heal(amount, requested) {
      const r = this.current;
      if (!r) return;
      const m = r.metrics;
      if (typeof requested === "number" && requested > amount)
        m.overhealing = (m.overhealing || 0) + (requested - amount);
      if (!(amount > 0)) return;
      m.healingReceived = (m.healingReceived || 0) + amount;
      const reason = typeof requested === "string" ? requested : "pickup_or_skill";
      m.healingBySource = m.healingBySource || {};
      m.healingBySource[reason] = (m.healingBySource[reason] || 0) + amount;
      const bucket = this.minuteBucket(G && G.t);
      if (bucket) bucket.healingReceived += amount;
    },
    xp(raw, effective) {
      const r = this.current;
      if (!r) return;
      r.metrics.xpRaw += this.safeNum(raw);
      r.metrics.xpEffective += this.safeNum(effective);
      const bucket = this.minuteBucket(G && G.t);
      if (bucket) {
        bucket.xpRaw += this.safeNum(raw);
        bucket.xpEffective += this.safeNum(effective);
      }
    },
    collect(item) {
      const r = this.current;
      if (!r || !item) return;
      if (item._balanceCollected) return;
      item._balanceCollected = true;
      const type = item.type || "unknown";
      r.metrics.pickupsByType = r.metrics.pickupsByType || {};
      r.metrics.pickupsByType[type] = (r.metrics.pickupsByType[type] || 0) + 1;
      const drops = r.metrics.drops,
        typeCount = (drops.byType[type] = drops.byType[type] || {});
      drops.collected++;
      typeCount.collected = (typeCount.collected || 0) + 1;
      const bucket = this.minuteBucket(G && G.t);
      if (bucket) {
        bucket.drops.collected++;
        const minuteType =
          (bucket.drops.byType[type] = bucket.drops.byType[type] || {});
        minuteType.collected = (minuteType.collected || 0) + 1;
        if (type === "coin") bucket.coinsCollected++;
      }
      if (type === "coin") r.metrics.coinsCollected++;
    },
    pickupGenerated(type, item, convertedToXp) {
      const r = this.current;
      if (!r) return;
      const id = type || "unknown",
        drops = r.metrics.drops,
        typeCount = (drops.byType[id] = drops.byType[id] || {});
      drops.generated++;
      typeCount.generated = (typeCount.generated || 0) + 1;
      const bucket = this.minuteBucket(G && G.t);
      if (bucket) {
        bucket.drops.generated++;
        const minuteType =
          (bucket.drops.byType[id] = bucket.drops.byType[id] || {});
        minuteType.generated = (minuteType.generated || 0) + 1;
      }
      if (convertedToXp) {
        drops.convertedToXp++;
        typeCount.convertedToXp = (typeCount.convertedToXp || 0) + 1;
        if (bucket) {
          bucket.drops.convertedToXp++;
          const minuteType = bucket.drops.byType[id];
          minuteType.convertedToXp = (minuteType.convertedToXp || 0) + 1;
        }
        return;
      }
      if (item) this.pickupPlaced(item);
    },
    pickupPlaced(item) {
      const r = this.current;
      if (!r || !item || item._balancePlaced) return;
      item._balancePlaced = true;
      const type = item.type || "unknown",
        drops = r.metrics.drops,
        typeCount = (drops.byType[type] = drops.byType[type] || {});
      drops.placed++;
      typeCount.placed = (typeCount.placed || 0) + 1;
      const bucket = this.minuteBucket(G && G.t);
      if (bucket) {
        bucket.drops.placed++;
        const minuteType =
          (bucket.drops.byType[type] = bucket.drops.byType[type] || {});
        minuteType.placed = (minuteType.placed || 0) + 1;
      }
    },
    pickupExpired(item, reason) {
      const r = this.current;
      if (!r || !item || item._balanceExpired || item._balanceCollected) return;
      item._balanceExpired = true;
      const type = item.type || "unknown",
        cause = reason || "unknown",
        drops = r.metrics.drops,
        typeCount = (drops.byType[type] = drops.byType[type] || {});
      drops.expired++;
      typeCount.expired = (typeCount.expired || 0) + 1;
      this.addCount(drops.expiredByReason, cause);
      typeCount.expiredByReason = typeCount.expiredByReason || {};
      this.addCount(typeCount.expiredByReason, cause);
      const bucket = this.minuteBucket(G && G.t);
      if (bucket) {
        bucket.drops.expired++;
        this.addCount(bucket.drops.expiredByReason, cause);
        const minuteType =
          (bucket.drops.byType[type] = bucket.drops.byType[type] || {});
        minuteType.expired = (minuteType.expired || 0) + 1;
        minuteType.expiredByReason = minuteType.expiredByReason || {};
        this.addCount(minuteType.expiredByReason, cause);
      }
    },
    activeUse(id) {
      const r = this.current;
      if (!r) return;
      r.metrics.activeUses = r.metrics.activeUses || {};
      r.metrics.activeUses[id] = (r.metrics.activeUses[id] || 0) + 1;
      this.addCount(this.minuteBucket(G && G.t)?.activeUses, id);
    },
    levelUp(level) {
      if (!this.current) return;
      this.current.metrics.levelUps++;
      this.current.metrics.maxLevel = Math.max(
        this.current.metrics.maxLevel,
        level || 1,
      );
      const bucket = this.minuteBucket(G && G.t);
      if (bucket) bucket.levelsGained++;
      this.event("level_up", { level });
    },
    choiceCard(c) {
      if (!c) return null;
      const def = c.id && (WEAPONS[c.id] || PASSIVES[c.id] || ACT[c.id]),
        ownerDef =
          c.ownerId &&
          (WEAPONS[c.ownerId] || PASSIVES[c.ownerId] || ACT[c.ownerId]);
      let choiceDef = null;
      if (c.kind === "weaponBranch" || c.kind === "weaponNode")
        choiceDef =
          EVOLUTION_TREES.weapon[c.ownerId] &&
          EVOLUTION_TREES.weapon[c.ownerId].paths[c.id];
      else if (c.kind === "passiveBranch" || c.kind === "passiveNode")
        choiceDef =
          EVOLUTION_TREES.passive[c.ownerId] &&
          EVOLUTION_TREES.passive[c.ownerId].paths[c.id];
      else if (c.kind === "activeBranch" || c.kind === "activeNode")
        choiceDef =
          EVOLUTION_TREES.active[c.ownerId] &&
          EVOLUTION_TREES.active[c.ownerId].paths[c.id];
      else if (c.kind === "slingBranch" || c.kind === "slingNode")
        choiceDef = SLING_TREE[c.id];
      else if (c.kind === "evo") choiceDef = NX_EVO[c.id];
      return {
        kind: c.kind || null,
        id: c.id || null,
        ownerId: c.ownerId || null,
        ownerName: ownerDef ? ownerDef.name || ownerDef.n || c.ownerId : null,
        rarity: c.r == null ? null : c.r,
        rarityName: c.r == null ? null : (RAR[c.r] && RAR[c.r].n) || String(c.r),
        name:
          (choiceDef && (choiceDef.name || choiceDef.n)) ||
          (def && (def.name || def.n)) ||
          (c.kind === "heal" ? "Bênção do Pão" : null) ||
          (c.kind === "coins" ? "Oferta" : null) ||
          c.id ||
          c.kind ||
          null,
      };
    },
    openChoiceSession(pending, choices) {
      const r = this.current;
      if (!r) return;
      const prior = this.activeChoiceSessionId && r.choices.find(
        (session) => session.sessionId === this.activeChoiceSessionId,
      );
      if (prior && prior.status === "open") {
        prior.status = "ended_unselected";
        prior.endedReason = "replaced_without_selection";
      }
      r.choiceSequence = (r.choiceSequence || 0) + 1;
      const session = {
        sessionId: r.choiceSequence,
        t: Math.round(((G && G.t) || 0) * 10) / 10,
        level: (G && G.lvl) || null,
        pending: pending ? this.clone(pending) : null,
        status: "open",
        rerolledFromSessionId: this.pendingRerollFrom,
        originalOptions: (choices || []).map((card) => this.choiceCard(card)),
        visibleOptions: (choices || []).map((card) => this.choiceCard(card)),
        removedOptions: [],
        selected: null,
        skipReward: 0,
      };
      this.pendingRerollFrom = null;
      this.activeChoiceSessionId = session.sessionId;
      if (r.choices.length < BALANCE_MAX_CHOICES) r.choices.push(session);
      else {
        r.truncation.any = true;
        r.truncation.discarded.choices++;
        session._discarded = true;
      }
      this.event("choice_session_opened", {
        sessionId: session.sessionId,
        level: session.level,
        pendingKind: pending && pending.kind,
      });
    },
    banishOption(option, remaining) {
      const r = this.current;
      if (!r || !option) return;
      const session = r.choices.find(
        (item) => item.sessionId === this.activeChoiceSessionId,
      );
      if (!session) return;
      const removed = this.choiceCard(option);
      session.removedOptions.push({
        option: removed,
        remainingOptions: (remaining || []).map((card) => this.choiceCard(card)),
        t: Math.round(((G && G.t) || 0) * 10) / 10,
      });
      session.visibleOptions = (remaining || []).map((card) => this.choiceCard(card));
      r.metrics.banishedOptions = (r.metrics.banishedOptions || 0) + 1;
      this.syncChoiceTools();
      this.event("choice_banished", {
        sessionId: session.sessionId,
        option: removed,
        visibleOptions: session.visibleOptions,
      });
    },
    skipChoice(reward, xp) {
      const r = this.current;
      if (!r) return;
      const session = r.choices.find(
        (item) => item.sessionId === this.activeChoiceSessionId,
      );
      if (session) {
        session.status = "skipped";
        session.endedReason = "skip";
        session.skipReward = this.safeNum(reward); // moedas (sempre 0 desde a v1.0)
        session.skipXp = this.safeNum(xp);
        session.endedAt = Math.round(((G && G.t) || 0) * 10) / 10;
      }
      r.metrics.choicesSkipped = (r.metrics.choicesSkipped || 0) + 1;
      this.syncChoiceTools();
      this.event("choice_skipped", {
        sessionId: this.activeChoiceSessionId,
        visibleOptions: session ? session.visibleOptions : [],
        reward: this.safeNum(reward), // moedas (sempre 0 desde a v1.0)
        xp: this.safeNum(xp),
      });
      this.activeChoiceSessionId = null;
    },
    rerollChoice(source) {
      const r = this.current;
      if (!r) return;
      const session = r.choices.find(
        (item) => item.sessionId === this.activeChoiceSessionId,
      );
      if (session) {
        session.status = "rerolled";
        session.endedReason = "reroll";
        session.endedAt = Math.round(((G && G.t) || 0) * 10) / 10;
        this.pendingRerollFrom = session.sessionId;
      }
      r.choiceTools.rerolls = (r.choiceTools.rerolls || 0) + 1;
      r.metrics.rerolls = (r.metrics.rerolls || 0) + 1;
      this.syncChoiceTools();
      this.event("choice_rerolled", {
        sessionId: this.activeChoiceSessionId,
        rerollCount: r.choiceTools.rerolls,
        source: source || "unknown",
      });
    },
    choice(selected, choices) {
      const r = this.current;
      if (!r) return;
      const session = r.choices.find(
        (item) => item.sessionId === this.activeChoiceSessionId,
      );
      if (session) {
        session.status = "selected";
        session.selected = this.choiceCard(selected);
        session.visibleOptions = (choices || []).map((card) => this.choiceCard(card));
        session.endedAt = Math.round(((G && G.t) || 0) * 10) / 10;
      }
      this.syncChoiceTools();
      r.metrics.choicesMade++;
      const bucket = this.minuteBucket(G && G.t);
      if (bucket) bucket.choicesMade++;
      this.event("choice_selected", {
        sessionId: this.activeChoiceSessionId,
        selected: this.choiceCard(selected),
      });
      this.activeChoiceSessionId = null;
    },
    snapshot(g, force) {
      const r = this.current;
      if (!r || !g) return;
      const alive = (g.enemies || []).filter((e) => !e.dead),
        byType = {};
      for (const e of alive) {
        const k = e.boss ? "boss" : e.t || "unknown";
        byType[k] = (byType[k] || 0) + 1;
      }
      const weapons = Object.keys(g.W || {}).map((id) => {
        const w = g.W[id] || {};
        const s = w.s || {};
        return {
          id,
          level: w.lvl || 1,
          damage: this.safeNum(s.dmg),
          cooldown: this.safeNum(s.cd),
          count: this.safeNum(s.count),
          pierce: this.safeNum(s.pierce),
          range: this.safeNum(s.range),
          radius: this.safeNum(s.radius),
          evolved: !!(g.evo && g.evo[id]),
          stats: this.primitiveModifiers(s) /* todos os atributos da arma (alcance, anéis, orbes, lentidão...) */,
        };
      });
      const passives = Object.keys(g.P || {}).map((id) => ({
        id,
        level: g.P[id],
      }));
      const active = Object.keys(g.al || {}).map((id) => ({
        id,
        level: g.al[id],
      }));
      const trees = {
        sling: g.slingTree,
        weapons: g.weaponTrees || {},
        passives: g.passiveTrees || {},
        active: g.activeTrees || {},
      };
      const treesJson = JSON.stringify(trees),
        treesChanged = treesJson !== this.lastTreesJson;
      this.lastTreesJson = treesJson; /* árvores só são gravadas quando mudam */
      const mods = g.mods || {};
      const effectiveStats = {
        currentHp: this.safeNum(g.p && g.p.hp),
        maxHp: this.safeNum(mods.maxhp),
        damage: this.safeNum(mods.dmg),
        attackInterval: this.safeNum(mods.cd),
        attackSpeedMultiplier: mods.cd ? 1 / mods.cd : null,
        projectileSpeed: this.safeNum(mods.pspd),
        movementSpeed: this.safeNum(mods.spd),
        attackRange: this.safeNum(mods.rng),
        pickupRange: this.safeNum(mods.pickup),
        blockChance: this.safeNum(mods.block),
        flatDamageReduction: this.safeNum(mods.dr),
        regeneration: this.safeNum(mods.regen),
        area: this.safeNum(mods.area),
        duration: this.safeNum(mods.duration),
        extraUnits: this.safeNum(mods.amount),
        luck: this.safeNum(mods.luck),
        greed: this.safeNum(mods.greed),
        experienceMultiplier: this.safeNum(mods.xp),
        criticalChance: this.safeNum(mods.crit),
        criticalMultiplier: this.safeNum(mods.critMul),
        knockbackMultiplier: this.safeNum(mods.kbm),
        knockbackBonus: this.safeNum(mods.kbBonus),
        effectiveKnockbackMultiplier:
          (mods.kbm == null ? 1 : this.safeNum(mods.kbm)) *
          (mods.kbBonus == null ? 1 : this.safeNum(mods.kbBonus)),
        enemyHealthCurse: this.safeNum(mods.curse),
        enemySpawnFrequencyCurse: this.safeNum(mods.curse),
        enemySpeedCurse: this.safeNum(mods.curseSpd),
        resurrectionsAvailable:
          g.P && g.P.manto > 0 && !g.reviveUsed ? 1 : 0,
        resurrectionsUsed: g.reviveUsed ? 1 : 0,
      };
      r.snapshots.push({
        t: Math.round(g.t * 10) / 10,
        level: g.lvl,
        xp: Math.round(g.xp * 100) / 100,
        xpNeeded: g.need,
        hp: Math.round(g.p.hp * 100) / 100,
        maxHp: mods.maxhp,
        hpRatio: mods.maxhp
          ? Math.round((g.p.hp / mods.maxhp) * 1000) / 1000
          : null,
        kills: g.kills,
        coins: g.coins,
        enemyAlive: alive.length,
        enemiesByType: byType,
        eliteAlive: alive.filter((e) => e.elite).length,
        difficulty: {
          enemyHpScale: Math.round(enemyHpScale(g.t) * 1000) / 1000,
          spawnPerSecond: Math.round(spawnRateNow(g) * 1000) / 1000,
          enemyCap: ENEMY_CAP,
          bossActive: !!g.boss,
          enemyThreatHp: Math.round(alive.reduce((s, e) => s + (e.hp || 0), 0)),
          enemyThreatDps: Math.round(
            alive.reduce((s, e) => s + (e.boss ? 0 : e.dmg || 0), 0),
          ),
        },
        boss: g.boss
          ? {
            name: (BOSSES[g.boss.idx] && BOSSES[g.boss.idx].name) || "boss",
            hp: Math.round(g.boss.hp * 10) / 10,
            maxHp: g.boss.mhp,
            hpRatio: g.boss.mhp
              ? Math.round((g.boss.hp / g.boss.mhp) * 1000) / 1000
              : null,
          }
          : null,
        cumulativeDamageDealt: Math.round(r.metrics.damageDealt * 10) / 10,
        cumulativeDamageTaken: Math.round(r.metrics.damageTaken * 10) / 10,
        stats: {
          ...effectiveStats,
        },
        effectiveStats,
        effectiveModifiers: this.primitiveModifiers(mods),
        weapons,
        passives,
        active,
        evolutions: treesChanged ? this.clone(trees) : undefined,
      });
      if (r.snapshots.length > BALANCE_MAX_SNAPSHOTS) {
        r.snapshots.splice(1, 1); /* mantém o snapshot inicial */
        r.truncation.any = true;
        r.truncation.discarded.snapshots++;
      }
      r.metrics.maxEnemiesAlive = Math.max(
        r.metrics.maxEnemiesAlive || 0,
        alive.length,
      );
      r.metrics.maxLevel = Math.max(r.metrics.maxLevel || 1, g.lvl || 1);
    },
    integrateActiveTo(time) {
      const r = this.current,
        endT = Math.max(0, this.safeNum(time)),
        startT = Math.max(0, Math.min(endT, this.lastTickGameT));
      let cursor = startT;
      while (cursor < endT) {
        const minuteEnd = (Math.floor(cursor / 60) + 1) * 60,
          sampleEnd = this.nextAliveSampleAt > cursor
            ? this.nextAliveSampleAt
            : cursor + 1,
          next = Math.min(endT, minuteEnd, sampleEnd),
          elapsed = Math.max(0, next - cursor),
          bucket = this.minuteBucket(cursor);
        if (elapsed > 0) {
          r.metrics.activeSeconds += elapsed;
          r.metrics.enemyAliveSeconds += this.aliveSampleCount * elapsed;
          if (bucket) {
            bucket.activeSeconds += elapsed;
            bucket.enemyAliveSeconds += this.aliveSampleCount * elapsed;
            bucket.averageEnemiesAlive = bucket.activeSeconds
              ? bucket.enemyAliveSeconds / bucket.activeSeconds
              : 0;
            if (G && G.p && G.mods && G.mods.maxhp > 0) {
              bucket.hpRatioSeconds =
                (bucket.hpRatioSeconds || 0) +
                Math.max(0, Math.min(1, G.p.hp / G.mods.maxhp)) * elapsed;
              bucket.averageHpRatio = bucket.activeSeconds
                ? bucket.hpRatioSeconds / bucket.activeSeconds
                : 0;
            }
          }
        }
        cursor = next;
        if (cursor >= this.nextAliveSampleAt) {
          this.aliveSampleCount = (G.enemies || []).reduce(
            (count, enemy) => count + (!enemy.dead ? 1 : 0),
            0,
          );
          this.nextAliveSampleAt = cursor + 1;
        }
      }
      this.lastTickGameT = endT;
      r.metrics.averageEnemiesAlive = r.metrics.activeSeconds
        ? r.metrics.enemyAliveSeconds / r.metrics.activeSeconds
        : 0;
    },
    tick(dt) {
      const r = this.current;
      if (!r || !G || G.over || state !== "play" || G.resumeT > 0) return;
      this.integrateActiveTo(G.t);
      if (G.mods && G.mods.maxhp > 0) {
        const ratio = G.p.hp / G.mods.maxhp;
        if (ratio <= 0.3)
          r.metrics.timeBelow30Hp = (r.metrics.timeBelow30Hp || 0) + dt;
        if (ratio <= 0.15)
          r.metrics.timeBelow15Hp = (r.metrics.timeBelow15Hp || 0) + dt;
      }
      r.lastT = Math.round(G.t * 10) / 10;
      if (G.t >= this.nextSampleAt) {
        this.snapshot(G, false);
        this.nextSampleAt = G.t + 15;
      }
      if (G.t - this.lastPersistGameT >= 30) {
        this.lastPersistGameT = G.t;
        this.persist();
      }
    },
    markInterrupted(run, reason) {
      run.status = "interrupted";
      run.endReason = reason;
      run.endedAt = new Date().toISOString();
      const openSession = (run.choices || []).find(
        (session) => session.status === "open",
      );
      if (openSession) {
        openSession.status = "ended_unselected";
        openSession.endedReason = reason;
      }
      const m = run.metrics || {};
      run.result = {
        won: false,
        returnedToMenu: false,
        endReason: reason,
        durationSeconds: run.lastT == null ? null : run.lastT,
        level: m.maxLevel || null,
        kills: m.kills || 0,
        hpRemaining: null,
        maxHp: null,
        hitBy: null,
        coinsEarned: null,
        xpRemaining: null,
        build: null,
      };
    },
    buildSnapshot(g) {
      const weapons = {},
        passives = {},
        active = {};
      for (const id of Object.keys(g.W || {}))
        weapons[id] = (g.W[id] && g.W[id].lvl) || 1;
      for (const id of Object.keys(g.P || {})) passives[id] = g.P[id];
      for (const id of Object.keys(g.al || {})) active[id] = g.al[id];
      const txt = (o) =>
        Object.keys(o)
          .map((k) => k + ":" + o[k])
          .join("|");
      return {
        weapons,
        passives,
        active,
        text:
          "W[" +
          txt(weapons) +
          "] P[" +
          txt(passives) +
          "] A[" +
          txt(active) +
          "]",
        sling: this.clone(g.slingTree),
        evolutions: {
          weapon: this.clone(g.weaponTrees || {}),
          passive: this.clone(g.passiveTrees || {}),
          active: this.clone(g.activeTrees || {}),
        },
      };
    },
    finish(won, ret) {
      const r = this.current;
      if (!r || r.status !== "in_progress" || !G) return;
      this.integrateActiveTo(G.t);
      this.syncChoiceTools();
      const openSession = r.choices.find(
        (session) =>
          session.sessionId === this.activeChoiceSessionId &&
          session.status === "open",
      );
      if (openSession) {
        openSession.status = "ended_unselected";
        openSession.endedReason = "run_ended_without_selection";
        openSession.endedAt = Math.round(G.t * 10) / 10;
      }
      this.activeChoiceSessionId = null;
      this.snapshot(G, true);
      r.status = "completed";
      r.endedAt = new Date().toISOString();
      r.metrics.averageEnemiesAlive = r.metrics.activeSeconds
        ? r.metrics.enemyAliveSeconds / r.metrics.activeSeconds
        : 0;
      r.result = {
        won: !!won,
        returnedToMenu: !!ret,
        endReason: ret ? "interrupted_by_player" : won ? "victory" : "defeat",
        durationSeconds: Math.round(G.t * 10) / 10,
        activeSeconds: Math.round(r.metrics.activeSeconds * 10) / 10,
        averageEnemiesAlive: r.metrics.averageEnemiesAlive,
        level: G.lvl,
        kills: G.kills,
        hpRemaining: Math.round(G.p.hp * 100) / 100,
        maxHp: G.mods.maxhp,
        hitBy: G.hitBy || null,
        lastHits: this.clone(this.recentHits || []),
        coinsCollectedRaw: Math.round((G.coins || 0) * 1000) / 1000,
        coinMultiplier: Math.round(runCoinMul() * 1000) / 1000,
        coinsEarned: runCoins(G),
        economy: ecoReport(G),
        xpRemaining: Math.round((G.xp || 0) * 100) / 100,
        build: this.buildSnapshot(G),
      };
      this.event("run_end", this.clone(r.result));
      this.data.runs.push(r);
      this.lastRun = r;
      const excess = Math.max(0, this.data.runs.length - BALANCE_MAX_RUNS);
      if (excess) {
        this.data.historyDiscardedRuns =
          (this.data.historyDiscardedRuns || 0) + excess;
        this.data.runs = this.data.runs.slice(-BALANCE_MAX_RUNS);
      }
      this.current = null;
      this.data.active = null;
      this.pendingRerollFrom = null;
      this.persist();
    },
    /* completa result.economy depois do fim da partida (bônus do Desafio do Dia, anúncio de moedas) */
    patchEconomy(patch) {
      const r = this.lastRun;
      if (!r || !r.result || !patch) return;
      const e = (r.result.economy = Object.assign(r.result.economy || {}, patch));
      e.totalGranted =
        this.safeNum(e.coinsCredited) +
        this.safeNum(e.adCoins) +
        this.safeNum(e.dailyBonus);
      this.persist();
    },
    recoverInterrupted() {
      const old = this.data.active;
      if (old && old.status === "in_progress") {
        this.markInterrupted(old, "page_reload_or_tab_closed");
        this.data.runs.push(old);
        const excess = Math.max(0, this.data.runs.length - BALANCE_MAX_RUNS);
        if (excess) {
          this.data.historyDiscardedRuns =
            (this.data.historyDiscardedRuns || 0) + excess;
          this.data.runs = this.data.runs.slice(-BALANCE_MAX_RUNS);
        }
        this.data.active = null;
        this.persist();
      }
    },
    allData() {
      return {
        schemaVersion: this.data.schemaVersion || BALANCE_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        telemetryVersion: BALANCE_TELEMETRY_VERSION,
        game: "Fé Survivor",
        storage: {
          key: BALANCE_STORE_KEY,
          localOnly: true,
          storageFull: !!this.storageFull,
          persistenceFailed: !!this.storageFull,
          historyDiscardedRuns: this.data.historyDiscardedRuns || 0,
          storagePressureEvents: this.data.storagePressureEvents || 0,
          limits: {
            runs: BALANCE_MAX_RUNS,
            eventsPerRun: BALANCE_MAX_EVENTS,
            choicesPerRun: BALANCE_MAX_CHOICES,
            snapshotsPerRun: BALANCE_MAX_SNAPSHOTS,
            minuteBucketsPerRun: BALANCE_MAX_MINUTE_BUCKETS,
          },
        },
        contentFingerprint: this.contentFingerprint(),
        balanceTables: this.balanceTables(),
        runs: this.data.runs,
        active: this.current || this.data.active || null,
      };
    },
    /* identifica a versão dos números de balanceamento usada na partida */
    contentFingerprint() {
      if (this._fp) return this._fp;
      let h = 2166136261;
      const s = JSON.stringify(this.balanceTables());
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (this._fp = (h >>> 0).toString(16).padStart(8, "0"));
    },
    /* tabelas de balanceamento atuais (o que o jogo está usando agora) */
    balanceTables() {
      const content = window.FE_SURVIVOR_CONTENT || {},
        prim = (o) => this.primitiveModifiers(o),
        pick = (table) =>
          Object.fromEntries(
            Object.entries(table || {}).map(([id, v]) => [id, prim(v)]),
          );
      const weapons = {};
      for (const [id, w] of Object.entries(content.weapons || {}))
        weapons[id] = {
          name: w.name,
          behavior: w.behavior,
          base: this.clone(w.base),
          upgrades: (w.up || []).map((u) => u.d),
        };
      return {
        hpScale: HPS,
        rules: {
          winTimeSeconds: typeof WIN_T === "number" ? WIN_T : null,
          standardSlots: { weapons: 4, passives: 4, actives: MAX_ACTIVE_STANDARD },
          infiniteSlots: {
            weapons: INF_SLOTS_W,
            passives: INF_SLOTS_P,
            actives: INF_ACTIVES,
          },
          maxWeaponLevel: MAXW,
          maxPassiveLevel: MAXP,
          enemyCap: ENEMY_CAP,
          stackCaps: STACK_CAPS,
          domLevelForEvolution:
            typeof NXV !== "undefined" ? NXV.domLv : null,
        },
        heroes: Object.fromEntries(
          Object.entries(content.heroes || {}).map(([id, h]) => [
            id,
            { ...prim(h), attackRange: HRNG[id] || null },
          ]),
        ),
        weapons,
        passives: pick(content.passives),
        actives: pick(content.actives),
        enemies: pick(ET),
        bosses: (BOSSES || []).map((b) => prim(b)),
        worlds: (WORLDS || []).map((w) => prim(w)),
      };
    },
    csvTable(fields, rows) {
      return (
        "\ufeff" +
        [fields.join(",")]
          .concat(
            rows.map((o) => fields.map((k) => this.csvEscape(o[k])).join(",")),
          )
          .join("\r\n")
      );
    },
    runHead(r) {
      const c = r.config || {},
        h = c.hero || {},
        res = r.result || {};
      return {
        runId: r.id,
        attempt: r.attempt,
        status: r.status,
        gameVersion: r.gameVersion,
        fingerprint: c.contentFingerprint || "",
        mode: c.mode,
        world: c.world,
        heroId: h.id,
        won: res.won,
        durationSeconds:
          res.durationSeconds != null ? res.durationSeconds : r.lastT,
      };
    },
    allRuns() {
      return this.data.runs.concat(this.current ? [this.current] : []);
    },
    toCSVMinutes() {
      const fields = [
        "runId", "attempt", "status", "gameVersion", "fingerprint", "mode", "world", "heroId", "won", "durationSeconds",
        "minute", "activeSeconds", "averageEnemiesAlive", "averageHpRatio", "spawns", "kills", "eliteKills",
        "bossesSpawned", "bossesDefeated", "damageDealt", "damageToBosses", "damageToElites", "damageTaken",
        "mitigatedDamage", "hitsTaken", "blockedHits", "healingReceived", "xpRaw", "xpEffective", "coinsCollected",
        "levelsGained", "choicesMade", "dropsGenerated", "dropsCollected", "dropsExpired", "topDamageSource",
        "damageBySource", "killsByType", "enemySpawnsByType", "activeUses",
      ];
      const rows = [];
      const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
      for (const r of this.allRuns())
        for (const b of r.minuteBuckets || []) {
          const top = Object.entries(b.damageBySource || {}).sort((x, y) => y[1] - x[1])[0];
          rows.push({
            ...this.runHead(r),
            minute: b.minute,
            activeSeconds: Math.round((b.activeSeconds || 0) * 10) / 10,
            averageEnemiesAlive: Math.round((b.averageEnemiesAlive || 0) * 10) / 10,
            averageHpRatio: Math.round((b.averageHpRatio || 0) * 1000) / 1000,
            spawns: sum(b.enemySpawnsByType),
            kills: sum(b.killsByType),
            eliteKills: b.eliteKills,
            bossesSpawned: b.bossesSpawned,
            bossesDefeated: b.bossesDefeated,
            damageDealt: Math.round(b.damageDealt || 0),
            damageToBosses: Math.round(b.damageToBosses || 0),
            damageToElites: Math.round(b.damageToElites || 0),
            damageTaken: Math.round(b.damageTaken || 0),
            mitigatedDamage: Math.round(b.mitigatedDamage || 0),
            hitsTaken: b.hitsTaken,
            blockedHits: b.blockedHits,
            healingReceived: Math.round(b.healingReceived || 0),
            xpRaw: Math.round(b.xpRaw || 0),
            xpEffective: Math.round(b.xpEffective || 0),
            coinsCollected: b.coinsCollected,
            levelsGained: b.levelsGained,
            choicesMade: b.choicesMade,
            dropsGenerated: b.drops && b.drops.generated,
            dropsCollected: b.drops && b.drops.collected,
            dropsExpired: b.drops && b.drops.expired,
            topDamageSource: top ? top[0] + ":" + Math.round(top[1]) : "",
            damageBySource: Object.fromEntries(
              Object.entries(b.damageBySource || {}).map(([k, v]) => [k, Math.round(v)]),
            ),
            killsByType: b.killsByType,
            enemySpawnsByType: b.enemySpawnsByType,
            activeUses: b.activeUses,
          });
        }
      return this.csvTable(fields, rows);
    },
    toCSVWeapons() {
      const fields = [
        "runId", "attempt", "status", "gameVersion", "fingerprint", "mode", "world", "heroId", "won", "durationSeconds",
        "source", "kind", "finalLevel", "evolved", "damage", "damageShare", "dps", "hits", "avgHit", "kills",
        "killShare", "crits", "critRate", "finalStats",
      ];
      const rows = [];
      for (const r of this.allRuns()) {
        const m = r.metrics || {},
          dbw = m.damageByWeapon || {},
          kbw = m.killsByWeapon || {},
          hbw = m.hitsByWeapon || {},
          cbw = m.critsByWeapon || {},
          snaps = r.snapshots || [],
          last = snaps[snaps.length - 1] || {},
          lw = Object.fromEntries((last.weapons || []).map((w) => [w.id, w])),
          totalDmg = Object.values(dbw).reduce((a, b) => a + b, 0) || 1,
          totalKills = Object.values(kbw).reduce((a, b) => a + b, 0) || 1,
          dur = (r.result && r.result.durationSeconds) || r.lastT || 1,
          ids = new Set([...Object.keys(dbw), ...Object.keys(kbw), ...Object.keys(lw)]);
        for (const id of ids) {
          const w = lw[id],
            isWeapon = !!WEAPONS[id],
            dmg = dbw[id] || 0,
            hits = hbw[id] || 0;
          rows.push({
            ...this.runHead(r),
            source: id,
            kind: isWeapon ? "arma" : PASSIVES[id] ? "dom" : "efeito/outro",
            finalLevel: w ? w.level : "",
            evolved: w ? w.evolved : "",
            damage: Math.round(dmg),
            damageShare: Math.round((dmg / totalDmg) * 1000) / 1000,
            dps: Math.round((dmg / dur) * 10) / 10,
            hits,
            avgHit: hits ? Math.round((dmg / hits) * 10) / 10 : "",
            kills: kbw[id] || 0,
            killShare: Math.round(((kbw[id] || 0) / totalKills) * 1000) / 1000,
            crits: cbw[id] || 0,
            critRate: hits ? Math.round(((cbw[id] || 0) / hits) * 1000) / 1000 : "",
            finalStats: w ? w.stats : "",
          });
        }
      }
      return this.csvTable(fields, rows);
    },
    toCSVEnemies() {
      const fields = [
        "runId", "attempt", "status", "gameVersion", "fingerprint", "mode", "world", "heroId", "won", "durationSeconds",
        "type", "name", "spawned", "killed", "killRate", "avgSpawnHp", "avgSpawnDmg", "avgSpawnSpeed", "avgLifetimeSeconds",
        "maxLifetimeSeconds", "damageTakenFromPlayer", "damageDealtToPlayer", "hitsOnPlayer", "dpsContribution",
      ];
      const rows = [];
      for (const r of this.allRuns()) {
        const m = r.metrics || {},
          sp = m.enemiesSpawnedByType || {},
          kb = m.killsByType || {},
          ss = m.spawnStats || {},
          lf = m.lifetimeByType || {},
          dt = m.damageByTargetType || {},
          ds = m.damageSources || {},
          hs = m.hitsBySource || {},
          dur = (r.result && r.result.durationSeconds) || r.lastT || 1;
        for (const type of Object.keys(sp)) {
          const nm = (DI[type] && DI[type][0]) || type,
            s = ss[type],
            l = lf[type];
          rows.push({
            ...this.runHead(r),
            type,
            name: nm,
            spawned: sp[type],
            killed: kb[type] || 0,
            killRate: sp[type] ? Math.round(((kb[type] || 0) / sp[type]) * 1000) / 1000 : "",
            avgSpawnHp: s ? Math.round((s.hp / s.n) * 10) / 10 : "",
            avgSpawnDmg: s ? Math.round((s.dmg / s.n) * 10) / 10 : "",
            avgSpawnSpeed: s ? Math.round((s.spd / s.n) * 10) / 10 : "",
            avgLifetimeSeconds: l ? Math.round((l.sum / l.n) * 10) / 10 : "",
            maxLifetimeSeconds: l ? Math.round(l.max * 10) / 10 : "",
            damageTakenFromPlayer: Math.round(dt[type] || 0),
            damageDealtToPlayer: Math.round(ds[nm] || 0),
            hitsOnPlayer: hs[nm] || 0,
            dpsContribution: Math.round(((ds[nm] || 0) / dur) * 100) / 100,
          });
        }
      }
      return this.csvTable(fields, rows);
    },
    toCSVBosses() {
      const fields = [
        "runId", "attempt", "status", "gameVersion", "fingerprint", "mode", "world", "heroId", "won", "durationSeconds",
        "boss", "index", "cycle", "spawnedAt", "defeated", "secondsAlive", "hpMax", "enemyDmg", "enemySpeed",
        "damageDealt", "playerDps", "playerLevelAtSpawn", "playerLevelAtKill", "playerMaxHpAtSpawn",
        "playerHpRatioAtSpawn", "playerHpRatioAtEnd", "damageToPlayer", "hitsOnPlayer", "patterns",
      ];
      const rows = [];
      for (const r of this.allRuns())
        for (const f of r.bossFights || [])
          rows.push({
            ...this.runHead(r),
            boss: f.name,
            index: f.index,
            cycle: f.cycle,
            spawnedAt: Math.round((f.spawnedAt || 0) * 10) / 10,
            defeated: f.defeated,
            secondsAlive: f.secondsAlive,
            hpMax: Math.round(f.hpMax || 0),
            enemyDmg: f.enemyDmg,
            enemySpeed: f.enemySpeed != null ? Math.round(f.enemySpeed * 10) / 10 : "",
            damageDealt: Math.round(f.damageDealt || 0),
            playerDps: f.playerDps,
            playerLevelAtSpawn: f.playerLevelAtSpawn,
            playerLevelAtKill: f.playerLevelAtKill,
            playerMaxHpAtSpawn: f.playerMaxHpAtSpawn,
            playerHpRatioAtSpawn: f.playerHpRatioAtSpawn,
            playerHpRatioAtEnd: f.playerHpRatioAtEnd,
            damageToPlayer: Math.round(f.damageToPlayer || 0),
            hitsOnPlayer: f.hitsOnPlayer,
            patterns: f.patterns,
          });
      return this.csvTable(fields, rows);
    },
    /* ZIP simples (sem compressão) para baixar tudo de uma vez */
    zipStore(files) {
      const enc = new TextEncoder(),
        crcT = (this._crcT =
          this._crcT ||
          Array.from({ length: 256 }, (_, n) => {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            return c >>> 0;
          }));
      const crc = (u8) => {
        let c = 0xffffffff;
        for (let i = 0; i < u8.length; i++) c = crcT[(c ^ u8[i]) & 255] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
      };
      const parts = [],
        central = [];
      let offset = 0;
      const u16 = (v) => [v & 255, (v >>> 8) & 255],
        u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
      const dosTime = 0,
        dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
      for (const [name, text] of files) {
        const nameB = enc.encode(name),
          data = enc.encode(text),
          c = crc(data),
          local = new Uint8Array([
            ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0),
            ...u16(dosTime), ...u16(dosDate), ...u32(c),
            ...u32(data.length), ...u32(data.length),
            ...u16(nameB.length), ...u16(0),
          ]);
        parts.push(local, nameB, data);
        central.push(
          new Uint8Array([
            ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
            ...u16(dosTime), ...u16(dosDate), ...u32(c),
            ...u32(data.length), ...u32(data.length),
            ...u16(nameB.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
            ...u32(0), ...u32(offset),
          ]),
          nameB,
        );
        offset += local.length + nameB.length + data.length;
      }
      const cdSize = central.reduce((n, p) => n + p.length, 0),
        end = new Uint8Array([
          ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length),
          ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0),
        ]);
      return new Uint8Array(
        [...parts, ...central, end].reduce((a, p) => a.concat(Array.from(p)), []),
      );
    },
    exportPackage() {
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-"),
        json = JSON.stringify(this.allData(), null, 2),
        files = [
          ["01-partidas-resumo.csv", "\ufeff" + this.toCSV()],
          ["02-por-minuto.csv", this.toCSVMinutes()],
          ["03-por-arma.csv", this.toCSVWeapons()],
          ["04-por-inimigo.csv", this.toCSVEnemies()],
          ["05-por-chefe.csv", this.toCSVBosses()],
          ["06-tabelas-de-balanceamento.json", JSON.stringify(this.balanceTables(), null, 2)],
          ["07-telemetria-completa.json", json],
        ];
      let ok = false;
      try {
        const zip = this.zipStore(files);
        ok = this.download("fe-survivor-balance-pacote-" + stamp + ".zip", zip, "application/zip");
      } catch (e) {
        ok = false;
      }
      this.status(
        ok
          ? "Pacote completo (ZIP) preparado: 5 CSVs + tabelas de balanceamento + JSON."
          : "Não foi possível gerar o ZIP neste navegador. Use os botões JSON/CSV.",
      );
    },
    csvEscape(value) {
      const s =
        value == null
          ? ""
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value);
      return '"' + s.replace(/"/g, '""') + '"';
    },
    toCSV() {
      const fields = [
        "id",
        "schemaVersion",
        "telemetryVersion",
        "gameVersion",
        "status",
        "startedAt",
        "endedAt",
        "mode",
        "modeLabel",
        "world",
        "worldIndex",
        "worldName",
        "heroId",
        "heroName",
        "daily",
        "rngSeed",
        "rngSource",
        "attempt",
        "durationSeconds",
        "activeSeconds",
        "averageEnemiesAlive",
        "won",
        "endReason",
        "level",
        "kills",
        "enemiesSpawned",
        "maxEnemiesAlive",
        "damageDealt",
        "damageToBosses",
        "damageToElites",
        "damageTaken",
        "hitsTaken",
        "blockedHits",
        "healingReceived",
        "timeBelow30Hp",
        "timeBelow15Hp",
        "xpRaw",
        "xpEffective",
        "choicesMade",
        "choicesSkipped",
        "banishedOptions",
        "rerolls",
        "bossesSpawned",
        "bossesDefeated",
        "eliteKills",
        "hpRemaining",
        "maxHp",
        "coinsEarned",
        "coinsCollected",
        "hitBy",
        "buildText",
        "contentFingerprint",
        "hpScale",
        "slotsWeapons",
        "slotsPassives",
        "slotsActives",
        "heroHp",
        "heroDmg",
        "heroSpd",
        "heroCrit",
        "heroLuck",
        "crits",
        "critRate",
        "overkillDamage",
        "rawDamageTaken",
        "mitigatedDamage",
        "maxHit",
        "blockedDamage",
        "overhealing",
        "damagePerSecond",
        "damageTakenPerSecond",
        "killsByWeapon",
        "damageByTargetType",
        "healingBySource",
        "damageSources",
        "lastHits",
        "damageByWeapon",
        "pickupsByType",
        "activeUses",
        "runModifiers",
        "bossFights",
        "dropsGenerated",
        "dropsPlaced",
        "dropsCollected",
        "dropsExpired",
        "dropsConvertedToXp",
        "dropsByType",
        "dropsExpiredByReason",
        "choiceTools",
        "choiceSessions",
        "truncationAny",
        "truncatedEvents",
        "truncatedChoices",
        "truncatedSnapshots",
        "truncatedMinuteBuckets",
        "storageFailures",
        "storagePersistenceFailed",
        "storagePressureEvents",
        "historyDiscardedRuns",
        "limitEvents",
        "limitChoices",
        "limitSnapshots",
        "limitMinuteBuckets",
        "limitHistoryRuns",
      ];
      const rows = [fields.join(",")];
      const runs = this.data.runs.concat(this.current ? [this.current] : []);
      for (const r of runs) {
        const c = r.config || {},
          h = c.hero || {},
          m = r.metrics || {},
          res = r.result || {},
          b = res.build || null;
        const dbw = m.damageByWeapon
          ? Object.fromEntries(
            Object.entries(m.damageByWeapon).map(([k, v]) => [
              k,
              Math.round(v),
            ]),
          )
          : null;
        const obj = {
          id: r.id,
          schemaVersion: r.schemaVersion,
          telemetryVersion: r.telemetryVersion || 1,
          gameVersion: r.gameVersion,
          status: r.status,
          startedAt: r.startedAt,
          endedAt: r.endedAt,
          mode: c.mode,
          modeLabel: c.modeLabel,
          world: c.world,
          worldIndex: c.worldIndex,
          worldName: c.worldName,
          heroId: h.id,
          heroName: h.name,
          daily: c.dailyChallenge
            ? c.dailySeed == null
              ? "sim"
              : c.dailySeed
            : false,
          rngSeed: c.rng && c.rng.seed != null ? c.rng.seed : c.dailySeed,
          rngSource: c.rng && c.rng.source,
          attempt: r.attempt,
          durationSeconds:
            res.durationSeconds != null ? res.durationSeconds : r.lastT,
          activeSeconds: m.activeSeconds,
          averageEnemiesAlive: m.averageEnemiesAlive,
          won: res.won,
          endReason: res.endReason,
          level: res.level || m.maxLevel,
          kills: res.kills == null ? m.kills : res.kills,
          enemiesSpawned: m.enemiesSpawned,
          maxEnemiesAlive: m.maxEnemiesAlive,
          damageDealt: Math.round(m.damageDealt || 0),
          damageToBosses: Math.round(m.damageToBosses || 0),
          damageToElites: Math.round(m.damageToElites || 0),
          damageTaken: Math.round(m.damageTaken || 0),
          hitsTaken: m.hitsTaken,
          blockedHits: m.blockedHits,
          healingReceived: Math.round(m.healingReceived || 0),
          timeBelow30Hp: Math.round(m.timeBelow30Hp || 0),
          timeBelow15Hp: Math.round(m.timeBelow15Hp || 0),
          xpRaw: Math.round(m.xpRaw || 0),
          xpEffective: Math.round(m.xpEffective || 0),
          choicesMade: m.choicesMade,
          choicesSkipped: m.choicesSkipped,
          banishedOptions: m.banishedOptions,
          rerolls: m.rerolls,
          bossesSpawned: m.bossesSpawned,
          bossesDefeated: m.bossesDefeated,
          eliteKills: m.eliteKills,
          hpRemaining: res.hpRemaining,
          maxHp: res.maxHp,
          coinsEarned: res.coinsEarned,
          coinsCollected: m.coinsCollected,
          hitBy: res.hitBy,
          buildText: b ? b.text : null,
          contentFingerprint: c.contentFingerprint,
          hpScale: c.hpScale,
          slotsWeapons: c.slots && c.slots.weapons,
          slotsPassives: c.slots && c.slots.passives,
          slotsActives: c.slots && c.slots.actives,
          heroHp: h.hp,
          heroDmg: h.dmg,
          heroSpd: h.spd,
          heroCrit: h.crit,
          heroLuck: h.luck,
          crits: m.crits || 0,
          critRate: m.hitsByWeapon
            ? Math.round(
              ((m.crits || 0) /
                Math.max(1, Object.values(m.hitsByWeapon).reduce((a, b) => a + b, 0))) *
              1000,
            ) / 1000
            : "",
          overkillDamage: Math.round(m.overkillDamage || 0),
          rawDamageTaken: Math.round(m.rawDamageTaken || 0),
          mitigatedDamage: Math.round(m.mitigatedDamage || 0),
          maxHit: m.maxHit,
          blockedDamage: Math.round(m.blockedDamage || 0),
          overhealing: Math.round(m.overhealing || 0),
          damagePerSecond: Math.round(
            ((m.damageDealt || 0) / Math.max(1, res.durationSeconds || r.lastT || 1)) * 10,
          ) / 10,
          damageTakenPerSecond: Math.round(
            ((m.damageTaken || 0) / Math.max(1, res.durationSeconds || r.lastT || 1)) * 100,
          ) / 100,
          killsByWeapon: m.killsByWeapon,
          damageByTargetType: m.damageByTargetType
            ? Object.fromEntries(Object.entries(m.damageByTargetType).map(([k, v]) => [k, Math.round(v)]))
            : null,
          healingBySource: m.healingBySource
            ? Object.fromEntries(Object.entries(m.healingBySource).map(([k, v]) => [k, Math.round(v)]))
            : null,
          damageSources: m.damageSources
            ? Object.fromEntries(Object.entries(m.damageSources).map(([k, v]) => [k, Math.round(v)]))
            : null,
          lastHits: res.lastHits,
          damageByWeapon: dbw,
          pickupsByType: m.pickupsByType,
          activeUses: m.activeUses,
          runModifiers: c.runModifiers,
          bossFights: r.bossFights,
          dropsGenerated: m.drops && m.drops.generated,
          dropsPlaced: m.drops && m.drops.placed,
          dropsCollected: m.drops && m.drops.collected,
          dropsExpired: m.drops && m.drops.expired,
          dropsConvertedToXp: m.drops && m.drops.convertedToXp,
          dropsByType: m.drops && m.drops.byType,
          dropsExpiredByReason: m.drops && m.drops.expiredByReason,
          choiceTools: r.choiceTools,
          choiceSessions: r.choices && r.choices.length,
          truncationAny: !!(r.truncation && r.truncation.any),
          truncatedEvents: r.truncation && r.truncation.discarded.events,
          truncatedChoices: r.truncation && r.truncation.discarded.choices,
          truncatedSnapshots: r.truncation && r.truncation.discarded.snapshots,
          truncatedMinuteBuckets:
            r.truncation && r.truncation.discarded.minuteBuckets,
          storageFailures: r.truncation && r.truncation.storageFailures,
          storagePersistenceFailed: !!(
            r.truncation && r.truncation.storageFailures
          ),
          storagePressureEvents: this.data.storagePressureEvents || 0,
          historyDiscardedRuns: this.data.historyDiscardedRuns || 0,
          limitEvents: r.limits && r.limits.events,
          limitChoices: r.limits && r.limits.choices,
          limitSnapshots: r.limits && r.limits.snapshots,
          limitMinuteBuckets: r.limits && r.limits.minuteBuckets,
          limitHistoryRuns: r.limits && r.limits.historyRuns,
        };
        rows.push(fields.map((k) => this.csvEscape(obj[k])).join(","));
      }
      return rows.join("\r\n");
    },
    download(filename, data, mime) {
      try {
        const blob = new Blob([data], { type: mime + ";charset=utf-8" }),
          url = URL.createObjectURL(blob),
          a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        return true;
      } catch (e) {
        return false;
      }
    },
    exportJSON(lastOnly) {
      const data = this.allData();
      if (lastOnly) data.runs = data.runs.slice(-1);
      const ok = this.download(
        lastOnly
          ? "fe-survivor-ultima-partida.json"
          : "fe-survivor-balance-telemetry.json",
        JSON.stringify(data, null, 2),
        "application/json",
      );
      this.status(
        ok
          ? "Exportação JSON iniciada."
          : "Não foi possível baixar o JSON neste navegador.",
      );
    },
    exportCSV(kind) {
      const gen = {
        resumo: ["fe-survivor-balance-resumo.csv", () => "\ufeff" + this.toCSV()],
        minutos: ["fe-survivor-balance-por-minuto.csv", () => this.toCSVMinutes()],
        armas: ["fe-survivor-balance-por-arma.csv", () => this.toCSVWeapons()],
        inimigos: ["fe-survivor-balance-por-inimigo.csv", () => this.toCSVEnemies()],
        chefes: ["fe-survivor-balance-por-chefe.csv", () => this.toCSVBosses()],
      }[kind || "resumo"],
        ok = this.download(gen[0], gen[1](), "text/csv");
      this.status(
        ok
          ? "Exportação CSV iniciada."
          : "Não foi possível baixar o CSV neste navegador.",
      );
    },
    status(msg) {
      const el = document.getElementById("balanceExportStatus");
      if (el)
        el.textContent = this.storageFull
          ? msg + " A persistência local falhou; exporte o JSON para preservar os dados."
          : msg;
    },
    initUI() {
      /* O painel "Dados de balanceamento" saiu da tela final: a exportação fica só no menu inicial (openScreen). */
      const old = document.getElementById("balanceExportPanel");
      if (old) old.remove();
    },
    openScreen() {
      scr("Dados de Balanceamento", (b) => {
        const count = this.data.runs.length + (this.current ? 1 : 0);
        b.innerHTML =
          '<div class="rw"><span><b>Telemetria local</b><small>Registra build e status efetivos, sessões de escolha, Banir/Pular/Reroll, drops, métricas por minuto, dano por arma (com kills e críticos), inimigos (vida, dano, tempo de vida), chefes (padrões, dano ao herói, DPS), mitigação, cura, economia e as tabelas de balanceamento da versão. O pacote ZIP reúne tudo. Os dados ficam neste dispositivo até você exportá-los.</small></span></div>' +
          '<div class="rw"><span><b>' +
          count +
          " partidas registradas</b><small>Limite de histórico: " +
          BALANCE_MAX_RUNS +
          " partidas. Versão do esquema: " +
          BALANCE_SCHEMA_VERSION +
          " · Partidas antigas descartadas: " +
          (this.data.historyDiscardedRuns || 0) +
          (this.storageFull
            ? " · AVISO: a persistência local falhou; exporte os dados agora."
            : "") +
          ".</small></span></div>" +
          '<div class="balance-export-actions balance-export-grid"><button type="button" class="mb" id="balanceScreenLast">Última partida (JSON)</button><button type="button" class="mb" id="balanceScreenAll">Histórico completo (JSON)</button><button type="button" class="mb" id="balanceScreenCSV">Resumo para planilha (CSV)</button><button type="button" class="mb" id="balanceScreenMin">CSV por minuto</button><button type="button" class="mb" id="balanceScreenWpn">CSV por arma</button><button type="button" class="mb" id="balanceScreenEne">CSV por inimigo</button><button type="button" class="mb" id="balanceScreenBoss">CSV por chefe</button><button type="button" class="mb" id="balanceScreenZip">Pacote completo (ZIP)</button></div><p class="sub" id="balanceScreenStatus" aria-live="polite"></p>';
        const status = (m) => {
          const el = document.getElementById("balanceScreenStatus");
          if (el) el.textContent = m;
        };
        b.querySelector("#balanceScreenLast").addEventListener("click", () => {
          this.exportJSON(true);
          status("Arquivo preparado. Verifique a pasta de downloads.");
        });
        b.querySelector("#balanceScreenAll").addEventListener("click", () => {
          this.exportJSON(false);
          status("Arquivo preparado. Verifique a pasta de downloads.");
        });
        b.querySelector("#balanceScreenCSV").addEventListener("click", () => {
          this.exportCSV();
          status("Arquivo preparado. Verifique a pasta de downloads.");
        });
        [
          ["#balanceScreenMin", "minutos"],
          ["#balanceScreenWpn", "armas"],
          ["#balanceScreenEne", "inimigos"],
          ["#balanceScreenBoss", "chefes"],
        ].forEach(([sel, kind]) =>
          b.querySelector(sel).addEventListener("click", () => {
            this.exportCSV(kind);
            status("Arquivo preparado. Verifique a pasta de downloads.");
          }),
        );
        b.querySelector("#balanceScreenZip").addEventListener("click", () => {
          this.exportPackage();
          status("Pacote preparado. Verifique a pasta de downloads.");
        });
      });
    },
  };
  BTL.recoverInterrupted();
  BTL.initUI();

  function resize() {
    const w = gameEl.clientWidth || innerWidth,
      h = gameEl.clientHeight || innerHeight,
      a = w / h;
    document.documentElement.style.setProperty("--gh", h + "px");
    if (a >= 1) {
      if (a > 2.4) {
        VW = 648;
        VH = Math.round(648 / a);
      } else {
        VH = 270;
        VW = Math.round(270 * a);
      }
    } else {
      VW = 240;
      VH = Math.round(240 / a);
    }
    if (TOUCH_UI) {
      /* v0.26: cada pixel do jogo = k pixels físicos inteiros */
      const dpr = Math.max(1, window.devicePixelRatio || 1),
        tgt = a >= 1 ? (a > 2.4 ? 648 : 270) : 240,
        ax = a >= 1 && a <= 2.4 ? h : w,
        k = Math.max(1, Math.round((ax * dpr) / tgt));
      VW = Math.max(160, Math.round((w * dpr) / k));
      VH = Math.max(120, Math.round((h * dpr) / k));
    }
    cv.width = VW;
    cv.height = VH;
    ctx.imageSmoothingEnabled = false;
    vign = mk(VW, VH, (g) => {
      const gr = g.createRadialGradient(
        VW / 2,
        VH / 2,
        Math.min(VW, VH) * 0.35,
        VW / 2,
        VH / 2,
        Math.hypot(VW, VH) * 0.55,
      );
      gr.addColorStop(0, "rgba(5,3,15,0)");
      gr.addColorStop(1, "rgba(5,3,15,.6)");
      g.fillStyle = gr;
      g.fillRect(0, 0, VW, VH);
    });
  }

  /* ---- grade espacial para colisões ---- */
  const CELL = 32;
  let grid = new Map();
  const gk = (cx, cy) => ((cx & 1023) << 10) | (cy & 1023);
  function buildGrid() {
    grid = new Map();
    for (const e of G.enemies) {
      if (e.dead) continue;
      const k = gk(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
      const a = grid.get(k);
      if (a) a.push(e);
      else grid.set(k, [e]);
    }
  }
  function forNear(x, y, rad, fn) {
    const x0 = Math.floor((x - rad) / CELL),
      x1 = Math.floor((x + rad) / CELL),
      y0 = Math.floor((y - rad) / CELL),
      y1 = Math.floor((y + rad) / CELL);
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++) {
        const a = grid.get(gk(cx, cy));
        if (a) for (let i = 0; i < a.length; i++) if (!a[i].dead) fn(a[i]);
      }
  }

  /* ================= início de partida ================= */
  function newRun(hk) {
    const H = HEROES[hk];
    G = {
      hero: H,
      hk,
      t: 0,
      kills: 0,
      coins: 0, // moedas-base (drops + Colheita), sujeitas aos multiplicadores
      offerCoins: 0, // moedas da Oferta (fixas, fora dos multiplicadores)
      eco: ecoNew(),
      lvl: 1,
      xp: 0,
      need: needFor(1),
      p: {
        x: 0,
        y: 0,
        hp: H.hp,
        face: 1,
        ang: 0,
        inv: 0,
        sh: 0,
        regen: 0,
        moving: false,
        walk: 0,
      },
      W: {},
      P: {},
      slingTree: null,
      weaponTrees: {},
      passiveTrees: {},
      activeTrees: {},
      enemies: [],
      shots: [],
      eshots: [],
      poisonPools: [],
      poisonT: 0,
      poisonTick: 0,
      poisonSrc: null,
      pk: [],
      parts: [],
      fx: [],
      mods: {},
      bossIdx: 0,
      boss: null,
      spawnAcc: 0,
      itemT: 7,
      tRing: 40,
      ringN: 0,
      tElite: 100,
      visited: new Set(),
      shake: 0,
      flash: 0,
      hurtFlash: 0,
      pending: [],
      over: false,
      rackKey: "",
      choiceTools: createChoiceTools(),
      signalZones: [],
      signalZoneActive: false,
      signalZoneCrit: 0,
      signalZoneRange: 0,
    };
    addWeapon(H.start);
    if (H.startLvl > 1) {
      G.W[H.start].lvl = H.startLvl;
      G.W[H.start].s = statsFor(H.start, H.startLvl);
    }
    recalc();
    G.p.hp = G.mods.maxhp;
    for (let i = 0; i < 7; i++) spawnEnemy("imp");
    scatter();
  }
  function addWeapon(id) {
    G.W[id] = { lvl: 1, cd: 0.5, ang: 0, tick: 0, s: statsFor(id, 1) };
  }
  /* aplica os limites de empilhamento e registra quais foram atingidos (m.stackCapped) */
  function applyStackCaps(m, H) {
    const C = STACK_CAPS,
      hit = [];
    const lim = (name, cur, cap, up) => {
      if (up ? cur > cap : cur < cap) {
        hit.push(name);
        return cap;
      }
      return cur;
    };
    if (H.dmg) m.dmg = lim("dmg", m.dmg, H.dmg * C.dmg, true);
    if (H.xp) m.xp = lim("xp", m.xp, H.xp * C.xp, true);
    if (H.spd) m.spd = lim("speed", m.spd, H.spd * C.speed, true);
    if (H.pickup) m.pickup = lim("pickup", m.pickup, 26 * H.pickup * C.pickup, true);
    m.cd = lim("cd", m.cd, C.cdMin, false);
    m.crit = lim("crit", m.crit || 0, C.crit, true);
    m.critMul = lim("critMul", m.critMul || 2, C.critMul, true);
    if (m.regen) m.regen = lim("regen", m.regen, C.regenMin, false);
    if (m.invT) m.invT = lim("invT", m.invT, C.invT, true);
    m.exec = lim("exec", m.exec || 0, C.exec, true);
    m.guil = lim("guil", m.guil || 0, C.guil, true);
    m.stackCapped = hit.join(",");
  }
  function recalc() {
    const m = G.mods,
      P = effP(),
      H = G.hero;
    m.maxhp = H.hp;
    m.dmg = H.dmg;
    m.cd = 1 / (H.attackSpeed || 1);
    m.pspd = 1;
    m.spd = H.spd;
    m.pickup = 26 * H.pickup;
    m.xp = H.xp;
    m.block = 0;
    m.rng = HRNG[G.hk] || 90;
    m.regen = 0;
    m.area = 1;
    m.duration = 1;
    m.amount = 0;
    m.luck = Number(H.luck) || 0;
    m.greed = 0;
    m.curse = 0;
    m.curseSpd = 0;
    let rangeBonus = 0,
      armorBonus = 0,
      maxHpPercent = 0;
    for (const [id, rawLevel] of Object.entries(P)) {
      const level = Math.max(0, Number(rawLevel) || 0),
        def = PASSIVES[id];
      if (!level || !def) continue;
      switch (def.behavior) {
        case "max_salvation":
          m.maxhp += 2 * level * HPS;
          break;
        case "global_damage":
          m.dmg *= 1 + 0.12 * level;
          break;
        case "block_chance":
          m.block += 0.12 * level;
          break;
        case "movement_speed":
          m.spd *= 1 + 0.1 * level;
          break;
        case "pickup_range":
          m.pickup *= 1 + 0.3 * level;
          break;
        case "regeneration":
          m.regen = Math.max(3, 14 - 2 * level);
          break;
        case "faith_gain":
          m.xp *= 1 + 0.12 * level;
          break;
        case "weapon_cooldown":
          m.cd *= 1 - 0.08 * level;
          break;
        case "attack_range":
          rangeBonus += 0.2 * level;
          break;
        case "eagle_mobility":
          m.spd *= 1 + 0.05 * level;
          rangeBonus += 0.15 * level;
          break;
        case "fervor":
          m.cd /= 1 + 0.1 * level;
          m.pspd *= 1 + 0.08 * level;
          break;
        case "flat_armor":
          armorBonus += 0.75 * level;
          break;
        case "max_salvation_percent":
          maxHpPercent += 0.1 * level;
          break;
        case "weapon_area":
          m.area *= 1 + 0.07 * level;
          break;
        case "effect_duration":
          m.duration *= 1 + 0.08 * level;
          break;
        case "weapon_amount":
          m.amount += level;
          break;
        case "luck":
          m.luck += 0.05 * level;
          break;
        case "greed":
          m.greed += 0.08 * level;
          break;
        case "curse":
          m.curse += 0.03 * level;
          m.curseSpd += 0.015 * level;
          break;
        case "revival":
          /* consumed by hurtPlayer once per run; the owned level is G.P.manto */ break;
        case "omni_curse":
          m.dmg *= 1 + 0.03 * level;
          m.pspd *= 1 + 0.03 * level;
          m.area *= 1 + 0.03 * level;
          m.duration *= 1 + 0.03 * level;
          if (((G.P && G.P[id]) || 0) >= passiveMaxLevel(id)) m.curse += 0.12;
          break;
      }
    }
    m.cd = Math.max(0.4, m.cd);
    if (G.p && G.p.atkBuffT > 0) {
      m.cd /= 1 + (G.p.atkBuffBonus || 1);
      m.dmg *= G.p.atkBuffDmg || 1;
    }
    m.block = Math.min(0.45, m.block);
    m.rng *= 1 + rangeBonus;
    m.area = Math.min(2.5, m.area);
    m.duration = Math.min(2.5, m.duration);
    m.amount = Math.min(2.4, m.amount);
    m.luck = Math.min(0.25, m.luck);
    m.greed = Math.min(0.4, m.greed);
    m.curse = Math.min(0.35, m.curse);
    m.curseSpd = Math.min(0.12, m.curseSpd);
    m.moveDmg = 0;
    m.evoDR = 0;
    m.thorns = 0;
    m.regenShield = 0;
    shopMods(m);
    m.dr = Math.min(8.75, (m.dr || 0) + armorBonus);
    const E = G.passiveTrees || {},
      path = (id) => E[id] && E[id].path,
      tier = (id) => (E[id] && E[id].tier ? 1 : 0);
    if (path("helmet") === "crown") m.maxhp += (tier("helmet") ? 4 : 2) * HPS;
    if (path("helmet") === "mercy")
      m.regen = m.regen
        ? Math.max(2, m.regen - (tier("helmet") ? 5 : 3))
        : tier("helmet")
          ? 10
          : 13;
    if (path("helmet") === "steadfast") m.block += tier("helmet") ? 0.08 : 0.05;
    if (path("belt") === "righteousness") m.dmg *= tier("belt") ? 1.25 : 1.15;
    if (path("belt") === "truth") m.xp *= tier("belt") ? 1.2 : 1.1;
    if (path("belt") === "warrior") m.moveDmg += tier("belt") ? 0.22 : 0.12;
    if (path("breast") === "fortitude") m.block += tier("breast") ? 0.12 : 0.08;
    if (path("breast") === "thorns") m.thorns = tier("breast") ? 8 : 5;
    if (path("breast") === "refuge") m.evoDR = tier("breast") ? 6.25 : 3.25;
    if (path("boots") === "swiftness") m.spd *= tier("boots") ? 1.22 : 1.12;
    if (path("boots") === "pilgrimage") m.pickup *= tier("boots") ? 1.4 : 1.2;
    if (path("boots") === "momentum") m.moveDmg += tier("boots") ? 0.2 : 0.1;
    if (path("grace") === "gatherer") m.pickup *= tier("grace") ? 1.65 : 1.4;
    if (path("grace") === "harvest") m.xp *= tier("grace") ? 1.22 : 1.12;
    if (path("grace") === "abundance") {
      m.pickup *= tier("grace") ? 1.25 : 1.12;
      m.xp *= tier("grace") ? 1.15 : 1.08;
    }
    if (path("hope") === "restoration" && m.regen)
      m.regen = Math.max(2, m.regen - (tier("hope") ? 4 : 2));
    if (path("hope") === "endurance") m.maxhp += (tier("hope") ? 4 : 2) * HPS;
    if (path("hope") === "shielding") m.regenShield = tier("hope") ? 0.9 : 0.5;
    if (path("wisdom") === "insight") m.xp *= tier("wisdom") ? 1.22 : 1.18;
    if (path("wisdom") === "discernment") m.dmg *= tier("wisdom") ? 1.14 : 1.08;
    if (path("fasting") === "devotion") m.cd *= tier("fasting") ? 0.82 : 0.9;
    if (path("fasting") === "discipline")
      m.pspd *= tier("fasting") ? 1.25 : 1.15;
    if (path("fasting") === "stillness")
      m.crit = (m.crit || 0) + (tier("fasting") ? 0.06 : 0.035);
    if (path("watch") === "sentinel") m.rng *= tier("watch") ? 1.45 : 1.25;
    if (path("watch") === "precision") m.dmg *= tier("watch") ? 1.14 : 1.08;
    if (path("watch") === "vigilance") m.cd *= tier("watch") ? 0.82 : 0.9;
    if (path("eagle") === "wings") m.spd *= tier("eagle") ? 1.22 : 1.12;
    if (path("eagle") === "soar") m.pspd *= tier("eagle") ? 1.25 : 1.15;
    if (path("eagle") === "dive") m.moveDmg += tier("eagle") ? 0.22 : 0.12;
    if (path("fervor") === "zeal") m.cd *= tier("fervor") ? 0.82 : 0.9;
    if (path("fervor") === "flame") m.dmg *= tier("fervor") ? 1.15 : 1.1;
    if (path("fervor") === "momentum") m.pspd *= tier("fervor") ? 1.25 : 1.15;
    if (G.signalZoneActive) {
      m.crit += G.signalZoneCrit || 0.15;
      m.rng *= 1 + (G.signalZoneRange || 0.2);
    }
    m.block = Math.min(0.58, m.block);
    applyStackCaps(m, H);
    m.maxhp = Math.round(m.maxhp * (1 + maxHpPercent));
  }

  /* ================= inimigos ================= */
  function spawnEnemy(type, ang, dist) {
    if (G.enemies.length >= 240) return null;
    const T = ET[type];
    if (!T) {
      console.warn("[Content] spawnEnemy received unknown demon ID:", type);
      return null;
    }
    const a = ang !== undefined ? ang : rng() * 6.2832,
      d = dist || Math.hypot(VW, VH) / 2 + rnd(12, 40),
      hm = enemyHpScale(G.t);
    const e = {
      t: type,
      x: G.p.x + Math.cos(a) * d,
      y: G.p.y + Math.sin(a) * d,
      hp: T.hp * hm * (1 + (G.mods.curse || 0)),
      mhp: T.hp * hm * (1 + (G.mods.curse || 0)),
      spd: T.spd * rnd(0.9, 1.1) * (1 + (G.mods.curseSpd || 0)),
      dmg: T.dmg,
      r: T.r,
      spr: T.spr,
      sc: T.sc || 1,
      mv: T.mv,
      col: T.col,
      flash: 0,
      kx: 0,
      ky: 0,
      slowT: 0,
      shCd: 0,
      hurtT: 0,
      ph: rnd(0, 6.28),
      face: 1,
      elite: type === "elite",
      boss: false,
      dead: false,
      atk: 2,
      ab: T.ab,
      mass: T.mass == null ? 0.5 : T.mass,
      fly: !!T.fly,
      fps: T.fps || 6,
      ai: null,
      pose: null,
      dropBehavior: T.dropBehavior || null,
      rangedAttack: T.rangedAttack || null,
    };
    G.enemies.push(e);
    BTL.spawn(e, false);
    return e;
  }
  /* Escala de vida dos inimigos e taxa de spawn: usadas no jogo e na telemetria (fonte única). */
  function enemyHpScale(t) {
    return 1 + (G && G.inf && t > 600 ? 3 + (t - 600) / 400 : t / 200);
  }
  const ENEMY_CAP = 240;
  function spawnRateNow(g) {
    return (
      (1.2 + g.t * 0.009) *
      Math.min(1, 0.85 + g.t / 800) *
      (g.boss ? 0.6 : 1) *
      RUN.spawn *
      (1 + 1.2 * rage(g)) *
      (1 + (g.mods.curse || 0))
    );
  }
  function spawnBoss(i) {
    const B = BOSSES[i % BOSSES.length],
      cyc = Math.floor(i / BOSSES.length),
      a = rng() * 6.2832,
      d = 105;
    let pw = 0;
    for (const k in G.W) pw += G.W[k].lvl;
    for (const k in G.P) pw += G.P[k];
    // Balance Patch 0.1: os chefes respeitam os modificadores do mundo, como os demônios comuns.
    const world = RUN.world;
    const worldHp = world && Number.isFinite(world.hp) ? world.hp : 1;
    const worldSpd = world && Number.isFinite(world.spd) ? world.spd : 1;
    const bhp = Math.round(
      B.hp *
      (1 + cyc * 0.5) *
      (1 + Math.min(0.35, 0.02 * Math.max(0, pw - 3))) *
      worldHp,
    ); // +3,5% de vida por melhoria acima de 3, além do mundo
    const e = {
      t: "boss",
      x: G.p.x + Math.cos(a) * d,
      y: G.p.y + Math.sin(a) * d,
      hp: bhp,
      mhp: bhp,
      spd: B.spd * worldSpd,
      dmg: B.dmg,
      r: 6 * B.sc,
      spr: B.spr,
      sc: B.sc,
      mv: "chase",
      col: B.col,
      flash: 0,
      kx: 0,
      ky: 0,
      slowT: 0,
      shCd: 0,
      ph: 0,
      face: 1,
      elite: false,
      boss: true,
      dead: false,
      atk: 3,
      idx: i % BOSSES.length,
      act: null,
      mass: 10,
    };
    if (S[B.spr] && S[B.spr].hd) e.sc = 1;
    G.enemies.push(e);
    G.boss = e;
    G.arena = { x: G.p.x, y: G.p.y, r: ARENA(Math.min(i, 6)) };
    BTL.bossSpawn(e, B);
    banner(B.name + (cyc ? " · retorno " + cyc : ""), B.sub);
    SFX.play("boss");
    G.shake = 0.6;
  }
  function chooseType() {
    const t = G.t,
      list = [];
    for (const [k, T] of Object.entries(ET)) {
      if (T.spawnPool !== "survival" || t < T.from || !(T.w > 0)) continue;
      const growth = Number(T.weightGrowthPerSecond) || 0;
      list.push({ k, w: T.w + Math.max(0, t - T.from) * growth });
    }
    if (!list.length)
      return (
        Object.keys(ET).find(
          (k) => ET[k].spawnPool === "survival" && ET[k].w > 0,
        ) || "imp"
      );
    return wpick(list).k;
  }
  function ring(type, n, dist) {
    // RUN.spawn também se aplica a eventos roteirizados, não apenas ao spawn contínuo.
    const count = scaledEventCount(n);
    for (let i = 0; i < count; i++)
      spawnEnemy(type, (i / count) * 6.2832, dist);
  }

  /* Balance Lab: atribui o dano de um efeito à arma que o criou (f.wid / s.wid). */
  function hurtBy(src, e, d, kx, ky, kb) {
    const prev = BTL.src;
    BTL.src = src || null;
    try {
      hurt(e, d, kx, ky, kb);
    } finally {
      BTL.src = prev;
    }
  }
  function hurt(e, d, kx, ky, kb) {
    if (e.dead) return;
    if (G.p && G.p.moving && G.mods.moveDmg) d *= 1 + G.mods.moveDmg;
    if (G.mods.exec && e.mhp && e.hp / e.mhp < 0.3) d *= 1 + G.mods.exec;
    if (G.rageT > 0 && G.mods.rage) d *= 1 + G.mods.rage;
    if (G.nextBonus) {
      d *= 1.5;
      G.nextBonus = false;
    }
    if (G.mods.crit && rng() < G.mods.crit) {
      d *= G.mods.critMul || 2;
      var cr = true;
    } else var cr = false;
    d = Math.max(0, roundGameplayValue(d));
    BTL.damage(
      Math.min(Math.max(0, d), Math.max(0, e.hp)),
      e,
      BTL.src || "other",
      { crit: cr, overkill: Math.max(0, d - Math.max(0, e.hp)), raw: d },
    );
    dmgNum(e, Math.min(d, e.hp), cr);
    e.hp -= d;
    e.flash = 0.09;
    e.hurtT = 0.12;
    if (!(e.sqT > 0)) e.sqT = 0.12; /* um pulso por vez: sob fogo contínuo vira pulsar, não deformação fixa */
    if (kb) {
      const k =
        (kb * (G.mods.kbm || 1) * (G.mods.kbBonus || 1)) /
        (e.boss ? 8 : e.elite ? 2.5 : 1);
      e.kx += kx * k;
      e.ky += ky * k;
    }
    SFX.play("hit");
    if (
      G.mods.guil &&
      !e.boss &&
      e.hp > 0 &&
      e.hp / e.mhp < 0.2 &&
      rng() < G.mods.guil
    ) {
      const executeRemainder = Math.max(0, e.hp);
      e.hp = 0;
      BTL.damage(executeRemainder, e, "execution");
    }
    if (e.hp <= 0) kill(e);
  }
  function burst(x, y, n, col, sp) {
    if (!save.set.fx) return;
    for (let i = 0; i < n && G.parts.length < 400; i++) {
      const a = rngFx() * 6.2832,
        v = rndFx(10, sp || 60);
      G.parts.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: rndFx(0.3, 0.7),
        max: 0.7,
        col,
        sz: rngFx() < 0.3 ? 2 : 1,
      });
    }
  }
  function enemyDeathFx(e) {
    const g = G;
    if (
      !save.set.fx ||
      !e ||
      e.boss ||
      g.fx.filter((f) => f.k === "enemyDeath").length >= 48
    )
      return;
    const sprite = eSpr(e, g),
      frames =
        e.spr === "plague_rat"
          ? PLAGUE_RAT_ART.death
          : (EA[e.spr] && EA[e.spr].std && EA[e.spr].std.death) || null;
    if (!sprite) return;
    const smoke = [];
    for (let i = 0; i < 8; i++)
      smoke.push({
        x: rndFx(-sprite.w * 0.35, sprite.w * 0.35),
        y: rndFx(-sprite.h * 0.4, sprite.h * 0.4),
        vx: rndFx(-22, 22),
        vy: rndFx(-34, -9),
        delay: 0.025 + i * 0.018,
        life: rndFx(0.22, 0.32),
        size: rngFx() < 0.35 ? 3 : 2,
        col: rngFx() < 0.5 ? "#541b42" : "#35172f",
      });
    const syy =
      e.mv === "swoop" ? 0.75 + 0.25 * Math.abs(Math.sin(g.t * 14 + e.ph)) : 1;
    g.fx.push({
      k: "enemyDeath",
      x: e.x,
      y: e.y,
      sprite,
      sc: e.sc,
      syy,
      flip: e.face < 0,
      smoke,
      frames,
      t: 0,
      life: frames ? 0.72 : 0.4,
    });
  }
  /* Game feel: congela a simulação por instantes ao derrotar elite/chefe. Só desenho continua.
     Intervalo mínimo entre congelamentos evita travadas em ondas de elites. Respeita "efeitos visuais". */
  const HITSTOP_MIN_GAP_MS = 350;
  function hitStop(sec) {
    if (state !== "play" || !G || !save.set.fx) return;
    const now = performance.now();
    if (now - (G.hsLast || 0) < HITSTOP_MIN_GAP_MS) return;
    G.hsLast = now;
    G.hitstop = sec;
  }
  function kill(e) {
    if (e.dead) return;
    e.dead = true;
    if (e.boss) hitStop(0.09);
    else if (e.elite) hitStop(0.04);
    G.kills++;
    BTL.killed(e);
    if (G.mods.rage) G.rageT = 2;
    if (G.mods.killHeal && G.p) {
      /* limite: no máximo 4 de Salvação por segundo vindos de abates */
      const win = G.khWin || (G.khWin = { t: G.t, v: 0 });
      if (G.t - win.t >= 1) {
        win.t = G.t;
        win.v = 0;
      }
      const add = Math.min(G.mods.killHeal, Math.max(0, 4 - win.v));
      if (add > 0) {
        win.v += add;
        const hp0 = G.p.hp;
        G.p.hp = Math.min(G.mods.maxhp, G.p.hp + add);
        BTL.heal(G.p.hp - hp0, "on_kill");
      }
    }
    if (G.mods.acc && G.kills % 20 === 0) G.nextBonus = true;
    harvestTick();
    const fireTree = G.weaponTrees && G.weaponTrees.fire;
    if (
      fireTree &&
      fireTree.path === "wildfire" &&
      e.burnT > 0 &&
      !e.burnBurst
    ) {
      e.burnBurst = true;
      const radius = fireTree.tier ? 48 : 34,
        blast = (e.burnDmg || 1) * (fireTree.tier ? 7 : 5);
      burst(e.x, e.y, fireTree.tier ? 16 : 10, "#ff9a2a", 85);
      for (const near of G.enemies) {
        if (near === e || near.dead) continue;
        const dx = near.x - e.x,
          dy = near.y - e.y,
          d = Math.hypot(dx, dy) || 1;
        if (d < radius + near.r)
          hurtBy("kill_blast", near, blast, dx / d, dy / d, 18);
      }
    }
    if (KILL_MS.indexOf(G.kills) >= 0) toast(G.kills + " demônios derrotados!");
    if (e.ab === "fuse") explode(e);
    if (e.boss) burst(e.x, e.y, 40, e.col, 120);
    else enemyDeathFx(e);
    SFX.play("kill");
    if (e.boss) {
      G.boss = null;
      G.bossIdx++;
      G.eshots.length = 0;
      G.flash = 0.5;
      G.shake = 0.6;
      drop(e.x, e.y, "ark");
      toast(
        G.inf
          ? "Chefe derrotado! A vigília continua."
          : e.idx === 4
            ? "O Dragão caiu! Resista até o amanhecer"
            : "Chefe derrotado! A Arca da Aliança apareceu",
      );
    } else if (e.elite) {
      drop(e.x, e.y, "f3");
      drop(e.x + 6, e.y, "f2");
      for (let i = 0; i < 3; i++)
        drop(e.x + rnd(-12, 12), e.y + rnd(-12, 12), "coin");
      drop(e.x - 8, e.y, pick(["bread", "mana", "fire", "shield"]));
    } else if (e.dropBehavior === "brute_bonus") {
      drop(e.x, e.y, "f2");
      if (rng() < 0.25) drop(e.x + 5, e.y, "coin");
    } else {
      const luck = Math.max(0, Math.min(0.25, G.mods.luck || 0));
      drop(e.x, e.y, rng() < 0.02 * (1 + luck * 0.8) ? "f2" : "f1");
      if (rng() < 0.05 * (1 + luck)) drop(e.x + 4, e.y + 2, "coin");
    }
  }
  function drop(x, y, type) {
    if (type === "f1" && G.pk.length > 380) {
      BTL.pickupGenerated(type, null, true);
      gainXp(1);
      return;
    }
    const pickup = {
      x,
      y,
      type,
      ph: rnd(0, 6.28),
      mag: false,
      sp: 0,
      life: type === "coin" ? COIN_LIFETIME : type[0] === "f" ? 90 : 60,
    };
    G.pk.push(pickup);
    BTL.pickupGenerated(type, pickup, false);
  }
  const COIN_LIFETIME = 8,
    COIN_BLINK_SECONDS = 2.5;
  function tickCoinLifetime(k, dt) {
    if (k.type !== "coin") return false;
    k.life -= dt;
    if (k.life > 0) return false;
    k.dead = true;
    return true;
  }
  function coinOpacity(k, time) {
    return k.type === "coin" &&
      k.life <= COIN_BLINK_SECONDS &&
      Math.floor(time * 8) % 2 === 0
      ? 0.25
      : 1;
  }

  /* ================= progresso ================= */
  // Patch 0.3: modos que aumentam a densidade de inimigos rendem menos XP por abate (evita que a dificuldade vire poder).
  function xpDensityMul() {
    return RUN.world && RUN.world.key === "world2" ? 0.85 : 1;
  }
  /* valor da Oferta mostrado na carta (já com o fator temporal da Vigília) */
  function offerShown(r) {
    const base = Math.round(ECO.OFFER_BASE * RAR[r || 0].m);
    return Math.round(base * (G && G.inf ? vigFactor(G.t) : 1));
  }
  function gainXp(v) {
    v *= xpDensityMul();
    const effectiveXp = v * G.mods.xp;
    BTL.xp(v, effectiveXp);
    G.xp += effectiveXp;
    while (G.xp >= G.need) {
      G.xp -= G.need;
      G.lvl++;
      G.need = needFor(G.lvl);
      G.pending.push({ kind: "lvl", n: G.lvl });
      BTL.levelUp(G.lvl);
    }
  }
  function rollChoices() {
    const g = G,
      wc = Object.keys(g.W).length,
      pc = Object.keys(g.P).length;
    g.snub = g.snub || {};
    g.offerN = (g.offerN || 0) + 1;
    if (g.pending[0] && g.pending[0].kind === "slingTree")
      return Object.keys(SLING_TREE).map((id) => ({ kind: "slingBranch", id }));
    const pool = [],
      add = (kind, id, w) => pool.push({ kind, id, w });
    const pd = g.pending[0];
    if (pd && pd.kind === "weaponTree")
      return Object.keys(EVOLUTION_TREES.weapon[pd.id].paths).map((id) => ({
        kind: "weaponBranch",
        id,
        ownerId: pd.id,
      }));
    if (pd && pd.kind === "passiveTree")
      return Object.keys(EVOLUTION_TREES.passive[pd.id].paths).map((id) => ({
        kind: "passiveBranch",
        id,
        ownerId: pd.id,
      }));
    if (pd && pd.kind === "activeTree")
      return Object.keys(EVOLUTION_TREES.active[pd.id].paths).map((id) => ({
        kind: "activeBranch",
        id,
        ownerId: pd.id,
      }));
    for (const id in WEAPONS) {
      const w = g.W[id];
      if (w) {
        if (w.lvl < MAXW) add("w", id, 1.25);
      } else if (wc < SLOT_W) add("w", id, 0.5);
    } /* armas novas são raras de propósito */
    for (const id in PASSIVES) {
      const l = g.P[id],
        max = passiveMaxLevel(id);
      if (l) {
        if (l < max) add("p", id, passivePickWeight(id));
      } else if (pc < SLOT_P) add("p", id, passivePickWeight(id));
    }
    const nA = g.A ? g.A.length : 0;
    for (const id in ACT) {
      const l = g.al && g.al[id];
      if (l) {
        if (l < MAXA) add("a", id, 0.8);
      } else if (nA < activeSkillLimit(g)) add("a", id, 0.7);
    }
    let ok = pool.filter((c) => !(g.snub[cardKey(c)] > g.offerN));
    const src =
      ok.length >= 3
        ? ok
        : pool; /* ignoradas ficam de fora; se faltar opção, voltam */
    const bag = src.slice(),
      out = [],
      skip = [];
    let newW = 0,
      nW = 0;
    while (out.length < 3 && bag.length) {
      const c = wpick(bag);
      bag.splice(bag.indexOf(c), 1);
      const isNewW = c.kind === "w" && !g.W[c.id];
      if ((isNewW && newW >= 1) || (c.kind === "w" && nW >= 2)) {
        skip.push(c);
        continue;
      } /* no máximo 1 arma nova e 2 cartas de arma por sorteio */
      if (isNewW) newW++;
      if (c.kind === "w") nW++;
      out.push(c);
    }
    while (out.length < 3 && skip.length) out.push(skip.shift());
    const fill = [{ kind: "heal" }, { kind: "coins" }];
    while (out.length < 3) out.push(fill[out.length % 2]);
    /* A maestria é uma opção garantida até ser escolhida; árvores aguardando maestria são serializadas, uma por vez. */
    let node = null;
    if (
      g.slingTree &&
      g.slingTree.tier < 1 &&
      g.W.sling &&
      g.W.sling.lvl >= MAXW
    )
      node = { kind: "slingNode", id: g.slingTree.path };
    if (!node) {
      for (const id of Object.keys(g.weaponTrees || {}))
        if (g.weaponTrees[id].tier < 1 && g.W[id] && g.W[id].lvl >= MAXW) {
          node = {
            kind: "weaponNode",
            id: g.weaponTrees[id].path,
            ownerId: id,
          };
          break;
        }
      if (!node)
        for (const id of Object.keys(g.activeTrees || {}))
          if (g.activeTrees[id].tier < 1 && g.al && g.al[id] >= MAXA) {
            node = {
              kind: "activeNode",
              id: g.activeTrees[id].path,
              ownerId: id,
            };
            break;
          }
      if (!node)
        for (const id of Object.keys(g.passiveTrees || {}))
          if (g.passiveTrees[id].tier < 1 && g.P[id] >= passiveMaxLevel(id)) {
            node = {
              kind: "passiveNode",
              id: g.passiveTrees[id].path,
              ownerId: id,
            };
            break;
          }
    }
    if (
      node &&
      !out.some(
        (c) =>
          c.kind === node.kind &&
          c.id === node.id &&
          c.ownerId === node.ownerId,
      )
    )
      out[out.length - 1] = node;
    const ark = g.pending[0] && g.pending[0].kind === "ark";
    const treeCards = [
      "slingBranch",
      "slingNode",
      "weaponBranch",
      "weaponNode",
      "passiveBranch",
      "passiveNode",
      "activeBranch",
      "activeNode",
    ];
    out.forEach((c) => {
      delete c.w;
      if (c.kind !== "w" && !treeCards.includes(c.kind)) c.r = rollRar(ark);
    });
    return out;
  }
  let curChoices = [],
    LV_LOCK = 0;
  function openLevelUp() {
    const pd = G.pending[0];
    state = "levelup";
    syncFpsHud();
    const wcN = Object.keys(G.W).length,
      pcN = Object.keys(G.P).length;
    let seenDirty = false;
    save.seen = save.seen || {};
    $("#lvTitle").textContent =
      pd.kind === "slingTree"
        ? "A Funda de Davi evoluiu!"
        : pd.kind === "weaponTree"
          ? WEAPONS[pd.id].name + " evoluiu!"
          : pd.kind === "passiveTree"
            ? PASSIVES[pd.id].name + " despertou!"
            : pd.kind === "activeTree"
              ? ACT[pd.id].n + " evoluiu!"
              : pd.kind === "ark"
                ? "Bênção da Arca"
                : pd.kind === "start"
                  ? "Bênção inicial"
                  : (pd.rev ? "Renascido! Nível " : "Fé aumentou! Nível ") +
                  pd.n;
    $("#lvSub").textContent =
      pd.kind === "slingTree"
        ? "Escolha um caminho para a sua Funda. Você só poderá seguir um nesta partida."
        : ["weaponTree", "passiveTree", "activeTree"].includes(pd.kind)
          ? "Escolha uma rota. A maestria do caminho aparecerá em uma próxima escolha."
          : "Armas " +
          wcN +
          "/" +
          SLOT_W +
          " · Dons " +
          pcN +
          "/" +
          SLOT_P +
          " · " +
          activeSkillCountLabel(G) +
          " — as cartas que você ignorar demoram a voltar";
    curChoices = rollChoices();
    BTL.openChoiceSession(pd, curChoices);
    LV_LOCK = performance.now() + 450;
    const box = $("#cards");
    box.classList.remove("has-two");
    box.innerHTML = "";
    curChoices.forEach((c, i) => {
      let name,
        tag,
        desc,
        ref = "",
        icon,
        iconSrc = null,
        treeOwner = null,
        treePath = null,
        isMastery = false;
      if (c.kind === "w") {
        const W = WEAPONS[c.id],
          cur = G.W[c.id];
        name = W.name;
        icon = c.id;
        ref = W.ref;
        if (cur) {
          tag = "Nível " + cur.lvl + " → " + (cur.lvl + 1);
          desc = W.up[cur.lvl - 1].d + ".";
        } else {
          tag = "Nova arma · " + (wcN + 1) + "/" + SLOT_W;
          desc = W.desc;
        }
      } else if (c.kind === "p") {
        const P = PASSIVES[c.id],
          cur = G.P[c.id],
          max = passiveMaxLevel(c.id);
        name = P.name;
        icon = c.id;
        ref = P.ref;
        tag = cur
          ? "Nível " + cur + " → " + (cur + 1) + "/" + max
          : "Novo dom · " + (pcN + 1) + "/" + SLOT_P;
        desc = P.desc;
      } else if (c.kind === "a") {
        const A = ACT[c.id],
          cur = G.al && G.al[c.id];
        name = A.n;
        icon = c.id;
        ref = A.ref;
        if (cur) {
          tag = "Ativa · Nível " + cur + " → " + (cur + 1);
          desc = A.up + ".";
        } else {
          tag =
            "Habilidade ativa · " +
            (TOUCH_UI ? "botão " : "tecla ") +
            ((G.A ? G.A.length : 0) + 1);
          desc = A.d + " Recarga de " + A.cd + " s.";
        }
      } else if (c.kind === "slingBranch") {
        const T = SLING_TREE[c.id];
        name = T.name;
        icon = "sling";
        treeOwner = "sling";
        treePath = c.id;
        iconSrc = evolutionIconURL(treeOwner, treePath, false);
        ref = T.ref;
        tag = "Evolução · Caminho";
        desc = T.desc;
      } else if (c.kind === "slingNode") {
        const T = SLING_TREE[G.slingTree.path];
        name = T.node.name;
        icon = "sling";
        treeOwner = "sling";
        treePath = G.slingTree.path;
        iconSrc = evolutionIconURL(treeOwner, treePath, true);
        isMastery = true;
        ref = T.node.ref;
        tag = "✦ Maestria Lendária ✦";
        desc = T.node.desc;
      } else if (c.kind === "weaponBranch" || c.kind === "weaponNode") {
        const E = EVOLUTION_TREES.weapon[c.ownerId].paths[c.id],
          W = WEAPONS[c.ownerId];
        isMastery = c.kind === "weaponNode";
        treeOwner = c.ownerId;
        treePath = c.id;
        icon = c.ownerId;
        iconSrc = evolutionIconURL(treeOwner, treePath, isMastery);
        name = isMastery ? E.node.name : E.name;
        ref = isMastery ? E.node.ref : E.ref;
        tag = isMastery ? "✦ Maestria Lendária ✦" : "Evolução · " + W.name;
        desc = isMastery ? E.node.desc : E.desc;
      } else if (c.kind === "passiveBranch" || c.kind === "passiveNode") {
        const E = EVOLUTION_TREES.passive[c.ownerId].paths[c.id],
          P = PASSIVES[c.ownerId];
        isMastery = c.kind === "passiveNode";
        treeOwner = c.ownerId;
        treePath = c.id;
        icon = c.ownerId;
        iconSrc = evolutionIconURL(treeOwner, treePath, isMastery);
        name = isMastery ? E.node.name : E.name;
        ref = isMastery ? E.node.ref : E.ref;
        tag = isMastery ? "✦ Maestria Lendária ✦" : "Evolução · " + P.name;
        desc = isMastery ? E.node.desc : E.desc;
      } else if (c.kind === "activeBranch" || c.kind === "activeNode") {
        const E = EVOLUTION_TREES.active[c.ownerId].paths[c.id],
          A = ACT[c.ownerId];
        isMastery = c.kind === "activeNode";
        treeOwner = c.ownerId;
        treePath = c.id;
        icon = c.ownerId;
        iconSrc = evolutionIconURL(treeOwner, treePath, isMastery);
        name = isMastery ? E.node.name : E.name;
        ref = isMastery ? E.node.ref : E.ref;
        tag = isMastery ? "✦ Maestria Lendária ✦" : "Evolução · " + A.n;
        desc = isMastery ? E.node.desc : E.desc;
      } else if (c.kind === "heal") {
        name = "Bênção do Pão";
        icon = "heal";
        tag = "Bênção";
        desc = "Recupera " + 4 * HPS + " de Salvação.";
        ref = "João 6:35";
      } else {
        name = "Oferta";
        icon = "coins";
        tag = "Bênção";
        desc = "+" + offerShown(0) + " moedas.";
        ref = "Lucas 21:1";
      }
      if (CAT[c.id] && c.id && !/Branch|Node/.test(c.kind))
        tag += " · " + CAT[c.id];
      const R = c.r != null ? RAR[c.r] : null;
      if (R) {
        if (c.kind === "p") desc = scaleDesc(desc, R.m);
        else if (c.kind === "a") {
          if (R.m > 1)
            desc +=
              " Recarga −" +
              Math.round((1 - 1 / (1 + (R.m - 1) * 0.5)) * 100) +
              "%.";
        } else if (c.kind === "heal")
          desc = "Recupera " + Math.round(4 * HPS * R.m) + " de Salvação.";
        else desc = "+" + offerShown(c.r || 0) + " moedas.";
      }
      const isNew =
        !!c.id &&
        (c.kind === "w" || c.kind === "p" || c.kind === "a") &&
        !save.seen[cardKey(c)];
      if (isNew) {
        save.seen[cardKey(c)] = 1;
        seenDirty = true;
      }
      const b = document.createElement("button");
      b.className =
        "card k-" +
        c.kind +
        (iconSrc ? " is-evolution" : "") +
        (isMastery ? " is-mastery" : "");
      b.type = "button";
      b.style.animationDelay = i * 90 + "ms";
      if (iconSrc) {
        b.style.setProperty(
          "--evo-color",
          isMastery ? "#f2c14e" : evoAccent(treeOwner, treePath, false),
        );
        b.dataset.evoPath = treePath;
        b.dataset.evoOwner = treeOwner;
      }
      b.innerHTML =
        "<kbd>" +
        (i + 1) +
        '</kbd><div class="cb"><span class="cn">' +
        name +
        "</span>" +
        (isMastery
          ? '<span class="mastery-stamp">✦ MAESTRIA ✦</span>'
          : iconSrc
            ? '<span class="evolution-stamp">CAMINHO EVOLUTIVO</span>'
            : "") +
        '</div><div class="ca"><img class="ci" alt="" src="' +
        (iconSrc || iconURL(icon)) +
        '"></div><div class="ct">' +
        tag +
        '</div><div class="cd">' +
        desc +
        '</div><div class="cr">' +
        ref +
        "</div>" +
        (R ? '<div class="rr">' + R.n + "</div>" : "") +
        (isNew ? '<div class="nflag">NEW</div>' : "");
      if (R) {
        b.dataset.r = c.r;
        b.style.setProperty("--cr", R.c);
      }
      b.addEventListener("click", () => chooseIdx(curChoices.indexOf(c)));
      box.appendChild(b);
    });
    if (seenDirty) persist();
    $("#rrBtn").hidden = false;
    refreshChoiceToolUI();
    showLvStats();
    $("#lvlup").hidden = false;
    SFX.play("level");
    G.flash = Math.max(G.flash, 0.22);
    burst(G.p.x, G.p.y, 18, "#9fe0ff", 90);
  }
  function chooseIdx(i) {
    if (state !== "levelup" || !curChoices[i] || performance.now() < LV_LOCK)
      return;
    const c = curChoices[i];
    if (c.kind === "a" && !(G.al && G.al[c.id]) && !canGainActive(G)) {
      toast("Você já possui 2 habilidades ativas neste modo.");
      return;
    }
    G.actLock = performance.now() + 700;
    for (const o of curChoices)
      if (o !== c && o.id) G.snub[cardKey(o)] = G.offerN + SNUB_N;
    if (c.kind === "w") {
      const w = G.W[c.id];
      if (w) {
        w.lvl++;
        w.s = statsFor(c.id, w.lvl);
        if (c.id === "sling" && w.lvl === MAXW && !G.slingTree)
          G.pending.push({ kind: "slingTree" });
        else if (
          c.id !== "sling" &&
          w.lvl === MAXW &&
          EVOLUTION_TREES.weapon[c.id] &&
          !G.weaponTrees[c.id]
        )
          G.pending.push({ kind: "weaponTree", id: c.id });
      } else addWeapon(c.id);
    } else if (c.kind === "slingBranch") {
      G.slingTree = { path: c.id, tier: 0 };
      toast("Novo caminho: " + SLING_TREE[c.id].name);
    } else if (c.kind === "slingNode") {
      if (G.slingTree && G.slingTree.path === c.id) {
        G.slingTree.tier = 1;
        toast("Maestria alcançada: " + SLING_TREE[c.id].node.name);
      }
    } else if (c.kind === "weaponBranch") {
      G.weaponTrees[c.ownerId] = { path: c.id, tier: 0 };
      toast(
        "Novo caminho: " + EVOLUTION_TREES.weapon[c.ownerId].paths[c.id].name,
      );
    } else if (c.kind === "weaponNode") {
      if (G.weaponTrees[c.ownerId] && G.weaponTrees[c.ownerId].path === c.id) {
        G.weaponTrees[c.ownerId].tier = 1;
        toast(
          "Maestria: " +
          EVOLUTION_TREES.weapon[c.ownerId].paths[c.id].node.name,
        );
      }
    } else if (c.kind === "passiveBranch") {
      G.passiveTrees[c.ownerId] = { path: c.id, tier: 0 };
      recalc();
      toast(
        "Novo caminho: " + EVOLUTION_TREES.passive[c.ownerId].paths[c.id].name,
      );
    } else if (c.kind === "passiveNode") {
      if (
        G.passiveTrees[c.ownerId] &&
        G.passiveTrees[c.ownerId].path === c.id
      ) {
        G.passiveTrees[c.ownerId].tier = 1;
        recalc();
        toast(
          "Maestria: " +
          EVOLUTION_TREES.passive[c.ownerId].paths[c.id].node.name,
        );
      }
    } else if (c.kind === "activeBranch") {
      G.activeTrees[c.ownerId] = { path: c.id, tier: 0 };
      toast(
        "Novo caminho: " + EVOLUTION_TREES.active[c.ownerId].paths[c.id].name,
      );
    } else if (c.kind === "activeNode") {
      if (G.activeTrees[c.ownerId] && G.activeTrees[c.ownerId].path === c.id) {
        G.activeTrees[c.ownerId].tier = 1;
        toast(
          "Maestria: " +
          EVOLUTION_TREES.active[c.ownerId].paths[c.id].node.name,
        );
      }
    } else if (c.kind === "p") {
      const oldP = G.P[c.id] || 0,
        max = passiveMaxLevel(c.id);
      G.P[c.id] = Math.min(max, oldP + 1);
      (G.Pw = G.Pw || {})[c.id] = Math.min(
        max * 1.2,
        (G.Pw[c.id] != null ? G.Pw[c.id] : oldP) + RAR[c.r || 0].m,
      );
      recalc();
      if (c.id === "helmet") healP(2 * HPS);
      if (
        oldP < max &&
        G.P[c.id] === max &&
        EVOLUTION_TREES.passive[c.id] &&
        !G.passiveTrees[c.id]
      )
        G.pending.push({ kind: "passiveTree", id: c.id });
    } else if (c.kind === "a") {
      const oldA = (G.al && G.al[c.id]) || 0;
      if (!gainAct(c.id)) return;
      (G.arm = G.arm || {})[c.id] = Math.max(G.arm[c.id] || 1, RAR[c.r || 0].m);
      if (
        oldA < MAXA &&
        G.al[c.id] === MAXA &&
        EVOLUTION_TREES.active[c.id] &&
        !G.activeTrees[c.id]
      )
        G.pending.push({ kind: "activeTree", id: c.id });
    } else if (c.kind === "heal") {
      healP(Math.round(4 * HPS * RAR[c.r || 0].m));
      SFX.play("heal");
    } else if (c.kind === "coins") {
      ecoGain("offer", Math.round(ECO.OFFER_BASE * RAR[c.r || 0].m));
    }
    if (
      G.pending[0] &&
      G.pending[0].kind === "lvl" &&
      G.passiveTrees.wisdom &&
      G.passiveTrees.wisdom.path === "illumination"
    )
      healP((G.passiveTrees.wisdom.tier ? 2 : 1) * HPS);
    G.pending.shift();
    fxGain(c);
    $("#lvlup").hidden = true;
    buildRack();
    if (G.pending.length) openLevelUp();
    else {
      state = "play";
      last = performance.now();
      syncFpsHud();
      if (G.t > 1) {
        G.resumeT = 0.9;
        toast("Prepare-se…");
      }
    }
  }

  /* ================= coleta e itens ================= */
  function collect(k) {
    BTL.collect(k);
    if (k.type !== "f1")
      fxSpark(
        G.p.x,
        G.p.y,
        k.type === "coin"
          ? "#f2c14e"
          : k.type[0] === "f"
            ? "#9fe0ff"
            : "#9fffa8",
        7,
      );
    switch (k.type) {
      case "f1":
        gainXp(1);
        SFX.play("pick");
        break;
      case "f2":
        gainXp(5);
        SFX.play("pick");
        break;
      case "f3":
        gainXp(20);
        SFX.play("pick");
        break;
      case "coin":
        ecoGain("drop", 1);
        SFX.play("coin");
        if (G.t - (G.ct || -9) > 0.3) {
          G.ct = G.t;
          G.fx.push({
            wid: BTL.src || null,
            k: "txt",
            x: G.p.x,
            y: G.p.y - 12,
            s: "+1",
            t: 0,
            life: 0.6,
            col: "#f2c14e",
          });
        }
        break;
      case "bread":
        healP(3 * HPS);
        SFX.play("heal");
        toast("Pão da Vida +" + 3 * HPS + " Salvação");
        break;
      case "mana":
        for (const q of G.pk)
          if (q.type[0] === "f" || q.type === "coin") q.mag = true;
        SFX.play("heal");
        toast("Maná do céu! Toda a fé vem até você");
        break;
      case "fire":
        holyFire();
        break;
      case "shield":
        G.p.sh = 6;
        SFX.play("shield");
        toast("Escudo Divino: 6s invencível");
        break;
      case "ark":
        G.pending.push({ kind: "ark" });
        G.arks = (G.arks || 0) + 1;
        toast("Arca da Aliança!");
        break;
    }
    burst(k.x, k.y, 4, "#f2c14e", 40);
  }
  function holyFire() {
    G.flash = 0.7;
    G.shake = 0.5;
    SFX.play("boom");
    toast("Fogo do Céu!");
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (e.boss) hurtBy("holy_fire", e, 60 + e.mhp * 0.08, 0, 0, 0);
      else if (e.elite) hurtBy("holy_fire", e, e.mhp * 0.6, 0, 0, 0);
      else hurtBy("holy_fire", e, 1e6, 0, 0, 0);
    }
    G.eshots.length = 0;
  }
  const ITEM_CHANCE = 0.1; // chance de surgir um item no mapa a cada sorteio (9–15 s)
  function spawnItem() {
    const itemChance =
      ITEM_CHANCE * (1 + Math.max(0, Math.min(0.25, G.mods.luck || 0)) * 0.4);
    if (rng() >= itemChance) return;
    const p = G.p,
      low = p.hp < G.mods.maxhp * 0.7;
    const t = wpick([
      { k: "bread", w: low ? 24 : 8 },
      { k: "fire", w: 6 },
      { k: "shield", w: 7 },
    ]).k;
    const a = rng() * 6.2832,
      d = rnd(60, 150);
    const pickup = {
      x: p.x + Math.cos(a) * d,
      y: p.y + Math.sin(a) * d,
      type: t,
      ph: rnd(0, 6.28),
      mag: false,
      sp: 0,
      life: 60,
    };
    G.pk.push(pickup);
    BTL.pickupGenerated(t, pickup, false);
    G.fx.push({
      wid: BTL.src || null,
      k: "pulse",
      x: p.x + Math.cos(a) * d,
      y: p.y + Math.sin(a) * d,
      t: 0,
      life: 0.5,
    });
  }
  const CH = 150;
  function scatter() {
    const cx = Math.floor(G.p.x / CH),
      cy = Math.floor(G.p.y / CH);
    for (let dx = -2; dx <= 2; dx++)
      for (let dy = -2; dy <= 2; dy++) {
        const key = cx + dx + "," + (cy + dy);
        if (G.visited.has(key)) continue;
        G.visited.add(key);
        /* sem cristais nem moedas espalhados pelo mapa (só drops de inimigos e itens raros) */
      }
  }
  function hurtPlayer(d, src) {
    const rawHit = d;
    d = Math.max(
      1,
      Math.round(
        Math.max(rawHit * 0.4, d - (G.mods.dr || 0) - (G.mods.evoDR || 0)),
      ),
    ); // reduções nunca passam de 60% do golpe
    const p = G.p;
    if (p.inv > 0 || p.sh > 0) return;
    if (rng() < G.mods.block) {
      BTL.blockedHit(rawHit);
      p.inv = 0.4;
      SFX.play("block");
      if (FXQ())
        G.fx.push({
          wid: BTL.src || null,
          k: "guard",
          x: p.x,
          y: p.y,
          t: 0,
          life: 0.35,
          follow: true,
        });
      G.fx.push({
        wid: BTL.src || null,
        k: "txt",
        x: p.x,
        y: p.y - 14,
        s: "BLOQUEOU",
        t: 0,
        life: 0.8,
        col: "#9fe0ff",
      });
      return;
    }
    const hpBeforeHit = p.hp;
    p.hp -= d;
    if (TUT.on && p.hp < 1) p.hp = 1;
    BTL.playerDamage(Math.max(0, hpBeforeHit - p.hp), src, rawHit);
    G.dmgTaken = (G.dmgTaken || 0) + d;
    p.inv = G.mods.invT || 0.8;
    G.hHurt = G.t;
    G.shake = 0.45;
    G.hurtFlash = 0.45;
    SFX.play("hurt");
    vib(40);
    G.fx.push({
      wid: BTL.src || null,
      k: "txt",
      x: p.x,
      y: p.y - 14,
      s: "-" + d,
      t: 0,
      life: 0.9,
      col: "#ff6b6b",
    });
    if (src) G.hitBy = srcName(src);
    if (G.mods.thorns && FXQ())
      G.fx.push({
        wid: BTL.src || null,
        k: "thorns",
        x: p.x,
        y: p.y,
        t: 0,
        life: 0.35,
      });
    if (G.mods.thorns)
      forNear(p.x, p.y, 42, (e) => {
        const dx = e.x - p.x,
          dy = e.y - p.y,
          dist = Math.hypot(dx, dy) || 1;
        if (dist < 42 + e.r)
          hurtBy("thorns", e, G.mods.thorns, dx / dist, dy / dist, 12);
      });
    if (p.hp <= 0 && G.P && G.P.manto > 0 && !G.reviveUsed) {
      G.reviveUsed = true;
      p.hp = Math.max(1, Math.round(G.mods.maxhp * 0.35));
      p.inv = Math.max(p.inv || 0, 2.4);
      BTL.heal(p.hp, "manto_revival");
      BTL.event("revive", { source: "manto" });
      G.shake = 0.55;
      G.flash = 0.25;
      burst(p.x, p.y, 24, "#fff0a3", 100);
      SFX.play("heal");
      toast("Manto da Ressurreição! Você foi restaurado.");
      G.fx.push({
        wid: BTL.src || null,
        k: "ring",
        x: p.x,
        y: p.y,
        r: 3,
        maxr: 90,
        dmg: 0,
        knock: 0,
        style: "pulse",
        hit: new Set(),
        t: 0,
        life: 0.55,
        follow: true,
      });
    }
  }
  function poisonHero(duration, src) {
    if (G.poisonT > 0) return;
    G.poisonT = duration;
    G.poisonTick = 0.9;
    G.poisonSrc = src || "Veneno";
  }
  function addPoisonPool(g, x, y, src) {
    if (g.poisonPools.length >= 8) g.poisonPools.shift();
    g.poisonPools.push({ x, y, r: 14, life: 3, tick: 0, src });
    if (g.fx.length < 80)
      g.fx.push({ k: "poisonSplash", x, y, t: 0, life: 0.45 });
  }
  function impactPoisonFlask(q, g, x, y, hit) {
    addPoisonPool(g, x, y, q.src);
    if (hit) {
      hurtPlayer(q.dmg, q.src);
      poisonHero(3, q.src);
    }
    q.dead = true;
  }
  function updatePoison(g, dt) {
    for (const pool of g.poisonPools) {
      pool.life -= dt;
      if (Math.hypot(pool.x - g.p.x, pool.y - g.p.y) < pool.r) {
        poisonHero(3, pool.src);
      }
    }
    g.poisonPools = g.poisonPools.filter((pool) => pool.life > 0);
    if (g.poisonT <= 0) return;
    g.poisonT = Math.max(0, g.poisonT - dt);
    g.poisonTick -= dt;
    while (g.poisonTick <= 0 && g.poisonT > 0) {
      hurtPlayer(HPS / 2, g.poisonSrc);
      g.poisonTick += 0.9;
    }
    if (g.poisonT <= 0) g.poisonSrc = null;
  }

  /* ================= armas ================= */
  function nearestList(x, y, range, n) {
    const arr = [],
      r2 = range * range;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const dx = e.x - x,
        dy = e.y - y,
        d2 = dx * dx + dy * dy;
      if (d2 < r2) arr.push({ e, d2 });
    }
    arr.sort((a, b) => a.d2 - b.d2);
    return arr.slice(0, n).map((o) => o.e);
  }
  function createSignalZone(x, y, evolved) {
    const g = G;
    if (!g || g.hk !== "jonathan") return;
    const zone = {
      wid: "jonathan",
      k: "signalZone",
      x,
      y,
      r: evolved ? 72 : 54,
      t: 0,
      life: evolved ? 5 : 3,
      crit: evolved ? 0.25 : 0.15,
      range: evolved ? 0.3 : 0.2,
    };
    g.signalZones.push(zone);
    g.fx.push(zone);
    burst(x, y, 18, "#ffe49a", 90);
    SFX.play("level");
  }
  function updWeapons(dt) {
    const p = G.p,
      m = G.mods;
    for (const id in G.W) {
      const w = G.W[id],
        s = w.s;
      BTL.src = id;
      const weaponDef = WEAPONS[id],
        behavior = weaponDef && weaponDef.behavior;
      switch (behavior) {
        case "projectile_target": {
          w.cd -= dt;
          if (w.cd > 0) break;
          const tree = G.weaponTrees && G.weaponTrees[id],
            path = tree && tree.path,
            tier = tree && tree.tier ? 1 : 0;
          let count = Math.min(8, s.count + amountBonus(m));
          if (id === "covenant_bow" && path === "volley")
            count = Math.min(8, count + (tier ? 2 : 1));
          const list = nearestList(p.x, p.y, m.rng, count);
          if (!list.length) {
            w.cd = 0.1;
            break;
          }
          w.cd =
            s.cd *
            m.cd *
            (id === "covenant_bow" && path === "volley"
              ? tier
                ? 0.88
                : 1.08
              : 1);
          SFX.play("sling");
          if (FXQ())
            G.fx.push({
              wid: BTL.src || null,
              k: "swing",
              a0: rngFx() * TAU,
              t: 0,
              life: 0.16,
            });
          for (let i = 0; i < count; i++) {
            const tg = list[i % list.length];
            let a = Math.atan2(tg.y - p.y, tg.x - p.x);
            if (i >= list.length)
              a += (i - list.length + 1) * 0.2 * (i % 2 ? 1 : -1);
            const speed =
              s.speed *
              (m.pspd || 1) *
              (path === "aim" ? (tier ? 1.42 : 1.2) : 1);
            if (id === "covenant_bow") {
              G.hm.arrowCount = (G.hm.arrowCount || 0) + 1;
              const signal = G.hk === "jonathan" && G.hm.arrowCount % 5 === 0;
              const evolved = !!G.evo.covenant_bow,
                maxDistance = Math.max(100, m.rng * (signal ? 1.35 : 1.15));
              const pathDamage = path === "aim" ? (tier ? 1.3 : 1.15) : 1;
              const pierce = signal
                ? Infinity
                : s.pierce +
                (path === "pierce" ? (tier ? 5 : 3) : 0) +
                (evolved ? 2 : 0);
              G.shots.push({
                wid: id,
                k: "covenant_arrow",
                x: p.x,
                y: p.y,
                vx: Math.cos(a) * speed,
                vy: Math.sin(a) * speed,
                dmg:
                  s.dmg *
                  m.dmg *
                  pathDamage *
                  (signal ? (evolved ? 2.2 : 1.7) : evolved ? 1.3 : 1),
                pierce,
                hit: [],
                r: signal ? 4 : 3,
                life: maxDistance / speed + 0.1,
                travel: 0,
                maxDistance,
                signal,
                evolved,
              });
              continue;
            }
            G.shots.push({
              wid: BTL.src || null,
              k: "stone",
              x: p.x,
              y: p.y,
              vx: Math.cos(a) * speed,
              vy: Math.sin(a) * speed,
              dmg: s.dmg * m.dmg,
              pierce: s.pierce + (path === "pierce" ? (tier ? 3 : 2) : 0),
              hit: [],
              r: 3 * (m.area || 1),
              life: 1.6 * (m.duration || 1),
              treePath: path || null,
              treeTier: tier,
            });
          }
          break;
        }
        case "melee_arc": {
          w.cd -= dt;
          if (w.cd > 0) break;
          const variant = weaponDef.variant || id;
          const tree = G.weaponTrees && G.weaponTrees[id],
            path = tree && tree.path,
            tier = tree && tree.tier ? 1 : 0;
          let ss = Object.assign({}, s);
          ss.style = variant;
          const rb = Math.max(0, (m.rng - 100) * 0.4);
          ss.range = (ss.range + rb) * (m.area || 1);
          if (variant === "sword") {
            if (path === "cleave") {
              ss.range *= tier ? 1.55 : 1.35;
              ss.arc += tier ? 0.45 : 0.25;
            }
            if (path === "justice") ss.dmg *= tier ? 1.5 : 1.3;
          } else {
            if (path === "impact") ss.evoKnock = tier ? 125 : 90;
            if (path === "steadfast") ss.dmg *= tier ? 1.2 : 1.1;
          }
          const list = nearestList(p.x, p.y, ss.range + 40, 1);
          if (!list.length) {
            w.cd = 0.1;
            break;
          }
          w.cd = s.cd * m.cd;
          const tg = list[0],
            a = Math.atan2(tg.y - p.y, tg.x - p.x);
          slash(a, ss);
          if (s.dbl) slash(a + Math.PI, ss);
          if (variant === "sword" && path === "echo")
            slash(
              a + 0.42,
              Object.assign({}, ss, {
                dmg: ss.dmg * (tier ? 0.82 : 0.52),
                arc: ss.arc * 0.72,
              }),
            );
          if (variant === "jawbone" && path === "quake")
            G.fx.push({
              wid: BTL.src || null,
              k: "ring",
              x: p.x,
              y: p.y,
              r: 3,
              maxr: tier ? 46 : 32,
              dmg: s.dmg * m.dmg * (tier ? 0.5 : 0.3),
              knock: 48,
              style: "quake",
              hit: new Set(),
              t: 0,
              life: 0.28,
              follow: false,
            });
          break;
        }
        case "aura_pulse": {
          const tree = G.weaponTrees && G.weaponTrees[id],
            path = tree && tree.path,
            tier = tree && tree.tier ? 1 : 0;
          const radius =
            s.radius *
            (path === "sanctuary" ? (tier ? 1.55 : 1.3) : 1) *
            (m.area || 1),
            slow = path === "stillness" ? (tier ? 0.66 : 0.5) : s.slow;
          for (const e of G.enemies) {
            if (e.dead) continue;
            const dx = e.x - p.x,
              dy = e.y - p.y;
            if (dx * dx + dy * dy < (radius + e.r) * (radius + e.r))
              ((e.slowT = 0.25), (e.slowAmt = slow));
          }
          w.tick -= dt;
          if (w.tick <= 0) {
            w.tick = s.tick * m.cd;
            w.pAt = G.t;
            forNear(p.x, p.y, radius + 28, (e) => {
              const dx = e.x - p.x,
                dy = e.y - p.y,
                d = Math.hypot(dx, dy) || 1;
              if (d < radius + e.r)
                hurt(
                  e,
                  s.dmg *
                  m.dmg *
                  (path === "stillness" ? (tier ? 1.35 : 1.2) : 1),
                  dx / d,
                  dy / d,
                  8,
                );
            });
          }
          if (path === "pulse") {
            w.evoPulse = (w.evoPulse || (tier ? 3 : 4)) - dt;
            if (w.evoPulse <= 0) {
              w.evoPulse = tier ? 3 : 4;
              G.fx.push({
                wid: BTL.src || null,
                k: "ring",
                x: p.x,
                y: p.y,
                r: 3,
                maxr: radius + 10,
                dmg: s.dmg * m.dmg * (tier ? 1.05 : 0.65),
                knock: 18,
                style: "pulse",
                hit: new Set(),
                t: 0,
                life: 0.32,
                follow: false,
              });
            }
          }
          break;
        }
        case "orbiting_shields": {
          const tree = G.weaponTrees && G.weaponTrees[id],
            path = tree && tree.path,
            tier = tree && tree.tier ? 1 : 0;
          const count = Math.min(
            8,
            s.count +
            (path === "bastion" ? (tier ? 2 : 1) : 0) +
            amountBonus(m),
          ),
            radius = s.radius + (path === "orbit" ? (tier ? 10 : 5) : 0),
            speed = s.speed * (path === "orbit" ? (tier ? 1.8 : 1.45) : 1),
            hitRadius = 7 * (m.area || 1);
          w.ang += speed * (m.pspd || 1) * dt;
          for (let i = 0; i < count; i++) {
            const a = w.ang + (i * 6.2832) / count,
              sx = p.x + Math.cos(a) * radius,
              sy = p.y + Math.sin(a) * radius;
            forNear(sx, sy, hitRadius + 28, (e) => {
              if (e.shCd > 0) return;
              const dx = e.x - sx,
                dy = e.y - sy,
                d = Math.hypot(dx, dy) || 1;
              if (d < e.r + hitRadius) {
                e.shCd = 0.5;
                fxSpark(e.x, e.y, "#9fe0ff", 10);
                hurt(
                  e,
                  s.dmg *
                  m.dmg *
                  (path === "retribution" ? (tier ? 1.6 : 1.35) : 1),
                  dx / d,
                  dy / d,
                  path === "retribution" ? 55 : 40,
                );
              }
            });
            for (const q of G.eshots)
              if (
                !q.dead &&
                Math.hypot(q.x - sx, q.y - sy) < (path === "bastion" ? 11 : 9)
              ) {
                q.dead = true;
                fxSpark(q.x, q.y, "#9fe0ff", 9);
              }
          }
          break;
        }
        case "orbiting_companions": {
          const tree = G.weaponTrees && G.weaponTrees[id],
            path = tree && tree.path,
            tier = tree && tree.tier ? 1 : 0;
          const count = Math.min(
            6,
            s.count + (path === "host" ? (tier ? 2 : 1) : 0) + amountBonus(m),
          );
          const radius =
            s.radius +
            (path === "war" ? 0 : 0) +
            (path === "guard" ? (tier ? 4 : 2) : 0),
            hitRadius = 8 * (m.area || 1);
          const speed = s.speed * (path === "war" ? (tier ? 1.55 : 1.3) : 1);
          const dmgMul = path === "war" ? (tier ? 1.45 : 1.25) : 1;
          w.ang += speed * (m.pspd || 1) * dt;
          for (let i = 0; i < count; i++) {
            const a = w.ang + (i * 6.2832) / count,
              ax = p.x + Math.cos(a) * radius,
              ay = p.y + Math.sin(a) * radius;
            forNear(ax, ay, hitRadius + 28, (e) => {
              if (e.shCd > 0) return;
              const dx = e.x - ax,
                dy = e.y - ay,
                d = Math.hypot(dx, dy) || 1;
              if (d < e.r + hitRadius) {
                e.shCd = 0.42;
                if (FXQ()) fxSpark(e.x, e.y, "#fff0a3", 8);
                hurt(
                  e,
                  s.dmg * m.dmg * dmgMul,
                  dx / d,
                  dy / d,
                  path === "war" ? 28 : 12,
                );
              }
            });
            if (path === "guard") {
              const hitR = tier ? 12 : 9;
              for (const q of G.eshots)
                if (!q.dead && Math.hypot(q.x - ax, q.y - ay) < hitR) {
                  q.dead = true;
                  if (FXQ()) fxSpark(q.x, q.y, "#fff0a3", 7);
                }
            }
          }
          break;
        }
        case "homing_doves": {
          const tree = G.weaponTrees && G.weaponTrees[id],
            path = tree && tree.path,
            tier = tree && tree.tier ? 1 : 0;
          w.cd -= dt;
          if (w.cd > 0) break;
          const count = Math.min(
            8,
            s.count +
            (path === "flock" ? (tier ? 2 : 1) : 0) +
            amountBonus(m),
          ),
            list = nearestList(p.x, p.y, m.rng, count);
          if (!list.length) {
            w.cd = 0.2;
            break;
          }
          w.cd = s.cd * m.cd;
          SFX.play("sling");
          for (let i = 0; i < count; i++) {
            const tg = list[i % list.length],
              a =
                Math.atan2(tg.y - p.y, tg.x - p.x) +
                (i >= list.length
                  ? (i - list.length + 1) * 0.5 * (i % 2 ? 1 : -1)
                  : 0);
            G.shots.push({
              wid: BTL.src || null,
              k: "dove",
              x: p.x,
              y: p.y,
              vx: Math.cos(a) * 110,
              vy: Math.sin(a) * 110,
              dmg:
                s.dmg *
                m.dmg *
                (path === "piercing" ? (tier ? 1.25 : 1.12) : 1),
              pierce: path === "piercing" ? (tier ? 2 : 1) : 0,
              hit: [],
              r: 4 * (m.area || 1),
              life: 4 * (m.duration || 1),
              tg: i < list.length && !tg.ph ? tg : null,
            });
          }
          break;
        }
        case "chain_lightning": {
          const tree = G.weaponTrees && G.weaponTrees[id],
            path = tree && tree.path,
            tier = tree && tree.tier ? 1 : 0;
          w.cd -= dt;
          if (w.cd > 0) break;
          const list = nearestList(p.x, p.y, m.rng, 30);
          if (!list.length) {
            w.cd = 0.2;
            break;
          }
          const count = Math.min(
            10,
            s.count + (path === "storm" ? (tier ? 2 : 1) : 0) + amountBonus(m),
          );
          w.cd = s.cd * m.cd * (path === "storm" ? (tier ? 0.78 : 0.88) : 1);
          for (let i = 0; i < count; i++) {
            const tg = list[Math.floor(rng() * list.length)];
            G.fx.push({
              wid: BTL.src || null,
              k: "bolt",
              x: tg.x,
              y: tg.y,
              r:
                (12 + (path === "judgment" ? (tier ? 14 : 8) : 0)) *
                (m.area || 1),
              dmg:
                s.dmg * m.dmg * (path === "judgment" ? (tier ? 1.3 : 1.15) : 1),
              t: 0,
              delay: 0.16,
              life: 0.55,
              done: false,
              zz: Array.from({ length: 7 }, () => rnd(-1, 1) * 9),
              chainCount: path === "chain" ? (tier ? 3 : 2) : 0,
              chainMult: tier ? 0.68 : 0.5,
              bossMult: path === "judgment" ? (tier ? 1.85 : 1.5) : 1,
            });
          }
          break;
        }
        case "radial_wave": {
          const tree = G.weaponTrees && G.weaponTrees[id],
            path = tree && tree.path,
            tier = tree && tree.tier ? 1 : 0;
          w.cd -= dt;
          if (w.cd > 0) break;
          const maxr =
            s.maxr *
            (path === "rampart" ? (tier ? 1.55 : 1.35) : 1) *
            (m.area || 1),
            knock = s.knock + (path === "rampart" ? (tier ? 35 : 20) : 0);
          if (!nearestList(p.x, p.y, maxr * 0.9, 1).length) {
            w.cd = 0.2;
            break;
          }
          w.cd = s.cd * m.cd;
          SFX.play("trumpet");
          const baseRing = {
            wid: BTL.src || null,
            k: "ring",
            x: p.x,
            y: p.y,
            r: 4,
            maxr,
            dmg: s.dmg * m.dmg,
            knock,
            style: "horn",
            hit: new Set(),
            t: 0,
            life: 0.55 * (m.duration || 1),
            follow: true,
            bossMult: path === "condemnation" ? (tier ? 1.9 : 1.5) : 1,
          };
          G.fx.push(baseRing);
          if (path === "echo")
            G.fx.push({
              ...baseRing,
              r: 4,
              dmg: baseRing.dmg * (tier ? 0.82 : 0.6),
              knock: knock * 0.75,
              hit: new Set(),
              t: 0,
              life: 0.55 * (m.duration || 1),
              wait: 0.22,
              follow: true,
            });
          break;
        }
        case "targeted_flames": {
          const tree = G.weaponTrees && G.weaponTrees[id],
            path = tree && tree.path,
            tier = tree && tree.tier ? 1 : 0;
          w.cd -= dt;
          if (w.cd > 0) break;
          const count = Math.min(
            8,
            s.count +
            (path === "pentecost" ? (tier ? 2 : 1) : 0) +
            amountBonus(m),
          ),
            radius =
              s.r *
              (path === "pentecost" ? (tier ? 1.5 : 1.25) : 1) *
              (m.area || 1);
          const list = nearestList(p.x, p.y, m.rng, 30);
          if (!list.length) {
            w.cd = 0.2;
            break;
          }
          w.cd = s.cd * m.cd;
          SFX.play("fire");
          for (let i = 0; i < count; i++) {
            const tg = list[Math.floor(rng() * list.length)];
            G.fx.push({
              wid: BTL.src || null,
              k: "flame",
              x: tg.x,
              y: tg.y,
              r: radius,
              dmg:
                s.dmg *
                m.dmg *
                (path === "pentecost" ? (tier ? 1.35 : 1.15) : 1),
              t: 0,
              delay: 0.45,
              life: 0.85 * (m.duration || 1),
              done: false,
              burn: path === "ember" || path === "wildfire",
              burnDuration: (tier ? 3.2 : 2.4) * (m.duration || 1),
              burnRatio: tier ? 0.24 : 0.16,
            });
          }
          break;
        }
      }
    }
  }
  /* Balance Lab: fora das armas (ex.: efeitos de fase), o dano vai para "other". */
  const _updWeaponsBase = updWeapons;
  updWeapons = function (dt) {
    try {
      _updWeaponsBase(dt);
    } finally {
      BTL.src = null;
    }
  };

  function slash(ang, s) {
    const p = G.p,
      jaw = s.style === "jawbone";
    G.fx.push({
      wid: BTL.src || null,
      k: "slash",
      style: s.style || "sword",
      ang,
      range: s.range,
      arc: s.arc,
      t: 0,
      life: jaw ? 0.4 : 0.26,
      follow: true,
      x: p.x,
      y: p.y,
    });
    const h = {
      wid: BTL.src || null,
      k: "melee",
      ang,
      range: s.range,
      arc: s.arc,
      dmg: s.dmg * G.mods.dmg,
      knock: s.evoKnock || 50,
      t: 0,
      life: 0.05,
      wait: jaw ? 0.11 : 0,
      follow: false,
    };
    if (jaw) G.fx.push(h);
    else meleeHit(h);
  }
  function meleeHit(f) {
    const p = G.p;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x,
        dy = e.y - p.y,
        d = Math.hypot(dx, dy) || 1;
      if (d < f.range + e.r) {
        let da = Math.atan2(dy, dx) - f.ang;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < f.arc / 2 || d < e.r + 8)
          hurtBy(f.wid || f.k || "fx", e, f.dmg, dx / d, dy / d, f.knock);
      }
    }
  }

  /* ================= atualização ================= */
  function update(dt) {
    const g = G,
      p = g.p,
      m = g.mods;
    if (g.resumeT > 0) {
      g.resumeT -= dt;
      if (g.resumeT <= 0) crowdPush();
      return;
    }
    g.t += dt;
    // movimento
    let ix = 0,
      iy = 0;
    if (keys["a"] || keys["arrowleft"]) ix -= 1;
    if (keys["d"] || keys["arrowright"]) ix += 1;
    if (keys["w"] || keys["arrowup"]) iy -= 1;
    if (keys["s"] || keys["arrowdown"]) iy += 1;
    if (stick.on) {
      ix = stick.dx;
      iy = stick.dy;
    }
    const il = Math.hypot(ix, iy);
    if (il > 1) {
      ix /= il;
      iy /= il;
    }
    p.moving = il > 0.05 && !(p.stasisT > 0);
    if (p.moving) {
      const sprint =
        p.evoSpeedT > 0
          ? G.activeTrees && G.activeTrees.refuge && G.activeTrees.refuge.tier
            ? 1.55
            : 1.35
          : 1;
      p.x += ix * m.spd * sprint * dt;
      p.y += iy * m.spd * sprint * dt;
      p.walk += dt;
      if (FXQ() && (G.P.boots || 0) + (G.P.eagle || 0) > 0 && rngFx() < dt * 14)
        G.parts.push({
          x: p.x + rndFx(-3, 3),
          y: p.y + 8,
          vx: rndFx(-8, 8) - ix * 10,
          vy: rndFx(-6, 0),
          life: 0.4,
          max: 0.5,
          col: "rgba(190,170,130,.8)",
          sz: 1,
        });
      if (Math.abs(ix) > 0.1) p.face = ix < 0 ? -1 : 1;
    }
    p.x += (p.kx || 0) * dt;
    p.y += (p.ky || 0) * dt;
    {
      const k8 = Math.max(0, 1 - dt * 8);
      p.kx = (p.kx || 0) * k8;
      p.ky = (p.ky || 0) * k8;
    }
    G.rageT = Math.max(0, (G.rageT || 0) - dt);
    if (G.mods.divCd) {
      G.divT = (G.divT === undefined ? G.mods.divCd : G.divT) - dt;
      if (G.divT <= 0) {
        G.divT = G.mods.divCd;
        p.sh = Math.max(p.sh, 2);
      }
    }
    if (G.mods.aura)
      forNear(p.x, p.y, 40, (e) => {
        if (e.dead || e.boss) return;
        const auraDmg = G.mods.aura * dt,
          beforeAuraHp = Math.max(0, e.hp);
        e.hp -= auraDmg;
        BTL.damage(Math.min(beforeAuraHp, auraDmg), e, "aura");
        if (e.hp <= 0) kill(e);
      });
    p.inv -= dt;
    p.sh -= dt;
    if (p.stasisT > 0) {
      p.stasisT -= dt;
      p.kx = 0;
      p.ky = 0;
      if (p.stasisT <= 0) {
        p.stasisT = 0;
        if (p.stasisHeal) {
          healP(Math.ceil(m.maxhp * p.stasisHeal));
          p.stasisHeal = 0;
          SFX.play("heal");
        }
      }
    }
    if (p.atkBuffT > 0) {
      p.atkBuffT -= dt;
      if (p.atkBuffT <= 0) {
        p.atkBuffT = 0;
        recalc();
      }
    }
    p.evoSpeedT = Math.max(0, (p.evoSpeedT || 0) - dt);
    p.evoHealT = Math.max(0, (p.evoHealT || 0) - dt);
    p.evoRegenCd = Math.max(0, (p.evoRegenCd || 0) - dt);
    if (g.arena && g.boss) clampArena(p, 4);
    else g.arena = null;
    if (m.regen) {
      p.regen += dt;
      if (p.regen >= m.regen) {
        p.regen = 0;
        const hp0 = p.hp;
        p.hp = Math.min(m.maxhp, p.hp + HPS);
        BTL.heal(p.hp - hp0, "regeneration");
        if (p.hp > hp0) healFx(p.hp - hp0);
        if (m.regenShield) p.sh = Math.max(p.sh, m.regenShield);
      }
    }
    if (p.evoHealT > 0 && p.evoRegenCd <= 0) {
      p.evoRegenCd = 0.9;
      const hp0 = p.hp;
      p.hp = Math.min(m.maxhp, p.hp + HPS);
      BTL.heal(p.hp - hp0, "evolution_regeneration");
      if (p.hp > hp0) healFx(p.hp - hp0, false);
    }
    scatter();

    g.spawnAcc += dt * spawnRateNow(g);
    if (g.enemies.length >= ENEMY_CAP) g.spawnAcc = 0;
    while (g.spawnAcc >= 1) {
      g.spawnAcc -= 1;
      spawnEnemy(chooseType());
    }
    if (g.t >= g.tRing) {
      g.tRing += 90;
      g.ringN++;
      const bats = g.ringN % 2 === 1;
      ring(
        bats ? "bat" : "imp",
        16 + Math.floor(g.t / 30),
        bats ? Math.hypot(VW, VH) / 2 + 20 : 170,
      );
      toast(
        bats
          ? "Uma revoada de morcegos demoníacos!"
          : "Os demônios cercam você!",
      );
    }
    if (g.t >= g.tElite) {
      g.tElite += 70;
      const n = scaledEventCount(1 + Math.floor(g.t / 240));
      for (let i = 0; i < n; i++) spawnEnemy("elite");
      toast("Um demônio poderoso se aproxima");
    }
    if (
      (g.inf || g.bossIdx < BOSS_T.length) &&
      !g.boss &&
      g.t >= bossTime(g.bossIdx)
    )
      spawnBoss(g.bossIdx);
    g.itemT -= dt;
    if (g.itemT <= 0) {
      g.itemT = rnd(9, 15);
      spawnItem();
    }

    // inimigos
    for (const e of g.enemies) {
      if (e.dead) continue;
      if (e.burnT > 0) {
        e.burnT -= dt;
        e.burnTick = (e.burnTick == null ? 0.35 : e.burnTick) - dt;
        if (e.burnTick <= 0) {
          e.burnTick = 0.45;
          hurtBy("burn", e, e.burnDmg || 1, 0, 0, 0);
        }
        if (e.dead) continue;
      }
      const heroDx = p.x - e.x,
        heroDy = p.y - e.y,
        heroD = Math.hypot(heroDx, heroDy) || 1;
      const dx = heroDx,
        dy = heroDy,
        d = Math.hypot(dx, dy) || 1;
      if (!e.boss && d > 460) {
        const a = rng() * 6.2832,
          rr = Math.hypot(VW, VH) / 2 + 20;
        e.x = p.x + Math.cos(a) * rr;
        e.y = p.y + Math.sin(a) * rr;
        continue;
      }
      let sp = e.spd * (1 + (e.boss ? 0.12 : 0.25) * rage(G));
      if (e.slowT > 0) {
        sp *= 1 - (e.slowAmt || 0.25);
        e.slowT -= dt;
      }
      e.shCd -= dt;
      e.flash -= dt;
      e.hurtT = Math.max(0, (e.hurtT || 0) - dt);
      e.sqT = Math.max(0, (e.sqT || 0) - dt);
      if (
        e.ab === "fuse" &&
        Math.sin(g.t * (d < 80 ? 22 : 9) + e.ph) > (d < 80 ? 0.5 : 0.75)
      )
        e.flash = 0.05;
      let vx = (dx / d) * sp,
        vy = (dy / d) * sp;
      if (e.mv === "wave") {
        const w = Math.sin(g.t * 2.2 + e.ph) * sp * 0.8;
        vx += (-dy / d) * w;
        vy += (dx / d) * w;
      } else if (e.mv === "swoop") {
        const w = Math.sin(g.t * 3 + e.ph) * sp * 1.1;
        vx += (-dy / d) * w;
        vy += (dx / d) * w;
      }
      if (!e.boss && e.ab) {
        const ov = enemyAI(e, g, p, dt, dx, dy, d, sp, vx, vy);
        vx = ov[0];
        vy = ov[1];
      }
      if (e.boss && e.act) {
        const ov = bossMove(e, vx, vy);
        vx = ov[0];
        vy = ov[1];
      }
      e.x += (vx + e.kx) * dt;
      e.y += (vy + e.ky) * dt;
      const kd = Math.min(1, dt * 7);
      e.kx -= e.kx * kd;
      e.ky -= e.ky * kd;
      e.face = dx < 0 ? -1 : 1;
      if (e.rangedAttack && e.rangedAttack.behavior === "red_orb") {
        const ra = e.rangedAttack;
        e.shT =
          (e.shT == null
            ? rnd(ra.initialInterval[0], ra.initialInterval[1])
            : e.shT) - dt;
        if (e.shT <= 0 && d > ra.minRange && d < ra.maxRange) {
          e.shT = rnd(ra.interval[0], ra.interval[1]);
          e.flash = 0.14;
          e.impT = g.t;
          g.eshots.push({
            x: e.x,
            y: e.y - 2,
            vx: (dx / d) * ra.speed,
            vy: (dy / d) * ra.speed,
            r: ra.radius,
            dmg: ra.damage,
            life: ra.life,
            dead: false,
            src: e,
            red: !!ra.red,
          });
          SFX.play("sling");
        }
      }
      if (e.boss) bossAI(e, dt, dx, dy);
    }
    // separação
    buildGrid();
    for (const e of g.enemies) {
      if (e.dead || e.boss) continue;
      forNear(e.x, e.y, e.r * 2, (o) => {
        if (o === e) return;
        const dx = e.x - o.x,
          dy = e.y - o.y,
          dd = Math.hypot(dx, dy) || 0.01,
          min = (e.r + o.r) * 0.85;
        if (dd < min) {
          const f = (min - dd) * 0.5;
          e.x += (dx / dd) * f * (o.boss ? 2 : 1);
          e.y += (dy / dd) * f * (o.boss ? 2 : 1);
        }
      });
    }

    heroBody(g);
    /* O Sol Parou: as armas continuam atirando; a habilidade só evita dano. */
    updWeapons(dt);

    // tiros do jogador
    for (const s of g.shots) {
      if (s.dead) continue;
      if (s.k === "stone" && s.treePath === "aim") {
        const target = nearestList(s.x, s.y, s.treeTier ? 260 : 170, 1)[0];
        if (target) {
          let ang = Math.atan2(s.vy, s.vx),
            goal = Math.atan2(target.y - s.y, target.x - s.x);
          let da = Math.atan2(Math.sin(goal - ang), Math.cos(goal - ang));
          ang += clamp(
            da,
            -(s.treeTier ? 3.3 : 1.5) * dt,
            (s.treeTier ? 3.3 : 1.5) * dt,
          );
          const speed = Math.hypot(s.vx, s.vy) || 1;
          s.vx = Math.cos(ang) * speed;
          s.vy = Math.sin(ang) * speed;
        }
      }
      if (s.k === "dove") {
        if (!s.tg || s.tg.dead) {
          const l = nearestList(s.x, s.y, Math.max(120, m.rng + 60), 1);
          s.tg = l[0] || null;
        }
        let a = Math.atan2(s.vy, s.vx);
        if (s.tg) {
          let da = Math.atan2(s.tg.y - s.y, s.tg.x - s.x) - a;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          a += clamp(da, -5 * dt, 5 * dt);
        }
        const v = 125 * (m.pspd || 1);
        s.vx = Math.cos(a) * v;
        s.vy = Math.sin(a) * v;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.k === "covenant_arrow") {
        s.travel += Math.hypot(s.vx, s.vy) * dt;
        if (s.travel >= s.maxDistance || (s.life -= dt) <= 0) {
          if (s.signal) createSignalZone(s.x, s.y, s.evolved);
          s.dead = true;
          continue;
        }
      } else {
        s.life -= dt;
        if (s.life <= 0) {
          s.dead = true;
          continue;
        }
      }
      if (FXQ()) {
        const tr = s.tr || (s.tr = []);
        tr.push({ x: s.x, y: s.y });
        if (tr.length > (s.k === "dove" ? 9 : 6)) tr.shift();
        if (s.k === "stone") s.spin = (s.spin || 0) + dt * 22;
        else if (rngFx() < dt * 18)
          g.parts.push({
            x: s.x,
            y: s.y,
            vx: rndFx(-6, 6),
            vy: rndFx(2, 10),
            life: 0.6,
            max: 0.7,
            col: "#ffffff",
            sz: 1,
          });
      }
      forNear(s.x, s.y, s.r + 28, (e) => {
        if (s.dead || s.hit.indexOf(e) >= 0) return;
        const dx = e.x - s.x,
          dy = e.y - s.y,
          d = Math.hypot(dx, dy) || 1;
        if (d < e.r + s.r) {
          const chainBonus =
            s.k === "stone" && s.treePath === "pierce"
              ? 1 + s.hit.length * (s.treeTier ? 0.5 : 0.35)
              : 1;
          hurtBy(
            s.wid || s.k || "shot",
            e,
            s.dmg * chainBonus,
            s.vx / 230,
            s.vy / 230,
            25,
          );
          s.hit.push(e);
          fxSpark(
            s.x,
            s.y,
            s.k === "dove" || s.k === "covenant_arrow" || s.k === "sword"
              ? "#fff6c8"
              : "#e8ecf8",
            s.signal ? 11 : 7,
          );
          if (s.k === "sword" && s.echo && !s.ghost) {
            s.echo = false;
            const o = nearestList(e.x, e.y, 150, 4).filter(
              (q) => q !== e && s.hit.indexOf(q) < 0,
            )[0];
            if (o) {
              const ea = Math.atan2(o.y - e.y, o.x - e.x);
              g.shots.push({
                wid: s.wid,
                k: "sword",
                x: e.x,
                y: e.y,
                vx: Math.cos(ea) * 300,
                vy: Math.sin(ea) * 300,
                ang: ea,
                dmg: s.dmg * (s.echoTier ? 0.82 : 0.52),
                pierce: 0,
                hit: [e],
                r: 4,
                life: 0.9,
                tg: o,
                ghost: true,
              });
            }
          }
          if (s.signal && e.boss) {
            createSignalZone(e.x, e.y, s.evolved);
            s.dead = true;
            return;
          }
          if (
            s.k === "dove" &&
            G.weaponTrees &&
            G.weaponTrees.dove &&
            G.weaponTrees.dove.path === "mercy" &&
            G.t >= (G.W.dove.evoHealAt || 0)
          ) {
            G.W.dove.evoHealAt = G.t + (G.weaponTrees.dove.tier ? 9 : 14);
            if (G.p.hp < G.mods.maxhp) healP(HPS);
          }
          if (s.k === "stone" && s.treePath === "impact") {
            const radius = s.treeTier ? 42 : 26,
              splash = s.dmg * (s.treeTier ? 0.55 : 0.32);
            burst(
              s.x,
              s.y,
              s.treeTier ? 12 : 7,
              s.treeTier ? "#ffe27a" : "#ff9a2a",
              s.treeTier ? 95 : 65,
            );
            for (const near of g.enemies) {
              if (near.dead || near === e) continue;
              const ndx = near.x - s.x,
                ndy = near.y - s.y,
                nd = Math.hypot(ndx, ndy) || 1;
              if (nd < radius + near.r)
                hurtBy(
                  s.wid || s.k || "shot",
                  near,
                  splash,
                  ndx / nd,
                  ndy / nd,
                  8,
                );
            }
          }
          if (s.hit.length > s.pierce) {
            s.dead = true;
            if (s.k === "dove") burst(s.x, s.y, 4, "#ffffff", 40);
          }
        }
      });
    }
    g.shots = g.shots.filter((s) => !s.dead);
    // tiros inimigos
    updatePoison(g, dt);
    for (const q of g.eshots) {
      if (q.dead) continue;
      if (q.k === "poison_flask") {
        q.t += dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        const progress = clamp(q.t / q.flight, 0, 1);
        q.z = Math.sin(progress * Math.PI) * q.arc;
        if (Math.hypot(q.x - p.x, q.y - p.y) < q.r + 5) {
          impactPoisonFlask(q, g, p.x, p.y, true);
          continue;
        }
        if (q.t >= q.flight) impactPoisonFlask(q, g, q.x, q.y, false);
        continue;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.life -= dt;
      if (q.life <= 0) {
        q.dead = true;
        continue;
      }
      if (Math.hypot(q.x - p.x, q.y - p.y) < q.r + 5) {
        hurtPlayer(q.dmg, q);
        q.dead = true;
      }
    }
    g.eshots = g.eshots.filter((q) => !q.dead);
    // contato
    if (p.inv <= 0 && p.sh <= 0)
      forNear(p.x, p.y, 5 + 28, (e) => {
        if (p.inv > 0) return;
        if (e.ab === "poison_flask") return;
        if (Math.hypot(e.x - p.x, e.y - (p.y + HOY)) < e.r + HR + 1.5) {
          if (e.ab === "fuse") {
            kill(e);
            return;
          }
          e.impT = g.t;
          hurtPlayer(e.dmg, e);
          pushP(p.x - e.x, p.y - e.y, 170);
          e.kx -= (p.x - e.x) * 2;
          e.ky -= (p.y - e.y) * 2;
        }
      });

    // pickups
    const pr = m.pickup;
    for (const k of g.pk) {
      if (tickCoinLifetime(k, dt)) {
        BTL.pickupExpired(k, "coin_lifetime");
        continue;
      }
      const dx = p.x - k.x,
        dy = p.y - k.y,
        d = Math.hypot(dx, dy) || 1,
        magnetic = k.type[0] === "f" || k.type === "coin";
      if (magnetic && (k.mag || d < pr)) {
        k.sp = Math.min(280, k.sp + 700 * dt);
        k.x += (dx / d) * Math.max(k.sp, 60) * dt;
        k.y += (dy / d) * Math.max(k.sp, 60) * dt;
      }
      if (d < (magnetic ? 7 : 11)) {
        k.dead = true;
        collect(k);
      }
      if (k.type !== "coin") {
        k.life -= dt;
        if (k.life <= 0 && !k.mag && d > 400) {
          k.dead = true;
          BTL.pickupExpired(k, "unmagnetized_out_of_range_timeout");
        }
      }
    }
    g.pk = g.pk.filter((k) => !k.dead);

    // fx
    for (const f of g.fx) {
      if (f.wait > 0) {
        f.wait = Math.max(0, f.wait - dt);
        continue;
      }
      f.t += dt;
      if (f.follow) {
        f.x = p.x;
        f.y = p.y;
      }
      if (f.k === "melee") {
        if (!f.done) {
          f.done = true;
          meleeHit(f);
        }
      } else if (f.k === "ring") {
        f.r = 4 + (f.maxr - 4) * Math.min(1, f.t / f.life);
        for (const e of g.enemies) {
          if (e.dead || f.hit.has(e)) continue;
          const dx = e.x - f.x,
            dy = e.y - f.y,
            d = Math.hypot(dx, dy) || 1;
          if (Math.abs(d - f.r) < 10 + e.r) {
            f.hit.add(e);
            hurtBy(
              f.wid || f.k || "fx",
              e,
              f.dmg * (e.boss ? f.bossMult || 1 : 1),
              dx / d,
              dy / d,
              f.knock,
            );
          }
        }
        for (const q of g.eshots)
          if (!q.dead && Math.abs(Math.hypot(q.x - f.x, q.y - f.y) - f.r) < 10)
            q.dead = true;
      } else if (f.k === "flame" && !f.done && f.t >= f.delay) {
        f.done = true;
        burst(f.x, f.y, 8, "#ff9a2a", 70);
        for (const e of g.enemies) {
          if (e.dead) continue;
          const dx = e.x - f.x,
            dy = e.y - f.y,
            d = Math.hypot(dx, dy) || 1;
          if (d < f.r + e.r) {
            if (f.burn) {
              e.burnT = Math.max(e.burnT || 0, f.burnDuration || 2.4);
              e.burnDmg = Math.max(
                e.burnDmg || 0,
                f.dmg * (f.burnRatio || 0.16),
              );
              e.burnTick = Math.min(
                e.burnTick == null ? 0.35 : e.burnTick,
                0.35,
              );
            }
            hurtBy(f.wid || f.k || "fx", e, f.dmg, dx / d, dy / d, 20);
          }
        }
      }
    }
    for (const f of g.fx)
      if (f.k === "bolt" && !f.done && f.t >= f.delay) {
        f.done = true;
        burst(f.x, f.y, 10, "#fff3a0", 80);
        SFX.play("zap");
        const hit = new Set();
        for (const e of g.enemies) {
          if (e.dead) continue;
          const dx = e.x - f.x,
            dy = e.y - f.y,
            d = Math.hypot(dx, dy) || 1;
          if (d < f.r + e.r) {
            hurtBy(
              f.wid || f.k || "fx",
              e,
              f.dmg * (e.boss ? f.bossMult || 1 : 1),
              dx / d,
              dy / d,
              15,
            );
            hit.add(e);
          }
        }
        if (f.chainCount) {
          const near = nearestList(
            f.x,
            f.y,
            f.chainCount === 3 ? 115 : 85,
            12,
          ).filter((e) => !hit.has(e));
          for (const e of near.slice(0, f.chainCount)) {
            if (e.dead) continue;
            const dx = e.x - f.x,
              dy = e.y - f.y,
              d = Math.hypot(dx, dy) || 1;
            hurtBy(
              f.wid || f.k || "fx",
              e,
              f.dmg * f.chainMult * (e.boss ? f.bossMult || 1 : 1),
              dx / d,
              dy / d,
              8,
            );
            burst(e.x, e.y, 4, "#fff3a0", 45);
            (f.links || (f.links = [])).push({ x: e.x, y: e.y });
          }
        }
      }
    g.fx = g.fx.filter((f) => f.t < f.life);
    for (const q of g.parts) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 0.94;
      q.vy *= 0.94;
      q.life -= dt;
    }
    g.parts = g.parts.filter((q) => q.life > 0);
    g.enemies = g.enemies.filter((e) => !e.dead);
    g.shake = Math.max(0, g.shake - dt);
    g.flash = Math.max(0, g.flash - dt);
    g.hurtFlash = Math.max(0, g.hurtFlash - dt);

    if (p.hp <= 0) return endRun(false);
    if (!g.inf && g.t >= WIN_T) return endRun(true);
    if (g.pending.length && state === "play") {
      openLevelUp();
    }
  }

  /* ================= desenho ================= */
  const sx = (x) => Math.round(x - camx),
    sy = (y) => Math.round(y - camy);
  function pathC(tx) {
    return 5 * Math.sin(tx * 0.045) + 2.5 * Math.sin(tx * 0.11 + 1.7);
  }
  function pathW(tx) {
    return 2 + 0.7 * Math.sin(tx * 0.07 + 0.5);
  }
  function onPath(tx, ty) {
    return Math.abs(ty - pathC(tx)) < pathW(tx) + 0.8;
  }
  function drawGround() {
    const x0 = Math.floor(camx / TS),
      y0 = Math.floor(camy / TS),
      x1 = Math.floor((camx + VW) / TS),
      y1 = Math.floor((camy + VH) / TS),
      dk = dawnK();
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        const v = Math.floor(hash(tx, ty, 3) * 4);
        let grp,
          vi = v;
        const dist = Math.abs(ty - pathC(tx)),
          w = pathW(tx);
        if (dist < w || (dist < w + 1 && hash(tx, ty, 5) > 0.5)) {
          grp = "dirt";
          vi = v % 3;
        } else {
          const n =
            vnoise(tx * 0.11, ty * 0.11) * 0.7 +
            vnoise(tx * 0.33, ty * 0.33) * 0.3;
          grp = n > 0.56 ? "g2" : "g1";
        }
        const X = tx * TS - camx,
          Y = ty * TS - camy;
        ctx.drawImage(S.tiles[grp][vi], X, Y);
        if (dk > 0) {
          ctx.globalAlpha = dk;
          ctx.drawImage(S.tilesDay[grp][vi], X, Y);
          ctx.globalAlpha = 1;
        }
      }
  }
  /* decoração do cenário: determinística por célula (usada no desenho e na colisão) */
  const DCS = 26;
  const OPEN_T = [
    [0.16, "tuftDead"],
    [0.27, "skull"],
    [0.33, "bones"],
    [0.45, "bush"],
    [0.55, "rock"],
    [0.67, "deadTree"],
    [0.73, "cross"],
    [0.79, "tombA"],
    [0.83, "candle"],
    [0.87, "blood"],
    [0.9, "pent"],
    [0.93, "invCross"],
    [0.96, "wisp"],
    [0.98, "skullH"],
    [1, "statue"],
  ];
  const GRAVE_T = [
    [0.2, "tombA"],
    [0.36, "tombB"],
    [0.47, "cross"],
    [0.56, "skull"],
    [0.63, "bones"],
    [0.71, "fence"],
    [0.77, "candle"],
    [0.82, "deadTree"],
    [0.87, "invCross"],
    [0.91, "statue"],
    [0.95, "coffin"],
    [0.975, "skullH"],
    [1, "blood"],
  ];
  const SOLID = {
    deadTree: 6,
    bush: 5,
    rock: 5,
    tombA: 5,
    tombB: 5,
    cross: 4,
    angel: 6,
    gargoyle: 6,
    coffin: 7,
  },
    FLAT = { blood: 1, pent: 1 };
  const graveZone = (cx, cy) =>
    vnoise(cx * 0.09 + 40, cy * 0.09 + 17) > 0.64; /* manchas de cemitério */
  function decorAt(cx, cy) {
    const gz = graveZone(cx, cy);
    if (hash(cx, cy, 7) > (gz ? 0.5 : 0.2)) return null;
    const px = cx * DCS + hash(cx, cy, 8) * DCS,
      py = cy * DCS + hash(cx, cy, 10) * DCS;
    if (onPath(px / TS, py / TS)) return null;
    const r = hash(cx, cy, 9),
      tb = gz ? GRAVE_T : OPEN_T;
    let k = "rock";
    for (const e of tb)
      if (r < e[0]) {
        k = e[1];
        break;
      }
    if (k === "statue") k = hash(cx, cy, 11) < 0.5 ? "angel" : "gargoyle";
    return { k, px, py };
  }
  function spr(s, x, y, sc, flash, flip, syy, alpha, sxx) {
    ctx.save();
    ctx.translate(sx(x), sy(y));
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
    ctx.scale((flip ? -1 : 1) * sc * (sxx || 1), sc * (syy || 1));
    ctx.drawImage(flash ? s.f : s.c, -s.w / 2, -s.h / 2);
    ctx.restore();
  }
  function shadow(x, y, w) {
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.fillRect(sx(x - w / 2), sy(y), Math.round(w), 2);
  }
  function drawText(s, x, y, col) {
    ctx.font = "9px " + CF.body;
    ctx.textAlign = "center";
    ctx.fillStyle = "#000";
    ctx.fillText(s, x + 1, y + 1);
    ctx.fillStyle = col;
    ctx.fillText(s, x, y);
  }

  function draw() {
    const g = G,
      p = g.p;
    let shx = 0,
      shy = 0;
    if (g.shake > 0 && save.set.fx) {
      shx = Math.round(rndFx(-2, 2) * Math.min(1, g.shake * 3));
      shy = Math.round(rndFx(-2, 2) * Math.min(1, g.shake * 3));
    }
    camx = Math.round(p.x - VW / 2) + shx;
    camy = Math.round(p.y - VH / 2) + shy;
    drawGround();
    nxShadowPass();
    drawDecor();
    // pickups
    for (const k of g.pk) {
      if (
        k.x < camx - 20 ||
        k.x > camx + VW + 20 ||
        k.y < camy - 20 ||
        k.y > camy + VH + 20
      )
        continue;
      const bob = Math.sin(g.t * 4 + k.ph) * 1.5;
      let im = S[k.type],
        sc = 1;
      if (!im) continue;
      if (k.type === "f3") sc = 1.4;
      if (k.type === "mana" || k.type === "ark") sc = 1.2;
      if (
        k.type === "mana" ||
        k.type === "fire" ||
        k.type === "shield" ||
        k.type === "ark"
      ) {
        ctx.fillStyle =
          "rgba(255,230,150," + (0.15 + 0.1 * Math.sin(g.t * 5 + k.ph)) + ")";
        ctx.beginPath();
        ctx.arc(sx(k.x), sy(k.y + bob), 9, 0, 6.3);
        ctx.fill();
      }
      shadow(k.x, k.y + 5, 6);
      spr(im, k.x, k.y + bob, sc, false, false, 1, coinOpacity(k, g.t));
    }
    // inimigos (no chão: ordenados com o cenário; voadores por cima)
    g.enemies.sort((a, b) => a.y - b.y);
    {
      const air = [];
      for (const e of g.enemies) {
        if (
          e.x < camx - 60 ||
          e.x > camx + VW + 60 ||
          e.y < camy - 60 ||
          e.y > camy + VH + 60
        )
          continue;
        if (e.fly) {
          air.push(e);
          continue;
        }
        drawEnemy(e, g, false);
      }
      for (const e of air) drawEnemy(e, g, true);
    }
    // jogador
    flushDecor(p.y + 8);
    {
      const frame = p.moving ? Math.floor(p.walk * 8) % 2 : 0,
        hv2 = HFR[g.hk] && HFR[g.hk].v2,
        bob =
          p.moving && !hv2
            ? -Math.abs(Math.sin((Math.PI * (p.walk * 13 - 0.5)) / 2)) * 1.5
            : 0;
      for (const [weaponId, weaponRun] of Object.entries(g.W || {}))
        if (
          weaponRun &&
          WEAPONS[weaponId] &&
          WEAPONS[weaponId].behavior === "aura_pulse"
        )
          drawAura(g, p, weaponId);
      if (g.mods.rng) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,.10)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        ctx.arc(sx(p.x), sy(p.y), g.mods.rng, 0, 6.3);
        ctx.stroke();
        ctx.restore();
      }
      shadow(p.x, p.y + (hv2 ? 11 : 10), hv2 ? 12 : 10);
      const frozen = p.stasisT > 0;
      const blink = !frozen && p.inv > 0 && Math.floor(g.t * 20) % 2 === 0;
      drawFrenzy(g, p, bob);
      const hs = heroSpr(g, p) || S.hero[g.hk][frame];
      spr(
        frozen ? goldSprite(hs) : hs,
        p.x,
        p.y + bob - (g.fallY || 0),
        1,
        false,
        p.face < 0,
        1,
        blink ? 0.4 : 1,
      );
      if (frozen) drawGoldGlint(g, p, bob);
      heroExtra(g, p);
      if (p.sh > 0 && !frozen) drawDome(g, p);
    }
    flushDecor(1e9);
    // escudos
    for (const [weaponId, weaponRun] of Object.entries(g.W || {})) {
      const behavior = WEAPONS[weaponId] && WEAPONS[weaponId].behavior;
      if (!weaponRun) continue;
      if (behavior === "orbiting_shields") drawShields(g, p, weaponId);
      else if (behavior === "orbiting_companions") drawAngels(g, p, weaponId);
    }
    // tiros
    drawShots(g);
    for (const pool of g.poisonPools) {
      const fade = Math.min(1, pool.life / 0.3);
      ctx.globalAlpha = 0.7 * fade;
      ctx.fillStyle = "#397a35";
      ctx.beginPath();
      ctx.ellipse(sx(pool.x), sy(pool.y) + 2, 13, 5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#81d64b";
      ctx.fillRect(sx(pool.x) - 6, sy(pool.y), 2, 1);
      ctx.fillRect(sx(pool.x) + 3, sy(pool.y) + 2, 2, 1);
      ctx.globalAlpha = 1;
    }
    for (const q of g.eshots) {
      if (q.k === "poison_flask") {
        const x = sx(q.x),
          y = sy(q.y - q.z);
        ctx.fillStyle = "#203b24";
        ctx.fillRect(x - 2, y - 3, 5, 6);
        ctx.fillRect(x - 1, y - 5, 3, 2);
        ctx.fillStyle = "#3a8b36";
        ctx.fillRect(x - 1, y - 2, 3, 4);
        ctx.fillStyle = "#b5f05e";
        ctx.fillRect(x, y - 1, 1, 2);
        continue;
      }
      if (q.red ? S.eshotr : S.eshot) {
        spr(q.red ? S.eshotr : S.eshot, q.x, q.y, 1);
        continue;
      }
      ctx.fillStyle = q.red ? "#4a0a0a" : "#2a0a3a";
      ctx.beginPath();
      ctx.arc(sx(q.x), sy(q.y), 4, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = q.red ? "#ff4a3a" : "#c04dff";
      ctx.beginPath();
      ctx.arc(sx(q.x), sy(q.y), 2.5, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(sx(q.x), sy(q.y) - 1, 1, 1);
    }
    // fx
    for (const f of g.fx) {
      if (f.wait > 0) continue;
      const k = f.t / f.life;
      if (FXR[f.k]) FXR[f.k](f, k, g);
      else if (f.k === "txt") drawText(f.s, sx(f.x), sy(f.y - k * 10), f.col);
      else if (f.k === "ghost") {
        const hs = S.hero[g.hk] && S.hero[g.hk][0];
        if (hs) spr(hs, f.x, f.y, 1, false, f.face < 0, 1, 0.55 * (1 - k));
      }
    }
    for (const q of g.parts) {
      ctx.globalAlpha = Math.max(0, q.life / q.max);
      ctx.fillStyle = q.col;
      ctx.fillRect(sx(q.x), sy(q.y), q.sz, q.sz);
    }
    ctx.globalAlpha = 1;
    // atmosfera: anoitece com o tempo
    const night = NIGHT_A * (1 - dawnK());
    if (night > 0.01 && save.set.fx) {
      ctx.fillStyle = nxNightCol() + night * nxNightMul() + ")";
      ctx.fillRect(0, 0, VW, VH);
    }
    if (save.set.fx) {
      ctx.globalAlpha = 0.25 + 0.75 * (1 - dawnK());
      ctx.drawImage(vign, 0, 0);
      ctx.globalAlpha = 1;
    }
    if (g.flash > 0 && save.set.fx) {
      ctx.fillStyle = "rgba(255,245,200," + Math.min(0.8, g.flash) + ")";
      ctx.fillRect(0, 0, VW, VH);
    }
    if (g.hurtFlash > 0 && save.set.fx) {
      /* dano: pisca em vermelho nas bordas (o centro fica limpo) */
      const k = Math.min(1, g.hurtFlash / 0.45),
        gr = ctx.createRadialGradient(
          VW / 2,
          VH / 2,
          Math.min(VW, VH) * 0.38,
          VW / 2,
          VH / 2,
          Math.hypot(VW, VH) / 2,
        );
      gr.addColorStop(0, "rgba(224,40,60,0)");
      gr.addColorStop(1, "rgba(224,40,60," + 0.5 * k * (0.65 + 0.35 * Math.cos((1 - k) * 14)) + ")");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, VW, VH);
    }
  }

  /* ================= HUD ================= */
  const H$ = {
    xpfill: $("#xpfill"),
    lvl: $("#lvl"),
    kills: $("#kills"),
    hpfill: $("#hpfill"),
    hptxt: $("#hptxt"),
    timer: $("#timer"),
    obj: $("#obj"),
    coins: $("#coins"),
    bossbar: $("#bossbar"),
    bossname: $("#bossname"),
    bossfill: $("#bossfill"),
    rack: $("#rack"),
    fps: $("#fps"),
  };
  let fpsFrames = 0,
    fpsLast = 0,
    fpsValue = 0;
  function updFps(now) {
    fpsFrames++;
    if (now - fpsLast >= 500) {
      fpsValue = Math.round((fpsFrames * 1000) / (now - fpsLast));
      fpsFrames = 0;
      fpsLast = now;
      if (H$.fps && save.set.showfps) H$.fps.textContent = "FPS: " + fpsValue;
    }
  }
  function syncFpsHud() {
    if (!H$.fps) return;
    /* Só na gameplay ativa — some na pausa e overlays escuros */
    const on = !!save.set.showfps && state === "play";
    H$.fps.hidden = !on;
    if (on) H$.fps.textContent = "FPS: " + fpsValue;
  }
  const hl = {};
  function setT(el, key, v) {
    if (hl[key] !== v) {
      hl[key] = v;
      el.textContent = v;
    }
  }
  function updHud() {
    const g = G;
    H$.xpfill.style.width = ((g.xp / g.need) * 100).toFixed(1) + "%";
    setT(H$.lvl, "lvl", "NÍVEL " + g.lvl);
    setT(H$.kills, "k", g.kills + " DERROTADOS");
    const mh = g.mods.maxhp;
    H$.hpfill.style.width = clamp((g.p.hp / mh) * 100, 0, 100).toFixed(1) + "%";
    setT(
      H$.hptxt,
      "hp",
      "SALVAÇÃO " + Math.max(0, Math.ceil(g.p.hp)) + "/" + mh,
    );
    setT(H$.timer, "t", fmt(g.t));
    setT(H$.coins, "c", "Moedas " + runCoins(g));
    let o;
    if (g.boss) o = "Derrote " + BOSSES[g.boss.idx].name + "!";
    else if (g.inf || g.bossIdx < BOSS_T.length)
      o =
        "Sobreviva · " +
        (g.bossIdx === 0 ? "primeiro chefe" : "próximo chefe") +
        " em " +
        Math.max(0, Math.ceil(bossTime(g.bossIdx) - g.t)) +
        "s";
    else
      o =
        "Resista até o amanhecer · faltam " +
        Math.max(0, Math.ceil(WIN_T - g.t)) +
        "s";
    setT(H$.obj, "o", o);
    {
      const ohv = !!g.boss;
      if (hl.oh !== ohv) {
        hl.oh = ohv;
        H$.obj.hidden = ohv;
      }
    }
    if (g.boss) {
      H$.bossbar.hidden = false;
      setT(H$.bossname, "bn", BOSSES[g.boss.idx].name);
      H$.bossfill.style.width =
        clamp((g.boss.hp / g.boss.mhp) * 100, 0, 100).toFixed(1) + "%";
    } else H$.bossbar.hidden = true;
  }
  function slotHTML(id, lvl, isW) {
    const group = isW ? "weapon" : "passive",
      ev = selectedEvolution(id, group),
      path =
        ev &&
        (id === "sling"
          ? SLING_TREE[ev.path]
          : EVOLUTION_TREES[group] &&
          EVOLUTION_TREES[group][id] &&
          EVOLUTION_TREES[group][id].paths[ev.path]);
    const evolved = !!ev,
      mastered = evolved && !!ev.tier,
      sup = !!(isW && G && G.evo && G.evo[id]),
      rdy = !!(isW && !sup && G && G.nx && G.nx.ready && G.nx.ready[id]),
      cls =
        "slot" +
        (isW ? " w" : "") +
        (evolved ? " evolved" : "") +
        (mastered ? " mastered" : "") +
        (sup ? " supreme" : "") +
        (rdy ? " evo-ready" : "");
    const title =
      (isW ? WEAPONS[id].name : PASSIVES[id].name) +
      " · Nv " +
      lvl +
      (isW ? "" : "&#10;" + (PASSIVES[id].desc || "")) +
      (path
        ? "&#10;" +
        path.name +
        (mastered ? " · MAESTRIA: " + path.node.name : " · caminho evolutivo")
        : "") +
      (sup
        ? "&#10;✦ Evolução Suprema: " + NX_EVO[id].n
        : rdy
          ? "&#10;✦ Evolução Suprema pronta: aparece na próxima Arca"
          : "");
    return (
      '<div class="' +
      cls +
      '"' +
      (evolved
        ? ' style="--evo-color:' +
        evoAccent(id, ev.path, mastered) +
        '" data-evo-path="' +
        ev.path +
        '"'
        : "") +
      ' data-tip="' +
      title +
      '"><img alt="" src="' +
      gameIconURL(id, group) +
      '"><b>' +
      lvl +
      "</b></div>"
    );
  }
  function buildHTML() {
    let h = "",
      ph = state !== "dead" && state !== "win";
    for (const id in G.W) h += slotHTML(id, G.W[id].lvl, true);
    if (ph)
      for (let i = Object.keys(G.W).length; i < SLOT_W; i++)
        h += '<div class="slot empty" data-tip="Espaço de arma livre"></div>';
    for (const id in G.P) h += slotHTML(id, G.P[id], false);
    if (ph)
      for (let i = Object.keys(G.P).length; i < SLOT_P; i++)
        h += '<div class="slot empty" data-tip="Espaço de dom livre"></div>';
    return h;
  }
  function buildRack() {
    H$.rack.innerHTML = buildHTML();
  }
  let toastT = 0;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.remove("show");
    void t.offsetWidth;
    t.classList.add("show");
  }
  function banner(a, b) {
    const t = $("#banner");
    $("#bnT").textContent = a;
    $("#bnS").textContent = b;
    t.classList.remove("show");
    void t.offsetWidth;
    t.classList.add("show");
  }

  /* ================= fluxo ================= */
  let last = 0,
    raf = 0,
    lastDraw = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const cap = save.set.fps;
    if (cap) {
      const step = 1000 / cap;
      if (now - lastDraw < step - 3) return;
      lastDraw = now;
    }
    if (state !== "dawning") dawnText(0);
    if (save.set.showfps) updFps(now);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (state === "play") {
      if (G && G.hitstop > 0) G.hitstop -= dt;
      else update(dt);
    } else if (state === "dying") deathTick(dt);
    else if (state === "dawning") dawnTick(dt);
    else if (G && (state === "paused" || state === "levelup")) {
      try {
        wxUpdate(dt);
      } catch (e) { }
    }
    if (
      G &&
      (state === "play" ||
        state === "levelup" ||
        state === "paused" ||
        state === "dead" ||
        state === "win" ||
        state === "dying" ||
        state === "dawning" ||
        state === "tut")
    ) {
      draw();
      if (state === "play" || state === "levelup" || state === "tut") updHud();
    } else if (state === "menu") {
      menuDraw(now / 1000);
    }
  }
  function menuDraw(t) {
    // fundo animado do menu: cenário a deslizar
    camx = Math.round(t * 14);
    camy = Math.round(-20 + Math.sin(t * 0.3) * 10);
    ctx.clearRect(0, 0, VW, VH);
    drawGround();
    nxShadowPass();
    drawDecor();
    ctx.fillStyle = nxNightCol() + ".44)";
    ctx.fillRect(0, 0, VW, VH);
    ctx.globalAlpha = 0.55;
    for (const [sp, par] of [
      [6, 0.4],
      [-10, 0.7],
    ]) {
      const ox = -(((t * sp + camx * par) % 256) + 256) % 256,
        oy = -(((t * sp * 0.4 + camy * par) % 256) + 256) % 256;
      for (let x = ox - 256; x < VW; x += 256)
        for (let y = oy - 256; y < VH; y += 256) ctx.drawImage(FOG, x, y);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(vign, 0, 0);
  }
  function startRun() {
    SFX.init();
    save.hero = selHero;
    persist();
    try {
      profTouchDay();
    } catch (e) { }
    track("run_start", {
      hero: selHero,
      daily: RUN.daily ? 1 : 0,
      mode: RUN.mode === "inf" ? "inf" : "std",
    });
    try {
      wxReset();
    } catch (e) { }
    newRun(selHero);
    G.inf = RUN.mode === "inf";
    SLOT_W = G.inf ? INF_SLOTS_W : 4;
    SLOT_P = G.inf ? INF_SLOTS_P : 4;
    state = "play";
    last = performance.now();
    BTL.start(G);
    $("#menu").hidden = true;
    $("#end").hidden = true;
    $("#pause").hidden = true;
    $("#lvlup").hidden = true;
    $("#hud").hidden = false;
    for (const k in hl) delete hl[k];
    buildRack();
    updHud();
    hudHeroAvatar();
    syncFpsHud();
    toast(
      G.inf
        ? "Vigília Eterna: não há amanhecer. Sobreviva o quanto puder!"
        : "Resista às trevas! Sua fé é sua força",
    );
  }
  function endRun(won, ret, quiet) {
    if (G.over) return;
    G.over = true;
    state = won ? "win" : "dead";
    BTL.finish(won, ret);
    save.coins += runCoins();
    save.runs++;
    starterArm();
    G.won = !!won;
    track("run_end", {
      won: won ? 1 : 0,
      t: Math.floor(G.t),
      lvl: G.lvl,
      kills: G.kills,
      hero: selHero,
      ret: ret ? 1 : 0,
      mode: G.inf ? "inf" : "std",
    });
    if (won) (save.winH = save.winH || {})[G.hk] = 1;
    checkAch();
    {
      const c = (save.cst = save.cst || { n: 0, s: 0 });
      c.n++;
      c.s += runCoins();
    }
    save.mast[selHero] = Math.max(save.mast[selHero] || 0, G.t);
    const newBest = G.inf
      ? G.t > (save.bestInf || 0)
      : G.t > save.best;
    if (newBest) {
      if (G.inf) save.bestInf = G.t;
      else save.best = G.t;
    }
    persist();
    recordRun(won);
    try {
      profRecordRun(won, ret);
    } catch (e) {
      console.warn("[perfil]", e);
    }
    if (!quiet) SFX.play(won ? "win" : "lose");
    $("#hud").hidden = true;
    const v = ret ? END_VERSES.interrupted : pick(END_VERSES[won ? "win" : "lose"]);
    $("#endT").textContent = ret
      ? "Jornada interrompida"
      : won
        ? "Vitória na fé!"
        : G.inf
          ? "Vigília encerrada"
          : "A fé fraquejou";
    $("#endV").innerHTML = "“" + v[0] + "” <b>" + v[1] + "</b>";
    $("#endSum").innerHTML =
      "<div><b>" +
      fmt(G.t) +
      "</b>Tempo" +
      (newBest && !won ? '<br><span class="newrec">NOVO RECORDE</span>' : "") +
      "</div><div><b>" +
      G.kills +
      "</b>Derrotados</div><div><b>" +
      G.lvl +
      '</b>Nível de fé</div><div id="sumCoins"><b>' +
      runCoins() +
      "</b>Moedas</div>";
    $("#endBuild").innerHTML = buildHTML();
    $("#againBtn").textContent = won ? "Jogar de novo" : "Tentar de novo";
    endNote(won, ret);
    reviveSetup(won, ret);
    $("#end").hidden = false;
    try {
      endHeroStart(won && !ret);
    } catch (e) {
      console.warn("[endHero]", e);
    }
    refreshMeta();
    dblSetup(runCoins());
  }
  function pauseGame() {
    if (state !== "play") return;
    state = "paused";
    $("#pauseBuild").innerHTML = buildHTML();
    {
      const ps = $("#pauseStats");
      ps.innerHTML = "";
      try {
        ps.appendChild(statBox());
      } catch (e) { }
    }
    $("#pause").hidden = false;
    resetScrollTree($("#pause"));
    syncFpsHud();
  }
  function resumeGame() {
    if (state !== "paused") return;
    state = "play";
    $("#pause").hidden = true;
    last = performance.now();
    syncFpsHud();
  }
  function toMenu() {
    state = "menu";
    G = null;
    try {
      wxReset();
    } catch (e) { }
    $("#hud").hidden = true;
    $("#pause").hidden = true;
    $("#end").hidden = true;
    $("#lvlup").hidden = true;
    $("#menu").hidden = false;
    refreshMeta();
    resetScrollTree($("#menu"));
    starterMenu();
  }
  function refreshMeta() {
    $("#meta").textContent =
      "Moedas guardadas: " +
      save.coins +
      " · Melhor tempo: " +
      (save.best ? fmt(save.best) : "—") +
      " · Partidas: " +
      save.runs;
    refreshBuildInfo();
    starterCardSync();
    try {
      profBtnSync();
    } catch (e) { }
  }

  /* ================= v0.2: loja, testemunhos, configuracoes ================= */
  save.shop = save.shop || {};
  save.ach = save.ach || {};
  save.mast = save.mast || {};
  save.unl = save.unl || {};
  save.set = Object.assign(
    {
      sound: 1,
      vol: 1,
      auto: 1,
      music: 1,
      mvol: 0.65,
      fx: 1,
      fps: 0,
      showfps: 0,
      fog: 1,
      sysfont: 0,
    },
    save.set || {},
  );
  applyFont();
  SFX.on = !!save.set.sound;
  SFX.vol = save.set.vol;
  const LEGACY_SHOP = [
    ["sharpen", "Afiar a Espada", "+5% de dano", 60],
    ["vigor", "Vigor da Fé", "+1 de Salvação máxima", 50],
    ["feet", "Pés Ligeiros", "+3% de velocidade", 45],
    ["discern", "Discernimento", "+5% de Fé ganha", 70],
    ["greed", "Generosidade", "+10% de moedas", 80],
    ["area", "Alcance da Luz", "+4% de área das armas", 60],
    ["skin", "Pele de Ferro", "−1 de dano recebido (mín. 1)", 260, 3],
    ["crit", "Golpe Certeiro", "+2% de chance de crítico", 300],
    ["magnet", "Ímã da Graça", "+17% de alcance de coleta", 200],
  ];
  const slv = (id) => save.shop[id] || 0,
    scost = (x) => Math.round(x[3] * (1 + 0.4 * slv(x[0])));
  /* ================= Runas do Reino (árvore de melhorias meta) ================= */
  // Cada ramo: uma pedra-chave e três níveis. Em cada nível escolhe-se UMA runa.
  // Níveis só abrem depois de ter as escolhas anteriores do ramo.
  const RT_COST = ECO.RUNE_COST,
    RT_RESPEC = ECO.RUNE_RESPEC,
    RT_NEED = { key: 0, t1: 1, t2: 2, t3: 3 };
  const RT_LBL = {
    key: "Pedra-chave",
    t1: "Nível 1",
    t2: "Nível 2",
    t3: "Nível 3",
  };
  const CHOICE_TOOL_BASE_USES = 2,
    CHOICE_TOOL_MAX_USES = 5,
    CHOICE_TOOL_UPGRADE_COST = (level) => RT_COST.t3 * (level + 1);
  if (
    !save.choiceToolUpgrades ||
    typeof save.choiceToolUpgrades !== "object" ||
    Array.isArray(save.choiceToolUpgrades)
  )
    save.choiceToolUpgrades = {};
  for (const id of ["banish", "skip"])
    save.choiceToolUpgrades[id] = Math.max(
      0,
      Math.min(
        CHOICE_TOOL_MAX_USES - CHOICE_TOOL_BASE_USES,
        Math.floor(Number(save.choiceToolUpgrades[id]) || 0),
      ),
    );
  function choiceToolMaxUses(id, adBonus) {
    return (
      CHOICE_TOOL_BASE_USES + save.choiceToolUpgrades[id] + (adBonus ? 1 : 0)
    );
  }
  function createChoiceTools() {
    return {
      banishUsed: 0,
      skipUsed: 0,
      adBonus: false,
      banished: [],
      action: null,
      max: {
        banish: choiceToolMaxUses("banish", false),
        skip: choiceToolMaxUses("skip", false),
      },
    };
  }
  function choiceToolCost(id) {
    return CHOICE_TOOL_UPGRADE_COST(save.choiceToolUpgrades[id]);
  }
  function upgradeChoiceTool(id, box) {
    const level = save.choiceToolUpgrades[id];
    if (level >= CHOICE_TOOL_MAX_USES - CHOICE_TOOL_BASE_USES) return;
    const cost = choiceToolCost(id);
    if (save.coins < cost)
      return notify(
        "Faltam " + (cost - save.coins) + " moedas para esse aprimoramento.",
        "warn",
      );
    save.coins -= cost;
    save.choiceToolUpgrades[id] = level + 1;
    persist();
    SFX.play("coin");
    renderShop(box);
  }
  function renderChoiceToolUpgrades(shopBox) {
    const box = document.createElement("div");
    box.className = "rt-choice-upgrades";
    box.innerHTML =
      "<b>" +
      "CONTROLE DAS BÊNÇÃOS" +
      "</b><small>" +
      "Aprimoramentos permanentes do ramo Utilidade · cada nível concede +1 uso por partida." +
      "</small>";
    for (const [id, label, description] of [
      [
        "banish",
        "BANIR",
        "Remove uma bênção das próximas escolhas desta partida.",
      ],
      [
        "skip",
        "PULAR",
        "Encerra esta escolha sem selecionar uma bênção e concede um pouco de XP.",
      ],
    ]) {
      const level = save.choiceToolUpgrades[id],
        uses = choiceToolMaxUses(id, false),
        maxed = uses >= CHOICE_TOOL_MAX_USES,
        cost = choiceToolCost(id);
      const button = document.createElement("button");
      button.type = "button";
      button.disabled = maxed;
      button.innerHTML =
        "<span><b>" +
        label +
        " · " +
        uses +
        "/" +
        CHOICE_TOOL_MAX_USES +
        " usos</b><small>" +
        description +
        "</small></span><strong>" +
        (maxed ? "MÁX." : "↑ " + cost) +
        "</strong>";
      if (!maxed) button.onclick = () => upgradeChoiceTool(id, shopBox);
      box.appendChild(button);
    }
    return box;
  }
  const RT_CAT = {
    atk: {
      title: "Ataque",
      color: "#e0573a",
      icon: "sword",
      key: [
        [
          "k_blade",
          "Lâmina Ardente",
          "+10% de dano em todas as armas.",
          "sword",
        ],
        [
          "k_crit",
          "Olho Sagrado",
          "+6% de chance de crítico. Críticos causam 2,5× de dano, em vez de 2×.",
          "eye",
        ],
        [
          "k_wrath",
          "Fúria do Justo",
          "Ao abater um inimigo, causa +15% de dano por 2 s.",
          "flame",
        ],
      ],
      t1: [
        [
          "a1_exec",
          "Julgamento",
          "+20% de dano contra inimigos com menos de 30% de vida.",
          "target",
        ],
        [
          "a1_tempo",
          "Cadência Sagrada",
          "Suas armas disparam 8% mais rápido.",
          "hourglass",
        ],
      ],
      t2: [
        [
          "a2_area",
          "Alcance da Luz",
          "+10% de área e alcance das armas.",
          "sun",
        ],
        [
          "a2_kb",
          "Impacto Divino",
          "Golpes empurram os inimigos 40% mais longe.",
          "wind",
        ],
      ],
      t3: [
        [
          "a3_sede",
          "Sede de Justiça",
          "Cada abate restaura 1 de Salvação (máximo de 4 por segundo).",
          "drop",
        ],
        [
          "a3_guil",
          "Juízo Súbito",
          "Inimigos com menos de 20% de vida têm 5% de chance de cair na hora. Não afeta chefes.",
          "bolt",
        ],
      ],
    },
    def: {
      title: "Defesa",
      color: "#4a9ee8",
      icon: "shield",
      key: [
        ["k_fort", "Fortaleza da Fé", "+20% da Salvação base do herói.", "cross"],
        [
          "k_thorn",
          "Coroa de Espinhos",
          "Ao ser atingido, reflete 4 de dano nos inimigos próximos.",
          "thorn",
        ],
        [
          "k_mercy",
          "Misericórdia",
          "Recupera 10 de Salvação a cada 8 s.",
          "heart",
        ],
      ],
      t1: [
        [
          "d1_block",
          "Couraça de Fé",
          "+7% de chance de bloquear golpes.",
          "shield",
        ],
        ["d1_dr", "Pele de Ferro", "−3 de dano recebido (mínimo 40% do golpe).", "armor"],
      ],
      t2: [
        [
          "d2_refuge",
          "Refúgio",
          "Depois de ser atingido, fica invulnerável por 1,0 s (em vez de 0,8 s).",
          "dove",
        ],
        ["d2_vigor", "Vigor da Fé", "+15% da Salvação base do herói.", "cross"],
      ],
      t3: [
        [
          "d3_divine",
          "Escudo Divino",
          "A cada 30 s, fica invulnerável por 2 s.",
          "halo",
        ],
        [
          "d3_aura",
          "Aura Sagrada",
          "Inimigos próximos perdem 2 de vida por segundo.",
          "ring",
        ],
      ],
    },
    util: {
      title: "Utilidade",
      color: "#8bd16b",
      icon: "staff",
      key: [
        ["k_ascend", "Ascensão", "+8% de velocidade de movimento.", "boot"],
        [
          "k_grace",
          "Graça Abundante",
          "+10% de Fé ganha e +10% de moedas.",
          "star",
        ],
        [
          "k_pilgrim",
          "Peregrino",
          "+3% de velocidade e +20% de alcance de coleta.",
          "staff",
        ],
      ],
      t1: [
        ["u1_magnet", "Ímã da Graça", "+15% de alcance de coleta.", "magnet"],
        ["u1_wisdom", "Sabedoria", "+10% de Fé ganha.", "scroll"],
      ],
      t2: [
        ["u2_tithe", "Dízimo", "+20% de moedas ao fim da partida.", "coin"],
        [
          "u2_swift",
          "Passos Leves",
          "+6% de velocidade de movimento.",
          "wing",
        ],
      ],
      t3: [
        [
          "u3_acc",
          "Juízo Acumulado",
          "A cada 20 abates, o próximo golpe causa 50% a mais.",
          "stack",
        ],
        [
          "u3_harvest",
          "Colheita",
          "3% de chance de cada abate render 1 moeda extra (limite de 30 moedas-base por partida).",
          "wheat",
        ],
      ],
    },
  };
  const RT_ICONS = {
    sword: '<path d="M14 4h6v6L10 20l-4-4z"/><path d="M4 20l3-3M6 14l4 4"/>',
    eye: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
    flame:
      '<path d="M12 3c2 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 2 4 4z"/>',
    target:
      '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
    hourglass:
      '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
    wind: '<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h7"/>',
    drop: '<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>',
    bolt: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
    shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
    armor: '<path d="M6 4h12v5c0 4-3 7-6 9-3-2-6-5-6-9z"/><path d="M6 9h12"/>',
    cross: '<path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z"/>',
    thorn: '<path d="M12 3l3 7 6 2-6 2-3 7-3-7-6-2 6-2z"/>',
    heart:
      '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    dove: '<path d="M3 13c4-1 6-4 8-7 2 1 3 3 3 5l5-2-3 5c-3 3-8 4-13 2z"/>',
    halo: '<ellipse cx="12" cy="8" rx="7" ry="2.2"/><path d="M8 13c0 4 2 6 4 6s4-2 4-6"/>',
    ring: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4" stroke-dasharray="2 2"/>',
    boot: '<path d="M8 3v11l-4 3v3h13c2 0 3-1 3-2v-2l-5-2V3z"/>',
    wing: '<path d="M3 17c4 0 6-2 8-6 2 2 4 3 9 3-3 2-6 4-9 4-3 0-5-1-8-1z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    staff: '<path d="M14 3v18M14 3c-3 0-5 2-5 5s2 5 5 5"/>',
    magnet: '<path d="M5 4v7a7 7 0 0 0 14 0V4h-4v7a3 3 0 0 1-6 0V4z"/>',
    scroll:
      '<path d="M7 4h11v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3"/><path d="M9 8h6M9 12h6"/>',
    coin: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h4a1.5 1.5 0 0 1 0 3h-3"/>',
    stack: '<path d="M4 7l8-4 8 4-8 4zM4 12l8 4 8-4M4 17l8 4 8-4"/>',
    wheat:
      '<path d="M12 21V8M12 8c-2-1-3-3-3-5 2 1 3 3 3 5zM12 8c2-1 3-3 3-5-2 1-3 3-3 5zM12 13c-2-1-3-2-3-4 2 1 3 2 3 4zM12 13c2-1 3-2 3-4-2 1-3 2-3 4z"/>',
  };
  /* Ícones personalizados: assets/icons/runes/<id>.png
   id da runa (k_blade, u2_tithe...) ou da categoria (atk, def, util).
   Faltou o arquivo? Fica o SVG desenhado em RT_ICONS (fallback).
   Outro nome de arquivo: ASSET_MANIFEST.runes = { k_blade: "icons/runes/lamina.png" } */
  const RT_IMG_DIR = "icons/runes/"; /* relativo a ASSET_DIR (assets/) */
  const RT_IMG = {}; /* id -> url carregada | false (não existe) | null (aguardando) */
  const rtImgUrl = (id) =>
    (ASSET_MANIFEST.runes && ASSET_MANIFEST.runes[id]) || RT_IMG_DIR + id + ".png";
  const rtImgTag = (url) =>
    '<img src="' + url + '" alt="" draggable="false">';
  function rtImgApply(id) {
    const url = RT_IMG[id];
    if (!url) return;
    document
      .querySelectorAll('.rt-ico[data-rt="' + id + '"]')
      .forEach((el) => (el.innerHTML = rtImgTag(url)));
  }
  function rtImgLoad(id) {
    if (id in RT_IMG) return;
    RT_IMG[id] = null;
    const u = rtImgUrl(id),
      im = new Image();
    im.onload = () => {
      RT_IMG[id] = ASSET_DIR + u;
      ASSET_LOG.ok.push(u);
      rtImgApply(id);
    };
    im.onerror = () => {
      RT_IMG[id] = false;
      ASSET_LOG.miss.push(u);
    };
    im.src = ASSET_DIR + u;
  }
  const rtSvg = (n) =>
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (RT_ICONS[n] || RT_ICONS.star) +
    "</svg>";
  /* n = nome do glifo (fallback) · id = id da runa/categoria (nome do PNG) */
  const rtIcon = (n, id) => {
    if (id) rtImgLoad(id);
    return (
      '<span class="rt-ico" data-rt="' + (id || "") + '">' +
      (id && RT_IMG[id] ? rtImgTag(RT_IMG[id]) : rtSvg(n)) +
      "</span>"
    );
  };
  let runeSel = null; // runa destacada na tela
  const rtHas = (id) => {
    const T = save.rt || {};
    for (const c in T) for (const s in T[c]) if (T[c][s] === id) return true;
    return false;
  };
  const rtPicks = (cat) => Object.keys((save.rt || {})[cat] || {}).length;
  const rtFind = (cat, slot, id) =>
    (RT_CAT[cat][slot] || []).find((o) => o[0] === id);
  const rtUnlocked = (cat, slot) => {
    const others = rtPicks(cat) - (((save.rt || {})[cat] || {})[slot] ? 1 : 0);
    return others >= RT_NEED[slot];
  };
  /* ================= Economia central (v1.0) =================
     Toda moeda de partida passa por aqui. Fontes:
       drop    (moeda do chão)    → G.coins       × (1 + runas + Bolsa) × mapa
       harvest (runa Colheita)    → G.coins       × (1 + runas + Bolsa) × mapa   [limite: ECO.HARVEST_CAP moedas-base]
       offer   (bênção Oferta)    → G.offerCoins  valor fixo, SEM multiplicadores
       skip    (Pular)            → 0 moeda (concede XP)
     Vigília Eterna: ganhos após 10 min são reduzidos por vigFactor() e o crédito final tem teto (ECO.VIG_CAP).
     Desafio do Dia e anúncios são pagos à parte (valores fixos, fora dos multiplicadores). */
  const finiteNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const clampN = (v, a, b) => Math.min(b, Math.max(a, finiteNum(v, a)));
  const coinBonus = () =>
    clampN(
      (rtHas("u2_tithe") ? 0.2 : 0) +
      (rtHas("k_grace") ? 0.1 : 0) +
      clampN(G && G.mods ? G.mods.greed : 0, 0, ECO.BOLSA_MAX),
      0,
      ECO.COIN_BONUS_MAX,
    );
  const coinMul = () => 1 + coinBonus(); // runas + Bolsa da Provisão (aditivo)
  const mapCoinMul = () =>
    clampN(RUN && RUN.coin != null ? RUN.coin : 1, 1, ECO.MAP_COIN_MAX);
  const runCoinMul = () => coinMul() * mapCoinMul(); // máximo 1,8 × 1,75 = 3,15
  /* fator temporal da Vigília: 1 até 10:00, cai linearmente até 0,25 aos 30:00 e fica lá */
  function vigFactor(t) {
    const x = clampN((finiteNum(t) - ECO.VIG_FULL_S) / ECO.VIG_RAMP_S, 0, 1);
    return Math.max(ECO.VIG_MIN, 1 - (1 - ECO.VIG_MIN) * x);
  }
  const ecoSrc = () => ({ n: 0, raw: 0, eff: 0 });
  const ecoNew = () => ({
    drop: ecoSrc(),
    harvest: ecoSrc(),
    offer: ecoSrc(),
    skip: { n: 0, coins: 0, xp: 0 },
    vigMin: 1,
  });
  /* concede moedas-base de uma fonte (kind: drop | harvest | offer); devolve o valor efetivo (após o fator da Vigília) */
  function ecoGain(kind, base) {
    const g = G;
    if (!g) return 0;
    base = Math.max(0, finiteNum(base));
    const f = g.inf ? vigFactor(g.t) : 1,
      eff = base * f,
      e = g.eco || (g.eco = ecoNew()),
      s = e[kind];
    s.n++;
    s.raw += base;
    s.eff += eff;
    if (f < e.vigMin) e.vigMin = f;
    if (kind === "offer") g.offerCoins = finiteNum(g.offerCoins) + eff;
    else g.coins = finiteNum(g.coins) + eff;
    return eff;
  }
  /* Colheita: sorteio individual por abate (sempre consome o RNG, para não desalinhar o Desafio do Dia) + limite por partida */
  function harvestTick() {
    const g = G,
      ch = g && g.mods ? finiteNum(g.mods.harvest) : 0;
    if (!ch) return;
    const roll = rng(),
      e = g.eco || (g.eco = ecoNew());
    if (roll < ch && e.harvest.raw + 1 <= ECO.HARVEST_CAP) ecoGain("harvest", 1);
  }
  /* moedas da partida antes do teto da Vigília */
  function runCoinsRaw(g = G) {
    if (!g) return 0;
    const v = finiteNum(g.coins) * runCoinMul() + finiteNum(g.offerCoins);
    return Math.max(0, Math.round(v));
  }
  /* moedas efetivamente creditadas no fim da partida (HUD, tela final, saldo, perfil e telemetria usam SOMENTE isto) */
  function runCoins(g = G) {
    const v = runCoinsRaw(g);
    return g && g.inf ? Math.min(v, ECO.VIG_CAP) : v;
  }
  /* Desafio do Dia: 30 + 70 (vitória) + 10 por dia consecutivo após o primeiro (máx. +50) */
  function dailyBonus(streak, won) {
    const steps = clampN(
      Math.floor(finiteNum(streak)) - 1,
      0,
      ECO.DAILY_STREAK_MAX_STEPS,
    );
    return (
      ECO.DAILY_BASE +
      (won ? ECO.DAILY_WIN : 0) +
      steps * ECO.DAILY_STREAK_STEP
    );
  }
  function ecoReport(g = G) {
    const e = (g && g.eco) || ecoNew(),
      r3 = (v) => Math.round(finiteNum(v) * 1000) / 1000,
      pre = runCoinsRaw(g),
      cred = runCoins(g);
    return {
      version: 1,
      coinsFromEnemies: { n: e.drop.n, base: r3(e.drop.raw), baseAfterTime: r3(e.drop.eff) },
      coinsFromHarvest: { n: e.harvest.n, base: r3(e.harvest.raw), baseAfterTime: r3(e.harvest.eff), cap: ECO.HARVEST_CAP },
      coinsFromOffer: { n: e.offer.n, base: r3(e.offer.raw), afterTime: r3(e.offer.eff) },
      coinsFromSkip: 0,
      skipXp: Math.round(finiteNum(e.skip.xp) * 100) / 100,
      skipsUsed: e.skip.n,
      runeMultiplier: r3(coinMul()),
      mapMultiplier: r3(mapCoinMul()),
      vigilFactorAtEnd: g && g.inf ? r3(vigFactor(g.t)) : 1,
      vigilFactorMin: r3(e.vigMin),
      coinsBeforeLimit: pre,
      coinsCredited: cred,
      vigilCapApplied: !!(g && g.inf && pre > cred),
      adCoins: finiteNum(g && g.dblPaid),
      dailyBonus: finiteNum(g && g.dailyBonus),
      totalGranted: cred + finiteNum(g && g.dblPaid) + finiteNum(g && g.dailyBonus),
    };
  }
  // efeitos de atributos: recalculados a cada partida (recalc). Campos que o motor usa como gancho ficam em m.
  function shopMods(m) {
    const h = rtHas;
    /* Salvação base do herói: Fortaleza e Vigor escalam com ela (+20% / +15%) */
    const baseHp = (G && G.hero && G.hero.hp) || 100;
    m.dmg *= h("k_blade") ? 1.1 : 1;
    m.crit =
      (h("k_crit") ? 0.06 : 0) + (G && G.hero ? Number(G.hero.crit) || 0 : 0);
    m.critMul = h("k_crit") ? 2.5 : 2;
    m.rage = h("k_wrath") ? 0.15 : 0;
    if (h("k_fort")) m.maxhp += Math.round(baseHp * 0.2);
    m.thorns = h("k_thorn") ? 4 : m.thorns || 0;
    if (h("k_mercy")) m.regen = m.regen ? Math.min(m.regen, 8) : 8;
    if (h("k_ascend")) m.spd *= 1.08;
    if (h("k_pilgrim")) {
      m.spd *= 1.03;
      m.pickup *= 1.2;
    }
    if (h("k_grace")) m.xp *= 1.1;
    m.exec = h("a1_exec") ? 0.2 : 0;
    if (h("a1_tempo")) m.cd *= 0.92;
    m.kbBonus = h("a2_kb") ? 1.4 : 1;
    m.killHeal = h("a3_sede") ? 1 : 0;
    m.guil = h("a3_guil") ? 0.05 : 0;
    if (h("d1_block")) m.block += 0.07;
    m.dr = h("d1_dr") ? 3 : 0;
    m.invT = h("d2_refuge") ? 1.0 : 0;
    if (h("d2_vigor")) m.maxhp += Math.round(baseHp * 0.15);
    m.divCd = h("d3_divine") ? 30 : 0;
    m.aura = h("d3_aura") ? 2 : 0;
    if (h("u1_magnet")) m.pickup *= 1.15;
    if (h("u1_wisdom")) m.xp *= 1.1;
    if (h("u2_swift")) m.spd *= 1.06;
    m.acc = h("u3_acc");
    m.harvest = h("u3_harvest") ? ECO.HARVEST_CHANCE : 0;
    heroMods(m);
    // Patch 0.3: teto de empilhamento. Runas, dons e heróis não multiplicam XP acima de ×2,0 nem dano acima de ×3,0 do valor base do herói.
    const hb = G.hero;
    if (hb && hb.xp) m.xp = hb.xp * Math.min(2, m.xp / hb.xp);
    if (hb && hb.dmg) m.dmg = hb.dmg * Math.min(3, m.dmg / hb.dmg);
  }
  // migração única: as melhorias antigas (níveis comprados) voltam como moedas
  if (!save.rt) {
    let refund = 0;
    for (const x of LEGACY_SHOP) {
      const L = slv(x[0]);
      for (let l = 0; l < L; l++) refund += Math.round(x[3] * (1 + 0.4 * l));
    }
    save.rt = {};
    if (refund) {
      save.coins += refund;
      save.rtMsg = refund;
    }
    try {
      persist();
    } catch (e) { }
  }
  const _sf = statsFor;
  statsFor = function (id, l) {
    const s = _sf(id, l),
      a =
        1 +
        (rtHas("a2_area") ? 0.1 : 0) +
        ((HX[selHero] && HX[selHero].area) || 0);
    for (const k of ["radius", "range", "maxr", "r"]) if (s[k]) s[k] *= a;
    return s;
  };
  const wN = (g) => (g.W ? Object.keys(g.W).length : 0),
    pN = (g) => (g.P ? Object.keys(g.P).length : 0),
    wIdx = () => (RUN && RUN.world ? WORLDS.indexOf(RUN.world) : 0);
  /* [id, nome, descrição, condição(g partida, s save), pontos no Google Play Games] */
  /* Conquistas: nome, descrição e recompensa ficam em registry.js → achievements. Aqui só as regras (funções). */
  /* Helpers dos Testemunhos (leem o save; Runas do Reino ficam em save.rt = {ramo:{slot:id}}, 4 slots por ramo) */
  const rtCount = (s) =>
    Object.values(s.rt || {}).reduce((n, c) => n + Object.keys(c || {}).length, 0),
    rtFull = (s) =>
      Object.values(s.rt || {}).filter((c) => Object.keys(c || {}).length >= 4).length,
    coinsEarned = (s) =>
      Math.max((s.cst && s.cst.s) || 0, (s.prof && s.prof.st && s.prof.st.coins) || 0),
    treeMastered = (g) =>
      !!(g.slingTree && g.slingTree.tier >= 1) ||
      [g.weaponTrees, g.passiveTrees, g.activeTrees].some(
        (o) => o && Object.values(o).some((t) => t && t.tier >= 1),
      );
  const ACH_RULES = {
    k25: (g) => (g.kills || 0) >= 25,
    k100: (g) => (g.kills || 0) >= 100,
    k300: (g) => (g.kills || 0) >= 300,
    k500: (g) => (g.kills || 0) >= 500,
    k1000: (g) => (g.kills || 0) >= 1000,
    k2000: (g) => (g.kills || 0) >= 2000,
    t1: (g) => (g.t || 0) >= 60,
    t3: (g) => (g.t || 0) >= 180,
    t5: (g) => (g.t || 0) >= 300,
    t8: (g) => (g.t || 0) >= 480,
    t10: (g) => (g.t || 0) >= 600,
    vig15: (g) => !!g.inf && (g.t || 0) >= 900,
    vig20: (g) => !!g.inf && (g.t || 0) >= 1200,
    b1: (g) => (g.bossIdx || 0) >= 1,
    b2: (g) => (g.bossIdx || 0) >= 2,
    b3: (g) => (g.bossIdx || 0) >= 3,
    b4: (g) => (g.bossIdx || 0) >= 4,
    b5: (g) => (g.bossIdx || 0) >= 5,
    l10: (g) => (g.lvl || 0) >= 10,
    l20: (g) => (g.lvl || 0) >= 20,
    l30: (g) => (g.lvl || 0) >= 30,
    w4: (g) => wN(g) >= 4,
    p4: (g) => pN(g) >= 4,
    /* Amanhecer limita a 2 habilidades ativas; só a Vigília (3) permitia o antigo "3 habilidades". Agora: encher o limite do modo. */
    a3: (g) => !!g.A && g.A.length >= Math.min(3, activeSkillLimit(g)),
    wmax: (g) => !!g.W && Object.keys(g.W).some((k) => g.W[k].lvl >= MAXW),
    ark: (g) => (g.arks || 0) >= 1,
    tree: (g) => treeMastered(g),
    evo1: (g) => !!g.evo && Object.keys(g.evo).length >= 1,
    h1: (g, s) => Object.keys(s.unl || {}).length >= 1,
    h3: (g, s) => Object.keys(s.unl || {}).length >= 3,
    h5: (g, s) => Object.keys(s.unl || {}).length >= FE_CONTENT.lockedHeroIds.length,
    whero3: (g, s) => Object.keys(s.winH || {}).length >= 3,
    mast: (g, s) => Object.values(s.mast || {}).filter((v) => v >= 600).length >= 6,
    ww2: (g) => wIdx() >= 1 && (g.t || 0) >= 180,
    ww3: (g) => !!g.won && wIdx() >= 2,
    d1: (g, s) => !!(s.daily && s.daily.last),
    d3: (g, s) => !!(s.daily && s.daily.streak >= 3),
    d7: (g, s) => !!(s.daily && s.daily.streak >= 7),
    c1: (g, s) => rtCount(s) >= 1,
    c10: (g, s) => rtFull(s) >= 1,
    c100: (g, s) => coinsEarned(s) >= 10000,
    c1000: (g, s) => (s.coins || 0) >= 1000,
    cmax: (g, s) => rtFull(s) >= 3,
    rev: (g) => !!g.revived,
    prova: (g) => ((g.P && g.P.provacao) || 0) >= passiveMaxLevel("provacao") && (g.t || 0) >= 300,
    fast: (g) => wN(g) === 1 && (g.t || 0) >= 300,
    nodmg: (g) => (g.t || 0) >= 120 && !g.dmgTaken,
    mend: (g) => g.hk === "mendigo" && (g.t || 0) >= 180,
    r25: (g, s) => (s.runs || 0) >= 25,
    r100: (g, s) => (s.runs || 0) >= 100,
  };
  const ACH = FE_CONTENT.achievements.entries.map((a) => {
    if (!ACH_RULES[a.id]) console.warn("[Content] Conquista sem regra: " + a.id);
    return [
      a.id,
      a.name,
      String(a.desc || "").replace("{n}", FE_CONTENT.lockedHeroIds.length),
      ACH_RULES[a.id] || (() => false),
      a.reward,
    ];
  });

  const ACH_HEAD = FE_CONTENT.achievements.sections; /* registry.js → achievements.sections */

  function checkAch() {
    if (TUT.on) return;
    const g = G || {};
    for (const a of ACH)
      if (!save.ach[a[0]]) {
        let ok = false;
        try {
          ok = a[3](g, save);
        } catch (e) { }
        if (ok) {
          save.ach[a[0]] = 1;
          persist();
          achPop(a);
          PGS.unlock(a[0]);
          /* b1/b2 liberam Deserto de Sur / Vale da Sombra na hora (sem reiniciar) */
          try {
            for (const k in WORLD_ACH)
              if (WORLD_ACH[k][0] === a[0]) {
                const wi = WORLDS.findIndex((w) => w.key === k);
                if (wi > 0) {
                  wLbl();
                  notify("Mundo liberado: " + WORLDS[wi].n + "!", "ok");
                }
              }
          } catch (e) { }
        }
      }
  }
  const popQ = [];
  let popOn = 0;
  function achPop(a) {
    popQ.push(a);
    if (!popOn) nextPop();
  }
  function nextPop() {
    const a = popQ.shift();
    if (!a) {
      popOn = 0;
      return;
    }
    popOn = 1;
    const d = document.createElement("div");
    d.className = "ach" + (state !== "play" ? " low" : "");
    d.innerHTML =
      "<small>" +
      (a.h || "TESTEMUNHO ALCANÇADO") +
      "</small><b>" +
      a[1] +
      "</b><span>" +
      a[2] +
      "</span>";
    gameEl.appendChild(d);
    SFX.play("level");
    setTimeout(() => {
      d.remove();
      nextPop();
    }, 3400);
  }
  setInterval(() => {
    if (state === "play") checkAch();
  }, 1000);

  // Sempre começa no topo ao abrir uma tela ou painel.
  function resetScrollTree(root) {
    if (!root) return;

    const reset = () => {
      root.scrollTop = 0;
      root.scrollLeft = 0;

      root.querySelectorAll("*").forEach((el) => {
        if (el.scrollTop) el.scrollTop = 0;
        if (el.scrollLeft) el.scrollLeft = 0;
      });
    };

    // Corrige imediatamente e também após a renderização do navegador.
    reset();
    requestAnimationFrame(reset);
    setTimeout(reset, 60);
  }

  const SCR = document.createElement("div");
  SCR.className = "ov subscreen";
  SCR.hidden = true;
  SCR.innerHTML =
    '<div class="ov-in subscreen-panel"><h2 id="sT"></h2><div id="sB"></div><button class="mb back-btn" id="sBack" type="button" aria-label="Voltar"><span class="pxchev" aria-hidden="true"></span></button></div>';
  gameEl.appendChild(SCR);
  /* CSS moved to style.css: shared modal, rows, tooltips and achievements. */
  function scr(t, fn) {
    $("#sT").textContent = t;

    const body = $("#sB");

    // Limpa estilos e classes específicas da tela anterior.
    body.removeAttribute("style");
    body.classList.remove("mode-grid");

    // Renderiza a tela atual.
    fn(body);

    const wasOpen = !SCR.hidden;
    SCR.hidden = false;
    resetScrollTree(SCR);
    if (wasOpen) {
      const p = SCR.firstElementChild;
      p.classList.remove("swap");
      void p.offsetWidth;
      p.classList.add("swap");
    }
  }
  $("#sBack").onclick = () => {
    SCR.hidden = true;
    refreshMeta();
  };
  function renderShop(b) {
    b.innerHTML = "";
    if (save.rtMsg) {
      notify("Tesouros antigos convertidos: +" + save.rtMsg + " moedas.", "ok");
      delete save.rtMsg;
      persist();
    }
    const top = document.createElement("div");
    top.className = "rw";
    top.innerHTML =
      "<span>Moedas: <b>" +
      save.coins +
      '</b></span><span class="adslot"></span>';
    b.appendChild(top);
    {
      const left = AD_COIN_MAX - adGoldUsed(),
        bt = document.createElement("button");
      bt.type = "button";
      bt.className = "mb adcoin";
      bt.innerHTML =
        left > 0
          ? '<span class="uic i-play"></span> +' +
          AD_COIN +
          " grátis <em>" +
          left +
          "/" +
          AD_COIN_MAX +
          "</em>"
          : "Grátis amanhã";
      if (left <= 0) bt.style.opacity = 0.55;
      bt.onclick = () => {
        if (adGoldUsed() >= AD_COIN_MAX)
          return deny(
            bt,
            "Você já usou os " +
            AD_COIN_MAX +
            " anúncios de hoje. Volte amanhã!",
          );
        ADS.rewarded((ok) => {
          if (!ok) return;
          adGoldUsed();
          save.adg.n++;
          save.coins += AD_COIN;
          persist();
          SFX.play("coin");
          notify("+" + AD_COIN + " moedas!", "ok");
          renderShop(b);
        });
      };
      top.querySelector(".adslot").appendChild(bt);
    }
    const info = document.createElement("div");
    info.className = "rw rt-info";
    const total = Object.keys(RT_CAT).reduce((a, c) => a + rtPicks(c), 0);
    info.innerHTML =
      "<span>Runas escolhidas <b>" +
      total +
      "/12</b><small>Cada ramo tem uma pedra-chave e três níveis. Você escolhe uma runa por degrau; cada nível só abre depois do anterior. Trocar uma runa custa de novo.</small></span>";
    b.appendChild(info);
    const grid = document.createElement("div");
    grid.className = "rt-grid";
    for (const cat of Object.keys(RT_CAT)) grid.appendChild(rtColumn(cat, b));
    b.appendChild(grid);
    b.appendChild(rtDetail(b));
  }
  function rtColumn(cat, b) {
    const C = RT_CAT[cat],
      col = document.createElement("div");
    col.className = "rt-col";
    col.style.setProperty("--rc", C.color);
    col.innerHTML =
      '<div class="rt-head"><span class="rt-ic">' +
      rtIcon(C.icon, cat) +
      "</span><b>" +
      C.title +
      "</b><small>" +
      rtPicks(cat) +
      "/4 escolhidas</small></div>";
    for (const slot of ["key", "t1", "t2", "t3"]) {
      const unl = rtUnlocked(cat, slot),
        row = document.createElement("div");
      row.className = "rt-row" + (unl ? "" : " lk");
      const lbl = document.createElement("div");
      lbl.className = "rt-lbl";
      lbl.textContent = RT_LBL[slot] + (unl ? "" : " · bloqueado");
      row.appendChild(lbl);
      const nodes = document.createElement("div");
      nodes.className = "rt-nodes";
      for (const o of C[slot]) {
        const on = ((save.rt || {})[cat] || {})[slot] === o[0],
          n = document.createElement("button");
        n.type = "button";
        n.className = "rt-node" + (on ? " on" : "") + (unl ? "" : " lk");
        n.title = o[1];
        n.innerHTML = rtIcon(o[3], o[0]);
        const cur = runeSel && runeSel.id === o[0];
        if (cur) n.classList.add("sel");
        if (!on && ((save.rt || {})[cat] || {})[slot]) n.classList.add("dim");
        n.onclick = () => {
          runeSel = { cat, slot, id: o[0] };
          renderShop(b);
        };
        nodes.appendChild(n);
      }
      row.appendChild(nodes);
      col.appendChild(row);
    }
    if (cat === "util") col.appendChild(renderChoiceToolUpgrades(b));
    const rs = document.createElement("button");
    rs.type = "button";
    rs.className = "rt-respec";
    rs.textContent = "Refazer ramo · " + RT_RESPEC;
    rs.onclick = () => rtRespec(cat, b);
    if (!rtPicks(cat)) rs.disabled = true;
    col.appendChild(rs);
    return col;
  }
  function rtDetail(b) {
    const box = document.createElement("div");
    box.className = "rt-detail";
    if (!runeSel) {
      box.innerHTML =
        '<span class="rt-hint">Toque em uma runa para ver o efeito, o custo e o que ela exige.</span>';
      return box;
    }
    const C = RT_CAT[runeSel.cat],
      o = rtFind(runeSel.cat, runeSel.slot, runeSel.id);
    if (!o) return box;
    const cur = ((save.rt || {})[runeSel.cat] || {})[runeSel.slot],
      on = cur === o[0],
      unl = rtUnlocked(runeSel.cat, runeSel.slot),
      cost = RT_COST[runeSel.slot];
    const need = RT_NEED[runeSel.slot];
    let status = on
      ? "Equipada neste ramo."
      : !unl
        ? "Exige " +
        (need === 1 ? "a pedra-chave" : need + " escolhas anteriores") +
        " do ramo " +
        C.title +
        "."
        : cur
          ? "Substitui a runa atual deste nível: " +
          (rtFind(runeSel.cat, runeSel.slot, cur) || [0, "?"])[1] +
          "."
          : "Disponível.";
    box.style.setProperty("--rc", C.color);
    box.innerHTML =
      '<span class="rt-big">' +
      rtIcon(o[3], o[0]) +
      '</span><div class="rt-txt"><b>' +
      o[1] +
      "</b><small>" +
      C.title +
      " · " +
      RT_LBL[runeSel.slot] +
      "</small><p>" +
      o[2] +
      '</p><small class="rt-st">' +
      status +
      "</small></div>";
    const bt = document.createElement("button");
    bt.type = "button";
    bt.className = "mb rt-act";
    if (on) {
      bt.textContent = "Equipada ✓";
      bt.disabled = true;
    } else if (!unl) {
      bt.textContent = "Bloqueada";
      bt.disabled = true;
    } else {
      bt.textContent = (cur ? "Trocar" : "Escolher") + " · " + cost;
      bt.onclick = () => rtPick(runeSel.cat, runeSel.slot, o[0], b);
    }
    box.appendChild(bt);
    return box;
  }
  function rtPick(cat, slot, id, b) {
    const o = rtFind(cat, slot, id),
      cost = RT_COST[slot];
    if (!rtUnlocked(cat, slot))
      return notify("Esse nível ainda está bloqueado.", "warn");
    if (save.coins < cost)
      return notify(
        "Faltam " + (cost - save.coins) + " moedas para essa runa.",
        "warn",
      );
    save.coins -= cost;
    save.rt[cat] = save.rt[cat] || {};
    save.rt[cat][slot] = id;
    save.shop.rt = 1;
    persist();
    SFX.play("coin");
    checkAch();
    notify(o[1] + " escolhida!", "ok");
    renderShop(b);
  }
  function rtRespec(cat, b) {
    if (!rtPicks(cat)) return;
    if (save.coins < RT_RESPEC)
      return notify("Refazer o ramo custa " + RT_RESPEC + " moedas.", "warn");
    if (!rtRespec.armed || rtRespec.armed !== cat) {
      rtRespec.armed = cat;
      return notify('Toque de novo em "Refazer ramo" para confirmar.', "warn");
    }
    rtRespec.armed = null;
    save.coins -= RT_RESPEC;
    save.rt[cat] = {};
    if (runeSel && runeSel.cat === cat) runeSel = null;
    persist();
    SFX.play("coin");
    notify("Ramo " + RT_CAT[cat].title + " refeito.", "ok");
    renderShop(b);
  }
  /* Ícones dos Testemunhos: moldura hexagonal + glifo por conquista [glifo, cor]. Bloqueado = tudo cinza (CSS). */
  const ACH_GLYPHS = Object.assign({}, RT_ICONS, {
    skull:
      '<path d="M5 12a7 7 0 0 1 14 0v3l-2 1v3H7v-3l-2-1z"/><circle cx="9.5" cy="12" r="1.2"/><circle cx="14.5" cy="12" r="1.2"/>',
    crown: '<path d="M4 18h16M4 18L3 7l5 4 4-6 4 6 5-4-1 11z"/>',
    branch: '<path d="M12 21V10M12 14l-5-4M12 12l5-4M7 10V6M17 8V4"/>',
    ark: '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M4 13h16M9 9V6h6v3"/>',
    calendar:
      '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M9 15l2 2 4-4"/>',
    trophy:
      '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 13v4M8 20h8M10 17h4"/>',
    moon: '<path d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z"/>',
    group:
      '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2 20c0-3 3-5 6-5s6 2 6 5M14 15c3 0 8 1 8 5"/>',
  });
  const ACH_COL = {
    atk: "#ff7a59",
    time: "#6fc3ff",
    vig: "#b39bff",
    boss: "#ff9a4d",
    lvl: "#ffd86b",
    build: "#5fe0a8",
    hero: "#f2c14e",
    world: "#f0a742",
    day: "#7fe3d6",
    gold: "#ffd45a",
    chal: "#ff86b0",
    trip: "#9fb8ff",
  };
  const ACH_ICON = {
    k25: ["sword", ACH_COL.atk], k100: ["target", ACH_COL.atk], k300: ["flame", ACH_COL.atk],
    k500: ["bolt", ACH_COL.atk], k1000: ["group", ACH_COL.atk], k2000: ["wing", ACH_COL.atk],
    t1: ["hourglass", ACH_COL.time], t3: ["hourglass", ACH_COL.time], t5: ["hourglass", ACH_COL.time],
    t8: ["moon", ACH_COL.time], t10: ["sun", ACH_COL.time],
    vig15: ["moon", ACH_COL.vig], vig20: ["eye", ACH_COL.vig],
    b1: ["group", ACH_COL.boss], b2: ["wind", ACH_COL.boss], b3: ["wing", ACH_COL.boss],
    b4: ["drop", ACH_COL.boss], b5: ["flame", ACH_COL.boss],
    l10: ["star", ACH_COL.lvl], l20: ["halo", ACH_COL.lvl], l30: ["sun", ACH_COL.lvl],
    w4: ["stack", ACH_COL.build], p4: ["armor", ACH_COL.build], a3: ["bolt", ACH_COL.build],
    wmax: ["sword", ACH_COL.build], ark: ["ark", ACH_COL.build], tree: ["branch", ACH_COL.build],
    evo1: ["thorn", ACH_COL.build],
    h1: ["halo", ACH_COL.hero], h3: ["group", ACH_COL.hero], h5: ["crown", ACH_COL.hero],
    whero3: ["trophy", ACH_COL.hero], mast: ["target", ACH_COL.hero],
    ww2: ["boot", ACH_COL.world], ww3: ["sun", ACH_COL.world],
    d1: ["calendar", ACH_COL.day], d3: ["wheat", ACH_COL.day], d7: ["sun", ACH_COL.day],
    c1: ["coin", ACH_COL.gold], c10: ["scroll", ACH_COL.gold], c100: ["wheat", ACH_COL.gold],
    c1000: ["star", ACH_COL.gold], cmax: ["stack", ACH_COL.gold],
    rev: ["heart", ACH_COL.chal], prova: ["cross", ACH_COL.chal], fast: ["dove", ACH_COL.chal],
    nodmg: ["shield", ACH_COL.chal], mend: ["staff", ACH_COL.chal],
    r25: ["boot", ACH_COL.trip], r100: ["trophy", ACH_COL.trip],
  };
  /* Imagens opcionais: assets/icons/ach/<id>.png (id = k25, t1, b1, vig15...). Faltou o arquivo? Fica o glifo desenhado acima.
     Para apontar outro arquivo: ASSET_MANIFEST.ach = { k25: "icons/ach/primeiro.png" }. assetReport() lista o que carregou/faltou. */
  const ACH_IMG_DIR = "icons/ach/"; /* relativo a ASSET_DIR (assets/) */
  const ACH_IMG = {}; /* id -> url carregada | false (arquivo não existe) | null (pedida, aguardando) */
  const achImgUrl = (id) =>
    (ASSET_MANIFEST.ach && ASSET_MANIFEST.ach[id]) || ACH_IMG_DIR + id + ".png";
  function achImgApply(id) {
    const url = ACH_IMG[id];
    if (!url) return;
    document
      .querySelectorAll('.ach-hex[data-id="' + id + '"]')
      .forEach((h) => {
        const im = h.querySelector(".ach-img");
        if (im.getAttribute("src") !== url) im.src = url;
        h.classList.add("has-img");
      });
  }
  function achImgLoad(id) {
    if (id in ACH_IMG) return;
    ACH_IMG[id] = null;
    const u = achImgUrl(id),
      im = new Image();
    im.onload = () => {
      ACH_IMG[id] = ASSET_DIR + u;
      ASSET_LOG.ok.push(u);
      achImgApply(id);
    };
    im.onerror = () => {
      ACH_IMG[id] = false;
      ASSET_LOG.miss.push(u);
    };
    im.src = ASSET_DIR + u;
  }
  setTimeout(() => ACH.forEach((a) => achImgLoad(a[0])), 1500);
  /* A estrutura da linha vive em index.html (<template id="achRowTpl">) e o visual em style.css (seção Testemunhos). */
  function achRow(a, ok) {
    const tpl = document.getElementById("achRowTpl");
    if (!tpl) {
      console.warn("[Testemunhos] <template id=\"achRowTpl\"> ausente em index.html");
      const r = document.createElement("div");
      r.className = "rw " + (ok ? "ok" : "lk");
      r.textContent = a[1] + " — " + a[2];
      return r;
    }
    const row = tpl.content.firstElementChild.cloneNode(true),
      [gl, col] = ACH_ICON[a[0]] || ["star", "#ffd86b"],
      hex = row.querySelector(".ach-hex");
    row.classList.add(ok ? "ok" : "lk");
    hex.dataset.id = a[0];
    hex.style.setProperty("--c", col);
    row.querySelector(".ach-glyph").innerHTML = ACH_GLYPHS[gl] || ACH_GLYPHS.star;
    row.querySelector(".ach-name").textContent = a[1];
    row.querySelector(".ach-desc").textContent = a[2];
    row.querySelector(".ach-state .uic").classList.add("i-" + (ok ? "check" : "lock"));
    return row;
  }
  function renderAch(b) {
    let n = 0;
    b.innerHTML = "";
    ACH.forEach((a) => {
      const ok = save.ach[a[0]];
      if (ok) n++;
      if (ACH_HEAD[a[0]]) {
        const h = document.createElement("div");
        h.className = "hdg";
        h.textContent = ACH_HEAD[a[0]];
        b.appendChild(h);
      }
      b.appendChild(achRow(a, ok));
      if (ACH_IMG[a[0]]) achImgApply(a[0]);
      else achImgLoad(a[0]);
    });
    b.insertAdjacentHTML(
      "afterbegin",
      '<div class="rw"><span>Testemunhos <b>' +
      n +
      "/" +
      ACH.length +
      '</b></span><span id="achGp"></span></div>',
    );
    if (window.FePGS) {
      const gb = document.createElement("button");
      gb.type = "button";
      gb.className = "mb";
      gb.textContent = "Google Play Games";
      gb.onclick = () =>
        FePGS.showAch().then((ok) => {
          if (!ok)
            notify(
              "Entre no Google Play Games para ver as conquistas.",
              "warn",
            );
        });
      b.querySelector("#achGp").appendChild(gb);
    }
  }
  /* controles pixel art das Configurações (menu e pausa): chave ON/OFF e slider com barra segmentada */
  function pxToggleSet(bt, on) {
    bt.setAttribute("aria-checked", on ? "true" : "false");
    bt.firstChild.textContent = on ? "ON" : "OFF";
  }
  function pxToggle(on, label) {
    const bt = document.createElement("button");
    bt.type = "button";
    bt.className = "pxtoggle";
    bt.setAttribute("role", "switch");
    if (label) bt.setAttribute("aria-label", label);
    bt.innerHTML =
      '<span class="pxt-lbl"></span><i class="pxt-knob" aria-hidden="true"></i>';
    pxToggleSet(bt, on);
    return bt;
  }
  function pxRange(el) {
    const f = () =>
      el.style.setProperty(
        "--p",
        ((el.value - el.min) / (el.max - el.min || 1)) * 100 + "%",
      );
    f();
    el.addEventListener("input", f);
    return el;
  }
  function renderSet(b) {
    const T = (l, k) => {
      const d = document.createElement("div");
      d.className = "rw";
      d.innerHTML = "<span>" + l + "</span>";
      const bt = pxToggle(!!save.set[k], (l.split("<")[0] || k).trim());
      bt.onclick = () => {
        save.set[k] = save.set[k] ? 0 : 1;
        if (k === "sound") {
          SFX.on = !!save.set.sound;
          if (!SFX.on) {
            try {
              wxStopRain();
            } catch (e) { }
          }
        }
        if (k === "music") musApply();
        if (k === "sysfont") applyFont();
        if (k === "showfps") syncFpsHud();
        if (k === "fx" && !save.set.fx) {
          try {
            wxReset();
          } catch (e) { }
        }
        persist();
        if (k === "fx") renderSet(b);
        else pxToggleSet(bt, !!save.set[k]);
      };
      d.appendChild(bt);
      return d;
    };
    b.innerHTML = "";
    const R = (l, k, cb) => {
      const d = document.createElement("div");
      d.className = "rw";
      d.innerHTML =
        "<span>" +
        l +
        " <b>" +
        Math.round(save.set[k] * 100) +
        '%</b></span><input type="range" min="0" max="100" value="' +
        Math.round(save.set[k] * 100) +
        '" class="setting-range">';
      pxRange(d.querySelector("input")).oninput = (e) => {
        save.set[k] = e.target.value / 100;
        d.querySelector("b").textContent = e.target.value + "%";
        cb && cb();
        persist();
      };
      return d;
    };
    b.appendChild(R("Música", "mvol", musApply));
    const v = document.createElement("div");
    v.className = "rw";
    v.innerHTML =
      "<span>SFX <b>" +
      Math.round(save.set.vol * 100) +
      '%</b></span><input type="range" min="0" max="100" value="' +
      Math.round(save.set.vol * 100) +
      '" class="setting-range">';
    pxRange(v.querySelector("input")).oninput = (e) => {
      save.set.vol = e.target.value / 100;
      SFX.vol = save.set.vol;
      if (SFX._m) SFX._m.gain.value = SFX.vol;
      try {
        wxSyncRainVol();
      } catch (e) { }
      v.querySelector("b").textContent = e.target.value + "%";
      persist();
    };
    v.querySelector("input").onchange = () => SFX.play("coin");
    b.appendChild(v);
    b.appendChild(T("Pausa automática", "auto"));
    if (state === "menu")
      b.appendChild(
        T(
          "Fonte sem serifa<small>Troca a fonte do jogo pela Inter, sans-serif mais legível em textos pequenos</small>",
          "sysfont",
        ),
      );
    if (state === "menu") {
      const d = document.createElement("div");
      d.className = "rw";
      d.innerHTML =
        "<span>Tutorial<small>Reveja a partida de introdução. Nada é salvo.</small></span>";
      const tb = document.createElement("button");
      tb.type = "button";
      tb.className = "mb";
      tb.textContent = "JOGAR";
      tb.onclick = () => TUT.start(false);
      d.appendChild(tb);
      b.appendChild(d);
    }
    {
      const d = document.createElement("div");
      d.className = "rw";
      d.innerHTML =
        "<span>Ataque<small>" +
        (isTouch
          ? "Manual: esquerda move, direita mira e atira"
          : "Manual: mire com o mouse e clique (segure para repetir)") +
        "</small></span>";
      const bt = document.createElement("button");
      bt.className = "mb";
      bt.textContent = atkLbl();
      bt.onclick = () => {
        toggleAtk();
        renderSet(b);
      };
      d.appendChild(bt);
      b.appendChild(d);
    }
    b.appendChild(
      T(
        "Efeitos visuais<small>Tremor, neblina, flashes e partículas</small>",
        "fx",
      ),
    );
    /* Neblina: só na pausa; mínimo 30%; desabilitada se Efeitos visuais OFF (fogPass já depende de fx) */
    if (state === "paused") {
      const fogVal = clamp(save.set.fog == null ? 1 : save.set.fog, 0.3, 1);
      const fogOn = !!save.set.fx;
      const fogRow = document.createElement("div");
      fogRow.className = "rw" + (fogOn ? "" : " is-disabled");
      fogRow.innerHTML =
        "<span>Neblina<small>" +
        (fogOn
          ? "Mínimo 30% (chefe e Hora Final)"
          : "Ative Efeitos visuais para ajustar") +
        "</small> <b>" +
        Math.round(fogVal * 100) +
        '%</b></span><input type="range" min="30" max="100" value="' +
        Math.round(fogVal * 100) +
        '" class="setting-range"' +
        (fogOn ? "" : " disabled") +
        ">";
      pxRange(fogRow.querySelector("input"));
      if (fogOn)
        fogRow.querySelector("input").oninput = (e) => {
          save.set.fog = Math.max(0.3, e.target.value / 100);
          fogRow.querySelector("b").textContent =
            Math.round(save.set.fog * 100) + "%";
          persist();
        };
      b.appendChild(fogRow);
    }
    {
      const f = document.createElement("div");
      f.className = "rw";
      f.innerHTML =
        "<span>Limite de FPS<small>Ajuda em celulares e PCs fracos</small></span>";
      const FP = [0, 60, 45, 30],
        bt = document.createElement("button");
      bt.className = "mb";
      bt.textContent = save.set.fps ? save.set.fps + " FPS" : "SEM LIMITE";
      bt.onclick = () => {
        save.set.fps = FP[(FP.indexOf(save.set.fps || 0) + 1) % FP.length];
        persist();
        renderSet(b);
      };
      f.appendChild(bt);
      b.appendChild(f);
    }
    b.appendChild(
      T(
        "Mostrar FPS<small>Contador de quadros por segundo na tela de jogo</small>",
        "showfps",
      ),
    );
    {
      const d = document.createElement("div");
      d.className = "rw";
      d.innerHTML =
        "<span>Como jogar<small>Controles e objetivo</small></span>";
      const hb = document.createElement("button");
      hb.type = "button";
      hb.className = "mb";
      hb.textContent = "ABRIR";
      hb.onclick = () => showHelp();
      d.appendChild(hb);
      b.appendChild(d);
    }
    if (state === "menu") {
      const l = document.createElement("div");
      l.className = "set-links";
      l.innerHTML =
        '<button type="button" id="lnkSup">Suporte ou feedback</button><button type="button" id="lnkPriv">Política de privacidade</button><button type="button" id="lnkRate">Avaliar o jogo</button>';
      b.appendChild(l);
      l.querySelector("#lnkSup").onclick = () =>
        openExt("mailto:" + SUPPORT_EMAIL);
      l.querySelector("#lnkPriv").onclick = () => openExt(PRIVACY_URL);
      l.querySelector("#lnkRate").onclick = () =>
        openExt(
          IS_NATIVE
            ? "market://details?id=" + PLAY_APP_ID
            : "https://play.google.com/store/apps/details?id=" + PLAY_APP_ID,
        );
    }
    {
      const d = document.createElement("div");
      d.className = "settings-footer";
      d.innerHTML = "<span>Fé Survivor v" + APP_VER + "</span>";
      if (state === "menu") {
        const r = document.createElement("button");
        r.type = "button";
        r.textContent = "Apagar progresso";
        r.className = "progress-reset";
        let t = 0;
        r.onclick = () => {
          if (!t) {
            r.textContent =
              "Toque de novo para apagar o progresso (compras são mantidas)";
            r.classList.add("is-confirming");
            t = setTimeout(() => {
              t = 0;
              if (r.isConnected) {
                r.textContent = "Apagar progresso";
                r.classList.remove("is-confirming");
              }
            }, 3500);
            return;
          }
          clearTimeout(t);
          wipeProgress();
        };
        d.appendChild(r);
      }
      b.appendChild(d);
    }
  }
  $("#playBtn").insertAdjacentHTML(
    "afterend",
    '<div class="menu-actions"><button class="mb" id="mHero"></button><button class="mb" id="mShop">Tesouros do Reino</button><button class="mb" id="mAch">Testemunhos</button><button class="mb" id="mRank">Ranking</button><button class="mb" id="mSet">Configurações</button></div>',
  );
  $("#mShop").onclick = () => scr("Tesouros do Reino", renderShop);
  $("#mAch").onclick = () => scr("Testemunhos", renderAch);
  $("#mSet").onclick = () => scr("Configurações", renderSet);
  $("#mSet").insertAdjacentHTML(
    "beforebegin",
    '<button style="display:none;" class="mb" id="mBalanceData" type="button">Dados de Balanceamento</button>',
  );
  $("#mBalanceData").onclick = () => BTL.openScreen();
  $("#mRank").onclick = () => scr("Ranking", renderRank);
  const _oldRank = () =>
    scr("Ranking", (b) => {
      b.innerHTML =
        '<div class="rw"><span>O ranking online (Tempo, Abates, Nível) chega em uma próxima atualização.<small>Seu melhor tempo: ' +
        (save.best ? fmt(save.best) : "—") +
        "</small></span></div>";
    });

  const RUN = { spawn: 1, coin: 1 };
  function goRun() {
    RUN.daily = null;
    RUN.world = curW();
    RUN.coin = RUN.world.coin;
    RUN.spawn = RUN.world.spawn;
    SCR.hidden = true;
    startRun();
    toast("Resista às trevas!");
  }
  // Arredondamento estocástico mantém o total médio esperado e evita que pequenos multiplicadores
  // sejam sempre perdidos (por exemplo, +25% sobre um evento que gera apenas um elite).
  function scaledEventCount(base) {
    const factor =
      (Number.isFinite(RUN.spawn) ? Math.max(0, RUN.spawn) : 1) *
      (1 + ((G && G.mods && G.mods.curse) || 0));
    const amount = Math.max(0, base) * factor;
    const whole = Math.floor(amount),
      fraction = amount - whole;
    const count = whole + (fraction > 0 && rng() < fraction ? 1 : 0);
    return base > 0 ? Math.max(1, count) : 0;
  }
  /* ================= ASSETS (opcionais) =================
     Coloque os PNG nas pastas e o jogo os encontra sozinho pelo nome. O que faltar continua sendo desenhado pelo código.
       assets/ui/<nome>.png        play help gear trophy book globe bag star calendar door redo flag check lock store coin rate pause left right close
       assets/icons/<id>.png       ícones de armas, dons, habilidades ativas, heal, coins
       assets/icons/ach/<id>.png   ícones dos Testemunhos (k25, t1, b1, vig15...; PNG quadrado, enquadrado em hexágono pelo CSS)
       assets/sprites/<nome>.png   itens, projéteis, inimigos, chefes, cross, dove_0/1
       assets/sprites/<heroi>_0.png e _1.png   (davi paulo debora sansao ester elias mendigo; só _0 serve para os dois quadros)
     ASSET_MANIFEST abaixo é opcional: use para apontar um arquivo com outro nome (ex.: sprites: { imp: 'sprites/diabo.png', 'hero.davi.0': 'sprites/pastor.png' }).
     No console (modo debug), assetReport() mostra o que foi carregado e o que usou o desenho do código. */
  const ASSET_DIR = "assets/",
    ASSET_AUTO = true;
  const ASSET_MANIFEST = {
    sprites: {},
    icons: {},
    ach: {} /* opcional: { k25: 'icons/ach/outro.png' } */,
    ui: {},
    loading: {} /* opcional: { scenes: [{ video: 'loading/a.mp4', image: 'loading/a.png' }, …] } */,
    modes: {} /* opcional: { dawn: 'modes/amanhecer.jpg', vigil: '...', upcoming: '...' } */,
    sfx: {},
    music: {
      menu: ["music/music_menus.mp3", "music/music_menus_2.mp3"],
      run: ["music/run.mp3", "music/run_2.mp3"],
      boss: ["music/boss.mp3", "music/boss_2.mp3"],
    },
  };
  const ASSET_LOG = { ok: [], miss: [] },
    BOOT = { total: 0, done: 0 };
  function fromImg(im) {
    const c = mk(im.width, im.height, (g) => {
      g.imageSmoothingEnabled = false;
      g.drawImage(im, 0, 0);
    });
    const f = mk(c.width, c.height, (g) => {
      g.drawImage(c, 0, 0);
      g.globalCompositeOperation = "source-in";
      g.fillStyle = "#fff";
      g.fillRect(0, 0, c.width, c.height);
    });
    return { c, f, w: c.width, h: c.height };
  }
  function loadImg(u, ok, miss) {
    BOOT.total++;
    const im = new Image();
    im.onload = () => {
      BOOT.done++;
      ASSET_LOG.ok.push(u);
      try {
        ok(im);
      } catch (e) {
        console.warn("[assets] erro ao aplicar", u, e);
      }
    };
    im.onerror = () => {
      BOOT.done++;
      ASSET_LOG.miss.push(u);
      if (miss) miss();
    };
    im.src = ASSET_DIR + u;
  }
  const BOSS_IDS = BOSS_DEFS.map((b) => b.id);
  const BOSS_SPR_IDS = BOSS_DEFS.map((b) => b.spr);
  const SPR_IDS = Array.from(
    new Set(
      [
        "f1",
        "f2",
        "f3",
        "coin",
        "bread",
        "mana",
        "fire",
        "shield",
        "ark",
        "cross",
        "stone",
        "eshot",
        "eshotr",
      ].concat(
        Object.values(ET)
          .map((e) => e.spr)
          .filter(Boolean),
        BOSS_SPR_IDS,
      ),
    ),
  );
  const HERO_IDS = FE_CONTENT.externalSpriteHeroIds.slice();
  const HERO_FILE = {},
    DOVE_FILE = [0, 0],
    ICON_FILE = new Set();
  let uiT = 0;
  const uiCssSoon = () => {
    clearTimeout(uiT);
    uiT = setTimeout(() => uiCss(), 30);
  };
  /* ícones que o código desenha a partir de sprites: refazer se o sprite vier de arquivo */
  function dropDerivedIcons() {
    for (const id of ["shield", "dove", "fire", "grace", "heal", "coins"])
      if (!ICON_FILE.has(id)) delete ICONS[id];
  }
  /* a cruz do título tem tamanho livre (o desenho em código tem 7x10 dentro de uma moldura de 1 px) */
  function drawCross() {
    const cv = $("#crossCv"),
      sp = S.cross;
    if (!cv || !sp) return;
    const a = !!sp.asset,
      w = a ? sp.w : 7,
      h = a ? sp.h : 10;
    cv.width = w;
    cv.height = h;
    const g = cv.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, w, h);
    g.drawImage(sp.c, a ? 0 : 1, a ? 0 : 1, w, h, 0, 0, w, h);
  }
  function setSprite(k, im) {
    const sp = fromImg(im);
    sp.asset = true;
    const p = k.split(".");
    if (BOSS_SPR_IDS.indexOf(k) >= 0)
      sp.hd = true; /* chefes são desenhados no tamanho do arquivo */
    if (p[0] === "hero") {
      const id = p[1],
        i = +p[2];
      if (!S.hero || !S.hero[id]) return;
      const F = HERO_FILE[id] || (HERO_FILE[id] = [0, 0]);
      S.hero[id][i] = sp;
      F[i] = 1;
      if (!F[1 - i]) S.hero[id][1 - i] = sp;
    } else if (p[0] === "dove") {
      const i = +p[1];
      S.dove[i] = sp;
      DOVE_FILE[i] = 1;
      if (!DOVE_FILE[1 - i]) S.dove[1 - i] = sp;
    } else {
      S[k] = sp;
      if (k === "shield") S.shieldI = sp;
      if (k === "shieldI") S.shield = sp;
    }
    dropDerivedIcons();
    if (k === "cross") drawCross();
  }
  function loadAssets() {
    const spr = {},
      ico = {},
      ui = {};
    if (ASSET_AUTO) {
      SPR_IDS.forEach((n) => (spr[n] = "sprites/" + n + ".png"));
      spr["dove.0"] = "sprites/dove_0.png";
      spr["dove.1"] = "sprites/dove_1.png";
      HERO_IDS.forEach((h) => {
        spr["hero." + h + ".0"] = "sprites/" + h + "_0.png";
        spr["hero." + h + ".1"] = "sprites/" + h + "_1.png";
      });
      Object.keys(ICON_DRAW).forEach((n) => (ico[n] = "icons/" + n + ".png"));
      for (const n of new Set(
        [].concat(
          Object.keys(WEAPONS),
          Object.keys(PASSIVES),
          Object.keys(ACT),
        ),
      ))
        if (!ico[n]) ico[n] = "icons/" + n + ".png";
      Object.keys(UI_M).forEach((n) => (ui[n] = "ui/" + n + ".png"));
    }
    Object.assign(spr, ASSET_MANIFEST.sprites);
    Object.assign(ico, ASSET_MANIFEST.icons);
    Object.assign(ui, ASSET_MANIFEST.ui);
    for (const k in spr) loadImg(spr[k], (im) => setSprite(k, im));
    for (const k in ico)
      loadImg(ico[k], (im) => {
        ICON_FILE.add(k);
        ICONS[k] = im.src;
        ICON_IMG[k] = im;
        for (const ek in EVOLUTION_ICONS)
          if (ek.indexOf(k + ":") === 0) delete EVOLUTION_ICONS[ek];
      });
    for (const k in ui)
      loadImg(ui[k], (im) => {
        UI_URL[k] = im.src;
        uiCssSoon();
      });
  }
  window.assetReport = () => {
    console.log(
      "Carregados (" + ASSET_LOG.ok.length + "):",
      ASSET_LOG.ok.join(", "),
    );
    console.log(
      "Não encontrados, usando o desenho do código (" +
      ASSET_LOG.miss.length +
      "):",
      ASSET_LOG.miss.join(", "),
    );
  };
  const SFXF = {};
  for (const k in ASSET_MANIFEST.sfx) {
    const a = new Audio(ASSET_DIR + ASSET_MANIFEST.sfx[k]);
    a.preload = "auto";
    a.addEventListener(
      "canplaythrough",
      () => {
        SFXF[k] = () => {
          const c = a.cloneNode();
          c.volume = Math.min(1, SFX.vol);
          const pr = SFX._pj || 1;
          if (pr !== 1) {
            c.playbackRate = pr;
            c.preservesPitch = c.mozPreservesPitch = c.webkitPreservesPitch = false;
          }
          c.play().catch(() => { });
        };
      },
      { once: true },
    );
  }
  const MUSA = {};
  let musCur = null,
    musTrk = null,
    nxMusicDuck = 1;
  const musLast = {};
  const nxMusMul = (a) => (a._f == null ? 1 : a._f) * nxMusicDuck;
  function nxMusIn(a) {
    if (!a) return;
    a._f = 0;
    try {
      a.volume = 0;
    } catch (e) { }
    nxFade(a, 1, 900);
  }
  function nxMusOut(a) {
    if (!a) return;
    nxFade(a, 0, 600, () => {
      try {
        a.pause();
      } catch (e) { }
      a._f = 1;
    });
  }
  for (const k in ASSET_MANIFEST.music)
    MUSA[k] = ASSET_MANIFEST.music[k].map((f) => {
      const a = new Audio(ASSET_DIR + f);
      a.loop = false;
      a.preload = "auto";
      a.addEventListener("ended", () => {
        if (musTrk === a) musNext();
      });
      a.addEventListener("error", () =>
        console.warn("[music] não encontrado:", ASSET_DIR + f),
      );
      return a;
    });
  function musApply() {
    const a = musTrk;
    if (!a) return;
    a.volume = clamp(save.set.mvol * nxMusMul(a), 0, 1);
    if (save.set.music && !ADS.busy && !document.hidden) {
      const p = a.play();
      if (p && p.catch) p.catch(() => { });
    } else a.pause();
  }
  /* sorteia uma das faixas da categoria (nunca repete a anterior, se houver 2+) e toca até acabar; ao fim sorteia outra */
  function musNext() {
    const L = MUSA[musCur] || [];
    if (musTrk) nxMusOut(musTrk);
    if (!L.length) {
      musTrk = null;
      return;
    }
    let c = L.filter((a) => a !== musLast[musCur]);
    if (!c.length) c = L;
    musTrk = pick(c);
    musLast[musCur] = musTrk;
    try {
      musTrk.currentTime = 0;
    } catch (e) { }
    musApply();
    nxMusIn(musTrk);
  }
  function musSet(n) {
    if (n === musCur) return;
    musCur = n;
    musNext();
  }
  const musWant = () => nxMusWant();
  setInterval(() => musSet(musWant()), 250);
  ["pointerdown", "touchstart", "keydown"].forEach((ev) =>
    addEventListener(ev, musApply, { passive: true }),
  ); /* se o navegador bloquear o autoplay, o 1º toque inicia */
  document.addEventListener("visibilitychange", musApply);

  /* ================= Heróis: atributos, Graça pessoal e Maestria ================= */
  const HX = FE_CONTENT.heroProfiles;
  for (const k of FE_CONTENT.lockedHeroIds)
    Object.defineProperty(HX[k], "locked", {
      get: () => !save.unl[k],
      configurable: true,
      enumerable: true,
    });
  const MT = FE_CONTENT.masteryTiers.thresholds,
    MQ = FE_CONTENT.masteryTiers.labels; /* registry.js → masteryTiers */
  const mlv = (k) => 1 + MT.filter((t) => (save.mast[k] || 0) >= t).length;
  function applyHeroContentEffect(mods, effect) {
    if (!effect || effect.behavior === "none") return;
    switch (effect.behavior) {
      case "add":
        mods[effect.key] = (Number(mods[effect.key]) || 0) + effect.value;
        break;
      case "multiply":
        mods[effect.key] *= effect.value;
        break;
      case "set":
        mods[effect.key] = effect.value;
        break;
      case "regen_cap":
        mods.regen = mods.regen
          ? Math.min(mods.regen, effect.value)
          : effect.value;
        break;
      case "block_add_capped":
        mods.block = Math.min(effect.cap, (mods.block || 0) + effect.value);
        break;
      default:
        throw new Error(
          "[Content] Unsupported hero effect behavior: " + effect.behavior,
        );
    }
  }
  function heroMods(m) {
    const X = HX[selHero];
    if (!X || X.locked) return;
    m.kbm = 1;
    if (X.grace) applyHeroContentEffect(m, X.grace.effect);
    for (let i = 0; i < mlv(selHero) - 1; i++)
      if (X.perks[i]) applyHeroContentEffect(m, X.perks[i][2]);
  }
  let viewHero = null;
  function updHeroBtn() {
    $("#mHero").textContent = "Herói: " + HEROES[selHero].name;
  }
  /* Retrato: colorido se liberado; silhueta preta fixa se bloqueado (sem data-hero → animação do menu não sobrescreve) */
  /* reveal: herói bloqueado mostrado com o sprite original e animado (usado na Loja); sem reveal vira silhueta preta */
  function heroCardPortrait(k, locked, reveal) {
    const wrap = document.createElement("div");
    wrap.className =
      "hero-portrait-wrap" +
      (locked ? (reveal ? " is-preview" : " is-locked") : "");
    const sp = S.hero[k] && S.hero[k][0];
    if (sp) {
      const c = document.createElement("canvas");
      c.width = sp.w;
      c.height = sp.h;
      c.className = "hero-portrait";
      if (!locked || reveal)
        c.dataset.hero = k; /* animar liberados e os revelados na Loja */
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.drawImage(sp.c, 0, 0);
      if (locked && !reveal) {
        /* silhueta sólida preta a partir do alpha do sprite */
        g.globalCompositeOperation = "source-in";
        g.fillStyle = "#0a0818";
        g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = "source-over";
      }
      wrap.appendChild(c);
    }
    if (locked) {
      const lk = document.createElement("span");
      lk.className = "uic i-lock hero-lock-badge";
      lk.setAttribute("aria-hidden", "true");
      wrap.appendChild(lk);
    }
    return wrap;
  }
  function renderHeroes(b) {
    const v = viewHero && HX[viewHero] ? viewHero : selHero;
    viewHero = v;
    const X = HX[v],
      H = X.locked ? X : HEROES[v];
    b.innerHTML = "";
    const row = document.createElement("div");
    row.className = "hero-list";
    for (const k in HX) {
      const x = HX[k],
        d = document.createElement("button");
      d.className =
        "hero" + (k === v ? " sel" : "") + (x.locked ? " locked" : "");
      d.appendChild(heroCardPortrait(k, !!x.locked));
      d.insertAdjacentHTML(
        "beforeend",
        "<h3>" +
        x.name +
        '</h3><div class="role">' +
        (x.locked
          ? "Bloqueado"
          : k === selHero
            ? '<span class="uic i-check"></span> Escolhido'
            : "&nbsp;") +
        "</div>",
      );
      d.onclick = () => {
        viewHero = k;
        if (!x.locked) {
          selHero = k;
          save.hero = k;
          persist();
          updHeroBtn();
        }
        renderHeroes(b);
      };
      row.appendChild(d);
    }
    b.appendChild(row);
    const cl = (n) => Math.max(1, Math.min(5, n)),
      sg = (n, u) => (n ? (n > 0 ? "+" : "−") + Math.abs(n) + u : "—");
    const dh = H.hp - 10 * HPS,
      dp = Math.round((H.spd - 60) / 0.6),
      dd = Math.round(((H.dmg || 1) - 1) * 100),
      dx = Math.round(((H.xp || 1) - 1) * 100);
    const bar = (l, val, f) =>
      '<div class="hero-stat-row"><span class="hero-stat-label">' +
      l +
      '</span><span class="bar">' +
      [1, 2, 3, 4, 5]
        .map((i) => '<i class="' + (i <= f ? "on" : "") + '"></i>')
        .join("") +
      '</span><b class="hero-stat-value ' +
      (val[0] === "−" ? "is-negative" : "is-positive") +
      '">' +
      val +
      "</b></div>";
    const h = (t) => '<div class="hero-section-title">' + t + "</div>";
    let o =
      '<div class="hero-detail-header"><b class="hero-detail-name">' +
      X.name +
      '</b><span class="hero-detail-role">' +
      (X.locked
        ? '<span class="uic i-lock"></span> ' + H.role
        : H.role + (X.ch ? "" : " · Maestria Nv " + mlv(v))) +
      "</span></div>" +
      h("ATRIBUTOS") +
      bar("Salvação", sg(dh, ""), cl(3 + Math.round(dh / (1.5 * HPS)))) +
      bar("Poder", sg(dd, "%"), cl(3 + Math.round(dd / 10))) +
      bar("Passo", sg(dp, "%"), cl(3 + Math.round(dp / 6))) +
      bar("Sabedoria", sg(dx, "%"), cl(3 + Math.round(dx / 10))) +
      bar(
        "Alcance",
        String(HRNG[v] || 90),
        cl(Math.round((HRNG[v] || 90) / 35)),
      ) +
      (H.attackSpeed
        ? bar(
          "Velocidade de ataque",
          "+" + Math.round((H.attackSpeed - 1) * 100) + "%",
          4,
        )
        : "") +
      (H.crit ? bar("Crítico", Math.round(H.crit * 100) + "%", 3) : "") +
      (H.luck ? bar("Sorte", Math.round(H.luck * 100) + "%", 3) : "");
    if (X.locked)
      o +=
        h("ARMA INICIAL") +
        "<div>" +
        H.start +
        "</div>" +
        h("GRAÇA") +
        "<div>" +
        H.gr +
        "</div>" +
        h("COMO DESBLOQUEAR") +
        '<b class="hero-gold">' +
        H.quest +
        '</b><div class="hero-hint">Desbloqueie na Loja.</div>';
    else {
      const l = mlv(v),
        nx = l < 4 ? X.perks[l - 1] : null;
      o +=
        h("ARMA INICIAL") +
        '<div><img class="hero-weapon-icon" alt="" src="' +
        iconURL(H.start) +
        '"> ' +
        WEAPONS[H.start].name +
        '</div><div class="hero-bonus">Bônus: ' +
        H.bonus +
        "</div>" +
        h("GRAÇA PESSOAL") +
        (X.grace
          ? "<b>" +
          X.grace.n +
          '</b><div class="hero-muted">' +
          X.grace.d +
          "</div>"
          : '<b>NENHUMA</b><div class="hero-muted">Sem passiva, escudo ou cura. Desafio para experientes.</div>') +
        h("MAESTRIA") +
        (X.ch
          ? '<b class="hero-blood">SEM MAESTRIA</b><div class="hero-muted">Sem bônus de classe.</div>'
          : nx
            ? '<b class="hero-gold">PRÓXIMA M' +
            (l + 1) +
            " · " +
            nx[0].toUpperCase() +
            '</b><div class="hero-muted">' +
            nx[1] +
            " — " +
            MQ[l - 1] +
            " com " +
            X.name +
            "</div>"
            : '<b class="hero-gold">MAESTRIA MÁXIMA</b>');
    }
    const p = document.createElement("div");
    p.className = "rw hero-details";
    p.innerHTML = o;
    b.appendChild(p);
  }
  /* Static CSS moved to style.css. */
  $("#heroes").hidden = true;
  $("#menu .sub").hidden = true;
  $("#menu .meta:last-child").hidden = true;
  $("#mHero").onclick = () => scr("Escolha seu herói", renderHeroes);
  $("#menuBtn").insertAdjacentHTML(
    "afterend",
    '<button id="setBtn" class="mb" type="button">Configurações</button><button id="evoBtn" class="mb" type="button">Evoluções de Armas</button>',
  );
  $("#setBtn").onclick = () => scr("Configurações", renderSet);
  $("#evoBtn").onclick = () => scr("Evoluções de Armas", renderEvoGlossary);

  /* ================= v0.8: confirmação ao reiniciar ou sair para o menu durante a partida ================= */
  let okQuit = false,
    cfKind = null;
  function askQuit(kind) {
    const n = G ? runCoins() : 0;
    $("#cfT").textContent = "Sair da partida?";
    $("#cfP").innerHTML =
      "Você guarda as <b>" +
      n +
      " moedas</b> ganhas, mas perde o progresso desta partida.";
    $("#cfYes").textContent = "Sim, sair";
    $("#cfNo").textContent = "Continuar jogando";
    cfKind = kind;
    $("#confirm").hidden = false;
    $("#cfNo").focus();
  }
  function closeQuit() {
    $("#confirm").hidden = true;
    cfKind = null;
    const r = $("#resumeBtn");
    if (r) r.focus({ preventScroll: true });
  }
  [["#menuBtn", "menu"]].forEach(([sel, kind]) =>
    $(sel).addEventListener(
      "click",
      (e) => {
        if (okQuit) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        askQuit(kind);
      },
      true,
    ),
  );
  $("#cfNo").addEventListener("click", closeQuit);
  $("#cfYes").addEventListener("click", () => {
    const k = cfKind;
    $("#confirm").hidden = true;
    cfKind = null;
    okQuit = true;
    try {
      /* sair pela pausa sempre guarda as moedas da partida */
      if (G && !G.over && (state === "paused" || state === "play")) {
        const gained = runCoins();
        endRun(false, true, true);
        if (gained > 0) notify("+" + gained + " moedas guardadas");
      }
      $("#menuBtn").click();
    } finally {
      okQuit = false;
    }
  });
  addEventListener(
    "keydown",
    (e) => {
      if ($("#confirm").hidden) return;
      const k = e.key.toLowerCase();
      if (k === "escape" || k === "p") closeQuit();
      if (k !== "tab" && k !== "enter" && k !== " ") {
        e.stopImmediatePropagation();
        e.preventDefault();
      } else if (k === "tab") {
        e.preventDefault();
        (document.activeElement === $("#cfNo")
          ? $("#cfYes")
          : $("#cfNo")
        ).focus();
      }
      e.stopImmediatePropagation();
    },
    true,
  );

  /* ================= v0.5: novos heróis, armas, desbloqueio, reset de debug ================= */

  /* ================= v0.6: mundos e Desafio do Dia ================= */
  const WORLDS = FE_CONTENT.worlds.map((w) => Object.assign({}, w)); /* registry.js → worlds */

  save.world = save.world || 0;
  save.daily = save.daily || { date: "", best: 0, streak: 0, last: "" };
  save.iap = save.iap || {};
  save.iapTok = save.iapTok || [];
  /* Migração única: quem já tinha liberado os mundos pelo tempo de sobrevivência (3:00 e 6:00) mantém o acesso.
     Para NÃO dar esse presente aos jogadores atuais, mude GRANDFATHER_WORLDS para false. */
  const GRANDFATHER_WORLDS = true,
    LEGACY_WORLD_NEED = [0, 180, 360];
  if (!save.iapMig) {
    save.iapMig = 1;
    if (GRANDFATHER_WORLDS)
      WORLDS.forEach((w, i) => {
        if (w.key && (save.best || 0) >= LEGACY_WORLD_NEED[i])
          save.iap[w.key] = 1;
      });
    persist();
  }
  /* Acesso gratuito aos mundos por conquistas existentes (não criam compra em save.iap, não dependem do Google Play Games):
     Deserto de Sur ← "Leviatã Vencido" (b4, derrote o 4º chefe) · Vale da Sombra ← "Dragão Vencido" (b5, derrote o chefe final).
     Na bateria de 60 partidas (Davi no Vale de Elá): Leviatã caiu em 38% das partidas e o Dragão em 25% (Legião 94%, Belzebu 81%).
     Para ajustar a dificuldade basta trocar o id da conquista aqui. A compra (save.iap) continua liberando o mundo. Elá é sempre aberto. */
  const WORLD_ACH = { world1: ["b4", "Leviatã"], world2: ["b5", "O Dragão"] };
  const achDone = (id) => !!(save.ach && save.ach[id]);
  const worldOwned = (i) =>
    !!(WORLDS[i] && WORLDS[i].key && save.iap[WORLDS[i].key]);
  const worldByAch = (i) => {
    const w = WORLDS[i],
      a = w && w.key && WORLD_ACH[w.key];
    return !!(a && achDone(a[0]));
  };
  function worldHint(i) {
    const w = WORLDS[i],
      a = w && w.key && WORLD_ACH[w.key];
    if (!a) return "";
    const row = ACH.find((x) => x[0] === a[0]);
    return (
      'DESBLOQUEIO GRATUITO: Conquiste "' +
      (row ? row[1] : a[0]) +
      '" derrotando ' +
      a[1] +
      "."
    );
  }
  const wOpen = (i) =>
    !!WORLDS[i] && (!WORLDS[i].key || worldOwned(i) || worldByAch(i)),
    curW = () => WORLDS[wOpen(save.world) ? save.world : 0],
    _mr0 = Math.random;
  const mul = (a) => () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const dk = (d) =>
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0");
  const spDate = () =>
    new Date(
      Date.now() - 10800000,
    ) /* America/Sao_Paulo = UTC-3 (sem horário de verão desde 2019) */,
    dayKey = () => {
      const d = spDate();
      return (
        d.getUTCFullYear() +
        "-" +
        String(d.getUTCMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getUTCDate()).padStart(2, "0")
      );
    },
    yday = (k) => {
      const [y, m, d] = k.split("-").map(Number);
      return dk(new Date(y, m - 1, d - 1));
    };
  const daySeed = (k) => {
    let h = 2166136261;
    for (const c of k) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return h >>> 0;
  };
  function dailyCfg() {
    const k = dayKey(),
      seed = daySeed(k),
      q = mul(seed),
      hs = Object.keys(HEROES).filter((h) => !(HX[h] && HX[h].locked));
    return {
      k,
      seed,
      hero: hs[Math.floor(q() * hs.length)],
      world: Math.floor(q() * WORLDS.length),
    };
  }
  const _se = spawnEnemy;
  spawnEnemy = function () {
    const e = _se.apply(null, arguments),
      w = RUN.world;
    if (e && w && e.t !== "boss") {
      e.hp *= w.hp;
      e.mhp *= w.hp;
      e.spd *= w.spd;
    }
    return e;
  };
  const _dg = drawGround;
  drawGround = function () {
    _dg();
    const w = state === "menu" || !RUN.world ? curW() : RUN.world;
    if (w.tint) {
      ctx.fillStyle = w.tint;
      ctx.fillRect(0, 0, VW, VH);
    }
  };
  function startDaily() {
    const c = dailyCfg(),
      w = WORLDS[c.world];
    RUN.daily = c;
    RUN.daily.prev = save.hero;
    RUN.world = w;
    RUN.coin = w.coin;
    RUN.spawn = w.spawn;
    selHero = c.hero;
    _rg = mul(c.seed);
    SCR.hidden = true;
    startRun();
    toast("Desafio do Dia · " + HEROES[c.hero].name + " · " + w.n);
  }
  function leaveDaily() {
    if (RUN.daily) {
      selHero = save.hero = RUN.daily.prev;
      persist();
      _rg = _mr0;
    }
  }
  const _er = endRun;
  endRun = function (won, ret) {
    const g = G,
      d = RUN.daily;
    if (!g || g.over) return _er(won, ret);
    _er(won, ret);
    wLbl();
    if (!d) return;
    const sc = Math.round(g.kills * 5 + g.t * 3 + (won ? 1000 : 0)),
      D = save.daily,
      newDay = D.date !== d.k,
      /* só a 1ª partida CONCLUÍDA do dia vale: abandonar (ret) não paga nem avança a sequência */
      claim = !ret && D.last !== d.k;
    if (newDay) {
      D.date = d.k;
      D.best = 0;
    }
    if (claim) {
      D.streak = D.last === yday(d.k) ? D.streak + 1 : 1;
      D.last = d.k;
    }
    const nb = sc > D.best;
    if (nb) D.best = sc;
    const bonus = claim ? dailyBonus(D.streak, !!won) : 0;
    if (bonus) {
      save.coins += bonus;
      g.dailyBonus = bonus;
      BTL.patchEconomy({ dailyBonus: bonus });
    }
    persist();
    refreshMeta();
    leaveDaily();
    wLbl();
    checkAch();
    $("#endSum").insertAdjacentHTML(
      "beforeend",
      "<div><b>" +
      sc +
      "</b>Pontos do dia" +
      (nb ? '<br><span class="newrec">MELHOR DO DIA</span>' : "") +
      "</div>" +
      (bonus
        ? "<div><b>+" + bonus + "</b>Bônus · sequência " + D.streak + "</div>"
        : ""),
    );
  };
  ["#againBtn"].forEach((s) =>
    $(s).addEventListener(
      "click",
      () => {
        if (RUN.daily) {
          selHero = RUN.daily.hero;
          _rg = mul(RUN.daily.seed);
        } else _rg = _mr0;
      },
      true,
    ),
  );
  ["#menuBtn", "#endMenuBtn"].forEach((s) =>
    $(s).addEventListener("click", leaveDaily, true),
  );
  $("#mSet").insertAdjacentHTML(
    "beforebegin",
    '<button class="mb" id="mWorld"></button><button class="mb" id="mDaily"></button>',
  );
  const infUnlocked = () => !!(save.winH && Object.keys(save.winH).length);
  function wLbl() {
    $("#mWorld").textContent = "Mundo: " + curW().n;
    $("#mDaily").textContent =
      "Desafio do Dia" +
      (save.daily.last === dayKey() ? " (feito)" : " (novo)");
  }
  wLbl();
  function renderWorlds(b) {
    b.innerHTML = "";
    WORLDS.forEach((w, i) => {
      const ok = wOpen(i),
        d = document.createElement("button");
      d.className = "rw";
      d.classList.add("world-choice");
      if (!ok) d.classList.add("is-locked");
      else if (curW() === w) d.classList.add("is-selected");
      d.innerHTML =
        "<span><b>" +
        (ok ? "" : '<span class="uic i-lock"></span> ') +
        w.n +
        "</b><small>" +
        (ok
          ? w.d
          : worldHint(i) + " Ou compre por " + Billing.priceOf(w.key) + ".") +
        "</small></span>";
      d.onclick = () => {
        if (!ok) {
          buyWorld(i, () => renderWorlds(b));
          return;
        }
        save.world = i;
        persist();
        wLbl();
        renderWorlds(b);
      };
      b.appendChild(d);
    });
  }
  function renderDaily(b) {
    const c = dailyCfg(),
      w = WORLDS[c.world],
      D = save.daily,
      done = D.last === c.k,
      str = D.last === c.k || D.last === yday(c.k) ? D.streak : 0;
    b.innerHTML =
      '<div class="rw"><span><b>Hoje · ' +
      fmtDate(c.k) +
      "</b><small>Herói: " +
      HEROES[c.hero].name +
      "<br>Mundo: " +
      w.n +
      '</small></span></div><div class="rw"><span>Melhor pontuação de hoje <b>' +
      (D.date === c.k ? D.best : "—") +
      "</b><small>Sequência: " +
      str +
      " dia(s) · Bônus: " +
      (done
        ? "já recebido hoje"
        : ECO.DAILY_BASE +
        " moedas (+" +
        ECO.DAILY_WIN +
        " na vitória) + " +
        ECO.DAILY_STREAK_STEP +
        " por dia de sequência") +
      '</small></span></div><div class="rw"><span>Próximo desafio em <b id="dCount">--:--:--</b></span></div>';
    const g = document.createElement("button");
    g.className = "mb daily-action";
    g.textContent = done ? "Jogar de novo" : "Começar desafio";
    g.onclick = startDaily;
    b.appendChild(g);
    dailyTick(b, c.k);
  }
  $("#mWorld").onclick = () => scr("Selecione o Mundo", renderWorlds);
  $("#mDaily").onclick = () => scr("Desafio do Dia", renderDaily);

  /* ================= v0.7: Hora Final, neblina, habilidades ativas, colisão ================= */
  const rage = (g) =>
    !g || g.t < 480 ? 0 : Math.min(g.inf ? 2.2 : 1, (g.t - 480) / 120);
  const _se2 = spawnEnemy;
  spawnEnemy = function () {
    const e = _se2.apply(null, arguments);
    if (e && e.t !== "boss") {
      const f = 1 + 0.5 * rage(G);
      e.hp *= f;
      e.mhp *= f;
    }
    return e;
  };
  const FOG = mk(256, 256, (g) => {
    const q = mul(7);
    for (let i = 0; i < 44; i++) {
      const x = q() * 256,
        y = q() * 256,
        rr = 36 + q() * 56;
      for (const ox of [-256, 0, 256])
        for (const oy of [-256, 0, 256]) {
          const gr = g.createRadialGradient(
            x + ox,
            y + oy,
            0,
            x + ox,
            y + oy,
            rr,
          );
          gr.addColorStop(0, "rgba(105,120,165,.24)");
          gr.addColorStop(1, "rgba(105,120,165,0)");
          g.fillStyle = gr;
          g.fillRect(x + ox - rr, y + oy - rr, rr * 2, rr * 2);
        }
    }
  });
  const NIGHT_A = 0.46,
    NIGHT_FOG = 0.6;
  let FOGC = null;
  const HOLE = mk(320, 320, (g) => {
    const gr = g.createRadialGradient(160, 160, 20, 160, 160, 160);
    gr.addColorStop(0, "rgba(0,0,0,1)");
    gr.addColorStop(0.5, "rgba(0,0,0,.8)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 320, 320);
  });
  function fogPass() {
    const g = G;
    if (!g || !save.set.fx) return;
    const dk = 1 - dawnK();
    if (dk < 0.01) return;
    const cur = g.fog == null ? NIGHT_FOG : g.fog,
      ex = Math.max(g.boss ? 1 : 0, rage(g) * 0.45);
    g.fog = cur + (NIGHT_FOG + (1 - NIGHT_FOG) * ex - cur) * 0.03;
    /* save.set.fog só afeta o desenho (mín. 30% — chefe / Hora Final); g.fog mecânico permanece intacto */
    const fogMul = clamp(save.set.fog == null ? 1 : save.set.fog, 0.3, 1);
    const f = g.fog * dk * fogMul,
      xt = clamp((g.fog - NIGHT_FOG) / (1 - NIGHT_FOG), 0, 1) * fogMul,
      T = g.t + (g.dawn ? g.dawn.t : 0);
    if (!FOGC || FOGC.c.width !== VW || FOGC.c.height !== VH) {
      const c = document.createElement("canvas");
      c.width = VW;
      c.height = VH;
      FOGC = { c, g: c.getContext("2d") };
    }
    const fg = FOGC.g;
    fg.globalCompositeOperation = "source-over";
    fg.globalAlpha = 1;
    fg.clearRect(0, 0, VW, VH);
    fg.fillStyle = nxFogBase() + f * 0.18 + ")";
    fg.fillRect(0, 0, VW, VH);
    for (const [sp, al, par] of [
      [5, 0.75, 0.35],
      [-9, 0.6, 0.55],
      [13, 0.45, 0.8],
    ]) {
      fg.globalAlpha = Math.min(1, f * al);
      const ox = -(((T * sp + camx * par) % 256) + 256) % 256,
        oy = -(((T * sp * 0.4 + camy * par) % 256) + 256) % 256;
      for (let x = ox - 256; x < VW; x += 256)
        for (let y = oy - 256; y < VH; y += 256) fg.drawImage(FOG, x, y);
    }
    fg.globalCompositeOperation = "destination-out";
    fg.globalAlpha = 0.85;
    fg.drawImage(
      HOLE,
      sx(g.p.x) - 160,
      sy(g.p.y) - 160,
    ); /* clareira em volta do herói */
    fg.globalCompositeOperation = "source-over";
    fg.globalAlpha = 1;
    ctx.drawImage(FOGC.c, 0, 0);
    ctx.save();
    if (xt > 0.01) {
      ctx.fillStyle = "rgba(25,0,12," + xt * 0.4 * dk + ")";
      ctx.fillRect(0, 0, VW, VH);
    }
    const gr = ctx.createRadialGradient(
      VW / 2,
      VH / 2,
      VH * 0.25,
      VW / 2,
      VH / 2,
      VW * 0.62,
    );
    gr.addColorStop(0, "rgba(10,0,5,0)");
    gr.addColorStop(1, "rgba(10,0,5," + (0.2 + 0.6 * xt) * dk + ")");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, VW, VH);
    if (g.boss) {
      ctx.fillStyle =
        "rgba(120,0,20," + (0.05 + 0.04 * Math.sin(g.t * 3)) + ")";
      ctx.fillRect(0, 0, VW, VH);
    }
    ctx.restore();
  }
  /* ===== Clima: chuva + vento + trovoadas (todos os mapas) =====
     Respeita save.set.fx (Efeitos visuais). Som de chuva em loop + trovão na claridade. */
  const WX = {
    drops: [],
    splashes: [],
    wind: 0,
    windTarget: 0,
    windT: 0,
    nextWind: 4,
    playerLean: 0,
    nextFlash: 10,
    flash: 0,
    flashDelay: 0,
    rainOn: false,
    rainNodes: null,
    _noise: null,
  };
  function wxActive() {
    return (
      !!(save.set && save.set.fx) &&
      G &&
      (state === "play" ||
        state === "levelup" ||
        state === "paused" ||
        state === "tut")
    );
  }
  function wxMakeNoiseBuf(ctx, sec) {
    const n = Math.max(1, Math.floor(ctx.sampleRate * sec)),
      buf = ctx.createBuffer(1, n, ctx.sampleRate),
      d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function wxStartRain() {
    if (WX.rainOn || !SFX.on) return;
    SFX.init();
    const c = SFX.ctx;
    if (!c) return;
    try {
      if (!WX._noise) WX._noise = wxMakeNoiseBuf(c, 2);
      const src = c.createBufferSource();
      src.buffer = WX._noise;
      src.loop = true;
      const hp = c.createBiquadFilter();
      hp.type = "bandpass";
      hp.frequency.value = 900;
      hp.Q.value = 0.6;
      const g = c.createGain();
      g.gain.value = 0.0001;
      src.connect(hp);
      hp.connect(g);
      g.connect(SFX.mg());
      src.start();
      g.gain.linearRampToValueAtTime(0.045 * SFX.vol, c.currentTime + 0.8);
      WX.rainNodes = { src, g, hp };
      WX.rainOn = true;
    } catch (e) {
      WX.rainOn = false;
      WX.rainNodes = null;
    }
  }
  function wxStopRain() {
    if (!WX.rainOn || !WX.rainNodes) {
      WX.rainOn = false;
      WX.rainNodes = null;
      return;
    }
    try {
      const c = SFX.ctx,
        g = WX.rainNodes.g,
        src = WX.rainNodes.src;
      if (c && g) {
        g.gain.cancelScheduledValues(c.currentTime);
        g.gain.setValueAtTime(g.gain.value, c.currentTime);
        g.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.4);
        setTimeout(() => {
          try {
            src.stop();
          } catch (e) { }
        }, 500);
      } else {
        try {
          src.stop();
        } catch (e) { }
      }
    } catch (e) { }
    WX.rainOn = false;
    WX.rainNodes = null;
  }
  function wxSyncRainVol() {
    if (WX.rainOn && WX.rainNodes && WX.rainNodes.g && SFX.ctx) {
      try {
        WX.rainNodes.g.gain.setTargetAtTime(
          0.045 * SFX.vol,
          SFX.ctx.currentTime,
          0.05,
        );
      } catch (e) { }
    }
  }
  function wxReset() {
    WX.drops.length = 0;
    WX.splashes.length = 0;
    WX.wind = 0;
    WX.windTarget = 0;
    WX.windT = 0;
    WX.nextWind = 3 + Math.random() * 4;
    WX.playerLean = 0;
    WX.nextFlash = 6 + Math.random() * 8;
    WX.flash = 0;
    WX.flashDelay = 0;
    wxStopRain();
  }
  function wxUpdate(dt) {
    if (!wxActive()) {
      wxStopRain();
      WX.drops.length = 0;
      WX.flash = 0;
      return;
    }
    if (state === "play") {
      if (SFX.on) wxStartRain();
      else wxStopRain();
      /* vento ambiente suave + inclinação na direção do movimento do jogador */
      WX.windT += dt;
      if (WX.windT >= WX.nextWind) {
        WX.windT = 0;
        WX.nextWind = 4 + Math.random() * 8;
        WX.windTarget =
          (Math.random() * 2 - 1) * (8 + Math.random() * 14); /* bem suave */
      }
      WX.wind += (WX.windTarget - WX.wind) * Math.min(1, dt * 0.9);
      let moveX = 0;
      if (typeof stick !== "undefined" && stick.on && Math.abs(stick.dx) > 0.12)
        moveX = stick.dx;
      else if (typeof keys !== "undefined") {
        if (keys.a || keys.arrowleft) moveX -= 1;
        if (keys.d || keys.arrowright) moveX += 1;
      }
      if (!moveX && G.p && G.p.moving) moveX = G.p.face || 0;
      const leanTarget =
        Math.max(-1, Math.min(1, moveX)) *
        18; /* inclinação moderada ao andar */
      WX.playerLean += (leanTarget - WX.playerLean) * Math.min(1, dt * 3.5);
      /* relâmpago */
      if (WX.flashDelay > 0) {
        WX.flashDelay -= dt;
        if (WX.flashDelay <= 0) {
          WX.flash = 0.45 + Math.random() * 0.35;
          SFX.play("thunder");
        }
      }
      WX.nextFlash -= dt;
      if (WX.nextFlash <= 0) {
        WX.nextFlash = 7 + Math.random() * 14;
        WX.flash = Math.max(WX.flash, 0.55 + Math.random() * 0.35);
        WX.flashDelay = 0.12 + Math.random() * 0.45;
      }
      WX.flash = Math.max(0, WX.flash - dt * 2.8);
      /* gotas */
      const dens = 4;
      for (let i = 0; i < dens; i++) {
        if (WX.drops.length > 200) break;
        WX.drops.push({
          x: Math.random() * (VW + 40) - 20,
          y: -8 - Math.random() * 30,
          len: 5 + Math.random() * 8,
          spd: 150 + Math.random() * 110,
          a: 0.2 + Math.random() * 0.3,
          groundY:
            VH *
            (0.52 + Math.random() * 0.42) /* onde “bate” no chão da tela */,
        });
      }
      const drift = WX.wind + WX.playerLean;
      for (let i = WX.drops.length - 1; i >= 0; i--) {
        const d = WX.drops[i];
        d.x += drift * dt;
        d.y += d.spd * dt;
        if (d.y >= d.groundY) {
          /* pingo no chão */
          if (WX.splashes.length < 48 && Math.random() < 0.55) {
            WX.splashes.push({
              x: d.x,
              y: d.groundY,
              t: 0,
              life: 0.22 + Math.random() * 0.2,
              r: 2 + Math.random() * 3,
            });
          }
          WX.drops.splice(i, 1);
        } else if (d.x < -40 || d.x > VW + 40) WX.drops.splice(i, 1);
      }
      for (let i = WX.splashes.length - 1; i >= 0; i--) {
        const s = WX.splashes[i];
        s.t += dt;
        if (s.t >= s.life) WX.splashes.splice(i, 1);
      }
    } else {
      /* pausa / levelup: congela gotas, mantém chuva sonora se SFX ligado */
      if (SFX.on) wxStartRain();
      else wxStopRain();
      WX.flash = Math.max(0, WX.flash - dt * 2.8);
    }
  }
  function wxPass() {
    if (!wxActive()) {
      wxStopRain();
      return;
    }
    const g = G;
    if (!g) return;
    if (SFX.on) wxStartRain();
    else wxStopRain();
    /* chuva — inclinação suave (vento + direção do jogador) */
    const lean = WX.wind + WX.playerLean;
    const slant = lean * 0.012; /* ~ ±0.4 px por px de comprimento — natural */
    if (WX.drops.length) {
      ctx.save();
      ctx.strokeStyle = "rgba(180,200,255,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < WX.drops.length; i++) {
        const d = WX.drops[i];
        ctx.globalAlpha = d.a;
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + slant * d.len, d.y + d.len);
      }
      ctx.stroke();
      ctx.restore();
    }
    /* pingos no chão */
    if (WX.splashes.length) {
      ctx.save();
      ctx.lineWidth = 1;
      for (let i = 0; i < WX.splashes.length; i++) {
        const s = WX.splashes[i],
          k = s.t / s.life,
          r = s.r * (0.6 + k * 1.6);
        ctx.globalAlpha = (1 - k) * 0.45;
        ctx.strokeStyle = "rgba(200,220,255,0.9)";
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, r, r * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (k < 0.35) {
          ctx.globalAlpha = (1 - k / 0.35) * 0.5;
          ctx.fillStyle = "rgba(220,235,255,0.8)";
          ctx.fillRect(s.x - 0.5, s.y - 1, 1, 1);
        }
      }
      ctx.restore();
    }
    /* clarão de trovão */
    if (WX.flash > 0.01) {
      ctx.save();
      const a = Math.min(0.72, WX.flash);
      ctx.fillStyle = "rgba(220,235,255," + a + ")";
      ctx.fillRect(0, 0, VW, VH);
      /* segundo flash mais fraco (pisca) */
      if (WX.flash > 0.35 && Math.floor(WX.flash * 20) % 3 === 0) {
        ctx.fillStyle = "rgba(255,255,255," + a * 0.45 + ")";
        ctx.fillRect(0, 0, VW, VH);
      }
      ctx.restore();
    }
  }
  const _dr = draw;
  draw = function () {
    _dr();
    fogPass();
    wxPass();
  };
  const _updWx = typeof update === "function" ? update : null;

  const _updW = update;
  update = function (dt) {
    _updW(dt);
    wxUpdate(dt);
  };
  /* ao ligar/desligar efeitos: limpa clima */
  const _wxFxWatch = true;

  /* colisão do jogador com árvore, arbusto, pedra e cruz (inimigos atravessam) */
  /* habilidades ativas (v0.8): viram cartas sorteadas no início da partida e a cada nível; teclas 1/2/3 usam as que você já tem */
  const MAXA = 5,
    MAX_ACTIVE_STANDARD = 2,
    START_PICK = true;
  const activeSkillLimit = (g) =>
    g && g.inf
      ? INF_ACTIVES
      : g && RUN.mode === "std" && !RUN.daily
        ? MAX_ACTIVE_STANDARD
        : Infinity;
  const canGainActive = (g) =>
    (g && g.A ? g.A.length : 0) < activeSkillLimit(g);
  const activeSkillCountLabel = (g) =>
    "Ativas " +
    (g.A ? g.A.length : 0) +
    (activeSkillLimit(g) === Infinity
      ? " (sem limite)"
      : "/" + activeSkillLimit(g));
  const ACTIVE_BEHAVIOR_HANDLERS = {
    judgment_wave(g, l, id) {
      const ev = g.activeTrees && g.activeTrees[id],
        path = ev && ev.path,
        tier = ev && ev.tier ? 1 : 0;
      const base = {
        wid: id,
        k: "ring",
        x: g.p.x,
        y: g.p.y,
        r: 4,
        maxr: (140 + 15 * (l - 1)) * (g.mods.area || 1),
        dmg: (30 + 3 * g.lvl) * (1 + 0.35 * (l - 1)) * g.mods.dmg,
        knock: 70,
        style: "judg",
        hit: new Set(),
        t: 0,
        life: 0.55 * (g.mods.duration || 1),
        follow: true,
        bossMult: path === "bossbane" ? (tier ? 2.1 : 1.7) : 1,
      };
      if (path === "echo")
        g.fx.push({
          wid: id,
          ...base,
          dmg: base.dmg * (tier ? 0.85 : 0.6),
          knock: 48,
          hit: new Set(),
          t: 0,
          life: 0.55,
          wait: 0.22,
        });
      else g.fx.push(base);
      if (path === "cleansing") {
        g.eshots.length = 0;
        if (tier)
          g.fx.push({
            wid: id,
            ...base,
            maxr: 70,
            dmg: base.dmg * 0.45,
            knock: 45,
            hit: new Set(),
            t: 0,
            life: 0.35,
            wait: 0.12,
          });
      }
      if (path === "echo" && tier)
        g.fx.push({
          wid: id,
          ...base,
          dmg: base.dmg * 0.6,
          knock: 48,
          hit: new Set(),
          t: 0,
          life: 0.55,
          wait: 0.42,
        });
      g.shake = 0.5;
      g.flash = 0.25;
      SFX.play("trumpet");
      if (FXQ())
        g.fx.push({
          k: "pillar",
          x: g.p.x,
          y: g.p.y,
          t: 0,
          life: 0.7,
          follow: true,
        });
      toast(ACT[id].n + "!");
    },
    invulnerability(g, l, id) {
      const ev = g.activeTrees && g.activeTrees[id],
        path = ev && ev.path,
        tier = ev && ev.tier ? 1 : 0,
        seconds = 4 + l + (path === "fortress" ? (tier ? 4 : 2) : 0);
      g.p.sh = Math.max(g.p.sh, seconds);
      if (path === "purge") {
        g.eshots.length = 0;
        for (const e of g.enemies) {
          if (e.dead) continue;
          const dx = e.x - g.p.x,
            dy = e.y - g.p.y,
            d = Math.hypot(dx, dy) || 1;
          if (d < (tier ? 115 : 85))
            hurtBy(id, e, 8 + 2 * l, dx / d, dy / d, 45);
        }
      }
      if (path === "swift")
        g.p.evoSpeedT = Math.max(g.p.evoSpeedT || 0, tier ? 3.5 : 2.2);
      SFX.play("heal");
      if (FXQ())
        g.fx.push({
          k: "domeFlash",
          x: g.p.x,
          y: g.p.y,
          t: 0,
          life: 0.5,
          follow: true,
        });
      toast(ACT[id].n + ": " + seconds + " s invencível");
    },
    healing(g, l, id) {
      const ev = g.activeTrees && g.activeTrees[id],
        path = ev && ev.path,
        tier = ev && ev.tier ? 1 : 0,
        bonus = path === "overflow" ? (tier ? 0.2 : 0.1) : 0;
      healP(Math.ceil(g.mods.maxhp * (0.2 + 0.05 * l + bonus)));
      if (path === "restoration") {
        g.p.evoHealT = Math.max(g.p.evoHealT || 0, tier ? 8 : 5);
        g.p.evoRegenCd = 0;
      }
      if (path === "ward") g.p.sh = Math.max(g.p.sh, tier ? 4 : 2.5);
      SFX.play("heal");
      if (FXQ())
        g.fx.push({
          k: "heal",
          x: g.p.x,
          y: g.p.y,
          t: 0,
          life: 1.2,
          follow: true,
        });
      toast(ACT[id].n + ": cura");
    },
    dash(g, l, id) {
      const p = g.p;
      let ix = 0,
        iy = 0;
      if (keys["a"] || keys["arrowleft"]) ix -= 1;
      if (keys["d"] || keys["arrowright"]) ix += 1;
      if (keys["w"] || keys["arrowup"]) iy -= 1;
      if (keys["s"] || keys["arrowdown"]) iy += 1;
      if (stick.on) {
        ix = stick.dx;
        iy = stick.dy;
      }
      let n = Math.hypot(ix, iy);
      if (n < 0.2) {
        ix = p.face;
        iy = 0;
        n = 1;
      }
      ix /= n;
      iy /= n;
      const duration = 0.16,
        distance = 62 + 20 * (l - 1);
      p.dash = {
        t: duration,
        vx: (ix * distance) / duration,
        vy: (iy * distance) / duration,
        gh: 0,
      };
      p.inv = Math.max(p.inv, 0.3 + 0.1 * (l - 1));
      SFX.play("dash");
      vib(20);
      burst(p.x, p.y, 8, "#fff3b0", 60);
    },
    stasis(g, l, id) {
      /* O Sol Parou: estase estilo Zhonya. Invulnerável e imóvel; as armas continuam atirando. */
      const ev = g.activeTrees && g.activeTrees[id],
        path = ev && ev.path,
        tier = ev && ev.tier ? 1 : 0,
        p = g.p,
        seconds =
          2.75 + 0.25 * l + (path === "longday" ? (tier ? 2 : 1) : 0);
      p.stasisT = seconds;
      p.stasisHeal = path === "fought" ? (tier ? 0.18 : 0.1) : 0;
      p.sh = Math.max(p.sh, seconds);
      p.dash = null;
      p.moving = false;
      p.kx = 0;
      p.ky = 0;
      if (path === "hail") {
        const rad = tier ? 150 : 105,
          dmg = (14 + 4 * l) * (tier ? 1.5 : 1);
        for (const e of g.enemies) {
          if (e.dead) continue;
          const dx = e.x - p.x,
            dy = e.y - p.y,
            d = Math.hypot(dx, dy) || 1;
          if (d < rad) hurtBy(id, e, dmg, dx / d, dy / d, 60);
        }
      }
      SFX.play("heal");
      burst(p.x, p.y, 14, "#ffe08a", 70);
      if (FXQ())
        g.fx.push({
          k: "domeFlash",
          x: p.x,
          y: p.y,
          t: 0,
          life: 0.8,
          follow: true,
          gold: true,
        });
      toast(ACT[id].n + ": " + Math.round(seconds * 10) / 10 + " s parado no tempo");
    },
    attack_speed_buff(g, l, id) {
      /* Mãos Treinadas: velocidade de ataque temporária (aplicada em recalc()). */
      const ev = g.activeTrees && g.activeTrees[id],
        path = ev && ev.path,
        tier = ev && ev.tier ? 1 : 0,
        p = g.p,
        seconds =
          4.5 + 0.5 * l + (path === "fingers" ? (tier ? 3 : 1.5) : 0),
        bonus = 1 + (path === "raised" ? (tier ? 0.5 : 0.25) : 0);
      p.atkBuffT = Math.max(p.atkBuffT || 0, seconds);
      p.atkBuffBonus = bonus;
      p.atkBuffDmg = path === "bronze" ? (tier ? 1.25 : 1.15) : 1;
      for (const wid in g.W) {
        const w = g.W[wid];
        if (w.cd > 0) w.cd /= 1 + bonus;
      }
      recalc();
      SFX.play("dash");
      burst(p.x, p.y, 12, "#ffe08a", 80);
      toast(
        ACT[id].n + ": +" + Math.round(bonus * 100) + "% de ataque por " + Math.round(seconds * 10) / 10 + " s",
      );
    },
  };
  const ACT = Object.fromEntries(
    Object.entries(FE_CONTENT.actives).map(([id, definition]) => {
      const handler = ACTIVE_BEHAVIOR_HANDLERS[definition.behavior];
      if (typeof handler !== "function")
        throw new Error(
          "[Content] Active " +
          id +
          " has no engine handler for " +
          definition.behavior +
          ".",
        );
      return [id, { ...definition, go: (g, level) => handler(g, level, id) }];
    }),
  );
  ICON_DRAW.judgment = (g) => {
    g.fillStyle = "#fff3b0";
    g.beginPath();
    g.moveTo(14, 1);
    g.lineTo(5, 13);
    g.lineTo(11, 13);
    g.lineTo(8, 23);
    g.lineTo(19, 9);
    g.lineTo(13, 9);
    g.closePath();
    g.fill();
    g.strokeStyle = "#e0a82e";
    g.lineWidth = 1;
    g.stroke();
  };
  ICON_DRAW.refuge = (g) => {
    R(g, "#2a5fb0", 4, 3, 16, 12);
    R(g, "#2a5fb0", 6, 15, 12, 3);
    R(g, "#2a5fb0", 9, 18, 6, 3);
    R(g, "#8fc4ff", 6, 5, 12, 9);
    R(g, "#8fc4ff", 8, 14, 8, 3);
    R(g, "#fff", 11, 6, 2, 10);
    R(g, "#fff", 8, 9, 8, 2);
  };
  ICON_DRAW.shepherd = (g) => {
    g.strokeStyle = "#a8741f";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(8, 22);
    g.lineTo(8, 8);
    g.arc(12, 8, 4, Math.PI, 0);
    g.lineTo(16, 11);
    g.stroke();
    R(g, "#7ec850", 15, 15, 6, 4);
    R(g, "#4a9442", 17, 13, 2, 3);
  };
  const actCd = (id, l) =>
    Math.max(8, ACT[id].cd - ACT[id].step * (l - 1)) /
    (G && G.arm && G.arm[id] ? 1 + (G.arm[id] - 1) * 0.5 : 1);
  /* a recarga das ativas ignora o bônus temporário de velocidade de ataque de Mãos Treinadas */
  const actCdMod = (g) =>
    g.mods.cd * (g.p && g.p.atkBuffT > 0 ? 1 + (g.p.atkBuffBonus || 1) : 1);
  function ensureA(g) {
    if (!g.A) {
      g.A = [];
      g.al = {};
      g.acd = {};
      g.sel = 0;
    }
    return g;
  }
  function gainAct(id) {
    const g = ensureA(G);
    if (g.al[id]) {
      g.al[id]++;
      return true;
    }
    if (!canGainActive(g)) {
      toast("Você já possui 2 habilidades ativas neste modo.");
      return false;
    }
    g.al[id] = 1;
    g.A.push(id);
    g.acd[id] = 6;
    g.sel = g.A.length - 1;
    toast(ACT[id].n + (TOUCH_UI ? " · botão " : " · tecla ") + g.A.length);
    return true;
  }
  function useAct(i) {
    const g = G;
    if (!g || state !== "play" || !g.A) return;
    if (performance.now() < (g.actLock || 0)) return;
    const id = g.A[i];
    if (!id) return;
    if (g.p && g.p.stasisT > 0) {
      toast("O tempo está parado: você não pode se mover nem usar habilidades.");
      return;
    }
    g.sel = i;
    if (g.acd[id] > 0) {
      toast(ACT[id].n + " em " + Math.ceil(g.acd[id]) + " s");
      deny(AC.children[i], null);
      return;
    }
    ACT[id].go(g, g.al[id]);
    BTL.activeUse(id);
    g.acd[id] = actCd(id, g.al[id]) * actCdMod(g);
  }
  const AC = document.createElement("div");
  AC.id = "acts";
  $("#hud").appendChild(AC);
  /* Static CSS moved to style.css. */
  function buildActs() {
    AC.innerHTML = "";
    const g = G;
    if (!g || !g.A) return;
    g.A.forEach((id, i) => {
      const b = document.createElement("button"),
        ev = selectedEvolution(id, "active");
      b.className =
        "act" + (ev ? " evolved" : "") + (ev && ev.tier ? " mastered" : "");
      b.type = "button";
      b.setAttribute(
        "data-tip",
        actTip(id, g) +
        (ev
          ? " · " +
          EVOLUTION_TREES.active[id].paths[ev.path].name +
          (ev.tier
            ? " · MAESTRIA " +
            EVOLUTION_TREES.active[id].paths[ev.path].node.name
            : "")
          : ""),
      );
      if (ev)
        b.style.setProperty("--evo-color", evoAccent(id, ev.path, !!ev.tier));
      b.innerHTML =
        '<img alt="" src="' +
        gameIconURL(id, "active") +
        '"><kbd>' +
        (i + 1) +
        "</kbd><em>" +
        g.al[id] +
        "</em><i></i><b></b>";
      b.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        e.preventDefault();
        useAct(i);
      });
      AC.appendChild(b);
    });
  }
  const _bh = buildHTML;
  buildHTML = function () {
    let h = _bh();
    const g = G;
    if (g && g.A)
      for (const id of g.A) {
        const ev = selectedEvolution(id, "active"),
          cls =
            "slot a" +
            (ev ? " evolved" : "") +
            (ev && ev.tier ? " mastered" : ""),
          label = ev && EVOLUTION_TREES.active[id].paths[ev.path];
        h +=
          '<div class="' +
          cls +
          '"' +
          (ev
            ? ' style="--evo-color:' + evoAccent(id, ev.path, !!ev.tier) + '"'
            : "") +
          ' data-tip="' +
          ACT[id].n +
          " · Nv " +
          g.al[id] +
          " · ativa, " +
          (TOUCH_UI ? "botão " : "tecla ") +
          (g.A.indexOf(id) + 1) +
          (label
            ? " · " +
            label.name +
            (ev.tier ? " · Maestria: " + label.node.name : "")
            : "") +
          '"><img alt="" src="' +
          gameIconURL(id, "active") +
          '"><b>' +
          g.al[id] +
          "</b></div>";
      }
    if (g && g.slingTree) {
      const ev = g.slingTree,
        label = SLING_TREE[ev.path];
      if (label)
        h +=
          '<div class="tree-ribbon' +
          (ev.tier ? " mastered" : "") +
          '" style="--evo-color:' +
          evoAccent("sling", ev.path, !!ev.tier) +
          '"><img alt="" src="' +
          evolutionIconURL("sling", ev.path, !!ev.tier) +
          '"><span><b>' +
          label.name +
          "</b><small>" +
          (ev.tier
            ? "✦ Maestria: " + label.node.name
            : "Caminho escolhido · Maestria pendente") +
          "</small></span></div>";
    }
    if (g)
      for (const [grp, map] of [
        ["weapon", g.weaponTrees],
        ["passive", g.passiveTrees],
        ["active", g.activeTrees],
      ])
        for (const id in map || {}) {
          const ev = map[id],
            label = EVOLUTION_TREES[grp][id].paths[ev.path];
          if (label)
            h +=
              '<div class="tree-ribbon' +
              (ev.tier ? " mastered" : "") +
              '" style="--evo-color:' +
              evoAccent(id, ev.path, !!ev.tier) +
              '"><img alt="" src="' +
              evolutionIconURL(id, ev.path, !!ev.tier) +
              '"><span><b>' +
              label.name +
              "</b><small>" +
              (ev.tier
                ? "✦ Maestria: " + label.node.name
                : "Caminho escolhido · Maestria pendente") +
              "</small></span></div>";
        }
    return h;
  };
  buildRack = function () {
    H$.rack.innerHTML = _bh();
    buildActs();
  };
  const _uw = updWeapons;
  updWeapons = function (dt) {
    const g = G;
    _uw(dt);
    if (!g || g.over) return;
    collide(g.p);
    if (g.A) for (const id of g.A) g.acd[id] = Math.max(0, g.acd[id] - dt);
    if (g.t >= 480 && !g.fin) {
      g.fin = 1;
      g.tFin = g.t + 10;
      g.tFr = g.t + 30;
      banner("HORA FINAL", "Os demônios se enfurecem");
      SFX.play("boss");
      g.shake = 0.5;
      $("#timer").style.color = "#ff6b5e";
    }
    if (g.fin && g.t >= g.tFin) {
      g.tFin = g.t + 20;
      for (let i = 0, n = scaledEventCount(2); i < n; i++) spawnEnemy("elite");
    }
    if (g.fin && g.t >= g.tFr) {
      g.tFr = g.t + 30;
      ring("imp", 22 + Math.floor(g.t / 30), 170);
    }
    g.ua = (g.ua || 0) - dt;
    if (g.ua <= 0) {
      g.ua = 0.1;
      AC.querySelectorAll(".act").forEach((b, i) => {
        const id = g.A && g.A[i];
        if (!id) return;
        const c = g.acd[id],
          tot = actCd(id, g.al[id]) * actCdMod(g);
        b.classList.toggle("sel", i === g.sel);
        b.classList.toggle("rdy", c <= 0);
        b.querySelector("i").style.height =
          c > 0 ? Math.min(100, (c / tot) * 100) + "%" : "0";
        b.querySelector("b").textContent = c > 0 ? Math.ceil(c) : "";
      });
    }
  };
  const _sr = startRun;
  startRun = function () {
    if (document.activeElement && document.activeElement.blur)
      document.activeElement.blur();
    $("#timer").style.color = "";
    $("#banner").classList.remove("show");
    $("#toast").classList.remove("show");
    _sr();
    if (START_PICK && G) G.pending.push({ kind: "start" });
  };
  addEventListener("keydown", (e) => {
    if (state !== "play" || !G || !G.A || !G.A.length || e.repeat) return;
    const k = e.key.toLowerCase(),
      n = G.A.length;
    if (k === " ") useAct(G.sel || 0);
    else if (k === "q" || k === "e")
      G.sel = ((G.sel || 0) + (k === "e" ? 1 : n - 1)) % n;
    else if (k === "1" || k === "2" || k === "3") useAct(+k - 1);
  });

  const DEBUG_RESET = false; // coloque false antes de publicar

  ICON_DRAW.jawbone = (g) => {
    R(g, "#e9dcc0", 6, 4, 12, 4);
    R(g, "#e9dcc0", 4, 8, 4, 10);
    R(g, "#cbbf9f", 8, 10, 10, 3);
    R(g, "#e9dcc0", 14, 8, 4, 6);
  };
  ICON_DRAW.scepter = (g) => {
    R(g, "#a8741f", 11, 8, 2, 14);
    R(g, "#f2c14e", 8, 3, 8, 6);
    R(g, "#fff0a8", 10, 5, 4, 2);
  };

  const UNL = {
    sansao: (g) => g.kills >= 500,
    ester: (g) => g.t >= 300,
    elias: (g) => g.bossIdx >= 3,
  };
  setInterval(() => {
    if (state === "play" && G && activeHeroPowerBehavior() === "royal_decree") {
      if (G.nsh == null) G.nsh = 60;
      if (G.t >= G.nsh) {
        G.nsh += 60;
        G.p.sh = 6;
        SFX.play("shield");
        toast("Coragem da Rainha: Escudo Divino");
      }
    }
  }, 500);
  if (DEBUG_RESET) {
    const r = document.createElement("button");
    r.className = "debug-reset";
    r.textContent = "reset";
    r.onclick = () => {
      if (r.dataset.c) {
        try {
          localStorage.removeItem(SAVE_KEY);
        } catch (e) { }
        location.reload();
      } else {
        r.dataset.c = 1;
        r.textContent = "apagar TUDO? clique de novo";
        r.classList.add("is-confirming");
        setTimeout(() => {
          delete r.dataset.c;
          r.textContent = "reset";
          r.classList.remove("is-confirming");
        }, 3000);
      }
    };
    $("#menu").appendChild(r);
  }
  /* ================= v0.9 ================= */
  // Alcance de ataque por herói (px). Armas que miram só disparam com inimigo dentro desse raio; corpo a corpo ganha alcance extra acima de 100.
  const HRNG = FE_CONTENT.heroAttackRange;
  ICON_DRAW.watch = (g) => {
    g.fillStyle = "#e8faff";
    g.beginPath();
    g.ellipse(12, 12, 10, 6, 0, 0, 6.3);
    g.fill();
    g.strokeStyle = "#2a5fb0";
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = "#2a7fc4";
    g.beginPath();
    g.arc(12, 12, 4, 0, 6.3);
    g.fill();
    R(g, "#0c0918", 11, 11, 2, 2);
    R(g, "#fff", 12, 10, 1, 1);
  };
  ICON_DRAW.eagle = (g) => {
    g.fillStyle = "#f2c14e";
    g.beginPath();
    g.moveTo(2, 16);
    g.lineTo(10, 4);
    g.lineTo(22, 6);
    g.lineTo(16, 10);
    g.lineTo(21, 12);
    g.lineTo(14, 15);
    g.lineTo(17, 19);
    g.lineTo(8, 19);
    g.closePath();
    g.fill();
    g.strokeStyle = "#a8741f";
    g.lineWidth = 1.5;
    g.stroke();
    R(g, "#fff3b0", 10, 7, 6, 1);
  };
  ICON_DRAW.sunstop = (g) => {
    g.fillStyle = "#ffe08a";
    g.beginPath();
    g.arc(12, 12, 6, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#e0a82e";
    g.lineWidth = 1.5;
    g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.beginPath();
      g.moveTo(12 + Math.cos(a) * 8, 12 + Math.sin(a) * 8);
      g.lineTo(12 + Math.cos(a) * 11, 12 + Math.sin(a) * 11);
      g.stroke();
    }
    R(g, "#7a4b12", 11, 8, 2, 5);
    R(g, "#7a4b12", 11, 12, 4, 1);
  };
  ICON_DRAW.handsbattle = (g) => {
    g.lineCap = "round";
    g.strokeStyle = "#f2c14e";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(7, 22);
    g.lineTo(8, 11);
    g.moveTo(17, 22);
    g.lineTo(16, 11);
    g.stroke();
    g.fillStyle = "#ffe0b0";
    g.beginPath();
    g.arc(8, 8, 3.2, 0, Math.PI * 2);
    g.arc(16, 8, 3.2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#fff3b0";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(12, 2);
    g.lineTo(12, 6);
    g.moveTo(3, 3);
    g.lineTo(5, 6);
    g.moveTo(21, 3);
    g.lineTo(19, 6);
    g.stroke();
  };
  function actTip(id, g) {
    const A = ACT[id],
      l = g.al[id];
    let d = A.d;
    if (id === "shepherd")
      d = "Cura " + Math.round((0.2 + 0.05 * l) * 100) + "% da Salvação.";
    else if (id === "refuge") d = "Invencível por " + (4 + l) + " s.";
    else if (id === "sunstop")
      d = "Invulnerável e imóvel por " + (2.75 + 0.25 * l) + " s. Suas armas continuam atirando.";
    else if (id === "handsbattle")
      d = "+100% de velocidade de ataque por " + (4.5 + 0.5 * l) + " s.";
    return (
      A.n +
      " · Nv " +
      l +
      "\n" +
      d +
      "\nRecarga: " +
      Math.round(actCd(id, l) * actCdMod(g)) +
      " s · tecla " +
      (g.A.indexOf(id) + 1)
    );
  }
  /* Static CSS moved to style.css. */
  function dmgNum(e, v, cr) {
    if (!G || v <= 0 || G.fx.length > 140) return;
    G.fx.push({
      wid: BTL.src || null,
      k: "dmg",
      x: e.x + rndFx(-5, 5),
      y: e.y - e.r - 4,
      s: String(Math.max(1, Math.round(v))),
      cr,
      col: cr ? "#ffd24a" : "#ff5a5a",
      t: 0,
      life: 0.75,
    });
  }
  function dmgPass() {
    const g = G;
    if (!g) return;
    ctx.textAlign = "center";
    for (const f of g.fx) {
      if (f.k !== "dmg") continue;
      const k = f.t / f.life,
        X = sx(f.x),
        Y = sy(f.y - k * 14);
      if (X < -20 || X > VW + 20 || Y < -10 || Y > VH + 10) continue;
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      ctx.font = (f.cr ? 11 : 9) + "px " + CF.body;
      ctx.fillStyle = "#000";
      ctx.fillText(f.s, X + 1, Y + 1);
      ctx.fillStyle = f.col;
      ctx.fillText(f.s, X, Y);
    }
    ctx.globalAlpha = 1;
  }
  const _dr3 = draw;
  draw = function () {
    _dr3();
    dmgPass();
  };

  /* ================= menu ================= */

  /* ================= v0.10: anúncios, bomba, empurrões, biblioteca ================= */
  const IS_NATIVE = !!(
    window.Capacitor &&
    Capacitor.isNativePlatform &&
    Capacitor.isNativePlatform()
  );
  /* v0.39: analytics silencioso. Sem bridge (navegador) não faz nada; no app envia ao Firebase, se instalado */
  const track = (n, p) => {
    if (TUT.on) return;
    try {
      window.FeTrack && window.FeTrack(n, p);
    } catch (e) { }
  };
  const ADS_SIM = !IS_NATIVE && /[?&]debug\b/.test(location.search); // simulador só no navegador e só com ?debug
  const AD_REWARDED_ID = "ca-app-pub-3940256099942544/5224354917"; // reserva (só usada se o android-bridge.js faltar): ID de teste do Google
  const ADM = () => IS_NATIVE && Capacitor.Plugins && Capacitor.Plugins.AdMob;
  let admInit = null;
  function adMsg(t) {
    notify(t, "warn");
  }
  function adMsgOld(t) {
    const d = document.createElement("div");
    d.className = "legacy-ad-message";
    d.textContent = t;
    gameEl.appendChild(d);
    setTimeout(() => d.remove(), 2600);
  }
  const ADS = {
    busy: false,
    rewarded(cb) {
      if (ADS.busy || ADS.loading) return;
      const _rcb = cb;
      cb = (ok) => {
        track("ad_rewarded", { ok: ok ? 1 : 0 });
        _rcb && _rcb(ok);
      };
      const sdk = window.CrazyGames && window.CrazyGames.SDK,
        A = ADM();
      ADS.loading = true;
      const ldT = setTimeout(() => {
        ADS.loading = false;
      }, 35000);
      if (IS_NATIVE) notify("Carregando anúncio…", "info");
      const start = () => {
        clearTimeout(ldT);
        ADS.loading = false;
        ADS.busy = true;
        SFX.on = false;
        if (musTrk) musTrk.pause();
      },
        done = (ok) => {
          clearTimeout(ldT);
          ADS.loading = false;
          ADS.busy = false;
          SFX.on = !!save.set.sound;
          musApply();
          cb(ok);
        };
      if (sdk && sdk.ad)
        sdk.ad.requestAd("rewarded", {
          adStarted: start,
          adFinished: () => done(true),
          adError: (m) => {
            adMsg(
              typeof m === "string" && m
                ? m
                : "Anúncio indisponível agora. Tente de novo em instantes.",
            );
            done(false);
          },
        });
      else if (A) {
        start();
        let rewarded = false,
          fin = false;
        const hs = [];
        const finish = (ok) => {
          if (fin) return;
          fin = true;
          hs.forEach((h) => {
            try {
              h.remove();
            } catch (e) { }
          });
          if (!ok)
            adMsg("Anúncio indisponível agora. Tente de novo em instantes.");
          done(ok);
        };
        const on = (ev, fn) =>
          Promise.resolve(A.addListener(ev, fn)).then((h) => hs.push(h));
        const wd = setTimeout(() => finish(false), 25000); // evita travar o botão se algo falhar
        (
          admInit ||
          (admInit = A.initialize({}).catch((e) => {
            admInit = null;
            throw e;
          }))
        )
          .then(async () => {
            await on("onRewardedVideoAdReward", () => {
              rewarded = true;
            });
            await on("onRewardedVideoAdShowed", () => clearTimeout(wd));
            await on("onRewardedVideoAdDismissed", () =>
              setTimeout(() => finish(rewarded), 300),
            );
            await on("onRewardedVideoAdFailedToLoad", () => {
              clearTimeout(wd);
              finish(false);
            });
            await on("onRewardedVideoAdFailedToShow", () => {
              clearTimeout(wd);
              finish(false);
            });
            await A.prepareRewardVideoAd({
              adId: AD_REWARDED_ID,
              isTesting: true,
            });
            await A.showRewardVideoAd();
          })
          .catch(() => {
            clearTimeout(wd);
            finish(false);
          });
      } else if (ADS_SIM) {
        start();
        const o = document.createElement("div");
        o.className = "ov ad-test-overlay";
        o.innerHTML =
          '<div class="ov-in"><h2>Anúncio de teste</h2><p class="sub">Simulando anúncio recompensado…</p></div>';
        gameEl.appendChild(o);
        setTimeout(() => {
          o.remove();
          done(true);
        }, 2500);
      } else {
        clearTimeout(ldT);
        ADS.loading = false;
        adMsg("Anúncio indisponível agora");
      }
    },
  };
  const rrb = document.createElement("button");
  rrb.id = "rrBtn";
  rrb.type = "button";
  rrb.className = "mb alt";
  rrb.hidden = true;
  rrb.innerHTML = '<span class="uic i-play"></span> Novas Bênçãos (anúncio)';
  $("#cards").insertAdjacentElement("afterend", rrb);
  const choiceToolsUI = document.createElement("div");
  choiceToolsUI.id = "choiceTools";
  choiceToolsUI.className = "choice-tools";
  choiceToolsUI.hidden = true;
  choiceToolsUI.innerHTML =
    '<button id="banishBtn" class="mb alt" type="button"></button><button id="skipChoiceBtn" class="mb alt" type="button"></button><button id="choiceToolsAdBtn" class="mb" type="button">' +
    "+1 de cada · anúncio" +
    '</button><span id="choiceToolsHint" role="status" hidden></span>';
  rrb.insertAdjacentElement("beforebegin", choiceToolsUI);
  const banishBtn = choiceToolsUI.querySelector("#banishBtn"),
    skipChoiceBtn = choiceToolsUI.querySelector("#skipChoiceBtn"),
    choiceToolsAdBtn = choiceToolsUI.querySelector("#choiceToolsAdBtn"),
    choiceToolsHint = choiceToolsUI.querySelector("#choiceToolsHint");
  function choiceToolUsesLeft(id) {
    const tools = G && G.choiceTools;
    if (!tools) return 0;
    const used = tools[id + "Used"];
    return Math.max(0, tools.max[id] + (tools.adBonus ? 1 : 0) - used);
  }
  function refreshChoiceToolUI() {
    const tools = G && G.choiceTools;
    choiceToolsUI.hidden = state !== "levelup" || !tools || !!(TUT && TUT.on);
    if (!tools) return;
    const banishMax = tools.max.banish + (tools.adBonus ? 1 : 0),
      skipMax = tools.max.skip + (tools.adBonus ? 1 : 0);
    banishBtn.textContent =
      "BANIR" +
      " · " +
      choiceToolUsesLeft("banish") +
      "/" +
      banishMax;
    skipChoiceBtn.innerHTML =
      "PULAR" +
      " · " +
      choiceToolUsesLeft("skip") +
      "/" +
      skipMax;
    banishBtn.title = "Remova uma bênção das próximas escolhas desta partida.";
    skipChoiceBtn.title =
      "Encerre esta escolha sem selecionar uma bênção e ganhe um pouco de XP.";
    banishBtn.disabled = choiceToolUsesLeft("banish") <= 0;
    skipChoiceBtn.disabled = choiceToolUsesLeft("skip") <= 0;
    choiceToolsAdBtn.hidden = tools.adBonus;
    choiceToolsHint.hidden = tools.action !== "banish";
    choiceToolsHint.textContent =
      tools.action === "banish"
        ? "Toque em uma bênção para bani-la desta partida."
        : "";
    choiceToolsUI.classList.toggle("banish-mode", tools.action === "banish");
    const box = $("#cards");
    if (box) {
      box.classList.toggle("banish-mode", tools.action === "banish");
      Array.from(box.children).forEach((card) =>
        card.classList.toggle("banish-target", tools.action === "banish"),
      );
    }
    banishBtn.setAttribute(
      "aria-pressed",
      tools.action === "banish" ? "true" : "false",
    );
  }
  /* Pular: não concede moedas. Concede XP = fração da barra do nível atual (pouco no início, cresce com o nível) */
  function skipXpAmount() {
    const frac = Math.min(
      ECO.SKIP_XP_MAX,
      ECO.SKIP_XP_BASE + ECO.SKIP_XP_PER_LVL * (G.lvl || 1),
    );
    return Math.max(1, Math.round((G.need || 0) * frac));
  }
  function completeSkippedLevel() {
    const xp = skipXpAmount();
    G.choiceTools.skipUsed++;
    BTL.skipChoice(0, xp);
    G.choiceTools.action = null;
    G.pending.shift();
    {
      const e = G.eco || (G.eco = ecoNew());
      e.skip.n++;
      e.skip.xp += xp;
    }
    gainXp(xp);
    $("#lvlup").hidden = true;
    buildRack();
    if (G.pending.length) openLevelUp();
    else {
      state = "play";
      last = performance.now();
      syncFpsHud();
      if (G.t > 1) {
        G.resumeT = 0.9;
        toast("Prepare-se…");
      }
    }
    refreshChoiceToolUI();
    SFX.play("pick");
    notify("+" + xp + " XP", "ok");
  }
  function banishChoice(i) {
    if (state !== "levelup" || performance.now() < LV_LOCK) return;
    const choice = curChoices[i],
      tools = G && G.choiceTools;
    if (!choice || !tools || choiceToolUsesLeft("banish") <= 0) return;
    const key = cardKey(choice),
      remaining = curChoices.filter(
        (c, index) => index !== i && !tools.banished.includes(cardKey(c)),
      );
    if (!remaining.length) {
      toast(
        "Mantenha ao menos uma bênção disponível para esta escolha.",
      );
      return;
    }
    tools.banished.push(key);
    tools.banishUsed++;
    tools.action = null;
    curChoices = remaining;
    BTL.banishOption(choice, remaining);
    const cards = $("#cards"),
      removed = cards && cards.children[i];
    if (removed) {
      removed.disabled = true;
      removed.classList.add("card-disintegrate");
      setTimeout(() => {
        if (removed.parentNode !== cards) return;
        removed.remove();
        if (cards)
          cards.classList.toggle("has-two", cards.children.length === 2);
        if (cards)
          Array.from(cards.children).forEach((card, index) => {
            const label = card.querySelector("kbd");
            if (label) label.textContent = String(index + 1);
          });
      }, 1000);
    }
    refreshChoiceToolUI();
    toast(
      "Bênção banida desta partida.",
    );
  }
  banishBtn.onclick = () => {
    if (state !== "levelup" || !G || choiceToolUsesLeft("banish") <= 0) return;
    G.choiceTools.action = G.choiceTools.action === "banish" ? null : "banish";
    refreshChoiceToolUI();
  };
  skipChoiceBtn.onclick = () => {
    if (
      state !== "levelup" ||
      !G ||
      performance.now() < LV_LOCK ||
      choiceToolUsesLeft("skip") <= 0
    )
      return;
    completeSkippedLevel();
  };
  choiceToolsAdBtn.onclick = () => {
    const run = G;
    if (state !== "levelup" || !run || run.choiceTools.adBonus) return;
    ADS.rewarded((ok) => {
      if (!ok || G !== run || state !== "levelup" || run.choiceTools.adBonus)
        return;
      run.choiceTools.adBonus = true;
      BTL.syncChoiceTools();
      refreshChoiceToolUI();
      toast(
        "Anúncio recompensado: +1 uso de Banir e +1 uso de Pular nesta partida.",
      );
    });
  };
  const _chooseWithBanish = chooseIdx;
  chooseIdx = function (i) {
    if (
      state === "levelup" &&
      G &&
      G.choiceTools &&
      G.choiceTools.action === "banish"
    )
      return banishChoice(i);
    return _chooseWithBanish(i);
  };
  rrb.onclick = () =>
    ADS.rewarded((ok) => {
      if (ok && state === "levelup") {
        BTL.rerollChoice("rewarded_ad");
        if (G.choiceTools) G.choiceTools.action = null;
        G.rr = 1;
        for (const o of curChoices) if (o.id) G.snub[cardKey(o)] = G.offerN + 2;
        openLevelUp();
      }
    });
  const dbl = document.createElement("button");
  dbl.id = "dblBtn";
  dbl.type = "button";
  dbl.className = "btn";
  dbl.hidden = true;
  $("#againBtn").parentNode.insertAdjacentElement("beforebegin", dbl);
  function dblSetup(n) {
    const u = AD_COIN,
      left = Math.max(0, AD_COIN_MAX - adGoldUsed()),
      already = !!(G && (G.dblPaid || 0) > 0); /* no máximo 1 por partida */
    dbl.hidden = already;
    if (already) return;
    dbl.disabled = left <= 0;
    dbl.innerHTML =
      left <= 0
        ? '<span class="uic i-play"></span> +' +
        u +
        " moedas · limite de hoje atingido"
        : '<span class="uic i-play"></span> +' +
        u +
        " moedas · anúncio (restam " +
        left +
        " hoje)";
    dbl.onclick = () => {
      if (adGoldUsed() >= AD_COIN_MAX || (G && (G.dblPaid || 0) > 0)) return;
      ADS.rewarded((ok) => {
        /* cancelamento ou falha não consomem tentativa */
        if (!ok) return;
        if (adGoldUsed() >= AD_COIN_MAX || (G && (G.dblPaid || 0) > 0)) return;
        save.adg.n++;
        save.coins += u;
        if (G) G.dblPaid = (G.dblPaid || 0) + u;
        BTL.patchEconomy({ adCoins: G ? G.dblPaid : u });
        persist();
        refreshMeta();
        dbl.hidden = true;
        coinBoost(u);
      });
    }; /* se o anúncio for cancelado, o botão permanece */
  }
  function coinBoost(n) {
    const box = $("#sumCoins");
    SFX.play("coin");
    setTimeout(() => SFX.play("coin"), 140);
    setTimeout(() => SFX.play("coin"), 280);
    vib(30);
    if (!box) return notify("+" + n + " moedas!", "ok");
    const b = box.querySelector("b"),
      t0 = performance.now(),
      base = parseInt(b.textContent, 10) || 0; /* moedas ganhas na partida */
    box.classList.add("boost");
    box.insertAdjacentHTML(
      "beforeend",
      '<span class="newrec coin-doubled">BÔNUS DO ANÚNCIO</span><span class="coinpop">+' +
      n +
      " moedas</span>",
    );
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 750);
      b.textContent = Math.round(base + n * k); /* conta de base até base + n (ex.: 24 → 54) */
      if (k < 1) requestAnimationFrame(step);
    };
    step();
  }
  function pushP(dx, dy, f) {
    const d = Math.hypot(dx, dy) || 1;
    G.p.kx = (dx / d) * f;
    G.p.ky = (dy / d) * f;
  }
  function crowdPush() {
    const p = G.p;
    let n = 0;
    for (const e of G.enemies)
      if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 80) n++;
    if (n < 6) return;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x,
        dy = e.y - p.y,
        d = Math.hypot(dx, dy) || 1;
      if (d < 140) {
        const f = e.boss ? 60 : e.elite ? 200 : 380;
        e.kx += (dx / d) * f;
        e.ky += (dy / d) * f;
      }
    }
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * 6.2832;
      G.parts.push({
        x: p.x + Math.cos(a) * 14,
        y: p.y + Math.sin(a) * 14,
        vx: Math.cos(a) * 150,
        vy: Math.sin(a) * 150,
        life: 0.4,
        max: 0.7,
        col: "#fff3a0",
        sz: 2,
      });
    }
    G.shake = 0.25;
    SFX.play("boom");
    toast("Os demônios recuam!");
  }
  function explode(e) {
    const RD = 46;
    burst(e.x, e.y, 22, "#ff9a2a", 130);
    burst(e.x, e.y, 10, "#fff3a0", 90);
    G.shake = Math.max(G.shake, 0.3);
    SFX.play("boom");
    G.fx.push({
      wid: BTL.src || null,
      k: "pulse",
      x: e.x,
      y: e.y,
      t: 0,
      life: 0.4,
    });
    const p = G.p;
    if (Math.hypot(p.x - e.x, p.y - e.y) < RD + 4) {
      hurtPlayer(2 * HPS, "Demônio Explosivo");
      pushP(p.x - e.x, p.y - e.y, 200);
    }
    for (const o of G.enemies.slice()) {
      if (o.dead || o === e) continue;
      const dx = o.x - e.x,
        dy = o.y - e.y,
        d = Math.hypot(dx, dy) || 1;
      if (d < RD + o.r) hurtBy("explosion", o, 16, dx / d, dy / d, 40);
    }
  }
  /* Biblioteca */
  const DI = Object.fromEntries(
    Object.entries(ET)
      .filter(([, d]) => d.library)
      .map(([id, d]) => [id, d.library]),
  );
  const LBL = {
    dmg: "Dano",
    cd: "Recarga",
    count: "Qtde",
    range: "Alcance",
    radius: "Raio",
    pierce: "Perfura",
    r: "Raio",
    speed: "Veloc.",
  };
  const LBL2 = Object.assign({}, LBL, {
    maxr: "Alcance máx.",
    knock: "Empurrão",
    tick: "Pulso (s)",
    slow: "Lentidão",
  });
  const GLBL = {
    w: "ARMA",
    p: "DOM",
    a: "ATIVA",
    d: "DEMÔNIO",
    b: "CHEFE",
    h: "HERÓI",
  };
  const LIB_TIP = FE_CONTENT.libraryTips;
  const BPD = FE_CONTENT.bossPatternDescriptions;
  const BOSS_TIP = BOSS_DEFS.map((b) => b.tip);
  const MV_TXT = FE_CONTENT.movementLabels;

  let libTab = 0,
    libFilter = "all",
    libList = [],
    libIdx = 0;
  let libTreeList = [],
    libTreeIdx = 0,
    libDetailMode = "skill";
  function sprURL(sp) {
    try {
      return sp && sp.c ? sp.c.toDataURL() : "";
    } catch (e) {
      return "";
    }
  }
  function libEntries() {
    const L = [];
    for (const id in WEAPONS) {
      const W = WEAPONS[id];
      L.push({
        g: "w",
        id,
        name: W.name,
        ref: W.ref,
        desc: W.desc,
        tag: "Arma · " + (CAT[id] || ""),
        badge: "Nv " + MAXW,
        img: () => iconURL(id),
      });
    }
    for (const id in PASSIVES) {
      const P = PASSIVES[id];
      L.push({
        g: "p",
        id,
        name: P.name,
        ref: P.ref,
        desc: P.desc,
        tag: "Dom · " + (CAT[id] || ""),
        badge: "Nv " + passiveMaxLevel(id),
        img: () => iconURL(id),
      });
    }
    for (const id in ACT) {
      const A = ACT[id];
      L.push({
        g: "a",
        id,
        name: A.n,
        ref: A.ref,
        desc: A.d,
        tag: "Ativa · " + (CAT[id] || ""),
        badge: "Nv " + MAXA,
        img: () => iconURL(id),
      });
    }
    for (const k in ET) {
      const T = ET[k],
        d = DI[k];
      L.push({
        g: "d",
        id: k,
        name: d[0],
        ref: d[1],
        desc: d[2],
        tag: "Demônio",
        badge: "Vida " + T.hp,
        img: () => sprURL(S[T.spr]),
      });
    }
    BOSSES.forEach((B, i) => {
      const p = B.sub.split(" — ");
      L.push({
        g: "b",
        id: i,
        name: B.name,
        ref: p[1] || "",
        desc: p[0],
        tag: "Chefe · " + fmt(BOSS_T[i]),
        badge: "Vida " + B.hp,
        img: () => sprURL(S[B.spr]),
      });
    });
    return L;
  }
  /* Catálogo de heróis (consulta): usa HX + HEROES já existentes */
  function libHeroEntries() {
    const L = [];
    for (const id in HX) {
      const X = HX[id],
        H = HEROES[id];
      if (!H) continue;
      const locked = !!X.locked;
      const startId = H.start,
        startName =
          (WEAPONS[startId] && WEAPONS[startId].name) ||
          String(X.start || startId || "—");
      const graceN = X.grace ? X.grace.n : X.ch ? "Nenhuma" : X.gr || "—";
      const graceD = X.grace
        ? X.grace.d
        : X.ch
          ? "Sem passiva, escudo ou cura. Desafio para experientes."
          : X.gr || "";
      let unlock = "Disponível desde o início";
      if (locked) {
        const parts = [];
        if (X.quest) parts.push(X.quest);
        if (typeof HU !== "undefined" && HU[id]) {
          if (HU[id].coins) parts.push(HU[id].coins + " moedas");
          else if (HU[id].ads) parts.push(HU[id].ads + " anúncios");
        }
        unlock = parts.length ? parts.join(" · ou ") : "Bloqueado";
      }
      L.push({
        g: "h",
        id,
        name: X.name,
        ref: "",
        desc: H.role || X.role || "",
        tag: "Herói · " + (H.role || X.role || ""),
        badge: locked ? "BLOQ" : "M" + mlv(id),
        img: () => sprURL(S.hero[id] && S.hero[id][0]),
        locked,
        H,
        X,
        startId,
        startName,
        graceN,
        graceD,
        unlock,
      });
    }
    return L;
  }
  const libCard = (e) =>
    '<span class="lc-top"><i>' +
    GLBL[e.g] +
    "</i><em>" +
    e.badge +
    '</em></span><span class="lc-art"><img alt="" src="' +
    e.img() +
    '"></span><span class="lc-name">' +
    e.name +
    '</span><span class="lc-sep"></span><span class="lc-desc">' +
    e.desc +
    '</span><span class="lc-foot">' +
    e.tag +
    "</span>";
  /* Catálogo consultável das árvores implementadas. Os dados vêm das mesmas
     definições usadas no combate, para manter a biblioteca sincronizada com as cartas. */
  function libTreeEntries() {
    const L = [];
    const add = (g, id, base, paths, max, img) =>
      L.push({
        g,
        id,
        name: base.name,
        ref: base.ref || "",
        desc: base.desc || "",
        paths,
        max,
        img: img || (() => iconURL(id)),
      });
    if (WEAPONS.sling && SLING_TREE)
      add("w", "sling", WEAPONS.sling, SLING_TREE, MAXW);
    for (const [id, root] of Object.entries(EVOLUTION_TREES.weapon || {}))
      if (WEAPONS[id]) add("w", id, WEAPONS[id], root.paths, MAXW);
    for (const [id, root] of Object.entries(EVOLUTION_TREES.passive || {}))
      if (PASSIVES[id])
        add("p", id, PASSIVES[id], root.paths, passiveMaxLevel(id));
    for (const [id, root] of Object.entries(EVOLUTION_TREES.active || {}))
      if (ACT[id])
        add(
          "a",
          id,
          { name: ACT[id].n, ref: ACT[id].ref, desc: ACT[id].d },
          root.paths,
          MAXA,
        );
    return L;
  }
  const libTreeCard = (e) =>
    '<span class="lc-top"><i>ÁRVORE ✦</i><em>3 caminhos</em></span><span class="lc-art evolution-art"><img alt="" src="' +
    iconURL(e.id) +
    '"></span><span class="lc-name">' +
    e.name +
    '</span><span class="lc-sep"></span><span class="lc-desc">' +
    e.desc +
    '</span><span class="lc-foot">' +
    (e.g === "w" ? "Arma" : e.g === "p" ? "Dom" : "Habilidade ativa") +
    " · Nv " +
    e.max +
    "</span>";
  /* ---------- Glossário de Evoluções de Armas ----------
     Dom Nv 3 + arma Nv 6 = Evolução Suprema. Os dados vêm de NX_EVO (as mesmas regras do combate).
     Na pausa mostra o progresso da partida; na Biblioteca é só consulta. */
  function evoGlossaryHTML(live) {
    const g = live && G && G.W ? G : null,
      domLv = NXV.domLv;
    const piece = (id, group, label, have, need, cls) =>
      '<div class="evo-p' +
      (g ? (have >= need ? " is-ok" : " is-miss") : "") +
      '"><span class="evo-ic"><img alt="" src="' +
      iconURL(id) +
      '"><em class="evo-lv">' +
      label +
      (g ? "<small>" + Math.min(have, need) + "/" + need + "</small>" : "") +
      (g && have >= need ? '<i class="evo-ck">✓</i>' : "") +
      '</em></span><span class="evo-nm">' +
      (group === "w" ? WEAPONS[id].name : PASSIVES[id].name) +
      "</span></div>";
    let h = '<div class="evo-gl">';
    for (const id in WEAPONS) {
      const E = NX_EVO[id];
      if (!E || !PASSIVES[E.dom]) continue;
      const wl = g && g.W[id] ? g.W[id].lvl : 0,
        dl = g ? g.P[E.dom] || 0 : 0,
        done = !!(g && g.evo && g.evo[id]),
        ready = !!(g && !done && wl >= MAXW && dl >= domLv);
      h +=
        '<div class="evo-r' +
        (done ? " is-done" : ready ? " is-ready" : "") +
        '">' +
        '<div class="evo-eq">' +
        piece(E.dom, "p", "Nv " + domLv + "+", dl, domLv) +
        '<span class="evo-op">+</span>' +
        piece(id, "w", "Nv " + MAXW, wl, MAXW) +
        '<span class="evo-op">=</span>' +
        '<div class="evo-p evo-res"><span class="evo-ic evo-sup"><img alt="" src="' +
        iconURL(id) +
        '"><i class="evo-star evo-s1">✦</i><i class="evo-star evo-s2">✦</i></span><span class="evo-nm">' +
        E.n +
        "</span></div></div>" +
        '<div class="evo-tx"><b>' +
        E.n +
        " <small>" +
        E.ref +
        "</small>" +
        (done
          ? '<u class="evo-tag">EVOLUÍDA</u>'
          : ready
            ? '<u class="evo-tag">PRONTA · próxima Arca</u>'
            : "") +
        "</b><span>" +
        E.d +
        "</span></div></div>";
    }
    return h + "</div>";
  }
  function renderEvoGlossary(b) {
    const live = state === "paused" && !!G;
    b.innerHTML =
      '<div class="lib-tree-intro"><b>Monte sua build.</b><span>' +
      (live
        ? "Veja o que falta para cada Evolução Suprema da sua partida: ✓ marca o requisito cumprido."
        : "Dom no nível 3 + arma no nível 6 = Evolução Suprema, revelada na próxima Arca.") +
      "</span></div>" +
      evoGlossaryHTML(live);
  }
  function renderLib(b) {
    const chip = (id, t) =>
      '<button class="mb' +
      (libFilter === id ? " on" : "") +
      '" data-f="' +
      id +
      '" type="button">' +
      t +
      "</button>";
    /* 0 Habilidades · 1 Árvores · 2 Demônios · 3 Chefes · 4 Heróis · 5 Evoluções */
    const isSkills = libTab === 0,
      isTrees = libTab === 1,
      isHeroes = libTab === 4,
      isEvo = libTab === 5;
    const tabs = [
      "Habilidades",
      "Árvores",
      "Demônios",
      "Chefes",
      "Heróis",
      "Evoluções",
    ];
    b.innerHTML =
      '<div class="lib-tabs">' +
      tabs
        .map(
          (t, i) =>
            '<button class="mb' +
            (i === libTab ? " on" : "") +
            '" data-t="' +
            i +
            '" type="button">' +
            t +
            "</button>",
        )
        .join("") +
      "</div>" +
      (isSkills || isTrees
        ? '<div class="lib-chips">' +
        chip("all", "Todas") +
        chip("w", "Armas") +
        chip("p", "Dons") +
        chip("a", "Ativas") +
        "</div>"
        : "") +
      (isTrees
        ? '<div class="lib-tree-intro"><b>Planeje sua build antes da partida.</b><span>Cada árvore oferece três caminhos exclusivos. Depois de escolher um caminho, a Maestria correspondente pode aparecer nas escolhas seguintes. Esta tela é apenas uma prévia: não altera sua partida.</span></div>'
        : "") +
      (isEvo
        ? '<div class="lib-tree-intro"><b>Glossário de Evoluções de Armas.</b><span>Cada arma no nível 6 se une a um dom no nível 3 e revela sua Evolução Suprema na próxima Arca. Planeje sua build com antecedência. Esta tela é apenas consulta.</span></div>'
        : "") +
      (isHeroes
        ? '<div class="lib-tree-intro"><b>Conheça os heróis da fé.</b><span>Atributos, arma inicial, graça pessoal e maestrias. Esta tela é apenas consulta e não altera sua partida.</span></div>'
        : "") +
      '<div id="libB" class="lib-grid' +
      (isHeroes ? " lib-grid-heroes" : "") +
      (isEvo ? " lib-grid-evo" : "") +
      '"></div><div class="lib-hint">' +
      (isTrees
        ? "Toque em uma árvore para comparar os caminhos e as maestrias."
        : isEvo
          ? "Dom Nv 3 + arma Nv 6 = Evolução Suprema."
          : isHeroes
            ? "Toque em um herói para ver atributos, graça e maestrias."
            : "Toque em uma carta para ver os detalhes") +
      "</div>";
    b.querySelectorAll("[data-t]").forEach(
      (x) =>
      (x.onclick = () => {
        libTab = +x.dataset.t;
        renderLib(b);
      }),
    );
    b.querySelectorAll("[data-f]").forEach(
      (x) =>
      (x.onclick = () => {
        libFilter = x.dataset.f;
        renderLib(b);
      }),
    );
    const grid = $("#libB");
    if (isEvo) {
      libTreeList = [];
      libList = [];
      grid.innerHTML = evoGlossaryHTML(false);
    } else if (isTrees) {
      libTreeList = libTreeEntries().filter(
        (e) => libFilter === "all" || e.g === libFilter,
      );
      libList = [];
      libTreeList.forEach((e, i) => {
        const c = document.createElement("button");
        c.type = "button";
        c.className = "lc g-" + e.g + " lc-tree";
        c.innerHTML = libTreeCard(e);
        c.setAttribute("aria-label", "Ver árvore de " + e.name);
        c.onclick = () => openTreeDet(i);
        grid.appendChild(c);
      });
    } else if (isHeroes) {
      libTreeList = [];
      libList = libHeroEntries();
      libList.forEach((e, i) => {
        const c = document.createElement("button");
        c.type = "button";
        c.className = "lc g-h" + (e.locked ? " lc-locked" : "");
        c.innerHTML = libCard(e);
        c.setAttribute("aria-label", "Ver herói " + e.name);
        c.onclick = () => openLibDet(i);
        grid.appendChild(c);
      });
    } else {
      libList = libEntries().filter((e) =>
        isSkills
          ? (e.g === "w" || e.g === "p" || e.g === "a") &&
          (libFilter === "all" || e.g === libFilter)
          : libTab === 2
            ? e.g === "d"
            : e.g === "b",
      );
      libTreeList = [];
      libList.forEach((e, i) => {
        const c = document.createElement("button");
        c.type = "button";
        c.className = "lc g-" + e.g;
        c.innerHTML = libCard(e);
        c.onclick = () => openLibDet(i);
        grid.appendChild(c);
      });
    }
  }
  function libDetail(e) {
    const st = [],
      evo = [];
    let tip = "";
    if (e.g === "w") {
      const W = WEAPONS[e.id];
      st.push(["Nível máximo", MAXW]);
      for (const [k, v] of Object.entries(W.base))
        if (typeof v === "number") st.push([LBL2[k] || k, +v.toFixed(2)]);
      W.up.forEach((u, j) => evo.push(["Nv " + (j + 2), u.d]));
      tip = LIB_TIP[e.id];
    } else if (e.g === "p") {
      st.push(
        ["Nível máximo", passiveMaxLevel(e.id)],
        ["Espaços de dom", SLOT_P + " por partida"],
        ["Categoria", CAT[e.id]],
      );
      evo.push(["Cada nível", "Acumula: " + PASSIVES[e.id].desc]);
      tip = LIB_TIP[e.id];
    } else if (e.g === "a") {
      const A = ACT[e.id];
      st.push(
        ["Recarga", A.cd + " s"],
        ["Nível máximo", MAXA],
        ["Categoria", CAT[e.id]],
      );
      evo.push(["Cada nível", A.up]);
      tip = LIB_TIP[e.id];
    } else if (e.g === "d") {
      const T = ET[e.id];
      st.push(
        ["Vida", T.hp],
        ["Dano", T.dmg],
        ["Velocidade", T.spd],
        ["Tamanho", T.r],
        [
          "Surge",
          T.from >= 9999 ? "a cada 70 s desde 1:40" : "aos " + fmt(T.from),
        ],
        ["Movimento", MV_TXT[T.mv]],
        ["Habilidade", AB_TXT[T.ab] || "—"],
      );
      if (T.rangedAttack && T.rangedAttack.behavior === "poison_flask") {
        st.push(
          [
            "Alcance do frasco",
            T.rangedAttack.minRange + "–" + T.rangedAttack.maxRange,
          ],
          ["Dano de impacto", T.rangedAttack.damage],
          ["Intervalo do frasco", T.rangedAttack.interval.join("–") + " s"],
          ["Veneno", "5 de dano a cada 0,9 s por 3 s"],
        );
      }
      evo.push(["Vida", "Cresce com o tempo de partida (×(1 + tempo/200))."]);
      tip = LIB_TIP[e.id];
    } else if (e.g === "h") {
      const H = e.H,
        X = e.X;
      st.push(
        ["Salvação", H.hp],
        ["Velocidade", H.spd],
        ["Dano", Math.round((H.dmg || 1) * 100) + "%"],
        ["Fé ganha", Math.round((H.xp || 1) * 100) + "%"],
        ["Coleta", Math.round((H.pickup || 1) * 100) + "%"],
        ["Alcance", HRNG[e.id] || 90],
      );
      evo.push([
        "Arma inicial",
        e.startName + (H.startLvl ? " · já no nível " + H.startLvl : ""),
      ]);
      evo.push(["Bônus", H.bonus || "—"]);
      evo.push(["Graça", e.graceN + (e.graceD ? " — " + e.graceD : "")]);
      if (X.perks && X.perks.length)
        X.perks.forEach((p, i) =>
          evo.push([
            "Maestria M" + (i + 2),
            p[0] + " · " + p[1] + (MQ[i] ? " · " + MQ[i] : ""),
          ]),
        );
      else if (X.ch) evo.push(["Maestria", "Sem maestria (herói de desafio)"]);
      evo.push(["Como desbloquear", e.unlock]);
    } else {
      const B = BOSSES[e.id];
      st.push(
        ["Chega aos", fmt(BOSS_T[e.id])],
        ["Vida", B.hp + " (+até 35% pela sua build)"],
        ["Dano", B.dmg],
        ["Velocidade", B.spd],
        ["Arena", ARENA(e.id) * 2 + " px"],
      );
      BOSS_PAT[e.id].forEach((k) => evo.push([BPN[k], BPD[k]]));
      evo.push(["Recompensa", "Arca da Aliança (cartas mais raras)"]);
      tip = BOSS_TIP[e.id];
    }
    return { st, evo, tip };
  }
  const LIBD = document.createElement("div");
  LIBD.id = "libDet";
  LIBD.className = "ov library-detail-overlay";
  LIBD.hidden = true;
  gameEl.appendChild(LIBD);
  function bindLibDetailNavigation() {
    LIBD.querySelectorAll(".ld-nav").forEach(
      (x) =>
      (x.onclick = (ev) => {
        ev.stopPropagation();
        const d = +x.dataset.d;
        if (libDetailMode === "tree") openTreeDet(libTreeIdx + d);
        else openLibDet(libIdx + d);
      }),
    );
    const close = LIBD.querySelector(".ld-x");
    if (close) close.onclick = closeLibDet;
    LIBD.hidden = false;
    resetScrollTree(LIBD);
  }
  function openLibDet(i) {
    libDetailMode = "skill";
    libIdx = (i + libList.length) % libList.length;
    const e = libList[libIdx],
      D = libDetail(e);
    const lab =
      e.g === "b"
        ? "Ataques"
        : e.g === "d"
          ? "Sobre"
          : e.g === "h"
            ? "Perfil"
            : "Evolução";
    const sub =
      e.g === "h"
        ? e.locked
          ? '<span class="uic i-lock"></span> Bloqueado · ' + e.tag
          : e.tag + " · Maestria Nv " + mlv(e.id)
        : e.tag;
    const bodyExtra =
      e.g === "h"
        ? '<div class="ld-hero-grid">' +
        '<div class="ld-hero-block"><h4>ARMA INICIAL</h4><div class="ld-hero-weapon">' +
        (e.startId && WEAPONS[e.startId]
          ? '<img alt="" src="' + iconURL(e.startId) + '"> '
          : "") +
        e.startName +
        (e.H.startLvl ? " <em>Nv " + e.H.startLvl + "</em>" : "") +
        '</div><div class="ld-hero-muted">' +
        (e.H.bonus || "") +
        "</div></div>" +
        '<div class="ld-hero-block"><h4>GRAÇA PESSOAL</h4><b>' +
        e.graceN +
        '</b><div class="ld-hero-muted">' +
        e.graceD +
        "</div></div>" +
        '<div class="ld-hero-block"><h4>MAESTRIA</h4>' +
        (e.X.ch
          ? '<b>Sem maestria</b><div class="ld-hero-muted">Herói de desafio — sem bônus de classe.</div>'
          : e.X.perks && e.X.perks.length
            ? '<ol class="ld-hero-perks">' +
            e.X.perks
              .map(
                (p, j) =>
                  "<li><b>M" +
                  (j + 2) +
                  " · " +
                  p[0] +
                  "</b> " +
                  p[1] +
                  (MQ[j] ? "<small>" + MQ[j] + "</small>" : "") +
                  "</li>",
              )
              .join("") +
            "</ol>"
            : '<div class="ld-hero-muted">—</div>') +
        "</div>" +
        '<div class="ld-hero-block"><h4>COMO DESBLOQUEAR</h4><b class="ld-hero-gold">' +
        e.unlock +
        "</b></div>" +
        "</div>"
        : "<h4>" +
        lab.toUpperCase() +
        "</h4><ol>" +
        D.evo
          .map((r) => "<li><b>" + r[0] + "</b> " + r[1] + "</li>")
          .join("") +
        "</ol>" +
        (D.tip ? '<div class="ld-tip"><b>Dica:</b> ' + D.tip + "</div>" : "");
    LIBD.innerHTML =
      '<div class="ld-wrap' +
      (e.g === "h" ? " ld-wrap-hero" : "") +
      '"><button type="button" class="lc ld-card g-' +
      e.g +
      (e.locked ? " lc-locked" : "") +
      '" tabindex="-1">' +
      libCard(e) +
      '</button><div class="ld-info"><h3>' +
      e.name +
      (e.ref ? "<small>" + e.ref + "</small>" : "") +
      '</h3><div class="ld-sub">' +
      sub +
      "</div><p>" +
      e.desc +
      "</p>" +
      '<h4>ATRIBUTOS</h4><div class="ld-stats">' +
      D.st
        .map((r) => "<div><span>" + r[0] + "</span><b>" + r[1] + "</b></div>")
        .join("") +
      "</div>" +
      bodyExtra +
      "</div></div>" +
      '<button type="button" class="mb ld-nav ld-prev" data-d="-1" aria-label="Anterior"><span class="uic i-left"></span></button><button type="button" class="mb ld-nav ld-next" data-d="1" aria-label="Próximo"><span class="uic i-right"></span></button><button type="button" class="mb ld-x ld-closed" aria-label="Fechar"><span class="uic i-close"></span></button><div class="ld-close">Toque fora da carta para fechar</div>';
    bindLibDetailNavigation();
    mountLibArt(e);
  }
  function openTreeDet(i) {
    libDetailMode = "tree";
    libTreeIdx = (i + libTreeList.length) % libTreeList.length;
    const e = libTreeList[libTreeIdx],
      paths = Object.entries(e.paths || {}),
      category =
        e.g === "w" ? "Arma" : e.g === "p" ? "Dom" : "Habilidade ativa";
    const branches = paths
      .map(
        ([key, path], n) =>
          '<article class="lt-branch lt-' +
          e.g +
          '" style="--evo-color:' +
          evoAccent(e.id, key, false) +
          '">' +
          '<div class="lt-path-head"><div class="lt-path-icon"><img alt="Ícone do caminho ' +
          path.name +
          '" src="' +
          iconURL(e.id) +
          '"></div><div class="lt-path-copy"><div class="lt-branch-kicker">CAMINHO ' +
          (n + 1) +
          " · EVOLUÇÃO</div>" +
          "<h4>" +
          path.name +
          "</h4>" +
          (path.ref ? '<div class="lt-ref">' + path.ref + "</div>" : "") +
          "</div></div>" +
          "<p>" +
          path.desc +
          "</p>" +
          '<div class="lt-link"><span aria-hidden="true">↓</span> DESPERTA A MAESTRIA</div>' +
          '<div class="lt-mastery is-mastered"><div class="lt-master-icon"><img alt="Ícone de Maestria ' +
          path.node.name +
          '" src="' +
          iconURL(e.id) +
          '"></div><div class="lt-master-copy"><span class="lt-master-ribbon">✦ MAESTRIA LENDÁRIA ✦</span><b>' +
          path.node.name +
          "</b>" +
          (path.node.ref ? "<small>" + path.node.ref + "</small>" : "") +
          "<p>" +
          path.node.desc +
          "</p></div></div>" +
          "</article>",
      )
      .join("");
    const unlock = ("A árvore é desbloqueada ao atingir o nível máximo (" + (e.max) + ") de " + (e.name) + ". Escolha apenas um dos três caminhos nesta partida. Depois, a carta de Maestria desse caminho volta às escolhas seguintes até ser selecionada.");
    LIBD.innerHTML =
      '<div class="ld-tree-wrap"><div class="ld-tree-head"><div class="lt-title-art"><img alt="" src="' +
      e.img() +
      '"></div><div class="ld-tree-title"><div class="ld-sub">' +
      category +
      " · PRÉVIA DA ÁRVORE</div><h3>" +
      e.name +
      (e.ref ? "<small>" + e.ref + "</small>" : "") +
      "</h3><p>" +
      e.desc +
      '</p><div class="lt-unlock"><b>Como desbloquear</b><span>' +
      unlock +
      '</span></div></div></div><div class="lt-branches-title"><h4>ESCOLHA SEU CAMINHO</h4><span>3 rotas · 1 escolha por partida</span></div><div class="lt-branches">' +
      branches +
      '</div><div class="lt-footnote">Esta é uma biblioteca de consulta. As melhorias são aplicadas durante a partida quando você escolhe as cartas correspondentes.</div></div>' +
      '<button type="button" class="mb ld-nav ld-prev" data-d="-1" aria-label="Anterior"><span class="uic i-left"></span></button><button type="button" class="mb ld-nav ld-next" data-d="1" aria-label="Próximo"><span class="uic i-right"></span></button><button type="button" class="mb ld-x ld-closed" aria-label="Fechar"><span class="uic i-close"></span></button><div class="ld-close">Toque fora para fechar</div>';
    bindLibDetailNavigation();
  }
  /* v0.53: a carta ampliada anima o sprite (herói, demônio ou chefe). Heróis e demônios são ampliados
     por escala inteira (a arte original é pequena); chefes mantêm o tamanho nativo. */
  let libArtTimer = 0;
  function libArtSpec(e) {
    if (e.g === "h") {
      const H = HFR[e.id];
      if (!H || !S.hero[e.id] || S.hero[e.id][0] !== H.base0) return null;
      return { frames: H.idle, fps: H.v2 ? 6 : 2, fit: true };
    }
    if (e.g === "d") {
      const sp = ET[e.id].spr;
      return { frames: EFR[sp] || [S[sp]], fps: 8, fit: true };
    }
    if (e.g === "b") {
      const sp = BOSSES[e.id].spr;
      return { frames: (EA[sp] && EA[sp].loop) || [S[sp]], fps: 9, fit: false };
    }
    return null;
  }
  function mountLibArt(e) {
    clearInterval(libArtTimer);
    libArtTimer = 0;
    const box = LIBD.querySelector(".ld-card .lc-art"),
      spec = box && libArtSpec(e);
    const frames = spec
      ? (spec.frames || []).filter((f) => f && f.c && f.w && f.h)
      : [];
    if (!frames.length) return;
    let mw = 1,
      mh = 1;
    frames.forEach((f) => {
      mw = Math.max(mw, f.w);
      mh = Math.max(mh, f.h);
    });
    const avail = Math.min(box.clientWidth, box.clientHeight) - 8,
      ratio = avail / Math.max(mw, mh);
    const k = spec.fit
      ? ratio >= 2
        ? Math.floor(ratio)
        : Math.max(1, ratio)
      : 1; /* inteiro quando cabe 2x+ (pixel nítido) */
    const cv = document.createElement("canvas");
    cv.className = "lib-art-anim";
    cv.width = Math.round(mw * k);
    cv.height = Math.round(mh * k);
    const g = cv.getContext("2d");
    g.imageSmoothingEnabled = false;
    const draw = (i) => {
      const f = frames[i % frames.length],
        dw = Math.round(f.w * k),
        dh = Math.round(f.h * k);
      g.clearRect(0, 0, cv.width, cv.height);
      g.drawImage(f.c, Math.round((cv.width - dw) / 2), cv.height - dh, dw, dh);
    };
    box.innerHTML = "";
    box.appendChild(cv);
    draw(0);
    if (frames.length < 2) return;
    let n = 0;
    libArtTimer = setInterval(() => {
      if (!cv.isConnected) {
        clearInterval(libArtTimer);
        libArtTimer = 0;
        return;
      }
      draw(++n);
    }, 1000 / spec.fps);
  }
  function closeLibDet() {
    LIBD.hidden = true;
    clearInterval(libArtTimer);
    libArtTimer = 0;
  }
  LIBD.addEventListener("click", (ev) => {
    if (ev.target === LIBD || ev.target.classList.contains("ld-close"))
      closeLibDet();
  });
  addEventListener(
    "keydown",
    (ev) => {
      if (LIBD.hidden) return;
      const k = ev.key;
      if (k === "Escape" || k === "Enter") closeLibDet();
      else if (k === "ArrowLeft") {
        if (libDetailMode === "tree") openTreeDet(libTreeIdx - 1);
        else openLibDet(libIdx - 1);
      } else if (k === "ArrowRight") {
        if (libDetailMode === "tree") openTreeDet(libTreeIdx + 1);
        else openLibDet(libIdx + 1);
      } else return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
    },
    true,
  );
  $("#mRank").insertAdjacentHTML(
    "afterend",
    '<button class="mb" id="mLib">Biblioteca</button>',
  );
  $("#mLib").onclick = () => scr("Biblioteca", renderLib);

  /* ================= v0.11: mira manual, chefes com habilidades, arena ================= */
  const isTouch = matchMedia("(pointer:coarse)").matches;
  const ARENA = (i) => (125 + 10 * i) * 2; // meia-lateral do quadrado, em px (ajuste o fator 2 aqui)
  const SCAT = 0.2,
    F2_MAP = 0.012; // fé espalhada no mapa: fração mantida de f1 (−80%) e chance de f2 por região
  save.set.sound = 1;
  save.set.music = 1;
  if (save.set.atk == null) save.set.atk = 0;
  if (!save.set.atkInit) {
    save.set.atkInit = 1;
    if (isTouch) save.set.atk = 1;
    persist();
  } // padrão manual no celular
  const manualOn = () => save.set.atk === 1;
  const atkLbl = () => "Ataque: " + (save.set.atk ? "Manual" : "Automático");
  function toggleAtk() {
    save.set.atk = save.set.atk ? 0 : 1;
    persist();
    const b = $("#atkBtn");
    if (b) b.textContent = atkLbl();
  }
  const AIM = { sx: 240, sy: 135, down: false, pending: false };
  function setAim(e) {
    const r = cv.getBoundingClientRect();
    AIM.sx = ((e.clientX - r.left) / r.width) * VW;
    AIM.sy = ((e.clientY - r.top) / r.height) * VH;
  }
  cv.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") setAim(e);
  });
  cv.addEventListener("contextmenu", (e) => {
    if (manualOn()) e.preventDefault();
  });
  addEventListener("pointerup", (e) => {
    if (e.pointerType === "mouse" && e.button === 0) AIM.down = false;
  });
  addEventListener("blur", () => {
    AIM.down = false;
  });
  $("#muteBtn").style.display = "none";
  let MANUAL = null;
  const _nl = nearestList;
  nearestList = function (x, y, range, n) {
    if (!MANUAL) return _nl(x, y, range, n);
    if (!MANUAL.fire) return [];
    const p = G.p,
      o = [];
    for (const e of G.enemies) {
      if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > range + e.r) continue;
      const d = Math.hypot(e.x - MANUAL.x, e.y - MANUAL.y);
      if (d < 70) o.push([d, e]);
    }
    o.sort((a, b) => a[0] - b[0]);
    const r = o.slice(0, n).map((q) => q[1]);
    if (!r.length)
      r.push({ x: MANUAL.x, y: MANUAL.y, ph: true, dead: false, r: 4 });
    return r;
  };
  const _uwM = updWeapons;
  updWeapons = function (dt) {
    if (G && G.dying) return;
    MANUAL = manualOn()
      ? { x: camx + AIM.sx, y: camy + AIM.sy, fire: AIM.down || AIM.pending }
      : null;
    _uwM(dt);
    AIM.pending = false;
    MANUAL = null;
  };
  /* chefes */
  const BOSS_PAT = BOSS_DEFS.map((b) => b.patterns);
  const BPN = FE_CONTENT.bossPatternNames;
  const orb = (e, a, v) =>
    G.eshots.push({
      x: e.x,
      y: e.y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      r: 3,
      dmg: e.dmg,
      life: 6,
      dead: false,
      src: e,
    });
  function segD(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1,
      dy = y2 - y1;
    let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1);
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  }
  function clampArena(o, pad) {
    const A = G.arena,
      R = A.r - pad;
    o.x = Math.max(A.x - R, Math.min(A.x + R, o.x));
    o.y = Math.max(A.y - R, Math.min(A.y + R, o.y));
  }
  function bossMove(e, vx, vy) {
    const a = e.act;
    if (a.k === "dash")
      return a.t < a.tel
        ? [0, 0]
        : [Math.cos(a.ang) * 300, Math.sin(a.ang) * 300];
    if (a.k === "spiral") return [vx * 0.3, vy * 0.3];
    return [0, 0];
  }
  function cone(e, ang) {
    const n = 5 + e.idx;
    for (let i = 0; i < n; i++) orb(e, ang + (i - (n - 1) / 2) * 0.17, 92);
  }
  function bossAI(e, dt, dx, dy) {
    const g = G,
      ang = Math.atan2(dy, dx),
      cd = () => Math.max(1.3, 2.6 - e.idx * 0.25);
    if (e.act) {
      const a = e.act;
      a.t += dt;
      if (a.k === "dash") {
        if (a.t >= a.tel + a.dur) {
          e.act = null;
          e.atk = cd();
        }
      } else if (a.k === "beam") {
        if (
          a.t >= a.tel &&
          a.t < a.tel + a.dur &&
          segD(
            g.p.x,
            g.p.y,
            e.x,
            e.y,
            e.x + Math.cos(a.ang) * 320,
            e.y + Math.sin(a.ang) * 320,
          ) < 8
        )
          hurtPlayer(e.dmg + HPS, e);
        if (a.t >= a.tel + a.dur) {
          e.act = null;
          e.atk = cd();
        }
      } else if (a.k === "spiral") {
        a.acc += dt;
        while (a.acc > 0.08) {
          a.acc -= 0.08;
          orb(e, a.t * 6, 70);
          orb(e, a.t * 6 + Math.PI, 70);
        }
        if (a.t >= a.dur) {
          e.act = null;
          e.atk = cd();
        }
      } else if (a.k === "blink") {
        if (a.t >= a.tel) {
          burst(e.x, e.y, 14, "#c04dff", 90);
          e.x = a.x;
          e.y = a.y;
          burst(e.x, e.y, 14, "#c04dff", 90);
          cone(e, Math.atan2(g.p.y - e.y, g.p.x - e.x));
          e.act = null;
          e.atk = cd();
        }
      }
    } else {
      e.atk -= dt;
      if (e.atk <= 0) startPat(e, ang, cd());
    }
    if (g.arena) clampArena(e, e.r);
  }
  function startPat(e, ang, cd) {
    const g = G,
      T = g.tel || (g.tel = []),
      L = BOSS_PAT[e.idx];
    let k;
    do k = pick(L);
    while (k === e.lastP && L.length > 1);
    e.lastP = k;
    BTL.bossPattern(e, k);
    if (k === "ring" || k === "cone" || k === "summon" || k === "fire")
      e.castT = g.t;
    switch (k) {
      case "ring": {
        const n = 8 + e.idx * 3,
          off = rng() * 6.28;
        for (let i = 0; i < n; i++) orb(e, off + (i / n) * 6.2832, 58);
        for (let i = -1; i <= 1; i++) orb(e, ang + i * 0.22, 85);
        e.atk = cd;
        break;
      }
      case "cone":
        cone(e, ang);
        e.atk = cd;
        break;
      case "summon": {
        const t = e.idx >= 2 ? "bomber" : "imp",
          n = scaledEventCount(e.idx >= 2 ? 3 : 6);
        for (let i = 0; i < n; i++) spawnEnemy(t, rng() * 6.2832, 110);
        toast("Os demônios são chamados!");
        e.atk = cd;
        break;
      }
      case "fire": {
        for (let i = 0; i < 6; i++) {
          const a = rng() * 6.2832,
            r = i ? rnd(20, 75) : 0;
          let x = g.p.x + Math.cos(a) * r,
            y = g.p.y + Math.sin(a) * r;
          if (g.arena) {
            const o = { x, y };
            clampArena(o, 8);
            x = o.x;
            y = o.y;
          }
          T.push({
            k: "circ",
            x,
            y,
            r: 20,
            t: 0,
            delay: 0.95,
            life: 1.2,
            dmg: e.dmg,
            done: false,
          });
        }
        e.atk = cd;
        break;
      }
      case "dash":
        e.act = { k: "dash", t: 0, tel: 0.65, dur: 0.5, ang };
        T.push({
          k: "line",
          x: e.x,
          y: e.y,
          x2: e.x + Math.cos(ang) * 250,
          y2: e.y + Math.sin(ang) * 250,
          w: 7,
          t: 0,
          delay: 0.65,
          life: 0.65,
        });
        break;
      case "beam":
        e.act = { k: "beam", t: 0, tel: 0.9, dur: 0.4, ang };
        T.push({
          k: "line",
          x: e.x,
          y: e.y,
          x2: e.x + Math.cos(ang) * 320,
          y2: e.y + Math.sin(ang) * 320,
          w: 5,
          t: 0,
          delay: 0.9,
          life: 1.3,
          live: true,
        });
        break;
      case "blink": {
        const a = rng() * 6.2832,
          o = { x: g.p.x + Math.cos(a) * 100, y: g.p.y + Math.sin(a) * 100 };
        if (g.arena) clampArena(o, e.r + 6);
        e.act = { k: "blink", t: 0, tel: 0.55, x: o.x, y: o.y };
        T.push({
          k: "circ",
          x: o.x,
          y: o.y,
          r: 14,
          t: 0,
          delay: 0.55,
          life: 0.6,
          dmg: 0,
          done: true,
        });
        break;
      }
      case "spiral":
        e.act = { k: "spiral", t: 0, dur: 2.2, acc: 0 };
        break;
    }
  }
  const _upd = update;
  update = function (dt) {
    _upd(dt);
    const g = G;
    if (!g || state !== "play" || g.resumeT > 0 || !g.tel) return;
    for (const f of g.tel) {
      f.t += dt;
      if (f.k === "circ" && !f.done && f.t >= f.delay) {
        f.done = true;
        burst(f.x, f.y, 12, "#ff9a2a", 90);
        g.shake = Math.max(g.shake, 0.15);
        if (f.dmg && Math.hypot(g.p.x - f.x, g.p.y - f.y) < f.r + 4)
          hurtPlayer(f.dmg, f.who || "Chamas do chefe");
      }
    }
    g.tel = g.tel.filter((f) => f.t < f.life);
  };

  /* Borda da arena do chefe: muralha de chamas espirituais (vermelho, laranja, amarelo e branco) com faíscas */
  function drawArenaBorder(g) {
    const A = g.arena;
    if (!A) return;
    const x = sx(A.x - A.r),
      y = sy(A.y - A.r),
      w = A.r * 2,
      h = A.r * 2,
      tm = g.t,
      fx = FXQ();
    const hash = (n) => {
      const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
      return v - Math.floor(v);
    };
    ctx.save();
    /* exterior escurecido */
    ctx.fillStyle = "rgba(10, 2, 8, .58)";
    ctx.beginPath();
    ctx.rect(0, 0, VW, VH);
    ctx.rect(x, y, w, h);
    ctx.fill("evenodd");
    /* halo quente (brasa) em volta da arena */
    const pulse = 0.75 + 0.25 * Math.sin(tm * 5);
    if (fx) {
      ctx.shadowColor = "rgba(255, 90, 20, .7)";
      ctx.shadowBlur = 16;
      ctx.strokeStyle = "rgba(255, 70, 20," + (0.22 * pulse).toFixed(3) + ")";
      ctx.lineWidth = 9;
      ctx.strokeRect(x, y, w, h);
      ctx.shadowColor = "rgba(255, 200, 80, .6)";
      ctx.shadowBlur = 8;
      ctx.strokeStyle = "rgba(255, 190, 70," + (0.18 * pulse).toFixed(3) + ")";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;
    }
    /* lados: início, direção da borda e normal apontando para dentro da arena */
    const sides = [
      [x, y, 1, 0, 0, 1, w],
      [x + w, y, 0, 1, -1, 0, h],
      [x + w, y + h, -1, 0, 0, -1, w],
      [x, y + h, 0, -1, 1, 0, h],
    ];
    const M = 36; /* margem de corte fora da tela */
    const STEP = 5;
    const flame = (bx, by, tx, ty, nx, ny, wid, hei, sway, fill) => {
      const tipx = bx + nx * hei + tx * sway,
        tipy = by + ny * hei + ty * sway,
        cxm = nx * hei * 0.55 + tx * sway * 0.35,
        cym = ny * hei * 0.55 + ty * sway * 0.35;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(bx - tx * wid, by - ty * wid);
      ctx.quadraticCurveTo(
        bx - tx * wid * 0.9 + cxm,
        by - ty * wid * 0.9 + cym,
        tipx,
        tipy,
      );
      ctx.quadraticCurveTo(
        bx + tx * wid * 0.9 + cxm,
        by + ty * wid * 0.9 + cym,
        bx + tx * wid,
        by + ty * wid,
      );
      ctx.closePath();
      ctx.fill();
    };
    if (fx) ctx.globalCompositeOperation = "lighter";
    for (let s = 0; s < 4; s++) {
      const [x1, y1, tx, ty, nx, ny, len] = sides[s];
      const n = Math.max(8, Math.floor(len / STEP));
      /* brasa no chão ao longo da borda */
      for (let i = 0; i <= n; i++) {
        const px = x1 + tx * i * STEP,
          py = y1 + ty * i * STEP;
        if (px < -M || px > VW + M || py < -M || py > VH + M) continue;
        const seed = i * 1.37 + s * 17.3;
        const a = 0.5 + 0.5 * Math.sin(tm * 6.3 + seed * 1.7);
        const b = 0.5 + 0.5 * Math.sin(tm * 3.1 + seed * 0.53);
        let H = 5 + 11 * (0.55 * a + 0.45 * b);
        /* línguas altas ocasionais, que pulsam */
        if (hash(seed) > 0.86)
          H *= 1.35 + 0.35 * Math.sin(tm * 4 + seed);
        const sway = Math.sin(tm * 5 + seed * 1.3) * 2.2;
        const al = fx ? 0.78 : 0.95;
        flame(px, py, tx, ty, nx, ny, 3.8, H, sway, "rgba(205, 28, 18," + al + ")");
        flame(px, py, tx, ty, nx, ny, 2.9, H * 0.78, sway * 0.8, "rgba(255, 118, 24," + al + ")");
        if (fx) {
          flame(px, py, tx, ty, nx, ny, 1.9, H * 0.52, sway * 0.55, "rgba(255, 214, 80,.9)");
          if (H > 11)
            flame(px, py, tx, ty, nx, ny, 1, H * 0.28, sway * 0.3, "rgba(255, 250, 226,.95)");
        }
      }
      /* faixa de brasa na base das chamas */
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255, 70, 25," + (0.8 * pulse).toFixed(3) + ")";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + tx * len, y1 + ty * len);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 205, 90," + (0.7 * pulse).toFixed(3) + ")";
      ctx.lineWidth = 1;
      ctx.stroke();
      /* faíscas subindo e flutuando para dentro da arena */
      if (fx) {
        const ns = Math.max(10, Math.floor(len / 12));
        for (let j = 0; j < ns; j++) {
          const sd = j * 3.17 + s * 41.9;
          const cyc = 0.45 + hash(sd) * 0.9; /* velocidade */
          const t = (tm * cyc * 0.55 + hash(sd + 1.3)) % 1;
          const along = hash(sd + 2.1) * len + Math.sin(tm * 2 + sd) * 4 * t;
          const dist = t * (10 + hash(sd + 3.7) * 46);
          const px = x1 + tx * along + nx * dist,
            py = y1 + ty * along + ny * dist - t * 6; /* sobe levemente */
          if (px < -4 || px > VW + 4 || py < -4 || py > VH + 4) continue;
          const c = hash(sd + 5.9);
          const col =
            c < 0.38
              ? "255, 120, 25"
              : c < 0.62
                ? "230, 40, 25"
                : c < 0.82
                  ? "255, 215, 80"
                  : "255, 248, 225";
          ctx.fillStyle = "rgba(" + col + "," + (1 - t).toFixed(3) + ")";
          const sz = t < 0.35 && c > 0.5 ? 2 : 1;
          ctx.fillRect(Math.round(px), Math.round(py), sz, sz);
        }
      }
    }
    ctx.globalCompositeOperation = "source-over";
    /* fio dourado sagrado, mais interno */
    ctx.strokeStyle = "rgba(255, 200, 90, .22)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.lineDashOffset = -tm * 8;
    ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
    ctx.setLineDash([]);
    ctx.restore();
  }
  function drawOverlay() {
    const g = G;
    if (!g) return;
    if (g.low && !g.dying && !g.dawn && save.set.fx) {
      const a = 0.16 + 0.1 * Math.sin(g.t * 6),
        gr = ctx.createRadialGradient(
          VW / 2,
          VH / 2,
          VH * 0.3,
          VW / 2,
          VH / 2,
          VW * 0.65,
        );
      gr.addColorStop(0, "rgba(180,20,40,0)");
      gr.addColorStop(1, "rgba(180,20,40," + a + ")");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, VW, VH);
    }
    if (g.arena && g.boss) drawArenaBorder(g);
    for (const f of g.tel || []) {
      ctx.save();
      if (f.k === "circ") {
        if (f.t < f.delay) {
          ctx.globalAlpha = 0.3 + 0.25 * Math.sin(f.t * 20);
          ctx.fillStyle = "#ff6a2a";
          ctx.beginPath();
          ctx.arc(sx(f.x), sy(f.y), f.r, 0, 6.2832);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "#ffd27a";
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (f.dmg) {
          ctx.globalAlpha =
            Math.max(0, 1 - (f.t - f.delay) / (f.life - f.delay)) * 0.7;
          ctx.fillStyle = "#ffd27a";
          ctx.beginPath();
          ctx.arc(sx(f.x), sy(f.y), f.r, 0, 6.2832);
          ctx.fill();
        }
      } else if (f.t < f.delay) {
        ctx.strokeStyle = "rgba(255,90,60,.6)";
        ctx.lineWidth = f.w * 0.6;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(sx(f.x), sy(f.y));
        ctx.lineTo(sx(f.x2), sy(f.y2));
        ctx.stroke();
      } else if (f.live) {
        ctx.strokeStyle = "#ff4a2a";
        ctx.lineWidth = f.w * 1.8;
        ctx.beginPath();
        ctx.moveTo(sx(f.x), sy(f.y));
        ctx.lineTo(sx(f.x2), sy(f.y2));
        ctx.stroke();
        ctx.strokeStyle = "#fff3a0";
        ctx.lineWidth = f.w * 0.8;
        ctx.stroke();
      }
      ctx.restore();
    }
    const man = manualOn() && state === "play" && (!isTouch || AIM.down);
    cv.style.cursor = man ? "none" : "";
    if (man) {
      const x = Math.round(AIM.sx),
        y = Math.round(AIM.sy);
      ctx.save();
      ctx.strokeStyle = "rgba(255,243,160,.3)";
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(sx(g.p.x), sy(g.p.y));
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "#140b22";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 6.2832);
      ctx.moveTo(x - 9, y);
      ctx.lineTo(x - 3, y);
      ctx.moveTo(x + 3, y);
      ctx.lineTo(x + 9, y);
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x, y - 3);
      ctx.moveTo(x, y + 3);
      ctx.lineTo(x, y + 9);
      ctx.stroke();
      ctx.strokeStyle = AIM.down ? "#ff6a2a" : "#fff3a0";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }
  const _dw = draw;
  draw = function () {
    const g = G,
      D = g && g.dying,
      W = g && g.dawn;
    if (D) {
      const z = 1 + 2.2 * (1 - Math.pow(1 - Math.min(1, D.t / 3), 3)),
        cx = sx(g.p.x),
        cy = sy(g.p.y);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(z, z);
      ctx.translate(-cx, -cy);
    } else if (W) {
      const z = 1 + 0.6 * W.k,
        cx = sx(g.p.x),
        cy = sy(g.p.y);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(z, z);
      ctx.translate(-cx, -cy);
    }
    _dw();
    drawOverlay();
    if (D) {
      for (const q of D.dust) {
        ctx.globalAlpha = Math.max(0, q.a);
        ctx.fillStyle = q.col;
        ctx.fillRect(sx(q.x), sy(q.y), 1, 1);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      const gr = ctx.createRadialGradient(
        VW / 2,
        VH / 2,
        18,
        VW / 2,
        VH / 2,
        Math.max(VW, VH) * 0.65,
      );
      gr.addColorStop(0, "rgba(0,0,0,0)");
      gr.addColorStop(1, "rgba(0,0,0," + Math.min(0.85, D.t * 0.2) + ")");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, VW, VH);
    } else if (W) {
      dawnWorld(W, g);
      ctx.restore();
      dawnScreen(W);
    }
  };
  /* ===== amanhecer (vitória): a noite se dissolve em luz, os demônios viram faíscas e a névoa some ===== */
  const DAWN_DUR = 7.4;
  function dawnK() {
    return G && G.dawn ? G.dawn.k : 0;
  }
  function dawnWorld(W, g) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const px = sx(g.p.x),
      py = sy(g.p.y),
      hr = ctx.createRadialGradient(px, py, 2, px, py, 46);
    hr.addColorStop(0, "rgba(255,236,170," + 0.55 * W.k + ")");
    hr.addColorStop(1, "rgba(255,200,100,0)");
    ctx.fillStyle = hr;
    ctx.fillRect(px - 50, py - 50, 100, 100);
    ctx.fillStyle = "#ffe9a0";
    for (const q of W.motes) {
      ctx.globalAlpha = Math.max(0, q.a) * 0.9;
      ctx.fillRect(sx(q.x), sy(q.y), q.s, q.s);
    }
    ctx.restore();
  }
  /* v0.49: o texto do amanhecer agora é HTML (#dawnTxt), não canvas. Assim ele usa --f-title/--f-body (acompanha "Fonte do sistema"),
     fica nítido na resolução do aparelho e ganha o fundo escuro do CSS para ler sobre a luz forte. */
  const dawnTxtEl = $("#dawnTxt");
  function dawnText(a) {
    if (!dawnTxtEl) return;
    const on = a > 0.01;
    if (dawnTxtEl.hidden === on) dawnTxtEl.hidden = !on;
    if (on) dawnTxtEl.style.opacity = a.toFixed(3);
  }
  function dawnScreen(W) {
    const k = W.k;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = "rgba(255,190,110," + 0.34 * k + ")";
    ctx.fillRect(0, 0, VW, VH);
    const gx = VW / 2,
      gy = -VH * 0.1,
      gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, VW * 0.8);
    gr.addColorStop(0, "rgba(255,250,210," + 0.95 * k + ")");
    gr.addColorStop(0.3, "rgba(255,214,130," + 0.5 * k + ")");
    gr.addColorStop(1, "rgba(255,160,80,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, VW, VH);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255,232,170," + 0.06 * k + ")";
    for (let i = 0; i < 9; i++) {
      const a = Math.PI / 2 + (i - 4) * 0.17 + Math.sin(W.t * 0.5 + i) * 0.03,
        L = VH * 2.2;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + Math.cos(a - 0.045) * L, gy + Math.sin(a - 0.045) * L);
      ctx.lineTo(gx + Math.cos(a + 0.045) * L, gy + Math.sin(a + 0.045) * L);
      ctx.fill();
    }
    ctx.restore();
    dawnText(
      state === "dawning" && W.t > 1.8 ? clamp((W.t - 1.8) / 1.2, 0, 1) : 0,
    );
  }
  function startDawn() {
    const g = G;
    state = "dawning";
    g.dawn = { t: 0, k: 0, motes: [] };
    g.pending.length = 0;
    $("#lvlup").hidden = true;
    $("#hud").hidden = true;
    $("#stick").hidden = true;
    gameEl.classList.add("dying");
    g.fx = g.fx.filter((f) => f.k !== "dmg" && f.k !== "txt");
    g.eshots.length = 0;
    stick.on = false;
    AIM.down = false;
    g.shake = 0;
    SFX.play("trumpet");
  }
  function dawnTick(dt) {
    const g = G,
      D = g.dawn;
    D.t += dt;
    for (const k in keys) keys[k] = false;
    stick.on = false;
    const kk = clamp((D.t - 0.4) / 5.4, 0, 1);
    D.k = 1 - Math.pow(1 - kk, 2);
    if (!D.snd && D.t > 1.4) {
      D.snd = 1;
      SFX.play("win");
    }
    for (const e of g.enemies) {
      if (e.dead) continue;
      if (e.ds == null) e.ds = e.boss ? 0.3 : rndFx(0.3, 3.4);
      if (D.t >= e.ds) {
        e.al = Math.max(0, (e.al == null ? 1 : e.al) - dt * 2.2);
        e.flash = 0.05;
        if (!e.sp) {
          e.sp = 1;
          burst(e.x, e.y, e.boss ? 40 : 6, "#fff0b0", e.boss ? 120 : 50);
        }
        if (e.al <= 0) e.dead = true;
      }
    }
    g.enemies = g.enemies.filter((e) => !e.dead);
    if (D.k > 0.15 && rngFx() < dt * 40 * D.k)
      D.motes.push({
        x: camx + rndFx(0, VW),
        y: camy + VH + 4,
        vy: -rndFx(14, 34),
        vx: rndFx(-6, 6),
        life: rndFx(2, 4),
        a: 1,
        s: rngFx() < 0.3 ? 2 : 1,
      });
    for (const q of D.motes) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.life -= dt;
      q.a = Math.min(1, q.life);
    }
    D.motes = D.motes.filter((q) => q.life > 0);
    for (const q of g.parts) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 0.94;
      q.vy *= 0.94;
      q.life -= dt;
    }
    g.parts = g.parts.filter((q) => q.life > 0);
    for (const f of g.fx) f.t += dt;
    g.fx = g.fx.filter((f) => f.t < f.life);
    if (D.t >= DAWN_DUR) finishDawn();
  }
  function finishDawn() {
    const g = G;
    g.t = Math.max(g.t, WIN_T);
    gameEl.classList.remove("dying");
    g.enemies.length = 0;
    if (TUT.on) TUT.done();
    else _erD(true);
  }
  /* morte: câmera lenta, zoom e o herói vira poeira ao vento */
  /* Static CSS moved to style.css. */
  const _erD = endRun;
  endRun = function (won, ret) {
    if (state === "dying" || state === "dawning") return;
    if (!won && !ret && G && !G.over && state === "play") {
      startDeath();
      return;
    }
    if (
      won &&
      !ret &&
      G &&
      !G.over &&
      (state === "play" || state === "levelup")
    ) {
      startDawn();
      return;
    }
    return _erD(won, ret);
  };
  function startDeath() {
    const g = G;
    state = "dying";
    g.dying = { t: 0, t0: g.t, c: false, dust: [] };
    $("#hud").hidden = true;
    $("#stick").hidden = true;
    gameEl.classList.add("dying");
    g.fx = g.fx.filter((f) => f.k !== "dmg" && f.k !== "txt");
    stick.on = false;
    SFX.play("hurt");
  }
  function deathTick(dt) {
    const g = G,
      D = g.dying;
    D.t += dt;
    for (const k in keys) keys[k] = false;
    stick.on = false;
    update(dt * 0.25);
    if (!D.c && D.t >= 0.8) {
      D.c = true;
      const sp = S.hero[g.hk][0],
        w = sp.w,
        h = sp.h,
        px = (() => {
          try {
            return sp.c.getContext("2d").getImageData(0, 0, w, h).data;
          } catch (e) {
            return new Uint8ClampedArray(w * h * 4);
          }
        })(),
        fl = g.p.face < 0;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (px[i + 3] < 128) continue;
          D.dust.push({
            x: g.p.x - w / 2 + (fl ? w - 1 - x : x),
            y: g.p.y - h / 2 + y,
            col: "rgb(" + px[i] + "," + px[i + 1] + "," + px[i + 2] + ")",
            d: D.t + (y / h) * 1.8 + rngFx() * 0.5,
            vx: 0,
            vy: 0,
            a: 1,
            life: rndFx(1.4, 2.6),
            on: false,
          });
        }
      D.sw = S.hero[g.hk];
      const bl = { c: mk(w, h, () => { }), f: mk(w, h, () => { }), w, h };
      S.hero[g.hk] = [bl, bl];
    }
    for (const q of D.dust) {
      if (!q.on) {
        if (D.t >= q.d) {
          q.on = true;
          q.vx = rndFx(35, 115);
          q.vy = rndFx(-50, 6);
        }
        continue;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt + Math.sin(D.t * 9 + q.x * 0.3) * 0.25;
      q.a -= dt / q.life;
    }
    if (D.t >= 6.2) {
      if (D.sw) S.hero[g.hk] = D.sw;
      g.t = D.t0;
      g.dying = null;
      gameEl.classList.remove("dying");
      snapPre(g);
      _erD(false);
    }
  }

  /* ================= v0.14: desbloqueio de heróis por anúncios e moedas ================= */
  const HU = FE_CONTENT.heroShop; // registros de compra definidos no Content Registry
  save.adw = save.adw || {};
  for (const k in UNL) delete UNL[k];

  for (const k in HU)
    Object.defineProperty(HX[k], "quest", {
      get: () =>
        HU[k].ads
          ? "Assistir " +
          HU[k].ads +
          " anúncios (" +
          (save.adw[k] || 0) +
          "/" +
          HU[k].ads +
          ")"
          : HU[k].coins + " moedas",
      configurable: true,
    });
  if (HX[selHero] && HX[selHero].locked) {
    selHero = save.hero = "davi";
    persist();
  }
  function unlockHero(k) {
    save.unl[k] = 1;
    selHero = save.hero = k;
    viewHero = k;
    persist();
    updHeroBtn();
    checkAch();
    achPop(
      Object.assign(
        ["u" + k, HX[k].name + " desbloqueado!", "Escolha-o na tela de Herói"],
        { h: "NOVO HERÓI" },
      ),
    );
    SFX.play("level");
  }
  const _rh = renderHeroes;
  renderHeroes = function (b) {
    _rh(b);
    const v = viewHero,
      X = HX[v],
      U = HU[v];
    if (!X || !X.locked || !U) return;
    const row = document.createElement("div");
    row.className = "rw hero-unlock-row";
    const c = save.cst,
      avg = c && c.n ? Math.round(c.s / c.n) : 0;
    const bt = document.createElement("button");
    bt.className = "btn";
    bt.type = "button";
    if (b.id === "prepH") {
      bt.innerHTML = '<span class="uic i-store"></span> Ir à Loja';
      bt.onclick = () => {
        shopSec = "heroes";
        scr("Loja", renderStore);
      };
    } else if (U.ads) {
      bt.innerHTML =
        '<span class="uic i-play"></span> Assistir anúncio (' +
        (save.adw[v] || 0) +
        "/" +
        U.ads +
        ")";
      bt.onclick = () =>
        ADS.rewarded((ok) => {
          if (!ok) return;
          save.adw[v] = (save.adw[v] || 0) + 1;
          if (save.adw[v] >= U.ads) unlockHero(v);
          persist();
          renderHeroes(b);
        });
    } else {
      const lb = "Desbloquear · " + U.coins + " moedas";
      bt.textContent = lb;
      if (save.coins < U.coins) bt.style.opacity = 0.6;
      bt.onclick = () => {
        if (save.coins < U.coins)
          return deny(
            bt,
            "Faltam " +
            (U.coins - save.coins) +
            " moedas para desbloquear " +
            X.name +
            ".",
          );
        if (!bt.dataset.c) {
          bt.dataset.c = 1;
          bt.textContent = "Confirmar compra? (" + U.coins + ")";
          setTimeout(() => {
            if (bt.isConnected) {
              delete bt.dataset.c;
              bt.textContent = lb;
            }
          }, 3000);
          return;
        }
        if (save.coins < U.coins) return;
        save.coins -= U.coins;
        unlockHero(v);
        persist();
        refreshMeta();
        SFX.play("coin");
        buyPop("Herói desbloqueado", X.name + " já está disponível na tela de Herói.");
        renderHeroes(b);
      };
    }
    row.appendChild(bt);
    if (!U.ads)
      row.insertAdjacentHTML(
        "beforeend",
        '<small class="hero-wallet">Você tem ' +
        save.coins +
        " moedas" +
        (avg
          ? " · média de " + avg + " por partida (" + c.n + " partidas)"
          : "") +
        "</small>",
      );
    b.appendChild(row);
  };

  /* ================= v0.15: cartas redesenhadas e modal Como jogar ================= */
  /* Static CSS moved to style.css. */
  const HLP = document.createElement("div");
  HLP.className = "ov help-overlay";
  HLP.hidden = true;
  const K = (...a) => a.map((x) => '<i class="kc">' + x + "</i>").join("");
  const HLP_KEYS =
    '<div class="hr"><b>Mover</b><span>' +
    K("W", "A", "S", "D") +
    "<small>ou setas</small></span></div>" +
    '<div class="hr"><b>Mirar e atacar</b><span>Automático: as armas acertam o demônio mais próximo.<small>Para mirar com o mouse, ative o modo Manual em Configurações e clique.</small></span></div>' +
    '<div class="hr"><b>Habilidade ativa</b><span>' +
    K("Espaço") +
    "<small>usa a habilidade selecionada · " +
    K("Q", "E") +
    " trocam</small></span></div>" +
    '<div class="hr"><b>Escolher bênção</b><span>' +
    K("1", "2", "3") +
    "<small>" +
    "ou clique na carta · Banir remove uma opção desta partida e Pular continua sem escolher; ambos têm usos limitados." +
    "</small></span></div>" +
    '<div class="hr"><b>Pausar</b><span>' +
    K("P") +
    K("Esc") +
    "</span></div>";
  const HLP_TOUCH =
    '<div class="hr"><b>Mover</b><span>Arraste o dedo no <b>lado esquerdo</b> da tela.<small>O joystick aparece onde você toca.</small></span></div>' +
    '<div class="hr"><b>Mirar e atirar</b><span>Arraste no <b>lado direito</b>: a arma mira e atira para onde você arrasta. Um toque atira para a frente.<small>Em Configurações, o Ataque pode ser Automático (toque em qualquer lugar para mover).</small></span></div>' +
    '<div class="hr"><b>Habilidades ativas</b><span>Toque nos botões grandes à direita da tela, perto do polegar.</span></div>' +
    '<div class="hr"><b>Bênçãos</b><span>' +
    "A cada nível, toque na carta que quiser. Use Banir para remover uma opção desta partida ou Pular para continuar sem escolher; ambos têm usos limitados." +
    "</span></div>" +
    '<div class="hr"><b>Pausar</b><span>Botão <i class="kc">II</i> no canto superior ou o botão Voltar do Android.</span></div>';
  const HLP_OBJ =
    '<div class="hg"><b>Objetivo:</b> resista até o amanhecer (ou, na Vigília Eterna, sobreviva o máximo que puder). Sobreviva 10 minutos de noite, derrote demônios para ganhar Fé, escolha uma bênção a cada nível e vença os chefes para ganhar a Arca da Aliança.</div>';
  const IS_PHONE =
    isTouch ||
    !!(
      window.Capacitor &&
      Capacitor.isNativePlatform &&
      Capacitor.isNativePlatform()
    );
  HLP.innerHTML =
    '<div class="ov-in hlp"><h2>Como jogar</h2>' +
    (IS_PHONE ? HLP_TOUCH : HLP_KEYS) +
    HLP_OBJ +
    '<div class="hbtn centered-content"><button id="hOk" class="btn" type="button">Entendi!</button></div></div>';
  gameEl.appendChild(HLP);
  let hCb = null;

  const showHelp = (cb) => {
    hCb = cb || null;
    HLP.hidden = false;
    resetScrollTree(HLP);
    $("#hOk").focus({ preventScroll: true });
  };

  $("#hOk").onclick = () => {
    HLP.hidden = true;
    if (!save.help) {
      save.help = 1;
      persist();
    }
    const f = hCb;
    hCb = null;
    if (f) f();
  };
  addEventListener(
    "keydown",
    (e) => {
      if (!HLP.hidden && (e.key === "Escape" || e.key === "Enter")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        $("#hOk").click();
      }
    },
    true,
  );
  $("#mSet").insertAdjacentHTML(
    "afterend",
    '<button class="mb" id="mHelp">Como jogar</button>',
  );
  $("#mHelp").onclick = () => showHelp();
  $("#playBtn").addEventListener(
    "click",
    (e) => {
      if (!save.help) {
        e.stopImmediatePropagation();
        showHelp(() => $("#playBtn").click());
      }
    },
    true,
  );

  /* ================= v0.16: raridade das cartas (dons, habilidades ativas e bênçãos) ================= */
  const RAR = [
    { n: "Comum", m: 1, c: "#9aa3b5" },
    { n: "Incomum", m: 1.35, c: "#5ec26a" },
    { n: "Rara", m: 1.7, c: "#4aa3ff" },
    { n: "Lendária", m: 2.4, c: "#ff9a2a" },
  ];
  const RAR_W = { lvl: [63, 26, 10, 1], ark: [0, 30, 50, 20] }; // pesos de sorteio por origem (ajuste aqui)
  function rollRar(ark) {
    const base = ark ? RAR_W.ark : RAR_W.lvl,
      luck = Math.max(0, Math.min(0.25, (G && G.mods && G.mods.luck) || 0)),
      w = base.map(
        (value, i) =>
          value * (i === 0 ? 1 - 0.25 * luck : 1 + luck * (0.4 + 0.25 * i)),
      );
    let r = rng() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) {
      if ((r -= w[i]) < 0) return i;
    }
    return 0;
  }
  const scaleDesc = (d, m) =>
    /^\+\d+/.test(d)
      ? d.replace(/\d+/, (n) => Math.round(n * m))
      : d + " · Potência ×" + +m.toFixed(2);
  function effP() {
    const P = {};
    for (const k in G.P) P[k] = G.Pw && G.Pw[k] != null ? G.Pw[k] : G.P[k];
    return P;
  }
  /* Static CSS moved to style.css. */

  /* ================= v0.17: preparação (herói + mundo), ícones de UI, sprites dos chefes, assets ================= */
  const BOSS_VEC = {
    legiao: {
      w: 36,
      h: 34,
      ops: [
        ["#256458", "e", 18, 24, 15, 9],
        ["#3b8f80", "e", 18, 19, 16, 13],
        ["#58c2ae", "e", 9, 14, 8, 7],
        ["#58c2ae", "e", 27, 14, 8, 7],
        ["#58c2ae", "e", 18, 9, 9, 7],
        ["#ffffff", "e", 12, 14, 2.4, 2.4],
        ["#d81e2c", "e", 12, 14.3, 1.2, 1.5],
        ["#ffffff", "e", 18, 9, 2.4, 2.4],
        ["#d81e2c", "e", 18, 9.3, 1.2, 1.5],
        ["#ffffff", "e", 24, 14, 2.4, 2.4],
        ["#d81e2c", "e", 24, 14.3, 1.2, 1.5],
        ["#ffffff", "e", 14, 20, 2.4, 2.4],
        ["#d81e2c", "e", 14, 20.3, 1.2, 1.5],
        ["#ffffff", "e", 22, 20, 2.4, 2.4],
        ["#d81e2c", "e", 22, 20.3, 1.2, 1.5],
        ["#ffffff", "e", 9, 24, 2.4, 2.4],
        ["#d81e2c", "e", 9, 24.3, 1.2, 1.5],
        ["#ffffff", "e", 27, 24, 2.4, 2.4],
        ["#d81e2c", "e", 27, 24.3, 1.2, 1.5],
        ["#0b1f1c", "e", 18, 28, 6, 2.6],
        [
          "#ffffff",
          "p",
          [
            [14, 27],
            [16, 27],
            [15, 29],
          ],
        ],
        [
          "#ffffff",
          "p",
          [
            [20, 27],
            [22, 27],
            [21, 29],
          ],
        ],
      ],
    },
    belzebu: {
      w: 38,
      h: 36,
      ops: [
        [
          "#c9e3f7",
          "p",
          [
            [15, 15],
            [1, 6],
            [3, 22],
            [13, 24],
          ],
        ],
        [
          "#c9e3f7",
          "p",
          [
            [23, 15],
            [37, 6],
            [35, 22],
            [25, 24],
          ],
        ],
        [
          "#8fb6d8",
          "p",
          [
            [14, 22],
            [4, 31],
            [13, 28],
          ],
        ],
        [
          "#8fb6d8",
          "p",
          [
            [24, 22],
            [34, 31],
            [25, 28],
          ],
        ],
        [
          "#2a170d",
          "p",
          [
            [13, 30],
            [8, 35],
            [11, 35],
            [15, 31],
          ],
        ],
        [
          "#2a170d",
          "p",
          [
            [25, 30],
            [30, 35],
            [27, 35],
            [23, 31],
          ],
        ],
        ["#4a2a1a", "e", 19, 24, 8, 10],
        ["#6b3a22", "e", 19, 22, 8, 2],
        ["#6b3a22", "e", 19, 27, 7, 1.6],
        ["#5e341f", "e", 19, 13, 8, 7],
        [
          "#e8d9b0",
          "p",
          [
            [14, 8],
            [11, 0],
            [17, 7],
          ],
        ],
        [
          "#e8d9b0",
          "p",
          [
            [24, 8],
            [27, 0],
            [21, 7],
          ],
        ],
        ["#d92b38", "e", 14, 12, 4, 4.2],
        ["#140b22", "e", 14, 12.2, 1.6, 2.94],
        ["#d92b38", "e", 24, 12, 4, 4.2],
        ["#140b22", "e", 24, 12.2, 1.6, 2.94],
        ["#140b22", "e", 19, 17, 3, 1.6],
        [
          "#d92b38",
          "p",
          [
            [17, 32],
            [19, 36],
            [21, 32],
          ],
        ],
      ],
    },
    abadom: {
      w: 42,
      h: 40,
      ops: [
        [
          "#8a4a1e",
          "p",
          [
            [17, 16],
            [1, 6],
            [3, 26],
            [15, 28],
          ],
        ],
        [
          "#8a4a1e",
          "p",
          [
            [25, 16],
            [41, 6],
            [39, 26],
            [27, 28],
          ],
        ],
        [
          "#b8702e",
          "p",
          [
            [16, 17],
            [5, 10],
            [6, 22],
            [15, 24],
          ],
        ],
        [
          "#b8702e",
          "p",
          [
            [26, 17],
            [37, 10],
            [36, 22],
            [27, 24],
          ],
        ],
        [
          "#6e6a1f",
          "p",
          [
            [14, 20],
            [7, 24],
            [9, 27],
            [15, 24],
          ],
        ],
        [
          "#6e6a1f",
          "p",
          [
            [28, 20],
            [35, 24],
            [33, 27],
            [27, 24],
          ],
        ],
        [
          "#5b2a7a",
          "p",
          [
            [18, 30],
            [21, 40],
            [24, 30],
          ],
        ],
        ["#6e6a1f", "e", 21, 24, 7, 11],
        ["#4a4713", "e", 21, 21, 7, 1.3],
        ["#4a4713", "e", 21, 25, 7, 1.3],
        ["#4a4713", "e", 21, 29, 6, 1.3],
        ["#8c8a2c", "e", 21, 11, 7, 7],
        [
          "#f2c14e",
          "p",
          [
            [15, 7],
            [15, 1],
            [18, 5],
            [21, 0],
            [24, 5],
            [27, 1],
            [27, 7],
          ],
        ],
        ["#ff3b3b", "e", 18, 12, 2.2, 2.4],
        ["#140b22", "e", 18, 12.2, 0.8800000000000001, 1.68],
        ["#ff3b3b", "e", 24, 12, 2.2, 2.4],
        ["#140b22", "e", 24, 12.2, 0.8800000000000001, 1.68],
        ["#140b22", "e", 21, 16.5, 3, 1.5],
      ],
    },
    leviata: {
      w: 46,
      h: 40,
      ops: [
        [
          "#143f7a",
          "p",
          [
            [3, 31],
            [5, 26],
            [7, 31],
          ],
        ],
        [
          "#143f7a",
          "p",
          [
            [8, 31.5],
            [10, 26.5],
            [12, 31.5],
          ],
        ],
        [
          "#143f7a",
          "p",
          [
            [14, 30.5],
            [16, 25.5],
            [18, 30.5],
          ],
        ],
        [
          "#143f7a",
          "p",
          [
            [20, 26],
            [22, 21],
            [24, 26],
          ],
        ],
        [
          "#143f7a",
          "p",
          [
            [22, 20],
            [24, 15],
            [26, 20],
          ],
        ],
        [
          "#143f7a",
          "p",
          [
            [25, 14],
            [27, 9],
            [29, 14],
          ],
        ],
        [
          "#143f7a",
          "p",
          [
            [29, 10],
            [31, 5],
            [33, 10],
          ],
        ],
        ["#3b86d6", "e", 5, 33, 3, 3],
        ["#a9d4ff", "e", 5, 34.05, 1.7999999999999998, 1.5],
        ["#3b86d6", "e", 10, 35, 4.5, 4.5],
        ["#a9d4ff", "e", 10, 36.575, 2.6999999999999997, 2.25],
        ["#3b86d6", "e", 16, 35, 5.5, 5.5],
        ["#a9d4ff", "e", 16, 36.925, 3.3, 2.75],
        ["#3b86d6", "e", 22, 31, 6, 6],
        ["#a9d4ff", "e", 22, 33.1, 3.5999999999999996, 3.0],
        ["#3b86d6", "e", 24, 25, 6, 6],
        ["#a9d4ff", "e", 24, 27.1, 3.5999999999999996, 3.0],
        ["#3b86d6", "e", 27, 19, 6, 6],
        ["#a9d4ff", "e", 27, 21.1, 3.5999999999999996, 3.0],
        ["#3b86d6", "e", 31, 15, 6, 6],
        ["#a9d4ff", "e", 31, 17.1, 3.5999999999999996, 3.0],
        [
          "#143f7a",
          "p",
          [
            [41, 5],
            [46, 0],
            [44, 8],
          ],
        ],
        ["#3b86d6", "e", 37, 11, 8, 6.5],
        [
          "#1f5aa3",
          "p",
          [
            [31, 13],
            [45, 17],
            [43, 21],
            [33, 18],
          ],
        ],
        [
          "#ffffff",
          "p",
          [
            [35, 15],
            [36, 18],
            [37, 15.5],
          ],
        ],
        [
          "#ffffff",
          "p",
          [
            [40, 16],
            [41, 19],
            [42, 16.5],
          ],
        ],
        ["#ffd24a", "e", 40, 9, 2.2, 2.2],
        ["#140b22", "e", 40.3, 9, 0.9, 1.6],
      ],
    },
    dragao: {
      w: 58,
      h: 50,
      ops: [
        [
          "#6e0e1c",
          "p",
          [
            [23, 26],
            [2, 6],
            [6, 28],
            [10, 40],
            [22, 38],
          ],
        ],
        [
          "#6e0e1c",
          "p",
          [
            [35, 26],
            [56, 6],
            [52, 28],
            [48, 40],
            [36, 38],
          ],
        ],
        [
          "#a31c2e",
          "p",
          [
            [22, 27],
            [7, 12],
            [9, 28],
            [13, 36],
            [22, 35],
          ],
        ],
        [
          "#a31c2e",
          "p",
          [
            [36, 27],
            [51, 12],
            [49, 28],
            [45, 36],
            [36, 35],
          ],
        ],
        [
          "#c22636",
          "p",
          [
            [29, 38],
            [40, 44],
            [52, 40],
            [55, 45],
            [40, 49],
            [27, 44],
          ],
        ],
        [
          "#9c1a2a",
          "p",
          [
            [21, 40],
            [16, 47],
            [22, 46],
            [26, 42],
          ],
        ],
        [
          "#9c1a2a",
          "p",
          [
            [37, 40],
            [42, 47],
            [36, 46],
            [32, 42],
          ],
        ],
        [
          "#ffffff",
          "p",
          [
            [16, 47],
            [15, 49],
            [18, 47],
          ],
        ],
        [
          "#ffffff",
          "p",
          [
            [42, 47],
            [43, 49],
            [40, 47],
          ],
        ],
        ["#c22636", "e", 29, 31, 11, 14],
        ["#f2c14e", "e", 29, 35, 6, 10],
        ["#d79a1e", "e", 29, 31, 6, 1],
        ["#d79a1e", "e", 29, 35, 6, 1],
        ["#d79a1e", "e", 29, 39, 5, 1],
        [
          "#c22636",
          "p",
          [
            [24, 24],
            [34, 24],
            [33, 14],
            [25, 14],
          ],
        ],
        ["#d92b3c", "e", 29, 10, 8, 6.5],
        ["#b01f30", "e", 29, 15, 5, 3],
        [
          "#f2c14e",
          "p",
          [
            [22, 7],
            [18, 0],
            [25, 5],
          ],
        ],
        [
          "#f2c14e",
          "p",
          [
            [36, 7],
            [40, 0],
            [33, 5],
          ],
        ],
        ["#ffd24a", "e", 25, 9, 2.2, 1.9],
        ["#140b22", "e", 25, 9.2, 0.8800000000000001, 1.3299999999999998],
        ["#ffd24a", "e", 33, 9, 2.2, 1.9],
        ["#140b22", "e", 33, 9.2, 0.8800000000000001, 1.3299999999999998],
        [
          "#ff9a2a",
          "p",
          [
            [26, 18],
            [29, 28],
            [32, 18],
          ],
        ],
        [
          "#ffe27a",
          "p",
          [
            [27.5, 18],
            [29, 24],
            [30.5, 18],
          ],
        ],
      ],
    },
  };
  function vecSprite(d) {
    const SC = 4,
      W = d.w,
      H = d.h,
      big = mk(W * SC, H * SC, (g) => {
        for (const o of d.ops) {
          g.fillStyle = o[0];
          g.beginPath();
          if (o[1] === "e")
            g.ellipse(o[2] * SC, o[3] * SC, o[4] * SC, o[5] * SC, 0, 0, 6.2832);
          else
            o[2].forEach((p, i) =>
              i
                ? g.lineTo(p[0] * SC, p[1] * SC)
                : g.moveTo(p[0] * SC, p[1] * SC),
            );
          g.fill();
        }
      });
    const bd = big.getContext("2d").getImageData(0, 0, W * SC, H * SC).data;
    const px = mk(W + 2, H + 2, (g) => {
      const im = g.createImageData(W + 2, H + 2);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = ((y * SC + 2) * W * SC + x * SC + 2) * 4;
          if (bd[i + 3] >= 128) {
            const j = ((y + 1) * (W + 2) + x + 1) * 4;
            im.data[j] = bd[i];
            im.data[j + 1] = bd[i + 1];
            im.data[j + 2] = bd[i + 2];
            im.data[j + 3] = 255;
          }
        }
      g.putImageData(im, 0, 0);
    });
    const sil = mk(W + 2, H + 2, (g) => {
      g.drawImage(px, 0, 0);
      g.globalCompositeOperation = "source-in";
      g.fillStyle = "#140b22";
      g.fillRect(0, 0, W + 2, H + 2);
    });
    const sp = fromImg(
      mk(W + 2, H + 2, (g) => {
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
          g.drawImage(sil, dx, dy);
        g.drawImage(px, 0, 0);
      }),
    );
    sp.hd = true;
    return sp;
  }
  function buildBossArt() {
    for (const k in BOSS_VEC) S[k] = vecSprite(BOSS_VEC[k]);
    a2Enemies();
  }
  /* ícones de UI 8x8 (substituíveis por PNG em assets/ui/<nome>.png ou ASSET_MANIFEST.ui)
     Inclui: play help gear trophy book globe bag star calendar door redo flag check lock store coin rate
     + pause left right close (navegação da biblioteca e botão de pausa) */
  const UI_M = {
    store: [
      "gGgGgGgG",
      "GgGgGgGg",
      "gggggggg",
      ".g....g.",
      ".g.WW.g.",
      ".g.WW.g.",
      ".g.WW.g.",
      ".gggggg.",
    ],
    rate: [
      "...GG...",
      "..GGGG..",
      "GGGGGGGG",
      ".GGGGGG.",
      "..GGGG..",
      ".GGGGGG.",
      "GGG..GGG",
      "GG....GG",
    ],
    coin: [
      ".GGGGGG.",
      "GGggggGG",
      "GgGGGGgG",
      "GgGggGgG",
      "GgGggGgG",
      "GgGGGGgG",
      "GGggggGG",
      ".GGGGGG.",
    ],
    play: [
      "..G.....",
      "..GG....",
      "..GGG...",
      "..GGGG..",
      "..GGGG..",
      "..GGG...",
      "..GG....",
      "..G.....",
    ],
    help: [
      ".WWWWW..",
      "WW...WW.",
      ".....WW.",
      "....WW..",
      "...WW...",
      "...WW...",
      "........",
      "...WW...",
    ],
    gear: [
      "...GG...",
      ".G.GG.G.",
      "..GGGG..",
      "GGG..GGG",
      "GGG..GGG",
      "..GGGG..",
      ".G.GG.G.",
      "...GG...",
    ],
    trophy: [
      "GGGGGGGG",
      "G.GGGG.G",
      "G.GGGG.G",
      ".GGGGGG.",
      "..GGGG..",
      "...GG...",
      "...GG...",
      "..gggg..",
    ],
    book: [
      ".BBBBBB.",
      "BWWBWWWB",
      "BWWBWWWB",
      "BWWBWWWB",
      "BWWBWWWB",
      "BWWBWWWB",
      ".BBBBBB.",
      "........",
    ],
    globe: [
      "..BBBB..",
      ".BNNBBB.",
      "BNNNBBNB",
      "BBNBBNNB",
      "BBBBNNNB",
      ".BBBNNB.",
      "..BBBB..",
      "........",
    ],
    bag: [
      "..GGGG..",
      "...gg...",
      "..gggg..",
      ".gggggg.",
      "gggGGggg",
      "gggGGggg",
      ".gggggg.",
      "..gggg..",
    ],
    star: [
      "...GG...",
      "...GG...",
      "GGGGGGGG",
      ".GGGGGG.",
      "..GGGG..",
      "..GGGG..",
      ".GG..GG.",
      ".G....G.",
    ],
    calendar: [
      "RRRRRRRR",
      "RWWWWWWR",
      "WWWWWWWW",
      "WGWGWGWW",
      "WWWWWWWW",
      "WGWGWGWW",
      "WWWWWWWW",
      "WWWWWWWW",
    ],
    door: [
      ".gggggg.",
      ".gGGGGg.",
      ".gGGGGg.",
      ".gGGGGg.",
      ".gGGGWg.",
      ".gGGGGg.",
      ".gGGGGg.",
      ".gggggg.",
    ],
    redo: [
      "..WWWW..",
      ".W....W.",
      "W.....WW",
      "W....WWW",
      "W.....WW",
      ".W......",
      "..WWWW..",
      "........",
    ],
    flag: [
      "GG......",
      "GRRRRR..",
      "GRRRRRR.",
      "GRRRRR..",
      "G.......",
      "G.......",
      "G.......",
      "GG......",
    ],
    check: [
      "........",
      ".......N",
      "......NN",
      "N....NN.",
      "NN..NN..",
      ".NNNN...",
      "..NN....",
      "........",
    ],
    noads: [
      "..RRRR..",
      ".RR..RR.",
      "RR...RRR",
      "R...R..R",
      "R..R...R",
      "RRR...RR",
      ".RR..RR.",
      "..RRRR..",
    ],
    lock: [
      "..gggg..",
      ".g....g.",
      ".g....g.",
      "GGGGGGGG",
      "GGGDDGGG",
      "GGGDDGGG",
      "GGGGGGGG",
      "GGGGGGGG",
    ],
    /* pause: duas barras verticais (substitui "II") */
    pause: [
      "........",
      ".GG..GG.",
      ".GG..GG.",
      ".GG..GG.",
      ".GG..GG.",
      ".GG..GG.",
      ".GG..GG.",
      "........",
    ],
    /* left / right: setas de navegação da biblioteca (substitui ‹ ›) */
    left: [
      "........",
      "...G....",
      "..GG....",
      ".GGGGGG.",
      ".GGGGGG.",
      "..GG....",
      "...G....",
      "........",
    ],
    right: [
      "........",
      "....G...",
      "....GG..",
      ".GGGGGG.",
      ".GGGGGG.",
      "....GG..",
      "....G...",
      "........",
    ],
    /* close: X de fechar modal (substitui "X") */
    close: [
      "........",
      ".GG..GG.",
      "..GGGG..",
      "...GG...",
      "...GG...",
      "..GGGG..",
      ".GG..GG.",
      "........",
    ],
  },
    UI_C = {
      G: "#f2c14e",
      g: "#a8741f",
      W: "#f1e4c3",
      R: "#e0475a",
      B: "#4aa3ff",
      N: "#5ec26a",
      D: "#2b2150",
    },
    UI_URL = {};
  const uiSt = document.createElement("style");
  document.head.appendChild(uiSt);
  function uiCss() {
    uiSt.textContent = Object.keys(UI_URL)
      .map((k) => ".i-" + k + '{--ic:url("' + UI_URL[k] + '")}')
      .join("");
  }
  for (const k in UI_M)
    UI_URL[k] = mk(8, 8, (g) =>
      UI_M[k].forEach((r, y) =>
        [...r].forEach((c, x) => {
          if (UI_C[c]) {
            g.fillStyle = UI_C[c];
            g.fillRect(x, y, 1, 1);
          }
        }),
      ),
    ).toDataURL();
  uiCss();
  [
    ["#playBtn", "play"],
    ["#mHelp", "help"],
    ["#mSet", "gear"],
    ["#mRank", "trophy"],
    ["#mLib", "book"],
    ["#mShop", "bag"],
    ["#mAch", "star"],
    ["#mDaily", "calendar"],
    ["#resumeBtn", "play"],
    ["#menuBtn", "door"],
    ["#setBtn", "gear"],
    ["#evoBtn", "book"],
    ["#againBtn", "redo"],
    ["#endMenuBtn", "door"],
  ].forEach(([q, k]) => {
    const e = $(q);
    if (e) e.classList.add("ib", "i-" + k);
  });
  window.listAssets = () => {
    const r = [];
    const walk = (o, p) => {
      for (const k in o) {
        const v = o[k];
        if (v && v.c && v.w) r.push({ chave: p + k, tamanho: v.w + "x" + v.h });
        else if (
          v &&
          typeof v === "object" &&
          !v.c &&
          !(v instanceof HTMLElement)
        )
          walk(v, p + k + ".");
      }
    };
    walk(S, "");
    console.table(r);
    console.log("ícones (24px):", Object.keys(ICON_DRAW).join(", "));
    console.log("ícones de UI (8px):", Object.keys(UI_M).join(", "));
    return r;
  };
  /* preparação: herói + mundo na mesma tela */
  const _scr = scr;
  scr = function (t, fn) {
    const panel = SCR.firstElementChild;
    panel.classList.toggle("wide-modes", fn === renderModes);
    panel.classList.toggle("wide-prep", fn === renderPrep);
    panel.classList.toggle("wide-runes", fn === renderShop);
    panel.classList.toggle(
      "wide-library",
      fn === renderLib || fn === renderEvoGlossary,
    );
    panel.classList.toggle("wide-shop", fn === renderStore);
    panel.classList.toggle("wide-rate", fn === renderRate);
    _scr(t, fn);
  }; /* largura controlada por classe */
  function renderPrep(b) {
    b.innerHTML =
      '<div class="prep-top"><button class="mb back-btn prep-back" id="prepBack" type="button" aria-label="Voltar"><span class="pxchev" aria-hidden="true"></span></button><button class="btn" id="prepGo" type="button"><span class="uic i-play"></span> Continuar</button></div><div id="prepH"></div>';
    viewHero = selHero;
    renderHeroes($("#prepH"));
    $("#prepBack").onclick = () => $("#sBack").click();
    $("#prepGo").onclick = () => {
      if (HX[viewHero] && !HX[viewHero].locked && HEROES[viewHero]) {
        selHero = save.hero = viewHero;
        persist();
      }
      SCR.hidden = true;
      openModes();
    };
  }
  /* Mundo: fica na tela "Escolha o modo". host recebe o bloco (#prepW, #prepD, #prepBuy). */
  function renderWorldPick(host) {
    host.innerHTML =
      '<div class="hdg"><span class="uic i-globe"></span> Mundo</div><div id="prepW" class="prep-worlds"></div><small id="prepD" class="prep-description"></small><div id="prepBuy" class="prep-buy"></div>';
    WORLDS.forEach((w, i) => {
      const ok = wOpen(i),
        x = document.createElement("button");
      x.className = "mb";
      x.classList.add("world-choice");
      if (!ok) x.classList.add("is-locked");
      else if (curW() === w) x.classList.add("is-selected");
      x.innerHTML =
        '<span class="uic i-' + (ok ? "globe" : "lock") + '"></span> ' + w.n;
      x.onclick = () => {
        if (!ok) {
          offerWorld(i, host);
          return;
        }
        save.world = i;
        persist();
        wLbl();
        renderWorldPick(host);
      };
      host.querySelector("#prepW").appendChild(x);
      try {
        const c = document.createElement("canvas");
        c.width = 64;
        c.height = 32;
        c.className = "wthumb";
        c.getContext("2d").drawImage(nxWorldThumb(i), 0, 0);
        x.insertBefore(c, x.firstChild);
      } catch (e) { }
    });
    host.querySelector("#prepD").textContent = curW().d;
  }
  /* mundo bloqueado: mostra a oferta de compra logo abaixo da descrição */
  function offerWorld(i, host) {
    const w = WORLDS[i],
      box = host.querySelector("#prepBuy");
    if (!box) return;
    host.querySelector("#prepD").textContent = w.d;
    box.innerHTML = "";
    const hint = document.createElement("small");
    hint.className = "prep-description world-hint";
    hint.textContent = worldHint(i);
    box.appendChild(hint);
    const or = document.createElement("small");
    or.className = "prep-description world-or";
    or.textContent = "Ou desbloqueie agora, de forma permanente:";
    box.appendChild(or);
    const bt = document.createElement("button");
    bt.type = "button";
    bt.className = "btn";
    bt.innerHTML =
      '<span class="uic i-lock"></span> Comprar ' +
      w.n +
      " · " +
      Billing.priceOf(w.key);
    bt.onclick = () => buyWorld(i, () => renderWorldPick(host));
    box.appendChild(bt);
  }
  async function buyWorld(i, after) {
    const w = WORLDS[i];
    if (!(await Billing.buy(w.key))) return;
    save.world = i;
    persist();
    wLbl();
    notify("Mundo liberado: " + w.n + "!", "ok");
    after && after();
  }
  /* ===== Arte dos cards de modo (tela "Escolha o modo") =====
     Coloque a imagem em assets/modes/<id>.png | .jpg | .jpeg | .webp, com id = dawn (Amanhecer), vigil (Vigília Eterna)
     ou upcoming (Em breve). Se existir, ela cobre o fundo do card; se não, continua o desenho feito por código.
     Para usar outro nome de arquivo: ASSET_MANIFEST.modes = { dawn: "modes/meu_arquivo.jpg" }. */
  const MODE_ART_EXT = ["png", "jpg", "jpeg", "webp"];
  const MODE_ART = Object.create(null);
  function modeArtResolve(kind, cb) {
    const m =
      MODE_ART[kind] || (MODE_ART[kind] = { state: "idle", url: null, cbs: [] });
    if (m.state === "ok") return cb && cb(m.url);
    if (m.state === "none") return;
    if (cb) m.cbs.push(cb);
    if (m.state === "loading") return;
    m.state = "loading";
    const manual = ASSET_MANIFEST.modes && ASSET_MANIFEST.modes[kind];
    const list = manual
      ? [ASSET_DIR + manual]
      : MODE_ART_EXT.map((e) => ASSET_DIR + "modes/" + kind + "." + e);
    const next = (i) => {
      if (i >= list.length) {
        m.state = "none";
        m.cbs.length = 0;
        return;
      }
      const im = new Image();
      im.onload = () => {
        m.state = "ok";
        m.url = list[i];
        m.cbs.splice(0).forEach((f) => f(m.url));
      };
      im.onerror = () => next(i + 1);
      im.src = list[i];
    };
    next(0);
  }
  function modeArtApply(kind, art) {
    if (!document.getElementById("modeArtCss")) {
      const st = document.createElement("style");
      st.id = "modeArtCss";
      st.textContent =
        ".mc-art > img.mc-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block;pointer-events:none;user-select:none}" +
        ".mc-art.has-img > i,.mc-art.has-img > .mc-q{display:none !important}";
      document.head.appendChild(st);
    }
    modeArtResolve(kind, (url) => {
      if (art.querySelector(".mc-img")) return;
      const img = new Image();
      img.className = "mc-img";
      img.alt = "";
      img.draggable = false;
      img.src = url;
      art.insertBefore(img, art.firstChild);
      art.classList.add("has-img");
    });
  }
  ["dawn", "vigil", "upcoming"].forEach((k) => modeArtResolve(k));
  function openModes() {
    if (!SCR.hidden) return;
    scr("Escolha o modo", renderModes);
  }
  function renderModes(b) {
    b.innerHTML =
      '<div class="mode-grid"></div><div class="modes-worlds"></div>';
    const grid = b.querySelector(".mode-grid");
    const unl = infUnlocked();
    const mk = (kind, title, desc, state, foot, pick) => {
      const c = document.createElement("button");
      c.type = "button";
      c.disabled = state === "soon";
      c.className =
        "mcard " +
        kind +
        (state === "ok" ? "" : " lk") +
        (state === "soon" ? " soon" : "");
      const art = document.createElement("div");
      art.className = "mc-art " + kind + (state === "soon" ? " soon" : "");
      if (kind === "dawn")
        art.innerHTML =
          '<i class="mc-sun"></i><i class="mc-hill"></i><i class="mc-cv"></i><i class="mc-ch"></i>';
      else if (kind === "vigil")
        art.innerHTML =
          '<i class="mc-moon"></i><i class="mc-candle"></i><i class="mc-flame"></i>';
      else art.innerHTML = '<b class="mc-q">?</b>';
      modeArtApply(kind, art); /* imagem de assets/modes, se existir */
      if (state !== "ok" && state !== "soon") {
        const lk = document.createElement("span");
        lk.className = "mc-lock";
        lk.innerHTML = '<span class="uic i-lock"></span>';
        art.appendChild(lk);
      }
      c.appendChild(art);
      const band = document.createElement("div");
      band.className = "mc-band";
      band.textContent = title;
      c.appendChild(band);
      const d = document.createElement("div");
      d.className = "mc-desc";
      d.textContent = desc;
      c.appendChild(d);
      const f = document.createElement("div");
      f.className = "mc-foot";
      if (state === "ok") {
        f.innerHTML = '<span class="mc-play">Jogar</span>';
      } else if (state !== "soon") {
        f.innerHTML = '<span class="mc-st">' + foot + "</span>";
      }
      if (state !== "soon") c.appendChild(f);
      if (state !== "soon") c.onclick = pick;
      grid.appendChild(c);
    };
    const go = (m) => {
      RUN.mode = m;
      goRun();
    };
    mk(
      "dawn",
      "Amanhecer",
      "Modo padrão. Sobreviva 10 minutos de noite, derrote os 5 chefes e vença ao amanhecer.",
      "ok",
      "",
      () => go("std"),
    );
    mk(
      "vigil",
      "Vigília Eterna",
      "Sem amanhecer: a partida só acaba com a morte. Os chefes voltam a cada 90 s, os inimigos ficam mais fortes sem parar e o limite sobe para 6 armas, 6 dons e 3 habilidades ativas. A Fé cresce mais devagar. Sobreviva o máximo que puder.",
      unl ? "ok" : "lk",
      "Vença o Amanhecer",
      () => {
        if (!unl) {
          notify(
            "Vença o Amanhecer uma vez para liberar a Vigília Eterna.",
            "warn",
          );
          return;
        }
        go("inf");
      },
    );
    mk(
      "upcoming",
      "Em breve",
      "Um novo modo está em preparação.",
      "soon",
      "",
      null,
    );
    renderWorldPick(b.querySelector(".modes-worlds"));
  }
  function openPrep() {
    scr("Preparar a jornada", renderPrep);
  }
  $("#mHero").style.display = "none";
  $("#mWorld").style.display = "none";
  $("#mHelp").style.display = "none";
  $("#playBtn").addEventListener(
    "click",
    (e) => {
      e.stopImmediatePropagation();
      RUN.mode = RUN.modeNext || "std";
      RUN.modeNext = null;
      openPrep();
    },
    true,
  );
  function buildMenu() {
    const box = $("#heroes");
    box.innerHTML = "";
    for (const k in HEROES) {
      const H = HEROES[k],
        b = document.createElement("button");
      b.type = "button";
      b.className = "hero" + (k === selHero ? " sel" : "");
      b.dataset.k = k;
      const c = document.createElement("canvas");
      const s = S.hero[k][0];
      c.width = s.w;
      c.height = s.h;
      c.getContext("2d").drawImage(s.c, 0, 0);
      c.classList.add("hero-menu-portrait");
      c.dataset.hero = k;
      const info = document.createElement("div");
      info.className = "hero-menu-meta";
      info.innerHTML =
        "<h3>" +
        H.name +
        '</h3><div class="role">' +
        H.role +
        '</div><div class="st">Salvação <b>' +
        H.hp +
        "</b> · Velocidade <b>" +
        H.spd +
        "</b><br>Inicia com: <b>" +
        WEAPONS[H.start].name +
        '</b><br><span class="hero-menu-bonus">' +
        H.bonus +
        "</span></div>";
      b.appendChild(c);
      b.appendChild(info);
      b.addEventListener("click", () => {
        selHero = k;
        box
          .querySelectorAll(".hero")
          .forEach((x) => x.classList.toggle("sel", x.dataset.k === k));
      });
      box.appendChild(b);
    }
    drawCross();
    refreshMeta();
  }

  /* ================= v0.22: feedback, anúncios intersticiais, compra "sem anúncios", clima do jogo ================= */
  function notify(msg, kind) {
    const old = $("#ntf");
    if (old) old.remove();
    const d = document.createElement("div");
    d.id = "ntf";
    d.className = "ntf " + (kind || "info");
    d.textContent = msg;
    gameEl.appendChild(d);
    clearTimeout(notify.t);
    notify.t = setTimeout(() => d.remove(), 2800);
  }
  /* Hápticos de gameplay (dano, dash, etc.). Sem toggle em Configurações. */
  function vib(ms) {
    const browserFallback = () => {
      try {
        if (navigator.vibrate) navigator.vibrate(ms);
      } catch (e) { }
    };
    // Native Capacitor must use the Haptics plugin; navigator.vibrate alone is unreliable in Android WebView.
    if (window.FeHaptics && typeof window.FeHaptics.vibrate === "function") {
      try {
        const result = window.FeHaptics.vibrate(ms);
        if (result && typeof result.then === "function") {
          result
            .then((ok) => {
              if (!ok) browserFallback();
            })
            .catch(browserFallback);
          return;
        }
        if (result) return;
      } catch (e) { }
    }
    browserFallback();
  }
  function deny(el, msg) {
    SFX.play("deny");
    vib(25);
    if (el) {
      el.classList.remove("nope");
      void el.offsetWidth;
      el.classList.add("nope");
    }
    if (msg) notify(msg, "warn");
  }
  /* efeito visual de cura: partículas verdes + número (usado por healP e pela regeneração) */
  function healFx(a, showText = true) {
    const p = G.p;
    if (FXQ())
      G.fx.push({
        wid: BTL.src || null,
        k: "heal",
        x: p.x,
        y: p.y,
        t: 0,
        life: 0.8,
        follow: true,
      });
    if (showText)
      G.fx.push({
        wid: BTL.src || null,
        k: "txt",
        x: p.x,
        y: p.y - 14,
        s: "+" + a,
        t: 0,
        life: 0.9,
        col: "#7ee08a",
      });
  }
  function healP(n) {
    const p = G.p,
      amount = Math.max(0, roundGameplayValue(n)),
      a = Math.min(amount, G.mods.maxhp - p.hp);
    if (a <= 0) {
      BTL.heal(0, amount); /* cura desperdiçada com a Salvação cheia */
      return;
    }
    BTL.heal(a, amount);
    p.hp += a;
    healFx(a);
  }
  function srcName(o) {
    if (typeof o === "string") return o;
    if (!o) return null;
    if (o.src) return srcName(o.src);
    if (o.t === "boss" && BOSSES[o.idx]) return BOSSES[o.idx].name;
    return DI[o.t] ? DI[o.t][0] : null;
  }
  const KILL_MS = [25, 50, 100, 200, 300, 500, 750, 1000, 1500, 2000];
  const AD_COIN = ECO.AD_GOLD,
    AD_COIN_MAX =
      ECO.AD_GOLD_MAX_DAY; /* moedas por anúncio recompensado e limite diário compartilhado */
  /* contador diário COMPARTILHADO dos anúncios de MOEDAS (Loja + tela final).
     Migra save.adc / save.dbl (versões antigas) uma única vez, somando só os usos do dia atual. */
  function adGoldUsed() {
    const d = dayKey(),
      num = (v) => Math.max(0, Math.floor(Number(v) || 0));
    if (!save.adg || typeof save.adg !== "object") {
      let n = 0;
      if (save.adc && save.adc.d === d) n += num(save.adc.n);
      if (save.dbl && save.dbl.d === d) n += num(save.dbl.n);
      save.adg = { d, n: Math.min(n, AD_COIN_MAX) };
    } else if (save.adg.d !== d) save.adg = { d, n: 0 };
    save.adg.n = Math.min(num(save.adg.n), AD_COIN_MAX);
    return save.adg.n;
  }
  const END_TIPS = FE_CONTENT.endTips; /* registry.js → endTips */

  function endNote(won, ret) {
    let el = $("#endNote");
    if (!el) {
      el = document.createElement("p");
      el.id = "endNote";
      el.className = "verse";
      $("#endV").insertAdjacentElement("afterend", el);
    }
    let h;
    if (won)
      h =
        "Você resistiu à noite inteira e derrotou <b>" +
        G.kills +
        "</b> demônios. Amanheceu!";
    else if (ret)
      h = "Suas moedas foram guardadas. Você chegou a <b>" + fmt(G.t) + "</b>.";
    else
      h =
        (G.hitBy
          ? "Você caiu para <b>" + G.hitBy + "</b> aos " + fmt(G.t) + ". "
          : "") +
        (G.inf
          ? "Sua vigília chegou ao fim."
          : "Faltaram <b>" +
          fmt(Math.max(0, WIN_T - G.t)) +
          "</b> para o amanhecer.");
    if (!won && !ret)
      h += '<br><span class="end-tip">Dica: ' + pick(END_TIPS) + "</span>";
    el.innerHTML = h;
  }
  /* ---- clima da partida: vida baixa, marcos, avisos e dicas iniciais ---- */
  const TIME_MSG = [
    [45, "Você ainda está de pé. Continue!"],
    [150, "Os demônios estão ficando mais fortes…"],
    [300, "Metade da noite! Resista!"],
    [420, "A escuridão se aprofunda…"],
    [540, "Falta 1 minuto para o amanhecer!"],
    [570, "O amanhecer está chegando!"],
    [590, "Só mais um pouco…"],
  ];
  function feel(dt) {
    const g = G,
      p = g.p,
      mx = g.mods.maxhp;
    g.md = g.md || {};
    g.bw = g.bw || {};
    const low = p.hp > 0 && p.hp <= Math.max(2, mx * 0.3);
    if (low && !g.low) {
      g.low = true;
      toast("Salvação baixa! Procure o Pão da Vida");
      SFX.play("warn");
      vib([60, 50, 60]);
    } else if (g.low && p.hp > mx * 0.45) g.low = false;
    if (g.low) {
      g.beatT = (g.beatT || 0) - dt;
      if (g.beatT <= 0) {
        g.beatT = 1.15;
        SFX.play("beat");
      }
    }
    for (const m of TIME_MSG)
      if (g.t >= m[0] && !g.md[m[0]] && !(g.inf && m[0] >= 540)) {
        g.md[m[0]] = 1;
        if (!g.boss) toast(m[1]);
      }
    const bi = g.bossIdx;
    if (
      (g.inf || bi < BOSS_T.length) &&
      !g.boss &&
      g.t >= bossTime(bi) - 10 &&
      !g.bw[bi]
    ) {
      g.bw[bi] = 1;
      toast("Algo terrível se aproxima…");
      SFX.play("warn");
    }
    if (g.boss && !g.boss.weak && g.boss.hp < g.boss.mhp * 0.25) {
      g.boss.weak = 1;
      toast("O chefe está enfraquecendo!");
    }
    if ((save.runs || 0) < 3) {
      const H = [
        [
          1.5,
          IS_PHONE
            ? "Arraste no lado esquerdo para se mover"
            : "Mova-se com WASD ou as setas",
        ],
        [
          6,
          manualOn()
            ? IS_PHONE
              ? "Arraste no lado direito para mirar e atirar"
              : "Mire com o mouse e clique para atirar"
            : "Suas armas atiram sozinhas",
        ],
        [12, "Colete os cristais azuis: eles dão Fé"],
        [22, "Ao subir de nível, escolha com cuidado!"],
      ];
      g.hd = g.hd || {};
      for (const h of H)
        if (g.t >= h[0] && !g.hd[h[0]]) {
          g.hd[h[0]] = 1;
          toast(h[1]);
        }
    }
  }
  const _upd3 = update;
  update = function (dt) {
    _upd3(dt);
    if (state === "play" && G && !G.over) feel(dt);
  };
  /* ---- anúncios intersticiais ---- */
  const adsRemoved = () => !!save.noAds;
  const INT = { runs: 0, pending: false, last: 0, idle: 0, busy: false };
  ADS.interstitial = function (cb) {
    if (adsRemoved() || ADS.busy) return cb && cb();
    const _icb = cb;
    cb = () => {
      track("ad_interstitial_end", {});
      _icb && _icb();
    };
    const sdk = window.CrazyGames && window.CrazyGames.SDK;
    let fin = false;
    const start = () => {
      ADS.busy = true;
      SFX.on = false;
      if (musTrk) musTrk.pause();
    },
      done = () => {
        if (fin) return;
        fin = true;
        ADS.busy = false;
        SFX.on = !!save.set.sound;
        INT.last = Date.now();
        INT.idle = 0;
        musApply();
        cb && cb();
      };
    if (sdk && sdk.ad)
      sdk.ad.requestAd("midgame", {
        adStarted: start,
        adFinished: done,
        adError: done,
      });
    else if (ADS_SIM) {
      start();
      const o = document.createElement("div");
      o.className = "ov ad-test-overlay";
      o.innerHTML =
        '<div class="ov-in"><h2>Anúncio de teste</h2><p class="sub">Simulando anúncio intersticial…</p></div>';
      gameEl.appendChild(o);
      setTimeout(() => {
        o.remove();
        done();
      }, 1800);
    } else done();
  };
  function intCountRun() {
    INT.runs++;
    if (INT.runs >= 4 && (INT.runs - 4) % 3 === 0) INT.pending = true;
  }
  function intNotice(kind, secs, then) {
    INT.busy = true;
    const d = document.createElement("div");
    d.id = "adNote";
    d.className = "adnote " + kind;
    gameEl.appendChild(d);
    let n = secs;
    const set = () => {
      d.innerHTML =
        "<b>Um breve anúncio está vindo…</b><small>" +
        (kind === "idle" ? "em " + n + " s" : "Obrigado por apoiar o jogo!") +
        "</small>";
    };
    set();
    const iv = setInterval(() => {
      n--;
      if (n > 0) return set();
      clearInterval(iv);
      d.remove();
      ADS.interstitial(() => {
        INT.busy = false;
        then && then();
      });
    }, 1000);
  }
  function intGate(next) {
    if (
      INT.pending &&
      !adsRemoved() &&
      !ADS.busy &&
      Date.now() - INT.last > 60000
    ) {
      INT.pending = false;
      intNotice("run", 3, next);
    } else next();
  }
  const _sr3 = startRun;
  startRun = function () {
    if (INT.busy) return;
    if (G && !G.over) {
      G.over = true;
      intCountRun();
    }
    intGate(() => _sr3());
  };
  const _tm = toMenu;
  toMenu = function () {
    if (INT.busy) return;
    if (G && !G.over) {
      G.over = true;
      intCountRun();
    }
    intGate(() => _tm());
  };
  /* v0.39: anúncio ocioso no menu removido (aparecia sem ação do jogador) */
  /* ================= compras reais (Google Play Billing) =================
     A ponte Android (android-bridge.js) precisa expor window.FeIAP com este contrato:
       info(sku)     -> Promise<{ priceString }>        preço já localizado pela Play Store
       owned(sku)    -> Promise<boolean>                produto único (não consumível) já comprado
       buy(sku)      -> Promise<boolean | { ok, token }> abre a compra (token = purchaseToken)
       consume(sku)  -> Promise<void>                   consome o pacote de moedas depois de entregue
       pending()     -> Promise<[{ sku, token }]>       pacotes pagos e ainda não consumidos
     Chamadas SEM sku continuam valendo para "Remover anúncios" (produto antigo, comportamento preservado).
     Cadastre no Play Console: world_sur e world_sombra como produtos ÚNICOS (não consumíveis);
     coins_1000 (1.000), coins_3500 (entrega 3.000) e coins_9000 (entrega 7.000) como produtos CONSUMÍVEIS.
     Os SKUs coins_3500/coins_9000 foram mantidos; as quantidades entregues vêm apenas de PRODUCTS.coins. O preço real vem do Play Console;
     "fb" e "brl" abaixo servem só de reserva (navegador/offline) e para calcular o selo de bônus. */
  const PRODUCTS = Object.freeze({
    noads: { sku: null, kind: "once", name: "Remover anúncios", fb: "" },
    world1: {
      sku: "world_sur",
      kind: "once",
      name: "Deserto de Sur",
      fb: "R$ 3,49",
    },
    world2: {
      sku: "world_sombra",
      kind: "once",
      name: "Vale da Sombra",
      fb: "R$ 5,49",
    },
    coins1: {
      sku: "coins_1000",
      kind: "coins",
      name: "Bolsa de Moedas",
      coins: 1000,
      brl: 4.99,
      fb: "R$ 4,99",
    },
    coins2: {
      sku: "coins_3500",
      kind: "coins",
      name: "Cofre de Moedas",
      coins: 3000,
      brl: 12.99,
      fb: "R$ 12,99",
      tag: "Mais popular",
    },
    coins3: {
      sku: "coins_9000",
      kind: "coins",
      name: "Tesouro Real",
      coins: 7000,
      brl: 29.99,
      fb: "R$ 29,99",
      tag: "Melhor valor",
    },
    starter: {
      sku: "starter_pack",
      kind: "once",
      name: "Pacote inicial",
      brl: 24.9,
      fb: "R$ 24,90",
    },
  });
  /* Pacote inicial (oferta única): sem desconto percentual nem preço "de" (não há valor de referência comprovável) */
  const STARTER = {
    coins: 3500,
    hero: "sansao",
    world: "world1",
  };
  /* concessão: a compra entrega tudo; a restauração (sync) só libera os direitos permanentes, sem moedas de novo */
  function starterGrant(token, fresh) {
    const first =
      !save.iap.starter &&
      (fresh || (token && !(save.iapTok || []).includes(token)));
    if (first) {
      save.coins += STARTER.coins;
      save.paid = (save.paid || 0) + STARTER.coins;
    }
    if (token) save.iapTok = (save.iapTok || []).concat(token).slice(-40);
    save.iap.starter = 1;
    save.unl[STARTER.hero] = 1;
    save.iap[STARTER.world] = 1;
    save.noAds = 1;
    save.st = "done";
    persist();
    refreshMeta();
    return true;
  }
  const COIN_PACKS = ["coins1", "coins2", "coins3"];
  const keyBySku = (sku) =>
    Object.keys(PRODUCTS).find((k) => PRODUCTS[k].sku === sku);

  /* ---- Pacote inicial: modal após a primeira partida + card abaixo de Notícias ---- */
  function starterArm() {
    if (TUT.on || save.iap.starter) return;
    if (!save.st) {
      save.st = "modal";
      persist();
    }
  }
  function starterPrice() {
    return Billing.priceOf("starter");
  }
  let starterUI = null;
  function starterEnsure() {
    if (starterUI) return starterUI;
    const host = $("#topLeft");
    if (!host) return null;
    const card = document.createElement("button");
    card.type = "button";
    card.id = "starterCard";
    card.className = "starter-card";
    card.hidden = true;
    card.onclick = () => openStarter();
    host.appendChild(card);
    const ov = document.createElement("div");
    ov.id = "starterModal";
    ov.className = "ov starter-overlay";
    ov.hidden = true;
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.addEventListener("pointerdown", (e) => {
      if (e.target === ov) closeStarter(true);
    });
    document.body.appendChild(ov);
    starterUI = { card, ov };
    return starterUI;
  }
  function starterCardSync() {
    const ui = starterEnsure();
    if (!ui) return;
    const show = save.st === "card" && !save.iap.starter;
    ui.card.hidden = !show;
    if (show)
      ui.card.innerHTML =
        '<span class="sc-badge">Única</span><b>' +
        "Pacote inicial" +
        "</b><small>" +
        starterPrice() +
        "</small>";
    /* modal pendente abre sempre que a tela inicial estiver visível (inclusive ao reabrir o app) */
    const menu = $("#menu");
    if (
      save.st === "modal" &&
      !TUT.on &&
      !save.iap.starter &&
      menu &&
      !menu.hidden &&
      starterUI &&
      starterUI.ov.hidden
    )
      openStarter();
  }
  function starterRender(ui) {
    ui.ov.innerHTML =
      '<div class="starter-panel" role="document">' +
      '<button type="button" class="starter-x" aria-label="' +
      "Fechar" +
      '">×</button>' +
      '<span class="starter-badge">Oferta única</span>' +
      '<h2 class="starter-title">' +
      "Pacote inicial" +
      "</h2>" +
      '<p class="starter-sub">' +
      "Primeira compra · oferta única" +
      "</p>" +
      '<ul class="starter-list">' +
      "<li>" +
      "Sansão, o Juiz: herói desbloqueado" +
      "</li><li>" +
      "Deserto de Sur: mundo desbloqueado (+25% de moedas)" +
      "</li>" +
      "<li>" +
      STARTER.coins.toLocaleString("pt-BR") +
      " moedas" +
      "</li><li>" +
      "Sem anúncios intersticiais para sempre" +
      "</li></ul>" +
      '<div class="starter-price"><b>' +
      starterPrice() +
      "</b></div>" +
      '<button type="button" class="mb starter-buy">' +
      ("Comprar por " + (starterPrice())) +
      "</button>" +
      '<button type="button" class="starter-later">' +
      "Agora não" +
      "</button>" +
      '<p class="starter-note">' +
      "Oferta única. Não se repete." +
      "</p></div>";
    ui.ov.querySelector(".starter-x").onclick = () => closeStarter(true);
    ui.ov.querySelector(".starter-later").onclick = () => closeStarter(true);
    ui.ov.querySelector(".starter-buy").onclick = async () => {
      if (await Billing.buy("starter")) {
        closeStarter(false);
        notify("Pacote inicial liberado!", "ok");
        starterCardSync();
      }
    };
  }
  function openStarter() {
    if (save.iap.starter) return;
    const ui = starterEnsure();
    if (!ui) return;
    starterRender(ui);
    ui.ov.hidden = false;
    const b = ui.ov.querySelector(".starter-buy");
    if (b) b.focus();
  }
  function closeStarter(keepCard) {
    const ui = starterEnsure();
    if (!ui) return;
    ui.ov.hidden = true;
    if (keepCard && save.st === "modal") {
      save.st = "card";
      persist();
    }
    starterCardSync();
  }
  function starterMenu() {
    starterCardSync();
    try {
      if (profWelcomeMaybe()) return;
    } catch (e) {
      console.warn("[perfil]", e);
    } /* boas-vindas antes da oferta do Pacote Inicial */
    if (save.st === "modal" && !TUT.on && !save.iap.starter) openStarter();
  }
  const Billing = {
    busy: false,
    price: {},
    priceOf(key) {
      return Billing.price[key] || PRODUCTS[key].fb;
    },
    owned(key) {
      return key === "noads" ? !!save.noAds : !!save.iap[key];
    },
    /* entrega o item. Pacote de moedas é idempotente por token: o mesmo pedido nunca paga duas vezes */
    grant(key, token, fresh) {
      const P = PRODUCTS[key];
      if (key === "starter") return starterGrant(token, fresh);
      if (P.kind === "coins") {
        if (token && save.iapTok.includes(token)) return false;
        save.coins += P.coins;
        save.paid = (save.paid || 0) + P.coins;
        if (token) save.iapTok = save.iapTok.concat(token).slice(-40);
      } else if (key === "noads") save.noAds = 1;
      else save.iap[key] = 1;
      persist();
      refreshMeta();
      return true;
    },
    async loadPrices() {
      if (!window.FeIAP) return;
      await Promise.all(
        Object.keys(PRODUCTS).map(async (key) => {
          try {
            const r = await FeIAP.info(PRODUCTS[key].sku || undefined);
            if (r && r.priceString) Billing.price[key] = r.priceString;
          } catch (e) { }
        }),
      );
    },
    async buy(key) {
      const P = PRODUCTS[key];
      if (Billing.busy && Date.now() - (Billing.t || 0) < 150000) {
        notify("Aguarde a compra anterior terminar.", "info");
        return false;
      }
      if (P.kind === "once" && Billing.owned(key)) return true;
      Billing.busy = true;
      Billing.t = Date.now();
      try {
        let ok = false,
          token = null;
        if (window.FeIAP) {
          const r = await (P.sku ? FeIAP.buy(P.sku) : FeIAP.buy());
          ok = r === true || !!(r && r.ok);
          token = (r && r.token) || null;
        } else if (ADS_SIM) {
          ok = confirm('[TESTE] Simular a compra de "' + P.name + '"?');
          token = ok ? "sim-" + Date.now() : null;
        } else {
          notify("As compras só funcionam no aplicativo instalado.", "warn");
          return false;
        }
        if (!ok) {
          track("purchase_fail", {
            key: key,
            err: window.FeIAP && FeIAP.lastError ? 1 : 0,
          });
          notify(
            window.FeIAP && FeIAP.lastError
              ? "Compra não concluída [" + FeIAP.lastError + "]"
              : "Compra cancelada.",
            window.FeIAP && FeIAP.lastError ? "warn" : "info",
          );
          return false;
        }
        Billing.grant(key, token, true);
        track("purchase_ok", { key: key });
        SFX.play(P.kind === "coins" ? "coin" : "win");
        if (P.kind === "coins" && window.FeIAP) {
          try {
            await FeIAP.consume(P.sku);
          } catch (e) {
            /* sync() tenta consumir de novo na próxima abertura */
          }
        }
        return true;
      } catch (e) {
        notify("Não foi possível concluir a compra. Tente de novo.", "warn");
        return false;
      } finally {
        Billing.busy = false;
      }
    },
    /* confere o que a conta Google já possui (restaurar) e entrega pacotes pagos que não chegaram a ser consumidos */
    async sync() {
      if (!window.FeIAP) return;
      try {
        if (await FeIAP.owned()) Billing.grant("noads");
      } catch (e) { }
      for (const key of Object.keys(PRODUCTS)) {
        const P = PRODUCTS[key];
        if (P.kind !== "once" || !P.sku) continue;
        try {
          if (await FeIAP.owned(P.sku)) Billing.grant(key);
        } catch (e) { }
      }
      try {
        for (const it of (await FeIAP.pending()) || []) {
          const key = keyBySku(it.sku);
          if (!key || !it.token) continue;
          Billing.grant(key, it.token);
          try {
            await FeIAP.consume(it.sku);
          } catch (e) { }
        }
      } catch (e) { }
    },
    async restore() {
      if (Billing.busy) return;
      if (!window.FeIAP)
        return notify("Disponível apenas no aplicativo instalado.", "warn");
      Billing.busy = true;
      try {
        const snap = () => JSON.stringify([save.noAds, save.iap, save.coins]),
          before = snap();
        await Billing.sync();
        notify(
          snap() !== before
            ? "Compras restauradas!"
            : "Nenhuma compra encontrada nesta conta.",
          snap() !== before ? "ok" : "info",
        );
      } catch (e) {
        notify("Não foi possível verificar suas compras agora.", "warn");
      } finally {
        Billing.busy = false;
      }
    },
  };
  /* Compras só são consultadas ao abrir a Loja (nada de chamadas nativas de compra na abertura do jogo) */

  /* ---- tela LOJA: pacotes de moedas + remover anúncios + restaurar ---- */
  /* Store styles moved to style.css. */
  /* ---- LOJA (v0.66): menu lateral de seções + cartões. Seções: Moedas, Pacote inicial, Heróis, Skins, Anúncios e compras. ---- */
  let shopSec = "coins";
  /* Feedback de compra em modal (estilo "recompensa obtida"). Fecha no botão ou tocando fora. */
  function buyPop(title, sub, ico) {
    const ov = document.createElement("div");
    ov.className = "ov buy-pop";
    ov.innerHTML =
      '<div class="buy-card"><span class="buy-ico uic i-' + (ico || "coin") + '"></span><h2></h2><p></p><button type="button" class="btn buy-ok">Continuar</button></div>';
    ov.querySelector("h2").textContent = title;
    ov.querySelector("p").textContent = sub;
    const close = () => ov.remove();
    ov.querySelector(".buy-ok").onclick = close;
    ov.onclick = (e) => {
      if (e.target === ov) close();
    };
    gameEl.appendChild(ov);
  }
  const SHOP_SECS = [
    ["coins", "Moedas", "coin"],
    ["starter", "Pacote inicial", "bag"],
    ["heroes", "Heróis", "star"],
    ["skins", "Skins", "play"],
    ["icons", "Ícones", "flag"],
    ["extras", "Anúncios e compras", "store"],
  ];
  function buyHeroShop(k, bt, lbl, cost, refresh) {
    if (save.coins < cost)
      return deny(
        bt,
        "Faltam " +
        (cost - save.coins).toLocaleString("pt-BR") +
        " moedas para desbloquear " +
        HX[k].name +
        ".",
      );
    if (!bt.dataset.c) {
      bt.dataset.c = 1;
      bt.textContent =
        "Confirmar compra? (" + cost.toLocaleString("pt-BR") + ")";
      setTimeout(() => {
        if (bt.isConnected) {
          delete bt.dataset.c;
          bt.textContent = lbl;
        }
      }, 3000);
      return;
    }
    save.coins -= cost;
    unlockHero(k);
    persist();
    refreshMeta();
    SFX.play("coin");
    buyPop("Herói desbloqueado", HX[k].name + " já está disponível na tela de Herói.", "star");
    refresh();
  }
  /* compra de ícone de perfil (demônios e chefes): mesmo padrão do herói — toque duas vezes para confirmar */
  function buyIconShop(it, bt, html, cost, refresh) {
    if (save.coins < cost)
      return deny(
        bt,
        "Faltam " +
        (cost - save.coins).toLocaleString("pt-BR") +
        " moedas para desbloquear o ícone " +
        it.name +
        ".",
      );
    if (!bt.dataset.c) {
      bt.dataset.c = 1;
      bt.textContent =
        "Confirmar compra? (" + cost.toLocaleString("pt-BR") + ")";
      setTimeout(() => {
        if (bt.isConnected) {
          delete bt.dataset.c;
          bt.innerHTML = html;
        }
      }, 3000);
      return;
    }
    save.coins -= cost;
    (save.icons = save.icons || {})[it.id] = 1;
    persist();
    refreshMeta();
    try {
      track("icon_buy", { id: it.id, cost });
    } catch (e) { }
    SFX.play("coin");
    buyPop(
      "Ícone desbloqueado",
      it.name + " já está disponível no seu Perfil.",
    );
    refresh();
  }
  function renderStore(b) {
    const base = PRODUCTS.coins1.coins / PRODUCTS.coins1.brl,
      n = (v) => v.toLocaleString("pt-BR");
    const refresh = () => {
      if (!SCR.hidden) renderStore(b);
    };
    b.innerHTML = "";
    const top = document.createElement("div");
    top.className = "shop-top";
    top.innerHTML =
      '<span class="shop-wallet"><span class="uic i-coin"></span> <b>' +
      n(save.coins) +
      "</b></span>";
    const side = document.createElement("nav");
    side.className = "shop-side";
    SHOP_SECS.forEach(([id, label, icon]) => {
      const bt = document.createElement("button");
      bt.type = "button";
      bt.className = "shop-tab" + (shopSec === id ? " on" : "");
      bt.setAttribute("aria-pressed", shopSec === id ? "true" : "false");
      bt.innerHTML =
        '<span class="uic i-' +
        icon +
        '"></span><span class="shop-tab-l">' +
        label +
        "</span>";
      bt.onclick = () => {
        shopSec = id;
        renderStore(b);
      };
      side.appendChild(bt);
    });
    const main = document.createElement("div");
    main.className = "shop-main";
    const body = document.createElement("div");
    body.className = "shop-body";
    body.appendChild(side);
    body.appendChild(main);
    b.appendChild(top);
    b.appendChild(body);

    /* ---- peças reutilizáveis ---- */
    const head = (title, note) =>
      main.insertAdjacentHTML(
        "beforeend",
        '<h3 class="shop-h">' +
        title +
        "</h3>" +
        (note ? '<p class="shop-note">' + note + "</p>" : ""),
      );
    const rail = () => {
      const r = document.createElement("div");
      r.className = "shop-rail";
      main.appendChild(r);
      return r;
    };
    const ico = (name) => {
      const sp = document.createElement("span");
      sp.className = "uic i-" + name;
      return sp;
    };
    const cta = (label, dim, onclick) => {
      const bt = document.createElement("button");
      bt.type = "button";
      bt.className = "btn shop-cta" + (dim === "dim" ? " dim" : "");
      bt.innerHTML = label;
      bt.disabled = dim === true;
      bt.onclick = onclick;
      return bt;
    };
    /* card de item: moldura de ícone + título + subtítulo + ação (opcional) */
    const item = (o) => {
      const c = document.createElement("div");
      c.className = "shop-item" + (o.cls ? " " + o.cls : "");
      const f = document.createElement("div");
      f.className = "shop-ico" + (o.artCls ? " " + o.artCls : "");
      if (o.art) f.appendChild(o.art);
      c.appendChild(f);
      if (o.badge) {
        const bd = document.createElement("em");
        bd.className = "shop-badge" + (o.hot ? " shop-badge-hot" : "");
        bd.textContent = o.badge;
        c.appendChild(bd);
      }
      const t = document.createElement("b");
      t.className = "shop-item-t";
      t.textContent = o.title;
      c.appendChild(t);
      const sub = document.createElement("div");
      sub.className = "shop-item-s";
      sub.innerHTML = o.sub || "";
      c.appendChild(sub);
      if (o.cta) c.appendChild(o.cta);
      return c;
    };

    if (shopSec === "coins") {
      head("Ofertas", "Arraste para o lado para ver mais.");
      const r1 = rail();
      if (!save.iap.starter)
        r1.appendChild(
          item({
            cls: "epic",
            art: heroCardPortrait("sansao", false),
            artCls: "hero-art",
            badge: "Oferta única",
            hot: true,
            title: "Pacote inicial",
            sub: n(STARTER.coins) + " moedas · Sansão · Deserto de Sur",
            cta: cta(
              Billing.priceOf("starter") || PRODUCTS.starter.fb,
              false,
              async () => {
                if (await Billing.buy("starter"))
                  buyPop("Pacote inicial", "Pacote inicial liberado!");
                refresh();
              },
            ),
          }),
        );
      const P3 = PRODUCTS.coins3;
      r1.appendChild(
        item({
          cls: "epic",
          art: ico("coin"),
          artCls: "coin-art",
          badge: "Melhor valor",
          title: P3.name,
          sub: n(P3.coins) + " moedas",
          cta: cta(Billing.priceOf("coins3"), false, async () => {
            if (await Billing.buy("coins3"))
              buyPop(
                P3.name,
                "+" + n(P3.coins) + " moedas adicionadas à sua carteira.",
              );
            refresh();
          }),
        }),
      );
      head("Pacotes de moedas", "");
      const r2 = rail();
      COIN_PACKS.forEach((key) => {
        const P = PRODUCTS[key],
          bonus = Math.round((P.coins / P.brl / base - 1) * 100);
        const tier = key === "coins3" ? "epic" : key === "coins2" ? "rare" : "";
        r2.appendChild(
          item({
            cls: tier,
            art: ico("coin"),
            artCls: "coin-art",
            badge: P.tag || "",
            title: P.name,
            sub:
              n(P.coins) +
              " moedas" +
              (bonus > 0
                ? ' · <span class="pk-bonus">+' + bonus + "% bônus</span>"
                : ""),
            cta: cta(Billing.priceOf(key), false, async () => {
              if (await Billing.buy(key))
                buyPop(
                  P.name,
                  "+" + n(P.coins) + " moedas adicionadas à sua carteira.",
                );
              refresh();
            }),
          }),
        );
      });
    }

    if (shopSec === "starter") {
      head("Pacote inicial", "Oferta única para começar a jornada.");
      const owned = !!save.iap.starter;
      rail().appendChild(
        item({
          cls: "epic" + (owned ? " owned" : ""),
          art: heroCardPortrait("sansao", false),
          artCls: "hero-art",
          badge: "Oferta única",
          hot: true,
          title: "Pacote inicial",
          sub:
            n(STARTER.coins) +
            " moedas · herói Sansão · Deserto de Sur · sem anúncios intersticiais",
          cta: owned
            ? cta("Adquirido", true, () => { })
            : cta(
              Billing.priceOf("starter") || PRODUCTS.starter.fb,
              false,
              async () => {
                if (await Billing.buy("starter"))
                  buyPop("Pacote inicial", "Pacote inicial liberado!");
                refresh();
              },
            ),
        }),
      );
    }

    if (shopSec === "heroes") {
      head(
        "Heróis",
        "Desbloqueie com moedas. Depois, escolha o herói na tela de preparação.",
      );
      const r = rail();
      Object.keys(HX).forEach((k) => {
        const X = HX[k],
          U = HU[k];
        if (!X) return;
        if (!X.locked) {
          r.appendChild(
            item({
              cls: "owned",
              art: heroCardPortrait(k, false),
              artCls: "hero-art",
              title: X.name,
              sub: X.role || "",
              cta: cta("Desbloqueado", true, () => { }),
            }),
          );
          return;
        }
        if (!U) {
          r.appendChild(
            item({
              art: heroCardPortrait(k, true, true),
              artCls: "hero-art",
              title: X.name,
              sub: "Conquiste em jogo",
              cta: cta("Em breve", true, () => { }),
            }),
          );
          return;
        }
        const lbl = "Desbloquear · " + n(U.coins) + " moedas";
        const bt = cta(
          '<span class="uic i-lock"></span> ' + lbl,
          save.coins < U.coins ? "dim" : false,
          () => buyHeroShop(k, bt, lbl, U.coins, refresh),
        );
        r.appendChild(
          item({
            art: heroCardPortrait(k, true, true),
            artCls: "hero-art",
            title: X.name,
            sub: X.role || "",
            cta: bt,
          }),
        );
      });
    }

    if (shopSec === "skins") {
      head(
        "Skins de heróis",
        "Em breve: a primeira skin de cada herói será gratuita.",
      );
      const r = rail();
      Object.keys(HX).forEach((k) => {
        const X = HX[k];
        if (!X) return;
        r.appendChild(
          item({
            cls: "skin",
            art: ico("star"),
            artCls: "skin-art",
            title: X.name,
            sub: "Skin 1 · em breve",
          }),
        );
      });
    }

    if (shopSec === "icons") {
      const P = profEnsure(),
        L = profIconList(),
        tierCls = { abadom: "rare", leviata: "rare", dragao: "epic" };
      const add = (list, r) =>
        list.forEach((it) => {
          const own = !profIconLocked(it.id),
            cost = profIconCost(it.id);
          let bt;
          if (!own) {
            const html =
              '<span class="uic i-lock"></span> Comprar · ' +
              n(cost) +
              " moedas";
            bt = cta(html, save.coins < cost ? "dim" : false, () =>
              buyIconShop(it, bt, html, cost, refresh),
            );
          } else if (P.icon === it.id) bt = cta("Em uso", true, () => { });
          else
            bt = cta("Usar no perfil", false, () => {
              P.icon = it.id;
              persist();
              profBtnSync();
              notify("Ícone atualizado!", "ok");
              refresh();
            });
          r.appendChild(
            item({
              cls: (own ? "owned " : "") + (tierCls[it.id] || ""),
              art: profAvatar(it.id, 56),
              artCls: "icon-art",
              title: it.name,
              sub: own
                ? "Desbloqueado"
                : it.cat === "demon"
                  ? FE_CONTENT.libraryTips[it.id] || "Ícone de demônio para seu perfil."
                  : "",
              cta: bt,
            }),
          );
        });
      head(
        "Ícones de perfil",
        "Compre ícones de demônios e chefes para usar no seu Perfil. Os ícones dos heróis são liberados junto com cada herói.",
      );
      head("Demônios", "Todos custam " + n(ECO.ICON_COST.demon) + " moedas.");
      add(
        L.filter((x) => x.cat === "demon"),
        rail(),
      );
      head("Chefes", "Quanto mais forte o chefe, mais caro o ícone.");
      add(
        L.filter((x) => x.cat === "boss"),
        rail(),
      );
    }

    if (shopSec === "extras") {
      head("Anúncios e compras", "");
      const r = rail();
      const done = Billing.owned("noads");
      r.appendChild(
        item({
          cls: done ? "owned" : "",
          art: ico("store"),
          artCls: "store-art",
          title: "Remover anúncios",
          sub: "Sem interrupções. Anúncios opcionais com recompensa continuam.",
          cta: cta(
            done ? "Comprado" : Billing.priceOf("noads") || "Comprar",
            done,
            async () => {
              if (done) return;
              if (await Billing.buy("noads"))
                buyPop("Anúncios removidos", "Obrigado por apoiar o jogo!");
              refresh();
            },
          ),
        }),
      );
      r.appendChild(
        item({
          art: ico("bag"),
          artCls: "store-art",
          title: "Restaurar compras",
          sub: "Já comprou algo? Recupere aqui.",
          cta: cta("Restaurar", false, async () => {
            await Billing.restore();
            refresh();
          }),
        }),
      );
    }
  }
  $("#topRight").insertAdjacentHTML(
    "beforeend",
    '<button class="mb ib i-store" id="mStore" type="button">Loja</button>',
  );
  $("#mStore").onclick = () => {
    scr("Loja", renderStore);
    Promise.allSettled([Billing.loadPrices(), Billing.sync()]).then(() => {
      if (!SCR.hidden && $("#sT") && $("#sT").textContent === "Loja")
        renderStore($("#sB"));
    });
  };

  /* "Apagar progresso" apaga só o jogo. Ficam: sem anúncios, mundos comprados e as moedas COMPRADAS ainda não gastas
     (save.paid acompanha quanto do saldo veio de compra; ao gastar, o saldo pago diminui junto). Nada é restaurado aqui. */
  function wipeProgress() {
    const paid = Math.min(save.paid || 0, save.coins || 0);
    /* pid permanece — é ID do dispositivo, não progresso de partida */
    const keep = {
      noAds: save.noAds,
      iap: save.iap || {},
      iapTok: save.iapTok || [],
      iapMig: 1,
      paid: paid,
      coins: paid,
      pid: save.pid,
      prof: save.prof
        ? { name: save.prof.name, icon: save.prof.icon, named: save.prof.named }
        : undefined,
    };
    window.__wiping = true;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(keep));
    } catch (e) { }
    location.reload();
  }

  /* ---- tela AVALIAR JOGO ---- */
  /* Rating UI styles moved to style.css. */
  /* v0.48: estrela em pixel art 11x11 (O = contorno, F = preenchimento, H = brilho, S = sombra).
     As cores de cada estado (vazia / prévia / dourada) ficam no style.css, nas classes .o .f .h .s. */
  const STAR_PIX = [
    ".....O.....",
    "....OHO....",
    "...OHFSO...",
    "OOOOHFSOOOO",
    "OHHFFFFFSSO",
    ".OHFFFFFSO.",
    "..OHFFFSO..",
    "..OHFFFSO..",
    ".OHFFOFFSO.",
    "OHFFO.OFSSO",
    "OOOOO.OOOOO",
  ];
  const STAR_SVG = (() => {
    const d = { O: "", F: "", H: "", S: "" };
    STAR_PIX.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (c in d) d[c] += "M" + x + " " + y + "h1v1h-1z";
      }),
    );
    return (
      '<svg viewBox="0 0 11 11" aria-hidden="true" focusable="false">' +
      Object.keys(d)
        .map((k) => '<path class="' + k.toLowerCase() + '" d="' + d[k] + '"/>')
        .join("") +
      "</svg>"
    );
  })();
  function renderRate(b) {
    b.innerHTML =
      '<div class="rate-screen"><div class="rate-card"><img class="rate-art" src="assets/ui/rate_art.png" alt=""></div><div class="rate-main"><p class="rate-hint">Toque em uma estrela para avaliar na Play Store</p><div class="rate-row" role="radiogroup" aria-label="Avaliação"></div><button type="button" class="btn" id="rateGo">Avaliar</button></div></div>';
    const art = b.querySelector(".rate-art");
    art.onerror = () => {
      const f = document.createElement("span");
      f.className = "uic i-rate rate-art";
      art.replaceWith(f);
    };
    const row = b.querySelector(".rate-row"),
      stars = [];
    const openStore = () =>
      openExt(
        IS_NATIVE
          ? "market://details?id=" + PLAY_APP_ID
          : "https://play.google.com/store/apps/details?id=" + PLAY_APP_ID,
      );
    const paint = (n, cls) =>
      stars.forEach((s, k) => s.classList.toggle(cls, k < n));
    let busy = false;
    for (let i = 1; i <= 5; i++) {
      const st = document.createElement("button");
      st.type = "button";
      st.className = "rate-star";
      st.setAttribute("role", "radio");
      st.setAttribute("aria-checked", "false");
      st.setAttribute("aria-label", i + " / 5");
      st.innerHTML = STAR_SVG;
      st.onmouseenter = () => paint(i, "pre");
      /* qualquer estrela: acende de 1 até ela (com a animação) e, logo depois, abre a Play Store, igual ao botão amarelo */
      st.onclick = () => {
        if (busy) return;
        busy = true;
        paint(i, "on");
        paint(0, "pre");
        stars.forEach((s, k) => {
          s.setAttribute("aria-checked", k === i - 1 ? "true" : "false");
          s.classList.remove("pop");
          if (k < i) {
            s.style.animationDelay = k * 50 + "ms";
            void s.offsetWidth;
            s.classList.add("pop");
          }
        });
        setTimeout(
          () => {
            busy = false;
            if (row.isConnected) openStore();
          },
          320 + (i - 1) * 50,
        );
      };
      row.appendChild(st);
      stars.push(st);
    }
    row.onmouseleave = () => paint(0, "pre");
    b.querySelector("#rateGo").onclick = openStore;
  }
  $("#topRight").insertAdjacentHTML(
    "beforeend",
    '<button class="mb ib i-rate" id="mRate" type="button">Avaliar</button>',
  );
  $("#topRight").appendChild($("#mSet"));
  $("#mRate").onclick = () => scr("Avaliar jogo", renderRate);

  /* ================= v0.65: PERFIL DO JOGADOR =================
     Botão "Perfil" no canto superior esquerdo da tela inicial (Idioma e Notícias foram para o canto inferior direito).
     Dados em save.prof = { name, icon, since, st:{...estatísticas} }.
     Ícones de perfil: assets/icons/profile/<id>.png  (id = herói, demônio ou chefe: davi, paulo, imp, bat, legiao, dragao...).
     Se o PNG não existir, o jogo desenha o rosto a partir do sprite do personagem (não precisa de nenhum arquivo para funcionar).
     Textos de perfil escritos diretamente em português. */
  const PROF = {
    NAME_MIN: 3,
    NAME_MAX: 14,
    BTN_FS: 1.8, // BTN_FS: escala da moldura no botão Perfil do menu

    LOCK_HERO_ICONS: true, // true: o ícone de um herói só pode ser usado se o herói já estiver liberado
    ICON_DIR: "icons/profile/",
  };
  const PROF_FOES = FE_CONTENT.profileEnemyIds.map((x) => x.slice());
  const PROF_BOSSES = FE_CONTENT.profileBossIds.map((x) => x.slice());
  const PROF_TITLES = [
    ["Peregrino", 0],
    ["Discípulo", 0.05],
    ["Servo Fiel", 0.12],
    ["Vigia", 0.2],
    ["Guerreiro da Fé", 0.3],
    ["Intercessor", 0.4],
    ["Campeão da Fé", 0.52],
    ["Guardião do Reino", 0.65],
    ["Herdeiro da Glória", 0.8],
    ["Lenda do Reino", 0.95],
  ]; /* [nome, fração das conquistas] — cada título tem a sua moldura */
  /* ---- molduras do perfil: 10 níveis em pixel art (grade 46x46; o buraco central de 20x20 recebe o ícone) ---- */
  const PROF_FRAME_NAMES = [
    "Oliveira",
    "Bronze",
    "Prata",
    "Aço da Vigília",
    "Ouro Santo",
    "Esmeralda",
    "Safira",
    "Ametista",
    "Rubi da Glória",
    "Luz Eterna",
  ];
  const PROF_FRAME_N = 46,
    PROF_FRAME_HOLE = 20,
    PROF_FRAME_PAD = 13; /* pixels da grade: tamanho total, buraco, margem até o ícone */
  /* paleta por nível: [contorno, sombra, base, luz, brilho, pedra, ouro, ouro escuro, brilho interno] */
  const PROF_FRAME_PAL = [
    [
      "#24170a",
      "#4f3418",
      "#6f4a24",
      "#93653a",
      "#b88a56",
      "#c9a56a",
      "#c9a56a",
      "#6f4a24",
      "#93653a",
    ],
    [
      "#2a1308",
      "#6e3511",
      "#a85f27",
      "#d68a44",
      "#f5b878",
      "#ffe0a8",
      "#f2c14e",
      "#8a5a10",
      "#d68a44",
    ],
    [
      "#1b202e",
      "#5b6579",
      "#98a2b8",
      "#cdd4e3",
      "#f6f8ff",
      "#7db4ff",
      "#f2c14e",
      "#8a5a10",
      "#cdd4e3",
    ],
    [
      "#0c1730",
      "#26467a",
      "#4673b4",
      "#78a6e6",
      "#bcd8ff",
      "#ffd36a",
      "#f2c14e",
      "#8a5a10",
      "#78a6e6",
    ],
    [
      "#2b1a05",
      "#855510",
      "#cf951c",
      "#f2c14e",
      "#fff0a8",
      "#ff6a5a",
      "#fff0a8",
      "#855510",
      "#f2c14e",
    ],
    [
      "#06231a",
      "#0f6a4a",
      "#17a26b",
      "#4fd69a",
      "#b8ffe0",
      "#ff6a8a",
      "#f2c14e",
      "#8a5a10",
      "#7bffc0",
    ],
    [
      "#0a1640",
      "#1b45a8",
      "#2f6ee0",
      "#6ea4ff",
      "#c4dcff",
      "#ff7a5a",
      "#f2c14e",
      "#8a5a10",
      "#8fc0ff",
    ],
    [
      "#1d0a38",
      "#5d2aa0",
      "#8a4de0",
      "#b98cff",
      "#e6d2ff",
      "#7fe4ff",
      "#f2c14e",
      "#8a5a10",
      "#d2b0ff",
    ],
    [
      "#2e0710",
      "#8a1a2c",
      "#d12f46",
      "#ff6b7e",
      "#ffc2ca",
      "#7fe4ff",
      "#f2c14e",
      "#8a5a10",
      "#ff9aa8",
    ],
    [
      "#4a3510",
      "#c9a24a",
      "#f4e2a0",
      "#fff6d6",
      "#ffffff",
      "#7fe4ff",
      "#ffd45a",
      "#c58b21",
      "#fffbe8",
    ],
  ];
  /* devolve PROF_FRAME_N linhas x PROF_FRAME_N colunas com a cor (#hex) de cada pixel, ou null (transparente) */
  function profFrameGrid(tier) {
    const N = PROF_FRAME_N,
      M = 7,
      t = Math.max(1, Math.min(10, tier | 0)),
      P = PROF_FRAME_PAL[t - 1];
    const [OUT, SHD, BASE, LIT, HI, GEM, GOLD, GOLD_D, GLOW] = P,
      W = "#ffffff",
      R = 32; /* R = lado do anel (32) */
    const g = Array.from({ length: N }, () => Array(N).fill(null));
    const set = (x, y, c) => {
      if (x >= 0 && x < N && y >= 0 && y < N && c) g[y][x] = c;
    };
    const L = (x, y, c) =>
      set(x + M, y + M, c); /* coordenadas locais do anel 32x32 */
    const stamp = (rows, x0, y0, map, mirror) =>
      rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const ch = row[mirror ? row.length - 1 - i : i];
          if (ch !== ".") set(x0 + i, y0 + j, map[ch]);
        }
      });
    const inHole = (x, y) => x >= 6 && x <= 25 && y >= 6 && y <= 25;
    const cut = (x, y) =>
      x + y < 3 ||
      R - 1 - x + y < 3 ||
      x + R - 1 - y < 3 ||
      R - 1 - x + R - 1 - y < 3;
    /* 1) anel com bisel */
    for (let y = 0; y < R; y++)
      for (let x = 0; x < R; x++) {
        if (inHole(x, y) || cut(x, y)) continue;
        const d = Math.min(x, y, R - 1 - x, R - 1 - y),
          tl = Math.min(x, y) <= Math.min(R - 1 - x, R - 1 - y);
        L(
          x,
          y,
          d === 0
            ? OUT
            : d === 1
              ? tl
                ? HI
                : SHD
              : d === 2
                ? tl
                  ? LIT
                  : BASE
                : d === 3
                  ? BASE
                  : d === 4
                    ? tl
                      ? SHD
                      : LIT
                    : OUT,
        );
      }
    /* 2) brilho interno (6+) */
    if (t >= 6)
      for (let i = 6; i <= 25; i++) {
        const c = t >= 9 ? GLOW : SHD;
        L(i, 6, c);
        L(i, 25, c);
        L(6, i, c);
        L(25, i, c);
      }
    /* 3) pontilhado na faixa (4+) */
    if (t >= 4)
      for (let i = 8; i <= 23; i += 2) {
        L(i, 3, HI);
        L(i, 28, HI);
        L(3, i, HI);
        L(28, i, HI);
      }
    /* 4) pinos nos cantos (2+) */
    if (t >= 2)
      [
        [3, 3],
        [28, 3],
        [3, 28],
        [28, 28],
      ].forEach(([cx, cy]) => {
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const m = Math.abs(dx) + Math.abs(dy);
            if (m > 2) continue;
            L(
              cx + dx,
              cy + dy,
              m === 0
                ? GEM
                : m === 1
                  ? t >= 5
                    ? GOLD
                    : HI
                  : t >= 5
                    ? GOLD_D
                    : OUT,
            );
          }
      });
    /* 5) pinos no meio dos lados (3+) */
    if (t >= 3)
      [
        [16, 3, 1, 0],
        [16, 28, 1, 0],
        [3, 16, 0, 1],
        [28, 16, 0, 1],
      ].forEach(([cx, cy, ax, ay]) => {
        for (let k = -2; k <= 1; k++) {
          const x = cx + k * ax,
            y = cy + k * ay;
          L(x, y, k === -1 || k === 0 ? GEM : t >= 5 ? GOLD : HI);
          L(x + ay, y + ax, OUT);
          L(x - ay, y - ax, OUT);
        }
      });
    const C = { O: OUT, G: GOLD, g: GOLD_D, H: HI, J: GEM, W: W, L: LIT };
    const cx = N / 2;
    /* 6) coroa (5+): simples, alta ou real */
    const crownA = [
      ".O...O...O.",
      "OGO.OGO.OGO",
      "OGGOGGGOGGO",
      "OGGGGGGGGGO",
      "OGgGGJGGgGO",
      ".OOOOOOOOO.",
    ];
    const crownB = [
      "..O...O...O..",
      ".OGO.OGO.OGO.",
      "OGGGOGGGOGGGO",
      "OGGGGGGGGGGGO",
      "OGgGGGJGGGgGO",
      "OGGGGGGGGGGGO",
      ".OOOOOOOOOOO.",
    ];
    const crownC = [
      ".......O.......",
      "..O...OGO...O..",
      ".OGO.OGGGO.OGO.",
      "OGGGOGGGGGOGGGO",
      "OGGGGGGGGGGGGGO",
      "OGgGGGGJGGGGgGO",
      "OGGGGGGGGGGGGGO",
      ".OOOOOOOOOOOOO.",
    ];
    if (t >= 5) {
      const rows = t >= 9 ? crownC : t >= 7 ? crownB : crownA,
        w = rows[0].length;
      stamp(rows, cx - (w >> 1) - 0, M + 2 - rows.length, C);
    }
    /* 7) joias laterais (6+) */
    if (t >= 6)
      [
        [3, 23],
        [N - 4, 23],
      ].forEach(([x, y]) => {
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const m = Math.abs(dx) + Math.abs(dy);
            if (m > 2) continue;
            set(x + dx, y + dy, m === 0 ? GEM : m === 1 ? GOLD : GOLD_D);
          }
      });
    /* 8) losangos fora dos cantos (7+) */
    if (t >= 7)
      [
        [4, 4],
        [N - 5, 4],
        [4, N - 5],
        [N - 5, N - 5],
      ].forEach(([x, y]) => {
        set(x, y, GEM);
        set(x - 1, y, GOLD);
        set(x + 1, y, GOLD);
        set(x, y - 1, GOLD);
        set(x, y + 1, GOLD);
      });
    /* 9) asas (8: pequenas, 9+: grandes) */
    const wingL = [
      "........",
      ".gg.....",
      "gGHg....",
      ".gGHg...",
      "..gGHgg.",
      "gggGGHHg",
      "gGGHHGGG",
      "gggGGHHg",
      "..gGHgg.",
      ".gGHg...",
      "gGHg....",
      ".gg.....",
      "........",
    ];
    const wingS = wingL.slice(2, 11);
    if (t >= 8) {
      const wr = t >= 9 ? wingL : wingS,
        yy = cx - (wr.length >> 1);
      stamp(wr, M - 8, yy, C);
      stamp(wr, N - M, yy, C, true);
    }
    /* 10) nível 10: faíscas e raios de luz */
    if (t >= 10) {
      [
        [3, 3],
        [N - 4, 3],
        [3, N - 4],
        [N - 4, N - 4],
      ].forEach(([x, y]) => {
        set(x, y, W);
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].forEach(([a, b]) => set(x + a, y + b, GOLD));
      });
      for (let k = 0; k < 4; k++) {
        set(cx - 8 - k, 3 - (k >> 1), GOLD);
        set(cx + 7 + k, 3 - (k >> 1), GOLD);
      }
    }
    return g;
  }
  const PROF_FRAME_URL = {};
  /* imagem (data URL) da moldura, desenhada uma vez por nível */
  function profFrameURL(tier) {
    const t = Math.max(1, Math.min(10, tier | 0));
    if (PROF_FRAME_URL[t]) return PROF_FRAME_URL[t];
    const c = document.createElement("canvas");
    c.width = c.height = PROF_FRAME_N;
    const g = c.getContext("2d"),
      grid = profFrameGrid(t);
    for (let y = 0; y < PROF_FRAME_N; y++)
      for (let x = 0; x < PROF_FRAME_N; x++)
        if (grid[y][x]) {
          g.fillStyle = grid[y][x];
          g.fillRect(x, y, 1, 1);
        }
    return (PROF_FRAME_URL[t] = c.toDataURL("image/png"));
  }
  const PROF_IMG = {}; // id -> url do PNG carregado
  /* lista completa de ícones: heróis (lidos do jogo, então heróis novos entram sozinhos), demônios e chefes */
  function profIconList() {
    const L = [];
    for (const k in HX) L.push({ id: k, name: HX[k].name || k, cat: "hero" });
    for (const [id, name] of PROF_FOES) L.push({ id, name, cat: "demon" });
    for (const [id, name] of PROF_BOSSES) L.push({ id, name, cat: "boss" });
    return L;
  }
  const profIconInfo = (id) => profIconList().find((x) => x.id === id) || null;
  /* ícone liberado? herói: segue o herói; demônio/chefe: comprado na Loja (save.icons) */
  function profIconLocked(id) {
    const i = profIconInfo(id);
    if (!i) return true;
    if (i.cat === "hero")
      return !!(PROF.LOCK_HERO_ICONS && HX[id] && HX[id].locked);
    return !(save.icons && save.icons[id]);
  }
  const profIconCost = (id) => {
    const i = profIconInfo(id);
    return !i || i.cat === "hero"
      ? 0
      : ECO.ICON_COST[id] || ECO.ICON_COST.demon;
  };
  /* ---------- avatar: PNG se existir, senão o rosto desenhado a partir do sprite ---------- */
  function profPaintAvatar(el, id) {
    el.textContent = "";
    if (PROF_IMG[id]) {
      const im = document.createElement("img");
      im.src = PROF_IMG[id];
      im.alt = "";
      im.draggable = false;
      el.appendChild(im);
      return;
    }
    const isHero = !!(HX[id] && S.hero && S.hero[id]),
      sp = isHero ? S.hero[id][0] : S[id];
    if (sp && sp.c && sp.w && sp.h) {
      const cw = sp.w,
        ch = isHero
          ? Math.min(sp.h, Math.max(8, Math.round(sp.w * 1.05)))
          : sp.h; /* herói: só a parte de cima (rosto) */
      const c = document.createElement("canvas");
      c.width = cw;
      c.height = ch;
      c.className = "prof-av-cv";
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.drawImage(sp.c, 0, 0, cw, ch, 0, 0, cw, ch);
      el.appendChild(c);
      return;
    }
    const i = profIconInfo(id);
    el.classList.add("is-ph");
    el.textContent = ((i && i.name) || "?").charAt(0).toUpperCase();
  }

  /* HUD: busto do herói ao lado da barra de Salvação (reaproveita o avatar do perfil) */
  function hudHeroAvatar() {
    const el = $("#hudAv");
    if (!el || !G) return;
    el.className = "prof-av";
    el.dataset.icon = G.hk;
    profPaintAvatar(el, G.hk);
  }

  function profAvatar(id, px) {
    const el = document.createElement("span");
    el.className = "prof-av";
    el.style.setProperty("--av", px + "px");
    el.dataset.icon = id;
    profPaintAvatar(el, id);
    return el;
  }
  /* ---------- dados ---------- */
  function profEnsure() {
    let P = save.prof;
    if (!P || typeof P !== "object") P = save.prof = {};
    if (typeof P.name !== "string" || !P.name)
      P.name = "Peregrino" + String(save.pid || "0000").slice(-4);
    if (!save.icons || typeof save.icons !== "object") save.icons = {};
    if (!P.icon || !profIconInfo(P.icon) || profIconLocked(P.icon))
      P.icon = HX[save.hero] && !HX[save.hero].locked ? save.hero : "davi";
    if (typeof P.named !== "boolean") P.named = false;
    if (typeof P.frame !== "number")
      P.frame = 0; /* 0 = automática (a mais alta liberada); 1..10 = moldura escolhida */
    if (!P.since) P.since = dayKey();
    if (!P.st) {
      /* jogadores antigos: estimativa inicial. Vitórias = pelo menos 1 por herói com vitória registrada; o resto das partidas vira derrota. */
      const runs = save.runs || 0,
        wins = Math.min(runs, Object.keys(save.winH || {}).length),
        ph = {};
      for (const k in save.mast || {})
        if (save.mast[k] > 0 && HX[k])
          ph[k] = { n: 1, w: save.winH && save.winH[k] ? 1 : 0 };
      if (runs > 0) {
        const used = Object.values(ph).reduce((a, x) => a + x.n, 0),
          h = HX[save.hero] ? save.hero : "davi";
        (ph[h] = ph[h] || { n: 0, w: 0 }).n += Math.max(0, runs - used);
      }
      P.st = {
        w: wins,
        l: Math.max(0, runs - wins),
        q: 0,
        kills: 0,
        bosses: 0,
        time: 0,
        coins: 0,
        maxLvl: 0,
        maxKills: 0,
        ph,
        days: 0,
        streak: 0,
        bestStreak: 0,
        last: "",
      };
    }
    return P;
  }
  /* dia jogado (fuso de Brasília, igual ao Desafio do Dia): conta ao iniciar uma partida */
  function profTouchDay() {
    if (TUT.on) return;
    const st = profEnsure().st,
      k = dayKey();
    if (st.last === k) return;
    st.streak = st.last === yday(k) ? st.streak + 1 : 1;
    st.last = k;
    st.days++;
    st.bestStreak = Math.max(st.bestStreak, st.streak);
    persist();
  }
  /* chamado no fim de cada partida (endRun). Desistir e guardar conta como "abandonada": não é vitória nem derrota. */
  function profRecordRun(won, ret) {
    if (TUT.on || !G) return;
    const g = G,
      st = profEnsure().st,
      mode = g.inf ? "inf" : "std",
      hk = g.hk || selHero;
    if (ret) st.q++;
    else if (mode === "std") {
      if (won) st.w++;
      else st.l++;
    }
    st.kills += g.kills | 0;
    st.bosses += g.bossIdx | 0;
    st.time += Math.floor(g.t || 0);
    st.coins += runCoins(g);
    st.maxLvl = Math.max(st.maxLvl, g.lvl | 0);
    st.maxKills = Math.max(st.maxKills, g.kills | 0);
    const h = st.ph[hk] || (st.ph[hk] = { n: 0, w: 0 });
    h.n++;
    if (won && mode === "std" && !ret) h.w++;
    persist();
  }
  /* ---------- regras do nome ---------- */
  const PROF_RESERVED = [
    "admin",
    "administrador",
    "moderador",
    "suporte",
    "oficial",
    "staff",
    "sistema",
    "gamemaster",
    "snowstudio",
    "fesurvivor",
    "fe survivor",
    "snow studio",
  ];
  const PROF_BAD_LONG = [
    "caralho",
    "buceta",
    "fodase",
    "foder",
    "merda",
    "porra",
    "viado",
    "arrombad",
    "vagabund",
    "estupr",
    "pedofil",
    "nazist",
    "hitler",
    "suicid",
    "fuck",
    "shit",
    "bitch",
    "nigger",
    "nigga",
    "faggot",
    "whore",
    "slut",
    "pussy",
    "cunt",
  ];
  const PROF_BAD_TOK = [
    "puta",
    "cu",
    "pau",
    "pica",
    "rola",
    "dick",
    "cock",
    "rape",
    "anal",
    "sex",
    "sexo",
    "porn",
    "pedo",
    "nazi",
    "kkk",
  ];
  const profFold = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/0/g, "o")
      .replace(/1/g, "i")
      .replace(/3/g, "e")
      .replace(/4/g, "a")
      .replace(/5/g, "s")
      .replace(/7/g, "t");
  const profCollapse = (s) => s.replace(/(.)\1+/g, "$1");
  function profBadWord(name) {
    const f = profFold(name),
      toks = f.split(" ").filter(Boolean),
      flat = f.replace(/ /g, ""),
      cf = profCollapse(flat);
    if (
      toks.some(
        (x) =>
          PROF_BAD_TOK.includes(x) || PROF_BAD_TOK.includes(profCollapse(x)),
      )
    )
      return true;
    if (
      flat.length >= 4 &&
      (PROF_BAD_TOK.includes(flat) || PROF_BAD_TOK.includes(cf))
    )
      return true; /* letras separadas por espaço: "P u t a" */
    return PROF_BAD_LONG.some(
      (w) =>
        flat.includes(w) ||
        (profCollapse(w).length >= 6 && cf.includes(profCollapse(w))),
    );
  }
  /* devolve { ok, name, err } — name já vem normalizado (sem espaços sobrando) */
  function profCheckName(raw) {
    const name = String(raw == null ? "" : raw)
      .replace(/\s+/g, " ")
      .trim();
    if (name.length < PROF.NAME_MIN)
      return {
        ok: false,
        name,
        err: "Use pelo menos " + PROF.NAME_MIN + " caracteres.",
      };
    if (name.length > PROF.NAME_MAX)
      return {
        ok: false,
        name,
        err: "Use no máximo " + PROF.NAME_MAX + " caracteres.",
      };
    if (!/^[A-Za-zÀ-ÖØ-öø-ÿ0-9 ]+$/.test(name))
      return { ok: false, name, err: "Use só letras, números e espaços." };
    if ((name.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []).length < 2)
      return { ok: false, name, err: "Inclua pelo menos 2 letras." };
    if (/(.)\1{3,}/i.test(name))
      return {
        ok: false,
        name,
        err: "Evite repetir o mesmo caractere mais de 3 vezes.",
      };
    const flat = profFold(name).replace(/ /g, "");
    if (PROF_RESERVED.some((r) => flat === r.replace(/ /g, "")))
      return { ok: false, name, err: "Este nome é reservado." };
    if (profBadWord(name))
      return {
        ok: false,
        name,
        err: "Este nome não é permitido. Escolha outro.",
      };
    return { ok: true, name, err: "" };
  }
  const profClean = (s) =>
    String(s || "")
      .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9 ]/g, "")
      .replace(/ {2,}/g, " ")
      .slice(0, PROF.NAME_MAX);
  /* ---------- formatação ---------- */
  function profDur(s) {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60);
    return h > 0
      ? h + "h " + String(m).padStart(2, "0") + "min"
      : m > 0
        ? m + "min " + String(s % 60).padStart(2, "0") + "s"
        : s + "s";
  }
  const profNum = (n) => (n || 0).toLocaleString("pt-BR");
  function profTitle() {
    const n = Object.keys(save.ach || {}).length,
      tot = ACH.length || 1,
      need = PROF_TITLES.map((x) => Math.ceil(x[1] * tot - 1e-9));
    let tier = 1;
    for (let j = 0; j < PROF_TITLES.length; j++) if (n >= need[j]) tier = j + 1;
    return {
      tier,
      cur: PROF_TITLES[tier - 1][0],
      frame: PROF_FRAME_NAMES[tier - 1],
      next: tier < 10 ? PROF_TITLES[tier][0] : "",
      needNext: tier < 10 ? need[tier] : 0,
      need,
      n,
      total: ACH.length,
    };
  }
  /* moldura em uso: a escolhida pelo jogador, se já liberada; senão a do título atual */
  function profFrameTier(T) {
    T = T || profTitle();
    const f = profEnsure().frame | 0;
    return f >= 1 && f <= T.tier ? f : T.tier;
  }
  /* avatar dentro da moldura do nível; fs = tamanho de cada pixel da moldura em px (a moldura toda tem 46 pixels) */
  function profFrameApply(w, fs, tier) {
    w.style.setProperty("--fs", fs + "px");
    w.style.setProperty("--fr", "url(" + profFrameURL(tier) + ")");
    w.dataset.tier = tier;
  }
  function profFramed(id, fs, tier) {
    const w = document.createElement("span");
    w.className = "prof-frame";
    profFrameApply(w, fs, tier);
    const av = document.createElement("span");
    av.className = "prof-av";
    av.dataset.icon = id;
    profPaintAvatar(av, id);
    w.appendChild(av);
    return w;
  }
  /* ---------- botão do menu ---------- */
  function profBtnSync() {
    const btn = $("#profBtn");
    if (!btn) return;
    const P = profEnsure(),
      fr = $("#profBtnFrame");
    if (fr) {
      profFrameApply(fr, PROF.BTN_FS, profFrameTier());
      const av = fr.querySelector(".prof-av");
      if (av) {
        av.dataset.icon = P.icon;
        profPaintAvatar(av, P.icon);
      }
    }
    const nm = $("#profBtnName");
    if (nm) nm.textContent = P.name;
    const tt = $("#profBtnTitle");
    if (tt) tt.textContent = profTitle().cur.toUpperCase();
  }
  function profInit() {
    const btn = $("#profBtn");
    if (btn && !btn.dataset.ready) {
      btn.dataset.ready = 1;
      btn.onclick = () => scr("Perfil", renderProfile);
    }
    profIconList().forEach((i) =>
      loadImg(
        PROF.ICON_DIR + i.id + ".png",
        (im) => {
          PROF_IMG[i.id] = im.src;
          profBtnSync();
          if (!SCR.hidden && $("#sT").textContent === "Perfil")
            renderProfile($("#sB"));
        },
        null,
      ),
    );
    profBtnSync();
  }
  /* ---------- seletor de ícone ---------- */
  let profPick = null;
  function profPickEnsure() {
    if (profPick) return profPick;
    const ov = document.createElement("div");
    ov.className = "ov pf-overlay";
    ov.hidden = true;
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-labelledby", "pfPickT");
    ov.innerHTML =
      '<div class="ov-in pf-pick"><h2 id="pfPickT">Escolha seu ícone</h2><p class="sub">Heróis, demônios e chefes</p><div class="pf-pick-tabs" role="tablist"></div><div class="pf-pick-grid"></div><button type="button" class="mb pf-pick-shop" hidden>Comprar na Loja</button><button type="button" class="mb back-btn pf-pick-close" aria-label="Voltar"><span class="pxchev" aria-hidden="true"></span></button></div>';
    gameEl.appendChild(ov);
    ov.addEventListener("pointerdown", (e) => {
      if (e.target === ov) profPickClose();
    });
    ov.querySelector(".pf-pick-close").onclick = profPickClose;
    ov.querySelector(".pf-pick-shop").onclick = () => {
      ov.hidden = true;
      shopSec = "icons";
      scr("Loja", renderStore);
    };
    profPick = { ov, tab: "hero" };
    return profPick;
  }
  function profPickClose() {
    if (profPick) profPick.ov.hidden = true;
    const b = $(".pf-avatar");
    if (b) b.focus({ preventScroll: true });
  }
  function profPickOpen() {
    const p = profPickEnsure(),
      P = profEnsure(),
      info = profIconInfo(P.icon);
    p.tab = info ? info.cat : "hero";
    p.ov.hidden = false;
    profPickDraw();
  }
  function profPickDraw() {
    const p = profPick,
      P = profEnsure(),
      tabs = p.ov.querySelector(".pf-pick-tabs"),
      grid = p.ov.querySelector(".pf-pick-grid"),
      L = profIconList();
    const CATS = [
      ["hero", "Heróis"],
      ["demon", "Demônios"],
      ["boss", "Chefes"],
    ],
      n = (v) => v.toLocaleString("pt-BR");
    tabs.innerHTML = "";
    grid.innerHTML = "";
    p.ov.querySelector(".pf-pick-shop").hidden = p.tab === "hero";
    p.ov.querySelector(".sub").textContent =
      p.tab === "hero"
        ? "Os ícones dos heróis são liberados junto com o herói."
        : "Ícones bloqueados podem ser comprados na Loja.";
    for (const [c, label] of CATS) {
      const bt = document.createElement("button");
      bt.type = "button";
      bt.className = "mb pf-tab" + (p.tab === c ? " on" : "");
      bt.setAttribute("role", "tab");
      bt.setAttribute("aria-selected", p.tab === c ? "true" : "false");
      const li = L.filter((x) => x.cat === c);
      bt.textContent =
        label +
        " " +
        li.filter((x) => !profIconLocked(x.id)).length +
        "/" +
        li.length;
      bt.onclick = () => {
        p.tab = c;
        profPickDraw();
      };
      tabs.appendChild(bt);
    }
    for (const it of L.filter((x) => x.cat === p.tab)) {
      const lk = profIconLocked(it.id),
        cost = profIconCost(it.id),
        bt = document.createElement("button");
      bt.type = "button";
      bt.className =
        "pf-ico" + (P.icon === it.id ? " sel" : "") + (lk ? " lk" : "");
      bt.setAttribute("aria-label", it.name + (lk ? " (bloqueado)" : ""));
      bt.appendChild(profAvatar(it.id, 52));
      if (lk)
        bt.insertAdjacentHTML(
          "beforeend",
          '<span class="uic i-lock pf-ico-lock" aria-hidden="true"></span>',
        );
      bt.insertAdjacentHTML("beforeend", "<small></small>");
      bt.lastChild.textContent = it.name;
      if (lk && cost)
        bt.insertAdjacentHTML(
          "beforeend",
          '<span class="pf-ico-price"><span class="uic i-coin"></span> ' +
          n(cost) +
          "</span>",
        );
      bt.onclick = () => {
        if (lk)
          return deny(
            bt,
            it.cat === "hero"
              ? "Libere o herói " + it.name + " para usar este ícone."
              : "Compre este ícone na Loja por " + n(cost) + " moedas.",
          );
        P.icon = it.id;
        persist();
        SFX.play("coin");
        profBtnSync();
        profPick.ov.hidden = true;
        notify("Ícone atualizado!", "ok");
        if (!SCR.hidden) renderProfile($("#sB"));
      };
      grid.appendChild(bt);
    }
  }
  addEventListener(
    "keydown",
    (e) => {
      if (profPick && !profPick.ov.hidden && e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        profPickClose();
      }
    },
    true,
  );
  $("#sBack").addEventListener("click", () => {
    if (profPick) profPick.ov.hidden = true;
  }); /* Voltar/botão do Android fecha o seletor junto */
  /* ---------- tela do Perfil ---------- */
  function profFav(st) {
    const rows = Object.keys(st.ph)
      .filter((k) => HX[k] && st.ph[k].n > 0)
      .map((k) => ({ k, n: st.ph[k].n, w: st.ph[k].w }))
      .sort((a, b) => b.n - a.n || b.w - a.w);
    return rows;
  }
  /* formulário de nome (tela de Perfil e boas-vindas): filtra caracteres ao digitar, mostra contador e valida ao salvar */
  function profNameForm(host, o) {
    host.innerHTML = "";
    const f = document.createElement("div");
    f.className = "pf-form";
    f.innerHTML =
      '<input class="pf-input" type="text" inputmode="text" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="done" aria-label="Nome do personagem"><div class="pf-count"></div><div class="pf-err" role="alert"></div><div class="pf-hint">' +
      PROF.NAME_MIN +
      " a " +
      PROF.NAME_MAX +
      ' caracteres. Só letras, números e espaços.</div><div class="pf-btns"></div>';
    host.appendChild(f);
    const inp = f.querySelector(".pf-input"),
      cnt = f.querySelector(".pf-count"),
      err = f.querySelector(".pf-err"),
      btns = f.querySelector(".pf-btns");
    const sv = document.createElement("button");
    sv.type = "button";
    sv.className = "btn pf-save";
    sv.textContent = o.saveLabel || "Salvar";
    btns.appendChild(sv);
    if (o.cancelLabel) {
      const cb = document.createElement("button");
      cb.type = "button";
      cb.className = "btn alt pf-cancel";
      cb.textContent = o.cancelLabel;
      cb.onclick = () => o.onCancel && o.onCancel();
      btns.appendChild(cb);
    }
    inp.maxLength = PROF.NAME_MAX;
    inp.placeholder = o.placeholder || "";
    inp.value = o.value || "";
    const upd = () => {
      const c = profClean(inp.value);
      if (c !== inp.value) inp.value = c;
      cnt.textContent = inp.value.trim().length + "/" + PROF.NAME_MAX;
      err.textContent = "";
      inp.classList.remove("bad");
    };
    const submit = () => {
      const r = profCheckName(inp.value);
      if (!r.ok) {
        err.textContent = r.err;
        inp.classList.add("bad");
        deny(inp, "");
        return;
      }
      o.onSave(r.name);
    };
    inp.addEventListener("input", upd);
    inp.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      } else if (e.key === "Escape" && o.cancelLabel) {
        e.preventDefault();
        o.onCancel && o.onCancel();
      }
    });
    inp.addEventListener("keyup", (e) => e.stopPropagation());
    sv.onclick = submit;
    upd();
    setTimeout(() => {
      try {
        inp.focus();
        inp.select();
      } catch (e) { }
    }, 60);
    return inp;
  }
  /* boas-vindas: abre na tela inicial logo depois do tutorial (ou na 1ª abertura desta versão) pedindo o nome, com o ícone do Davi */
  let profWel = null;
  function profWelcomeMaybe() {
    if (profWel) return true;
    if (
      TUT.on ||
      state !== "menu" ||
      !save.tut ||
      document.getElementById("boot") ||
      (newsModal && !newsModal.hidden)
    )
      return false;
    if (profEnsure().named) return false;
    profWelcomeOpen();
    return true;
  }
  function profWelcomeOpen() {
    const P = profEnsure();
    if (!(save.runs > 0)) P.icon = "davi";
    const ov = document.createElement("div");
    ov.className = "ov pf-overlay pf-welcome";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-labelledby", "pfWelT");
    ov.innerHTML =
      '<div class="ov-in pf-wel"><div class="pf-wel-av"></div><h2 id="pfWelT">Bem-vindo, peregrino!</h2><p class="sub">Como devemos te chamar na jornada?</p><div class="pf-wel-form"></div><p class="pf-wel-note">Você pode mudar o nome e o ícone quando quiser, no Perfil.</p></div>';
    gameEl.appendChild(ov);
    profWel = ov;
    ov.querySelector(".pf-wel-av").appendChild(
      profFramed(P.icon, 2, profFrameTier()),
    );
    const close = () => {
      ov.remove();
      profWel = null;
      P.named = true;
      persist();
      profBtnSync();
      try {
        starterMenu();
      } catch (e) { }
    };
    profNameForm(ov.querySelector(".pf-wel-form"), {
      value: "",
      placeholder: "Seu nome",
      saveLabel: "Começar",
      cancelLabel: "Agora não",
      onCancel: close,
      onSave: (name) => {
        P.name = name;
        SFX.play("coin");
        close();
        notify("Bem-vindo, " + name + "!", "ok");
      },
    });
  }
  function renderProfile(b) {
    const P = profEnsure(),
      st = P.st,
      T = profTitle(),
      pid = String(save.pid || "");
    b.innerHTML = "";
    const root = document.createElement("div");
    root.className = "pf";
    b.appendChild(root);
    /* --- coluna da esquerda: identidade --- */
    const id = document.createElement("div");
    id.className = "pf-card pf-id";
    root.appendChild(id);
    const avb = document.createElement("button");
    avb.type = "button";
    avb.className = "pf-avatar";
    avb.setAttribute("aria-label", "Trocar ícone");
    const fr = profFramed(P.icon, 3, profFrameTier(T));
    fr.insertAdjacentHTML("beforeend", "<em>TROCAR</em>");
    avb.appendChild(fr);
    avb.onclick = profPickOpen;
    id.appendChild(avb);
    const nr = document.createElement("div");
    nr.className = "pf-namerow";
    id.appendChild(nr);
    const drawName = () => {
      nr.innerHTML = "";
      const nm = document.createElement("b");
      nm.className = "pf-name";
      nm.textContent = P.name;
      nr.appendChild(nm);
      const eb = document.createElement("button");
      eb.type = "button";
      eb.className = "mb pf-edit";
      eb.textContent = "Editar nome";
      eb.onclick = editName;
      nr.appendChild(eb);
    };
    const editName = () =>
      profNameForm(nr, {
        value: P.name,
        saveLabel: "Salvar",
        cancelLabel: "Cancelar",
        onCancel: drawName,
        onSave: (name) => {
          P.name = name;
          persist();
          profBtnSync();
          SFX.play("coin");
          notify("Nome atualizado!", "ok");
          drawName();
        },
      });
    drawName();
    const pct = T.total ? Math.round((T.n / T.total) * 100) : 0,
      base = T.need[T.tier - 1],
      span = T.next ? Math.max(1, T.needNext - base) : 1,
      bar = T.next ? Math.round(((T.n - base) / span) * 100) : 100;
    id.insertAdjacentHTML(
      "beforeend",
      '<div class="pf-title"></div><div class="pf-subt"></div><div class="pf-ach"><span></span><i><u></u></i></div><div class="pf-meta"><span>ID do jogador <b></b></span><span>Jogando desde <b></b></span></div>',
    );
    id.querySelector(".pf-title").textContent = T.cur;
    id.querySelector(".pf-subt").textContent =
      "Título " +
      T.tier +
      " de " +
      PROF_TITLES.length +
      " · Moldura " +
      T.frame;
    id.querySelector(".pf-ach span").textContent =
      "Conquistas " +
      T.n +
      "/" +
      T.total +
      (T.next
        ? " · faltam " + (T.needNext - T.n) + " para " + T.next
        : " · título máximo");
    id.querySelector(".pf-ach u").style.width =
      Math.max(0, Math.min(100, bar)) + "%";
    const mb = id.querySelectorAll(".pf-meta b");
    mb[0].textContent = pid || "—";
    mb[1].textContent = fmtDate(P.since);
    /* --- coluna da direita --- */
    const right = document.createElement("div");
    right.className = "pf-right";
    root.appendChild(right);
    /* herói mais jogado, com o sprite animado (o intervalo global anima todo canvas[data-hero]) */
    const fav = profFav(st),
      top = fav[0] || { k: HX[selHero] ? selHero : "davi", n: 0, w: 0 },
      FX = HX[top.k],
      sp = S.hero && S.hero[top.k] && S.hero[top.k][0];
    const fc = document.createElement("div");
    fc.className = "pf-card pf-fav";
    right.appendChild(fc);
    fc.insertAdjacentHTML(
      "beforeend",
      '<div class="pf-cap">HERÓI MAIS JOGADO</div>',
    );
    const fb = document.createElement("div");
    fb.className = "pf-favbody";
    fc.appendChild(fb);
    const stage = document.createElement("div");
    stage.className = "pf-stage";
    fb.appendChild(stage);
    if (sp) {
      const c = document.createElement("canvas");
      c.width = sp.w;
      c.height = sp.h;
      c.className = "pf-sprite";
      c.dataset.hero = top.k;
      const sc = Math.max(2, Math.min(6, Math.floor(92 / sp.h)));
      c.style.width = sp.w * sc + "px";
      c.style.height = sp.h * sc + "px";
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.drawImage(sp.c, 0, 0);
      stage.appendChild(c);
    }
    const fi = document.createElement("div");
    fi.className = "pf-faveinfo";
    fb.appendChild(fi);
    const wr = top.n ? Math.round((top.w / top.n) * 100) : 0,
      H = HEROES[top.k] || {};
    fi.innerHTML =
      '<b class="pf-favname"></b><span class="pf-favrole"></span><div class="pf-favstats"><span><b></b>partidas</span><span><b></b>vitórias</span><span><b></b>maestria</span></div>';
    fi.querySelector(".pf-favname").textContent = (FX && FX.name) || top.k;
    fi.querySelector(".pf-favrole").textContent = top.n
      ? H.role || ""
      : "Jogue para registrar seu herói favorito";
    const fs = fi.querySelectorAll(".pf-favstats b");
    fs[0].textContent = profNum(top.n);
    fs[1].textContent = top.n ? profNum(top.w) + " (" + wr + "%)" : "—";
    fs[2].textContent = FX && !FX.ch ? "Nv " + mlv(top.k) : "—";
    if (fav.length > 1) {
      const lst = document.createElement("div");
      lst.className = "pf-top3";
      const max = fav[0].n || 1;
      fav.slice(0, 4).forEach((r, i) => {
        const row = document.createElement("div");
        row.className = "pf-top3row";
        row.innerHTML = '<span class="n"></span><i><u></u></i><b></b>';
        row.querySelector(".n").textContent = i + 1 + ". " + HX[r.k].name;
        row.querySelector("u").style.width =
          Math.max(6, Math.round((r.n / max) * 100)) + "%";
        row.querySelector("b").textContent = profNum(r.n);
        lst.appendChild(row);
      });
      fc.appendChild(lst);
    }
    /* títulos e molduras: um por faixa de conquistas; os bloqueados aparecem apagados */
    const ts = document.createElement("div");
    ts.className = "pf-sec";
    ts.innerHTML =
      '<div class="pf-cap">TÍTULOS E MOLDURAS</div><p class="pf-capnote">Toque numa moldura liberada para usá-la no seu ícone.</p><div class="pf-titles"></div>';
    let used = profFrameTier(T);
    const cells = [],
      cellLabel = (j) =>
        j + 1 === used
          ? "Em uso"
          : T.need[j]
            ? T.need[j] + " conquistas"
            : "Início";
    const equip = (n) => {
      used = n;
      P.frame = n;
      persist();
      profBtnSync();
      profFrameApply(fr, 3, n);
      SFX.play("coin");
      cells.forEach((c, j) => {
        c.classList.toggle("cur", j + 1 === n);
        c.querySelector("small").textContent = cellLabel(j);
        c.setAttribute("aria-pressed", j + 1 === n ? "true" : "false");
      });
    };
    T.need.forEach((need, i) => {
      const c = document.createElement("button");
      c.type = "button";
      c.className =
        "pf-trk" +
        (i + 1 === used ? " cur" : "") +
        (i + 1 > T.tier ? " lk" : "");
      c.title = PROF_TITLES[i][0] + " · moldura " + PROF_FRAME_NAMES[i];
      c.setAttribute("aria-pressed", i + 1 === used ? "true" : "false");
      c.appendChild(profFramed(P.icon, 1, i + 1));
      c.insertAdjacentHTML("beforeend", "<b></b><small></small>");
      c.querySelector("b").textContent = PROF_TITLES[i][0];
      c.querySelector("small").textContent = cellLabel(i);
      c.onclick = () => {
        if (i + 1 > T.tier)
          return deny(
            c,
            "Desbloqueie esta moldura com " + need + " conquistas.",
          );
        equip(i + 1);
      };
      cells.push(c);
      ts.lastChild.appendChild(c);
    });
    right.appendChild(ts);
    /* estatísticas */
    const dec = st.w + st.l,
      rate = dec ? Math.round((st.w / dec) * 1000) / 10 : null;
    const dk = dayKey(),
      D = save.daily || {},
      dStr = D.last === dk || D.last === yday(dk) ? D.streak || 0 : 0,
      curStreak = st.last === dk || st.last === yday(dk) ? st.streak : 0;
    const heroIds = Object.keys(HX),
      heroOpen = heroIds.filter((k) => !HX[k].locked).length;
    const tiles = [
      [
        "JORNADA",
        [
          [
            "Partidas",
            profNum(save.runs || 0),
            st.q ? profNum(st.q) + " abandonadas" : "",
          ],
          ["Vitórias", profNum(st.w), "Amanhecer"],
          ["Derrotas", profNum(st.l), "Amanhecer"],
          [
            "Taxa de vitória",
            rate == null ? "—" : String(rate).replace(".", ",") + "%",
            "",
            rate == null ? 0 : rate,
          ],
          [
            "Maior tempo sobrevivido",
            save.best ? fmt(save.best) : "—",
            "Modo Amanhecer",
          ],
          [
            "Vigília Eterna",
            save.bestInf ? fmt(save.bestInf) : "—",
            "Melhor tempo",
          ],
        ],
      ],
      [
        "COMBATE",
        [
          ["Demônios derrotados", profNum(st.kills), "Desde esta versão"],
          ["Recorde de abates", profNum(st.maxKills), "Em uma partida"],
          ["Chefes derrotados", profNum(st.bosses), "Desde esta versão"],
          [
            "Maior nível de fé",
            st.maxLvl ? String(st.maxLvl) : "—",
            "Em uma partida",
          ],
          [
            "Tempo jogado",
            st.time ? profDur(st.time) : "—",
            "Desde esta versão",
          ],
          ["Moedas ganhas", profNum(st.coins), "Em partidas"],
        ],
      ],
      [
        "CONSTÂNCIA E COLEÇÃO",
        [
          [
            "Dias em sequência",
            String(curStreak),
            curStreak ? "jogando todo dia" : "Jogue hoje para começar",
          ],
          ["Melhor sequência", String(st.bestStreak || 0) + " d", ""],
          ["Dias jogados", String(st.days || 0), "No total"],
          ["Desafio do Dia", String(dStr) + " d", "Sequência atual"],
          ["Conquistas", T.n + "/" + T.total, pct + "%"],
          ["Heróis liberados", heroOpen + "/" + heroIds.length, ""],
        ],
      ],
    ];
    for (const [cap, list] of tiles) {
      const sec = document.createElement("div");
      sec.className = "pf-sec";
      sec.innerHTML = '<div class="pf-cap"></div><div class="pf-grid"></div>';
      sec.firstChild.textContent = cap;
      const gr = sec.lastChild;
      for (const [label, val, sub, bar] of list) {
        const t = document.createElement("div");
        t.className = "pf-tile";
        t.innerHTML =
          '<span class="l"></span><b class="v"></b><small class="s"></small>';
        t.querySelector(".l").textContent = label;
        t.querySelector(".v").textContent = val;
        t.querySelector(".s").textContent = sub || "";
        if (bar != null)
          t.insertAdjacentHTML(
            "beforeend",
            '<i class="bar"><u style="width:' +
            Math.max(0, Math.min(100, bar)) +
            '%"></u></i>',
          );
        gr.appendChild(t);
      }
      right.appendChild(sec);
    }
  }
  {
    const _scrP = scr;
    scr = function (t, fn) {
      SCR.firstElementChild.classList.toggle(
        "wide-profile",
        fn === renderProfile,
      );
      _scrP(t, fn);
    };
  }

  /* ================= v0.23: reviver com anúncio ================= */
  /* guarda o que o fim da partida vai gravar, para desfazer se o jogador reviver (a partida continua de onde parou) */
  function snapPre(g) {
    g.pre = {
      coins: save.coins,
      runs: save.runs,
      cst: save.cst ? JSON.stringify(save.cst) : null,
      daily: JSON.stringify(save.daily),
      top: JSON.stringify(save.top || []),
      irun: INT.runs,
      ipend: INT.pending,
      prof: save.prof ? JSON.stringify(save.prof) : null,
    };
  }
  const rev = document.createElement("button");
  rev.id = "revBtn";
  rev.type = "button";
  rev.className = "btn";
  rev.hidden = true;
  $("#dblBtn").insertAdjacentElement("beforebegin", rev);
  function reviveSetup(won, ret) {
    const g = G;
    rev.hidden = !(g && g.pre && !won && !ret && !g.revived);
    rev.disabled = false;
    rev.innerHTML =
      '<span class="uic i-play"></span> Reviver? Vida cheia · anúncio';
  }
  rev.onclick = () =>
    ADS.rewarded((ok) => {
      if (ok && G && G.over && state === "dead" && !G.revived) doRevive();
    });
  /* Balance Lab: roda uma arma definindo a origem do dano/efeitos criados por ela. */
  function nxAs(id, fn, ...args) {
    const prev = BTL.src;
    BTL.src = id;
    try {
      return fn(...args);
    } finally {
      BTL.src = prev;
    }
  }
  function doRevive() {
    const g = G,
      p = g.p,
      pre = g.pre;
    g.revived = true;
    track("revive", { lvl: g.lvl });
    save.coins = pre.coins + (g.dblPaid || 0);
    save.runs = pre.runs;
    /* o bônus do anúncio de 2x já assistido é mantido */ if (pre.cst)
      save.cst = JSON.parse(pre.cst);
    save.daily = JSON.parse(pre.daily);
    save.top = JSON.parse(pre.top);
    if (pre.prof) save.prof = JSON.parse(pre.prof);
    INT.runs = pre.irun;
    INT.pending = pre.ipend;
    persist();
    refreshMeta();
    if (RUN.daily) {
      selHero = RUN.daily.hero;
      _rg = mul(RUN.daily.seed + 977);
    } /* Desafio do Dia: volta ao herói do desafio */
    g.over = false;
    g.pre = null;
    g.dying = null;
    g.hitBy = null;
    g.low = false;
    p.hp = g.mods.maxhp;
    p.inv = 3;
    p.sh = Math.max(p.sh, 3);
    p.kx = p.ky = 0;
    g.eshots.length = 0;
    g.tel = [];
    if (g.boss) g.boss.act = null;
    for (const e of g.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x,
        dy = e.y - p.y,
        d = Math.hypot(dx, dy) || 1;
      if (d < 220) {
        const f = e.boss ? 60 : e.elite ? 220 : 520;
        e.kx += (dx / d) * f;
        e.ky += (dy / d) * f;
      }
    }
    g.fx.push({
      wid: "revive",
      k: "ring",
      x: p.x,
      y: p.y,
      r: 4,
      maxr: 170,
      dmg: (30 + 3 * g.lvl) * g.mods.dmg,
      knock: 80,
      hit: new Set(),
      t: 0,
      life: 0.55,
      follow: true,
    });
    g.flash = 0.6;
    g.shake = 0.4;
    $("#end").hidden = true;
    $("#hud").hidden = false;
    for (const k in hl) delete hl[k];
    buildRack();
    updHud();
    syncFpsHud();
    g.lvl++;
    g.need = needFor(g.lvl);
    g.pending.push({ kind: "lvl", n: g.lvl, rev: 1 });
    state = "play";
    last = performance.now();
    SFX.play("heal");
    vib([40, 40, 80]);
    toast("Você renasceu! Escolha uma bênção");
    openLevelUp();
  }
  /* ================= v0.24: links, desafio do dia (Brasília), Play Games, ranking e avaliação ================= */
  const SUPPORT_EMAIL = "anjeoidualc@gmail.com",
    PRIVACY_URL = "https://anjeoidualc-frozen.github.io/fe-survivor-docs/",
    PLAY_APP_ID = "com.fesurvivor.game";
  function openExt(url) {
    try {
      if (/^https?:/.test(url) && !IS_NATIVE) {
        window.open(url, "_blank", "noopener");
        return;
      }
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove(); /* no app Android o Capacitor repassa mailto:, market: e https: ao app de e-mail, Play Store e navegador */
    } catch (e) {
      notify("Não foi possível abrir o link.", "warn");
    }
  }
  save.seen = save.seen || {};
  save.winH = save.winH || {};
  save.top = save.top || [];
  save.rate = save.rate || { n: 0 };
  const fmtDate = (k) => {
    const p = k.split("-");
    return p[2] + "/" + p[1] + "/" + p[0];
  };
  const secsToNext = () => {
    const sod = ((Date.now() - 10800000) / 1000) % 86400;
    return Math.max(0, Math.ceil(86400 - sod));
  };
  const fmtHMS = (t) => {
    const h = Math.floor(t / 3600),
      m = Math.floor((t % 3600) / 60),
      q = t % 60,
      z = (n) => String(n).padStart(2, "0");
    return z(h) + ":" + z(m) + ":" + z(q);
  };
  let dailyIv = 0;
  function dailyTick(b, key) {
    clearInterval(dailyIv);
    const draw = () => {
      const el = $("#dCount");
      if (!el) return false;
      const t = secsToNext();
      el.textContent = fmtHMS(t);
      el.classList.toggle("cd-red", t <= 3600);
      return true;
    };
    draw(); /* a tela ainda está sendo aberta: desenha já, sem esperar 1 s */
    dailyIv = setInterval(() => {
      if (SCR.hidden || !draw()) return clearInterval(dailyIv);
      if (dayKey() !== key) {
        clearInterval(dailyIv);
        wLbl();
        renderDaily(b);
      }
    }, 1000);
  }
  setInterval(() => wLbl(), 30000);
  /* ---- Google Play Games (conquistas e ranking). A ponte Android cria window.FePGS; no navegador tudo isso é ignorado ---- */
  const PGS = {
    unlock(id) {
      try {
        if (window.FePGS) FePGS.unlock(id);
      } catch (e) { }
    },
    submit(k, v) {
      try {
        if (window.FePGS) FePGS.submit(k, v);
      } catch (e) { }
    },
    sync() {
      try {
        for (const id in save.ach) PGS.unlock(id);
      } catch (e) { }
    },
  };
  addEventListener("fepgs", () => {
    PGS.sync();
    if (!SCR.hidden && $("#sT").textContent === "Ranking")
      renderRank($("#sB"));
  });
  function recordRun(won) {
    const g = G,
      rec = {
        t: Math.floor(g.t),
        k: g.kills,
        l: g.lvl,
        h: g.hk,
        w: won ? 1 : 0,
        d: dayKey(),
        m: g.inf ? "inf" : "std",
      };
    const list = g.inf ? (save.topInf = save.topInf || []) : save.top;
    list.push(rec);
    list.sort((x, y) => y.t - x.t || y.k - x.k);
    list.length = Math.min(5, list.length);
    persist();
    /* Padrão: o amanhecer iguala todas as vitórias em 10:00, então o tempo não entra mais no placar. Vigília: placar próprio de tempo. */
    if (g.inf) PGS.submit("timeInf", Math.round(g.t * 1000));
    else {
      PGS.submit("kills", g.kills);
      PGS.submit("level", g.lvl);
    }
  }
  function renderRank(b) {
    const top = save.top || [];
    b.innerHTML =
      '<div class="rw"><span>Seu melhor tempo <b>' +
      (save.best ? fmt(save.best) : "—") +
      "</b><small>Partidas jogadas: " +
      (save.runs || 0) +
      '</small></span></div><div class="rw"><span>Vigília Eterna · melhor tempo <b>' +
      (save.bestInf ? fmt(save.bestInf) : "—") +
      '</b></span></div><div class="hdg">SUAS MELHORES PARTIDAS</div>' +
      (top.length
        ? top
          .map(
            (r, i) =>
              '<div class="rw"><span><b>' +
              (i + 1) +
              ". " +
              fmt(r.t) +
              "</b>" +
              (r.w ? " (vitória)" : "") +
              "<small>" +
              r.k +
              " abates · nível " +
              r.l +
              " · " +
              ((HEROES[r.h] || {}).name || r.h) +
              " · " +
              fmtDate(r.d) +
              "</small></span></div>",
          )
          .join("")
        : '<div class="rw"><span><small>Jogue uma partida para registrar seus recordes.</small></span></div>') +
      '<div class="hdg">GOOGLE PLAY GAMES</div><div id="rkGp"></div>';
    const box = b.querySelector("#rkGp");
    if (!window.FePGS) {
      box.innerHTML =
        '<div class="rw"><span><small>O ranking mundial e as conquistas do Google Play Games ficam disponíveis no aplicativo Android.</small></span></div>';
      return;
    }
    const add = (t, f) => {
      const x = document.createElement("div");
      x.className = "rw";
      x.innerHTML = "<span>" + t + "</span>";
      const bt = document.createElement("button");
      bt.type = "button";
      bt.className = "mb";
      bt.textContent = "ABRIR";
      bt.onclick = f;
      x.appendChild(bt);
      box.appendChild(x);
    };
    if (!FePGS.signed) {
      add(
        "Entrar no Google Play Games<small>Entre para competir e salvar suas conquistas</small>",
        () =>
          FePGS.signIn().then((ok) => {
            if (!ok)
              notify(
                "Não foi possível entrar agora. Tente de novo mais tarde." +
                (FePGS.lastError ? " [" + FePGS.lastError + "]" : ""),
                "warn",
              );
            else {
              save.pgsSkip = 0;
              persist();
              renderRank(b);
            }
          }),
      );
      return;
    }
    const gpFail = (ok) => {
      if (!ok)
        notify(
          "Não foi possível abrir o Google Play Games." +
          (FePGS.lastError ? " [" + FePGS.lastError + "]" : ""),
          "warn",
        );
    };
    add("Ranking: Vigília Eterna - melhor tempo", () => FePGS.show("time").then(gpFail));
    add("Ranking: Amanhecer - mais abates", () => FePGS.show("kills").then(gpFail));
    add("Ranking: Amanhecer - maior nível", () => FePGS.show("level").then(gpFail));
    add("Conquistas", () => FePGS.showAch().then(gpFail));
  }
  /* ---- avaliação do jogo (a cada 3 partidas concluídas, ao voltar ao menu) ----
     'inapp' = chama direto o cartão de avaliação do Google Play (recomendado: a Play proíbe perguntas como "Está gostando?" antes dele e botões que o disparem).
     'modal' = mostra o convite com estrelas e abre a página do jogo na Play Store. */
  const RATE_MODE = "inapp",
    RATE_AT = [3, 15];
  const rateDue = () =>
    (save.rate.n || 0) < RATE_AT.length &&
    (save.runs || 0) >= RATE_AT[save.rate.n || 0];
  function rateCheck() {
    if (
      state !== "menu" ||
      !rateDue() ||
      INT.busy ||
      ADS.busy ||
      !SCR.hidden ||
      !HLP.hidden ||
      Date.now() - INT.last < 60000
    )
      return;
    if (RATE_MODE === "inapp") {
      if (!window.FeReview) return;
      save.rate.n++;
      persist();
      FeReview.inApp();
    } else {
      if (!$("#rateBox")) showRate();
    }
  }
  function showRate() {
    const o = document.createElement("div");
    o.id = "rateBox";
    o.className = "ov rate-overlay";
    o.innerHTML =
      '<div class="ov-in rate-panel"><h2>Está gostando do jogo?</h2><p class="sub">Avalie o Fé Survivor na Play Store</p><div class="rate-stars">' +
      '<button type="button"><span class="uic big i-star"></span></button>'.repeat(
        5,
      ) +
      '</div><div class="row"><button type="button" class="btn" id="rtYes">Avaliar</button><button type="button" class="btn alt" id="rtNo">Agora não</button></div></div>';
    gameEl.appendChild(o);
    const close = (done) => {
      save.rate.n = done ? RATE_AT.length : (save.rate.n || 0) + 1;
      persist();
      o.remove();
    },
      go = () => {
        close(true);
        if (window.FeReview) FeReview.store();
        else
          openExt(
            "https://play.google.com/store/apps/details?id=" + PLAY_APP_ID,
          );
      };
    o.querySelectorAll(".rate-stars button").forEach((x) => (x.onclick = go));
    o.querySelector("#rtYes").onclick = go;
    o.querySelector("#rtNo").onclick = () => close(false);
  }
  const _tm2 = toMenu;
  toMenu = function () {
    _tm2();
    setTimeout(rateCheck, 900);
  };

  /* ================= v0.25: Corrida de Elias (dash), Fervor, status do personagem e novo layout do HUD ================= */
  ICON_DRAW.dash = (g) => {
    for (const [c, x] of [
      ["#f2c14e", 9],
      ["#fff3b0", 14],
    ]) {
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(x, 5);
      g.lineTo(x + 7, 12);
      g.lineTo(x, 19);
      g.lineTo(x + 3, 19);
      g.lineTo(x + 10, 12);
      g.lineTo(x + 3, 5);
      g.closePath();
      g.fill();
    }
    R(g, "#9fe0ff", 1, 8, 6, 2);
    R(g, "#9fe0ff", 0, 11, 8, 2);
    R(g, "#9fe0ff", 2, 14, 5, 2);
  };
  ICON_DRAW.fervor = (g) => {
    g.fillStyle = "#ff7a1a";
    g.beginPath();
    g.moveTo(12, 2);
    g.quadraticCurveTo(20, 10, 16, 19);
    g.lineTo(8, 19);
    g.quadraticCurveTo(4, 10, 12, 2);
    g.fill();
    g.fillStyle = "#ffe27a";
    g.beginPath();
    g.moveTo(12, 9);
    g.quadraticCurveTo(16, 14, 14, 19);
    g.lineTo(10, 19);
    g.quadraticCurveTo(8, 14, 12, 9);
    g.fill();
    R(g, "#fff", 11, 15, 2, 3);
    R(g, "#9fe0ff", 3, 21, 18, 1);
  };
  function dashStep(dt) {
    const p = G && G.p;
    if (!p || !p.dash) return;
    const D = p.dash,
      st = Math.min(dt, D.t);
    p.x += D.vx * st;
    p.y += D.vy * st;
    D.t -= dt;
    D.gh -= dt;
    if (D.gh <= 0) {
      D.gh = 0.035;
      G.fx.push({
        wid: BTL.src || null,
        k: "ghost",
        x: p.x,
        y: p.y,
        face: p.face,
        t: 0,
        life: 0.32,
      });
    }
    if (D.t <= 0) p.dash = null;
  }
  const _upd4 = update;
  update = function (dt) {
    if (state === "play" && G) dashStep(dt);
    _upd4(dt);
    if (state === "play" && G && !G.over) {
      const hb = $("#hpbar");
      if (hb) hb.classList.toggle("low", !!G.low);
    }
    BTL.tick(dt);
  };
  /* ---- status do personagem (pausa/configurações e lateral da tela de cartas) ---- */
  const ST_KEYS = [
    "Dano",
    "Vel. de ataque",
    "Vel. de movimento",
    "Alcance de ataque",
    "Alcance de coleta",
    "Salvação máx.",
    "Bloqueio",
    "Crítico",
    "Fé ganha",
  ];
  const ST_OPTIONAL = [
    "Redução de dano",
    "Área dos ataques",
    "Duração dos efeitos",
    "Unidades extras",
    "Sorte",
    "Moedas ao fim",
    "Vida/aparição demoníaca",
    "Velocidade demoníaca",
    "Ressurreição",
  ];
  const ST_DEFAULT = {
    "Redução de dano": 0,
    "Área dos ataques": 100,
    "Duração dos efeitos": 100,
    "Unidades extras": 0,
    Sorte: 0,
    "Moedas ao fim": 0,
    "Vida/aparição demoníaca": 0,
    "Velocidade demoníaca": 0,
    Ressurreição: "—",
  };
  const ST_UNIT = {
    Dano: "%",
    "Vel. de ataque": "%",
    Bloqueio: "%",
    Crítico: "%",
    "Fé ganha": "%",
    "Área dos ataques": "%",
    "Duração dos efeitos": "%",
    Sorte: "%",
    "Moedas ao fim": "%",
    "Vida/aparição demoníaca": "%",
    "Velocidade demoníaca": "%",
  };
  function statRaw() {
    const m = G.mods,
      stats = {
        Dano: m.dmg * 100,
        "Vel. de ataque": 100 / m.cd,
        "Vel. de movimento": m.spd,
        "Alcance de ataque": m.rng * (m.area || 1),
        "Alcance de coleta": m.pickup,
        "Salvação máx.": m.maxhp,
        Bloqueio: (m.block || 0) * 100,
        Crítico: (m.crit || 0) * 100,
        "Fé ganha": m.xp * 100,
      };
    if (m.dr > 0) stats["Redução de dano"] = m.dr;
    if (m.area > 1) stats["Área dos ataques"] = m.area * 100;
    if (m.duration > 1) stats["Duração dos efeitos"] = m.duration * 100;
    const extraUnits = Math.max(
      0,
      Math.min(2, Math.floor(Number(m.amount) || 0)),
    );
    if (extraUnits) stats["Unidades extras"] = extraUnits;
    if (m.luck > 0) stats.Sorte = m.luck * 100;
    if (m.greed > 0) stats["Moedas ao fim"] = m.greed * 100;
    if (m.curse > 0) stats["Vida/aparição demoníaca"] = m.curse * 100;
    if (m.curseSpd > 0) stats["Velocidade demoníaca"] = m.curseSpd * 100;
    if (G.P && G.P.manto > 0)
      stats.Ressurreição = G.reviveUsed ? "Usada" : "Disponível";
    return stats;
  }
  function statValue(k, value) {
    if (typeof value !== "number") return value;
    return String(roundGameplayValue(value)).replace(".", ",");
  }
  function statRows(cur, base, keys) {
    const rows =
      keys ||
      ST_KEYS.concat(
        ST_OPTIONAL.filter((k) => {
          const current = cur[k] == null ? ST_DEFAULT[k] : cur[k],
            previous = base && base[k] != null ? base[k] : ST_DEFAULT[k];
          return (
            current !== ST_DEFAULT[k] || (base && previous !== ST_DEFAULT[k])
          );
        }),
      );
    return rows
      .map((k) => {
        const u = ST_UNIT[k] || "",
          value = cur[k] == null ? ST_DEFAULT[k] : cur[k],
          previous = base && (base[k] == null ? ST_DEFAULT[k] : base[k]);
        const v = statValue(k, value),
          dl =
            typeof value === "number" && base
              ? roundGameplayValue(value - previous)
              : 0;
        const delta = dl
          ? '<i class="d' +
          (dl < 0 ? " neg" : "") +
          '">' +
          (dl > 0 ? "+" : "−") +
          statValue(k, Math.abs(dl)) +
          "</i>"
          : "";
        return (
          '<div class="st-r"><span>' +
          k +
          "</span><b>" +
          v +
          u +
          delta +
          "</b></div>"
        );
      })
      .join("");
  }
  function statBox() {
    const d = document.createElement("div");
    d.className = "rw st-box";
    d.innerHTML =
      '<span><b>Status do personagem</b><div class="st-grid">' +
      statRows(statRaw(), null) +
      "</div></span>";
    return d;
  }
  function showLvStats() {
    const g = G,
      pd0 = g.pending[0];
    if (g.stFor !== pd0) {
      g.stFor = pd0;
      g.stBase = g.stCur || null;
      g.stCur = statRaw();
    }
    $("#stPanel").innerHTML = "<h4>STATUS</h4>" + statRows(g.stCur, g.stBase);
    $("#stLine").textContent = [
      "Dano",
      "Vel. de ataque",
      "Vel. de movimento",
      "Alcance de ataque",
    ]
      .map(
        (k) =>
          k.replace("Vel. de ", "Vel. ") +
          " " +
          statValue(k, g.stCur[k]) +
          (ST_UNIT[k] || ""),
      )
      .join(" · ");
  }
  (() => {
    const p = document.createElement("div");
    p.id = "stPanel";
    $("#lvlup").appendChild(p);
    const l = document.createElement("div");
    l.id = "stLine";
    $("#cards").insertAdjacentElement("beforebegin", l);
    /* HUD: vida no topo; objetivo, moedas e espaços de habilidade agrupados no canto inferior esquerdo */
    const hud = $("#hud"),
      mkc = (id, ...k) => {
        const d = document.createElement("div");
        d.id = id;
        d.append(...k);
        hud.appendChild(d);
        return d;
      };
    const tl = mkc("tlcol", $("#hpbar"), $("#coins"));
    const hav = document.createElement("span");
    hav.id = "hudAv";
    hav.className = "prof-av";
    tl.prepend(hav);
    mkc("tccol", $("#timer"), $("#obj"), $("#bossbar"));
    mkc("blcol", $("#rack"));
  })();

  /* ================= entrada ================= */
  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (
      ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k) &&
      state !== "menu"
    )
      e.preventDefault();
    if (k === "escape" || k === "p") {
      if (state === "play") pauseGame();
      else if (state === "paused") resumeGame();
    }
    if (state === "levelup" && !e.repeat && ["1", "2", "3"].includes(k))
      chooseIdx(+k - 1);
    if (k === "enter" && state === "menu" && SCR.hidden) $("#playBtn").click();
  });
  addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
  });
  addEventListener("blur", () => {
    for (const k in keys) keys[k] = false;
    if (state === "play" && save.set.auto) pauseGame();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "play" && save.set.auto) pauseGame();
  });
  const stick2 = document.createElement("div");
  stick2.id = "stick2";
  stick2.hidden = true;
  stick2.innerHTML = "<i></i>";
  gameEl.appendChild(stick2);
  AIM.id = null;
  AIM.ox = 0;
  AIM.oy = 0;
  const aimSide = (e) =>
    manualOn() &&
    e.pointerType !== "mouse" &&
    e.clientX > gameEl.getBoundingClientRect().left + gameEl.clientWidth / 2;
  cv.addEventListener("pointerdown", (e) => {
    if (state !== "play") return;
    if (manualOn() && e.pointerType === "mouse") {
      setAim(e);
      if (e.button === 0) AIM.down = AIM.pending = true;
      return;
    }
    const r = gameEl.getBoundingClientRect();
    if (aimSide(e)) {
      // lado direito: mira e ataque
      if (AIM.id != null) return;
      AIM.id = e.pointerId;
      AIM.ox = e.clientX;
      AIM.oy = e.clientY;
      AIM.down = AIM.pending = true;
      AIM.sx = VW / 2 + (G ? G.p.face : 1) * 60;
      AIM.sy = VH / 2; // sem arrastar: atira para a frente
      try {
        cv.setPointerCapture(e.pointerId);
      } catch (x) { }
      stick2.style.left = e.clientX - r.left + "px";
      stick2.style.top = e.clientY - r.top + "px";
      stick2.hidden = false;
      stick2.firstElementChild.style.transform = "translate(0,0)";
      return;
    }
    if (stick.on) return; // lado esquerdo (ou modo automático): movimento
    stick.on = true;
    stick.id = e.pointerId;
    stick.ox = e.clientX;
    stick.oy = e.clientY;
    stick.dx = stick.dy = 0;
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (x) { }
    const el = $("#stick");
    el.style.left = e.clientX - r.left + "px";
    el.style.top = e.clientY - r.top + "px";
    el.hidden = false;
    el.firstElementChild.style.transform = "translate(0,0)";
  });
  cv.addEventListener("pointermove", (e) => {
    if (stick.on && e.pointerId === stick.id) {
      let dx = e.clientX - stick.ox,
        dy = e.clientY - stick.oy;
      const d = Math.hypot(dx, dy),
        max = 50;
      if (d > max) {
        dx = (dx / d) * max;
        dy = (dy / d) * max;
      }
      stick.dx = dx / max;
      stick.dy = dy / max;
      if (Math.hypot(stick.dx, stick.dy) < 0.15) {
        stick.dx = stick.dy = 0;
      }
      $("#stick").firstElementChild.style.transform =
        "translate(" + dx + "px," + dy + "px)";
    }
    if (e.pointerId === AIM.id) {
      let dx = e.clientX - AIM.ox,
        dy = e.clientY - AIM.oy;
      const d = Math.hypot(dx, dy),
        max = 45;
      if (d > 8) {
        AIM.sx = VW / 2 + (dx / d) * 60;
        AIM.sy = VH / 2 + (dy / d) * 60;
      }
      if (d > max) {
        dx = (dx / d) * max;
        dy = (dy / d) * max;
      }
      stick2.firstElementChild.style.transform =
        "translate(" + dx + "px," + dy + "px)";
    }
  });
  function endStick(e) {
    if (e.pointerId === AIM.id) {
      AIM.id = null;
      AIM.down = false;
      stick2.hidden = true;
      return;
    }
    if (e.pointerId !== stick.id) return;
    stick.on = false;
    stick.dx = stick.dy = 0;
    $("#stick").hidden = true;
  }
  cv.addEventListener("pointerup", endStick);
  cv.addEventListener("pointercancel", endStick);
  setInterval(() => {
    if (state !== "play") {
      if (AIM.id != null) {
        AIM.id = null;
        AIM.down = false;
        stick2.hidden = true;
      }
      if (stick.on) {
        stick.on = false;
        stick.dx = stick.dy = 0;
        $("#stick").hidden = true;
      }
    }
  }, 200);
  $("#pauseBtn").addEventListener("click", pauseGame);
  $("#resumeBtn").addEventListener("click", resumeGame);
  $("#menuBtn").addEventListener("click", toMenu);
  $("#againBtn").addEventListener("click", startRun);
  $("#endMenuBtn").addEventListener("click", toMenu);
  $("#muteBtn").addEventListener("click", () => {
    SFX.on = !SFX.on;
    $("#muteBtn").textContent = "Som: " + (SFX.on ? "ligado" : "desligado");
  });
  addEventListener("resize", resize);
  gameEl.addEventListener("contextmenu", (e) => e.preventDefault());

  /* v0.18 removido: substituído pelo bloco v0.26 (injetado por último, abaixo). */
  /* ================= v0.22 CSS ================= */
  /* Static CSS moved to style.css. */
  /* ================= v0.26 CSS ================= */
  /* Static CSS moved to style.css. */

  /* ================= v0.32: identidade visual das árvores e Maestrias ================= */
  /* Static CSS moved to style.css. */

  /* ================= boot ================= */

  /* ================= v0.26: ajustes de plataforma ================= */
  (() => {
    const canHover = matchMedia("(hover:hover)").matches;
    if (!canHover) {
      /* toque não tem "hover": remove as regras :hover para não ficarem presas depois do toque */
      const strip = (o) => {
        for (let i = o.cssRules.length - 1; i >= 0; i--) {
          const r = o.cssRules[i];
          if (r.selectorText) {
            if (r.selectorText.indexOf(":hover") >= 0) o.deleteRule(i);
          } else if (r.type === 4) strip(r);
        }
      };
      for (const s of document.styleSheets) {
        try {
          strip(s);
        } catch (e) { }
      }
      /* sem hover, a dica do item aparece ao tocar nele */
      document.addEventListener("click", (e) => {
        const s = e.target.closest && e.target.closest(".slot[data-tip]");
        if (s && !s.classList.contains("empty"))
          notify(s.getAttribute("data-tip"));
      });
    }
    /* Android: esconde barras do sistema (tela cheia) se o plugin SystemBars do Capacitor existir */
    const immersive = () => {
      try {
        const SB =
          IS_NATIVE && Capacitor.Plugins && Capacitor.Plugins.SystemBars;
        if (SB && SB.hide) {
          const p = SB.hide();
          if (p && p.catch) p.catch(() => { });
        }
      } catch (e) { }
    };
    immersive();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) persist();
      else immersive();
    });
    addEventListener("pagehide", persist);
  })();
  /* ---- Abertura: Snow Studio → carregamento (assets, fontes e login no Google Play Games) ---- */
  function bootScreen() {
    const B = $("#boot");
    if (!B) return;
    if (/[?&](debug|noboot)\b/.test(location.search)) {
      B.remove();
      if (/[?&]tutorial\b/.test(location.search))
        setTimeout(() => TUT.start(true), 200);
      return;
    }
    const st = $("#bootStudio"),
      ld = $("#bootLoad"),
      fill = $("#bootFill"),
      pct = $("#bootPct"),
      sub = $("#bootSub"),
      setSub = (x) => {
        sub.textContent = x;
      };
    $("#bootTxt").textContent = "CARREGANDO";
    setSub("Preparando o jogo…");
    /* ===== Cenas de carregamento: vídeo curto (mudo, em loop) + imagem de fallback =====
       Arquivos: assets/loading/loading_01.mp4 … loading_21.mp4 e assets/loading/loading_01.png … loading_21.png.
       A imagem aparece primeiro e fica como reserva: se o vídeo não existir, der erro, travar ou o aparelho
       bloquear o autoplay, o vídeo é descartado e a imagem continua na tela.
       Para usar outros nomes, defina ASSET_MANIFEST.loading = { scenes: [{ video: "loading/davi.mp4", image: "loading/davi.png" }, …] }. */
    const BOOT_SCENE_COUNT = 21;
    const bootScenes =
      ASSET_MANIFEST.loading &&
        ASSET_MANIFEST.loading.scenes &&
        ASSET_MANIFEST.loading.scenes.length
        ? ASSET_MANIFEST.loading.scenes.map((x) => ({
          video: x.video ? ASSET_DIR + x.video : "",
          image: x.image ? ASSET_DIR + x.image : "",
        }))
        : Array.from({ length: BOOT_SCENE_COUNT }, (_, i) => {
          const id = "loading/loading_" + String(i + 1).padStart(2, "0");
          return { video: ASSET_DIR + id + ".mp4", image: ASSET_DIR + id + ".png" };
        });
    let bootIdx = Math.floor(Math.random() * bootScenes.length);
    try {
      /* não repete a cena da abertura anterior */
      const last = parseInt(localStorage.getItem("fe_bootScene"), 10);
      if (bootScenes.length > 1 && bootIdx === last)
        bootIdx =
          (bootIdx + 1 + Math.floor(Math.random() * (bootScenes.length - 1))) %
          bootScenes.length;
      localStorage.setItem("fe_bootScene", String(bootIdx));
    } catch (e) { }
    const scene = bootScenes[bootIdx],
      artEl = $("#bootArt");
    /* 1) imagem (fallback e fundo enquanto o vídeo carrega) */
    if (scene.image) {
      const art = new Image();
      art.onload = () => {
        artEl.style.backgroundImage = 'url("' + art.src + '")';
        B.classList.add("hasimg");
      };
      art.src = scene.image;
    }
    /* 2) vídeo por cima da imagem */
    let bootVid = null,
      vidTimers = [],
      vidStarted = false;
    const vidClear = () => {
      vidTimers.forEach(clearTimeout);
      vidTimers = [];
    },
      killVideo = () => {
        vidClear();
        if (!bootVid) return;
        try {
          bootVid.pause();
          bootVid.removeAttribute("src");
          bootVid.load();
        } catch (e) { }
        bootVid.remove();
        bootVid = null;
      };
    const mkBootVideo = () => {
      if (!scene.video || !artEl) return;
      if (!document.getElementById("bootVidCss")) {
        const st = document.createElement("style");
        st.id = "bootVidCss";
        st.textContent =
          "#bootArt > video.boot-vid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;opacity:0;transition:opacity .5s ease;pointer-events:none;background:transparent}";
        document.head.appendChild(st);
      }
      if (getComputedStyle(artEl).position === "static")
        artEl.style.position = "relative";
      const v = document.createElement("video");
      v.className = "boot-vid";
      v.muted = true;
      v.defaultMuted = true;
      v.loop = true;
      v.playsInline = true;
      v.controls = false;
      v.disablePictureInPicture = true;
      v.preload = "auto";
      ["muted", "playsinline", "webkit-playsinline"].forEach((a) =>
        v.setAttribute(a, ""),
      );
      if (scene.image) v.poster = scene.image;
      v.addEventListener("error", killVideo);
      v.addEventListener("playing", () => {
        vidStarted = true;
        vidClear(); /* cancela o aviso de travamento */
        v.style.opacity = "1";
        B.classList.add("hasimg");
      });
      const stall = () => {
        vidClear();
        /* travou por mais de 2,5 s: volta para a imagem */
        vidTimers.push(setTimeout(() => (v.style.opacity = "0"), 2500));
      };
      v.addEventListener("waiting", stall);
      v.addEventListener("stalled", stall);
      v.src = scene.video;
      artEl.insertBefore(v, artEl.firstChild);
      bootVid = v;
    };
    const startBootVideo = () => {
      if (!bootVid) return;
      try {
        const pr = bootVid.play();
        if (pr && pr.catch) pr.catch(killVideo); /* autoplay bloqueado */
      } catch (e) {
        killVideo();
        return;
      }
      /* se não começar a tocar em 4,5 s, descarta o vídeo e mantém a imagem */
      vidTimers.push(
        setTimeout(() => {
          if (!vidStarted) killVideo();
        }, 4500),
      );
    };
    try {
      mkBootVideo();
    } catch (e) {
      killVideo();
    }
    const P = { fonts: 0, init: 1, pgs: 0 },
      tF = setTimeout(() => {
        P.fonts = 1;
      }, 3000);
    if (document.fonts && document.fonts.ready)
      document.fonts.ready.then(() => {
        P.fonts = 1;
        clearTimeout(tF);
      });
    else P.fonts = 1;
    /* login no Google Play Games (só no app). Se falhar, o jogo segue e a tentativa manual fica no Ranking */
    const pgs = () =>
      new Promise((res) => {
        if (!IS_NATIVE || save.pgsSkip) return res(null);
        let n = 0;
        const wait = setInterval(() => {
          if (window.FePGS || ++n > 12) {
            clearInterval(wait);
            go();
          }
        }, 100);
        const go = () => {
          const G2 = window.FePGS;
          if (!G2) return res(null);
          setSub(
            "Entrando no Google Play Games…",
          );
          if (G2.signed) return res(true);
          let done = 0;
          const fin = (ok) => {
            if (!done) {
              done = 1;
              res(ok);
            }
          },
            to = setTimeout(() => fin(!!G2.signed), 10000);
          addEventListener(
            "fepgs",
            () => {
              if (G2.signed) {
                clearTimeout(to);
                fin(true);
              }
            },
            { once: true },
          );
          try {
            Promise.resolve(G2.ready || G2.signIn()).then(
              (ok) => {
                clearTimeout(to);
                fin(!!ok || !!G2.signed);
              },
              () => {
                clearTimeout(to);
                fin(false);
              },
            );
          } catch (e) {
            clearTimeout(to);
            fin(false);
          }
        };
      });
    pgs().then((ok) => {
      P.pgs = 1;
      if (ok === null) return;
      save.pgsSkip = 0;
      persist();
      setSub(
        ok
          ? "Google Play Games conectado"
          : "Google Play Games indisponível. Você pode entrar depois, em Ranking.",
      );
    });
    let t0 = performance.now(),
      tL = 0,
      shown = 0,
      fin = 0;
    requestAnimationFrame(() => st.classList.add("show"));
    setTimeout(() => st.classList.remove("show"), 1900);
    setTimeout(() => {
      st.style.display = "none";
      ld.classList.add("show");
      tL = performance.now();
      startBootVideo();
    }, 2500);
    const done = () => {
      fin = 1;
      fill.style.width = "100%";
      pct.textContent = "100%";
      setTimeout(() => {
        if (!save.tut) {
          if (save.runs > 0 || save.help) {
            save.tut = 1;
            persist();
          } else TUT.start(true);
        }
        B.classList.add("out");
        setTimeout(() => {
          killVideo();
          B.remove();
          /* após boot: se versão nova, abre Notícias */ try {
            syncNewsBadge();
            if (newsIsUnread() && !TUT.on) openNewsModal();
            else profWelcomeMaybe();
          } catch (e) { }
        }, 650);
      }, 350);
    };
    const iv = setInterval(() => {
      if (!tL || fin) return;
      const now = performance.now(),
        as = BOOT.total ? BOOT.done / BOOT.total : 1;
      const tg = Math.min(1, (P.fonts + as * 6 + P.init + P.pgs * 3) / 11);
      shown = Math.min(tg, shown + Math.max((tg - shown) * 0.12, 0.006));
      const v = Math.floor(shown * 100);
      fill.style.width = v + "%";
      pct.textContent = v + "%";
      if ((shown >= 0.999 && now - tL > 1600) || now - tL > 14000) {
        clearInterval(iv);
        done();
      }
    }, 33);
  }
  /* ================= v0.39: corpo rígido, cenário com profundidade, inimigos novos, animações ================= */
  const TAU = 6.2832,
    FXQ = () => !!save.set.fx;
  /* ================= v0.52: sprites animados (art_v2.js) =================
     Heróis: 6 quadros parado, 8 andando, 4 de ação, dano e investida. Inimigos: ciclos de 6-8 quadros + preparação/ataque.
     Chefes: 8 quadros de movimento + preparação, ataque e investida ligados à IA real. Se art_v2.js faltar, o jogo usa a arte antiga. */
  const A2 = (typeof window !== "undefined" && window.ART_V2) || null,
    EA = {};
  function a2rows(s) {
    return s
      .split("/")
      .map((r) => r.replace(/(\d*)(.)/g, (m, n, c) => c.repeat(n ? +n : 1)));
  }
  function a2build(list, pal, hd) {
    return list.map((f) => {
      const sp = buildSprite(a2rows(f), pal);
      if (hd) sp.hd = true;
      return sp;
    });
  }
  function a2Enemies() {
    if (!A2) return;
    for (const k in A2.enemy) {
      if (!EA[k]) {
        const A = A2.enemy[k];
        EA[k] = {
          loop: a2build(A.loop, A.pal),
          windup: A.windup ? a2build(A.windup, A.pal) : null,
          attack: A.attack ? a2build(A.attack, A.pal) : null,
        };
      }
      EFR[k] = EA[k].loop;
      S[k] = EA[k].loop[0];
    }
    for (const k in A2.boss) {
      if (!EA[k]) {
        const A = A2.boss[k];
        EA[k] = {
          loop: a2build(A.loop, A.pal, 1),
          windup: a2build(A.windup, A.pal, 1),
          attack: a2build(A.attack, A.pal, 1),
          dash: a2build(A.dash, A.pal, 1),
        };
      }
      S[k] = EA[k].loop[0];
    }
  }
  function a2Hero(k) {
    const A = A2.hero[k],
      b = (l) => a2build(l, A.pal),
      idle = b(A.idle),
      walk = b(A.walk),
      act = b(A.act),
      hurt = b(A.hurt),
      dash = b(A.dash);
    HFR[k] = {
      idle,
      walk,
      act: act[1],
      actF: act,
      hurt: hurt[0],
      dash,
      base0: idle[0],
      v2: true,
    };
    S.hero[k][0] = idle[0];
    S.hero[k][1] = walk[0];
  }
  function a2Boss(e, g, A) {
    const t = g.t,
      a = e.act,
      W = A.windup,
      T = A.attack,
      D = A.dash;
    if (a) {
      if (a.k === "dash")
        return a.t < a.tel
          ? W[a.t < a.tel * 0.55 ? 0 : 1]
          : D[Math.floor(t * 16) % D.length];
      if (a.k === "beam")
        return a.t < a.tel
          ? W[a.t < a.tel * 0.55 ? 0 : 1]
          : T[
          Math.min(
            T.length - 1,
            Math.floor(((a.t - a.tel) / a.dur) * T.length),
          )
          ];
      if (a.k === "spiral") return T[Math.floor(t * 9) % T.length];
      if (a.k === "blink") return W[1];
    }
    if (e.castT != null && t - e.castT < 0.45)
      return T[
        Math.min(T.length - 1, Math.floor(((t - e.castT) / 0.45) * T.length))
      ];
    if (e.atk > 0 && e.atk < 0.45) return W[Math.floor(t * 8) & 1];
    return A.loop[Math.floor(t * 9 + e.ph) % A.loop.length];
  }
  /* ---------- Animações padrão dos demônios (referência: Rato da Praga) ----------
     Todo demônio comum passa a ter os mesmos 5 estados do Rato da Praga:
     parado, correndo, ataque (preparo, golpe e recuperação), dano e derrota.
     Os quadros que faltam são gerados dos quadros que o demônio já tem, com
     transformações que preservam o pixel (achatar, esticar, inclinar por linhas). */
  const EA_CFG = FE_CONTENT.enemyAnimation; /* registry.js → enemyAnimation */
  function stdBake(sp, o) {
    o = o || {};
    const PX = Math.max(6, Math.ceil(sp.w * 0.22)),
      PY = Math.max(8, Math.ceil(sp.h * 0.3)),
      W = sp.w + PX * 2,
      H = sp.h + PY * 2,
      outW = Math.max(1, Math.round(sp.w * (o.sx || 1))),
      outH = Math.max(1, Math.round(sp.h * (o.sy || 1))),
      lean = o.lean || 0,
      c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    if (o.alpha != null) g.globalAlpha = o.alpha;
    const x0 = PX + Math.round((sp.w - outW) / 2 + (o.dx || 0)),
      yb = PY + sp.h + Math.round(o.dy || 0);
    for (let r = 0; r < outH; r++) {
      const sr = Math.min(sp.h - 1, Math.floor((r / outH) * sp.h)),
        sh = outH > 1 ? Math.round(lean * (1 - r / (outH - 1))) : 0;
      g.drawImage(sp.c, 0, sr, sp.w, 1, x0 + sh, yb - outH + r, outW, 1);
    }
    g.globalAlpha = 1;
    if (o.tint) {
      /* tinge só o corpo: o contorno escuro é preservado */
      const id = g.getImageData(0, 0, W, H),
        d = id.data,
        hx = o.tint[0],
        tr = parseInt(hx.slice(1, 3), 16),
        tg = parseInt(hx.slice(3, 5), 16),
        tb = parseInt(hx.slice(5, 7), 16),
        ta = o.tint[1];
      for (let i = 0; i < d.length; i += 4)
        if (d[i + 3] > 0 && (d[i] * 3 + d[i + 1] * 6 + d[i + 2]) / 10 > 48) {
          d[i] = d[i] * (1 - ta) + tr * ta;
          d[i + 1] = d[i + 1] * (1 - ta) + tg * ta;
          d[i + 2] = d[i + 2] * (1 - ta) + tb * ta;
        }
      g.putImageData(id, 0, 0);
    }
    const f = document.createElement("canvas");
    f.width = W;
    f.height = H;
    const fg = f.getContext("2d");
    fg.drawImage(c, 0, 0);
    fg.globalCompositeOperation = "source-in";
    fg.fillStyle = "#fff";
    fg.fillRect(0, 0, W, H);
    return { c, f, w: W, h: H };
  }
  function buildEnemyStd() {
    if (!A2) return;
    const tint = (t) => (t ? [EA_CFG.tints[t[0]] || t[0], t[1]] : null),
      AT = EA_CFG.attack;
    for (const k in EA) {
      const def = ET[k],
        A = EA[k];
      if (!def || EA_CFG.handDrawn.includes(k) || !A.loop || A.std) continue;
      if (A2.boss && A2.boss[k]) continue;
      const arch =
        EA_CFG.archetypes[k] ||
        (def.fly ? "fly" : def.mv === "wave" ? "spirit" : "ground"),
        ST = EA_CFG.states[arch],
        L = A.loop,
        L0 = L[0],
        W = A.windup && A.windup.length ? A.windup : null,
        T = A.attack && A.attack.length ? A.attack : null,
        mk = (sp, o) => stdBake(sp, Object.assign({}, o, { tint: tint(o.tint) })),
        fr = (spec) => mk(L[(spec.f || 0) % L.length], spec),
        lg = ST.lunge;
      const attack = [
        W ? W[0] : mk(L0, AT.anticipate[0]),
        W ? W[Math.min(1, W.length - 1)] : mk(L0, AT.anticipate[1]),
        T ? T[0] : mk(L0, Object.assign({}, AT.strike, lg)),
        T
          ? mk(T[0], AT.followFromAttack)
          : mk(L0, {
            sx: AT.follow.sx,
            sy: AT.follow.sy,
            lean: lg.lean + AT.follow.leanDelta,
            dx: (lg.dx || 0) + AT.follow.dxDelta,
            dy: lg.dy || 0,
          }),
        mk(L0, AT.recover),
      ];
      if (W && W.length === 1) attack[1] = mk(W[0], AT.anticipateSolo);
      A.std = {
        idle: ST.idle.map(fr),
        run: L,
        attack,
        hurt: ST.hurt.map(fr),
        death: ST.death.map(fr),
        base: L0,
        arch,
      };
    }
  }
  function enemyMoving(e, g) {
    const TM = EA_CFG.timing;
    if (e.mvTick !== g.t) {
      e.mvTick = g.t;
      const lx = e.mvX == null ? e.x : e.mvX,
        ly = e.mvY == null ? e.y : e.mvY;
      if (Math.hypot(e.x - lx, e.y - ly) > TM.moveEps) e.mvT = g.t;
      e.mvX = e.x;
      e.mvY = e.y;
    }
    if (e.slowT > 0 && e.slowAmt >= 1) return false;
    return e.mvT != null && g.t - e.mvT < TM.stopGrace;
  }
  function stdFrame(e, g, A) {
    const Z = A.std,
      a = e.ai,
      atk = Z.attack,
      TM = EA_CFG.timing,
      AB = EA_CFG.abilities;
    if (e.hurtT > 0)
      return Z.hurt[
        Math.min(1, Math.max(0, Math.floor(((TM.hurt - e.hurtT) / TM.hurt) * 2)))
      ];
    const st = a ? a.st : 0;
    if (e.sa !== st) {
      e.sa = st;
      e.saT = g.t;
      e.sa0 = a ? a.t : 0;
    }
    const prep = e.pose === 2 || (a && a.st === 1 && AB.prep.includes(e.ab));
    if (prep) {
      const q = a && e.sa0 > 0 ? clamp(1 - a.t / e.sa0, 0, 1) : TM.prepSplit;
      return atk[q < TM.prepSplit ? 0 : 1];
    }
    if (a && a.st === 2 && AB.strike.includes(e.ab))
      return atk[g.t - e.saT < TM.dashStrike ? 2 : 3];
    if (e.impT != null) {
      const q = g.t - e.impT;
      if (q < TM.strike[0]) return atk[2];
      if (q < TM.strike[1]) return atk[3];
      if (q < TM.strike[2]) return atk[4];
    }
    if (a && a.st === 3 && AB.recover.includes(e.ab) && g.t - e.saT < TM.recover)
      return atk[4];
    if (e.ab === "fuse" && g.p && Math.hypot(e.x - g.p.x, e.y - g.p.y) < TM.fuseRange)
      return atk[Math.floor(g.t * TM.fuseFps + e.ph) % 2];
    if (enemyMoving(e, g))
      return Z.run[Math.floor(g.t * (e.fps || 6) * 1.6 + e.ph) % Z.run.length];
    return Z.idle[Math.floor(g.t * TM.idleFps + e.ph) % Z.idle.length];
  }
  function a2Frame(e, g, A) {
    if (e.boss) return a2Boss(e, g, A);
    if (A.std) return stdFrame(e, g, A);
    const a = e.ai;
    let w = e.pose === 2;
    if (
      !w &&
      a &&
      a.st === 1 &&
      (e.ab === "dive" ||
        e.ab === "stomp" ||
        e.ab === "dash" ||
        e.ab === "cast" ||
        e.ab === "nova")
    )
      w = true;
    if (w && A.windup)
      return A.windup[a && a.t < 0.28 ? Math.min(1, A.windup.length - 1) : 0];
    if (A.attack) {
      if (a && a.st === 2 && (e.ab === "dive" || e.ab === "dash"))
        return A.attack[0];
      if (e.impT != null && g.t - e.impT < 0.22) return A.attack[0];
    }
    return A.loop[Math.floor(g.t * (e.fps || 6) * 1.6 + e.ph) % A.loop.length];
  }
  const PLAGUE_RAT_ART = {};
  const EFR = {},
    ENEMY_ART = {
      imp: {
        pal: {
          R: "#d9463b",
          r: "#8f2523",
          L: "#f27a63",
          Y: "#ffe45a",
          K: "#1b0c10",
          H: "#efe3bd",
          T: "#ffffff",
          w: "#5a1f33",
        },
        f: [
          [
            "H..........H",
            "HH........HH",
            ".HRRRRRRRRH.",
            "..RRRRRRRR..",
            ".RKRRRRRRKR.",
            "wRYYRRRRYYRw",
            "wRKYRRRRYKRw",
            ".RRRRTTRRRR.",
            "..RRrKKrRR..",
            ".RRRRRRRRRR.",
            "RLRRRrrRRRLR",
            "R.RRRrrRRR.R",
            "..RR....RR..",
          ],
          [
            "H..........H",
            "HH........HH",
            ".HRRRRRRRRH.",
            "..RRRRRRRR..",
            ".RKRRRRRRKR.",
            "wRYYRRRRYYRw",
            "wRKYRRRRYKRw",
            ".RRRRTTRRRR.",
            "..RRrKKrRR..",
            ".RRRRRRRRRR.",
            ".RLRRrrRRLR.",
            "RR.RRrrRR.RR",
            "...RR..RR...",
          ],
        ],
      },
      bomber: {
        pal: {
          O: "#e8791f",
          o: "#9a3e0d",
          L: "#ffa84a",
          Y: "#fff3a0",
          K: "#1b0c10",
          F: "#ff3a1a",
          G: "#ffd24a",
          H: "#d8c9a0",
        },
        f: [
          [
            "......GG......",
            "......HH......",
            "..H.OOOOOO.H..",
            ".OOOOOOOOOOOO.",
            ".OKOOOOOOOOKO.",
            ".OYYOOOOOOYYO.",
            ".OKYOOOOOOYKO.",
            ".OOOOKKKKOOOO.",
            "OOLOOOOOOOOLOO",
            "OLOFFFFFFFFOLO",
            "OOFYYFFFFYYFOO",
            "OOOFFFFFFFFOOO",
            ".oOOOOOOOOOOo.",
            "..oo.oooo.oo..",
          ],
          [
            "......YY......",
            "......HH......",
            "..H.OOOOOO.H..",
            ".OOOOOOOOOOOO.",
            ".OKOOOOOOOOKO.",
            ".OYYOOOOOOYYO.",
            ".OKYOOOOOOYKO.",
            ".OOOOKKKKOOOO.",
            "OOLOOOOOOOOLOO",
            "OLOYYYYYYYYOLO",
            "OOYYYYYYYYYYOO",
            "OOOYYYYYYYYOOO",
            ".oOOOOOOOOOOo.",
            ".oo..oooo..oo.",
          ],
        ],
      },
      shade: {
        pal: {
          P: "#7a5bb5",
          p: "#54397f",
          D: "#2b1b52",
          L: "#a58be0",
          E: "#c8ff7a",
          K: "#120a24",
          W: "#d9c8ff",
        },
        f: [
          [
            "...PPPPPPPP...",
            "..PPPPPPPPPP..",
            ".PPLLPPPPLLPP.",
            ".PKKKKKKKKKKP.",
            ".PKEEKKKKEEKP.",
            ".PKKKKKKKKKKP.",
            ".PPKKKKKKKKPP.",
            "WPPppPPPPppPPW",
            "WWPPPPPPPPPPWW",
            ".PpPPPPPPPPpP.",
            ".PpPPPPPPPPpP.",
            "pPPPPPPPPPPPPp",
            ".pPPPpPPpPPPp.",
            "..pPPpPPpPPp..",
            "...pP.pp.Pp...",
            "....p....p....",
          ],
          [
            "...PPPPPPPP...",
            "..PPPPPPPPPP..",
            ".PPLLPPPPLLPP.",
            ".PKKKKKKKKKKP.",
            ".PKEEKKKKEEKP.",
            ".PKKKKKKKKKKP.",
            ".PPKKKKKKKKPP.",
            ".PPppPPPPppPP.",
            "WWPPPPPPPPPPWW",
            "WPpPPPPPPPPpPW",
            ".PpPPPPPPPPpP.",
            ".PPPPPPPPPPPP.",
            "pPpPPPppPPPpPp",
            "p.pPPpPPpPPp.p",
            "...pPp..pPp...",
            "...p.p..p.p...",
          ],
        ],
      },
      wraith: {
        pal: {
          C: "#5fd6d0",
          c: "#2f8f94",
          D: "#173e52",
          E: "#ff4a4a",
          B: "#e8f6f0",
          K: "#0b1822",
          H: "#cfe6e0",
          W: "#a8fff4",
        },
        f: [
          [
            "H............H",
            "HH..........HH",
            ".HHBBBBBBBBHH.",
            "..BBBBBBBBBB..",
            "..KEEBBBBEEK..",
            "..BBBBBBBBBB..",
            "...BKKBBKKB...",
            "...BBBBBBBB...",
            ".CcCCCCCCCCcC.",
            "CcCCCCCCCCCCcC",
            "BCcCDDCCDDCcCB",
            "BCcCDDDDDDCcCB",
            "WCcCCDDDDCCcCW",
            ".CcCCCCCCCCcC.",
            ".cCCCCccCCCCc.",
            "..cCCCccCCCc..",
            "..cCCcCCcCCc..",
            "...cCccccCc...",
            "...cC.cc.Cc...",
            "....c....c....",
          ],
          [
            "H............H",
            "HH..........HH",
            ".HHBBBBBBBBHH.",
            "..BBBBBBBBBB..",
            "..KEEBBBBEEK..",
            "..BBBBBBBBBB..",
            "...BKKBBKKB...",
            "...BBBBBBBB...",
            ".CcCCCCCCCCcC.",
            "CcCCCCCCCCCCcC",
            "CCcCDDCCDDCcCC",
            "BCcCDDDDDDCcCB",
            "BCcCCDDDDCCcCB",
            "WcCCCCCCCCCCcW",
            ".cCCCCccCCCCc.",
            "..cCCCccCCCc..",
            "..cCCcCCcCCc..",
            "..cCcCccCcCc..",
            "...cC.cc.Cc...",
            "...c......c...",
          ],
        ],
      },
      bat: {
        pal: {
          B: "#5a3a7a",
          b: "#3a2354",
          L: "#7e58a8",
          R: "#ff4d6d",
          T: "#ffffff",
          E: "#2a1840",
        },
        f: [
          [
            "BB....E..E....BB",
            "BBb...EBBE...bBB",
            "BBBb.BBBBBB.bBBB",
            ".BBBbBRBBRBbBBB.",
            "..BBBBBBBBBBBB..",
            "...bBBBTTBBBb...",
            ".....BBBBBB.....",
            "......B..B......",
          ],
          [
            "................",
            "......E..E......",
            "......EBBE......",
            "bB..BBRBBRBB..Bb",
            "BBbBBBBBBBBBBbBB",
            "BBBbbBBTTBBbbBBB",
            ".BB.bBBBBBBb.BB.",
            "..b..BB..BB..b..",
            "......b..b......",
          ],
        ],
      },
      fangbat: {
        pal: {
          B: "#7a2a4a",
          b: "#4a1830",
          L: "#b04a78",
          R: "#ff3030",
          T: "#ffffff",
          E: "#3a1426",
          M: "#8c3a5e",
          K: "#1a0a14",
        },
        f: [
          [
            "B..................B",
            "BB.....E....E.....BB",
            "BMB....EB..BE....BMB",
            "BMMb..BBBBBBBB..bMMB",
            ".BMMbBBBBBBBBBBbMMB.",
            ".BBMMBBRRBBRRBBMMBB.",
            "..BBBBBBBBBBBBBBBB..",
            "...bBBBKKBBKKBBBb...",
            "....bBBBTKKTBBBb....",
            ".....BBBBTTBBBB.....",
            "......BBB..BBB......",
            ".......B....B.......",
          ],
          [
            "....................",
            ".......E....E.......",
            ".......EB..BE.......",
            "..b...BBBBBBBB...b..",
            "B.bbbBBBBBBBBBBbbb.B",
            "BBMbBBBRRBBRRBBBbMBB",
            "BMMMMBBBBBBBBBBMMMMB",
            ".BMMMBBKKBBKKBBMMMB.",
            "..BbMBBBTKKTBBBMbB..",
            "...b.BBBBTTBBBB.b...",
            ".......BB..BB.......",
            "........B..B........",
          ],
        ],
      },
      brute: {
        pal: {
          R: "#9b2f55",
          r: "#521833",
          L: "#c4507a",
          Y: "#ffd24a",
          K: "#14070e",
          H: "#e6dcc0",
          T: "#ffffff",
        },
        f: [
          [
            "H................H",
            "HH..............HH",
            ".HHRRRRRRRRRRRRHH.",
            "..RRRRRRRRRRRRRR..",
            "..RKRRRRRRRRRRKR..",
            "..RYYRRRRRRRRYYR..",
            "..RKYRRRRRRRRYKR..",
            "..RRRRRTRRTRRRRR..",
            "..rRKKKKKKKKKKRr..",
            "..RRRRRRRRRRRRRR..",
            "RRRLRRRRRRRRRRLRRR",
            "RLLLRRrRRRRrRRLLLR",
            "RRLRRRrRRRRrRRRLRR",
            "HRRRRRRrRRrRRRRRRH",
            "HRRrRRRRRRRRRRrRRH",
            "HH.rRRRRRRRRRRr.HH",
            "...RRRRRRRRRRRR...",
            "...rrR.rrrr.Rrr...",
            "..rrr........rrr..",
          ],
          [
            "H................H",
            "HH..............HH",
            ".HHRRRRRRRRRRRRHH.",
            "..RRRRRRRRRRRRRR..",
            "..RKRRRRRRRRRRKR..",
            "..RYYRRRRRRRRYYR..",
            "..RKYRRRRRRRRYKR..",
            "..RRRRRTRRTRRRRR..",
            "..rRKKKKKKKKKKRr..",
            "..RRRRRRRRRRRRRR..",
            "RRRLRRRRRRRRRRLRRR",
            "RLLLRRrRRRRrRRLLLR",
            "RRLRRRrRRRRrRRRLRR",
            "HRRRRRRrRRrRRRRRRH",
            "HRRrRRRRRRRRRRrRRH",
            "HH.rRRRRRRRRRRr.HH",
            "...RRRRRRRRRRRR...",
            "...rrr.rrrr.rrr...",
            "...rr........rr...",
          ],
        ],
      },
      hexer: {
        pal: {
          D: "#3a2a5a",
          d: "#231638",
          P: "#5b3f8c",
          E: "#ff5a8a",
          H: "#d8cdb0",
          O: "#c04dff",
          o: "#f6c8ff",
          K: "#0e0818",
          B: "#e8d9b0",
          Q: "#8a5cff",
        },
        f: [
          [
            ".....DD.....",
            "....DDDD....",
            "H..DDDDDD..H",
            "HH.DDPPDD.HH",
            ".HDDPPPPDDH.",
            "..DKKKKKKD..",
            "..DEEKKEED..",
            "..DKKKKKKD..",
            ".DDDDDDDDDD.",
            "DDPDDQQDDPDD",
            "DDDDdOOdDDDD",
            "DBDDdOOdDDBD",
            "DDDDdQQdDDDD",
            "DDDDDddDDDDD",
            "dDDDDDDDDDDd",
            "dDDDDDDDDDDd",
            ".dDdDddDdDd.",
          ],
          [
            ".....DD.....",
            "....DDDD....",
            "H..DDDDDD..H",
            "HH.DDPPDD.HH",
            ".HDDPPPPDDH.",
            "..DKKKKKKD..",
            "..DEEKKEED..",
            "..DKKKKKKD..",
            ".DDDDDDDDDD.",
            "DDPDDQQDDPDD",
            "DDDDdoodDDDD",
            "DBDDdoodDDBD",
            "DDDDdQQdDDDD",
            "DDDDDddDDDDD",
            "dDDDDDDDDDDd",
            "dDDDDDDDDDDd",
            ".dDdDddDdDd.",
          ],
          [
            ".....DD.....",
            "....DDDD....",
            "H..DDDDDD..H",
            "HH.DDPPDD.HH",
            ".HDDPPPPDDH.",
            "..DKKKKKKD..",
            "..DEEKKEED..",
            "..DKKKKKKD..",
            ".DDDDDDDDDD.",
            "DDPDDooDDPDD",
            "DDDDdoodDDDD",
            "DBDDdoodDDBD",
            "DDDDdoodDDDD",
            "DDDDDddDDDDD",
            "dDDDDDDDDDDd",
            "dDDDDDDDDDDd",
            ".dDdDddDdDd.",
          ],
        ],
      },
      elite: {
        pal: {
          A: "#3a3a68",
          a: "#1b1b3a",
          L: "#6a6aa0",
          Y: "#ff4d4d",
          G: "#f2c14e",
          K: "#07070f",
          H: "#e6dcc0",
          T: "#ffffff",
        },
        f: [
          [
            "H.......GG.......H",
            "HH.....GGGG.....HH",
            ".HH.GGGGGGGGGG.HH.",
            "..GAAAAAAAAAAAAG..",
            "..AAAAAAAAAAAAAA..",
            "..AKKKKKKKKKKKKA..",
            "..AKYYKKKKKKYYKA..",
            "..AKKKKKKKKKKKKA..",
            "..aKTKTKTTKTKTKa..",
            "GGGAaAAAAAAAAaAGGG",
            "GAAAAAALLLLAAAAAAG",
            "GAGAAAALAALAAAAGAG",
            ".GAAAAGGGGGGAAAAG.",
            "..AAAAAAAAAAAAAA..",
            "..aAAaAAAAAAaAAa..",
            "..aAAAAAAAAAAAAa..",
            "..AA.AAAAAAAA.AA..",
            "..aa.aaaaaaaa.aa..",
            "..aaa........aaa..",
          ],
          [
            "H.......GG.......H",
            "HH.....GGGG.....HH",
            ".HH.GGGGGGGGGG.HH.",
            "..GAAAAAAAAAAAAG..",
            "..AAAAAAAAAAAAAA..",
            "..AKKKKKKKKKKKKA..",
            "..AKYYKKKKKKYYKA..",
            "..AKKKKKKKKKKKKA..",
            "..aKTKTKTTKTKTKa..",
            "GGGAaAAAAAAAAaAGGG",
            "GAAAAAALLLLAAAAAAG",
            "GAGAAAALAALAAAAGAG",
            ".GAAAAGGGGGGAAAAG.",
            "..AAAAAAAAAAAAAA..",
            "..aAAaAAAAAAaAAa..",
            "..aAAAAAAAAAAAAa..",
            ".AA..AAAAAAAA..AA.",
            "...aa.aaaaaa.aa...",
            "...aa........aa...",
          ],
          [
            "H.......GG.......H",
            "HH.....GGGG.....HH",
            ".HH.GGGGGGGGGG.HH.",
            "..GAAAAAAAAAAAAG..",
            "..AAAAAAAAAAAAAA..",
            "..AKKKKKKKKKKKKA..",
            "..AKYYKKKKKKYYKA..",
            "..AKKKKKKKKKKKKA..",
            "..aKTKTKTTKTKTKa..",
            "GGGAaAAAAAAAAaAGGG",
            "GAAAAAALLLLAAAAAAG",
            "GAGAAAALAALAAAAGAG",
            ".GAAAAGGGGGGAAAAG.",
            "..AAAAAAAAAAAAAA..",
            "..aAAaAAAAAAaAAa..",
            "..aAAAAAAAAAAAAa..",
            "..AA.AAAAAAAA.AA..",
            "..aa.aaaaaaaa.aa..",
            "..aaa........aaa..",
          ],
        ],
      },
    },
    STALKER_VEC = [
      {
        w: 27,
        h: 18,
        ops: [
          ["#2e2250", "e", 1.2, 9.5, 1.4, 1.0],
          ["#2e2250", "e", 3.2, 12.0, 1.2, 0.9],
          ["#2e2250", "e", 9, 13.2, 1.3, 0.8],
          [
            "#241a3e",
            "p",
            [
              [3.5, 5.8],
              [0.8, 3.6],
              [0, 0.4],
              [1.8, 1.6],
              [3, 3.2],
              [5.6, 5.6],
            ],
          ],
          [
            "#2e2250",
            "p",
            [
              [13.2, 10.5],
              [15.6, 10.5],
              [18.8, 14.0],
              [19.2, 16.4],
              [17, 16.4],
              [14.2, 13.2],
            ],
          ],
          [
            "#2e2250",
            "p",
            [
              [6.6, 10],
              [9, 10],
              [7.4, 14.2],
              [5.6, 16.4],
              [3.6, 16.4],
              [5.6, 13.8],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [4.7, 5.6],
              [6.2, 2.0],
              [7.7, 5.6],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [7.7, 5.6],
              [9.2, 2.0],
              [10.7, 5.6],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [10.7, 5.6],
              [12.2, 2.0],
              [13.7, 5.6],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [13.7, 5.6],
              [15.2, 2.0],
              [16.7, 5.6],
            ],
          ],
          ["#4a3a78", "e", 6, 8.6, 4.6, 4.0],
          ["#4a3a78", "e", 11.2, 7.8, 7.2, 3.7],
          ["#4a3a78", "e", 16.4, 8.4, 4.3, 4.1],
          ["#7a66b8", "e", 11.2, 6.6, 5.6, 1.5],
          ["#7a66b8", "e", 16.8, 6.4, 2.4, 1.1],
          [
            "#4a3a78",
            "p",
            [
              [15.6, 10.5],
              [18.2, 10.5],
              [22.2, 14.6],
              [22.8, 16.6],
              [20.4, 16.6],
              [17.4, 13.2],
              [15.6, 12],
            ],
          ],
          [
            "#4a3a78",
            "p",
            [
              [3.5, 10],
              [6.8, 10],
              [5, 14.6],
              [2.4, 16.6],
              [0.4, 16.6],
              [2.2, 14],
              [3.4, 12],
            ],
          ],
          ["#4a3a78", "e", 21.4, 5.4, 3.5, 3.0],
          [
            "#4a3a78",
            "p",
            [
              [22.6, 3.8],
              [26.6, 5.6],
              [26.6, 7.4],
              [22, 8.0],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [21, 7.6],
              [26.6, 7.2],
              [24.6, 9.6],
              [21, 9.2],
            ],
          ],
          [
            "#ffffff",
            "p",
            [
              [22.4, 7.4],
              [22.9, 8.8],
              [23.5, 7.4],
            ],
          ],
          [
            "#ffffff",
            "p",
            [
              [24.6, 7.4],
              [25.1, 8.8],
              [25.7, 7.4],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [18.8, 3.2],
              [19.4, -0.6],
              [21.2, 2.8],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [21.0, 2.8],
              [22.8, -0.2],
              [23.6, 3.8],
            ],
          ],
          ["#ff3030", "e", 22.4, 4.8, 1.4, 1.0],
          ["#ffe6e6", "e", 22.7, 4.7, 0.5, 0.4],
        ],
      },
      {
        w: 27,
        h: 18,
        ops: [
          ["#2e2250", "e", 1.2, 9.1, 1.4, 1.0],
          ["#2e2250", "e", 3.2, 11.76, 1.2, 0.9],
          ["#2e2250", "e", 9, 13.04, 1.3, 0.8],
          [
            "#241a3e",
            "p",
            [
              [3.5, 5.4],
              [0.8, 3.2],
              [0, 0.0],
              [1.8, 1.2],
              [3, 2.8],
              [5.6, 5.2],
            ],
          ],
          [
            "#2e2250",
            "p",
            [
              [13.2, 10.5],
              [15.4, 10.5],
              [14.6, 14.2],
              [14.8, 16.4],
              [12.6, 16.4],
              [12.8, 13.6],
            ],
          ],
          [
            "#2e2250",
            "p",
            [
              [6.6, 10],
              [9, 10],
              [10.2, 14.0],
              [11.2, 16.4],
              [9, 16.4],
              [8.2, 13.8],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [4.7, 5.2],
              [6.2, 1.6],
              [7.7, 5.2],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [7.7, 5.2],
              [9.2, 1.6],
              [10.7, 5.2],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [10.7, 5.2],
              [12.2, 1.6],
              [13.7, 5.2],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [13.7, 5.2],
              [15.2, 1.6],
              [16.7, 5.2],
            ],
          ],
          ["#4a3a78", "e", 6, 8.2, 4.6, 4.0],
          ["#4a3a78", "e", 11.2, 7.4, 7.2, 3.7],
          ["#4a3a78", "e", 16.4, 8.0, 4.3, 4.1],
          ["#7a66b8", "e", 11.2, 6.2, 5.6, 1.5],
          ["#7a66b8", "e", 16.8, 6.0, 2.4, 1.1],
          [
            "#4a3a78",
            "p",
            [
              [15.6, 10.5],
              [18.2, 10.5],
              [18.4, 14.0],
              [19.6, 16.6],
              [17.2, 16.6],
              [16.4, 14],
            ],
          ],
          [
            "#4a3a78",
            "p",
            [
              [3.5, 10],
              [6.8, 10],
              [7.6, 14.0],
              [8.6, 16.6],
              [6.2, 16.6],
              [5.4, 14],
            ],
          ],
          ["#4a3a78", "e", 21.4, 5.0, 3.5, 3.0],
          [
            "#4a3a78",
            "p",
            [
              [22.6, 3.4],
              [26.6, 5.2],
              [26.6, 7.0],
              [22, 7.6],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [21, 7.2],
              [26.6, 6.8],
              [24.6, 9.2],
              [21, 8.8],
            ],
          ],
          [
            "#ffffff",
            "p",
            [
              [22.4, 7.0],
              [22.9, 8.4],
              [23.5, 7.0],
            ],
          ],
          [
            "#ffffff",
            "p",
            [
              [24.6, 7.0],
              [25.1, 8.4],
              [25.7, 7.0],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [18.8, 2.8],
              [19.4, -1.0],
              [21.2, 2.4],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [21.0, 2.4],
              [22.8, -0.6],
              [23.6, 3.4],
            ],
          ],
          ["#ff3030", "e", 22.4, 4.4, 1.4, 1.0],
          ["#ffe6e6", "e", 22.7, 4.3, 0.5, 0.4],
        ],
      },
      {
        w: 27,
        h: 18,
        ops: [
          ["#2e2250", "e", 1.5, 13.2, 1.6, 1.0],
          ["#2e2250", "e", 4, 14.2, 1.4, 0.8],
          [
            "#241a3e",
            "p",
            [
              [3.5, 8.2],
              [0.8, 6.0],
              [0, 2.8],
              [1.8, 4.0],
              [3, 5.6],
              [5.6, 8.0],
            ],
          ],
          [
            "#2e2250",
            "p",
            [
              [13.2, 12.5],
              [15.6, 12.5],
              [18.6, 15.4],
              [19, 16.8],
              [16.8, 16.8],
              [14, 15],
            ],
          ],
          [
            "#2e2250",
            "p",
            [
              [6.6, 12.5],
              [9, 12.5],
              [8, 15.2],
              [7.8, 16.8],
              [5.6, 16.8],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [4.7, 8.0],
              [6.2, 3.2],
              [7.7, 8.0],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [7.7, 8.0],
              [9.2, 3.2],
              [10.7, 8.0],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [10.7, 8.0],
              [12.2, 3.2],
              [13.7, 8.0],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [13.7, 8.0],
              [15.2, 3.2],
              [16.7, 8.0],
            ],
          ],
          ["#4a3a78", "e", 6, 11.0, 4.6, 4.0],
          ["#4a3a78", "e", 11.2, 10.2, 7.2, 3.7],
          ["#4a3a78", "e", 16.4, 11.28, 4.3, 4.1],
          ["#7a66b8", "e", 11.2, 9.0, 5.6, 1.5],
          ["#7a66b8", "e", 16.8, 9.28, 2.4, 1.1],
          [
            "#4a3a78",
            "p",
            [
              [15.6, 12.5],
              [18.4, 12.5],
              [22, 15.8],
              [22.4, 17],
              [20, 17],
              [17, 15],
            ],
          ],
          [
            "#4a3a78",
            "p",
            [
              [3.5, 12.5],
              [7, 12.5],
              [6.6, 15.4],
              [7, 17],
              [4.2, 17],
              [3.6, 15],
            ],
          ],
          ["#4a3a78", "e", 21.4, 9.4, 3.5, 3.0],
          [
            "#4a3a78",
            "p",
            [
              [22.6, 7.8],
              [26.6, 9.6],
              [26.6, 11.4],
              [22, 12.0],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [21, 11.6],
              [26.6, 11.8],
              [24.6, 15.1],
              [21, 14.7],
            ],
          ],
          [
            "#ffffff",
            "p",
            [
              [22.4, 11.4],
              [22.9, 13.55],
              [23.5, 11.4],
            ],
          ],
          [
            "#ffffff",
            "p",
            [
              [24.6, 11.4],
              [25.1, 13.55],
              [25.7, 11.4],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [18.8, 7.2],
              [19.4, 3.4],
              [21.2, 6.8],
            ],
          ],
          [
            "#241a3e",
            "p",
            [
              [21.0, 6.8],
              [22.8, 3.8],
              [23.6, 7.8],
            ],
          ],
          ["#ff9a3a", "e", 22.4, 8.8, 1.4, 1.0],
          ["#ffe6e6", "e", 22.7, 8.7, 0.5, 0.4],
        ],
      },
    ];
  function buildEnemyArt() {
    for (const k in ENEMY_ART) {
      const A = ENEMY_ART[k];
      EFR[k] = A.f.map((r) => buildSprite(r, A.pal));
      S[k] = EFR[k][0];
    }
    EFR.stalker = STALKER_VEC.map(vecSprite);
    S.stalker = EFR.stalker[0];
    buildPlagueRatArt();
    for (const [id, def] of Object.entries(ET)) {
      const spriteKey = def.spr || id;
      if (
        S[spriteKey] ||
        !def.artTemplate ||
        !TPL[def.artTemplate] ||
        !def.palette
      )
        continue;
      const fallback = buildSprite(TPL[def.artTemplate], def.palette);
      S[spriteKey] = fallback;
      EFR[spriteKey] = [fallback];
    }
    a2Enemies();
    buildEnemyStd();
  }
  function eSpr(e, g) {
    const s = S[e.spr];
    if (!s || s.asset) return s;
    if (e.spr === "plague_rat") return plagueRatFrame(e, g);
    const A2f = EA[e.spr];
    if (A2f) return a2Frame(e, g, A2f);
    const fr = EFR[e.spr];
    if (!fr) return s;
    if (e.pose != null && fr[e.pose]) return fr[e.pose];
    const n = Math.min(2, fr.length);
    return fr[Math.floor(g.t * (e.fps || 6) + e.ph) % n];
  }
  function buildPlagueRatArt() {
    const v2 = A2 && A2.plague_rat;
    if (v2) {
      for (const pose of ["idle", "run", "attack", "hurt", "death"])
        PLAGUE_RAT_ART[pose] = a2build(v2[pose], v2.pal);
      EFR.plague_rat = PLAGUE_RAT_ART.idle;
      S.plague_rat = EFR.plague_rat[0];
      return;
    }
    const palette = ET.plague_rat.palette;
    const make = (pose, frame) => {
      const pixels = Array.from({ length: 18 }, () => Array(20).fill("."));
      const rect = (x, y, w, h, color) => {
        for (let py = Math.max(0, y); py < Math.min(18, y + h); py++)
          for (let px = Math.max(0, x); px < Math.min(20, x + w); px++)
            pixels[py][px] = color;
      };
      const bob = pose === "run" ? frame % 2 : pose === "idle" ? frame % 2 : 0;
      const drop = pose === "death" ? Math.floor(frame / 2) : 0;
      const by = 7 + bob + drop;
      const tail = [
        [5, by + 4],
        [4, by + 5],
        [3, by + 5],
        [2, by + 4],
        [2, by + 3],
      ];
      for (const [x, y] of tail) rect(x, y, 1, 1, "P");
      for (let row = 0; row < 7; row++) {
        const width = [5, 8, 9, 9, 8, 7, 5][row];
        rect(9 - Math.floor(width / 2), by + row, width, 1, "D");
        rect(10 - Math.floor(width / 2), by + row, Math.max(1, width - 2), 1, "F");
      }
      rect(8, by + 3, 5, 3, "L");
      rect(12, by - 2, 6, 6, "D");
      rect(13, by - 3, 4, 2, "D");
      rect(14, by - 2, 3, 4, "F");
      rect(13, by - 1, 3, 2, "B");
      rect(18, by + 1, 2, 2, "P");
      rect(16, by, 1, 1, "E");
      rect(16, by + 1, 1, 1, "D");
      rect(14, by + 3, 2, 1, "P");
      const stride = pose === "run" ? (frame % 2 ? 2 : -1) : 0;
      rect(7 + stride, by + 6, 2, 2, "D");
      rect(12 - stride, by + 6, 2, 2, "D");
      rect(7 + stride, by + 7, 3, 1, "P");
      rect(12 - stride, by + 7, 3, 1, "P");
      if (pose === "attack") {
        const lift = frame < 2 ? 1 : frame > 3 ? 0 : 2;
        rect(15, by + 2 - lift, 2, 1, "D");
        rect(16, by - 1 - lift, 2, 2, "O");
        rect(17, by - 2 - lift, 1, 1, "G");
        rect(16, by - lift, 2, 2, "g");
        rect(17, by - lift, 1, 1, "G");
      } else if (pose === "hurt") {
        rect(14, by - 1, 1, 1, "P");
        rect(17, by, 1, 1, "P");
      } else if (pose === "death") {
        rect(13, by - 1, 1, 1, "P");
        rect(17, by + 1, 1, 1, "P");
        if (frame >= 2) {
          rect(10, by, 2, 1, ".");
          rect(15, by + 2, 2, 1, ".");
        }
      }
      return buildSprite(pixels.map((row) => row.join("")), palette);
    };
    for (const [pose, count] of Object.entries({
      idle: 4,
      run: 6,
      attack: 5,
      hurt: 2,
      death: 4,
    }))
      PLAGUE_RAT_ART[pose] = Array.from({ length: count }, (_, i) =>
        make(pose, i),
      );
    EFR.plague_rat = PLAGUE_RAT_ART.idle;
    S.plague_rat = EFR.plague_rat[0];
  }
  function plagueRatFrame(e, g) {
    if (e.hurtT > 0)
      return PLAGUE_RAT_ART.hurt[
        Math.min(
          PLAGUE_RAT_ART.hurt.length - 1,
          Math.floor(((0.12 - e.hurtT) / 0.12) * PLAGUE_RAT_ART.hurt.length),
        )
      ];
    if (e.ai && e.ai.st === 1)
      return PLAGUE_RAT_ART.attack[
        Math.min(
          PLAGUE_RAT_ART.attack.length - 1,
          Math.floor(((0.58 - e.ai.t) / 0.58) * PLAGUE_RAT_ART.attack.length),
        )
      ];
    const moving = e.ratMoving;
    const frames = moving ? PLAGUE_RAT_ART.run : PLAGUE_RAT_ART.idle;
    return frames[Math.floor(g.t * (moving ? 12 : 5) + e.ph) % frames.length];
  }
  const AB_TXT = FE_CONTENT.demonAbilityText; /* registry.js → demonAbilityText */

  const eSfx = (e, g, d) => {
    if (d < 200 && g.t - (g.eSfx || 0) > 0.2) {
      g.eSfx = g.t;
      SFX.play("dash");
    }
  };

  /* ---------- habilidades dos inimigos comuns ---------- */
  function lunge(e, g, dt, d, ang, sf, vx, vy) {
    const dash = e.ab === "dash",
      C = dash
        ? {
          mn: 36,
          mx: 150,
          tel: 0.55,
          dur: 0.4,
          spd: 215,
          rec: 0.75,
          c0: 3.4,
          c1: 4.8,
          wk: 0.8,
        }
        : {
          mn: 60,
          mx: 170,
          tel: 0.5,
          dur: 0.5,
          spd: 185,
          rec: 0.55,
          c0: 3,
          c1: 4.2,
          wk: 1,
        };
    const a = e.ai || (e.ai = { st: 0, t: rnd(1.2, 2.5), ang: 0, gh: 0 });
    a.t -= dt;
    if (a.st === 0) {
      if (a.t <= 0 && d > C.mn && d < C.mx) {
        a.st = 1;
        a.t = C.tel;
        a.ang = ang;
      }
      return [vx * C.wk, vy * C.wk];
    }
    if (a.st === 1) {
      if (dash) e.pose = 2;
      if (a.t > 0.15) a.ang = ang;
      if (a.t <= 0) {
        a.st = 2;
        a.t = C.dur;
        eSfx(e, g, d);
      }
      return dash ? [0, 0] : [vx * 0.1, vy * 0.1];
    }
    if (a.st === 2) {
      a.gh -= dt;
      if (a.gh <= 0) {
        a.gh = 0.04;
        g.fx.push({
          k: "eghost",
          x: e.x,
          y: e.y,
          spr: e.spr,
          sc: e.sc,
          face: e.face,
          t: 0,
          life: 0.22,
        });
      }
      if (a.t <= 0) {
        a.st = 3;
        a.t = C.rec;
      }
      return [Math.cos(a.ang) * C.spd * sf, Math.sin(a.ang) * C.spd * sf];
    }
    if (a.t <= 0) {
      a.st = 0;
      a.t = rnd(C.c0, C.c1);
    }
    return dash ? [0, 0] : [-Math.cos(a.ang) * 40, -Math.sin(a.ang) * 40];
  }
  function enemyAI(e, g, p, dt, dx, dy, d, sp, vx, vy) {
    const sf = sp / (e.spd || 1),
      ang = Math.atan2(dy, dx),
      ux = dx / d,
      uy = dy / d;
    e.pose = null;
    let a = e.ai;
    switch (e.ab) {
      case "poison_flask": {
        const ra = e.rangedAttack;
        if (!ra) return [vx, vy];
        a = e.ai || (e.ai = { st: 0, t: rnd(ra.initialInterval[0], ra.initialInterval[1]) });
        a.t -= dt;
        if (a.st === 1) {
          e.ratMoving = false;
          e.pose = 2;
          if (a.t <= 0) {
            const flight = clamp(d / ra.speed, 0.4, 1.4),
              startX = e.x + e.face * 4,
              startY = e.y - 4,
              targetX = p.x,
              targetY = p.y,
              throwDx = targetX - startX,
              throwDy = targetY - startY,
              throwD = Math.hypot(throwDx, throwDy) || 1;
            g.eshots.push({
              k: "poison_flask",
              x: startX,
              y: startY,
              z: 0,
              vx: (throwDx / throwD) * (throwD / flight),
              vy: (throwDy / throwD) * (throwD / flight),
              t: 0,
              flight,
              life: flight,
              arc: 15,
              r: ra.radius,
              dmg: ra.damage,
              dead: false,
              src: e,
            });
            SFX.play("sling");
            a.st = 0;
            a.t = rnd(ra.interval[0], ra.interval[1]);
          }
          return [0, 0];
        }
        if (a.t <= 0 && d > ra.minRange && d < ra.maxRange) {
          a.st = 1;
          a.t = 0.58;
          e.ratMoving = false;
          return [0, 0];
        }
        if (d < 85) {
          e.ratMoving = true;
          return [-ux * sp, -uy * sp];
        }
        if (d > 145) {
          e.ratMoving = true;
          return [ux * sp, uy * sp];
        }
        e.ratMoving = false;
        return [0, 0];
      }
      case "flank": {
        const k =
          clamp((d - 26) / 110, 0, 1) *
          0.7 *
          (Math.sin(e.ph * 7) > 0 ? 1 : -1),
          c = Math.cos(k),
          s = Math.sin(k);
        return [(ux * c - uy * s) * sp, (ux * s + uy * c) * sp];
      }
      case "fuse":
        return d < 80 ? [vx * 1.45, vy * 1.45] : [vx, vy];
      case "phase": {
        a = e.ai || (e.ai = { st: 0, t: rnd(1, 3) });
        a.t -= dt;
        if (a.t <= 0) {
          a.st ^= 1;
          a.t = a.st ? 1.4 : rnd(3, 4.5);
        }
        return a.st ? [vx * 1.5, vy * 1.5] : [vx, vy];
      }
      case "blink": {
        a = e.ai || (e.ai = { st: 0, t: rnd(1.2, 2.4) });
        a.t -= dt;
        if (a.st === 0) {
          if (a.t <= 0 && d > 55 && d < 280) {
            a.st = 1;
            a.t = 0.6;
            const ba = rnd(0, TAU),
              br = rnd(46, 62);
            a.bx = p.x + Math.cos(ba) * br;
            a.by = p.y + Math.sin(ba) * br;
          }
          return [vx, vy];
        }
        if (a.st === 1) {
          if (a.t <= 0) {
            burst(e.x, e.y, 10, "#7fe9ff", 70);
            e.x = a.bx;
            e.y = a.by;
            burst(e.x, e.y, 12, "#7fe9ff", 80);
            g.fx.push({ k: "blinkring", x: e.x, y: e.y, t: 0, life: 0.35 });
            a.st = 2;
            a.t = 0.28;
          }
          return [0, 0];
        }
        if (a.t <= 0) {
          a.st = 0;
          a.t = rnd(2.6, 4);
        }
        return [vx * 0.4, vy * 0.4];
      }
      case "dash":
      case "dive":
        return lunge(e, g, dt, d, ang, sf, vx, vy);
      case "cast": {
        a = e.ai || (e.ai = { st: 0, t: rnd(1.5, 3) });
        a.t -= dt;
        const fs = Math.sin(e.ph * 5) > 0 ? 1 : -1;
        if (a.st === 1) {
          e.pose = 2;
          if (a.t <= 0) {
            const n = g.t > 300 ? 5 : 3;
            for (let i = 0; i < n; i++) {
              const aa = ang + (i - (n - 1) / 2) * 0.28;
              g.eshots.push({
                x: e.x,
                y: e.y - 4,
                vx: Math.cos(aa) * 68,
                vy: Math.sin(aa) * 68,
                r: 3,
                dmg: e.dmg,
                life: 4.5,
                dead: false,
                src: e,
              });
            }
            if (d < 260) SFX.play("sling");
            e.impT = g.t;
            a.st = 0;
            a.t = rnd(3, 4.2);
          }
          return [0, 0];
        }
        if (a.t <= 0 && d < 210) {
          a.st = 1;
          a.t = 0.55;
          return [0, 0];
        }
        let rx, ry;
        if (d < 90) {
          rx = -ux * 0.9;
          ry = -uy * 0.9;
        } else if (d > 135) {
          rx = ux;
          ry = uy;
        } else {
          rx = -uy * fs * 0.6;
          ry = ux * fs * 0.6;
        }
        return [rx * sp, ry * sp];
      }
      case "nova": {
        a = e.ai || (e.ai = { st: 0, t: rnd(3, 5) });
        a.t -= dt;
        if (a.st === 1) {
          e.pose = 2;
          if (a.t <= 0) {
            const n = g.t > 300 ? 14 : 10,
              off = rnd(0, TAU);
            for (let i = 0; i < n; i++) {
              const aa = off + (i / n) * TAU;
              g.eshots.push({
                x: e.x,
                y: e.y,
                vx: Math.cos(aa) * 62,
                vy: Math.sin(aa) * 62,
                r: 3,
                dmg: HPS,
                life: 5,
                dead: false,
                src: e,
                red: true,
              });
            }
            burst(e.x, e.y, 14, "#ff4d4d", 90);
            e.impT = g.t;
            a.st = 0;
            a.t = rnd(5, 7);
          }
          return [vx * 0.1, vy * 0.1];
        }
        if (a.t <= 0 && d < 230) {
          a.st = 1;
          a.t = 0.95;
        }
        return [vx, vy];
      }
      case "stomp": {
        a = e.ai || (e.ai = { st: 0, t: rnd(2, 3) });
        a.t -= dt;
        if (a.st === 1) {
          if (a.t <= 0) {
            a.st = 0;
            a.t = rnd(4, 5.5);
            e.impT = g.t;
            g.shake = Math.max(g.shake, 0.12);
            burst(e.x, e.y + 4, 12, "#c9a46a", 80);
          }
          return [0, 0];
        }
        if (a.t <= 0 && d < 50) {
          a.st = 1;
          a.t = 0.65;
          (g.tel || (g.tel = [])).push({
            k: "circ",
            x: e.x,
            y: e.y + 4,
            r: 38,
            t: 0,
            delay: 0.65,
            life: 0.8,
            dmg: e.dmg,
            done: false,
            who: "Bruto",
          });
        }
        return [vx, vy];
      }
    }
    return [vx, vy];
  }

  /* ---------- corpo rígido herói x inimigos (borda com borda) ---------- */
  const HR = 5,
    HOY = 2;
  function heroBody(g) {
    const p = g.p;
    if (p.dash || g.dying) return;
    const hx = p.x,
      hy = p.y + HOY;
    let ax = 0,
      ay = 0;
    forNear(hx, hy, HR + 34, (e) => {
      if (e.dead || !(e.mass > 0)) return;
      const dx = hx - e.x,
        dy = hy - e.y,
        d = Math.hypot(dx, dy) || 0.001,
        min = HR + e.r;
      if (d >= min) return;
      const nx = dx / d,
        ny = dy / d,
        pen = min - d,
        sh = e.mass / (e.mass + 1.5);
      ax += nx * pen * sh;
      ay += ny * pen * sh;
      e.x -= nx * pen * (1 - sh);
      e.y -= ny * pen * (1 - sh);
    });
    const m = Math.hypot(ax, ay);
    if (m > 2.5) {
      ax *= 2.5 / m;
      ay *= 2.5 / m;
    }
    p.x += ax;
    p.y += ay;
  }

  /* ---------- cenário: colisão por base do sprite e ordenação por profundidade ---------- */
  const COLL = {
    deadTree: [5, 4],
    bush: [7, 6],
    rock: [5, 5],
    tombA: [5, 6],
    tombB: [5, 4],
    cross: [5, 4],
    angel: [6, 5],
    gargoyle: [7, 5],
    coffin: [9, 7],
  };
  function solidAt(cx, cy) {
    const d = decorAt(cx, cy);
    if (!d || !SOLID[d.k]) return null;
    const c = COLL[d.k] || [SOLID[d.k], SOLID[d.k]];
    return { x: d.px, y: d.py, r: SOLID[d.k], hw: c[0], dp: c[1] };
  }
  function collide(p) {
    const FR = 5;
    for (let it = 0; it < 2; it++) {
      const fy = p.y + 6,
        c0 = Math.floor(p.x / 26),
        d0 = Math.floor(fy / 26);
      for (let cx = c0 - 1; cx <= c0 + 1; cx++)
        for (let cy = d0 - 1; cy <= d0 + 1; cy++) {
          const o = solidAt(cx, cy);
          if (!o) continue;
          const qx = clamp(p.x, o.x - o.hw, o.x + o.hw),
            qy = clamp(fy, o.y - o.dp, o.y),
            dx = p.x - qx,
            dy = fy - qy,
            d = Math.hypot(dx, dy);
          if (d >= FR) continue;
          if (d > 0.001) {
            const k = (FR - d) / d;
            p.x += dx * k;
            p.y += dy * k;
          } else {
            const l = p.x - (o.x - o.hw),
              r = o.x + o.hw - p.x,
              t = fy - (o.y - o.dp),
              b = o.y - fy,
              m = Math.min(l, r, t, b);
            if (m === l) p.x -= l + FR;
            else if (m === r) p.x += r + FR;
            else if (m === t) p.y -= t + FR;
            else p.y += b + FR;
          }
        }
    }
  }
  let DQ = [],
    DQI = 0;
  function drawDI(o) {
    const im = o.im,
      k = o.k,
      x = o.x,
      y = o.y,
      T = o.T;
    if (FLAT[k]) ctx.drawImage(im, x - (im.width >> 1), y - (im.height >> 1));
    else ctx.drawImage(im, x - (im.width >> 1), y - im.height);
    if (k === "candle") {
      ctx.fillStyle =
        "rgba(255,170,60," + (0.13 + 0.07 * Math.sin(T * 9 + o.px)) + ")";
      ctx.beginPath();
      ctx.arc(x, y - im.height + 3, 11, 0, 6.3);
      ctx.fill();
    } else if (k === "gargoyle") {
      ctx.fillStyle =
        "rgba(255,60,60," + (0.55 + 0.35 * Math.sin(T * 3 + o.px)) + ")";
      ctx.fillRect(x - (im.width >> 1) + 6, y - im.height + 6, 1, 1);
      ctx.fillRect(x - (im.width >> 1) + 9, y - im.height + 6, 1, 1);
    }
  }
  function flushDecor(y) {
    while (DQI < DQ.length && DQ[DQI].py <= y) drawDI(DQ[DQI++]);
  }
  function drawDecor() {
    const x0 = Math.floor((camx - 24) / DCS),
      x1 = Math.floor((camx + VW + 24) / DCS),
      y0 = Math.floor((camy - 10) / DCS),
      y1 = Math.floor((camy + VH + 34) / DCS),
      T = G ? G.t : performance.now() / 1000,
      queue = !!(G && G.p && state !== "menu");
    DQ.length = 0;
    DQI = 0;
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const d = decorAt(cx, cy);
        if (!d) continue;
        const k = d.k,
          x = Math.round(d.px - camx),
          y = Math.round(d.py - camy);
        if (k === "wisp") {
          const b = Math.sin(T * 2 + d.px) * 3;
          ctx.fillStyle =
            "rgba(120,220,255," + (0.13 + 0.05 * Math.sin(T * 5 + d.py)) + ")";
          ctx.beginPath();
          ctx.arc(x, y - 12 + b, 7, 0, 6.3);
          ctx.fill();
          ctx.fillStyle = "rgba(200,248,255,.95)";
          ctx.fillRect(x - 1, y - 13 + b, 2, 2);
          continue;
        }
        const im = S.decor[k];
        if (!im) continue;
        const o = { im, k, x, y, py: d.py, px: d.px, T };
        if (queue && !FLAT[k] && im.height > 8) DQ.push(o);
        else drawDI(o);
      }
    DQ.sort((a, b) => a.py - b.py);
  }

  /* ---------- desenho de inimigos ---------- */
  function enemyTel(e, g) {
    const a = e.ai;
    if (!a) return;
    const x = sx(e.x),
      y = sy(e.y);
    if ((e.ab === "dash" || e.ab === "dive") && a.st === 1) {
      const q = 1 - a.t / (e.ab === "dash" ? 0.55 : 0.5);
      ctx.save();
      ctx.strokeStyle = "rgba(255,70,50," + (0.35 + 0.5 * q) + ")";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a.ang) * 90, y + Math.sin(a.ang) * 90);
      ctx.stroke();
      ctx.restore();
      glow(e.x, e.y, 14, "rgba(255,60,40,1)", 0.3 + 0.4 * q);
    } else if (e.ab === "blink" && a.st === 1) {
      const q = 1 - a.t / 0.6;
      ctx.strokeStyle = "rgba(127,233,255," + (0.4 + 0.4 * q) + ")";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx(a.bx), sy(a.by), 14 - 8 * q, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx(a.bx), sy(a.by), 4, 0, TAU);
      ctx.stroke();
    } else if (e.ab === "nova" && a.st === 1) {
      const q = 1 - a.t / 0.95;
      glow(e.x, e.y, 20 + 12 * q, "rgba(255,60,60,1)", 0.25 + 0.5 * q);
      ctx.strokeStyle = "rgba(255,90,70," + (0.3 + 0.5 * q) + ")";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 30 * (1 - q) + 6, 0, TAU);
      ctx.stroke();
    } else if (e.ab === "cast" && a.st === 1) {
      const q = 1 - a.t / 0.55;
      glow(e.x, e.y + 2, 10 + 6 * q, "rgba(192,77,255,1)", 0.3 + 0.5 * q);
    } else if (e.ab === "poison_flask" && a.st === 1) {
      const q = 1 - a.t / 0.58;
      glow(e.x + e.face * 5, e.y - 2, 7 + 4 * q, "rgba(129,214,75,1)", 0.3 + 0.45 * q);
    }
  }
  const SQUASH_T = 0.12;
  function drawEnemy(e, g, air) {
    const s = eSpr(e, g);
    if (!s) return;
    let syy = 1,
      yy = e.y;
    const v2e = !!EA[e.spr] || e.spr === "plague_rat";
    if (e.mv === "swoop") {
      syy = v2e ? 1 : 0.75 + 0.25 * Math.abs(Math.sin(g.t * 14 + e.ph));
      yy += Math.sin(g.t * 6 + e.ph) * 1.5;
    } else if (e.mv === "wave")
      yy += Math.sin(g.t * 3 + e.ph) * (v2e ? 0.8 : 1.5);
    else if (!v2e) yy += -Math.abs(Math.sin(g.t * 9 + e.ph)) * 1.2;
    const bs = (EA[e.spr] && EA[e.spr].std && EA[e.spr].std.base) || s;
    if (!air) flushDecor(e.y + (bs.h * e.sc) / 2);
    if (e.boss) {
      ctx.fillStyle =
        "rgba(224,71,90," + (0.1 + 0.06 * Math.sin(g.t * 4)) + ")";
      ctx.beginPath();
      ctx.arc(sx(e.x), sy(e.y), e.r + 8, 0, 6.3);
      ctx.fill();
    }
    if (e.elite) {
      ctx.fillStyle = "rgba(242,193,78,.18)";
      ctx.beginPath();
      ctx.arc(sx(e.x), sy(e.y), e.r + 4, 0, 6.3);
      ctx.fill();
    }
    if (e.ai) enemyTel(e, g);
    if (e.mv !== "swoop" && e.mv !== "wave")
      shadow(e.x, e.y + (bs.h * e.sc) / 2 - 1, bs.w * e.sc * 0.7);
    let al = (e.mv === "wave" ? 0.92 : 1) * (e.al != null ? e.al : 1),
      a = e.ai;
    if (a && e.ab === "blink")
      al *= a.st === 1 ? 0.3 + 0.4 * Math.abs(Math.sin(g.t * 30)) : 0.85;
    if (a && e.ab === "phase" && a.st === 1) al *= 0.45;
    /* Game feel: squash & stretch ao levar dano (visual, não altera hitbox). Achata e alarga com os pés
       fixos no chão e recupera em ~0,12 s. Medidas em pixels inteiros para não borrar a pixel art. */
    let sxx = 1;
    if (e.sqT > 0 && save.set.fx && !e.boss && e.spr !== "plague_rat") {
      const k = (e.sqT / SQUASH_T) * (e.elite ? 0.5 : 1),
        hh = s.h * e.sc,
        ww = s.w * e.sc,
        ty = Math.max(hh - 3, Math.round(hh * (1 - 0.16 * k))),
        tx = Math.round(ww * (1 + 0.12 * k));
      yy += (hh - ty) / 2;
      syy *= ty / hh;
      sxx = tx / ww;
    }
    spr(s, e.x, yy, e.sc, e.flash > 0, e.face < 0, syy, al, sxx);
  }

  /* ---------- efeitos: utilidades ---------- */
  const GLT = {};
  function glowTex(c) {
    return (
      GLT[c] ||
      (GLT[c] = mk(32, 32, (g) => {
        const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        r.addColorStop(0, c);
        r.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = r;
        g.fillRect(0, 0, 32, 32);
      }))
    );
  }
  function glow(x, y, r, c, a) {
    if (!FXQ() || a <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(glowTex(c), sx(x) - r, sy(y) - r, r * 2, r * 2);
    ctx.restore();
  }
  function sprRot(s, x, y, sc, rot, flip, alpha) {
    ctx.save();
    ctx.translate(sx(x), sy(y));
    ctx.rotate(rot);
    ctx.scale((flip ? -1 : 1) * sc, sc);
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(s.c, -s.w / 2, -s.h / 2);
    ctx.restore();
  }
  function fxSpark(x, y, col, r) {
    if (!G || G.fx.length > 200 || !FXQ()) return;
    G.fx.push({
      wid: BTL.src || null,
      k: "spark",
      x,
      y,
      col: col || "#fff3a0",
      r: r || 10,
      t: 0,
      life: 0.26,
    });
  }
  function fxGain(c) {
    if (!G || !FXQ()) return;
    if (
      c.kind === "w" ||
      c.kind === "p" ||
      c.kind === "a" ||
      /Branch|Node/.test(c.kind)
    )
      G.fx.push({
        wid: BTL.src || null,
        k: "gain",
        x: G.p.x,
        y: G.p.y,
        t: 0,
        life: 0.9,
        follow: true,
        col:
          c.kind === "p"
            ? "159,224,255"
            : c.kind === "a"
              ? "229,166,255"
              : "255,214,110",
      });
  }
  const hz = (i, s) => {
    const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };

  const FXR = {};
  FXR.enemyDeath = (f, k) => {
    if (f.frames) {
      const frame = Math.min(
        f.frames.length - 1,
        Math.floor(f.t / 0.13),
      );
      if (f.t < 2 / 60)
        spr(f.frames[0], f.x, f.y, f.sc, true, f.flip, f.syy);
      else if (f.t < 0.52)
        spr(f.frames[frame], f.x, f.y, f.sc, false, f.flip, f.syy);
      else {
        const alpha = clamp(1 - (f.t - 0.52) / 0.2, 0, 1);
        if (alpha > 0)
          spr(f.frames[frame], f.x, f.y, f.sc, false, f.flip, f.syy, alpha);
      }
    } else if (f.t < 2 / 60) {
      spr(f.sprite, f.x, f.y, f.sc, true, f.flip, f.syy);
    } else {
      const alpha = clamp(1 - (f.t - 2 / 60) / (f.life - 2 / 60), 0, 1);
      if (alpha > 0) spr(f.sprite, f.x, f.y, f.sc, false, f.flip, f.syy, alpha);
    }
    for (const p of f.smoke) {
      const age = f.t - p.delay;
      if (age < 0 || age >= p.life) continue;
      const progress = age / p.life,
        alpha = Math.min(1, age / 0.04) * (1 - progress);
      const x = sx(f.x) + Math.round(p.x + p.vx * age),
        y = sy(f.y) + Math.round(p.y + p.vy * age);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.col;
      ctx.fillRect(x, y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  };
  FXR.poisonSplash = (f, k) => {
    const frame = Math.min(2, Math.floor(k * 3)),
      x = sx(f.x),
      y = sy(f.y),
      size = [3, 5, 7][frame],
      alpha = 1 - k;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#3a8b36";
    ctx.fillRect(x - size, y - 1, size * 2, 3);
    ctx.fillRect(x - 2, y - size, 4, size * 2);
    ctx.fillStyle = "#b5f05e";
    ctx.fillRect(x - 1, y - 2, 2, 2);
    if (frame > 0) {
      ctx.fillRect(x - size - 2, y - 3, 2, 2);
      ctx.fillRect(x + size, y + 2, 2, 2);
    }
    ctx.globalAlpha = 1;
  };
  FXR.slash = (f, k, g) => {
    const jaw = f.style === "jawbone",
      ox = sx(f.x),
      oy = sy(f.y),
      R = f.range,
      a0 = f.ang - f.arc / 2,
      wind = jaw ? 0.26 : 0,
      sw = jaw ? 0.62 : 0.55;
    if (!FXQ()) {
      ctx.fillStyle = "rgba(255,244,200," + (1 - k) * 0.9 + ")";
      ctx.beginPath();
      ctx.arc(ox, oy, R, a0, a0 + f.arc);
      ctx.arc(ox, oy, R * (0.55 + k * 0.2), a0 + f.arc, a0, true);
      ctx.closePath();
      ctx.fill();
      return;
    }
    const s2 = clamp((k - wind) / (sw - wind), 0, 1),
      e = 1 - Math.pow(1 - s2, 3),
      th = k < wind ? a0 - 0.4 * (k / wind) : a0 + f.arc * e,
      fade = 1 - Math.max(0, (k - sw) / (1 - sw));
    if (!jaw && !f.sp) {
      f.sp = 1;
      burst(
        f.x + Math.cos(f.ang) * R,
        f.y + Math.sin(f.ang) * R,
        7,
        "#ffe9a0",
        70,
      );
    }
    if (k >= wind) {
      const len = f.arc * e * (jaw ? 0.5 : 0.85),
        N = 12;
      ctx.save();
      ctx.lineCap = "butt";
      for (let i = 0; i < N; i++) {
        const t1 = th - (len * i) / N,
          t2 = th - (len * (i + 1)) / N,
          al = (1 - i / N) * fade * (jaw ? 0.5 : 0.8);
        if (al <= 0.02) continue;
        ctx.strokeStyle = jaw
          ? "rgba(214,190,150," + al + ")"
          : "rgba(255,236,160," + al + ")";
        ctx.lineWidth = R * (jaw ? 0.55 : 0.42) * (1 - (i / N) * 0.4);
        ctx.beginPath();
        ctx.arc(ox, oy, R * 0.74, t2, t1);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255,255,255," + fade * 0.8 + ")";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ox, oy, R, th - len, th);
      ctx.stroke();
      ctx.restore();
    }
    if (!jaw) {
      if (k < sw + 0.15) {
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(th);
        ctx.lineCap = "round";
        ctx.strokeStyle = "rgba(255,200,90," + fade * 0.55 + ")";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(R, 0);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255," + fade + ")";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(R, 0);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,214,110," + fade + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(7, -3);
        ctx.lineTo(7, 3);
        ctx.stroke();
        ctx.restore();
        glow(
          f.x + Math.cos(th) * R,
          f.y + Math.sin(th) * R,
          9,
          "rgba(255,240,170,1)",
          fade * 0.9,
        );
      }
    } else {
      const bone = (t, al) => {
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(t);
        ctx.lineCap = "round";
        ctx.strokeStyle = "rgba(30,20,34," + al + ")";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(R * 0.95, 0);
        ctx.stroke();
        ctx.strokeStyle = "rgba(233,220,192," + al + ")";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(R * 0.95, 0);
        ctx.stroke();
        ctx.strokeStyle = "rgba(185,173,140," + al + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(5, 1.5);
        ctx.lineTo(R * 0.95, 1.5);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255," + al + ")";
        for (let r = R * 0.35; r < R * 0.92; r += 4)
          ctx.fillRect(r, -3.5, 2, 2);
        ctx.fillStyle = "rgba(233,220,192," + al + ")";
        ctx.beginPath();
        ctx.arc(R * 0.95, 0, 3.2, 0, TAU);
        ctx.fill();
        ctx.restore();
      };
      if (k >= wind && s2 < 1)
        for (let i = 3; i >= 1; i--)
          bone(th - 0.2 * i, ((0.22 * fade) / i) * 2);
      if (k < sw + 0.2) bone(th, fade);
      const ix = f.x + Math.cos(f.ang) * R * 0.9,
        iy = f.y + Math.sin(f.ang) * R * 0.9;
      const ki = wind + (sw - wind) * 0.21;
      if (k >= ki) {
        if (!f.imp) {
          f.imp = 1;
          burst(ix, iy, 14, "#c9b48a", 80);
          burst(ix, iy, 6, "#ffb04a", 60);
        }
        const q = (k - ki) / (1 - ki);
        glow(ix, iy, 16, "rgba(255,170,70,1)", (1 - q) * 0.8);
        ctx.strokeStyle = "rgba(220,190,140," + (1 - q) + ")";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(sx(ix), sy(iy), 5 + q * 18, 2.5 + q * 9, 0, 0, TAU);
        ctx.stroke();
        ctx.lineWidth = 1;
        for (let i = 0; i < 7; i++) {
          const aa = (i / 7) * TAU,
            r1 = 4 + q * 8,
            r2 = r1 + 5 * (1 - q);
          ctx.beginPath();
          ctx.moveTo(
            sx(ix) + Math.cos(aa) * r1,
            sy(iy) + Math.sin(aa) * r1 * 0.55,
          );
          ctx.lineTo(
            sx(ix) + Math.cos(aa) * r2,
            sy(iy) + Math.sin(aa) * r2 * 0.55,
          );
          ctx.stroke();
        }
      }
    }
  };
  FXR.ring = (f, k, g) => {
    const x = sx(f.x),
      y = sy(f.y),
      R = f.r,
      st = f.style || "horn",
      fd = 1 - k;
    if (!FXQ()) {
      ctx.strokeStyle = "rgba(242,193,78," + fd + ")";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.stroke();
      return;
    }
    if (st === "quake") {
      ctx.strokeStyle = "rgba(201,164,106," + fd + ")";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = "rgba(60,40,24," + fd + ")";
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const aa = (i / 8) * TAU + hz(i, 1) * 0.4;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(aa) * 4, y + Math.sin(aa) * 4);
        ctx.lineTo(
          x + Math.cos(aa + 0.1) * R * 0.55,
          y + Math.sin(aa + 0.1) * R * 0.55,
        );
        ctx.lineTo(x + Math.cos(aa) * R * 0.95, y + Math.sin(aa) * R * 0.95);
        ctx.stroke();
      }
      return;
    }
    if (st === "pulse") {
      ctx.strokeStyle = "rgba(255,240,170," + fd * 0.8 + ")";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.stroke();
      return;
    }
    const judg = st === "judg",
      c = judg ? "255,246,200" : "255,214,110",
      gr = ctx.createRadialGradient(x, y, R * 0.55, x, y, R);
    gr.addColorStop(0, "rgba(" + c + ",0)");
    gr.addColorStop(1, "rgba(" + c + "," + fd * 0.38 + ")");
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(" + c + "," + fd + ")";
    ctx.lineWidth = judg ? 4 : 3;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255," + fd * 0.9 + ")";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, R - 3), 0, TAU);
    ctx.stroke();
    for (const [m, al] of [
      [0.8, 0.55],
      [0.62, 0.35],
    ]) {
      ctx.strokeStyle = "rgba(" + c + "," + fd * al + ")";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, R * m, 0, TAU);
      ctx.stroke();
    }
    if (k < 0.3 || judg) {
      const n = judg ? 12 : 8,
        L = R * (judg ? 0.35 : 0.5) * (1 - k);
      ctx.strokeStyle = "rgba(255,255,230," + fd * 0.8 + ")";
      for (let i = 0; i < n; i++) {
        const aa = (i / n) * TAU + (judg ? k * 1.5 : 0);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(aa) * (R - L), y + Math.sin(aa) * (R - L));
        ctx.lineTo(x + Math.cos(aa) * R, y + Math.sin(aa) * R);
        ctx.stroke();
      }
    }
    glow(f.x, f.y, R * 0.8, "rgba(" + c + ",1)", fd * (k < 0.2 ? 0.6 : 0.2));
  };
  FXR.flame = (f, k, g) => {
    const x = sx(f.x),
      y = sy(f.y),
      fq = FXQ();
    if (f.t < f.delay) {
      const q = f.t / f.delay;
      ctx.save();
      ctx.strokeStyle = "rgba(255,120,40," + (0.35 + 0.4 * q) + ")";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.lineDashOffset = -f.t * 30;
      ctx.beginPath();
      ctx.arc(x, y, f.r * (0.45 + 0.55 * q), 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(x, y, f.r * 0.4 * q, 0, TAU);
      ctx.stroke();
      ctx.restore();
      if (fq) {
        ctx.fillStyle = "rgba(255,170,60,.9)";
        for (let i = 0; i < 6; i++) {
          const ph = (f.t * 1.6 + hz(i, 2)) % 1,
            aa = hz(i, 3) * TAU,
            rr = f.r * 0.8 * hz(i, 4);
          ctx.fillRect(
            x + Math.cos(aa) * rr,
            y + Math.sin(aa) * rr * 0.6 - ph * 16,
            1,
            1 + (ph < 0.5 ? 1 : 0),
          );
        }
      }
      if (q > 0.6) {
        const fq2 = (q - 0.6) / 0.4,
          fy = y - 130 * (1 - fq2);
        glow(f.x, f.y - 130 * (1 - fq2), 16, "rgba(255,150,40,1)", 0.8);
        ctx.fillStyle = "#ffe27a";
        ctx.fillRect(x - 2, fy - 2, 4, 4);
        ctx.fillStyle = "#ff7a1a";
        ctx.fillRect(x - 1, fy - 12 * fq2 - 6, 2, 8);
      }
      return;
    }
    const kk = (f.t - f.delay) / (f.life - f.delay),
      fd = 1 - kk;
    ctx.fillStyle = "rgba(30,14,8," + fd * 0.35 + ")";
    ctx.beginPath();
    ctx.ellipse(x, y, f.r, f.r * 0.5, 0, 0, TAU);
    ctx.fill();
    for (let j = -2; j <= 2; j++) {
      const tx = x + j * f.r * 0.35,
        h =
          (46 - Math.abs(j) * 9) *
          (1 - kk * 0.45) *
          (0.85 + 0.15 * Math.sin(f.t * 22 + j * 2)),
        w = f.r * 0.55 * (1 - kk * 0.4),
        sway = Math.sin(f.t * 14 + j) * 2;
      for (const [c, sc] of [
        ["rgba(230,59,26,", 1],
        ["rgba(255,140,30,", 0.75],
        ["rgba(255,226,122,", 0.45],
      ]) {
        ctx.fillStyle = c + fd * 0.9 + ")";
        ctx.beginPath();
        ctx.moveTo(tx - (w * sc) / 2, y);
        ctx.quadraticCurveTo(
          tx - w * sc * 0.65,
          y - h * sc * 0.5,
          tx + sway * sc,
          y - h * sc,
        );
        ctx.quadraticCurveTo(
          tx + w * sc * 0.65,
          y - h * sc * 0.5,
          tx + (w * sc) / 2,
          y,
        );
        ctx.fill();
      }
    }
    glow(f.x, f.y - 10, f.r * 1.7, "rgba(255,150,40,1)", fd * 0.75);
    if (fq) {
      ctx.fillStyle = "rgba(255,200,90," + fd + ")";
      for (let i = 0; i < 7; i++) {
        const ph = (kk * 1.4 + hz(i, 5)) % 1;
        ctx.fillRect(x + (hz(i, 6) - 0.5) * f.r * 1.6, y - 6 - ph * 40, 1, 1);
      }
    }
  };
  FXR.bolt = (f, k, g) => {
    const bx = sx(f.x),
      by = sy(f.y);
    if (f.t < f.delay) {
      const q = f.t / f.delay;
      ctx.strokeStyle = "rgba(255,240,140," + (0.3 + 0.5 * q) + ")";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bx, by, f.r * (1 - 0.5 * q), 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const aa = hz(i, 7) * TAU + f.t * 9,
          r1 = f.r * (1 - 0.5 * q);
        ctx.beginPath();
        ctx.moveTo(bx + Math.cos(aa) * r1, by + Math.sin(aa) * r1);
        ctx.lineTo(bx + Math.cos(aa) * (r1 + 4), by + Math.sin(aa) * (r1 + 4));
        ctx.stroke();
      }
      glow(f.x, f.y, f.r, "rgba(255,240,140,1)", 0.2 * q);
      return;
    }
    const kk = (f.t - f.delay) / (f.life - f.delay),
      al = 1 - kk,
      top = by - 150;
    ctx.save();
    ctx.lineJoin = "miter";
    const path = (ox, tx, amp) => {
      ctx.beginPath();
      for (let i = 0; i <= 7; i++) {
        const x = i === 7 ? tx : ox + f.zz[i] * amp * (1 - (i / 7) * 0.6),
          y = top + ((by - top) * i) / 7;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
    };
    path(bx, bx, 1);
    ctx.strokeStyle = "rgba(255,225,90," + al * 0.35 + ")";
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,214,74," + al + ")";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255," + al + ")";
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let b = 0; b < 2; b++) {
      const si = 2 + b * 2,
        sy0 = top + ((by - top) * si) / 7,
        sxx = bx + f.zz[si] * (1 - (si / 7) * 0.6),
        dir = b ? 1 : -1;
      ctx.strokeStyle = "rgba(255,240,150," + al * 0.8 + ")";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sxx, sy0);
      ctx.lineTo(sxx + dir * 8, sy0 + 9);
      ctx.lineTo(sxx + dir * 5, sy0 + 17);
      ctx.stroke();
    }
    ctx.restore();
    glow(f.x, f.y, f.r * 2, "rgba(255,240,150,1)", al * 0.9);
    ctx.fillStyle = "rgba(255,250,200," + al * 0.6 + ")";
    ctx.beginPath();
    ctx.arc(bx, by, f.r * (0.8 + kk * 0.6), 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,230,120," + al + ")";
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const aa = hz(i, 8) * TAU,
        r1 = f.r * (0.8 + kk),
        r2 = r1 + 6 * al;
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(aa) * r1, by + Math.sin(aa) * r1 * 0.6);
      ctx.lineTo(bx + Math.cos(aa) * r2, by + Math.sin(aa) * r2 * 0.6);
      ctx.stroke();
    }
    if (f.links)
      for (const l of f.links) {
        const ex = sx(l.x),
          ey = sy(l.y);
        ctx.strokeStyle = "rgba(255,240,150," + al + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        for (let i = 1; i < 4; i++)
          ctx.lineTo(
            bx + ((ex - bx) * i) / 4 + (hz(i, 9) - 0.5) * 8,
            by + ((ey - by) * i) / 4 + (hz(i, 10) - 0.5) * 8,
          );
        ctx.lineTo(ex, ey);
        ctx.stroke();
        glow(l.x, l.y, 8, "rgba(255,240,150,1)", al * 0.7);
      }
  };
  FXR.spark = (f, k) => {
    const x = sx(f.x),
      y = sy(f.y),
      r = f.r * (0.4 + k);
    glow(f.x, f.y, f.r, f.col, 1 - k);
    ctx.strokeStyle = f.col;
    ctx.globalAlpha = 1 - k;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r);
    ctx.lineTo(x, y + r);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  FXR.heal = (f, k) => {
    const fd = 1 - k;
    for (let i = 0; i < 8; i++) {
      const aa = hz(i, 11) * TAU,
        rr = 4 + hz(i, 12) * 9,
        x = sx(f.x) + Math.cos(aa) * rr,
        y = sy(f.y) + 4 - k * 22 - hz(i, 13) * 6;
      ctx.fillStyle =
        (i & 1 ? "rgba(160,255,170," : "rgba(255,240,170,") + fd + ")";
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
    }
    ctx.strokeStyle = "rgba(140,255,160," + fd * 0.7 + ")";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(sx(f.x), sy(f.y) + 7, 4 + k * 12, 2 + k * 5, 0, 0, TAU);
    ctx.stroke();
    glow(f.x, f.y, 14, "rgba(120,255,160,1)", fd * 0.35);
  };
  FXR.guard = (f, k) => {
    const x = sx(f.x),
      y = sy(f.y),
      R = 8 + k * 9;
    ctx.strokeStyle = "rgba(159,224,255," + (1 - k) + ")";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const aa = (i / 6) * TAU + 0.5;
      if (i) ctx.lineTo(x + Math.cos(aa) * R, y + Math.sin(aa) * R);
      else ctx.moveTo(x + Math.cos(aa) * R, y + Math.sin(aa) * R);
    }
    ctx.stroke();
    glow(f.x, f.y, 16, "rgba(159,224,255,1)", (1 - k) * 0.6);
  };
  FXR.thorns = (f, k) => {
    const x = sx(f.x),
      y = sy(f.y),
      fd = 1 - k;
    ctx.fillStyle = "rgba(255,230,200," + fd + ")";
    for (let i = 0; i < 10; i++) {
      const aa = (i / 10) * TAU,
        r1 = 6 + k * 30,
        r2 = r1 + 8 * fd + 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(aa) * r1, y + Math.sin(aa) * r1);
      ctx.lineTo(
        x + Math.cos(aa + 0.12) * (r1 - 3),
        y + Math.sin(aa + 0.12) * (r1 - 3),
      );
      ctx.lineTo(x + Math.cos(aa) * r2, y + Math.sin(aa) * r2);
      ctx.fill();
    }
  };
  FXR.eghost = (f, k, g) => {
    const fr = EFR[f.spr],
      s = (fr && fr[0]) || S[f.spr];
    if (s) spr(s, f.x, f.y, f.sc, false, f.face < 0, 1, 0.4 * (1 - k));
  };
  FXR.blinkring = (f, k) => {
    const x = sx(f.x),
      y = sy(f.y);
    ctx.strokeStyle = "rgba(127,233,255," + (1 - k) + ")";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 4 + k * 16, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 2 + k * 9, 0, TAU);
    ctx.stroke();
    glow(f.x, f.y, 16, "rgba(127,233,255,1)", (1 - k) * 0.6);
  };
  FXR.swing = (f, k, g) => {
    const p = g.p,
      x = sx(p.x),
      y = sy(p.y - 2),
      aa = f.a0 + k * TAU * 1.3,
      L = 13;
    ctx.strokeStyle = "rgba(210,190,150," + (1 - k) + ")";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(aa) * L, y + Math.sin(aa) * L * 0.8);
    ctx.stroke();
    ctx.fillStyle = "rgba(200,205,220," + (1 - k) + ")";
    ctx.fillRect(
      x + Math.cos(aa) * L - 1,
      y + Math.sin(aa) * L * 0.8 - 1,
      3,
      3,
    );
    ctx.strokeStyle = "rgba(255,255,255," + (1 - k) * 0.3 + ")";
    ctx.beginPath();
    ctx.ellipse(x, y, L, L * 0.8, 0, aa - 1.4, aa);
    ctx.stroke();
  };
  FXR.gain = (f, k) => {
    const x = sx(f.x),
      y = sy(f.y),
      fd = 1 - k,
      c = f.col;
    ctx.strokeStyle = "rgba(" + c + "," + fd + ")";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y + 7, 6 + k * 18, 3 + k * 8, 0, 0, TAU);
    ctx.stroke();
    const gr = ctx.createLinearGradient(0, y - 60, 0, y + 8);
    gr.addColorStop(0, "rgba(" + c + ",0)");
    gr.addColorStop(1, "rgba(" + c + "," + fd * 0.45 + ")");
    ctx.fillStyle = gr;
    ctx.fillRect(x - 6 * (1 - k * 0.5), y - 60, 12 * (1 - k * 0.5), 68);
    for (let i = 0; i < 8; i++) {
      const aa = (i / 8) * TAU + k * 5,
        rr = 6 + k * 12;
      ctx.fillStyle = "rgba(255,255,255," + fd + ")";
      ctx.fillRect(
        x + Math.cos(aa) * rr,
        y + 2 - k * 24 + Math.sin(aa) * rr * 0.4,
        1,
        1,
      );
    }
    glow(f.x, f.y, 18, "rgba(" + c + ",1)", fd * 0.5);
  };
  FXR.pillar = (f, k) => {
    const x = sx(f.x),
      y = sy(f.y),
      fd = 1 - k,
      w = 10 * (1 - k * 0.6);
    const gr = ctx.createLinearGradient(0, y - 120, 0, y + 6);
    gr.addColorStop(0, "rgba(255,250,210,0)");
    gr.addColorStop(1, "rgba(255,246,200," + fd * 0.8 + ")");
    ctx.fillStyle = gr;
    ctx.fillRect(x - w / 2, y - 120, w, 126);
    ctx.fillStyle = "rgba(255,255,255," + fd + ")";
    ctx.fillRect(x - 1, y - 120, 2, 126);
    glow(f.x, f.y, 28, "rgba(255,240,170,1)", fd * 0.7);
  };
  FXR.domeFlash = (f, k) => {
    const x = sx(f.x),
      y = sy(f.y);
    if (f.gold) {
      ctx.strokeStyle = "rgba(255,210,90," + (1 - k) + ")";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 6 + k * 26, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,246,200," + (1 - k) + ")";
      ctx.beginPath();
      ctx.arc(x, y, 4 + k * 20, 0, TAU);
      ctx.stroke();
      glow(f.x, f.y, 30, "rgba(255,200,70,1)", (1 - k) * 0.6);
      return;
    }
    ctx.strokeStyle = "rgba(159,224,255," + (1 - k) + ")";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 6 + k * 26, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255," + (1 - k) + ")";
    ctx.beginPath();
    ctx.arc(x, y, 4 + k * 20, 0, TAU);
    ctx.stroke();
    glow(f.x, f.y, 30, "rgba(159,224,255,1)", (1 - k) * 0.6);
  };

  /* ---------- aura, escudos, cúpula, projéteis ---------- */
  function drawAura(g, p, id = "aura") {
    const w = g.W[id];
    if (!w) return;
    const s = w.s,
      tree = g.weaponTrees && g.weaponTrees[id],
      path = tree && tree.path,
      tier = tree && tree.tier ? 1 : 0,
      R = s.radius * (path === "sanctuary" ? (tier ? 1.55 : 1.3) : 1),
      x = sx(p.x),
      y = sy(p.y),
      t = g.t;
    if (!FXQ()) {
      ctx.fillStyle = "rgba(255,240,180,.10)";
      ctx.beginPath();
      ctx.arc(x, y, R, 0, 6.3);
      ctx.fill();
      return;
    }
    glow(
      p.x,
      p.y,
      R * 1.15,
      "rgba(255,225,140,1)",
      0.2 + 0.05 * Math.sin(t * 3),
    );
    const gr = ctx.createRadialGradient(x, y, R * 0.3, x, y, R);
    gr.addColorStop(0, "rgba(255,240,180,.03)");
    gr.addColorStop(1, "rgba(255,230,140,.16)");
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,230,140,.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.stroke();
    ctx.save();
    ctx.strokeStyle = "rgba(255,245,200,.7)";
    for (let i = 0; i < 24; i++) {
      const aa = (i / 24) * TAU + t * 0.35,
        l = i % 3 ? 2 : 4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(aa) * (R - 1), y + Math.sin(aa) * (R - 1));
      ctx.lineTo(
        x + Math.cos(aa) * (R - 1 - l),
        y + Math.sin(aa) * (R - 1 - l),
      );
      ctx.stroke();
    }
    ctx.setLineDash([2, 5]);
    ctx.lineDashOffset = t * 8;
    ctx.strokeStyle = "rgba(255,255,255,.4)";
    ctx.beginPath();
    ctx.arc(x, y, R * 0.7, 0, TAU);
    ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 5; i++) {
      const aa = (i / 5) * TAU - t * 0.7,
        sxx = x + Math.cos(aa) * R * 0.85,
        syy = y + Math.sin(aa) * R * 0.85,
        sz = 2 + Math.sin(t * 4 + i);
      ctx.fillStyle = "rgba(255,250,210,.9)";
      ctx.fillRect(sxx - sz / 2, syy, sz, 1);
      ctx.fillRect(sxx, syy - sz / 2, 1, sz);
    }
    ctx.fillStyle = "rgba(255,240,170,.9)";
    for (let i = 0; i < 10; i++) {
      const ph = (t * 0.45 + hz(i, 14)) % 1,
        aa = hz(i, 15) * TAU,
        rr = R * (0.2 + 0.75 * hz(i, 16));
      ctx.globalAlpha = Math.sin(Math.PI * ph);
      ctx.fillRect(
        x + Math.cos(aa) * rr,
        y + Math.sin(aa) * rr * 0.8 - ph * 14,
        1,
        1,
      );
    }
    ctx.globalAlpha = 1;
    if (w.pAt != null) {
      const q = (g.t - w.pAt) / 0.4;
      if (q >= 0 && q < 1) {
        ctx.strokeStyle = "rgba(255,245,190," + (1 - q) * 0.8 + ")";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, R * (0.35 + 0.65 * q), 0, TAU);
        ctx.stroke();
      }
    }
  }
  function drawShields(g, p, id = "shield") {
    const w = g.W[id];
    if (!w) return;
    const s = w.s,
      tree = g.weaponTrees && g.weaponTrees[id],
      path = tree && tree.path,
      tier = tree && tree.tier ? 1 : 0,
      count = s.count + (path === "bastion" ? (tier ? 2 : 1) : 0),
      R = s.radius + (path === "orbit" ? (tier ? 10 : 5) : 0),
      fq = FXQ();
    for (let i = 0; i < count; i++) {
      const a = w.ang + (i * TAU) / count,
        X = p.x + Math.cos(a) * R,
        Y = p.y + Math.sin(a) * R;
      if (fq) {
        ctx.save();
        for (let j = 0; j < 8; j++) {
          ctx.strokeStyle = "rgba(159,224,255," + (1 - j / 8) * 0.45 + ")";
          ctx.lineWidth = 3 * (1 - j / 10);
          ctx.beginPath();
          ctx.arc(sx(p.x), sy(p.y), R, a - (j + 1) * 0.09, a - j * 0.09);
          ctx.stroke();
        }
        ctx.restore();
        glow(
          X,
          Y,
          11,
          "rgba(120,190,255,1)",
          0.5 + 0.15 * Math.sin(g.t * 6 + i),
        );
      }
      sprRot(S.shieldI, X, Y, 0.8, a + Math.PI / 2 - Math.PI);
    }
  }
  function drawAngels(g, p, id = "angels") {
    const w = g.W[id];
    if (!w) return;
    const s = w.s,
      tree = g.weaponTrees && g.weaponTrees[id],
      path = tree && tree.path,
      tier = tree && tree.tier ? 1 : 0;
    const count = Math.min(6, s.count + (path === "host" ? (tier ? 2 : 1) : 0));
    const R = s.radius + (path === "guard" ? (tier ? 4 : 2) : 0),
      fq = FXQ(),
      t = g.t;
    for (let i = 0; i < count; i++) {
      const a = w.ang + (i * TAU) / count,
        X = p.x + Math.cos(a) * R,
        Y = p.y + Math.sin(a) * R;
      const sx0 = sx(X),
        sy0 = sy(Y),
        bob = Math.sin(t * 5 + i) * 1.2;
      if (fq) {
        glow(
          X,
          Y + bob,
          12,
          "rgba(255,240,170,1)",
          0.4 + 0.12 * Math.sin(t * 4 + i),
        );
        ctx.save();
        ctx.strokeStyle =
          "rgba(255,230,150," + (0.25 + 0.15 * Math.sin(t * 3 + i)) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx(p.x), sy(p.y), R, a - 0.12, a + 0.02);
        ctx.stroke();
        ctx.restore();
      }
      /* pixel angel: body + wings + halo */
      ctx.save();
      ctx.translate(sx0, sy0 + bob);
      const face = Math.cos(a) < 0 ? -1 : 1;
      ctx.scale(face, 1);
      /* wings */
      ctx.fillStyle = "rgba(255,250,230,.95)";
      ctx.fillRect(-7, -2, 3, 5);
      ctx.fillRect(-8, 0, 2, 3);
      ctx.fillRect(4, -2, 3, 5);
      ctx.fillRect(6, 0, 2, 3);
      /* robe */
      ctx.fillStyle = "#f0e6c0";
      ctx.fillRect(-2, -1, 4, 7);
      /* head */
      ctx.fillStyle = "#ffe8b0";
      ctx.fillRect(-1, -5, 3, 3);
      /* halo */
      ctx.strokeStyle = "#f2c14e";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0.5, -6.5, 2.5, 0, TAU);
      ctx.stroke();
      /* sparkle */
      if (fq) {
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 8 + i);
        ctx.fillRect(3, -7, 1, 1);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }
  function drawDome(g, p) {
    const sh = p.sh,
      x = sx(p.x),
      y = sy(p.y),
      t = g.t,
      low = sh < 1.5,
      al = low ? 0.4 + 0.4 * Math.sin(t * 20) : 0.85;
    if (!FXQ()) {
      ctx.strokeStyle = "rgba(159,224,255," + al + ")";
      ctx.fillStyle = "rgba(159,224,255,.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, 6.3);
      ctx.fill();
      ctx.stroke();
      return;
    }
    const gr = ctx.createRadialGradient(x, y - 2, 3, x, y, 15);
    gr.addColorStop(0, "rgba(159,224,255,.04)");
    gr.addColorStop(1, "rgba(159,224,255," + 0.32 * al + ")");
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(190,235,255," + al + ")";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255," + al * 0.6 + ")";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const aa = (i / 6) * TAU + t * 1.2;
      if (i) ctx.lineTo(x + Math.cos(aa) * 10, y + Math.sin(aa) * 10);
      else ctx.moveTo(x + Math.cos(aa) * 10, y + Math.sin(aa) * 10);
    }
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const aa = (i / 4) * TAU - t * 1.6;
      ctx.fillStyle = "rgba(255,255,255," + al + ")";
      ctx.fillRect(x + Math.cos(aa) * 15 - 1, y + Math.sin(aa) * 15 - 1, 2, 2);
    }
    glow(p.x, p.y, 20, "rgba(159,224,255,1)", 0.22 * al);
  }
  function drawShots(g) {
    for (const s of g.shots) {
      if (s.k === "covenant_arrow") {
        const x = sx(s.x),
          y = sy(s.y),
          a = Math.atan2(s.vy, s.vx);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        if (s.signal) {
          ctx.fillStyle = "rgba(255,230,145,.7)";
          ctx.fillRect(-10, -2, 18, 4);
        }
        ctx.fillStyle = s.signal ? "#fff1b5" : "#f0d7a2";
        ctx.fillRect(-6, -1, 12, 2);
        ctx.fillStyle = s.signal ? "#f2c14e" : "#80502e";
        ctx.fillRect(-7, 0, 9, 1);
        ctx.fillStyle = "#fff";
        ctx.fillRect(4, -1, 3, 1);
        ctx.fillRect(4, 0, 3, 1);
        ctx.fillStyle = "#8b452a";
        ctx.fillRect(-7, -2, 2, 1);
        ctx.fillRect(-7, 1, 2, 1);
        ctx.restore();
        if (s.signal) glow(s.x, s.y, 10, "rgba(255,220,125,1)", 0.7);
      } else if (s.k === "stone") {
        const tr = s.tr || [];
        if (FXQ() && tr.length > 1) {
          ctx.save();
          for (let i = 1; i < tr.length; i++) {
            ctx.strokeStyle =
              "rgba(220,225,240," + (i / tr.length) * 0.55 + ")";
            ctx.lineWidth = 1 + i / tr.length;
            ctx.beginPath();
            ctx.moveTo(sx(tr[i - 1].x), sy(tr[i - 1].y));
            ctx.lineTo(sx(tr[i].x), sy(tr[i].y));
            ctx.stroke();
          }
          ctx.restore();
        }
        if (S.stone) spr(S.stone, s.x, s.y, 1);
        else {
          ctx.save();
          ctx.translate(sx(s.x), sy(s.y));
          ctx.rotate(s.spin || 0);
          ctx.fillStyle = "#23232f";
          ctx.fillRect(-3, -3, 6, 6);
          ctx.fillStyle = "#9ea3b8";
          ctx.fillRect(-2, -2, 4, 4);
          ctx.fillStyle = "#e8ecf8";
          ctx.fillRect(-2, -2, 2, 2);
          ctx.restore();
        }
        if (s.treePath === "impact" || s.treePath === "aim")
          glow(
            s.x,
            s.y,
            7,
            s.treePath === "aim" ? "rgba(160,220,255,1)" : "rgba(255,150,60,1)",
            0.5,
          );
      } else if (s.k === "sword") {
        const tr = s.tr || [];
        if (FXQ() && tr.length > 1) {
          ctx.save();
          for (let i = 1; i < tr.length; i++) {
            ctx.strokeStyle =
              (s.ghost ? "rgba(170,210,255," : "rgba(255,238,170,") +
              (i / tr.length) * 0.55 +
              ")";
            ctx.lineWidth = 1 + (i / tr.length) * 1.5;
            ctx.beginPath();
            ctx.moveTo(sx(tr[i - 1].x), sy(tr[i - 1].y));
            ctx.lineTo(sx(tr[i].x), sy(tr[i].y));
            ctx.stroke();
          }
          ctx.restore();
        }
        glow(
          s.x,
          s.y,
          s.ev ? 13 : 9,
          s.ghost ? "rgba(150,200,255,1)" : "rgba(255,230,150,1)",
          s.ghost ? 0.35 : 0.45,
        );
        ctx.save();
        ctx.translate(Math.round(sx(s.x)), Math.round(sy(s.y)));
        ctx.rotate(s.ang || 0);
        if (s.ghost) ctx.globalAlpha = 0.7;
        ctx.fillStyle = s.ghost ? "#8fb4e6" : s.ev ? "#ffe27a" : "#aeb6c8";
        ctx.fillRect(-2, -1, 10, 3);
        ctx.fillStyle = s.ghost ? "#dcecff" : s.ev ? "#fff7d0" : "#f4f7ff";
        ctx.fillRect(-2, -1, 10, 1);
        ctx.fillRect(8, 0, 2, 1);
        ctx.fillStyle = s.ghost ? "#bcd6f6" : "#f2c14e";
        ctx.fillRect(-4, -3, 2, 7);
        ctx.fillStyle = "#7a4a22";
        ctx.fillRect(-8, -1, 4, 3);
        ctx.fillStyle = s.ghost ? "#dcecff" : "#f2c14e";
        ctx.fillRect(-9, -1, 1, 3);
        ctx.restore();
      } else {
        const tr = s.tr || [],
          fq = FXQ();
        if (fq && tr.length > 1) {
          ctx.save();
          for (let i = 1; i < tr.length; i++) {
            ctx.strokeStyle = "rgba(255,255,255," + (i / tr.length) * 0.5 + ")";
            ctx.lineWidth = 1 + (i / tr.length) * 2;
            ctx.beginPath();
            ctx.moveTo(sx(tr[i - 1].x), sy(tr[i - 1].y));
            ctx.lineTo(sx(tr[i].x), sy(tr[i].y));
            ctx.stroke();
          }
          ctx.restore();
        }
        glow(s.x, s.y, 10, "rgba(255,245,200,1)", 0.45);
        const ang = Math.atan2(s.vy, Math.abs(s.vx)) * 0.7;
        sprRot(
          S.dove[Math.floor(g.t * 14) % 2],
          s.x,
          s.y,
          1,
          s.vx < 0 ? -ang : ang,
          s.vx < 0,
        );
      }
    }
  }
  FXR.pulse = (f, k) => {
    ctx.strokeStyle = "rgba(255,240,170," + (1 - k) + ")";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sx(f.x), sy(f.y), 4 + k * 22, 0, TAU);
    ctx.stroke();
    glow(f.x, f.y, 6 + k * 22, "rgba(255,200,100,1)", (1 - k) * 0.35);
  };
  FXR.signalZone = (f, k) => {
    const x = sx(f.x),
      y = sy(f.y),
      pulse = 0.65 + 0.35 * Math.sin(f.t * 7);
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - k * 0.65);
    ctx.fillStyle = "rgba(255,220,130,.12)";
    ctx.beginPath();
    ctx.arc(x, y, f.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,230,160," + 0.65 * pulse + ")";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, f.r * (0.94 + 0.04 * Math.sin(f.t * 4)), 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,245,200,.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, f.r * 0.72, 0, TAU);
    ctx.stroke();
    ctx.restore();
    glow(f.x, f.y, f.r * 0.75, "rgba(255,220,130,1)", 0.16 * pulse);
  };
  /* ================= v0.40: sprites e animações dos heróis (parado, caminhada, ação) ================= */
  const HERO_ART = FE_CONTENT.heroArt,
    HFR = {};
  function buildHeroArt() {
    for (const k in HERO_ART) {
      if (!S.hero[k]) continue;
      const A = HERO_ART[k],
        b = (r) => buildSprite(r, A.pal),
        idle = A.idle.map(b);
      if (A.v2) {
        /* arte completa no padrão dos demais heróis: parado 6, andando 8, ataque 4, dano 1, investida 2 */
        const L = (l) => l.map(b),
          walk = L(A.walk),
          act = L(A.act);
        HFR[k] = {
          idle,
          walk,
          act: act[1],
          actF: act,
          hurt: b(A.hurt),
          dash: L(A.dash),
          base0: idle[0],
          v2: true,
        };
        S.hero[k][0] = idle[0];
        S.hero[k][1] = walk[0];
        continue;
      }
      HFR[k] = {
        idle,
        walk: A.walk.map(b),
        act: b(A.act),
        attack: A.attack ? A.attack.map(b) : null,
        attackDuration: 0.56,
        base0: idle[0],
      };
      S.hero[k][0] = idle[0];
      S.hero[k][1] = HFR[k].walk[0];
      if (A2 && A2.hero && A2.hero[k]) a2Hero(k);
    }
    if (A2 && A2.hero)
      for (const k in A2.hero)
        if (!HFR[k] && S.hero[k]) a2Hero(k);
  }

  /* ================= Tela final: sprite do herói feliz (vitória) ou triste (derrota) =================
     Reaproveita os quadros que o herói já tem (parado, ferido, braço erguido) e acrescenta o sentimento por código:
     feliz = pula com o braço erguido, brilho dourado, faíscas e confete; triste = quadro de dor, cabeça baixa, nuvem de chuva e lágrimas. */
  let endHeroRAF = 0;
  function endHeroFrames(k) {
    const H = HFR[k],
      sh = S.hero && S.hero[k];
    if (H && sh && sh[0] === H.base0) {
      const idle = H.idle[0];
      return {
        idle,
        up: (H.v2 && H.actF && H.actF[1]) || H.act || idle,
        sad: H.hurt || idle,
      };
    }
    if (sh && sh[0]) return { idle: sh[0], up: sh[1] || sh[0], sad: sh[0] };
    return null;
  }
  function endHeroStart(happy) {
    const host = document.querySelector("#end .end-r");
    if (!host) return;
    cancelAnimationFrame(endHeroRAF);
    endHeroRAF = 0;
    let box = document.getElementById("endHero");
    const fr = G && endHeroFrames(G.hk);
    if (!fr) {
      if (box) box.hidden = true;
      return;
    }
    if (!document.getElementById("endHeroCss")) {
      const st = document.createElement("style");
      st.id = "endHeroCss";
      st.textContent =
        "#endHero{display:flex;justify-content:center;align-items:flex-end;margin:0 auto 10px}" +
        "#endHero canvas{width:min(168px,30vh);height:auto;aspect-ratio:1/1;image-rendering:pixelated;image-rendering:crisp-edges}";
      document.head.appendChild(st);
    }
    if (!box) {
      box = document.createElement("div");
      box.id = "endHero";
      box.appendChild(document.createElement("canvas"));
      host.insertBefore(box, host.firstChild);
    }
    box.hidden = false;
    const cv2 = box.querySelector("canvas");
    const maxDim = Math.max(
      fr.idle.w, fr.idle.h, fr.up.w, fr.up.h, fr.sad.w, fr.sad.h,
    );
    const L = Math.max(72, Math.ceil((maxDim * 2.2) / 4) * 4),
      u = L / 72;
    cv2.width = L;
    cv2.height = L;
    const g = cv2.getContext("2d");
    const fx = FXQ();
    const hs = (n) => {
      const v = Math.sin(n * 12.9898 + 4.1414) * 43758.5453;
      return v - Math.floor(v);
    };
    const WARM = ["255,214,80", "255,120,25", "255,248,225", "230,40,25", "255,190,60"];
    const t0 = performance.now();
    let lastT = -1;
    const render = (t) => {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, L, L);
      g.imageSmoothingEnabled = false;
      /* pose */
      let s = fr.idle,
        hop = 0,
        sy = 1;
      if (happy) {
        const ph = (t * 2.1) % 1;
        hop = Math.abs(Math.sin(ph * Math.PI)) * 8;
        s = hop > 2.2 ? fr.up : fr.idle;
        if (hop < 0.5) sy = 0.94;
      } else {
        s = fr.sad;
        sy = 0.96;
      }
      const sway = happy ? 0 : Math.sin(t * 1.6) * 0.6;
      /* fundo: brilho dourado (feliz) ou azul frio (triste) + sombra */
      g.save();
      g.scale(u, u);
      const gl = g.createRadialGradient(36, 40, 2, 36, 40, 34);
      if (happy) {
        const a = 0.3 + 0.08 * Math.sin(t * 4);
        gl.addColorStop(0, "rgba(255,205,90," + a.toFixed(3) + ")");
        gl.addColorStop(1, "rgba(255,160,40,0)");
      } else {
        gl.addColorStop(0, "rgba(80,100,170,.30)");
        gl.addColorStop(1, "rgba(40,50,110,0)");
      }
      g.fillStyle = gl;
      g.fillRect(0, 0, 72, 72);
      g.fillStyle = "rgba(0,0,0," + (0.35 - hop * 0.02).toFixed(3) + ")";
      g.beginPath();
      g.ellipse(36, 67, 11 - hop * 0.4, 2.2, 0, 0, 6.2832);
      g.fill();
      g.restore();
      /* herói */
      const dw = s.w,
        dh = s.h * sy,
        hx = Math.round(L / 2 - dw / 2 + sway * u),
        hy = Math.round(L * 0.915 - dh - hop * u);
      if (!happy)
        try {
          g.filter = "grayscale(.5) brightness(.85)";
        } catch (e) { }
      g.drawImage(s.c, hx, hy, dw, dh);
      try {
        g.filter = "none";
      } catch (e) { }
      if (!fx) return;
      const top = hy / u,
        mid = top + dh / (2 * u);
      g.save();
      g.scale(u, u);
      if (happy) {
        /* faíscas que explodem do herói */
        for (let j = 0; j < 14; j++) {
          const sd = j * 3.7;
          const ph = (t * (0.35 + hs(sd) * 0.5) + hs(sd + 1)) % 1;
          const ang = hs(sd + 2) * 6.2832;
          const rad = 12 + ph * 26 * (0.6 + hs(sd + 3) * 0.6);
          const px = 36 + Math.cos(ang) * rad,
            py = mid - Math.abs(Math.sin(ang)) * rad * 0.9 - ph * 8;
          g.fillStyle =
            "rgba(" + WARM[Math.floor(hs(sd + 4) * WARM.length)] + "," + (1 - ph).toFixed(3) + ")";
          const z = ph < 0.35 && hs(sd + 5) > 0.5 ? 2 : 1;
          g.fillRect(Math.round(px), Math.round(py), z, z);
        }
        /* estrelinhas piscando */
        [[14, 20], [58, 16], [10, 44], [62, 40], [36, 8]].forEach((p, i) => {
          const k2 = Math.max(0, Math.sin(t * 3 + i * 1.7));
          if (k2 < 0.15) return;
          const r = k2 > 0.7 ? 2 : 1;
          g.fillStyle = i % 2 ? "rgba(255,248,225,.95)" : "rgba(255,214,80,.95)";
          g.fillRect(p[0], p[1], 1, 1);
          g.fillRect(p[0] - r, p[1], r, 1);
          g.fillRect(p[0] + 1, p[1], r, 1);
          g.fillRect(p[0], p[1] - r, 1, r);
          g.fillRect(p[0], p[1] + 1, 1, r);
        });
        /* confete caindo */
        for (let j = 0; j < 10; j++) {
          const sd = j * 5.3 + 50;
          const x = hs(sd) * 72 + Math.sin(t * 2 + sd) * 3,
            y = ((t * (14 + hs(sd + 1) * 12) + hs(sd + 2) * 72) % 80) - 4;
          g.fillStyle = "rgba(" + WARM[j % WARM.length] + ",.9)";
          g.fillRect(Math.round(x), Math.round(y), 2, 1);
        }
      } else {
        /* nuvem de chuva sobre a cabeça */
        const cx = 36,
          cy = Math.max(5, top - 10) + Math.sin(t * 1.4) * 0.7;
        g.fillStyle = "#3f4863";
        g.fillRect(cx - 9, cy + 4, 18, 2);
        g.fillStyle = "#5b6682";
        g.fillRect(cx - 11, cy + 2, 22, 3);
        g.fillRect(cx - 6, cy - 1, 10, 4);
        g.fillRect(cx + 1, cy - 2, 7, 4);
        g.fillStyle = "#7a86a6";
        g.fillRect(cx - 5, cy - 1, 6, 1);
        g.fillRect(cx + 2, cy - 2, 4, 1);
        /* chuva */
        for (let j = 0; j < 8; j++) {
          const sd = j * 2.9 + 9;
          const x = cx - 9 + j * 2.6,
            ph = (t * (0.9 + hs(sd) * 0.3) + hs(sd + 1)) % 1,
            y = cy + 7 + ph * (66 - (cy + 7));
          g.fillStyle = "rgba(150,190,255," + (0.9 - ph * 0.5).toFixed(3) + ")";
          g.fillRect(Math.round(x), Math.round(y), 1, 2);
        }
        /* lágrimas escorrendo do rosto */
        for (let e = -1; e <= 1; e += 2) {
          const ph = (t * 0.65 + (e > 0 ? 0.5 : 0)) % 1;
          g.fillStyle = "rgba(190,225,255," + (1 - ph * 0.6).toFixed(3) + ")";
          g.fillRect(Math.round(36 + e * 3), Math.round(top + dh / u * 0.3 + ph * 7), 1, 2);
        }
      }
      g.restore();
    };
    render(0);
    const tick = () => {
      const endEl = document.getElementById("end");
      if (!endEl || endEl.hidden || !box.isConnected) {
        endHeroRAF = 0;
        return;
      }
      const t = (performance.now() - t0) / 1000;
      if (t - lastT >= 1 / 30) {
        lastT = t;
        render(t);
      }
      endHeroRAF = requestAnimationFrame(tick);
    };
    endHeroRAF = requestAnimationFrame(tick);
  }
  function heroActing(g) {
    for (const f of g.fx) {
      if (
        f.t < 0.2 &&
        (f.k === "slash" ||
          f.k === "swing" ||
          f.k === "pillar" ||
          (f.k === "ring" && f.follow))
      )
        return true;
      if (
        (f.k === "bolt" || f.k === "flame") &&
        f.t < 0.25 &&
        f.t < f.delay + 0.1
      )
        return true;
    }
    for (const s of g.shots)
      if (
        s.tr &&
        s.tr.length < 3 &&
        (g.hk !== "jonathan" || s.k === "covenant_arrow")
      )
        return true;
    return false;
  }
  /* ---------- O Sol Parou: herói dourado (estilo Zhonya) ---------- */
  const GOLD_SPR = new Map();
  function goldSprite(s) {
    if (!s || !s.c) return s;
    let r = GOLD_SPR.get(s.c);
    if (r) return r;
    const c = mk(s.w, s.h, (x) => {
      x.drawImage(s.c, 0, 0);
      x.globalCompositeOperation = "color";
      x.fillStyle = "#f0b830";
      x.fillRect(0, 0, s.w, s.h);
      x.globalCompositeOperation = "overlay";
      x.fillStyle = "rgba(255,230,120,.4)";
      x.fillRect(0, 0, s.w, s.h);
      x.globalCompositeOperation = "destination-in";
      x.drawImage(s.c, 0, 0);
    });
    r = { c, f: s.f, w: s.w, h: s.h };
    GOLD_SPR.set(s.c, r);
    return r;
  }
  function drawGoldGlint(g, p, bob) {
    if (!FXQ()) return;
    const pulse = 0.5 + 0.5 * Math.sin(g.t * 6);
    glow(p.x, p.y + bob - 2, 24, "rgba(255,210,90,1)", 0.35 + 0.2 * pulse);
    const ph = (g.t * 1.4) % 1;
    ctx.save();
    ctx.globalAlpha = (1 - ph) * 0.8;
    ctx.fillStyle = "#fff6c8";
    const gx = sx(p.x) - 6 + ph * 12,
      gy = sy(p.y + bob) - 12 + ph * 6;
    ctx.fillRect(gx - 1, gy, 3, 1);
    ctx.fillRect(gx, gy - 1, 1, 3);
    ctx.restore();
  }

  /* ---------- Mãos Treinadas: aura de fogo / frenesi ---------- */
  function drawFrenzy(g, p, bob) {
    const on = p.atkBuffT > 0 ? 1 : 0;
    g._fzK = (g._fzK || 0) + (on - (g._fzK || 0)) * 0.12;
    const k = g._fzK;
    if (k < 0.02) return;
    const bx = sx(p.x),
      by = sy(p.y + (bob || 0)) + 9,
      t = g.t;
    glow(p.x, p.y - 4, 34, "rgba(255,90,20,1)", 0.55 * k);
    glow(p.x, p.y - 8, 20, "rgba(255,200,60,1)", 0.4 * k);
    const layers = [
      { col: "rgba(200,30,10,A)", n: 7, h: 34, w: 5.5 },
      { col: "rgba(255,110,20,A)", n: 6, h: 27, w: 4.5 },
      { col: "rgba(255,225,90,A)", n: 5, h: 19, w: 3.2 },
    ];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    layers.forEach((L, li) => {
      ctx.fillStyle = L.col.replace("A", (0.75 * k).toFixed(2));
      for (let i = 0; i < L.n; i++) {
        const u = L.n === 1 ? 0 : i / (L.n - 1) - 0.5,
          ph = t * (7 + li * 1.5) + i * 1.9 + li,
          fl = 0.75 + 0.25 * Math.sin(ph),
          hh = L.h * k * fl * (1 - Math.abs(u) * 0.7),
          ww = L.w * (1 + 0.2 * Math.sin(ph * 1.3)),
          x0 = bx + u * 22,
          sway = Math.sin(ph * 0.9) * 3;
        ctx.beginPath();
        ctx.moveTo(x0 - ww, by);
        ctx.quadraticCurveTo(x0 - ww * 0.4 + sway * 0.5, by - hh * 0.55, x0 + sway, by - hh);
        ctx.quadraticCurveTo(x0 + ww * 0.4 + sway * 0.5, by - hh * 0.55, x0 + ww, by);
        ctx.closePath();
        ctx.fill();
      }
    });
    if (FXQ()) {
      ctx.fillStyle = "rgba(255,200,80," + (0.9 * k).toFixed(2) + ")";
      for (let i = 0; i < 6; i++) {
        const q = (t * 0.9 + i / 6) % 1,
          x = bx + Math.sin(i * 7.3 + t * 2) * 12,
          y = by - 4 - q * 40;
        ctx.globalAlpha = (1 - q) * k;
        ctx.fillRect(Math.round(x), Math.round(y), 1.5, 1.5);
      }
    }
    ctx.restore();
  }

  function heroSpr(g, p) {
    const H = HFR[g.hk];
    if (!H || S.hero[g.hk][0] !== H.base0) return null;
    if (heroActing(g)) {
      if (g.hAct == null || g.t - g.hAct > 0.3) g.hActS = g.t;
      g.hAct = g.t;
    }
    if (H.attack && H.attack.length) {
      const attackAge = g.t - (g.hAct == null ? -9 : g.hAct);
      if (attackAge >= 0 && attackAge < H.attackDuration)
        return H.attack[
          Math.min(
            H.attack.length - 1,
            Math.floor((attackAge / H.attackDuration) * H.attack.length),
          )
        ];
      if (p.moving) return H.walk[Math.floor(p.walk * 13) % H.walk.length];
      return H.idle[Math.floor(g.t * 2.2) % H.idle.length];
    }
    if (H.v2) {
      if (g.hHurt != null && g.t - g.hHurt < 0.2) return H.hurt;
      if (p.dash) return H.dash[p.dash.t > 0.08 ? 0 : 1];
      if (g.hAct != null && g.t - g.hAct < 0.24) {
        const q = g.t - (g.hActS || 0);
        return H.actF[
          q < 0.28
            ? Math.min(3, Math.floor(q / 0.07))
            : 1 + (Math.floor(g.t * 9) & 1)
        ];
      }
      if (p.moving) return H.walk[Math.floor(p.walk * 16) % 8];
      return H.idle[Math.floor(g.t * 5) % 6];
    }
    if (g.t - (g.hAct == null ? -9 : g.hAct) < 0.24) return H.act;
    if (p.moving) return H.walk[Math.floor(p.walk * 13) % 4];
    return H.idle[Math.floor(g.t * 2.2) % 2];
  }
  function heroExtra(g, p) {
    const H = HFR[g.hk];
    if (!FXQ() || !H || S.hero[g.hk][0] !== H.base0) return;
    const dir = p.face < 0 ? -1 : 1,
      t = g.t,
      acting = t - (g.hAct == null ? -9 : g.hAct) < 0.24;
    if (g.hk === "elias") {
      const x = p.x + dir * 5.5,
        y =
          p.y -
          8 +
          (p.moving
            ? -Math.abs(Math.sin((Math.PI * (p.walk * 13 - 0.5)) / 2)) * 1.5
            : 0);
      glow(
        x,
        y,
        acting ? 11 : 7,
        "rgba(255,150,40,1)",
        0.45 + 0.2 * Math.sin(t * 19) + (acting ? 0.25 : 0),
      );
      ctx.fillStyle = "rgba(255,240,150,.9)";
      ctx.fillRect(
        sx(x) - 1 + Math.round(Math.sin(t * 23)),
        sy(y) - 2 - (Math.sin(t * 17) > 0 ? 1 : 0),
        1,
        1,
      );
    } else if (g.hk === "ester") {
      const ph = t % 3.4;
      if (ph < 0.35) {
        const q = Math.sin((ph / 0.35) * Math.PI),
          x = sx(p.x - 1.5 * dir),
          y = sy(p.y - 9),
          r = 1 + 3 * q;
        ctx.fillStyle = "rgba(255,255,230," + q + ")";
        ctx.fillRect(x - r, y, 2 * r + 1, 1);
        ctx.fillRect(x, y - r, 1, 2 * r + 1);
      }
      if (acting) glow(p.x + dir * 6, p.y - 5, 10, "rgba(210,140,255,1)", 0.6);
    } else if (g.hk === "debora" && acting)
      glow(p.x, p.y - 3, 17, "rgba(255,225,140,1)", 0.55);
    else if (g.hk === "paulo" && acting)
      glow(p.x + dir * 6, p.y - 9, 8, "rgba(235,245,255,1)", 0.6);
    else if (g.hk === "davi" && acting)
      glow(p.x + dir * 3, p.y - 9, 7, "rgba(255,245,200,1)", 0.35);
    else if (g.hk === "sansao" && acting)
      glow(p.x + dir * 6, p.y - 7, 9, "rgba(255,200,120,1)", 0.45);
    else if (g.hk === "mendigo" && acting)
      glow(p.x + dir * 5, p.y - 6, 8, "rgba(255,240,190,1)", 0.4);
  }
  let hMenuT = 0;
  setInterval(() => {
    hMenuT++;
    document.querySelectorAll("canvas[data-hero]").forEach((c) => {
      /* ignora silhuetas bloqueadas (sem data-hero ou com data-locked) */
      if (
        c.dataset.locked === "1" ||
        c.closest(".hero.locked, .hero-portrait-wrap.is-locked")
      )
        return;
      const k = c.dataset.hero,
        H = HFR[k];
      if (!H || !S.hero[k] || S.hero[k][0] !== H.base0) return;
      const sp =
        hMenuT % 6 === 5
          ? H.act
          : H.idle[H.v2 ? hMenuT % H.idle.length : hMenuT & 1],
        x = c.getContext("2d");
      x.clearRect(0, 0, c.width, c.height);
      x.drawImage(
        sp.c,
        Math.round((c.width - sp.w) / 2),
        Math.round((c.height - sp.h) / 2),
      );
    });
  }, 450);
  /* ================= v0.49: pacote de conteúdo =================
     5 armas novas (Cajado de Moisés, Machado de Eliseu, Jarros de Gideão, Rede de Pedro, Menorá),
     Evoluções Supremas (arma Nv 6 + dom Nv 3, reveladas pela Arca) e heróis com Poder Heroico próprio.
     Tudo o que é novo usa o prefixo nx/NX para não colidir com o restante do arquivo. */
  const NXV = { domLv: 3, evoChance: 0.35 };
  const NX_SND = {
    sea() {
      SFX.tone(110, 0.4, "sawtooth", 0.045, -40);
      SFX.tone(330, 0.3, "triangle", 0.02, -120, 0.04);
    },
    axe() {
      SFX.tone(420, 0.08, "square", 0.02, -150);
    },
    jar() {
      SFX.tone(700, 0.05, "square", 0.03, -300);
      SFX.tone(200, 0.15, "sawtooth", 0.03, -120, 0.04);
    },
    net() {
      SFX.tone(240, 0.2, "triangle", 0.03, 160);
    },
    sword() {
      SFX.tone(720, 0.09, "triangle", 0.03, -380);
      SFX.tone(1180, 0.05, "square", 0.012, -500, 0.02);
    },
    raven() {
      SFX.tone(300, 0.1, "sawtooth", 0.025, -140);
      SFX.tone(210, 0.13, "square", 0.012, -90, 0.06);
    },
    fwall() {
      SFX.tone(170, 0.4, "sawtooth", 0.04, 180);
      SFX.tone(440, 0.22, "triangle", 0.02, -90, 0.05);
    },
    jericho() {
      SFX.tone(130, 0.5, "sawtooth", 0.05, 90);
      SFX.tone(260, 0.4, "square", 0.025, 120, 0.05);
      SFX.tone(520, 0.3, "triangle", 0.02, -200, 0.1);
    },
    evo() {
      [392, 523, 659, 784, 1046].forEach((f, i) =>
        SFX.tone(f, 0.2, "square", 0.04, 0, i * 0.07),
      );
    },
    decree() {
      SFX.tone(196, 0.4, "sawtooth", 0.05, 60);
      SFX.tone(392, 0.35, "triangle", 0.04, 0, 0.08);
    },
    rage() {
      SFX.tone(70, 0.5, "sawtooth", 0.07, -20);
      SFX.tone(140, 0.4, "square", 0.04, -60, 0.05);
    },
    bolt() {
      SFX.tone(980, 0.07, "triangle", 0.02, -300);
    },
  };
  function nxS(n) {
    try {
      if (!SFX.ctx || !SFX.on) return;
      const now = performance.now(),
        key = "nx" + n;
      if (SFX.last[key] && now - SFX.last[key] < 110) return;
      SFX.last[key] = now;
      NX_SND[n] && NX_SND[n]();
    } catch (e) { }
  }
  const nxTree = (id) => {
    const t = G && G.weaponTrees && G.weaponTrees[id];
    return t ? { p: t.path, t: t.tier ? 1 : 0 } : { p: null, t: 0 };
  };
  const nxHas = (id) => !!(G && G.evo && G.evo[id]);
  const nxRect = (g, c, x, y, w, h) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  };

  /* ---------- dados das armas ---------- */

  Object.assign(LBL2, {
    wall: "Largura",
    dist: "Distância",
    reach: "Alcance",
    hold: "Prisão (s)",
    dur: "Duração (s)",
    beams: "Orbes de luz",
    waves: "Anéis",
    bread: "Pão (Salvação)",
  });

  /* ---------- ícones ---------- */
  ICON_DRAW.staff = (g) => {
    g.lineCap = "round";
    g.strokeStyle = "#5a3a1a";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(5, 22);
    g.lineTo(15, 6);
    g.stroke();
    g.strokeStyle = "#c9923a";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(4.5, 21.5);
    g.lineTo(14.5, 5.5);
    g.stroke();
    g.strokeStyle = "#5a3a1a";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(17.5, 6, 3.2, Math.PI * 0.85, Math.PI * 2.15);
    g.stroke();
    nxRect(g, "#5fb0f0", 15, 14, 8, 2);
    nxRect(g, "#9fdcff", 16, 13, 4, 1);
    nxRect(g, "#5fb0f0", 17, 18, 6, 2);
    nxRect(g, "#9fdcff", 18, 17, 3, 1);
    nxRect(g, "#3a86c8", 14, 21, 9, 1);
  };
  ICON_DRAW.axe = (g) => {
    g.lineCap = "round";
    g.strokeStyle = "#6b4423";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(5, 21);
    g.lineTo(16, 7);
    g.stroke();
    g.fillStyle = "#b9c2d4";
    g.beginPath();
    g.moveTo(13, 4);
    g.lineTo(21, 7);
    g.lineTo(21, 14);
    g.lineTo(16, 12);
    g.lineTo(11, 11);
    g.closePath();
    g.fill();
    g.fillStyle = "#eef3ff";
    g.beginPath();
    g.moveTo(14, 5);
    g.lineTo(20, 8);
    g.lineTo(20, 10);
    g.lineTo(14, 8);
    g.closePath();
    g.fill();
    g.strokeStyle = "#4a5468";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(21, 7);
    g.lineTo(21, 14);
    g.stroke();
  };
  ICON_DRAW.jars = (g) => {
    nxRect(g, "#7a3f1d", 6, 10, 12, 10);
    nxRect(g, "#9a5a2a", 7, 9, 10, 2);
    nxRect(g, "#7a3f1d", 8, 7, 8, 3);
    nxRect(g, "#b5733a", 8, 11, 2, 8);
    nxRect(g, "#4a2410", 6, 19, 12, 2);
    nxRect(g, "#4a2410", 8, 21, 8, 1);
    nxRect(g, "#ff9a2a", 10, 2, 4, 5);
    nxRect(g, "#ffe27a", 11, 3, 2, 3);
    nxRect(g, "#ffd24a", 11, 1, 2, 2);
  };
  ICON_DRAW.firewall = (g) => {
    g.lineWidth = 3;
    g.strokeStyle = "#a4210f";
    g.beginPath();
    g.arc(12, 12, 8.5, 0, 6.3);
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = "#ff6a1a";
    g.beginPath();
    g.arc(12, 12, 8.5, 0, 6.3);
    g.stroke();
    g.lineWidth = 1;
    g.strokeStyle = "#ffe27a";
    g.beginPath();
    g.arc(12, 12, 8, 0, 6.3);
    g.stroke();
    nxRect(g, "#ffb43a", 11, 1, 2, 3);
    nxRect(g, "#fff3b0", 11, 0, 2, 2);
    nxRect(g, "#ffb43a", 11, 20, 2, 3);
    nxRect(g, "#ffb43a", 1, 11, 3, 2);
    nxRect(g, "#ffb43a", 20, 11, 3, 2);
    nxRect(g, "#ff6a1a", 18, 4, 2, 2);
    nxRect(g, "#ff6a1a", 4, 4, 2, 2);
    nxRect(g, "#ff6a1a", 18, 18, 2, 2);
    nxRect(g, "#ff6a1a", 4, 18, 2, 2);
    nxRect(g, "#ff9a2a", 10, 9, 4, 6);
    nxRect(g, "#ffe27a", 11, 10, 2, 4);
  };
  ICON_DRAW.net = (g) => {
    g.strokeStyle = "#e9dcc0";
    g.lineWidth = 1;
    g.beginPath();
    g.arc(12, 12, 9, 0, 6.3);
    g.stroke();
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(12 + i * 4, 4);
      g.lineTo(12 + i * 4, 20);
      g.stroke();
      g.beginPath();
      g.moveTo(4, 12 + i * 4);
      g.lineTo(20, 12 + i * 4);
      g.stroke();
    }
    nxRect(g, "#f2c14e", 2, 11, 3, 3);
    nxRect(g, "#f2c14e", 19, 11, 3, 3);
    nxRect(g, "#f2c14e", 11, 2, 3, 3);
    nxRect(g, "#f2c14e", 11, 19, 3, 3);
  };
  ICON_DRAW.menorah = (g) => {
    nxRect(g, "#f2c14e", 11, 8, 2, 13);
    nxRect(g, "#f2c14e", 7, 20, 10, 2);
    nxRect(g, "#c9923a", 9, 18, 6, 2);
    g.strokeStyle = "#f2c14e";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(4, 8);
    g.lineTo(4, 12);
    g.quadraticCurveTo(4, 17, 12, 17);
    g.quadraticCurveTo(20, 17, 20, 12);
    g.lineTo(20, 8);
    g.stroke();
    g.beginPath();
    g.moveTo(8, 8);
    g.lineTo(8, 12);
    g.quadraticCurveTo(8, 15, 12, 15);
    g.quadraticCurveTo(16, 15, 16, 12);
    g.lineTo(16, 8);
    g.stroke();
    for (const x of [3, 7, 11, 15, 19]) {
      nxRect(g, "#fff0a8", x + 0.5, 4, 2, 2);
      nxRect(g, "#ff9a2a", x + 1, 2, 1, 2);
    }
    nxRect(g, "#fff0a8", 11.5, 4, 2, 2);
    nxRect(g, "#ff9a2a", 12, 2, 1, 2);
  };

  /* ---------- árvores de evolução (3 caminhos + maestria por arma) ---------- */

  /* ---------- efeitos genéricos ---------- */
  function nxProj(style, x, y, ang, speed, dmg, o) {
    o = o || {};
    G.fx.push({
      wid: BTL.src || null,
      k: "nxp",
      style,
      x,
      y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      sp: speed,
      r: o.r || 6,
      dmg,
      pierce: o.pierce == null ? 99 : o.pierce,
      knock: o.knock || 20,
      col: o.col,
      hit: new Set(),
      t: 0,
      life: o.life || 1,
      ang,
    });
  }
  function nxZone(x, y, o) {
    G.fx.push(
      Object.assign(
        {
          wid: BTL.src || null,
          k: "jzone",
          x,
          y,
          t: 0,
          acc: 0,
          landed: false,
          ox: G.p.x,
          oy: G.p.y,
        },
        o,
        { life: o.delay + o.dur },
      ),
    );
  }

  /* ---------- Cajado de Moisés ---------- */
  function nxStaff(w, dt, id = "staff") {
    const g = G,
      p = g.p,
      m = g.mods,
      s = w.s,
      tr = nxTree(id),
      ev = nxHas(id);
    w.cd -= dt;
    if (w.cd > 0) return;
    const list = nearestList(p.x, p.y, m.rng + 40, 1);
    if (!list.length) {
      w.cd = 0.15;
      return;
    }
    const a = Math.atan2(list[0].y - p.y, list[0].x - p.x),
      tide = tr.p === "tide";
    w.cd = s.cd * m.cd * (tide && tr.t ? 0.85 : 1);
    const wall =
      s.wall *
      (tide ? (tr.t ? 1.45 : 1.25) : 1) *
      (ev ? 1.25 : 1) *
      (m.area || 1),
      speed = s.speed * (m.pspd || 1) * (tide ? 1.15 : 1),
      dist = s.dist * (1 + (m.rng - 90) / 400);
    const dmg = s.dmg * m.dmg,
      ret = tr.p === "return" || ev;
    const mk = (ang, dm, delay) =>
      g.fx.push({
        wid: BTL.src || null,
        k: "sea",
        x: p.x + Math.cos(ang) * 8,
        y: p.y + Math.sin(ang) * 8,
        ang,
        wall,
        dmg: dm,
        speed,
        dist,
        trav: 0,
        hit: new Set(),
        t: 0,
        life: 30,
        wait: delay || 0,
        ret,
        back: false,
        retMul: tr.p === "return" ? (tr.t ? 0.9 : 0.55) : 0.6,
        corridor: tr.p === "corridor",
        ct: tr.t,
      });
    mk(a, dmg, 0);
    if (s.twin) mk(a, dmg * 0.6, 0.4);
    if (ev) mk(a + Math.PI, dmg * 0.6, 0);
    nxS("sea");
  }
  function nxSeaFx(f, dt) {
    const g = G,
      st = f.speed * dt;
    f.x += Math.cos(f.ang) * st;
    f.y += Math.sin(f.ang) * st;
    f.trav += st;
    const dx = Math.cos(f.ang),
      dy = Math.sin(f.ang),
      nx = -dy,
      ny = dx,
      half = f.wall / 2;
    forNear(f.x, f.y, half + 18, (e) => {
      if (f.hit.has(e)) return;
      const rx = e.x - f.x,
        ry = e.y - f.y,
        al = rx * dx + ry * dy,
        pe = rx * nx + ry * ny;
      if (Math.abs(al) < 7 + e.r && Math.abs(pe) < half + e.r) {
        f.hit.add(e);
        const sg = pe >= 0 ? 1 : -1;
        hurtBy(
          f.wid || f.k || "fx",
          e,
          f.dmg,
          dx * 0.3 + nx * sg * 0.9,
          dy * 0.3 + ny * sg * 0.9,
          55,
        );
        if (f.corridor) {
          e.slowT = Math.max(e.slowT || 0, f.ct ? 4 : 3);
          e.slowAmt = Math.max(e.slowAmt || 0, f.ct ? 0.6 : 0.42);
        }
      }
    });
    for (const q of g.eshots)
      if (!q.dead) {
        const rx = q.x - f.x,
          ry = q.y - f.y;
        if (
          Math.abs(rx * dx + ry * dy) < 8 &&
          Math.abs(rx * nx + ry * ny) < half + 3
        )
          q.dead = true;
      }
    if (FXQ() && rngFx() < dt * 30)
      g.parts.push({
        x: f.x + nx * rndFx(-half, half),
        y: f.y + ny * rndFx(-half, half),
        vx: rndFx(-8, 8),
        vy: rndFx(-14, -2),
        life: 0.45,
        max: 0.5,
        col: "#e8faff",
        sz: 1,
      });
    if (f.trav >= f.dist) {
      if (f.ret && !f.back) {
        f.back = true;
        f.ang += Math.PI;
        f.hit = new Set();
        f.dmg *= f.retMul;
        f.trav = 0;
        f.dist *= 0.9;
      } else f.life = -1;
    }
  }
  FXR.sea = (f, k, g) => {
    if (f.wait > 0) return;
    const x = sx(f.x),
      y = sy(f.y),
      h = f.wall / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(f.ang);
    if (!FXQ()) {
      ctx.fillStyle = "rgba(120,200,255,.5)";
      ctx.fillRect(-10, -h, 14, h * 2);
      ctx.restore();
      return;
    }
    const gr = ctx.createLinearGradient(-26, 0, 6, 0);
    gr.addColorStop(0, "rgba(60,140,220,0)");
    gr.addColorStop(1, "rgba(110,190,250,.6)");
    ctx.fillStyle = gr;
    ctx.fillRect(-26, -h, 32, h * 2);
    ctx.strokeStyle = "rgba(235,250,255,.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const yy = -h + (i / 14) * h * 2,
        xx = 5 + Math.sin(g.t * 11 + i * 1.4) * 2.2;
      i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(150,215,255,.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const yy = -h + (i / 14) * h * 2,
        xx = -3 + Math.sin(g.t * 9 + i * 1.1 + 1) * 2;
      i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.9)";
    for (let i = 0; i < 6; i++) {
      const yy = -h + hz(i, 21) * h * 2,
        xx = 2 + hz(i, 22) * 5 + Math.sin(g.t * 8 + i) * 1.5;
      ctx.fillRect(xx, yy, 1, 1);
    }
    ctx.restore();
    glow(f.x, f.y, h * 0.9, "rgba(120,200,255,1)", 0.22);
  };

  /* ---------- Machado de Eliseu ---------- */
  function nxAxe(w, dt, id = "axe") {
    const g = G,
      p = g.p,
      m = g.mods,
      s = w.s,
      tr = nxTree(id),
      ev = nxHas(id);
    w.cd -= dt;
    if (w.cd > 0) return;
    const list = nearestList(p.x, p.y, m.rng + 30, 8);
    if (!list.length) {
      w.cd = 0.15;
      return;
    }
    w.cd = s.cd * m.cd;
    const n = Math.min(
      7,
      (ev
        ? Math.max(3, s.count + 1)
        : s.count + (tr.p === "twin" ? (tr.t ? 2 : 1) : 0)) + amountBonus(m),
    ),
      a0 = Math.atan2(list[0].y - p.y, list[0].x - p.x);
    const reach = s.reach * (1 + (m.rng - 90) / 320) * (ev ? 1.15 : 1),
      heavy = tr.p === "heavy",
      hov = tr.p === "floating" || ev ? (tr.t || ev ? 1.9 : 1.2) : 0;
    for (let i = 0; i < n; i++) {
      const fan = a0 + (i - (n - 1) / 2) * 0.34,
        ang =
          !ev && list.length >= n
            ? Math.atan2(list[i].y - p.y, list[i].x - p.x)
            : fan;
      g.fx.push({
        wid: BTL.src || null,
        k: "axe",
        x: p.x,
        y: p.y,
        ang,
        ph: 0,
        trav: 0,
        reach,
        speed: s.speed * (m.pspd || 1),
        dmg: s.dmg * m.dmg * (heavy ? (tr.t ? 1.7 : 1.4) : 1) * (ev ? 1.2 : 1),
        hit: new Set(),
        hov: 0,
        hovMax: hov * (m.duration || 1),
        r: (heavy ? 10 : 8) * (m.area || 1),
        knock: heavy ? (tr.t ? 95 : 65) : 28,
        spin: rngFx() * 6,
        tick: 0,
        t: 0,
        life: 14,
      });
    }
    nxS("axe");
  }
  function nxAxeFx(f, dt) {
    const g = G,
      p = g.p;
    f.spin += dt * 17;
    if (f.ph === 0) {
      const st = f.speed * dt;
      f.x += Math.cos(f.ang) * st;
      f.y += Math.sin(f.ang) * st;
      f.trav += st;
      if (f.trav >= f.reach) {
        if (f.hovMax > 0) {
          f.ph = 1;
          f.hov = f.hovMax;
          f.tick = 0;
        } else f.ph = 2;
        f.hit = new Set();
      }
    } else if (f.ph === 1) {
      f.hov -= dt;
      f.tick += dt;
      if (f.tick >= 0.3) {
        f.tick = 0;
        f.hit = new Set();
      }
      if (f.hov <= 0) {
        f.ph = 2;
        f.hit = new Set();
      }
    } else {
      const dx = p.x - f.x,
        dy = p.y - f.y,
        d = Math.hypot(dx, dy) || 1,
        st = f.speed * 1.25 * dt;
      f.x += (dx / d) * st;
      f.y += (dy / d) * st;
      if (d < 9 || f.t > f.life - 0.2) {
        f.life = -1;
        return;
      }
    }
    forNear(f.x, f.y, f.r + 26, (e) => {
      if (f.hit.has(e)) return;
      const dx = e.x - f.x,
        dy = e.y - f.y,
        d = Math.hypot(dx, dy) || 1;
      if (d < f.r + e.r) {
        f.hit.add(e);
        hurtBy(
          f.wid || f.k || "fx",
          e,
          f.dmg * (f.ph === 2 ? 0.8 : 1),
          dx / d,
          dy / d,
          f.knock,
        );
        fxSpark(e.x, e.y, "#dfe6f5", 6);
      }
    });
  }
  FXR.axe = (f, k, g) => {
    const x = sx(f.x),
      y = sy(f.y);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(f.spin);
    ctx.scale(1.45, 1.45);
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(-2, -8, 4, 16);
    ctx.fillStyle = "#8a5a2b";
    ctx.fillRect(-1, -7, 2, 14);
    ctx.fillStyle = "#b9c2d4";
    ctx.beginPath();
    ctx.moveTo(1, -7);
    ctx.lineTo(8, -5);
    ctx.lineTo(8, 1);
    ctx.lineTo(1, -1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f2f6ff";
    ctx.fillRect(5, -5, 3, 2);
    ctx.restore();
    if (f.ph === 1) glow(f.x, f.y, 16, "rgba(180,220,255,1)", 0.65);
    else glow(f.x, f.y, 12, "rgba(255,255,255,1)", 0.5);
  };


  /* ---------- Corvo Negro (Elias · 1 Reis 17:6) ----------
     Mecânica própria, evolução da ideia da Pomba: cada corvo escolhe a PRESA MAIS FORTE ao alcance
     (chefe > elite > mais vida), voa até ela perseguindo, atravessa alguns inimigos e VOLTA ao herói,
     ferindo de novo na volta. Quem acertou alguém traz PÃO: cura Salvação (com intervalo entre entregas). */
  const ravenScore = (e) => (e.boss ? 1e6 : 0) + (e.elite ? 1e4 : 0) + (e.hp || 0);
  function ravenLaunch(w, tg, opt) {
    const g = G,
      p = g.p,
      m = g.mods,
      s = w.s,
      tr = nxTree("raven"),
      ev = nxHas("raven"),
      big = !!(opt && opt.big),
      a = Math.atan2(tg.y - p.y, tg.x - p.x) + ((opt && opt.spread) || 0);
    g.fx.push({
      wid: BTL.src || null,
      k: "raven",
      x: p.x,
      y: p.y,
      ang: a,
      vx: Math.cos(a) * s.speed,
      vy: Math.sin(a) * s.speed,
      ph: 0 /* 0 = ida, 1 = volta */,
      tg,
      trav: 0,
      reach: s.reach * (1 + (m.rng - 90) / 320) * (ev ? 1.15 : 1) * (big ? 1.4 : 1),
      speed: s.speed * (m.pspd || 1) * (big ? 0.9 : 1),
      dmg: s.dmg * m.dmg * (tr.p === "murder" && tr.t ? 1.12 : 1) * (big ? 2.6 : 1),
      pierce: s.pierce + (big ? 4 : 0),
      outHits: 0,
      struck: 0,
      hit: new Set(),
      r: (big ? 9 : 5) * (m.area || 1),
      flap: rngFx() * 6,
      big,
      mark: tr.p === "mark" ? (tr.t ? { d: 6, a: 0.3 } : { d: 4, a: 0.2 }) : null,
      t: 0,
      life: 12,
    });
  }
  function nxRaven(w, dt, id = "raven") {
    const g = G,
      p = g.p,
      m = g.mods,
      s = w.s,
      tr = nxTree(id),
      ev = nxHas(id),
      reachMax = s.reach * (1 + (m.rng - 90) / 320) * (ev ? 1.15 : 1),
      range = Math.min(m.rng + 70, reachMax * 0.9);
    /* Evolução Suprema: a cada 7 s um Corvo Gigante caça a presa mais forte */
    if (ev) {
      w.bigT = (w.bigT == null ? 3 : w.bigT) - dt;
      if (w.bigT <= 0) {
        const pool = nearestList(p.x, p.y, range, 24);
        if (pool.length) {
          pool.sort((a, b) => ravenScore(b) - ravenScore(a));
          ravenLaunch(w, pool[0], { big: true });
          nxS("raven");
          w.bigT = 7;
        } else w.bigT = 0.6;
      }
    }
    w.cd -= dt;
    if (w.cd > 0) return;
    const pool = nearestList(p.x, p.y, range, 24);
    if (!pool.length) {
      w.cd = 0.2;
      return;
    }
    w.cd = s.cd * m.cd;
    pool.sort((a, b) => ravenScore(b) - ravenScore(a));
    const n = Math.min(
      8,
      s.count + (tr.p === "murder" ? (tr.t ? 2 : 1) : 0) + amountBonus(m),
    );
    for (let i = 0; i < n; i++)
      ravenLaunch(w, pool[i % pool.length], {
        spread: i >= pool.length ? (i - pool.length + 1) * 0.35 * (i % 2 ? 1 : -1) : 0,
      });
    nxS("raven");
  }
  /* pão do corvo: cura a Salvação, com intervalo mínimo entre entregas */
  function ravenBread(f) {
    const g = G,
      p = g.p,
      tr = nxTree("raven"),
      ev = nxHas("raven"),
      W = g.W.raven;
    if (g.t < (g.ravenBreadAt || 0)) return;
    let heal = ((W && W.s.bread) || 1) + (tr.p === "bread" ? (tr.t ? 2 : 1) : 0);
    if (ev) heal = Math.max(heal, 3);
    g.ravenBreadAt = g.t + (ev ? 2 : tr.p === "bread" ? (tr.t ? 2 : 2.5) : 3);
    if (p.hp < g.mods.maxhp) nxAs("raven", healP, heal * (f.big ? 2 : 1));
    if (tr.p === "bread" && tr.t) nxAs("raven", gainXp, 3);
    burst(p.x, p.y, 6, "#9a8ee0", 55);
  }
  function nxRavenFx(f, dt) {
    const g = G,
      p = g.p,
      turn = (target, rate) => {
        let da = Math.atan2(target.y - f.y, target.x - f.x) - f.ang;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        f.ang += clamp(da, -rate * dt, rate * dt);
      };
    f.flap += dt * (f.big ? 13 : 19);
    let sp = f.speed;
    if (f.ph === 0) {
      if (!f.tg || f.tg.dead) {
        f.tg = nearestList(f.x, f.y, 150, 1)[0] || null;
        if (!f.tg) {
          f.ph = 1;
          f.hit = new Set();
        }
      }
      if (f.ph === 0) {
        turn(f.tg, 6);
        /* mergulho: acelera ao chegar perto da presa */
        if (Math.hypot(f.tg.x - f.x, f.tg.y - f.y) < 46) sp *= 1.35;
      }
    }
    if (f.ph === 1) {
      turn(p, 9);
      sp *= 1.2;
      if (Math.hypot(p.x - f.x, p.y - f.y) < 10) {
        if (f.struck > 0) ravenBread(f);
        f.life = -1;
        return;
      }
    }
    f.vx = Math.cos(f.ang) * sp;
    f.vy = Math.sin(f.ang) * sp;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (f.ph === 0) {
      f.trav += sp * dt;
      if (f.trav >= f.reach * 1.25) {
        f.ph = 1;
        f.hit = new Set();
      }
    }
    if (f.t > f.life - 0.2) {
      f.life = -1;
      return;
    }
    if (FXQ() && rngFx() < dt * 26)
      g.parts.push({
        x: f.x,
        y: f.y,
        vx: rndFx(-6, 6),
        vy: rndFx(-4, 8),
        life: 0.5,
        max: 0.55,
        col: rngFx() < 0.5 ? "#4b3f7a" : "#9a8ee0",
        sz: 1,
      });
    forNear(f.x, f.y, f.r + 26, (e) => {
      if (e.dead || f.hit.has(e)) return;
      const dx = e.x - f.x,
        dy = e.y - f.y,
        d = Math.hypot(dx, dy) || 1;
      if (d < f.r + e.r) {
        f.hit.add(e);
        hurtBy(f.wid || "raven", e, f.dmg * (f.ph ? 0.75 : 1), dx / d, dy / d, f.big ? 60 : 22);
        f.struck++;
        if (f.mark) {
          /* Presa Marcada: o primeiro ferido sofre mais dano de todas as fontes */
          e.vulnT = Math.max(e.vulnT || 0, f.mark.d);
          e.vulnAmt = Math.max(e.vulnAmt || 0, f.mark.a);
          f.mark = null;
        }
        fxSpark(e.x, e.y, "#b9a8ff", f.big ? 10 : 6);
        if (f.ph === 0) {
          f.outHits++;
          if (f.outHits > f.pierce) {
            f.ph = 1;
            f.hit = new Set();
          }
        }
      }
    });
  }
  /* Corvo Negro: sprite em pixel art (2 quadros de asa), um pouco maior que a pomba; o Corvo Gigante é 2x */
  FXR.raven = (f, k, g) => {
    const up = Math.sin(f.flap) > 0,
      ang = Math.atan2(f.vy, Math.abs(f.vx) || 1) * 0.7;
    glow(
      f.x,
      f.y,
      f.big ? 16 : 8,
      f.big ? "rgba(255,200,90,1)" : "rgba(150,130,240,1)",
      f.big ? 0.4 : 0.3,
    );
    sprRot(S.raven[up ? 0 : 1], f.x, f.y, f.big ? 2 : 1, f.vx < 0 ? -ang : ang, f.vx < 0);
  };

  /* ---------- Jarros de Gideão ---------- */
  function nxJars(w, dt, id = "jars") {
    const g = G,
      p = g.p,
      m = g.mods,
      s = w.s,
      tr = nxTree(id),
      ev = nxHas(id),
      heroWeaponMods =
        (HEROES[g.hk] &&
          HEROES[g.hk].weaponModifiers &&
          HEROES[g.hk].weaponModifiers[id]) ||
        {};
    w.cd -= dt;
    if (w.cd > 0) return;
    const list = nearestList(p.x, p.y, m.rng + 40, 24);
    if (!list.length) {
      w.cd = 0.2;
      return;
    }
    w.cd = s.cd * m.cd;
    const n = Math.min(6, s.count + (ev ? 1 : 0) + amountBonus(m));
    const dur =
      s.dur *
      (heroWeaponMods.durationMultiplier || 1) *
      (ev ? 1.2 : 1) *
      (m.duration || 1),
      r =
        s.r *
        (heroWeaponMods.radiusMultiplier || 1) *
        (ev ? 1.25 : 1) *
        (m.area || 1),
      vuln = ev ? 0.3 : tr.p === "mark" ? (tr.t ? 0.35 : 0.22) : 0;
    for (let i = 0; i < n; i++) {
      const tg = list[Math.floor(rng() * list.length)];
      nxZone(tg.x + rnd(-8, 8), tg.y + rnd(-8, 8), {
        r,
        dur,
        dmg: s.dmg * m.dmg,
        tick: 0.55,
        delay: 0.45,
        style: "jar",
        burn: tr.p === "torch",
        burnT: (tr.t ? 3.4 : 2.4) * (m.duration || 1),
        vuln,
        shard: tr.p === "shatter" ? (tr.t ? 5 : 3) : 0,
      });
    }
    nxS("jar");
  }
  function nxZoneFx(f, dt) {
    if (f.t < f.delay) return;
    if (!f.landed) {
      f.landed = true;
      burst(f.x, f.y, 10, f.style === "carmel" ? "#ff9a2a" : "#ffd77a", 70);
      if (f.shard)
        for (let i = 0; i < f.shard; i++) {
          const a = rnd(0, TAU),
            d = rnd(14, f.r * 1.1);
          nxZone(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, {
            r: f.r * 0.55,
            dur: f.dur * 0.5,
            dmg: f.dmg * 0.7,
            tick: 0.55,
            delay: 0.2,
            style: f.style,
            burn: f.burn,
            burnT: f.burnT,
            vuln: f.vuln,
            shard: 0,
          });
        }
    }
    f.acc += dt;
    const r2 = f.r;
    forNear(f.x, f.y, r2 + 24, (e) => {
      const dx = e.x - f.x,
        dy = e.y - f.y;
      if (dx * dx + dy * dy > (r2 + e.r) * (r2 + e.r)) return;
      if (f.style !== "carmel" && (!(e.slowT > 0) || (e.slowAmt || 0) < 0.3)) {
        e.slowT = 0.25;
        e.slowAmt = 0.3;
      }
      if (f.vuln) {
        e.vulnT = Math.max(e.vulnT || 0, 0.35);
        e.vulnAmt = Math.max(e.vulnAmt || 0, f.vuln);
      }
    });
    if (f.acc >= f.tick) {
      f.acc -= f.tick;
      forNear(f.x, f.y, r2 + 24, (e) => {
        const dx = e.x - f.x,
          dy = e.y - f.y,
          d = Math.hypot(dx, dy) || 1;
        if (d > r2 + e.r) return;
        hurtBy(f.wid || f.k || "fx", e, f.dmg, dx / d, dy / d, 4);
        if (f.burn) {
          e.burnT = Math.max(e.burnT || 0, f.burnT || 2.4);
          e.burnDmg = Math.max(e.burnDmg || 0, f.dmg * 0.35);
          e.burnTick = Math.min(e.burnTick == null ? 0.35 : e.burnTick, 0.35);
        }
      });
    }
  }
  FXR.jzone = (f, k, g) => {
    const car = f.style === "carmel";
    if (f.t < f.delay) {
      const q = f.t / f.delay,
        ox = f.ox,
        oy = f.oy - 4,
        x = ox + (f.x - ox) * q,
        y = oy + (f.y - oy) * q - Math.sin(q * Math.PI) * 34;
      ctx.save();
      ctx.translate(sx(x), sy(y));
      ctx.rotate(q * 9);
      ctx.fillStyle = "#7a3f1d";
      ctx.fillRect(-3, -3, 6, 6);
      ctx.fillStyle = "#b5733a";
      ctx.fillRect(-2, -3, 2, 5);
      ctx.fillStyle = "#ffd24a";
      ctx.fillRect(-1, -6, 2, 3);
      ctx.restore();
      ctx.strokeStyle = "rgba(255,200,90," + (0.2 + 0.3 * q) + ")";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.arc(sx(f.x), sy(f.y), f.r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    const lf = f.life - f.delay,
      kk = (f.t - f.delay) / lf,
      fd = kk > 0.8 ? (1 - kk) / 0.2 : 1,
      x = sx(f.x),
      y = sy(f.y),
      fl = 0.85 + 0.15 * Math.sin(g.t * 17 + f.x);
    const col = car ? "255,120,40" : f.vuln ? "255,150,150" : "255,214,110";
    if (!FXQ()) {
      ctx.fillStyle = "rgba(" + col + "," + 0.22 * fd + ")";
      ctx.beginPath();
      ctx.arc(x, y, f.r, 0, TAU);
      ctx.fill();
      return;
    }
    const gr = ctx.createRadialGradient(x, y, f.r * 0.1, x, y, f.r);
    gr.addColorStop(0, "rgba(" + col + "," + 0.2 * fd * fl + ")");
    gr.addColorStop(1, "rgba(" + col + ",0)");
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(x, y, f.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(" + col + "," + 0.55 * fd + ")";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, f.r * fl, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const ph = (g.t * 1.3 + hz(i, 31)) % 1,
        aa = hz(i, 32) * TAU,
        rr = f.r * 0.75 * hz(i, 33);
      ctx.fillStyle =
        "rgba(255," + ((200 - ph * 90) | 0) + ",80," + (1 - ph) * fd + ")";
      ctx.fillRect(
        x + Math.cos(aa) * rr,
        y + Math.sin(aa) * rr * 0.7 - ph * 14,
        2,
        2,
      );
    }
    glow(f.x, f.y - 3, f.r * 1.05, "rgba(" + col + ",1)", 0.16 * fd);
  };

  /* ---------- Rede de Pedro ---------- */
  function nxNet(w, dt, id = "net") {
    const g = G,
      p = g.p,
      m = g.mods,
      s = w.s,
      tr = nxTree(id),
      ev = nxHas(id);
    w.cd -= dt;
    if (w.cd > 0) return;
    const list = nearestList(p.x, p.y, m.rng + 50, 40);
    if (!list.length) {
      w.cd = 0.2;
      return;
    }
    w.cd = s.cd * m.cd * (ev ? 0.9 : 1);
    const nets = Math.min(
      4,
      1 + (tr.p === "cast" ? (tr.t ? 2 : 1) : 0) + amountBonus(m),
    ),
      used = [],
      rad =
        s.r *
        (tr.p === "cast" && tr.t ? 1.2 : 1) *
        (ev ? 1.3 : 1) *
        (m.area || 1);
    for (let n = 0; n < nets; n++) {
      let best = null,
        bc = -1;
      for (const e of list) {
        if (used.some((u) => Math.hypot(u.x - e.x, u.y - e.y) < rad * 1.2))
          continue;
        let c = 0;
        for (const o of list)
          if (Math.hypot(o.x - e.x, o.y - e.y) < rad * 1.1) c++;
        if (c > bc) {
          bc = c;
          best = e;
        }
      }
      if (!best) break;
      used.push(best);
      const hold =
        (s.hold + (tr.p === "tight" && tr.t ? 0.6 : 0)) *
        (ev ? 1.4 : 1) *
        (m.duration || 1),
        haul = tr.p === "haul" || ev ? (tr.t || ev ? 2 : 1) : 0;
      g.fx.push({
        wid: BTL.src || null,
        k: "net",
        x: best.x,
        y: best.y,
        r: rad,
        hold,
        dmg: s.dmg * m.dmg * (ev ? 1.3 : 1),
        tick: tr.p === "tight" ? (tr.t ? 0.3 : 0.45) : 0,
        tdmg: s.dmg * m.dmg * (tr.t ? 0.5 : 0.35),
        pull: ev,
        haul,
        delay: 0.4,
        life: 0.4 + hold + 0.35,
        landed: false,
        acc: 0,
        t: 0,
        ox: p.x,
        oy: p.y,
      });
    }
    nxS("net");
  }
  function nxNetFx(f, dt) {
    if (f.t < f.delay) return;
    if (!f.landed) {
      f.landed = true;
      burst(f.x, f.y, 8, "#e9dcc0", 60);
      forNear(f.x, f.y, f.r + 24, (e) => {
        const dx = e.x - f.x,
          dy = e.y - f.y,
          d = Math.hypot(dx, dy) || 1;
        if (d < f.r + e.r) {
          hurtBy(f.wid || f.k || "fx", e, f.dmg, dx / d, dy / d, 6);
          if (f.haul) {
            e.haulUntil = G.t + f.hold + 0.3;
            e.haulLv = f.haul;
          }
        }
      });
    }
    if (f.t > f.delay + f.hold) return;
    f.acc += dt;
    forNear(f.x, f.y, f.r + 24, (e) => {
      const dx = f.x - e.x,
        dy = f.y - e.y,
        d = Math.hypot(dx, dy) || 1;
      if (d > f.r + e.r) return;
      const imm = e.boss ? 0.35 : e.elite ? 0.7 : 1;
      if (!(e.slowT > 0) || (e.slowAmt || 0) <= imm) {
        e.slowT = 0.25;
        e.slowAmt = imm;
      }
      e.vulnT = Math.max(e.vulnT || 0, 0.35);
      e.vulnAmt = Math.max(e.vulnAmt || 0, 0.2);
      if (f.pull && !e.boss) {
        const k = Math.min(1, dt * 2.4);
        e.x += dx * k * 0.5;
        e.y += dy * k * 0.5;
      }
    });
    if (f.tick && f.acc >= f.tick) {
      f.acc -= f.tick;
      forNear(f.x, f.y, f.r + 24, (e) => {
        const dx = e.x - f.x,
          dy = e.y - f.y,
          d = Math.hypot(dx, dy) || 1;
        if (d < f.r + e.r)
          hurtBy(f.wid || f.k || "fx", e, f.tdmg, dx / d, dy / d, 0);
      });
    }
  }
  /* ---------- Espada da Palavra: espadas lançadas que perseguem um alvo ---------- */
  function nxSword(w, dt, id = "sword") {
    const g = G,
      p = g.p,
      m = g.mods,
      s = w.s;
    w.q = w.q || [];
    for (const it of w.q) it.t -= dt;
    while (w.q.length && w.q[0].t <= 0) {
      const it = w.q.shift(),
        tg =
          it.tg && !it.tg.dead ? it.tg : nearestList(p.x, p.y, it.rng, 1)[0];
      if (tg) nxSwordLaunch(w, tg, it, id);
    }
    w.cd -= dt;
    if (w.cd > 0) return;
    const rng = m.rng + (s.range - 150),
      cnt = Math.max(1, Math.round(s.count)),
      list = nearestList(p.x, p.y, rng, cnt);
    if (!list.length) {
      w.cd = 0.1;
      return;
    }
    w.cd = s.cd * m.cd;
    for (let i = 0; i < cnt; i++)
      // w.q.push({ t: i * 0.09, tg: list[i % list.length], rng, i, n: cnt });
      w.q.push({ t: i * 0.09, tg: list[i % list.length], rng, i, n: cnt, ll: list.length });
    nxS("sword");
  }
  function nxSwordLaunch(w, tg, it, id) {
    const g = G,
      p = g.p,
      m = g.mods,
      s = w.s,
      tr = nxTree(id),
      a =
        Math.atan2(tg.y - p.y, tg.x - p.x) +
        //(it.n > 1 ? (it.i - (it.n - 1) / 2) * 0.24 : 0),
        (it.i >= it.ll ? (it.i - it.ll + 1) * 0.2 * (it.i % 2 ? 1 : -1) : 0),
      speed = s.speed * (m.pspd || 1);
    g.shots.push({
      wid: BTL.src || id,
      k: "sword",
      x: p.x,
      y: p.y - 4,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      ang: a,
      dmg:
        s.dmg *
        m.dmg *
        (tr.p === "justice" ? (tr.t ? 1.5 : 1.3) : 1),
      pierce: s.pierce + (tr.p === "pierce" ? (tr.t ? 4 : 2) : 0),
      hit: [],
      r: 4,
      life: 1.5 * (m.duration || 1),
      tg,
      echo: tr.p === "echo",
      echoTier: tr.t,
      ev: nxHas(id),
    });
  }
  /* ---------- Chicote de Cordas: chibatadas em linha e Expulsão ---------- */
  const WT = FE_CONTENT.weaponTuning.whip; /* balanceamento em registry.js → weaponTuning.whip */
  function nxWhip(w, dt, id = "whip") {
    const g = G,
      p = g.p,
      m = g.mods,
      s = w.s,
      tr = nxTree(id),
      ev = nxHas(id),
      cr = tr.p === "cords" ? (tr.t ? 1 : 0) : -1;
    w.cd -= dt;
    if (w.cd > 0) return;
    const reach =
      (s.reach + (cr >= 0 ? WT.cords.reach[cr] : 0)) *
      (1 + (m.rng - 90) / 320) *
      (1 + ((m.area || 1) - 1) * WT.lengthFromArea);
    const tg = nearestList(p.x, p.y, reach * WT.targetRange, 1);
    if (!tg.length) {
      w.cd = WT.retryDelay;
      return;
    }
    w.cd = s.cd * m.cd;
    const base = Math.atan2(tg[0].y - p.y, tg[0].x - p.x),
      n = Math.min(
        WT.maxLashes,
        s.count +
        (cr >= 0 ? WT.cords.lashes[cr] : 0) +
        (ev ? WT.supremeExtraLashes : 0),
      );
    for (let i = 0; i < n; i++)
      g.fx.push({
        wid: BTL.src || id,
        k: "whip",
        x: p.x,
        y: p.y,
        follow: true,
        ang: base + (WT.lashAngles[i] * Math.PI) / 180,
        len: reach,
        wd: s.width * (1 + ((m.area || 1) - 1) * WT.widthFromArea),
        dmg: s.dmg * m.dmg,
        need: ev || tr.p === "zeal" ? WT.mark.needFast : WT.mark.need,
        zealNode: tr.p === "zeal" && tr.t,
        tables: tr.p === "tables" ? (tr.t ? 2 : 1) : 0,
        nova: ev,
        done: false,
        t: 0,
        wait: i * WT.lashDelay,
        life: WT.lashLife,
      });
  }
  function nxWhipFx(f, dt) {
    if (f.done || f.t < WT.hitTime) return;
    f.done = true;
    const g = G,
      c = Math.cos(f.ang),
      sn = Math.sin(f.ang);
    for (const e of g.enemies) {
      if (e.dead) continue;
      const dx = e.x - f.x,
        dy = e.y - f.y,
        along = dx * c + dy * sn,
        perp = Math.abs(-dx * sn + dy * c);
      if (along < -6 || along > f.len + e.r || perp > f.wd / 2 + e.r) continue;
      hurtBy(f.wid, e, f.dmg, c, sn, 12);
      if (e.dead) continue;
      e.zeal = (e.zealT > g.t ? e.zeal || 0 : 0) + 1;
      e.zealT = g.t + WT.mark.window;
      if (e.zeal >= f.need) nxExpel(f, e, c, sn);
      else
        burst(
          e.x,
          e.y - 4,
          WT.mark.sparks + e.zeal,
          WT.mark.sparkColor,
          WT.mark.sparkSpeed,
        );
    }
  }
  /* Expulsão: o demônio é arremessado, fica atordoado e sofre dano extra */
  function nxExpel(f, e, c, sn) {
    const g = G,
      X = WT.expel;
    e.zeal = 0;
    e.zealT = 0;
    hurtBy(
      f.wid,
      e,
      f.dmg * (f.zealNode ? X.bonusZeal : X.bonus),
      c,
      sn,
      e.boss ? X.bossKnock : X.knock,
    );
    if (!e.dead) {
      const st = e.boss ? X.stun.boss : e.elite ? X.stun.elite : X.stun.normal;
      e.slowT = Math.max(e.slowT || 0, st[0]);
      e.slowAmt = Math.max(e.slowAmt || 0, st[1]);
    }
    burst(e.x, e.y, X.burst.n, X.burst.color, X.burst.speed);
    g.fx.push({
      wid: f.wid,
      k: "ring",
      x: e.x,
      y: e.y,
      r: X.ring.r,
      maxr: X.ring.maxr,
      dmg: 0,
      knock: 0,
      style: X.ring.style,
      hit: new Set(),
      t: 0,
      life: X.ring.life,
    });
    const K = WT.shock,
      rr = f.tables === 2 ? K.tables2 : f.tables === 1 ? K.tables1 : f.nova ? K.supreme : 0;
    if (rr)
      forNear(e.x, e.y, rr, (o) => {
        if (o === e || o.dead) return;
        const dx = o.x - e.x,
          dy = o.y - e.y,
          d = Math.hypot(dx, dy) || 1;
        hurtBy(f.wid, o, f.dmg * K.dmgMult, dx / d, dy / d, K.knock);
      });
    if (f.tables && rng() < (f.tables === 2 ? WT.coin.tables2 : WT.coin.tables1))
      drop(e.x + rnd(-WT.coin.jitter, WT.coin.jitter), e.y, "coin");
  }
  FXR.whip = (f, k, g) => {
    const ox = sx(f.x),
      oy = sy(f.y - 3),
      ext = k < 0.22 ? k / 0.22 : 1,
      fade = k < 0.6 ? 1 : Math.max(0, 1 - (k - 0.6) / 0.4),
      L = f.len * ext,
      c = Math.cos(f.ang),
      sn = Math.sin(f.ang),
      px = -sn,
      py = c,
      N = 9,
      pts = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N,
        wob =
          Math.sin(u * 7 + k * 16) *
          (1 - u * 0.5) *
          (ext < 1 ? 8 * (1 - ext) + 2 : 2.2 * (1 - k));
      pts.push([ox + c * L * u + px * wob, oy + sn * L * u + py * wob]);
    }
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const stroke = (col, w) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      pts.forEach((q, i) =>
        i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]),
      );
      ctx.stroke();
    };
    if (!FXQ()) stroke("#e8c98a", 2);
    else {
      stroke("#4a2a12", 3.4);
      stroke("#a8743a", 2.2);
      stroke("#f0d49a", 0.9);
    }
    ctx.restore();
    if (k > 0.2 && k < 0.5)
      glow(
        f.x + c * f.len,
        f.y - 3 + sn * f.len,
        11,
        "rgba(255,240,170,1)",
        0.8 * (1 - (k - 0.2) / 0.3),
      );
  };
  ICON_DRAW.whip = (g) => {
    nxRect(g, "#4a2a12", 3, 18, 5, 4);
    nxRect(g, "#7a4a22", 4, 17, 3, 3);
    nxRect(g, "#a8743a", 7, 15, 3, 2);
    nxRect(g, "#a8743a", 9, 12, 3, 3);
    nxRect(g, "#c58a4c", 11, 9, 3, 3);
    nxRect(g, "#c58a4c", 13, 6, 3, 3);
    nxRect(g, "#e8c98a", 15, 4, 3, 2);
    nxRect(g, "#f0d49a", 17, 3, 2, 2);
    nxRect(g, "#fff3b0", 19, 1, 3, 3);
    nxRect(g, "#ffe27a", 18, 5, 2, 2);
    nxRect(g, "#ffe27a", 21, 4, 2, 2);
    nxRect(g, "#ffd24a", 20, 0, 1, 1);
  };
  /* ---------- Josué: Marcha de Jericó (balanceamento em registry.js → heroPowerTuning.jericho_march) ---------- */
  const JT = FE_CONTENT.heroPowerTuning.jericho_march;
  function nxJericho() {
    const g = G,
      p = g.p,
      R = JT.radius * (1 + ((g.mods.area || 1) - 1) * JT.radiusFromArea);
    nxS("jericho");
    if (!g.hm.first.jericho) {
      g.hm.first.jericho = 1;
      toast(JT.firstToast);
    }
    g.shake = JT.shake;
    g.flash = JT.flash;
    forNear(p.x, p.y, R, (e) => {
      const st = e.boss ? JT.stun.boss : e.elite ? JT.stun.elite : JT.stun.normal;
      e.slowT = Math.max(e.slowT || 0, st[0]);
      e.slowAmt = Math.max(e.slowAmt || 0, st[1]);
    });
    if (JT.clearProjectiles)
      for (const q of g.eshots)
        if (Math.hypot(q.x - p.x, q.y - p.y) < R) q.dead = true;
    if (JT.resetWeapon && g.W[JT.resetWeapon]) g.W[JT.resetWeapon].cd = 0;
    g.fx.push({
      wid: "hero_josue",
      k: "ring",
      x: p.x,
      y: p.y,
      r: 3,
      maxr: R,
      dmg: (JT.dmgBase + JT.dmgPerLevel * g.lvl) * g.mods.dmg,
      knock: JT.knock,
      style: "horn",
      hit: new Set(),
      t: 0,
      life: JT.ringLife,
      follow: true,
    });
  }
  /* ---------- Muro de Fogo: anel que expande e retorna ---------- */
  function nxFirewall(w, dt, id = "firewall") {
    const g = G,
      p = g.p,
      m = g.mods,
      s = w.s,
      tr = nxTree(id),
      ev = nxHas(id);
    w.cd -= dt;
    if (w.cd > 0) return;
    const maxr =
      s.maxr *
      (tr.p === "rampart" ? (tr.t ? 1.5 : 1.3) : 1) *
      (ev ? 1.25 : 1) *
      (m.area || 1);
    if (!nearestList(p.x, p.y, maxr * 0.95, 1).length) {
      w.cd = 0.2;
      return;
    }
    w.cd = s.cd * m.cd;
    const waves = Math.min(
      4,
      s.waves + (tr.p === "wheel" ? (tr.t ? 2 : 1) : 0) + (ev ? 1 : 0),
    ),
      half = 0.72 * (m.duration || 1),
      burn = tr.p === "burn" || ev;
    for (let i = 0; i < waves; i++)
      g.fx.push({
        wid: BTL.src || id,
        k: "fwall",
        x: p.x,
        y: p.y,
        r: 4,
        maxr,
        dmg: s.dmg * m.dmg * (ev ? 1.35 : 1) * (i ? 0.75 : 1),
        slow: Math.min(0.7, s.slow + (ev ? 0.1 : 0)),
        knock: tr.p === "rampart" ? (tr.t ? 46 : 30) : 14,
        burn,
        burnT: tr.p === "burn" && tr.t ? 3.4 : 2.4,
        burnRatio: tr.p === "burn" && tr.t ? 0.45 : 0.3,
        follow: true,
        hit: new Set(),
        back: false,
        t: 0,
        wait: i * 0.3,
        life: half * 2,
        half,
      });
    nxS("fwall");
  }
  function nxFwallFx(f, dt) {
    const g = G;
    if (!f.back && f.t >= f.half) {
      f.back = true;
      f.hit = new Set();
    }
    const k = Math.max(
      0,
      Math.min(1, f.back ? (f.life - f.t) / f.half : f.t / f.half),
    ),
      ease = 1 - (1 - k) * (1 - k);
    f.r = 4 + (f.maxr - 4) * ease;
    for (const e of g.enemies) {
      if (e.dead || f.hit.has(e)) continue;
      const dx = e.x - f.x,
        dy = e.y - f.y,
        d = Math.hypot(dx, dy) || 1;
      if (Math.abs(d - f.r) >= 9 + e.r) continue;
      f.hit.add(e);
      /* quanto mais perto da borda, maior o dano (60% no centro, 140% na borda) */
      const dmg = f.dmg * (0.6 + 0.8 * Math.min(1, d / f.maxr));
      hurtBy(f.wid || "fx", e, dmg, dx / d, dy / d, f.back ? 0 : f.knock);
      e.slowT = Math.max(e.slowT || 0, 1);
      e.slowAmt = Math.max(e.slowAmt || 0, e.boss ? f.slow * 0.5 : f.slow);
      if (f.burn) {
        e.burnT = Math.max(e.burnT || 0, f.burnT);
        e.burnDmg = Math.max(e.burnDmg || 0, dmg * f.burnRatio);
        e.burnTick = Math.min(e.burnTick == null ? 0.35 : e.burnTick, 0.35);
      }
    }
    for (const q of g.eshots)
      if (!q.dead && Math.abs(Math.hypot(q.x - f.x, q.y - f.y) - f.r) < 10)
        q.dead = true;
  }
  FXR.fwall = (f, k, g) => {
    const x = sx(f.x),
      y = sy(f.y),
      R = f.r,
      dir = f.back ? -1 : 1,
      fade =
        f.t < 0.1
          ? f.t / 0.1
          : f.life - f.t < 0.14
            ? Math.max(0, (f.life - f.t) / 0.14)
            : 1;
    if (!FXQ()) {
      ctx.strokeStyle = "rgba(255,140,40," + fade * 0.9 + ")";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.stroke();
      return;
    }
    ctx.save();
    const gr = ctx.createRadialGradient(x, y, R * 0.55, x, y, R);
    gr.addColorStop(0, "rgba(255,120,30,0)");
    gr.addColorStop(1, "rgba(255,140,40," + 0.2 * fade + ")");
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = fade;
    const n = Math.max(16, Math.round((R * TAU) / 3));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU,
        ca = Math.cos(a),
        sa = Math.sin(a),
        fl = 0.5 + 0.5 * Math.sin(g.t * 19 + i * 1.7 + hz(i, 3) * 6),
        len = 2 + fl * 4 + hz(i, 5) * 3,
        px = x + ca * R,
        py = y + sa * R;
      ctx.fillStyle = "#a4210f";
      ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3);
      ctx.fillStyle = "#ff6a1a";
      ctx.fillRect(
        Math.round(px + ca * dir * len * 0.4) - 1,
        Math.round(py + sa * dir * len * 0.4) - 1,
        2,
        2,
      );
      if (fl > 0.3) {
        ctx.fillStyle = "#ffb43a";
        ctx.fillRect(
          Math.round(px + ca * dir * len * 0.75),
          Math.round(py + sa * dir * len * 0.75),
          2,
          1 + (fl > 0.7 ? 1 : 0),
        );
      }
      if (fl > 0.8) {
        ctx.fillStyle = "#fff3b0";
        ctx.fillRect(
          Math.round(px + ca * dir * len),
          Math.round(py + sa * dir * len),
          1,
          1,
        );
      }
    }
    ctx.strokeStyle = "rgba(255,240,170,0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, R - 1), 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 9; i++) {
      const ph = (g.t * 1.6 + hz(i, 7)) % 1,
        a = hz(i, 8) * TAU + g.t * 0.3 * dir,
        rr = R + dir * ph * 12;
      ctx.fillStyle =
        "rgba(255," + ((220 - ph * 110) | 0) + ",80," + (1 - ph) + ")";
      ctx.fillRect(
        Math.round(x + Math.cos(a) * rr),
        Math.round(y + Math.sin(a) * rr - ph * 6),
        1,
        1,
      );
    }
    ctx.restore();
    glow(f.x, f.y, R * 0.9, "rgba(255,140,40,1)", fade * 0.18);
  };
  FXR.net = (f, k, g) => {
    const x = sx(f.x),
      y = sy(f.y);
    if (f.t < f.delay) {
      const q = f.t / f.delay,
        ox = f.ox,
        oy = f.oy - 4,
        px = ox + (f.x - ox) * q,
        py = oy + (f.y - oy) * q - Math.sin(q * Math.PI) * 28,
        rr = 4 + f.r * q;
      ctx.strokeStyle = "rgba(233,220,192,.9)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx(px), sy(py), rr, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx(px) - rr, sy(py));
      ctx.lineTo(sx(px) + rr, sy(py));
      ctx.moveTo(sx(px), sy(py) - rr);
      ctx.lineTo(sx(px), sy(py) + rr);
      ctx.stroke();
      return;
    }
    const left = f.life - f.t,
      fd = Math.min(1, left / 0.35),
      R = f.r;
    ctx.save();
    ctx.strokeStyle = "rgba(233,220,192," + 0.9 * fd + ")";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      const o = (i * R) / 3,
        hh = Math.sqrt(Math.max(0, R * R - o * o));
      ctx.moveTo(x + o, y - hh);
      ctx.lineTo(x + o, y + hh);
      ctx.moveTo(x - hh, y + o);
      ctx.lineTo(x + hh, y + o);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(242,193,78," + fd + ")";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.fillRect(x + Math.cos(a) * R - 1, y + Math.sin(a) * R - 1, 3, 3);
    }
    ctx.restore();
    if (f.pull) glow(f.x, f.y, R, "rgba(160,220,255,1)", 0.22 * fd);
  };

  /* ---------- Menorá (raios giratórios) ---------- */
  function nxMenorahBeams(id = "menorah") {
    const g = G,
      w = g.W[id],
      s = w.s,
      m = g.mods,
      tr = nxTree(id),
      ev = nxHas(id),
      n = ev ? 7 : Math.min(7, s.beams + amountBonus(m));
    const len =
      s.range *
      (tr.p === "radiance" ? (tr.t ? 1.5 : 1.3) : 1) *
      (ev ? 1.25 : 1) *
      (1 + (m.rng - 90) / 500) *
      (m.area || 1),
      wid =
        3.2 * (tr.p === "radiance" ? (tr.t ? 1.7 : 1.35) : 1) * (m.area || 1);
    return { n, len, wid, tr, ev, rev: tr.p === "revolve" };
  }
  /* Candeeiros: orbes de luz giram em volta do herói e pulsam para dentro e para fora
     (inspirado em espíritos orbitais). Cada orbe fere o que toca, inclusive ao longo do
     caminho percorrido desde o último golpe, para não "pular" inimigos. */
  function nxMenorah(w, dt, id = "menorah") {
    const g = G,
      p = g.p,
      m = g.mods,
      s = w.s,
      B = nxMenorahBeams(id),
      spin = s.spin * (m.pspd || 1) * (B.rev ? (B.tr.t ? 1.55 : 1.3) : 1),
      oy = p.y - 3;
    w.ang += spin * dt;
    w.ang2 = (w.ang2 || 0) - spin * dt;
    w.beams = [];
    w.trail = w.trail || [];
    w.sweep = w.sweep || [];
    w.orbR = 5.5 + B.wid * 1.2;
    for (let i = 0; i < B.n; i++) {
      const a = (B.rev && i % 2 ? w.ang2 : w.ang) + (i * TAU) / B.n,
        pulse = 0.5 + 0.5 * Math.sin(g.t * 2.4 + i * 2.4),
        r = B.len * (0.3 + 0.7 * pulse),
        x = p.x + Math.cos(a) * r,
        y = oy + Math.sin(a) * r;
      w.beams.push({ a, len: r, x, y, i });
      const tr = (w.trail[i] = w.trail[i] || []);
      tr.push({ x, y });
      if (tr.length > 9) tr.shift();
      (w.sweep[i] = w.sweep[i] || []).push({ x, y });
    }
    w.trail.length = B.n;
    w.sweep.length = B.n;
    w.tick -= dt;
    if (w.tick > 0) return;
    w.tick = s.tick * m.cd;
    const dmg = s.dmg * m.dmg * (B.ev ? 1.4 : 1),
      burn = B.tr.p === "burn",
      ro = w.orbR;
    for (let i = 0; i < w.beams.length; i++) {
      const seen = new Set(),
        path = w.sweep[i];
      for (let k = 0; k < path.length; k += 2) {
        const q = path[k];
        forNear(q.x, q.y, ro + 16, (e) => {
          if (seen.has(e) || Math.hypot(e.x - q.x, e.y - q.y) >= e.r + ro)
            return;
          seen.add(e);
          const dx = e.x - p.x,
            dy = e.y - p.y,
            d = Math.hypot(dx, dy) || 1;
          hurtBy(id, e, dmg, dx / d, dy / d, 6);
          if (burn) {
            e.burnT = Math.max(e.burnT || 0, B.tr.t ? 3.2 : 2.2);
            e.burnDmg = Math.max(e.burnDmg || 0, dmg * (B.tr.t ? 0.5 : 0.35));
            e.burnTick = Math.min(e.burnTick == null ? 0.35 : e.burnTick, 0.35);
          }
        });
      }
      w.sweep[i] = path.slice(-1);
    }
  }
  /* desenho: orbes em pixel art com chama de candeeiro, rastro e brilho */
  function nxDrawBeams(g) {
    const fq = FXQ();
    ctx.save();
    for (const [id, w] of Object.entries(g.W || {})) {
      if (!w.beams || !WEAPONS[id] || WEAPONS[id].behavior !== "rotating_beams")
        continue;
      const tr = nxTree(id),
        ev = nxHas(id),
        pal =
          tr.p === "burn"
            ? ["#8a2a10", "#ff6a1a", "#ffb43a", "#fff3b0"]
            : tr.p === "revolve"
              ? ["#3a5a8a", "#8ec9ff", "#d8f0ff", "#ffffff"]
              : ["#7a4a10", "#e8a21c", "#ffd86a", "#fff8d8"],
        big = w.orbR >= 10.5 || ev ? 1 : 0;
      /* órbita fraca, só para leitura do alcance */
      if (fq && w.beams[0]) {
        const px = sx(g.p.x),
          py = sy(g.p.y - 3);
        ctx.globalAlpha = 0.1;
        ctx.strokeStyle = pal[2];
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        for (const b of w.beams) {
          ctx.beginPath();
          ctx.arc(px, py, b.len, 0, TAU);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      for (const b of w.beams) {
        const trail = (w.trail && w.trail[b.i]) || [];
        /* rastro de brasas */
        for (let k = 0; k < trail.length - 1; k++) {
          const t = trail[k],
            f = (k + 1) / trail.length,
            sz = f > 0.6 ? 2 : 1;
          ctx.globalAlpha = f * 0.75;
          ctx.fillStyle = f > 0.7 ? pal[2] : pal[1];
          ctx.fillRect(Math.round(sx(t.x)) - 1, Math.round(sy(t.y)) - 1, sz, sz);
        }
        const x = Math.round(sx(b.x)),
          y = Math.round(sy(b.y)),
          fl = Math.sin(g.t * 14 + b.i * 1.9) > 0 ? 1 : 0;
        if (fq) {
          ctx.globalCompositeOperation = "lighter";
          glow(b.x, b.y, 16 + big * 5, pal[1], 0.3);
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.globalAlpha = 1;
        /* corpo do orbe (círculo em pixels) */
        ctx.fillStyle = pal[0];
        ctx.fillRect(x - 2 - big, y - 1 - big, 5 + 2 * big, 3 + 2 * big);
        ctx.fillRect(x - 1 - big, y - 2 - big, 3 + 2 * big, 5 + 2 * big);
        ctx.fillStyle = pal[1];
        ctx.fillRect(x - 1 - big, y - 1 - big, 3 + 2 * big, 3 + 2 * big);
        ctx.fillStyle = pal[2];
        ctx.fillRect(x - big, y - big, 2 + big, 2 + big);
        ctx.fillStyle = pal[3];
        ctx.fillRect(x - big, y - big, 1 + big, 1 + big);
        /* chama de candeeiro no alto do orbe */
        ctx.fillStyle = pal[1];
        ctx.fillRect(x, y - 4 - big - fl, 1, 2 + fl);
        ctx.fillStyle = pal[3];
        ctx.fillRect(x, y - 3 - big, 1, 1);
        /* faíscas que se soltam */
        if (Math.sin(g.t * 9 + b.i * 3.3) > 0.82) {
          ctx.fillStyle = pal[3];
          ctx.fillRect(
            x + Math.round(Math.cos(b.a + 1.6) * 4),
            y + Math.round(Math.sin(b.a + 1.6) * 4),
            1,
            1,
          );
        }
      }
    }
    ctx.restore();
  }

  /* ---------- projéteis genéricos das Evoluções Supremas ---------- */
  function nxProjFx(f, dt) {
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    forNear(f.x, f.y, f.r + 26, (e) => {
      if (f.hit.has(e)) return;
      const dx = e.x - f.x,
        dy = e.y - f.y,
        d = Math.hypot(dx, dy) || 1;
      if (d < f.r + e.r) {
        f.hit.add(e);
        hurtBy(
          f.wid || f.k || "fx",
          e,
          f.dmg,
          f.vx / f.sp,
          f.vy / f.sp,
          f.knock,
        );
        fxSpark(f.x, f.y, f.col || "#fff0a3", 6);
        if (f.hit.size > f.pierce) f.life = -1;
      }
    });
  }
  FXR.nxp = (f, k, g) => {
    const x = sx(f.x),
      y = sy(f.y);
    if (f.style === "swordwave") {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(f.ang);
      ctx.strokeStyle = "rgba(255,245,190,.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-6, 0, 11, -1.05, 1.05);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.9)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(-6, 0, 11, -1, 1);
      ctx.stroke();
      ctx.restore();
      glow(f.x, f.y, 14, "rgba(255,230,140,1)", 0.45);
    } else if (f.style === "holybolt") {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(f.ang);
      ctx.fillStyle = "rgba(255,250,210,.95)";
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-2, -2.5);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-2, 2.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      glow(f.x, f.y, 11, "rgba(255,240,150,1)", 0.6);
    } else {
      ctx.fillStyle = f.col || "#9fe0ff";
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(x - 1, y - 1, 2, 2);
      glow(f.x, f.y, 9, "rgba(160,225,255,1)", 0.5);
    }
  };

  /* ================= Evoluções Supremas: arma Nv 6 + dom Nv 3 → a Arca revela a forma suprema ================= */
  /* Evoluções Supremas: dados (nome, versículo, texto, dom e ops de atributos) em registry.js → supremeEvolutions */
  const NX_EVO = {};
  for (const id in FE_CONTENT.supremeEvolutions) {
    const E = FE_CONTENT.supremeEvolutions[id];
    NX_EVO[id] = {
      dom: E.dom,
      n: E.n,
      ref: E.ref,
      d: E.d,
      ap: (w) => applyContentStatOperations(w.s, E.ops),
    };
  }

  function nxEligible() {
    const g = G,
      out = [];
    if (!g || !g.W || !g.evo) return out;
    for (const id in NX_EVO) {
      const w = g.W[id],
        E = NX_EVO[id];
      if (
        w &&
        w.lvl >= MAXW &&
        !g.evo[id] &&
        (g.P[E.dom] || 0) >= NXV.domLv &&
        PASSIVES[E.dom]
      )
        out.push(id);
    }
    return out;
  }
  function nxApplyEvo(id) {
    const g = nxState(),
      E = NX_EVO[id],
      w = g.W[id];
    if (!w || g.evo[id]) return;
    g.evo[id] = 1;
    BTL.event("evolution", { weapon: id, weaponLevel: w.lvl });
    E.ap(w);
    g.nx.ready[id] = 0;
    g.flash = 0.7;
    g.shake = 0.45;
    burst(g.p.x, g.p.y, 36, "#ffd86b", 130);
    nxS("evo");
    g.fx.push({
      k: "pillar",
      x: g.p.x,
      y: g.p.y,
      t: 0,
      life: 0.9,
      follow: true,
    });
    banner(E.n, "Evolução Suprema");
    toast("Evolução Suprema: " + E.n + "!");
    if (id === "shield" || id === "angels") w.ang = w.ang || 0;
  }
  function nxState() {
    const g = G;
    if (!g.evo) g.evo = {};
    if (!g.nx) g.nx = { ready: {}, tm: {}, chk: 0, lastNsh: null };
    if (!g.hm)
      g.hm = {
        n: 0,
        arrowCount: 0,
        stk: 0,
        stkT: 0,
        rage: 0,
        fury: 0,
        tA: 0,
        tB: 0,
        rr: Math.max(0, Number(HEROES[g.hk] && HEROES[g.hk].freeRerolls) || 0),
        first: {},
        mem: 0,
      };
    return g;
  }

  /* ---------- cartas: a Arca (e, às vezes, o nível) oferece a Evolução Suprema ---------- */
  const _nxRoll = rollChoices;
  rollChoices = function () {
    const out = _nxRoll(),
      g = G;
    if (!g || !g.pending[0]) return out;
    const pd = g.pending[0];
    if (pd.kind !== "ark" && pd.kind !== "lvl") return out;
    const el = nxEligible();
    if (!el.length) return out;
    if (pd.kind === "lvl" && rng() > NXV.evoChance) return out;
    const isTree = (c) => /Branch|Node/.test(c.kind);
    let idx = 0;
    if (isTree(out[0])) idx = 1;
    out[idx] = { kind: "evo", id: el[0] };
    return out;
  };
  const _rollWithEvolutions = rollChoices;
  rollChoices = function () {
    const g = G,
      tools = g && g.choiceTools;
    if (!tools || !tools.banished.length) return _rollWithEvolutions();
    const blocked = new Set(tools.banished),
      result = [],
      seen = new Set();
    const addAvailable = (choices) => {
      for (const choice of choices) {
        const key = cardKey(choice);
        if (blocked.has(key) || seen.has(key)) continue;
        result.push(choice);
        seen.add(key);
        if (result.length >= 3) break;
      }
    };
    addAvailable(_rollWithEvolutions());
    for (let attempt = 0; result.length < 3 && attempt < 8; attempt++)
      addAvailable(_rollWithEvolutions());
    return result;
  };
  const _nxOlu = openLevelUp;
  openLevelUp = function () {
    _nxOlu();
    try {
      const box = $("#cards");
      curChoices.forEach((c, i) => {
        if (c.kind !== "evo") return;
        const b = box.children[i];
        if (!b) return;
        const E = NX_EVO[c.id],
          W = WEAPONS[c.id];
        b.className = "card k-evo is-evolution is-mastery";
        b.style.setProperty("--evo-color", "#f2c14e");
        b.dataset.evoOwner = c.id;
        b.dataset.evoPath = "supreme";
        b.innerHTML =
          "<kbd>" +
          (i + 1) +
          '</kbd><div class="cb"><span class="cn">' +
          E.n +
          '</span><span class="mastery-stamp">✦ EVOLUÇÃO SUPREMA ✦</span></div><div class="ca"><img class="ci" alt="" src="' +
          evolutionIconURL(c.id, "supreme", true) +
          '"></div><div class="ct">' +
          W.name +
          " · " +
          PASSIVES[E.dom].name +
          '</div><div class="cd">' +
          E.d +
          '</div><div class="cr">' +
          E.ref +
          "</div>";
      });
      const g = G;
      if (g && g.hm) {
        const free =
          g.hm.rr > 0 && Number(HEROES[g.hk] && HEROES[g.hk].freeRerolls) > 0;
        if (free) rrb.innerHTML = "Novas Bênçãos (" + g.hm.rr + " grátis)";
        else if (rrb.dataset.nxd) rrb.innerHTML = rrb.dataset.nxd;
      }
    } catch (e) { }
    refreshChoiceToolUI();
  };
  rrb.dataset.nxd = rrb.innerHTML;
  const _nxRrClick = rrb.onclick;
  rrb.onclick = () => {
    if (
      G &&
      G.hm &&
      G.hm.rr > 0 &&
      Number(HEROES[G.hk] && HEROES[G.hk].freeRerolls) > 0 &&
      state === "levelup"
    ) {
      BTL.rerollChoice("free_hero");
      G.hm.rr--;
      if (G.choiceTools) G.choiceTools.action = null;
      G.rr = 1;
      for (const o of curChoices) if (o.id) G.snub[cardKey(o)] = G.offerN + 2;
      openLevelUp();
      return;
    }
    _nxRrClick();
  };
  const _nxChoose = chooseIdx;
  chooseIdx = function (i) {
    const c = curChoices[i];
    if (
      state === "levelup" &&
      c &&
      c.kind === "evo" &&
      !(G.choiceTools && G.choiceTools.action === "banish") &&
      performance.now() >= LV_LOCK
    ) {
      G.actLock = performance.now() + 700;
      for (const o of curChoices)
        if (o !== c && o.id) G.snub[cardKey(o)] = G.offerN + SNUB_N;
      nxApplyEvo(c.id);
      G.pending.shift();
      fxGain({ kind: "w" });
      $("#lvlup").hidden = true;
      buildRack();
      if (G.pending.length) openLevelUp();
      else {
        state = "play";
        last = performance.now();
        syncFpsHud();
        if (G.t > 1) {
          G.resumeT = 0.9;
          toast("Prepare-se…");
        }
      }
      return;
    }
    return _nxChoose(i);
  };

  /* ---------- ganchos de dano / morte ---------- */
  const _nxHurt = hurt;
  hurt = function (e, d, kx, ky, kb) {
    const g = G;
    if (g && e && !e.dead) {
      if (e.vulnT > 0) d *= 1 + (e.vulnAmt || 0.25);
      const hm = g.hm;
      if (hm) {
        if (heroPowerBehavior(g.hk) === "broken_chains" && hm.stk > 0)
          d *= 1 + 0.06 * hm.stk;
        else if (heroPowerBehavior(g.hk) === "nazirite_fury" && hm.fury > 0)
          d *= 1.4;
      }
    }
    return _nxHurt(e, d, kx, ky, kb);
  };
  const _nxKill = kill;
  kill = function (e) {
    const g = G;
    if (!e || e.dead || !g) return _nxKill(e);
    const haul = e.haulUntil && g.t < e.haulUntil ? e.haulLv : 0;
    _nxKill(e);
    if (g.hm && heroPowerBehavior(g.hk) === "nazirite_fury" && g.hm.fury <= 0)
      g.hm.rage = Math.min(10, g.hm.rage + 0.12);
    if (haul) {
      drop(e.x + 3, e.y, "f2");
      if (haul > 1) drop(e.x - 3, e.y, "f2");
      if (rng() < (haul > 1 ? 0.5 : 0.3)) drop(e.x, e.y + 3, "coin");
    }
  };
  const _nxHurtP = hurtPlayer;
  hurtPlayer = function (d, src) {
    const g = G,
      p = g && g.p;
    if (
      !g ||
      !p ||
      !g.hm ||
      !["broken_chains", "nazirite_fury"].includes(heroPowerBehavior(g.hk))
    )
      return _nxHurtP(d, src);
    const hp0 = p.hp,
      inv0 = p.inv,
      sh0 = p.sh;
    _nxHurtP(d, src);
    const took = p.hp < hp0,
      blocked = !took && p.inv > inv0 && sh0 <= 0;
    if (heroPowerBehavior(g.hk) === "broken_chains" && (took || blocked)) {
      const h = g.hm;
      h.stk = Math.min(5, h.stk + 1);
      h.stkT = 6;
      burst(p.x, p.y, 14, "#e6edf6", 90);
      g.fx.push({
        wid: "nx_event",
        k: "ring",
        x: p.x,
        y: p.y,
        r: 3,
        maxr: 58,
        dmg: (5 + g.lvl * 0.6) * g.mods.dmg,
        knock: 70,
        style: "horn",
        hit: new Set(),
        t: 0,
        life: 0.35,
        follow: true,
      });
    } else if (
      heroPowerBehavior(g.hk) === "nazirite_fury" &&
      took &&
      g.hm.fury <= 0
    )
      g.hm.rage = Math.min(10, g.hm.rage + 1.5);
  };

  /* ---------- laço principal do pacote ---------- */
  const _nxUw = updWeapons;
  updWeapons = function (dt) {
    const g = G;
    if (!g || g.over || !g.p) return _nxUw(dt);
    nxState();
    nxPre(dt);
    _nxUw(dt);
    if (!G || G.over) return;
    nxPost(dt);
  };
  function nxPre(dt) {
    const g = G,
      p = g.p;
    if (!g.eshots.length) return;
    for (const [id, w] of Object.entries(g.W || {})) {
      if (
        !w ||
        !WEAPONS[id] ||
        WEAPONS[id].behavior !== "orbiting_shields" ||
        !nxHas(id)
      )
        continue;
      const s = w.s,
        tr = nxTree(id),
        count = s.count + (tr.p === "bastion" ? (tr.t ? 2 : 1) : 0),
        radius = s.radius + (tr.p === "orbit" ? (tr.t ? 10 : 5) : 0);
      for (let i = 0; i < count; i++) {
        const a = w.ang + (i * TAU) / count,
          ax = p.x + Math.cos(a) * radius,
          ay = p.y + Math.sin(a) * radius;
        for (const q of g.eshots)
          if (!q.dead && Math.hypot(q.x - ax, q.y - ay) < 11) {
            q.dead = true;
            const ang = Math.atan2(-q.vy, -q.vx);
            nxProj("orb", q.x, q.y, ang, 150, s.dmg * g.mods.dmg * 2, {
              r: 5,
              pierce: 1,
              life: 1.4,
              col: "#9fe0ff",
              knock: 30,
            });
          }
      }
    }
  }
  const nxEvTimer = (id, key, every, dt) => {
    const tm = G.nx.tm;
    tm[key] = (tm[key] == null ? every : tm[key]) - dt;
    if (tm[key] <= 0) {
      tm[key] = every;
      return true;
    }
    return false;
  };
  function nxPost(dt) {
    const g = G,
      p = g.p,
      m = g.mods,
      W = g.W;
    g.signalZones = g.signalZones.filter((zone) => g.fx.includes(zone));
    const zoneBonuses = g.signalZones.reduce(
      (best, zone) => {
        if (Math.hypot(p.x - zone.x, p.y - zone.y) > zone.r) return best;
        return {
          crit: Math.max(best.crit, zone.crit),
          range: Math.max(best.range, zone.range),
        };
      },
      { crit: 0, range: 0 },
    );
    const inSignalZone = zoneBonuses.crit > 0;
    if (
      inSignalZone !== g.signalZoneActive ||
      zoneBonuses.crit !== g.signalZoneCrit ||
      zoneBonuses.range !== g.signalZoneRange
    ) {
      g.signalZoneActive = inSignalZone;
      g.signalZoneCrit = zoneBonuses.crit;
      g.signalZoneRange = zoneBonuses.range;
      recalc();
    }
    const extendedWeaponHandlers = {
      water_wall: nxStaff,
      returning_axe: nxAxe,
      returning_ravens: nxRaven,
      ground_zones: nxJars,
      snare_net: nxNet,
      expanding_ring: nxFirewall,
      thrown_swords: nxSword,
      lash_line: nxWhip,
      rotating_beams: nxMenorah,
    };
    for (const [id, weaponRun] of Object.entries(W)) {
      const handler =
        extendedWeaponHandlers[WEAPONS[id] && WEAPONS[id].behavior];
      if (handler) nxAs(id, handler, weaponRun, dt, id);
    }
    /* efeitos próprios */
    for (const f of g.fx) {
      if (f.wait > 0) continue;
      if (f.k === "sea") nxSeaFx(f, dt);
      else if (f.k === "axe") nxAxeFx(f, dt);
      else if (f.k === "raven") nxRavenFx(f, dt);
      else if (f.k === "jzone") nxZoneFx(f, dt);
      else if (f.k === "net") nxNetFx(f, dt);
      else if (f.k === "fwall") nxFwallFx(f, dt);
      else if (f.k === "whip") nxWhipFx(f, dt);
      else if (f.k === "nxp") nxProjFx(f, dt);
    }
    /* espelhos: reage a efeitos criados pelas armas originais para aplicar a Evolução Suprema */
    if (
      nxHas("trumpet") ||
      nxHas("fire") ||
      nxHas("jawbone") ||
      nxHas("scepter")
    ) {
      for (const f of g.fx) {
        if (f.nx) continue;
        if (
          f.k === "ring" &&
          f.style === "horn" &&
          f.follow &&
          !f.fromNx &&
          nxHas("trumpet") &&
          !f.wait
        ) {
          f.nx = 1;
          for (let i = 1; i <= 6; i++)
            g.fx.push(
              Object.assign({}, f, {
                r: 4,
                dmg: f.dmg * (0.65 - i * 0.04),
                maxr: f.maxr * (1 + 0.07 * i),
                hit: new Set(),
                t: 0,
                wait: 0.17 * i,
                nx: 1,
                fromNx: 1,
                knock: f.knock * 0.3,
                bossMult: f.bossMult,
              }),
            );
        } else if (f.k === "flame" && nxHas("fire")) {
          f.nx = 1;
          f.burn = true;
          f.burnDuration = 3.2;
          f.burnRatio = 0.16;
          nxZone(f.x, f.y, {
            r: f.r * 0.8,
            dur: 2.4,
            dmg: f.dmg * 0.12,
            tick: 0.5,
            delay: f.delay,
            style: "carmel",
            burn: true,
            burnT: 2.6,
            vuln: 0,
            shard: 0,
          });
        } else if (
          f.k === "slash" &&
          f.style === "jawbone" &&
          nxHas("jawbone")
        ) {
          f.nx = 1;
          const s = g.W.jawbone.s;
          g.fx.push({
            wid: "jawbone",
            k: "ring",
            x: p.x,
            y: p.y,
            r: 3,
            maxr: 78,
            dmg: s.dmg * m.dmg * 0.8,
            knock: 95,
            style: "quake",
            hit: new Set(),
            t: 0,
            wait: 0.12,
            life: 0.3,
            follow: true,
            nx: 1,
          });
        } else if (f.k === "bolt" && nxHas("scepter")) {
          f.nx = 1;
          f.chainCount = 2;
          f.chainMult = 0.5;
        }
      }
      for (const f of g.fx)
        if (f.k === "bolt" && f.done && f.nx === 1 && nxHas("scepter")) {
          f.nx = 2;
          forNear(f.x, f.y, f.r + 22, (e) => {
            if (e.boss) {
              e.slowT = 1;
              e.slowAmt = 0.5;
            } else {
              e.slowT = 1.6;
              e.slowAmt = 1;
            }
          });
        }
    }
    /* disparos novos das armas originais */
    if (nxHas("dove") || heroPowerBehavior(g.hk) === "fifth_stone")
      for (const s of g.shots) {
        if (s.nx) continue;
        s.nx = 1;
        if (s.k === "dove" && nxHas("dove")) s.pierce = Math.max(s.pierce, 1);
        else if (s.k === "stone" && heroPowerBehavior(g.hk) === "fifth_stone") {
          g.hm.n++;
          if (g.hm.n % 5 === 0) {
            s.dmg *= 3;
            s.pierce += 3;
            s.r = 5;
            s.big = true;
            s.life = 2;
            fxSpark(s.x, s.y, "#fff3a0", 12);
          }
        }
      }
    /* especiais por evolução */
    if (g.evo.sling && nxEvTimer("sling", "sling", 5, dt) && W.sling) {
      const s = W.sling.s;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        g.shots.push({
          k: "stone",
          x: p.x,
          y: p.y,
          vx: Math.cos(a) * 190,
          vy: Math.sin(a) * 190,
          dmg: s.dmg * m.dmg * 1.3,
          pierce: 3,
          hit: [],
          r: 3,
          life: 1.1,
          treePath: null,
          treeTier: 0,
          nx: 1,
        });
      }
      burst(p.x, p.y, 10, "#e8ecf8", 90);
    }
    if (g.evo.aura && W.aura) {
      if (nxEvTimer("aura", "auraH", 5, dt)) {
        const rad = W.aura.s.radius;
        if (nearestList(p.x, p.y, rad, 1).length && p.hp < m.maxhp) healP(HPS);
      }
      if (nxEvTimer("aura", "auraP", 6, dt))
        g.fx.push({
          wid: "aura",
          k: "ring",
          x: p.x,
          y: p.y,
          r: 3,
          maxr: W.aura.s.radius + 16,
          dmg: W.aura.s.dmg * m.dmg * 1.5,
          knock: 24,
          style: "pulse",
          hit: new Set(),
          t: 0,
          life: 0.36,
          follow: true,
        });
    }
    if (g.evo.dove && nxEvTimer("dove", "dove", 6, dt)) {
      if (p.hp < m.maxhp) healP(HPS);
      g.fx.push({
        wid: "dove",
        k: "ring",
        x: p.x,
        y: p.y,
        r: 3,
        maxr: 60,
        dmg: (W.dove ? W.dove.s.dmg : 4) * m.dmg * 0.5,
        knock: 60,
        style: "horn",
        hit: new Set(),
        t: 0,
        life: 0.4,
        follow: true,
      });
      burst(p.x, p.y, 12, "#ffffff", 80);
    }
    if (g.evo.angels && W.angels && nxEvTimer("angels", "angels", 4.5, dt)) {
      const w = W.angels,
        s = w.s,
        count = Math.min(6, s.count + 0);
      for (let i = 0; i < count; i++) {
        const a = w.ang + (i * TAU) / count,
          ax = p.x + Math.cos(a) * s.radius,
          ay = p.y + Math.sin(a) * s.radius,
          l = nearestList(ax, ay, 190, 3),
          tg = l[i % Math.max(1, l.length)];
        if (tg)
          nxProj(
            "holybolt",
            ax,
            ay,
            Math.atan2(tg.y - ay, tg.x - ax),
            230,
            s.dmg * m.dmg * 2.2,
            { r: 6, pierce: 2, life: 1.1, knock: 30 },
          );
      }
      nxS("bolt");
    }
    /* medidor, anúncios e Poder Heroico */
    g.nx.chk -= dt;
    if (g.nx.chk <= 0) {
      g.nx.chk = 0.5;
      let dirty = false;
      for (const id of nxEligible())
        if (!g.nx.ready[id]) {
          g.nx.ready[id] = 1;
          dirty = true;
          toast(
            "Evolução Suprema pronta: " +
            NX_EVO[id].n +
            "! Ela aparece na próxima Arca",
          );
          SFX.play("level");
        }
      for (const id in g.nx.ready)
        if (g.nx.ready[id] && g.evo[id]) {
          g.nx.ready[id] = 0;
          dirty = true;
        }
      if (dirty) buildRack();
    }
    for (const e of g.enemies) {
      if (e.vulnT > 0) e.vulnT -= dt;
    }
    nxHero(dt);
  }
  const _nxDs = drawShots;
  drawShots = function (g) {
    _nxDs(g);
    nxDrawBeams(g);
    for (const s of g.shots)
      if (s.big) glow(s.x, s.y, 13, "rgba(255,240,150,1)", 0.8);
  };
  const _nxDe = drawEnemy;
  drawEnemy = function (e, g, air) {
    _nxDe(e, g, air);
    if (e.vulnT > 0 && FXQ()) {
      const x = sx(e.x),
        y = sy(e.y - e.r - 6 + Math.sin(g.t * 6 + e.ph) * 1);
      ctx.fillStyle = "rgba(255,215,90,.95)";
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y + 1, 1, 1);
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.fillRect(x, y - 1, 1, 1);
    }
  };
  const _nxBh = buildHTML;
  buildHTML = function () {
    let h = _nxBh();
    const g = G;
    if (g && g.evo)
      for (const id in g.evo)
        if (g.evo[id] && NX_EVO[id])
          h +=
            '<div class="tree-ribbon mastered" style="--evo-color:#ffd86b"><img alt="" src="' +
            evolutionIconURL(id, "supreme", true) +
            '"><span><b>' +
            NX_EVO[id].n +
            "</b><small>✦ Evolução Suprema</small></span></div>";
    return h;
  };
  const _nxLibDetail = libDetail;
  libDetail = function (e) {
    const D = _nxLibDetail(e);
    if (e.g === "w" && NX_EVO[e.id]) {
      const E = NX_EVO[e.id];
      D.evo.push([
        "Evolução Suprema",
        E.n +
        " — " +
        E.d +
        " Requer: " +
        PASSIVES[E.dom].name +
        " Nv " +
        NXV.domLv +
        "+ · " +
        WEAPONS[e.id].name +
        " Nv " +
        MAXW +
        ". A Arca revela a evolução.",
      ]);
    }
    return D;
  };

  /* ================= Heróis: Poder Heroico (mecânica própria) + 3 heróis novos ================= */

  const NXH = ["gideao", "pedro", "moises"];

  for (const k of NXH)
    Object.defineProperty(HX[k], "quest", {
      get: () => HU[k].coins + " moedas",
      configurable: true,
      enumerable: true,
    });

  {
    const mm = HX.mendigo;
    delete HX.mendigo;
    HX.mendigo = mm;
    const mh = HEROES.mendigo;
    delete HEROES.mendigo;
    HEROES.mendigo = mh;
  }

  /* Poder Heroico: texto exibido na tela de heróis e na biblioteca */
  const NX_SIG = FE_CONTENT.heroPowers;

  /* Hero pixel art and palette data are supplied by FE_CONTENT.heroArt. */

  /* ---------- medidor do Poder Heroico (HUD) ---------- */
  const nxMeter = document.createElement("div");
  nxMeter.id = "nxMeter";
  nxMeter.hidden = true;
  nxMeter.innerHTML = "<i></i><span></span>";
  {
    const tl = $("#tlcol"),
      cn = $("#coins");
    if (tl) tl.insertBefore(nxMeter, cn && cn.parentNode === tl ? cn : null);
    else $("#hud").appendChild(nxMeter);
  }
  let nxMeterKey = "";
  function nxMeterSet(label, v, hot) {
    const key = label + "|" + Math.round(v * 50) + "|" + (hot ? 1 : 0);
    if (key === nxMeterKey) return;
    nxMeterKey = key;
    nxMeter.hidden = false;
    nxMeter.classList.toggle("hot", !!hot);
    nxMeter.firstChild.style.width = Math.max(0, Math.min(100, v * 100)) + "%";
    nxMeter.lastChild.textContent = label;
  }
  function nxMeterOff() {
    if (!nxMeter.hidden) {
      nxMeter.hidden = true;
      nxMeterKey = "";
    }
  }

  /* ---------- Poder Heroico: lógica por herói ---------- */
  function nxHero(dt) {
    const g = G,
      p = g.p,
      m = g.mods,
      h = g.hm,
      hk = g.hk,
      behavior = heroPowerBehavior(hk);
    let lab = null,
      val = 0,
      hot = false;
    if (behavior === "covenant_archery") {
      const arrows = h.arrowCount || 0;
      lab = "Flecha de Sinal";
      val = (arrows % 5) / 5;
      hot = arrows % 5 === 4;
    } else if (behavior === "fifth_stone") {
      lab = "Pedra Lisa";
      val = (h.n % 5) / 5;
      hot = h.n % 5 === 4;
    } else if (behavior === "broken_chains") {
      if (h.stkT > 0) {
        h.stkT -= dt;
        if (h.stkT <= 0) h.stk = 0;
      }
      lab = "Zelo ×" + h.stk;
      val = h.stk / 5;
      hot = h.stk >= 5;
    } else if (behavior === "palm_sentence") {
      const R = g.W.aura ? g.W.aura.s.radius : 56,
        r2 = R * R;
      for (const e of g.enemies) {
        if (e.dead) continue;
        const dx = e.x - p.x,
          dy = e.y - p.y;
        if (dx * dx + dy * dy < (R + e.r) * (R + e.r)) {
          e.jt = (e.jt || 0) + dt;
          if (e.jt >= 1.2) {
            e.vulnT = Math.max(e.vulnT || 0, 4);
            e.vulnAmt = Math.max(e.vulnAmt || 0, 0.3);
          }
        } else if (e.jt > 0) e.jt = Math.max(0, e.jt - dt * 0.5);
      }
      h.tA += dt;
      if (h.tA >= 40) {
        h.tA = 0;
        for (const q of g.pk)
          if (q.type[0] === "f" || q.type === "coin") q.mag = true;
        toast("Canto de Débora: a Fé vem até você");
        SFX.play("heal");
        g.fx.push({
          wid: "hero_debora",
          k: "ring",
          x: p.x,
          y: p.y,
          r: 3,
          maxr: 90,
          dmg: 0,
          knock: 0,
          style: "pulse",
          hit: new Set(),
          t: 0,
          life: 0.5,
          follow: true,
        });
      }
      lab = "Canto";
      val = h.tA / 40;
    } else if (behavior === "nazirite_fury") {
      if (h.fury > 0) {
        h.fury -= dt;
        lab = "FÚRIA!";
        val = h.fury / 8;
        hot = true;
        if (h.fury <= 0) {
          h.fury = 0;
          h.rage = 0;
        }
      } else {
        if (h.rage >= 10) {
          h.fury = 8;
          h.rage = 10;
          g.shake = 0.5;
          g.flash = 0.35;
          nxS("rage");
          toast("Fúria Nazireia!");
          burst(p.x, p.y, 30, "#d9b27a", 130);
          g.fx.push({
            wid: "hero_sansao",
            k: "ring",
            x: p.x,
            y: p.y,
            r: 3,
            maxr: 150,
            dmg: (22 + 2 * g.lvl) * m.dmg,
            knock: 130,
            style: "quake",
            hit: new Set(),
            t: 0,
            life: 0.5,
            follow: true,
          });
        }
        lab = "Fúria";
        val = h.rage / 10;
      }
    } else if (behavior === "royal_decree") {
      if (g.nsh != null) {
        if (g.nx.lastNsh == null) g.nx.lastNsh = g.nsh;
        else if (g.nsh !== g.nx.lastNsh) {
          g.nx.lastNsh = g.nsh;
          nxDecree();
        }
        lab = "Decreto";
        val = clampNx(1 - (g.nsh - g.t) / 60);
      } else {
        lab = "Decreto";
        val = clampNx(g.t / 60);
      }
    } else if (behavior === "heaven_fire") {
      h.tA += dt;
      if (h.tA >= 18) {
        h.tA = 0;
        nxCarmel();
      }
      lab = "Fogo do Céu";
      val = h.tA / 18;
    } else if (behavior === "parting_waters") {
      h.tA += dt;
      if (h.tA >= 40) {
        h.tA = 0;
        nxWaters();
      }
      lab = "Águas";
      val = h.tA / 40;
    } else if (behavior === "keys_kingdom") {
      lab = "Trocas grátis " + h.rr;
      val = h.rr / 3;
    } else if (behavior === "jericho_march") {
      if (p.moving) h.tA += dt;
      if (h.tA >= JT.period) {
        h.tA = 0;
        nxJericho();
      }
      lab = JT.label;
      val = h.tA / JT.period;
      hot = h.tA >= JT.hotAt;
    }
    if (lab && state !== "menu") nxMeterSet(lab, val, hot);
    else nxMeterOff();
  }
  const clampNx = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  function nxDecree() {
    const g = G,
      p = g.p;
    nxS("decree");
    toast("Decreto Real!");
    g.flash = 0.3;
    forNear(p.x, p.y, 130, (e) => {
      if (e.boss) {
        e.slowT = 1.5;
        e.slowAmt = 0.5;
      } else {
        e.slowT = 2.2;
        e.slowAmt = 1;
      }
    });
    g.fx.push({
      wid: "decree",
      k: "ring",
      x: p.x,
      y: p.y,
      r: 3,
      maxr: 120,
      dmg: (12 + g.lvl * 1.2) * g.mods.dmg,
      knock: 60,
      style: "judg",
      hit: new Set(),
      t: 0,
      life: 0.55,
      follow: true,
    });
    for (const q of g.pk) if (q.type === "coin") q.mag = true;
  }
  function nxCarmel() {
    const g = G,
      p = g.p,
      list = nearestList(p.x, p.y, 175, 60)
        .sort((a, b) => (b.boss ? 9999 : b.hp) - (a.boss ? 9999 : a.hp))
        .slice(0, 4);
    if (!list.length) return;
    SFX.play("fire");
    if (!g.hm.first.carmel) {
      g.hm.first.carmel = 1;
      toast("Fogo do Céu!");
    }
    for (const e of list)
      g.fx.push({
        wid: BTL.src || null,
        k: "flame",
        x: e.x,
        y: e.y,
        r: 26,
        dmg: (14 + 2 * g.lvl) * g.mods.dmg,
        t: 0,
        delay: 0.55,
        life: 0.95,
        done: false,
        burn: true,
        burnDuration: 3,
        burnRatio: 0.2,
      });
  }
  function nxWaters() {
    const g = G,
      p = g.p;
    nxS("sea");
    toast("As águas se abrem!");
    g.shake = 0.4;
    g.flash = 0.25;
    forNear(p.x, p.y, 210, (e) => {
      const dx = e.x - p.x,
        dy = e.y - p.y,
        d = Math.hypot(dx, dy) || 1;
      if (!e.boss) {
        e.kx += (dx / d) * 230;
        e.ky += (dy / d) * 230;
      }
      e.slowT = Math.max(e.slowT || 0, 3.5);
      e.slowAmt = Math.max(e.slowAmt || 0, 0.6);
    });
    for (const q of g.eshots)
      if (Math.hypot(q.x - p.x, q.y - p.y) < 210) q.dead = true;
    g.p.sh = Math.max(g.p.sh, 1);
    g.fx.push({
      wid: "nx_waters",
      k: "ring",
      x: p.x,
      y: p.y,
      r: 3,
      maxr: 200,
      dmg: 0,
      knock: 0,
      style: "horn",
      hit: new Set(),
      t: 0,
      life: 0.6,
      follow: true,
    });
  }

  const _nxEnd = endRun;
  endRun = function () {
    nxMeterOff();
    return _nxEnd.apply(this, arguments);
  };

  /* Gideão: 5º espaço de arma */
  const _nxSr = startRun;
  startRun = function () {
    _nxSr();
    const extraSlots =
      (G && Number(HEROES[G.hk] && HEROES[G.hk].extraWeaponSlots)) || 0;
    if (G && extraSlots > 0 && !G.inf)
      SLOT_W = Math.min(MAXW, SLOT_W + extraSlots);
  };

  /* ---------- telas de herói e biblioteca ---------- */
  const _nxRh = renderHeroes;
  renderHeroes = function (b) {
    _nxRh(b);
    const v = viewHero,
      SG = NX_SIG[v],
      det = b.querySelector(".hero-details");
    if (!SG || !det) return;
    const titles = det.querySelectorAll(".hero-section-title"),
      anchor = titles[3];
    if (!anchor) return;
    const wrap = document.createElement("div");
    wrap.className = "hero-sig";
    wrap.innerHTML =
      '<div class="hero-section-title">PODER HEROICO</div><b class="hero-gold">' +
      SG.n +
      '</b><div class="hero-muted">' +
      SG.d +
      "</div>";
    anchor.parentNode.insertBefore(wrap, anchor);
  };
  const _nxLhe = libHeroEntries;
  libHeroEntries = function () {
    const L = _nxLhe();
    for (const x of L) {
      const S = NX_SIG[x.id];
      if (S)
        x.graceD =
          (x.graceD ? x.graceD + " " : "") +
          "PODER HEROICO · " +
          S.n +
          ": " +
          S.d;
    }
    return L;
  };
  /* brilho extra dos novos heróis durante o ataque */
  const _nxHx = heroExtra;
  heroExtra = function (g, p) {
    _nxHx(g, p);
    const H = HFR[g.hk];
    if (!FXQ() || !H || S.hero[g.hk][0] !== H.base0) return;
    const dir = p.face < 0 ? -1 : 1,
      t = g.t,
      acting = t - (g.hAct == null ? -9 : g.hAct) < 0.24;
    if (g.hk === "gideao")
      glow(
        p.x + dir * 5.5,
        p.y - 11,
        acting ? 11 : 7,
        "rgba(255,150,40,1)",
        0.45 + 0.2 * Math.sin(t * 19),
      );
    else if (g.hk === "moises" && acting)
      glow(p.x + dir * 6, p.y - 8, 12, "rgba(120,200,255,1)", 0.6);
    else if (g.hk === "pedro" && acting)
      glow(p.x + dir * 6, p.y - 8, 9, "rgba(233,220,192,1)", 0.5);
  };
  window.__nx =
    IS_NATIVE || !/[?&]debug\b/.test(location.search)
      ? null
      : {
        NX_EVO,
        NX_SIG,
        nxEligible,
        nxApplyEvo,
        nxCarmel,
        nxWaters,
        nxDecree,
        nxState,
        WEAPONS,
        PASSIVES,
        EVOLUTION_TREES,
        HX,
        HU,
        statsFor,
        addWeapon,
        MAXW,
        rollChoices,
        get curChoices() {
          return curChoices;
        },
        get SLOT_W() {
          return SLOT_W;
        },
        get LV_LOCK() {
          return LV_LOCK;
        },
        openLevelUp,
        spawnEnemy,
        draw: () => draw(),
        buildHTML,
        buildRack,
        FXR,
        libEntries,
        libDetail,
        iconURL,
        evolutionIconURL,
      };

  /* ================= v0.50: Mundos com identidade própria =================
     Cada mundo agora tem terreno, decoração, luz/sombras, clima, inimigo exclusivo e um evento próprio:
       Vale de Elá  — campo de batalha pastoral (chuva e trovoadas), sol pálido, sombras curtas
       Deserto de Sur — dunas, ruínas e acácias, sol baixo com sombras longas, TEMPESTADES DE AREIA, Escorpiões de Sur
       Vale da Sombra — cristais, obeliscos e árvores negras; ESCURIDÃO (a luz do herói e das armas de luz), Sombras Rastejantes */
  WORLDS.forEach((w, i) => {
    w.wi = i;
  });
  WORLDS[0].d =
    "O campo de batalha onde tudo começa. Chuva, trovoadas e as ruínas de um acampamento.";
  WORLDS[1].d =
    "Sol baixo, sombras longas e tempestades de areia que empurram tudo. Escorpiões de Sur atacam em investidas. Inimigos 12% mais rápidos e 10% mais frequentes. +25% de moedas.";
  WORLDS[2].d =
    "Escuridão: você só enxerga perto da sua luz, e as Sombras Rastejantes só sofrem dano pleno quando iluminadas. Menorá, Jarros e Fogo iluminam mais. Inimigos com 30% mais vida e 20% mais frequentes. +60% de moedas.";
  WORLDS[1].tint = null;
  WORLDS[2].tint = null; /* a cor agora vem do próprio terreno */
  const nxWi = () => {
    const w = state === "menu" || !RUN.world ? curW() : RUN.world;
    return w.wi || 0;
  };

  /* ---------- utilitários de pixel art ---------- */
  const nxPx = (g, c, x, y) => R(g, c, x, y, 1, 1);
  function nxBlob(g, cx, cy, rx, ry, base, hi, lo, seed) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x - cx) / rx,
          dy = (y - cy) / ry,
          n = (hash(x, y, seed || 3) - 0.5) * 0.28;
        if (dx * dx + dy * dy <= 1 + n) {
          const sh = -dx * 0.55 - dy * 0.85;
          nxPx(g, sh < -0.38 ? hi : sh > 0.42 ? lo : base, x, y);
        }
      }
  }
  function nxLine(g, c, x0, y0, x1, y1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++)
      nxPx(
        g,
        c,
        Math.round(x0 + ((x1 - x0) * i) / n),
        Math.round(y0 + ((y1 - y0) * i) / n),
      );
  }
  const nxOut = (c, col) =>
    mk(c.width + 2, c.height + 2, (g) => {
      const sil = mk(c.width, c.height, (h) => {
        h.drawImage(c, 0, 0);
        h.globalCompositeOperation = "source-in";
        h.fillStyle = col;
        h.fillRect(0, 0, c.width, c.height);
      });
      for (const d of [
        [0, 1],
        [2, 1],
        [1, 0],
        [1, 2],
      ])
        g.drawImage(sil, d[0], d[1]);
      g.drawImage(c, 1, 1);
    });
  const nxRows = (rows, pal, col) =>
    nxOut(
      mk(rows[0].length, rows.length, (g) => {
        for (let y = 0; y < rows.length; y++)
          for (let x = 0; x < rows[y].length; x++) {
            const ch = rows[y][x];
            if (ch !== "." && pal[ch]) nxPx(g, pal[ch], x, y);
          }
      }),
      col,
    );

  /* ---------- terreno por mundo ---------- */
  const nxTile = (base, fl, seed, extra) =>
    mk(16, 16, (g) => {
      R(g, base, 0, 0, 16, 16);
      let s = seed;
      const r = () =>
        (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
      for (let i = 0; i < 12; i++)
        R(
          g,
          fl[Math.floor(r() * fl.length)],
          Math.floor(r() * 16),
          Math.floor(r() * 16),
          r() < 0.4 ? 2 : 1,
          1,
        );
      if (extra) extra(g, r);
    });
  const nxRipple = (hi, lo) => (g, r) => {
    for (let k = 0; k < 2; k++) {
      const y = 3 + Math.floor(r() * 10),
        x = Math.floor(r() * 6);
      for (let i = 0; i < 8; i++) {
        nxPx(g, hi, x + i, y + Math.round(Math.sin(i * 0.8) * 1.2));
        nxPx(g, lo, x + i, y + 1 + Math.round(Math.sin(i * 0.8) * 1.2));
      }
    }
  };
  const nxCrack = (col, hi) => (g, r) => {
    for (let n = 0; n < 2; n++) {
      let x = 1 + Math.floor(r() * 14),
        y = 1 + Math.floor(r() * 14);
      const hz2 = r() < 0.5,
        len = 4 + Math.floor(r() * 7);
      for (let i = 0; i < len; i++) {
        nxPx(g, col, x, y);
        if (hi && i % 4 === 0)
          nxPx(g, hi, x + (hz2 ? 0 : 1), y + (hz2 ? 1 : 0));
        const j = r() < 0.4 ? (r() < 0.5 ? -1 : 1) : 0;
        if (hz2) {
          x += 1;
          y += j;
        } else {
          y += 1;
          x += j;
        }
        if (x < 0 || x > 15 || y < 0 || y > 15) break;
      }
    }
  };
  const nxPebbles = (c1, c2) => (g, r) => {
    for (let i = 0; i < 3; i++) {
      const x = 1 + Math.floor(r() * 13),
        y = 1 + Math.floor(r() * 13);
      nxPx(g, c1, x, y);
      nxPx(g, c2, x + 1, y + 1);
    }
  };
  function nxMakeTiles(spec) {
    const T = {
      tiles: { g1: [], g2: [], dirt: [] },
      tilesDay: { g1: [], g2: [], dirt: [] },
    };
    for (let i = 0; i < 4; i++)
      for (const grp of ["g1", "g2"]) {
        for (const [dst, P] of [
          [T.tiles, spec.night],
          [T.tilesDay, spec.day],
        ]) {
          const q = P[grp];
          dst[grp].push(
            nxTile(
              q.b,
              q.f,
              (grp === "g1" ? 11 : 31) + i * (grp === "g1" ? 7 : 5),
              i === 3 ? q.x3 : i % 2 ? q.x1 : null,
            ),
          );
        }
      }
    for (let i = 0; i < 3; i++)
      for (const [dst, P] of [
        [T.tiles, spec.night],
        [T.tilesDay, spec.day],
      ]) {
        const q = P.dirt;
        dst.dirt.push(nxTile(q.b, q.f, 51 + i * 9, i === 0 ? null : q.x1));
      }
    return T;
  }
  const NX_TERRAIN = {
    1: {
      /* Deserto de Sur: areia dourada, ondulações de duna e leito seco rachado */
      night: {
        g1: {
          b: "#7d5c33",
          f: ["#8e6a3b", "#6c4d29", "#9b7544"],
          x1: nxRipple("#946f40", "#5f4424"),
          x3: nxPebbles("#a07a48", "#55391d"),
        },
        g2: {
          b: "#6e5030",
          f: ["#7a5b36", "#5d4326", "#86663c"],
          x1: nxPebbles("#8a6a3e", "#4a321a"),
          x3: nxRipple("#82603a", "#503820"),
        },
        dirt: {
          b: "#5b3d28",
          f: ["#6a4a31", "#4a3020", "#775540"],
          x1: nxCrack("#32200f", "#7b5a3c"),
        },
      },
      day: {
        g1: {
          b: "#e1b96a",
          f: ["#efcb7e", "#d3a85a", "#f6d996"],
          x1: nxRipple("#f3d68c", "#c99a4c"),
          x3: nxPebbles("#caa05a", "#a67a3a"),
        },
        g2: {
          b: "#d4a557",
          f: ["#e0b568", "#c0924a", "#e8c27c"],
          x1: nxPebbles("#c39650", "#9a6e34"),
          x3: nxRipple("#e6c079", "#b98a43"),
        },
        dirt: {
          b: "#a97a4c",
          f: ["#b98a58", "#8d6338", "#c49a6a"],
          x1: nxCrack("#6f4724", "#d1a77a"),
        },
      },
    },
    2: {
      /* Vale da Sombra: rocha violeta, cinza e veios incandescentes */
      night: {
        g1: {
          b: "#221832",
          f: ["#2c2040", "#1a1126", "#37284f"],
          x1: nxPebbles("#3a2d52", "#120a1c"),
          x3: nxCrack("#12081c", "#8a2a6a"),
        },
        g2: {
          b: "#180f26",
          f: ["#20152f", "#110a1c", "#2a1c3c"],
          x1: nxPebbles("#2a1f3c", "#0c0614"),
          x3: nxCrack("#0a0412", "#a6306c"),
        },
        dirt: {
          b: "#3a3148",
          f: ["#463c56", "#2b2338", "#5b506e"],
          x1: (g, r) => {
            for (let i = 0; i < 4; i++) {
              const x = Math.floor(r() * 14),
                y = Math.floor(r() * 14);
              nxPx(g, "#b6adc2", x, y);
              nxPx(g, "#7e748d", x + 1, y);
            }
          },
        },
      },
      day: {
        g1: {
          b: "#6a5c88",
          f: ["#7a6c9a", "#5a4c76", "#8a7cac"],
          x1: nxPebbles("#8a7cac", "#3f3258"),
          x3: nxCrack("#3a2d52", "#c0508a"),
        },
        g2: {
          b: "#584a74",
          f: ["#65577f", "#4a3d62", "#74668f"],
          x1: nxPebbles("#74668f", "#33284a"),
          x3: nxCrack("#2f2444", "#b84a84"),
        },
        dirt: {
          b: "#8d839d",
          f: ["#9b91ab", "#7a7089", "#aaa0ba"],
          x1: (g, r) => {
            for (let i = 0; i < 4; i++) {
              const x = Math.floor(r() * 14),
                y = Math.floor(r() * 14);
              nxPx(g, "#e6e0ee", x, y);
              nxPx(g, "#b0a6bd", x + 1, y);
            }
          },
        },
      },
    },
  };

  /* ---------- decoração por mundo ---------- */
  const DK = {
    /* contornos escuros que combinam com cada mundo */ ela: "#0b0816",
    sur: "#2b1608",
    sombra: "#07020f",
  };
  function nxBuildDecor() {
    const D = S.decor,
      STn = "#7b7488",
      SLn = "#a69fb6",
      SDn = "#443f55";
    /* --- Vale de Elá: campo de batalha pastoral --- */
    D.grassTuft = mk(8, 6, (g) => {
      for (const [x, h, c] of [
        [1, 3, "#2d5a38"],
        [2, 5, "#3a7046"],
        [4, 4, "#2f6240"],
        [5, 5, "#468453"],
        [6, 3, "#2d5a38"],
      ])
        R(g, c, x, 6 - h, 1, h);
    });
    D.olive = nxOut(
      mk(24, 28, (g) => {
        R(g, "#3a2a1c", 10, 15, 4, 12);
        R(g, "#523b27", 10, 15, 1, 12);
        R(g, "#2a1d12", 8, 25, 8, 2);
        R(g, "#3a2a1c", 8, 20, 3, 2);
        R(g, "#3a2a1c", 13, 18, 3, 2);
        R(g, "#3a2a1c", 7, 17, 3, 2);
        nxBlob(g, 12, 10, 11, 8, "#4d6b4a", "#6f8f66", "#33503a", 5);
        nxBlob(g, 6, 13, 5, 4, "#456243", "#668260", "#2f4a35", 6);
        nxBlob(g, 18, 13, 5, 4, "#456243", "#668260", "#2f4a35", 7);
        for (const [x, y] of [
          [8, 7],
          [14, 5],
          [17, 9],
          [10, 12],
          [5, 12],
        ])
          nxPx(g, "#8aa57e", x, y);
      }),
      DK.ela,
    );
    D.standStone = nxOut(
      mk(9, 19, (g) => {
        R(g, STn, 1, 3, 7, 16);
        R(g, STn, 2, 1, 5, 3);
        R(g, SLn, 2, 2, 1, 16);
        R(g, SDn, 7, 3, 1, 16);
        R(g, SDn, 1, 18, 7, 1);
        R(g, "#3f6a52", 1, 14, 3, 3);
        R(g, "#3f6a52", 5, 16, 2, 2);
        R(g, SDn, 3, 6, 3, 1);
        R(g, SDn, 4, 7, 1, 3);
      }),
      DK.ela,
    );
    D.spear = nxOut(
      mk(7, 22, (g) => {
        R(g, "#6b4a2a", 3, 4, 1, 18);
        R(g, "#8a6338", 3, 4, 1, 18);
        R(g, "#c9ced8", 2, 0, 3, 5);
        R(g, "#eef2fa", 3, 0, 1, 4);
        R(g, "#a82a2a", 4, 6, 3, 2);
        R(g, "#d04a3a", 4, 6, 2, 1);
        R(g, "#7a1c1c", 5, 8, 2, 1);
        R(g, "#33281c", 1, 20, 5, 2);
      }),
      DK.ela,
    );
    D.shieldB = nxOut(
      mk(12, 11, (g) => {
        nxBlob(g, 6, 5.5, 5.5, 4.5, "#6b6258", "#8e8576", "#3e382f", 8);
        R(g, "#a8741f", 5, 1, 2, 9);
        R(g, "#d6a43a", 5, 4, 2, 2);
        nxLine(g, "#1c1612", 2, 8, 9, 3);
        nxLine(g, "#1c1612", 3, 9, 7, 6);
      }),
      DK.ela,
    );
    D.haystack = nxOut(
      mk(18, 14, (g) => {
        for (let y = 0; y < 14; y++) {
          const w = Math.round(3 + y * 1.0);
          for (let x = 9 - w; x <= 9 + w - 1; x++)
            nxPx(
              g,
              (x + y * 2) % 3 === 0 ? "#c7a24a" : x < 9 ? "#d9b659" : "#a98433",
              x,
              y,
            );
        }
        nxLine(g, "#8a6a22", 4, 9, 14, 9);
        nxLine(g, "#e9cc7a", 8, 2, 9, 5);
      }),
      DK.ela,
    );
    D.flowers = mk(14, 7, (g) => {
      for (const [x, y, c] of [
        [1, 4, "#f2f2fa"],
        [4, 2, "#f2c14e"],
        [6, 5, "#e0e8ff"],
        [9, 3, "#f2f2fa"],
        [11, 5, "#e87a9a"],
        [12, 2, "#f2c14e"],
      ]) {
        nxPx(g, "#2d5a38", x, y + 1);
        nxPx(g, c, x, y);
      }
      nxPx(g, "#3a7046", 3, 6);
      nxPx(g, "#3a7046", 8, 6);
    });
    D.cairn = nxOut(
      mk(12, 11, (g) => {
        nxBlob(g, 6, 8, 5.5, 2.8, "#6e6a78", "#938fa0", "#403c4c", 2);
        nxBlob(g, 6, 5, 4, 2.4, "#7a7686", "#a29eb0", "#46424f", 4);
        nxBlob(g, 6, 2.5, 2.4, 1.8, "#85818f", "#aca8ba", "#4d4958", 6);
      }),
      DK.ela,
    );
    D.campfire = nxOut(
      mk(14, 9, (g) => {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * 6.283;
          nxBlob(
            g,
            7 + Math.cos(a) * 5,
            4.5 + Math.sin(a) * 2.6,
            1.6,
            1.3,
            "#6e6a78",
            "#8f8b9c",
            "#3d3947",
            i,
          );
        }
        nxBlob(g, 7, 4.5, 3.6, 1.8, "#2a2622", "#3a352f", "#1a1714", 9);
        nxLine(g, "#4a3524", 4, 5, 10, 3);
        nxLine(g, "#4a3524", 5, 3, 9, 6);
        nxPx(g, "#ff7a1a", 7, 4);
        nxPx(g, "#ffd24a", 8, 4);
      }),
      DK.ela,
    );
    D.wallRuin = nxOut(
      mk(22, 11, (g) => {
        for (let r = 0; r < 3; r++)
          for (let x = 0; x < 22; x += 5) {
            const off = r % 2 ? 2 : 0,
              w = 5;
            if (r === 0 && (x < 3 || x > 15)) continue;
            R(
              g,
              (x + r) % 3 === 0 ? "#8a8396" : "#777088",
              x + off - 2,
              2 + r * 3,
              w - 1,
              3,
            );
            R(g, "#a39dae", x + off - 2, 2 + r * 3, w - 1, 1);
          }
        R(g, "#443f55", 0, 10, 22, 1);
        R(g, "#3f6a52", 2, 8, 4, 2);
        R(g, "#3f6a52", 14, 9, 3, 1);
      }),
      DK.ela,
    );
    /* --- Deserto de Sur --- */
    D.sandTuft = mk(8, 6, (g) => {
      for (const [x, h, c] of [
        [1, 3, "#7a5a30"],
        [2, 5, "#9a7440"],
        [4, 4, "#b08a4c"],
        [5, 5, "#8a6636"],
        [6, 3, "#6a4c28"],
      ])
        R(g, c, x, 6 - h, 1, h);
    });
    D.thornbush = nxOut(
      mk(14, 10, (g) => {
        nxBlob(g, 7, 6, 6, 3.6, "#6b5230", "#8f7142", "#43321c", 3);
        for (const [x, y] of [
          [2, 4],
          [5, 2],
          [9, 2],
          [12, 4],
          [7, 1],
          [3, 7],
          [11, 7],
        ])
          nxPx(g, "#1f1608", x, y);
        nxPx(g, "#a8884a", 6, 4);
        nxPx(g, "#a8884a", 9, 5);
      }),
      DK.sur,
    );
    D.sandRock = nxOut(
      mk(13, 9, (g) => {
        nxBlob(g, 6.5, 5, 6, 3.8, "#a8693f", "#cd8c5a", "#73432a", 4);
        nxLine(g, "#73432a", 2, 5, 11, 5);
        nxLine(g, "#c98f60", 3, 3, 8, 3);
      }),
      DK.sur,
    );
    D.redBoulder = nxOut(
      mk(20, 16, (g) => {
        nxBlob(g, 10, 9, 9.2, 6.2, "#9c5a36", "#c98050", "#62371f", 2);
        nxLine(g, "#62371f", 2, 9, 17, 9);
        nxLine(g, "#62371f", 3, 12, 15, 12);
        nxLine(g, "#d79a68", 4, 6, 12, 6);
        nxLine(g, "#3a1f10", 9, 4, 11, 8);
        nxLine(g, "#3a1f10", 11, 8, 10, 11);
      }),
      DK.sur,
    );
    D.acacia = nxOut(
      mk(30, 26, (g) => {
        R(g, "#3a2614", 14, 11, 3, 14);
        R(g, "#5a3c22", 14, 11, 1, 14);
        R(g, "#241508", 12, 23, 7, 2);
        R(g, "#3a2614", 12, 14, 3, 2);
        R(g, "#3a2614", 17, 12, 3, 2);
        nxLine(g, "#3a2614", 11, 12, 6, 8);
        nxLine(g, "#3a2614", 17, 11, 24, 7);
        nxBlob(g, 15, 5, 14, 3.4, "#6b7a3a", "#9aaa52", "#46531f", 2);
        nxBlob(g, 7, 9, 7, 2.6, "#627032", "#8e9f4a", "#3f4a1b", 3);
        nxBlob(g, 23, 8, 7, 2.6, "#627032", "#8e9f4a", "#3f4a1b", 4);
      }),
      DK.sur,
    );
    D.palmDead = nxOut(
      mk(22, 30, (g) => {
        for (let y = 29; y > 8; y--) {
          const x = 11 + Math.round(Math.sin((29 - y) * 0.13) * 2.4);
          R(g, y % 3 === 0 ? "#4a3420" : "#6b4a2c", x, y, 2, 1);
        }
        for (const [dx, dy, c] of [
          [-9, 3, "#7a6a34"],
          [9, 3, "#7a6a34"],
          [-6, 6, "#8a7a3c"],
          [6, 6, "#8a7a3c"],
          [-3, 7, "#6a5a2c"],
          [3, 7, "#6a5a2c"],
        ]) {
          let x = 12,
            y = 8;
          for (let i = 0; i < 9; i++) {
            x += dx / 9;
            y += (dy / 9) * (1 + i * 0.18) - 0.35 + i * 0.22;
            nxPx(g, c, Math.round(x), Math.round(y));
            nxPx(g, c, Math.round(x), Math.round(y) - 1);
          }
        }
        nxBlob(g, 12, 9, 2, 1.6, "#4a3420", "#6b4a2c", "#2e1f10", 3);
      }),
      DK.sur,
    );
    D.camelRibs = nxRows(
      [
        "..B.B.B.B.B..",
        ".BBBBBBBBBBB.",
        "B.BSBSBSBSB.B",
        ".B.B.B.B.B.B.",
        "..S.S.S.S.S..",
      ],
      { B: "#e6d8b0", S: "#b8a67c" },
      DK.sur,
    );
    D.ruinPillar = nxOut(
      mk(11, 24, (g) => {
        R(g, "#b49468", 1, 2, 9, 3);
        R(g, "#c8aa7c", 1, 2, 9, 1);
        R(g, "#9c7e54", 2, 5, 7, 16);
        R(g, "#c8aa7c", 2, 5, 2, 16);
        R(g, "#7a5c38", 7, 5, 2, 16);
        R(g, "#b49468", 0, 21, 11, 3);
        R(g, "#7a5c38", 0, 23, 11, 1);
        for (const y of [8, 12, 16]) R(g, "#7a5c38", 2, y, 7, 1);
        nxLine(g, "#4e3a22", 4, 5, 6, 11);
        nxPx(g, "#4e3a22", 6, 12);
        R(g, "#9c7e54", 3, 0, 3, 2);
        R(g, "#c8aa7c", 3, 0, 1, 2);
      }),
      DK.sur,
    );
    D.tent = nxOut(
      mk(26, 18, (g) => {
        for (let y = 0; y < 16; y++) {
          const w = Math.round(2 + y * 0.78);
          for (let x = 13 - w; x <= 13 + w - 1; x++)
            nxPx(
              g,
              x < 13
                ? (x + y) % 5 === 0
                  ? "#c9b18a"
                  : "#b99f76"
                : (x + y) % 5 === 0
                  ? "#8d7552"
                  : "#7b6444",
              x,
              y,
            );
        }
        R(g, "#3a2616", 12, 0, 2, 3);
        R(g, "#241508", 10, 9, 6, 7);
        R(g, "#33200f", 11, 10, 4, 6);
        nxLine(g, "#3a2616", 1, 15, 8, 4);
        nxLine(g, "#3a2616", 24, 15, 18, 4);
        R(g, "#9c2f2f", 6, 12, 2, 4);
        R(g, "#9c2f2f", 19, 12, 2, 3);
        R(g, "#241508", 0, 16, 26, 1);
      }),
      DK.sur,
    );
    D.dryWell = nxOut(
      mk(16, 14, (g) => {
        nxBlob(g, 8, 9, 7.2, 4.2, "#9c8660", "#c2aa7c", "#6b5a3a", 3);
        nxBlob(g, 8, 8, 4.6, 2.4, "#1c1208", "#2c200f", "#120b04", 2);
        R(g, "#5a3c22", 2, 1, 2, 9);
        R(g, "#5a3c22", 12, 1, 2, 9);
        R(g, "#6b4a2c", 1, 0, 14, 2);
        R(g, "#8a6338", 1, 0, 14, 1);
        nxLine(g, "#d8c9a0", 8, 2, 8, 6);
      }),
      DK.sur,
    );
    D.dune = mk(28, 9, (g) => {
      for (let x = 0; x < 28; x++) {
        const h = Math.round(Math.sin((x / 27) * Math.PI) * 6);
        for (let y = 8 - h; y < 9; y++)
          nxPx(
            g,
            y === 8 - h ? "#f2d89a" : x > 15 ? "#c99a4c" : "#e0b868",
            x,
            y,
          );
      }
      for (let x = 6; x < 24; x += 2) nxPx(g, "#a77a3a", x, 8);
    });
    D.skullSand = nxRows(
      [
        "..BBBB..",
        ".BBBBBB.",
        "BBBBBBBB",
        "BKKBBKKB",
        "BKKBBKKB",
        "BBBKKBBB",
        ".BBBBBB.",
        "..BSBS..",
      ],
      { B: "#ead8ae", K: "#2b1608", S: "#b8a47a" },
      DK.sur,
    );
    /* --- Vale da Sombra --- */
    const bt = (c, h, glow) =>
      nxOut(
        mk(26, 32, (g) => {
          R(g, "#0d0716", 9, 29, 9, 2);
          R(g, c, 11, 11, 4, 19);
          R(g, h, 11, 11, 1, 19);
          R(g, c, 9, 27, 8, 3);
          R(g, c, 12, 3, 2, 9);
          R(g, c, 11, 5, 2, 3);
          R(g, c, 6, 12, 6, 2);
          R(g, c, 4, 9, 3, 4);
          R(g, c, 2, 6, 2, 4);
          R(g, c, 0, 4, 2, 2);
          R(g, c, 14, 9, 6, 2);
          R(g, c, 19, 6, 3, 4);
          R(g, c, 21, 3, 2, 4);
          R(g, c, 23, 4, 2, 2);
          R(g, h, 4, 9, 1, 4);
          R(g, h, 19, 6, 1, 4);
          for (const [x, y] of [
            [12, 15],
            [12, 20],
            [12, 24],
            [7, 12],
            [20, 8],
          ])
            nxPx(g, glow, x, y);
          R(g, glow, 11, 9, 1, 1);
          R(g, glow, 14, 9, 1, 1);
        }),
        DK.sombra,
      );
    D.blackTree = bt("#1a1226", "#3a2a56", "#b04aff");
    D.thornDead = nxOut(
      mk(14, 13, (g) => {
        for (const [x0, y0, x1, y1] of [
          [7, 12, 7, 1],
          [7, 10, 2, 4],
          [7, 8, 12, 3],
          [7, 6, 3, 1],
          [7, 5, 11, 1],
          [7, 11, 11, 8],
        ])
          nxLine(g, "#1c1230", x0, y0, x1, y1);
        for (const [x, y] of [
          [2, 4],
          [12, 3],
          [3, 1],
          [11, 1],
          [11, 8],
        ])
          nxPx(g, "#6a4a9a", x, y);
      }),
      DK.sombra,
    );
    D.crystal = nxOut(
      mk(16, 24, (g) => {
        const shard = (x0, w, h, c1, c2, c3) => {
          for (let y = 0; y < h; y++) {
            const ww = Math.max(
              1,
              Math.round(w * (y < h * 0.3 ? (y + 1) / (h * 0.3) : 1)),
            );
            for (let x = 0; x < ww; x++)
              nxPx(
                g,
                x < ww * 0.4 ? c1 : x < ww * 0.75 ? c2 : c3,
                x0 + Math.round((w - ww) / 2) + x,
                23 - h + y + 0,
              );
          }
        };
        shard(1, 4, 12, "#9a6aff", "#7a42e0", "#4a2490");
        shard(11, 4, 14, "#a67aff", "#8250e8", "#4f2a9a");
        shard(6, 5, 22, "#c49aff", "#9a66ff", "#5a30b0");
        R(g, "#e8d4ff", 7, 3, 1, 8);
        R(g, "#e8d4ff", 12, 12, 1, 4);
        R(g, "#e8d4ff", 2, 13, 1, 3);
        R(g, "#120a22", 0, 22, 16, 2);
      }),
      DK.sombra,
    );
    D.crystalS = nxOut(
      mk(9, 12, (g) => {
        for (let y = 0; y < 11; y++) {
          const w = y < 3 ? 1 + y : 3;
          for (let x = 0; x < w; x++)
            nxPx(
              g,
              x === 0 ? "#c49aff" : x === 1 ? "#8250e8" : "#4f2a9a",
              3 - Math.floor(w / 2) + x + 1,
              y,
            );
        }
        nxPx(g, "#f0e0ff", 3, 3);
        R(g, "#120a22", 1, 10, 7, 1);
      }),
      DK.sombra,
    );
    D.obelisk = nxOut(
      mk(12, 34, (g) => {
        for (let y = 0; y < 30; y++) {
          const w = y < 4 ? 2 + y : Math.round(6 + y * 0.08);
          for (let x = 0; x < w; x++)
            nxPx(
              g,
              x < w * 0.35 ? "#4a3f62" : x < w * 0.8 ? "#322a46" : "#1d1730",
              6 - Math.floor(w / 2) + x,
              y,
            );
        }
        R(g, "#1d1730", 1, 30, 10, 4);
        R(g, "#4a3f62", 1, 30, 10, 1);
        for (const y of [8, 13, 18, 23]) {
          R(g, "#c04aff", 4, y, 1, 3);
          R(g, "#c04aff", 6, y + 1, 2, 1);
          R(g, "#ff7ad9", 5, y + 1, 1, 1);
        }
      }),
      DK.sombra,
    );
    D.brazier = nxOut(
      mk(12, 18, (g) => {
        R(g, "#2d2640", 4, 9, 4, 8);
        R(g, "#4a3f62", 4, 9, 1, 8);
        R(g, "#1d1730", 2, 16, 8, 2);
        nxBlob(g, 6, 8, 5.2, 2.4, "#3a3052", "#5a4d78", "#231c36", 2);
        R(g, "#150f24", 2, 7, 8, 1);
      }),
      DK.sombra,
    );
    D.ribArch = nxOut(
      mk(30, 28, (g) => {
        for (const sgn of [-1, 1])
          for (let i = 0; i < 4; i++) {
            const cx = 15 + sgn * (4 + i * 1.6);
            for (let t = 0; t <= 26; t++) {
              const a = (t / 26) * Math.PI * 0.5,
                x =
                  15 + sgn * (13 * Math.sin(a) + (i - 1.5) * 1.4 * Math.cos(a)),
                y = 26 - 22 * Math.cos(a) * (1 - i * 0.035);
              nxPx(
                g,
                i % 2 ? "#c9bfa8" : "#e6dcc4",
                Math.round(x),
                Math.round(y),
              );
            }
          }
        R(g, "#e6dcc4", 13, 3, 4, 3);
        R(g, "#9a907a", 13, 5, 4, 1);
        R(g, "#2a2236", 1, 26, 8, 2);
        R(g, "#2a2236", 21, 26, 8, 2);
      }),
      DK.sombra,
    );
    D.blackPool = mk(22, 9, (g) => {
      nxBlob(g, 11, 4.5, 10, 3.6, "#0d0716", "#1c1230", "#080410", 2);
      for (const [x, y] of [
        [6, 3],
        [10, 2],
        [14, 4],
        [8, 5],
      ])
        nxPx(g, "#6a3aa8", x, y);
      nxPx(g, "#c49aff", 10, 3);
    });
    D.fissure = mk(24, 8, (g) => {
      let x = 0,
        y = 4;
      for (let i = 0; i < 24; i++) {
        nxPx(g, "#2a0a2a", i, y - 1);
        nxPx(g, "#7a1f5a", i, y);
        nxPx(g, "#ff5aa0", i, y);
        nxPx(g, "#2a0a2a", i, y + 1);
        if (hash(i, 4, 5) < 0.35) y += hash(i, 5, 5) < 0.5 ? -1 : 1;
        y = Math.max(2, Math.min(5, y));
      }
      for (const i of [5, 12, 18]) nxPx(g, "#ffd0e8", i, y);
    });
    D.boneDust = nxRows(
      [".B..B.B...", "BBS.BBBBS.", ".BBBSBBB.B", "..B.B..BB."],
      { B: "#c9bfd0", S: "#8b809a" },
      DK.sombra,
    );
    /* aliases por sombra/ruína já existentes: ossos/crânios em tom de areia */
    D.skull_sand = D.skullSand;
  }
  /* sólidos e colisões das peças novas */
  Object.assign(SOLID, {
    olive: 6,
    standStone: 4,
    haystack: 6,
    cairn: 5,
    wallRuin: 6,
    thornbush: 4,
    sandRock: 5,
    redBoulder: 7,
    acacia: 6,
    palmDead: 3,
    ruinPillar: 5,
    tent: 8,
    dryWell: 6,
    blackTree: 6,
    thornDead: 3,
    crystal: 5,
    obelisk: 5,
    brazier: 4,
  });
  Object.assign(FLAT, { flowers: 1, dune: 1, blackPool: 1, fissure: 1 });
  Object.assign(COLL, {
    olive: [5, 4],
    standStone: [4, 4],
    haystack: [7, 5],
    cairn: [5, 4],
    wallRuin: [10, 4],
    thornbush: [6, 4],
    sandRock: [6, 4],
    redBoulder: [9, 6],
    acacia: [4, 3],
    palmDead: [3, 3],
    ruinPillar: [4, 4],
    tent: [11, 6],
    dryWell: [7, 5],
    blackTree: [5, 4],
    thornDead: [5, 3],
    crystal: [6, 4],
    obelisk: [5, 4],
    brazier: [5, 3],
  });

  /* mapas de sorteio por mundo: [limite, peça]; zonas escolhem a tabela (0 = campo aberto) */
  const nxZn = (cx, cy, ox, oy, k, th) => vnoise(cx * k + ox, cy * k + oy) > th;
  const NXW = {
    0: {
      name: "Vale de Elá",
      den: [0.18, 0.5, 0.45],
      zone: (cx, cy) =>
        nxZn(cx, cy, 40, 17, 0.09, 0.72)
          ? 1
          : nxZn(cx, cy, 90, 33, 0.08, 0.68)
            ? 2
            : 0,
      tabs: [
        [
          [0.18, "grassTuft"],
          [0.3, "bush"],
          [0.4, "flowers"],
          [0.5, "rock"],
          [0.61, "olive"],
          [0.69, "standStone"],
          [0.75, "cairn"],
          [0.8, "deadTree"],
          [0.85, "bones"],
          [0.89, "skull"],
          [0.93, "shieldB"],
          [0.97, "spear"],
          [1, "haystack"],
        ],
        [
          [0.2, "tombA"],
          [0.36, "tombB"],
          [0.47, "cross"],
          [0.56, "skull"],
          [0.63, "bones"],
          [0.71, "fence"],
          [0.77, "candle"],
          [0.82, "deadTree"],
          [0.87, "invCross"],
          [0.91, "statue"],
          [0.95, "coffin"],
          [0.975, "skullH"],
          [1, "blood"],
        ],
        [
          [0.14, "spear"],
          [0.28, "shieldB"],
          [0.4, "campfire"],
          [0.52, "haystack"],
          [0.66, "wallRuin"],
          [0.76, "cairn"],
          [0.84, "bones"],
          [0.9, "skull"],
          [0.95, "flowers"],
          [1, "standStone"],
        ],
      ],
    },
    1: {
      name: "Deserto de Sur",
      den: [0.2, 0.46, 0.3],
      zone: (cx, cy) =>
        nxZn(cx, cy, 10, 55, 0.08, 0.64)
          ? 1
          : nxZn(cx, cy, 70, 12, 0.07, 0.62)
            ? 2
            : 0,
      tabs: [
        [
          [0.16, "sandTuft"],
          [0.3, "thornbush"],
          [0.42, "sandRock"],
          [0.5, "camelRibs"],
          [0.58, "skullSand"],
          [0.7, "acacia"],
          [0.78, "palmDead"],
          [0.86, "redBoulder"],
          [0.92, "bones"],
          [0.96, "dune"],
          [1, "thornbush"],
        ],
        [
          [0.18, "ruinPillar"],
          [0.34, "tent"],
          [0.48, "dryWell"],
          [0.6, "camelRibs"],
          [0.7, "sandRock"],
          [0.8, "skullSand"],
          [0.88, "bones"],
          [0.94, "redBoulder"],
          [1, "ruinPillar"],
        ],
        [
          [0.4, "dune"],
          [0.6, "sandTuft"],
          [0.72, "sandRock"],
          [0.82, "thornbush"],
          [0.9, "camelRibs"],
          [0.96, "palmDead"],
          [1, "acacia"],
        ],
      ],
    },
    2: {
      name: "Vale da Sombra",
      den: [0.2, 0.5, 0.42],
      zone: (cx, cy) =>
        nxZn(cx, cy, 25, 70, 0.08, 0.64)
          ? 1
          : nxZn(cx, cy, 60, 5, 0.08, 0.66)
            ? 2
            : 0,
      tabs: [
        [
          [0.14, "thornDead"],
          [0.3, "blackTree"],
          [0.42, "blackPool"],
          [0.52, "boneDust"],
          [0.6, "fissure"],
          [0.68, "obelisk"],
          [0.76, "brazier"],
          [0.84, "skullH"],
          [0.91, "thornDead"],
          [1, "blackTree"],
        ],
        [
          [0.22, "crystal"],
          [0.4, "crystalS"],
          [0.55, "crystalS"],
          [0.66, "fissure"],
          [0.76, "obelisk"],
          [0.85, "boneDust"],
          [1, "crystal"],
        ],
        [
          [0.16, "ribArch"],
          [0.3, "boneDust"],
          [0.42, "skullH"],
          [0.52, "coffin"],
          [0.62, "invCross"],
          [0.7, "tombB"],
          [0.78, "statue"],
          [0.86, "brazier"],
          [0.92, "blackTree"],
          [1, "bones"],
        ],
      ],
    },
  };
  decorAt = function (cx, cy) {
    const C = NXW[nxWi()],
      zi = C.zone(cx, cy);
    if (hash(cx, cy, 7) > C.den[zi]) return null;
    const px = cx * DCS + hash(cx, cy, 8) * DCS,
      py = cy * DCS + hash(cx, cy, 10) * DCS;
    if (onPath(px / TS, py / TS)) return null;
    const r = hash(cx, cy, 9),
      tb = C.tabs[zi];
    let k = tb[tb.length - 1][1];
    for (const e of tb)
      if (r < e[0]) {
        k = e[1];
        break;
      }
    if (k === "statue") k = hash(cx, cy, 11) < 0.5 ? "angel" : "gargoyle";
    return { k, px, py };
  };

  /* ---------- luz e sombras: direção, comprimento e cor por mundo ---------- */
  const NXL = {
    lx: 0.88,
    ly: 0.48,
    len: 0.55,
    a: 0.3,
    col: "4,8,28",
    radial: false,
  };
  const LIGHTD = {
    crystal: [38, "196,154,255"],
    crystalS: [24, "196,154,255"],
    obelisk: [34, "200,90,255"],
    brazier: [48, "190,110,255"],
    fissure: [28, "255,90,160"],
    candle: [26, "255,170,60"],
    campfire: [30, "255,150,60"],
  };
  const NXLIGHTS = [];
  function nxLightSync() {
    const wi = nxWi(),
      dk = dawnK();
    if (wi === 0) {
      NXL.lx = 0.88;
      NXL.ly = 0.48;
      NXL.len = 0.75 + 0.55 * dk;
      NXL.a = 0.52 + 0.08 * dk;
      NXL.col = "2,5,20";
      NXL.radial = false;
    } else if (wi === 1) {
      NXL.lx = -0.93;
      NXL.ly = 0.37;
      NXL.len = 1.25 + 0.4 * dk;
      NXL.a = 0.58;
      NXL.col = "36,12,0";
      NXL.radial = false;
    } else {
      NXL.lx = 0.7;
      NXL.ly = 0.72;
      NXL.len = 1;
      NXL.a = 0.66;
      NXL.col = "6,0,18";
      NXL.radial = true;
    }
  }
  const NXSIL = {};
  function nxSil(k, im) {
    const key = k + nxWi();
    return (
      NXSIL[key] ||
      (NXSIL[key] = mk(im.width, im.height, (g) => {
        g.drawImage(im, 0, 0);
        g.globalCompositeOperation = "source-in";
        g.fillStyle = "rgb(" + NXL.col + ")";
        g.fillRect(0, 0, im.width, im.height);
      }))
    );
  }
  function nxCast(sil, x, y, W, H, dx, dy, len, alpha) {
    let kx = dx * len,
      ky = dy * len * 0.5;
    if (Math.abs(ky) < 0.1 * len) ky = (ky < 0 ? -1 : 1) * 0.1 * len;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.transform(1, 0, -kx, -ky, x + kx * H, y + ky * H);
    ctx.drawImage(sil, -W / 2, 0);
    ctx.restore();
  }
  function nxShadowPass() {
    nxInit();
    nxLightSync();
    NXLIGHTS.length = 0;
    const x0 = Math.floor((camx - 40) / DCS),
      x1 = Math.floor((camx + VW + 40) / DCS),
      y0 = Math.floor((camy - 10) / DCS),
      y1 = Math.floor((camy + VH + 50) / DCS),
      g = G,
      pp = g && g.p,
      soft = FXQ();
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const d = decorAt(cx, cy);
        if (!d) continue;
        const k = d.k,
          im = S.decor[k];
        if (!im) {
          continue;
        }
        const x = Math.round(d.px - camx),
          y = Math.round(d.py - camy),
          L = LIGHTD[k];
        if (L)
          NXLIGHTS.push({
            x: d.px,
            y: d.py - im.height * 0.55,
            r: L[0],
            c: L[1],
          });
        if (FLAT[k]) continue;
        const W = im.width,
          H = im.height;
        /* sombra de contato */
        ctx.fillStyle = "rgba(" + NXL.col + "," + NXL.a * 1.05 + ")";
        const aw = Math.round(W * 0.62);
        ctx.fillRect(x - (aw >> 1) + 1, y - 2, aw - 2, 1);
        ctx.fillRect(x - (aw >> 1), y - 1, aw, 2);
        ctx.fillRect(x - (aw >> 1) + 1, y + 1, aw - 2, 1);
        if (H <= 8) continue;
        let dx = NXL.lx,
          dy = NXL.ly,
          len = NXL.len;
        if (NXL.radial && pp) {
          const ex = d.px - pp.x,
            ey = d.py - pp.y,
            dist = Math.hypot(ex, ey) || 1;
          dx = ex / dist;
          dy = ey / dist;
          len = 0.3 + 0.75 * Math.min(1, dist / 120);
          if (dy < 0.15 && dy > -0.15) dy = dy < 0 ? -0.15 : 0.15;
        }
        const sil = nxSil(k, im),
          tall = Math.min(1.25, 0.55 + H / 34);
        nxCast(
          sil,
          x,
          y,
          W,
          H,
          dx,
          dy,
          len * tall,
          NXL.a * (soft ? 0.62 : 0.95),
        );
        if (soft)
          nxCast(sil, x, y, W, H, dx, dy, len * tall * 0.6, NXL.a * 0.55);
      }
  }
  /* sombra dos seres (herói, inimigos, itens): elipse que segue a luz do mundo */
  shadow = function (x, y, w) {
    const ox = Math.round(NXL.lx * w * 0.1),
      X = sx(x - w / 2) + ox,
      Y = sy(y),
      W = Math.max(3, Math.round(w)),
      a = NXL.a * 1.15,
      c = "rgba(" + NXL.col + ",";
    ctx.fillStyle = c + a * 0.6 + ")";
    ctx.fillRect(X + 1, Y - 1, W - 2, 1);
    ctx.fillStyle = c + a + ")";
    ctx.fillRect(X, Y, W, 2);
    ctx.fillStyle = c + a * 0.6 + ")";
    ctx.fillRect(X + 1, Y + 2, W - 2, 1);
  };

  /* ---------- decoração com brilho próprio ---------- */
  const _nxDI = drawDI;
  drawDI = function (o) {
    _nxDI(o);
    const k = o.k,
      im = o.im,
      x = o.x,
      y = o.y,
      T = o.T;
    if (LIGHTD[k] && k !== "candle") {
      const L = LIGHTD[k],
        fl = 0.8 + 0.2 * Math.sin(T * (k === "brazier" ? 11 : 3) + o.px),
        cyy = FLAT[k] ? y : y - im.height * 0.55;
      glow(
        o.px,
        FLAT[k] ? o.py : o.py - im.height * 0.55,
        L[0] * 0.7 * fl,
        "rgba(" + L[1] + ",1)",
        k === "fissure" ? 0.45 : 0.5,
      );
      if (k === "brazier") {
        ctx.fillStyle =
          "rgba(210,140,255," + (0.8 + 0.2 * Math.sin(T * 13)) + ")";
        ctx.fillRect(
          x - 1,
          y - im.height - 3 + Math.round(Math.sin(T * 9 + o.px)),
          2,
          4,
        );
        ctx.fillStyle = "rgba(255,230,255,.9)";
        ctx.fillRect(x, y - im.height - 2, 1, 2);
      }
    }
    if (k === "campfire") {
      ctx.fillStyle =
        "rgba(255,170,60," + (0.7 + 0.3 * Math.sin(T * 14 + o.px)) + ")";
      ctx.fillRect(x - 1, y - 7 + Math.round(Math.sin(T * 8)), 2, 3);
    }
  };

  /* ---------- tiles, sprites e fx de cada mundo (preguiçosos) ---------- */
  let NXREADY = false;
  const NXTILES = {};
  function nxInit() {
    if (NXREADY) return;
    NXREADY = true;
    NXTILES[0] = { tiles: S.tiles, tilesDay: S.tilesDay };
    NXTILES[1] = nxMakeTiles(NX_TERRAIN[1]);
    NXTILES[2] = nxMakeTiles(NX_TERRAIN[2]);
    nxBuildDecor();
    nxBuildEnemies();
  }
  const _nxDG = drawGround;
  drawGround = function () {
    nxInit();
    const T = NXTILES[nxWi()];
    S.tiles = T.tiles;
    S.tilesDay = T.tilesDay;
    _nxDG();
  };

  /* ---------- inimigos exclusivos ---------- */

  function nxBuildEnemies() {
    const SC = [
      "............TTTT....",
      "...........T....T...",
      "..........TS.....T..",
      "..........S......T..",
      "..CC.............T..",
      ".CCCC..BBBBBBBB..T..",
      ".C..CCBBBBBBBBBBT...",
      ".CC.CBBEBBBBBBBBB...",
      "..CCCBBBBBBBBBBB....",
      "....L.BBBBBBBBB.L...",
      "..L.L.L..L.L.L.L.L..",
      ".L.L.L....L.L.L.L...",
    ];
    const SC2 = [
      "............TTTT....",
      "...........T....T...",
      "..........TS.....T..",
      "..........S......T..",
      "...CC............T..",
      "..CCCC.BBBBBBBB..T..",
      "..C.CCBBBBBBBBBBT...",
      "..CC.CBEBBBBBBBB....",
      "...CCBBBBBBBBBBB....",
      "....L.BBBBBBBBB.L...",
      ".L.L.L.L..L.L.L.L...",
      "..L.L.L...L.L.L.L.L.",
    ];
    const PS = {
      C: "#e0a040",
      R: "#a8601a",
      B: "#c9862a",
      T: "#b87420",
      S: "#ff4a3a",
      E: "#1a0a0a",
      L: "#7a4a14",
    };
    S.scorp = buildSprite(SC, PS, "#2b1608");
    const s2 = buildSprite(SC2, PS, "#2b1608");
    const UM = [
      "....KKKK....",
      "...KKKKKK...",
      "..KKKKKKKK..",
      "..KKEKKEKK..",
      "..KKKKKKKK..",
      ".KKKKKKKKKK.",
      ".KLKKKKKKKK.",
      "KKLKKKKKKKKK",
      "KKKKKKKKKKKK",
      ".KKKK.KKKKK.",
      ".KK..KK..KK.",
      "K...K..K...K",
      "....K....K..",
    ];
    const UM2 = [
      "....KKKK....",
      "...KKKKKK...",
      "..KKKKKKKK..",
      "..KKEKKEKK..",
      "..KKKKKKKK..",
      ".KKKKKKKKKK.",
      ".KLKKKKKKKK.",
      "KKLKKKKKKKKK",
      "KKKKKKKKKKKK",
      ".KKK.KKKKKK.",
      "KK..KK..KK..",
      ".K...K.K...K",
      "..K....K....",
    ];
    const PU = { K: "#1d1233", L: "#3a2a5e", E: "#ff5ad0" };
    S.umbra = buildSprite(UM, PU, "#5a3a94");
    const u2 = buildSprite(UM2, PU, "#5a3a94");
    if (typeof EFR !== "undefined") {
      EFR.scorp = [S.scorp, s2];
      EFR.umbra = [S.umbra, u2];
    }
    a2Enemies();
  }
  const _nxCT = chooseType;
  chooseType = function () {
    const g = G,
      wi = nxWi(),
      t = g.t;
    if (wi === 1 && t >= 25 && rng() < (g.nxw && g.nxw.k > 0.3 ? 0.34 : 0.13))
      return "scorp";
    if (wi === 2 && t >= 30 && rng() < 0.16) return "umbra";
    return _nxCT();
  };

  /* ---------- luz do herói e das armas de luz (Vale da Sombra) ---------- */
  function nxLightR(g) {
    let r = 58 + Math.min(26, g.lvl * 1.2) + 2.2 * Math.sin(g.t * 5);
    for (const [id, w] of Object.entries(g.W || {}))
      if (w && WEAPONS[id] && WEAPONS[id].behavior === "rotating_beams")
        r += 20 + 2 * (w.s.beams || 2);
    if (g.W.aura) r += 10;
    if (g.W.fire) r += 6;
    if (g.W.jars) r += 8;
    if (g.W.angels) r += 10;
    if (g.evo && Object.keys(g.evo).length) r += 6;
    return r;
  }
  function nxLit(x, y) {
    if (nxWi() !== 2 || !G || !G.p) return true;
    const g = G,
      p = g.p;
    if (Math.hypot(x - p.x, y - p.y) < nxLightR(g) * 0.92) return true;
    for (const f of g.fx) {
      if (
        f.k === "jzone" &&
        f.t >= f.delay &&
        Math.hypot(x - f.x, y - f.y) < f.r * 1.4
      )
        return true;
      if (f.k === "flame" && Math.hypot(x - f.x, y - f.y) < (f.r || 20) * 1.5)
        return true;
    }
    for (const [id, mw] of Object.entries(g.W || {}))
      if (
        mw &&
        mw.beams &&
        WEAPONS[id] &&
        WEAPONS[id].behavior === "rotating_beams"
      )
        for (const b of mw.beams)
          if (Math.hypot(x - b.x, y - b.y) < 26) return true;
    for (const L of NXLIGHTS)
      if (Math.hypot(x - L.x, y - L.y) < L.r * 0.9) return true;
    return false;
  }
  const _nxHurt4 = hurt;
  hurt = function (e, d, kx, ky, kb) {
    if (e && e.t === "umbra" && !nxLit(e.x, e.y)) {
      d *= 0.2;
      if (G && G.t - (e.rsT || 0) > 0.3) {
        e.rsT = G.t;
        fxSpark(e.x, e.y, "#6a4aa0", 5);
      }
    }
    return _nxHurt4(e, d, kx, ky, kb);
  };
  const _nxDE4 = drawEnemy;
  drawEnemy = function (e, g, air) {
    if (
      e.t === "scorp" &&
      e.ai &&
      e.ai.st === 2 &&
      FXQ() &&
      hz(Math.floor(g.t * 30), e.ph) < 0.5
    )
      g.parts.push({
        x: e.x + rndFx(-4, 4),
        y: e.y + 4,
        vx: rndFx(-10, 10),
        vy: rndFx(-12, -2),
        life: 0.35,
        max: 0.4,
        col: "#e0b868",
        sz: 1,
      });
    _nxDE4(e, g, air);
  };
  let DKC = null;
  function nxDark(g) {
    if (!g || !g.p || state === "menu" || !(g.t >= 0)) return;
    const dk = 1 - dawnK();
    if (dk < 0.02) return;
    if (!DKC || DKC.c.width !== VW || DKC.c.height !== VH) {
      const c = document.createElement("canvas");
      c.width = VW;
      c.height = VH;
      DKC = { c, g: c.getContext("2d") };
    }
    const c = DKC.g,
      p = g.p,
      hole = (x, y, r, a) => {
        c.globalAlpha = a;
        c.drawImage(HOLE, sx(x) - r, sy(y) - r, r * 2, r * 2);
      };
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
    c.clearRect(0, 0, VW, VH);
    c.fillStyle =
      "rgba(5,0,14," +
      (save.set.fx ? 0.58 : 0.42) * dk * (g.boss ? 0.55 : 1) +
      ")";
    c.fillRect(0, 0, VW, VH);
    c.globalCompositeOperation = "destination-out";
    hole(p.x, p.y - 4, nxLightR(g) * 1.5, 1);
    let n = 0;
    const cap = FXQ() ? 22 : 8;
    for (const f of g.fx) {
      if (n > cap) break;
      if (f.k === "jzone" && f.t >= f.delay) {
        hole(f.x, f.y, f.r * 1.9, 0.92);
        n++;
      } else if (f.k === "flame" && f.t >= (f.delay || 0)) {
        hole(f.x, f.y, (f.r || 20) * 2, 0.85);
        n++;
      } else if (f.k === "nxp") {
        hole(f.x, f.y, 26, 0.6);
        n++;
      }
    }
    for (const [id, mw] of Object.entries(g.W || {}))
      if (
        mw &&
        mw.beams &&
        WEAPONS[id] &&
        WEAPONS[id].behavior === "rotating_beams"
      ) {
        c.globalAlpha = 0.9;
        c.lineCap = "round";
        c.strokeStyle = "rgba(0,0,0,1)";
        for (const b of mw.beams) {
          c.lineWidth = 48;
          c.beginPath();
          c.moveTo(sx(b.x), sy(b.y));
          c.lineTo(sx(b.x), sy(b.y));
          c.stroke();
        }
      }
    for (const L of NXLIGHTS) hole(L.x, L.y, L.r * 1.5, 0.85);
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
    ctx.drawImage(DKC.c, 0, 0);
    /* realce do contorno da luz do herói */
    glow(p.x, p.y - 4, nxLightR(g) * 0.9, "rgba(190,150,255,1)", 0.1);
    glow(p.x, p.y - 5, 26, "rgba(255,240,255,1)", 0.22);
  }

  /* ---------- clima e atmosfera por mundo ---------- */
  const NX_FOGCOL = { 0: "105,120,165", 1: "214,170,100", 2: "120,70,170" };
  let NXFOGWI = -1;
  function nxFogSync() {
    const wi = nxWi();
    if (wi === NXFOGWI) return;
    NXFOGWI = wi;
    const c = FOG.getContext("2d"),
      col = NX_FOGCOL[wi];
    c.clearRect(0, 0, 256, 256);
    const q = mul(7);
    for (let i = 0; i < 44; i++) {
      const x = q() * 256,
        y = q() * 256,
        rr = 36 + q() * 56;
      for (const ox of [-256, 0, 256])
        for (const oy of [-256, 0, 256]) {
          const gr = c.createRadialGradient(
            x + ox,
            y + oy,
            0,
            x + ox,
            y + oy,
            rr,
          );
          gr.addColorStop(
            0,
            "rgba(" +
            col +
            "," +
            (wi === 1 ? 0.1 : wi === 2 ? 0.13 : 0.24) +
            ")",
          );
          gr.addColorStop(1, "rgba(" + col + ",0)");
          c.fillStyle = gr;
          c.fillRect(x + ox - rr, y + oy - rr, rr * 2, rr * 2);
        }
    }
  }
  const nxNightCol = () => {
    const w = nxWi();
    return w === 1
      ? "rgba(96,40,10,"
      : w === 2
        ? "rgba(22,4,44,"
        : "rgba(8,10,46,";
  };
  const nxNightMul = () => (nxWi() === 1 ? 0.5 : nxWi() === 2 ? 0.6 : 1);
  const nxFogBase = () => {
    const w = nxWi();
    return w === 1
      ? "rgba(60,32,8,"
      : w === 2
        ? "rgba(22,6,38,"
        : "rgba(14,16,40,";
  };
  const _nxWA = wxActive;
  wxActive = function () {
    return _nxWA() && nxWi() === 0;
  }; /* chuva e trovoada: só no Vale de Elá */

  function nxWorldTick(dt) {
    const g = G,
      p = g.p,
      wi = nxWi();
    if (wi === 0) return;
    const st =
      g.nxw ||
      (g.nxw = {
        on: 0,
        t: 0,
        k: 0,
        next: 38 + rnd(0, 14),
        dx: 1,
        dy: 0,
        emit: 0,
      });
    if (wi === 1) {
      if (!st.on) {
        st.next -= dt;
        st.k = Math.max(0, st.k - dt * 0.7);
        if (st.next <= 0 && g.t > 20 && !g.boss && !g.dawn) {
          st.on = 1;
          st.t = 0;
          st.dur = 9;
          const a = (rng() < 0.5 ? 0 : Math.PI) + rnd(-0.4, 0.4);
          st.dx = Math.cos(a);
          st.dy = Math.sin(a) * 0.5;
          banner("Tempestade de Areia", "O vento empurra tudo");
          toast("Tempestade de Areia!");
          SFX.play("warn");
        }
      } else {
        st.t += dt;
        st.k = Math.min(1, st.t / 1.4, (st.dur - st.t) / 1.6);
        if (st.k < 0) st.k = 0;
        p.x += st.dx * 15 * st.k * dt;
        p.y += st.dy * 15 * st.k * dt;
        for (const e of g.enemies)
          if (!e.boss) {
            e.x += st.dx * 22 * st.k * dt;
            e.y += st.dy * 22 * st.k * dt;
          }
        for (const q of g.eshots) {
          q.x += st.dx * 30 * st.k * dt;
          q.y += st.dy * 30 * st.k * dt;
        }
        st.emit -= dt;
        if (st.emit <= 0 && g.enemies.length < 200) {
          st.emit = 1.7;
          const a = Math.atan2(-st.dy, -st.dx) + rnd(-0.9, 0.9);
          spawnEnemy("scorp", a, Math.hypot(VW, VH) / 2 + 20);
        }
        if (st.t >= st.dur) {
          st.on = 0;
          st.next = 58 + rnd(0, 26);
        }
      }
    } else if (wi === 2) {
      for (const e of g.enemies)
        if (e.t === "umbra") {
          const tg = nxLit(e.x, e.y) ? 1 : 0.3;
          e.al = e.al == null ? tg : e.al + (tg - e.al) * Math.min(1, dt * 6);
        }
    }
  }
  const _nxUw5 = updWeapons;
  updWeapons = function (dt) {
    _nxUw5(dt);
    if (G && !G.over && G.p) nxWorldTick(dt);
  };

  function nxAtmos() {
    const g = G;
    if (!g || !g.p || state === "menu") return;
    const wi = nxWi();
    if (wi === 0) return;
    const T = g.t,
      fx = FXQ(),
      st = g.nxw;
    if (wi === 1) {
      const k = st ? st.k : 0,
        dxs = st && st.on ? st.dx : 1,
        N = fx ? 26 + Math.round(120 * k) : 8 + Math.round(40 * k);
      ctx.save();
      ctx.fillStyle =
        "rgba(255,196,110," + (0.025 + 0.015 * Math.sin(T * 0.6)) + ")";
      ctx.fillRect(0, 0, VW, VH);
      if (k > 0.01) {
        ctx.fillStyle = "rgba(205,140,60," + 0.42 * k + ")";
        ctx.fillRect(0, 0, VW, VH);
        const gr = ctx.createRadialGradient(
          VW / 2,
          VH / 2,
          VH * 0.2,
          VW / 2,
          VH / 2,
          VW * 0.65,
        );
        gr.addColorStop(0, "rgba(120,70,20,0)");
        gr.addColorStop(1, "rgba(120,70,20," + 0.35 * k + ")");
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, VW, VH);
      }
      for (let i = 0; i < N; i++) {
        const sp = (14 + hz(i, 2) * 26) * (1 + k * 6) * dxs,
          x =
            ((((hz(i, 1) * VW * 1.3 + T * sp + camx * (0.4 + hz(i, 5) * 0.5)) %
              (VW + 30)) +
              VW +
              30) %
              (VW + 30)) -
            15,
          y =
            (((hz(i, 3) * VH + Math.sin(T * 0.7 + i) * 4 - camy * 0.25) % VH) +
              VH) %
            VH,
          len = 3 + hz(i, 4) * 7 * (1 + k * 2);
        ctx.fillStyle =
          "rgba(240,210,150," + (0.16 + hz(i, 6) * 0.3 + k * 0.25) + ")";
        ctx.fillRect(Math.round(x), Math.round(y), Math.round(len), 1);
      }
      ctx.restore();
    } else if (wi === 2) {
      nxDark(g);
      ctx.save();
      const N = fx ? 44 : 14;
      for (let i = 0; i < N; i++) {
        const x =
          (((hz(i, 1) * VW +
            Math.sin(T * 0.5 + i) * 10 -
            camx * (0.3 + hz(i, 5) * 0.4)) %
            VW) +
            VW) %
          VW,
          y =
            (((hz(i, 3) * VH + T * (7 + hz(i, 2) * 12) - camy * 0.2) % VH) +
              VH) %
            VH;
        if (i % 5 === 0) {
          ctx.fillStyle =
            "rgba(255,120,60," + (0.45 + 0.3 * Math.sin(T * 6 + i)) + ")";
          ctx.fillRect(Math.round(x), Math.round(VH - y), 1, 1);
        } else {
          ctx.fillStyle = "rgba(190,175,215," + (0.18 + hz(i, 6) * 0.25) + ")";
          ctx.fillRect(
            Math.round(x),
            Math.round(y),
            1,
            1 + (i % 3 === 0 ? 1 : 0),
          );
        }
      }
      ctx.restore();
    }
  }
  const _nxDraw4 = draw;
  draw = function () {
    nxFogSync();
    _nxDraw4();
    nxAtmos();
  };

  /* ---------- seleção de mundo: miniatura do terreno ---------- */
  const NXTH = {};
  function nxWorldThumb(i) {
    nxInit();
    if (NXTH[i]) return NXTH[i];
    const T = NXTILES[i],
      C = NXW[i],
      key = [
        ["g1", 0],
        ["g2", 1],
        ["g1", 2],
        ["dirt", 0],
        ["g2", 3],
        ["g1", 1],
        ["dirt", 1],
        ["g2", 0],
      ];
    const cv = mk(64, 32, (g) => {
      for (let n = 0; n < 8; n++) {
        const [grp, vi] = key[n];
        g.drawImage(
          T.tilesDay[grp][vi % T.tilesDay[grp].length],
          (n % 4) * 16,
          (n >> 2) * 16,
        );
      }
      const pick = {
        0: ["olive", "standStone", "haystack"],
        1: ["acacia", "ruinPillar", "tent"],
        2: ["blackTree", "crystal", "obelisk"],
      }[i];
      pick.forEach((k, j) => {
        const im = S.decor[k];
        if (im)
          g.drawImage(im, 6 + j * 20 - (im.width >> 1) + 8, 31 - im.height);
      });
      const sh = g.createLinearGradient(0, 0, 0, 32);
      sh.addColorStop(0, "rgba(0,0,0,0)");
      sh.addColorStop(1, "rgba(0,0,0,.35)");
      g.fillStyle = sh;
      g.fillRect(0, 0, 64, 32);
    });
    return (NXTH[i] = cv);
  }
  /* v0.54: miniaturas dos mundos agora são criadas em renderWorldPick (tela de modos). */

  /* ---------- biblioteca (demônios novos) e cena do menu ---------- */

  const _nxMD = menuDraw;
  menuDraw = function (t) {
    nxFogSync();
    _nxMD(t);
  };
  if (window.__nx)
    Object.assign(window.__nx, {
      NXW,
      WORLDS,
      nxLit,
      nxLightR,
      nxWi,
      nxShadowPass,
      nxWorldThumb,
      getRUN: () => RUN,
      ET,
      S,
      NXLIGHTS,
      getCam: () => [camx, camy],
      nxBuildEnemies,
      nxInit,
      decorAt: (a, b) => decorAt(a, b),
      hurt: (e, d, kx, ky, kb) => hurt(e, d, kx, ky, kb),
      menuDraw: (t) => menuDraw(t),
      renderPrep: (b) => renderPrep(b),
    });

  /* ================= v0.51: áudio de combate variado e feedback de coleta =================
     - Sons em WebAudio (sem atraso), com variação de tom/volume, limite de vozes, panorama e distância
     - Normaliza o volume e corta silêncios dos arquivos automaticamente (qualquer arquivo entra equilibrado)
     - Escada de notas ao coletar Fé em sequência, sequência de abates, passos por mundo, sons por arma
     - Cada som tem reserva sintetizada: se um arquivo faltar, o jogo continua soando
     - Música: Amanhecer e Vigília, com fade entre faixas e "abaixa a música" nos grandes momentos
     Arquivos esperados em assets/sfx/ (.ogg, .wav ou .mp3) e assets/music/. */
  const NXA = {
    buf: {},
    voices: {},
    active: 0,
    maxVoices: 22,
    lastT: {},
    cyc: {},
    pk: { chain: 0, t: -9, merged: 0 },
    kill: { n: 0, t: -9 },
    st: { px: null, py: null, d: 0, alt: 0 },
    hum: 0,
    dk: 1,
    dkT: 0,
    loaded: false,
    report: { ok: [], miss: [] },
  };
  const NXA_EXT = ["ogg", "wav", "mp3"];
  /* g = ganho base · r = faixa de tom · v = vozes simultâneas · gap = intervalo mínimo (ms) · pri = prioridade · max = duração máx (s) · rms = nível-alvo · duck = abaixa a música (ms) */
  const NXA_EV = {
    impact: {
      f: "sfx_impact",
      old: "hit",
      g: 0.5,
      r: [0.88, 1.14],
      v: 5,
      gap: 32,
      pri: 2,
      max: 0.32,
      rms: 0.1,
    },
    enemy_death: {
      f: "sfx_enemy_death",
      old: "kill",
      g: 0.62,
      r: [0.84, 1.16],
      v: 5,
      gap: 42,
      pri: 2,
      max: 0.65,
      rms: 0.1,
    },
    boss_death: {
      f: "sfx_boss_death",
      g: 0.95,
      r: [1, 1],
      v: 1,
      gap: 600,
      pri: 5,
      max: 3.6,
      rms: 0.13,
      duck: 1600,
    },
    boss_alert: {
      f: "sfx_boss_alert",
      g: 1.7,
      r: [1, 1],
      v: 1,
      gap: 900,
      pri: 5,
      max: 2.6,
      rms: 0.13,
      duck: 1300,
    },
    player_hurt: {
      f: "sfx_player_hurt",
      g: 1.3,
      r: [0.94, 1.06],
      v: 2,
      gap: 120,
      pri: 4,
      max: 0.8,
      rms: 0.12,
    },
    faith_pickup: {
      f: "sfx_faith_pickup",
      g: 0.55,
      r: [1, 1],
      v: 4,
      gap: 42,
      pri: 1,
      max: 0.5,
      rms: 0.09,
    },
    heal: {
      f: "sfx_heal",
      g: 0.7,
      r: [0.97, 1.03],
      v: 2,
      gap: 120,
      pri: 3,
      max: 1.4,
      rms: 0.1,
    },
    level_up: {
      f: "sfx_level_up",
      g: 0.85,
      r: [1, 1],
      v: 1,
      gap: 400,
      pri: 5,
      max: 2.6,
      rms: 0.12,
      duck: 1100,
    },
    card_select: {
      f: "sfx_card_select",
      g: 0.45,
      r: [0.98, 1.04],
      v: 2,
      gap: 80,
      pri: 3,
      max: 0.8,
      rms: 0.1,
    },
    chest: {
      f: "sfx_chest",
      g: 0.85,
      r: [1, 1],
      v: 1,
      gap: 500,
      pri: 5,
      max: 2.6,
      rms: 0.12,
      duck: 1000,
    },
    shield: {
      f: "sfx_shield",
      g: 0.7,
      r: [0.94, 1.08],
      v: 2,
      gap: 150,
      pri: 3,
      max: 1.2,
      rms: 0.1,
    },
    victory: {
      f: "sfx_victory",
      g: 0.9,
      r: [1, 1],
      v: 1,
      gap: 1500,
      pri: 5,
      max: 7,
      rms: 0.12,
      duck: 2800,
    },
    defeat: {
      f: "sfx_defeat",
      g: 0.9,
      r: [1, 1],
      v: 1,
      gap: 1500,
      pri: 5,
      max: 7,
      rms: 0.12,
      duck: 2800,
    },
    footstep: {
      f: "sfx_footstep",
      g: 0.8,
      r: [1, 1.25],
      v: 2,
      gap: 110,
      pri: 0,
      max: 0.3,
      rms: 0.06,
    },
    weapon_arrows: {
      f: "sfx_weapon_arrows",
      g: 0.5,
      r: [0.92, 1.1],
      v: 3,
      gap: 70,
      pri: 2,
      max: 0.55,
      rms: 0.1,
    },
    weapon_cross: {
      f: "sfx_weapon_cross",
      g: 0.55,
      r: [0.92, 1.1],
      v: 3,
      gap: 80,
      pri: 2,
      max: 0.7,
      rms: 0.1,
    },
    weapon_aura: {
      f: "sfx_weapon_aura",
      g: 0.4,
      r: [0.95, 1.05],
      v: 2,
      gap: 220,
      pri: 1,
      max: 1.1,
      rms: 0.08,
    },
    weapon_seal: {
      f: "sfx_weapon_seal",
      g: 0.5,
      r: [0.94, 1.08],
      v: 3,
      gap: 110,
      pri: 2,
      max: 1.0,
      rms: 0.1,
    },
  };
  const NXA_ALIAS = {
    hit: "impact",
    kill: "enemy_death",
    hurt: "player_hurt",
    pick: "faith_pickup",
    level: "level_up",
    block: "shield",
    win: "victory",
    lose: "defeat",
    boss: "boss_alert",
    sling: "weapon_arrows",
    card: "card_select",
    step: "footstep",
    w_arrows: "weapon_arrows",
    w_cross: "weapon_cross",
    w_aura: "weapon_aura",
    w_seal: "weapon_seal",
  };

  /* ---------- barramento com limitador (evita estourar quando há muitos sons) ---------- */
  SFX.mg = function () {
    if (!this._m) {
      const c = this.ctx;
      this._m = c.createGain();
      try {
        const k = c.createDynamicsCompressor();
        k.threshold.value = -14;
        k.knee.value = 12;
        k.ratio.value = 6;
        k.attack.value = 0.003;
        k.release.value = 0.18;
        this._m.connect(k);
        k.connect(c.destination);
      } catch (e) {
        this._m.connect(c.destination);
      }
    }
    this._m.gain.value = this.vol;
    return this._m;
  };

  /* ---------- carregamento: decodifica, corta silêncio e mede o volume de cada arquivo ---------- */
  const nxaDecode = (c, ab) =>
    new Promise((ok, no) => {
      try {
        const p = c.decodeAudioData(ab, ok, no);
        if (p && p.then) p.then(ok, no);
      } catch (e) {
        no(e);
      }
    });
  function nxaAnalyze(b, def) {
    const ch = b.getChannelData(0),
      n = b.length,
      sr = b.sampleRate;
    let pk = 0;
    for (let i = 0; i < n; i += 2) {
      const a = Math.abs(ch[i]);
      if (a > pk) pk = a;
    }
    if (pk < 1e-4) return null;
    const th = pk * 0.02;
    let s = 0,
      e = n - 1;
    while (s < n && Math.abs(ch[s]) < th) s++;
    while (e > s && Math.abs(ch[e]) < th) e--;
    s = Math.max(0, s - Math.round(sr * 0.004));
    e = Math.min(n - 1, e + Math.round(sr * 0.02));
    const len = Math.max(0.02, Math.min((e - s) / sr, def.max || 4)),
      lim = Math.min(n, s + Math.floor(len * sr));
    let sum = 0,
      cnt = 0;
    for (let i = s; i < lim; i += 2) {
      sum += ch[i] * ch[i];
      cnt++;
    }
    const rms = Math.sqrt(sum / Math.max(1, cnt)),
      norm = Math.max(
        0.2,
        Math.min(5, (def.rms || 0.1) / Math.max(rms, 1e-4), 1.25 / pk),
      );
    return { b, off: s / sr, dur: len, norm, pk, rms };
  }
  async function nxaLoadOne(ev) {
    const def = NXA_EV[ev],
      c = SFX.ctx,
      names = [];
    for (const x of NXA_EXT) names.push(def.f + "." + x);
    if (def.old) for (const x of NXA_EXT) names.push(def.old + "." + x);
    for (const nm of names) {
      try {
        const r = await fetch(ASSET_DIR + "sfx/" + nm);
        if (!r.ok) continue;
        const buf = await nxaDecode(c, await r.arrayBuffer()),
          A = nxaAnalyze(buf, def);
        if (A) {
          NXA.buf[ev] = A;
          NXA.report.ok.push(nm);
          return;
        }
      } catch (e) { }
    }
    NXA.report.miss.push(def.f);
  }
  function nxaLoadAll() {
    if (NXA.loaded || !SFX.ctx || typeof fetch !== "function") return;
    NXA.loaded = true;
    Promise.all(Object.keys(NXA_EV).map(nxaLoadOne)).then(() => {
      try {
        console.log(
          "[áudio] carregados:",
          NXA.report.ok.join(", ") || "(nenhum)",
          "| usando som sintetizado:",
          NXA.report.miss.join(", ") || "(nenhum)",
        );
      } catch (e) { }
    });
  }
  const _nxaInit = SFX.init;
  SFX.init = function () {
    _nxaInit.call(this);
    nxaLoadAll();
  };
  window.audioReport = () => ({
    ok: NXA.report.ok.slice(),
    miss: NXA.report.miss.slice(),
  });

  /* ---------- reprodução ---------- */
  const nxaRate = (def, ev) => {
    const r = def.r || [1, 1],
      k = (NXA.cyc[ev] = ((NXA.cyc[ev] || 0) + 1) % 7);
    return r[0] + (r[1] - r[0]) * ((k * 0.618 + Math.random() * 0.3) % 1);
  };
  function nxaPlay(ev, o) {
    const def = NXA_EV[ev],
      A = NXA.buf[ev],
      c = SFX.ctx;
    if (!A || !c) return false;
    const now = performance.now();
    if (
      NXA.lastT[ev] &&
      now - NXA.lastT[ev] < (o.gap != null ? o.gap : def.gap)
    )
      return "skip";
    if ((NXA.voices[ev] || 0) >= def.v) return "skip";
    if (NXA.active >= NXA.maxVoices && def.pri < 4) return "skip";
    NXA.lastT[ev] = now;
    const rate = Math.max(
      0.4,
      Math.min(2.4, o.rate != null ? o.rate : nxaRate(def, ev)),
    ),
      t = c.currentTime + (o.delay || 0),
      dur = A.dur / rate;
    const src = c.createBufferSource();
    src.buffer = A.b;
    src.playbackRate.value = rate;
    const g = c.createGain(),
      vol = def.g * A.norm * (o.gain == null ? 1 : o.gain),
      tail = Math.min(0.05, dur * 0.4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.setValueAtTime(vol, Math.max(t + 0.005, t + dur - tail));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    let node = src;
    if (o.lp) {
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = o.lp;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    let out = g;
    if (o.pan && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      g.connect(p);
      out = p;
    }
    out.connect(SFX.mg());
    NXA.voices[ev] = (NXA.voices[ev] || 0) + 1;
    NXA.active++;
    let done = false;
    src.onended = () => {
      if (!done) {
        done = true;
        NXA.voices[ev]--;
        NXA.active--;
      }
    };
    src.start(t, A.off, A.dur);
    src.stop(t + dur + 0.03);
    return "ok";
  }

  /* ---------- reservas sintetizadas (usadas quando o arquivo não existe) ---------- */
  let NXA_NOISE = null;
  function nxaNoise(dur, lp, vol, delay, hp) {
    const c = SFX.ctx;
    if (!c || !SFX.on) return;
    if (!NXA_NOISE) {
      NXA_NOISE = c.createBuffer(
        1,
        Math.floor(c.sampleRate * 0.6),
        c.sampleRate,
      );
      const d = NXA_NOISE.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime + (delay || 0),
      s = c.createBufferSource();
    s.buffer = NXA_NOISE;
    const f = c.createBiquadFilter();
    f.type = hp ? "highpass" : "lowpass";
    f.frequency.value = lp;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(SFX.mg());
    s.start(t);
    s.stop(t + dur + 0.02);
  }
  const J = (v, p) =>
    v * (1 + (Math.random() * 2 - 1) * (p == null ? 0.08 : p));
  const NXA_SYN = {
    impact(o) {
      const r = o.rate || 1,
        v = o.gain || 1;
      SFX.tone(J(190, 0.12) * r, 0.05, "square", 0.02 * v, -70);
      nxaNoise(0.04, 2400 * r, 0.02 * v, 0, true);
    },
    enemy_death(o) {
      const r = o.rate || 1,
        v = o.gain || 1,
        f = J(280, 0.12) * r;
      SFX.tone(f, 0.09, "triangle", 0.03 * v, -170);
      SFX.tone(f * 0.5, 0.14, "sine", 0.025 * v, -40, 0.02);
      nxaNoise(0.1, 1200 * r, 0.02 * v);
    },
    boss_death() {
      SFX.tone(90, 1.2, "sawtooth", 0.08, -60);
      SFX.tone(60, 1.6, "square", 0.05, -25, 0.1);
      nxaNoise(1.1, 500, 0.08);
      [392, 330, 262].forEach((f, i) =>
        SFX.tone(f, 0.5, "triangle", 0.04, 0, 0.5 + i * 0.25),
      );
    },
    boss_alert() {
      SFX.tone(70, 0.9, "sawtooth", 0.08, -20);
      SFX.tone(105, 0.9, "sawtooth", 0.05, -30, 0.1);
      SFX.tone(330, 0.25, "triangle", 0.05, 0, 0.5);
      SFX.tone(247, 0.35, "triangle", 0.05, 0, 0.72);
    },
    player_hurt(o) {
      const r = o.rate || 1;
      SFX.tone(150 * r, 0.22, "sawtooth", 0.06, -90);
      nxaNoise(0.12, 900, 0.05);
    },
    faith_pickup(o) {
      const r = o.rate || 1,
        v = o.gain || 1;
      SFX.tone(740 * r, 0.07, "triangle", 0.025 * v, 260 * r);
      SFX.tone(1480 * r, 0.05, "sine", 0.012 * v, 0, 0.03);
    },
    coin(o) {
      const r = o.rate || 1;
      SFX.tone(1100 * r, 0.05, "square", 0.02);
      SFX.tone(1560 * r, 0.08, "square", 0.02, 0, 0.05);
    },
    heal() {
      SFX.tone(520, 0.1, "triangle", 0.04);
      SFX.tone(780, 0.14, "triangle", 0.04, 0, 0.09);
      SFX.tone(1040, 0.18, "sine", 0.025, 0, 0.18);
    },
    level_up() {
      [523, 659, 784, 1046, 1318].forEach((f, i) =>
        SFX.tone(f, 0.16, "square", 0.032, 0, i * 0.075),
      );
      SFX.tone(262, 0.5, "triangle", 0.04, 0, 0.1);
    },
    card_select(o) {
      SFX.tone(J(880, 0.03), 0.06, "square", 0.02, 200);
      SFX.tone(J(1320, 0.03), 0.09, "triangle", 0.02, 0, 0.05);
    },
    chest() {
      nxaNoise(0.18, 1800, 0.04);
      SFX.tone(220, 0.22, "sawtooth", 0.04, 120);
      [523, 659, 784, 1046].forEach((f, i) =>
        SFX.tone(f, 0.24, "triangle", 0.04, 0, 0.22 + i * 0.09),
      );
    },
    shield(o) {
      const r = o.rate || 1;
      SFX.tone(900 * r, 0.08, "triangle", 0.04, -300);
      SFX.tone(1350 * r, 0.16, "sine", 0.025, -200, 0.03);
      nxaNoise(0.06, 3000, 0.02, 0, true);
    },
    victory() {
      [523, 659, 784, 1046, 1318].forEach((f, i) =>
        SFX.tone(f, 0.24, "triangle", 0.05, 0, i * 0.12),
      );
    },
    defeat() {
      [392, 330, 262, 196].forEach((f, i) =>
        SFX.tone(f, 0.32, "triangle", 0.05, 0, i * 0.18),
      );
    },
    footstep(o) {
      nxaNoise(0.05, (o.lp || 900) * (o.rate || 1), 0.05 * (o.gain || 1));
    },
    weapon_arrows(o) {
      const r = o.rate || 1;
      SFX.tone(J(520, 0.06) * r, 0.06, "square", 0.015, -200);
      nxaNoise(0.05, 3200, 0.012, 0, true);
    },
    weapon_cross(o) {
      const r = o.rate || 1,
        v = o.gain || 1;
      nxaNoise(0.12, 1800 * r, 0.035 * v, 0, true);
      SFX.tone(J(260, 0.08) * r, 0.1, "sawtooth", 0.025 * v, -140);
    },
    weapon_aura(o) {
      const r = o.rate || 1;
      SFX.tone(J(420, 0.04) * r, 0.4, "sine", 0.02 * (o.gain || 1), 120);
      SFX.tone(J(630, 0.04) * r, 0.5, "sine", 0.012, 100, 0.05);
    },
    weapon_seal(o) {
      const r = o.rate || 1,
        v = o.gain || 1;
      SFX.tone(J(330, 0.05) * r, 0.35, "triangle", 0.03 * v, 220);
      SFX.tone(J(660, 0.05) * r, 0.4, "sine", 0.02 * v, 150, 0.04);
      nxaNoise(0.15, 2600, 0.015 * v, 0, true);
    },
  };

  /* ---------- contexto: ajusta tom, volume, panorama e distância conforme o que aconteceu ---------- */
  const nxaDist = (x, y) => {
    const g = G;
    if (!g || !g.p) return 1;
    return 1 - Math.min(0.5, Math.hypot(x - g.p.x, y - g.p.y) / 420);
  };
  const nxaPan = (x) =>
    Math.max(-0.65, Math.min(0.65, ((x - camx - VW / 2) / (VW / 2)) * 0.6));
  const nxaFar = (x, y) => {
    const g = G;
    if (!g || !g.p) return 0;
    return Math.hypot(x - g.p.x, y - g.p.y) > 230 ? 2200 : 0;
  };
  function nxaXpPulse(chain, big) {
    const el = $("#xp");
    if (!el) return;
    const now = performance.now();
    if (now - (NXA.xpT || 0) < 90) return;
    NXA.xpT = now;
    el.classList.remove("nxpulse");
    void el.offsetWidth;
    el.classList.add("nxpulse");
    el.classList.toggle("nxbig", !!big || chain >= 8);
    clearTimeout(NXA.xpC);
    NXA.xpC = setTimeout(() => el.classList.remove("nxpulse", "nxbig"), 160);
  }
  const NXA_CTX = {
    impact(o) {
      const h = SFX.hc;
      if (!h || !h.e) return;
      const e = h.e,
        d = h.d || 1;
      o.rate =
        (o.rate != null ? o.rate : nxaRate(NXA_EV.impact, "impact")) *
        (e.boss
          ? 0.78
          : e.elite
            ? 0.9
            : Math.max(0.88, Math.min(1.2, 1.24 - e.r * 0.03)));
      o.gain =
        (o.gain || 1) *
        Math.max(0.7, Math.min(1.35, 0.75 + d / 16)) *
        nxaDist(e.x, e.y);
      o.pan = nxaPan(e.x);
      const lp = nxaFar(e.x, e.y);
      if (lp) o.lp = lp;
    },
    enemy_death(o) {
      const e = SFX.kc,
        K = NXA.kill,
        t = performance.now() / 1000;
      if (t - K.t > 0.7) K.n = 0;
      K.n++;
      K.t = t;
      o.rate =
        (o.rate != null ? o.rate : nxaRate(NXA_EV.enemy_death, "enemy_death")) *
        (1 + Math.min(0.2, K.n * 0.016));
      o.gain = o.gain || 1;
      if (e) {
        o.rate *= e.elite
          ? 0.86
          : Math.max(0.9, Math.min(1.15, 1.2 - e.r * 0.025));
        if (e.elite) {
          o.gain *= 1.2;
          SFX.tone(90, 0.16, "sine", 0.05, -30);
        }
        o.gain *= nxaDist(e.x, e.y);
        o.pan = nxaPan(e.x);
        const lp = nxaFar(e.x, e.y);
        if (lp) o.lp = lp;
      }
      if (K.n > 0 && K.n % 15 === 0) {
        SFX.tone(1568, 0.09, "triangle", 0.025);
        SFX.tone(2093, 0.12, "triangle", 0.02, 0, 0.06);
      }
    },
    faith_pickup(o) {
      const P = NXA.pk,
        t = performance.now() / 1000,
        xp = SFX.px || 1,
        big = xp >= 20,
        mid = xp >= 5;
      if (t - P.t > 0.9) P.chain = 0;
      P.chain++;
      P.t = t;
      const L = [1, 1.125, 1.25, 1.5, 1.667, 1.875, 2],
        step = Math.min(P.chain - 1, 6);
      o.rate =
        L[step] *
        (big ? 0.78 : mid ? 0.92 : 1) *
        (1 + (Math.random() - 0.5) * 0.015);
      o.gain =
        (big ? 1.35 : mid ? 1.05 : 0.85) + Math.min(0.4, P.merged * 0.08);
      P.merged = 0;
      if (P.chain >= 8 && P.chain % 2 === 0)
        SFX.tone(L[step] * 1568, 0.06, "sine", 0.012, 0, 0.02);
      if (P.chain === 10 || P.chain === 25 || P.chain === 50) {
        SFX.tone(1568, 0.1, "triangle", 0.03);
        SFX.tone(2093, 0.16, "triangle", 0.03, 0, 0.08);
        if (G && G.p)
          G.fx.push({
            wid: BTL.src || null,
            k: "txt",
            x: G.p.x,
            y: G.p.y - 16,
            s: "Fé ×" + P.chain,
            t: 0,
            life: 0.8,
            col: "#9fe0ff",
          });
      }
      nxaXpPulse(P.chain, big);
    },
    player_hurt(o) {
      const g = G;
      if (g && g.p)
        o.rate =
          (0.94 +
            0.12 *
            Math.max(0, Math.min(1, g.p.hp / Math.max(1, g.mods.maxhp)))) *
          (1 + (Math.random() - 0.5) * 0.05);
    },
    footstep(o) {
      const g = G,
        p = g && g.p,
        wi = nxWi(),
        st = NXA.st;
      st.alt ^= 1;
      o.rate = (st.alt ? 1.05 : 1.2) * (1 + (Math.random() - 0.5) * 0.08);
      let gain = 1;
      if (wi === 1) {
        o.lp = 1500;
        o.rate *= 0.9;
        gain = 0.85;
        if (g.nxw && g.nxw.k > 0.3) gain *= 0.5;
      } else if (wi === 2) {
        o.rate *= 1.1;
        gain = 1.05;
      } else if (p && onPath(p.x / TS, p.y / TS)) {
        o.rate *= 1;
        gain = 1;
      } else {
        o.lp = 1900;
        o.rate *= 0.95;
        gain = 0.75;
      }
      o.gain = gain;
    },
    level_up(o) {
      const g = G,
        pd = g && g.pending && g.pending[0];
      if (pd && pd.kind === "ark") {
        nxaGo("chest", {});
        o.delay = 0.45;
        o.gain = 0.7;
      }
    },
    victory() { },
    defeat() { },
  };
  const NXA_LAYER = {
    boss_alert() {
      SFX.tone(392, 0.3, "triangle", 0.05, 0, 0.45);
      SFX.tone(294, 0.45, "triangle", 0.05, 0, 0.72);
    },
    player_hurt() {
      nxaNoise(0.08, 1800, 0.035, 0, true);
    },
  };
  function nxaGo(ev, o) {
    o = Object.assign({}, o);
    const def = NXA_EV[ev];
    if (!def) return;
    if (ev === "enemy_death" && SFX.kc && SFX.kc.boss) ev = "boss_death";
    const f = NXA_CTX[ev];
    if (f) f(o);
    if (NXA_EV[ev].duck) nxaDuck(0.42, NXA_EV[ev].duck);
    const r = nxaPlay(ev, o);
    if (r) {
      if (r === "skip" && ev === "faith_pickup") NXA.pk.merged++;
      if (r === "ok" && NXA_LAYER[ev]) NXA_LAYER[ev]();
      return;
    }
    /* sem arquivo: reserva sintetizada (com o mesmo controle de intervalo) */
    const now = performance.now(),
      key = "s_" + ev;
    if (NXA.lastT[key] && now - NXA.lastT[key] < def.gap) {
      if (ev === "faith_pickup") NXA.pk.merged++;
      return;
    }
    NXA.lastT[key] = now;
    const S2 = NXA_SYN[ev];
    if (S2) S2(o);
  }
  const _nxaPlay = SFX.play;
  SFX.play = function (n, o) {
    if (!this.ctx || !this.on) return;
    try {
      const ev = NXA_ALIAS[n] || n;
      if (ev === "coin") {
        const P = NXA.pk,
          t = performance.now() / 1000,
          now = performance.now();
        if (NXA.lastT.coin && now - NXA.lastT.coin < 45) return;
        NXA.lastT.coin = now;
        if (t - NXA.cT > 0.9) NXA.cc = 0;
        NXA.cc = (NXA.cc || 0) + 1;
        NXA.cT = t;
        NXA_SYN.coin({
          rate: [1, 1.122, 1.26, 1.5, 1.68][Math.min(4, NXA.cc - 1)],
        });
        return;
      }
      if (NXA_EV[ev]) {
        nxaGo(ev, o);
        return;
      }
    } catch (e) { }
    return _nxaPlay.call(this, n);
  };
  NXA.cT = -9;

  /* ---------- ganchos: contexto de dano, abate, Fé ganha ---------- */
  const _nxaHurt = hurt;
  hurt = function (e, d, kx, ky, kb) {
    SFX.hc = { e, d };
    try {
      return _nxaHurt(e, d, kx, ky, kb);
    } finally {
      SFX.hc = null;
    }
  };
  const _nxaKill = kill;
  kill = function (e) {
    SFX.kc = e;
    try {
      return _nxaKill(e);
    } finally {
      SFX.kc = null;
    }
  };
  const _nxaGx = gainXp;
  gainXp = function (v) {
    SFX.px = v;
    return _nxaGx(v);
  };
  const _nxaCI = chooseIdx;
  chooseIdx = function (i) {
    const banishing = !!(
      G &&
      G.choiceTools &&
      G.choiceTools.action === "banish"
    ),
      c =
        !banishing && state === "levelup" && performance.now() >= LV_LOCK
          ? curChoices[i]
          : null,
      rejectedActive = !!(
        c &&
        c.kind === "a" &&
        !(G.al && G.al[c.id]) &&
        !canGainActive(G)
      ),
      evo = !!(c && c.kind === "evo");
    if (c && !rejectedActive) BTL.choice(c, curChoices.slice());
    const r = _nxaCI(i);
    if (c) SFX.play(evo ? "chest" : "card");
    return r;
  };

  /* ---------- armas: som para cada efeito novo, passos e zumbido da Menorá ---------- */
  const NXA_FX = {
    slash: (f) => [
      "weapon_cross",
      f.style === "jawbone"
        ? { rate: 0.7, gain: 1.15 }
        : { rate: 1 + rnd(-0.06, 0.12) },
    ],
    sea: () => ["weapon_seal", { rate: 0.55, gain: 1.1 }],
    axe: () => ["weapon_cross", { rate: 0.8, gain: 0.9 }],
    jzone: (f) =>
      f.delay
        ? ["weapon_seal", { rate: 1.3, gain: 0.7, delay: f.delay }]
        : null,
    net: (f) => ["weapon_seal", { rate: 0.85, gain: 0.8, delay: f.delay || 0 }],
    fwall: (f) => ["weapon_aura", { rate: 0.7, gain: 0.8, delay: f.wait || 0 }],
    whip: (f) => ["weapon_cross", { rate: 1.3, gain: 0.8, delay: (f.wait || 0) + 0.04 }],
    nxp: (f) =>
      f.style === "swordwave"
        ? ["weapon_cross", { rate: 1.35, gain: 0.7 }]
        : f.style === "holybolt"
          ? ["weapon_aura", { rate: 1.5, gain: 0.6 }]
          : null,
    ring: (f) =>
      f.style === "pulse" && f.follow
        ? ["weapon_aura", { rate: 1, gain: 0.85 }]
        : f.style === "quake"
          ? ["weapon_cross", { rate: 0.6, gain: 1.2 }]
          : f.style === "judg"
            ? ["weapon_seal", { rate: 0.8, gain: 0.9 }]
            : null,
  };
  function nxaWorld(dt) {
    const g = G,
      p = g.p;
    if (!SFX.on || !SFX.ctx) return;
    for (const f of g.fx) {
      if (f.sn) continue;
      f.sn = 1;
      const h = NXA_FX[f.k];
      if (h) {
        const r = h(f);
        if (r) nxaGo(r[0], r[1]);
      }
    }
    for (const s of g.shots) {
      if (s.sn) continue;
      s.sn = 1;
      if (s.k === "dove") nxaGo("weapon_arrows", { rate: 1.35, gain: 0.5 });
    }
    if (
      Object.keys(g.W || {}).some(
        (id) => WEAPONS[id] && WEAPONS[id].behavior === "rotating_beams",
      )
    ) {
      NXA.hum -= dt;
      if (NXA.hum <= 0) {
        NXA.hum = 1.4;
        nxaGo("weapon_aura", { rate: 0.6, gain: 0.35 });
      }
    }
    const st = NXA.st;
    if (st.px == null) {
      st.px = p.x;
      st.py = p.y;
    }
    const d = Math.hypot(p.x - st.px, p.y - st.py);
    st.px = p.x;
    st.py = p.y;
    if (d > 0 && d < 20 && state === "play") {
      st.d += d;
      if (st.d >= 22) {
        st.d = 0;
        nxaGo("footstep", {});
      }
    }
  }
  const _nxaUw = updWeapons;
  updWeapons = function (dt) {
    _nxaUw(dt);
    if (G && !G.over && G.p) {
      try {
        nxaWorld(dt);
      } catch (e) { }
    }
  };

  /* ---------- música: Amanhecer e Vigília, fade entre faixas e "abaixa a música" ---------- */
  function nxMusWant() {
    if (state === "dawning") NXA.dawnDone = false;
    const hasDawn = !!(MUSA.dawn && MUSA.dawn.length);
    /* o Amanhecer continua pela tela de vitória até a faixa acabar; depois volta a música do menu */
    const w =
      state === "dawning"
        ? "dawn"
        : state === "win"
          ? hasDawn && !NXA.dawnDone && NXA.dawnSeen
            ? "dawn"
            : "menu"
          : state === "menu" || state === "dead"
            ? "menu"
            : G && G.boss
              ? "boss"
              : G && G.inf
                ? "vigil"
                : "run";
    if (w === "dawn") NXA.dawnSeen = true;
    return (w === "dawn" || w === "vigil") && !(MUSA[w] && MUSA[w].length)
      ? w === "dawn"
        ? "menu"
        : "run"
      : w;
  }
  function nxFade(a, to, ms, done) {
    clearInterval(a._fi);
    const from = a._f == null ? 1 : a._f,
      t0 = performance.now();
    a._fi = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      a._f = from + (to - from) * k;
      try {
        a.volume = clamp(save.set.mvol * nxMusMul(a), 0, 1);
      } catch (e) { }
      if (k >= 1) {
        clearInterval(a._fi);
        if (done) done();
      }
    }, 40);
  }
  function nxaDuck(amt, ms) {
    if (!MUSA) return;
    NXA.dk = Math.min(NXA.dk, amt);
    nxMusicDuck = NXA.dk;
    clearTimeout(NXA.dkT);
    const apply = () => {
      if (musTrk) {
        try {
          musTrk.volume = clamp(save.set.mvol * nxMusMul(musTrk), 0, 1);
        } catch (e) { }
      }
    };
    apply();
    NXA.dkT = setTimeout(() => {
      const t0 = performance.now(),
        from = NXA.dk;
      const iv = setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / 700);
        NXA.dk = from + (1 - from) * k;
        nxMusicDuck = NXA.dk;
        apply();
        if (k >= 1) clearInterval(iv);
      }, 50);
    }, ms);
  }
  function nxMusLoad(cat, base, loop) {
    const exts = ["ogg", "mp3", "wav"];
    let i = 0;
    const next = () => {
      if (i >= exts.length) return;
      const a = new Audio();
      a.preload = "auto";
      a.loop = !!loop;
      a.addEventListener("error", next, { once: true });
      a.addEventListener(
        "canplaythrough",
        () => {
          (MUSA[cat] = MUSA[cat] || []).push(a);
          a.addEventListener("ended", () => {
            if (cat === "dawn") {
              NXA.dawnDone = true;
              if (musTrk === a) musCur = null;
              return;
            }
            if (musTrk === a) musNext();
          });
          if (nxMusWant() === cat) musCur = null;
        },
        { once: true },
      );
      a.src = ASSET_DIR + "music/" + base + "." + exts[i++];
    };
    next();
  }
  nxMusLoad("dawn", "music_dawn", false);
  nxMusLoad("vigil", "music_vigil", true);
  if (window.__nx)
    Object.assign(window.__nx, {
      NXA,
      NXA_EV,
      SFX,
      nxaGo,
      nxaRoute: (n, o) => SFX.play(n, o),
      nxaAnalyze,
      nxaLoadAll,
      getMus: () => musTrk,
      setMus: (v) => {
        musTrk = v;
      },
      MUSA,
      nxMusWant,
      nxMusIn,
      nxMusOut,
      nxaDuck,
      musApply: () => musApply(),
    });

  buildAll();
  buildBossArt();
  buildEnemyArt();
  buildHeroArt();
  initIcons();
  resize();
  buildMenu();
  updHeroBtn();
  loadAssets();
  try {
    profInit();
  } catch (e) {
    console.warn("[perfil]", e);
  }
  try {
    syncNewsBadge();
  } catch (e) { }
  bootScreen();
  window.FE_SURVIVOR_BALANCE = Object.freeze({
    schemaVersion: BALANCE_SCHEMA_VERSION,
    telemetryVersion: BALANCE_TELEMETRY_VERSION,
    getSummary: () => ({
      savedRuns: BTL.data.runs.length,
      activeRun: !!BTL.current,
      storageKey: BALANCE_STORE_KEY,
      localOnly: true,
      storageFull: !!BTL.storageFull,
      historyDiscardedRuns: BTL.data.historyDiscardedRuns || 0,
    }),
    exportJSON: () => BTL.exportJSON(false),
    exportCSV: () => BTL.exportCSV(),
    getData: () => BTL.clone(BTL.allData()),
  });
  window.__dbg =
    IS_NATIVE || !/[?&]debug\b/.test(location.search)
      ? {
        get state() {
          return state;
        },
      } /* sem ?debug: só o estado (botão Voltar do app) */
      : {
        /* ganchos de teste da economia (só com ?debug no navegador; nunca no app nativo) */
        eco: {
          ECO,
          PRODUCTS,
          STARTER,
          grant: (k, t, f) => Billing.grant(k, t, f),
          coinMul,
          mapCoinMul,
          runCoinMul,
          vigFactor,
          ecoGain,
          harvestTick,
          runCoins,
          runCoinsRaw,
          dailyBonus,
          adGoldUsed,
          wOpen,
          worldHint,
          ecoReport,
          skipXpAmount,
          offerShown,
          newRun: (h) => newRun(h),
          dayKey: () => dayKey(),
          yday: (k) => yday(k),
          endRun: (w, r, q) => _erD(w, r, q), /* encerra direto (sem as animações de morte/amanhecer) */
          checkAch: () => checkAch(),
          snapPre: (g) => snapPre(g),
          doRevive: () => doRevive(),
          startDaily: () => startDaily(),
          get G() {
            return G;
          },
          get RUN() {
            return RUN;
          },
          WORLDS,
        },
        solidAt,
        seed: (n) => {
          _balanceDebugSeed = Number(n);
          _rg = mul(n);
          _rf = mul(n ^ 0x9e3779b9);
        },
        unseed: () => {
          _balanceDebugSeed = null;
          _rg = _rf = Math.random;
        },
        unlockInf: () => {
          save.winH = save.winH || {};
          save.winH.davi = 1;
          persist();
          return "Vigília liberada";
        },
        lockInf: () => {
          save.winH = {};
          persist();
          return "Vigília bloqueada";
        },
        useAct: (i) => useAct(i),
        get choices() {
          return curChoices;
        },
        get slots() {
          return [SLOT_W, SLOT_P, MAXA];
        },
        bossTime: (i) => bossTime(i),
        get save() {
          return save;
        },
        HEROES,
        WORLDS,
        RUN,
        WIN_T,
        BOSS_T,
        MAXW,
        SLOT_W,
        SLOT_P,
        ACT,
        stick,
        goRun: (p) => goRun(p),
        setHero: (h) => {
          selHero = h;
        },
        toMenu: () => {
          state = "menu";
          G = null;
        },
        recalc: () => recalc(),
        get ACH() {
          return ACH;
        },
        get S() {
          return S;
        },
        ICONS,
        UI_URL,
        ASSET_LOG,
        get G() {
          return G;
        },
        get state() {
          return state;
        },
        startRun,
        chooseIdx,
        setT: (t) => {
          if (G) G.t = t;
        },
        update: (dt) => update(dt),
        updHud: () => updHud(),
        dblSetup: (n) => dblSetup(n),
        grantTest: (k, t, f) => Billing.grant(k, t, f),
        tapXY: (x, y) => {
          const r = cv.getBoundingClientRect();
          return {
            x: r.left + ((x - camx) / VW) * r.width,
            y: r.top + ((y - camy) / VH) * r.height,
          };
        },
        keys,
        gainAct,
        buildActs,
        buildRack,
        openLevelUp,
        toast,
        notify,
      };
  track("app_open");
  musSet(musWant()); /* música do menu já na abertura */
  raf = requestAnimationFrame(loop);

  /* ================= v0.47: partida de introdução (tutorial) =================
     Partida de verdade, mas controlada por roteiro: nada é salvo (persist/track/conquistas ficam desligados
     enquanto TUT.on) e, ao sair, o save é restaurado do instantâneo tirado no início. */
  (function tutorialModule() {
    const TOTAL = 7;
    const _upd = update,
      _drop = drop,
      _scat = scatter,
      _olu = openLevelUp,
      _pg = pauseGame;
    let ui = null,
      spotTg = null,
      rafId = 0,
      okCb = null,
      hintTm = 0,
      pulseEl = null,
      forcePos = null;

    function build() {
      if (ui) return ui;
      const root = document.createElement("div");
      root.id = "tut";
      root.hidden = true;
      root.innerHTML =
        '<div id="tutBlock"></div><svg id="tutSvg" width="100%" height="100%" aria-hidden="true"><defs><mask id="tutMask" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%"><rect width="100%" height="100%" fill="#fff"/><g id="tutHoles" fill="#000"></g></mask></defs><rect width="100%" height="100%" fill="rgba(5,3,12,.76)" mask="url(#tutMask)"/><g id="tutRings" fill="none"></g></svg><div id="tutCard" role="dialog" aria-live="polite"><small id="tutStep"></small><h3 id="tutT"></h3><p id="tutP"></p><div class="tut-btns"><button id="tutOk" class="btn" type="button"></button></div><button id="tutSkip" class="tut-skip" type="button"></button></div>';
      const hint = document.createElement("div");
      hint.id = "tutHint";
      hint.hidden = true;
      gameEl.appendChild(root);
      gameEl.appendChild(hint);
      ui = {
        root,
        block: root.querySelector("#tutBlock"),
        holes: root.querySelector("#tutHoles"),
        rings: root.querySelector("#tutRings"),
        card: root.querySelector("#tutCard"),
        step: root.querySelector("#tutStep"),
        t: root.querySelector("#tutT"),
        p: root.querySelector("#tutP"),
        ok: root.querySelector("#tutOk"),
        skip: root.querySelector("#tutSkip"),
        hint,
      };
      ui.ok.onclick = () => {
        const f = okCb;
        if (f) f();
      };
      ui.skip.onclick = () => TUT.exit(true);
      addEventListener(
        "keydown",
        (e) => {
          if (!TUT.on || ui.root.hidden) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopImmediatePropagation();
            ui.ok.click();
          }
        },
        true,
      );
      return ui;
    }
    function place() {
      if (!ui) return;
      const u = ui,
        gr = gameEl.getBoundingClientRect(),
        tg = spotTg,
        P = 8,
        shapes = [];
      if (tg && tg.el) {
        const e = $(tg.el);
        if (e) {
          const r = e.getBoundingClientRect();
          if (r.width > 0)
            shapes.push({
              x: r.left - gr.left - P,
              y: r.top - gr.top - P,
              w: r.width + 2 * P,
              h: r.height + 2 * P,
            });
        }
      } else if (tg && tg.pts) {
        const cr = cv.getBoundingClientRect(),
          k = cr.width / VW;
        for (const q of tg.pts()) {
          const rd = q.r * k + P;
          shapes.push({
            cx: cr.left - gr.left + (q.x - camx) * k,
            cy: cr.top - gr.top + (q.y - camy) * k,
            r: rd,
          });
        }
      }
      let holes = "",
        l = 1e9,
        t = 1e9,
        r2 = -1e9,
        b = -1e9;
      for (const s of shapes) {
        if (s.r) {
          holes +=
            '<circle cx="' +
            s.cx.toFixed(1) +
            '" cy="' +
            s.cy.toFixed(1) +
            '" r="' +
            s.r.toFixed(1) +
            '"/>';
          l = Math.min(l, s.cx - s.r);
          t = Math.min(t, s.cy - s.r);
          r2 = Math.max(r2, s.cx + s.r);
          b = Math.max(b, s.cy + s.r);
        } else {
          holes +=
            '<rect x="' +
            s.x.toFixed(1) +
            '" y="' +
            s.y.toFixed(1) +
            '" width="' +
            s.w.toFixed(1) +
            '" height="' +
            s.h.toFixed(1) +
            '" rx="12"/>';
          l = Math.min(l, s.x);
          t = Math.min(t, s.y);
          r2 = Math.max(r2, s.x + s.w);
          b = Math.max(b, s.y + s.h);
        }
      }
      if (u.holes.innerHTML !== holes) {
        u.holes.innerHTML = holes;
        u.rings.innerHTML = holes;
      }
      const c = u.card.classList;
      c.remove("side", "side-l", "side-r");
      if (forcePos) {
        c.toggle("top", forcePos === "top");
        return;
      }
      if (!shapes.length) {
        c.remove("top");
        return;
      }
      const w = r2 - l,
        cx = (l + r2) / 2,
        cy = (t + b) / 2;
      if (gr.width > gr.height * 1.25 && w < gr.width * 0.5) {
        c.remove("top");
        c.add("side", cx < gr.width * 0.5 ? "side-r" : "side-l");
      } else c.toggle("top", cy > gr.height * 0.52);
    }
    function frame() {
      if (!ui || ui.root.hidden) {
        rafId = 0;
        return;
      }
      place();
      rafId = requestAnimationFrame(frame);
    }
    function show(o) {
      const u = build();
      u.step.textContent = o.step
        ? "Dica " + o.step + "/" + TOTAL
        : "";
      u.t.textContent = o.title;
      u.p.textContent = o.text;
      u.ok.textContent = o.btn;
      u.skip.textContent = "Pular tutorial";
      u.skip.hidden = !!o.noSkip;
      u.block.style.pointerEvents = o.block === false ? "none" : "auto";
      spotTg = o.target || null;
      okCb = o.onOk;
      forcePos = o.pos || null;
      u.root.hidden = false;
      u.card.style.animation = "none";
      void u.card.offsetWidth;
      u.card.style.animation = "";
      place();
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(frame);
    }
    function hide() {
      if (!ui) return;
      ui.root.hidden = true;
      spotTg = null;
      okCb = null;
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    function hint(text, ms, pulse) {
      build();
      clearTimeout(hintTm);
      ui.hint.textContent = text;
      ui.hint.hidden = false;
      if (pulseEl) pulseEl.classList.remove("tut-pulse");
      pulseEl = pulse ? $(pulse) : null;
      if (pulseEl) pulseEl.classList.add("tut-pulse");
      if (ms) hintTm = setTimeout(hintHide, ms);
    }
    function hintHide() {
      clearTimeout(hintTm);
      if (ui) ui.hint.hidden = true;
      if (pulseEl) {
        pulseEl.classList.remove("tut-pulse");
        pulseEl = null;
      }
    }
    function freeze() {
      stick.on = false;
      stick.dx = stick.dy = 0;
      AIM.down = false;
      for (const k in keys) keys[k] = false;
      $("#stick").hidden = true;
      stick2.hidden = true;
      if (G) {
        G.shake = 0;
        G.hurtFlash = 0;
      }
      state = "tut";
    }
    function unfreeze() {
      hide();
      state = "play";
      last = performance.now();
      if (G) G.resumeT = Math.max(G.resumeT || 0, 0.35);
    }
    const live = () => G.enemies.filter((e) => !e.dead && !e.boss);
    const onScreen = (o) =>
      Math.abs(o.x - G.p.x) < VW / 2 - 8 && Math.abs(o.y - G.p.y) < VH / 2 - 8;
    function keepAlive(n) {
      if (TUT.clock - TUT.lastSp < 1.8 || live().length >= n) return;
      TUT.lastSp = TUT.clock;
      spawnEnemy("imp", rng() * 6.2832, 135);
    }
    const phoneUI = () => isTouch || TOUCH_UI;

    /* ---- as 7 dicas ---- */
    function cardLand() {
      freeze();
      show({
        step: 1,
        title: "Bem-vindo, " + G.hero.name + "!",
        btn: "Entendi",
        text: "Você é um herói da fé e acabou de chegar ao campo de batalha. Sua arma ataca sozinha o demônio mais próximo: você só precisa se mover e sobreviver.",
        target: { pts: () => [{ x: G.p.x, y: G.p.y, r: 15 }] },
        onOk() {
          unfreeze();
          TUT.ph = "move";
          TUT.moved = 0;
          TUT.mx = G.p.x;
          TUT.my = G.p.y;
          TUT.t0 = TUT.clock;
          hint(
            phoneUI()
              ? "Arraste o dedo pela tela para andar"
              : "Use W A S D ou as setas para andar",
            0,
          );
        },
      });
    }
    function cardHp() {
      freeze();
      show({
        step: 2,
        title: "Salvação (sua vida)",
        btn: "Entendi",
        text: "Esta é a sua barra de Salvação. Cada golpe de um demônio a reduz. Se ela chegar a zero, a fé fraqueja e a partida termina.",
        target: { el: "#hpbar" },
        onOk() {
          unfreeze();
          TUT.ph = "enemyWait";
          TUT.t0 = TUT.clock;
          for (const a of [0.35, 2.6, 4.4]) spawnEnemy("imp", a, 120);
        },
      });
    }
    function cardEnemy() {
      freeze();
      TUT.ph = "enemyCard";
      show({
        step: 3,
        title: "Demônios!",
        btn: "Entendi",
        text: "Eles vão perseguir você sem parar. Continue se movendo para não ser cercado: sua arma já atira neles automaticamente.",
        target: {
          pts: () =>
            live()
              .filter(onScreen)
              .map((e) => ({ x: e.x, y: e.y, r: 13 })),
        },
        onOk() {
          unfreeze();
          TUT.ph = "fight";
        },
      });
    }
    function cardGem() {
      const gem = TUT.gem;
      freeze();
      TUT.ph = "gemCard";
      show({
        step: 4,
        title: "Cristal de Fé",
        btn: "Entendi",
        text: "Todo demônio derrotado deixa um cristal de Fé. Chegue perto para coletar: ele enche a sua barra de Fé.",
        target: {
          pts: () =>
            G.pk.includes(gem) ? [{ x: gem.x, y: gem.y, r: 10 }] : [],
        },
        onOk() {
          unfreeze();
          TUT.ph = "collect";
        },
      });
    }
    TUT.onLevel = function () {
      if (this.ph === "levelPick") return;
      this.ph = "levelPick";
      hintHide();
      show({
        step: 5,
        title: "Você subiu de nível!",
        btn: "Entendi",
        pos: "top",
        text: "A cada nível você escolhe 1 entre 3 bênçãos: armas, dons ou habilidades. Cartas mais raras são mais fortes. Escolha uma para continuar.",
        target: { el: "#cards" },
        onOk() {
          hide();
        },
      });
    };
    function cardBoss() {
      freeze();
      TUT.ph = "bossCard";
      const b = G.boss;
      show({
        step: 6,
        title: "Um chefe apareceu!",
        btn: "Entendi",
        text: "Chefes são demônios gigantes, muito mais fortes que os comuns. A vida dele aparece na barra lá em cima. Enquanto ele estiver vivo, você fica preso na arena: desvie dos ataques e continue atirando.",
        target: {
          pts: () =>
            b && !b.dead
              ? [{ x: b.x, y: b.y, r: Math.max(34, b.r * 2.2) }]
              : [],
        },
        onOk() {
          unfreeze();
          TUT.ph = "bossFight";
          TUT.t0 = TUT.clock;
        },
      });
    }
    function cardDawn() {
      freeze();
      TUT.ph = "dawnCard";
      gameEl.classList.add("t-time");
      show({
        step: 7,
        title: "O amanhecer",
        btn: "Ver o amanhecer",
        text: "Este é o relógio da noite. Se você resistir até 10:00, o sol nasce, a luz destrói todos os demônios e você vence a partida. Vamos ver como é!",
        target: { el: "#timer" },
        onOk() {
          hide();
          TUT.ph = "dawn";
          startDawn();
        },
      });
    }

    /* ---- controle da partida ---- */
    TUT.tick = function (dt) {
      const g = G;
      g.tRing = g.tElite = g.itemT = 1e9;
      g.spawnAcc = 0;
      if (this.ph !== "fall") return false;
      this.clock += dt;
      if (this.clock < 0.6) {
        g.fallY = 190;
        return true;
      }
      this.vy = (this.vy || 30) + 1500 * dt;
      g.fallY -= this.vy * dt;
      if (g.fallY <= 0) {
        g.fallY = 0;
        burst(g.p.x, g.p.y + 8, 22, "#d9c9a0", 80);
        g.shake = 0.3;
        g.flash = 0.3;
        SFX.play("level");
        this.ph = "landWait";
        this.t0 = this.clock;
      }
      return true;
    };
    TUT.post = function (dt) {
      const g = G,
        p = g.p;
      this.clock += dt;
      switch (this.ph) {
        case "landWait":
          if (this.clock - this.t0 > 0.6) {
            this.ph = "landCard";
            cardLand();
          }
          break;
        case "move":
          this.moved += Math.hypot(p.x - this.mx, p.y - this.my);
          this.mx = p.x;
          this.my = p.y;
          if (this.moved > 70 || this.clock - this.t0 > 9) {
            hintHide();
            this.ph = "hpCard";
            gameEl.classList.add("t-hp");
            cardHp();
          }
          break;
        case "enemyWait":
          if (this.clock - this.t0 > 1.1) cardEnemy();
          break;
        case "fight":
          keepAlive(2);
          if (this.gem && g.pk.includes(this.gem) && onScreen(this.gem))
            cardGem();
          break;
        case "collect":
          keepAlive(2);
          if (!g.pk.includes(this.gem)) {
            gameEl.classList.add("t-xp");
            hint(
              "A barra de FÉ enche! Colete mais cristais para subir de nível.",
              5500,
              "#xp",
            );
            this.ph = "levelwait";
            this.t0 = this.clock;
          }
          break;
        case "levelwait":
          keepAlive(3);
          if (this.clock - this.t0 > 30) {
            this.t0 = this.clock;
            gainXp(g.need);
          }
          break;
        case "levelPick":
          if (state === "play") {
            hide();
            g.need = 1e9;
            gameEl.classList.add("t-rack");
            hint(
              "Suas armas e dons ficam guardados aqui.",
              5000,
              "#rack",
            );
            this.ph = "post";
            this.t0 = this.clock;
          }
          break;
        case "post":
          keepAlive(2);
          if (this.clock - this.t0 > 7) {
            spawnBoss(0);
            this.ph = "bossWait";
            this.t0 = this.clock;
          }
          break;
        case "bossWait":
          if (this.clock - this.t0 > 0.9 || !g.boss) cardBoss();
          break;
        case "bossFight":
          if (this.clock - this.t0 > 12 || !g.boss) {
            for (let i = g.pk.length - 1; i >= 0; i--)
              if (g.pk[i].type === "ark") g.pk.splice(i, 1);
            cardDawn();
          }
          break;
      }
    };
    TUT.done = function () {
      if (this.ph === "end") return;
      this.ph = "end";
      freeze();
      hintHide();
      show({
        title: "Tutorial concluído!",
        btn: "Ir para o menu",
        noSkip: true,
        pos: "bottom",
        text: "Agora você conhece o básico: sobreviva, colete Fé, escolha bênçãos, derrote os chefes e resista até o amanhecer. Nada desta partida foi salvo. Boa jornada!",
        onOk() {
          TUT.exit(false);
        },
      });
    };
    TUT.start = function (first) {
      if (this.on || (G && !G.over && state !== "menu")) return;
      build();
      this.snap = JSON.stringify(save);
      this.first = !!first;
      this.run0 = Object.assign({}, RUN);
      this.hero0 = selHero;
      this.bt0 = BOSS_T[0];
      this.on = true;
      this.ph = "fall";
      this.clock = 0;
      this.lastSp = -9;
      this.gem = null;
      this.vy = 0;
      save.set.atk = 0; /* ataque automático só durante o tutorial */
      Object.assign(RUN, { spawn: 0, coin: 1, mode: "std", daily: 0 });
      BOSS_T[0] = 1e9;
      selHero = "davi";
      gameEl.classList.remove("t-hp", "t-xp", "t-time", "t-rack");
      gameEl.classList.add("tutor");
      SCR.hidden = true;
      _sr3();
      const g = G;
      g.pending.length = 0;
      g.pk.length = 0;
      g.enemies.length = 0;
      g.eshots.length = 0;
      g.need = 3;
      g.xp = 0;
      g.fallY = 190;
      g.inf = false;
      g.tRing = g.tElite = g.itemT = 1e9;
      $("#toast").classList.remove("show");
      $("#banner").classList.remove("show");
      hintHide();
      hide();
      musSet(musWant());
    };
    TUT.exit = function (skipped) {
      if (!this.on) return;
      hide();
      hintHide();
      this.on = false;
      gameEl.classList.remove(
        "tutor",
        "t-hp",
        "t-xp",
        "t-time",
        "t-rack",
        "dying",
      );
      BOSS_T[0] = this.bt0;
      for (const k of Object.keys(RUN)) delete RUN[k];
      Object.assign(RUN, this.run0);
      selHero = this.hero0;
      const snap = JSON.parse(this.snap);
      for (const k of Object.keys(save)) delete save[k];
      Object.assign(save, snap);
      save.tut = 1;
      if (this.first) save.help = 1;
      persist();
      for (const k in hl) delete hl[k];
      stick.on = false;
      $("#stick").hidden = true;
      stick2.hidden = true;
      $("#banner").classList.remove("show");
      $("#toast").classList.remove("show");
      $("#lvlup").hidden = true;
      SLOT_W = 4;
      SLOT_P = 4;
      toMenu();
      musSet(musWant());
    };

    /* ---- ganchos no motor ---- */
    update = function (dt) {
      if (!TUT.on) return _upd(dt);
      if (TUT.tick(dt)) return;
      _upd(dt);
      if (TUT.on) TUT.post(dt);
    };
    drop = function (x, y, type) {
      if (TUT.on && type === "coin") return;
      const n = G.pk.length;
      _drop(x, y, type);
      if (TUT.on && !TUT.gem && /^f\d$/.test(type) && G.pk.length > n)
        TUT.gem = G.pk[G.pk.length - 1];
    };
    scatter = function () {
      if (TUT.on) return;
      _scat();
    };
    openLevelUp = function () {
      _olu();
      if (TUT.on) {
        const r = $("#rrBtn");
        if (r) r.hidden = true;
        TUT.onLevel();
      }
    };
    pauseGame = function () {
      if (!TUT.on) return _pg();
      if (state !== "play") return;
      freeze();
      show({
        title: "Tutorial pausado",
        btn: "Continuar",
        text: "Respire fundo. Quando estiver pronto, continue de onde parou.",
        onOk: unfreeze,
      });
    };
  })();

  /* ================= v0.46: transições de entrada e saída de telas ================= */
  (function screenTransitions() {
    const OUT_MS = 170,
      desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "hidden");
    function patch(el) {
      if (
        !(el instanceof HTMLElement) ||
        !el.classList.contains("ov") ||
        el.__fadeHide
      )
        return;
      el.__fadeHide = true;
      let timer = 0,
        logical = desc.get.call(el);
      Object.defineProperty(el, "hidden", {
        configurable: true,
        get() {
          return logical;
        },
        set(v) {
          v = !!v;
          clearTimeout(timer);
          el.classList.remove("ov-out");
          if (v && !logical && !desc.get.call(el)) {
            logical = true;
            el.classList.add("ov-out");
            timer = setTimeout(() => {
              el.classList.remove("ov-out");
              desc.set.call(el, true);
            }, OUT_MS);
          } else {
            logical = v;
            desc.set.call(el, v);
          }
        },
      });
    }
    gameEl.querySelectorAll(".ov").forEach(patch);
    new MutationObserver((rs) => {
      for (const r of rs)
        r.addedNodes.forEach((n) => {
          if (n.nodeType === 1) {
            patch(n);
            n.querySelectorAll && n.querySelectorAll(".ov").forEach(patch);
          }
        });
    }).observe(gameEl, { childList: true });
  })();
})();