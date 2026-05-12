#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ScriptDir = $PSScriptRoot
$RepoRoot  = (Resolve-Path (Join-Path $ScriptDir "..\..\..")).Path

if (-not $env:HF_HUB_DISABLE_SYMLINKS_WARNING) { $env:HF_HUB_DISABLE_SYMLINKS_WARNING = "1" }
if (-not $env:PYTHONIOENCODING)                { $env:PYTHONIOENCODING = "utf-8" }
if (-not $env:PYTHONUTF8)                      { $env:PYTHONUTF8 = "1" }

$PythonBinDocker = "/opt/docling-venv/bin/python"
$PythonBinRepoWin  = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$PythonBinRepoUnix = Join-Path $RepoRoot ".venv/bin/python"

$PythonBin = $null
foreach ($candidate in @($PythonBinDocker, $PythonBinRepoWin, $PythonBinRepoUnix)) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
        $PythonBin = $candidate
        break
    }
}

$ScriptPath = Join-Path $RepoRoot "apps\api\bin\docling_nodes_cuda.py"

if (-not $PythonBin) {
    [Console]::Error.WriteLine("Error: no suitable python venv found for docling_nodes.")
    [Console]::Error.WriteLine("Looked for:")
    [Console]::Error.WriteLine("  - $PythonBinDocker")
    [Console]::Error.WriteLine("  - $PythonBinRepoWin")
    [Console]::Error.WriteLine("  - $PythonBinRepoUnix")
    [Console]::Error.WriteLine("Create the repo venv (.venv) locally, or run inside the Docker workers-runtime image.")
    exit 1
}

if (-not (Test-Path -LiteralPath $ScriptPath -PathType Leaf)) {
    [Console]::Error.WriteLine("Error: script not found: $ScriptPath")
    exit 1
}

& $PythonBin -c "import llama_index.core" 2>$null
if ($LASTEXITCODE -ne 0) {
    $PipHint = if ($PythonBin -like "*\Scripts\python.exe") {
        Join-Path (Split-Path $PythonBin -Parent) "pip.exe"
    } else {
        ($PythonBin -replace "/bin/python$", "/bin/pip")
    }
    [Console]::Error.WriteLine("Error: llama_index is not installed in the selected venv.")
    [Console]::Error.WriteLine("Install with:")
    [Console]::Error.WriteLine("  $PipHint install -U llama-index-core llama-index-readers-docling llama-index-node-parser-docling")
    exit 1
}

& $PythonBin $ScriptPath @args
exit $LASTEXITCODE