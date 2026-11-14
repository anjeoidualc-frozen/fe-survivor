import math
from vec import *
def lerp(a, b, t): return a + (b - a) * t
S_ = math.sin; C_ = math.cos

# ===================== LEGIÃO =====================
LW, LH = 46, 44
TEAL = ramp('#2f8a78'); FACE = ramp('#7fe0c8'); WISP = ramp('#c8fff0'); DMOUTH = ramp('#10242a')
def legiao(ph=0.0, mouth=0.2, grow=1.0, flare=0.0, stretch=1.0):
    cv = Cv(LW, LH); cx, cy = 23, 25
    # tentáculos com mãos
    for i in range(6):
        a = i / 6 * 2 * math.pi + 0.5
        w = S_(ph * 2 + i * 1.3) * 3.0
        r0 = 11; r1 = 17 + flare * 4 + S_(ph + i) * 1.5
        p = [(cx + C_(a) * r0 * stretch, cy + S_(a) * r0 * .85), (cx + C_(a + .25) * (r0 + r1) / 2 * stretch + w * -S_(a), cy + S_(a + .25) * (r0 + r1) / 2 * .85 + w * C_(a)),
             (cx + C_(a + .1) * r1 * stretch + w * -S_(a) * 1.4, cy + S_(a + .1) * r1 * .85 + w * C_(a) * 1.4)]
        t = cv.tube(p, [3.2, 2.4, 2.0])
        hand = cv.ell(p[-1][0], p[-1][1], 2.6, 2.2)
        cv.paint(cv.union(t, hand), TEAL, edge=True, band=1.0)
    # massa
    body = cv.ell(cx, cy, (15.5 * grow) * stretch, 13.5 * grow)
    cv.paint(body, TEAL, edge=True, band=1.6, spec=True)
    # rostos
    faces = [(23, 17, 6.4, 1.0), (13.5, 27, 4.6, .8), (32.5, 27, 4.6, .8), (23, 33, 4.2, .7), (15, 16, 3.4, .6), (31.5, 16.5, 3.4, .6)]
    for k, (fx, fy, fr, sc) in enumerate(faces):
        fx2 = cx + (fx - cx) * grow * stretch; fy2 = cy + (fy - cy) * grow
        m = cv.ell(fx2, fy2, fr, fr * 1.08)
        cv.paint(m, FACE, edge=True, band=.9, spec=False)
        op = mouth * (0.6 + 0.4 * S_(ph * 2 + k)) if sc > .65 else mouth * .5
        mo = cv.ell(fx2, fy2 + fr * .42, fr * .42, fr * (.16 + op * .5))
        cv.paint(mo, DMOUTH, edge=False, light=False, shade=False)
        ex = fr * .42
        eyec = (255, 60 + int(120 * flare), 60) if flare > .3 else (232, 40, 52)
        cv.pixel(fx2 - ex, fy2 - fr * .25, eyec); cv.pixel(fx2 + ex, fy2 - fr * .25, eyec)
        if fr > 6:
            cv.pixel(fx2 - ex - 1, fy2 - fr * .25, '#ffffff'); cv.pixel(fx2 + ex + 1, fy2 - fr * .25, '#ffffff')
    # fogos-fátuos
    for i in range(5):
        a = ph * 1.4 + i / 5 * 2 * math.pi
        wx = cx + C_(a) * 20 * stretch; wy = cy - 4 + S_(a) * 14
        fl = cv.tube([(wx, wy + 2.5), (wx + .5, wy), (wx, wy - 3)], [1.9, 1.5, .6])
        cv.paint(fl, WISP, edge=False, light=False, shade=False, flat=(200, 255, 240))
        cv.pixel(wx, wy - 1, '#ffffff')
    return cv.finish()

