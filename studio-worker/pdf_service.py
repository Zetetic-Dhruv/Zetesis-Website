#!/usr/bin/env python3
"""Local/sidecar PDF renderer for Decision Manifold Studio reports."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


DEFAULT_HOST = os.environ.get("STUDIO_PDF_HOST", "127.0.0.1")
DEFAULT_PORT = int(os.environ.get("STUDIO_PDF_PORT", "8790"))
MAX_BODY_BYTES = 2_000_000


def generate_pdf(payload: dict[str, Any]) -> bytes:
    report = normalize_report(payload.get("report") or payload)
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.58 * inch,
        leftMargin=0.58 * inch,
        topMargin=0.58 * inch,
        bottomMargin=0.55 * inch,
        title=report["title"],
        author="Decision Manifold Studio",
    )

    styles = build_styles()
    story: list[Any] = []

    story.append(Paragraph(report["title"], styles["Title"]))
    if report["subtitle"]:
        story.append(Paragraph(report["subtitle"], styles["Subtitle"]))
    meta_bits = [x for x in [report["client"], report["preparedFor"]] if x]
    if meta_bits:
        story.append(Paragraph(" | ".join(escape_text(x) for x in meta_bits), styles["MetaCenter"]))
    story.append(Spacer(1, 0.24 * inch))

    add_section(story, styles, "Refined Problem Statement")
    story.append(body_para(report["refinedProblemStatement"] or "Draft not yet approved.", styles))

    add_section(story, styles, "Curated High-Value Questions")
    add_questions(story, styles, report["highValueQuestions"])

    story.append(PageBreak())
    add_section(story, styles, "Type Map")
    add_type_map(story, styles, report["typeMap"])

    story.append(Spacer(1, 0.16 * inch))
    add_section(story, styles, "Assumption Drill Summary")
    add_drill_summary(story, styles, report["drillSummary"])

    add_section(story, styles, "One Thing Left Open")
    story.append(body_para(report["oneThingLeftOpen"] or "No open item recorded.", styles))
    if report["whyLeftOpen"]:
        story.append(Spacer(1, 0.06 * inch))
        story.append(body_para(report["whyLeftOpen"], styles))

    if report["guardrailNote"]:
        story.append(Spacer(1, 0.12 * inch))
        story.append(Paragraph(f"<b>Guardrail note:</b> {escape_text(report['guardrailNote'])}", styles["Small"]))

    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()


def build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "Title": ParagraphStyle(
            "StudioTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#111827"),
            spaceAfter=7,
        ),
        "Subtitle": ParagraphStyle(
            "StudioSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=13,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#4b5563"),
            spaceAfter=3,
        ),
        "MetaCenter": ParagraphStyle(
            "StudioMetaCenter",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#6b7280"),
        ),
        "Section": ParagraphStyle(
            "StudioSection",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=15,
            textColor=colors.HexColor("#111827"),
            spaceBefore=12,
            spaceAfter=6,
        ),
        "Body": ParagraphStyle(
            "StudioBody",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.2,
            leading=13,
            alignment=TA_LEFT,
            textColor=colors.HexColor("#1f2937"),
            spaceAfter=6,
        ),
        "Small": ParagraphStyle(
            "StudioSmall",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=9.5,
            textColor=colors.HexColor("#4b5563"),
        ),
        "Cell": ParagraphStyle(
            "StudioCell",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=6.8,
            leading=8.3,
            textColor=colors.HexColor("#111827"),
        ),
        "CellHeader": ParagraphStyle(
            "StudioCellHeader",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=6.6,
            leading=8,
            textColor=colors.white,
        ),
    }


def add_section(story: list[Any], styles: dict[str, ParagraphStyle], title: str) -> None:
    story.append(Paragraph(escape_text(title), styles["Section"]))


def add_questions(story: list[Any], styles: dict[str, ParagraphStyle], questions: list[dict[str, str]]) -> None:
    if not questions:
        story.append(body_para("No high-value questions tagged yet.", styles))
        return

    rows = [[
        cell("Question", styles, True),
        cell("Who must say yes", styles, True),
        cell("Veto", styles, True),
        cell("Likely no", styles, True),
    ]]
    for item in questions:
        rows.append([
            cell(item["question"], styles),
            cell(item["whoMustSayYes"], styles),
            cell(item["vetoHolder"], styles),
            cell(item["likelyToSayNo"], styles),
        ])
    table = Table(rows, colWidths=[2.85 * inch, 1.45 * inch, 1.25 * inch, 1.25 * inch], repeatRows=1)
    table.setStyle(table_style())
    story.append(table)


def add_type_map(story: list[Any], styles: dict[str, ParagraphStyle], type_map: list[dict[str, str]]) -> None:
    if not type_map:
        story.append(body_para("No type-map items recorded yet.", styles))
        return

    rows = [[
        cell("Bucket", styles, True),
        cell("Status", styles, True),
        cell("Value", styles, True),
        cell("Holder/source", styles, True),
        cell("Source", styles, True),
        cell("Item", styles, True),
    ]]
    for item in type_map:
        rows.append([
            cell(item["bucket"], styles),
            cell(item["status"], styles),
            cell(item["valueTag"], styles),
            cell(item["holder"], styles),
            cell(item["sourceField"], styles),
            cell(item["item"], styles),
        ])
    table = Table(
        rows,
        colWidths=[0.52 * inch, 0.82 * inch, 0.52 * inch, 1.2 * inch, 0.78 * inch, 2.96 * inch],
        repeatRows=1,
    )
    table.setStyle(table_style())
    story.append(table)


def add_drill_summary(story: list[Any], styles: dict[str, ParagraphStyle], assumptions: list[dict[str, str]]) -> None:
    if not assumptions:
        story.append(body_para("No assumption drill entries recorded yet.", styles))
        return

    for assumption in assumptions:
        rows = [
            [cell(assumption["label"], styles, True), cell("", styles, True)],
            [cell("Given", styles), cell(assumption["givenStatement"], styles)],
            [cell("Wrong if", styles), cell(assumption["wrongIf"], styles)],
            [cell("What changes", styles), cell(assumption["whatChanges"], styles)],
        ]
        table = Table(rows, colWidths=[1.05 * inch, 5.75 * inch], hAlign="LEFT")
        style = table_style()
        style.add("SPAN", (0, 0), (1, 0))
        story.append(table)
        table.setStyle(style)
        story.append(Spacer(1, 0.08 * inch))


def body_para(text: str, styles: dict[str, ParagraphStyle]) -> Paragraph:
    return Paragraph(escape_text(text).replace("\n", "<br/>"), styles["Body"])


def cell(text: str, styles: dict[str, ParagraphStyle], header: bool = False) -> Paragraph:
    return Paragraph(escape_text(text or ""), styles["CellHeader" if header else "Cell"])


def table_style() -> TableStyle:
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d1d5db")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
    ])


def footer(canvas: Any, doc: SimpleDocTemplate) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#6b7280"))
    canvas.drawString(doc.leftMargin, 0.32 * inch, "Decision Manifold Studio")
    canvas.drawRightString(letter[0] - doc.rightMargin, 0.32 * inch, f"Page {doc.page}")
    canvas.restoreState()


def normalize_report(raw: Any) -> dict[str, Any]:
    data = raw if isinstance(raw, dict) else {}
    return {
        "title": text(data.get("title"), 120) or "Decision Manifold Studio Final Report",
        "subtitle": text(data.get("subtitle"), 180),
        "client": text(data.get("client"), 140),
        "preparedFor": text(data.get("preparedFor"), 180),
        "refinedProblemStatement": text(data.get("refinedProblemStatement"), 2000),
        "highValueQuestions": normalize_items(data.get("highValueQuestions"), normalize_question, 30),
        "typeMap": normalize_items(data.get("typeMap"), normalize_type_item, 120),
        "drillSummary": normalize_items(data.get("drillSummary"), normalize_drill, 12),
        "oneThingLeftOpen": text(data.get("oneThingLeftOpen"), 1200),
        "whyLeftOpen": text(data.get("whyLeftOpen"), 1200),
        "guardrailNote": text(data.get("guardrailNote"), 600),
    }


def normalize_question(raw: Any) -> dict[str, str]:
    item = raw if isinstance(raw, dict) else {}
    return {
        "question": text(item.get("question"), 1000),
        "whoMustSayYes": text(item.get("whoMustSayYes"), 300),
        "vetoHolder": text(item.get("vetoHolder"), 300),
        "likelyToSayNo": text(item.get("likelyToSayNo"), 300),
    }


def normalize_type_item(raw: Any) -> dict[str, str]:
    item = raw if isinstance(raw, dict) else {}
    return {
        "bucket": text(item.get("bucket"), 20),
        "status": text(item.get("status"), 80),
        "valueTag": text(item.get("valueTag"), 20),
        "holder": text(item.get("holder"), 240),
        "sourceField": text(item.get("sourceField"), 80),
        "item": text(item.get("item"), 1600),
    }


def normalize_drill(raw: Any) -> dict[str, str]:
    item = raw if isinstance(raw, dict) else {}
    return {
        "label": text(item.get("label"), 120) or "Assumption",
        "givenStatement": text(item.get("givenStatement"), 1000),
        "wrongIf": text(item.get("wrongIf"), 1000),
        "whatChanges": text(item.get("whatChanges"), 1000),
    }


def normalize_items(value: Any, mapper: Any, limit: int) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    return [mapper(item) for item in value[:limit]]


def text(value: Any, limit: int) -> str:
    if value is None:
        return ""
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]+", " ", str(value))
    cleaned = re.sub(r"[ \t]+", " ", cleaned).strip()
    return cleaned[:limit]


def escape_text(value: str) -> str:
    return escape(value or "", {"'": "&#39;", '"': "&quot;"})


def filename_for(payload: dict[str, Any]) -> str:
    report = payload.get("report") if isinstance(payload.get("report"), dict) else {}
    base = text(report.get("client") or report.get("title") or "decision-manifold-final-report", 80)
    slug = re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-") or "decision-manifold-final-report"
    return f"{slug}.pdf"


class PdfHandler(BaseHTTPRequestHandler):
    server_version = "DecisionManifoldPdf/1.0"

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.add_cors_headers()
        self.end_headers()

    def do_GET(self) -> None:
        if self.path != "/health":
            self.send_error(404)
            return
        self.send_response(200)
        self.add_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def do_POST(self) -> None:
        if self.path != "/pdf":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0 or length > MAX_BODY_BYTES:
            self.send_error(413, "Invalid or too-large request body")
            return

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            pdf = generate_pdf(payload)
        except Exception as exc:  # noqa: BLE001 - return useful local renderer error
            self.send_response(400)
            self.add_cors_headers()
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(str(exc).encode("utf-8", "replace"))
            return

        filename = filename_for(payload)
        self.send_response(200)
        self.add_cors_headers()
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(pdf)))
        self.end_headers()
        self.wfile.write(pdf)

    def add_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Expose-Headers", "Content-Disposition")

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def sample_payload() -> dict[str, Any]:
    return {
        "report": {
            "title": "Decision Manifold Studio Final Report",
            "subtitle": "Decision Manifold summary",
            "client": "Bethany House of Nassau County",
            "preparedFor": "Columbia SPS Mastering Consulting",
            "refinedProblemStatement": "The staffing gap is not only a resourcing problem; it is a relationship-continuity problem.",
            "highValueQuestions": [
                {
                    "question": "Which partner relationship must survive the staffing transition?",
                    "whoMustSayYes": "Bethany House CEO",
                    "vetoHolder": "Board chair",
                    "likelyToSayNo": "Budget owner",
                }
            ],
            "typeMap": [
                {
                    "bucket": "UK",
                    "status": "settled",
                    "valueTag": "High",
                    "holder": "Bethany House CEO",
                    "sourceField": "known",
                    "item": "The Executive Assistant role carries informal partner memory.",
                }
            ],
            "drillSummary": [
                {
                    "label": "Assumption 1",
                    "givenStatement": "The staffing gap is an execution-capacity problem.",
                    "wrongIf": "The missing capacity is actually relationship continuity.",
                    "whatChanges": "The team would design a transition plan before writing a generic job description.",
                }
            ],
            "oneThingLeftOpen": "Which partner relationship is most fragile?",
            "whyLeftOpen": "The team needs a channel outside the CEO before treating this as settled.",
            "guardrailNote": "Generated only from approved workspace fields. Blank fields indicate missing or unapproved team input.",
        }
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Decision Manifold Studio PDF renderer")
    parser.add_argument("--once", nargs=2, metavar=("INPUT_JSON", "OUTPUT_PDF"))
    parser.add_argument("--sample", metavar="OUTPUT_PDF")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    args = parser.parse_args()

    if args.sample:
        output = Path(args.sample)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(generate_pdf(sample_payload()))
        print(output)
        return

    if args.once:
        input_path, output_path = args.once
        payload = json.loads(Path(input_path).read_text(encoding="utf-8"))
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(generate_pdf(payload))
        print(output)
        return

    server = ThreadingHTTPServer((args.host, args.port), PdfHandler)
    print(f"PDF service ready on http://{args.host}:{args.port}/pdf", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
