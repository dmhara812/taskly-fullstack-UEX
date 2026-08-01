# Etapa 01 — Diagnóstico e decisões técnicas iniciais

## 1. Objetivo da etapa

Consolidar o diagnóstico do KanbanCore API em relação ao escopo do Taskly, registrar as decisões técnicas aprovadas pelo desenvolvedor e criar a base de rastreabilidade do projeto antes de qualquer alteração funcional.

Esta etapa é exclusivamente documental. Nenhum arquivo Python, migration, configuração de runtime ou regra de negócio foi alterado.

## 2. O que foi feito e por quê

Foram criados os documentos iniciais que orientam as próximas etapas:

- `docs/AI_USAGE.md`: registra o uso de IA como apoio de pesquisa, comparação e revisão, distinguindo sugestões, decisões do desenvolvedor, alterações humanas e validações reais;
- `docs/CURRENT_STATE.md`: apresenta o estado atual do projeto e as pendências em ordem de execução;
- `docs/DECISIONS.md`: registra as decisões arquiteturais aprovadas e suas consequências;
- `docs/prompts/etapa-01-diagnostico.md`: preserva a finalidade, o contexto e as restrições do uso de IA na análise inicial;
- `docs/etapas/etapa-01-diagnostico.md`: documenta integralmente esta etapa.

A documentação foi criada antes da implementação para evitar três problemas:

1. alterações sem justificativa rastreável;
2. decisões técnicas tomadas implicitamente durante a codificação;
3. documentação de IA escrita apenas ao final, sem refletir o processo real de revisão do desenvolvedor.

## 3. Diagnóstico consolidado

### 3.1. Componentes reaproveitáveis

O backend atual já fornece uma base relevante para o Taskly:

- inicialização FastAPI e tratamento global de erros;
- configuração e sessão SQLAlchemy;
- autenticação por e-mail e senha;
- emissão de access e refresh tokens;
- rota de usuário autenticado;
- CRUD de projetos com `owner_id`, status, filtros e paginação;
- CRUD de tarefas ligado a projetos;
- padrão de ownership por consultas filtradas pelo usuário autenticado;
- separação em rotas, serviços, repositórios, modelos e schemas;
- PostgreSQL, Alembic, Docker, pytest, Ruff e GitHub Actions.

Esses componentes serão evoluídos, não reescritos, salvo quando uma mudança for necessária para atender ao contrato do Taskly.

### 3.2. Lacunas funcionais

Ainda precisam ser implementados:

- status `cancelled`;
- `short_description` separada da descrição completa;
- `due_at` com data, hora e timezone;
- tags;
- anexos e fotos;
- endpoint de refresh consumível pelo frontend;
- testes de ownership com usuários distintos;
- frontend React/Vite/TypeScript;
- lista, kanban, toggle e drag-and-drop persistido;
- Docker Compose fullstack, deploy e documentação final.

### 3.3. Problemas estruturais prioritários

A inspeção identificou quatro bloqueadores que devem ser tratados antes ou junto da primeira evolução do banco:

1. `alembic/versions/` não possui revision inicial versionada;
2. `.gitignore` ignora `alembic/versions/*.py`;
3. os testes usam `Base.metadata.create_all()` e não detectam migrations inválidas;
4. o entrypoint executa `alembic upgrade head`, mas um banco vazio não recebe as tabelas sem revisions.

Também foram registrados riscos de:

- adicionar valor a enum nativo do PostgreSQL;
- converter `date` em datetime sem uma regra explícita de timezone;
- expor ou excluir anexos de outro usuário;
- deixar arquivos órfãos no storage;
- exibir um kanban incompleto por causa da paginação;
- manter estado visual incorreto após falha no drag-and-drop;
- confundir emissão de refresh token com sessão realmente renovável.

## 4. Decisões técnicas tomadas

### 4.1. Arquitetura

A arquitetura em camadas será preservada.

**Alternativa rejeitada:** reestruturar o backend durante o case.  
**Motivo:** custo e risco incompatíveis com o prazo, sem benefício proporcional.

### 4.2. Migrations

Será criada uma baseline Alembic reproduzível e validada em banco vazio. O banco local do case é considerado recriável.

**Alternativa rejeitada:** depender de `create_all()` ou manter migrations fora do Git.  
**Motivo:** não reproduz o deploy nem garante consistência entre ORM e banco.

### 4.3. Tags

Será adotada modelagem relacional many-to-many, com tags reutilizáveis e pertencentes ao usuário.

**Alternativa avaliada:** JSONB/array na tarefa.  
**Prós:** implementação mais curta.  
**Contras:** duplicidade, normalização difícil, filtros menos naturais e menor aderência à arquitetura planejada.

**Decisão do desenvolvedor:** solução relacional enxuta, sem CRUD administrativo desnecessário.

