# Decisões técnicas do Taskly

Este documento registra decisões tomadas pelo desenvolvedor após análise do repositório, comparação de alternativas e avaliação do prazo do desafio.

As alternativas podem ter sido organizadas com apoio de IA, mas a decisão aplicada, a implementação e a validação pertencem ao desenvolvedor.

---

## DEC-001 — Preservar a arquitetura em camadas

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O KanbanCore já separa rotas, regras de negócio, acesso a dados, modelos SQLAlchemy e schemas Pydantic.

### Alternativas consideradas

1. Reestruturar o backend durante a adaptação para o Taskly.
2. Preservar a arquitetura atual e evoluir somente os pontos necessários.

### Decisão do desenvolvedor

Preservar o fluxo `api → service → repository → model`, mantendo schemas Pydantic na fronteira da API.

### Justificativa

A base já é coerente, testável e adequada ao prazo. Uma reescrita aumentaria risco sem entregar valor proporcional ao escopo do desafio.

### Consequências

- Novas entidades seguirão o mesmo padrão.
- Regras de ownership permanecerão na camada de serviço e nas consultas protegidas.
- Mudanças estruturais exigirão justificativa técnica explícita.

---

## DEC-002 — Criar uma baseline Alembic reproduzível

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O repositório possui configuração do Alembic, mas não possui revisions versionadas. Além disso, o `.gitignore` ignora arquivos Python da pasta de versions.

### Alternativas consideradas

1. Manter `Base.metadata.create_all()` como mecanismo principal.
2. Criar uma baseline do KanbanCore e depois migrations incrementais.
3. Criar uma migration inicial consolidada já com o modelo final do Taskly.

### Decisão do desenvolvedor

Tratar o banco local do case como recriável e estabelecer uma baseline Alembic reproduzível antes das alterações funcionais. A sequência das revisions foi mantida compreensível e validável, separando baseline e evoluções incrementais.

### Justificativa

O avaliador deve conseguir iniciar o projeto em banco vazio com `alembic upgrade head`. A baseline reduz a diferença entre o modelo ORM e o histórico real do banco.

### Consequências

- O `.gitignore` deverá permitir migrations.
- A CI deverá validar upgrade em banco vazio.
- `create_all()` poderá continuar em testes rápidos, mas não substituirá o smoke test de migrations.

---

## DEC-003 — Adotar tags relacionais por usuário

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O Taskly exige tags editáveis e reutilizáveis. O backend atual não possui estrutura equivalente.

### Alternativas consideradas

1. Armazenar tags em JSONB ou array na tabela de tarefas.
2. Criar `tags` e uma associação many-to-many com tarefas.

### Decisão do desenvolvedor

Utilizar modelagem relacional enxuta:

- tags pertencem ao usuário;
- tarefas e tags possuem associação many-to-many;
- o nome será normalizado para evitar duplicidade por diferença de caixa ou espaços;
- a API terá somente as operações necessárias ao fluxo do Taskly, evitando um CRUD administrativo excessivo.

### Justificativa

A solução melhora consistência, reutilização, filtros e autocomplete, sem extrapolar o escopo mínimo.

### Consequências

- Será necessário evitar N+1 nas consultas.
- Ownership deverá impedir associação entre tarefa e tag de usuários diferentes.
- A migration incluirá tabela de tags, associação e restrição de unicidade.

---

## DEC-004 — Isolar anexos atrás de uma interface de storage

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

Anexos exigem persistência de metadados e armazenamento de bytes. O ambiente definitivo de deploy ainda não foi escolhido.

### Alternativas consideradas

1. Acoplar o serviço diretamente ao filesystem local.
2. Acoplar diretamente a um serviço externo compatível com S3.
3. Definir uma interface e fornecer implementações intercambiáveis.

### Decisão do desenvolvedor

Criar uma abstração `StorageBackend`, usar implementação local em desenvolvimento e testes e selecionar a implementação de produção quando houver um ambiente externo definido.

Os metadados serão persistidos em uma entidade `Attachment`, incluindo nome original, chave ou URL, tipo, tamanho e `task_id`.

### Justificativa

A abstração mantém o domínio independente do provedor, reduz risco durante o desenvolvimento e permite adequação ao ambiente real de deploy.

