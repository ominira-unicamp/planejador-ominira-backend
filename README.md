# POMI Backend Workspace

[![Lint and Format](https://github.com/ominira-unicamp/pomi-backend/actions/workflows/lint-and-format.yml/badge.svg?branch=main)](https://github.com/ominira-unicamp/pomi-backend/actions/workflows/lint-and-format.yml)
[![Deploy to GCP](https://github.com/ominira-unicamp/pomi-backend/actions/workflows/deploy.yml/badge.svg)](https://github.com/ominira-unicamp/pomi-backend/actions/workflows/deploy.yml)
![GitHub last commit (branch)](https://img.shields.io/github/last-commit/ominira-unicamp/pomi-backend/main)
![GitHub contributors](https://img.shields.io/github/contributors/ominira-unicamp/pomi-backend)

Este workspace reúne a API pública de dados universitários, a API de recursos pessoais do POMI, o schema compartilhado do banco e os processos de injeção.

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
# Inicie o banco e aplique as migrations
docker compose up db db-migrate -d

# Execute as migrations
npm run prisma:migrate:dev

# Gere o cliente Prisma
npm run prisma:generate

# Inicie as APIs em terminais separados
npm run dev:data
npm run dev:app
```

Para executar PostgreSQL, Keycloak e as duas APIs, preencha `.docker.env` a partir
de `.env.template` e execute `docker compose up --build`. A POMI Data API fica em
`http://localhost:3000` e a POMI App API em `http://localhost:3001`. Esse Compose usa a
configuração declarativa em `../pomi-infra/slices/pomi/keycloak` e o tema em
`../pomi-keycloak-theme/theme/pomi`; portanto, os três projetos devem estar
lado a lado. O realm `pomi`, o client público
`pomi-frontend` e a audiência `pomi-api` são reconciliados pelo serviço
transitório `keycloak-config`. O console local fica em `http://localhost:8080`.

### Orquestração de obtenções e injeções

O pacote `@pomi/injection` fornece o CLI `pomi-injection`. Cada injection é
predefinida no registry do pacote: a obtenção roda em um subprocesso externo e
a persistência é executada pelo serviço correspondente. O JSON configura a
agenda, o comando de obtenção, o arquivo de entrada e as opções tipadas da função.

Copie `packages/injection/injections.example.json`, ajuste os comandos e use:

```bash
npm run injection:validate
npm run injection:list
npm run injection:run -- academic-data
npm run injection:watch

# Enfileirar uma execução manual (retorna o ID do job)
npm run injection:request -- academic-data all
npm run notifier:request

# Consultar o estado de um job
npm run injection:job-status -- <job-id>
npm run notifier:job-status -- <job-id>
```

O `watch` executa uma injection por vez, registra falhas e aguarda a próxima
ocorrência cron definida em cada entrada. As expressões usam cinco campos e o
fuso horário local do processo (configurável por `TZ`). O diretório de dados e
o lock do scheduler ficam sob a raiz configurada, sem remover arquivos
existentes. Os tipos predefinidos são
`academic-data`, `calendar`, `catalogs`, `catalog-disciplines`, `daily-menus`,
`exchange-notices` e `suggestions`.
As alterações persistidas são emitidas como eventos JSON pelo Pino no stdout;
o nível pode ser ajustado com `LOG_LEVEL` (ou, por compatibilidade,
`POMI_INJECTION_LOG_LEVEL`). O envio opcional para OpenObserve usa
`OPENOBSERVE_URL` e `OPENOBSERVE_AUTH`, ou `OPENOBSERVE_USER` e
`OPENOBSERVE_PASSWORD`; o stream padrão é `pomi-injection-logs` e pode ser
alterado com `OPENOBSERVE_STREAM`. Sem `OPENOBSERVE_URL`, nenhum envio remoto
é realizado.

### Logs e telemetria das APIs

As APIs POMI Data e POMI App emitem logs JSON no stdout para cada requisição,
com `requestId`, método, rota parametrizada, status e duração. O identificador
também é devolvido em `X-Request-ID`, permitindo correlacionar uma resposta ao
log correspondente. Corpos, tokens e cookies não são registrados.

Use `LOG_LEVEL` para ajustar a verbosidade. Para enviar os mesmos eventos ao
OpenObserve, defina `OPENOBSERVE_URL` e `OPENOBSERVE_AUTH` (ou
`OPENOBSERVE_USER` e `OPENOBSERVE_PASSWORD`); `OPENOBSERVE_STREAM` é opcional e
usa `pomi-api-logs` por padrão. Sem `OPENOBSERVE_URL`, a aplicação não realiza
envio remoto.

### Acessando a Documentação

Após iniciar os servidores, acesse:

- **POMI Data:** http://localhost:3000/docs
- **POMI Data pública:** http://localhost:3000/public-docs
- **POMI App:** http://localhost:3001/docs
- **POMI App para estudantes:** http://localhost:3001/student-docs

## Estrutura do Projeto

```text
pomi-backend/
├── packages/
│   ├── db/          # Prisma, migrations e cliente compartilhado
│   ├── api-core/    # Infraestrutura HTTP comum
│   ├── data/        # API pública e administrativa de dados
│   ├── app/         # API autenticada de usuários e planejamentos
│   └── injection/   # Importadores e normalizadores
├── docker-compose.yaml
├── package.json
└── tsconfig.json
```

## Pendências de domínio

`StudyPeriod` registra atualmente apenas a data inicial do período acadêmico.
O modelo deverá passar a representar explicitamente as datas de início e fim
do semestre para que consumidores da API possam identificar o período vigente
sem heurísticas. Até essa evolução, o frontend considera janeiro a junho como
primeiro semestre e julho a dezembro como segundo semestre. Essa aproximação
representa a grade semanal prevista e não considera feriados, recessos,
cancelamentos ou outras exceções do calendário acadêmico.

## LICENÇA

O projeto está licenciado pelos termos da AGPL v3.0, para informações completas ver [licença](https://github.com/ominira-unicamp/pomi-backend/blob/main/LICENSE).
