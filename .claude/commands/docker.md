# Gerenciar Serviços Docker

Gerencie os serviços Docker do projeto (MongoDB, Redis, Backend, Frontend).

## Serviços Disponíveis

| Serviço    | Porta  | Descrição                        |
|------------|--------|----------------------------------|
| backend    | 8000   | FastAPI (Python)                 |
| frontend   | 3000   | React                            |
| mongodb    | 27017  | MongoDB 7                        |
| redis      | 6379   | Redis 7 (rate limiting/cache)    |

## Comandos Comuns

```bash
# Subir todos os serviços
docker-compose up -d

# Subir serviço específico
docker-compose up -d backend

# Ver logs em tempo real
docker-compose logs -f backend

# Parar todos os serviços
docker-compose down

# Rebuild e subir
docker-compose up -d --build backend

# Status dos containers
docker-compose ps

# Acessar shell do container
docker-compose exec backend bash
docker-compose exec mongodb mongosh
```

## Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:
- `MONGODB_URL` - Conexão com MongoDB
- `JWT_SECRET` - Chave secreta para tokens JWT (mín. 32 chars)
- `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` - Credenciais do superadmin

## Tarefa

$ARGUMENTS

Execute a operação Docker solicitada e reporte o resultado, incluindo logs relevantes em caso de erro.
