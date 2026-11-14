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
const weapon = content.weapons.plasma_ring;
const tree = content.evolutionTrees.weapon.plasma_ring;
assert.strictEqual(content.validate().length, 0);
assert(weapon, 'Plasma Ring should be registered as a weapon.');
assert.strictEqual(weapon.behavior, 'plasma_ring');
assert.strictEqual(weapon.up.length, 5, 'The weapon should have five base upgrade tiers.');
assert.deepStrictEqual(
  Object.keys(tree.paths).sort(),
  ['conductive', 'overcharged', 'static'],
);
for (const pathEntry of Object.values(tree.paths))
  assert(pathEntry.node.name && pathEntry.node.desc, 'Each evolution path needs a mastery node.');

const html = fs.readFileSync(path.join(root, 'tools', 'content-studio.html'), 'utf8');
const embedded = html.match(
  /<script type="application\/json" id="default-data">([\s\S]*?)<\/script>/,
);
assert(embedded, 'Content Studio default catalog is missing.');
const studioCatalog = JSON.parse(embedded[1]);
assert(studioCatalog.weapons.plasma_ring, 'Content Studio should retain the weapon.');
assert(studioCatalog.evolutionTrees.weapon.plasma_ring);
assert(studioCatalog.weaponBehaviorContracts.plasma_ring);

const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
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

const statContext = { WEAPONS: content.weapons };
vm.createContext(statContext);
vm.runInContext(
  extractFunction('applyContentStatOperations') + '\n' + extractFunction('statsFor'),
  statContext,
);
const maxLevelStats = vm.runInContext('statsFor("plasma_ring", 6)', statContext);
assert.strictEqual(maxLevelStats.dmg, 10.5);
assert.strictEqual(maxLevelStats.maxr, 175);
assert.strictEqual(maxLevelStats.speed, 415);
assert.strictEqual(maxLevelStats.returnPct, 0.55);
assert(Math.abs(maxLevelStats.cd - 4.08) < 1e-10);

const waveContext = { clamp: (value, min, max) => Math.max(min, Math.min(max, value)) };
vm.createContext(waveContext);
vm.runInContext(
  extractFunction('plasmaRingWaveState') + '\n' + extractFunction('plasmaRingDamage'),
  waveContext,
);
waveContext.effect = {
  maxr: 100,
  dmg: 10,
  returnPct: 0.4,
  expandTime: 2,
  returnTime: 1,
};
const waveState = (time) =>
  vm.runInContext('plasmaRingWaveState(effect, ' + time + ')', waveContext);
assert.strictEqual(waveState(0).radius, 4);
assert.strictEqual(waveState(1).radius, 52);
assert.strictEqual(waveState(2).radius, 100);
assert.strictEqual(waveState(2.5).phase, 'return');
assert.strictEqual(waveState(2.5).radius, 52);
assert.strictEqual(waveState(3).radius, 4);
assert.strictEqual(
  vm.runInContext('plasmaRingDamage(effect, "out", 1)', waveContext),
  10,
);
assert.strictEqual(
  vm.runInContext('plasmaRingDamage(effect, "return", 0.5)', waveContext),
  4,
);
assert(
  vm.runInContext('plasmaRingDamage(effect, "out", 1)', waveContext) >
    vm.runInContext('plasmaRingDamage(effect, "return", 0.5)', waveContext),
  'Return damage must be lower than maximum outward damage.',
);

assert(game.includes('case "plasma_ring"'), 'The weapon needs a main-loop handler.');
assert(game.includes('f.k === "plasmaRing"'), 'The ring effect needs main-loop collision handling.');
assert(game.includes('FXR.plasmaRing ='), 'The ring effect needs a renderer.');
assert(game.includes('e.shockT = Math.max'), 'The overcharged path should apply a timed shock.');
assert(game.includes('chainLimit: tier ? 5 : 3'), 'Conductive effects should be bounded per wave.');
assert(game.includes('class="slot-cooldown"'), 'Weapon HUD slots should show cooldown indicators.');
assert(game.includes('slot.dataset.weaponId'), 'Weapon cooldowns should update by weapon ID.');
assert(game.includes('gameIconURL(id, group)'), 'The HUD should render weapon and passive icons.');
assert(game.includes('if (w.lvl < MAXW) add("w", id, 1.25)'), 'Weapon choice upgrades must respect the max level.');

console.log('Plasma Ring content, mastery, wave scaling, and HUD checks passed.');
