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
