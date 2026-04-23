#!/usr/bin/env python3
"""
Yukimura snowman-battleship sprite — isometric low-poly 3-D style.

Sprite anchor: the game renderer does
    ctx.translate(cx, cy - hPx * 0.72)
    ctx.drawImage(sprite, -W/2, -H * 0.72, W, H)
so the image's 72% mark aligns with the ship pivot (roughly lower-body centre).

Layout (y coords in 512-wide × 580-tall canvas, anchor CY = 418 ≈ 72%):
  29  ← turret barrel tips
  67  ← hat dome top
  99  ← hat brim
 140  ← head top / hat brim overlap
 180  ← head centre
 230  ← head bottom / mid-ball top
 280  ← mid-ball centre
 335  ← scarf
 360  ← lower-ball top
 418  ← CY (72%) = lower-ball centre   ← ship pivot anchor
 484  ← lower-ball bottom / hull deck top
 518  ← hull oval bottom
 534  ← hull side bottom
"""

from PIL import Image, ImageDraw
import math

# ── canvas ────────────────────────────────────────────────────────────────────
W, H = 512, 580
img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
D   = ImageDraw.Draw(img)

# 72% anchor  →  lower-ball centre
CY = int(H * 0.72)   # 417

# ── palette ───────────────────────────────────────────────────────────────────
SNOW_W   = (255, 255, 255)
SNOW_MID = (235, 242, 252)
SNOW_LO  = (196, 210, 228)
SNOW_SHD = (140, 158, 182)
SNOW_DEP = (100, 125, 158)
GRN_BRI  = ( 74, 222, 128)
GRN_MID  = ( 21, 128,  61)
GRN_DRK  = ( 20,  83,  45)
GRN_DST  = ( 10,  50,  25)
RED_BRI  = (248,  82,  82)
RED_MID  = (220,  38,  38)
RED_DRK  = (153,  27,  27)
ORANGE   = (234,  88,  12)
ORN_DRK  = (180,  58,   5)
GUN_LIT  = (165, 180, 196)
GUN_MID  = ( 95, 112, 130)
GUN_DRK  = ( 50,  63,  80)
BLK      = ( 15,  23,  42)
HULL_LIT = (215, 228, 240)
HULL_MID = (185, 200, 215)
HULL_SHD = (130, 148, 168)

# ── helpers ───────────────────────────────────────────────────────────────────
def a(c, alpha=255): return (*c[:3], alpha)

def ell(cx, cy, rx, ry, fill=None, outline=None, lw=2):
    b = [cx-rx, cy-ry, cx+rx, cy+ry]
    if fill    is not None: D.ellipse(b, fill=a(fill))
    if outline is not None: D.ellipse(b, outline=a(outline), width=lw)

def pg(pts, fill=None, outline=None, lw=1):
    ipts = [(int(x), int(y)) for x, y in pts]
    if fill    is not None: D.polygon(ipts, fill=a(fill))
    if outline is not None:
        for i in range(len(ipts)):
            D.line([ipts[i], ipts[(i+1) % len(ipts)]], fill=a(outline), width=lw)

def ln(p1, p2, col, lw=1):
    D.line([(int(p1[0]),int(p1[1])), (int(p2[0]),int(p2[1]))], fill=a(col), width=lw)

def rct(x0,y0,x1,y1, fill=None, outline=None, lw=1):
    if fill:    D.rectangle([int(x0),int(y0),int(x1),int(y1)], fill=a(fill))
    if outline: D.rectangle([int(x0),int(y0),int(x1),int(y1)], outline=a(outline), width=lw)

def ring_seg(cx, cy, Rx, Ry, rx, ry, a0d, a1d, fill):
    """Filled annular ring segment."""
    n = 18
    a0, a1 = math.radians(a0d), math.radians(a1d)
    outer = [(cx + Rx*math.cos(a0+(a1-a0)*t/n), cy + Ry*math.sin(a0+(a1-a0)*t/n)) for t in range(n+1)]
    inner = [(cx + rx*math.cos(a0+(a1-a0)*t/n), cy + ry*math.sin(a0+(a1-a0)*t/n)) for t in range(n+1)]
    pg(outer + list(reversed(inner)), fill=fill)

