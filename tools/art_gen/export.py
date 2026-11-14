import sys, json, math
sys.path.insert(0, '/home/claude/art')
from rig import rle
from specs import SPECS
from poses import *
from heroes import render, idle_poses, walk_poses
import vec, enemies, boss_dragon as BD, bosses_rest as BR
S_ = math.sin

def enc_rows(rows): return '/'.join(rle(r) for r in rows)

# ---------- HERÓIS ----------
def hero_frames(name):
    sp = SPECS[name]
    def rows(p, fl=0):
        p = dict(p); p['fl'] = fl
        return render(sp, p).crop_sym(16, 22, [16, 20, 24, 28, 32], [22, 24, 26, 28, 30])
    idle = [enc_rows(rows(p, i)) for i, p in enumerate(idle_poses())]
    walk = [enc_rows(rows(dict(p, walkish=True, dpa=(4 if i % 4 in (0, 1) else -4) * (1 if i < 4 else -1)), i)) for i, p in enumerate(walk_poses())]
    act = [enc_rows(rows(p, i)) for i, p in enumerate(act_poses(name))]
    hurt = [enc_rows(rows(hurt_pose()))]
    dash = [enc_rows(rows(p, i)) for i, p in enumerate(dash_poses())]
    return dict(pal=sp['pal'], idle=idle, walk=walk, act=act, hurt=hurt, dash=dash)

# ---------- INIMIGOS ----------
def enemy_frames(name):
    sq = enemies.SEQ[name]
    groups = {}
    allarr = []
    for g in ('loop', 'windup', 'attack'):
        if g in sq:
            groups[g] = [f() for f in sq[g]]; allarr += groups[g]
    pal, rows = vec.to_rows(allarr)
    out = dict(pal=pal); i = 0
    for g in ('loop', 'windup', 'attack'):
        if g in groups:
            n = len(groups[g]); out[g] = [enc_rows(r) for r in rows[i:i + n]]; i += n
    return out

# ---------- CHEFES ----------
def T(i, n=8): return i / n * 2 * math.pi
BOSS = {}
BOSS['dragao'] = dict(
  loop=[lambda i=i: BD.draw(phi=S_(T(i)), sway=S_(T(i) + 1), breathe=S_(T(i)), tail=T(i), mouth=.2 + .1 * S_(2 * T(i))) for i in range(8)],
  windup=[lambda: BD.draw(phi=.9, mouth=.5, glow=.4, lunge=-.4, lift=-1), lambda: BD.draw(phi=1, mouth=.9, glow=1, lunge=-.8, lift=-1)],
  attack=[lambda: BD.draw(phi=-1, mouth=1, glow=1, lunge=1, lift=1), lambda: BD.draw(phi=-.4, mouth=1, glow=1, lunge=1.3), lambda: BD.draw(phi=0, mouth=.6, glow=.5, lunge=.5)],
  dash=[lambda: BD.draw(fold=.85, phi=-1, lunge=.8, mouth=.5, tail=1), lambda: BD.draw(fold=1, phi=-1, lunge=1, mouth=.6, tail=2)])
BOSS['legiao'] = dict(
  loop=[lambda i=i: BR.legiao(ph=T(i), mouth=.25 + .2 * S_(2 * T(i)), grow=1 + .03 * S_(T(i))) for i in range(8)],
  windup=[lambda: BR.legiao(ph=1, grow=.92, mouth=.7, flare=.5), lambda: BR.legiao(ph=2, grow=.88, mouth=1, flare=1)],
  attack=[lambda: BR.legiao(ph=3, grow=1.12, flare=.8, mouth=1), lambda: BR.legiao(ph=4, grow=1.2, flare=1, mouth=.8), lambda: BR.legiao(ph=5, grow=1.06, flare=.4, mouth=.4)],
  dash=[lambda: BR.legiao(ph=1, stretch=1.2, flare=.3, mouth=.6), lambda: BR.legiao(ph=2.5, stretch=1.24, flare=.4, mouth=.8)])
