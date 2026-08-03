# Taskly Fullstack

Aplicação de gestão de projetos e tarefas desenvolvida como case técnico, com backend FastAPI, frontend React/TypeScript, PostgreSQL, migrations, testes automatizados e execução fullstack com Docker Compose.

## Funcionalidades

- cadastro, login, renovação de sessão e logout;
- rotas públicas e protegidas;
- persistência local da sessão;
- projetos ativos e arquivados;
- criação, edição e exclusão de tarefas;
- tarefas com descrição, prioridade, prazo, tags e anexos;
- visualização em lista e kanban;
- filtros por status, prioridade e texto;
- drag-and-drop com atualização otimista, persistência e rollback;
- ownership de projetos, tarefas, tags e anexos;
- upload e download autenticado de imagens e PDFs;
- modo somente leitura para projetos arquivados;
- validação automatizada do backend e frontend.

## Stack

### Backend

- Python 3.12+
- FastAPI
- SQLAlchemy 2
- Pydantic 2
- PostgreSQL 16
- Alembic
- JWT
- pytest
- Ruff

### Frontend

- React
- Vite
- TypeScript
- React Router
- TanStack Query
- React Hook Form
- Zod
- dnd-kit
- Vitest
- Testing Library
- ESLint

### Infraestrutura

- Docker
- Docker Compose
- Nginx
- GitHub Actions

## Estrutura

```text
taskly-fullstack-UEX/
├── backend/          # FastAPI, SQLAlchemy, Alembic e pytest
├── frontend/         # React, Vite, TypeScript e Vitest
├── docs/             # especificação, arquitetura, decisões e validação
├── scripts/          # validação local
├── .github/          # integração contínua
├── docker-compose.yml
└── README.md
```

## Pré-requisitos

### Execução completa com Docker

- Git;
- Docker Desktop com Docker Compose.

### Desenvolvimento separado

- Git;
- Docker Desktop ou PostgreSQL 16 instalado localmente;
- Python 3.12 ou superior;
- Node.js 20.19 ou superior;
- npm.

Verifique as instalações no PowerShell:

```powershell
git --version
docker --version
docker compose version
py --version
node --version
npm --version
```

Caso o comando `py` não esteja disponível, tente:

```powershell
python --version
```

## Clonar o repositório

```powershell
git clone https://github.com/dmhara812/taskly-fullstack-UEX.git
cd taskly-fullstack-UEX
```

A partir desse ponto, o terminal estará na **raiz do repositório**.

---

# Execução fullstack com Docker

Esta é a forma mais simples e recomendada para executar o projeto completo.

## 1. Configurar o ambiente

Na raiz do repositório:

```powershell
Copy-Item .env.example .env
```

Abra o arquivo:

```powershell
notepad .env
```

Substitua o valor de `TASKLY_JWT_SECRET_KEY` por uma chave local segura.

O arquivo `.env` não deve ser enviado ao Git.

## 2. Iniciar a aplicação

Certifique-se de que o Docker Desktop esteja aberto e ativo.

Na raiz do repositório:

```powershell
docker compose up -d --build
```

Confira os serviços:

```powershell
docker compose ps
```

## 3. Acessar

- aplicação: `http://localhost:5173`;
- cadastro: `http://localhost:5173/register`;
- login: `http://localhost:5173/login`;
- Swagger: `http://localhost:8000/docs`;
- health check: `http://localhost:8000/api/v1/health`.

As migrations do banco são executadas automaticamente pelo entrypoint da API.

Os volumes `postgres_data` e `attachment_data` preservam o banco e os anexos entre reinícios.

## 4. Consultar logs

Todos os serviços:

```powershell
docker compose logs -f
```

Somente a API:

```powershell
docker compose logs -f api
```

Somente o frontend:

```powershell
docker compose logs -f frontend
```

Somente o banco:

```powershell
docker compose logs -f db
```

Use `Ctrl + C` para sair da visualização dos logs. Isso não interrompe os contêineres executados em segundo plano.

## 5. Parar a aplicação

Parar e remover os contêineres, preservando os volumes:

```powershell
docker compose down
```

Iniciar novamente:

```powershell
docker compose up -d
```

Apagar também banco e anexos locais:

```powershell
docker compose down -v
```

> O comando `docker compose down -v` remove definitivamente os dados mantidos nos volumes locais.

---

# Desenvolvimento separado

Nesse modo, o PostgreSQL é executado pelo Docker, enquanto backend e frontend são executados diretamente na máquina.

Serão necessários três terminais:

1. PostgreSQL;
2. backend;
3. frontend.

## 1. Iniciar somente o PostgreSQL

Na raiz do repositório:

```powershell
docker compose up -d db
docker compose ps
```

---

## 2. Configurar e iniciar o backend

Abra outro PowerShell na raiz do repositório:

```powershell
cd backend
```

Agora você estará na **raiz do backend**.

### Primeira execução neste computador

Confirme o Python:

```powershell
py --version
```

Crie o ambiente virtual:

```powershell
py -m venv .venv
```

Caso o comando `py` não exista:

```powershell
python -m venv .venv
```

Confirme que o ambiente foi criado:

```powershell
Test-Path .\.venv\Scripts\Activate.ps1
```

O resultado esperado é:

