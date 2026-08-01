# Especificação funcional do Taskly

## Objetivo

Permitir que um usuário organize projetos e tarefas em uma aplicação web com autenticação própria, visualizações em lista e kanban, tags e anexos.

## Funcionalidades entregues

### Autenticação

- cadastro por nome, e-mail e senha;
- login com access token e refresh token;
- sessão persistente;
- renovação automática seletiva;
- rota protegida de usuário autenticado;
- logout.

### Projetos

- criação, edição, listagem e busca;
- paginação;
- arquivamento e restauração;
- exclusão com confirmação;
- isolamento por proprietário;
- projetos arquivados em modo somente leitura.

### Tarefas

- criação, edição, listagem, filtros e busca;
- título, descrição curta e descrição completa;
- prioridade baixa, média e alta;
- prazo com data e hora normalizado em UTC;
- status `todo`, `in_progress`, `done` e `cancelled`;
- exclusão com confirmação;
- isolamento por proprietário.

### Lista e kanban

- alternância entre lista e kanban;
- quatro colunas de status;
- drag-and-drop persistido;
- alternativa acessível por controle de status;
- atualização otimista com rollback;
- carregamento de todas as páginas do projeto;
- rolagem horizontal superior em largura reduzida.

### Tags

- tags relacionais pertencentes ao usuário;
- criação automática por nome;
- reutilização e autocomplete;
- prevenção de associação entre usuários diferentes.

### Anexos

- upload de JPEG, PNG, WebP e PDF;
- limite configurável de tamanho;
- validação de MIME e assinatura;
- listagem, download autenticado e exclusão;
- metadados no PostgreSQL;
- conteúdo em storage desacoplado;
- persistência local por volume Docker.

## Fora do escopo da entrega

- colaboração entre vários usuários no mesmo projeto;
- comentários e subtarefas;
- notificações em tempo real;
- ordenação manual persistente dentro de uma coluna;
- armazenamento externo de objetos;
- deploy público;
- testes end-to-end completos em navegador.
