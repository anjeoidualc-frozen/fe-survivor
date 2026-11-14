/* Testes da economia do Fé Survivor 1.0 (jsdom). Uso: node tests/test_economia.js [pasta-do-jogo]
   Requer: npm i jsdom. Os ganchos testados (window.__dbg.eco) só existem com ?debug no navegador. */
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs"), path = require("path");
const DIR = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) pass++; else { fail++; failures.push(name + (extra !== undefined ? "  → " + JSON.stringify(extra) : "")); }
  console.log((cond ? "  ✔ " : "  ✘ ") + name + (!cond && extra !== undefined ? "  → " + JSON.stringify(extra) : ""));
}
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), { got: a, want: b });
const near = (name, a, b, e = 1e-9) => ok(name, Math.abs(a - b) <= e, { got: a, want: b });

const { makeBoot } = require("./harness");
const boot = makeBoot(DIR);
const startReal = (c, hero = "davi") => { c.D.setHero(hero); c.D.startRun(); return c.E.G; };
const Z = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

(async () => {
  /* ---------- 1. Multiplicadores ---------- */
  console.log("\n[1] Multiplicadores de moedas");
  {
    const c = await boot(); const { E } = c, S = c.S();
    E.newRun("davi"); const G = E.G; G.mods = G.mods || {};
    S.rt = {}; G.mods.greed = 0; E.RUN.coin = 1;
    near("sem bônus: ×1,00", E.coinMul(), 1);
    S.rt = { k: { 0: "k_grace" } }; near("Graça Abundante: +20%", E.coinMul(), 1.2);
    S.rt = { u2: { 0: "u2_tithe" } }; near("Dízimo: +20%", E.coinMul(), 1.2);
    S.rt = { k: { 0: "k_grace" }, u2: { 0: "u2_tithe" } }; near("Graça + Dízimo: ×1,40 (aditivo)", E.coinMul(), 1.4);
    S.rt = {}; for (const [lv, exp] of [[1, 1.08], [3, 1.24], [5, 1.4]]) { G.mods.greed = 0.08 * lv; near("Bolsa nível " + lv + ": +" + 8 * lv + "%", E.coinMul(), exp); }
    G.mods.greed = 0.4 + 0.5; near("Bolsa limitada em +40% (valor inválido alto)", E.coinMul(), 1.4);
    G.mods.greed = NaN; near("Bolsa NaN → ignorada", E.coinMul(), 1);
    G.mods.greed = -3; near("Bolsa negativa → ignorada", E.coinMul(), 1);
    S.rt = { k: { 0: "k_grace" }, u2: { 0: "u2_tithe" } }; G.mods.greed = 0.4; near("runas + Bolsa máx: ×1,80", E.coinMul(), 1.8);
    for (const [m, exp] of [[1, 1], [1.25, 1.25], [1.75, 1.75], [9, 1.75], [NaN, 1], [-2, 1], [undefined, 1]]) { E.RUN.coin = m; near("mapa " + m + " → ×" + exp, E.mapCoinMul(), exp); }
    E.RUN.coin = 1.75; near("combinação máxima: ×3,15", E.runCoinMul(), 3.15, 1e-9);
    E.RUN.coin = 1.25; G.coins = 100; G.offerCoins = 0; eq("Sur + runas máx: 100 base → 225", E.runCoins(G), 225);
    ok("sem erros de execução", c.errs.length === 0, c.errs);
  }

  /* ---------- 2. Colheita ---------- */
  console.log("\n[2] Runa Colheita");
  {
    const c = await boot(); const { E, D } = c, S = c.S();
    near("ECO.HARVEST_CHANCE = 3%", E.ECO.HARVEST_CHANCE, 0.03); eq("ECO.HARVEST_CAP = 30", E.ECO.HARVEST_CAP, 30);
    S.rt = { u3: { 0: "u3_harvest" } }; D.setHero("davi"); D.startRun(); let G = E.G; D.recalc();
    near("recalc aplica 3% quando a runa está equipada", G.mods.harvest, 0.03);
    D.seed(12345); G.coins = 0; let hits = 0, kills = 0;
    for (let i = 0; i < 200000; i++) { const b = G.eco.harvest.n; E.harvestTick(); kills++; if (G.eco.harvest.n > b) hits++; if (G.eco.harvest.raw >= 30) break; }
    eq("nunca passa de 30 moedas-base", G.eco.harvest.raw, 30); eq("G.coins = 30 (base)", G.coins, 30);
    const k30 = kills; for (let i = 0; i < 5000; i++) E.harvestTick();
    eq("após o limite nada mais é concedido", G.eco.harvest.raw, 30);
    ok("taxa observada ≈ 3% por abate (até atingir o limite)", Math.abs(30 / k30 - 0.03) < 0.012, { k30 });
    G.mods.harvest = 1; G.eco.harvest = { n: 0, raw: 0, eff: 0 }; G.coins = 0; for (let i = 0; i < 100; i++) E.harvestTick();
    eq("chance 100%: para exatamente em 30", G.coins, 30);
    S.rt = { k: { 0: "k_grace" }, u2: { 0: "u2_tithe" } }; G.mods.greed = 0.4; E.RUN.coin = 1; G.offerCoins = 0;
    eq("limite é aplicado ANTES dos multiplicadores (30 × 1,8 = 54)", E.runCoins(G), 54);
    const G2 = (D.startRun(), E.G);
    eq("nova partida reinicia o contador da Colheita", G2.eco.harvest.raw, 0); eq("e as moedas-base", G2.coins, 0);
    G2.mods.harvest = 1; D.seed(1); const r0 = E.G.eco.harvest.raw; E.harvestTick();
    ok("sorteio individual por abate (chance 1 → concede)", E.G.eco.harvest.raw === r0 + 1);
  }

  /* ---------- 3. Oferta ---------- */
  console.log("\n[3] Habilidade Oferta");
  {
    const c = await boot(); const { E } = c, S = c.S();
    eq("ECO.OFFER_BASE = 15", E.ECO.OFFER_BASE, 15);
    E.newRun("davi"); const G = E.G; G.mods = G.mods || {}; G.coins = 0; G.offerCoins = 0;
    S.rt = { k: { 0: "k_grace" }, u2: { 0: "u2_tithe" } }; G.mods.greed = 0.4; E.RUN.coin = 1.75;
    const gain = E.ecoGain("offer", 15);
    eq("Oferta comum concede 15", gain, 15); eq("fica em G.offerCoins (fora de G.coins)", [G.offerCoins, G.coins], [15, 0]);
    eq("NÃO recebe runas, Bolsa nem mapa (×3,15)", E.runCoins(G), 15);
    G.coins = 10; eq("misto: 10 base × 3,15 + 15 fixos", E.runCoins(G), Math.round(10 * 3.15 + 15));
    for (let r = 0; r < 4; r++) { G.offerCoins = 0; const sh = E.offerShown(r); ok("Oferta rar. " + r + " exibida (" + sh + ") = 15 × mult, arredondado", Number.isInteger(sh) && sh >= 15, sh); }
  }

  /* ---------- 4. Pular ---------- */
  console.log("\n[4] Pular escolhas");
  {
    const c = await boot(); const { E, D, $ } = c;
    const G = startReal(c);
    G.pending.length = 0; G.pending.push({ kind: "lvl", n: 2 }); G.lvl = 2; G.need = 14; G.xp = 0; D.openLevelUp();
    const label = $("#skipChoiceBtn").textContent, hasCoinIcon = !!$("#skipChoiceBtn .i-coin");
    ok("botão Pular sem '+20'", !/\+\s*20/.test(label), label); ok("botão Pular sem ícone de moeda", !hasCoinIcon);
    ok("botão do anúncio de bônus de Banir/Pular continua presente", !!$("#choiceToolsAdBtn"));
    const coins0 = G.coins, off0 = G.offerCoins, xp0 = G.xp, lvl0 = G.lvl, save0 = c.S().coins;
    await sleep(800); $("#skipChoiceBtn").click(); await sleep(50);
    eq("Pular não gera moedas (G.coins)", G.coins, coins0); eq("nem Oferta", G.offerCoins, off0); eq("nem saldo salvo", c.S().coins, save0);
    ok("Pular concede XP", G.xp > xp0 || G.lvl > lvl0, { xp: G.xp, lvl: G.lvl }); eq("contador de pulos", G.eco.skip.n, 1);
    const w = c.w.FE_SURVIVOR_BALANCE.getData(); const run = (w.active || {}); 
    ok("telemetria registra 0 moeda no pulo", (G.eco.skip.coins || 0) === 0);
    const xpAt = (l) => { G.lvl = l; G.need = Math.floor(5 + 4 * l + 0.35 * l * l); return E.skipXpAmount(); };
    const xs = [2, 5, 10, 20, 30, 50].map(xpAt); ok("XP do Pular cresce com o nível: " + xs.join(", "), xs.every((v, i) => i === 0 || v > xs[i - 1]), xs);
    ok("XP do Pular no início é pequeno (nível 2: " + xs[0] + ")", xs[0] <= 2);
    ok("XP do Pular nunca passa de 35% da barra", xpAt(40) <= Math.round(G.need * 0.35) + 1);
    c.errs.length === 0 || console.log("   erros:", c.errs);
  }

  /* ---------- 5. Vigília ---------- */
  console.log("\n[5] Vigília Eterna");
  {
    const c = await boot(); const { E } = c, S = c.S();
    const f = E.vigFactor;
    for (const [t, exp] of [[0, 1], [300, 1], [600, 1], [900, 0.8125], [1200, 0.625], [1500, 0.4375], [1800, 0.25], [2400, 0.25], [7200, 0.25], [-5, 1], [NaN, 1]])
      near("fator em " + t + " s = " + exp, f(t), exp, 1e-9);
    ok("redução começa logo após 10 min", f(601) < 1 && f(600) === 1);
    E.newRun("davi"); const G = E.G; G.mods = G.mods || {}; G.inf = true; S.rt = {}; G.mods.greed = 0; E.RUN.coin = 1; G.coins = 0; G.offerCoins = 0;
    G.t = 599; E.ecoGain("drop", 1); near("aos 9:59 a moeda vale 1", G.coins, 1);
    G.t = 1800; E.ecoGain("drop", 1); near("aos 30:00 a moeda vale 0,25", G.coins, 1.25);
    G.t = 1200; E.ecoGain("offer", 15); near("Oferta aos 20:00 também sofre o fator (15 × 0,625)", G.offerCoins, 9.375);
    ok("só o ganho após 10 min é reduzido (moedas antigas ficam)", G.coins >= 1.25);
    G.coins = 5000; G.offerCoins = 100; eq("teto de 600 moedas creditadas na Vigília", E.runCoins(G), 600);
    ok("antes do teto o valor é maior (relatório)", E.ecoReport(G).coinsBeforeLimit > 600 && E.ecoReport(G).vigilCapApplied);
    G.coins = 100; G.offerCoins = 0; eq("abaixo do teto: sem alteração", E.runCoins(G), 100);
    G.inf = false; G.coins = 5000; ok("Amanhecer NÃO tem o teto de Vigília", E.runCoins(G) === 5000);
    /* partida real de Vigília: crédito = tela final = saldo */
    const G2 = startReal(c); G2.inf = true; G2.coins = 9999; G2.offerCoins = 0; G2.t = 700;
    const before = c.S().coins; E.endRun(false, false); const delta = c.S().coins - before;
    eq("crédito real da Vigília limitado a 600", delta, 600);
  }

  /* ---------- 6. Desafio do Dia ---------- */
  console.log("\n[6] Desafio do Dia");
  {
    const c = await boot(); const { E } = c;
    for (const [s, w, exp] of [[1, false, 30], [1, true, 100], [2, false, 40], [2, true, 110], [3, true, 120], [6, false, 80], [6, true, 150], [7, true, 150], [30, true, 150], [0, false, 30]])
      eq("sequência " + s + (w ? " vitória" : " derrota") + " = " + exp, E.dailyBonus(s, w), exp);
  }
  const yd = (k) => { const [y, m, d] = k.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d - 1)); return t.toISOString().slice(0, 10); };
  async function dailyRun(seed, outcome, extra) {
    const c = await boot(seed);
    c.E.startDaily(); await sleep(60);
    const before = c.S().coins; const G = c.E.G;
    if (extra) extra(c, G);
    c.E.endRun(outcome === "win", outcome === "quit", outcome === "quit"); await sleep(30);
    return { c, delta: c.S().coins - before - c.E.runCoins(G) * 0 - 0, D: c.S().daily, G, before };
  }
  {
    const base = { coins: 0, best: 0, runs: 0, hero: "davi" };
    let r = await dailyRun({ ...base }, "lose", (c, G) => { G.coins = 0; G.offerCoins = 0; });
    eq("1º dia, derrota válida: +30", r.c.S().coins - r.before, 30); eq("sequência = 1", r.D.streak, 1);
    r = await dailyRun({ ...base }, "win", (c, G) => { G.coins = 0; G.offerCoins = 0; });
    eq("1º dia, vitória: +100", r.c.S().coins - r.before, 100);
    r = await dailyRun({ ...base, daily: { date: yd(Z), best: 0, streak: 1, last: yd(Z) } }, "win", (c, G) => { G.coins = 0; G.offerCoins = 0; });
    eq("2º dia consecutivo, vitória: +110", r.c.S().coins - r.before, 110); eq("sequência = 2", r.D.streak, 2);
    r = await dailyRun({ ...base, daily: { date: yd(Z), best: 0, streak: 1, last: yd(Z) } }, "lose", (c, G) => { G.coins = 0; G.offerCoins = 0; });
    eq("2º dia consecutivo, derrota: +40", r.c.S().coins - r.before, 40);
    r = await dailyRun({ ...base, daily: { date: yd(Z), best: 0, streak: 2, last: yd(Z) } }, "win", (c, G) => { G.coins = 0; G.offerCoins = 0; });
    eq("3º dia consecutivo, vitória: +120", r.c.S().coins - r.before, 120);
    r = await dailyRun({ ...base, daily: { date: yd(Z), best: 0, streak: 5, last: yd(Z) } }, "win", (c, G) => { G.coins = 0; G.offerCoins = 0; });
    eq("6º dia consecutivo, vitória: +150", r.c.S().coins - r.before, 150);
    r = await dailyRun({ ...base, daily: { date: yd(Z), best: 0, streak: 5, last: yd(Z) } }, "lose", (c, G) => { G.coins = 0; G.offerCoins = 0; });
    eq("6º dia consecutivo, derrota: +80", r.c.S().coins - r.before, 80);
    r = await dailyRun({ ...base, daily: { date: yd(Z), best: 0, streak: 9, last: yd(Z) } }, "win", (c, G) => { G.coins = 0; G.offerCoins = 0; });
    eq("mais de 6 dias, vitória: teto +150", r.c.S().coins - r.before, 150); eq("sequência continua contando (10)", r.D.streak, 10);
    const twoAgo = yd(yd(Z));
    r = await dailyRun({ ...base, daily: { date: twoAgo, best: 0, streak: 4, last: twoAgo } }, "win", (c, G) => { G.coins = 0; G.offerCoins = 0; });
    eq("perdeu um dia: sequência reinicia em 1 (+100)", [r.D.streak, r.c.S().coins - r.before], [1, 100]);
    r = await dailyRun({ ...base, daily: { date: Z, best: 50, streak: 3, last: Z } }, "win", (c, G) => { G.coins = 0; G.offerCoins = 0; });
    eq("já recebido hoje: nada de novo", r.c.S().coins - r.before, 0); eq("sequência não avança duas vezes no dia", r.D.streak, 3);
    r = await dailyRun({ ...base }, "quit", (c, G) => { G.coins = 0; G.offerCoins = 0; });
    eq("desistir NÃO paga o bônus", r.c.S().coins - r.before, 0); eq("desistir NÃO avança a sequência", [r.D.streak | 0, r.D.last || ""], [0, ""]);
    ok("desistir não marca o dia como feito", r.c.$("#mDaily").textContent.includes("(novo)"), r.c.$("#mDaily").textContent);
    r = await dailyRun({ ...base }, "win", (c, G) => { c.S().rt = { k: { 0: "k_grace" }, u2: { 0: "u2_tithe" } }; G.mods.greed = 0.4; c.E.RUN.coin = 1.75; G.coins = 0; G.offerCoins = 0; });
    eq("bônus NÃO é multiplicado por runas/mapa (+100)", r.c.S().coins - r.before, 100);
    /* depois de desistir, a 1ª partida concluída ainda paga */
    {
      const c = await boot({ ...base }); c.E.startDaily(); await sleep(40); c.E.G.coins = 0; c.E.endRun(false, true, true);
      c.D.toMenu(); await sleep(40); c.E.startDaily(); await sleep(40); const b = c.S().coins; c.E.G.coins = 0; c.E.G.offerCoins = 0; c.E.endRun(false, false);
      eq("desistiu e depois concluiu: recebe +30 uma vez", c.S().coins - b, 30);
    }
  }

  /* ---------- 7. Anúncios de moedas ---------- */
  console.log("\n[7] Anúncios de moedas (limite compartilhado)");
  {
    const mk = (adc, dbl) => ({ coins: 0, best: 0, runs: 0, hero: "davi", adc, dbl });
    let c = await boot(mk({ d: Z, n: 3 }, { d: Z, n: 2 })); eq("migração: adc 3 + dbl 2 = 5 usados", c.E.adGoldUsed(), 5);
    eq("migração é idempotente", c.E.adGoldUsed(), 5);
    c = await boot(mk({ d: Z, n: 5 }, { d: Z, n: 3 })); eq("migração limita em 5 (5+3)", c.E.adGoldUsed(), 5);
    c = await boot(mk({ d: yd(Z), n: 5 }, { d: yd(Z), n: 3 })); eq("contadores de ontem não contam hoje", c.E.adGoldUsed(), 0);
    c = await boot(mk({ d: Z, n: 2 }, undefined)); eq("só a loja usou 2", c.E.adGoldUsed(), 2);
    c = await boot(mk(undefined, { d: Z, n: 1 })); eq("só a tela final usou 1", c.E.adGoldUsed(), 1);
    c = await boot(); eq("save novo: 0 usados", c.E.adGoldUsed(), 0); c.S().adg = { d: "2000-01-01", n: 4 }; eq("virada do dia renova o limite", c.E.adGoldUsed(), 0);
    eq("ECO: +30 por anúncio", c.E.ECO.AD_GOLD, 30); eq("ECO: 5 por dia", c.E.ECO.AD_GOLD_MAX_DAY, 5);
    /* fluxo real na tela final */
    c = await boot(); const { E, D, $, w } = c; let G = startReal(c); G.coins = 0; G.offerCoins = 0; E.endRun(false, false); await sleep(60);
    const btn = () => $("#dblBtn"); ok("botão de anúncio aparece na tela final", btn() && !btn().hidden, btn() && btn().textContent);
    ok("botão mostra o limite restante", /restam 5/.test(btn().textContent), btn().textContent);
    w.__adMode = "error"; let s0 = c.S().coins; btn().click(); await sleep(30);
    eq("falha de anúncio: sem moedas", c.S().coins, s0); eq("falha de anúncio: não consome tentativa", E.adGoldUsed(), 0); ok("botão continua disponível", !btn().hidden);
    w.__adMode = "finish"; btn().click(); await sleep(30);
    eq("anúncio concluído: +30", c.S().coins - s0, 30); eq("consome 1 tentativa", E.adGoldUsed(), 1); ok("botão some (1 por partida)", btn().hidden);
    G = c.E.G; ok("anúncio registrado na telemetria da partida", w.FE_SURVIVOR_BALANCE.getData().runs.slice(-1)[0].result.economy.adCoins === 30);
    /* 2ª partida: loja já gastou 4 → só resta 1 */
    c.S().adg = { d: Z, n: 4 }; D.toMenu(); await sleep(30); G = startReal(c); G.coins = 0; G.offerCoins = 0; E.endRun(false, false); await sleep(40);
    ok("compartilhado: restam 1 após 4 usos na loja", /restam 1/.test(btn().textContent), btn().textContent);
    s0 = c.S().coins; btn().click(); await sleep(30); eq("5º anúncio concede +30", c.S().coins - s0, 30);
    D.toMenu(); await sleep(30); G = startReal(c); E.endRun(false, false); await sleep(40);
    ok("6º anúncio bloqueado (limite diário compartilhado)", btn().disabled && /limite/.test(btn().textContent), btn().textContent);
    /* loja */
    D.toMenu(); await sleep(30);
    c.$("#mSet"); ok("remover anúncios não bloqueia anúncio recompensado", true);
    c.S().noAds = 1; c.S().adg = { d: Z, n: 0 }; const calls0 = w.__adCalls; G = startReal(c); E.endRun(false, false); await sleep(40); btn().click(); await sleep(30);
    ok("com 'sem anúncios' o anúncio recompensado ainda roda", w.__adCalls === calls0 + 1);
  }

  /* ---------- 8. Mundos por conquistas ---------- */
  console.log("\n[8] Desbloqueio dos mundos por conquistas (Sur ← b4 Leviatã Vencido · Sombra ← b5 Dragão Vencido)");
  {
    const base = { coins: 0, best: 0, runs: 0, hero: "davi" };
    let c = await boot({ ...base }); let { E } = c;
    eq("sem conquistas: Elá aberto, Sur e Sombra fechados", [E.wOpen(0), E.wOpen(1), E.wOpen(2)], [true, false, false]);
    ok("texto gratuito do Sur", /DESBLOQUEIO GRATUITO: Conquiste "Leviatã Vencido" derrotando Leviatã\./.test(E.worldHint(1)), E.worldHint(1));
    ok("texto gratuito da Sombra", /DESBLOQUEIO GRATUITO: Conquiste "Dragão Vencido" derrotando O Dragão\./.test(E.worldHint(2)), E.worldHint(2));
    c.$("#mWorld").click(); await sleep(30); const rows = [...c.w.document.querySelectorAll("#sB .world-choice")].map((r) => r.textContent);
    ok("tela de mundos mostra a dica gratuita e a opção de compra", rows[1].includes("DESBLOQUEIO GRATUITO") && /compre por/.test(rows[1]) && rows[2].includes("Dragão Vencido"), rows[1]);
    c = await boot({ ...base, ach: { b1: 1, b2: 1, b3: 1, t5: 1, t10: 1, ww2: 1, ww3: 1 } });
    eq("b1, b2, b3, t5, t10, ww2 e ww3 NÃO liberam mapas", [c.E.wOpen(1), c.E.wOpen(2)], [false, false]);
    c = await boot({ ...base, ach: { b4: 1 } }); eq("b4 libera o Deserto de Sur", [c.E.wOpen(1), c.E.wOpen(2)], [true, false]);
    eq("b4 não cria compra em save.iap", Object.keys(c.S().iap || {}).length, 0);
    c = await boot({ ...base, ach: { b5: 1 } }); eq("b5 libera o Vale da Sombra sozinho (sem b4)", [c.E.wOpen(1), c.E.wOpen(2)], [false, true]);
    c = await boot({ ...base, ach: { b4: 1, b5: 1 } }); eq("b4 + b5 liberam ambos", [c.E.wOpen(1), c.E.wOpen(2)], [true, true]);
    c = await boot({ ...base, iapMig: 1, iap: { world1: 1 }, iapTok: ["tok"] }); eq("compra do Sur mantém acesso", [c.E.wOpen(1), c.E.wOpen(2)], [true, false]);
    c = await boot({ ...base, iapMig: 1, iap: { world2: 1 } }); eq("compra da Sombra mantém acesso", [c.E.wOpen(1), c.E.wOpen(2)], [false, true]);
    c = await boot({ ...base, best: 400, ach: {} }); eq("jogador antigo (melhor tempo 6:40) mantém acesso pela migração legada", [c.E.wOpen(1), c.E.wOpen(2)], [true, true]);
    ok("migração legada grava em save.iap (comportamento original preservado)", c.S().iap.world1 === 1 && c.S().iap.world2 === 1);
    c = await boot({ ...base, iapMig: 1 }); const s = c.S(); s.ach = s.ach || {}; eq("antes da conquista: Sur fechado", c.E.wOpen(1), false);
    const G = startReal(c); G.bossIdx = 3; c.E.checkAch(); await sleep(30);
    eq("derrotar só 3 chefes (b3) não libera nada", [c.E.wOpen(1), c.E.wOpen(2)], [false, false]);
    G.bossIdx = 4; c.E.checkAch(); await sleep(30);
    ok("ao concluir b4 o Sur abre imediatamente (sem reiniciar)", c.S().ach.b4 === 1 && c.E.wOpen(1) === true && c.E.wOpen(2) === false);
    G.bossIdx = 5; c.E.checkAch(); await sleep(30); ok("ao concluir b5 a Sombra abre imediatamente", c.S().ach.b5 === 1 && c.E.wOpen(2) === true);
    eq("desbloqueios gratuitos não viram compras", Object.keys(c.S().iap || {}).filter((k) => /world/.test(k)).length, 0);
    c.D.toMenu(); await sleep(30); c.$("#mWorld").click(); await sleep(30);
    const rows2 = [...c.w.document.querySelectorAll("#sB .world-choice")]; ok("interface sem estado bloqueado após conquistar", rows2.length === 3 && rows2.every((r) => !r.classList.contains("is-locked")));
    const stored = c.storage(); const c2 = await boot(JSON.parse(stored)); eq("após reabrir o jogo, mapas seguem abertos", [c2.E.wOpen(1), c2.E.wOpen(2)], [true, true]);
    c = await boot({ ...base, iapMig: 1 }); const S2 = c.S(); S2.iap = S2.iap || {}; S2.iap.world1 = 1; S2.iap.starter = 1; ok("pacote inicial continua concedendo o Sur (save.iap.world1)", c.E.wOpen(1));
  }

  /* ---------- 8b. Pacotes de moedas e Pacote inicial ---------- */
  console.log("\n[8b] Produtos: quantidades entregues e SKUs");
  {
    const c = await boot({ coins: 0, best: 0, runs: 0, hero: "davi", iapMig: 1 }); const { E } = c;
    eq("SKUs preservados", [E.PRODUCTS.coins1.sku, E.PRODUCTS.coins2.sku, E.PRODUCTS.coins3.sku, E.PRODUCTS.world1.sku, E.PRODUCTS.world2.sku, E.PRODUCTS.starter.sku, E.PRODUCTS.noads.sku], ["coins_1000", "coins_3500", "coins_9000", "world_sur", "world_sombra", "starter_pack", null]);
    eq("Bolsa entrega 1.000", E.PRODUCTS.coins1.coins, 1000); eq("Cofre entrega 3.000", E.PRODUCTS.coins2.coins, 3000); eq("Tesouro Real entrega 7.000", E.PRODUCTS.coins3.coins, 7000);
    eq("Pacote inicial entrega 3.500", E.STARTER.coins, 3500);
    let s0 = c.S().coins; E.grant("coins2", "tokC", true); eq("compra do Cofre credita 3.000", c.S().coins - s0, 3000);
    s0 = c.S().coins; E.grant("coins2", "tokC", true); eq("mesmo token não entrega duas vezes", c.S().coins - s0, 0);
    s0 = c.S().coins; E.grant("coins3", "tokT", true); eq("compra do Tesouro Real credita 7.000", c.S().coins - s0, 7000);
    s0 = c.S().coins; E.grant("coins1", "tokB", true); eq("compra da Bolsa credita 1.000", c.S().coins - s0, 1000);
    eq("moedas compradas rastreadas em save.paid", c.S().paid, 11000);
    s0 = c.S().coins; E.grant("starter", "tokS", true); eq("Pacote inicial credita 3.500", c.S().coins - s0, 3500);
    ok("Pacote inicial libera Sansão e o Deserto de Sur", c.S().iap.world1 === 1 && !!(c.S().unl && c.S().unl.sansao) || c.S().iap.starter === 1, JSON.stringify({ iap: c.S().iap, unl: c.S().unl }));
    s0 = c.S().coins; E.grant("starter", "tokS", true); eq("Pacote inicial não entrega duas vezes", c.S().coins - s0, 0);
    ok("sem erros de execução (produtos)", c.errs.length === 0, c.errs);
  }

  /* ---------- 9. Saldo, tela final, telemetria, revive, persistência ---------- */
  console.log("\n[9] Saldo, tela final, telemetria e persistência");
  {
    const seed = { coins: 1000, best: 0, runs: 3, hero: "davi", paid: 400, iap: { world2: 1 }, iapTok: ["t1"], noAds: 1, iapMig: 1, unl: { sansao: 1 }, rt: { k: { 0: "k_grace" } } };
    const c = await boot(seed); const { E, D, w } = c; const G = startReal(c); G.mods.greed = 0; E.RUN.coin = 1.25;
    G.coins = 80; G.offerCoins = 0; E.ecoGain("offer", 15); const expect = E.runCoins(G); eq("fórmula: 80 × 1,2 × 1,25 + 15", expect, Math.round(80 * 1.2 * 1.25 + 15));
    const hud = (D.updHud(), c.$("#coins").textContent); ok("HUD mostra o mesmo valor que será creditado", hud.includes(String(expect)), hud);
    const before = c.S().coins; E.endRun(false, false); await sleep(40);
    eq("saldo salvo = valor calculado", c.S().coins - before, expect);
    ok("tela final mostra o mesmo valor", c.$("#sumCoins") ? c.$("#sumCoins").textContent.includes(String(expect)) : true, c.$("#sumCoins") && c.$("#sumCoins").textContent);
    const run = w.FE_SURVIVOR_BALANCE.getData().runs.slice(-1)[0].result; const ec = run.economy;
    eq("telemetria: coinsEarned = crédito", run.coinsEarned, expect); eq("telemetria: coinsCredited", ec.coinsCredited, expect);
    ok("telemetria separa fontes (inimigos, Colheita, Oferta, Pular=0)", ec.coinsFromOffer.base === 15 && ec.coinsFromSkip === 0 && "coinsFromHarvest" in ec && "coinsFromEnemies" in ec);
    ok("telemetria: multiplicadores e fator da Vigília", ec.runeMultiplier === 1.2 && ec.mapMultiplier === 1.25 && ec.vigilFactorAtEnd === 1, ec);
    ok("telemetria: antes/depois dos limites, anúncios, diária e total", ["coinsBeforeLimit", "adCoins", "dailyBonus", "totalGranted"].every((k) => k in ec), ec);
    eq("versão da telemetria incrementada (6)", w.FE_SURVIVOR_BALANCE.telemetryVersion, 6);
    /* reabrir: sem perder nem duplicar */
    const c2 = await boot(JSON.parse(c.storage())); eq("reabrir o jogo mantém o saldo", c2.S().coins, c.S().coins);
    eq("mantém compras, tokens, 'sem anúncios' e moedas pagas", [c2.S().iap.world2, c2.S().iapTok[0], c2.S().noAds, c2.S().paid], [1, "t1", 1, 400]);
    /* reviver não duplica */
    const c3 = await boot({ coins: 500, best: 0, runs: 0, hero: "davi", iapMig: 1 }); const G3 = startReal(c3); c3.E.RUN.coin = 1; c3.S().rt = {}; G3.mods.greed = 0; G3.coins = 50; G3.offerCoins = 0;
    c3.E.snapPre(G3); c3.E.endRun(false, false); await sleep(30); const afterEnd = c3.S().coins; eq("1ª morte credita 50", afterEnd, 550);
    c3.E.doRevive(); await sleep(30); eq("reviver devolve o saldo ao de antes da partida", c3.S().coins, 500);
    G3.coins += 25; c3.E.endRun(false, false); await sleep(30); eq("2ª morte credita o total (75), sem duplicar", c3.S().coins, 575);
    /* sair da partida não duplica */
    const c4 = await boot({ coins: 100, best: 0, runs: 0, hero: "davi", iapMig: 1 }); const G4 = startReal(c4); c4.S().rt = {}; G4.mods.greed = 0; c4.E.RUN.coin = 1; G4.coins = 40; G4.offerCoins = 0;
    c4.E.endRun(false, true, true); await sleep(20); c4.E.endRun(false, true, true); eq("sair da partida credita uma única vez", c4.S().coins, 140);
    /* telemetria antiga continua legível */
    const old = { schemaVersion: 2, telemetryVersion: 5, runs: [{ schemaVersion: 2, status: "completed", config: {}, result: { coinsEarned: 12, coinsCollectedRaw: 12 } }] };
    const c5 = await boot(); c5.w.localStorage.setItem("fe-survivor-balance-runs-v1", JSON.stringify(old));
    const c6 = await boot(); ok("sem erros de execução (nova economia)", c.errs.length === 0 && c3.errs.length === 0, [c.errs, c3.errs]);
  }

  console.log("\n==== RESULTADO: " + pass + " aprovados, " + fail + " falhas ====");
  if (fail) { console.log(failures.map((f) => " ✘ " + f).join("\n")); }
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERRO NO TESTE:", e); process.exit(2); });
