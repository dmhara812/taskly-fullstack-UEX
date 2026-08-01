# Etapa 11 — Entrega local reproduzível e curadoria documental

## 1. Objetivo

Consolidar a execução fullstack local por Docker Compose, registrar a decisão do desenvolvedor de não realizar deploy público nas horas finais e revisar a documentação para demonstrar uso crítico de IA sem transferir autoria ou responsabilidade técnica.

Este arquivo é um documento de trabalho. Ele foi gerado para orientar a execução da etapa e não precisa permanecer na árvore pública final. O patch não remove `docs/etapas/`; essa decisão fica reservada para a revisão final da Etapa 12.

## 2. Avaliação da documentação existente

Os arquivos de `docs/etapas/` foram úteis durante a construção porque preservam contexto, comandos e correções. Contudo, eles repetem grandes blocos de código e podem desviar a leitura do avaliador para o processo assistido, em vez do resultado técnico.

A recomendação adotada é:

- manter os arquivos por etapa durante o trabalho;
- preservar uma cópia local antes da submissão;
- avaliar sua remoção da árvore pública na Etapa 12;
- manter no repositório final documentos consolidados: `README`, `SPEC`, `ARCHITECTURE`, `DECISIONS`, `AI_USAGE`, `VALIDATION` e prompts selecionados.

O `AI_USAGE.md` foi reescrito para destacar pesquisa, comparação, decisões do desenvolvedor e correções humanas observadas durante a validação.

## 3. Decisões técnicas

### 3.1. Não realizar deploy público

**Alternativa 1:** publicar frontend, API e banco nas horas finais.  
**Prós:** URL demonstrativa.  
**Contras:** risco de CORS, segredos, migrations, banco remoto e storage efêmero.

**Alternativa 2:** entregar ambiente fullstack local reproduzível.  
**Prós:** estabilidade, persistência, execução verificável e foco nos critérios de maior peso.  
**Contras:** ausência de URL pública.

**Decisão do desenvolvedor:** adotar a segunda alternativa e registrar o deploy como evolução futura.

### 3.2. Frontend em Nginx

O frontend é construído em estágio Node e servido por Nginx. O proxy `/api/` encaminha chamadas para o serviço FastAPI, mantendo a mesma origem na execução via Compose.

### 3.3. Persistência local

PostgreSQL e anexos usam volumes Docker separados. `docker compose down` preserva dados; `docker compose down -v` remove intencionalmente os volumes.

### 3.4. Curadoria documental

O repositório final deve priorizar documentos consolidados e evidências reais. A documentação de IA não afirma execução automática nem validações não realizadas.

## 4. Arquivos afetados

- `.env.example`;
- `backend/.dockerignore`;
- `backend/Dockerfile`;
- `frontend/.dockerignore`;
- `frontend/Dockerfile`;
- `frontend/nginx.conf`;
- `docker-compose.yml`;
- `README.md`;
- `frontend/README.md`;
- `docs/README.md`;
- `docs/SPEC.md`;
- `docs/ARCHITECTURE.md`;
- `docs/AI_USAGE.md`;
- `docs/DECISIONS.md`;
- `docs/CURRENT_STATE.md`;
- `docs/VALIDATION.md`;
- `docs/prompts/README.md`;
- `docs/prompts/prompt-etapa-11-entrega-local-curadoria.md`.

Nenhum model, schema, service, repository, rota ou migration foi alterado.

## 5. Ordem de aplicação

1. aplicar o patch na raiz do repositório;
2. confirmar que `frontend/package-lock.json` está versionado;
3. copiar `.env.example` para `.env` e trocar o segredo JWT;
4. validar o Compose;
5. construir e iniciar os três serviços;
6. testar persistência após reinício;
7. executar os scripts de validação;
8. registrar somente resultados reais em `docs/VALIDATION.md`;
9. revisar a documentação que será mantida na submissão.

## 6. Conteúdo completo dos arquivos alterados

### `.env.example`

````env
# Variáveis usadas pelo Docker Compose local.
POSTGRES_DB=projects_api
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DB_PORT=5433
API_PORT=8000
FRONTEND_PORT=5173

# Substitua antes de compartilhar ou usar fora do ambiente local.
TASKLY_JWT_SECRET_KEY=replace-with-a-long-random-secret
````

### `backend/.dockerignore`

````text
.venv
__pycache__
.pytest_cache
.ruff_cache
.coverage
htmlcov
.env
storage
app/tests
*.pyc
*.pyo
````

### `backend/Dockerfile`

````dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY app ./app

# A imagem de execução recebe apenas dependências de runtime. Ruff, pytest e
# outras ferramentas continuam disponíveis no ambiente local e na CI.
RUN pip install --upgrade pip \
    && pip install --no-cache-dir .

COPY alembic.ini ./
COPY alembic ./alembic
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
````

### `frontend/.dockerignore`

````text
node_modules
dist
.env
.env.*
coverage
*.log
````

### `frontend/Dockerfile`

````dockerfile
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
````

### `frontend/nginx.conf`

````nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location = /healthz {
        access_log off;
        add_header Content-Type text/plain;
        return 200 "ok\n";
    }

    # O frontend usa uma URL relativa (/api/v1). O proxy mantém frontend e API
    # na mesma origem durante a execução via Compose e evita CORS desnecessário.
    location /api/ {
        proxy_pass http://api:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # React Router precisa devolver index.html para rotas acessadas diretamente.
    location / {
        try_files $uri $uri/ /index.html;
    }
}
````

### `docker-compose.yml`

````yaml
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_API_URL: /api/v1
    container_name: taskly-frontend
    ports:
      - "${FRONTEND_PORT:-5173}:80"
    depends_on:
      api:
        condition: service_healthy
    restart: unless-stopped

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: taskly-api
    environment:
      APP_NAME: "Taskly API"
      APP_ENV: "docker"
      APP_DEBUG: "false"
      APP_VERSION: "0.1.0"
      DATABASE_URL: >-
        postgresql+psycopg://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@db:5432/${POSTGRES_DB:-projects_api}
      JWT_SECRET_KEY: "${TASKLY_JWT_SECRET_KEY:-change-this-local-secret}"
      JWT_ALGORITHM: "HS256"
      ACCESS_TOKEN_EXPIRE_MINUTES: "30"
      REFRESH_TOKEN_EXPIRE_DAYS: "7"
      CORS_ORIGINS: "http://localhost:${FRONTEND_PORT:-5173},http://localhost:${API_PORT:-8000}"
      ATTACHMENT_STORAGE_DIR: "storage/attachments"
      ATTACHMENT_MAX_SIZE_BYTES: "5242880"
      ATTACHMENT_ALLOWED_CONTENT_TYPES: "image/jpeg,image/png,image/webp,application/pdf"
    ports:
      - "${API_PORT:-8000}:8000"
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - attachment_data:/app/storage/attachments
    healthcheck:
      test:
        [
          "CMD",
          "python",
          "-c",
          "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health')",
        ]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 10s
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    container_name: taskly-db
    environment:
      POSTGRES_DB: "${POSTGRES_DB:-projects_api}"
      POSTGRES_USER: "${POSTGRES_USER:-postgres}"
      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:-postgres}"
    ports:
      - "${DB_PORT:-5433}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-projects_api}",
        ]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

