'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const game = fs.readFileSync(path.resolve(__dirname, '..', 'game.js'), 'utf8');
assert(!/choiceToolText|translateSourceText|currentLang|GameI18n/.test(game), 'The language-selection and translation helpers must be removed.');
assert(game.includes('"Em breve"'), 'The upcoming-mode label should be a direct Portuguese string.');
const helpStart = game.indexOf('const HLP_KEYS =');
const helpEnd = game.indexOf('const HLP_OBJ =', helpStart);
assert(helpStart >= 0 && helpEnd > helpStart, 'Help text definitions are missing.');
const helpText = game.slice(helpStart, helpEnd);
assert(!/\bT\s*\(|\bt\s*\(/.test(helpText), 'Help text should contain direct baseline strings, not localization calls.');

const musicStateStart = game.indexOf('const MUSA = {};');
const musicApply = game.indexOf('function musApply()');
const musicDuck = game.indexOf('function nxaDuck(');
assert(musicStateStart >= 0 && musicStateStart < musicApply, 'Music multiplier state must be initialized before musApply can run.');
assert(game.indexOf('const nxMusMul =', musicStateStart) < musicApply, 'Music multiplier must be defined before musApply.');
assert(game.indexOf('function nxMusIn(', musicStateStart) < musicApply, 'Music fade-in must not be in the temporal dead zone when musApply starts.');
assert(game.indexOf('function nxMusOut(', musicStateStart) < musicApply, 'Music fade-out must not be in the temporal dead zone when musApply starts.');
assert(musicDuck > musicApply && game.includes('nxMusicDuck = NXA.dk;', musicDuck), 'Music ducking must update the safely initialized multiplier.');

console.log('Startup reference regressions passed.');
