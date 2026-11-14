import math
from vec import *
S_ = math.sin; C_ = math.cos
def lerp(a, b, t): return a + (b - a) * t
INK = '#1b0c10'

# ---------------- IMP ----------------
IMP = ramp('#d9463b'); IWING = ramp('#7a2a4a'); HORN = ramp('#efe3bd')
def imp(hop=0.0, wing=0.0, tail=0.0, sq=0.0, attack=0.0):
    cv = Cv(18, 18); cx = 9; by = -hop * 2.2 + 1.0
    for sd in (-1, 1):
        a = math.radians(30 + wing * 36)
        w = cv.poly([(cx + sd * 3, 8 + by), (cx + sd * (3 + C_(a) * 7), 8 + by - S_(a) * 7.5), (cx + sd * (3 + C_(a) * 5.6), 8 + by - S_(a) * 4.4 + 3.2), (cx + sd * 4, 10.6 + by)])
        cv.paint(w, IWING, edge=True, band=.7, light=False)
    tl = cv.tube([(cx + 3, 13 + by), (cx + 6.6, 14.6 + by + S_(tail) * 1), (cx + 7.6, 11.4 + by + S_(tail + 1) * 1.4)], [1.0, .8, .6])
    cv.paint(tl, IMP, edge=False, light=False, shade=False, flat=(143, 37, 35))
    cv.pixel(cx + 7.6, 10 + by + S_(tail + 1), '#8f2523'); cv.pixel(cx + 8.6, 10.6 + by + S_(tail + 1), '#8f2523')
    for sd in (-1, 1):
        stretch = hop * 1.2 if hop > 0 else 0
        lg = cv.tube([(cx + sd * 2.2, 13 + by), (cx + sd * (2.6 + (0.5 if hop > .5 else 0)), 15.4 + by + stretch * .4), (cx + sd * 3.0, 16.6 + (0 if hop <= 0 else -hop * .6))], [1.5, 1.3, 1.2])
        cv.paint(lg, IMP, edge=True, band=.6, light=False)
    body = cv.ell(cx, 11 + by + sq * .3, 4.7 - sq * .3, 3.8 + sq * .4)
    cv.paint(body, IMP, edge=True, band=1.1, spec=False)
    belly = cv.ell(cx, 12 + by, 2.4, 2.0); cv.fill(ImageChops.multiply(belly, body), (242, 122, 99))
    for sd in (-1, 1):
        ar = cv.tube([(cx + sd * 4, 10.4 + by), (cx + sd * (5.4 + attack * 1.5), 12 + by - attack * 3), (cx + sd * (5.6 + attack * 2), 13.4 + by - attack * 4.5)], [1.2, 1.0, .9])
        cv.paint(ar, IMP, edge=True, band=.6, light=False)
    hd = cv.ell(cx, 6.2 + by - sq * .2, 5.3 + sq * .2, 4.3)
    cv.paint(hd, IMP, edge=True, band=1.2, spec=True)
    for sd in (-1, 1):
        hm = cv.tube([(cx + sd * 3.6, 3.4 + by), (cx + sd * 5.4, 1.2 + by), (cx + sd * 5.4, -.6 + by)], [1.3, 1.0, .35])
        cv.paint(hm, HORN, edge=True, band=.5)
    for sd in (-1, 1):
        cv.pixel(cx + sd * 2.3, 5.6 + by, '#ffe45a'); cv.pixel(cx + sd * 2.3 + sd, 5.6 + by, '#ffe45a'); cv.pixel(cx + sd * 2.3, 6.6 + by, '#1b0c10'); cv.pixel(cx + sd * 3.3, 6.6 + by, '#ffe45a')
    for dx in (-2, -1, 0, 1): cv.pixel(cx + dx, 8.4 + by, '#1b0c10')
    cv.pixel(cx - 1, 8.4 + by, '#ffffff'); cv.pixel(cx + 1, 8.4 + by, '#ffffff')
    return cv.finish()

