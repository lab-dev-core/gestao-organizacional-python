import io
from datetime import datetime
from typing import List
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY


def format_date_br(date_str: str) -> str:
    """Format date string to Brazilian format"""
    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
                  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
        return f"{date_obj.day} de {months[date_obj.month - 1]} de {date_obj.year}"
    except:
        return date_str


def generate_acompanhamento_pdf(acompanhamentos: List[dict], title: str = "Relatório de Acompanhamentos") -> io.BytesIO:
    """Generate PDF report for acompanhamentos"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)

    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=30,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#4F46E5')
    )
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        spaceBefore=20,
        spaceAfter=10,
        textColor=colors.HexColor('#1F2937')
    )
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6,
        alignment=TA_JUSTIFY
    )
    label_style = ParagraphStyle(
        'CustomLabel',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#6B7280')
    )

    elements = []

    # Title
    elements.append(Paragraph(title, title_style))
    elements.append(Paragraph(f"Gerado em: {datetime.now().strftime('%d/%m/%Y às %H:%M')}", label_style))
    elements.append(Spacer(1, 20))

    for idx, acomp in enumerate(acompanhamentos, 1):
        # Acompanhamento header
        elements.append(Paragraph(f"Acompanhamento #{idx}", heading_style))

        # Info table
        info_data = [
            ["Formando:", acomp.get("user_name", "-")],
            ["Formador:", acomp.get("formador_name", "-")],
            ["Data:", format_date_br(acomp.get("date", "-"))],
            ["Horário:", acomp.get("time", "-")],
            ["Local:", acomp.get("location", "-")],
            ["Frequência:", "Semanal" if acomp.get("frequency") == "weekly" else "Quinzenal"],
        ]

        info_table = Table(info_data, colWidths=[3*cm, 13*cm])
        info_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#4B5563')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(info_table)

        # Content
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("Relatório:", label_style))

        # Content box
        content_text = acomp.get("content", "").replace("\n", "<br/>")
        elements.append(Paragraph(content_text, normal_style))

        # Separator
        if idx < len(acompanhamentos):
            elements.append(Spacer(1, 15))
            separator_table = Table([[""]], colWidths=[16*cm])
            separator_table.setStyle(TableStyle([
                ('LINEABOVE', (0, 0), (-1, 0), 1, colors.HexColor('#E5E7EB')),
            ]))
            elements.append(separator_table)

    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer
