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
- Documentação pública consolidada.
- Notas operacionais removidas da árvore pública.
- Decisão de não realizar deploy público registrada.

## Em validação final

- Reexecução do GitHub Actions após as correções de Ruff e Blob.
- Teste manual do Docker Compose fullstack.
- Classificação final do `npm audit`.
- Gravação do vídeo de apresentação.

## Critérios para submissão

- workflow do backend verde;
- workflow do frontend verde;
- upload e download preservados após reinício dos containers;
- README revisado a partir de uma clonagem limpa;
- vídeo gravado e link inserido na entrega.

## Último commit planejado

`docs: finaliza revisão pública e material de apresentação`
