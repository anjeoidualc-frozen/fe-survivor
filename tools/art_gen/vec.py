"""Motor vetorial -> pixel art. Formas em coordenadas de pixel final; renderizadas em alta resolução
sem antialias, sombreadas por deslocamento de máscara e reduzidas por voto de maioria."""
import math, numpy as np
from PIL import Image, ImageDraw, ImageChops, ImageFilter

def hx(c):
    c = c.lstrip('#'); return tuple(int(c[i:i+2], 16) for i in (0, 2, 4))

def ramp(base, n=4, edge=None):
    """gera rampa [edge, dark, mid, light, spec] a partir de uma cor média"""
    r, g, b = hx(base)
    def mix(c, t, to):
        return tuple(int(c[i] + (to[i] - c[i]) * t) for i in range(3))
    dark = mix((r, g, b), .38, (10, 6, 24)); edge_c = mix((r, g, b), .62, (10, 6, 24))
    light = mix((r, g, b), .32, (255, 245, 220)); spec = mix((r, g, b), .62, (255, 250, 235))
    return dict(edge=edge_c, dark=dark, mid=(r, g, b), light=light, spec=spec)

class Cv:
    def __init__(self, W, H, sc=8):
        self.W, self.H, self.sc = W, H, sc
        self.img = Image.new('RGBA', (W * sc, H * sc), (0, 0, 0, 0))
        self.px_over = []
    # -------- máscaras --------
    def M(self): return Image.new('L', (self.W * self.sc, self.H * self.sc), 0)
    def _d(self, m): return ImageDraw.Draw(m)
    def ell(self, cx, cy, rx, ry, rot=0, m=None):
        s = self.sc; m = m or self.M()
        if rot == 0:
            self._d(m).ellipse([(cx - rx) * s, (cy - ry) * s, (cx + rx) * s, (cy + ry) * s], fill=255)
        else:
            pts = []
            for i in range(40):
                a = i / 40 * 2 * math.pi
                x, y = math.cos(a) * rx, math.sin(a) * ry
                c, sn = math.cos(rot), math.sin(rot)
                pts.append(((cx + x * c - y * sn) * s, (cy + x * sn + y * c) * s))
            self._d(m).polygon(pts, fill=255)
        return m
    def poly(self, pts, m=None):
        m = m or self.M(); s = self.sc
        self._d(m).polygon([(x * s, y * s) for x, y in pts], fill=255); return m
    def tube(self, pts, radii, m=None, n=None):
        """pts: lista de pontos de controle (curva suave Catmull-Rom); radii: raio por ponto"""
        m = m or self.M(); s = self.sc; d = self._d(m)
        P = [pts[0]] + list(pts) + [pts[-1]]; R = [radii[0]] + list(radii) + [radii[-1]]
        for i in range(1, len(P) - 2):
            p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
            seg = max(6, int(math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 2.2))
            for k in range(seg + 1):
                t = k / seg; t2, t3 = t * t, t * t * t
                x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
                y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
                r = R[i] + (R[i + 1] - R[i]) * t
                d.ellipse([(x - r) * s, (y - r) * s, (x + r) * s, (y + r) * s], fill=255)
        return m
    def union(self, *ms):
        out = ms[0]
        for m in ms[1:]: out = ImageChops.lighter(out, m)
        return out
    # -------- pintura com sombreamento --------
    def paint(self, mask, rp, edge=True, band=1.25, light=True, shade=True, spec=False, flat=None):
        s = self.sc; img = self.img
        if edge:
            e = max(1, int(s * 0.62))
            dil = mask.filter(ImageFilter.MaxFilter(2 * e + 1))
            img.paste(Image.new('RGBA', img.size, rp['edge'] + (255,)), (0, 0), dil)
        if flat:
            img.paste(Image.new('RGBA', img.size, flat + (255,)), (0, 0), mask); return
        img.paste(Image.new('RGBA', img.size, rp['mid'] + (255,)), (0, 0), mask)
        d = int(s * band)
        if shade:
            sh = ImageChops.subtract(mask, ImageChops.offset(mask, -d, -d))
            sh = ImageChops.multiply(sh, mask)
            img.paste(Image.new('RGBA', img.size, rp['dark'] + (255,)), (0, 0), sh)
        if light:
            lt = ImageChops.subtract(mask, ImageChops.offset(mask, d, d))
            lt = ImageChops.multiply(lt, mask)
            img.paste(Image.new('RGBA', img.size, rp['light'] + (255,)), (0, 0), lt)
        if spec:
            d2 = int(s * band * 2.1)
            sp = ImageChops.subtract(ImageChops.offset(mask, d, d), ImageChops.offset(mask, d2, d2))
            sp = ImageChops.multiply(sp, ImageChops.subtract(mask, ImageChops.offset(mask, d, d)))
            sp = ImageChops.multiply(sp, mask)
            img.paste(Image.new('RGBA', img.size, rp['spec'] + (255,)), (0, 0), sp)
    def fill(self, mask, color):
        self.img.paste(Image.new('RGBA', self.img.size, hx(color) + (255,) if isinstance(color, str) else color + (255,)), (0, 0), mask)
    def pixel(self, x, y, color):
        self.px_over.append((int(round(x)), int(round(y)), hx(color) if isinstance(color, str) else color))
    def rect_px(self, x0, y0, w, h, color):
        for j in range(h):
            for i in range(w): self.pixel(x0 + i, y0 + j, color)
    # -------- redução --------
    def finish(self):
        s = self.sc; W, H = self.W, self.H
        a = np.array(self.img)
        blk = a.reshape(H, s, W, s, 4).transpose(0, 2, 1, 3, 4).reshape(H, W, s * s, 4)
        alpha = (blk[..., 3] > 0)
        cover = alpha.mean(axis=2)
        out = np.zeros((H, W, 4), dtype=np.uint8)
        keys = (blk[..., 0].astype(np.int64) << 16) | (blk[..., 1].astype(np.int64) << 8) | blk[..., 2].astype(np.int64)
        for y in range(H):
            for x in range(W):
                if cover[y, x] < 0.5: continue
                kk = keys[y, x][alpha[y, x]]
                vals, cnt = np.unique(kk, return_counts=True)
                k = vals[np.argmax(cnt)]
                out[y, x] = ((k >> 16) & 255, (k >> 8) & 255, k & 255, 255)
        for (x, y, c) in self.px_over:
            if 0 <= x < W and 0 <= y < H: out[y, x] = c + (255,)
        return out