# ===================== BELZEBU =====================
BW, BH = 50, 48
BROWN = ramp('#5a3a22'); DBROWN = ramp('#3e2616'); EYER = ramp('#d81e2c'); WINGM = ramp('#bfe0f0'); CREAM = ramp('#e8dcb4'); ABD = ramp('#6a4a1e')
def belzebu(flap=0.0, bob=0.0, leg=0.0, mouth=0.0, rear=0.0):
    cv = Cv(BW, BH); cx = 25; by = bob
    # asas (2 pares)
    for pair, (L, ang0, oy) in enumerate(((22, 40, 22), (17, 8, 25))):
        for sd in (-1, 1):
            a = math.radians(ang0 + flap * 28 + rear * 18 - pair * 8)
            ox, oy2 = cx + sd * 4, oy + by
            tipx, tipy = ox + sd * C_(a) * L, oy2 - S_(a) * L * .9
            mx, my = (ox + tipx) / 2, (oy2 + tipy) / 2
            nx, ny = -(tipy - oy2), (tipx - ox)
            nl = math.hypot(nx, ny) or 1; nx, ny = nx / nl * 6.6, ny / nl * 6.6
            m = cv.poly([(ox, oy2), (mx + nx, my + ny), (tipx, tipy), (mx - nx * .7, my - ny * .7)])
            cv.paint(m, WINGM, edge=True, band=.8, light=False, shade=False, flat=(196, 226, 244) if pair == 0 else (170, 205, 230))
            vn = cv.tube([(ox, oy2), (mx, my), (tipx, tipy)], [.8, .7, .4])
            cv.fill(vn, (112, 150, 190))
    # pernas
    for i, (dx, dyy) in enumerate(((-6, 0), (6, 0), (-8, 3), (8, 3), (-5, 5), (5, 5))):
        sd = -1 if dx < 0 else 1; w = S_(leg * 6.28 + i * 1.2) * 1.2
        lg = cv.tube([(cx + dx * .5, 28 + by + dyy * .3), (cx + dx + w, 33 + by + dyy), (cx + dx * 1.2 + w * 1.5, 39 + by + dyy)], [1.2, 1.0, .7])
        cv.paint(lg, DBROWN, edge=False, light=False, shade=False, flat=(46, 28, 18))
    # abdômen
    ab = cv.ell(cx, 33 + by, 7.4, 9.8)
    cv.paint(ab, ABD, edge=True, band=1.4)
    for j in range(5):
        bd = cv.ell(cx, 27.5 + j * 3.4 + by, 7.6, .65); bd = ImageChops.multiply(bd, ab); cv.fill(bd, ABD['edge'])
    sting = cv.poly([(cx - 1.4, 42.4 + by), (cx + 1.4, 42.4 + by), (cx, 46.4 + by)])
    cv.paint(sting, ramp('#7a2a6a'), edge=True, band=.5)
    # tórax
    th = cv.ell(cx, 25 + by, 9.2, 7.4)
    cv.paint(th, BROWN, edge=True, band=1.4, spec=True)
    for dx in (-5, -2, 1, 4): cv.pixel(cx + dx, 22 + by, '#8a6a42'); cv.pixel(cx + dx + 1, 26 + by, '#8a6a42')
    # cabeça
    hd = cv.ell(cx, 15 + by - rear * 1.0, 8.2, 7.2)
    cv.paint(hd, BROWN, edge=True, band=1.3)
    # chifres
    for sd in (-1, 1):
        hm = cv.tube([(cx + sd * 4.4, 10 + by), (cx + sd * 7.8, 6 + by), (cx + sd * 9.4, 1.4 + by)], [1.9, 1.4, .5])
        cv.paint(hm, CREAM, edge=True, band=.7)
    # olhos compostos
    for sd in (-1, 1):
        e = cv.ell(cx + sd * 4.6, 14.6 + by, 4.6, 5.0)
        cv.paint(e, EYER, edge=True, band=1.2, spec=True)
        for (ox, oy3) in ((-1.5, -1.5), (0.5, -1.5), (-1.5, .5), (.5, .5), (-0.5, 2.5)):
            cv.pixel(cx + sd * 4.6 + ox, 14.6 + by + oy3, '#7a0a18')
        cv.pixel(cx + sd * 4.6 - 1, 12.4 + by, '#ffb0b8')
    # mandíbulas
    for sd in (-1, 1):
        md = cv.tube([(cx + sd * 1.8, 19 + by), (cx + sd * (2.6 + mouth * 1.5), 22 + by + mouth), (cx + sd * (1.2 + mouth * 2.4), 24.6 + by + mouth * 1.5)], [1.4, 1.1, .5])
        cv.paint(md, CREAM, edge=True, band=.6)
    cv.pixel(cx, 18 + by, '#1a0a0a'); cv.pixel(cx, 19 + by, '#1a0a0a')
    # coroa pequena
    for dx in (-2, 0, 2): cv.pixel(cx + dx, 8.2 + by, '#f4c542'); cv.pixel(cx + dx, 7.2 + by, '#ffe27a')
    for dx in (-1, 0, 1): cv.pixel(cx + dx, 9.2 + by, '#f4c542')
    return cv.finish()

