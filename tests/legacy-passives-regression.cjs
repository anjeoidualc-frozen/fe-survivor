'use strict';
const fs=require('fs'), vm=require('vm'), path=require('path');
const root=path.resolve(__dirname,'..');
const base=path.resolve(root,'..','base','fe-survivor-content-stage2-release');
if (!fs.existsSync(path.join(base, 'content', 'registry.js')) || !fs.existsSync(path.join(base, 'game.js'))) {
  console.log('SKIPPED legacy passive comparison: reference baseline is not present.');
  process.exit(0);
}
function getRegistry(file){const c={};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(file,'utf8'),c);return c.FE_SURVIVOR_CONTENT;}
function getFunction(source, signature){const s=source.indexOf(signature);if(s<0)throw Error('missing '+signature);const open=source.indexOf('{',s);let depth=0,quote=null,esc=false,line=false,block=false;for(let i=open;i<source.length;i++){const ch=source[i],nx=source[i+1];if(line){if(ch==='\n')line=false;continue;}if(block){if(ch==='*'&&nx==='/'){block=false;i++;}continue;}if(quote){if(esc){esc=false;continue;}if(ch==='\\'){esc=true;continue;}if(ch===quote)quote=null;continue;}if(ch==='/'&&nx==='/'){line=true;i++;continue;}if(ch==='/'&&nx==='*'){block=true;i++;continue;}if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(s,i+1);}throw Error('unclosed '+signature);}
function runRecalc(fn, C, heroId, levels){const G={hero:C.heroes[heroId],hk:heroId,mods:{},P:levels,passiveTrees:{}};const ctx={G,PASSIVES:C.passives,MAXP:5,HRNG:C.heroAttackRange||{[heroId]:90},effP:()=>G.P,passiveMaxLevel:id=>Math.max(1,Math.min(5,Math.floor(Number(C.passives[id]?.maxLevel)||5))),shopMods:m=>{m.dr=m.dr||0;}};vm.createContext(ctx);vm.runInContext(fn+'\nrecalc();',ctx);return G.mods;}
const oldC=getRegistry(path.join(base,'content/registry.js'));
const newC=getRegistry(path.join(root,'content/registry.js'));
const oldFn=getFunction(fs.readFileSync(path.join(base,'game.js'),'utf8'),'function recalc()');
const newFn=getFunction(fs.readFileSync(path.join(root,'game.js'),'utf8'),'function recalc()');
const oldIds=Object.keys(oldC.passives);
const commonKeys=['maxhp','dmg','cd','pspd','spd','pickup','xp','block','rng','regen','dr','moveDmg','evoDR','thorns','regenShield','crit'];
const tested=[];
for(const id of oldIds){
  for(const level of [1,3,5]){
    const levels={[id]:level};
    const a=runRecalc(oldFn,oldC,'davi',levels),b=runRecalc(newFn,newC,'davi',levels);
    for(const key of commonKeys){const av=Number(a[key]||0),bv=Number(b[key]||0);if(Math.abs(av-bv)>1e-9)throw Error(`${id}@${level}.${key} changed: ${av} -> ${bv}`);}
    tested.push(`${id}@${level}`);
  }
}
for(const levels of [
 {belt:5,fasting:5,wisdom:5},
 {helmet:5,hope:5,breast:5},
 {boots:5,eagle:5,watch:5},
 {fervor:5,fasting:5,belt:5},
 {grace:5,wisdom:5,hope:5}
]){
 const a=runRecalc(oldFn,oldC,'davi',levels),b=runRecalc(newFn,newC,'davi',levels);
 for(const key of commonKeys){const av=Number(a[key]||0),bv=Number(b[key]||0);if(Math.abs(av-bv)>1e-9)throw Error(`combo ${JSON.stringify(levels)}.${key} changed: ${av} -> ${bv}`);}
 tested.push('combo:'+Object.keys(levels).join('+'));
}
console.log('LEGACY PASSIVE REGRESSION PASSED');
console.log(JSON.stringify({legacyPassiveIds:oldIds.length,scenarios:tested.length,valuesCompared:tested.length*commonKeys.length,scenariosTested:tested},null,2));
