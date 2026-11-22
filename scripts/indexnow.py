#!/usr/bin/env python3
"""Tell Bing (and other IndexNow engines: Yandex, Seznam, Naver, Yep) that pages
changed, so they re-crawl within hours. Bing's index also feeds ChatGPT search
and Copilot. Google does not use IndexNow; it reads the sitemap.

Runs by itself after every production deploy (.github/workflows/indexnow.yml).
By hand, once the deploy is live:

    python3 scripts/indexnow.py                         # every URL in website/sitemap.xml
    python3 scripts/indexnow.py /blog/foo /pricing      # only these paths
    python3 scripts/indexnow.py --changed BASE [HEAD]   # pages changed between two commits
    python3 scripts/indexnow.py --dry-run ...           # list the URLs, send nothing

The key file website/aabefd4272bd49cd96a4d875dfc44010.txt must be deployed (it is public by design).
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

HOST = "www.notebooktools.com"
KEY = "aabefd4272bd49cd96a4d875dfc44010"
KEY_URL = f"https://{HOST}/{KEY}.txt"
ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "website"
ENDPOINT = "https://api.indexnow.org/indexnow"
UA = "NotebookTools-IndexNow/1.0 (+https://www.notebooktools.com)"

ERRORS = {
    400: "bad request (malformed URL list)",
    403: f"key not valid: {KEY_URL} must be live and contain exactly the key",
    422: "URLs don't belong to the host, or the key doesn't match",
    429: "too many requests; try again later",
}


def sitemap_urls(text: str | None = None) -> list[str]:
    if text is None:
        text = (SITE / "sitemap.xml").read_text(encoding="utf-8")
    return re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", text)


def path_to_url(rel: str) -> str | None:
    """website/blog/foo.html -> https://host/blog/foo (Vercel cleanUrls)."""
    if not rel.startswith("website/") or not rel.endswith(".html"):
        return None
    page = rel[len("website/"):-len(".html")]
    if page == "index":
        return f"https://{HOST}/"
    if page.endswith("/index"):
        page = page[: -len("/index")]
    return f"https://{HOST}/{page}"


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True, text=True).stdout


def sitemap_at(commit: str) -> list[str]:
    try:
        return sitemap_urls(git("show", f"{commit}:website/sitemap.xml"))
    except subprocess.CalledProcessError:
        return []  # no sitemap in that commit


def changed_urls(base: str, head: str) -> list[str]:
    """Pages added, edited, renamed or deleted between two commits that are (or were) in the sitemap."""
    before, after = sitemap_at(base), sitemap_at(head)
    listed = set(before) | set(after)
    urls: list[str] = []
    for line in git("diff", "--name-status", "--find-renames", base, head, "--", "website").splitlines():
        for rel in line.split("\t")[1:]:  # renames list both the old and the new path
            url = path_to_url(rel)
            if url and url in listed and url not in urls:
                urls.append(url)
    # Pages newly listed in the sitemap even if their HTML didn't change
    old = set(before)
    urls += [url for url in after if url not in old and url not in urls]
    return urls


def key_is_live() -> bool:
    req = urllib.request.Request(KEY_URL, headers={"User-Agent": UA, "Cache-Control": "no-cache"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.read().decode("utf-8", "replace").strip() == KEY
    except (urllib.error.URLError, TimeoutError) as error:
        print(f"Could not read {KEY_URL}: {error}")
        return False


def submit(urls: list[str]) -> bool:
    ok = True
    for i in range(0, len(urls), 10000):
        batch = urls[i : i + 10000]
        body = json.dumps({"host": HOST, "key": KEY, "keyLocation": KEY_URL, "urlList": batch}).encode()
        req = urllib.request.Request(
            ENDPOINT,
            data=body,
            headers={"Content-Type": "application/json; charset=utf-8", "User-Agent": UA},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                print(f"IndexNow: HTTP {resp.status} for {len(batch)} URLs (200/202 = accepted)")
        except urllib.error.HTTPError as error:
            print(f"IndexNow: HTTP {error.code} for {len(batch)} URLs: {ERRORS.get(error.code, error.reason)}")
            ok = False
        except (urllib.error.URLError, TimeoutError) as error:
            print(f"IndexNow: request failed: {error}")
            ok = False
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("paths", nargs="*", help="paths like /blog/foo (default: every sitemap URL)")
    parser.add_argument("--changed", nargs="+", metavar="COMMIT", help="BASE [HEAD]: only pages changed between commits")
    parser.add_argument("--dry-run", action="store_true", help="print the URLs without sending")
    parser.add_argument("--skip-key-check", action="store_true", help="don't check that the key file is live first")
    args = parser.parse_args()

    if args.changed:
        base = args.changed[0]
        head = args.changed[1] if len(args.changed) > 1 else "HEAD"
        urls = changed_urls(base, head)
    elif args.paths:
        urls = [f"https://{HOST}{p if p.startswith('/') else '/' + p}" for p in args.paths]
    else:
        urls = sitemap_urls()

    if not urls:
        print("IndexNow: no indexable pages changed; nothing to send.")
        return 0
    print(f"{len(urls)} URL(s):")
    for url in urls[:50]:
        print("  " + url)
    if len(urls) > 50:
        print(f"  … and {len(urls) - 50} more")
    if args.dry_run:
        return 0
    if not args.skip_key_check and not key_is_live():
        print(f"IndexNow: stopped. {KEY_URL} is not live with the right key yet (deploy first).")
        return 1
    return 0 if submit(urls) else 1


if __name__ == "__main__":
    sys.exit(main())
