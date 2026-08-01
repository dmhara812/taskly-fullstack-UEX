# Prompt da Etapa 11 — Entrega local e curadoria documental

## Finalidade

Registrar a consulta usada para revisar a estratégia de entrega, o Docker Compose e a documentação final do Taskly.

## Contexto fornecido pelo desenvolvedor

- O escopo funcional obrigatório já está implementado localmente.
- O projeto possui backend, frontend, PostgreSQL, migrations, testes, Docker e CI.
- Um deploy público abriria riscos de CORS, segredos, banco remoto e persistência de anexos.
- Os documentos por etapa foram úteis durante a construção, mas repetem código e podem desviar a leitura da documentação consolidada.
- A documentação deve deixar claro que a IA apoiou pesquisa e revisão, enquanto decisões, integração, correções e validação pertencem ao desenvolvedor.

## Solicitação feita à IA

> Compare deploy público de última hora com uma entrega local reproduzível. Proponha a consolidação do Docker Compose fullstack, revise a documentação pública e reorganize o AI_USAGE para destacar decisões e correções conduzidas pelo desenvolvedor. Não apresente testes como executados sem evidência real e não inclua um deploy público.

## Decisão do desenvolvedor

O desenvolvedor decidiu:

- não realizar deploy público nesta entrega;
- manter execução local fullstack por Docker Compose;
- manter os scripts de validação;
- consolidar `SPEC`, `ARCHITECTURE`, `DECISIONS`, `AI_USAGE`, `VALIDATION` e README;
- avaliar a remoção de `docs/etapas/` somente na revisão final, preservando uma cópia local;
- manter prompts selecionados como evidência de uso crítico da ferramenta.
