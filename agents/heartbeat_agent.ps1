<#
.SYNOPSIS
DCM Heartbeat Agent for Windows VMs
.DESCRIPTION
This script sends a periodic heartbeat to the DCM Backend to indicate this Windows server is online.
#>

param (
    [string]$BackendUrl = "http://localhost:8000",
    [int]$IntervalSeconds = 60,
    [string]$IpAddress = ""
)

if ([string]::IsNullOrEmpty($IpAddress)) {
    # Get the primary IPv4 address
    $ipInfo = Get-NetIPAddress -AddressFamily IPv4 -Type Unicast | Where-Object { $_.InterfaceAlias -notmatch "Loopback" } | Select-Object -First 1
    if ($ipInfo) {
        $IpAddress = $ipInfo.IPAddress
    } else {
        $IpAddress = "127.0.0.1"
    }
}

$Hostname = [System.Net.Dns]::GetHostName()
$Url = "$($BackendUrl.TrimEnd('/'))/api/server-ping-monitoring/heartbeat"

Write-Host "Starting DCM Heartbeat Agent for Windows..."
Write-Host "Target Backend: $Url"
Write-Host "Interval: $IntervalSeconds seconds"
Write-Host "Local IP: $IpAddress"
Write-Host "Hostname: $Hostname"
Write-Host "--------------------------------------------------"

while ($true) {
    $Payload = @{
        ipAddress = $IpAddress
        hostname = $Hostname
        status = "UP"
    }
    $JsonPayload = $Payload | ConvertTo-Json

    try {
        $Response = Invoke-RestMethod -Uri $Url -Method Post -Body $JsonPayload -ContentType "application/json" -TimeoutSec 10
        $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Write-Host "[$Timestamp] Heartbeat sent successfully for $Hostname ($IpAddress)"
    } catch {
        $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Write-Host "[$Timestamp] Error sending heartbeat: $_" -ForegroundColor Red
    }

    Start-Sleep -Seconds $IntervalSeconds
}
