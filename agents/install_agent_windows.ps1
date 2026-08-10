<#
.SYNOPSIS
DCM Heartbeat Agent Automated Installer for Windows
#>

# Ensure script is run as Administrator
if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Please run this script as an Administrator!"
    Write-Host "Right-click powershell and select 'Run as Administrator', then run this script again."
    Exit
}

Write-Host "=== DCM Heartbeat Agent Installer ===" -ForegroundColor Cyan

$BackendUrl = Read-Host "Enter DCM Backend URL (e.g. http://192.168.1.100:8000)"
if ([string]::IsNullOrWhiteSpace($BackendUrl)) {
    Write-Warning "Backend URL is required. Exiting."
    Exit
}

$Interval = Read-Host "Enter interval in seconds (Press Enter for default: 60)"
if ([string]::IsNullOrWhiteSpace($Interval)) { $Interval = "60" }

$AgentPath = "C:\DCM_Agent"
if (!(Test-Path $AgentPath)) {
    New-Item -ItemType Directory -Path $AgentPath | Out-Null
}

$ScriptSource = "$PSScriptRoot\heartbeat_agent.ps1"
if (Test-Path $ScriptSource) {
    Copy-Item $ScriptSource -Destination "$AgentPath\heartbeat_agent.ps1" -Force
} else {
    Write-Warning "heartbeat_agent.ps1 not found. Please ensure both scripts are in the same folder."
    Exit
}

$TaskName = "DCM Heartbeat Agent"

# Remove existing task if any
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create Scheduled Task using SYSTEM account so it runs regardless of user logon
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$AgentPath\heartbeat_agent.ps1`" -BackendUrl `"$BackendUrl`" -IntervalSeconds $Interval"
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

$Task = New-ScheduledTask -Action $Action -Trigger $Trigger -Principal $Principal
Register-ScheduledTask -TaskName $TaskName -InputObject $Task | Out-Null

# Start the task immediately
Start-ScheduledTask -TaskName $TaskName

Write-Host ""
Write-Host "✅ Installation complete!" -ForegroundColor Green
Write-Host "The DCM Heartbeat Agent is now running silently in the background."
Write-Host "It will automatically start every time this server reboots."
Write-Host "You can view or manage it from the 'Task Scheduler' under the name '$TaskName'."
