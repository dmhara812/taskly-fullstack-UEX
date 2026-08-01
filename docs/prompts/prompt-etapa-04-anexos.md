# Prompt da Etapa 04 — Anexos e armazenamento

## Finalidade

Registrar como a IA foi utilizada como apoio de pesquisa, comparação e revisão na implementação de anexos, mantendo decisões, aplicação e validação sob responsabilidade do desenvolvedor.

## Contexto fornecido pelo desenvolvedor

- O repositório já está organizado em `backend/`, `frontend/` e `docs/`.
- O backend usa FastAPI, SQLAlchemy, PostgreSQL, Alembic e arquitetura em camadas.
- Tarefas já possuem ownership indireto por projeto.
- Tags relacionais foram implementadas na etapa anterior.
- O Taskly exige anexos e/ou fotos editáveis após a criação da tarefa.
- Os metadados devem permanecer no banco e o storage deve poder ser trocado futuramente.
- Projetos arquivados são somente leitura.
- Nenhum teste pode ser declarado como aprovado sem saída real do ambiente do desenvolvedor.

## Solicitação feita à IA

> Analise o estado posterior à Etapa 03 e apresente uma implementação completa de anexos. Crie entidade e migration, interface de armazenamento, adapter local, endpoints de upload, listagem, download e exclusão, integração à resposta de tarefas, validação de ownership, tipos e tamanho, limpeza física ao excluir anexos, tarefas ou projetos e testes automatizados. Preserve a arquitetura em camadas e documente alternativas e riscos. Separe claramente o documento da etapa em `docs/etapas/` e este prompt em `docs/prompts/`.

## Restrições aplicadas

- Não armazenar bytes diretamente no PostgreSQL.
- Não usar o nome original como caminho físico.
- Não expor anexos de outra conta.
- Não permitir alteração de anexos em projeto arquivado.
- Não acoplar regras de negócio diretamente ao filesystem.
- Não adicionar provider externo sem necessidade real do ambiente de deploy.
- Não aceitar qualquer MIME sem validação adicional.
- Não afirmar que Ruff, pytest, Docker ou PostgreSQL foram validados sem evidência real.

## Resultado utilizado pelo desenvolvedor

O material de apoio foi usado para:

- definir o contrato de `StorageBackend`;
- comparar consistência entre arquivo e metadados;
- escolher os tipos aceitos no MVP;
- estruturar as consultas de ownership;
- definir endpoints protegidos;
- organizar a limpeza física em cascatas de aplicação;
- preparar cenários de teste e comandos de validação.

## Decisões aplicadas pelo desenvolvedor

- storage local atrás de interface intercambiável;
- metadados relacionais com URL protegida e chave interna;
- JPEG, PNG, WebP e PDF no MVP;
- limite padrão de 5 MiB configurável;
- validação de MIME e assinatura inicial;
- nomes físicos gerados com UUID;
- download autenticado pela API;
- upload e exclusão bloqueados em projetos arquivados;
- limpeza de arquivos ao excluir anexo, tarefa ou projeto;
- provider de produção adiado para a etapa de deploy.
