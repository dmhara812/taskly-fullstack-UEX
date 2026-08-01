#!/usr/bin/env sh
set -eu

REPOSITORY_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

if [ "${INSTALL_DEPENDENCIES:-0}" = "1" ]; then
  (
    cd "$REPOSITORY_ROOT/backend"
    python -m pip install -e ".[dev]"
  )
  (
    cd "$REPOSITORY_ROOT/frontend"
    npm ci
  )
fi

(
  cd "$REPOSITORY_ROOT/backend"
  python -m ruff check .
  python -m ruff format . --check
  python -m pytest --cov=app --cov-report=term-missing
)

(
  cd "$REPOSITORY_ROOT/frontend"
  npm run check
)

printf '%s\n' "Validação concluída sem erros."