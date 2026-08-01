param(
    [switch]$InstallDependencies
)

$ErrorActionPreference = "Stop"
$RepositoryRoot = Split-Path -Parent $PSScriptRoot

Write-Host "Validando backend..." -ForegroundColor Cyan
Push-Location (Join-Path $RepositoryRoot "backend")
try {
    if ($InstallDependencies) {
        python -m pip install -e ".[dev]"
    }

    python -m ruff check .
    python -m ruff format . --check
    python -m pytest --cov=app --cov-report=term-missing
}
finally {
    Pop-Location
}

Write-Host "Validando frontend..." -ForegroundColor Cyan
Push-Location (Join-Path $RepositoryRoot "frontend")
try {
    if ($InstallDependencies) {
        npm ci
    }

    npm run check
}
finally {
    Pop-Location
}

Write-Host "Validação concluída sem erros." -ForegroundColor Green