### Consequências

- Upload e exclusão precisarão coordenar banco e storage.
- Ownership será validado por `Attachment → Task → Project → owner_id`.
- Nomes físicos serão não previsíveis.
- Tipos iniciais serão imagens e PDF, com limite configurável.

---

## DEC-005 — Usar UTC no contrato de prazos

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O campo atual `due_date` contém apenas data. O Taskly exige data e hora.

### Alternativas consideradas

1. Persistir datetime sem timezone.
2. Persistir horário local do usuário.
3. Persistir datetime timezone-aware e normalizar em UTC.

### Decisão do desenvolvedor

Substituir `due_date` por `due_at`, usando `TIMESTAMP WITH TIME ZONE` no PostgreSQL e datetime timezone-aware no contrato da API. A API normalizará valores para UTC; o frontend fará a conversão somente para apresentação e edição local.

### Justificativa

A decisão evita ambiguidades e deslocamentos silenciosos entre ambientes.

### Consequências

- Payloads sem offset deverão ser rejeitados ou tratados por regra explícita.
- Testes deverão verificar normalização e serialização.
- A migration deverá evitar conversões implícitas dependentes do timezone da sessão.

---

## DEC-006 — Manter prioridade como recurso adicional

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

Prioridade não é requisito obrigatório do Taskly, mas já está implementada no KanbanCore.

### Decisão do desenvolvedor

Manter `low`, `medium` e `high` no domínio e no frontend.

### Justificativa

O recurso já funciona, agrega valor ao produto e não desvia o cronograma quando apenas adaptado às novas telas.

### Consequências

- Os testes existentes serão adaptados, não removidos.
- Prioridade não terá precedência sobre requisitos obrigatórios.

---

## DEC-007 — Carregar todas as páginas para compor o kanban

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

A listagem atual é paginada e retorna 20 itens por padrão. Um kanban parcial poderia ocultar tarefas sem informar o usuário.

### Alternativas consideradas

1. Mostrar apenas a primeira página.
2. Criar imediatamente um endpoint específico para board.
3. Consumir todas as páginas do projeto no frontend.

### Decisão do desenvolvedor

No escopo do case, o frontend carregará todas as páginas do projeto para compor o board. Um endpoint específico só será criado se medições demonstrarem necessidade.

### Justificativa

A solução preserva a API existente, evita duplicação prematura e garante visão completa do projeto.

### Consequências

- O hook do kanban deverá controlar paginação acumulada.
- Estados de carregamento e falha parcial deverão ser tratados.

---

## DEC-008 — Tornar projeto arquivado somente leitura

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O backend já impede criação de tarefas em projetos arquivados, mas ainda é necessário definir edição, exclusão e movimentação.

### Decisão do desenvolvedor

Projetos arquivados serão somente leitura no Taskly. Não será permitida criação, edição, exclusão ou movimentação de tarefas enquanto o projeto estiver arquivado.

### Justificativa

A regra é previsível, reduz inconsistências e evita comportamentos diferentes entre lista e kanban.

### Consequências

- O backend deverá aplicar a regra, não apenas o frontend.
- A interface deverá comunicar o estado de somente leitura.
- Testes deverão cobrir as operações bloqueadas.

---

## DEC-009 — Estratégia de sessão adequada ao prazo do case

**Status:** aprovada com trade-off documentado
**Data:** 31/07/2026

### Contexto

O backend emite access e refresh tokens, mas não possui endpoint de renovação. Cookies HttpOnly oferecem proteção adicional, porém exigem configuração de CORS, credenciais e proteção contra CSRF.

### Decisão do desenvolvedor

Para o prazo do case, implementar renovação de sessão com access e refresh tokens armazenados no cliente, registrando a limitação de segurança e evitando apresentar essa estratégia como escolha definitiva para produção.

A adoção de cookies HttpOnly permanecerá como evolução recomendada para um produto real.

### Justificativa

A abordagem reduz complexidade operacional no prazo de três dias e permite demonstrar sessão persistente de ponta a ponta.

### Consequências

