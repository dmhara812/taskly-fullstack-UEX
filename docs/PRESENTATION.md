# Roteiro de apresentação do Taskly

## Objetivo

Apresentar primeiro o produto funcionando e, depois, explicar as decisões técnicas que sustentam a entrega. Duração sugerida: 7 a 9 minutos.

## Preparação antes da gravação

Deixar previamente criado:

- um usuário de demonstração;
- dois projetos ativos e um arquivado;
- tarefas distribuídas nos quatro status;
- pelo menos três tags;
- uma tarefa com imagem;
- uma tarefa com PDF;
- prazos e descrições realistas.

Fechar ferramentas e abas que não serão usadas, limpar notificações e confirmar:

```powershell
docker compose ps
```

## Roteiro sugerido

### 00:00 — Contexto

- apresentar o Taskly como aplicação de gestão de projetos e tarefas;
- explicar que o backend existente foi evoluído e o frontend foi criado para o case;
- destacar o prazo curto e a priorização do escopo obrigatório.

### 00:45 — Produto funcionando

- cadastro ou login;
- sessão persistente;
- listagem de projetos;
- criação ou edição rápida de um projeto.

### 02:00 — Tarefas

- abrir um projeto;
- mostrar descrições, prioridade, prazo, tags e anexos;
- criar ou editar uma tarefa;
- mostrar filtros e estados da lista.

### 03:20 — Kanban

- alternar para o quadro;
- movimentar uma tarefa;
- recarregar a página e confirmar persistência;
- reduzir a janela e mostrar a barra horizontal superior.

### 04:30 — Regras e segurança

- mostrar projeto arquivado em modo somente leitura;
- explicar ownership aplicado no backend;
- mostrar download autenticado de anexo;
- mencionar normalização UTC e migrations Alembic.

### 05:30 — Arquitetura

- apresentar rapidamente `backend/`, `frontend/`, `docs/` e `scripts/`;
- explicar a separação `api → service → repository → model`;
- citar TanStack Query, React Hook Form, Zod e dnd-kit;
- mostrar a abstração de storage.

### 06:30 — Qualidade

- mostrar GitHub Actions;
- citar Ruff, pytest, ESLint, TypeScript, Vitest e build;
- mencionar rollback otimista e testes de ownership;
- explicar que falhas reais de ambiente foram analisadas e corrigidas.

### 07:30 — Decisões e próximos passos

- explicar a decisão de priorizar execução local reproduzível em vez de deploy público de última hora;
- citar como evoluções: PostgreSQL gerenciado, storage S3, cookies HttpOnly, observabilidade e E2E;
- encerrar reforçando funcionalidade, arquitetura, testes e documentação.

## Demonstração de falha controlada

A demonstração do rollback do kanban é opcional. Caso seja utilizada:

1. abrir o kanban com o backend ativo;
2. interromper a API;
3. tentar mover uma tarefa;
4. mostrar o retorno para a coluna original e o estado de erro;
5. reativar a API antes de continuar.

Evitar essa demonstração se houver risco de comprometer o tempo ou o estado preparado para o vídeo.

## Checklist final do vídeo

- áudio compreensível;
- resolução suficiente para ler a interface;
- sem segredos ou tokens visíveis;
- sem longos períodos digitando dados;
- fluxo funcional antes da explicação de código;
- limitações apresentadas como decisões conscientes;
- duração abaixo de dez minutos.
