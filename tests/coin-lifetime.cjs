'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const game = fs.readFileSync(path.resolve(__dirname, '..', 'game.js'), 'utf8');
const helperStart = game.indexOf('const COIN_LIFETIME = 8,');
const helperEnd = game.indexOf('\n\n  /* ================= progresso', helperStart);
assert(helperStart >= 0 && helperEnd > helperStart, 'Coin lifetime helpers are missing.');
const helpers = vm.runInNewContext(game.slice(helperStart, helperEnd) + '\n({ COIN_LIFETIME, tickCoinLifetime, coinOpacity })');

assert.strictEqual(helpers.COIN_LIFETIME, 8);
const coin = { type: 'coin', life: helpers.COIN_LIFETIME, dead: false };
assert.strictEqual(helpers.tickCoinLifetime(coin, 5.4), false);
assert(Math.abs(coin.life - 2.6) < 1e-9, 'Coin lifetime should decrement by dt.');
assert.strictEqual(helpers.coinOpacity(coin, 0), 1, 'Coins should not blink before the final 2.5 seconds.');
assert.strictEqual(helpers.tickCoinLifetime(coin, 0.2), false);
assert.strictEqual(helpers.coinOpacity(coin, 0), 0.25, 'Coins should blink during their final 2.5 seconds.');
assert.strictEqual(helpers.coinOpacity({ type: 'f1', life: 0 }, 0), 1, 'Other pickups should not blink as coins.');
assert.strictEqual(helpers.tickCoinLifetime(coin, 2.4), true);
assert.strictEqual(coin.dead, true, 'An expired coin must be marked dead.');
const compactGame = game.replace(/\s+/g, '').replace(/["']/g, '"');
const hasCode = fragment => compactGame.includes(fragment.replace(/\s+/g, '').replace(/["']/g, '"'));
assert(hasCode('if (tickCoinLifetime(k, dt)) { BTL.pickupExpired(k, "coin_lifetime"); continue; }'), 'Expired coins must be recorded and skip collection.');
assert(hasCode('coinOpacity(k, g.t)'), 'The coin opacity effect must be used while drawing pickups.');

console.log('Coin lifetime and blink checks passed.');
