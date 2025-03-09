# 增强版PowerShell脚本
$ErrorActionPreference = 'Stop'
$host.UI.RawUI.WindowTitle = "文件更新进程 - 正在运行..."

try {
    # 配置参数
    $urls = @(
        "https://mp5tournament.github.io/bracket.json",
        "https://mp5tournament.pages.dev/bracket.json"
    )
    $targetPath = Join-Path $PSScriptRoot "static\COMMON\data\bracket.json"
    $tempFile = New-TemporaryFile

    # 强制现代加密协议
    [Net.ServicePointManager]::SecurityProtocol = 
        [Net.SecurityProtocolType]::Tls12 -bor
        [Net.SecurityProtocolType]::Tls13

    # 增强型JSON验证
    function Test-ValidJson {
        param($Path)
        try {
            $content = Get-Content $Path -Raw -ErrorAction Stop
            if ($content.Trim().Length -eq 0) { return $false }
            $null = $content | ConvertFrom-Json -ErrorAction Stop
            return $true
        } catch {
            Write-Host "[验证失败] $($_.Exception.Message)" -ForegroundColor Red
            return $false
        }
    }

    # 多源下载尝试
    $success = $false
    foreach ($url in $urls) {
        try {
            Write-Host "`n 尝试下载源: $url" -ForegroundColor Cyan
            
            # 带进度显示和超时的下载
            $ProgressPreference = 'Continue'
            Invoke-WebRequest $url -OutFile $tempFile -UseBasicParsing -TimeoutSec 15
            
            # 三级内容验证
            if (-not (Test-Path $tempFile)) { throw "临时文件未生成" }
            if ((Get-Item $tempFile).Length -eq 0) { throw "空文件内容" }
            if (-not (Test-ValidJson $tempFile)) { throw "无效JSON格式" }

            $success = $true
            Write-Host "下载验证通过" -ForegroundColor Green
            break
        } catch {
            Write-Host "下载失败: $($_.Exception.Message)" -ForegroundColor Red
        } finally {
            $ProgressPreference = 'SilentlyContinue'
        }
    }

    # 文件替换逻辑
    if ($success) {
        $targetDir = Split-Path $targetPath -Parent
        if (-not (Test-Path $targetDir)) { 
            New-Item $targetDir -ItemType Directory -Force | Out-Null 
        }
        
        Move-Item $tempFile $targetPath -Force
        Write-Host "`n 文件已更新: $targetPath" -ForegroundColor Green
    } else {
        Write-Host "`n 所有源均不可用，保留原文件" -ForegroundColor Yellow
    }
} catch {
    Write-Host "`n 未捕获的异常: $($_.Exception.ToString())" -ForegroundColor Red
} finally {
    if (Test-Path $tempFile) { Remove-Item $tempFile }
    Write-Host "`n 1秒后自动关闭..." -ForegroundColor Gray
    Start-Sleep -Seconds 1
}