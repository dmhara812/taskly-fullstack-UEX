# Prompt da Etapa 08 — Kanban e drag-and-drop

## Finalidade

Registrar o contexto em que a IA foi utilizada como apoio de pesquisa, comparação e revisão para a implementação do kanban do Taskly.

## Contexto fornecido pelo desenvolvedor

- Etapas 01 a 07 aplicadas ou preparadas.
- Backend já possui quatro status e endpoint `PATCH /tasks/{task_id}`.
- Frontend já possui lista, formulário, filtros, TanStack Query e mutation de atualização.
- A lista da API é paginada e o kanban precisa representar o projeto completo.
- O projeto arquivado deve permanecer somente leitura.
- A implementação deve usar `dnd-kit`.
- Toda falha de persistência deve restaurar o estado visual anterior.
- Documento técnico e prompt devem permanecer em arquivos distintos.

## Solicitação feita à IA

> Analise o estado consolidado da Etapa 07 e apresente uma implementação para a Etapa 08 com toggle lista/kanban, quatro colunas, carregamento de todas as páginas do projeto, drag-and-drop persistindo o status e rollback em caso de falha. Preserve a arquitetura existente, não altere o backend sem necessidade e prepare testes e documentação. Trate a IA como ferramenta de pesquisa e revisão; decisões, implementação, adaptações e validação pertencem ao desenvolvedor.

## Restrições aplicadas

- Não criar ordenação persistida que não exista no domínio.
- Não carregar somente a primeira página.
- Não manter estado remoto duplicado sem necessidade.
- Não esconder falhas do PATCH.
- Não permitir mutações em projeto arquivado.
- Não afirmar que npm, Vitest, lint ou build foram executados sem saída real.
- Não antecipar a gestão visual de anexos da Etapa 09.

## Resultado utilizado pelo desenvolvedor

O material de apoio foi usado para comparar primitives e sortable, estruturar a query acumulada, organizar os componentes do quadro e revisar o rollback do TanStack Query.

A decisão adotada pelo desenvolvedor foi usar `@dnd-kit/core`, sem ordenação interna persistida, com cada coluna representando um status e cada mudança persistida pelo endpoint já existente.
