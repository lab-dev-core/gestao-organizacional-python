# Revisão de Arquitetura — FormaPro (gestao-organizacional-python)

> Revisão conduzida por: Senior Staff Engineer
> Data: 2026-03-12
> Branch: `claude/architecture-review-Gdx6O`

---

## 🧠 Diagnóstico

O projeto é um sistema **SaaS multi-tenant** de gestão organizacional (FormaPro) composto por:

- **Backend**: FastAPI + Python 3.11 + Motor (async MongoDB)
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Infra**: Docker Compose com MongoDB 7

O sistema está funcionalmente maduro — autenticação JWT, RBAC, permissões granulares, audit log, multi-tenant, upload de arquivos, SSO (Google + Microsoft), exportação PDF, progresso de conteúdo. Isso é uma quantidade relevante de domínio implementado.

No entanto, existem **problemas estruturais que vão escalar negativamente à medida que o produto cresce**. Os problemas não são de sintoma — são de design. Este documento mapeia os 10 problemas críticos com prioridade e solução concreta.

---

## Sumário Executivo

| # | Problema | Severidade | Esforço de Correção |
|---|----------|-----------|---------------------|
| 1 | Rate limiting em memória (não distribuível) | 🔴 Alta | Médio |
| 2 | Segredos hardcoded / gestão insegura de config | 🔴 Alta | Baixo |
| 3 | Ausência de transações no MongoDB | 🔴 Alta | Médio |
| 4 | Acoplamento total entre rotas e lógica de negócio | 🟠 Média | Alto |
| 5 | Autenticação Social com chamada HTTP síncrona no fluxo de login | 🟠 Média | Baixo |
| 6 | Armazenamento local de arquivos (não escala horizontal) | 🟠 Média | Alto |
| 7 | Soft-delete sem estratégia de arquivamento / LGPD | 🟠 Média | Médio |
| 8 | Ausência de correlation ID / observabilidade real | 🟡 Baixa | Baixo |
| 9 | Backward compatibility de campo `role` → `roles` perpétuo | 🟡 Baixa | Médio |
| 10 | Sem estratégia de versionamento de API | 🟡 Baixa | Médio |

---

## ⚠️ Análise Detalhada e Trade-offs

---

### 1. Rate Limiting em Memória

**Localização**: `projeto-backend/app/main.py` — `RateLimitMiddleware`

**O problema:**
```python
# Estado armazenado em RAM do processo
request_counts: Dict[str, List[float]] = defaultdict(list)
```

Em qualquer deploy com mais de 1 instância (Kubernetes, Docker Swarm, múltiplos workers Uvicorn), cada processo tem seu próprio contador. Um atacante consegue `N_instâncias × 10` tentativas de login, não apenas 10.

**Trade-offs:**
- Manter como está: zero dependências externas, funciona para 1 processo, zero custo
- Redis: requer infra adicional, mas é a solução correta para qualquer escala horizontal

**Solução recomendada:**

Usar `slowapi` com Redis backend:

```python
# requirements.txt
slowapi==0.1.9
redis==5.0.1

# utils/rate_limit.py
from slowapi import Limiter
from slowapi.util import get_remote_address
import redis.asyncio as aioredis

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.REDIS_URL,  # "redis://localhost:6379"
)

# main.py
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# routes/auth.py
@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, ...):
    ...
```

Adicionar ao `docker-compose.yml`:
```yaml
redis:
  image: redis:7-alpine
  volumes:
    - redis_data:/data
  networks:
    - app-network
```

---

### 2. Gestão Insegura de Configuração / Segredos

**Localização**: `projeto-backend/app/config.py`

**O problema:**
```python
# Defaults inseguros que vão parar em produção
DEFAULT_SUPERADMIN_EMAIL: str = "admin@sistema.com"
DEFAULT_SUPERADMIN_PASSWORD: str = "Admin@123456"
JWT_SECRET_KEY: str = "your-secret-key-change-in-production"  # padrão documentado
CORS_ORIGINS: str = "*"  # padrão permite qualquer origem
```

Esses defaults são **armadilhas de segurança**. Se o `.env` não for configurado, o sistema sobe com credenciais conhecidas. O `JWT_SECRET_KEY` padrão é trivialmente explorável — qualquer um pode forjar tokens.

**Solução recomendada:**

