#!/usr/bin/env python3
"""
Build source-snapshot.js from the real JavaScript files beside it.

The live source console prefers fetching the .js files over HTTP. When the
page is opened directly from disk (file://), browsers block those fetches,
so this generated snapshot is used instead. Re-run this script after any
source edit:

    python tools/build-snapshot.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FILES = [
    "rose-engine.js",
    "petal-generator.js",
    "particle-system.js",
    "code-display.js",
    "controls.js",
    "script.js",
]

HEADER = """/* ============================================================
   ASCII ROSE GENERATOR - source-snapshot.js
   AUTO-GENERATED - DO NOT EDIT BY HAND.
   Regenerate with:  python tools/build-snapshot.py
   Used only as a file:// fallback; over HTTP the console fetches
   the real .js files with cache disabled.
   ============================================================ */

window.ASCII_ROSE_SOURCES = {
"""

FOOTER = "};\n"


def encode(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    # Replace CRLF so the displayed source is stable across platforms.
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    encoded = json.dumps(text, ensure_ascii=False)
    # U+2028/U+2029 are legal JSON but awkward inside JS source text.
    return encoded.replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def main() -> None:
    missing = [name for name in FILES if not (ROOT / name).is_file()]
    if missing:
        raise SystemExit(f"Missing source files: {', '.join(missing)}")

    chunks = [HEADER]
    for name in FILES:
        chunks.append(f"  {json.dumps(name)}: {encode(ROOT / name)},\n")
    chunks.append(FOOTER)

    target = ROOT / "source-snapshot.js"
    target.write_text("".join(chunks), encoding="utf-8")

    total = sum((ROOT / name).stat().st_size for name in FILES)
    print(f"Wrote {target.name}: {len(FILES)} files, {total:,} source bytes")


if __name__ == "__main__":
    main()