FL = [1, .1, -.9, -.1, 1, .1, -.9, -.1]
BOSS['belzebu'] = dict(
  loop=[lambda i=i: BR.belzebu(flap=FL[i], bob=[0, .5, 1, .5, 0, .5, 1, .5][i], leg=i / 8, mouth=.2 * (i % 2)) for i in range(8)],
  windup=[lambda: BR.belzebu(flap=1, rear=.7, mouth=.5, bob=0), lambda: BR.belzebu(flap=1, rear=1, mouth=1, bob=-.4)],
  attack=[lambda: BR.belzebu(flap=-1, mouth=1, bob=1), lambda: BR.belzebu(flap=.5, mouth=.6, bob=.4), lambda: BR.belzebu(flap=-1, mouth=.3, bob=.8)],
  dash=[lambda: BR.belzebu(flap=-.6, mouth=1, bob=.5), lambda: BR.belzebu(flap=-1, mouth=1, bob=.8, leg=.5)])
BOSS['abadom'] = dict(
  loop=[lambda i=i: BR.abadom(flap=S_(T(i)), bob=.6 + .6 * S_(T(i) + 1), tail=T(i), hairs=T(i)) for i in range(8)],
  windup=[lambda: BR.abadom(flap=1, arm=.5, glow=.6, lean=-1), lambda: BR.abadom(flap=1, arm=1, glow=1, lean=-1, tail=1)],
  attack=[lambda: BR.abadom(flap=-1, arm=1, glow=1, lean=1, tail=2), lambda: BR.abadom(flap=-.3, arm=.4, glow=1, lean=2, tail=3), lambda: BR.abadom(flap=0, arm=0, glow=.5, tail=4)],
  dash=[lambda: BR.abadom(flap=-.8, lean=2, arm=.6, tail=1), lambda: BR.abadom(flap=-.4, lean=2, arm=.8, tail=2)])
BOSS['leviata'] = dict(
  loop=[lambda i=i: BR.leviata(ph=T(i), jaw=.2 + .1 * S_(2 * T(i)), smoke=i / 8) for i in range(8)],
  windup=[lambda: BR.leviata(ph=1, rise=2, jaw=.4, thrust=-.4), lambda: BR.leviata(ph=1.6, rise=3, jaw=.5, thrust=-.8)],
  attack=[lambda: BR.leviata(ph=2, thrust=1, jaw=1, rise=-1), lambda: BR.leviata(ph=2.4, thrust=1.3, jaw=1, rise=-2), lambda: BR.leviata(ph=3, thrust=.4, jaw=.5)],
  dash=[lambda: BR.leviata(ph=2, thrust=1, jaw=.8), lambda: BR.leviata(ph=3.2, thrust=1, jaw=.9)])

def boss_frames(name):
    sq = BOSS[name]; groups = {}; allarr = []
    for g in ('loop', 'windup', 'attack', 'dash'):
        groups[g] = [f() for f in sq[g]]; allarr += groups[g]
    pal, rows = vec.to_rows(allarr)
    out = dict(pal=pal); i = 0
    for g in ('loop', 'windup', 'attack', 'dash'):
        n = len(groups[g]); out[g] = [enc_rows(r) for r in rows[i:i + n]]; i += n
    return out

if __name__ == '__main__':
    A = dict(v=2, hero={}, enemy={}, boss={})
    for k in SPECS: A['hero'][k] = hero_frames(k); print('hero', k)
    for k in enemies.SEQ: A['enemy'][k] = enemy_frames(k); print('enemy', k)
    for k in BOSS: A['boss'][k] = boss_frames(k); print('boss', k)
    js = '/* art_v2.js — sprites animados (gerado). Quadros em RLE: linhas separadas por "/"; "3R" = RRR. */\nwindow.ART_V2 = ' + json.dumps(A, separators=(',', ':')) + ';\n'
    open('/home/claude/art/art_v2.js', 'w').write(js)
    print(len(js) // 1024, 'KB')
