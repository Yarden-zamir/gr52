# /// script
# requires-python = ">=3.11"
# dependencies = ["requests"]
# ///
"""Add <ele> to every track point in site/GR52_all-in-one.gpx using OpenTopoData (EU-DEM 25 m).

Skips the park boundary track. Respects the public API limits: 100 points per call, 1 call per second.
"""
import sys, time, xml.etree.ElementTree as ET
from pathlib import Path
import requests

NS = "http://www.topografix.com/GPX/1/1"
ET.register_namespace("", NS)
ET.register_namespace("osmand", "https://osmand.net")
ns = {"g": NS}
path = Path(__file__).resolve().parent.parent / "site" / "GR52_all-in-one.gpx"
tree = ET.parse(path)
pts = []
for trk in tree.getroot().findall("g:trk", ns):
    if trk.findtext("g:name", namespaces=ns).startswith("PARK"):
        continue
    for p in trk.iter(f"{{{NS}}}trkpt"):
        if p.find("g:ele", ns) is None:
            pts.append(p)
print(f"{len(pts)} points without elevation", file=sys.stderr)
session = requests.Session()
for i in range(0, len(pts), 100):
    batch = pts[i : i + 100]
    locs = "|".join(f"{p.get('lat')},{p.get('lon')}" for p in batch)
    for attempt in range(5):
        r = session.get("https://api.opentopodata.org/v1/eudem25m", params={"locations": locs}, timeout=60)
        if r.status_code == 429:
            time.sleep(5)
            continue
        r.raise_for_status()
        break
    else:
        sys.exit("rate limited")
    for p, res in zip(batch, r.json()["results"]):
        e = res["elevation"]
        if e is not None:
            ele = ET.SubElement(p, f"{{{NS}}}ele")
            ele.text = f"{e:.0f}"
    print(f"{i + len(batch)}/{len(pts)}", file=sys.stderr)
    time.sleep(1.05)
tree.write(path, encoding="UTF-8", xml_declaration=True)
print("done", file=sys.stderr)
