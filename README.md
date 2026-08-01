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