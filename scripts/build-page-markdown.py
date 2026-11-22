#!/usr/bin/env python3
"""Write a clean Markdown twin next to every website page, for AI agents and LLMs.

index.html -> index.md, students.html -> students.md, blog/x.html -> blog/x.md ...
Each page gets <link rel="alternate" type="text/markdown" href="/x.md"> in its
<head>. Pages under website/tools/ already have hand-built twins
(scripts/build-tools-pages.py), so they are skipped here.

Run after editing pages:  python3 scripts/build-page-markdown.py
"""
from __future__ import annotations

import re
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag

SITE = Path(__file__).resolve().parent.parent / "website"
ORIGIN = "https://www.notebooktools.com"
SKIP_DIRS = {"tools", "assets"}
SKIP_FILES = {"account.html", "reset-password.html"}
DROP = {"script", "style", "noscript", "svg", "nav", "header", "footer", "button", "form", "input", "select", "textarea", "iframe", "template"}


def page_url(rel: Path) -> str:
    path = "/" + rel.as_posix()
    path = re.sub(r"(^|/)index\.html$", r"\1", path)
    path = re.sub(r"\.html$", "", path)
    return ORIGIN + (path.rstrip("/") or "/") if path != "/" else ORIGIN + "/"


def md_path(rel: Path) -> str:
    return "/" + rel.with_suffix(".md").as_posix()


def absolute(href: str) -> str:
    if not href or href.startswith(("#", "mailto:", "javascript:")):
        return href
    if href.startswith("/"):
        return ORIGIN + href
    return href


def inline(node) -> str:
    if isinstance(node, NavigableString):
        return re.sub(r"\s+", " ", str(node))
    if not isinstance(node, Tag) or node.name in DROP:
        return ""
    if node.get("aria-hidden") == "true" or node.has_attr("hidden"):
        return ""
    text = "".join(inline(c) for c in node.children)
    name = node.name
    if name in ("strong", "b"):
        return f"**{tidy(text)}**" if text.strip() else ""
    if name in ("em", "i"):
        return f"*{text.strip()}*" if text.strip() else ""
    if name == "code":
        return f"`{text.strip()}`"
    if name == "br":
        return "\u2028"
    if name == "a":
        href = absolute(node.get("href", ""))
        label = tidy(text)
        if not label:
            return ""
        return f"[{label}]({href})" if href and not href.startswith("#") else label
    if name == "img":
        alt = (node.get("alt") or "").strip()
        return f"![{alt}]({absolute(node.get('src', ''))})" if alt else ""
    if name in ("span", "small", "abbr", "time", "label"):
        return f" {text} "
    return text


def tidy(text: str) -> str:
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\s+([,.;:!?)])", r"\1", text)
    return text.replace("\u2028", "  \n").strip()