```text
True
```

Ative o ambiente:

```powershell
.\.venv\Scripts\Activate.ps1
```

O início do terminal deverá mudar para:

```text
(.venv) PS C:\...\taskly-fullstack-UEX\backend>
```

Copie as variáveis do backend:

```powershell
Copy-Item .env.example .env
```

Instale as dependências:

```powershell
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
```

Execute as migrations:

```powershell
python -m alembic upgrade head
```

Inicie a API:

```powershell
python -m uvicorn app.main:app --reload
```

A API ficará disponível em:

```text
http://localhost:8000
```

Swagger:

```text
http://localhost:8000/docs
```

### Execuções posteriores

Depois que a `.venv` já existir, não é necessário criá-la novamente:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m alembic upgrade head
python -m uvicorn app.main:app --reload
```

Para interromper o backend:

```text
Ctrl + C
```

---

## 3. Configurar e iniciar o frontend

Abra um terceiro PowerShell na raiz do repositório:

```powershell
cd frontend
```

Copie o ambiente:

```powershell
Copy-Item .env.example .env
```

O valor padrão deve apontar para:

```env
VITE_API_URL="http://localhost:8000/api/v1"
```

Instale as dependências:

```powershell
npm install
```

Inicie o Vite:

```powershell
npm run dev
```

A aplicação ficará disponível em:

```text
http://localhost:5173
```

Para interromper o frontend:

```text
Ctrl + C
```

---

# Validação

## Validação completa

Na raiz do repositório:

```powershell
.\scripts\validate.ps1
```

## Backend

Na raiz `backend/`, com a `.venv` ativa:

```powershell
python -m ruff check .
python -m ruff format . --check
python -m pytest
```

Com cobertura:

```powershell
python -m pytest --cov=app --cov-report=term-missing
```

## Frontend

Na raiz `frontend/`:

```powershell
npm run check
```

O comando executa:

- ESLint;
- verificação do TypeScript;
- testes com Vitest;
- build de produção.

Os resultados finais da validação são registrados em:

```text
docs/VALIDATION.md
```

---

# Comandos úteis

## Banco e API

```powershell
docker compose up -d db
docker compose up -d api
docker compose stop api
docker compose stop db
docker compose ps
```

## Alembic

Na raiz `backend/` e com a `.venv` ativa:

```powershell
python -m alembic history
python -m alembic heads
python -m alembic current
python -m alembic upgrade head
```

## Backend

```powershell
python -m uvicorn app.main:app --reload
python -m pytest
python -m ruff check .
```

## Frontend

```powershell
npm run dev
npm run check
npm run build
```

---

# Solução de problemas

## `.venv` não encontrada

Erro:

```text
.\.venv\Scripts\Activate.ps1 não é reconhecido
```

Isso significa que o ambiente ainda não foi criado naquele computador.

Na raiz `backend/`:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
```

## PowerShell bloqueia `Activate.ps1`

Libere somente a sessão atual:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Essa alteração é descartada ao fechar o PowerShell.

## PowerShell bloqueia `npm.ps1`

Libere somente a sessão atual:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Ou execute o arquivo do npm diretamente:

```powershell
npm.cmd install
npm.cmd run dev
```

## Alembic, Ruff ou pytest não reconhecidos

Use os módulos vinculados ao Python da `.venv`:

```powershell
python -m alembic upgrade head
python -m ruff check .
python -m pytest
```

Caso ainda não estejam instalados:

```powershell
python -m pip install -e ".[dev]"
```

## Docker Desktop não inicia

Feche o Docker Desktop e, em um PowerShell como administrador, execute:

```powershell
wsl --shutdown
wsl --update
```

Abra novamente o Docker Desktop e confira:

```powershell
docker version
docker info
```

## Porta ocupada

Verifique as portas utilizadas:

```powershell
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
```

---

# Documentação

- [Especificação funcional](docs/SPEC.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Decisões técnicas](docs/DECISIONS.md)
- [Uso de IA](docs/AI_USAGE.md)
- [Validação](docs/VALIDATION.md)
- [Estado atual](docs/CURRENT_STATE.md)
- [Organização da documentação](docs/README.md)
- [Detalhes do backend](backend/README.md)
- [Detalhes do frontend](frontend/README.md)

# Uso de IA

A IA foi utilizada como apoio para pesquisa, comparação de alternativas, sugestões e revisão técnica.

As decisões arquiteturais, a implementação, as adaptações, a execução dos testes, a validação e a responsabilidade pelo resultado final pertencem ao desenvolvedor.

A revisão crítica está consolidada em `docs/AI_USAGE.md`. A documentação pública contém somente consultas representativas, sem incluir notas operacionais extensas.

# Deploy público

A entrega prioriza uma execução local reproduzível e estável.

O deploy público não foi incluído porque exigiria decisões adicionais sobre:

- PostgreSQL gerenciado;
- gerenciamento de segredos;
- configuração de CORS;
- armazenamento durável dos anexos;
- observabilidade e manutenção do ambiente.

Como evolução futura, a aplicação poderá utilizar:

- frontend estático publicado separadamente;
- API containerizada;
- PostgreSQL gerenciado;
- armazenamento compatível com S3;
- observabilidade;
- testes end-to-end.