# Prompt da Etapa 06 — Projetos no frontend

## Finalidade

Registrar o uso de IA como apoio à pesquisa, comparação e revisão da implementação da gestão de projetos no frontend do Taskly.

## Contexto fornecido pelo desenvolvedor

- O repositório já está organizado em `backend/`, `frontend/` e `docs/`.
- O backend já possui CRUD de projetos com ownership, paginação, filtros, arquivamento e exclusão.
- O frontend já possui autenticação, sessão persistente, cliente HTTP e TanStack Query.
- Os testes da autenticação foram estabilizados com pool de threads, um worker, `fireEvent` e restauração dos mocks.
- A etapa deve reutilizar os endpoints existentes e não reescrever o backend sem necessidade.

## Solicitação feita à IA

> Estruture a Etapa 06 para implementar projetos no frontend. Reaproveite o CRUD existente do backend e a fundação de autenticação. Inclua listagem, busca, paginação, criação, edição, arquivamento, restauração, exclusão, estados de loading/erro/vazio, navegação para o projeto e testes dos fluxos críticos. Preserve a separação por feature e o uso do TanStack Query. Separe claramente o documento técnico em `docs/etapas/` e este registro em `docs/prompts/`. Não apresente validações como executadas sem resultado real.

## Restrições aplicadas

- Não alterar o backend se os contratos atuais forem suficientes.
- Não implementar tarefas ou kanban nesta etapa.
- Não duplicar dados remotos em estado local desnecessário.
- Não excluir projeto sem confirmação explícita.
- Não tentar refresh diante de erros de regra de negócio.
- Não declarar lint, testes ou build como aprovados sem execução no ambiente do desenvolvedor.
- Manter a IA como apoio e o desenvolvedor como responsável pelas decisões, implementação e validação.

## Resultado utilizado pelo desenvolvedor

O material de apoio foi usado para organizar:

- contratos e tipos do frontend;
- chaves de cache e mutations;
- componentes de card e formulário;
- filtros, paginação e estados de interface;
- navegação para o workspace do projeto;
- cenários de teste dos fluxos principais;
- documentação e comandos de validação.

O desenvolvedor permanece responsável por revisar, adaptar, executar e aceitar a implementação no repositório real.