```python
# config.py — Fazer startup falhar ruidosamente se segredos não estão configurados
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator, SecretStr

class Settings(BaseSettings):
    JWT_SECRET_KEY: SecretStr  # Sem default — falha se não configurado

    DEFAULT_SUPERADMIN_PASSWORD: SecretStr  # Sem default

    CORS_ORIGINS: str = "http://localhost:3000"  # Default restrito

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def jwt_secret_must_be_strong(cls, v: SecretStr) -> SecretStr:
        secret = v.get_secret_value()
        if len(secret) < 32:
            raise ValueError("JWT_SECRET_KEY deve ter pelo menos 32 caracteres")
        if secret in ("your-secret-key-change-in-production", "secret", "changeme"):
            raise ValueError("JWT_SECRET_KEY usa valor padrão inseguro")
        return v
```

Adicionar ao `docker-compose.yml` usando `secrets` do Docker:
```yaml
services:
  backend:
    secrets:
      - jwt_secret
secrets:
  jwt_secret:
    external: true
```

---

### 3. Ausência de Transações no MongoDB

**Localização**: `projeto-backend/app/routes/users.py`, `routes/stage_participations.py`

**O problema:**

Operações multi-step sem transação. Exemplo no cadastro de usuário:
```python
# 1. Cria o usuário
result = await db.users.insert_one(user_dict)

# 2. Loga a auditoria — se falhar aqui, o usuário existe sem log
await log_action(db, user_id=..., action="register", ...)

# 3. Atualiza jornada — se falhar aqui, estado inconsistente
await db.user_journeys.insert_one(journey_dict)
```

Se a conexão cair entre os passos, o banco fica em estado inconsistente. MongoDB suporta transações ACID desde v4.0 em replica sets.

**Trade-offs:**
- Transações: overhead de ~10-15% de latência, requer replica set
- Sem transações: operações são eventualmente inconsistentes, requer reconciliação manual

**Solução recomendada:**

```python
# database.py — Adicionar helper de transação
from contextlib import asynccontextmanager
from motor.motor_asyncio import AsyncIOMotorClientSession

@asynccontextmanager
async def transaction(client: AsyncIOMotorClient):
    async with await client.start_session() as session:
        async with session.start_transaction():
            try:
                yield session
            except Exception:
                await session.abort_transaction()
                raise

# routes/users.py
async def create_user(...):
    async with transaction(db_client) as session:
        result = await db.users.insert_one(user_dict, session=session)
        await log_action(db, ..., session=session)
        await db.user_journeys.insert_one(journey_dict, session=session)
        # Commit automático ao sair do bloco sem exceção
```

No `docker-compose.yml`, MongoDB precisa rodar como replica set (mesmo single-node):
```yaml
mongodb:
  image: mongo:7
  command: ["--replSet", "rs0", "--bind_ip_all"]
  # Adicionar healthcheck que inicializa o replica set
```

---

### 4. Lógica de Negócio nas Rotas (Acoplamento Total)

**Localização**: todos os arquivos em `routes/`

**O problema:**

As rotas misturam validação, lógica de negócio, acesso ao banco e serialização. Um exemplo representativo de `routes/users.py`:

```python
@router.put("/{user_id}")
async def update_user(user_id: str, user_update: UserUpdate, ...):
    # Busca no banco (data access)
    existing = await db.users.find_one(...)

    # Validação de negócio (business logic)
    if user_update.roles and current_user["roles"] != ["superadmin"]:
        if "admin" in user_update.roles and not is_admin:
            raise HTTPException(403, ...)

    # Mais lógica de negócio
    if user_update.formative_stage_id != existing.get("formative_stage_id"):
        await db.user_journeys.insert_one(...)  # side effect

    # Update no banco (data access)
    await db.users.update_one(...)

    # Audit (cross-cutting concern)
    await log_action(...)
```

Isso torna **testes unitários impossíveis** sem mockar MongoDB, **reutilização impossível** entre endpoints e **debugging difícil** quando lógica complexa está espalhada.

**Solução recomendada (Service Layer):**

```
app/
├── routes/       → HTTP concerns apenas (request/response, status codes)
├── services/     → Lógica de negócio (já existe parcialmente!)
│   ├── user_service.py
│   ├── document_service.py
│   └── ...
└── repositories/ → Acesso ao banco
    ├── user_repository.py
    └── ...
```

