# Prompt da Etapa 01 — Diagnóstico técnico

## Finalidade

Registrar de forma rastreável como a IA foi usada como apoio à análise inicial do Taskly, sem atribuir à ferramenta as decisões ou a implementação do projeto.

## Contexto fornecido pelo desenvolvedor

- Base existente: KanbanCore API em Python/FastAPI.
- Prazo do desafio: três dias corridos.
- Arquitetura existente a preservar: `api → service → repository → model`, com schemas Pydantic.
- Funcionalidades já existentes: autenticação JWT, usuários, projetos, tarefas, ownership, PostgreSQL, Alembic, pytest, Ruff, Docker e CI.
- Gaps obrigatórios: novo status, prazo com data e hora, descrições separadas, tags, anexos, frontend, lista, kanban, drag-and-drop, deploy e documentação.
- Regra: não gerar código antes da aprovação do diagnóstico.

## Solicitação feita à IA

> Analise a árvore e os arquivos reais do KanbanCore API. Produza um inventário do que pode ser reaproveitado, compare o repositório com o escopo do Taskly, indique arquivos afetados por cada gap, levante riscos técnicos, apresente alternativas para tags e anexos, proponha um plano incremental de três dias e separe as decisões que precisam de aprovação antes da implementação. Não gere código nem afirme que testes foram executados.

## Restrições aplicadas

- Não reescrever autenticação, CRUD ou ownership sem justificativa técnica.
- Não produzir pseudocódigo ou implementação nesta etapa.
- Não declarar execução de testes sem saída real.
- Priorizar funcionalidade e arquitetura antes de extras.
- Explicitar prós e contras das alternativas.
- Fundamentar o diagnóstico nos arquivos fornecidos.

## Resultado utilizado pelo desenvolvedor

O resultado serviu como material de apoio para:

- localizar componentes reaproveitáveis;
- identificar riscos de migrations e sessão persistente;
- comparar tags relacionais com JSONB;
- comparar armazenamento local com storage externo;
- estabelecer uma ordem segura de implementação.

O desenvolvedor revisou o diagnóstico, aprovou as decisões iniciais e definiu que a documentação deve apresentar a IA como ferramenta de pesquisa e proposição de alternativas, mantendo a implementação e a responsabilidade técnica sob autoria do desenvolvedor.

## Decisões aprovadas após a análise

- arquitetura atual preservada;
- baseline Alembic reproduzível;
- tags relacionais por usuário;
- storage desacoplado por interface;
- `due_at` timezone-aware em UTC;
- prioridade mantida;
- carregamento completo das páginas no kanban;
- projetos arquivados somente leitura;
- sessão persistente adequada ao prazo, com trade-off documentado;
- validações registradas somente após execução real.