# ---------------- BOMBER ----------------
BOMB = ramp('#e8791f')
def bomber(wal=0.0, fuse=0, glow=0.0, bob=0.0, flash=0.0):
    cv = Cv(18, 18); cx = 9; by = bob
    for sd in (-1, 1):
        l = S_(wal * 6.28 + (0 if sd < 0 else 3.14))
        ft = cv.ell(cx + sd * 3.4 + l * 1.2 * sd * 0, 16 - max(0, l) * 1.2, 2.2, 1.3)
        cv.paint(ft, ramp('#9a3e0d'), edge=True, band=.5, light=False)
    for sd in (-1, 1):
        ar = cv.ell(cx + sd * 7, 10.4 + by, 1.5, 2.0); cv.paint(ar, BOMB, edge=True, band=.5)
    body = cv.ell(cx, 10 + by, 6.6, 6.0)
    cv.paint(body, BOMB, edge=True, band=1.4, spec=True)
    bell = cv.ell(cx, 11.4 + by, 3.9, 2.6)
    cv.paint(bell, ramp('#3a1a0c'), edge=True, band=.5, light=False, shade=False)
    cv.fill(cv.ell(cx, 11.4 + by, 3.0, 1.9), (255, int(70 + 140 * glow), int(26 + 40 * glow)))
    cv.pixel(cx - 1, 11 + by, '#fff3a0'); cv.pixel(cx + 1, 11 + by, '#fff3a0' if glow > .5 else '#ffa84a')
    for sd in (-1, 1):
        cv.pixel(cx + sd * 2.6, 7.2 + by, '#ffe45a'); cv.pixel(cx + sd * 3.6, 7.2 + by, '#ffe45a'); cv.pixel(cx + sd * 2.6, 6.2 + by, '#1b0c10'); cv.pixel(cx + sd * 3.6, 6.2 + by, '#1b0c10'); cv.pixel(cx + sd * 2.6, 8.2 + by, '#1b0c10')
    for dx in (-2, -1, 0, 1): cv.pixel(cx + dx, 9.2 + by, '#1b0c10')
    for sd in (-1, 1):
        cv.pixel(cx + sd * 5, 4.4 + by, '#d8c9a0'); cv.pixel(cx + sd * 5 + sd, 3.4 + by, '#d8c9a0')
    f = cv.tube([(cx, 4.6 + by), (cx + 1.4, 2.4 + by), (cx + .6, .8 + by)], [.8, .7, .6]); cv.fill(f, (216, 201, 160))
    sp = [(255, 211, 74), (255, 120, 30), (255, 245, 170), (255, 70, 30)][fuse % 4]
    cv.pixel(cx + .6, -.4 + by, sp); cv.pixel(cx + 1.6, -.8 + by, sp); cv.pixel(cx - .4 + (fuse % 2), -1.6 + by, (255, 245, 200))
    if flash > .3:
        for (dx, dy) in ((-3, -3), (3, -2), (0, -4)): cv.pixel(cx + dx + 1, dy + 3 + by, '#fff3a0')
    return cv.finish()

# ---------------- SHADE (capuz roxo) ----------------
SHD = ramp('#7a5bb5')
def shade(ph=0.0, blink=0, arm=0.0, bob=0.0):
    cv = Cv(18, 20); cx = 9; by = bob
    pts = [(cx - 6.4 - 0.4 * S_(ph), 9 + by)]
    hem = []
    n = 7
    for i in range(n + 1):
        x = cx - 6.4 + i * (12.8 / n)
        yy = 17.4 + by + S_(ph + i * .95) * 1.5 + (1.0 if i % 2 else 0)
        hem.append((x, yy))
    robe = cv.poly([(cx - 6.4, 8 + by), (cx + 6.4, 8 + by)] + hem[::-1])
    robe = cv.union(robe, cv.ell(cx, 8 + by, 6.4, 4))
    cv.paint(robe, SHD, edge=True, band=1.3, spec=False)
    for sd in (-1, 1):
        a = cv.tube([(cx + sd * 6, 10 + by), (cx + sd * (7.8 + arm), 12 + by + arm), (cx + sd * (7.2 + arm * 1.4), 14 + by - arm * 2)], [1.3, 1.2, 1.4])
        cv.paint(a, ramp('#d9c8ff'), edge=True, band=.5, light=False)
    hood = cv.ell(cx, 6.2 + by, 5.6, 5.4)
    cv.paint(hood, SHD, edge=True, band=1.2, spec=True)
    face = cv.ell(cx, 6.8 + by, 3.9, 3.4)
    cv.fill(face, (18, 10, 36))
    if not blink:
        for sd in (-1, 1): cv.pixel(cx + sd * 1.9 - .5, 6.4 + by, '#c8ff7a'); cv.pixel(cx + sd * 1.9 + .5, 6.4 + by, '#c8ff7a'); cv.pixel(cx + sd * 1.9, 7.4 + by, '#7acc3a')
    else:
        for sd in (-1, 1): cv.pixel(cx + sd * 1.9, 7 + by, '#7acc3a')
    return cv.finish()

