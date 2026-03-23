# Trabalhar com Acompanhamentos

Auxilie na implementação de funcionalidades relacionadas ao módulo de Acompanhamentos (follow-up records).

## Contexto do Módulo

Os **acompanhamentos** são registros de acompanhamento pastoral/formativo entre formadores e formandos. Cada registro contém:

- **Formador**: Usuário com role `FORMADOR` ou `ADMIN`
- **Formando**: Usuário com role `USER`
- **Frequência**: SEMANAL, QUINZENAL, MENSAL
- **Conteúdo**: Notas, observações, anexos
- **Status**: Vinculado ao ciclo formativo (`stage_cycle`)

## Arquivos Relevantes

```
projeto-backend/app/
├── models/acompanhamento.py          # Modelo de dados
├── routes/acompanhamentos.py         # Endpoints da API
projeto-frontend/src/
├── pages/Acompanhamentos.js          # Página de listagem
├── components/acompanhamentos/       # Componentes específicos
```

## Endpoints Disponíveis

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/acompanhamentos` | Listar com filtros |
| POST | `/api/acompanhamentos` | Criar novo |
| GET | `/api/acompanhamentos/{id}` | Buscar por ID |
| PUT | `/api/acompanhamentos/{id}` | Atualizar |
| DELETE | `/api/acompanhamentos/{id}` | Excluir |
| GET | `/api/acompanhamentos/{id}/pdf` | Exportar PDF |
| POST | `/api/acompanhamentos/{id}/attachments` | Upload de anexo |

## Regras de Negócio

1. Formadores só veem acompanhamentos dos seus próprios formandos
2. Admins veem todos os acompanhamentos do tenant
3. Formandos só veem seus próprios acompanhamentos
4. Anexos limitados ao plano do tenant (max_storage_gb)
5. PDF gerado com cabeçalho do tenant + dados do acompanhamento

## Tarefa

$ARGUMENTS

Implemente a funcionalidade solicitada seguindo as regras de negócio e padrões do projeto.
