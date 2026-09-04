# /// script
# requires-python = ">=3.11"
# dependencies = ["requests", "pillow"]
# ///
import base64, io, json, math, os, sys, time
import requests
from PIL import Image, ImageDraw, ImageFont

UA = {"User-Agent": "gr52-trip-dossier/1.0 (personal hiking plan; contact dev@yarden-zamir.com)"}
S = requests.Session(); S.headers.update(UA)

# 1. GR52 geometry from OSM via Overpass
q = """
[out:json][timeout:90];
relation(3315112);
(._;>>;);
out geom;
"""
r = S.post("https://overpass-api.de/api/interpreter", data={"data": q}, timeout=120)
r.raise_for_status()
data = r.json()
ways = [e for e in data["elements"] if e["type"] == "way" and "geometry" in e]
rels = [e for e in data["elements"] if e["type"] == "relation"]
print("relations:", [(e["id"], e.get("tags", {}).get("name")) for e in rels])
print("ways:", len(ways))
lines = [[(p["lat"], p["lon"]) for p in w["geometry"]] for w in ways]
json.dump(lines, open("gr52_lines.json", "w"))

# 2. tile maths
def deg2num(lat, lon, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y

cache = {}
def tile(z, x, y):
    k = (z, x, y)
    if k in cache: return cache[k]
    fn = f"tiles/{z}_{x}_{y}.png"
    os.makedirs("tiles", exist_ok=True)
    if not os.path.exists(fn):
        for sub in "abc":
            rr = S.get(f"https://{sub}.tile.opentopomap.org/{z}/{x}/{y}.png", timeout=30)
            if rr.ok: open(fn, "wb").write(rr.content); break
            time.sleep(1)
        else:
            raise SystemExit(f"tile fail {k}")
        time.sleep(0.2)
    im = Image.open(fn).convert("RGB"); cache[k] = im; return im

font_path = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
def font(sz):
    try: return ImageFont.truetype(font_path, sz)
    except Exception: return ImageFont.load_default()

nights = [
    ("N1 Le Boréon", 44.1126, 7.2944),
    ("N2 Madone / Lac de Fenestre", 44.0958, 7.3564),
    ("N3 Refuge de Nice", 44.089, 7.394),
    ("N4 Merveilles", 44.0574, 7.4518),
    ("N5 Camp d'Argent", 43.989, 7.4012),
    ("N6 Sospel", 43.878, 7.449),
]
places = [
    ("Saint-Dalmas-Valdeblore", 44.0683, 7.2007),
    ("Col du Barn", 44.1171, 7.2010),
    ("Lac Petit (fallback)", 44.113, 7.189),
    ("Trécolpas", 44.1158, 7.3404),
        ("Refuge de la Cougourde", 44.1263, 7.3308),
        ("Pas du Mont Colomb", 44.1012, 7.3858),
    ("Baisse du Basto", 44.0967, 7.4276),
    ("Pas du Diable", 44.0475, 7.4308),
    ("Baisse de St-Véran", 44.0168, 7.4219),
    ("Col du Berceau", 43.8150, 7.5130),
    ("Menton", 43.775, 7.500),
]

def snap(la, lo):
    best=None
    for ln in lines:
        for a,b in ln:
            d=(a-la)**2+((b-lo)*0.72)**2
            if best is None or d<best[0]: best=(d,a,b)
    return best[1],best[2]
nights=[(n,)+snap(a,b) for n,a,b in nights]
places=[(n,)+snap(a,b) for n,a,b in places]

def render(name, lat0, lat1, lon0, lon1, z, title):
    x0, y1 = deg2num(lat0, lon0, z); x1, y0 = deg2num(lat1, lon1, z)
    tx0, tx1, ty0, ty1 = int(x0), int(x1), int(y0), int(y1)
    W, H = (tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256
    im = Image.new("RGB", (W, H))
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            im.paste(tile(z, tx, ty), ((tx - tx0) * 256, (ty - ty0) * 256))
    def px(lat, lon):
        x, y = deg2num(lat, lon, z); return ((x - tx0) * 256, (y - ty0) * 256)
    d = ImageDraw.Draw(im)
    for ln in lines:
        pts = [px(a, b) for a, b in ln]
        if len(pts) > 1:
            d.line(pts, fill=(255, 255, 255), width=7); d.line(pts, fill=(200, 50, 43), width=4)
    f = font(20 if z >= 13 else 15); fs = font(15 if z >= 13 else 12)
    for nm, la, lo in places:
        x, y = px(la, lo)
        if 0 <= x < W and 0 <= y < H:
            d.ellipse([x-5, y-5, x+5, y+5], fill=(44, 106, 138), outline="white", width=2)
            d.text((x+9, y-9), nm, font=fs, fill=(30, 39, 38), stroke_width=3, stroke_fill="white")
    for nm, la, lo in nights:
        x, y = px(la, lo)
        if 0 <= x < W and 0 <= y < H:
            d.ellipse([x-9, y-9, x+9, y+9], fill=(200, 50, 43), outline="white", width=3)
            d.text((x+13, y-12), nm, font=f, fill=(140, 20, 15), stroke_width=3, stroke_fill="white")
    # crop to requested bbox
    cx0, cy1 = px(lat0, lon0); cx1, cy0 = px(lat1, lon1)
    im = im.crop((int(cx0), int(cy0), int(cx1), int(cy1)))
    d = ImageDraw.Draw(im)
    d.rectangle([0, im.height-24, im.width, im.height], fill=(255, 255, 255))
    d.text((6, im.height-20), f"{title}  ·  map data © OpenStreetMap contributors, SRTM  ·  style © OpenTopoMap (CC-BY-SA)", font=font(13), fill=(60, 60, 60))
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=78, optimize=True)
    b = buf.getvalue(); print(name, im.size, len(b)//1024, "KB")
    return "data:image/jpeg;base64," + base64.b64encode(b).decode()

out = {}
out["overview"] = render("overview", 43.76, 44.17, 7.15, 7.56, 11, "GR52 overview, Saint-Dalmas-Valdeblore to Menton")
out["north"]    = render("north", 44.06, 44.16, 7.17, 7.40, 13, "Days 1–3: Saint-Dalmas, Boréon, Madone de Fenestre, Refuge de Nice")
out["merv"]     = render("merv", 44.00, 44.11, 7.34, 7.48, 13, "Days 3–5: Refuge de Nice, Baisse du Basto, Merveilles, Pas du Diable")
out["authion"]  = render("authion", 43.86, 44.03, 7.36, 7.49, 13, "Days 5–6: Authion ridge, Camp d'Argent, Sospel")
out["menton"]   = render("menton", 43.76, 43.89, 7.42, 7.54, 13, "Day 7: Sospel, Col du Berceau, Menton")
json.dump(out, open("maps.json", "w"))