volumes:
  postgres_data:
  attachment_data:
````

### `README.md`

````markdown
# Taskly Fullstack

Aplicação de gestão de projetos e tarefas desenvolvida como case técnico, com backend FastAPI, frontend React/TypeScript, PostgreSQL, migrations, testes e execução fullstack por Docker Compose.

## Funcionalidades

- cadastro, login, refresh de sessão e logout;
- projetos ativos e arquivados;
- tarefas com descrições, prioridade, prazo, tags e anexos;
- visualização em lista e kanban;
- drag-and-drop com persistência e rollback;
- ownership em projetos, tarefas, tags e anexos;
- upload e download autenticado de imagens e PDFs;
- modo somente leitura para projetos arquivados.

## Estrutura

```text
taskly-fullstack-UEX/
├── backend/          # FastAPI, SQLAlchemy, Alembic e pytest
├── frontend/         # React, Vite, TypeScript e Vitest
├── docs/             # especificação, arquitetura, decisões e validação
├── scripts/          # validação local
├── docker-compose.yml
└── README.md
```

## Requisitos

Para executar tudo por Docker:

- Docker Desktop com Docker Compose.

Para desenvolvimento local separado:

- Python 3.12+;
- Node.js 20.19+;
- PostgreSQL 16.

## Execução fullstack com Docker

Na raiz do repositório:

```powershell
Copy-Item .env.example .env
```

Revise `TASKLY_JWT_SECRET_KEY` no arquivo `.env` e execute:

```powershell
docker compose build
docker compose up -d
docker compose ps
```

Acessos:

- aplicação: `http://localhost:5173`;
- Swagger: `http://localhost:8000/docs`;
- health check da API: `http://localhost:8000/api/v1/health`.

As migrations são executadas automaticamente pelo entrypoint da API.

Os volumes `postgres_data` e `attachment_data` preservam banco e anexos entre reinícios:

```powershell
docker compose down
docker compose up -d
```

Para apagar os dados locais:

```powershell
docker compose down -v
```

## Desenvolvimento separado

### Backend

```powershell
cd backend
..\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

## Validação

Na raiz do repositório:

```powershell
.\scripts\validate.ps1
```

Ou separadamente:

```powershell
cd backend
python -m ruff check .
python -m ruff format . --check
python -m pytest

cd ..\frontend
npm run check
```

Os resultados finais devem ser registrados em `docs/VALIDATION.md`.

## Documentação

- [Especificação funcional](docs/SPEC.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Decisões técnicas](docs/DECISIONS.md)
- [Uso de IA](docs/AI_USAGE.md)
- [Validação](docs/VALIDATION.md)
- [Estado atual](docs/CURRENT_STATE.md)
- [Organização da documentação](docs/README.md)

## Uso de IA

A IA foi usada como apoio para pesquisa, comparação de alternativas e revisão técnica. As decisões, a integração, as correções, a execução dos testes e a responsabilidade pela entrega pertencem ao desenvolvedor. O histórico de revisão crítica está consolidado em `docs/AI_USAGE.md`.

## Deploy público

A entrega prioriza uma execução local reproduzível e estável. O deploy público não foi incluído porque exigiria uma decisão adicional sobre PostgreSQL gerenciado, segredos e armazenamento durável de anexos.

Como evolução futura, a aplicação pode usar:

- frontend estático publicado separadamente;
- API containerizada;
- PostgreSQL gerenciado;
- storage compatível com S3;
- observabilidade e testes end-to-end.
````

### `frontend/README.md`

````markdown
# Taskly Frontend

Frontend do Taskly desenvolvido com React, Vite e TypeScript.

## Stack

- React e React Router;
- TanStack Query para estado remoto e rollback de mutations;
- dnd-kit para drag-and-drop do kanban;
- React Hook Form e Zod para formulários;
- Vitest e Testing Library para testes;
- ESLint e TypeScript em modo estrito.

## Configuração

Copie o arquivo de ambiente:

```powershell
Copy-Item .env.example .env
```

Valor padrão:

```env
VITE_API_URL="http://localhost:8000/api/v1"
```

## Execução

Na raiz `frontend/`:

```powershell
npm install
npm run dev
```

A aplicação fica disponível em `http://localhost:5173`.

## Validação

```powershell
npm run check
```

## Fluxos disponíveis

- registro de usuário;
- login por e-mail e senha;
- persistência local da sessão;
- renovação automática do access token;
- validação da sessão por `GET /auth/me`;
- rotas públicas e protegidas;
- logout;
- gestão de projetos;
- lista paginada de tarefas;
- criação, edição, exclusão e atualização de status de tarefas;
- filtros por status, prioridade e busca;
- prazo com conversão entre horário local e UTC;
- tags com autocomplete, criação de novos nomes e exibição na lista e no kanban;
- toggle entre lista e kanban;
- carregamento completo das páginas no quadro;
- drag-and-drop de status com atualização otimista e rollback;
- anexos autenticados com upload, listagem, download e exclusão;
- consulta de anexos preservada em projetos arquivados, sem permitir alterações.

O armazenamento em `localStorage` é um trade-off consciente do case. Para um
produto real, a evolução recomendada é adotar cookies HttpOnly e proteção CSRF.

O comando `npm run check` executa ESLint, TypeScript, Vitest em um único
worker e o build de produção. A configuração serial reduz instabilidades de
workers observadas no Windows sem alterar o comportamento da aplicação.

## Imagem Docker

O `Dockerfile` usa build multi-stage e publica os arquivos estáticos com Nginx.
No Docker Compose, `VITE_API_URL` é definido como `/api/v1`, e o Nginx encaminha
as chamadas para o serviço `api`, mantendo a aplicação na mesma origem.
````

