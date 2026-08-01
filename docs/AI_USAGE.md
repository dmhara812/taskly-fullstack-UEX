# Uso de IA no desenvolvimento do Taskly

## Princípio adotado

A IA foi utilizada como ferramenta de apoio para pesquisa técnica, comparação de alternativas, levantamento de riscos e revisão de soluções. A definição do produto, as decisões arquiteturais, a integração ao código existente, as adaptações, a execução dos testes e a responsabilidade pelo resultado final permaneceram com o desenvolvedor.

As sugestões não foram tratadas como implementação definitiva. Cada mudança relevante foi revisada no contexto do repositório e confrontada com lint, testes, CI e validação manual.

## Como a ferramenta foi utilizada

| Área | Apoio solicitado | Decisão e atuação do desenvolvedor |
|---|---|---|
| Diagnóstico | Comparar o KanbanCore com os requisitos e levantar riscos. | Preservar a arquitetura existente e priorizar o fluxo obrigatório. |
| Banco de dados | Comparar migrations, enums e datas com timezone. | Criar baseline Alembic, revisions incrementais e contrato UTC. |
| Tags e anexos | Comparar JSONB, modelagem relacional e alternativas de storage. | Adotar tags relacionais e storage desacoplado com implementação local. |
| Autenticação | Revisar renovação de sessão, retry e armazenamento de tokens. | Implementar refresh seletivo e documentar o trade-off de `localStorage`. |
| Frontend | Revisar organização por features, cache, formulários e estados. | Integrar as bibliotecas ao contrato real da API e ajustar a experiência após testes. |
| Kanban | Comparar carregamento, persistência e rollback. | Carregar todas as páginas, atualizar de forma otimista e restaurar o cache em falhas. |
| Testes | Sugerir cenários de regressão e automação. | Executar, interpretar resultados e corrigir diferenças entre ambientes. |
| Entrega | Comparar deploy de última hora com entrega local estável. | Priorizar Docker Compose, documentação, vídeo e estabilidade. |

## Revisão crítica conduzida pelo desenvolvedor

Os principais ajustes realizados após avaliar os resultados sugeridos foram:

1. **Dependências de teste:** o ambiente exigiu `httpx2`; a dependência de desenvolvimento foi ajustada após inspeção do erro real.
2. **Configuração local:** variáveis obrigatórias e um banco exclusivo de testes foram configurados antes de considerar a suíte válida.
3. **Vitest no Windows:** o pool com processos filhos não iniciou de forma confiável; foram adotados `threads`, execução serial e um único worker.
4. **Testes de login:** interações mais lentas excederam o timeout e afetaram o teste seguinte; o fluxo foi simplificado e os mocks passaram a ser restaurados explicitamente.
5. **Estado React:** o ESLint apontou `setState` dentro de `useEffect`; a correção da paginação foi movida para as próprias ações de arquivar, restaurar e excluir.
6. **Compatibilidade visual:** `line-clamp` e imports foram corrigidos após revisão no editor, lint e build.
7. **Rollback do kanban:** o teste descartava caches sem observadores; o snapshot foi preservado com `gcTime: Infinity` somente no cenário de teste.
8. **Usabilidade responsiva:** a barra horizontal no fim do kanban foi considerada ineficiente no Opera; foi criada uma barra superior sincronizada sem transformar o contêiner usado pelo `dnd-kit`.
9. **Download binário:** uma primeira solução de leitura de Blob funcionou localmente, mas falhou na CI por misturar implementações de Node e jsdom. O teste foi refeito para simular diretamente o contrato `response.blob()` e verificar autenticação, tipo, tamanho e retorno do objeto.
10. **Formatação na CI:** o GitHub Actions encontrou dois arquivos de teste fora do formato do Ruff. A correção foi exclusivamente de formatação, sem alteração da lógica.
11. **Auditoria npm:** alertas de severidade alta não foram corrigidos com `--force` sem análise, evitando atualização incompatível.
12. **Deploy público:** após avaliar banco remoto, segredos, CORS, migrations e persistência dos anexos, o desenvolvedor decidiu não abrir uma frente de infraestrutura instável no fim do case.
13. **Curadoria documental:** notas extensas por fase foram removidas da árvore pública. Permaneceram documentos consolidados e três consultas representativas, preservando rastreabilidade sem apresentar o repositório como um roteiro seguido automaticamente.

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
- priorizar execução local reproduzível em vez de deploy público de última hora;
- selecionar quais registros de IA fariam parte da documentação pública.

## Evidências e limites

A documentação diferencia comandos recomendados de resultados efetivamente observados. As últimas falhas registradas pela CI foram analisadas e tiveram correções preparadas, mas só devem ser marcadas como aprovadas após um novo workflow verde.

Limitações reconhecidas:

- tokens em `localStorage` são uma escolha limitada ao case; cookies HttpOnly e proteção CSRF são recomendados para produção;
- storage local com volume Docker não substitui armazenamento de objetos em ambiente distribuído;
- o deploy público e testes end-to-end completos permanecem como evoluções futuras.

## Resultado

A IA apoiou pesquisa, comparação e revisão. O desenvolvedor tomou as decisões, integrou as mudanças, identificou problemas nas propostas, realizou correções e assumiu a responsabilidade técnica pela entrega.
