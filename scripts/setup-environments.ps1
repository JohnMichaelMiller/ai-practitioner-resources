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

function ConvertFrom-SecureStringToPlainText {
  param(
    [Parameter(Mandatory = $true)]
    [Security.SecureString]$SecureString
  )

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

# Environment variables required by the automation scripts
$envVarDefinitions = @(
  @{ Name = "ANTHROPIC_API_KEY"; Sensitive = $true; Description = "Anthropic API key for Claude AI generation (required)" }
  @{ Name = "GIST_TOKEN"; Sensitive = $true; Description = "GitHub personal access token with gist scope (primary, required)" }
  @{ Name = "GITHUB_GIST_TOKEN"; Sensitive = $true; Description = "GitHub personal access token with gist scope (fallback, for compatibility)" }
  @{ Name = "GIST_ID"; Sensitive = $false; Description = "Production GitHub Gist ID" }
  @{ Name = "TEST_GIST_ID"; Sensitive = $false; Description = "Test GitHub Gist ID" }
  @{ Name = "TEST_GIST_TOKEN"; Sensitive = $true; Description = "GitHub token for test gist updates" }
  @{ Name = "AI_TEMPERATURE"; Sensitive = $false; Description = "AI temperature value (for example: 0.3)" }
)

$envVars = @{}

Write-Host "This script will configure the following environment variables permanently (User scope):" -ForegroundColor Yellow
foreach ($definition in $envVarDefinitions) {
  Write-Host "  $($definition.Name) - $($definition.Description)" -ForegroundColor White
}

Write-Host "`n⚠️  WARNING: This will permanently set these environment variables for your user account." -ForegroundColor Yellow
Write-Host "   They will persist across PowerShell sessions and system restarts.`n" -ForegroundColor Yellow

$confirmation = Read-Host "Do you want to continue to value entry? (yes/no)"

if ($confirmation -ne "yes") {
  Write-Host "`n❌ Setup cancelled." -ForegroundColor Red
  exit 1
}

Write-Host "`n📝 Enter values for each environment variable:" -ForegroundColor Cyan
foreach ($definition in $envVarDefinitions) {
  if ($definition.Sensitive) {
    $secureValue = Read-Host "  $($definition.Name)" -AsSecureString
    $envVars[$definition.Name] = ConvertFrom-SecureStringToPlainText -SecureString $secureValue
  }
  else {
    $envVars[$definition.Name] = Read-Host "  $($definition.Name)"
  }
}

Write-Host "`nReview the values to be written:" -ForegroundColor Yellow
foreach ($definition in $envVarDefinitions) {
  $key = $definition.Name
  $value = $envVars[$key]
  if ([string]::IsNullOrEmpty($value)) {
    $displayValue = "<empty>"
  }
  elseif ($definition.Sensitive) {
    $displayValue = if ($value.Length -gt 8) { $value.Substring(0, 4) + "..." + $value.Substring($value.Length - 4) } else { "****" }
  }
  else {
    $displayValue = $value
  }

  Write-Host "  $key = $displayValue" -ForegroundColor White
}

$finalConfirmation = Read-Host "`nWrite these values to your user environment? (yes/no)"
if ($finalConfirmation -ne "yes") {
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
