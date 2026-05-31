$configFile = Join-Path $PSScriptRoot "monitored-files.txt"

if (-not (Test-Path $configFile)) {
    Write-Host "Configuration file not found."
    exit 0
}

# Read monitored files
$monitoredFiles = Get-Content $configFile |
    Where-Object {
        $_.Trim() -ne "" -and
        -not $_.Trim().StartsWith("#")
    }

# Get changed files
$changedFiles = git diff --name-only HEAD 2>$null

if (-not $changedFiles) {
    exit 0
}

$triggeredFiles = @()

foreach ($file in $monitoredFiles) {

    if ($changedFiles -contains $file) {
        $triggeredFiles += $file
    }
}

if ($triggeredFiles.Count -eq 0) {
    exit 0
}

# Ignore if CLAUDE.md itself changed
if ($changedFiles -contains "CLAUDE.md") {
    exit 0
}

$warningDir = ".claude\warnings"

if (-not (Test-Path $warningDir)) {
    New-Item `
        -ItemType Directory `
        -Path $warningDir `
        -Force | Out-Null
}

$warningFile = Join-Path $warningDir "claude-sync-required.md"

$content = @"
# CLAUDE.md Sync Required

The following monitored files were modified:

$($triggeredFiles | ForEach-Object { "- $_" } | Out-String)

CLAUDE.md was not modified.

Please review whether the following sections need updating:

- Project Overview
- Architecture Summary
- Security Constraints
- Development Guidelines
- Project Structure

Generated: $(Get-Date)
"@

Set-Content `
    -Path $warningFile `
    -Value $content

Write-Host "CLAUDE.md consistency warning generated."