```python
# services/user_service.py
class UserService:
    def __init__(self, user_repo: UserRepository, audit_service: AuditService):
        self.user_repo = user_repo
        self.audit = audit_service

    async def update_user(self, user_id: str, update: UserUpdate, actor: User) -> User:
        existing = await self.user_repo.get_by_id(user_id)
        self._validate_role_change(update, actor, existing)

        if update.formative_stage_id != existing.formative_stage_id:
            await self._record_journey_transition(existing, update)

        updated = await self.user_repo.update(user_id, update)
        await self.audit.log("update_user", actor, updated)
        return updated

# routes/users.py — Rota fica limpa
@router.put("/{user_id}")
async def update_user(user_id: str, update: UserUpdate,
                      service: UserService = Depends(get_user_service),
                      current_user: User = Depends(get_current_user)):
    return await service.update_user(user_id, update, current_user)
```

---

### 5. SSO com Chamada HTTP Síncrona no Login

**Localização**: `projeto-backend/app/routes/auth.py`

**O problema:**

```python
# Durante o login, chamada HTTP bloqueante para Google/Microsoft
if provider == "google":
    response = requests.get(  # requests é SÍNCRONO em async handler!
        f"https://www.googleapis.com/oauth2/v3/tokeninfo?id_token={token}"
    )
```

`requests.get()` é uma chamada **síncrona bloqueante** dentro de um handler **async**. Isso bloqueia o event loop do Uvicorn pelo tempo da chamada de rede (tipicamente 100-500ms), degradando **todos os outros requests concorrentes**.

**Solução recomendada:**

```python
# Substituir requests por httpx (async)
import httpx

async def verify_google_token(token: str) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            "https://www.googleapis.com/oauth2/v3/tokeninfo",
            params={"id_token": token}
        )
        response.raise_for_status()
        return response.json()
```

Adicionar ao `requirements.txt`: `httpx==0.27.0`

---

### 6. Armazenamento de Arquivos em Filesystem Local

**Localização**: `projeto-backend/app/routes/files.py`, `docker-compose.yml`

**O problema:**

```yaml
# docker-compose.yml
volumes:
  - backend_uploads:/app/uploads
```

Arquivos salvos em volume local do container. Isso significa:
- **Zero escalabilidade horizontal** — instâncias adicionais não têm acesso aos arquivos
- **Backup manual** — responsabilidade do ops configurar backup do volume
- **CDN impossível** — latência de download via API em vez de edge
- Configuração para OneDrive existe mas não é o padrão

**Solução recomendada:**

A infra para OneDrive já existe em `services/onedrive.py`. O problema é que não é o default. Criar uma abstração `StorageService` com implementações intercambiáveis:

```python
# services/storage.py
from abc import ABC, abstractmethod

class StorageService(ABC):
    @abstractmethod
    async def upload(self, file_path: str, content: bytes, content_type: str) -> str:
        """Returns public URL"""

    @abstractmethod
    async def delete(self, file_path: str) -> None: ...

    @abstractmethod
    async def get_url(self, file_path: str) -> str: ...


class LocalStorageService(StorageService):
    """Para desenvolvimento local"""
    ...

class OneDriveStorageService(StorageService):
    """Para produção"""
    ...

class S3StorageService(StorageService):
    """Alternativa AWS"""
    ...

# Dependency injection — troca sem mudar rotas
def get_storage() -> StorageService:
    if settings.STORAGE_BACKEND == "onedrive":
        return OneDriveStorageService(...)
    elif settings.STORAGE_BACKEND == "s3":
        return S3StorageService(...)
    return LocalStorageService(...)
```

---

### 7. Soft-Delete sem Estratégia de Arquivamento / LGPD

**Localização**: `routes/users.py` — `DELETE /api/users/{user_id}`

**O problema:**

```python
# Usuário deletado fica com status "inactive" mas todos os dados permanecem
await db.users.update_one(
    {"id": user_id},
    {"$set": {"status": "inactive", "updated_at": datetime.utcnow()}}
)
```

Isso cria dois problemas:
1. **LGPD/GDPR**: Usuário tem direito ao esquecimento. "Inactive" não é esquecimento
2. **Queries**: Todos os endpoints precisam filtrar `status != inactive` manualmente (e alguns provavelmente esquecem)