- O frontend deverá minimizar exposição dos tokens e limpar a sessão em falhas definitivas de refresh.
- O README e a documentação de segurança deverão registrar o trade-off.
- O backend deverá validar o tipo do token no endpoint de refresh.

---

## DEC-010 — IA como apoio, desenvolvedor como responsável técnico

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O desafio avalia o uso de IA, mas também exige demonstração de capacidade técnica, revisão crítica e rastreabilidade.

### Decisão do desenvolvedor

Registrar a IA como ferramenta de pesquisa, levantamento de alternativas, organização e revisão. Decisões arquiteturais, implementação, alterações manuais, execução de testes e aceitação dos resultados serão atribuídas ao desenvolvedor.

### Justificativa

O registro representa o uso real de uma ferramenta de apoio sem transferir autoria ou responsabilidade técnica.

### Consequências

- `AI_USAGE.md` distinguirá sugestão, decisão, alteração humana e validação real.
- Nenhum resultado será declarado como executado sem evidência.
- Divergências entre sugestão e implementação serão registradas.

---

## DEC-011 — Persistir valores textuais dos enums

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

Quando recebe uma classe `Enum` Python, o SQLAlchemy persiste os nomes dos membros por padrão. Assim, `TaskStatus.TODO = "todo"` poderia ser armazenado como `TODO`, divergindo do contrato textual da API e das migrations minúsculas.

### Alternativas consideradas

1. Manter os nomes internos em maiúsculas no PostgreSQL.
2. Configurar `values_callable` para persistir os valores públicos dos enums.

### Decisão do desenvolvedor

Configurar explicitamente os campos enum para persistirem os valores públicos: `active`, `archived`, `todo`, `in_progress`, `done`, `cancelled`, `low`, `medium` e `high`.

### Justificativa

O banco passa a refletir o contrato público, reduz ambiguidades em SQL manual, migrations e depuração.

### Consequências

- A baseline utiliza labels minúsculos.
- Bancos antigos criados por `create_all()` devem ser recriados para esta baseline.
- Novos enums devem declarar a mesma estratégia explicitamente.

---

## DEC-012 — Validar migrations no setup da suíte

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

A suíte original criava tabelas diretamente pelo metadata do ORM. Esse fluxo podia aprovar testes mesmo quando `alembic upgrade head` não conseguia construir o banco.

### Alternativas consideradas

1. Continuar usando `create_all()` e adicionar um teste isolado de migration.
2. Aplicar Alembic como preparação principal da sessão de testes.

### Decisão do desenvolvedor

Recriar o schema do banco exclusivo de testes e executar `alembic upgrade head` antes da suíte.

### Justificativa

O mesmo caminho usado no deploy passa a ser exercitado antes dos testes de API, aproximando a validação do ambiente real.

### Consequências

- `TEST_DATABASE_URL` deve apontar para banco descartável.
- O setup interrompe a execução quando a URL de teste coincide com a URL de desenvolvimento fora de `APP_ENV=test`.
- Falhas de migration impedem o início dos testes funcionais.

---

## DEC-013 — Organizar o Taskly como monorepo

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O repositório herdado possuía somente o backend diretamente na raiz. O Taskly exige backend, frontend, documentação e orquestração fullstack no mesmo projeto.

### Alternativas consideradas

1. Manter o backend na raiz e criar somente `frontend/` ao lado dele.
2. Criar `backend/` e `frontend/`, preservando arquivos globais na raiz.
3. Separar backend e frontend em repositórios diferentes.

### Decisão do desenvolvedor

Adotar um monorepo com:

- `backend/` para runtime, dependências, migrations, testes e imagem Docker da API;
- `frontend/` para React/Vite/TypeScript;
- `docs/` na raiz para documentação transversal;
- `.github/`, `.gitignore`, `.pre-commit-config.yaml`, `docker-compose.yml` e README principal na raiz.

### Justificativa

A estrutura aproxima o repositório da arquitetura final exigida, mantém um único histórico do case e permite que Docker Compose e CI coordenem os dois lados da aplicação.

### Consequências

- Comandos Python passam a ser executados em `backend/`.
- Comandos npm serão executados em `frontend/`.
- Git e Docker Compose continuam sendo executados na raiz.
- A CI precisa declarar o diretório de trabalho de cada job.
- Configurações que dependiam do diretório corrente devem usar caminhos explícitos.

