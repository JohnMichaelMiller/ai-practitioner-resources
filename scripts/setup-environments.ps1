#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Setup environment variables for AI Practitioner Resources automation
.DESCRIPTION
    This script sets environment variables permanently at the User level.
    These variables are used by the automation scripts for gist management and AI generation.
.NOTES
    Run this script once to configure your environment.
#>

Write-Host "`n🔧 AI Practitioner Resources - Environment Setup" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

# Configuration values
$envVars = @{
    # See OneNote for details on how to get these values
    "test"           = "test"
}

Write-Host "This will set the following environment variables permanently (User scope):" -ForegroundColor Yellow
foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    # Mask sensitive values for display
    $displayValue = if ($value.Length -gt 20) {
        $value.Substring(0, 10) + "..." + $value.Substring($value.Length - 10)
    }
    else {
        $value
    }
    Write-Host "  $key = $displayValue" -ForegroundColor White
}

Write-Host "`n⚠️  WARNING: This will permanently set these environment variables for your user account." -ForegroundColor Yellow
Write-Host "   They will persist across PowerShell sessions and system restarts.`n" -ForegroundColor Yellow

$confirmation = Read-Host "Do you want to proceed? (yes/no)"

if ($confirmation -ne "yes") {
    Write-Host "`n❌ Setup cancelled." -ForegroundColor Red
    exit 1
}

Write-Host "`n📝 Setting environment variables..." -ForegroundColor Cyan

$successCount = 0
$errorCount = 0

foreach ($key in $envVars.Keys) {
    try {
        # Set permanently at User level
        [Environment]::SetEnvironmentVariable($key, $envVars[$key], "User")

        # Also set for current session
        Set-Item -Path "env:$key" -Value $envVars[$key]

        Write-Host "  ✓ $key" -ForegroundColor Green
        $successCount++
    }
    catch {
        Write-Host "  ✗ $key - Error: $_" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host "`n📊 Summary:" -ForegroundColor Cyan
Write-Host "  Successfully set: $successCount" -ForegroundColor Green
if ($errorCount -gt 0) {
    Write-Host "  Failed: $errorCount" -ForegroundColor Red
}

Write-Host "`n✅ Environment setup complete!" -ForegroundColor Green
Write-Host "   Variables are now set permanently and available in current session." -ForegroundColor White
Write-Host "`n💡 Next steps:" -ForegroundColor Cyan
Write-Host "  • Run: npm run test:update-gist (to test)" -ForegroundColor White
Write-Host "  • Run: npm run update-gist (for production)" -ForegroundColor White
Write-Host "`n⚠️  Note: You may need to restart VS Code or other terminals to use these variables." -ForegroundColor Yellow