### `docs/README.md`

````markdown
# Organização da documentação

A documentação pública do Taskly foi organizada para atender três públicos: avaliadores, desenvolvedores que executarão o projeto e pessoas interessadas nas decisões técnicas.

## Documentos recomendados para a entrega final

- `README.md`: visão geral e execução do projeto;
- `docs/SPEC.md`: escopo funcional entregue;
- `docs/ARCHITECTURE.md`: componentes e fluxos técnicos;
- `docs/DECISIONS.md`: decisões arquiteturais tomadas pelo desenvolvedor;
- `docs/AI_USAGE.md`: uso crítico e responsável de IA;
- `docs/VALIDATION.md`: evidências reais de validação;
- `docs/CURRENT_STATE.md`: estado resumido da entrega;
- `docs/prompts/`: registros selecionados das consultas usadas como apoio.

## Documentos de trabalho por etapa

Os arquivos de `docs/etapas/` foram úteis durante a construção, mas repetem código e instruções operacionais. Para a submissão final, recomenda-se mantê-los em uma cópia local de trabalho e removê-los da árvore pública, evitando duplicação e concentrando a avaliação nos documentos consolidados.

Antes de removê-los, faça uma cópia fora do repositório:

```powershell
Copy-Item docs\etapas ..\taskly-working-notes\etapas -Recurse
```

A remoção do repositório deve ocorrer apenas na revisão final, após confirmação do desenvolvedor.

## Prompts

Os arquivos de `docs/prompts/` registram o contexto das consultas feitas à IA. Eles não representam decisões automáticas nem autoria da implementação. A decisão aplicada, a integração ao repositório e a validação pertencem ao desenvolvedor.
````

### `docs/SPEC.md`

````markdown
# Especificação funcional do Taskly

## Objetivo

Permitir que um usuário organize projetos e tarefas em uma aplicação web com autenticação própria, visualizações em lista e kanban, tags e anexos.

## Funcionalidades entregues

### Autenticação

- cadastro por nome, e-mail e senha;
- login com access token e refresh token;
- sessão persistente;
- renovação automática seletiva;
- rota protegida de usuário autenticado;
- logout.

### Projetos

- criação, edição, listagem e busca;
- paginação;
- arquivamento e restauração;
- exclusão com confirmação;
- isolamento por proprietário;
- projetos arquivados em modo somente leitura.

### Tarefas

- criação, edição, listagem, filtros e busca;
- título, descrição curta e descrição completa;
- prioridade baixa, média e alta;
- prazo com data e hora normalizado em UTC;
- status `todo`, `in_progress`, `done` e `cancelled`;
- exclusão com confirmação;
- isolamento por proprietário.

### Lista e kanban

- alternância entre lista e kanban;
- quatro colunas de status;
- drag-and-drop persistido;
- alternativa acessível por controle de status;
- atualização otimista com rollback;
- carregamento de todas as páginas do projeto;
- rolagem horizontal superior em largura reduzida.

### Tags

- tags relacionais pertencentes ao usuário;
- criação automática por nome;
- reutilização e autocomplete;
- prevenção de associação entre usuários diferentes.

### Anexos

- upload de JPEG, PNG, WebP e PDF;
- limite configurável de tamanho;
- validação de MIME e assinatura;
- listagem, download autenticado e exclusão;
- metadados no PostgreSQL;
- conteúdo em storage desacoplado;
- persistência local por volume Docker.

## Fora do escopo da entrega

- colaboração entre vários usuários no mesmo projeto;
- comentários e subtarefas;
- notificações em tempo real;
- ordenação manual persistente dentro de uma coluna;
- armazenamento externo de objetos;
- deploy público;
- testes end-to-end completos em navegador.
````

### `docs/ARCHITECTURE.md`

````markdown
# Arquitetura do Taskly

## Visão geral

O Taskly é um monorepo composto por frontend React, API FastAPI, PostgreSQL e documentação transversal.

```text
Navegador
   │
   ▼
Nginx / frontend React
   │ /api/v1
   ▼
FastAPI
   │
   ├── api/routes
   ├── services
   ├── repositories
   ├── models SQLAlchemy
   └── schemas Pydantic
   │
   ▼
PostgreSQL

Anexos: FastAPI → StorageBackend → volume local
```

## Backend

O backend preserva a arquitetura herdada do KanbanCore:

```text
api → service → repository → model
```

- `api/`: contrato HTTP e dependências de autenticação;
- `services/`: regras de negócio e ownership;
- `repositories/`: consultas SQLAlchemy;
- `models/`: persistência e relações;
- `schemas/`: validação e serialização;
- `alembic/`: histórico reproduzível do banco.

As regras de ownership são aplicadas no backend e cobertas por testes. Projetos arquivados permanecem consultáveis, mas bloqueiam mutações em tarefas e anexos.

## Frontend

O frontend é organizado por features:

- `auth/`;
- `projects/`;
- `tasks/`;
- `tags/`;
- `attachments/`.

TanStack Query gerencia dados remotos e invalidação de cache. React Hook Form e Zod validam formulários. O cliente HTTP centraliza autenticação, refresh e erros.

## Kanban

O kanban carrega todas as páginas do projeto porque a API permanece paginada. Ao mover uma tarefa:

1. o cache é atualizado de forma otimista;
2. o status é persistido pela API;
3. em caso de falha, os snapshots anteriores são restaurados;
4. as queries são invalidadas para confirmar o estado do servidor.

## Anexos

O banco armazena somente metadados. O conteúdo passa por uma interface `StorageBackend`, permitindo substituir o filesystem local por storage externo sem alterar o domínio.

## Execução local com Docker

O Docker Compose inicia:

- `frontend`: build Vite servido por Nginx;
- `api`: FastAPI com migrations no entrypoint;
- `db`: PostgreSQL 16;
- volumes para banco e anexos.

O Nginx encaminha `/api/` para a API, mantendo frontend e backend na mesma origem durante a demonstração local.
````

### `docs/AI_USAGE.md`

````markdown
# Uso de IA no desenvolvimento do Taskly

## Princípio adotado

A IA foi utilizada como ferramenta de apoio para pesquisa técnica, comparação de alternativas, levantamento de riscos e revisão de soluções. A definição do produto, as decisões arquiteturais, a integração ao código existente, as adaptações, a execução dos testes e a responsabilidade pelo resultado final permaneceram com o desenvolvedor.