# ===================== ABADOM =====================
AW, AH = 56, 54
IRON = ramp('#4c4660'); ASH = ramp('#b0a48a'); AMB = ramp('#d98a2a'); CLOAK = ramp('#2c1c38'); HAIR = ramp('#20141c'); AGOLD = ramp('#f4c542'); SCORP = ramp('#8a3a1a')
def abadom(flap=0.0, bob=0.0, tail=0.0, hairs=0.0, glow=0.0, arm=0.0, lean=0.0):
    cv = Cv(AW, AH); cx = 28 + lean; by = bob
    # asas de gafanhoto
    for pair, (L, a0) in enumerate(((26, 24), (22, 2))):
        for sd in (-1, 1):
            a = math.radians(a0 + flap * 24)
            ox, oy = cx + sd * 5, 25 + by
            tip = (ox + sd * C_(a) * L, oy - S_(a) * L)
            mid = ((ox + tip[0]) / 2, (oy + tip[1]) / 2)
            nx, ny = -(tip[1] - oy), (tip[0] - ox); nl = math.hypot(nx, ny) or 1; nx, ny = nx / nl * 5.4, ny / nl * 5.4
            m = cv.poly([(ox, oy), (mid[0] + nx, mid[1] + ny), tip, (mid[0] - nx * .55, mid[1] - ny * .55)])
            cv.paint(m, AMB, edge=True, band=1.0, light=(pair == 0), flat=None)
            vn = cv.tube([(ox, oy), mid, tip], [.9, .8, .45]); cv.fill(vn, (112, 62, 22))
    # cauda de escorpião
    tp = []
    for i, (bx, byy) in enumerate(((cx + 4, 36), (cx + 14, 34), (cx + 20, 25), (cx + 16, 15), (cx + 8, 11))):
        w = S_(tail + i * .7) * (0.6 + i * .5)
        tp.append((bx + w * .6, byy + by + w * .4))
    tt = cv.tube(tp, [3.0, 2.8, 2.5, 2.2, 1.9])
    cv.paint(tt, SCORP, edge=True, band=1.0)
    stp = cv.poly([(tp[-1][0] - 2, tp[-1][1] - 1), (tp[-1][0] - 3.4, tp[-1][1] + 3.6), (tp[-1][0] + 1.4, tp[-1][1] + 1.2)])
    cv.paint(stp, ramp('#ffb040'), edge=True, band=.5)
    cv.pixel(tp[-1][0] - 2, tp[-1][1] + 1, '#fff0a0')
    # manto/cauda inferior
    pts = [(cx, 30 + by), (cx + S_(hairs) * 1.0, 38 + by), (cx - S_(hairs + 1) * 1.5, 45 + by), (cx + S_(hairs + 2) * 2, 51 + by)]
    cl = cv.tube(pts, [8.0, 6.5, 4.2, 1.6])
    for k, off in enumerate((-5, 5)):
        cl = cv.tube([(cx + off * .5, 36 + by), (cx + off + S_(hairs + k) * 1.4, 43 + by), (cx + off * 1.1 + S_(hairs + k + 2) * 2, 49 + by)], [3.0, 2.2, .9], m=cl)
    cv.paint(cl, CLOAK, edge=True, band=1.2)
    # torso blindado
    tor = cv.ell(cx, 27 + by, 9.6, 9.4)
    cv.paint(tor, IRON, edge=True, band=1.4, spec=True)
    for (x0, y0, x1, y1) in ((-4, 22, -2, 30), (3, 23, 5, 31)):
        cr = cv.tube([(cx + x0, y0 + by), (cx + (x0 + x1) / 2 + 1, (y0 + y1) / 2 + by), (cx + x1, y1 + by)], [.6, .6, .5]); cv.fill(cr, (255, int(130 + 90 * glow), 40))
    belt = cv.ell(cx, 33.5 + by, 8, 1.6); belt = ImageChops.multiply(belt, tor); cv.fill(belt, AGOLD['mid'])
    # ombreiras com espinhos
    for sd in (-1, 1):
        sp1 = cv.poly([(cx + sd * 9, 20 + by), (cx + sd * 12.4, 12.4 + by), (cx + sd * 13.6, 22 + by)])
        pa = cv.ell(cx + sd * 11, 24 + by, 5.4, 4.2)
        cv.paint(cv.union(pa, sp1), IRON, edge=True, band=1.2, spec=True)
        # braço e garra
        ar = cv.tube([(cx + sd * 11, 27 + by), (cx + sd * (13 + arm * 3), 33 + by - arm * 3), (cx + sd * (12 + arm * 6), 38 + by - arm * 7)], [2.8, 2.4, 2.1])
        cv.paint(ar, ASH, edge=True, band=1.0)
        hx_, hy_ = cx + sd * (12 + arm * 6), 38.6 + by - arm * 7
        for k in (-1.4, 0, 1.4): cv.pixel(hx_ + k, hy_ + 2.4, '#e8e0cc')
    # cabelo
    for sd in (-1, 1):
        hr = cv.tube([(cx + sd * 6, 13 + by), (cx + sd * (9 + S_(hairs + sd) * 1.2), 22 + by), (cx + sd * (8 + S_(hairs + 1.5 + sd) * 2), 31 + by)], [2.6, 2.2, 1.0])
        cv.paint(hr, HAIR, edge=True, band=.9)
    # cabeça
    hd = cv.ell(cx, 15 + by, 7.2, 7.4)
    cv.paint(hd, ASH, edge=True, band=1.3)
    # coroa
    cr = cv.poly([(cx - 7, 9.6 + by), (cx - 7, 4 + by), (cx - 3.4, 8 + by), (cx, 2.4 + by), (cx + 3.4, 8 + by), (cx + 7, 4 + by), (cx + 7, 9.6 + by)])
    cv.paint(cr, AGOLD, edge=True, band=.8)
    # olhos e boca de leão
    ec = (255, int(110 + 100 * glow), 30)
    for sd in (-1, 1):
        cv.pixel(cx + sd * 3, 14 + by, ec); cv.pixel(cx + sd * 3 + sd, 14 + by, ec); cv.pixel(cx + sd * 3, 12.6 + by, '#2a0e0e')
    cv.pixel(cx, 16 + by, '#6a5a48')
    for dx in (-3, -2, -1, 0, 1, 2, 3): cv.pixel(cx + dx, 19 + by, '#2a0a0a')
    for dx in (-3, -1, 1, 3): cv.pixel(cx + dx, 19.8 + by, '#fff4dc'); 
    return cv.finish()

