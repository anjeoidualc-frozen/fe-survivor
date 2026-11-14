'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const registryPath = path.join(root, 'content', 'registry.js');
const gamePath = path.join(root, 'game.js');
const htmlPath = path.join(root, 'index.html');
const cssPath = path.join(root, 'style.css');
const versesPath = path.join(root, 'home-verses.js');
const context = { window: {}, console: { warn() {}, error() {}, log() {} } };
vm.runInNewContext(fs.readFileSync(registryPath, 'utf8'), context, { filename: registryPath });
const C = context.window.FE_SURVIVOR_CONTENT;
const game = fs.readFileSync(gamePath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const verses = fs.readFileSync(versesPath, 'utf8');
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const normalizeCode = value => value.replace(/\s+/g, '').replace(/["']/g, '"');
const hasCode = (source, fragment) => normalizeCode(source).includes(normalizeCode(fragment));
const hasGameCode = fragment => hasCode(game, fragment);

assert(!hasGameCode('const PROVAS ='), 'The proof catalog must be removed.');
assert(!hasGameCode('function openProvas'), 'The proof-selection screen must be removed.');
assert(!hasGameCode('RUN.trial') && !hasGameCode('RUN.fast'), 'Proof and fasting run modifiers must be removed.');
assert(!hasGameCode('Prova ativa') && !hasGameCode('Jejum Total'), 'Proof and fasting gameplay/achievement labels must be removed.');
assert(hasGameCode('goRun();'), 'Standard and infinite modes must start without a proof-selection screen.');
assert(!hasGameCode('c.prova') && !hasGameCode('c.fast'), 'Daily challenges must not apply proof or fasting modifiers.');
assert(!/altarDefense|ALTAR_|altarDirector|altarStructure|altarTray|altarSkipBtn|altar_structure|essenceValue/.test(game), 'Altar Defense gameplay code remains.');
assert(hasGameCode('c.disabled = state === "soon"') && hasGameCode('"Em breve"') && hasGameCode('if (state !== "soon") c.onclick = pick'), 'The upcoming mode card must use Portuguese text and remain non-selectable.');
assert(!/altarDefenseHUD|altarTray|altarSkipBtn/.test(html + css), 'Altar Defense HUD or tray markup/styles remain.');
assert(!/FE_SURVIVOR_LOCALES|currentLang|translateSourceText|GameI18n|i18n\//.test(game + html + css), 'Localization runtime or catalog references remain.');
assert(!fs.existsSync(path.join(root, 'i18n')), 'The localization catalog directory must be removed.');
assert(!/en-US|es-419|refEn|refEs|FE_SURVIVOR_LOCALES/.test(verses), 'Verse data must contain only the Portuguese baseline.');
assert(!/langBtn|langModal|langGrid|langClose|lnkTranslationError/.test(game + html + css), 'Language selection UI remains.');
assert(!/\bt\s*\(\s*["']/.test(game), 'Translation lookups should be replaced with direct strings.');

assert(C && C.schemaVersion === 3, 'Registry schemaVersion must be 3.');
if (!C) throw new Error('Registry did not export FE_SURVIVOR_CONTENT.');
assert(C.validate().length === 0, 'Registry validate() returned errors: ' + C.validate().join('; '));
assert(!JSON.stringify(C).includes('essenceValue'), 'Altar-only Essence metadata remains in the content registry.');
assert(Object.keys(C.heroes).length === 11, 'Expected 11 heroes.');

// Stage 2 catalogs must be editable JSON data: no executable callbacks inside records.
const nestedFunctions = [];
function scanFunctions(value, pathName) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'function') nestedFunctions.push(pathName + '.' + key);
    else if (child && typeof child === 'object') scanFunctions(child, pathName + '.' + key);
  }
}
for (const key of ['heroes','heroProfiles','heroAttackRange','heroPowers','heroArt','weapons','passives','actives','demons','demonDefinitions','bossDefinitions','evolutionTrees']) scanFunctions(C[key], key);
assert(nestedFunctions.length === 0, 'Content records contain executable functions: ' + nestedFunctions.join(', '));
assert(JSON.parse(JSON.stringify({ heroes:C.heroes, heroProfiles:C.heroProfiles, weapons:C.weapons, passives:C.passives, actives:C.actives, demons:C.demons, bosses:C.bossDefinitions })), 'Catalog JSON serialization failed.');
assert(Object.keys(C.weapons).length === 16, 'Expected 16 weapons.');
assert(C.heroes.jonathan.start === 'covenant_bow', 'Jonathan must start with the Covenant Bow.');
assert(C.heroes.jonathan.hp === 8 && C.heroes.jonathan.spd === 65 && C.heroes.jonathan.dmg === 1.1, 'Jonathan base salvation, movement, or damage stats are incorrect.');
assert(C.heroes.jonathan.attackSpeed === 1.15 && C.heroes.jonathan.crit === .12 && C.heroes.jonathan.luck === .08, 'Jonathan attack speed, critical chance, or luck is incorrect.');
assert(C.heroAttackRange.jonathan === 130, 'Jonathan base attack range is incorrect.');
assert(C.heroShopPrices.jonathan === 8000 && C.heroShop.jonathan.coins === 8000, 'Jonathan unlock price must be 8,000 coins.');
assert(C.heroPowers.jonathan.behavior === 'covenant_archery', 'Jonathan heroic power is not registered.');
assert(C.evolutionTrees.weapon.covenant_bow, 'Covenant Bow evolution tree is missing.');
assert(Object.keys(C.evolutionTrees.weapon.covenant_bow.paths).join(',') === 'aim,pierce,volley', 'Covenant Bow must offer aim, piercing, and volley branches.');
assert(Object.values(C.evolutionTrees.weapon.covenant_bow.paths).every(path => path.name && path.desc && path.node && path.node.name && path.node.desc), 'Covenant Bow tree paths need branch and mastery descriptions.');
assert(hasGameCode("id === 'covenant_bow'") && hasGameCode("k: 'covenant_arrow'"), 'Covenant Bow firing behavior is missing.');
assert(hasGameCode('G.hm.arrowCount % 5 === 0') && hasGameCode('const pierce = signal ? Infinity'), 'The fifth Signal Arrow must pierce every enemy.');
assert(hasGameCode("s.k === 'covenant_arrow'") && hasGameCode('createSignalZone(e.x, e.y, s.evolved)'), 'Covenant Arrow projectile or boss-impact zone behavior is missing.');
assert(hasGameCode('life: evolved ? 5 : 3') && hasGameCode('crit: evolved ? 0.25 : 0.15') && hasGameCode('range: evolved ? 0.3 : 0.2'), 'Jonathan holy-zone duration or bonuses are incorrect.');
assert(hasGameCode('FXR.signalZone ='), 'Jonathan holy-zone visual effect is missing.');
assert(hasGameCode("covenant_bow: { dom: 'belt', n: 'Arco do Pacto Eterno'"), 'Covenant Bow Supreme Evolution is missing.');
assert(hasGameCode('G.evo.covenant_bow') && hasGameCode('life: evolved ? 5 : 3'), 'The evolved Covenant Bow does not enhance the Signal Arrow zone.');
assert(C.heroArt.jonathan.walk.length === 10 && C.heroArt.jonathan.attack.length === 7, 'Jonathan must have 10 walk and 7 attack frames.');
assert(hasGameCode('attack: A.attack ? A.attack.map(b) : null') && hasGameCode('H.walk[Math.floor(p.walk * 13) % H.walk.length]'), 'Jonathan sprite sequences are not integrated into gameplay.');
const spriteRows = [...C.heroArt.jonathan.walk, ...C.heroArt.jonathan.attack, ...C.heroArt.jonathan.idle];
assert(spriteRows.every(frame => frame.length === 30 && frame.every(row => row.length === 24)), 'Jonathan sprite frame dimensions must be 24x30 pixels.');
const sheet = fs.readFileSync(path.join(root, 'assets', 'sprites', 'jonathan_spritesheet.png'));
assert(sheet.readUInt32BE(16) === 720 && sheet.readUInt32BE(20) === 180, 'Jonathan reference spritesheet must be 720x180 pixels.');
assert(sheet[24] === 4 && sheet[25] === 3, 'Jonathan spritesheet must be 4-bit indexed PNG.');
let chunkOffset = 8, paletteEntries = 0;
while (chunkOffset < sheet.length) {
  const size = sheet.readUInt32BE(chunkOffset), type = sheet.toString('ascii', chunkOffset + 4, chunkOffset + 8);
  if (type === 'PLTE') paletteEntries = size / 3;
  chunkOffset += size + 12;
}
assert(paletteEntries === 16, 'Jonathan spritesheet must contain exactly 16 palette colors.');
assert(Object.keys(C.passives).length === 21, 'Expected 21 passive gifts after the passive expansion.');
assert(Object.keys(C.actives).length === 4, 'Expected 4 active skills.');
assert(Object.keys(C.demons).length === 13, 'Expected 13 demons.');
assert(C.bossDefinitions.length === 5, 'Expected 5 boss definitions.');
const newPassiveIds = ['armadura','coracao','incenso','uncao','paes','alegria','provisao','provacao','manto','coroa'];
for (const id of newPassiveIds) {
  const p = C.passives[id];
  assert(!!p, 'Missing new passive ' + id + '.');
  assert(Number.isInteger(p.maxLevel) && p.maxLevel >= 1 && p.maxLevel <= 5, 'Invalid maxLevel for ' + id + '.');
  assert(Number.isFinite(p.pickWeight) && p.pickWeight > 0 && p.pickWeight <= 1.5, 'Invalid pickWeight for ' + id + '.');
}
assert(C.passives.paes.maxLevel === 2, 'Pães da Multiplicação must cap at 2 levels.');
assert(C.passives.manto.maxLevel === 1, 'Manto da Ressurreição must be a one-pick revive.');
assert(C.passives.manto.pickWeight < (C.passives.belt.pickWeight ?? 1), 'Revival must be rarer than regular passive gifts.');


// Every weapon data contract must point to an actual engine dispatch branch.
for (const [behavior, contract] of Object.entries(C.weaponBehaviorContracts)) {
  if (contract.dispatch === 'core') {
    assert(hasGameCode("case '" + behavior + "':"), 'Missing core weapon handler: ' + behavior);
  } else if (contract.dispatch === 'extended') {
    const start = game.indexOf('const extendedWeaponHandlers = {');
    const end = start < 0 ? -1 : game.indexOf('};', start);
    const block = start >= 0 && end >= 0 ? game.slice(start, end + 2) : '';
    assert(hasCode(block, behavior + ':'), 'Missing extended weapon handler: ' + behavior);
  } else assert(false, 'Unknown weapon dispatch type for ' + behavior);
}

// Passive/active definitions are tied to implemented behavior handlers.
const recalcStart = game.indexOf('function recalc()');
const recalcEnd = game.indexOf('\n  /* ================= inimigos', recalcStart);
const recalc = recalcStart >= 0 && recalcEnd > recalcStart ? game.slice(recalcStart, recalcEnd) : '';
for (const behavior of Object.keys(C.passiveBehaviorContracts)) {
  assert(hasCode(recalc, "case '" + behavior + "':"), 'Missing passive recalculation handler: ' + behavior);
}
for (const behavior of ['flat_armor','max_salvation_percent','weapon_area','effect_duration','weapon_amount','luck','greed','curse','revival','omni_curse']) {
  assert(hasCode(recalc, "case '" + behavior + "':"), 'Missing new passive handler: ' + behavior);
}
assert(/const passiveMaxLevel\s*=\s*\(?id\)?\s*=>/.test(game), 'Per-passive maximum level helper is missing.');
assert(/const passivePickWeight\s*=\s*\(?id\)?\s*=>/.test(game), 'Per-passive offer weight helper is missing.');
assert(hasGameCode("if (p.hp <= 0 && G.P && G.P.manto > 0 && !G.reviveUsed)"), 'The one-time revival trigger is missing.');
assert(hasGameCode('m.dr = Math.min(1.75, (m.dr || 0) + armorBonus)'), 'Flat armor is not applied to the damage-reduction stat.');
assert(hasGameCode('Math.min(8, s.count + amountBonus(m))'), 'Duplicator-like amount is not wired to projectile_target weapons.');
assert(hasGameCode('(1 + (G.mods.curse || 0))'), 'Curse is not wired to regular enemy health.');

const activeStart = game.indexOf('const ACTIVE_BEHAVIOR_HANDLERS = {');
const activeEnd = game.indexOf('\n  };', activeStart);
const activeBlock = activeStart >= 0 && activeEnd > activeStart ? game.slice(activeStart, activeEnd) : '';
for (const behavior of Object.keys(C.activeBehaviorContracts)) {
  assert(new RegExp('(?:^|\\n)\\s*' + behavior + '\\s*\\(').test(activeBlock), 'Missing active behavior handler: ' + behavior);
}

// Heroic powers and demon AI behavior identifiers must still be represented in the engine.
for (const behavior of C.heroPowerBehaviors) {
  // Gideon's effect is applied by the registered weaponModifiers metadata, not by nxHero().
  if (behavior === 'three_hundred_lights') {
    assert(hasGameCode('weaponModifiers[id]'), 'Gideon weapon modifier handler missing.');
  } else assert(hasGameCode("=== '" + behavior + "'"), 'Missing Heroic Power handler reference: ' + behavior);
}
for (const movement of C.demonMovementBehaviors) {
  if (movement === 'chase') assert(hasGameCode('let vx = (dx / d) * sp'), 'Missing default chase movement.');
  else if (movement === 'kite') assert(hasGameCode("case 'cast':") && hasGameCode('if (d < 90)'), 'Missing ranged kite behavior.');
  else assert(hasGameCode("e.mv === '" + movement + "'"), 'Missing demon movement handler reference: ' + movement);
}
for (const ability of C.demonAbilityBehaviors) {
  if (ability === 'fuse') assert(hasGameCode("e.ab === 'fuse'"), 'Missing fuse behavior.');
  else if (ability === 'dash' || ability === 'dive') assert(hasGameCode("case 'dash': case 'dive':"), 'Missing lunge behavior: ' + ability);
  else assert(hasGameCode("case '" + ability + "':"), 'Missing demon ability handler: ' + ability);
}

assert(hasGameCode('FE_CONTENT.demonDefinitions'), 'Game is not consuming the central demon definitions.');
assert(hasGameCode('FE_CONTENT.bossDefinitions'), 'Game is not consuming canonical boss definitions.');
assert(hasGameCode('FE_CONTENT.heroShopPrices'), 'Game is not consuming central hero shop prices.');
assert(hasGameCode('rangedAttack: T.rangedAttack || null'), 'Spawned demons do not receive registered ranged attack configuration.');
assert(hasGameCode('FE_CONTENT.heroArt'), 'Game is not consuming central hero art.');
assert(hasGameCode('FE_CONTENT.validate()'), 'Game does not validate the registry before starting.');

if (errors.length) {
  console.error('STAGE 2 VALIDATION FAILED');
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}
console.log('STAGE 2 VALIDATION PASSED');
console.log(JSON.stringify({
  schemaVersion: C.schemaVersion,
  heroes: Object.keys(C.heroes).length,
  weapons: Object.keys(C.weapons).length,
  passives: Object.keys(C.passives).length,
  actives: Object.keys(C.actives).length,
  demons: Object.keys(C.demons).length,
  bosses: C.bossDefinitions.length,
  weaponBehaviors: Object.keys(C.weaponBehaviorContracts).length,
  passiveBehaviors: Object.keys(C.passiveBehaviorContracts).length,
  activeBehaviors: Object.keys(C.activeBehaviorContracts).length,
  warnings: C.validate()
}, null, 2));
