# Taskly Fullstack

Repositório do case técnico Taskly, organizado como monorepo para manter backend, frontend e documentação no mesmo histórico Git.

## Estrutura atual

```text
taskly-fullstack-UEX/
├── backend/          # FastAPI, SQLAlchemy, Alembic e pytest
├── frontend/         # React, Vite, TypeScript e produto web
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

Use para npm, TypeScript, ESLint e Vitest:

```powershell
cd frontend
npm install
npm run dev
npm run lint
npx tsc --noEmit
npm run test
```

## Estado funcional

O backend possui autenticação, refresh token, projetos, tarefas, ownership, prazos em UTC, tags relacionais e anexos.

O frontend possui autenticação persistente, gestão de projetos, lista e kanban de tarefas, drag-and-drop persistido, autocomplete de tags e gestão autenticada de anexos com upload, download e exclusão.


## Validação consolidada

Com as dependências já instaladas, execute na raiz do repositório:

```powershell
.\scripts\validate.ps1
```

Para instalar novamente as dependências bloqueadas antes da validação:

```powershell
.\scripts\validate.ps1 -InstallDependencies
```

Em Linux ou macOS:

```bash
./scripts/validate.sh
```

O frontend utiliza `npm ci` na integração contínua. Portanto,
`frontend/package-lock.json` deve permanecer versionado e sincronizado com o
`package.json`. O relatório de `npm audit` deve ser analisado antes de qualquer
uso de `npm audit fix --force`, pois a opção pode introduzir versões
incompatíveis.