#!/usr/bin/env python3
"""Build the recipe carousel/hub feed from published recipe pages."""
import json
import re
import subprocess
from html import unescape
from pathlib import Path
from urllib.parse import urlparse

root = Path(__file__).resolve().parents[1]
recipes = []
for page in sorted((root / "przepisy").glob("*/index.html")):
    html = page.read_text(encoding="utf-8")
    slug = page.parent.name
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
        continue
    ld = re.search(r'<script\s+type="application/ld\+json"\s*>(.*?)</script>', html, re.S | re.I)
    if not ld:
        continue
    try:
        data = json.loads(ld.group(1))
    except json.JSONDecodeError:
        continue
    if data.get("@type") != "Recipe":
        continue
    def text(pattern, default=""):
        m = re.search(pattern, html, re.S | re.I)
        return unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip() if m else default
    title = text(r"<h1[^>]*>(.*?)</h1>", data.get("name", slug))
    summary = text(r'<p\s+class="deck"[^>]*>(.*?)</p>', data.get("description", ""))
    image = data.get("image", "")
    if isinstance(image, list):
        image = image[0] if image else ""
    if isinstance(image, dict):
        image = image.get("url", "")
    image = urlparse(str(image)).path
    if not image.startswith("/przepisy/images/") or not (root / image.lstrip("/")).is_file():
        image = ""
    dates = subprocess.run(["git", "log", "--diff-filter=A", "--format=%cs", "--", str(page.relative_to(root))], cwd=root, capture_output=True, text=True, check=True).stdout.splitlines()
    date = dates[-1] if dates else "2026-10-16"
    servings = str(data.get("recipeYield", "")).upper()
    recipes.append({"slug": slug, "title": title, "date": date, "summary": summary, "image": image, "alt": title, "servings": servings})
recipes.sort(key=lambda r: (r["date"], r["slug"]), reverse=True)
(root / "przepisy" / "articles.json").write_text(json.dumps({"articles": recipes}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Generated {len(recipes)} recipes")
