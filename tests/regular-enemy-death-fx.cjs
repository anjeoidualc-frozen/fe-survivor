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

const sprite = { w: 12, h: 14, c: {}, f: {} };
const run = { fx: [], t: 4 };
const creationContext = {
  G: run, save: { set: { fx: true } }, eSpr: () => sprite,
  rndFx: (min, max) => min + (max - min) * .5, rngFx: () => .2, Math
};
vm.runInNewContext(extractFunction(game, 'function enemyDeathFx(e)'), creationContext);
creationContext.enemyDeathFx({ x: 10, y: 20, sc: 1, face: -1, mv: 'walk', spr: 'imp', ph: 0 });
assert.strictEqual(run.fx.length, 1, 'Regular demon death should enqueue one effect.');
assert.strictEqual(run.fx[0].life, .4, 'The death effect should remain visible long enough to read in gameplay.');
assert.strictEqual(run.fx[0].sprite, sprite, 'The effect should preserve the demon sprite after removal.');
assert.strictEqual(run.fx[0].flip, true, 'The effect should preserve the demon facing direction.');
assert.strictEqual(run.fx[0].smoke.length, 8, 'The effect should use a small bounded set of smoke pixels.');
assert.strictEqual(run.fx[0].smoke.every(p => p.col === '#541b42' || p.col === '#35172f'), true, 'Smoke should use dark red/purple colors.');

creationContext.enemyDeathFx({ boss: true, x: 0, y: 0 });
assert.strictEqual(run.fx.length, 1, 'Boss deaths must not use the regular demon effect.');
run.fx = Array.from({ length: 48 }, () => ({ k: 'enemyDeath' }));
creationContext.enemyDeathFx({ x: 0, y: 0 });
assert.strictEqual(run.fx.length, 48, 'Concurrent death effects must be capped.');
creationContext.save.set.fx = false;
run.fx = [];
creationContext.enemyDeathFx({ x: 0, y: 0 });
assert.strictEqual(run.fx.length, 0, 'The effect should respect the graphics setting.');

const draws = [], pixels = [];
const drawContext = {
  FXR: {}, Math, sx: x => x, sy: y => y,
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  spr(...args) { draws.push(args); },
  ctx: { globalAlpha: 1, set fillStyle(value) {}, fillRect(...args) { pixels.push(args); } }
};
const handlerStart = game.indexOf('  FXR.enemyDeath =');
const handlerEnd = game.indexOf('\n  FXR.slash =', handlerStart);
assert(handlerStart >= 0 && handlerEnd > handlerStart, 'Death effect renderer is missing.');
vm.runInNewContext(game.slice(handlerStart, handlerEnd), drawContext);
const effect = { sprite, x: 0, y: 0, sc: 1, flip: false, syy: 1, t: 0, life: .4, smoke: [{ x: 0, y: 0, vx: 0, vy: -10, delay: .025, life: .25, size: 2, col: '#541b42' }] };
drawContext.FXR.enemyDeath(effect, 0);
effect.t = .02;
drawContext.FXR.enemyDeath(effect, .05);
assert.strictEqual(draws[0][4], true, 'The initial frame should flash the sprite white.');
assert.strictEqual(draws[1][4], true, 'The second frame should remain white.');
effect.t = .08;
drawContext.FXR.enemyDeath(effect, .2);
assert.strictEqual(draws[2][4], false, 'Dissolution frames should restore the colored sprite.');
assert.strictEqual(pixels.length, 1, 'Dark smoke pixels should appear during the dissolve phase.');
assert(draws[2][7] > 0 && draws[2][7] < 1, 'The demon sprite should visibly fade instead of disappearing at once.');
const compactGame = game.replace(/\s+/g, '').replace(/["']/g, '"');
assert(compactGame.includes('if(e.boss)burst(e.x,e.y,40,e.col,120);elseenemyDeathFx(e);'), 'Bosses should retain their existing death burst.');

console.log('Regular demon death FX checks passed.');
