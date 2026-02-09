# Configuracao CloudPanel - Backend API

## Problema: Erros 403 (Forbidden) em todas as requisicoes

Os erros 403 acontecem porque o CloudPanel/Nginx nao esta tratando corretamente
as requisicoes CORS (Cross-Origin Resource Sharing) entre o frontend e o backend.

### Causa Raiz

Quando o frontend (`https://app.dev-core.online`) faz requisicoes para o backend
(`https://back.dev-core.online`), o browser envia primeiro uma requisicao **OPTIONS**
(preflight). Se o Nginx do CloudPanel nao responde corretamente esse preflight,
o browser bloqueia todas as requisicoes com erro 403.

---

## Passo 1: Configurar o Vhost no CloudPanel

Acesse o CloudPanel e edite a configuracao do vhost do site `back.dev-core.online`.

No CloudPanel, va em:
**Sites > back.dev-core.online > Vhost > aba "Nginx Directives"**

Adicione o seguinte bloco **DENTRO do bloco `location /`** do seu vhost:

```nginx
# ================================================
# CORS - Permitir requisicoes do frontend
# ================================================

# Tratar requisicoes OPTIONS (preflight CORS)
if ($request_method = 'OPTIONS') {
    add_header 'Access-Control-Allow-Origin' 'https://app.dev-core.online' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Accept, Origin, X-Requested-With' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    add_header 'Access-Control-Max-Age' 3600 always;
    add_header 'Content-Type' 'text/plain; charset=utf-8' always;
    add_header 'Content-Length' 0 always;
    return 204;
}

# Headers CORS para todas as respostas
add_header 'Access-Control-Allow-Origin' 'https://app.dev-core.online' always;
add_header 'Access-Control-Allow-Credentials' 'true' always;
```

### Exemplo completo de configuracao do vhost no CloudPanel:

```nginx
location / {
    # CORS preflight
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' 'https://app.dev-core.online' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Accept, Origin, X-Requested-With' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Max-Age' 3600 always;
        add_header 'Content-Type' 'text/plain; charset=utf-8' always;
        add_header 'Content-Length' 0 always;
        return 204;
    }

    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Max body size para upload de arquivos
    client_max_body_size 500M;
}
```

---

## Passo 2: Configurar o arquivo .env.production

Na pasta do backend no servidor, crie o arquivo `.env.production`:

```bash
cp .env.production.example .env.production
```

Edite o `.env.production` e configure:

```env
ENVIRONMENT=production
MONGO_URL=mongodb://admin:SUA_SENHA@localhost:27017/
DB_NAME=gestao_organizacional
JWT_SECRET=GERE_UMA_CHAVE_SECRETA_FORTE_AQUI
CORS_ORIGINS=https://app.dev-core.online
FRONTEND_URL=https://app.dev-core.online
SUPERADMIN_EMAIL=seu-email@exemplo.com
SUPERADMIN_PASSWORD=uma-senha-forte-aqui
```

**IMPORTANTE**: Altere o `JWT_SECRET` para uma chave secreta forte e unica!

Para gerar uma chave secreta:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

---

## Passo 3: Iniciar o backend

```bash
# Na pasta do backend
cd projeto-backend

# Definir o ambiente
export ENVIRONMENT=production

# Instalar dependencias
pip install -r requirements.txt

# Iniciar o servidor
python -m app.server
```

Ou com um gerenciador de processos como PM2 ou systemd:

```bash
# Com PM2 (se instalado)
pm2 start "python -m app.server" --name gestao-backend

# Verificar se esta rodando
pm2 status
```

---

## Passo 4: Testar a conexao

### Teste 1: Health check (sem autenticacao)
```bash
curl https://back.dev-core.online/health
```
Resposta esperada: `{"status": "healthy", "timestamp": "..."}`

### Teste 2: Debug CORS (sem autenticacao)
```bash
curl https://back.dev-core.online/debug/cors
```
Resposta esperada: JSON com informacoes de CORS configuradas

### Teste 3: Preflight OPTIONS
```bash
curl -X OPTIONS https://back.dev-core.online/api/stats/dashboard \
  -H "Origin: https://app.dev-core.online" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization" \
  -v
```
Resposta esperada: HTTP 204 com headers `Access-Control-Allow-Origin`

### Teste 4: Login
```bash
curl -X POST https://back.dev-core.online/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "superadmin@sistema.com", "password": "superadmin123"}'
```

---

## Passo 5: Reiniciar o Nginx

Apos alterar a configuracao do vhost no CloudPanel:

```bash
sudo systemctl restart nginx
# ou
sudo nginx -t && sudo nginx -s reload
```

---

## Checklist de Verificacao

- [ ] `.env.production` criado com CORS_ORIGINS correto
- [ ] ENVIRONMENT=production definido
- [ ] JWT_SECRET alterado para valor seguro
- [ ] Vhost do CloudPanel configurado com CORS headers
- [ ] Nginx reiniciado apos alteracoes
- [ ] Backend rodando na porta 8000
- [ ] Teste de health check passando
- [ ] Teste de preflight OPTIONS retornando 204
- [ ] Login funcionando via curl
