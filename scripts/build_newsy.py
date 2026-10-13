#!/usr/bin/env python3
"""Build static, crawlable Newsy archives without altering approved styling."""
import html
import json
import re
from datetime import date
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NEWS = ROOT / "newsy"
BASE = "https://zapytajhanki.com"
PAGE_SIZE = 10
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
STREAM = re.compile(r'<div class="news-stream"[^>]*>.*?</div><p class="news-empty" id="news-status" role="status">.*?</p><button type="button" class="news-more" id="news-more" hidden>.*?</button>(?:<nav aria-label="Archiwum newsów">.*?</nav>)?', re.S)
SITEMAP_NEWS = re.compile(r'\s*<url>\s*<loc>https://zapytajhanki\.com/newsy/(?:strona/[0-9]+/|[a-z0-9-]+/)?</loc>\s*</url>')

def escape(value):
    return html.escape(str(value), quote=True)

def path(page):
    return "/newsy/" if page == 1 else f"/newsy/strona/{page}/"

def polish_date(value):
    year, month, day = map(int, value.split("-"))
    months = ("stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia")
    return f"{day} {months[month - 1]} {year}"

def cards(items):
    output = []
    for item in items:
        image = ('<img class="news-card-image" src="' + escape(item["image"]) + '" alt="' + escape(item.get("alt", "")) + '" loading="lazy">') if item.get("image") else ""
        summary = '<p>' + escape(item["summary"]) + '</p>' if item.get("summary") else ""
        output.append('<article class="news-card"><a class="news-card-link" href="/newsy/' + escape(item["slug"]) + '/">' + image + '<div class="news-card-date"><time datetime="' + escape(item["date"]) + '">' + escape(polish_date(item["date"])) + '</time></div><h3>' + escape(item["title"]) + '</h3>' + summary + '<span class="news-read">Czytaj więcej →</span></a></article>')
    return "".join(output)

def main():
    manifest = json.loads((NEWS / "articles.json").read_text(encoding="utf-8"))
    articles = manifest["articles"]
    if not isinstance(articles, list):
        raise ValueError("articles must be a list")
    seen = set()
    for item in articles:
        slug = item["slug"]
        if not isinstance(slug, str) or not SLUG.fullmatch(slug) or slug in seen or slug in ("strona", "podglad", "_template"):
            raise ValueError(f"Invalid or duplicate slug: {slug}")
        seen.add(slug)
        date.fromisoformat(item["date"])
        if not isinstance(item["title"], str) or not item["title"].strip():
            raise ValueError(f"Missing title: {slug}")
        image = item.get("image")
        if image and (not isinstance(image, str) or not image.startswith("/") or image.startswith("//") or any(c in image for c in '?#\\\"')):
            raise ValueError(f"Invalid image: {slug}")
        if not (NEWS / slug / "index.html").is_file():
            raise ValueError(f"Article page missing: {slug}")
    articles.sort(key=lambda a: (a["date"], a["slug"]), reverse=True)
    count = max(1, (len(articles) + PAGE_SIZE - 1) // PAGE_SIZE)
    homepage = NEWS / "index.html"
    template = homepage.read_text(encoding="utf-8")
    if len(STREAM.findall(template)) != 1:
        raise ValueError("Expected exactly one news stream block; template changed")
    if articles:
        status = ""
    else:
        status = "Pierwsze wiadomości już wkrótce."
    first = '<div class="news-stream" aria-label="Najnowsze wiadomości">' + cards(articles[:PAGE_SIZE]) + '</div><p class="news-empty" id="news-status" role="status">' + status + '</p><button type="button" class="news-more" id="news-more" hidden>Załaduj starsze wiadomości</button>'
    if count > 1:
        first += '<nav aria-label="Archiwum newsów"><a href="' + path(2) + '">Starsze wiadomości →</a></nav>'
    homepage.write_text(STREAM.sub(lambda m: first, template, count=1), encoding="utf-8")
    root = NEWS / "strona"
    root.mkdir(exist_ok=True)
    for old in root.glob("*/index.html"):
        if old.parent.name.isdigit():
            old.unlink()
            old.parent.rmdir()
    for page in range(2, count + 1):
        nav = '<nav aria-label="Strony archiwum"><a href="' + path(page - 1) + '">← Nowsze wiadomości</a>'
        if page < count:
            nav += ' <a href="' + path(page + 1) + '">Starsze wiadomości →</a>'
        nav += '</nav>'
        content = '<div class="news-stream" aria-label="Archiwum newsów">' + cards(articles[(page - 1) * PAGE_SIZE:page * PAGE_SIZE]) + '</div>' + nav
        output = STREAM.sub(lambda m: content, template, count=1)
        output = output.replace('<link rel="canonical" href="' + BASE + '/newsy/">', '<link rel="canonical" href="' + BASE + path(page) + '">')
        output = output.replace('<title>Newsy z Ameryki | Zapytaj Hanki</title>', '<title>Newsy z Ameryki — strona ' + str(page) + ' | Zapytaj Hanki</title>')
        output = output.replace('<meta name="description" content="Newsy — nowa sekcja wiadomości i ciekawostek z Ameryki po polsku.">', '<meta name="description" content="Archiwum wiadomości z Ameryki po polsku — strona ' + str(page) + '.">')
        output = re.sub(r'<script src="/newsy/feed\.js[^"]*" defer></script>', '', output)
        target = root / str(page)
        target.mkdir(parents=True, exist_ok=True)
        (target / "index.html").write_text(output, encoding="utf-8")
    sitemap = ROOT / "sitemap.xml"
    xml = sitemap.read_text(encoding="utf-8")
    xml = SITEMAP_NEWS.sub("", xml)
    links = [BASE + path(page) for page in range(1, count + 1)]
    links.extend(BASE + "/newsy/" + item["slug"] + "/" for item in articles)
    entries = "".join('  <url><loc>' + escape(link) + '</loc></url>\n' for link in links)
    xml = xml.replace("</urlset>", entries + "</urlset>")
    ET.fromstring(xml)
    sitemap.write_text(xml, encoding="utf-8")
    print(f"Built {count} archive pages and {len(articles)} articles")

if __name__ == "__main__":
    main()
