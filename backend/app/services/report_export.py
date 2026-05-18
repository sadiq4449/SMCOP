"""PDF / Excel exports for quarterly reports."""

from __future__ import annotations

import json
from io import BytesIO

from fpdf import FPDF
from openpyxl import Workbook

from app.models.report import Report


def _pdf_safe(text: str) -> str:
    """FPDF core fonts are latin-1; avoid encoding errors on Urdu or smart quotes."""
    return text.encode("latin-1", errors="replace").decode("latin-1")


def _append_kpi_chart_pdf(pdf: FPDF, snap: object) -> None:
    """Horizontal bar chart of KPI scores (included in exported PDF)."""
    if not isinstance(snap, dict):
        return
    scores = snap.get("kpi_scores")
    if not isinstance(scores, list) or not scores:
        return
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 13)
    pdf.multi_cell(0, 8, _pdf_safe("KPI performance chart"))
    pdf.ln(1)
    pdf.set_font("Helvetica", size=9)
    pdf.multi_cell(
        0,
        5,
        _pdf_safe("Bars show score achieved versus maximum for each indicator (from the report snapshot)."),
    )
    pdf.ln(3)
    bar_total_w = 108.0
    label_w = 72.0
    bar_x = 86.0
    pdf.set_draw_color(210, 213, 219)
    pdf.set_fill_color(37, 99, 235)
    for row in scores:
        if not isinstance(row, dict):
            continue
        if pdf.get_y() > 268:
            pdf.add_page()
        name_raw = row.get("kpi_name")
        name = _pdf_safe(str(name_raw or "Indicator")[:42])
        score_raw, mx_raw = row.get("score"), row.get("max_score")
        if mx_raw is None:
            mx_raw = 5
        try:
            sc = float(score_raw) if score_raw is not None else 0.0
            mx = float(mx_raw) if mx_raw else 5.0
        except (TypeError, ValueError):
            sc, mx = 0.0, 5.0
        pct = min(1.0, max(0.0, sc / mx)) if mx > 0 else 0.0
        y = pdf.get_y()
        pdf.set_xy(14, y)
        pdf.set_font("Helvetica", size=9)
        pdf.cell(label_w, 6, name[:36], border=0)
        pdf.rect(bar_x, y, bar_total_w, 5.5, style="D")
        inner_w = bar_total_w * pct
        if inner_w > 0.15:
            pdf.rect(bar_x, y, inner_w, 5.5, style="F")
        pdf.set_xy(bar_x + bar_total_w + 2, y)
        pdf.set_font("Helvetica", size=9)
        pdf.cell(28, 6, _pdf_safe(f"{sc:g} / {mx:g}"), ln=1)


def report_to_xlsx(report: Report) -> bytes:
    wb = Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "Summary"
    ws.append(["Quarter", report.quarter])
    ws.append(["School ID", str(report.school_id)])
    ws.append(["Status", report.status.value])
    ws.append(["Summary", report.summary or ""])
    ws.append(["Recommendations", report.recommendations or ""])
    ws.append(["Principal infrastructure notes", report.principal_infrastructure_notes or ""])
    ws.append(["Principal daily activity notes", report.principal_daily_activity_notes or ""])
    ws.append([])

    snap = report.generated_snapshot or {}
    ws.append(["Generated snapshot (JSON)"])
    ws.append([json.dumps(snap, indent=2)])

    ws2 = wb.create_sheet("KPI rows")
    ws2.append(["kpi_name", "score", "max_score"])
    scores = snap.get("kpi_scores") if isinstance(snap, dict) else None
    if isinstance(scores, list):
        for row in scores:
            if isinstance(row, dict):
                ws2.append([row.get("kpi_name"), row.get("score"), row.get("max_score")])

    bio = BytesIO()
    wb.save(bio)
    return bio.getvalue()


class _ReportPDF(FPDF):
    pass


def report_to_pdf(report: Report) -> bytes:
    pdf = _ReportPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.multi_cell(0, 8, _pdf_safe(f"Quarterly report — {report.quarter}"))
    pdf.ln(4)
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 6, _pdf_safe(f"School ID: {report.school_id}"))
    pdf.multi_cell(0, 6, _pdf_safe(f"Status: {report.status.value}"))
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Summary")
    pdf.ln()
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 6, _pdf_safe(report.summary or "(none)"))
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Recommendations")
    pdf.ln()
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 6, _pdf_safe(report.recommendations or "(none)"))
    pdf.ln(2)

    snap = report.generated_snapshot or {}
    if isinstance(snap, dict) and snap.get("visit_found"):
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "Auto-generated metrics")
        pdf.ln()
        pdf.set_font("Helvetica", size=11)
        pdf.multi_cell(0, 6, _pdf_safe(f"Aggregate score: {snap.get('aggregate_score')}"))
        pdf.multi_cell(0, 6, _pdf_safe(f"Classroom observations: {snap.get('classroom_observation_count')}"))
        att = snap.get("attendance") if isinstance(snap.get("attendance"), dict) else {}
        pdf.multi_cell(
            0,
            6,
            _pdf_safe(
                f"Attendance window: {att.get('period_start')} → {att.get('period_end')} "
                f"(approved teacher rows: {att.get('approved_teacher_attendance_rows')}, "
                f"student daily rows: {att.get('student_daily_entries')})"
            ),
        )

    _append_kpi_chart_pdf(pdf, snap)

    out = pdf.output(dest="S")
    if isinstance(out, str):
        return out.encode("latin-1")
    return bytes(out)
