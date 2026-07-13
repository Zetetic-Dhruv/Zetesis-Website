#!/usr/bin/env python3
"""Render and text-audit the Worker-native Module 2 recommendation PDF."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "tmp" / "pdfs"
PDF_PATH = OUTPUT / "module2-recommendation-smoke.pdf"
SOURCE_PATH = OUTPUT / "module2-recommendation-source.json"
PNG_PREFIX = OUTPUT / "module2-recommendation-smoke"


def normalized(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def main() -> None:
    source = json.loads(SOURCE_PATH.read_text())
    with pdfplumber.open(PDF_PATH) as pdf:
        assert len(pdf.pages) >= 2, "complete recommendation should span multiple readable pages"
        extracted = normalized(" ".join(page.extract_text() or "" for page in pdf.pages))
        for expected in source["expectedStrings"]:
            assert normalized(expected) in extracted, f"PDF omitted document content: {expected}"
        for excluded in source["excludedStrings"]:
            assert excluded not in extracted, f"PDF leaked internal provenance: {excluded}"
        assert "Bethany House Recommendation Brief" in extracted
        assert "CANDIDATE FIELD" in extracted
        assert "supporting evidence" in extracted.lower()
        assert "decision criteria" in extracted.lower()
        assert "DECISION COMMITMENTS" in extracted
        assert "confidence score" not in extracted.lower()
        assert "KK" not in extracted and "KU" not in extracted and "UK" not in extracted and "UU" not in extracted
        assert "system prompt" not in extracted.lower()

    if shutil.which("pdfinfo"):
        subprocess.run(["pdfinfo", str(PDF_PATH)], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if shutil.which("pdftoppm"):
        subprocess.run(
            ["pdftoppm", "-png", "-r", "140", str(PDF_PATH), str(PNG_PREFIX)],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        rendered = sorted(OUTPUT.glob("module2-recommendation-smoke-*.png"))
        assert len(rendered) >= 2, "every recommendation page should render to PNG"
        assert all(path.stat().st_size > 10_000 for path in rendered), "rendered pages should be visibly nonblank"

    print(PDF_PATH)


if __name__ == "__main__":
    main()
