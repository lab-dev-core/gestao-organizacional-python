# Sistema de Gestão Organizacional

Sistema completo para gestão organizacional com gerenciamento de usuários, documentos, vídeos, acompanhamentos e mais.

## Estrutura do Projeto

Este repositório contém dois projetos independentes:

```
├── projeto-frontend/    # Aplicação React (Frontend)
└── projeto-backend/     # API FastAPI (Backend)
```

## Projetos

### Frontend (`projeto-frontend/`)

Aplicação web desenvolvida em React com TailwindCSS e componentes ShadCN.

```bash
cd projeto-frontend
npm install
npm start
```

Acesse: http://localhost:3000

[Ver documentação completa do Frontend](./projeto-frontend/README.md)

### Backend (`projeto-backend/`)

API REST desenvolvida em Python com FastAPI e MongoDB.

```bash
cd projeto-backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

Acesse: http://localhost:8000/docs

[Ver documentação completa do Backend](./projeto-backend/README.md)

## Executando o Sistema Completo

1. **Inicie o MongoDB** (necessário para o backend)

2. **Inicie o Backend:**
   ```bash
   cd projeto-backend
   uvicorn server:app --reload --port 8000
   ```

3. **Inicie o Frontend:**
   ```bash
   cd projeto-frontend
   npm start
   ```

## Funcionalidades

- Autenticação JWT com roles (admin, formador, user)
- Gerenciamento de usuários
- Upload e gestão de documentos
- Upload e gestão de vídeos com tracking de progresso
- Sistema de acompanhamentos com exportação PDF
- Gerenciamento de localizações, funções e etapas formativas
- Logs de auditoria
- Tema claro/escuro
- Suporte a múltiplos idiomas