CX = W // 2   # 256

# ══════════════════════════════════════════════════════════════════════════════
#  Coordinate layout (from bottom up, painter's algorithm)
# ══════════════════════════════════════════════════════════════════════════════

# ── LOWER SNOWBALL (anchor = its centre = CY) ────────────────────────────────
LB_CX, LB_CY = CX, CY          # 256, 417
LB_RX, LB_RY = 86,  74

# ── HULL (below lower snowball) ───────────────────────────────────────────────
HRX  = 118    # deck half-rx
HRY  = 33     # deck half-ry  (isometric compression)
HHGT = 14     # hull side height
hull_deck_cy = LB_CY + LB_RY + 8   # 499 – top of deck oval

# ── SCARF ────────────────────────────────────────────────────────────────────
SC_CY = LB_CY - LB_RY - 14    # 329
SC_RX = 72
SC_RY = 22
SC_THK = 15

# ── MID SNOWBALL ──────────────────────────────────────────────────────────────
MB_CX, MB_CY = CX, SC_CY - SC_RY - 56 - 6   # 245
MB_RX, MB_RY = 66, 60

# ── HEAD ─────────────────────────────────────────────────────────────────────
HD_CX, HD_CY = CX, MB_CY - MB_RY - 40 - 4   # 141
HD_RX, HD_RY = 50, 44

# ── HAT ──────────────────────────────────────────────────────────────────────
HAT_CY = HD_CY - HD_RY + 8    # 105
HBX, HBY = 58, 18             # hat brim radii

# ── MAIN TURRET (on hat) ──────────────────────────────────────────────────────
HT_CX, HT_CY = CX + 4, HAT_CY - 55   # 50

# ══════════════════════════════════════════════════════════════════════════════
# Draw — back to front
# ══════════════════════════════════════════════════════════════════════════════

# ── 1. HULL ─────────────────────────────────────────────────────────────────
# Side face (3-D thickness, visible below deck oval)
side_pts = [
    (CX - HRX + 10, hull_deck_cy + HRY),
    (CX + HRX - 10, hull_deck_cy + HRY),
    (CX + HRX,      hull_deck_cy + HRY + HHGT),
    (CX - HRX,      hull_deck_cy + HRY + HHGT),
]
pg(side_pts, fill=HULL_SHD, outline=BLK, lw=2)

# Christmas stripe on hull side
stripe_n, sw = 8, (HRX * 2 - 20) / 8
for i in range(stripe_n):
    x0 = CX - HRX + 10 + i * sw
    x1 = x0 + sw
    col_top = RED_MID if i % 2 == 0 else GRN_MID
    col_bot = RED_DRK if i % 2 == 0 else GRN_DRK
    ym = hull_deck_cy + HRY + HHGT // 2
    pg([(x0, hull_deck_cy+HRY+1),(x1, hull_deck_cy+HRY+1),(x1,ym),(x0,ym)], fill=col_top)
    pg([(x0, ym),(x1, ym),(x1, hull_deck_cy+HRY+HHGT-1),(x0, hull_deck_cy+HRY+HHGT-1)], fill=col_bot)

