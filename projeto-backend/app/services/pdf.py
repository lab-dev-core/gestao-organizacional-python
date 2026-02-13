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


def generate_psychological_assessment_pdf(report_data: dict) -> io.BytesIO:
    """
    Gera PDF de relatório de avaliação psicológica.
    Pode ser relatório anual (final de ano) ou avaliação individual.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'PsychTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=20,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#4F46E5')
    )
    subtitle_style = ParagraphStyle(
        'PsychSubtitle',
        parent=styles['Heading2'],
        fontSize=14,
        spaceBefore=25,
        spaceAfter=12,
        textColor=colors.HexColor('#1F2937')
    )
    section_style = ParagraphStyle(
        'PsychSection',
        parent=styles['Heading3'],
        fontSize=12,
        spaceBefore=15,
        spaceAfter=8,
        textColor=colors.HexColor('#374151')
    )
    normal_style = ParagraphStyle(
        'PsychNormal',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6,
        alignment=TA_JUSTIFY
    )
    label_style = ParagraphStyle(
        'PsychLabel',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#6B7280')
    )
    bold_style = ParagraphStyle(
        'PsychBold',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6,
        fontName='Helvetica-Bold'
    )

    elements = []

    user = report_data.get("user", {})
    reference_year = report_data.get("reference_year")
    assessments = report_data.get("assessments", [])
    acompanhamentos = report_data.get("acompanhamentos", [])
    current_stage = report_data.get("current_stage")

    # === CABEÇALHO ===
    if reference_year:
        title_text = f"Relatório Anual de Avaliação Psicológica - {reference_year}"
    else:
        title_text = "Relatório de Avaliação Psicológica"

    elements.append(Paragraph(title_text, title_style))
    elements.append(Paragraph(
        f"Gerado em: {datetime.now().strftime('%d/%m/%Y às %H:%M')}",
        label_style
    ))
    elements.append(Spacer(1, 20))

    # === DADOS DO MEMBRO ===
    elements.append(Paragraph("Dados do Membro", subtitle_style))

    user_info = [
        ["Nome:", user.get("full_name", "-")],
        ["E-mail:", user.get("email", "-")],
        ["Telefone:", user.get("phone", "-") or "-"],
        ["CPF:", user.get("cpf", "-") or "-"],
    ]

    if user.get("birth_date"):
        user_info.append(["Data de Nascimento:", format_date_br(user.get("birth_date", "-"))])

    if user.get("education_level"):
        user_info.append(["Escolaridade:", user.get("education_level", "-")])

    if current_stage:
        user_info.append(["Etapa Formativa Atual:", current_stage.get("name", "-")])

    info_table = Table(user_info, colWidths=[4.5*cm, 11.5*cm])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#4B5563')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 15))

    # === AVALIAÇÕES ===
    if assessments:
        elements.append(Paragraph("Avaliações Realizadas", subtitle_style))

        for idx, assessment in enumerate(assessments, 1):
            a_type = assessment.get("assessment_type", "")
            type_labels = {
                "annual": "Relatório Anual",
                "stage_evaluation": "Avaliação de Etapa",
                "follow_up": "Acompanhamento Psicológico"
            }
            type_label = type_labels.get(a_type, a_type)

            elements.append(Paragraph(
                f"Avaliação #{idx} - {type_label}",
                section_style
            ))

            # Status e avaliador
            status_labels = {
                "draft": "Rascunho",
                "in_progress": "Em Andamento",
                "completed": "Concluído",
                "reviewed": "Revisado"
            }
            status_label = status_labels.get(assessment.get("status", ""), assessment.get("status", "-"))

            eval_info = [
                ["Avaliador:", assessment.get("assessor_name", "-")],
                ["Status:", status_label],
            ]

            if assessment.get("stage_name"):
                eval_info.append(["Etapa:", assessment.get("stage_name")])
            if assessment.get("cycle_name"):
                eval_info.append(["Ciclo:", assessment.get("cycle_name")])

            eval_table = Table(eval_info, colWidths=[4.5*cm, 11.5*cm])
            eval_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#4B5563')),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            elements.append(eval_table)

            # Indicadores com pontuação
            scores = assessment.get("indicator_scores", [])
            if scores:
                elements.append(Spacer(1, 8))
                elements.append(Paragraph("Indicadores:", bold_style))

                score_header = [["Indicador", "Categoria", "Nota", "Observações"]]
                score_rows = []
                for s in scores:
                    score_val = s.get("score")
                    max_val = s.get("max_score", 5)
                    score_text = f"{score_val}/{max_val}" if score_val is not None else "-"
                    score_rows.append([
                        s.get("indicator_name", "-"),
                        s.get("category", "-"),
                        score_text,
                        s.get("observations", "-") or "-"
                    ])

                score_table = Table(
                    score_header + score_rows,
                    colWidths=[4*cm, 3*cm, 2*cm, 7*cm]
                )
                score_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F3F4F6')),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                ]))
                elements.append(score_table)

            # Score geral
            if assessment.get("overall_score") is not None:
                elements.append(Spacer(1, 8))
                elements.append(Paragraph(
                    f"Pontuação Geral: {assessment['overall_score']}%",
                    bold_style
                ))

            # Campos textuais
            text_fields = [
                ("summary", "Resumo Geral"),
                ("strengths", "Pontos Fortes"),
                ("areas_for_improvement", "Áreas de Melhoria"),
                ("recommendations", "Recomendações"),
                ("observations", "Observações"),
                ("final_opinion", "Parecer Final"),
            ]

            for field_key, field_label in text_fields:
                value = assessment.get(field_key)
                if value:
                    elements.append(Spacer(1, 6))
                    elements.append(Paragraph(f"{field_label}:", bold_style))
                    elements.append(Paragraph(
                        value.replace("\n", "<br/>"),
                        normal_style
                    ))

            # Recomendação para próxima etapa
            recommended = assessment.get("recommended_for_next_stage")
            if recommended is not None:
                elements.append(Spacer(1, 8))
                rec_text = "SIM" if recommended else "NÃO"
                rec_color = '#059669' if recommended else '#DC2626'
                elements.append(Paragraph(
                    f'Recomendado para próxima etapa: <font color="{rec_color}"><b>{rec_text}</b></font>',
                    normal_style
                ))

            # Separador entre avaliações
            if idx < len(assessments):
                elements.append(Spacer(1, 15))
                separator = Table([[""]], colWidths=[16*cm])
                separator.setStyle(TableStyle([
                    ('LINEABOVE', (0, 0), (-1, 0), 1, colors.HexColor('#E5E7EB')),
                ]))
                elements.append(separator)

    # === RESUMO DE ACOMPANHAMENTOS ===
    if acompanhamentos:
        elements.append(Spacer(1, 15))
        elements.append(Paragraph(
            f"Resumo de Acompanhamentos ({len(acompanhamentos)} registros)",
            subtitle_style
        ))

        for idx, acomp in enumerate(acompanhamentos[:10], 1):
            date_text = format_date_br(acomp.get("date", "-"))
            formador = acomp.get("formador_name", "-")
            elements.append(Paragraph(
                f"<b>{date_text}</b> - Formador: {formador}",
                normal_style
            ))
            content_preview = acomp.get("content", "")
            if len(content_preview) > 200:
                content_preview = content_preview[:200] + "..."
            elements.append(Paragraph(content_preview.replace("\n", "<br/>"), label_style))

        if len(acompanhamentos) > 10:
            elements.append(Paragraph(
                f"... e mais {len(acompanhamentos) - 10} acompanhamentos.",
                label_style
            ))

    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer
