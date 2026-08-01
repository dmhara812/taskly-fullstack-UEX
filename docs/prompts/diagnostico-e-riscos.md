# Consulta selecionada — Diagnóstico e riscos

## Finalidade

Usar a IA como apoio para comparar o backend existente com os requisitos do Taskly antes de alterar o código.

## Contexto fornecido pelo desenvolvedor

- Base existente em Python/FastAPI com autenticação, projetos, tarefas e ownership.
- Prazo de três dias corridos.
- Arquitetura em camadas a preservar.
- Necessidade de evoluir o domínio e construir o frontend sem reescrever funcionalidades prontas.

## Solicitação

> Analise a árvore e os arquivos reais do KanbanCore API. Produza um inventário do que pode ser reaproveitado, compare o repositório com o escopo do Taskly, indique arquivos afetados por cada gap, levante riscos técnicos, apresente alternativas para tags e anexos, proponha um plano incremental de três dias e separe as decisões que precisam de aprovação antes da implementação. Não gere código nem afirme que testes foram executados.

## Uso do resultado

O levantamento foi revisado pelo desenvolvedor e utilizado para preservar a arquitetura existente, priorizar migrations reproduzíveis, comparar modelagem relacional e armazenamento desacoplado e definir a ordem de implementação.
