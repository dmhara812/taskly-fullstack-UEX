# Taskly Fullstack

Repositório do case técnico Taskly, organizado como monorepo para manter backend, frontend e documentação no mesmo histórico Git.

## Estrutura atual

```text
taskly-fullstack-UEX/
├── backend/          # FastAPI, SQLAlchemy, Alembic e pytest
├── frontend/         # React/Vite será inicializado na Etapa 05
├── docs/             # etapas, decisões, estado atual e uso de IA
├── .github/          # CI do repositório
├── docker-compose.yml
└── README.md
```

## Diretórios de execução

### Raiz do repositório

Use para Git e Docker Compose:

```powershell
cd "C:\Users\Daniel Hara\Documents\Projetos\taskly-fullstack-UEX"
git status
docker compose up -d
```

### Raiz do backend

Use para Alembic, Ruff e pytest:

```powershell
cd backend
alembic upgrade head
ruff check .
ruff format . --check
python -m pytest
```

### Raiz do frontend

A partir da inicialização do React/Vite, use para npm, TypeScript e Vitest:

```powershell
cd frontend
npm run dev
npm run lint
npx tsc --noEmit
npx vitest run
```

## Estado funcional

O backend já possui autenticação, projetos, tarefas, ownership, prazos em UTC e tags relacionais por usuário. Anexos e frontend ainda serão implementados nas próximas etapas.
