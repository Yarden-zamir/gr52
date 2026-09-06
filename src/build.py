# /// script
# requires-python = ">=3.11"
# ///
"""Assemble site/index.html from src/head.html, src/body.html and src/scripts.html."""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
OUT = ROOT / "site" / "index.html"

SHELL_HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Seven-day bivouac plan for the GR52 from Saint-Dalmas-Valdeblore to Menton, 12 to 18 September 2026: interactive map, park rules, water, refuges, technical options, transport. English and Hebrew.">
<meta name="color-scheme" content="light dark">
<style>body{margin:0;font-size:14px;font-family:system-ui,sans-serif}img{max-width:100%;height:auto}[hidden]{display:none!important}</style>
"""



def label_tables(html: str) -> str:
    """Add data-label="<header>" to every td so tables can stack as cards on phones."""
    def one(table: re.Match) -> str:
        t = table.group(0)
        rows = re.findall(r"<tr>.*?</tr>", t, flags=re.S)
        heads = [re.sub(r"<[^>]+>", "", h).strip() for h in re.findall(r"<th>(.*?)</th>", rows[0], flags=re.S)]
        out = t
        for row in rows[1:]:
            i = [0]
            def td(_m: re.Match) -> str:
                lab = heads[i[0]] if i[0] < len(heads) else ""
                i[0] += 1
                attrs = _m.group(1)
                return f'<td data-label="{lab}"{attrs}>'
            new = re.sub(r"<td([^>]*)>", td, row)
            out = out.replace(row, new, 1)
        return out
    html = re.sub(r"<table>.*?</table>", one, html, flags=re.S)

    def mark_long(_m: re.Match) -> str:
        """Wrap the cell in one span so the phone card grid has exactly label + value; flag long cells."""
        text = re.sub(r"<[^>]+>", "", _m.group(2))
        long_attr = " data-long" if len(text) > 48 else ""
        return f"<td{_m.group(1)}{long_attr}><span>{_m.group(2)}</span></td>"

    return re.sub(r"<td([^>]*)>(.*?)</td>", mark_long, html, flags=re.S)


# Place names that get a map link. Term -> waypoint or track query (accent-insensitive substring).
PLACES = {
    "Saint-Dalmas-Valdeblore": "NIGHT 0", "Saint-Dalmas": "NIGHT 0", "La Colmiane": "VIA FERRATA start",
    "Lac Petit": "Lac Petit", "Col du Barn": "Col du Barn", "Le Boréon": "NIGHT 1", "Refuge de la Cougourde": "REFUGE · Cougourde",
    "Lac de Trécolpas": "Trécolpas", "Trécolpas": "Trécolpas", "Pas des Ladres": "ROUTE 2 of 4",
    "Madone de Fenestre": "NIGHT 2 ·", "Lac de Fenestre": "NIGHT 2 option B", "Pas du Mont Colomb": "PASS · Pas du Mont Colomb",
    "Refuge de Nice": "NIGHT 3", "Lac de la Fous": "NIGHT 3", "Baisse du Basto": "Baisse du Basto",
    "Refuge des Merveilles": "NIGHT 4", "Vallée des Merveilles": "NIGHT 4", "Pas du Diable": "PASS · Pas du Diable",
    "Baisse de Saint-Véran": "Baisse de Saint-Veran", "Camp d'Argent": "NIGHT 5", "Col de Turini": "ESCAPE · Col de Turini",
    "Sospel": "NIGHT 6", "Col du Berceau": "Col du Berceau", "Menton": "FINISH",
    "Mont Bégo": "Mont Bégo", "Cime du Diable": "Cime du Diable", "Mont Colomb": "Mont Colomb", "Cime du Gélas": "Gélas",
    "Baus de la Frema": "VIA FERRATA start", "Salèse valley": "ROUTE 1 of 4", "עמק Salèse": "ROUTE 1 of 4", "Authion ridge": "ROUTE 3 of 4",
}
_TERM_RE = re.compile("|".join(re.escape(t) for t in sorted(PLACES, key=len, reverse=True)))
_TAG_RE = re.compile(r"<[^>]+>")


def link_places(html: str) -> str:
    """Wrap place names in map links, in text only, never inside <a>, headings, <button>, <title> or <summary>."""
    out, pos, skip = [], 0, 0
    for m in _TAG_RE.finditer(html):
        text = html[pos : m.start()]
        if skip == 0:
            text = _TERM_RE.sub(lambda t: f'<a href="#map" class="focus" data-focus="{PLACES[t.group(0)]}">{t.group(0)}</a>', text)
        out.append(text)
        tag = m.group(0)
        low = tag.lower()
        if low.startswith(("<a ", "<a>", "<h1", "<button", "<title", "<summary", "<h2", "<h3")):
            skip += 1
        elif low.startswith(("</a>", "</h1>", "</button>", "</title>", "</summary>", "</h2>", "</h3>")):
            skip = max(0, skip - 1)
        out.append(tag)
        pos = m.end()
    out.append(html[pos:])
    return "".join(out)


body = link_places(label_tables((SRC / "body.html").read_text()))
page = SHELL_HEAD + (SRC / "head.html").read_text() + "</head>\n<body>\n" + body + "\n" + (SRC / "scripts.html").read_text() + "</body>\n</html>\n"
OUT.write_text(page)
files = sorted(p for p in (ROOT / "site").rglob("*") if p.is_file() and p.name != "sw.js")
digest = hashlib.sha256()
for p in files:
    digest.update(p.relative_to(ROOT).as_posix().encode())
    digest.update(p.read_bytes())
build_id = digest.hexdigest()[:12]
(ROOT / "site" / "sw.js").write_text((SRC / "sw.js").read_text().replace("__BUILD__", build_id))
print(f"wrote {OUT.relative_to(ROOT)}: {len(page) // 1024} KB, sw build {build_id}")
