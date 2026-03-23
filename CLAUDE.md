# Gestão Organizacional — Contexto do Projeto

Sistema multi-tenant SaaS de gestão formativa (FormaPro). Backend FastAPI + MongoDB, frontend React 19.

## Estrutura

```
gestao-organizacional-python/
├── projeto-backend/        # FastAPI (Python 3.10+)
│   ├── app/
│   │   ├── main.py         # Setup, middleware, CORS, rate limiting
│   │   ├── config.py       # Variáveis de ambiente
│   │   ├── database.py     # Conexão MongoDB (Motor async) + índices
│   │   ├── models/         # Modelos Pydantic v2
│   │   ├── routes/         # Endpoints da API
│   │   ├── services/       # pdf.py, email.py, storage.py, onedrive.py
│   │   └── utils/          # security.py, permissions.py, audit.py
│   └── tests/              # pytest
├── projeto-frontend/       # React 19
│   └── src/
│       ├── pages/          # 18 páginas
│       ├── components/     # Layout + ShadCN UI
│       ├── contexts/       # AuthContext, ThemeContext, LanguageContext
│       └── hooks/
└── docker-compose.yml      # MongoDB 7, Redis 7, Backend, Frontend
```

## Stack

**Backend:** FastAPI 0.110, Motor 3.3 (MongoDB async), Pydantic v2, PyJWT, bcrypt, ReportLab, SlowAPI (rate limiting), Redis
**Frontend:** React 19, React Router 7, TailwindCSS, ShadCN/Radix UI, React Hook Form + Zod, Axios, Lucide React
**Infra:** Docker Compose, MongoDB 7, Redis 7, Nginx, GitHub Actions → Azure VM

## Roles e Autenticação

Roles: `SUPERADMIN`, `ADMIN`, `FORMADOR`, `USER`
JWT: access token 24h, refresh 7d, reset 1h
Autenticação: `get_current_user` de `utils/security.py`
Permissões: `utils/permissions.py`

## Padrões do Backend

- **Toda query filtra por `tenant_id`** — sem exceção
- Operações de escrita registram auditoria com `log_audit_action` (`utils/audit.py`)
- Rotas registradas em `app/main.py` com prefixo `/api`
- Erros HTTP padronizados: 400, 401, 403, 404, 422, 500
- Modelos seguem: `ModelCreate`, `ModelUpdate`, `ModelInDB`, `ModelResponse`
- Índices criados em `database.py` na função `create_indexes()`

## Padrões do Frontend

- Wrapper: `DashboardLayout`
- Componentes UI: ShadCN (`src/components/ui/`)
- Textos: `useLanguage()` do `LanguageContext`
- HTTP: Axios via `AuthContext` (interceptors de token automáticos)
- Formulários: React Hook Form + Zod
- Rotas registradas em `App.js` com proteção de auth
- Links no `Sidebar` com ícone Lucide

## Comandos

```bash
# Backend
cd projeto-backend
uvicorn server:app --reload --port 8000
pytest
pytest --cov=. --cov-report=term-missing

# Frontend
cd projeto-frontend
npm start
npm run build

# Docker
docker-compose up -d
docker-compose logs -f backend
docker-compose down
```

## Skills

### Adicionar rota no backend
Leia uma rota existente similar antes de criar. Use `get_current_user`, filtre por `tenant_id`, registre auditoria em escritas, adicione testes em `tests/`.

### Adicionar modelo Pydantic
Leia `models/user.py` para referência. Crie submodelos Create/Update/InDB/Response. Use enums de `models/enums.py`. Adicione `model_config = ConfigDict(populate_by_name=True)`. Registre índices em `database.py`.

### Adicionar página no frontend
Leia `pages/Users.js` para referência. Use `DashboardLayout`, componentes ShadCN, `useLanguage()`, loading states e tratamento de erros. Registre em `App.js` e adicione link no `Sidebar`.

### Trabalhar com Acompanhamentos
Registros entre formadores e formandos. Regras: formadores só veem seus formandos, admins veem todos do tenant, formandos só veem os próprios. Anexos limitados ao `max_storage_gb` do plano. PDF gerado via `services/pdf.py` com ReportLab.

### Gerar PDF
Use `services/pdf.py`. Cores: primária `#1a56db`, fundo header `#f8fafc`, texto `#1e293b`. Retorne como `StreamingResponse` com `io.BytesIO`. Inclua cabeçalho com nome do tenant e paginação no rodapé.

### Migração MongoDB
Scripts em `projeto-backend/scripts/`. Use Motor async. Padrão: `update_many` com `$set` para adicionar campos. Faça idempotente. Registre no audit log. Novos índices em `database.py > create_indexes()`.

### Criar/configurar tenant
Planos: FREE (10 users, 1GB), BASIC (50, 10GB), PRO (200, 50GB), ENTERPRISE (ilimitado, 500GB). Verifique unicidade do slug. Crie owner vinculado ao tenant.

### Revisão de segurança
Verifique: toda query filtra `tenant_id`, endpoints têm `get_current_user`, senhas nunca retornadas, upload valida MIME e tamanho, JWT_SECRET não usa default em produção, CORS com origens específicas, logs sem dados pessoais, auditoria em operações sensíveis.
