#!/usr/bin/env python3
"""Comprobacion mecanica del deck. Sin dependencias.

Verifica lo que se puede verificar sin navegador:
  - anidamiento del HTML,
  - que haya exactamente 16 diapositivas numeradas 1..16,
  - cuantos marcadores [VERIFY] quedan (plan §2: cero para dar por terminado),
  - que toda clase usada en el HTML exista en styles.css.

Uso: python3 tools/check.py
"""
import html.parser
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOID = {"meta", "link", "br", "img", "input", "hr", "source", "path", "line",
        "circle", "rect", "polyline", "polygon", "use", "stop"}


class Nesting(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.errors = []
        self.classes = set()
        self.slides = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for c in (a.get("class") or "").split():
            self.classes.add(c)
        if "data-slide" in a:
            self.slides.append(a["data-slide"])
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID and self.stack:
            self.stack.pop()

    def handle_endtag(self, tag):
        if not self.stack:
            self.errors.append(f"line {self.getpos()[0]}: stray </{tag}>")
            return
        if self.stack[-1][0] != tag:
            open_tag, open_line = self.stack[-1]
            self.errors.append(
                f"line {self.getpos()[0]}: </{tag}> closes <{open_tag}> opened on line {open_line}")
        else:
            self.stack.pop()


def main():
    src = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")

    p = Nesting()
    p.feed(src)
    problems = list(p.errors) + [f"unclosed <{t}> from line {n}" for t, n in p.stack]

    if p.slides != [str(i) for i in range(1, 17)]:
        problems.append(f"data-slide sequence is {p.slides}, expected 1..16")

    css_classes = set(re.findall(r"\.([A-Za-z][\w-]*)", css))
    missing = sorted(c for c in p.classes if c not in css_classes)
    if missing:
        problems.append("classes used in HTML with no rule in styles.css: " + ", ".join(missing))

    verify = re.findall(r'class="verify"[^>]*>\s*(\[VERIFY[^<]*)', src)
    print(f"slides: {len(p.slides)}")
    print(f"[VERIFY] markers outstanding: {len(verify)}")
    for v in verify:
        print("   ·", v.strip())

    if problems:
        print("\nPROBLEMS:")
        for x in problems:
            print("  !", x)
        return 1
    print("\nstructure OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
