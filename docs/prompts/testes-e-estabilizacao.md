# Consulta selecionada — Testes e estabilização

## Finalidade

Usar a IA para revisar lacunas de cobertura e organizar cenários de regressão sem atribuir à ferramenta a execução ou a aprovação dos testes.

## Contexto fornecido pelo desenvolvedor

- Backend e frontend obrigatórios já implementados.
- Ruff, ESLint, TypeScript, pytest, Vitest e build como validações obrigatórias.
- Problemas reais encontrados em workers do Vitest, rollback de cache, rolagem do kanban e compatibilidade de Blob.
- Necessidade de consolidar CI e validação local sem adicionar novas funcionalidades.

## Solicitação

> Revise a suíte atual do Taskly e proponha uma fase de estabilização sem criar novas funcionalidades. Amplie a cobertura dos fluxos obrigatórios, valide a integridade das migrations e do schema, consolide comandos locais e de CI, preserve as correções já feitas no Windows e documente somente resultados realmente apresentados pelo desenvolvedor.

## Uso do resultado

O desenvolvedor selecionou os cenários relevantes, executou as suítes, interpretou as falhas e corrigiu diferenças entre Windows, Node, jsdom e GitHub Actions.