# ===================== LEVIATÃ =====================
VW, VH = 62, 56
SEA = ramp('#2f6bb8'); SEAB = ramp('#cfeaf6'); FOAM = ramp('#e8f6ff'); FIN = ramp('#1f8ad0')
def leviata(ph=0.0, jaw=0.2, thrust=0.0, rise=0.0, smoke=0.0):
    cv = Cv(VW, VH)
    # espuma na base
    for i, (x, w) in enumerate(((14, 8), (30, 11), (47, 8))):
        e = cv.ell(x, 51 + S_(ph + i) * .6, w, 2.4); cv.paint(e, FOAM, edge=False, light=False, shade=False, flat=(150, 205, 240))
        e2 = cv.ell(x, 50.4 + S_(ph + i) * .6, w * .7, 1.2); cv.fill(e2, (232, 246, 255))
    # corpo ondulante
    base = [(8, 46), (17, 49), (29, 49), (41, 45), (47, 36), (44, 26), (40 + thrust * 3, 18 - rise)]
    pts = []
    for i, (x, y) in enumerate(base):
        w = S_(ph - i * 0.95) * (2.0 + i * .6)
        pts.append((x + (-w * .4 if i > 3 else 0), y + w * (.8 if i < 4 else .2)))
    rad = [2.0, 5.2, 7.4, 8.0, 7.6, 6.6, 5.6]
    body = cv.tube(pts, rad)
    # espinhos dorsais
    sp = cv.M()
    for i in range(1, len(pts) - 1):
        px_, py_ = pts[i]; r = rad[i]
        nx = -1 if i > 3 else 0; ny = -1 if i <= 3 else 0
        if i > 3: nx, ny = -.8, -.3
        tri = cv.poly([(px_ + nx * r - ny * 1.6, py_ + ny * r - nx * 1.6 - (0 if i > 3 else 0)), (px_ + nx * (r + 4.2) , py_ + ny * (r + 4.6)), (px_ + nx * r + ny * 1.6, py_ + ny * r + nx * 1.6)])
        sp = ImageChops.lighter(sp, tri)
    cv.paint(sp, FIN, edge=True, band=.8)
    cv.paint(body, SEA, edge=True, band=1.6, spec=True)
    # escamas
    for i in range(len(pts) - 1):
        for k in range(3):
            t = k / 3; x = lerp(pts[i][0], pts[i + 1][0], t); y = lerp(pts[i][1], pts[i + 1][1], t); r = lerp(rad[i], rad[i + 1], t)
            cr = cv.ell(x, y, r * .66, r * .4, rot=math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]) + 1.57)
            cr = ImageChops.multiply(cr, body); cv.fill(cr, SEA['dark'] if (i + k) % 2 else (60, 128, 200))
    # barriga clara (lado de dentro da curva)
    belly = cv.tube([(p[0] + 2.0, p[1] + 1.2) for p in pts[1:-1]], [r * .38 for r in rad[1:-1]])
    belly = ImageChops.multiply(belly, body); cv.fill(belly, SEAB['mid'])
    # cabeça
    hx0, hy0 = pts[-1]
    hx0 += 1; hy0 -= 4
    sk = cv.ell(hx0 + 2, hy0 + 2, 9.0, 5.8, rot=-0.15)
    snout = cv.poly([(hx0 + 5, hy0 - 2.6), (hx0 + 17 + thrust * 2, hy0 + 1), (hx0 + 5, hy0 + 3.6)])
    cv.paint(cv.union(sk, snout), SEA, edge=True, band=1.4, spec=True)
    jw = jaw * 6
    mo = cv.poly([(hx0 + 4, hy0 + 2.6), (hx0 + 16 + thrust * 2, hy0 + 1.4 + .3), (hx0 + 15 + thrust * 2, hy0 + 2.4 + jw), (hx0 + 5, hy0 + 5.6 + jw)])
    cv.paint(mo, ramp('#2a0e18'), edge=True, band=.6, light=False, shade=False)
    low = cv.poly([(hx0 + 2, hy0 + 4.2 + jw * .8), (hx0 + 15.4 + thrust * 2, hy0 + 2.6 + jw), (hx0 + 13 + thrust * 2, hy0 + 5.8 + jw * 1.05), (hx0 + 3, hy0 + 8 + jw * .9)])
    cv.paint(low, SEA, edge=True, band=1.0, light=False)
    for k in range(4):
        tx = hx0 + 7 + k * 2.6 + thrust * (k * .4)
        cv.pixel(tx, hy0 + 2.2 + 0.2 * k, '#ffffff'); cv.pixel(tx, hy0 + 3.2 + jw * .75, '#fff4dc')
    # chifre e olho
    hn = cv.tube([(hx0 - 2, hy0 - 3.4), (hx0 - 5, hy0 - 7.4), (hx0 - 8.4, hy0 - 8.6)], [1.8, 1.3, .5])
    cv.paint(hn, ramp('#e8dcb4'), edge=True, band=.7)
    cv.pixel(hx0 + 3, hy0 - 1, '#ffe45a'); cv.pixel(hx0 + 4, hy0 - 1, '#ffd02a'); cv.pixel(hx0 + 3, hy0 - 2, '#2a0e18'); cv.pixel(hx0 + 4, hy0 - 2, '#2a0e18')
    cv.pixel(hx0 + 15 + thrust * 2, hy0 - .4, '#10243a')
    # fumaça das narinas
    for k in range(3):
        a = (smoke + k / 3) % 1
        sx_ = hx0 + 14 + a * 5; sy_ = hy0 - 2 - a * 8
        m = cv.ell(sx_, sy_, 1.0 + a * 1.4, 1.0 + a * 1.2); cv.fill(m, (int(200 - a * 60), int(215 - a * 50), int(235 - a * 40)))
    return cv.finish()