As sugestões não foram tratadas como implementação definitiva. Cada mudança relevante foi revisada no contexto do repositório, validada no ambiente local e, quando necessário, corrigida pelo desenvolvedor.

## Como a ferramenta foi utilizada

| Área | Apoio solicitado à IA | Decisão e atuação do desenvolvedor |
|---|---|---|
| Diagnóstico | Comparar o KanbanCore com os requisitos do Taskly e levantar riscos. | Preservar a arquitetura existente e priorizar o fluxo obrigatório antes de extras. |
| Banco de dados | Comparar estratégias de migrations, enums e datas com timezone. | Criar baseline Alembic, migrations incrementais e contrato UTC. |
| Tags | Comparar JSONB/array com modelagem relacional. | Adotar tags relacionais por usuário e associação many-to-many. |
| Anexos | Comparar filesystem local, storage externo e abstração por interface. | Manter metadados relacionais e storage desacoplado, com implementação local no case. |
| Autenticação | Revisar renovação de sessão, retry e armazenamento de tokens. | Implementar refresh seletivo e documentar o trade-off de `localStorage`. |
| Frontend | Revisar organização por features, cache, formulários e estados de interface. | Integrar React, TanStack Query, React Hook Form e Zod ao contrato real da API. |
| Kanban | Comparar formas de carregar dados e persistir movimentações. | Carregar todas as páginas, usar atualização otimista e rollback em falhas. |
| Testes | Sugerir cenários de regressão e formas de automatizar validações. | Executar, interpretar os resultados e corrigir incompatibilidades reais do ambiente. |
| Entrega | Comparar deploy público de última hora com entrega local estável. | Priorizar Docker Compose local, documentação, vídeo e estabilidade. |

## Revisão crítica e correções conduzidas pelo desenvolvedor

Durante a validação, o desenvolvedor não aceitou as sugestões iniciais de forma automática. Os principais ajustes realizados foram:

1. **Dependências do TestClient:** o ambiente revelou a necessidade de `httpx2`; a dependência de desenvolvimento e a instalação local foram ajustadas após inspeção do erro real.
2. **Configuração de ambiente:** a ausência de `DATABASE_URL`, `TEST_DATABASE_URL` e `JWT_SECRET_KEY` foi identificada durante a execução; o `.env` e o banco exclusivo de testes foram configurados pelo desenvolvedor.
3. **Workers do Vitest no Windows:** o pool padrão com processos filhos não iniciou de forma confiável; o desenvolvedor adotou `threads`, execução sem paralelismo entre arquivos e um único worker.
4. **Testes de login:** interações com `userEvent` excederam o timeout e contaminaram o teste seguinte; o fluxo foi simplificado com `fireEvent` e restauração explícita dos mocks.
5. **Estado React em Effect:** o ESLint identificou `setState` dentro de `useEffect` na paginação de projetos; a correção foi transferida para as ações que removem o último item da página.
6. **Compatibilidade CSS e imports:** foram corrigidos `line-clamp` e imports das páginas de projeto após revisão local do editor e do lint.
7. **Rollback do kanban:** o teste descartava caches sem observadores por usar `gcTime: 0`; o desenvolvedor preservou os snapshots com `gcTime: Infinity` no cenário de teste.
8. **Usabilidade em largura reduzida:** a barra horizontal no fim do kanban foi considerada pouco eficiente durante teste no navegador; foi criada uma barra superior sincronizada sem alterar as coordenadas do `dnd-kit`.
9. **Teste de download:** o ambiente jsdom não ofereceu o mesmo comportamento de `Blob.text()` e converteu um Blob aninhado em `[object Blob]`; o mock foi corrigido para `Response('arquivo')` e leitura por `FileReader`.
10. **Auditoria npm:** alertas de severidade alta não foram corrigidos com `--force` sem análise, evitando atualização major e possível regressão.
11. **Deploy público:** após avaliar CORS, PostgreSQL remoto, migrations, segredos e persistência de anexos, o desenvolvedor decidiu não abrir uma frente de infraestrutura instável no fim do case.

Esses ajustes demonstram que o resultado final foi conduzido por revisão técnica e validação humana, e não pela aceitação automática de propostas da ferramenta.

## Decisões de responsabilidade do desenvolvedor

Foram decisões do desenvolvedor:

- preservar a arquitetura `api → service → repository → model`;
- reorganizar o projeto como monorepo;
- adotar migrations reproduzíveis;
- usar tags relacionais;
- isolar o storage de anexos;
- normalizar prazos em UTC;
- tratar projetos arquivados como somente leitura;
- implementar refresh seletivo de sessão;
- carregar todas as páginas no kanban;
- usar atualização otimista com rollback;
- manter prioridade como recurso adicional;
- limitar anexos a imagens e PDF com tamanho configurável;
- priorizar execução local reproduzível em vez de deploy público de última hora.

## Evidências de validação

A documentação distingue comandos sugeridos de resultados efetivamente observados. Entre as evidências fornecidas pelo desenvolvedor estão:

- ESLint sem erros nas execuções apresentadas;
- TypeScript sem erros nas execuções apresentadas;
- build de produção do Vite concluído;
- suíte Vitest executada, com falhas isoladas analisadas e corrigidas durante o desenvolvimento;
- testes específicos de autenticação, projetos, tarefas, kanban, tags e anexos executados no ambiente local;
- revisão manual da responsividade e da rolagem horizontal do kanban.

Os resultados completos e finais devem ser registrados em `docs/VALIDATION.md` somente após a última execução consolidada pelo desenvolvedor.

## Limitações reconhecidas

- Tokens permanecem em `localStorage` no escopo do case; cookies HttpOnly e proteção CSRF são a evolução recomendada para produção.
- O storage local de anexos é adequado à execução via volume Docker, mas um deploy distribuído exigiria armazenamento de objetos.
- O deploy público não faz parte da entrega final; a aplicação é demonstrada por Docker Compose local, testes e vídeo.
- Testes end-to-end completos em navegador permanecem como evolução futura.

## Resultado

A IA apoiou pesquisa, comparação e revisão. O desenvolvedor tomou as decisões, integrou as mudanças, identificou problemas nos resultados sugeridos, realizou correções e assumiu a responsabilidade técnica pela entrega.
````

### `docs/DECISIONS.md`

````markdown
# Decisões técnicas do Taskly

Este documento registra decisões tomadas pelo desenvolvedor após análise do repositório, comparação de alternativas e avaliação do prazo do desafio.

