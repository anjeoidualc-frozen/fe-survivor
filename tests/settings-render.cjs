'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const game = fs.readFileSync(path.resolve(__dirname, '..', 'game.js'), 'utf8');
const start = game.indexOf('function renderSet(b) {');
const end = game.indexOf('\n  $("#playBtn").insertAdjacentHTML(', start);
assert(start >= 0 && end > start, 'Settings renderer is missing.');
const renderSettings = game.slice(start, end);

assert(
  !/\.appendChild\(\s*["'`]/.test(renderSettings),
  'Settings must append DOM nodes, not text strings.',
);
for (const [label, key] of [
  ['Pausa automática', 'auto'],
  ['Fonte sem serifa', 'sysfont'],
  ['Efeitos visuais', 'fx'],
  ['Mostrar FPS', 'showfps'],
])
  assert(
    renderSettings.includes(label) && renderSettings.includes(`"${key}"`),
    `Settings should render ${label} as a toggle row.`,
  );

console.log('Settings renderer DOM node checks passed.');