**Solução recomendada:**

Implementar deleção em duas fases:
1. Soft-delete com `deleted_at` timestamp (não muda nada no comportamento atual)
2. Job de arquivamento que anonimiza dados após 30 dias (LGPD compliance)

```python
# models/user.py — Adicionar campo
deleted_at: Optional[datetime] = None
anonymized_at: Optional[datetime] = None

# utils/anonymization.py
async def anonymize_user(db, user_id: str):
    """Substitui dados pessoais por tokens irreversíveis — LGPD Art. 18"""
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "email": f"deleted_{user_id}@removed.invalid",
            "full_name": "[Removido]",
            "cpf": None,
            "phone": None,
            "birth_date": None,
            "photo_url": None,
            "anonymized_at": datetime.utcnow()
        }}
    )
```

---

### 8. Observabilidade Insuficiente — Sem Correlation ID

**Localização**: `projeto-backend/app/main.py` — `RequestLoggingMiddleware`

**O problema:**

```python
logger.info(f"[{status_code}] {method} {path} - {duration_ms:.1f}ms")
```

Log útil, mas sem correlation ID. Quando um request falha em produção, você tem:
- Stack trace com o erro
- Log de request com método + path
- Zero capacidade de correlacionar os dois sem timestamp exato

**Solução recomendada (5 linhas de mudança):**

```python
import uuid
from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar("request_id", default="")

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        request_id_var.set(request_id)
        request.state.request_id = request_id

        # Adicionar ao header de resposta para debugging
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id

        logger.info(f"[{request_id}] [{status_code}] {method} {path} - {duration_ms:.1f}ms")
        return response
```

Agora logs de erro e logs de request são correlacionáveis pelo `request_id`.

---

### 9. Migração `role` → `roles` Perpétua

**Localização**: `utils/security.py` — `get_user_roles()`, `normalize_user_roles()`

**O problema:**

```python
def get_user_roles(user: dict) -> list:
    """Suporte a campo legado 'role' (string) e novo 'roles' (lista)"""
    if "roles" in user and user["roles"]:
        return user["roles"]
    elif "role" in user and user["role"]:
        return [user["role"]]  # backward compat
    return []
```

Essa lógica está espalhada em múltiplos pontos. Cada novo dev que chega ao projeto precisa entender esse dualismo. O campo `role` legado deveria ter sido migrado com uma script de migration e removido.

**Solução recomendada:**

```python
# scripts/migrate_roles.py — Executar uma vez em produção
async def migrate_role_to_roles():
    """
    One-time migration: converte campo 'role' para 'roles' em todos os usuários.
    Após executar e verificar, remover campo 'role' e toda backward compat logic.
    """
    users_to_migrate = await db.users.find(
        {"role": {"$exists": True}, "roles": {"$exists": False}}
    ).to_list(None)

    for user in users_to_migrate:
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {"roles": [user["role"]]},
                "$unset": {"role": ""}
            }
        )
    print(f"Migrated {len(users_to_migrate)} users")

# Após migração: remover get_user_roles() e normalize_user_roles() e toda lógica legada
```

---

### 10. Ausência de Versionamento de API

**Localização**: `projeto-backend/app/routes/__init__.py`

**O problema:**

```python
app.include_router(auth_router, prefix="/api/auth")
app.include_router(users_router, prefix="/api/users")
```

Sem versionamento (`/api/v1/`), qualquer breaking change na API quebra todos os clientes. Com um frontend React já em produção, essa situação se torna um acoplamento rígido.

**Solução recomendada:**

```python
# routes/__init__.py
def setup_routes(app: FastAPI):
    v1_router = APIRouter(prefix="/api/v1")

    v1_router.include_router(auth_router, prefix="/auth", tags=["auth"])
    v1_router.include_router(users_router, prefix="/users", tags=["users"])
    # ...

    app.include_router(v1_router)

    # Alias de compatibilidade (deprecation period)
    legacy_router = APIRouter(prefix="/api", deprecated=True)
    legacy_router.include_router(auth_router, prefix="/auth")
    # ...
    app.include_router(legacy_router)
```

---

## ✅ Solução Recomendada — Roadmap Priorizado

### Sprint 1 — Segurança Crítica (1-2 semanas)

