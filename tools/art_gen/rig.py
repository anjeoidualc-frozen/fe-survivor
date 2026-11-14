"""Motor de pixel art: grade de caracteres + rig de membros + preview."""
from PIL import Image
import math

def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)

class Grid:
    def __init__(self, w, h, ox=0, oy=0):
        self.w, self.h, self.ox, self.oy = w, h, ox, oy
        self.p = [['.'] * w for _ in range(h)]
    def put(self, x, y, ch):
        x, y = int(x) + self.ox, int(y) + self.oy
        if 0 <= x < self.w and 0 <= y < self.h and ch != '.':
            self.p[y][x] = ch
    def get(self, x, y):
        x, y = x + self.ox, y + self.oy
        return self.p[y][x] if 0 <= x < self.w and 0 <= y < self.h else '.'
    def crop_sym(self, bw, bh, widths, heights):
        """recorta simetricamente em torno da área base (bw x bh) escolhendo o menor tamanho que contém o desenho"""
        xs = [x - self.ox for y in range(self.h) for x in range(self.w) if self.p[y][x] != '.']
        ys = [y - self.oy for y in range(self.h) for x in range(self.w) if self.p[y][x] != '.']
        minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
        Wc = next(w for w in widths if (w - bw) // 2 >= max(0, -minx) and (w - bw) // 2 >= max(0, maxx - (bw - 1)))
        Hc = next(h for h in heights if (h - bh) // 2 >= max(0, -miny) and (h - bh) // 2 >= max(0, maxy - (bh - 1)))
        px, py = (Wc - bw) // 2, (Hc - bh) // 2
        out = []
        for y in range(-py, bh + py):
            out.append(''.join(self.p[y + self.oy][x + self.ox] for x in range(-px, bw + px)))
        return out
    def stamp(self, rows, x, y, flip=False):
        for j, r in enumerate(rows):
            if flip: r = r[::-1]
            for i, ch in enumerate(r):
                if ch not in '. ': self.put(x + i, y + j, ch)
    def line(self, x0, y0, x1, y1, ch):
        x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        pts = []
        for i in range(n + 1):
            pts.append((round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)))
        for (x, y) in pts: self.put(x, y, ch)
        return pts
    def rows(self):
        return [''.join(r) for r in self.p]
    def copy(self):
        g = Grid(self.w, self.h); g.p = [r[:] for r in self.p]; return g

def limb(g, p0, p1, segs, shade=None, thick=2):
    """Membro de 2 px de largura. segs=[(t_inicio, char_luz)], shade=[(t_inicio, char_sombra)]"""
    x0, y0 = p0; x1, y1 = p1
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    vert = abs(y1 - y0) >= abs(x1 - x0)
    def pick(lst, t):
        c = lst[0][1]
        for (ts, ch) in lst:
            if t >= ts: c = ch
        return c
    for i in range(n + 1):
        t = i / n
        x = round(x0 + (x1 - x0) * t); y = round(y0 + (y1 - y0) * t)
        main = pick(segs, t)
        sh = pick(shade, t) if shade else main
        if thick == 1:
            g.put(x, y, main)
        elif vert:
            g.put(x, y, main); g.put(x + 1, y, sh)
        else:
            g.put(x, y, main); g.put(x, y + 1, sh)

def prop_line(g, p0, ang_deg, length, chars, start=0):
    """Linha reta a partir de p0 com ângulo (0=direita, -90=cima). chars: lista indexada por posição."""
    a = math.radians(ang_deg)
    pts = []
    for i in range(start, length + 1):
        x = p0[0] + math.cos(a) * i; y = p0[1] + math.sin(a) * i
        pts.append((round(x), round(y)))
    out = []
    for k, (x, y) in enumerate(pts):
        ch = chars[min(k, len(chars) - 1)] if isinstance(chars, (list, tuple)) else chars
        g.put(x, y, ch); out.append((x, y))
    return out

def to_image(rows, pal, outline='#140b22', scale=1):
    h = len(rows); w = max(len(r) for r in rows)
    base = Image.new('RGBA', (w + 2, h + 2), (0, 0, 0, 0)); b = base.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.' and ch in pal: b[x + 1, y + 1] = hexc(pal[ch])
    out = Image.new('RGBA', (w + 2, h + 2), (0, 0, 0, 0)); o = out.load()
    for y in range(h + 2):
        for x in range(w + 2):
            if b[x, y][3] == 0:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < w + 2 and 0 <= yy < h + 2 and b[xx, yy][3]:
                        o[x, y] = hexc(outline); break
            else: o[x, y] = b[x, y]
    if scale != 1: out = out.resize((out.width * scale, out.height * scale), Image.NEAREST)
    return out

def sheet(rows_of_imgs, scale=6, bg=(58, 70, 62, 255), gap=10, labels=None):
    """rows_of_imgs: lista de listas de PIL images"""
    wmax = 0; htot = gap
    for r in rows_of_imgs:
        wmax = max(wmax, sum(i.width * scale + gap for i in r) + gap)
        htot += max(i.height for i in r) * scale + gap
    s = Image.new('RGBA', (wmax, htot), bg); y = gap
    for r in rows_of_imgs:
        x = gap
        for im in r:
            im2 = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
            s.alpha_composite(im2, (x, y)); x += im2.width + gap
        y += max(i.height for i in r) * scale + gap
    return s

def rle(row):
    out = []; i = 0
    while i < len(row):
        j = i
        while j < len(row) and row[j] == row[i]: j += 1
        n = j - i
        out.append((str(n) if n > 1 else '') + row[i]); i = j
    return ''.join(out)
