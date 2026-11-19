#!/usr/bin/env python3
"""Tell Bing (and other IndexNow engines: Yandex, Seznam, Naver) that pages changed,
so they re-crawl within hours. Bing's index also feeds ChatGPT search and Copilot.

Run after a deploy is live:
    python3 scripts/indexnow.py                     # every URL in website/sitemap.xml
    python3 scripts/indexnow.py /blog/foo /pricing  # only these paths

The key file website/aabefd4272bd49cd96a4d875dfc44010.txt must be deployed (it is public by design).
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

HOST = "www.notebooktools.com"
KEY = "aabefd4272bd49cd96a4d875dfc44010"
SITE = Path(__file__).resolve().parent.parent / "website"


def urls_from_args_or_sitemap():
    if len(sys.argv) > 1:
        return [f"https://{HOST}{p if p.startswith('/') else '/' + p}" for p in sys.argv[1:]]
    sitemap = (SITE / "sitemap.xml").read_text(encoding="utf-8")
    return re.findall(r"<loc>([^<]+)</loc>", sitemap)


def main():
    urls = urls_from_args_or_sitemap()
    body = json.dumps({
        "host": HOST,
        "key": KEY,
        "keyLocation": f"https://{HOST}/{KEY}.txt",
        "urlList": urls[:10000],
    }).encode()
    req = urllib.request.Request(
        "https://api.indexnow.org/indexnow",
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        print(f"IndexNow: HTTP {resp.status} for {len(urls)} URLs (200/202 = accepted)")


if __name__ == "__main__":
    main()
