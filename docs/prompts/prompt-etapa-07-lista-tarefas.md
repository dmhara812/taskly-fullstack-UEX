# Prompt da Etapa 07 — Lista de tarefas

## Finalidade

Registrar o contexto em que a IA foi utilizada como apoio para pesquisa, comparação de alternativas e revisão da implementação da lista de tarefas do Taskly.

## Contexto fornecido pelo desenvolvedor

- Backend já possui CRUD de tarefas, ownership, quatro status, prioridade, prazo UTC, descrições, tags e anexos.
- Frontend já possui autenticação persistente e gestão de projetos.
- O workspace de projeto ainda apresentava apenas um conteúdo provisório.
- A correção do Vitest da Etapa 05 já havia sido incorporada.
- A Etapa 06 recebeu correções manuais em `ProjectsPage.tsx`, `styles.css` e nos imports de `App.tsx`.
- O kanban com drag-and-drop pertence à Etapa 08.
- Upload e gestão visual de anexos pertencem à Etapa 09.

## Solicitação feita à IA

> Estruture a Etapa 07 sobre o estado corrigido da Etapa 06. Implemente no frontend a lista paginada de tarefas por projeto, criação, edição, exclusão, atualização dos quatro status, prioridade, prazo com data e hora, descrições e tags. Inclua busca, filtros, estados de loading/erro/vazio, projeto arquivado em modo somente leitura e testes dos fluxos críticos. Preserve o backend existente e não antecipe o kanban nem a gestão visual de anexos. Separe claramente o documento técnico em `docs/etapas/` e este registro em `docs/prompts/`.

## Restrições aplicadas

- Não alterar models, migrations ou endpoints sem necessidade concreta.
- Não duplicar estado remoto fora do TanStack Query.
- Não usar `setState` síncrono dentro de `useEffect` para corrigir paginação.
- Converter `datetime-local` para UTC antes de enviar à API.
- Manter ownership e bloqueio de projeto arquivado como responsabilidade autoritativa do backend.
- Não declarar validações como executadas sem saída real.
- Apresentar a IA como apoio e atribuir ao desenvolvedor decisões, implementação e validação.

## Resultado utilizado pelo desenvolvedor

O material foi utilizado para organizar:

- a feature de tarefas;
- o contrato do formulário;
- a estratégia de filtros e paginação;
- a conversão de prazo;
- o modo somente leitura;
- os testes de integração do workspace.

A decisão final, a implementação aplicada, os ajustes e a validação permanecem sob responsabilidade do desenvolvedor.
