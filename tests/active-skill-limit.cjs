'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const game = fs.readFileSync(path.resolve(__dirname, '..', 'game.js'), 'utf8');
const helperStart = game.indexOf('const MAXA = 5,');
const helperEnd = game.indexOf('\n  const ACTIVE_BEHAVIOR_HANDLERS', helperStart);
assert(helperStart >= 0 && helperEnd > helperStart, 'Active skill limit helpers are missing.');
const run = { mode: 'std' };
const helpers = vm.runInNewContext(game.slice(helperStart, helperEnd) + '\n({ activeSkillLimit, canGainActive, activeSkillCountLabel })', { RUN: run });

assert.strictEqual(helpers.activeSkillLimit({}), 2, 'Amanhecer should allow at most two active skills.');
assert.strictEqual(helpers.canGainActive({ A: ['judgment', 'refuge'] }), false, 'Amanhecer should reject a third active skill.');
assert.strictEqual(helpers.canGainActive({ A: ['judgment'], al: { judgment: 1 } }), true, 'An existing active skill may still be upgraded.');
assert.strictEqual(helpers.activeSkillLimit({ inf: true }), Infinity, 'Vigília Eterna should not have a fixed active skill cap.');
assert.strictEqual(helpers.canGainActive({ inf: true, A: Array(12).fill('active') }), true, 'Vigília Eterna should continue offering new active skills.');
run.mode = 'inf';
assert.strictEqual(helpers.activeSkillLimit({}), Infinity, 'Vigília Eterna should stay unlimited based on its selected mode.');
run.mode = 'std';
run.daily = { active: true };
assert.strictEqual(helpers.activeSkillLimit({}), Infinity, 'The cap should be exclusive to standard Amanhecer runs, not daily challenges.');
run.daily = null;
assert.strictEqual(helpers.activeSkillCountLabel({ A: ['judgment'] }), 'Ativas 1/2');
assert.strictEqual(helpers.activeSkillCountLabel({ inf: true, A: ['judgment', 'refuge'] }), 'Ativas 2 (sem limite)');
const compactGame = game.replace(/\s+/g, '').replace(/["']/g, '"');
const hasCode = fragment => compactGame.includes(fragment.replace(/\s+/g, '').replace(/["']/g, '"'));
assert(hasCode('nA < activeSkillLimit(g)'), 'New active skill offers must respect the current mode limit.');
assert(hasCode("if (c.kind === 'a' && !(G.al && G.al[c.id]) && !canGainActive(G))"), 'Selecting a stale third active skill must be rejected.');

console.log('Active skill limit checks passed.');
