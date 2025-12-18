# cleanup.ps1 (Versión Rápida, Compatible y CON BARRA DE PROGRESO)

param(
    [string]$bindingName,
    [string]$fileName
)

Write-Host "Limpiando el KV namespace con binding '$bindingName' usando el archivo '$fileName' (MODO RÁPIDO)..."

# El tamaño del lote sigue siendo 20, como pediste.
$batchSize = 20

# Lee el archivo JSON
$keys = Get-Content -Path $fileName -Raw | ConvertFrom-Json

# Inicia una lista para guardar los trabajos (jobs) que lancemos
$jobs = @()

# Bucle para crear los trabajos en lotes
for ($i = 0; $i -lt $keys.Count; $i += $batchSize) {
    $batch = $keys[$i..($i + $batchSize - 1)]
    
    # Inicia un "Trabajo" y lo añade a nuestra lista
    $job = Start-Job -ScriptBlock {
        param($wranglerBatch, $wranglerBinding)
        foreach ($key in $wranglerBatch) {
            if ($key) {
                $keyName = $key.name
                wrangler kv key delete "$keyName" --binding $wranglerBinding --remote
            }
        }
    } -ArgumentList $batch, $bindingName
    $jobs += $job
}

# --- NUEVA SECCIÓN CON BARRA DE PROGRESO ---
Write-Host "Todos los trabajos de borrado han sido enviados. Monitoreando el progreso..."

$totalJobs = $jobs.Count
while ( (Get-Job -State Running).Count -gt 0 ) {
    $completedJobs = $totalJobs - (Get-Job -State Running).Count
    $percentComplete = ($completedJobs / $totalJobs) * 100
    
    # Esta es la línea que crea la barra de progreso
    Write-Progress -Activity "Borrando claves de KV en paralelo" -Status "$completedJobs de $totalJobs lotes completados" -PercentComplete $percentComplete
    
    Start-Sleep -Seconds 1
}

# Cierra la barra de progreso al terminar
Write-Progress -Activity "Borrando claves de KV en paralelo" -Completed

Write-Host "Todos los trabajos han finalizado."

# Limpia los trabajos de la sesión
Get-Job | Remove-Job

Write-Host "¡Limpieza completada para $bindingName!"