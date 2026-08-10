# POMI Backend - Planejador Ominira

[![Lint and Format](https://github.com/ominira-unicamp/pomi-backend/actions/workflows/lint-and-format.yml/badge.svg?branch=main)](https://github.com/ominira-unicamp/pomi-backend/actions/workflows/lint-and-format.yml)
[![Deploy to GCP](https://github.com/ominira-unicamp/pomi-backend/actions/workflows/deploy.yml/badge.svg)](https://github.com/ominira-unicamp/pomi-backend/actions/workflows/deploy.yml)
![GitHub last commit (branch)](https://img.shields.io/github/last-commit/ominira-unicamp/pomi-backend/main)
![GitHub contributors](https://img.shields.io/github/contributors/ominira-unicamp/pomi-backend)

Bom dia, boa tarde, boa noite, bem vindo ao backend do pranejador da ominira, que tem uma função dupla, ser uma fonte de dados academicos da unicamp para quem quiser, e ser o backend do planejador academico da ominira, feito de aluno para alunos.

## Índice

- [Tecnologias](#tecnologias)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Executando o Projeto](#executando-o-projeto)
- [Estrutura do Projeto](#estrutura-do-projeto)

## Sobre o Projeto

## Tecnologias

- **Runtime:** Node.js
- **Framework:** Express 5
- **Linguagem:** TypeScript
- **ORM:** Prisma 7
- **Banco de Dados:** PostgreSQL
- **Validação:** Zod
- **Documentação:** OpenAPI/Swagger (Scalar)
- **Autenticação:** OpenID Connect com Keycloak e validação JWT via JWKS (`jose`)
- **Segurança:** Helmet, CORS
- **Containerização:** Docker & Docker Compose

## Pré-requisitos

- Node.js (v18+)
- npm ou yarn
- Docker e Docker Compose (opcional, para desenvolvimento com containers)
- PostgreSQL (se não usar Docker)

## Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/ominira-unicamp/pomi-backend.git
cd pomi-backend
```

### 2. Instale as dependências

```bash
npm install
```

## Configuração

### Variáveis de Ambiente

Crie um arquivo `.env`, ou `.docker.env` caso utilize o docker, na raiz do projeto conforme o `.env.template`.

Com autenticação habilitada, configure `KEYCLOAK_ISSUER` e
`KEYCLOAK_AUDIENCE=pomi-api`. `DISABLED_AUTH=true` é aceito somente fora de
produção.

## Executando o Projeto

Para iniciar o ambiente de desenvolvimento em um ambiente com docker:

```bash
# Inicie o banco de dados PostgreSQL localmente ou via Docker
docker compose up db -d

# Execute as migrations
npx prisma migrate dev

# Gere o cliente Prisma
npx prisma generate

# Inicie o servidor em modo desenvolvimento
npm run dev
```

Para executar PostgreSQL, Keycloak e API juntos, preencha `.docker.env` a partir
de `.env.template` e execute `docker compose up --build`. Esse Compose usa a
configuração declarativa em `../pomi-infra/slices/pomi/keycloak`; portanto, os
dois repositórios devem estar lado a lado. O realm `pomi`, o client público
`pomi-frontend` e a audiência `pomi-api` são reconciliados pelo serviço
transitório `keycloak-config`. O console local fica em `http://localhost:8080`.

### Injeção de dados acadêmicos

O injetor lê por padrão `./prisma/seed.json`. Outro arquivo pode ser
informado por `ACADEMIC_DATA_INPUT`.

```bash
npm run inject:academic-data
```

### Acessando a Documentação

Após iniciar o servidor, acesse a documentação interativa da API:

- **Swagger UI:** http://localhost:3000/docs
- **OpenAPI JSON:** http://localhost:3000/openapi.json

## Estrutura do Projeto

```
pomi-backend/
├── prisma/
│   ├── schema.prisma     # Schema do banco de dados
│   ├── migrations/       # Migrations do Prisma
│   └── generated/        # Arquivos gerados (client, zod schemas)
├── scripts/
│   └── injects/          # Scripts de injeção de dados
├── src/
│   ├── index.ts          # Entry point da aplicação
│   ├── auth.ts           # Configuração de autenticação
│   ├── Controllers.ts    # Composição dos módulos da API
│   ├── OpenApi.ts        # Configuração OpenAPI
│   ├── PrismaClient.ts   # Instância do Prisma
│   ├── modules/          # Domínios da API
│   │   ├── academic/     # Referências acadêmicas compartilhadas
│   │   ├── catalog/      # Catálogos e estruturas curriculares
│   │   ├── identity/     # Identidade e autorização
│   │   ├── planning/     # Estudantes e planejamentos
│   │   └── schedule/     # Caderno de horário e calendário
│   ├── Middlewares/      # Middlewares Express
│   └── openapi/          # Builders para OpenAPI
├── .env
├── docker-compose.yaml
├── package.json
├── prisma.config.ts
└── tsconfig.json
```

## LICENÇA

O projeto está licenciado pelos termos da AGPL v3.0, para informações completas ver [licença](https://github.com/ominira-unicamp/pomi-backend/blob/main/LICENSE).
