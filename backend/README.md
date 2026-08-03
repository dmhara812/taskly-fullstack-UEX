# Taskly API

![Python](https://img.shields.io/badge/Python-3.12+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-red)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED)
![Tests](https://img.shields.io/badge/tests-pytest-brightgreen)

![CI](https://github.com/dmhara812/taskly-fullstack-UEX/actions/workflows/ci.yml/badge.svg)

Backend do **Taskly**, uma aplicação de gestão de projetos e tarefas desenvolvida como case técnico full stack.

A API foi construída com FastAPI, SQLAlchemy, PostgreSQL e Alembic, com autenticação JWT, regras de ownership, testes automatizados e armazenamento autenticado de anexos.

> Para executar o projeto completo, incluindo frontend, backend e PostgreSQL, consulte também o [`README.md`](../README.md) da raiz do repositório.

---

## Funcionalidades

- cadastro de usuários;
- login por e-mail e senha;
- access token e refresh token;
- renovação de sessão;
- consulta do usuário autenticado;
- CRUD de projetos;
- projetos ativos e arquivados;
- CRUD de tarefas;
- status, prioridade, descrição e prazo;
- paginação, filtros e busca;
- tags associadas às tarefas;
- criação e reutilização de tags;
- upload autenticado de imagens e PDFs;
- download autenticado de anexos;
- exclusão de anexos;
- validação de ownership;
- bloqueio de alterações em projetos arquivados;
- tratamento centralizado de erros de negócio;
- migrations com Alembic;
- testes automatizados com pytest;
- lint e formatação com Ruff;
- integração contínua com GitHub Actions.

---

## Stack

- Python 3.12+
- FastAPI
- Uvicorn
- PostgreSQL 16
- SQLAlchemy 2
- Alembic
- Pydantic 2
- Pydantic Settings
- JWT
- Psycopg
- pytest
- pytest-cov
- Ruff
- Docker
- Docker Compose
- GitHub Actions

---

## Arquitetura

O backend utiliza separação em camadas:

```text
HTTP request
    ↓
API route
    ↓
Service
    ↓
Repository
    ↓
Database
```

Responsabilidades principais:

```text
app/
├── api/             # rotas HTTP e composição dos routers
├── core/            # configurações, banco, autenticação e dependências
├── models/          # modelos SQLAlchemy
├── schemas/         # contratos de entrada e saída com Pydantic
├── repositories/    # acesso e consultas ao banco
├── services/        # regras de negócio
└── tests/           # testes automatizados

alembic/             # configuração e versões das migrations
storage/             # armazenamento local de anexos
```

As rotas recebem e validam as requisições. As regras de negócio ficam nos serviços, enquanto os repositórios concentram o acesso ao banco.

---

## Modelo de domínio

Relacionamentos principais:

```text
User 1 ─── N Project 1 ─── N Task
                         ├── N Tag
                         └── N Attachment
```

### User

Representa o usuário autenticado.

Campos principais:

- `id`;
- `name`;
- `email`;
- `hashed_password`;
- `is_active`;
- `created_at`;
- `updated_at`.

### Project

Representa um projeto pertencente a um usuário.

Campos principais:

- `id`;
- `owner_id`;
- `name`;
- `description`;
- `status`;
- `created_at`;
- `updated_at`.

Status:

```text
active
archived
```

### Task

Representa uma tarefa pertencente a um projeto.

Campos principais:

- `id`;
- `project_id`;
- `title`;
- `description`;
- `status`;
- `priority`;
- `due_date`;
- `created_at`;
- `updated_at`.

Status:

```text
todo
in_progress
done
```

Prioridades:

```text
low
medium
high
```

### Tag

Representa uma classificação reutilizável associada às tarefas do usuário.

As validações impedem o uso de tags pertencentes a outros usuários.

### Attachment

Representa o metadado de um arquivo associado a uma tarefa.

O conteúdo do arquivo é armazenado fora do banco, no diretório configurado por `ATTACHMENT_STORAGE_DIR`. O acesso ao conteúdo exige autenticação e validação de ownership.

---

## Pré-requisitos

Para desenvolvimento local:

- Git;
- Python 3.12 ou superior;
- Docker Desktop com Docker Compose;
- PostgreSQL 16 executado pelo Docker ou instalado localmente.

Verifique no PowerShell:

```powershell
git --version
py --version
docker --version
docker compose version
```

Caso o comando `py` não esteja disponível:

```powershell
python --version
```

---

## Primeira configuração

Os comandos desta seção partem da **raiz do repositório**.

### 1. Entrar no backend

```powershell
cd backend
```

A partir desse ponto, o terminal estará na **raiz do backend**.

### 2. Criar o ambiente virtual

```powershell
py -m venv .venv
```

Caso o comando `py` não esteja disponível:

```powershell
python -m venv .venv
```

Confirme que o script foi criado:

```powershell
Test-Path .\.venv\Scripts\Activate.ps1
```

Resultado esperado:

```text
True
```

### 3. Ativar o ambiente virtual

```powershell
.\.venv\Scripts\Activate.ps1
```

O terminal deverá ficar semelhante a:

```text
(.venv) PS C:\...\taskly-fullstack-UEX\backend>
```

#### Caso o PowerShell bloqueie o script

Libere a execução somente para a sessão atual:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

A alteração é descartada quando o PowerShell é fechado.

### 4. Instalar as dependências

```powershell
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
```

### 5. Criar o arquivo de ambiente

```powershell
Copy-Item .env.example .env
```

Abra para revisão:

```powershell
notepad .env
```

Troque `JWT_SECRET_KEY` por uma chave local segura.

---

## Variáveis de ambiente

O arquivo `backend/.env.example` contém:

```env
APP_NAME="Taskly API"
APP_ENV="local"
APP_DEBUG=true
APP_VERSION="0.1.0"

# Use esta URL quando rodar a API localmente pelo VS Code/terminal.
DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5433/projects_api"

# Banco separado para testes locais.
TEST_DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5433/projects_api_test"

JWT_SECRET_KEY="change-this-secret-key"
JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

CORS_ORIGINS="http://localhost:5173,http://localhost:8000"

# Anexos são armazenados fora do banco; caminhos relativos partem de backend/.
ATTACHMENT_STORAGE_DIR="storage/attachments"
ATTACHMENT_MAX_SIZE_BYTES=5242880
ATTACHMENT_ALLOWED_CONTENT_TYPES="image/jpeg,image/png,image/webp,application/pdf"
```

### Variáveis principais

| Variável | Finalidade |
|---|---|
| `DATABASE_URL` | conexão do backend local com o PostgreSQL |
| `TEST_DATABASE_URL` | conexão utilizada pelos testes |
| `JWT_SECRET_KEY` | assinatura dos tokens JWT |
| `JWT_ALGORITHM` | algoritmo de assinatura |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | validade do access token |
| `REFRESH_TOKEN_EXPIRE_DAYS` | validade do refresh token |
| `CORS_ORIGINS` | origens autorizadas a chamar a API |
| `ATTACHMENT_STORAGE_DIR` | diretório de armazenamento dos anexos |
| `ATTACHMENT_MAX_SIZE_BYTES` | tamanho máximo de cada arquivo |
| `ATTACHMENT_ALLOWED_CONTENT_TYPES` | tipos MIME aceitos |

Com o valor padrão:

```env
ATTACHMENT_MAX_SIZE_BYTES=5242880
```

o limite é de 5 MiB por arquivo.

Tipos aceitos:

```text
image/jpeg
image/png
image/webp
application/pdf
```

O caminho relativo:

```env
ATTACHMENT_STORAGE_DIR="storage/attachments"
```

é resolvido a partir da pasta `backend/`.

---

## PostgreSQL e portas

O PostgreSQL do projeto utiliza:

```text
localhost:5433 → container db:5432
```

Quando o backend é executado diretamente no Windows, a URL usa:

```text
localhost:5433
```

Quando a API é executada dentro do Docker Compose, a configuração do serviço deve usar:

```text
db:5432
```

Essa configuração interna é fornecida pelo Docker Compose e não deve substituir a URL local do arquivo `backend/.env`.

---

## Executar localmente com PostgreSQL no Docker

### 1. Iniciar o banco

Na **raiz do repositório**:

```powershell
docker compose up -d db
docker compose ps
```

### 2. Ativar o backend

Em outro PowerShell:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
```

### 3. Aplicar as migrations

```powershell
python -m alembic upgrade head
```

### 4. Iniciar a API

```powershell
python -m uvicorn app.main:app --reload
```

Acessos:

- API: `http://localhost:8000`;
- Swagger: `http://localhost:8000/docs`;
- health check: `http://localhost:8000/api/v1/health`.

Para interromper a API:

```text
Ctrl + C
```

---

## Execuções posteriores

Depois que `.venv` e `.env` já existirem:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m alembic upgrade head
python -m uvicorn app.main:app --reload
```

Não é necessário recriar a `.venv` a cada execução.

---

## Executar pelo Docker Compose

A execução fullstack é documentada no README da raiz.

Na **raiz do repositório**:

```powershell
Copy-Item .env.example .env
docker compose up -d --build
docker compose ps
```

A API executa as migrations antes de iniciar.

Logs da API:

```powershell
docker compose logs -f api
```

Parar os serviços:

```powershell
docker compose down
```

Os volumes preservam o banco e os anexos entre reinícios.

Para remover também os dados:

```powershell
docker compose down -v
```

---

## Migrations com Alembic

Execute os comandos na raiz `backend/`, com a `.venv` ativa.

Aplicar todas as migrations:

```powershell
python -m alembic upgrade head
```

Consultar o histórico:

```powershell
python -m alembic history
```

Consultar as heads:

```powershell
python -m alembic heads
```

Consultar a versão atual:

```powershell
python -m alembic current
```

Criar uma migration:

```powershell
python -m alembic revision --autogenerate -m "descricao da alteracao"
```

Reverter uma migration:

```powershell
python -m alembic downgrade -1
```

Sempre revise migrations geradas automaticamente antes de aplicá-las.

---

## Testes

Os testes utilizam o banco definido por:

```env
TEST_DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5433/projects_api_test"
```

### Criar o banco de testes

Com o serviço `db` ativo, execute na raiz do repositório:

```powershell
docker compose exec db createdb -U postgres projects_api_test
```

Caso o banco já exista, o PostgreSQL informará que ele não pode ser criado novamente. Isso não impede a execução dos testes.

### Executar os testes

Na raiz `backend/`, com a `.venv` ativa:

```powershell
python -m pytest
```

Com detalhes adicionais:

```powershell
python -m pytest -vv
```

Com cobertura:

```powershell
python -m pytest --cov=app --cov-report=term-missing
```

Executar apenas um arquivo:

```powershell
python -m pytest app/tests/test_auth.py -vv
```

Executar apenas um teste:

```powershell
python -m pytest app/tests/test_auth.py::nome_do_teste -vv
```

---

## Ruff

Execute na raiz `backend/`, com a `.venv` ativa.

Verificar o código:

```powershell
python -m ruff check .
```

Corrigir automaticamente o que for seguro:

```powershell
python -m ruff check . --fix
```

Formatar:

```powershell
python -m ruff format .
```

Verificar a formatação sem alterar arquivos:

```powershell
python -m ruff format . --check
```

---

## Validação completa do backend

```powershell
python -m ruff check .
python -m ruff format . --check
python -m pytest
```

A validação completa do repositório também pode ser executada pela raiz:

```powershell
.\scripts\validate.ps1
```

---

## Endpoints principais

Base URL:

```text
http://localhost:8000/api/v1
```

A documentação completa e atualizada dos contratos está disponível no Swagger:

```text
http://localhost:8000/docs
```

### Health

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/health` | verifica se a API está online |

### Autenticação

| Método | Endpoint | Descrição |
|---|---|---|
| `POST` | `/auth/register` | registra um usuário |
| `POST` | `/auth/login` | autentica e retorna os tokens |
| `POST` | `/auth/refresh` | renova access e refresh tokens |
| `GET` | `/auth/me` | retorna o usuário autenticado |

### Projetos

| Método | Endpoint | Descrição |
|---|---|---|
| `POST` | `/projects` | cria um projeto |
| `GET` | `/projects` | lista projetos |
| `GET` | `/projects/{project_id}` | consulta um projeto |
| `PATCH` | `/projects/{project_id}` | atualiza um projeto |
| `PATCH` | `/projects/{project_id}/archive` | arquiva um projeto |
| `DELETE` | `/projects/{project_id}` | exclui um projeto |

### Tarefas

| Método | Endpoint | Descrição |
|---|---|---|
| `POST` | `/tasks` | cria uma tarefa |
| `GET` | `/tasks` | lista tarefas |
| `GET` | `/tasks/{task_id}` | consulta uma tarefa |
| `PATCH` | `/tasks/{task_id}` | atualiza uma tarefa |
| `DELETE` | `/tasks/{task_id}` | exclui uma tarefa |

### Tags

As rotas de tags permitem consultar, criar e associar tags conforme os contratos exibidos no Swagger.

### Anexos

| Método | Endpoint | Descrição |
|---|---|---|
| `POST` | `/tasks/{task_id}/attachments` | envia um anexo para uma tarefa |
| `GET` | `/attachments/{attachment_id}/content` | baixa o conteúdo autenticado |
| `DELETE` | `/attachments/{attachment_id}` | exclui o anexo |

O identificador do anexo é global. Por isso, download e exclusão usam apenas `attachment_id`.

Upload e exclusão são bloqueados quando o projeto está arquivado. A consulta e o download permanecem disponíveis em modo somente leitura.

---

## Autenticação

O login utiliza dados no formato `application/x-www-form-urlencoded`:

```text
username=ana.silva@example.com
password=StrongPassword123
```

Resposta esperada:

```json
{
  "access_token": "jwt-access-token",
  "refresh_token": "jwt-refresh-token",
  "token_type": "bearer"
}
```

Rotas protegidas exigem:

```http
Authorization: Bearer <access_token>
```

O access token identifica o usuário pelo claim `sub`.

O endpoint de refresh valida o tipo do token e emite um novo access token e um novo refresh token.

---

## Ownership e projetos arquivados

A API valida que o recurso solicitado pertence ao usuário autenticado.

Essa proteção é aplicada a:

- projetos;
- tarefas;
- tags;
- anexos.

Projetos arquivados funcionam em modo somente leitura. A API impede alterações, incluindo:

- criação e edição de tarefas;
- movimentação de tarefas;
- upload de anexos;
- exclusão de anexos.

As consultas continuam disponíveis.

---

## Anexos

Os metadados são persistidos no PostgreSQL. O conteúdo dos arquivos é armazenado no sistema de arquivos.

Configuração padrão:

```env
ATTACHMENT_STORAGE_DIR="storage/attachments"
ATTACHMENT_MAX_SIZE_BYTES=5242880
ATTACHMENT_ALLOWED_CONTENT_TYPES="image/jpeg,image/png,image/webp,application/pdf"
```

O backend:

- valida o tipo MIME;
- valida o tamanho máximo;
- gera identificação própria para o arquivo;
- relaciona o anexo à tarefa;
- valida ownership no download e na exclusão;
- remove o arquivo físico ao excluir o anexo;
- bloqueia alterações em projetos arquivados.

O diretório local de armazenamento não deve ser usado como mecanismo definitivo em um deploy com filesystem efêmero. Uma evolução futura é utilizar armazenamento compatível com S3.

---

## Filtros e paginação

As listagens aceitam paginação e filtros conforme a documentação do Swagger.

Exemplo de projetos:

```http
GET /api/v1/projects?page=1&size=20&status=active&search=portfolio
```

Exemplo de tarefas:

```http
GET /api/v1/tasks?page=1&size=20&project_id=<uuid>&status=todo&priority=high&search=auth
```

Formato paginado:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "size": 20,
  "pages": 0
}
```

---

## Tratamento de erros

Respostas comuns:

| Status | Significado |
|---:|---|
| `400` | regra de negócio inválida |
| `401` ou `403` | autenticação inválida ou acesso não autorizado |
| `404` | recurso não encontrado |
| `409` | conflito, como e-mail já cadastrado |
| `422` | erro de validação do payload |

Exemplos de regras que podem retornar `400`:

- tentativa de alterar um projeto arquivado;
- upload em tarefa de projeto arquivado;
- exclusão de anexo de projeto arquivado.

---

## Solução de problemas

### `.venv` não encontrada

Erro:

```text
.\.venv\Scripts\Activate.ps1 não é reconhecido
```

Crie o ambiente na raiz `backend/`:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### PowerShell bloqueia o `Activate.ps1`

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

### Alembic, Ruff, Uvicorn ou pytest não reconhecidos

Use a execução pelo módulo Python:

```powershell
python -m alembic upgrade head
python -m ruff check .
python -m uvicorn app.main:app --reload
python -m pytest
```

Se os pacotes ainda não estiverem instalados:

```powershell
python -m pip install -e ".[dev]"
```

### PostgreSQL indisponível

Confira o serviço:

```powershell
docker compose ps
docker compose logs db
```

Inicie novamente:

```powershell
docker compose up -d db
```

### Porta 8000 ocupada

```powershell
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
```

### Anexo não encontrado após reinício

Na execução local, confirme:

- o valor de `ATTACHMENT_STORAGE_DIR`;
- a existência de `backend/storage/attachments`;
- as permissões de escrita;
- se o volume `attachment_data` está configurado quando o backend roda no Docker.

---

## CI com GitHub Actions

O workflow está localizado na raiz do repositório:

```text
.github/workflows/ci.yml
```

O CI valida, entre outros pontos:

- instalação das dependências;
- PostgreSQL como serviço;
- migrations;
- Ruff;
- pytest;
- validações do frontend.

---

## Decisões técnicas

### Arquitetura em camadas

Separa HTTP, regras de negócio e persistência, facilitando manutenção e testes.

### UUID

Os recursos utilizam UUIDs em vez de identificadores sequenciais.

### JWT com access e refresh token

O access token tem duração curta e protege as rotas privadas. O refresh token permite renovar a sessão sem solicitar novamente a senha.

### Ownership

Toda operação protegida valida o usuário proprietário do recurso.

### PostgreSQL separado para testes

`TEST_DATABASE_URL` evita que os testes alterem o banco local de desenvolvimento.

### Armazenamento de anexos fora do banco

O PostgreSQL mantém metadados e relacionamentos, enquanto os arquivos são persistidos no diretório configurado.

### Projetos arquivados em modo somente leitura

O arquivamento preserva o histórico, mas impede novas alterações.

---

## Melhorias futuras

- cookies HttpOnly para autenticação;
- revogação ou blacklist de refresh tokens;
- rate limiting;
- logs estruturados;
- membros e permissões por projeto;
- comentários em tarefas;
- armazenamento de anexos compatível com S3;
- observabilidade;
- testes end-to-end;
- deploy em ambiente demonstrativo.

---

## Documentação relacionada

- [README principal](../README.md)
- [Frontend](../frontend/README.md)
- [Especificação funcional](../docs/SPEC.md)
- [Arquitetura](../docs/ARCHITECTURE.md)
- [Decisões técnicas](../docs/DECISIONS.md)
- [Uso de IA](../docs/AI_USAGE.md)
- [Validação](../docs/VALIDATION.md)