# ---------------- WRAITH ----------------
WTL = ramp('#5fd6d0'); BONE = ramp('#e8f6f0')
def wraith(ph=0.0, bob=0.0, arm=0.0, glow=0.0):
    cv = Cv(18, 26); cx = 9; by = bob
    hem = []
    n = 8
    for i in range(n + 1):
        x = cx - 6.8 + i * (13.6 / n)
        yy = 23.6 + by + S_(ph + i * .85) * 1.6 + (1.2 if i % 2 else 0)
        hem.append((x, yy))
    robe = cv.poly([(cx - 6.8, 11 + by), (cx + 6.8, 11 + by)] + hem[::-1])
    robe = cv.union(robe, cv.ell(cx, 12 + by, 6.8, 3.2))
    cv.paint(robe, WTL, edge=True, band=1.3)
    cv.fill(ImageChops.multiply(cv.ell(cx, 17 + by, 3.4, 4.6), robe), (23, 62, 82))
    for sd in (-1, 1):
        a = cv.tube([(cx + sd * 6.4, 13 + by), (cx + sd * (8 + arm), 16 + by - arm * 2), (cx + sd * (7.4 + arm), 18.6 + by - arm * 4)], [1.4, 1.3, 1.5])
        cv.paint(a, BONE, edge=True, band=.5, light=False)
    sk = cv.ell(cx, 7.4 + by, 5.2, 4.8)
    cv.paint(sk, BONE, edge=True, band=1.2, spec=True)
    for sd in (-1, 1):
        hm = cv.tube([(cx + sd * 3.6, 4.2 + by), (cx + sd * 6.6, 2.4 + by), (cx + sd * 7.6, -.2 + by)], [1.4, 1.1, .4])
        cv.paint(hm, ramp('#cfe6e0'), edge=True, band=.5)
    ec = (255, int(74 + 100 * glow), 74)
    for sd in (-1, 1):
        cv.pixel(cx + sd * 2.4, 6.6 + by, ec); cv.pixel(cx + sd * 3.4, 6.6 + by, ec); cv.pixel(cx + sd * 2.4, 5.6 + by, '#0b1822')
    cv.pixel(cx, 8.6 + by, '#0b1822')
    for dx in (-2, -1, 1, 2): cv.pixel(cx + dx, 10.2 + by, '#0b1822')
    return cv.finish()

# ---------------- MORCEGOS ----------------
def _bat(W, H, pal, flap, body_r, span, fang=False, fold=0.0, dive=0.0):
    cv = Cv(W, H); cx = W / 2; cy = H * .55 + dive * 1.2
    a_up = math.radians(lerp(-24, 52, (flap + 1) / 2)); a_up = lerp(a_up, math.radians(-80), fold)
    for sd in (-1, 1):
        sh = (cx + sd * body_r * .6, cy - 1)
        el = (sh[0] + sd * C_(a_up) * span * .45, sh[1] - S_(a_up) * span * .45)
        tp = (sh[0] + sd * C_(a_up * .6 - .1) * span, sh[1] - S_(a_up * .6 - .1) * span * 1.05)
        tp = (tp[0], tp[1] if fold < .5 else tp[1] + 2)
        lo = (sh[0] + sd * span * .55 * (1 - fold * .6), sh[1] + 2.4 + (1 - flap) * .6)
        mid = (lerp(el[0], lo[0], .5) + sd * 0.4, lerp(el[1], lo[1], .5) + 1.2)
        w = cv.poly([sh, el, tp, ((tp[0] + mid[0]) / 2, (tp[1] + mid[1]) / 2 + 1.6), mid, ((mid[0] + lo[0]) / 2, ((mid[1] + lo[1]) / 2) + 1.2), lo, (sh[0], sh[1] + 3)])
        cv.paint(w, pal['wing'], edge=True, band=.8, light=False)
        bn = cv.tube([sh, el, tp], [.55, .5, .35]); cv.fill(bn, pal['bone'])
    bd = cv.ell(cx, cy, body_r, body_r * 1.05)
    cv.paint(bd, pal['body'], edge=True, band=1.0, spec=False)
    for sd in (-1, 1):
        ear = cv.poly([(cx + sd * body_r * .9, cy - body_r * .5), (cx + sd * body_r * 1.0, cy - body_r * 1.5 - 1.2), (cx + sd * body_r * .3, cy - body_r * .9)])
        cv.paint(ear, pal['body'], edge=True, band=.5, light=False)
        cv.pixel(cx + sd * body_r * .55, cy - .4, pal['eye']); 
        if fang: cv.pixel(cx + sd * body_r * .5 - sd * 0, cy + body_r * .7, '#ffffff'); cv.pixel(cx + sd * body_r * .5, cy + body_r * .7 + 1, '#ffffff')
    if not fang: cv.pixel(cx, cy + body_r * .55, '#ffffff')
    return cv.finish()
