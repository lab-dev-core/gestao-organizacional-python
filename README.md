# Sistema de Gestão Organizacional

Sistema completo para gestão organizacional com gerenciamento de usuários, documentos, vídeos, acompanhamentos e mais.

## Estrutura do Projeto

```
├── projeto-frontend/    # Aplicação React (Frontend)
├── projeto-backend/     # API FastAPI (Backend)
├── docker-compose.yml   # Orquestração dos containers
└── .env.example         # Variáveis de ambiente (exemplo)
```

## Executando com Docker (Recomendado)

A maneira mais fácil de executar o projeto completo:

```bash
# Copiar variáveis de ambiente
cp .env.example .env

# Subir todos os serviços
docker-compose up -d

# Ver logs
docker-compose logs -f
```

Acesse:
- **Frontend:** http://localhost
- **Backend API:** http://localhost:8000
- **Swagger Docs:** http://localhost:8000/docs

Para parar:
```bash
docker-compose down
```

## Executando Manualmente

### Pré-requisitos
- Node.js 18+
- Python 3.10+
- MongoDB

### Backend

```bash
cd projeto-backend
cp .env.example .env
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou .\venv\Scripts\activate no Windows
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

### Frontend

```bash
cd projeto-frontend
cp .env.example .env
npm install --legacy-peer-deps
npm start
```

## Credenciais Padrão

Ao iniciar o backend pela primeira vez, um admin é criado automaticamente:

- **Email:** admin@admin.com
- **Senha:** admin123

## Funcionalidades

- Autenticação JWT com roles (admin, formador, user)
- Recuperação de senha por email
- Gerenciamento de usuários
- Upload e gestão de documentos
- Upload e gestão de vídeos com tracking de progresso
- Sistema de acompanhamentos com exportação PDF
- Gerenciamento de localizações, funções e etapas formativas
- Logs de auditoria
- Tema claro/escuro
- Suporte a múltiplos idiomas

## Estrutura do Backend (v2.0)

```
projeto-backend/
├── app/
│   ├── main.py           # Aplicação FastAPI
│   ├── config.py         # Configurações
│   ├── database.py       # Conexão MongoDB
│   ├── models/           # Modelos Pydantic
│   ├── routes/           # Rotas da API
│   ├── services/         # Serviços (PDF, Email)
│   └── utils/            # Utilitários (auth, permissions)
├── server.py             # Entry point
├── Dockerfile
├── requirements.txt
└── .env.example
```

## Documentação

- [Frontend README](./projeto-frontend/README.md)
- [Backend README](./projeto-backend/README.md)
