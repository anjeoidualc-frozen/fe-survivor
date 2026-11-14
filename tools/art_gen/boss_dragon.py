import math
from vec import *
W, H = 72, 64
RED = ramp('#c42236'); MEM = ramp('#6a1a4a'); BELLY = ramp('#e9b84c'); GOLD = ramp('#f4c542'); BONE = ramp('#e8806c'); DARKM = ramp('#2a0610')
def lerp(a, b, t): return a + (b - a) * t

def wing(cv, side, phi, fold=0.0):
    """side=-1 esquerda, +1 direita. phi: -1 (baixo) .. 1 (alto)"""
    sx = 28 if side < 0 else 44; sy = 27
    ang = math.radians(lerp(-22, 52, (phi + 1) / 2))
    ang = ang * (1 - fold) + math.radians(-70) * fold
    def pol(o, a, L): return (o[0] + side * math.cos(a) * L, o[1] - math.sin(a) * L)
    S = (sx, sy)
    E = pol(S, ang, 11)
    Wr = pol(E, ang - math.radians(12), 13)
    tips = []
    offs = [58, 30, 2, -26]; lens = [13, 18, 19, 15]
    for o, L in zip(offs, lens):
        tips.append(pol(Wr, ang + math.radians(o) * (1 - 0.35 * fold), L))
    hip = (sx - side * -1 * 0 + side * -3, 40)
    pts = [S, E, Wr, tips[0]]
    for i in range(3):
        a, b = tips[i], tips[i + 1]
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        mid = (lerp(mid[0], Wr[0], .34), lerp(mid[1], Wr[1], .34))
        pts.append(mid); pts.append(b)
    pts.append((sx + side * 2, 42))
    m = cv.poly(pts)
    cv.paint(m, MEM, edge=True, band=1.0)
    # ossos
    bone = cv.M()
    cv.tube([S, E, Wr], [1.9, 1.5, 1.2], m=bone)
    for t in tips: cv.tube([Wr, ((Wr[0] + t[0]) / 2, (Wr[1] + t[1]) / 2), t], [1.2, .9, .5], m=bone)
    cv.paint(bone, BONE, edge=False, light=False, shade=False)
    # garra no pulso
    cl = cv.poly([(Wr[0] - side * 1.5, Wr[1] - 1), (Wr[0], Wr[1] - 5), (Wr[0] + side * 1.5, Wr[1] - 0.5)])
    cv.paint(cl, GOLD, edge=True, band=.6)

def head(cv, cx, cy, s, mouth, crown=True, glow=0.0, tilt=0.0):
    cx2 = cx
    # chifres
    for sd in (-1, 1):
        hm = cv.tube([(cx + sd * 4.2 * s, cy - 2.6 * s), (cx + sd * 7.2 * s, cy - 5.2 * s), (cx + sd * 8.4 * s + sd * tilt, cy - 9.5 * s)], [1.9 * s, 1.4 * s, .55 * s])
        cv.paint(hm, GOLD, edge=True, band=.8)
    sk = cv.ell(cx, cy, 6.6 * s, 5.2 * s)
    cv.paint(sk, RED, edge=True, band=1.3, spec=(s > .9))
    # boca aberta
    op = mouth
    if op > 0.05:
        inter = cv.ell(cx, cy + 5.2 * s, 3.9 * s, (1.1 + op * 2.4) * s)
        cv.paint(inter, DARKM, edge=True, band=.5, light=False, shade=False)
        if glow > 0.05:
            gl = cv.ell(cx, cy + 5.4 * s + op * .4, 2.8 * s, (0.8 + op * 1.6) * s)
            cv.fill(gl, (255, int(150 + 80 * glow), int(30 + 50 * glow)))
    jaw = cv.ell(cx, cy + 6.6 * s + op * 2.3 * s, 3.6 * s, 1.7 * s)
    cv.paint(jaw, RED, edge=True, band=.9, light=False)
    snout = cv.ell(cx, cy + 3.2 * s, 4.1 * s, 3.0 * s)
    cv.paint(snout, RED, edge=True, band=1.0, spec=(s > .9))
    # dentes
    if op > 0.05 and s > .9:
        for dx in (-2.6, -1.0, 1.0, 2.6):
            cv.pixel(cx + dx, cy + 5.4 * s, '#fff4dc')
        cv.pixel(cx - 2.6, cy + 6.4 * s + op * 2, '#fff4dc'); cv.pixel(cx + 2.6, cy + 6.4 * s + op * 2, '#fff4dc')
    # narinas e olhos
    cv.pixel(cx - 1.3 * s, cy + 2.6 * s, '#3a0a14'); cv.pixel(cx + 1.0 * s, cy + 2.6 * s, '#3a0a14')
    ey = cy - 0.8 * s
    ex = 3.2 * s
    for sd in (-1, 1):
        x = cx + sd * ex
        cv.pixel(x, ey, '#ffe45a'); cv.pixel(x + (0 if s < .9 else sd * 1), ey, '#ffd02a' if s > .9 else '#ffe45a')
        cv.pixel(x - sd * (1 if s > .9 else 0), ey - 1, '#3a0a14')
        if s > .9: cv.pixel(x + sd, ey - 1, '#3a0a14')
    if crown:
        gx = int(round(cx))
        for i, dx in enumerate((-2, -1, 0, 1, 2)):
            cv.pixel(gx + dx, cy - 5.3 * s, '#f4c542')
        for dx in (-2, 0, 2): cv.pixel(gx + dx, cy - 5.3 * s - 1, '#ffe27a')

