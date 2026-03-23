# Adicionar Nova Página no Frontend

Crie uma nova página React para o frontend seguindo os padrões do projeto.

## Contexto do Projeto

- **Framework**: React 19 com React Router DOM 7
- **Estilo**: TailwindCSS + ShadCN/Radix UI (`src/components/ui/`)
- **Formulários**: React Hook Form + Zod para validação
- **HTTP**: Axios com interceptors de auth em `contexts/AuthContext.js`
- **Ícones**: Lucide React
- **Internacionalização**: `contexts/LanguageContext.js`
- **Tema**: `contexts/ThemeContext.js` (light/dark mode)

## Padrões a Seguir

1. Leia uma página existente similar (ex: `pages/Users.js`, `pages/Documents.js`)
2. Use `DashboardLayout` como wrapper principal
3. Gerencie estado com `useState` + chamadas Axios ao backend
4. Use componentes ShadCN: `Button`, `Input`, `Dialog`, `Table`, `Card`, etc.
5. Implemente loading states e tratamento de erros com toasts
6. Adicione suporte a i18n com `useLanguage()` para textos da UI
7. Registre a rota em `App.js` com proteção de autenticação
8. Adicione o link no `Sidebar` com o ícone Lucide adequado

## Tarefa

$ARGUMENTS

Crie a página completa com listagem, filtros, formulário de criação/edição e exclusão, seguindo os padrões acima.
