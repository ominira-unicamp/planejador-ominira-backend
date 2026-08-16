# Plano de migração da Data API para o padrão de leitura

## Objetivo

Fazer com que todas as features da Data API sigam o padrão aplicado em
`class-schedule`, `catalog-program` e `curriculum-suggestion`:

- contratos como fonte dos schemas, rotas e autorização;
- services responsáveis por consultas e regras de domínio;
- entities responsáveis pela transformação dos dados do Prisma;
- problems responsáveis pelos erros de domínio;
- controllers compostos por `EndpointActions`;
- registro automático de rotas, autorização e OpenAPI via
  `createDataEndpointRegistries`.

A Data API permanecerá somente leitura. Nenhum endpoint `POST`, `PATCH`,
`PUT` ou `DELETE` será recriado.

## Estado atual

Migradas:

- `academic/course`
- `academic/professor`
- `catalog/catalog-program`
- `catalog/curriculum-suggestion`
- `schedule/class-schedule`

Pendentes:

- `academic/room`
- `academic/unit`
- `catalog/catalog`
- `catalog/language`
- `catalog/program`
- `catalog/specialization`
- `schedule/class`
- `schedule/study-period`
- `schedule/calendar-event`
- `schedule/calendar-tag`
- `schedule/calendar`

## Padrão por feature

Cada feature deverá possuir ou ajustar:

```text
<Feature>.contract.ts
<Feature>.service.ts
<Feature>.entity.ts
<Feature>.problems.ts
<Feature>.controller.ts
index.ts
```

### Contract

O contrato declara schemas públicos, operações `list` e `get`, filtros,
paginação, respostas de sucesso, problems de leitura e autorização.

Schemas de criação, atualização e remoção não devem permanecer exportados pela
Data API.

### Service

O service é o único local da feature que acessa o Prisma. Ele recebe dados
validados, executa consultas, filtros, ordenação e paginação, e retorna
entidades ou `Result` com problems.

Os métodos mínimos são:

```ts
list(input)
getById(id)
```

Services não importam Express nem conhecem Request, Response, body, query,
path ou status HTTP.

### Entity

A entity define a seleção Prisma, remove campos internos, transforma o payload
no schema público e deixa a adição de `_paths` para o controller.

### Problems

O caso mínimo é `ResourceNotFoundProblem`. Problems específicos só devem ser
criados quando carregarem informação adicional útil para o consumidor.

### Controller

O controller extrai a entrada validada, chama o service, converte o Result com
`createResultResponder`, adiciona `_paths`, responde com `ApiResponse` e
compõe as rotas usando `createDataEndpointRegistries`.

Controllers não acessam Prisma, não contêm regras de negócio ou transações e
não registram OpenAPI manualmente.

## Ordem de execução

1. Migrar `room` e `unit`, preservando listagem, consulta e links públicos.
2. Migrar `catalog`, `language`, `program` e `specialization`,
   preservando filtros, contagens, relações e ordenação.
3. Migrar `class` e `study-period`, preservando filtros, paginação e
   relações com horários, disciplinas e professores.
4. Migrar `calendar-event`, `calendar-tag` e `calendar`, preservando
   filtros de datas, tags, feeds e aliases.
5. Atualizar Context, DataCradle, Container e índices.
6. Remover código legado não utilizado e atualizar OpenAPI e testes.

## Compatibilidade

Manter URLs, parâmetros de query, formatos de sucesso, paginação, metadados,
`_paths`, aliases de calendário e classes e contratos consumidos pelo frontend
e pelo SDK.

Adaptações entre formato legado e service ficam no controller ou entity, nunca
no service por meio de conceitos HTTP. Autenticação global e políticas de
leitura não serão alteradas.

## Testes

Para cada feature, testar filtros, ordenação, paginação, transformação pública,
`ResourceNotFoundProblem`, conversão de Result, ausência de mutações, OpenAPI
somente com GET e autorização pública.

## Critérios de conclusão

- Todas as features possuem service, entity, problems e controller no padrão.
- Nenhum controller migrado acessa `ctx.prisma` ou `req.prisma`.
- Não existem handlers `_createFn`, `_patchFn`, `_removeFn` ou Actions de mutação.
- Não existem rotas mutáveis na Data API.
- OpenAPI e contratos permanecem compatíveis.
- Todos os testes passam.

## Validação final

Na raiz de `pomi-backend`:

```bash
npm run lint
npm run build
npm run test
npm run test --workspace @pomi/data
git diff --check
```

Verificações adicionais:

```bash
rg -n 'router\.(post|put|patch|delete)' packages/data/src/modules
rg -n 'Actions\["(create|patch|remove)"\]' packages/data/src/modules
rg -n 'ctx\.prisma|req\.prisma' packages/data/src/modules --glob '*controller.ts'
```

Os dois primeiros comandos não devem retornar resultados; o terceiro não deve
retornar resultados nos controllers migrados.