# Port (left) side face for extra depth
port_pts = [
    (CX - HRX,     hull_deck_cy),
    (CX - HRX + 10, hull_deck_cy + HRY),
    (CX - HRX,      hull_deck_cy + HRY + HHGT),
    (CX - HRX - 8,  hull_deck_cy + HHGT//2),
]
pg(port_pts, fill=SNOW_DEP, outline=BLK, lw=2)

# Deck top face (isometric oval, lighter = lit from bow)
ell(CX, hull_deck_cy, HRX, HRY, fill=HULL_LIT, outline=BLK, lw=2)
# Deck highlight (bow half)
pg([(CX - HRX*0.6, hull_deck_cy - HRY*0.8),
    (CX + HRX*0.6, hull_deck_cy - HRY*0.8),
    (CX + HRX*0.4, hull_deck_cy + HRY*0.1),
    (CX - HRX*0.4, hull_deck_cy + HRY*0.1)], fill=SNOW_W)
# Deck shadow (stern half)
pg([(CX - HRX*0.5, hull_deck_cy + HRY*0.1),
    (CX + HRX*0.5, hull_deck_cy + HRY*0.1),
    (CX + HRX*0.45, hull_deck_cy + HRY*0.85),
    (CX - HRX*0.45, hull_deck_cy + HRY*0.85)], fill=HULL_MID)
ell(CX, hull_deck_cy, HRX, HRY, outline=BLK, lw=2)  # re-draw outline

# Bow nose accent
bow_pts = [(CX-12, hull_deck_cy - HRY + 2),
           (CX+12, hull_deck_cy - HRY + 2),
           (CX, hull_deck_cy - HRY - 12)]
pg(bow_pts, fill=HULL_LIT, outline=BLK, lw=1)

# ── 2. DECK GUNS ─────────────────────────────────────────────────────────────
def draw_turret(tx, ty, rx, ry, barrel_up=True):
    """Small deck gun turret (isometric top view)."""
    # Turret side (depth)
    pg([(tx-rx+2, ty+ry//2-1),(tx+rx-2, ty+ry//2-1),
        (tx+rx,   ty+ry//2+7),(tx-rx,   ty+ry//2+7)], fill=GUN_DRK)
    # Turret top face
    ell(tx, ty, rx, ry, fill=GUN_MID, outline=BLK, lw=1)
    ell(tx, ty, rx-5, ry-3, fill=GUN_LIT)
    ell(tx, ty-3, rx-2, ry//2, fill=GUN_LIT, outline=GUN_DRK, lw=1)
    # Barrels
    if barrel_up:
        for bx in [-4, 4]:
            rct(tx+bx-2, ty-rx, tx+bx+2, ty-ry, GUN_DRK, BLK)

# Fore turret (bow area, center)
draw_turret(CX, hull_deck_cy - HRY + 14, 22, 12, barrel_up=True)
# Twin rear turrets
draw_turret(CX - 44, hull_deck_cy + 2, 16, 9, barrel_up=False)
draw_turret(CX + 44, hull_deck_cy + 2, 16, 9, barrel_up=False)
# Side secondary turrets
for sx in [CX - HRX*0.6, CX + HRX*0.6]:
    sx = int(sx)
    draw_turret(sx, hull_deck_cy - 4, 14, 8, barrel_up=False)

# ── 3. LOWER SNOWBALL ────────────────────────────────────────────────────────
# Shadow
D.ellipse([LB_CX-LB_RX+6, LB_CY-LB_RY+8, LB_CX+LB_RX+6, LB_CY+LB_RY+8],
           fill=a(SNOW_SHD, 60))
# Right shadow face (3-D depth shading polygon)
pg([(LB_CX + LB_RX*0.25, LB_CY - LB_RY*0.95),
    (LB_CX + LB_RX,      LB_CY - 5),
    (LB_CX + LB_RX*0.95, LB_CY + LB_RY*0.68),
    (LB_CX + LB_RX*0.08, LB_CY + LB_RY)], fill=SNOW_LO)
# Main ball
ell(LB_CX, LB_CY, LB_RX, LB_RY, fill=SNOW_MID, outline=BLK, lw=2)
# Highlight
ell(LB_CX-28, LB_CY-26, 38, 30, fill=SNOW_W)
# Mid-tone transition
pg([(LB_CX-12, LB_CY+LB_RY*0.5),(LB_CX+LB_RX*0.5, LB_CY+5),
    (LB_CX+LB_RX*0.4, LB_CY-LB_RY*0.4),(LB_CX-4, LB_CY-LB_RY*0.52)], fill=SNOW_MID)
ell(LB_CX, LB_CY, LB_RX, LB_RY, outline=BLK, lw=2)
# Buttons
for btn_dy in [-10, 20, 48]:
    ell(LB_CX+5, LB_CY+btn_dy, 5, 5, fill=GUN_DRK, outline=BLK, lw=1)

# ── 4. SIDE ARMS (secondary gun mounts) ──────────────────────────────────────
for side in [-1, 1]:
    ax = LB_CX + side * (LB_RX - 8)
    ay = LB_CY + 4
    # Shoulder/arm bulge
    ell(ax, ay, 22, 14, fill=SNOW_LO, outline=BLK, lw=1)
    ell(ax + side*2, ay-2, 16, 10, fill=SNOW_MID)
    # Gun mount
    gx, gy = ax + side*22, ay - 4
    ell(gx, gy, 14, 9, fill=GUN_MID, outline=BLK, lw=1)
    ell(gx, gy, 9, 6, fill=GUN_LIT)
    ell(gx, gy-3, 12, 5, fill=GUN_LIT, outline=GUN_DRK, lw=1)
    # Twin barrels
    for bi in range(2):
        bgy = gy - 5 + bi * 6
        ln((gx + side*5, bgy), (gx + side*20, bgy), GUN_DRK, 2)
    # Snowball on arm tip
    sb_x, sb_y = ax + side*30, ay+5
    ell(sb_x, sb_y, 9, 9, fill=SNOW_MID, outline=SNOW_SHD, lw=1)
    ell(sb_x - side*3, sb_y-3, 4, 4, fill=SNOW_W)

# ── 5. SCARF ─────────────────────────────────────────────────────────────────
# Outer (red base) ring
ell(CX, SC_CY, SC_RX+SC_THK//2, SC_RY+SC_THK//2, fill=RED_MID, outline=BLK, lw=2)
# Green alternating arcs
for seg in range(4):
    ring_seg(CX, SC_CY,
             SC_RX+SC_THK//2, SC_RY+SC_THK//2,
             SC_RX-SC_THK//2, SC_RY-SC_THK//2,
             -180 + seg*90, -180 + seg*90 + 44, GRN_MID)
# Inner mask to hollow
ell(CX, SC_CY, SC_RX-SC_THK//2, SC_RY-SC_THK//2, fill=SNOW_MID)
ell(CX, SC_CY, SC_RX+SC_THK//2, SC_RY+SC_THK//2, outline=BLK, lw=2)
ell(CX, SC_CY, SC_RX-SC_THK//2, SC_RY-SC_THK//2, outline=BLK, lw=1)

# Drape front flap
drape_top = SC_CY + SC_RY + SC_THK//2 - 2
pg([(CX-20, drape_top),(CX+16, drape_top),
    (CX+22, drape_top+36),(CX-14, drape_top+42)], fill=RED_MID, outline=BLK, lw=1)
pg([(CX-4,  drape_top+2),(CX+16, drape_top+2),
    (CX+18, drape_top+16),(CX-2, drape_top+16)], fill=GRN_MID)
pg([(CX-14, drape_top+22),(CX+18, drape_top+22),
    (CX+20, drape_top+38),(CX-12, drape_top+40)], fill=GRN_MID)

# ── 6. MID SNOWBALL ──────────────────────────────────────────────────────────
D.ellipse([MB_CX-MB_RX+5, MB_CY-MB_RY+7, MB_CX+MB_RX+5, MB_CY+MB_RY+7],
           fill=a(SNOW_SHD, 55))
pg([(MB_CX+MB_RX*0.28, MB_CY-MB_RY*0.94),(MB_CX+MB_RX, MB_CY),
    (MB_CX+MB_RX*0.90, MB_CY+MB_RY*0.64),(MB_CX+MB_RX*0.1, MB_CY+MB_RY)], fill=SNOW_LO)
ell(MB_CX, MB_CY, MB_RX, MB_RY, fill=SNOW_MID, outline=BLK, lw=2)
ell(MB_CX-22, MB_CY-22, 28, 22, fill=SNOW_W)
pg([(MB_CX-10, MB_CY+MB_RY*0.5),(MB_CX+MB_RX*0.5, MB_CY+4),
    (MB_CX+MB_RX*0.4, MB_CY-MB_RY*0.4),(MB_CX-4, MB_CY-MB_RY*0.5)], fill=SNOW_MID)
ell(MB_CX, MB_CY, MB_RX, MB_RY, outline=BLK, lw=2)

# ── 7. HEAD ──────────────────────────────────────────────────────────────────
D.ellipse([HD_CX-HD_RX+4, HD_CY-HD_RY+5, HD_CX+HD_RX+4, HD_CY+HD_RY+5],
           fill=a(SNOW_SHD, 52))
pg([(HD_CX+HD_RX*0.26, HD_CY-HD_RY*0.92),(HD_CX+HD_RX, HD_CY+2),
    (HD_CX+HD_RX*0.86, HD_CY+HD_RY*0.60),(HD_CX+HD_RX*0.08, HD_CY+HD_RY)], fill=SNOW_LO)
ell(HD_CX, HD_CY, HD_RX, HD_RY, fill=SNOW_MID, outline=BLK, lw=2)
ell(HD_CX-18, HD_CY-18, 22, 18, fill=SNOW_W)
pg([(HD_CX-8, HD_CY+HD_RY*0.5),(HD_CX+HD_RX*0.5, HD_CY+4),
    (HD_CX+HD_RX*0.4, HD_CY-HD_RY*0.4),(HD_CX-2, HD_CY-HD_RY*0.48)], fill=SNOW_MID)
ell(HD_CX, HD_CY, HD_RX, HD_RY, outline=BLK, lw=2)

# Face — eyes (round black circles with glint)
for ex in [HD_CX-15, HD_CX+13]:
    ey = HD_CY - 8
    ell(ex, ey, 7, 7, fill=BLK)
    ell(ex-3, ey-3, 2, 2, fill=SNOW_W)  # highlight glint

# Face — carrot nose (horizontal cone pointing to viewer's right)
nose_tip  = (HD_CX + 34, HD_CY + 2)
nose_bt   = (HD_CX + 3, HD_CY - 6)
nose_bb   = (HD_CX + 3, HD_CY + 9)
pg([nose_tip, nose_bt, nose_bb], fill=ORANGE, outline=ORN_DRK, lw=1)
ln((HD_CX+8, HD_CY-2), (HD_CX+28, HD_CY+1), ORN_DRK, 1)

# Face — curved smile (arc of small ellipses)
for si,(sx,sy) in enumerate([(-14,10),(-6,15),(4,16),(14,14),(22,10)]):
    ell(HD_CX+sx, HD_CY+sy, 3, 3, fill=GUN_DRK)

# ── 8. HAT ───────────────────────────────────────────────────────────────────
# Hat dome — draw using many horizontal ellipse slices (looks rounded/puffy)
DOME_TOP_Y = HAT_CY - 62
DOME_SLICES = 16
for si in range(DOME_SLICES + 1):
    t = si / DOME_SLICES   # 0 = brim, 1 = apex
    # Ellipse of the dome cross-section at height t
    slice_y = HAT_CY - t * (HAT_CY - DOME_TOP_Y)
    # Dome profile: rounded — use cosine for width
    dome_rx = int(HBX * math.cos(t * math.pi / 2) * 0.95)
    if dome_rx < 2: dome_rx = 2
    # Color: left half lit (GRN_MID→GRN_BRI), right half dark
    # Simple: alternate by height for knit texture
    col = GRN_MID if (si % 3 != 2) else GRN_DRK
    D.ellipse([HD_CX - dome_rx, slice_y - 4,
               HD_CX + dome_rx, slice_y + 4], fill=a(col))

# Dome left-face highlight
n_hi = 12
for si in range(n_hi):
    t = si / n_hi
    slice_y = HAT_CY - t * (HAT_CY - DOME_TOP_Y)
    dome_rx = int(HBX * math.cos(t * math.pi / 2) * 0.95)
    hi_rx = max(1, dome_rx // 2)
    col_alpha = int(180 * (1.0 - t))
    D.ellipse([HD_CX - dome_rx, slice_y - 3,
               HD_CX - dome_rx + hi_rx*2, slice_y + 3],
              fill=(*GRN_BRI, col_alpha))

# Dome outline
n_out = 30
dome_pts = []
for si in range(n_out + 1):
    t = si / n_out
    slice_y = HAT_CY - t * (HAT_CY - DOME_TOP_Y)
    dome_rx = int(HBX * math.cos(t * math.pi / 2) * 0.95)
    dome_pts.append((HD_CX - dome_rx, slice_y))
for si in range(n_out, -1, -1):
    t = si / n_out
    slice_y = HAT_CY - t * (HAT_CY - DOME_TOP_Y)
    dome_rx = int(HBX * math.cos(t * math.pi / 2) * 0.95)
    dome_pts.append((HD_CX + dome_rx, slice_y))
pg(dome_pts, outline=BLK, lw=2)

# Brim top (draws over dome base at brim level)
ell(HD_CX, HAT_CY, HBX, HBY, fill=GRN_DRK, outline=BLK, lw=2)
ell(HD_CX, HAT_CY, HBX-6, HBY-5, fill=GRN_MID)
# Brim side face (3-D depth)
pg([(HD_CX-HBX, HAT_CY),(HD_CX+HBX, HAT_CY),
    (HD_CX+HBX, HAT_CY+9),(HD_CX-HBX, HAT_CY+9)], fill=GRN_DST, outline=BLK, lw=1)
ell(HD_CX, HAT_CY, HBX, HBY, outline=BLK, lw=2)  # re-draw brim on top
# Pom-pom
ell(HD_CX-4, DOME_TOP_Y-2, 10, 10, fill=SNOW_W, outline=BLK, lw=1)
ell(HD_CX-7, DOME_TOP_Y-5, 4, 4, fill=SNOW_W)

# ── 9. HAT TURRET ────────────────────────────────────────────────────────────
# Turret barrel mantlet (back piece drawn first)
pg([(HT_CX-28, HT_CY),(HT_CX+28, HT_CY),
    (HT_CX+26, HT_CY+14),(HT_CX-26, HT_CY+14)], fill=GUN_DRK, outline=BLK, lw=1)
# Turret top face (iso ellipse)
ell(HT_CX, HT_CY, 28, 16, fill=GUN_MID, outline=BLK, lw=2)
ell(HT_CX, HT_CY, 20, 11, fill=GUN_LIT)
# Commander cupola
ell(HT_CX+6, HT_CY-4, 10, 6, fill=GUN_DRK, outline=BLK, lw=1)
ell(HT_CX+6, HT_CY-6, 8, 4, fill=GUN_MID)
# Twin barrels (point toward bow = sprite top)
for bx_off in [-6, 6]:
    bx = HT_CX + bx_off
    rct(bx-3, HT_CY-34, bx+3, HT_CY-12, GUN_DRK, BLK)   # barrel
    rct(bx-4, HT_CY-38, bx+4, HT_CY-32, GUN_MID, BLK)   # muzzle brake
# Antenna
ln((HT_CX+22, HT_CY-2),(HT_CX+27, HT_CY-48), GUN_DRK, 2)
ell(HT_CX+27, HT_CY-48, 4, 4, fill=GUN_DRK, outline=BLK, lw=1)
# Signal flag
pg([(HT_CX+27, HT_CY-48),(HT_CX+27, HT_CY-38),(HT_CX+38, HT_CY-44)],
   fill=RED_MID, outline=RED_DRK, lw=1)

# ── 10. OUTLINE RE-PASS ───────────────────────────────────────────────────────
ell(CX,    hull_deck_cy, HRX, HRY,    outline=BLK, lw=2)
ell(LB_CX, LB_CY,  LB_RX, LB_RY,    outline=BLK, lw=2)
ell(MB_CX, MB_CY,  MB_RX, MB_RY,     outline=BLK, lw=2)
ell(HD_CX, HD_CY,  HD_RX, HD_RY,     outline=BLK, lw=2)
ell(HD_CX, HAT_CY, HBX,   HBY,       outline=BLK, lw=2)

# ── Save ─────────────────────────────────────────────────────────────────────
OUT = r"c:\Users\minemura\projects\battleship_operation\src\assets\ships\snowmura-snowman-sprite.png"
img.save(OUT, "PNG")
print(f"Saved {W}×{H} → {OUT}")