As alternativas podem ter sido organizadas com apoio de IA, mas a decisão aplicada, a implementação e a validação pertencem ao desenvolvedor.

---

## DEC-001 — Preservar a arquitetura em camadas

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O KanbanCore já separa rotas, regras de negócio, acesso a dados, modelos SQLAlchemy e schemas Pydantic.

### Alternativas consideradas

1. Reestruturar o backend durante a adaptação para o Taskly.
2. Preservar a arquitetura atual e evoluir somente os pontos necessários.

### Decisão do desenvolvedor

Preservar o fluxo `api → service → repository → model`, mantendo schemas Pydantic na fronteira da API.

### Justificativa

A base já é coerente, testável e adequada ao prazo. Uma reescrita aumentaria risco sem entregar valor proporcional ao escopo do desafio.

### Consequências

- Novas entidades seguirão o mesmo padrão.
- Regras de ownership permanecerão na camada de serviço e nas consultas protegidas.
- Mudanças estruturais exigirão justificativa técnica explícita.

---

## DEC-002 — Criar uma baseline Alembic reproduzível

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O repositório possui configuração do Alembic, mas não possui revisions versionadas. Além disso, o `.gitignore` ignora arquivos Python da pasta de versions.

### Alternativas consideradas

1. Manter `Base.metadata.create_all()` como mecanismo principal.
2. Criar uma baseline do KanbanCore e depois migrations incrementais.
3. Criar uma migration inicial consolidada já com o modelo final do Taskly.

### Decisão do desenvolvedor

Tratar o banco local do case como recriável e estabelecer uma baseline Alembic reproduzível antes das alterações funcionais. A ordem exata das revisions será definida na Etapa 02 para manter o histórico compreensível e validável.

### Justificativa

O avaliador deve conseguir iniciar o projeto em banco vazio com `alembic upgrade head`. A baseline reduz a diferença entre o modelo ORM e o histórico real do banco.

### Consequências

- O `.gitignore` deverá permitir migrations.
- A CI deverá validar upgrade em banco vazio.
- `create_all()` poderá continuar em testes rápidos, mas não substituirá o smoke test de migrations.

---

## DEC-003 — Adotar tags relacionais por usuário

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O Taskly exige tags editáveis e reutilizáveis. O backend atual não possui estrutura equivalente.

### Alternativas consideradas

1. Armazenar tags em JSONB ou array na tabela de tarefas.
2. Criar `tags` e uma associação many-to-many com tarefas.

### Decisão do desenvolvedor

Utilizar modelagem relacional enxuta:

- tags pertencem ao usuário;
- tarefas e tags possuem associação many-to-many;
- o nome será normalizado para evitar duplicidade por diferença de caixa ou espaços;
- a API terá somente as operações necessárias ao fluxo do Taskly, evitando um CRUD administrativo excessivo.

### Justificativa

A solução melhora consistência, reutilização, filtros e autocomplete, sem extrapolar o escopo mínimo.

### Consequências

- Será necessário evitar N+1 nas consultas.
- Ownership deverá impedir associação entre tarefa e tag de usuários diferentes.
- A migration incluirá tabela de tags, associação e restrição de unicidade.

---

## DEC-004 — Isolar anexos atrás de uma interface de storage

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

Anexos exigem persistência de metadados e armazenamento de bytes. O ambiente definitivo de deploy ainda não foi escolhido.

### Alternativas consideradas

1. Acoplar o serviço diretamente ao filesystem local.
2. Acoplar diretamente a um serviço externo compatível com S3.
3. Definir uma interface e fornecer implementações intercambiáveis.

### Decisão do desenvolvedor

Criar uma abstração `StorageBackend`, usar implementação local em desenvolvimento e testes e selecionar a implementação de produção na etapa de deploy.

Os metadados serão persistidos em uma entidade `Attachment`, incluindo nome original, chave ou URL, tipo, tamanho e `task_id`.

### Justificativa

A abstração mantém o domínio independente do provedor, reduz risco durante o desenvolvimento e permite adequação ao ambiente real de deploy.

### Consequências

- Upload e exclusão precisarão coordenar banco e storage.
- Ownership será validado por `Attachment → Task → Project → owner_id`.
- Nomes físicos serão não previsíveis.
- Tipos iniciais serão imagens e PDF, com limite configurável.

---

## DEC-005 — Usar UTC no contrato de prazos

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O campo atual `due_date` contém apenas data. O Taskly exige data e hora.

### Alternativas consideradas

1. Persistir datetime sem timezone.
2. Persistir horário local do usuário.
3. Persistir datetime timezone-aware e normalizar em UTC.

### Decisão do desenvolvedor

Substituir `due_date` por `due_at`, usando `TIMESTAMP WITH TIME ZONE` no PostgreSQL e datetime timezone-aware no contrato da API. A API normalizará valores para UTC; o frontend fará a conversão somente para apresentação e edição local.

### Justificativa

A decisão evita ambiguidades e deslocamentos silenciosos entre ambientes.

### Consequências

- Payloads sem offset deverão ser rejeitados ou tratados por regra explícita.
- Testes deverão verificar normalização e serialização.
- A migration deverá evitar conversões implícitas dependentes do timezone da sessão.

---

## DEC-006 — Manter prioridade como recurso adicional

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

Prioridade não é requisito obrigatório do Taskly, mas já está implementada no KanbanCore.

### Decisão do desenvolvedor

Manter `low`, `medium` e `high` no domínio e no frontend.

### Justificativa

O recurso já funciona, agrega valor ao produto e não desvia o cronograma quando apenas adaptado às novas telas.

### Consequências

- Os testes existentes serão adaptados, não removidos.
- Prioridade não terá precedência sobre requisitos obrigatórios.

---

## DEC-007 — Carregar todas as páginas para compor o kanban

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

A listagem atual é paginada e retorna 20 itens por padrão. Um kanban parcial poderia ocultar tarefas sem informar o usuário.

### Alternativas consideradas

1. Mostrar apenas a primeira página.
2. Criar imediatamente um endpoint específico para board.
3. Consumir todas as páginas do projeto no frontend.

### Decisão do desenvolvedor

No escopo do case, o frontend carregará todas as páginas do projeto para compor o board. Um endpoint específico só será criado se medições demonstrarem necessidade.

### Justificativa

A solução preserva a API existente, evita duplicação prematura e garante visão completa do projeto.

### Consequências

