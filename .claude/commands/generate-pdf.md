# Gerar ou Modificar Relatório PDF

Crie ou modifique a geração de PDFs usando ReportLab no backend.

## Contexto do Projeto

- **Biblioteca**: ReportLab 4.0.0
- **Serviço de PDF**: `projeto-backend/app/services/pdf.py`
- **Endpoints que geram PDF**:
  - `GET /api/acompanhamentos/{id}/pdf` - Relatório de acompanhamento
  - `GET /api/acompanhamentos/report/pdf` - Relatório consolidado por formando
  - `GET /api/documents/{id}/pdf` - Export de documentos

## Padrões do Projeto

1. Leia `services/pdf.py` para ver os helpers existentes (`draw_header`, `draw_footer`, etc.)
2. Use a paleta de cores do projeto:
   - Primária: `#1a56db` (azul)
   - Fundo header: `#f8fafc`
   - Texto: `#1e293b`
3. Inclua cabeçalho com logo/nome do tenant, rodapé com paginação
4. Use `io.BytesIO` para retornar o PDF como `StreamingResponse`
5. Nome do arquivo no header: `Content-Disposition: attachment; filename="relatorio.pdf"`

## Estrutura Típica de Geração

```python
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table
from reportlab.lib.styles import getSampleStyleSheet
import io

def generate_report_pdf(data: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    # ... build content ...
    doc.build(elements)
    return buffer.getvalue()
```

## Tarefa

$ARGUMENTS

Implemente ou modifique a geração de PDF conforme solicitado, seguindo os padrões visuais do projeto.