### 4.4. Anexos

Será criada uma entidade de metadados e uma interface de armazenamento.

**Alternativa avaliada:** acoplamento direto ao filesystem ou a um provedor externo.  
**Prós do local:** rapidez e simplicidade.  
**Contras do local:** persistência depende do ambiente.  
**Prós do externo:** durabilidade e escalabilidade.  
**Contras do externo:** credenciais e complexidade operacional.

**Decisão do desenvolvedor:** adapter local em desenvolvimento e testes; provider de produção definido na etapa de deploy.

### 4.5. Datas e horas

O contrato usará datetime timezone-aware normalizado em UTC.

**Alternativa rejeitada:** datetime sem timezone.  
**Motivo:** resultados dependentes do ambiente e risco de deslocamento silencioso.

### 4.6. Sessão persistente

O fluxo receberá endpoint de refresh e tratamento no frontend. A estratégia adequada ao prazo será documentada como trade-off, sem ser apresentada como solução definitiva para um produto real.

### 4.7. Kanban

O frontend carregará todas as páginas de tarefas do projeto. O drag-and-drop utilizará atualização otimista com rollback em caso de falha.

### 4.8. Projetos arquivados

Projetos arquivados serão somente leitura, com aplicação da regra também no backend.

### 4.9. Uso de IA

A IA atua como ferramenta de apoio para levantamento, comparação e revisão. As decisões, a implementação, as adaptações, os testes e a responsabilidade técnica permanecem com o desenvolvedor.

## 5. Dependências entre arquivos e ordem de criação

Nesta etapa, a ordem foi:

1. criar `docs/AI_USAGE.md`, definindo o padrão de rastreabilidade;
2. criar `docs/DECISIONS.md`, registrando as decisões aprovadas;
3. criar `docs/CURRENT_STATE.md`, resumindo concluído e pendente;
4. criar `docs/prompts/etapa-01-diagnostico.md`, preservando o contexto do uso de IA;
5. criar este arquivo de etapa, reunindo objetivo, decisões, conteúdo integral, validação e próximo passo.

Não há dependência de runtime entre esses arquivos. A dependência é documental: as próximas etapas devem atualizar `AI_USAGE.md` e `CURRENT_STATE.md` e, quando necessário, adicionar ou revisar decisões em `DECISIONS.md`.

## 6. Conteúdo completo dos arquivos criados

O conteúdo deste próprio arquivo já constitui o registro integral da etapa e não é repetido recursivamente dentro dele. Os demais arquivos criados são reproduzidos integralmente abaixo.

### `docs/AI_USAGE.md`

````markdown
# Uso de IA no desenvolvimento do Taskly

## Princípios de registro

A IA é utilizada neste projeto como ferramenta de apoio para pesquisa técnica, organização de informações, comparação de alternativas, identificação preliminar de riscos e revisão de soluções.

As decisões arquiteturais, a seleção das abordagens aplicadas, a implementação, as adaptações ao código existente, a execução das validações e a responsabilidade pelo resultado final pertencem ao desenvolvedor.

Os registros abaixo não tratam sugestões da IA como decisões automáticas. Cada etapa deve distinguir:

- o que foi solicitado à ferramenta;
- quais alternativas foram apresentadas;
- qual decisão foi tomada pelo desenvolvedor;
- quais alterações foram realizadas pelo desenvolvedor;
- quais resultados foram efetivamente validados.

Não serão registrados testes, comandos ou resultados como executados sem a respectiva evidência real.

---

## Etapa 01 - Diagnóstico e decisões técnicas iniciais

### Objetivo

Analisar a base KanbanCore API, identificar o que pode ser reaproveitado no Taskly, localizar lacunas em relação ao escopo do desafio e estabelecer uma sequência de implementação compatível com o prazo de três dias.

### Uso da IA

A IA foi utilizada como apoio para:

- organizar o inventário dos componentes existentes;
- comparar o código atual com os requisitos funcionais do Taskly;
- levantar arquivos potencialmente afetados;
- apresentar alternativas para tags, anexos, persistência de sessão e migrations;
- apontar riscos que deveriam ser verificados antes da implementação;
- estruturar um plano incremental de execução.

Nesta etapa, a IA não implementou funcionalidades nem substituiu a análise e a aprovação do desenvolvedor.

### Sugestão inicial

A análise assistida sugeriu:

- preservar a arquitetura em camadas já existente;
- corrigir a base de migrations antes de evoluir o modelo de tarefas;
- utilizar tags relacionais com escopo por usuário;
- isolar o armazenamento de anexos atrás de uma interface;
- manter prioridade como recurso adicional;
- trabalhar com `due_at` timezone-aware e contrato em UTC;
- carregar todas as páginas de tarefas do projeto para compor o kanban;
- tratar projetos arquivados como somente leitura;
- documentar conscientemente os trade-offs da sessão persistente no frontend.

