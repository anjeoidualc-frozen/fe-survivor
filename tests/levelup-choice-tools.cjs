'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const game = fs.readFileSync(path.resolve(__dirname, '..', 'game.js'), 'utf8');
function extractFunction(source, signature) {
  const start = source.indexOf(signature), open = source.indexOf('{', start);
  assert(start >= 0 && open > start, 'Missing function: ' + signature);
  let depth = 0, quote = null, escaped = false;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('Unclosed function: ' + signature);
}
const helperStart = game.indexOf('const CHOICE_TOOL_BASE_USES = 2,');
const helperEnd = game.indexOf('\n  function renderChoiceToolUpgrades', helperStart);
assert(helperStart >= 0 && helperEnd > helperStart, 'Choice tool progression helpers are missing.');
const context = { save: { choiceToolUpgrades: { banish: 0, skip: 0 } }, RT_COST: { t3: 250 } };
const helpers = vm.runInNewContext(game.slice(helperStart, helperEnd) + '\n({ choiceToolMaxUses, createChoiceTools, choiceToolCost })', context);

for (const id of ['banish', 'skip']) {
  assert.strictEqual(helpers.choiceToolMaxUses(id, false), 2, id + ' should start with two free uses.');
  assert.strictEqual(helpers.choiceToolMaxUses(id, true), 3, id + ' should gain one use from the ad.');
  for (let rank = 1; rank <= 3; rank++) {
    context.save.choiceToolUpgrades[id] = rank;
    assert.strictEqual(helpers.choiceToolMaxUses(id, false), 2 + rank, id + ' upgrade should increase its per-run capacity.');
  }
  assert.strictEqual(helpers.choiceToolMaxUses(id, true), 6, id + ' should retain the ad bonus at maximum upgrade.');
  context.save.choiceToolUpgrades[id] = 0;
}

