#!/usr/bin/env python3
"""Generate crawlable Newsy archives and sitemap entries from articles.json."""
import html
import json
import re
from pathlib import Path
from datetime import date
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NEWS = ROOT / "newsy"
BASE = "https://zapytajhanki.com"
SIZE = 10
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
def esc(value):
    return html.escape(str(value), quote=True)
def url(page):
    return "/newsy/" if page == 1 else f"/newsy/strona/{page}/"
def cards(articles):
    out = []
    for a in articles:
        image = f'<img class="news-card-image" src="{esc(a["image"])}" alt="{esc(a.get("alt", ""))}" loading="lazy">' if a.get("image") else ""
        out.append(f'<article class="news-card"><a class="news-card-link" href="/newsy/{esc(a["slug"])}/">{image}<div class="news-card-date"><time datetime="{esc(a["date"])}">{esc(a["date"])}</time></div><h3>{esc(a["title"])}</h3><p>{esc(a.get("summary", ""))}</p><span class="news-read">Czytaj więcej →</span></a></article>')
    return "".join(out)
def main():
    data = json.loads((NEWS / "articles.json").read_text(encoding="utf-8"))
    articles = data["articles"]
    if not isinstance(articles, list):
        raise ValueError("articles must be an array")
    seen = set()
    for a in articles:
        slug = a["slug"]
        if not SLUG.fullmatch(slug) or slug in seen or slug in {"podglad", "_template", "strona"}:
            raise ValueError(f"Invalid/duplicate slug: {slug}")
        seen.add(slug)
        date.fromisoformat(a["date"])
        if not a["title"].strip():
            raise ValueError("Empty title")
        if a.get("image") and (not a["image"].startswith("/") or a["image"].startswith("//") or any(x in a["image"] for x in "?#\\\"")):
            raise ValueError("Invalid image")
        if not (NEWS / slug / "index.html").is_file():
            raise ValueError(f"Article page missing: {slug}")
    articles.sort(key=lambda a: (a["date"], a["slug"]), reverse=True)
    pages = max(1, (len(articles) + SIZE - 1) // SIZE)
    home = NEWS / "index.html"
    template = home.read_text(encoding="utf-8")
    # Preserve the approved hero, intro, and footer byte-for-byte.
    start = template.index('<div class="news-stream"')
    end = template.index('</div></section></main>', start)
    # Main page: crawlable first ten cards, progressive enhancement still handled by feed.js.
    first = cards(articles[:SIZE])
    replacement = f'<div class="news-stream" aria-label="Najnowsze wiadomości">{first}</div><p class="news-empty" id="news-status" role="status">{"Pierwsze wiadomości już wkrótce." if not articles else ""}</p><button type="button" class="news-more" id="news-more" hidden>Załaduj starsze wiadomości</button>'
    if pages > 1:
        replacement += f'<nav aria-label="Archiwum newsów"><a href="{url(2)}">Starsze wiadomości →</a></nav>'
    home.write_text(template[:start] + replacement + template[end:], encoding="utf-8")
    archive_root = NEWS / "strona"
    archive_root.mkdir(exist_ok=True)
    for old in archive_root.glob("*/index.html"):
        if old.parent.name.isdigit():
            old.unlink()
            old.parent.rmdir()
    for page in range(2, pages + 1):
        page_url = url(page)
        prev = url(page - 1)
        nxt = url(page + 1) if page < pages else None
        nav = f'<nav aria-label="Strony archiwum"><a href="{prev}">← Nowsze wiadomości</a>'
        if nxt:
            nav += f' <a href="{nxt}">Starsze wiadomości →</a>'
        nav += '</nav>'
        content = cards(articles[(page-1)*SIZE:page*SIZE]) + nav
        output = template.replace('<link rel="canonical" href="https://zapytajhanki.com/newsy/">', f'<link rel="canonical" href="{BASE}{page_url}">').replace('<title>Newsy z Ameryki | Zapytaj Hanki</title>', f'<title>Newsy z Ameryki — strona {page} | Zapytaj Hanki</title>')
        s = output.index('<div class="news-stream"')
        e = output.index('</div></section></main>', s)
        output = output[:s] + f'<div class="news-stream" aria-label="Archiwum newsów">{content}</div>' + output[e:]
        output = output.replace('<script src="/newsy/feed.js?v=20261013-publishing-feed" defer></script>', '')
        target = archive_root / str(page)
        target.mkdir(parents=True, exist_ok=True)
        (target / "index.html").write_text(output, encoding="utf-8")
    sitemap = ROOT / "sitemap.xml"
    xml = sitemap.read_text(encoding="utf-8")
    xml = re.sub(r'  <url><loc>https://zapytajhanki.com/newsy/(?:strona/\\d+/|[a-z0-9-]+/)?</loc></url>\\n', '', xml)
    entries = [BASE + url(i) for i in range(1, pages+1)] + [BASE + "/newsy/" + a["slug"] + "/" for a in articles]
    xml = xml.replace('</urlset>', ''.join(f'  <url><loc>{esc(link)}</loc></url>\\n' for link in entries) + '</urlset>')
    ET.fromstring(xml)
    sitemap.write_text(xml, encoding="utf-8")
    print(f"Generated {pages} archive page(s), {len(articles)} articles")
if __name__ == "__main__":
    main()