- O hook do kanban deverá controlar paginação acumulada.
- Estados de carregamento e falha parcial deverão ser tratados.

---

## DEC-008 — Tornar projeto arquivado somente leitura

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O backend já impede criação de tarefas em projetos arquivados, mas ainda é necessário definir edição, exclusão e movimentação.

### Decisão do desenvolvedor

Projetos arquivados serão somente leitura no Taskly. Não será permitida criação, edição, exclusão ou movimentação de tarefas enquanto o projeto estiver arquivado.

### Justificativa

A regra é previsível, reduz inconsistências e evita comportamentos diferentes entre lista e kanban.

### Consequências

- O backend deverá aplicar a regra, não apenas o frontend.
- A interface deverá comunicar o estado de somente leitura.
- Testes deverão cobrir as operações bloqueadas.

---

## DEC-009 — Estratégia de sessão adequada ao prazo do case

**Status:** aprovada com trade-off documentado
**Data:** 31/07/2026

### Contexto

O backend emite access e refresh tokens, mas não possui endpoint de renovação. Cookies HttpOnly oferecem proteção adicional, porém exigem configuração de CORS, credenciais e proteção contra CSRF.

### Decisão do desenvolvedor

Para o prazo do case, implementar renovação de sessão com access e refresh tokens armazenados no cliente, registrando a limitação de segurança e evitando apresentar essa estratégia como escolha definitiva para produção.

A adoção de cookies HttpOnly permanecerá como evolução recomendada para um produto real.

### Justificativa

A abordagem reduz complexidade operacional no prazo de três dias e permite demonstrar sessão persistente de ponta a ponta.

### Consequências

- O frontend deverá minimizar exposição dos tokens e limpar a sessão em falhas definitivas de refresh.
- O README e a documentação de segurança deverão registrar o trade-off.
- O backend deverá validar o tipo do token no endpoint de refresh.

---

## DEC-010 — IA como apoio, desenvolvedor como responsável técnico

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O desafio avalia o uso de IA, mas também exige demonstração de capacidade técnica, revisão crítica e rastreabilidade.

### Decisão do desenvolvedor

Registrar a IA como ferramenta de pesquisa, levantamento de alternativas, organização e revisão. Decisões arquiteturais, implementação, alterações manuais, execução de testes e aceitação dos resultados serão atribuídas ao desenvolvedor.

### Justificativa

O registro representa o uso real de uma ferramenta de apoio sem transferir autoria ou responsabilidade técnica.

### Consequências

- `AI_USAGE.md` distinguirá sugestão, decisão, alteração humana e validação real.
- Nenhum resultado será declarado como executado sem evidência.
- Divergências entre sugestão e implementação serão registradas.

---

## DEC-011 — Persistir valores textuais dos enums

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

Quando recebe uma classe `Enum` Python, o SQLAlchemy persiste os nomes dos membros por padrão. Assim, `TaskStatus.TODO = "todo"` poderia ser armazenado como `TODO`, divergindo do contrato textual da API e das migrations minúsculas.

### Alternativas consideradas

1. Manter os nomes internos em maiúsculas no PostgreSQL.
2. Configurar `values_callable` para persistir os valores públicos dos enums.

### Decisão do desenvolvedor

Configurar explicitamente os campos enum para persistirem os valores públicos: `active`, `archived`, `todo`, `in_progress`, `done`, `cancelled`, `low`, `medium` e `high`.

### Justificativa

O banco passa a refletir o contrato público, reduz ambiguidades em SQL manual, migrations e depuração.

### Consequências

- A baseline utiliza labels minúsculos.
- Bancos antigos criados por `create_all()` devem ser recriados para esta baseline.
- Novos enums devem declarar a mesma estratégia explicitamente.

---

## DEC-012 — Validar migrations no setup da suíte

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

A suíte original criava tabelas diretamente pelo metadata do ORM. Esse fluxo podia aprovar testes mesmo quando `alembic upgrade head` não conseguia construir o banco.

### Alternativas consideradas

1. Continuar usando `create_all()` e adicionar um teste isolado de migration.
2. Aplicar Alembic como preparação principal da sessão de testes.

### Decisão do desenvolvedor

Recriar o schema do banco exclusivo de testes e executar `alembic upgrade head` antes da suíte.

### Justificativa

O mesmo caminho usado no deploy passa a ser exercitado antes dos testes de API, aproximando a validação do ambiente real.

### Consequências

- `TEST_DATABASE_URL` deve apontar para banco descartável.
- O setup interrompe a execução quando a URL de teste coincide com a URL de desenvolvimento fora de `APP_ENV=test`.
- Falhas de migration impedem o início dos testes funcionais.

---

## DEC-013 — Organizar o Taskly como monorepo

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O repositório herdado possuía somente o backend diretamente na raiz. O Taskly exige backend, frontend, documentação e orquestração fullstack no mesmo projeto.

### Alternativas consideradas

1. Manter o backend na raiz e criar somente `frontend/` ao lado dele.
2. Criar `backend/` e `frontend/`, preservando arquivos globais na raiz.
3. Separar backend e frontend em repositórios diferentes.

### Decisão do desenvolvedor

Adotar um monorepo com:

- `backend/` para runtime, dependências, migrations, testes e imagem Docker da API;
- `frontend/` para React/Vite/TypeScript;
- `docs/` na raiz para documentação transversal;
- `.github/`, `.gitignore`, `.pre-commit-config.yaml`, `docker-compose.yml` e README principal na raiz.

### Justificativa

A estrutura aproxima o repositório da arquitetura final exigida, mantém um único histórico do case e permite que Docker Compose e CI coordenem os dois lados da aplicação.

### Consequências

- Comandos Python passam a ser executados em `backend/`.
- Comandos npm serão executados em `frontend/`.
- Git e Docker Compose continuam sendo executados na raiz.
- A CI precisa declarar o diretório de trabalho de cada job.
- Configurações que dependiam do diretório corrente devem usar caminhos explícitos.

---

## DEC-014 — Resolver tags por nome no fluxo de tarefas

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

A modelagem relacional aprovada exige definir como o frontend associa tags a uma tarefa. O envio direto de IDs exigiria criação prévia e validação adicional de ownership.

### Alternativas consideradas

1. Receber somente IDs de tags existentes.
2. Receber objetos completos de tags.
3. Receber nomes, reutilizar tags existentes e criar as ausentes para o usuário.

### Decisão do desenvolvedor

