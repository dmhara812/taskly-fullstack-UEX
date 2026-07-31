# Estado atual

## Concluído

- Repositório KanbanCore API inspecionado.
- Inventário dos componentes reaproveitáveis concluído.
- Comparação entre o estado atual e o escopo obrigatório do Taskly concluída.
- Riscos de migrations, ownership, sessão persistente, paginação do kanban e anexos registrados.
- Decisões iniciais de arquitetura aprovadas pelo desenvolvedor.
- Estratégia relacional para tags aprovada.
- Abstração de storage para anexos aprovada.
- Política de documentação do uso de IA definida.
- Estrutura inicial de documentação criada.

## Em desenvolvimento

- Nenhuma funcionalidade está em implementação nesta etapa documental.
- Preparação da Etapa 02: baseline Alembic e adaptação do modelo de tarefas.

## Pendente

- Corrigir o versionamento de migrations no `.gitignore`.
- Criar e validar a baseline Alembic em banco vazio.
- Adicionar `cancelled` ao status de tarefas.
- Adicionar `short_description`.
- Migrar `due_date` para `due_at` timezone-aware.
- Criar testes de ownership com dois usuários.
- Implementar endpoint de refresh token.
- Implementar tags.
- Implementar anexos e storage adapter.
- Criar o frontend React/Vite/TypeScript.
- Implementar lista, kanban e drag-and-drop persistido.
- Consolidar Docker Compose, CI, deploy, testes e documentação final.

## Último commit

- Ainda não executado.
- Mensagem planejada para esta etapa: `docs: registra diagnóstico e decisões iniciais do Taskly`
