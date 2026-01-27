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
  └── pages/ (Login, Register, Dashboard, Users, Documents, Videos, Locations, Functions, FormativeStages, AuditLogs, Profile, Acompanhamentos)
```

## User Personas
1. **Administrador**: Acesso total, gestão de usuários e configurações
2. **Formador**: Gerenciar documentos/vídeos formativos, criar acompanhamentos para seus formandos
3. **Usuário Comum**: Visualizar conteúdo permitido e seus próprios acompanhamentos

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
- [x] Módulo de Acompanhamentos
- [x] Exportação de Acompanhamentos para PDF

## O que foi implementado (27/01/2025)

### Backend
- API RESTful completa com FastAPI
- Autenticação JWT com access/refresh tokens
- CRUD para: Users, Locations, Functions, FormativeStages, Documents, Videos, Acompanhamentos
- Sistema de permissões granulares
- Upload de arquivos com validação
- Logs de auditoria automáticos
- Dashboard statistics endpoint
- **Exportação de Acompanhamentos para PDF** (individual e em lote)

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
- **Módulo de Acompanhamentos** com visualização por etapa formativa
- **Botões de exportação PDF** (individual no modal e em lote na lista)

## Backlog (P0/P1/P2)

### P0 (Crítico) - Concluídos
- [x] Bug de serialização ObjectId - CORRIGIDO
- [x] Exportação de Acompanhamentos para PDF - CONCLUÍDO

### P1 (Alto)
- [ ] Dashboard personalizado com progresso do usuário na etapa formativa
- [ ] Filtros por período na tela de acompanhamentos
- [ ] Upload opcional de foto no perfil do usuário
- [ ] Sistema de notificações em tempo real
- [ ] Versionamento de documentos
- [ ] Progresso de visualização de vídeos

### P2 (Médio)
- [ ] Comentários e avaliações em vídeos
- [ ] Busca global avançada
- [ ] Interface para visualizar logs de auditoria
- [ ] Backup automático
- [ ] Rate limiting
- [ ] Documentação Swagger

## Credenciais de Teste
- **Admin**: admin@test.com / admin123
- **Formador**: joao.formador@formapro.com / formador123

## Endpoints de Exportação PDF
- `GET /api/acompanhamentos/export/pdf` - Exporta todos os acompanhamentos (com filtros opcionais)
- `GET /api/acompanhamentos/{acomp_id}/pdf` - Exporta um acompanhamento individual