def draw(phi=0.0, sway=0.0, breathe=0.0, mouth=0.15, tail=0.0, glow=0.0, fold=0.0, lunge=0.0, lift=0.0):
    cv = Cv(W, H)
    by = lift
    # cauda
    tp = [(42, 50 + by), (51, 55 + by + math.sin(tail) * 1.2), (60 + math.sin(tail + .6) * 2, 53 + by), (66 + math.sin(tail + 1.2) * 3, 45 + by + math.cos(tail) * 2)]
    t = cv.tube(tp, [5.0, 4.0, 2.8, 1.4])
    tipx, tipy = tp[-1]
    sp = cv.poly([(tipx - 2.5, tipy + 1), (tipx + 1.5, tipy - 5.5), (tipx + 4.5, tipy - 1.5), (tipx + 1.5, tipy + 2.5)])
    cv.paint(cv.union(t), RED, edge=True, band=1.2)
    cv.paint(sp, GOLD, edge=True, band=.8)
    # asas atrás
    wing(cv, -1, phi, fold); wing(cv, 1, phi, fold)
    # patas traseiras
    for sd, x in ((-1, 26), (1, 46)):
        lg = cv.union(cv.ell(x, 50 + by, 6.0, 7.0), cv.tube([(x, 52 + by), (x + sd * 1, 58 + by), (x + sd * 2.5, 61)], [3.4, 2.8, 2.4]))
        cv.paint(lg, RED, edge=True, band=1.2)
        for k in (-1.8, 0, 1.8): cv.pixel(x + sd * 2.5 + k, 62, '#fff0cc')
    # pescoços laterais e central
    nl = cv.tube([(31, 32 + by), (25 + sway * 1.5, 28 + by), (19 + sway * 2.5, 23 + by), (16 + sway * 3, 18 + by + lunge * 1)], [4.2, 3.8, 3.4, 3.2])
    nr = cv.tube([(41, 32 + by), (47 - sway * 1.5, 28 + by), (53 - sway * 2.5, 23 + by), (56 - sway * 3, 18 + by + lunge * 1)], [4.2, 3.8, 3.4, 3.2])
    cv.paint(nl, RED, edge=True, band=1.2); cv.paint(nr, RED, edge=True, band=1.2)
    # corpo
    body = cv.ell(36, 41 + by + breathe * .4, 14.5, 15.5 + breathe * .5)
    cv.paint(body, RED, edge=True, band=1.5, spec=True)
    # braços dianteiros
    for sd, x in ((-1, 25.5), (1, 46.5)):
        ar = cv.tube([(x, 35 + by), (x + sd * -2, 41 + by), (x + sd * -1, 46 + by)], [3.2, 2.7, 2.3])
        cv.paint(ar, RED, edge=True, band=1.0)
        for k in (-1.4, 0.2, 1.8): cv.pixel(x + sd * -1 + k, 47.8 + by, '#fff0cc')
    # barriga dourada
    belly = cv.ell(36, 44 + by + breathe * .4, 8.2, 11.5)
    cv.paint(belly, BELLY, edge=True, band=1.3)
    for j in range(5):
        bd = cv.ell(36, 36.6 + j * 4.2 + by + breathe * .4, 8.4, .55)
        bd = ImageChops.multiply(bd, belly)
        cv.fill(bd, BELLY['dark'])
    # pescoço central e cabeças
    nc = cv.tube([(36, 33 + by), (36 + sway * -1, 27 + by), (36 + sway * .8, 21 + by), (36, 15.5 + by + lunge * 3)], [6.2, 5.4, 4.8, 4.6])
    cv.paint(nc, RED, edge=True, band=1.3)
    head(cv, 16 + sway * 3, 15 + by + lunge * 1, .78, mouth * .6, glow=glow * .5)
    head(cv, 56 - sway * 3, 15 + by + lunge * 1, .78, mouth * .6, glow=glow * .5)
    head(cv, 36, 10.5 + by + lunge * 3.5, 1.0, mouth, glow=glow)
    return cv.finish()

if __name__ == '__main__':
    import sys
    fr = [draw(phi=math.sin(i / 8 * 2 * math.pi), sway=math.sin(i / 8 * 2 * math.pi + 1), breathe=math.sin(i / 8 * 2 * math.pi), tail=i / 8 * 2 * math.pi, mouth=.2 + .1 * math.sin(i / 8 * 6.28)) for i in range(0, 8, 2)]
    fr += [draw(phi=1, sway=0, mouth=.9, glow=1, fold=0), draw(phi=-1, mouth=1.0, glow=1, lunge=1)]
    preview(fr, scale=5, cols=3).save('/home/claude/art/prev_dragon.png')
    print('ok')