BAT = dict(wing=ramp('#5a3a7a'), body=ramp('#6a4a8a'), bone=(42, 24, 64), eye=(255, 77, 109))
FBAT = dict(wing=ramp('#7a2a4a'), body=ramp('#9a3a5a'), bone=(58, 20, 40), eye=(255, 48, 48))
def bat(flap=0.0, fold=0.0): return _bat(22, 12, BAT, flap, 2.7, 10.4, False, fold)
def fangbat(flap=0.0, fold=0.0, dive=0.0): return _bat(28, 16, FBAT, flap, 3.6, 13.4, True, fold, dive)

# ---------------- BRUTE ----------------
BRU = ramp('#9b2f55')
def brute(step=0.0, bob=0.0, arm=0.0, up=0.0, slam=0.0):
    cv = Cv(26, 26); cx = 13; by = bob
    for sd in (-1, 1):
        s = S_(step * 6.28 + (0 if sd < 0 else 3.14)); lift = max(0, s) * 1.6
        lg = cv.tube([(cx + sd * 3.4, 17 + by), (cx + sd * 4.6, 20.6), (cx + sd * (4.6 + s * 1.6), 23.4 - lift)], [3.2, 2.9, 2.8])
        cv.paint(lg, ramp('#7a2346'), edge=True, band=.8, light=False)
        ft = cv.ell(cx + sd * (4.8 + s * 1.6) + 0.8, 24.2 - lift, 3.0, 1.4); cv.paint(ft, ramp('#521833'), edge=True, band=.5, light=False)
    bd = cv.ell(cx, 14 + by, 8.4, 7.4)
    cv.paint(bd, BRU, edge=True, band=1.5, spec=True)
    cv.fill(ImageChops.multiply(cv.ell(cx, 15.4 + by, 4.6, 4.6), bd), (196, 80, 122))
    for sd in (-1, 1):
        s = S_(step * 6.28 + (3.14 if sd < 0 else 0)) * (1 - up)
        sx, sy = cx + sd * 8.6, 11 + by
        hxp = sx + sd * (2.2 + arm * 1.6 * sd * 0) + s * 0 ; hyp = lerp(18 + s * 1.2 + by, 3 + by, up) + slam * 7
        elb = (sx + sd * (2.2 + up * 1.2), lerp(13.4 + by, 6 + by, up))
        a = cv.tube([(sx, sy), elb, (sx + sd * (1.2 + up * 1.6), hyp)], [3.0, 3.0, 2.8])
        cv.paint(a, BRU, edge=True, band=.9)
        fist = cv.ell(sx + sd * (1.2 + up * 1.6), hyp + 1.4, 3.0, 2.8); cv.paint(fist, ramp('#c4507a'), edge=True, band=.8)
    hd = cv.ell(cx, 7.2 + by, 6.4, 5.2)
    cv.paint(hd, BRU, edge=True, band=1.3, spec=True)
    for sd in (-1, 1):
        hm = cv.tube([(cx + sd * 5, 4 + by), (cx + sd * 8.6, 2.4 + by), (cx + sd * 9.4, -.4 + by)], [1.7, 1.3, .4])
        cv.paint(hm, HORN, edge=True, band=.6)
        cv.pixel(cx + sd * 3, 6.2 + by, '#ffd24a'); cv.pixel(cx + sd * 3 - sd, 6.2 + by, '#ffd24a'); cv.pixel(cx + sd * 3 - sd, 7.2 + by, '#14070e'); cv.pixel(cx + sd * 3, 5.2 + by, '#14070e')
    for dx in range(-3, 4): cv.pixel(cx + dx, 9.6 + by, '#14070e')
    for dx in (-3, -1, 1, 3): cv.pixel(cx + dx, 10.4 + by - (up * -1), '#ffffff')
    return cv.finish()

