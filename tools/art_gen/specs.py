import math
from rig import *
from heroes import *

def pole(g, hand, ang, back, front, chars, side=None):
    a = math.radians(ang); dx, dy = math.cos(a), math.sin(a)
    for i in range(-back, front + 1):
        x = round(hand[0] + dx * i); y = round(hand[1] + dy * i)
        ch = chars[(i + back) % len(chars)] if isinstance(chars, str) and len(chars) > 1 else chars
        g.put(x, y, ch)
    return (round(hand[0] + dx * front), round(hand[1] + dy * front))

# ----------------- ARMAS -----------------
def davi_prop(g, hand, pose):
    if 'sling' in pose:
        ang, ln, stone = pose['sling']
        a = math.radians(ang)
        tip = (hand[0] + math.cos(a) * ln, hand[1] + math.sin(a) * ln)
        g.line(hand[0], hand[1], tip[0], tip[1], 'r')
        if stone:
            tx, ty = round(tip[0]), round(tip[1])
            g.put(tx, ty, 'j'); g.put(tx + 1, ty, 'j'); g.put(tx, ty + 1, 'k'); g.put(tx + 1, ty + 1, 'k')
        return
    top = pole(g, hand, pose.get('pa', -88), 6, 13, 'wwW')
    tx, ty = top
    g.put(tx - 1, ty - 0, 'W'); g.put(tx - 2, ty + 1, 'w'); g.put(tx - 1, ty - 1, 'W')

def sword_prop(g, hand, pose):
    ang = pose.get('pa', -80); a = math.radians(ang); dx, dy = math.cos(a), math.sin(a)
    px, py = -dy, dx
    L = pose.get('bl', 9)
    for i in range(2, L + 1):
        x = round(hand[0] + dx * i); y = round(hand[1] + dy * i)
        g.put(x, y, 'W' if i % 3 else 'j')
    gx, gy = round(hand[0] + dx * 1.5), round(hand[1] + dy * 1.5)
    for k in (-1, 0, 1): g.put(round(gx + px * k), round(gy + py * k), 'g')
    g.put(round(hand[0] - dx), round(hand[1] - dy), 'G')

def palm_prop(g, hand, pose):
    top = pole(g, hand, pose.get('pa', -88), 6, 14, 'wwW')
    g.stamp(['v.V.v', '.vVv.', '..V..'], top[0] - 2, top[1] - 2)
    if pose.get('glow'): g.put(top[0] - 3, top[1] - 1, 'g'); g.put(top[0] + 3, top[1] - 1, 'g'); g.put(top[0], top[1] - 3, 'g')

def jaw_prop(g, hand, pose):
    ang = pose.get('pa', -68); a = math.radians(ang); dx, dy = math.cos(a), math.sin(a)
    px, py = -dy, dx
    for i in range(-2, 11):
        x = round(hand[0] + dx * i); y = round(hand[1] + dy * i)
        g.put(x, y, 'o')
        if i >= 4: g.put(round(x - px), round(y - py), 'o')
        if i >= 5 and i % 2 == 1: g.put(round(x + px), round(y + py), 'O')
        if i >= 8: g.put(round(x - px * 2), round(y - py * 2), 'O')
    ex, ey = round(hand[0] + dx * 11), round(hand[1] + dy * 11)
    g.put(ex, ey, 'O'); g.put(round(ex - px), round(ey - py), 'o')

def scepter_prop(g, hand, pose):
    top = pole(g, hand, pose.get('pa', -88), 3, 11, 'gGg')
    g.put(top[0], top[1] - 1, 'P'); g.put(top[0] + 1, top[1] - 1, 'p'); g.put(top[0], top[1] - 2, 'p'); g.put(top[0] - 1, top[1], 'g'); g.put(top[0] + 1, top[1], 'g')
    if pose.get('glow'):
        for (ox, oy) in ((-2, -2), (3, -2), (0, -4), (-1, -3)): g.put(top[0] + ox, top[1] + oy, 'P')

