# Uso de IA no desenvolvimento do Taskly

## Princípio adotado

A IA foi utilizada como ferramenta de apoio para pesquisa técnica, comparação de alternativas, levantamento de riscos e revisão de soluções. A definição do produto, as decisões arquiteturais, a integração ao código existente, as adaptações, a execução dos testes e a responsabilidade pelo resultado final permaneceram com o desenvolvedor.

As sugestões não foram tratadas como implementação definitiva. Cada mudança relevante foi revisada no contexto do repositório, validada no ambiente local e, quando necessário, corrigida pelo desenvolvedor.

## Como a ferramenta foi utilizada

| Área | Apoio solicitado à IA | Decisão e atuação do desenvolvedor |
|---|---|---|
| Diagnóstico | Comparar o KanbanCore com os requisitos do Taskly e levantar riscos. | Preservar a arquitetura existente e priorizar o fluxo obrigatório antes de extras. |
| Banco de dados | Comparar estratégias de migrations, enums e datas com timezone. | Criar baseline Alembic, migrations incrementais e contrato UTC. |
| Tags | Comparar JSONB/array com modelagem relacional. | Adotar tags relacionais por usuário e associação many-to-many. |
| Anexos | Comparar filesystem local, storage externo e abstração por interface. | Manter metadados relacionais e storage desacoplado, com implementação local no case. |
| Autenticação | Revisar renovação de sessão, retry e armazenamento de tokens. | Implementar refresh seletivo e documentar o trade-off de `localStorage`. |
| Frontend | Revisar organização por features, cache, formulários e estados de interface. | Integrar React, TanStack Query, React Hook Form e Zod ao contrato real da API. |
| Kanban | Comparar formas de carregar dados e persistir movimentações. | Carregar todas as páginas, usar atualização otimista e rollback em falhas. |
| Testes | Sugerir cenários de regressão e formas de automatizar validações. | Executar, interpretar os resultados e corrigir incompatibilidades reais do ambiente. |
| Entrega | Comparar deploy público de última hora com entrega local estável. | Priorizar Docker Compose local, documentação, vídeo e estabilidade. |

## Revisão crítica e correções conduzidas pelo desenvolvedor

Durante a validação, o desenvolvedor não aceitou as sugestões iniciais de forma automática. Os principais ajustes realizados foram:

1. **Dependências do TestClient:** o ambiente revelou a necessidade de `httpx2`; a dependência de desenvolvimento e a instalação local foram ajustadas após inspeção do erro real.
2. **Configuração de ambiente:** a ausência de `DATABASE_URL`, `TEST_DATABASE_URL` e `JWT_SECRET_KEY` foi identificada durante a execução; o `.env` e o banco exclusivo de testes foram configurados pelo desenvolvedor.
3. **Workers do Vitest no Windows:** o pool padrão com processos filhos não iniciou de forma confiável; o desenvolvedor adotou `threads`, execução sem paralelismo entre arquivos e um único worker.
4. **Testes de login:** interações com `userEvent` excederam o timeout e contaminaram o teste seguinte; o fluxo foi simplificado com `fireEvent` e restauração explícita dos mocks.
5. **Estado React em Effect:** o ESLint identificou `setState` dentro de `useEffect` na paginação de projetos; a correção foi transferida para as ações que removem o último item da página.
6. **Compatibilidade CSS e imports:** foram corrigidos `line-clamp` e imports das páginas de projeto após revisão local do editor e do lint.
7. **Rollback do kanban:** o teste descartava caches sem observadores por usar `gcTime: 0`; o desenvolvedor preservou os snapshots com `gcTime: Infinity` no cenário de teste.
8. **Usabilidade em largura reduzida:** a barra horizontal no fim do kanban foi considerada pouco eficiente durante teste no navegador; foi criada uma barra superior sincronizada sem alterar as coordenadas do `dnd-kit`.
9. **Teste de download:** o ambiente jsdom não ofereceu o mesmo comportamento de `Blob.text()` e converteu um Blob aninhado em `[object Blob]`; o mock foi corrigido para `Response('arquivo')` e leitura por `FileReader`.
10. **Auditoria npm:** alertas de severidade alta não foram corrigidos com `--force` sem análise, evitando atualização major e possível regressão.
11. **Deploy público:** após avaliar CORS, PostgreSQL remoto, migrations, segredos e persistência de anexos, o desenvolvedor decidiu não abrir uma frente de infraestrutura instável no fim do case.

Esses ajustes demonstram que o resultado final foi conduzido por revisão técnica e validação humana, e não pela aceitação automática de propostas da ferramenta.

## Decisões de responsabilidade do desenvolvedor

Foram decisões do desenvolvedor:

- preservar a arquitetura `api → service → repository → model`;
- reorganizar o projeto como monorepo;
- adotar migrations reproduzíveis;
- usar tags relacionais;
- isolar o storage de anexos;
- normalizar prazos em UTC;
- tratar projetos arquivados como somente leitura;
- implementar refresh seletivo de sessão;
- carregar todas as páginas no kanban;
- usar atualização otimista com rollback;
- manter prioridade como recurso adicional;
- limitar anexos a imagens e PDF com tamanho configurável;
- priorizar execução local reproduzível em vez de deploy público de última hora.

## Evidências de validação

A documentação distingue comandos sugeridos de resultados efetivamente observados. Entre as evidências fornecidas pelo desenvolvedor estão:

- ESLint sem erros nas execuções apresentadas;
- TypeScript sem erros nas execuções apresentadas;
- build de produção do Vite concluído;
- suíte Vitest executada, com falhas isoladas analisadas e corrigidas durante o desenvolvimento;
- testes específicos de autenticação, projetos, tarefas, kanban, tags e anexos executados no ambiente local;
- revisão manual da responsividade e da rolagem horizontal do kanban.

Os resultados completos e finais devem ser registrados em `docs/VALIDATION.md` somente após a última execução consolidada pelo desenvolvedor.

## Limitações reconhecidas

- Tokens permanecem em `localStorage` no escopo do case; cookies HttpOnly e proteção CSRF são a evolução recomendada para produção.
- O storage local de anexos é adequado à execução via volume Docker, mas um deploy distribuído exigiria armazenamento de objetos.
- O deploy público não faz parte da entrega final; a aplicação é demonstrada por Docker Compose local, testes e vídeo.
- Testes end-to-end completos em navegador permanecem como evolução futura.

## Resultado

A IA apoiou pesquisa, comparação e revisão. O desenvolvedor tomou as decisões, integrou as mudanças, identificou problemas nos resultados sugeridos, realizou correções e assumiu a responsabilidade técnica pela entrega.