# ---------------- HEXER ----------------
HEX = ramp('#3a2a5a')
def hexer(ph=0.0, bob=0.0, cast=0.0, orb=0.0):
    cv = Cv(16, 22); cx = 8; by = bob
    hem = []
    for i in range(7):
        x = cx - 5.6 + i * (11.2 / 6); hem.append((x, 19.4 + by + S_(ph + i * .9) * 1.1 + (1 if i % 2 else 0)))
    robe = cv.poly([(cx - 5.6, 9 + by), (cx + 5.6, 9 + by)] + hem[::-1]); robe = cv.union(robe, cv.ell(cx, 10 + by, 5.6, 3))
    cv.paint(robe, HEX, edge=True, band=1.3)
    for sd in (-1, 1):
        a = cv.tube([(cx + sd * 5.2, 11 + by), (cx + sd * (6.6 + cast), 13 + by - cast * 3), (cx + sd * (6 + cast * 1.4), 15 + by - cast * 6)], [1.4, 1.2, 1.3])
        cv.paint(a, HEX, edge=True, band=.5, light=False)
        cv.fill(cv.ell(cx + sd * (6 + cast * 1.4), 15.4 + by - cast * 6, 1.4, 1.4), (200, 120, 255) if cast > .3 else (216, 205, 176))
    g = cv.ell(cx, 14.4 + by, 2.0, 2.4)
    cv.paint(g, ramp('#c04dff'), edge=True, band=.5)
    cv.pixel(cx - .5, 13.4 + by, '#f6c8ff' if orb > .4 else '#d890ff')
    hd = cv.ell(cx, 6.6 + by, 4.9, 5.0); cv.paint(hd, HEX, edge=True, band=1.2, spec=True)
    cv.fill(cv.ell(cx, 7.2 + by, 3.4, 3.2), (14, 8, 24))
    for sd in (-1, 1): cv.pixel(cx + sd * 1.8, 7 + by, '#ff5a8a'); cv.pixel(cx + sd * 1.8 - sd, 7 + by, '#ff5a8a')
    for sd in (-1, 1):
        hm = cv.tube([(cx + sd * 4, 3.6 + by), (cx + sd * 6.4, 2 + by), (cx + sd * 7, -.4 + by)], [1.2, 1.0, .35]); cv.paint(hm, ramp('#d8cdb0'), edge=True, band=.5)
    return cv.finish()

# ---------------- ELITE ----------------
ELI = ramp('#3a3a68'); GOLD = ramp('#f2c14e')
def elite(step=0.0, bob=0.0, up=0.0, glow=0.0):
    cv = Cv(26, 26); cx = 13; by = bob
    for sd in (-1, 1):
        s = S_(step * 6.28 + (0 if sd < 0 else 3.14)); lift = max(0, s) * 1.4
        lg = cv.tube([(cx + sd * 3.4, 17 + by), (cx + sd * 4.2, 20.6), (cx + sd * (4.4 + s * 1.2), 23.2 - lift)], [3.0, 2.7, 2.6])
        cv.paint(lg, ramp('#1b1b3a'), edge=True, band=.8, light=False)
    bd = cv.ell(cx, 14 + by, 8.0, 7.2); cv.paint(bd, ELI, edge=True, band=1.5, spec=True)
    cv.fill(ImageChops.multiply(cv.ell(cx, 14.6 + by, 3.4, .9), bd), GOLD['mid'])
    cv.pixel(cx - 1, 13.4 + by, '#6a6aa0'); cv.pixel(cx, 13.4 + by, '#6a6aa0'); cv.pixel(cx + 1, 13.4 + by, '#6a6aa0')
    for sd in (-1, 1):
        pa = cv.ell(cx + sd * 8.2, 10.6 + by, 3.6, 3.0); cv.paint(pa, GOLD, edge=True, band=.7)
        sx, sy = cx + sd * 8.6, 12 + by
        hyp = lerp(17.4 + by + S_(step * 6.28 + (3.14 if sd < 0 else 0)) * (1 - up), 3 + by, up)
        a = cv.tube([(sx, sy), (sx + sd * 1.2, lerp(14.4 + by, 7 + by, up)), (sx + sd * (.6 + up), hyp)], [2.6, 2.5, 2.4])
        cv.paint(a, ELI, edge=True, band=.8)
        fist = cv.ell(sx + sd * (.6 + up), hyp + 1.2, 2.6, 2.4)
        cv.paint(fist, GOLD if glow > .3 else ramp('#6a6aa0'), edge=True, band=.6)
    hd = cv.ell(cx, 7.4 + by, 6.0, 5.2); cv.paint(hd, ELI, edge=True, band=1.3, spec=True)
    cv.fill(cv.ell(cx, 8 + by, 4.6, 3.2), (7, 7, 15))
    ec = (255, int(77 + 110 * glow), 77)
    for sd in (-1, 1): cv.pixel(cx + sd * 2.4, 7.4 + by, ec); cv.pixel(cx + sd * 2.4 - sd, 7.4 + by, ec); cv.pixel(cx + sd * 2.4, 6.4 + by, ec)
    for dx in range(-3, 4, 2): cv.pixel(cx + dx, 10 + by, '#ffffff')
    cr = cv.poly([(cx - 5.6, 4.4 + by), (cx - 4.6, -.4 + by), (cx - 2, 3 + by), (cx, -1.6 + by), (cx + 2, 3 + by), (cx + 4.6, -.4 + by), (cx + 5.6, 4.4 + by)])
    cv.paint(cr, GOLD, edge=True, band=.7)
    for sd in (-1, 1):
        hm = cv.tube([(cx + sd * 5.6, 5.4 + by), (cx + sd * 9, 3.4 + by), (cx + sd * 10.4, 0 + by)], [1.5, 1.2, .4]); cv.paint(hm, HORN, edge=True, band=.6)
    return cv.finish()

