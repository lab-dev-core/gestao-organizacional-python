# Sistema de Gestão Organizacional - Backend

API backend do Sistema de Gestão Organizacional, desenvolvida com FastAPI e MongoDB.

## Tecnologias

- **FastAPI** 0.110.1
- **Uvicorn** 0.25.0
- **MongoDB** (Motor async driver)
- **PyJWT** 2.10.1 (autenticação)
- **Bcrypt** 4.1.3 (hash de senhas)
- **ReportLab** (geração de PDFs)
- **Pydantic** (validação de dados)

## Pré-requisitos

- Python 3.10+
- MongoDB rodando localmente ou em cloud
- pip ou pipenv

## Instalação

```bash
# Criar ambiente virtual (recomendado)
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
.\venv\Scripts\activate  # Windows

# Instalar dependências
pip install -r requirements.txt
```

## Configuração

Configure as variáveis de ambiente necessárias:

```bash
export MONGODB_URL="mongodb://localhost:27017"
export JWT_SECRET="sua-chave-secreta"
export JWT_ALGORITHM="HS256"
```

## Executando o Servidor

```bash
# Modo de desenvolvimento
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

A API estará disponível em [http://localhost:8000](http://localhost:8000)

Documentação interativa (Swagger): [http://localhost:8000/docs](http://localhost:8000/docs)

## Estrutura do Projeto

```
projeto-backend/
├── server.py           # Aplicação principal FastAPI
├── requirements.txt    # Dependências Python
├── backend_test.py     # Testes de integração
├── uploads/            # Armazenamento de arquivos
│   ├── documents/      # Documentos enviados
│   ├── videos/         # Vídeos enviados
│   └── photos/         # Fotos de perfil
├── tests/              # Testes unitários
└── test_reports/       # Relatórios de teste
```

## Endpoints da API

### Autenticação (`/api/auth/`)
- `POST /register` - Registro de usuário
- `POST /login` - Login
- `POST /refresh` - Refresh token
- `GET /me` - Usuário atual

### Usuários (`/api/users/`)
- `GET /users` - Listar usuários
- `GET /users/{id}` - Buscar usuário
- `POST /users` - Criar usuário
- `PUT /users/{id}` - Atualizar usuário
- `DELETE /users/{id}` - Remover usuário

### Documentos (`/api/documents/`)
- `GET /documents` - Listar documentos
- `POST /documents` - Upload de documento
- `GET /documents/{id}/download` - Download

### Vídeos (`/api/videos/`)
- `GET /videos` - Listar vídeos
- `POST /videos` - Criar/upload vídeo
- `POST /videos/{id}/progress` - Atualizar progresso

### Acompanhamentos (`/api/acompanhamentos/`)
- `GET /acompanhamentos` - Listar acompanhamentos
- `POST /acompanhamentos` - Criar acompanhamento
- `GET /acompanhamentos/{id}/pdf` - Exportar PDF

### Outros
- `GET /api/locations` - Localizações
- `GET /api/functions` - Funções
- `GET /api/formative-stages` - Etapas formativas
- `GET /api/audit-logs` - Logs de auditoria
- `GET /api/stats/dashboard` - Estatísticas

## Testes

```bash
# Executar testes
pytest

# Com cobertura
pytest --cov=. --cov-report=html
```

## Roles de Usuário

- **admin** - Acesso total ao sistema
- **formador** - Gerencia formandos e acompanhamentos
- **user** - Acesso básico (formando)
