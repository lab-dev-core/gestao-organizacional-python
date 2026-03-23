# Adicionar Nova Rota no Backend

Adicione uma nova rota FastAPI ao backend seguindo os padrões do projeto.

## Contexto do Projeto

- **Framework**: FastAPI com MongoDB (Motor async)
- **Autenticação**: JWT com roles: `SUPERADMIN`, `ADMIN`, `FORMADOR`, `USER`
- **Tenant isolation**: Todos os dados filtrados por `tenant_id`
- **Arquivos de rota**: `projeto-backend/app/routes/`
- **Modelos Pydantic**: `projeto-backend/app/models/`
- **Utilitários**: `projeto-backend/app/utils/` (security, permissions, audit)

## Padrões a Seguir

1. Leia um arquivo de rota existente similar (ex: `routes/users.py` ou `routes/documents.py`) para entender o padrão
2. Use `get_current_user` do `utils/security.py` para autenticação
3. Filtre sempre por `tenant_id` do usuário autenticado
4. Registre ações de auditoria com `log_audit_action` do `utils/audit.py`
5. Retorne erros HTTP padronizados: 400, 401, 403, 404, 422, 500
6. Inclua a rota em `app/main.py` com o prefixo `/api`

## Tarefa

$ARGUMENTS

Crie a rota seguindo os padrões acima, incluindo:
- Endpoint(s) com tipo de operação (GET/POST/PUT/DELETE)
- Validação de permissões por role
- Isolamento por tenant
- Registro de auditoria para operações de escrita
- Testes unitários em `tests/`
