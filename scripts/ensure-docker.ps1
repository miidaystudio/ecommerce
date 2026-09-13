# scripts/ensure-docker.ps1
# Ensures Docker Desktop and ecommerce_postgres container are running and responsive.

$ErrorActionPreference = "Continue"

function Test-DockerDaemon {
    $out = & docker ps 2>&1
    return ($LASTEXITCODE -eq 0)
}

function Ensure-PostgresContainer {
    Write-Host "[docker] Verifying postgres container 'ecommerce_postgres'..."
    $status = & docker inspect -f '{{.State.Status}}' ecommerce_postgres 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[docker] Container 'ecommerce_postgres' not found. Creating from docker-compose or image..."
        if (Test-Path "docker-compose.yml") {
            & docker compose up -d
        } else {
            & docker run -d --name ecommerce_postgres -p 5432:5432 -e POSTGRES_USER=ecommerce -e POSTGRES_PASSWORD=ecommerce -e POSTGRES_DB=ecommerce postgres:16-alpine
        }
    } elseif ($status -ne "running") {
        Write-Host "[docker] Starting existing 'ecommerce_postgres' container..."
        & docker start ecommerce_postgres | Out-Null
    }
    Write-Host "[docker] 'ecommerce_postgres' is running on port 5432."
}

if (Test-DockerDaemon) {
    Write-Host "[docker] Docker daemon is already responsive."
    Ensure-PostgresContainer
    exit 0
}

Write-Host "[docker] Docker daemon not responsive. Launching Docker Desktop..."
$dockerExe = "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"

if (Test-Path $dockerExe) {
    Start-Process -FilePath $dockerExe
} else {
    Write-Error "[docker] Docker Desktop executable not found at '$dockerExe'"
    exit 1
}

Write-Host "[docker] Waiting for Docker daemon to become responsive (timeout: 60s)..."
$maxSeconds = 60
$elapsed = 0
$interval = 3

while ($elapsed -lt $maxSeconds) {
    Start-Sleep -Seconds $interval
    $elapsed += $interval
    if (Test-DockerDaemon) {
        Write-Host "[docker] Docker daemon is now responsive (took ~$elapsed seconds)."
        Ensure-PostgresContainer
        exit 0
    }
    Write-Host "[docker] Still waiting for Docker engine ($elapsed/${maxSeconds}s)..."
}

Write-Error "[docker] Timed out waiting for Docker daemon to become responsive."
exit 1