FLAME = [['..y.', '.yoy', '.oRo', '..R.'], ['.y..', '.yoy', 'oyoR', '.oR.'], ['..y.', '.yy.', 'yoRy', '.oR.']]
def torch_prop(g, hand, pose):
    top = pole(g, hand, pose.get('pa', -80), 4, 9, 'wwW')
    g.stamp(FLAME[pose.get('fl', 0) % 3], top[0] - 1, top[1] - 4)
    if pose.get('big'): g.stamp(['y.y', '.o.'], top[0] - 1, top[1] - 6)

def cane_prop(g, hand, pose):
    top = pole(g, hand, pose.get('pa', -84), 5, 8, 'wwW')
    g.put(top[0] - 1, top[1], 'W'); g.put(top[0] - 2, top[1] + 1, 'w')

# ----------------- CAMADAS TRASEIRAS -----------------
def long_back(cols, length=13, wide=3):
    H_, h_, J_ = cols
    def f(g, dy, sway, pose):
        for r in range(length):
            y = 5 + dy + r
            s = round(sway * r / 5.0) - (1 if pose.get('walkish') and r > 5 else 0)
            x0 = 4 - (1 if r > 2 else 0) - (1 if r > 7 else 0) + s
            w = wide if r < 9 else wide - 1
            for k in range(w):
                ch = H_ if (k + r) % 3 else h_
                if k == 0 and r % 4 == 1: ch = J_
                g.put(x0 + k, y, ch)
    return f

def sack_back(g, dy, sway, pose):
    g.stamp(['.QQQ.', 'QQQQq', 'QQQQq', 'QQQqq', '.qqq.'], 0, 9 + dy)
    g.put(3, 10 + dy, 'B'); g.put(3, 11 + dy, 'B')

def hood_back(g, dy, sway, pose):
    for r in range(12):
        y = 8 + dy + r
        s = round(sway * r / 6.0)
        g.stamp(['HhhH'], 2 + s - (1 if r > 6 else 0), y)

# ----------------- ESPECIFICAÇÕES -----------------
SK = dict(L='#ffe0b8', s='#f2c394', S='#d49a68', e='#2a1a0c', m='#c0705a', Y='#ffffff')
SPECS = {}

SPECS['davi'] = dict(pa0=-88,
  pal=dict(SK, J='#d9792f', h='#b5561f', H='#7d3814', U='#f2dc9c', t='#dcb86e', T='#b48a46', b='#7a4a1d', B='#4a2c10', g='#f2c14e',
           p='#8a5a2a', q='#5f3c18', f='#6b4423', F='#3a2410', w='#8a5a2a', W='#c28a4a', r='#e8dcc0', j='#aab0c0', k='#5b6070', G='#9a9a9a'),
  sleeve='t', sleeveS='T', sleeveL='U', skin='s', skinS='S',
  hair='curly', beard=None,
  torso=['.UUtttT.', 'UtttttTT', 'UtttttTT', 'UtttttTT', 'BbbgbbbB', 'UtttpptT', 'UtttpqTT', 'UTtTtTTT'],
  legs=dict(kind='legs', leg='s', legs='S', boot='f', bootD='F'),
  prop=davi_prop)

SPECS['paulo'] = dict(pa0=-80,
  pal=dict(L='#ffdcb0', s='#e8b98a', S='#c08c60', e='#1a1a1a', m='#8a3a2a', J='#5a463c', h='#3b2f2a', H='#2a1f1a',
           U='#fff6e0', t='#e9dcc0', T='#bfae8a', c='#9a4fd0', C='#6a2f9a', b='#c8a860', B='#6a5030', g='#f2c14e', G='#a8741f',
           f='#5a4630', F='#2f2418', W='#f4fbff', j='#b8c4d4'),
  sleeve='t', sleeveS='T', skin='s', skinS='S',
  sleeveL='U', hair='bald', beard='dark',
  torso=['.UUtttT.', 'UccttttT', 'UtccttTT', 'UtttcctT', 'BbbbbccB', 'UtttttcC', 'UtttttTT', 'UtttttTT'],
  legs=dict(kind='robe', boot='f', bootD='F'),
  skirt=['.UtttttTT.', 'UUttttttTT', 'UtTtttTttT'],
  prop=sword_prop)