Receber uma lista de nomes nos payloads de criação e atualização de tarefas. O backend normaliza, deduplica, busca tags do proprietário e cria somente as ausentes.

### Justificativa

O contrato simplifica o formulário, impede associação direta por ID de outra conta e mantém a regra de ownership centralizada no backend.

### Consequências

- `tags: []` remove todas as associações da tarefa.
- `tags: null` é inválido.
- A resposta retorna objetos com ID e nome para renderização e cache.
- Tags sem tarefas permanecem disponíveis para reutilização e autocomplete.
- A exclusão administrativa de tags fica fora do escopo desta etapa.

---

## DEC-015 — Priorizar entrega local reproduzível em vez de deploy público

**Status:** aprovada
**Data:** 01/08/2026

### Contexto

O fluxo funcional obrigatório está implementado e o prazo restante deve ser usado para estabilidade, documentação e apresentação. Um deploy público exigiria decidir e configurar banco gerenciado, segredos, CORS, migrations e persistência durável dos anexos.

### Alternativas consideradas

1. Publicar frontend, API e PostgreSQL em serviços externos nas horas finais.
2. Publicar apenas o frontend e manter a API local.
3. Consolidar uma execução fullstack local por Docker Compose e registrar o deploy como evolução futura.

### Decisão do desenvolvedor

Adotar a terceira alternativa. A entrega final será executável localmente por Docker Compose, com frontend, API, PostgreSQL, migrations e volumes persistentes. Não haverá URL pública nesta versão.

### Justificativa

A decisão prioriza os critérios de maior peso: funcionalidade, arquitetura, testes, documentação e comunicação. Também evita apresentar um ambiente parcialmente funcional ou perder a persistência dos anexos em filesystem efêmero.

### Consequências

- O README deve explicar a execução local completa.
- O vídeo demonstrará o produto rodando localmente.
- O storage local permanecerá persistente por volume Docker.
- Um deploy futuro deverá usar PostgreSQL gerenciado, armazenamento de objetos, segredos e observabilidade.
- A ausência de deploy público será documentada como priorização técnica, não como requisito esquecido.
````

### `docs/CURRENT_STATE.md`

````markdown
# Estado atual

## Concluído

- Backend FastAPI organizado em camadas.
- Autenticação com access token, refresh token e sessão persistente.
- Projetos com ownership, busca, paginação, arquivamento e restauração.
- Tarefas com quatro status, prioridade, descrições e prazo UTC.
- Tags relacionais por usuário.
- Anexos com storage desacoplado, validação e ownership.
- Frontend React/Vite/TypeScript.
- Lista e kanban com drag-and-drop persistido e rollback.
- Gestão visual de tags e anexos.
- Migrations Alembic reproduzíveis.
- Testes backend e frontend ampliados.
- Scripts de validação local e CI.
- Docker Compose fullstack com volumes para PostgreSQL e anexos.
- Documentação consolidada em `SPEC`, `ARCHITECTURE`, `DECISIONS`, `AI_USAGE` e `VALIDATION`.
- Decisão de não realizar deploy público registrada.

## Em desenvolvimento

- Execução final consolidada dos comandos de validação.
- Teste manual do Docker Compose fullstack.
- Preparação do README final e do roteiro de apresentação.
- Revisão da documentação que será mantida na submissão pública.

## Pendente

- Registrar a última saída completa do backend em `VALIDATION.md`.
- Registrar a última saída completa do frontend em `VALIDATION.md`.
- Classificar o resultado final de `npm audit`.
- Validar upload e download após reinício dos containers.
- Gravar o vídeo de apresentação.
- Decidir, antes da submissão, se `docs/etapas/` será removido da árvore pública após cópia local.

## Último commit

- Etapa 11 ainda não commitada.
- Mensagem planejada: `chore: consolida execução local e documentação da entrega`
````

### `docs/VALIDATION.md`

````markdown
# Validação do Taskly

Este documento registra somente resultados observados pelo desenvolvedor. Comandos sugeridos, mas ainda não executados na rodada final, permanecem marcados como pendentes.

## Evidências já observadas

### Frontend

- `npm run lint`: executado sem erro nas saídas apresentadas.
- `npx tsc --noEmit`: executado sem erro nas saídas apresentadas.
- `npm run build`: concluído com sucesso; o Vite gerou o bundle de produção.
- `npx vitest run`: executado em múltiplas rodadas.
- Foram observados e corrigidos problemas específicos em workers do Vitest, teste de login, rollback de cache e leitura de Blob.
- A última saída completa de toda a suíte após a correção final do Blob ainda deve ser registrada.

### Validação manual

- A interface foi testada em largura reduzida no Opera.
- A barra horizontal original no final do kanban foi considerada pouco eficiente.
- O desenvolvedor substituiu o comportamento por uma barra superior sincronizada.

### Backend

- As migrations, testes de ownership e fluxo integrado foram preparados e utilizados ao longo das etapas.
- A última saída consolidada de Ruff, Alembic e pytest deve ser registrada antes da submissão.

## Validação final recomendada

### Backend

Na raiz `backend/`:

```powershell
alembic heads
alembic current
alembic upgrade head

python -m ruff check .
python -m ruff format . --check
python -m pytest --cov=app --cov-report=term-missing
```

Head esperado:

```text
0004_add_attachments
```

### Frontend

Na raiz `frontend/`:

```powershell
npm ci
npm run check
npm audit
npm audit --omit=dev
```

Não executar `npm audit fix --force` sem revisar a alteração de versões.

### Docker fullstack

Na raiz do repositório:

```powershell
Copy-Item .env.example .env

docker compose config
docker compose build
docker compose up -d
docker compose ps
```

Verificações manuais:

1. acessar `http://localhost:5173`;
2. cadastrar e autenticar um usuário;
3. criar projeto e tarefa;
4. mover a tarefa no kanban;
5. enviar e baixar um anexo;
6. reiniciar os containers;
7. confirmar persistência do banco e do anexo;
8. conferir `http://localhost:8000/docs`;
9. encerrar com `docker compose down` sem `-v`.

Use `docker compose down -v` somente quando quiser remover dados e anexos locais.

## Matriz final