# ---------------- STALKER (lobo, de perfil olhando p/ direita) ----------------
WOLF = ramp('#4a3a78'); WOLFD = ramp('#2e2250')
def stalker(g=0.0, crouch=0.0, leap=0.0, bob=0.0):
    cv = Cv(32, 22)
    by = bob + crouch * 2.2 - leap * 1.2
    # fase de galope (0..1): pernas dianteiras e traseiras em oposição
    ph = g * 6.28
    def leg(x, y0, a, back=False, far=False):
        sw = S_(a) * (4.0 if not crouch else 1.2) * (1 - leap * .4) + (leap * (3 if not back else -4))
        lift = max(0, C_(a)) * 2.6 * (1 - crouch)
        k = [(x, y0), (x + sw * .5 * (1 if not back else -1) + (0 if not back else -0.6), y0 + 3.4 - lift * .4), (x + sw, 18.6 - lift + crouch * 1.4)]
        t = cv.tube(k, [2.3, 1.7, 1.3])
        col = WOLFD if far else WOLF
        cv.paint(t, col, edge=True, band=.7, light=not far)
        cv.fill(cv.ell(k[-1][0] + .8, k[-1][1] + .6, 1.8, 1.0), WOLFD['edge'])
    leg(10, 11.4 + by, ph + 3.14, True, True); leg(22, 11.4 + by, ph + 3.14 + .9, False, True)
    # cauda
    tl = cv.tube([(5, 8.6 + by), (1.6, 7.2 + by + S_(ph) * .8), (.6, 3.6 + by + S_(ph + 1) * 1.2)], [2.0, 1.6, .8]); cv.paint(tl, WOLFD, edge=True, band=.6, light=False)
    body = cv.ell(14.6, 9.6 + by, 10.6, 4.9 - crouch * .4); cv.paint(body, WOLF, edge=True, band=1.3, spec=True)
    for i in range(5):
        sp = cv.poly([(6 + i * 3.2, 5.6 + by), (7.2 + i * 3.2, 2.4 + by - (i % 2)), (8.4 + i * 3.2, 5.6 + by)]); cv.paint(sp, ramp('#241a3e'), edge=True, band=.4, light=False)
    leg(7.6, 11.4 + by, ph, True); leg(20, 11.4 + by, ph + .9, False)
    nk = cv.ell(21.6, 7.4 + by, 4.2, 3.8); cv.paint(nk, WOLF, edge=True, band=1.0)
    hd = cv.ell(24.4, 6.6 + by + crouch * .6, 3.8, 3.4); cv.paint(hd, WOLF, edge=True, band=1.0, spec=True)
    snt = cv.poly([(26, 5 + by + crouch * .6), (31, 6.8 + by + crouch * .6), (31, 8.6 + by + crouch * .6), (25.6, 9 + by + crouch * .6)]); cv.paint(snt, WOLF, edge=True, band=.7)
    jw = cv.poly([(25, 8.4 + by + crouch * .6), (30.4, 8.8 + by + crouch * .6 + leap * 1.4), (28.6, 10.4 + by + crouch * .6 + leap * 1.6), (25, 9.6 + by + crouch * .6)]); cv.paint(jw, ramp('#241a3e'), edge=True, band=.5, light=False)
    for k in range(2): cv.pixel(28 + k * 1.6, 8 + by + crouch * .6, '#ffffff')
    for (x0, x1) in ((22, 20), (24, 24.6)):
        e = cv.poly([(x0 - 1.2, 4 + by + crouch * .6), (x0 + .2, 1.2 + by + crouch * .6), (x0 + 1.6, 4 + by + crouch * .6)]); cv.paint(e, ramp('#241a3e'), edge=True, band=.4, light=False)
    ec = (255, 154, 58) if crouch > .5 or leap > .5 else (255, 48, 48)
    cv.pixel(26, 5.6 + by + crouch * .6, ec); cv.pixel(27, 5.6 + by + crouch * .6, ec)
    return cv.finish()

