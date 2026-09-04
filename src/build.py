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
    return re.sub(r"<table>.*?</table>", one, html, flags=re.S)


body = label_tables((SRC / "body.html").read_text())
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
