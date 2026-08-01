# Prompt da Etapa 05 — Fundação do frontend e autenticação

## Finalidade

Registrar a solicitação usada para apoiar a implementação da fundação React/Vite/TypeScript e do fluxo de autenticação do Taskly.

## Contexto fornecido pelo desenvolvedor

- O repositório já está organizado como monorepo com `backend/`, `frontend/` e `docs/`.
- O backend possui registro, login, access token, refresh token emitido, rota `/auth/me`, projetos, tarefas, tags e anexos.
- Ainda não existe endpoint que consuma o refresh token.
- A Etapa 05 deve iniciar o frontend e implementar autenticação persistente.
- A stack obrigatória inclui React, Vite, TypeScript, TanStack Query, React Hook Form, Zod e Vitest.
- A IA deve aparecer como ferramenta de pesquisa, comparação e revisão; decisões e implementação pertencem ao desenvolvedor.
- Documento de etapa e prompt devem permanecer claramente separados.

## Solicitação feita à IA

> Analise o contrato atual da autenticação e proponha a implementação completa da Etapa 05. Crie o endpoint de refresh no backend, inicialize o frontend React/Vite/TypeScript e implemente cadastro, login, sessão persistente, renovação automática, validação por `/auth/me`, rotas protegidas e logout. Use TanStack Query, React Hook Form, Zod e Vitest. Evite antecipar projetos e kanban. Inclua testes, validações, documentação da etapa, atualização de AI_USAGE e CURRENT_STATE e passo a passo de commit. Não declare comandos como executados sem evidência real.

## Restrições aplicadas

- Preservar o login form-urlencoded compatível com o Swagger.
- Validar o tipo do refresh token no backend.
- Não renovar a sessão para qualquer resposta `403`.
- Limitar o retry automático a uma tentativa.
- Manter a URL da API configurável.
- Não criar mocks silenciosos no código de produção.
- Não implementar projetos, tarefas ou kanban nesta etapa.
- Não alterar `DECISIONS.md` sem uma nova decisão relevante.
- Manter o arquivo técnico em `docs/etapas/` e este registro em `docs/prompts/`.

## Resultado utilizado pelo desenvolvedor

O material apoiou a organização do cliente HTTP, do estado de autenticação, dos formulários, das rotas e dos testes. O desenvolvedor permanece responsável por revisar, instalar as dependências, executar as validações e aceitar ou corrigir a implementação no ambiente real.
