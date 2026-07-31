# Prompt da Etapa 02 — Baseline Alembic e modelo de tarefas

## Finalidade

Registrar como a IA foi utilizada para pesquisar alternativas, identificar riscos e revisar a proposta técnica da Etapa 02, mantendo decisão, aplicação e validação sob responsabilidade do desenvolvedor.

## Contexto fornecido pelo desenvolvedor

- Backend existente em FastAPI, SQLAlchemy 2.0, PostgreSQL e Alembic.
- Nenhuma revision Alembic estava versionada.
- O `.gitignore` descartava `alembic/versions/*.py`.
- A tarefa original possuía `description`, `due_date` e três status.
- O Taskly exige descrição curta, descrição completa, data e hora e status cancelado.
- Ownership, arquitetura em camadas, Ruff e testes devem ser preservados.
- O banco local anterior pode ser recriado.

## Solicitação feita à IA

> Compare estratégias de baseline Alembic e apresente uma implementação completa para adaptar tarefas ao Taskly. Considere enum PostgreSQL, migração de dados legados, timezone UTC, impacto em model, schema, repository, service, routes e testes. Inclua testes de ownership com dois usuários, não use pseudocódigo e não declare validações que não tenham sido executadas.

## Alternativas apresentadas

- baseline única já no modelo final;
- baseline do KanbanCore seguida de migration incremental;
- uso de `create_all()` versus aplicação real das migrations nos testes;
- persistência de nomes ou valores dos enums Python;
- conversão da data legada para início ou fim determinístico do dia.

## Decisões do desenvolvedor

- duas revisions Alembic;
- banco local recriável;
- enums persistidos pelos valores públicos minúsculos;
- `short_description` obrigatória;
- `due_at` timezone-aware normalizado em UTC;
- data legada convertida para 23:59 UTC;
- projetos arquivados somente leitura;
- Alembic executado no setup da suíte;
- ownership validado com duas contas independentes.

## Limites da assistência

A ferramenta organizou alternativas e produziu uma proposta sujeita a revisão. O desenvolvedor permanece responsável por aplicar os arquivos, revisar o diff, executar os comandos no PostgreSQL, interpretar resultados e aceitar ou corrigir a implementação.
