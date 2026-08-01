# Prompt da Etapa 10 — Testes e estabilização

## Finalidade

Registrar o uso de IA como apoio para localizar lacunas de cobertura, organizar
cenários de regressão e revisar a automação de validação, sem atribuir à
ferramenta a execução ou a aprovação dos testes.

## Contexto fornecido pelo desenvolvedor

- Backend e frontend obrigatórios já estavam implementados.
- Ruff, ESLint, TypeScript, pytest, Vitest e build são validações obrigatórias.
- O ambiente Windows apresentou instabilidade no pool `forks` do Vitest.
- O teste otimista do kanban exigiu retenção explícita do cache.
- A rolagem horizontal inferior do kanban foi substituída por controle superior.
- O teste de Blob revelou incompatibilidades entre implementações de `jsdom`.
- A instalação npm informou duas vulnerabilidades de severidade alta.

## Solicitação feita à IA

> Revise a suíte atual do Taskly e proponha uma etapa de estabilização sem criar
> novas funcionalidades. Amplie a cobertura dos fluxos obrigatórios, valide a
> integridade das migrations e do schema, consolide comandos locais e de CI,
> preserve as correções já feitas no Windows e documente somente resultados
> realmente apresentados pelo desenvolvedor.

## Resultado utilizado pelo desenvolvedor

A análise serviu para priorizar:

- testes explícitos da head Alembic, relações, constraints e enums;
- ampliação do fluxo integrado do backend;
- cobertura do cadastro no frontend;
- regressão da barra superior e do modo somente leitura do kanban;
- comando único de validação local;
- uso de `npm ci` na CI;
- relatório de cobertura sem impor limite não medido;
- tratamento responsável do `npm audit`.

As alterações devem ser revisadas, executadas e aceitas pelo desenvolvedor.