Também foram apontados como riscos prioritários a ausência de revisions Alembic versionadas, a regra do `.gitignore` que bloqueia migrations, a falta de endpoint de refresh e a ausência de testes de ownership entre usuários diferentes.

### Decisão do desenvolvedor

O desenvolvedor revisou o diagnóstico e aprovou as diretrizes técnicas iniciais.

Foram adotadas as seguintes decisões:

- preservar a arquitetura `api → service → repository → model`;
- considerar o banco local do case recriável, sem obrigação de preservar dados anteriores;
- criar uma baseline Alembic reproduzível antes das mudanças funcionais;
- implementar tags por meio de modelagem relacional enxuta e reutilizável por usuário;
- implementar anexos com metadados relacionais e uma abstração de armazenamento;
- usar armazenamento local em desenvolvimento e testes, deixando a implementação de produção vinculada ao provedor de deploy;
- manter o campo de prioridade;
- adotar UTC como contrato de persistência e transporte para prazos;
- carregar todas as páginas de tarefas de um projeto na visualização kanban;
- tratar projetos arquivados como somente leitura;
- limitar anexos inicialmente a imagens e PDF, com limite configurável;
- utilizar a IA como apoio de pesquisa, comparação e revisão, mantendo decisões e implementação sob responsabilidade do desenvolvedor.

A definição do provedor de deploy e do storage de produção permanece deliberadamente adiada para a etapa de infraestrutura, pois depende das condições reais do ambiente escolhido.

### Alterações humanas

Nesta etapa, o desenvolvedor:

- forneceu o repositório e o escopo do desafio como base da análise;
- definiu que funcionalidades existentes não devem ser reescritas sem justificativa;
- aprovou as decisões técnicas iniciais;
- determinou a forma correta de registrar o uso de IA no desafio;
- manteve a Etapa 01 exclusivamente documental, sem alteração do código-fonte.

### Problemas identificados

- `alembic/versions/` não contém uma revision inicial versionada.
- `.gitignore` ignora `alembic/versions/*.py`.
- O entrypoint executa `alembic upgrade head`, mas a ausência de revisions impede a criação das tabelas em um banco vazio.
- O backend emite refresh token, porém não possui endpoint de renovação.
- Os testes usam `Base.metadata.create_all()` e não validam a integridade das migrations.
- A suíte atual não cobre tentativas de acesso cruzado entre usuários distintos.
- O kanban poderá exibir dados incompletos se consumir apenas a primeira página da listagem.
- Anexos exigem ownership indireto e limpeza coordenada entre banco e storage.
- A conversão futura de `due_date` para `due_at` exige tratamento explícito de timezone.

### Validação

A etapa foi validada por inspeção estática dos arquivos fornecidos e comparação com o escopo aprovado.

Nenhum comando de `pytest`, Ruff, Alembic, Docker, lint, TypeScript ou Vitest foi executado nesta etapa. Não houve alteração de código a ser validada.

### Resultado

O diagnóstico foi consolidado, as decisões iniciais foram aprovadas e a ordem de implementação foi definida. O código-fonte permanece inalterado.

A próxima etapa será a preparação da baseline Alembic e a adaptação do modelo de tarefas, iniciando pela integridade do banco antes da evolução funcional.
````

### `docs/CURRENT_STATE.md`

````markdown
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
````

### `docs/DECISIONS.md`

````markdown
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

Tratar o banco local do case como recriável e estabelecer uma baseline Alembic reproduzível antes das alterações funcionais. A ordem exata das revisions será definida na Etapa 02 para manter o histórico compreensível e validável.

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

Criar uma abstração `StorageBackend`, usar implementação local em desenvolvimento e testes e selecionar a implementação de produção na etapa de deploy.

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
````

### `docs/prompts/etapa-01-diagnostico.md`

````markdown
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
````

## 7. Comandos de validação

### 7.1. Verificação documental

Execute a partir da raiz do repositório:

```bash
# Confirmar os arquivos criados
git status --short

# Conferir a árvore documental
find docs -maxdepth 3 -type f | sort

# Procurar marcações incompletas que não devem permanecer
rg -n 'TO''DO|TB''D|PREEN''CHER|PLACE''HOLDER' docs

# Revisar o conteúdo da etapa
cat docs/etapas/etapa-01-diagnostico.md
```

No Windows PowerShell, o equivalente pode ser:

```powershell
git status --short
Get-ChildItem docs -Recurse -File | Sort-Object FullName
$markers = @("TO" + "DO", "TB" + "D", "PREEN" + "CHER", "PLACE" + "HOLDER")
Select-String -Path docs\**\*.md -Pattern ($markers -join "|")
Get-Content docs\etapas\etapa-01-diagnostico.md
```