```
[ ] Fix 2: Remover defaults inseguros do config.py
         Fazer startup falhar se JWT_SECRET_KEY não configurado
         Escrever .env.example com placeholders claros

[ ] Fix 5: Substituir requests por httpx no SSO
         5 linhas de mudança, elimina blocking do event loop

[ ] Fix 8: Adicionar correlation ID ao middleware de logging
         < 10 linhas de mudança, melhoria imediata de observabilidade
```

### Sprint 2 — Resiliência de Dados (2-4 semanas)

```
[ ] Fix 3: Habilitar MongoDB replica set no docker-compose
         Adicionar helper de transação em database.py
         Proteger operações multi-step críticas (registro, deleção)

[ ] Fix 9: Executar migration script role → roles
         Remover toda backward compat logic após verificação

[ ] Fix 7: Adicionar campo deleted_at aos modelos
         Implementar script de anonimização para LGPD compliance
```

### Sprint 3 — Escalabilidade (4-8 semanas)

```
[ ] Fix 1: Integrar Redis para rate limiting distribuído (slowapi)

[ ] Fix 6: Abstrair StorageService com implementação OneDrive como default

[ ] Fix 4: Extrair Service Layer das rotas mais complexas (users, documents)
         Começar pelos endpoints com mais lógica de negócio

[ ] Fix 10: Adicionar prefix /api/v1/ com backward compat /api/
```

---

## 🔭 Próximos Passos — Além dos Bugs

### Features Mapeadas no `possiveis_mudancas.md` + Análise

| Feature | Complexidade | Risco Técnico | Dependência |
|---------|-------------|---------------|-------------|
| Notificações em tempo real | Alta | WebSocket ou SSE + Redis pub/sub | Fix 1 (Redis) |
| Dashboard progresso do formando | Média | Query aggregation pipeline | Nenhuma |
| IA para transcrição de acompanhamentos | Alta | Integração Whisper API / AssemblyAI | Abstração de serviço |
| Módulo de Férias | Baixa | CRUD simples | Nenhuma |
| Formulários avaliativos com gráficos | Média | Schema flexível no MongoDB | Nenhuma |
| Relatórios formativos | Média | Aggregation pipeline + PDF | Fix 6 (storage) |
| Versionamento de documentos | Média | Immutable records pattern | Fix 3 (transações) |

### Débitos Técnicos que Crescem se Não Endereçados

1. **Testes**: O projeto tem `pytest.ini` e `test_result.md` mas zero evidência de testes unitários nos arquivos de código. Sem service layer (Fix 4), testes unitários reais são impossíveis — só integração com banco real.

2. **Documentação da API**: FastAPI gera Swagger automaticamente em `/docs`. Adicionar `response_model`, `summary` e `description` nos decoradores de rota — custo zero, valor alto para integrações.

3. **Paginação cursor-based**: Atual paginação offset (`skip/limit`) degrada com volume. Em coleções com 100k+ documentos, `skip(50000)` é uma full scan. Migrar para cursor-based com `_id` como cursor quando o volume crescer.

4. **Background tasks**: Envio de email (reset de senha), geração de PDF e chamadas para OneDrive estão síncronas no request. Usar `BackgroundTasks` do FastAPI ou Celery para não bloquear a resposta.

```python
# Imediato, sem nova dependência
@router.post("/password-reset/request")
async def request_reset(email: str, background_tasks: BackgroundTasks, ...):
    token = create_reset_token(user)
    background_tasks.add_task(send_reset_email, email, token)
    return {"message": "Email enviado"}  # Retorna imediatamente
```

---

## Conclusão

O FormaPro tem uma base sólida de domínio — o modelo de negócio está bem mapeado e a maioria das features funcionais estão implementadas. Os problemas identificados não são erros de iniciante; são consequências naturais de um sistema que cresceu rápido com foco em features.

A prioridade absoluta é o **Sprint 1** (segurança). Os Fixes 2 e 5 podem ir a produção hoje mesmo, antes de qualquer outra mudança. O Fix 8 (correlation ID) é praticamente gratuito e melhora imediatamente a capacidade de debugar issues em produção.

O Fix 4 (service layer) é o mais trabalhoso mas é o que desbloqueia tudo: testes unitários, reutilização de lógica, onboarding de novos devs e manutenibilidade a longo prazo.

---

*Revisão gerada com base na análise estática completa de 50+ arquivos Python do projeto.*