SPECS['debora'] = dict(pa0=-88,
  pal=dict(L='#ffe0c0', s='#e9b58b', S='#c08a62', e='#2a1a0c', m='#b5503c', J='#ffffff', h='#f2f2fa', H='#b4b8d0',
           U='#46c4b0', t='#2f9e8f', T='#1f6e63', g='#f2c14e', G='#b8862a', b='#e0b040', B='#8a6a1c', f='#6b4a2a', F='#3a2814',
           w='#8a5a2a', W='#c28a4a', v='#58b84a', V='#2e7d32'),
  sleeve='t', sleeveS='T', skin='s', skinS='S',
  sleeveL='U', hair='white', beard=None,
  torso=['.UUtttT.', 'UttggtTT', 'UtggggTT', 'UttggtTT', 'BbbbbbbB', 'UtttttTT', 'UtttttTT', 'UtttttTT'],
  legs=dict(kind='robe', boot='f', bootD='F'),
  skirt=['.UtttttTT.', 'UUttttttTT', 'GgGgGgGgGg'],
  back=long_back(('H', 'h', 'J'), length=11, wide=3),
  prop=palm_prop)

SPECS['sansao'] = dict(pa0=-68,
  pal=dict(L='#f0be8c', s='#d89a64', S='#a86a3c', e='#1a0c06', m='#6a2a1a', J='#6e4428', h='#4a2c18', H='#2a160c',
           c='#e0d2a8', C='#a89870', b='#6b4423', B='#3a2410', f='#6b4423', F='#3a2410', g='#d8b050', o='#f2ead2', O='#bfb18a', G='#3a2410'),
  sleeve='s', sleeveS='S', skin='s', skinS='S',
  sleeveL='L', hair='long', beard='stub',
  torso=['.LLssSS.', 'LLLsSsSS', 'LsssSssS', 'sssSSssS', 'sLssSLsS', 'BbbbbbbB', 'cccCccCc', 'cCcccCcc'],
  legs=dict(kind='legs', leg='s', legs='S', boot='f', bootD='F'),
  back=long_back(('H', 'h', 'J'), length=13, wide=4),
  prop=jaw_prop)

SPECS['ester'] = dict(pa0=-88,
  pal=dict(L='#ffe6cc', s='#f0c4a0', S='#c8946c', e='#2a1a2a', m='#c04a5a', J='#6e4468', h='#4a2a48', H='#2e1a2e',
           g='#f2c14e', R='#e0304a', G='#b8862a', U='#b36af0', t='#8a3ad0', T='#5a2490', b='#f2c14e', B='#b8862a',
           f='#e0b040', F='#8a6a1c', P='#e08bff', p='#a040e0', W='#ffffff'),
  sleeve='t', sleeveS='T', skin='s', skinS='S',
  sleeveL='U', hair='crown', beard=None,
  torso=['.UUWWtT.', 'UtWggWTT', 'UttWWttT', 'UtttttTT', 'BbbggbbB', 'UtttttTT', 'UtttttTT', 'UtttttTT'],
  legs=dict(kind='robe', boot='f', bootD='F'),
  skirt=['.UtttttTT.', 'UUttttttTT', 'gGgGgGgGgG'],
  back=long_back(('H', 'h', 'J'), length=12, wide=3),
  prop=scepter_prop)

SPECS['elias'] = dict(pa0=-80,
  pal=dict(L='#e8b890', s='#d0986c', S='#a87048', e='#1a0c06', m='#7a3a2a', J='#e8e8f0', G='#b8b8c4', h='#8a5a2a', H='#5e3a18',
           U='#b07a3c', t='#8a5a2a', T='#5e3a18', b='#4a2c10', B='#2a180c', f='#4a2f1a', F='#2a180c',
           w='#7a4a1d', W='#a8742c', y='#ffe27a', o='#ff9a2a', R='#e63b1a'),
  sleeve='t', sleeveS='T', skin='s', skinS='S',
  sleeveL='U', hair='hood', beard='gray',
  torso=['.UUtttT.', 'UtUttUTT', 'UttTtttT', 'UtUttTTT', 'BbbbbbbB', 'UtttTttT', 'UTtttUTT', 'UtttttTT'],
  legs=dict(kind='robe', boot='f', bootD='F'),
  skirt=['.UtTtUtTT.', 'UUttTttUTT', 'UTtUtTtTUT'],
  back=hood_back,
  prop=torch_prop)