if __name__ == '__main__':
    import sys
    rows = []
    rows += [legiao(ph=i * 1.57, mouth=.2 + .3 * (i % 2)) for i in range(3)] + [legiao(ph=1, mouth=1, grow=.9, flare=1), legiao(ph=2, mouth=.2, grow=1.12, flare=.5)]
    preview(rows, scale=5, cols=5).save('/home/claude/art/prev_leg.png')
    rows = [belzebu(flap=f, bob=b) for f, b in ((1, 0), (0, 1), (-1, 0), (0, 1))] + [belzebu(flap=1, rear=1, mouth=1)]
    preview(rows, scale=5, cols=5).save('/home/claude/art/prev_bel.png')
    rows = [abadom(flap=f, bob=b, tail=t) for f, b, t in ((1, 0, 0), (0, 1, 1.5), (-1, 0, 3), (0, 1, 4.5))] + [abadom(flap=1, arm=1, glow=1, tail=2)]
    preview(rows, scale=5, cols=5).save('/home/claude/art/prev_aba.png')
    rows = [leviata(ph=i * 1.5, jaw=.2, smoke=i / 4) for i in range(4)] + [leviata(ph=1, jaw=1.0, thrust=1)]
    preview(rows, scale=5, cols=5).save('/home/claude/art/prev_lev.png')
    print('ok')
