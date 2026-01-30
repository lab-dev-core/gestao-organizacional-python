# Sistema de Gestão Organizacional - Frontend

Aplicação frontend do Sistema de Gestão Organizacional, desenvolvida com React.

## Tecnologias

- **React** 19.0.0
- **TailwindCSS** 3.4.17
- **Radix UI** + **ShadCN** (componentes)
- **React Router DOM** 7.5.1
- **React Hook Form** + **Zod** (formulários e validação)
- **Axios** (requisições HTTP)
- **Lucide React** (ícones)

## Pré-requisitos

- Node.js 18+
- npm ou yarn

## Instalação

```bash
# Instalar dependências
npm install
```

## Executando o Projeto

```bash
# Modo de desenvolvimento
npm start
```

A aplicação estará disponível em [http://localhost:3000](http://localhost:3000)

## Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm start` | Inicia o servidor de desenvolvimento |
| `npm test` | Executa os testes |
| `npm run build` | Gera build de produção |

## Estrutura do Projeto

```
src/
├── components/
│   ├── layout/          # Componentes de layout (Header, Sidebar, DashboardLayout)
│   └── ui/              # Componentes UI (ShadCN)
├── contexts/            # Context providers (Auth, Theme, Language)
├── hooks/               # Custom hooks
├── lib/                 # Utilitários
└── pages/               # Páginas da aplicação
```

## Páginas

- **Login** - Autenticação de usuários
- **Register** - Cadastro de novos usuários
- **Dashboard** - Painel principal com estatísticas
- **Users** - Gerenciamento de usuários
- **Documents** - Gerenciamento de documentos
- **Videos** - Gerenciamento de vídeos
- **Acompanhamentos** - Gestão de acompanhamentos
- **Locations** - Gerenciamento de localizações
- **Functions** - Gerenciamento de funções
- **FormativeStages** - Etapas formativas
- **AuditLogs** - Logs de auditoria
- **Profile** - Perfil do usuário

## Configuração do Backend

Por padrão, o frontend espera que o backend esteja rodando em `http://localhost:8000`. Para alterar, modifique as configurações de API no `AuthContext.js`.

## Build de Produção

```bash
npm run build
```

Os arquivos de produção serão gerados na pasta `build/`.
