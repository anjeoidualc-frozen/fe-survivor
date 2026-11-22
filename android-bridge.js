/* Fé Survivor – ponte Android (Capacitor). v0.39: FeTrack (analytics), proteção do botão Voltar. No navegador não faz nada: o jogo segue igual. */
(() => {
  "use strict";
  const C = window.Capacitor;
  if (!(C && C.isNativePlatform && C.isNativePlatform())) return;

  /* ====== CONFIGURAÇÃO DO ADMOB ======
     testing: true  -> usa blocos de TESTE do Google (sempre entregam anúncio; seguro para clicar).
     testing: false -> usa seus blocos reais. Só deixe false na versão de PRODUÇÃO.
     Não clique nos seus próprios anúncios reais: risco de suspensão da conta. */
  const CFG = {
    testing: false, //MUDAR PARA FALSE NA PRODUÇÃO
    testId: "ca-app-pub-3940256099942544/5224354917", // premiado (teste Google)
    realId: "ca-app-pub-1958769970316197/3914248676", // premiado (seu)
    testInterId: "ca-app-pub-3940256099942544/1033173712", // intersticial (teste Google)
    realInterId: "ca-app-pub-1958769970316197/5562369663", // crie um bloco "Intersticial" no AdMob e cole o ID
    productRemoveAds: "remove_ads", // ID do produto único (gerenciado) no Google Play Console
    appId: "com.fesurvivor.game",
    /* Google Play Games: cole aqui os IDs (começam com CgkI...) criados no Play Console. Deixe '' para ignorar. */
    pgs: {
      leaderboards: {
        time: "",
        kills: "CgkI9saj0aEbEAIQAg",
        level: "CgkI9saj0aEbEAIQAw",
        timeInf: "CgkI9saj0aEbEAIQMw" /* preencher com o ID do ranking 'Vigília Eterna – Tempo' no Play Console; vazio = não envia */,
      },
      achievements: {
        k25: "CgkI9saj0aEbEAIQBA",
        k100: "CgkI9saj0aEbEAIQBQ",
        k300: "CgkI9saj0aEbEAIQBg",
        k500: "CgkI9saj0aEbEAIQBw",
        k1000: "CgkI9saj0aEbEAIQCA",
        k2000: "CgkI9saj0aEbEAIQCQ",
        t1: "CgkI9saj0aEbEAIQCg",
        t3: "CgkI9saj0aEbEAIQCw",
        t5: "CgkI9saj0aEbEAIQDA",
        t8: "CgkI9saj0aEbEAIQDQ",
        t10: "CgkI9saj0aEbEAIQDg",
        b1: "CgkI9saj0aEbEAIQDw",
        b2: "CgkI9saj0aEbEAIQEA",
        b3: "CgkI9saj0aEbEAIQEQ",
        b4: "CgkI9saj0aEbEAIQEg",
        b5: "CgkI9saj0aEbEAIQEw",
        l10: "CgkI9saj0aEbEAIQFA",
        l20: "CgkI9saj0aEbEAIQFQ",
        l30: "CgkI9saj0aEbEAIQFg",
        w4: "CgkI9saj0aEbEAIQFw",
        p4: "CgkI9saj0aEbEAIQGA",
        a3: "CgkI9saj0aEbEAIQGQ",
        wmax: "CgkI9saj0aEbEAIQGg",
        ark: "CgkI9saj0aEbEAIQGw",
        h1: "CgkI9saj0aEbEAIQHA",
        h5: "CgkI9saj0aEbEAIQHQ",
        h12: "CgkI9saj0aEbEAIQHg",
        whero3: "CgkI9saj0aEbEAIQHw",
        ww2: "CgkI9saj0aEbEAIQIA",
        ww3: "CgkI9saj0aEbEAIQIQ",
        d1: "CgkI9saj0aEbEAIQIg",
        d3: "CgkI9saj0aEbEAIQIw",
        d7: "CgkI9saj0aEbEAIQJA",
        c1: "CgkI9saj0aEbEAIQJQ",
        c10: "CgkI9saj0aEbEAIQJg",
        c100: "CgkI9saj0aEbEAIQJw",
        c1000: "CgkI9saj0aEbEAIQKA",
        cmax: "CgkI9saj0aEbEAIQKQ",
        rev: "CgkI9saj0aEbEAIQKg",
        prova: "CgkI9saj0aEbEAIQKw",
        fast: "CgkI9saj0aEbEAIQLA",
        nodmg: "CgkI9saj0aEbEAIQLQ",
        mend: "CgkI9saj0aEbEAIQLg",
        r25: "CgkI9saj0aEbEAIQLw",
        r100: "CgkI9saj0aEbEAIQMA",
        mast: "CgkI9saj0aEbEAIQMQ",
        /* NOVAS (v0.68): crie no Play Console e cole o ID (CgkI...) aqui. Vazio = não envia; ao preencher, o PGS.sync() do jogo envia as já conquistadas. */
        vig15: "CgkI9saj0aEbEAIQNA" /* Sentinela da Noite */,
        vig20: "CgkI9saj0aEbEAIQNQ" /* Vigia Incansável */,
        tree: "CgkI9saj0aEbEAIQNg" /* Caminho Estreito */,
        evo1: "CgkI9saj0aEbEAIQNw" /* Transfigurado */,
      },
    },
  };
  const adId = () => (CFG.testing ? CFG.testId : CFG.realId);
  const interId = () => (CFG.testing ? CFG.testInterId : CFG.realInterId);

  const P = (n) => (C.Plugins && C.Plugins[n]) || C.registerPlugin(n);

  /* Timeout para qualquer chamada nativa: se o plugin não responder, a Promise falha em vez de ficar pendente para sempre. */
  const T = (p, ms, tag) => {
    let id;
    return Promise.race([
      Promise.resolve(p),
      new Promise((_, rej) => {
        id = setTimeout(
          () => rej(new Error("timeout" + (tag ? " " + tag : ""))),
          ms,
        );
      }),
    ]).finally(() => clearTimeout(id));
  };
  const errTxt = (e) =>
    String(
      (e && e.code != null ? e.code + ": " : "") +
      ((e && e.message) || e || "erro"),
    ).slice(0, 100);

  /* ---- Vibração/hápticos nativos (requer @capacitor/haptics instalado e sincronizado) ---- */
  let hapticQueue = Promise.resolve(),
    hapticsWarned = false;
  window.FeHaptics = {
    vibrate(pattern) {
      const play = async () => {
        const Haptics = P("Haptics");
        if (!Haptics || typeof Haptics.vibrate !== "function")
          throw new Error("Plugin Haptics não registrado no Android.");
        const values = (Array.isArray(pattern) ? pattern : [pattern]).slice(
          0,
          9,
        );
        for (let i = 0; i < values.length; i++) {
          const duration = Math.max(0, Math.min(500, Number(values[i]) || 0));
          if (i % 2 === 0) {
            if (duration > 0) {
              await Haptics.vibrate({ duration });
              // O método nativo resolve ao disparar a vibração; respeita sua duração antes do próximo segmento.
              if (i < values.length - 1)
                await new Promise((resolve) => setTimeout(resolve, duration));
            }
          } else if (duration > 0) {
            await new Promise((resolve) => setTimeout(resolve, duration));
          }
        }
        return true;
      };
      const task = hapticQueue.then(play, play);
      hapticQueue = task.then(
        () => undefined,
        () => undefined,
      );
      return task.catch((error) => {
        if (!hapticsWarned) {
          hapticsWarned = true;
          console.warn(
            "[haptics] Vibração nativa indisponível; verifique @capacitor/haptics e o sync do Android.",
            error,
          );
        }
        return false;
      });
    },
  };

  const $ = (s) => document.querySelector(s);
  const visible = (el) => !!el && !el.hidden && el.offsetParent !== null;
  let setupP = null,
    busy = false;

  function setup() {
    return (
      setupP ||
      (setupP = (async () => {
        const AdMob = P("AdMob");
        try {
          const ci = await T(AdMob.requestConsentInfo(), 10000, "consent");
          if (ci.isConsentFormAvailable && ci.status === "REQUIRED")
            await AdMob.showConsentForm();
        } catch (e) {
          console.warn("[consent]", e);
        }
        await T(
          AdMob.initialize({
            initializeForTesting: CFG.testing,

            // Classificação máxima: conteúdo adequado ao público geral.
            maxAdContentRating: "General",
          }),
          15000,
          "admob.initialize",
        );
      })().catch((e) => {
        setupP = null;
        throw e;
      }))
    );
  }
  const code = (e) =>
    e && (e.code != null || e.message)
      ? " (" +
      [e.code, e.message].filter((x) => x != null && x !== "").join(": ") +
      ")"
      : "";

  /* Anúncio premiado. Emula a API do CrazyGames que o jogo usa. adError recebe o motivo. */
  async function rewarded(cb) {
    if (busy) {
      cb.adError && cb.adError("Aguarde o anúncio atual terminar.");
      return;
    }
    busy = true;
    const AdMob = P("AdMob"),
      hs = [];
    let got = false,
      ended = false,
      wd = 0;
    const end = (ok, why) => {
      if (ended) return;
      ended = true;
      busy = false;
      clearTimeout(wd);
      hs.forEach((h) => {
        try {
          h.remove();
        } catch (e) { }
      });
      ok ? cb.adFinished && cb.adFinished() : cb.adError && cb.adError(why);
    };
    const on = (ev, fn) =>
      Promise.resolve(AdMob.addListener(ev, fn)).then((h) => hs.push(h));
    try {
      wd = setTimeout(
        () =>
          end(
            false,
            "O anúncio demorou demais para carregar. Verifique a internet e tente de novo.",
          ),
        30000,
      );
      await setup();
      await on("onRewardedVideoAdReward", () => {
        got = true;
      });
      await on("onRewardedVideoAdShowed", () => clearTimeout(wd));
      await on("onRewardedVideoAdDismissed", () =>
        setTimeout(
          () =>
            end(
              got,
              got
                ? ""
                : "Assista o anúncio até o fim para receber a recompensa.",
            ),
          300,
        ),
      );
      await on("onRewardedVideoAdFailedToLoad", (e) => {
        console.warn("[ads] load", e);
        end(
          false,
          "Sem anúncio disponível agora" +
          code(e) +
          ". Tente de novo em instantes.",
        );
      });
      await on("onRewardedVideoAdFailedToShow", (e) => {
        console.warn("[ads] show", e);
        end(false, "Não foi possível exibir o anúncio" + code(e) + ".");
      });
      await AdMob.prepareRewardVideoAd({
        adId: adId(),
        isTesting: CFG.testing,
      });
      cb.adStarted && cb.adStarted();
      await AdMob.showRewardVideoAd();
    } catch (e) {
      console.warn("[ads]", e);
      end(false, "Falha ao iniciar anúncios" + code(e) + ".");
    }
  }

  /* Anúncio intersticial (tipo 'midgame'). Se falhar, o jogo simplesmente continua: sem mensagem de erro ao jogador. */
  async function interstitial(cb) {
    if (busy) return cb.adError && cb.adError();
    busy = true;
    const AdMob = P("AdMob"),
      hs = [];
    let ended = false,
      wd = 0,
      shown = false;
    const end = (ok) => {
      if (ended) return;
      ended = true;
      busy = false;
      clearTimeout(wd);
      hs.forEach((h) => {
        try {
          h.remove();
        } catch (e) { }
      });
      ok ? cb.adFinished && cb.adFinished() : cb.adError && cb.adError();
    };
    const on = (ev, fn) =>
      Promise.resolve(AdMob.addListener(ev, fn)).then((h) => hs.push(h));
    try {
      wd = setTimeout(() => {
        if (!shown) end(false);
      }, 15000);
      await setup();
      await on("interstitialAdShowed", () => {
        shown = true;
        clearTimeout(wd);
      });
      await on("interstitialAdDismissed", () =>
        setTimeout(() => end(true), 200),
      );
      await on("interstitialAdFailedToLoad", (e) => {
        console.warn("[int] load", e);
        end(false);
      });
      await on("interstitialAdFailedToShow", (e) => {
        console.warn("[int] show", e);
        end(false);
      });
      await AdMob.prepareInterstitial({
        adId: interId(),
        isTesting: CFG.testing,
      });
      cb.adStarted && cb.adStarted();
      await AdMob.showInterstitial();
    } catch (e) {
      console.warn("[int]", e);
      end(false);
    }
  }

  window.CrazyGames = {
    SDK: {
      ad: {
        requestAd: (type, cb) =>
          type === "midgame" ? interstitial(cb || {}) : rewarded(cb || {}),
      },
    },
  };

  /* ---- Compras (plugin @capgo/native-purchases 7.x) ----
     Contrato usado pelo jogo (index.html > Billing):
       info(sku) / owned(sku) / buy(sku) / consume(sku) / pending()
     Sem sku = produto antigo "Remover anúncios" (CFG.productRemoveAds).
     Produtos ÚNICOS (mundos, remover anúncios): comprados com acknowledge automático.
     Produtos CONSUMÍVEIS (pacotes de moedas): sem acknowledge automático; o jogo entrega as moedas
     e só então chama consume(sku). Se o app fechar no meio, pending() devolve o pedido na próxima abertura. */
  const NP = () => P("NativePurchases"),
    TYPE = "inapp";
  const CONSUMABLE_SKUS = [
    "coins_1000",
    "coins_3500",
    "coins_9000",
  ]; /* iguais aos "sku" de PRODUCTS no index.html e ao Play Console */
  const skuOf = (s) => s || CFG.productRemoveAds;
  const isConsumable = (s) => CONSUMABLE_SKUS.includes(s);
  const okState = (p) =>
    p.purchaseState == null ||
    String(p.purchaseState) === "1" ||
    String(p.purchaseState).toUpperCase() === "PURCHASED";
  /* Fila: as chamadas do plugin de compras saem UMA POR VEZ (em paralelo elas travavam a ponte no Android) */
  let npq = Promise.resolve();
  const NPQ = (fn, ms, tag) => {
    const run = () => T(fn(), ms, tag);
    const r = npq.then(run, run);
    npq = r.then(
      () => { },
      () => { },
    );
    return r;
  };
  let lpP =
    null; /* se já há uma consulta de compras em andamento, reaproveita a mesma */
  const listPurchases = () =>
    lpP ||
    (lpP = NPQ(
      () => NP().getPurchases({ productType: TYPE }),
      12000,
      "getPurchases",
    )
      .then((r) => (r && r.purchases) || [])
      .finally(() => {
        lpP = null;
      }));
  const tokens = {}; /* sku -> purchaseToken da compra feita nesta sessão */
  const cancelled = (e) =>
    /cancel/i.test(String((e && (e.message || e.code)) || e || ""));
  window.FeIAP = {
    lastError:
      "" /* motivo da última falha (vazio = cancelado pelo jogador ou sem erro); o jogo mostra na tela */,
    async info(sku) {
      const r = await NPQ(
        () =>
          NP().getProduct({ productIdentifier: skuOf(sku), productType: TYPE }),
        12000,
        "getProduct",
      );
      return r && r.product;
    },
    async owned(sku) {
      const id = skuOf(sku);
      return (await listPurchases()).some(
        (p) => p.productIdentifier === id && okState(p),
      );
    },
    async buy(sku) {
      const id = skuOf(sku);
      window.FeIAP.lastError = "";
      /* sem timeout aqui: o jogador pode demorar na tela de pagamento do Google */
      if (isConsumable(id)) {
        try {
          const t = await NP().purchaseProduct({
            productIdentifier: id,
            productType: TYPE,
            quantity: 1,
            isConsumable: false,
            autoAcknowledgePurchases: false,
          });
          const token = t && t.purchaseToken;
          if (!token) {
            window.FeIAP.lastError = "compra sem token";
            return false;
          } /* sem token não dá para entregar com segurança */
          tokens[id] = token;
          return { ok: true, token };
        } catch (e) {
          console.warn("[iap]", e);
          if (!cancelled(e)) window.FeIAP.lastError = errTxt(e);
          return false;
        }
      }
      try {
        await NP().purchaseProduct({
          productIdentifier: id,
          productType: TYPE,
          quantity: 1,
        });
        return true;
      } catch (e) {
        console.warn("[iap]", e);
        if (
          /already.?own|ITEM_ALREADY_OWNED/i.test(
            String((e && (e.message || e.code)) || e || ""),
          )
        )
          return true; /* não consulta getPurchases aqui */
        if (!cancelled(e)) window.FeIAP.lastError = errTxt(e);
        return false;
      }
    },
    /* consome o pacote depois que o jogo entregou as moedas (permite comprar de novo) */
    async consume(sku) {
      let token = tokens[sku];
      if (!token) {
        const p = (await listPurchases()).find(
          (x) => x.productIdentifier === sku && okState(x),
        );
        token = p && p.purchaseToken;
      }
      if (!token) return;
      await NPQ(
        () => NP().consumePurchase({ purchaseToken: token }),
        15000,
        "consume",
      );
      delete tokens[sku];
    },
    /* pacotes pagos que ainda não foram consumidos (ex.: o app fechou logo após a compra) */
    async pending() {
      return (await listPurchases())
        .filter(
          (p) =>
            isConsumable(p.productIdentifier) && okState(p) && p.purchaseToken,
        )
        .map((p) => ({ sku: p.productIdentifier, token: p.purchaseToken }));
    },
  };

  /* ---- Google Play Games: conquistas e ranking (plugin @openforge/capacitor-game-connect) ---- */
  const GC = () => P("CapacitorGameConnect");
  const FePGS = (window.FePGS = {
    signed: false,
    lastError: "",
    ready: null,
    _p: null,
    /* uma única tentativa por vez: o login automático da abertura e o botão do Ranking compartilham a mesma promessa */
    signIn() {
      if (FePGS._p) return FePGS._p;
      return (FePGS._p = (async () => {
        await 0; /* garante que _p já foi atribuída antes do finally */
        try {
          const r = await T(GC().signIn(), 15000, "pgs.signIn");
          FePGS.signed = true;
          FePGS.lastError = "";
          FePGS.player = r && r.player_name;
          window.dispatchEvent(new Event("fepgs"));
          return true;
        } catch (e) {
          console.warn("[pgs] signIn", e);
          FePGS.signed = false;
          FePGS.lastError = errTxt(e);
          return false;
        } finally {
          FePGS._p = null;
        }
      })());
    },
    unlock(key) {
      const id = CFG.pgs.achievements[key];
      if (!id || !FePGS.signed) return;
      GC()
        .unlockAchievement({ achievementID: id })
        .catch((e) => console.warn("[pgs] unlock", e));
    },
    submit(key, v) {
      const id = CFG.pgs.leaderboards[key];
      if (!id || !FePGS.signed) return;
      GC()
        .submitScore({ leaderboardID: id, totalScoreAmount: Math.round(v) })
        .catch((e) => console.warn("[pgs] score", e));
    },
    async show(key) {
      const id = CFG.pgs.leaderboards[key];
      if (!id) {
        FePGS.lastError = "ranking sem ID configurado: " + key;
        return false;
      }
      if (!FePGS.signed && !(await FePGS.signIn())) return false;
      try {
        await T(
          GC().showLeaderboard({ leaderboardID: id }),
          20000,
          "pgs.leaderboard",
        );
        return true;
      } catch (e) {
        FePGS.lastError = errTxt(e);
        return false;
      }
    },
    async showAch() {
      if (!FePGS.signed && !(await FePGS.signIn())) return false;
      try {
        await T(GC().showAchievements(), 20000, "pgs.achievements");
        return true;
      } catch (e) {
        FePGS.lastError = errTxt(e);
        return false;
      }
    },
  });
  FePGS.ready =
    FePGS.signIn(); /* login automático ao abrir o jogo; a tela de carregamento espera por esta promessa. Se falhar, o jogo segue normalmente */

  /* ---- Backup na nuvem: Google Play Games > Jogos salvos (plugin nativo próprio "FeCloudSave", FeCloudSavePlugin.java) ----
     Usa o mesmo login do ranking/conquistas (FePGS). Contrato usado pelo jogo (game.js > Cloud):
       save(json, descricao) -> true/false          load() -> { ok, empty } | { ok, data, modified } | { ok:false }
     Em caso de falha, FeCloud.lastError traz o motivo. */
  window.FeCloud = {
    lastError: "",
    async ready() {
      if (FePGS.signed) return true;
      if (await FePGS.signIn()) return true;
      FeCloud.lastError = "Entre no Google Play Games.";
      return false;
    },
    async save(json, description) {
      FeCloud.lastError = "";
      if (!(await FeCloud.ready())) return false;
      try {
        await T(
          P("FeCloudSave").save({ data: json, description: description || "Fé Survivor" }),
          30000,
          "cloud.save",
        );
        return true;
      } catch (e) {
        console.warn("[cloud] save", e);
        FeCloud.lastError = errTxt(e);
        return false;
      }
    },
    async load() {
      FeCloud.lastError = "";
      if (!(await FeCloud.ready())) return { ok: false };
      try {
        const r = await T(P("FeCloudSave").load(), 30000, "cloud.load");
        if (!r || r.empty || !r.data) return { ok: true, empty: true };
        return { ok: true, data: r.data, modified: r.modified };
      } catch (e) {
        console.warn("[cloud] load", e);
        FeCloud.lastError = errTxt(e);
        return { ok: false };
      }
    },
  };

  /* ---- Avaliação (Play In-App Review: @capacitor-community/in-app-review 7.x) ---- */
  window.FeReview = {
    async inApp() {
      try {
        await P("InAppReview").requestReview();
      } catch (e) {
        console.warn("[review]", e);
      }
    },
    store() {
      location.href = "market://details?id=" + CFG.appId;
    },
  };

  /* ---- Compartilhar imagem da run ----
     1) Plugin nativo próprio "FeShare" (FeSharePlugin.java): envia imagem + texto no mesmo envio (ACTION_SEND), então o
        WhatsApp e outros apps usam o texto como legenda. 2) Reserva: @capacitor/filesystem + @capacitor/share. Esse plugin
        envia a imagem em modo "múltiplos arquivos" e o WhatsApp descarta o texto; nesse caso retorna { caption: false }
        e o jogo copia o texto para o usuário colar. */
  window.FeShare = {
    async image(base64, text, title) {
      try {
        await P("FeShare").shareImage({ data: base64, text: text || "", title: title || "Fé Survivor" });
        return { caption: true };
      } catch (e) {
        if (!/unimplemented|not implemented|not available|not registered/i.test(String((e && (e.code + " " + e.message)) || e)))
          throw e;
      }
      const FS = P("Filesystem"),
        SH = P("Share");
      if (!FS || !SH)
        throw new Error("Plugins de compartilhamento não registrados no Android.");
      const r = await T(
        FS.writeFile({ path: "fe-survivor-run.png", data: base64, directory: "CACHE" }),
        15000,
        "gravar imagem",
      );
      await SH.share({
        title: title || "Fé Survivor",
        text: text || "",
        files: [r.uri],
        dialogTitle: "Compartilhar minha run",
      });
      return { caption: false };
    },
  };

  /* ---- Diagnóstico: no console do chrome://inspect, rode  FeDiag().then(console.log)  ---- */
  window.FeDiag = async () => {
    const r = {},
      t = async (k, f) => {
        const s = Date.now();
        try {
          await T(f(), 8000, k);
          r[k] = "OK " + (Date.now() - s) + "ms";
        } catch (e) {
          r[k] = "ERRO " + errTxt(e);
        }
      };
    await t("haptics", () => P("Haptics").vibrate({ duration: 100 }));
    await t("produto remove_ads", () => window.FeIAP.info());
    await t("produto coins_1000", () => window.FeIAP.info("coins_1000"));
    await t("produto world_sur", () => window.FeIAP.info("world_sur"));
    await t("produto world_sombra", () => window.FeIAP.info("world_sombra"));
    await t("compras", () => listPurchases());
    r.playGames = FePGS.signed
      ? "logado"
      : "não logado (" + FePGS.lastError + ")";
    return r;
  };
  
  /* ---- Botão voltar do Android (protegido: se o plugin App não existir, o resto da ponte continua funcionando) ---- */
  try {
    P("App").addListener("backButton", () => {
      const st = window.__dbg && window.__dbg.state,
        esc = () =>
          document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
          );
      if (visible($("#sharePrev")))
        return $("#sharePrev").querySelector('[data-a="close"]').click();
      if (visible($("#newsModal"))) return $("#newsBack").click();
      if (visible($("#libDet"))) return $("#libDet").click();
      if (visible($("#confirm"))) return $("#cfNo").click();
      if (visible($("#hOk"))) return $("#hOk").click();
      if (visible($("#sBack"))) return $("#sBack").click();
      if (st === "play" || st === "paused") return esc();
      if (st === "dead" || st === "win") return $("#endMenuBtn").click();
      if (st === "menu") return P("App").exitApp();
    });
  } catch (e) {
    console.warn("[app] botão voltar indisponível", e);
  }

  /* ---- Tela sempre ligada durante o jogo ---- */
  try {
    P("KeepAwake").keepAwake();
  } catch (e) { }
  /* ---- Bloqueia zoom por gesto ---- */
  document.addEventListener("gesturestart", (e) => e.preventDefault());
})();
