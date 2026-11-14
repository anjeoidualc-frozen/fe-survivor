from rig import *
W, H = 16, 22

# ---------------- cabeça (procedural) ----------------
FACE = ['.######.', '########', '########', '########', '########', '########', '.######.', '..####..']
HAIR = {
 'curly': ['..hhJhh...', '.hhhhhhhh.', 'hhJhhhHhhh', 'hh......hh', '.h......h.', '..........', '..........', '..........', '..........'],
 'bald':  ['..........', '..........', '.H......H.', '.H......H.', '.H......H.', '..........', '..........', '..........', '..........'],
 'long':  ['..HHHHHH..', '.HHhJhhHH.', 'HHhhhhhhHH', 'HHh....hHH', 'HH......HH', 'HH......HH', 'HH......HH', 'H........H', '..........'],
 'crown': ['.g.gRg.g..', '.gggggggg.', '.HHhhhhHH.', 'HHh....hHH', 'HH......HH', 'HH......HH', 'HH......HH', 'H........H', '..........'],
 'white': ['...hhhh...', '..hJhhhh..', '.hhhhhhhh.', 'hhh....hhh', 'hh......hh', 'hh......hh', 'hh......hh', '.h......h.', '..........'],
 'hood':  ['..HHHHHH..', '.HhhhhhhH.', 'HhhhhhhhhH', 'Hhh....hhH', 'Hh......hH', 'Hh......hH', 'Hh......hH', '.H......H.', '..........'],
 'ragged':['.h.hhh.h..', '.hhJhhhh..', 'hhHhhhHhhh', 'hh......hh', '.h......h.', '..........', '..........', '..........', '..........'],
}
BEARD = {
 None: None,
 'dark': ['..........', '..........', '..........', '..........', '..........', '.H......H.', '.HHhhhhHH.', '.HHhmmhHH.', '..HHhhHH..'],
 'gray': ['..........', '..........', '..........', '..........', '..........', '.G......G.', '.GGJJJJGG.', '.GGJmmJGG.', '..GGJJGG..'],
 'stub': ['..........', '..........', '..........', '..........', '..........', '..........', '..G....G..', '..GGGGGG..', '...GGGG...'],
}

def paint_head(g, hx, hy, style, beard=None, eyes='open', mouth='closed', beard_over=True):
    fx, fy = hx + 1, hy + 1
    for r, row in enumerate(FACE):
        for c, ch in enumerate(row):
            if ch != '#': continue
            col = 's'
            if r in (1, 2) and c in (1, 2, 3): col = 'L'
            if r == 3 and c == 1: col = 'L'
            if c == 7 and 2 <= r <= 6: col = 'S'
            if r == 7: col = 'S'
            if r == 6 and c == 6: col = 'S'
            g.put(fx + c, fy + r, col)
    # olhos / nariz / boca
    if eyes in ('open', 'focus'):
        g.put(fx + 2, fy + 4, 'Y'); g.put(fx + 3, fy + 4, 'e'); g.put(fx + 5, fy + 4, 'Y'); g.put(fx + 6, fy + 4, 'e')
        if eyes == 'focus':
            for c in (2, 3, 5, 6): g.put(fx + c, fy + 3, 'S')
    elif eyes == 'blink':
        for c in (2, 3, 5, 6): g.put(fx + c, fy + 4, 'S')
    elif eyes == 'hurt':
        for c in (2, 3, 5, 6): g.put(fx + c, fy + 4, 'e')
    g.put(fx + 7, fy + 5, 'S')                       # nariz
    if mouth == 'closed': g.put(fx + 4, fy + 6, 'm'); g.put(fx + 5, fy + 6, 'm')
    elif mouth == 'open': g.put(fx + 3, fy + 6, 'm'); g.put(fx + 4, fy + 6, 'm'); g.put(fx + 5, fy + 6, 'm'); g.put(fx + 4, fy + 7, 'm')
    if style in HAIR: g.stamp(HAIR[style], hx, hy)
    if beard and BEARD[beard]: 
        if mouth == 'open' and beard in ('dark', 'gray'):
            b = BEARD[beard][:]; 
            g.stamp(b, hx, hy)
            g.put(fx + 4, fy + 6, 'm'); g.put(fx + 5, fy + 6, 'm'); g.put(fx + 4, fy + 7, 'm')
        else: g.stamp(BEARD[beard], hx, hy)

# ---------------- pernas ----------------
def draw_leg(g, hip, foot_dx, lift, kind, cols, toe=True):
    hx = hip
    fy = 21 - lift
    top = 16
    limb(g, (hx, top), (hx + foot_dx, fy - 1), [(0, cols['leg'])], [(0, cols['legs'])])
    fx = hx + foot_dx
    # bota/sandália: 3 px com ponta para frente
    g.put(fx, fy, cols['boot']); g.put(fx + 1, fy, cols['boot']);
    if toe: g.put(fx + 2, fy, cols['bootD'])

