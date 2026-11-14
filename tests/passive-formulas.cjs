'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..');
const registrySource = fs.readFileSync(path.join(root, 'content', 'registry.js'), 'utf8');
const gameSource = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const host = { console: { warn() {} } };
host.window = host;
vm.createContext(host);
vm.runInContext(registrySource, host, { filename: 'registry.js' });
const C = host.FE_SURVIVOR_CONTENT;
if (!C) throw new Error('Registry did not expose FE_SURVIVOR_CONTENT');

function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error('Missing function: ' + signature);
  const open = source.indexOf('{', start);
  let depth = 0, quote = null, escaped = false, lineComment = false, blockComment = false;
  for (let i = open; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (lineComment) { if (ch === '\n') lineComment = false; continue; }
    if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('Unclosed function: ' + signature);
}

const recalcSource = extractFunction(gameSource, 'function recalc()');
const expected = {
  armadura: { dr: 0.75 },
  coracao: { maxhp: 15 },
  incenso: { area: 1.35 },
  uncao: { duration: 1.40 },
  paes: { amount: 2 },
  alegria: { luck: 0.25 },
  provisao: { greed: 0.40 },
  provacao: { curse: 0.15, curseSpd: 0.075 },
  coroa: { dmg: 1.265, pspd: 1.15, area: 1.15, duration: 1.15, curse: 0.12 }
};
const results = [];
for (const [id, checks] of Object.entries(expected)) {
  const G = { hero: C.heroes.davi, hk: 'davi', mods: {}, P: { [id]: C.passives[id].maxLevel }, passiveTrees: {} };
  const context = {
    G,
    PASSIVES: C.passives,
    MAXP: 5,
    HRNG: { davi: 170 },
    effP: () => G.P,
    passiveMaxLevel: key => Math.max(1, Math.min(5, Math.floor(Number(C.passives[key]?.maxLevel) || 5))),
    shopMods: m => { m.dr = 0; }
  };
  vm.createContext(context);
  vm.runInContext(recalcSource + '\nrecalc();', context, { filename: 'game.js#recalc' });
  for (const [key, target] of Object.entries(checks)) {
    const actual = G.mods[key];
    if (Math.abs(actual - target) > 1e-9) throw new Error(`${id}.${key}: expected ${target}, got ${actual}`);
  }
  results.push({ id, maxLevel: C.passives[id].maxLevel, outputs: checks, actual: Object.fromEntries(Object.keys(checks).map(k => [k, G.mods[k]])) });
}
// Manto is a one-charge runtime effect, not a passive stat. Verify the one-time trigger,
// 35% restore, and 2.4 s invulnerability are still present in the real damage handler.
const hurtStart = gameSource.indexOf('function hurtPlayer(');
const hurtEnd = gameSource.indexOf('\n  /* ================= armas', hurtStart);
const hurt = gameSource.slice(hurtStart, hurtEnd);
for (const fragment of ['G.P.manto > 0', '!G.reviveUsed', 'G.reviveUsed = true', 'G.mods.maxhp * 0.35', '2.4']) {
  if (!hurt.includes(fragment)) throw new Error('Manto runtime fragment missing: ' + fragment);
}
// Verify each effect is connected to the intended gameplay subsystem.
const integrationChecks = {
  area: /\(m\.area \|\| 1\)/.test(gameSource),
  duration: /\(m\.duration \|\| 1\)/.test(gameSource),
  amount: /amountBonus\(m\)/.test(gameSource),
  luck: /G\.mods\.luck/.test(gameSource) && /rollRar\(/.test(gameSource),
  greed: /G\.mods\.greed/.test(gameSource) && /coinMul/.test(gameSource),
  curse: /G\.mods\.curse/.test(gameSource) && /G\.mods\.curseSpd/.test(gameSource)
};
for (const [key, ok] of Object.entries(integrationChecks)) if (!ok) throw new Error('Missing integration: ' + key);
const statRawSource = extractFunction(gameSource, 'function statRaw()');
const statValueSource = extractFunction(gameSource, 'function statValue(k, value)');
const statRowsSource = extractFunction(gameSource, 'function statRows(cur, base, keys)');
const roundGameplayValueSource = extractFunction(gameSource, 'function roundGameplayValue(value)');
const hurtSource = extractFunction(gameSource, 'function hurt(e, d, kx, ky, kb)');
const hurtPlayerSource = extractFunction(gameSource, 'function hurtPlayer(d, src)');
const statusContext = {
  G: { mods: { dmg: 1.1, cd: 1, spd: 62, rng: 170, area: 1.07, pickup: 26, maxhp: 10, block: 0, crit: 0, xp: 1, dr: .15, duration: 1.08, amount: 1, luck: .05, greed: .08, curse: .03, curseSpd: .015 }, P: { manto: 1 } },
  ST_KEYS: ['Dano', 'Vel. de ataque', 'Vel. de movimento', 'Alcance de ataque', 'Alcance de coleta', 'Salvação máx.', 'Bloqueio', 'Crítico', 'Fé ganha'],
  ST_OPTIONAL: ['Redução de dano', 'Área dos ataques', 'Duração dos efeitos', 'Unidades extras', 'Sorte', 'Moedas ao fim', 'Vida/aparição demoníaca', 'Velocidade demoníaca', 'Ressurreição'],
  ST_DEFAULT: { 'Redução de dano': 0, 'Área dos ataques': 100, 'Duração dos efeitos': 100, 'Unidades extras': 0, 'Sorte': 0, 'Moedas ao fim': 0, 'Vida/aparição demoníaca': 0, 'Velocidade demoníaca': 0, 'Ressurreição': '—' },
  ST_UNIT: { 'Área dos ataques': '%', 'Duração dos efeitos': '%', 'Sorte': '%', 'Moedas ao fim': '%', 'Vida/aparição demoníaca': '%', 'Velocidade demoníaca': '%' },
};
vm.createContext(statusContext);
vm.runInContext(roundGameplayValueSource + '\n' + statRawSource + '\n' + statValueSource + '\n' + statRowsSource + '\n' +
  'globalThis.statusNow = statRaw(); globalThis.statusHtml = statRows(statusNow, { ...statusNow, "Alcance de ataque": 170, "Área dos ataques": 100, "Duração dos efeitos": 100, "Unidades extras": 0, "Sorte": 0, "Moedas ao fim": 0, "Vida/aparição demoníaca": 0, "Velocidade demoníaca": 0, "Redução de dano": 0, "Ressurreição": "—" });',
  statusContext, { filename: 'game.js#status-stats' });
if (Math.abs(statusContext.statusNow['Alcance de ataque'] - 181.9) > 1e-9) {
  throw new Error('Raw attack reach must include Incenso area: expected 181.9, got ' + statusContext.statusNow['Alcance de ataque']);
}
const roundingCases = [[1.1,1],[1.3,1],[1.4,1.5],[1.6,1.5],[1.7,2],[1.9,2],[181.9,182],[-1.4,-1.5]];
for (const [input, expected] of roundingCases) {
  const actual = vm.runInContext('roundGameplayValue(' + input + ')', statusContext);
  if (actual !== expected) throw new Error('roundGameplayValue(' + input + '): expected ' + expected + ', got ' + actual);
}
for (const fragment of ['>182<i', '+12</i>', '107%', '+7', '108%', '+8', 'Unidades extras</span><b>1', '5%', '8%', '3%', '1,5%', 'Disponível']) {
  if (!statusContext.statusHtml.includes(fragment)) throw new Error('Missing passive status display: ' + fragment);
}
const compactGameSource = gameSource.replace(/\s+/g, '');
for (const signature of ["d = Math.max(0, roundGameplayValue(d));", "d = Math.max(1, roundGameplayValue(d - (G.mods.dr || 0) - (G.mods.evoDR || 0)),)", "amount = Math.max(0, roundGameplayValue(n))"]) {
  if (!compactGameSource.includes(signature.replace(/\s+/g, ''))) throw new Error('Gameplay result is not using global rounding: ' + signature);
}
const combatContext = {
  G: { p: { moving: false }, mods: { moveDmg: 0, exec: 0, rage: 0, crit: 0 }, rageT: 0, nextBonus: false },
  TUT: { on: false },
  BTL: { src: 'test', damage(amount) { this.lastDamage = amount; }, playerDamage(amount) { this.lastPlayerDamage = amount; } },
  rng: () => 1,
  dmgNum() {},
  kill() {},
  SFX: { play() {} },
  FXQ: () => false,
  vib() {},
  srcName: () => 'test'
};
vm.createContext(combatContext);
vm.runInContext(roundGameplayValueSource + '\n' + hurtSource, combatContext);
const enemy = { dead: false, hp: 100, mhp: 100, boss: false, elite: false, kx: 0, ky: 0 };
combatContext.enemy = enemy;
vm.runInContext('hurt(enemy, 1.3, 0, 0, 0);', combatContext);
if (enemy.hp !== 99 || combatContext.BTL.lastDamage !== 1) throw new Error('Enemy damage 1.3 must round to 1 in gameplay.');
vm.runInContext('hurt(enemy, 1.4, 0, 0, 0);', combatContext);
if (enemy.hp !== 97.5 || combatContext.BTL.lastDamage !== 1.5) throw new Error('Enemy damage 1.4 must round to 1.5 in gameplay.');

combatContext.G.p = { hp: 10, inv: 0, sh: 0 };
combatContext.G.mods = { dr: 0, evoDR: 0, block: 0, invT: .8, thorns: 0 };
combatContext.G.fx = [];
combatContext.G.dmgTaken = 0;
vm.runInContext(hurtPlayerSource, combatContext);
vm.runInContext('hurtPlayer(1.4, null);', combatContext);
if (combatContext.G.p.hp !== 8.5 || combatContext.BTL.lastPlayerDamage !== 1.5) throw new Error('Player damage 1.4 must round to 1.5 in gameplay.');
const errors = C.validate();
if (errors.length) throw new Error('Registry validation failed: ' + errors.join('; '));
console.log('PASSIVE FORMULA TESTS PASSED');
console.log(JSON.stringify({ formulaTests: results.length, statusStats: 'passed', gameplayRounding: roundingCases.length, combatDamage: 'passed', mantoRuntime: 'passed', integrationChecks, registryErrors: errors.length, results }, null, 2));
