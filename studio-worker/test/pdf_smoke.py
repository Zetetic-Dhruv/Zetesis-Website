#!/usr/bin/env python3
"""Smoke-test the Decision Manifold Studio PDF renderer."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from pdf_service import generate_pdf, sample_payload  # noqa: E402


def main() -> None:
    output_dir = ROOT / "tmp" / "pdfs"
    output_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = output_dir / "studio-pdf-smoke.pdf"
    png_prefix = output_dir / "studio-pdf-smoke"

    pdf_path.write_bytes(generate_pdf(sample_payload()))
    assert pdf_path.stat().st_size > 3_000, "PDF should be non-trivial"

    with pdfplumber.open(pdf_path) as pdf:
        assert len(pdf.pages) >= 2, "sample report should render across at least two pages"
        text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        assert "Decision Manifold Studio Final Report" in text, "title should extract"
        assert "relationship-continuity problem" in text, "refined problem should extract"
        assert "Type Map" in text, "type-map section should extract"

    if shutil.which("pdfinfo"):
      subprocess.run(["pdfinfo", str(pdf_path)], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    if shutil.which("pdftoppm"):
      subprocess.run(
          ["pdftoppm", "-png", "-f", "1", "-singlefile", str(pdf_path), str(png_prefix)],
          check=True,
          stdout=subprocess.PIPE,
          stderr=subprocess.PIPE,
          text=True,
      )
      assert (output_dir / "studio-pdf-smoke.png").exists(), "page-one PNG should render"

    print(pdf_path)


if __name__ == "__main__":
    main()
