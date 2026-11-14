'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const registryContext = { window: {}, console: { warn() {} } };
vm.createContext(registryContext);
vm.runInContext(
  fs.readFileSync(path.join(root, 'content', 'registry.js'), 'utf8'),
  registryContext,
);
const content = registryContext.window.FE_SURVIVOR_CONTENT;
const rat = content.demons.plague_rat;
assert.strictEqual(content.validate().length, 0);
assert.strictEqual(Object.keys(content.demons).length, 13);
assert.strictEqual(rat.ab, 'poison_flask');
assert.strictEqual(rat.mv, 'kite');
assert.strictEqual(rat.rangedAttack.behavior, 'poison_flask');
assert.strictEqual(
  JSON.stringify(content.profileEnemyIds.find(([id]) => id === 'plague_rat')),
  JSON.stringify(['plague_rat', 'Rato da Praga']),
);

const html = fs.readFileSync(path.join(root, 'tools', 'content-studio.html'), 'utf8');
const embedded = html.match(
  /<script type="application\/json" id="default-data">([\s\S]*?)<\/script>/,
);
assert(embedded, 'Content Studio default catalog is missing.');
const studioCatalog = JSON.parse(embedded[1]);
assert(studioCatalog.demons.plague_rat, 'Content Studio should retain the new demon.');
assert(studioCatalog.demonBehaviorContracts.poison_flask);

const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
assert(game.includes('FE_CONTENT.profileEnemyIds.map'), 'Profile icons should consume the registry list.');
assert(game.includes('ECO.ICON_COST.demon'), 'Enemy profile icons should retain the generic coin price.');
assert(game.includes('FE_CONTENT.libraryTips[it.id]'), 'Enemy profile icons should show their combat tip.');
assert(game.includes('1 dano a cada 0,9 s por 3 s'), 'The Library should describe the poison duration and tick rate.');
function extractFunction(name) {
  const start = game.indexOf('function ' + name + '(');
  assert(start >= 0, 'Missing ' + name + ' implementation.');
  const open = game.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < game.length; i++) {
    if (game[i] === '{') depth++;
    else if (game[i] === '}' && --depth === 0)
      return game.slice(start, i + 1);
  }
  throw new Error('Unclosed function ' + name);
}

const artContext = {
  ET: { plague_rat: { palette: content.demonPalettes.plague_rat } },
  PLAGUE_RAT_ART: {},
  EFR: {},
  S: {},
  buildSprite: (rows, palette) => ({ rows, palette, w: 20, h: 18 }),
};
vm.createContext(artContext);
vm.runInContext(extractFunction('buildPlagueRatArt'), artContext);
artContext.buildPlagueRatArt();
for (const [pose, count] of Object.entries({
  idle: 4,
  run: 6,
  attack: 5,
  hurt: 2,
  death: 4,
}))
  assert.strictEqual(artContext.PLAGUE_RAT_ART[pose].length, count);
assert.strictEqual(artContext.EFR.plague_rat.length, 4);

const aiContext = {
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  rnd: (min, max) => min,
  SFX: { play() {} },
};
vm.createContext(aiContext);
vm.runInContext(extractFunction('enemyAI'), aiContext);
const ra = rat.rangedAttack;
const enemy = {
  ab: 'poison_flask',
  spd: 30,
  face: 1,
  x: 40,
  y: 0,
  ph: 0,
  ai: { st: 0, t: 0 },
  rangedAttack: ra,
};
const run = { t: 10, eshots: [] };
const player = { x: 0, y: 0 };
const retreat = aiContext.enemyAI(enemy, run, player, 0.016, -50, 0, 50, 30, -30, 0);
assert(retreat[0] * -50 < 0, 'The rat should retreat when the player is too close.');
const hold = aiContext.enemyAI(enemy, run, { x: 160, y: 0 }, 0, 120, 0, 120, 30, 30, 0);
assert.deepStrictEqual(Array.from(hold), [0, 0]);
assert.strictEqual(enemy.ai.st, 1, 'The rat should enter its throw animation at range.');
aiContext.enemyAI(enemy, run, { x: 160, y: 0 }, 0.6, 120, 0, 120, 30, 30, 0);
assert.strictEqual(run.eshots.length, 1, 'The completed attack should launch a flask.');
assert.strictEqual(run.eshots[0].k, 'poison_flask');
assert(run.eshots[0].arc > 0 && run.eshots[0].flight > 0);

const poisonContext = { G: null, hurtPlayer: () => { poisonContext.hits++; }, hits: 0 };
vm.createContext(poisonContext);
vm.runInContext(extractFunction('poisonHero'), poisonContext);
vm.runInContext(extractFunction('updatePoison'), poisonContext);
const poisonRun = { p: { x: 0, y: 0 }, poisonPools: [], poisonT: 0, poisonTick: 0 };
poisonContext.G = poisonRun;
poisonContext.poisonHero(3, 'rat');
for (let i = 0; i < 30; i++) poisonContext.updatePoison(poisonRun, 0.1);
assert.strictEqual(poisonContext.hits, 3, 'Three DoT ticks should occur during the exact 3-second effect.');
assert.strictEqual(poisonRun.poisonT, 0);

console.log('Plague Rat behavior, art, catalog, and poison checks passed.');