def to_rows(arrs, ):
    """converte lista de arrays RGBA em (palette dict char->hex, lista de rows por frame)"""
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    pal = {}; inv = {}
    out = []
    for arr in arrs:
        H, W = arr.shape[:2]; rows = []
        for y in range(H):
            r = []
            for x in range(W):
                if arr[y, x, 3] == 0: r.append('.')
                else:
                    c = tuple(int(v) for v in arr[y, x, :3])
                    if c not in inv:
                        inv[c] = chars[len(inv)]; pal[inv[c]] = '#%02x%02x%02x' % c
                    r.append(inv[c])
            rows.append(''.join(r))
        out.append(rows)
    return pal, out

def preview(arrs, scale=6, bg=(58, 70, 62), outline=(20, 11, 34), cols=None):
    ims = []
    for arr in arrs:
        H, W = arr.shape[:2]
        im = Image.new('RGBA', (W + 2, H + 2), (0, 0, 0, 0)); p = im.load()
        base = [[tuple(arr[y, x]) for x in range(W)] for y in range(H)]
        for y in range(H + 2):
            for x in range(W + 2):
                yy, xx = y - 1, x - 1
                if 0 <= yy < H and 0 <= xx < W and base[yy][xx][3]: p[x, y] = base[yy][xx]
        o = im.copy(); op = o.load()
        for y in range(H + 2):
            for x in range(W + 2):
                if p[x, y][3] == 0:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        xx, yy = x + dx, y + dy
                        if 0 <= xx < W + 2 and 0 <= yy < H + 2 and p[xx, yy][3]:
                            op[x, y] = outline + (255,); break
        ims.append(o.resize((o.width * scale, o.height * scale), Image.NEAREST))
    cols = cols or len(ims)
    rowsN = (len(ims) + cols - 1) // cols
    cw = max(i.width for i in ims) + 12; ch = max(i.height for i in ims) + 12
    sh = Image.new('RGBA', (cw * cols + 12, ch * rowsN + 12), bg + (255,))
    for i, im in enumerate(ims):
        sh.alpha_composite(im, (12 + (i % cols) * cw, 12 + (i // cols) * ch))
    return sh
