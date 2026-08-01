# Validação do Taskly

Este documento registra somente resultados observados pelo desenvolvedor. Comandos sugeridos, mas ainda não executados na rodada final, permanecem marcados como pendentes.

## Evidências já observadas

### Frontend

- `npm run lint`: executado sem erro nas saídas apresentadas.
- `npx tsc --noEmit`: executado sem erro nas saídas apresentadas.
- `npm run build`: concluído com sucesso; o Vite gerou o bundle de produção.
- `npx vitest run`: executado em múltiplas rodadas.
- Foram observados e corrigidos problemas específicos em workers do Vitest, teste de login, rollback de cache e leitura de Blob.
- A última saída completa de toda a suíte após a correção final do Blob ainda deve ser registrada.

### Validação manual

- A interface foi testada em largura reduzida no Opera.
- A barra horizontal original no final do kanban foi considerada pouco eficiente.
- O desenvolvedor substituiu o comportamento por uma barra superior sincronizada.

### Backend

- As migrations, testes de ownership e fluxo integrado foram preparados e utilizados ao longo das etapas.
- A última saída consolidada de Ruff, Alembic e pytest deve ser registrada antes da submissão.

## Validação final recomendada

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

Não executar `npm audit fix --force` sem revisar a alteração de versões.

### Docker fullstack

Na raiz do repositório:

```powershell
Copy-Item .env.example .env

docker compose config
docker compose build
docker compose up -d
docker compose ps
```

Verificações manuais:

1. acessar `http://localhost:5173`;
2. cadastrar e autenticar um usuário;
3. criar projeto e tarefa;
4. mover a tarefa no kanban;
5. enviar e baixar um anexo;
6. reiniciar os containers;
7. confirmar persistência do banco e do anexo;
8. conferir `http://localhost:8000/docs`;
9. encerrar com `docker compose down` sem `-v`.

Use `docker compose down -v` somente quando quiser remover dados e anexos locais.

## Matriz final

| Área | Validação | Estado |
|---|---|---|
| Backend lint | Ruff check | Pendente de saída final |
| Backend format | Ruff format check | Pendente de saída final |
| Backend testes | pytest e cobertura | Pendente de saída final |
| Migrations | upgrade até `0004` | Pendente de saída final |
| Frontend lint | ESLint | Evidência observada; repetir na rodada final |
| Frontend tipos | TypeScript | Evidência observada; repetir na rodada final |
| Frontend testes | Vitest | Correções aplicadas; rodada final pendente |
| Frontend build | Vite build | Evidência observada; repetir na rodada final |
| Docker Compose | build, health checks e fluxo manual | Pendente |
| Auditoria npm | classificação dos alertas | Pendente |
