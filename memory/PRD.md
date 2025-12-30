# FormaPro - Sistema de Gestão Organizacional

## Problema Original
Sistema completo de gestão organizacional com módulos de Gestão de Usuários (admin, formador, usuário comum), Documentos Formativos, Vídeos Formativos, Locais, Funções e Etapas Formativas. Requisitos: Dashboard, JWT auth, PT/EN, tema claro/escuro.

## Arquitetura

### Stack Tecnológica
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Banco de Dados**: MongoDB
- **Autenticação**: JWT com refresh token

### Estrutura
```
/app/backend/server.py - API completa com 50+ endpoints
/app/frontend/src/
  ├── contexts/ (Auth, Theme, Language)
  ├── components/layout/ (Sidebar, Header, DashboardLayout)
  └── pages/ (Login, Register, Dashboard, Users, Documents, Videos, Locations, Functions, FormativeStages, AuditLogs, Profile)
```

## User Personas
1. **Administrador**: Acesso total, gestão de usuários e configurações
2. **Formador**: Gerenciar documentos/vídeos formativos
3. **Usuário Comum**: Visualizar conteúdo permitido

## Core Requirements
- [x] Autenticação JWT com refresh token
- [x] Gestão de usuários com campos completos
- [x] Permissões granulares (por local/função/etapa/usuário)
- [x] Upload de documentos (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT)
- [x] Upload/Link de vídeos (MP4, AVI, MOV, MKV, WEBM + YouTube/Vimeo)
- [x] Dashboard com estatísticas
- [x] Logs de auditoria
- [x] Tema claro/escuro
- [x] Idiomas PT/EN

## O que foi implementado (30/12/2024)

### Backend
- API RESTful completa com FastAPI
- Autenticação JWT com access/refresh tokens
- CRUD para: Users, Locations, Functions, FormativeStages, Documents, Videos
- Sistema de permissões granulares
- Upload de arquivos com validação
- Logs de auditoria automáticos
- Dashboard statistics endpoint

### Frontend
- Login/Register com validação
- Dashboard interativo com estatísticas
- Gestão completa de usuários
- Gestão de documentos com drag-and-drop
- Gestão de vídeos (upload + links externos)
- Player integrado para vídeos
- Gestão de Locais, Funções e Etapas Formativas
- Logs de auditoria
- Página de perfil
- Toggle tema claro/escuro
- Toggle idioma PT/EN
- Design responsivo

## Backlog (P0/P1/P2)

### P0 (Crítico)
- [x] Bug de serialização ObjectId - CORRIGIDO

### P1 (Alto)
- [ ] Sistema de notificações em tempo real
- [ ] Exportação de relatórios (Excel/PDF)
- [ ] Versionamento de documentos
- [ ] Progresso de visualização de vídeos

### P2 (Médio)
- [ ] Comentários e avaliações em vídeos
- [ ] Busca global avançada
- [ ] Backup automático
- [ ] Rate limiting
- [ ] Documentação Swagger

## Próximas Tarefas
1. Implementar sistema de notificações
2. Adicionar exportação de relatórios
3. Implementar versionamento de documentos
4. Criar documentação da API