# ---------------- renderizador genérico ----------------
def render(spec, pose):
    g = Grid(32, 30, 8, 4)
    P = spec
    dy = pose.get('dy', 0)
    hdx = pose.get('hdx', 0); tdx = pose.get('tdx', 0)
    sway = pose.get('sway', 0)          # balanço de cabelo/barra (-1,0,1)
    # 1) camada traseira
    if P.get('back'): P['back'](g, dy, sway, pose)
    # 2) braço de trás
    ab = pose.get('armB', (3, 16))
    if P.get('behind'): P['behind'](g, dy, pose)
    limb(g, (3 + tdx, 11 + dy), (ab[0] + tdx, ab[1] + dy), [(0, P['sleeveS']), (0.55, P['skinS'])], [(0, P['sleeveS']), (0.55, P['skinS'])])
    # 3) pernas
    lg = P['legs']
    if lg['kind'] == 'legs':
        lb = pose.get('legB', (-1, 0)); lf = pose.get('legF', (1, 0))
        draw_leg(g, 5, lb[0], lb[1], 'legs', lg)
        draw_leg(g, 9, lf[0], lf[1], 'legs', lg)
    # 4) tronco
    g.stamp(P['torso'], 4 + tdx, 10 + dy)
    if P.get('torso_over'): P['torso_over'](g, dy, tdx, pose)
    # saia (túnicas longas)
    if lg['kind'] == 'robe':
        sk = P['skirt']
        seq = [(sk[0], 18 + dy, 0), (sk[1], 19, sway), (sk[2], 20, sway + pose.get('hem', 0))] if not dy else [(sk[0], 19, 0), (sk[2], 20, sway + pose.get('hem', 0))]
        for (row, yy, sh) in seq:
            g.stamp([row], 3 + sh + tdx, yy)
        lb = pose.get('legB', (-1, 0)); lf = pose.get('legF', (1, 0))
        for (fo, base) in ((lb, 5), (lf, 9)):
            fx = base + fo[0] + (sway // 2 if False else 0); fy = 21 - fo[1]
            g.put(fx, fy, lg['boot']); g.put(fx + 1, fy, lg['boot']); g.put(fx + 2, fy, lg['bootD'])
    # 5) cabeça
    paint_head(g, 3 + hdx, 1 + dy, P['hair'], P.get('beard'), pose.get('eyes', 'open'), pose.get('mouth', 'closed'))
    # 6) arma + braço da frente
    af = pose.get('armF', (12, 16))
    pp = dict(pose)
    if 'pa' not in pp and P.get('pa0') is not None: pp['pa'] = P['pa0'] + pp.get('dpa', 0)
    if P.get('prop'): P['prop'](g, (af[0] + tdx, af[1] + dy), pp)
    limb(g, (11 + tdx, 11 + dy), (af[0] + tdx, af[1] + dy), [(0, P.get('sleeveL', P['sleeve'])), (0.55, P['skin'])], [(0, P['sleeveS']), (0.55, P['skinS'])])
    if P.get('front'): P['front'](g, dy, sway, pose)
    return g

# ---------------- biblioteca de poses ----------------
def idle_poses():
    # 6 quadros: respiração suave + piscar + balanço de tecido
    return [
      dict(dy=0, sway=0, armB=(3,16), armF=(12,16)),
      dict(dy=0, sway=0, armB=(3,16), armF=(12,16), hdx=0),
      dict(dy=1, sway=1, armB=(3,17), armF=(12,17), hem=0),
      dict(dy=1, sway=1, armB=(3,17), armF=(12,17), eyes='blink'),
      dict(dy=1, sway=0, armB=(3,17), armF=(12,17)),
      dict(dy=0, sway=-1, armB=(3,16), armF=(12,16)),
    ]
def walk_poses():
    # 8 quadros: contato, descida, passagem, subida (x2)
    def mk(dy, l1, l2, aB, aF, sway, hem=0):
        return dict(dy=dy, legB=l1, legF=l2, armB=aB, armF=aF, sway=sway, hem=hem, tdx=0)
    A = [
      mk(1, (-3, 0), (3, 0), (4, 15), (11, 17), -1, -1),
      mk(1, (-2, 1), (2, 0), (4, 16), (11, 16), -1, -1),
      mk(0, (0, 2),  (0, 0), (3, 16), (12, 16), 0, 0),
      mk(0, (2, 1),  (-1, 0), (2, 16), (13, 15), 1, 1),
    ]
    B = [
      mk(1, (3, 0), (-3, 0), (2, 17), (13, 15), -1, -1),
      mk(1, (2, 0), (-2, 1), (3, 16), (12, 16), -1, -1),
      mk(0, (0, 0), (0, 2),  (3, 16), (12, 16), 0, 0),
      mk(0, (-1, 0), (2, 1), (4, 15), (11, 17), 1, 1),
    ]
    return A + B
