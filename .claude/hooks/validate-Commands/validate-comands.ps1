# Read hook payload from stdin
$inputJson = [Console]::In.ReadToEnd()

try {
    $payload = $inputJson | ConvertFrom-Json
}
catch {
    exit 0
}

# Claude Bash/PowerShell command
$command = $payload.tool_input.command

if ([string]::IsNullOrWhiteSpace($command)) {
    exit 0
}

$blockListFile = Join-Path $PSScriptRoot "blocklist.txt"

if (-not (Test-Path $blockListFile)) {
    exit 0
}

Get-Content $blockListFile | ForEach-Object {

    $pattern = $_.Trim()

    if ([string]::IsNullOrWhiteSpace($pattern)) {
        return
    }

    if ($pattern.StartsWith("#")) {
        return
    }

    if ($command -match $pattern) {
        Write-Host "BLOCKED: Dangerous command detected."
        Write-Host "Pattern: $pattern"
        exit 1
    }
}

exit 0