BLOCKS = {"p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "pre", "blockquote", "table", "details", "dl", "figure", "hr"}


def has_block_child(node: Tag) -> bool:
    return any(isinstance(c, Tag) and (c.name in BLOCKS or c.name in ("div", "section", "article", "li")) for c in node.children)


def block(node, out: list[str], depth: int = 0) -> None:
    if isinstance(node, NavigableString):
        text = re.sub(r"\s+", " ", str(node)).strip()
        if text:
            out.append(text)
        return
    if not isinstance(node, Tag) or node.name in DROP:
        return
    if node.get("aria-hidden") == "true" or node.has_attr("hidden"):
        return
    name = node.name
    if name and re.fullmatch(r"h[1-6]", name):
        text = tidy(inline(node))
        if text:
            out.append("#" * int(name[1]) + " " + text)
        return
    if name == "p":
        text = tidy(inline(node))
        if text:
            out.append(text)
        return
    if name in ("ul", "ol"):
        items = []
        for i, li in enumerate(node.find_all("li", recursive=False), 1):
            bullet = f"{i}." if name == "ol" else "-"
            if has_block_child(li):
                sub: list[str] = []
                for child in li.children:
                    block(child, sub, depth + 1)
                first, *rest = sub or [""]
                items.append("  " * depth + f"{bullet} {first}")
                items.extend("  " * (depth + 1) + line for line in rest)
            else:
                text = tidy(inline(li))
                if text:
                    items.append("  " * depth + f"{bullet} {text}")
        if items:
            out.append("\n".join(items))
        return
    if name == "pre":
        out.append("```\n" + node.get_text().strip("\n") + "\n```")
        return
    if name == "blockquote":
        sub: list[str] = []
        for child in node.children:
            block(child, sub, depth)
        if sub:
            out.append("\n".join("> " + line for line in "\n\n".join(sub).splitlines()))
        return
    if name == "details":
        summary = node.find("summary")
        if summary:
            out.append("### " + tidy(inline(summary)))
            summary.extract()
        for child in node.children:
            block(child, out, depth)
        return
    if name == "table":
        rows = []
        for tr in node.find_all("tr"):
            cells = [tidy(inline(c)).replace("|", "\\|") for c in tr.find_all(["th", "td"])]
            if cells:
                rows.append(cells)
        if rows:
            width = max(len(r) for r in rows)
            rows = [r + [""] * (width - len(r)) for r in rows]
            lines = ["| " + " | ".join(rows[0]) + " |", "|" + "---|" * width]
            lines += ["| " + " | ".join(r) + " |" for r in rows[1:]]
            out.append("\n".join(lines))
        return
    if name == "dl":
        for child in node.find_all(["dt", "dd"], recursive=False):
            text = tidy(inline(child))
            if text:
                out.append(f"**{text}**" if child.name == "dt" else text)
        return
    if name == "hr":
        out.append("---")
        return
    # Containers (div, section, article, main, figure, a cards, spans…)
    if has_block_child(node) or name in ("main", "section", "article", "div", "figure", "aside"):
        if not has_block_child(node):
            text = tidy(inline(node))
            if text:
                out.append(text)
            return
        for child in node.children:
            block(child, out, depth)
        return
    text = tidy(inline(node))
    if text:
        out.append(text)


def convert(html: str, rel: Path) -> str:
    soup = BeautifulSoup(html, "html.parser")
    title = (soup.title.get_text(strip=True) if soup.title else rel.stem).strip()
    desc_tag = soup.find("meta", attrs={"name": "description"})
    desc = desc_tag.get("content", "").strip() if desc_tag else ""
    main = soup.find("main") or soup.body or soup
    parts: list[str] = []
    block(main, parts)
    # Drop exact repeats (cards often repeat headings) and empty bits.
    seen, body = set(), []
    for part in parts:
        key = part.strip()
        if not key or (key in seen and len(key) < 200):
            continue
        seen.add(key)
        body.append(key)
    if not body or not body[0].startswith("# "):
        body.insert(0, f"# {title}")
    header = [f"> Source: {page_url(rel)}"]
    if desc:
        header.insert(0, f"> {desc}")
    text = body[0] + "\n\n" + "\n".join(header) + "\n\n" + "\n\n".join(body[1:]) + "\n"
    return re.sub(r"\n{3,}", "\n\n", text)


ALT_RE = re.compile(r'\s*<link rel="alternate" type="text/markdown"[^>]*>')


def add_alternate(html: str, href: str) -> str:
    html = ALT_RE.sub("", html)
    tag = f'\n    <link rel="alternate" type="text/markdown" href="{href}">'
    return re.sub(r"(<link rel=\"canonical\"[^>]*>)", r"\1" + tag, html, count=1) if 'rel="canonical"' in html \
        else html.replace("</head>", tag.strip() + "\n  </head>", 1)


def main() -> None:
    written = []
    for path in sorted(SITE.rglob("*.html")):
        rel = path.relative_to(SITE)
        if rel.parts[0] in SKIP_DIRS or rel.name in SKIP_FILES or rel.name.startswith("google"):
            continue
        html = path.read_text(encoding="utf-8")
        if 'name="robots" content="noindex' in html:
            continue
        md = convert(html, rel)
        path.with_suffix(".md").write_text(md, encoding="utf-8")
        new_html = add_alternate(html, md_path(rel))
        if new_html != html:
            path.write_text(new_html, encoding="utf-8")
        written.append(md_path(rel))
    print(f"Wrote {len(written)} Markdown pages")


if __name__ == "__main__":
    main()