### 7.2. Ruff e testes

Esta etapa não cria nem altera código Python. Por isso, Ruff e pytest não são requisitos de validação da alteração documental.

Uma verificação de regressão pode ser executada voluntariamente, desde que o resultado real seja registrado depois em `docs/AI_USAGE.md`:

```bash
ruff check .
ruff format . --check
pytest
```

Não registrar esses comandos como aprovados antes de executá-los no ambiente do projeto.

## 8. Passo a passo do commit

```bash
# 1. Verificar o que mudou
git status

# 2. Adicionar somente os arquivos documentais da etapa
git add \
  docs/AI_USAGE.md \
  docs/CURRENT_STATE.md \
  docs/DECISIONS.md \
  docs/prompts/etapa-01-diagnostico.md \
  docs/etapas/etapa-01-diagnostico.md

# 3. Revisar o conteúdo que será commitado
git diff --cached

# 4. Confirmar que somente documentação está no stage
git status

# 5. Criar o commit semântico
git commit -m "docs: registra diagnóstico e decisões iniciais do Taskly"

# 6. Enviar ao repositório remoto
git push origin main
```

Caso o desenvolvimento seja feito em branch própria, substitua `main` pelo nome da branch e preserve o fluxo de revisão adotado no repositório.

## 9. Problemas comuns e como resolver

### Arquivos criados fora da raiz correta

**Sintoma:** os documentos aparecem ao lado do repositório, e não dentro dele.  
**Correção:** mova a pasta `docs/` para a raiz que contém `app/`, `alembic/` e `pyproject.toml`.

### Commit inclui código ou artefatos locais

**Sintoma:** `git status` mostra `__pycache__`, `*.egg-info`, `.env` ou alterações de código.  
**Correção:** não use `git add .` nesta etapa. Adicione explicitamente apenas os cinco arquivos documentais.

### `CURRENT_STATE.md` afirma que o commit já ocorreu

**Sintoma:** o documento informa uma mensagem como último commit antes da execução do Git.  
**Correção:** mantenha o commit como planejado até que ele seja realmente criado; atualize o estado somente depois da confirmação local.

### Registro de IA atribui implementação à ferramenta

**Sintoma:** a documentação usa expressões como “a IA implementou” ou “a IA decidiu”.  
**Correção:** registre a IA como apoio de pesquisa, sugestão e revisão. A decisão aplicada e a implementação devem refletir a atuação real do desenvolvedor.

### Validação registrada sem execução

**Sintoma:** `AI_USAGE.md` declara testes aprovados sem saída de terminal.  
**Correção:** mantenha a etapa como inspeção estática e atualize os resultados somente após executar os comandos e preservar a evidência.

### Decisões futuras tratadas como definitivas sem contexto

**Sintoma:** o documento fixa um provedor de deploy ou storage ainda não escolhido.  
**Correção:** registre a abstração aprovada e adie a seleção do provedor até conhecer as restrições reais da Etapa 11.

## 10. Checklist da etapa

- [x] Inventário do KanbanCore consolidado.
- [x] Gaps do Taskly registrados.
- [x] Riscos técnicos prioritários documentados.
- [x] Arquitetura existente preservada como decisão.
- [x] Estratégia de migrations aprovada.
- [x] Estratégia relacional de tags aprovada.
- [x] Abstração de storage para anexos aprovada.
- [x] Contrato UTC para prazos aprovado.
- [x] Regras de kanban e projeto arquivado aprovadas.
- [x] Política de uso e documentação de IA definida.
- [x] `docs/AI_USAGE.md` criado.
- [x] `docs/CURRENT_STATE.md` criado.
- [x] `docs/DECISIONS.md` criado.
- [x] Prompt da etapa registrado.
- [x] Nenhum código-fonte alterado.
- [ ] Commit executado pelo desenvolvedor.
- [ ] Resultado real dos comandos opcionais registrado, caso sejam executados.

## 11. Próxima etapa

**Etapa 02 — Baseline Alembic e adaptação do modelo de tarefas**

A próxima etapa deverá:

1. permitir o versionamento das migrations;
2. criar uma baseline reproduzível em banco vazio;
3. validar o fluxo `alembic upgrade head`;
4. adicionar `cancelled`;
5. adicionar `short_description`;
6. migrar `due_date` para `due_at` timezone-aware;
7. adaptar schemas, repositório, serviço, rotas e testes;
8. adicionar cobertura de ownership com dois usuários;
9. atualizar `AI_USAGE.md`, `CURRENT_STATE.md` e a documentação da etapa com resultados reais.

Antes de escrever código, a Etapa 02 deverá apresentar a ordem dos arquivos, a estratégia concreta da migration e os efeitos de compatibilidade.
