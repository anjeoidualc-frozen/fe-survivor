'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'game.js'), 'utf8');

function extractBlock(text, signature) {
  const start = text.indexOf(signature);
  const open = text.indexOf('{', start);
  assert(start >= 0 && open > start, 'Missing block: ' + signature);
  let depth = 0, quote = null, escaped = false, line = false, block = false;
  for (let i = open; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (line) { if (ch === '\n') line = false; continue; }
    if (block) { if (ch === '*' && next === '/') { block = false; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') { line = true; i++; continue; }
    if (ch === '/' && next === '*') { block = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error('Unclosed block: ' + signature);
}

const run = {
  hero: { name: 'Davi', hp: 10, spd: 65, dmg: 1, attackSpeed: 1, xp: 1, pickup: 1, start: 'sling' },
  hk: 'davi',
  t: 0,
  lvl: 1,
  xp: 0,
  need: 10,
  kills: 0,
  coins: 0,
  p: { x: 0, y: 0, hp: 10 },
  mods: { maxhp: 10, dmg: 1, cd: 1, pspd: 1, spd: 65, rng: 90, pickup: 26, xp: 1, block: 0, dr: 0, regen: 0, area: 1, duration: 1, amount: 0, luck: 0, greed: 0, curse: 0, curseSpd: 0, customNumber: 7, customFlag: true, customText: 'captured' },
  W: { sling: { lvl: 1, s: { dmg: 10, cd: 1, count: 1 } } },
  P: {},
  al: {},
  A: [],
  enemies: [{ dead: false, t: 'imp' }, { dead: false, t: 'bat' }],
  boss: null,
  inf: false,
  choiceTools: { max: { banish: 2, skip: 2 }, banishUsed: 0, skipUsed: 0, adBonus: false, banished: [] },
  slingTree: null,
  weaponTrees: {},
  passiveTrees: {},
  activeTrees: {},
  reviveUsed: false,
  resumeT: 0,
  over: false,
  pk: []
};
const selectedWorld = { key: 'world1', n: 'Deserto de Sur', hp: 1, spd: 1.12, spawn: 1.1, coin: 1.25 };
const storeValue = { schemaVersion: 2, runs: [], active: null };
const context = {
  BALANCE_SCHEMA_VERSION: 2,
  BALANCE_TELEMETRY_VERSION: 4,
  BALANCE_MAX_RUNS: 100,
  BALANCE_MAX_EVENTS: 300,
  BALANCE_MAX_CHOICES: 300,
  BALANCE_MAX_SNAPSHOTS: 120,
  BALANCE_MAX_MINUTE_BUCKETS: 600,
  BALANCE_STORE_KEY: 'fe-survivor-balance-runs-v1',
  balanceReadStore: () => ({ ...storeValue, runs: [] }),
  localStorage: { getItem() { return null; }, setItem(key, value) { this.value = value; } },
  TUT: { on: false },
  save: { rt: {}, coins: 0, runs: 0, choiceToolUpgrades: {} },
  RUN: { spawn: 1, coin: 1, mode: 'std', world: selectedWorld, daily: null },
  WORLDS: [{ key: null, n: 'Vale de Elá' }, selectedWorld],
  APP_VER: '0.67',
  _balanceDebugSeed: null,
  window: { FE_SURVIVOR_CONTENT: { schemaVersion: 3, heroes: { davi: {} }, weapons: { sling: {} }, passives: { blessing: {} }, actives: { judgment: {} }, demons: { imp: {} }, bossDefinitions: [] } },
  HRNG: { davi: 90 },
  BOSSES: [],
  WEAPONS: { sling: { name: 'Funda de Davi' } },
  PASSIVES: { blessing: { name: 'Bênção' } },
  ACT: { judgment: { n: 'Juízo' } },
  RAR: [{ n: 'Comum' }, { n: 'Rara' }],
  EVOLUTION_TREES: { weapon: {}, passive: {}, active: {} },
  SLING_TREE: {},
  NX_EVO: {},
  state: 'play',
  G: run,
  coinMul: () => 1,
  console: { warn() {}, info() {} },
  Date,
  Math,
  JSON,
};
vm.createContext(context);
const objectStart = source.indexOf('const BTL = {');
const objectEnd = source.indexOf('\n  };\n  BTL.recoverInterrupted();', objectStart);
assert(objectStart >= 0 && objectEnd > objectStart, 'Balance Lab object is missing.');
const objectSource = source.slice(source.indexOf('{', objectStart), objectEnd + 5);
vm.runInContext('globalThis.BTL = ' + objectSource, context);
const BTL = context.BTL;

BTL.start(run);
let record = BTL.current;
assert.strictEqual(record.telemetryVersion, 4);
assert.strictEqual(record.attempt, 1);
assert.strictEqual(record.config.world, 'world1');
assert.strictEqual(record.config.rng.seed, null);
assert.strictEqual(record.snapshots.length, 1);
assert.strictEqual(record.snapshots[0].effectiveStats.attackRange, 90);
assert.deepStrictEqual(JSON.parse(JSON.stringify(record.snapshots[0].effectiveModifiers)), {
  maxhp: 10, dmg: 1, cd: 1, pspd: 1, spd: 65, rng: 90, pickup: 26, xp: 1,
  block: 0, dr: 0, regen: 0, area: 1, duration: 1, amount: 0, luck: 0, greed: 0,
  curse: 0, curseSpd: 0, customNumber: 7, customFlag: true, customText: 'captured'
});

const firstChoices = [{ kind: 'p', id: 'blessing', r: 1 }, { kind: 'w', id: 'sling', r: 0 }];
BTL.openChoiceSession({ kind: 'lvl', n: 2 }, firstChoices);
const firstSession = record.choices[0];
run.choiceTools.banishUsed = 1;
BTL.banishOption(firstChoices[0], [firstChoices[1]]);
assert.strictEqual(firstSession.originalOptions.length, 2);
assert.strictEqual(firstSession.removedOptions[0].option.id, 'blessing');
assert.strictEqual(firstSession.removedOptions[0].remainingOptions.length, 1);
assert.strictEqual(firstSession.selected, null, 'Banished options must not be recorded as selected.');

BTL.rerollChoice('test');
BTL.openChoiceSession({ kind: 'lvl', n: 2 }, [{ kind: 'p', id: 'blessing', r: 1 }]);
assert.strictEqual(record.choices[1].rerolledFromSessionId, firstSession.sessionId);
BTL.choice({ kind: 'p', id: 'blessing', r: 1 }, [{ kind: 'p', id: 'blessing', r: 1 }]);
assert.strictEqual(record.choices[1].selected.id, 'blessing');

BTL.openChoiceSession({ kind: 'lvl', n: 3 }, [{ kind: 'a', id: 'judgment' }]);
run.choiceTools.skipUsed = 1;
BTL.skipChoice(20);
assert.strictEqual(record.choices[2].status, 'skipped');
assert.strictEqual(record.choices[2].skipReward, 20);
assert.strictEqual(record.choiceTools.banish.used, 1);
assert.strictEqual(record.choiceTools.skip.used, 1);

run.t = 60;
BTL.tick(60);
run.t = 61;
BTL.tick(1);
const coin = { type: 'coin' }, bread = { type: 'bread' }, expired = { type: 'f1' };
BTL.pickupGenerated('coin', coin, false);
BTL.collect(coin);
BTL.pickupGenerated('bread', bread, false);
BTL.pickupExpired(bread, 'unmagnetized_out_of_range_timeout');
BTL.pickupGenerated('f1', null, true);
BTL.pickupGenerated('f1', expired, false);
BTL.pickupExpired(expired, 'test_expiry');
assert.strictEqual(record.metrics.drops.generated, 4);
assert.strictEqual(record.metrics.drops.placed, 3);
assert.strictEqual(record.metrics.drops.collected, 1);
assert.strictEqual(record.metrics.drops.expired, 2);
assert.strictEqual(record.metrics.drops.convertedToXp, 1);
assert.strictEqual(record.metrics.drops.expiredByReason.test_expiry, 1);
assert.strictEqual(record.metrics.drops.expiredByReason.unmagnetized_out_of_range_timeout, 1);
assert.strictEqual(record.metrics.coinsCollected, 1);
assert(record.events.some(event => event.type === 'pickup_expired' && event.reason === 'test_expiry'));
assert.strictEqual(record.minuteBuckets[0].activeSeconds, 60);
assert.strictEqual(record.minuteBuckets[0].averageEnemiesAlive, 2);
assert.strictEqual(record.minuteBuckets[1].activeSeconds, 1);
assert.strictEqual(record.metrics.averageEnemiesAlive, 2);
assert.strictEqual(record.minuteBuckets[1].drops.generated, 4);

for (let i = 0; i < 125; i++) BTL.snapshot(run, false);
assert.strictEqual(record.snapshots.length, 120);
assert(record.truncation.discarded.snapshots > 0);
BTL.minuteBucket(600 * 60);
assert(record.truncation.discarded.minuteBuckets > 0);
for (let i = 0; i < 350; i++) BTL.event('bounded_event', { index: i });
assert.strictEqual(record.events.length, 300);
assert(record.truncation.discarded.events > 0);
for (let i = 0; i < 305; i++) BTL.openChoiceSession({ kind: 'lvl', n: i + 4 }, []);
assert.strictEqual(record.choices.length, 300);
assert(record.truncation.discarded.choices > 0);

BTL.finish(false, false);
assert.strictEqual(BTL.data.runs.length, 1);
assert.strictEqual(BTL.current, null);
const finished = BTL.data.runs[0];
assert.strictEqual(finished.result.averageEnemiesAlive, 2);
assert.strictEqual(finished.metrics.averageEnemiesAlive, 2);
const exported = BTL.allData();
assert.strictEqual(exported.schemaVersion, 2);
assert.strictEqual(exported.storage.localOnly, true);
assert(JSON.stringify(exported).includes('effectiveModifiers'));
assert(BTL.toCSV().includes('truncationAny'));
assert(BTL.toCSV().includes('dropsByType'));
const csvRows = BTL.toCSV().split('\r\n');
const csvColumnCount = row => {
  let count = 1, quoted = false;
  for (let i = 0; i < row.length; i++) {
    if (row[i] === '"' && quoted && row[i + 1] === '"') { i++; continue; }
    if (row[i] === '"') quoted = !quoted;
    else if (row[i] === ',' && !quoted) count++;
  }
  return count;
};
assert.strictEqual(csvColumnCount(csvRows[0]), csvColumnCount(csvRows[1]));

BTL.data.runs = Array.from({ length: 101 }, (_, index) => ({
  id: 'history-' + index,
  status: 'completed',
  truncation: { any: false, discarded: { events: 0, choices: 0, snapshots: 0, minuteBuckets: 0 }, storageFailures: 0 }
}));
BTL.persist();
assert.strictEqual(BTL.data.runs.length, 100);
assert.strictEqual(BTL.data.historyDiscardedRuns, 1);
context.localStorage.setItem = () => { throw new Error('quota exceeded'); };
assert.strictEqual(BTL.persist(), false);
assert.strictEqual(BTL.data.runs.length, 1);
assert.strictEqual(BTL.storageFull, true);
assert.strictEqual(BTL.data.runs[0].truncation.storageFailures, 1);
assert.strictEqual(BTL.allData().storage.persistenceFailed, true);

const oldRun = { id: 'old-run', status: 'completed', choices: [{ selected: { id: 'legacy' } }] };
const oldStore = { schemaVersion: 1, runs: [oldRun], active: { id: 'active-old', status: 'in_progress' } };
const migrationContext = {
  BALANCE_SCHEMA_VERSION: 2,
  BALANCE_STORE_KEY: 'fe-survivor-balance-runs-v1',
  localStorage: { getItem() { return JSON.stringify(oldStore); } },
  console: { warn() {}, info() {} },
};
vm.createContext(migrationContext);
const ensureRun = extractBlock(source, 'function balanceEnsureRun(');
const readStore = extractBlock(source, 'function balanceReadStore(');
vm.runInContext(ensureRun + '\n' + readStore + '\nglobalThis.migrated = balanceReadStore();', migrationContext);
assert.strictEqual(migrationContext.migrated.schemaVersion, 2);
assert.strictEqual(migrationContext.migrated.runs[0].choices[0].selected.id, 'legacy');
assert.strictEqual(migrationContext.migrated.active.id, 'active-old');
assert.strictEqual(migrationContext.migrated.active.status, 'in_progress');

console.log('Balance telemetry controlled checks passed.');
