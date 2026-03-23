# Criar ou Configurar Tenant

Auxilie na criação, configuração ou troubleshooting de um tenant (organização) no sistema.

## Estrutura de um Tenant

```python
{
  "name": str,           # Nome da organização
  "slug": str,           # Identificador único (URL-safe)
  "plan": str,           # FREE | BASIC | PRO | ENTERPRISE
  "max_users": int,      # Limite de usuários
  "max_storage_gb": int, # Limite de armazenamento
  "is_active": bool,
  "owner_id": str        # ID do admin principal
}
```

## Planos Disponíveis

| Plano      | Usuários | Storage |
|------------|----------|---------|
| FREE       | 10       | 1 GB    |
| BASIC      | 50       | 10 GB   |
| PRO        | 200      | 50 GB   |
| ENTERPRISE | Ilimitado| 500 GB  |

## Endpoints Relevantes

- `POST /api/tenants` - Criar tenant (SUPERADMIN)
- `GET /api/tenants` - Listar tenants (SUPERADMIN)
- `PUT /api/tenants/{id}` - Atualizar tenant (SUPERADMIN)
- `POST /api/auth/register` - Registrar primeiro usuário (owner)

## Arquivos Relacionados

- `projeto-backend/app/routes/tenants.py`
- `projeto-backend/app/models/tenant.py`
- `projeto-backend/scripts/` - Scripts de setup do banco

## Tarefa

$ARGUMENTS

Execute a operação de tenant solicitada, verificando:
1. Unicidade do slug
2. Limites do plano configurados corretamente
3. Usuário owner criado e vinculado
4. Índices MongoDB criados para o novo tenant