# ---------------- SCORPIÃO ----------------
SCO = ramp('#c9862a')
def scorp(sc=0.0, tail=0.0, claw=0.0, bob=0.0):
    cv = Cv(26, 16); cx = 12; by = bob
    for i in range(4):
        for sd in (-1, 1):
            s = S_(sc * 6.28 + i * 1.6 + (0 if sd < 0 else 3.14)); xo = 4 + i * 2.6
            lg = cv.tube([(xo, 10 + by), (xo - 1.6 + s * 1.4, 12.4), (xo - 2.4 + s * 2.2, 14.6 - max(0, s) * 1)], [.9, .8, .6])
            cv.fill(lg, (122, 74, 20)) if sd < 0 else None
    for i in range(4):
        s = S_(sc * 6.28 + i * 1.6 + 3.14); xo = 5 + i * 2.6
        lg = cv.tube([(xo, 10 + by), (xo + 1.2 + s * 1.2, 12.8), (xo + .2 + s * 2.2, 14.8 - max(0, s) * 1)], [.9, .8, .6]); cv.fill(lg, (150, 90, 24))
    bd = cv.ell(11, 9 + by, 7.2, 3.6); cv.paint(bd, SCO, edge=True, band=1.0, spec=True)
    for i in range(4):
        cv.fill(ImageChops.multiply(cv.ell(6 + i * 2.6, 9 + by, .55, 3.4), bd), (168, 96, 26))
    hd = cv.ell(18.6, 9 + by, 3.2, 3.0); cv.paint(hd, SCO, edge=True, band=.8)
    for sd in (-1, 1):
        cl = cv.tube([(19, 9.4 + by + sd * 2), (22 + claw, 9 + by + sd * 3.0 - claw), (23.8 + claw * 1.4, 8.4 + by + sd * 2.0 - claw * 1.6)], [1.1, 1.2, 1.4])
        cv.paint(cl, ramp('#e0a040'), edge=True, band=.5, light=False)
    cv.pixel(19.6, 8 + by, '#ff4a3a'); cv.pixel(20.6, 8.6 + by, '#ff4a3a')
    tp = [(5, 8.4 + by), (1.6, 6 + by + S_(tail) * .6), (1.8 + tail * .0, 2.2 + by), (5.4 + S_(tail) * 1.2, -.6 + by - claw * 1.4)]
    tt = cv.tube(tp, [1.6, 1.4, 1.3, 1.1]); cv.paint(tt, ramp('#b87420'), edge=True, band=.6, light=False)
    cv.pixel(tp[-1][0] + 1, tp[-1][1] + 1.4, '#ff4a3a'); cv.pixel(tp[-1][0] + 2, tp[-1][1] + 1.4, '#ff8a3a')
    return cv.finish()

# ---------------- UMBRA ----------------
UMB = ramp('#2a1d4a')
def umbra(ph=0.0, bob=0.0, arm=0.0, blink=0):
    cv = Cv(16, 18); cx = 8; by = bob
    for i in range(5):
        x = cx - 5 + i * 2.5; w = S_(ph + i * 1.1) * 1.2
        t = cv.tube([(x, 11 + by), (x + w * .6, 14 + by), (x + w, 16.4 + (i % 2) * .8)], [1.4, 1.1, .5]); cv.paint(t, UMB, edge=True, band=.6, light=False)
    bd = cv.ell(cx, 9 + by, 6.4, 5.6); cv.paint(bd, UMB, edge=True, band=1.3, spec=True)
    for sd in (-1, 1):
        a = cv.tube([(cx + sd * 5.6, 9 + by), (cx + sd * (7.2 + arm), 11 + by + arm), (cx + sd * (7.4 + arm), 13.4 + by + arm * 2)], [1.3, 1.1, .7]); cv.paint(a, UMB, edge=True, band=.5, light=False)
    cv.fill(ImageChops.multiply(cv.ell(cx - 2, 7 + by, 2.0, 2.4), bd), (58, 42, 94))
    ec = (255, 90, 208)
    if not blink:
        for sd in (-1, 1): cv.pixel(cx + sd * 2.4 - .5, 7.4 + by, ec); cv.pixel(cx + sd * 2.4 + .5, 7.4 + by, ec); cv.pixel(cx + sd * 2.4, 6.4 + by, (255, 160, 230))
    else:
        for sd in (-1, 1): cv.pixel(cx + sd * 2.4, 7.4 + by, (140, 40, 120))
    for sd in (-1, 1):
        sp = cv.poly([(cx + sd * 3.4, 4 + by), (cx + sd * 4.4, .8 + by), (cx + sd * 1.8, 3.4 + by)]); cv.paint(sp, UMB, edge=True, band=.4, light=False)
    return cv.finish()

# ================= SEQUÊNCIAS =================
def N(n): return [i / n for i in range(n)]
SEQ = {}
SEQ['imp'] = dict(loop=[lambda i=i: imp(hop=h, wing=w, tail=i, sq=s) for i, (h, w, s) in enumerate([(0, -1, .6), (.7, 0, -.3), (1, 1, -.5), (.6, 0, 0), (0, -1, .2), (-.3, -.5, 1)])],
                  windup=[lambda: imp(hop=-.4, wing=1, sq=1, attack=.6), lambda: imp(hop=.2, wing=1, sq=-.4, attack=1)])
