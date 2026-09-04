# /// script
# requires-python = ">=3.11"
# ///
"""Assemble site/index.html from src/head.html, src/body.html and src/scripts.html."""
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

page = (
    SHELL_HEAD
    + (SRC / "head.html").read_text()
    + "</head>\n<body>\n"
    + (SRC / "body.html").read_text()
    + "\n"
    + (SRC / "scripts.html").read_text()
    + "</body>\n</html>\n"
)
OUT.write_text(page)
print(f"wrote {OUT.relative_to(ROOT)}: {len(page) // 1024} KB")
