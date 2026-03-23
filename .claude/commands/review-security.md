# Revisão de Segurança do Código

Analise o código para identificar vulnerabilidades de segurança específicas deste projeto.

## Checklist de Segurança do Projeto

### Autenticação & Autorização
- [ ] Todos os endpoints protegidos usam `get_current_user`
- [ ] Permissões verificadas antes de operações sensíveis
- [ ] Refresh tokens invalidados corretamente no logout
- [ ] Senhas nunca retornadas nas respostas da API
- [ ] Reset tokens têm expiração de 1 hora

### Isolamento Multi-Tenant
- [ ] Todas as queries filtram por `tenant_id`
- [ ] Nenhum dado cross-tenant sendo exposto
- [ ] SUPERADMIN operations verificadas explicitamente

### Validação de Entrada
- [ ] Upload de arquivos valida tipo MIME e tamanho
- [ ] Campos de texto sanitizados (XSS prevention)
- [ ] Injeção NoSQL impossível (uso de Pydantic para queries)
- [ ] Limites de rate limiting configurados para endpoints críticos

### Configuração
- [ ] `JWT_SECRET` não usa valor padrão em produção
- [ ] `SUPERADMIN_PASSWORD` não usa valor padrão em produção
- [ ] CORS configurado com origens específicas (não `*`)
- [ ] Debug mode desabilitado em produção

### Dados Sensíveis
- [ ] Logs não contêm senhas, tokens ou dados pessoais
- [ ] Audit log registra operações sensíveis
- [ ] CPF/dados pessoais armazenados conforme LGPD

## Arquivos Críticos para Revisar

- `projeto-backend/app/utils/security.py`
- `projeto-backend/app/utils/permissions.py`
- `projeto-backend/app/config.py`
- `projeto-backend/app/routes/auth.py`

## Tarefa

$ARGUMENTS

Revise o código/arquivo especificado contra o checklist acima. Reporte todos os problemas encontrados com:
1. Localização exata (arquivo:linha)
2. Descrição da vulnerabilidade
3. Risco (Crítico/Alto/Médio/Baixo)
4. Correção recomendada
