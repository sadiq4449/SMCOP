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

    out = pdf.output(dest="S")
    if isinstance(out, str):
        return out.encode("latin-1")
    return bytes(out)
