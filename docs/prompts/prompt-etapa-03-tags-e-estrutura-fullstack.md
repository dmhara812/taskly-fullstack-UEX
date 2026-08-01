# Prompt da Etapa 03 — Tags e estrutura fullstack

## Finalidade

Registrar como a IA foi utilizada como apoio de pesquisa, comparação de alternativas e revisão durante a reorganização do repositório e a implementação de tags relacionais.

## Contexto fornecido pelo desenvolvedor

- O repositório possuía somente o backend na raiz.
- A estrutura final precisa separar `backend/`, `frontend/` e `docs/`.
- O backend deve preservar as camadas `api → service → repository → model`.
- Tags devem ser relacionais, reutilizáveis e isoladas por usuário.
- Alterações de banco exigem migration Alembic.
- Regras de ownership exigem testes automatizados.
- A documentação deve atribuir decisões e implementação ao desenvolvedor.

## Solicitação feita à IA

> Reorganize a Etapa 03 para criar as pastas `backend/` e `frontend/`, movendo para `backend/` todos os arquivos de runtime Python. Preserve na raiz os arquivos que coordenam o monorepo, como `docs/`, `.github/`, `.gitignore`, `.pre-commit-config.yaml` e `docker-compose.yml`. Depois apresente e implemente uma solução relacional enxuta para tags, integrada ao cadastro e à edição de tarefas, com migration e testes de ownership. Diferencie claramente o documento da etapa e o documento de prompt.

## Alternativas pesquisadas

- manter o backend diretamente na raiz ou convertê-lo em monorepo;
- enviar IDs de tags pelo frontend ou aceitar nomes e resolver as entidades no backend;
- criar CRUD completo de tags ou expor apenas listagem/autocomplete;
- armazenar tags na própria tarefa ou usar relação many-to-many;
- manter `.env` dependente do diretório atual ou resolver seu caminho pela raiz física do backend.

## Decisões do desenvolvedor

- organizar o repositório como monorepo;
- manter ferramentas globais e documentação na raiz;
- mover FastAPI, Alembic, configuração Python e Dockerfile para `backend/`;
- criar `frontend/` como pasta reservada até a inicialização React/Vite;
- aceitar nomes de tags em tarefas e resolver tags por usuário no service/repository;
- limitar tarefas a dez tags, com nomes entre 1 e 40 caracteres;
- normalizar nomes para unicidade, preservando o texto de exibição;
- permitir limpar tags por `tags: []` e rejeitar `tags: null`;
- expor `GET /api/v1/tags` para autocomplete, sem CRUD administrativo excessivo.

## Responsabilidade técnica

A IA apoiou a organização das opções, a identificação de riscos e a revisão da consistência entre arquivos. A escolha das abordagens, a aplicação das alterações, a execução dos comandos, a revisão do código e a aceitação do resultado pertencem ao desenvolvedor.
