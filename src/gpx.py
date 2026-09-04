# /// script
# dependencies = ["requests"]
# ///
import requests, math, json, datetime
from xml.sax.saxutils import escape
H={"User-Agent":"gr52-dossier/1.0 dev@yarden-zamir.com"}
STAGES=[(18307045,"Saint-Dalmas-Valdeblore - Col de Salese"),(18872944,"Col de Salese - Pas des Ladres"),
        (18307046,"Pas des Ladres - Massif de l'Authion"),(18307047,"Massif de l'Authion - Menton")]
def fetch(rid):
    q=f"[out:json][timeout:120];relation({rid});out body;way(r);out geom;"
    import time
    for attempt in range(6):
        r=requests.post("https://overpass-api.de/api/interpreter",data={"data":q},headers=H,timeout=180)
        if r.status_code==429 or r.status_code==504: time.sleep(15*(attempt+1)); continue
        r.raise_for_status(); break
    else: raise SystemExit("overpass keeps rate limiting")
    time.sleep(5)
    d=r.json(); rel=[e for e in d["elements"] if e["type"]=="relation"][0]
    ways={e["id"]:[(p["lat"],p["lon"]) for p in e["geometry"]] for e in d["elements"] if e["type"]=="way"}
    order=[m["ref"] for m in rel["members"] if m["type"]=="way" and m["ref"] in ways and m.get("role","") in ("","forward","backward")]
    return rel["tags"].get("name"),[ways[i] for i in order]
def dist(a,b): return math.hypot(a[0]-b[0],(a[1]-b[1])*0.72)
def chain(ways,start):
    """Greedy chain: pick the unused way whose an endpoint is closest to the current end; orient it."""
    left=list(ways); out=[]; cur=start
    while left:
        best=min(((dist(cur,w[0]),False,w),(dist(cur,w[-1]),True,w)) for w in left)
        # min over tuples: compare first element
        d,rev,w=min([(dist(cur,w[0]),False,w) for w in left]+[(dist(cur,w[-1]),True,w) for w in left],key=lambda t:t[0])
        left.remove(w); pts=list(reversed(w)) if rev else list(w)
        if d>0.01: out.append(None)  # gap > ~1 km: new segment
        out.append(pts); cur=pts[-1]
    return out
START=(44.0683,7.2007)  # Saint-Dalmas-Valdeblore
segs=[]; cur=START; total=0.0
for rid,label in STAGES:
    name,ways=fetch(rid); print(rid,name,len(ways),"ways")
    parts=chain(ways,cur)
    trk=[]; seg=[]
    for p in parts:
        if p is None:
            if seg: trk.append(seg); seg=[]
            continue
        seg+=p
    if seg: trk.append(seg)
    cur=trk[-1][-1]; segs.append((name or label,trk))
    for s in trk:
        for a,b in zip(s,s[1:]): total+=math.hypot((a[0]-b[0])*111.2,(a[1]-b[1])*111.2*math.cos(math.radians(a[0])))
print("track km ≈ %.1f"%total, "end", cur)
WPTS=[
 ("Saint-Dalmas-Valdeblore - HI hostel Le Chalet (booked 11 Sep)",44.0683,7.2007,"Lodging"),
 ("N1 Lac Petit - bivouac (outside park core)",44.1130,7.1891,"Campsite"),
 ("Col du Barn 2452 m - park boundary",44.1171,7.2010,"Summit"),
 ("Le Boreon - last meal before Sospel",44.1126,7.2944,"Restaurant"),
 ("Refuge de la Cougourde 2100 m - open to 19 Sep",44.1263,7.3308,"Lodging"),
 ("N2 Lac de Trecolpas - bivouac",44.1158,7.3404,"Campsite"),
 ("Madone de Fenestre 1903 m - refuge, water, no camping",44.0958,7.3564,"Lodging"),
 ("Lac de Fenestre - fallback bivouac",44.1105,7.3624,"Campsite"),
 ("Pas du Mont Colomb 2548 m - rock step T3",44.1012,7.3858,"Summit"),
 ("N3 Refuge de Nice / Lac de la Fous - bivouac",44.0890,7.3940,"Campsite"),
 ("Baisse du Basto 2693 m - high point",44.0967,7.4276,"Summit"),
 ("N4 Refuge des Merveilles - bivouac area behind refuge ONLY",44.0574,7.4518,"Campsite"),
 ("Pas du Diable 2436 m - last water for 6 h",44.0475,7.4308,"Summit"),
 ("Baisse de Saint-Veran 1836 m - fort",44.0168,7.4219,"Summit"),
 ("N5 Camp d'Argent - L'Estive gite, open to 1 Oct",43.9890,7.4012,"Lodging"),
 ("N6 Sospel - camping Sainte-Madeleine, shops, station",43.8780,7.4490,"Campsite"),
 ("Col du Berceau 1090 m - steep loose descent",43.8150,7.5130,"Summit"),
 ("Menton - finish",43.7750,7.5000,"Flag"),
]
now=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
x=['<?xml version="1.0" encoding="UTF-8"?>',
   '<gpx version="1.1" creator="gr52-dossier" xmlns="http://www.topografix.com/GPX/1/1" xmlns:osmand="https://osmand.net">',
   f'<metadata><name>GR52 Saint-Dalmas-Valdeblore to Menton</name><desc>Route geometry from OpenStreetMap relation 3315112 (Traversee du Mercantour), stages in walking order, exported {now}. Map data (c) OpenStreetMap contributors, ODbL.</desc><time>{now}</time></metadata>']
for n,la,lo,typ in WPTS:
    x.append(f'<wpt lat="{la:.5f}" lon="{lo:.5f}"><name>{escape(n)}</name><type>{typ}</type></wpt>')
for name,trk in segs:
    x.append(f'<trk><name>GR52 {escape(name)}</name>')
    for s in trk:
        x.append('<trkseg>'+''.join(f'<trkpt lat="{a:.6f}" lon="{b:.6f}"/>' for a,b in s)+'</trkseg>')
    x.append('</trk>')
x.append('</gpx>')
open("GR52_Saint-Dalmas_Menton.gpx","w").write("\n".join(x))
print("segments per stage:",[len(t) for _,t in segs])
