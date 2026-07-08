"""PDF report generation — port of jsPDF client-side generation to server-side.

Uses reportlab for clean PDF output with the same content structure.
"""

from __future__ import annotations
import re
from io import BytesIO
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER


def _clean_markdown(md: str) -> str:
    """Strip markdown formatting for plain text in PDF."""
    md = re.sub(r'#{1,6}\s*', '', md)         # Remove headers
    md = re.sub(r'\*\*(.+?)\*\*', r'\1', md)   # Bold
    md = re.sub(r'\*(.+?)\*', r'\1', md)       # Italic
    md = re.sub(r'`(.+?)`', r'\1', md)         # Code
    md = re.sub(r'\[(.+?)\]\(.+?\)', r'\1', md) # Links
    return md.strip()


def _markdown_to_flowables(markdown: str, styles) -> list:
    """Convert markdown text to reportlab flowables."""
    flowables = []
    lines = markdown.split("\n")
    in_table = False
    table_rows = []

    i = 0
    while i < len(lines):
        line = lines[i].rstrip()

        # Skip empty lines
        if not line.strip():
            if in_table and table_rows:
                # End of table
                flowables.append(_build_table(table_rows, styles))
                table_rows = []
                in_table = False
            flowables.append(Spacer(1, 4 * mm))
            i += 1
            continue

        # Table rows
        if line.strip().startswith("|"):
            in_table = True
            # Skip separator rows
            if re.match(r'^\|[\s\-:|]+\|$', line.strip()):
                i += 1
                continue
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            table_rows.append(cells)
            i += 1
            continue

        if in_table and table_rows:
            flowables.append(_build_table(table_rows, styles))
            table_rows = []
            in_table = False

        # Headers
        header_match = re.match(r'^(#{1,6})\s+(.+)$', line)
        if header_match:
            level = len(header_match.group(1))
            text = _clean_markdown(header_match.group(2))
            if level <= 2:
                flowables.append(Paragraph(text, styles['ASHeading1'] if level == 1 else styles['ASHeading2']))
            else:
                flowables.append(Paragraph(text, styles['ASHeading3']))
            i += 1
            continue

        # Horizontal rule
        if line.strip() in ("---", "***", "___"):
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
            i += 1
            continue

        # Bullet points
        bullet_match = re.match(r'^[\s]*[-*]\s+(.+)$', line)
        if bullet_match:
            text = _clean_markdown(bullet_match.group(1))
            flowables.append(Paragraph(f"- {text}", styles['ASBody']))
            i += 1
            continue

        # Numbered lists
        num_match = re.match(r'^[\s]*(\d+)[.)]\s+(.+)$', line)
        if num_match:
            num = num_match.group(1)
            text = _clean_markdown(num_match.group(2))
            flowables.append(Paragraph(f"{num}. {text}", styles['ASBody']))
            i += 1
            continue

        # Regular text
        text = _clean_markdown(line)
        if text:
            flowables.append(Paragraph(text, styles['ASBody']))

        i += 1

    # Flush remaining table
    if in_table and table_rows:
        flowables.append(_build_table(table_rows, styles))

    return flowables


def _build_table(rows: list, styles) -> Table:
    """Build a reportlab Table from parsed rows."""
    if not rows:
        return Table([[""]])

    data = [[Paragraph(_clean_markdown(cell), styles['TableHeader']) for cell in rows[0]]]
    for row in rows[1:]:
        data.append([Paragraph(_clean_markdown(cell), styles['TableCell']) for cell in row])

    col_count = max(len(r) for r in data)
    # Pad rows
    for row in data:
        while len(row) < col_count:
            row.append("")

    col_width = (A4[0] - 40 * mm) / col_count
    t = Table(data, colWidths=[col_width] * col_count)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563EB')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
    ]))
    return t


def _get_styles():
    """Define PDF styles matching the app's design."""
    base = getSampleStyleSheet()
    base.add(ParagraphStyle(
        'ASHeading1', parent=base['Heading1'],
        fontSize=18, textColor=colors.HexColor('#1E40AF'),
        spaceAfter=8 * mm, spaceBefore=4 * mm,
    ))
    base.add(ParagraphStyle(
        'ASHeading2', parent=base['Heading2'],
        fontSize=14, textColor=colors.HexColor('#374151'),
        spaceAfter=4 * mm, spaceBefore=6 * mm,
    ))
    base.add(ParagraphStyle(
        'ASHeading3', parent=base['Heading3'],
        fontSize=12, textColor=colors.HexColor('#4B5563'),
        spaceAfter=3 * mm, spaceBefore=4 * mm,
    ))
    base.add(ParagraphStyle(
        'ASBody', parent=base['Normal'],
        fontSize=10, leading=14, textColor=colors.HexColor('#374151'),
        spaceAfter=2 * mm,
    ))
    base.add(ParagraphStyle(
        'ASTitle', parent=base['Title'],
        fontSize=24, textColor=colors.HexColor('#1E40AF'),
        spaceAfter=6 * mm,
    ))
    base.add(ParagraphStyle(
        'TableHeader', fontSize=9, textColor=colors.white, fontName='Helvetica-Bold',
    ))
    base.add(ParagraphStyle(
        'TableCell', fontSize=9, textColor=colors.HexColor('#374151'),
    ))
    return base


def generate_pdf_bytes(markdown: str, report_data: Optional[dict] = None) -> bytes:
    """Generate a PDF report from markdown content.

    Args:
        markdown: The report markdown text.
        report_data: Optional structured report data for metadata.

    Returns:
        PDF file bytes.
    """
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = _get_styles()
    flowables = []

    # Title
    flowables.append(Paragraph("AuraScan - Facial Analysis Report", styles['ASTitle']))
    flowables.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#2563EB')))
    flowables.append(Spacer(1, 4 * mm))

    # Add overall score if available
    if report_data and "overall" in report_data:
        overall = report_data["overall"]
        score = overall.get("score", "N/A")
        label = overall.get("scoreLabel", "")
        flowables.append(Paragraph(
            f"<b>Overall Score:</b> {score} — {label}",
            styles['ASHeading2'],
        ))
        flowables.append(Spacer(1, 4 * mm))

    # Main content
    flowables.extend(_markdown_to_flowables(markdown, styles))

    # Footer
    flowables.append(Spacer(1, 10 * mm))
    flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    flowables.append(Spacer(1, 2 * mm))
    flowables.append(Paragraph(
        "Generated by AuraScan · Python FastAPI Backend · Computer Vision Analysis",
        styles['ASBody'],
    ))

    doc.build(flowables)
    buf.seek(0)
    return buf.read()