SPECS['mendigo'] = dict(pa0=-84,
  pal=dict(L='#e8c0a0', s='#d4a07c', S='#a87858', e='#1a1410', m='#8a4a3a', J='#e8e8e8', h='#c4c4c4', H='#8a8a90', G='#9a9a9a',
           U='#c8c8cc', t='#9a9a9e', T='#6e6e74', P='#a0804a', Q='#8a6a42', q='#5a4228', b='#c8a860', B='#6a5030',
           f='#7a6a5a', F='#4a3e32', w='#7a4a1d', W='#a8742c', c='#9a9a9e'),
  sleeve='t', sleeveS='T', skin='s', skinS='S',
  sleeveL='U', hair='ragged', beard='stub',
  torso=['.UUtttT.', 'UtttPPTT', 'UtttPPTT', 'UtttttTT', 'BbbbbbbB', 'UtPPttTT', 'UtPQttTT', 'UTtTtTtT'],
  legs=dict(kind='legs', leg='t', legs='T', boot='f', bootD='F'),
  back=sack_back,
  prop=cane_prop)

for k, s in SPECS.items():
    assert all(len(r) == 8 for r in s['torso']), (k, [len(r) for r in s['torso']])
    if 'skirt' in s: assert all(len(r) == 10 for r in s['skirt']), k

for _k,_s in SPECS.items(): _s['pal'].setdefault('Y','#ffffff')

# ===================== HERÓIS EXTRAS (v0.49) =====================
import copy
def crook_prop(g, hand, pose):
    top = pole(g, hand, pose.get('pa', -84), 5, 11, 'wwW')
    g.put(top[0] - 1, top[1], 'W'); g.put(top[0] - 2, top[1] + 1, 'w'); g.put(top[0] - 1, top[1] - 1, 'W')
def net_prop(g, hand, pose):
    top = pole(g, hand, pose.get('pa', -84), 5, 11, 'wwW')
    g.stamp(['.nn.', 'n..n', 'n..n', '.nn.'], top[0] - 2, top[1] - 3)
    g.put(top[0] - 1, top[1] - 2, 'N'); g.put(top[0] + 1, top[1] - 1, 'N')

def derive(base, pal=None, **over):
    s = copy.deepcopy(SPECS[base])
    if pal: s['pal'].update(pal)
    s.update(over); return s

SPECS['moises'] = derive('paulo',
  pal=dict(H='#cfd4e2', h='#f2f4fa', J='#ffffff', U='#eadcb4', t='#c9b68e', T='#a8946a', c='#2e6aa8', C='#1f4a7a',
           b='#6b4423', B='#4a2c10', w='#7a4a1d', W='#b8864a', L='#f0c8a0', s='#d8a070', S='#b07848', f='#6b4a2a', F='#3a2814'),
  hair='long', beard='dark', pa0=-86, prop=crook_prop,
  back=long_back(('H', 'h', 'J'), length=13, wide=3))
SPECS['gideao'] = derive('davi',
  pal=dict(J='#5a4230', h='#3b2a1c', H='#2a1c12', L='#f0b888', s='#d9a070', S='#b07a48',
           U='#d09a5a', t='#a9743a', T='#7a4f25', b='#c0392b', B='#7a2418', p='#c9b27a', q='#8a7040',
           w='#7a4a1d', W='#a8742c', y='#ffe27a', o='#ff9a2a', R='#e63b1a'),
  pa0=-80, prop=torch_prop)
SPECS['pedro'] = derive('davi',
  pal=dict(J='#d8d8e0', h='#8a8a98', H='#6a6a78', G='#a8a8b8', U='#7ab8dc', t='#3f7aa0', T='#2e5a78',
           b='#c9b27a', B='#7a6a40', p='#c9b27a', q='#8a7040', w='#6a4a24', W='#9a7038', n='#e8dcc0', N='#a89870',
           L='#f0c8a0', s='#d9a070', S='#b07848'),
  hair='ragged', beard='gray', pa0=-84, prop=net_prop)
for _k in ('moises', 'gideao', 'pedro'): SPECS[_k]['pal'].setdefault('Y', '#ffffff')
