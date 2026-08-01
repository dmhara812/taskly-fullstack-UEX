# Validação do Taskly

## Objetivo

Centralizar os comandos, evidências e critérios de aceite usados antes do
deploy. Um item somente deve ser marcado como aprovado depois de sua execução
real no ambiente do desenvolvedor ou na CI.

## Comando consolidado

Na raiz do repositório, em PowerShell:

```powershell
.\scripts\validate.ps1
```

A primeira instalação ou uma reinstalação controlada pode ser feita com:

```powershell
.\scripts\validate.ps1 -InstallDependencies
```

## Backend

```powershell
cd backend
alembic heads
alembic current
alembic upgrade head
python -m ruff check .
python -m ruff format . --check
python -m pytest --cov=app --cov-report=term-missing
```

Critérios de aceite:

- uma única head Alembic: `0004_add_attachments`;
- migrations aplicáveis em banco PostgreSQL vazio;
- schema contém usuários, projetos, tarefas, tags, associação e anexos;
- enums persistem os valores públicos minúsculos;
- ownership retorna `404` para recursos de outra conta;
- projetos arquivados permanecem consultáveis e bloqueiam mutações;
- arquivos físicos são removidos junto com anexos, tarefas e projetos;
- Ruff e pytest finalizam sem erro.

## Frontend

```powershell
cd frontend
npm ci
npm run check
```

Critérios de aceite:

- ESLint sem erro;
- TypeScript sem erro;
- todos os testes Vitest aprovados;
- build de produção concluído;
- cadastro, login, refresh e logout funcionais;
- projetos e tarefas preservam as alterações após recarregar;
- kanban carrega todas as páginas e restaura o card após falha da API;
- barra superior movimenta horizontalmente o quadro em largura reduzida;
- anexos podem ser enviados, baixados e excluídos em projeto ativo;
- projeto arquivado permite consulta e download, mas não mutações.

## Evidências disponíveis até a preparação da Etapa 10

O desenvolvedor apresentou uma execução em que:

- ESLint foi concluído sem erro;
- `tsc --noEmit` foi concluído sem erro;
- o build Vite foi concluído;
- 24 de 25 testes frontend foram aprovados;
- a falha restante foi isolada no mock de conteúdo binário do `jsdom`;
- o mock foi corrigido para usar corpo textual convertido por `response.blob()`.

A execução integral posterior à correção ainda deve ser registrada com a saída
real. Este documento não presume aprovação sem essa evidência.

## Auditoria de dependências

A instalação informou duas vulnerabilidades de severidade alta. Antes do
deploy, execute:

```powershell
npm audit
npm audit --omit=dev
npm audit fix --dry-run
```

Não use `npm audit fix --force` automaticamente. Classifique se a dependência
afeta o bundle de produção, a ferramenta de desenvolvimento ou um caminho não
alcançável e registre a decisão no relatório final.

## Validação manual de regressão

1. Criar conta e confirmar redirecionamento para `/app`.
2. Atualizar a página e confirmar persistência da sessão.
3. Sair, entrar novamente e testar credenciais inválidas.
4. Criar, editar, arquivar, restaurar e excluir projeto.
5. Criar tarefa com prazo, tags e descrições.
6. Alterar status na lista e pelo kanban.
7. Desligar a API, mover um card e confirmar rollback.
8. Testar a barra horizontal superior em largura reduzida.
9. Enviar imagem e PDF, baixar e excluir os arquivos.
10. Arquivar o projeto e confirmar o modo somente leitura.
11. Inspecionar Network e Local Storage e confirmar que senhas não são
    persistidas.
12. Reduzir temporariamente a validade do access token e confirmar o refresh.