---

## DEC-014 — Resolver tags por nome no fluxo de tarefas

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

A modelagem relacional aprovada exige definir como o frontend associa tags a uma tarefa. O envio direto de IDs exigiria criação prévia e validação adicional de ownership.

### Alternativas consideradas

1. Receber somente IDs de tags existentes.
2. Receber objetos completos de tags.
3. Receber nomes, reutilizar tags existentes e criar as ausentes para o usuário.

### Decisão do desenvolvedor

Receber uma lista de nomes nos payloads de criação e atualização de tarefas. O backend normaliza, deduplica, busca tags do proprietário e cria somente as ausentes.

### Justificativa

O contrato simplifica o formulário, impede associação direta por ID de outra conta e mantém a regra de ownership centralizada no backend.

### Consequências

- `tags: []` remove todas as associações da tarefa.
- `tags: null` é inválido.
- A resposta retorna objetos com ID e nome para renderização e cache.
- Tags sem tarefas permanecem disponíveis para reutilização e autocomplete.
- A exclusão administrativa de tags fica fora do escopo atual.

---

## DEC-015 — Priorizar entrega local reproduzível em vez de deploy público

**Status:** aprovada
**Data:** 01/08/2026

### Contexto

O fluxo funcional obrigatório está implementado e o prazo restante deve ser usado para estabilidade, documentação e apresentação. Um deploy público exigiria decidir e configurar banco gerenciado, segredos, CORS, migrations e persistência durável dos anexos.

### Alternativas consideradas

1. Publicar frontend, API e PostgreSQL em serviços externos nas horas finais.
2. Publicar apenas o frontend e manter a API local.
3. Consolidar uma execução fullstack local por Docker Compose e registrar o deploy como evolução futura.

### Decisão do desenvolvedor

Adotar a terceira alternativa. A entrega final será executável localmente por Docker Compose, com frontend, API, PostgreSQL, migrations e volumes persistentes. Não haverá URL pública nesta versão.

### Justificativa

A decisão prioriza os critérios de maior peso: funcionalidade, arquitetura, testes, documentação e comunicação. Também evita apresentar um ambiente parcialmente funcional ou perder a persistência dos anexos em filesystem efêmero.

### Consequências

- O README deve explicar a execução local completa.
- O vídeo demonstrará o produto rodando localmente.
- O storage local permanecerá persistente por volume Docker.
- Um deploy futuro deverá usar PostgreSQL gerenciado, armazenamento de objetos, segredos e observabilidade.
- A ausência de deploy público será documentada como priorização técnica, não como requisito esquecido.

---

## DEC-016 — Curar a documentação pública

**Status:** aprovada
**Data:** 01/08/2026

### Contexto

Os documentos incrementais usados durante o desenvolvimento repetiam código, comandos e registros operacionais. Embora úteis como notas de trabalho, sua permanência no repositório público poderia desviar a avaliação do produto e sugerir a execução automática de um roteiro.

### Alternativas consideradas

1. Manter todos os documentos incrementais e todas as consultas no repositório.
2. Remover qualquer evidência de uso de IA.
3. Manter documentação consolidada e uma amostra representativa das consultas, preservando as notas completas fora do repositório.

### Decisão do desenvolvedor

Adotar a terceira alternativa:

- remover `docs/etapas/` da árvore pública após cópia local;
- manter `SPEC`, `ARCHITECTURE`, `DECISIONS`, `AI_USAGE`, `VALIDATION` e estado final;
- manter apenas três consultas representativas em `docs/prompts/`;
- registrar correções e decisões humanas no `AI_USAGE.md`.

### Justificativa

A seleção preserva rastreabilidade e demonstra uso crítico de IA sem transformar a documentação em um roteiro de implementação. O avaliador encontra rapidamente requisitos, arquitetura, trade-offs e evidências reais.

### Consequências

- notas completas permanecem disponíveis apenas como material privado de trabalho;
- referências a fases incrementais são removidas da documentação pública;
- o README passa a apontar somente para documentos consolidados;
- a autoria das decisões, correções e validações fica explicitamente atribuída ao desenvolvedor.