assert.strictEqual(helpers.choiceToolCost('banish'), 250, 'First upgrade should use the existing tier-three utility rune cost.');
context.save.choiceToolUpgrades.banish = 2;
assert.strictEqual(helpers.choiceToolCost('banish'), 750, 'Upgrade cost should increase with the upgrade level.');
const runTools = helpers.createChoiceTools();
context.save.choiceToolUpgrades.banish = 3;
assert.strictEqual(runTools.max.banish, 4, 'Run limits should snapshot the purchased upgrades when a run starts.');
assert.strictEqual(helpers.choiceToolMaxUses('banish', false), 5, 'A later upgrade should affect future runs.');
const compactGame = game.replace(/\s+/g, '').replace(/["']/g, '"');
const hasCode = fragment => compactGame.includes(fragment.replace(/\s+/g, '').replace(/["']/g, '"'));
assert(hasCode('"BANIR"') && hasCode('"PULAR"'), 'Utility upgrades should use direct Portuguese action labels.');
assert(hasCode('tools.banished.push(key); tools.banishUsed++;'), 'Banish must consume a run use and save the removed card for the current run.');
assert(hasCode('skipChoiceBtn.innerHTML = "PULAR"'), 'Level-up buttons should use direct Portuguese labels.');
assert(/skipChoiceBtn\.innerHTML\s*=\s*["']PULAR["']\s*\+/.test(game), 'Skip button should visibly advertise its 20-coin reward.');
assert(hasCode('G.coins += 20; G.choiceTools.skipUsed++;'), 'Skip should add 20 run coins and consume one use.');
assert(hasCode("notify('+20 moedas', 'ok')"), 'Skip should confirm its reward using the green success notification.');
assert(hasCode('chooseIdx(curChoices.indexOf(c))'), 'Remaining cards should keep selecting their current indexes after a banish.');
assert(hasCode("removed.classList.add('card-disintegrate')"), 'Banish should play the card disintegration animation.');
assert(hasCode("cards.classList.toggle('has-two', cards.children.length === 2)"), 'The two remaining cards should be centered after the banished card is removed.');
assert(hasCode('}, 1000);'), 'The banished card should remain during the full one-second animation.');
assert(hasCode('run.choiceTools.adBonus = true;'), 'Rewarded ad must grant a per-run bonus.');
assert(hasCode('const _chooseWithBanish = chooseIdx;'), 'Level-up cards must route through Banish selection mode.');
assert(hasCode('const _rollWithEvolutions = rollChoices;'), 'Banned blessings must be filtered from later offers.');

const filterStart = game.indexOf('  const _rollWithEvolutions = rollChoices;');
const filterEnd = game.indexOf('  const _nxOlu = openLevelUp;', filterStart);
assert(filterStart >= 0 && filterEnd > filterStart, 'Run-level banishment filter is missing.');
const rolls = [
  [{ kind: 'p', id: 'banned' }, { kind: 'p', id: 'one' }, { kind: 'p', id: 'two' }],
  [{ kind: 'w', id: 'three' }, { kind: 'w', id: 'four' }, { kind: 'w', id: 'five' }]
];
const filtering = { G: { choiceTools: { banished: ['p:banned'] } }, cardKey: c => c.kind + ':' + (c.id || ''), rollChoices: () => rolls.shift() || [] };
vm.runInNewContext(game.slice(filterStart, filterEnd), filtering);
const rerolled = filtering.rollChoices();
assert.strictEqual(rerolled.length, 3, 'Banish should keep three choices when replacements are available.');
assert(!rerolled.some(c => c.kind === 'p' && c.id === 'banned'), 'A banished blessing must not return during that run.');
assert.strictEqual(new Set(rerolled.map(c => c.kind + ':' + c.id)).size, 3, 'Replacement choices should not duplicate each other.');

const skippedRun = { choiceTools: { action: 'banish', skipUsed: 0 }, pending: [{}, {}], t: 10, coins: 7 };
let nextLevelOpened = 0, skippedState = 'levelup';
let rewardNotice = null;
let skipTelemetryReward = null;
const skipContext = {
  G: skippedRun, state: skippedState, last: 0,
  BTL: { skipChoice(reward) { skipTelemetryReward = reward; } },
  $: () => ({ hidden: false }), buildRack() {}, openLevelUp: () => { nextLevelOpened++; },
  performance: { now: () => 123 }, syncFpsHud() {}, refreshChoiceToolUI() {}, toast() {},
  notify(message, type) { rewardNotice = [message, type]; },
  SFX: { play() {} }
};
vm.runInNewContext(extractFunction(game, 'function completeSkippedLevel()'), skipContext);
skipContext.completeSkippedLevel();
assert.strictEqual(skippedRun.pending.length, 1, 'Skip should clear exactly the current pending level-up.');
assert.strictEqual(nextLevelOpened, 1, 'Skip should show the next queued level-up.');
assert.strictEqual(skippedRun.choiceTools.action, null, 'Skip should exit Banish targeting mode.');
assert.strictEqual(skippedRun.choiceTools.skipUsed, 1, 'Skip should consume exactly one use.');
assert.strictEqual(skipTelemetryReward, 20, 'Skip telemetry should record the granted reward.');
assert.strictEqual(skippedRun.coins, 27, 'Skip should grant 20 run coins.');
assert.deepStrictEqual(rewardNotice, ['+20 moedas', 'ok'], 'Skip should show the green +20 coin confirmation.');

const banishChoices = [{ kind: 'p', id: 'one' }, { kind: 'p', id: 'banned' }, { kind: 'p', id: 'three' }];
const makeClassList = () => {
  const classes = new Set();
  return { add(value) { classes.add(value); }, toggle(value, force) { if (force) classes.add(value); else classes.delete(value); }, contains(value) { return classes.has(value); } };
};
const makeCard = index => ({ label: { textContent: String(index + 1) }, classList: makeClassList(), parentNode: null, querySelector() { return this.label; }, remove() { banishCards.children.splice(banishCards.children.indexOf(this), 1); this.parentNode = null; } });
const banishCards = { children: [makeCard(0), makeCard(1), makeCard(2)], classList: makeClassList() };
banishCards.children.forEach(card => { card.parentNode = banishCards; });
let rerolls = 0, refreshed = 0;
let finishDisintegration;
let banishedTelemetry = null;
const banishRun = { choiceTools: { action: 'banish', banished: [], banishUsed: 0, max: { banish: 2 }, adBonus: false } };
const banishContext = {
  state: 'levelup', LV_LOCK: 0, G: banishRun, curChoices: banishChoices,
  BTL: { banishOption(option, remaining) { banishedTelemetry = { option, remaining }; } },
  performance: { now: () => 123 }, choiceToolUsesLeft: () => 2, cardKey: c => c.kind + ':' + c.id,
  $: selector => selector === '#cards' ? banishCards : null,
  refreshChoiceToolUI() { refreshed++; }, toast() {}, openLevelUp() { rerolls++; },
  setTimeout(callback) { finishDisintegration = callback; }
};
vm.runInNewContext(extractFunction(game, 'function banishChoice(i)'), banishContext);
banishContext.banishChoice(1);
assert.deepStrictEqual(Array.from(banishContext.curChoices, c => c.id), ['one', 'three'], 'Banish should keep the two unselected current choices.');
assert.strictEqual(banishCards.children.length, 3, 'The selected card should remain during its disintegration animation.');
assert(banishCards.children[1].classList.contains('card-disintegrate'), 'The selected card should receive the disintegration animation.');
finishDisintegration();
assert.strictEqual(banishCards.children.length, 2, 'Banish should remove only the selected card after its animation.');
assert(banishCards.classList.contains('has-two'), 'The two remaining cards should be centered.');
assert.deepStrictEqual(banishCards.children.map(card => card.label.textContent), ['1', '2'], 'Remaining card shortcuts should be renumbered.');
assert.deepStrictEqual(Array.from(banishRun.choiceTools.banished), ['p:banned'], 'Banish should still filter the card from future level-ups.');
assert.strictEqual(banishRun.choiceTools.banishUsed, 1, 'Banish should consume one use.');
assert.strictEqual(banishedTelemetry.option.id, 'banned', 'Banish telemetry should record the removed card.');
assert.deepStrictEqual(Array.from(banishedTelemetry.remaining, c => c.id), ['one', 'three']);
assert.strictEqual(rerolls, 0, 'Banish should not reroll the current level-up.');
assert.strictEqual(refreshed, 1, 'Banish should refresh its UI state after removing the card.');

console.log('Level-up Banish/Skip progression checks passed.');