SEQ['bomber'] = dict(loop=[lambda i=i: bomber(wal=i / 6, fuse=i, glow=(i % 2), bob=(0 if i % 3 else -.6)) for i in range(6)],
                     windup=[lambda: bomber(wal=0, fuse=1, glow=1, bob=.4, flash=1), lambda: bomber(wal=0, fuse=2, glow=1, bob=-.6, flash=1)])
SEQ['shade'] = dict(loop=[lambda i=i: shade(ph=i * 1.05, blink=(1 if i == 4 else 0), arm=S_(i * 1.05) * .5, bob=S_(i * 1.05) * .7) for i in range(6)],
                    windup=[lambda: shade(ph=0, arm=1.0, bob=-.5), lambda: shade(ph=1, arm=1.4, bob=-1)])
SEQ['wraith'] = dict(loop=[lambda i=i: wraith(ph=i * 1.05, bob=S_(i * 1.05) * .7, arm=S_(i * 1.05 + 1) * .5, glow=0) for i in range(6)],
                     windup=[lambda: wraith(ph=0, arm=1, glow=1, bob=-.5), lambda: wraith(ph=1, arm=1.4, glow=1, bob=-1)])
SEQ['bat'] = dict(loop=[lambda f=f: bat(flap=f) for f in (1, .4, -.4, -1, -.4, .4)], windup=[lambda: bat(flap=1, fold=.0), lambda: bat(flap=-1, fold=.0)])
SEQ['fangbat'] = dict(loop=[lambda f=f: fangbat(flap=f) for f in (1, .4, -.4, -1, -.4, .4)],
                      windup=[lambda: fangbat(flap=1, fold=0), lambda: fangbat(flap=0, fold=.6, dive=.5)],
                      attack=[lambda: fangbat(flap=0, fold=1, dive=1)])
SEQ['brute'] = dict(loop=[lambda i=i: brute(step=i / 8, bob=(0 if i % 4 in (1, 2) else -.0) + (.6 if i % 4 == 0 else 0)) for i in range(8)],
                    windup=[lambda: brute(step=0, up=.6, bob=.2), lambda: brute(step=0, up=1.0, bob=-.6)],
                    attack=[lambda: brute(step=0, up=.2, slam=.6, bob=.8)])
SEQ['hexer'] = dict(loop=[lambda i=i: hexer(ph=i * 1.05, bob=S_(i * 1.05) * .8, cast=.1, orb=(i % 2)) for i in range(6)],
                    windup=[lambda: hexer(ph=0, cast=.6, orb=1, bob=-.4), lambda: hexer(ph=1, cast=1, orb=1, bob=-1)])
SEQ['elite'] = dict(loop=[lambda i=i: elite(step=i / 6, bob=(.6 if i % 3 == 0 else 0)) for i in range(6)],
                    windup=[lambda: elite(up=.6, glow=.6, bob=.2), lambda: elite(up=1, glow=1, bob=-.6)])
SEQ['stalker'] = dict(loop=[lambda i=i: stalker(g=i / 8, bob=(-.6 if i % 4 in (0, 1) else .2)) for i in range(8)],
                      windup=[lambda: stalker(g=0, crouch=.7), lambda: stalker(g=0, crouch=1)],
                      attack=[lambda: stalker(g=.2, leap=1)])
SEQ['scorp'] = dict(loop=[lambda i=i: scorp(sc=i / 6, tail=i, bob=(.4 if i % 2 else 0)) for i in range(6)],
                    windup=[lambda: scorp(tail=1, claw=.8, bob=.4), lambda: scorp(tail=2, claw=1.4, bob=.8)])
SEQ['umbra'] = dict(loop=[lambda i=i: umbra(ph=i * 1.05, bob=S_(i * 1.05) * .7, arm=S_(i * 1.05) * .6, blink=(1 if i == 4 else 0)) for i in range(6)],
                    windup=[lambda: umbra(arm=1, bob=-.5), lambda: umbra(arm=1.4, bob=-1)])

if __name__ == '__main__':
    import sys
    names = sys.argv[1:] or list(SEQ)
    for k in names:
        arrs = [f() for f in SEQ[k]['loop'] + SEQ[k].get('windup', []) + SEQ[k].get('attack', [])]
        preview(arrs, scale=6, cols=8).save('/home/claude/art/prev_e_%s.png' % k)
    print('ok')