| Área | Validação | Estado |
|---|---|---|
| Backend lint | Ruff check | Pendente de saída final |
| Backend format | Ruff format check | Pendente de saída final |
| Backend testes | pytest e cobertura | Pendente de saída final |
| Migrations | upgrade até `0004` | Pendente de saída final |
| Frontend lint | ESLint | Evidência observada; repetir na rodada final |
| Frontend tipos | TypeScript | Evidência observada; repetir na rodada final |
| Frontend testes | Vitest | Correções aplicadas; rodada final pendente |
| Frontend build | Vite build | Evidência observada; repetir na rodada final |
| Docker Compose | build, health checks e fluxo manual | Pendente |
| Auditoria npm | classificação dos alertas | Pendente |
````

### `docs/prompts/README.md`

````markdown
# Registros de consultas à IA

Esta pasta contém registros selecionados das consultas usadas durante o desenvolvimento.

Os arquivos demonstram como a IA foi empregada para pesquisar alternativas, revisar riscos e sugerir caminhos. Eles não substituem as decisões do desenvolvedor nem afirmam que a ferramenta executou ou validou o projeto.

A relação entre sugestão, decisão humana, correção e validação está consolidada em `docs/AI_USAGE.md`.
````

### `docs/prompts/prompt-etapa-11-entrega-local-curadoria.md`

````markdown
# Prompt da Etapa 11 — Entrega local e curadoria documental

## Finalidade

Registrar a consulta usada para revisar a estratégia de entrega, o Docker Compose e a documentação final do Taskly.

## Contexto fornecido pelo desenvolvedor

- O escopo funcional obrigatório já está implementado localmente.
- O projeto possui backend, frontend, PostgreSQL, migrations, testes, Docker e CI.
- Um deploy público abriria riscos de CORS, segredos, banco remoto e persistência de anexos.
- Os documentos por etapa foram úteis durante a construção, mas repetem código e podem desviar a leitura da documentação consolidada.
- A documentação deve deixar claro que a IA apoiou pesquisa e revisão, enquanto decisões, integração, correções e validação pertencem ao desenvolvedor.

## Solicitação feita à IA

> Compare deploy público de última hora com uma entrega local reproduzível. Proponha a consolidação do Docker Compose fullstack, revise a documentação pública e reorganize o AI_USAGE para destacar decisões e correções conduzidas pelo desenvolvedor. Não apresente testes como executados sem evidência real e não inclua um deploy público.

## Decisão do desenvolvedor

O desenvolvedor decidiu:

- não realizar deploy público nesta entrega;
- manter execução local fullstack por Docker Compose;
- manter os scripts de validação;
- consolidar `SPEC`, `ARCHITECTURE`, `DECISIONS`, `AI_USAGE`, `VALIDATION` e README;
- avaliar a remoção de `docs/etapas/` somente na revisão final, preservando uma cópia local;
- manter prompts selecionados como evidência de uso crítico da ferramenta.
````

## 7. Validação

Na raiz do repositório:

```powershell
Copy-Item .env.example .env

docker compose config
docker compose build
docker compose up -d
docker compose ps
```

Depois:

```powershell
.\scriptsalidate.ps1
```

Fluxo manual obrigatório:

1. acessar a aplicação;
2. cadastrar usuário;
3. criar projeto e tarefa;
4. mover tarefa no kanban;
5. enviar e baixar anexo;
6. executar `docker compose restart`;
7. confirmar persistência dos dados e do arquivo.

Validações realizadas na preparação deste patch:

- aplicação limpa do patch sobre o estado corrigido da Etapa 10;
- parsing sintático do `docker-compose.yml`;
- presença dos serviços `frontend`, `api` e `db`;
- dependências condicionadas aos health checks;
- `git diff --check` sem erros;
- inspeção dos caminhos de proxy, volumes e variáveis.

Não foram executados neste ambiente:

- `docker compose build`;
- `docker compose up`;
- Nginx em runtime;
- migrations online;
- suíte completa backend e frontend.

## 8. Commit

```powershell
git status

git add .env.example
git add backend/Dockerfile backend/.dockerignore
git add frontend/Dockerfile frontend/.dockerignore frontend/nginx.conf
git add docker-compose.yml
git add README.md frontend/README.md
git add docs/AI_USAGE.md docs/CURRENT_STATE.md docs/DECISIONS.md
git add docs/VALIDATION.md docs/ARCHITECTURE.md docs/SPEC.md docs/README.md
git add docs/prompts/README.md
git add docs/prompts/prompt-etapa-11-entrega-local-curadoria.md

git diff --cached
git commit -m "chore: consolida execução local e documentação da entrega"
git push origin main
```

O documento de trabalho desta etapa não precisa ser adicionado ao commit final.

## 9. Problemas comuns

### `frontend/package-lock.json` não existe

Execute `npm install` em `frontend/`, revise o lockfile e inclua-o no Git antes do build Docker.

### API fica unhealthy

Verifique `docker compose logs api` e confirme se as migrations foram aplicadas e se o PostgreSQL está healthy.

### Frontend abre, mas a API falha

Confirme que a imagem foi construída com `VITE_API_URL=/api/v1` e que `nginx.conf` possui o proxy `/api/`.

### Dados desaparecem após reinício

Use `docker compose down`, não `docker compose down -v`. A opção `-v` remove os volumes.

### Segredo local inadequado

Copie `.env.example` para `.env` e substitua `TASKLY_JWT_SECRET_KEY` por valor longo e aleatório.

## 10. Checklist

- [x] Decisão de não realizar deploy público documentada.
- [x] Frontend Docker multi-stage criado.
- [x] Nginx configurado para SPA e proxy da API.
- [x] Backend Docker sem dependências de desenvolvimento.
- [x] Docker Compose fullstack consolidado.
- [x] Health checks adicionados.
- [x] Volumes de banco e anexos mantidos.
- [x] `AI_USAGE.md` reescrito com foco em revisão crítica.
- [x] `SPEC.md` criado.
- [x] `ARCHITECTURE.md` criado.
- [x] Política de curadoria documental registrada.
- [x] Scripts da Etapa 10 preservados.
- [ ] Docker build executado pelo desenvolvedor.
- [ ] Fluxo fullstack validado pelo desenvolvedor.
- [ ] Última suíte backend registrada.
- [ ] Última suíte frontend registrada.
- [ ] Decisão final sobre `docs/etapas/` executada.
- [ ] Commit realizado pelo desenvolvedor.

## 11. Próxima etapa

**Etapa 12 — README final, revisão do repositório e roteiro de apresentação.**

A próxima etapa deverá revisar a árvore pública final, atualizar evidências, decidir sobre a remoção de `docs/etapas/`, preparar dados de demonstração e produzir o roteiro do vídeo.
