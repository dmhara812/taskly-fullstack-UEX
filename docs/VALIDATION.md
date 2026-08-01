# Validação do Taskly

Este documento registra somente resultados observados pelo desenvolvedor. Correções preparadas, mas ainda não confirmadas por uma nova execução, permanecem identificadas como pendentes de rerun.

## Evidências observadas

### Frontend local

- `npm run lint`: executado sem erros nas saídas apresentadas.
- `npx tsc --noEmit`: executado sem erros nas saídas apresentadas.
- `npm run build`: concluído com sucesso, com bundle de produção gerado pelo Vite.
- As suítes cobriram autenticação, projetos, tarefas, kanban, rollback, tags e anexos.
- A interface foi testada em largura reduzida no Opera e a rolagem horizontal do kanban foi reposicionada para o topo após avaliação de usabilidade.

### GitHub Actions — frontend

Na última saída apresentada:

- ESLint passou;
- TypeScript passou;
- 28 de 29 testes passaram;
- o teste de download falhou por incompatibilidade entre o `Blob` retornado pela implementação de `Response` do Node e o `FileReader` do jsdom.

A correção preparada simula diretamente `response.blob()` com um Blob do mesmo ambiente do teste e verifica:

- retorno do objeto esperado;
- tipo MIME;
- tamanho;
- chamada do parser;
- envio do bearer token.

**Estado:** correção aplicada no código; novo workflow ainda deve confirmar o resultado.

### GitHub Actions — backend

Na última saída apresentada, `ruff format . --check` encontrou somente diferenças de formatação em:

- `app/tests/test_full_flow.py`;
- `app/tests/test_migrations.py`.

Não foi indicada falha lógica. Os arquivos foram ajustados para o formato esperado pelo Ruff.

**Estado:** correção aplicada no código; novo workflow ainda deve confirmar o resultado.

## Validação final

### Backend

Na raiz `backend/`:

```powershell
alembic heads
alembic current
alembic upgrade head

python -m ruff check .
python -m ruff format . --check
python -m pytest --cov=app --cov-report=term-missing
```

Head esperado:

```text
0004_add_attachments
```

### Frontend

Na raiz `frontend/`:

```powershell
npm ci
npm run check
npm audit
npm audit --omit=dev
```

Não executar `npm audit fix --force` sem revisar as alterações propostas.

### Docker fullstack

Na raiz do repositório:

```powershell
Copy-Item .env.example .env
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

Fluxo manual:

1. cadastrar e autenticar um usuário;
2. criar projeto e tarefa;
3. alternar entre lista e kanban;
4. mover a tarefa e recarregar a página;
5. enviar e baixar um anexo;
6. reiniciar os containers;
7. confirmar persistência do banco e do arquivo;
8. abrir o Swagger;
9. encerrar com `docker compose down`, sem `-v`.

## Matriz final

| Área | Última evidência | Estado |
|---|---|---|
| Backend lint | CI alcançou o format check | Rerun pendente após formatação |
| Backend format | Dois arquivos identificados | Correção aplicada; rerun pendente |
| Backend testes | Suíte ampliada e fluxo integrado preparados | Saída final pendente |
| Migrations | Head esperada `0004_add_attachments` | Saída final pendente |
| Frontend lint | GitHub Actions passou | Aprovado na última execução |
| Frontend tipos | GitHub Actions passou | Aprovado na última execução |
| Frontend testes | 28/29 antes da correção do Blob | Correção aplicada; rerun pendente |
| Frontend build | Build local concluído nas saídas apresentadas | Repetir na rodada final |
| Docker Compose | Arquivos e health checks configurados | Fluxo manual pendente |
| Auditoria npm | Alertas altos observados | Classificação final pendente |
