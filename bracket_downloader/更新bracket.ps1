# ��ǿ��PowerShell�ű�
$ErrorActionPreference = 'Stop'
$host.UI.RawUI.WindowTitle = "�ļ����½��� - ��������..."

try {
    # ���ò���
    $urls = @(
        "https://mp5tournament.github.io/bracket.json",
        "https://mp5tournament.pages.dev/bracket.json"
    )
    $targetPath = Join-Path $PSScriptRoot "static\COMMON\data\bracket.json"
    $tempFile = New-TemporaryFile

    # ǿ���ִ�����Э��
    [Net.ServicePointManager]::SecurityProtocol = 
        [Net.SecurityProtocolType]::Tls12 -bor
        [Net.SecurityProtocolType]::Tls13

    # ��ǿ��JSON��֤
    function Test-ValidJson {
        param($Path)
        try {
            $content = Get-Content $Path -Raw -ErrorAction Stop
            if ($content.Trim().Length -eq 0) { return $false }
            $null = $content | ConvertFrom-Json -ErrorAction Stop
            return $true
        } catch {
            Write-Host "[��֤ʧ��] $($_.Exception.Message)" -ForegroundColor Red
            return $false
        }
    }

    # ��Դ���س���
    $success = $false
    foreach ($url in $urls) {
        try {
            Write-Host "`n ��������Դ: $url" -ForegroundColor Cyan
            
            # ��������ʾ�ͳ�ʱ������
            $ProgressPreference = 'Continue'
            Invoke-WebRequest $url -OutFile $tempFile -UseBasicParsing -TimeoutSec 15
            
            # ����������֤
            if (-not (Test-Path $tempFile)) { throw "��ʱ�ļ�δ����" }
            if ((Get-Item $tempFile).Length -eq 0) { throw "���ļ�����" }
            if (-not (Test-ValidJson $tempFile)) { throw "��ЧJSON��ʽ" }

            $success = $true
            Write-Host "������֤ͨ��" -ForegroundColor Green
            break
        } catch {
            Write-Host "����ʧ��: $($_.Exception.Message)" -ForegroundColor Red
        } finally {
            $ProgressPreference = 'SilentlyContinue'
        }
    }

    # �ļ��滻�߼�
    if ($success) {
        $targetDir = Split-Path $targetPath -Parent
        if (-not (Test-Path $targetDir)) { 
            New-Item $targetDir -ItemType Directory -Force | Out-Null 
        }
        
        Move-Item $tempFile $targetPath -Force
        Write-Host "`n �ļ��Ѹ���: $targetPath" -ForegroundColor Green
    } else {
        Write-Host "`n ����Դ�������ã�����ԭ�ļ�" -ForegroundColor Yellow
    }
} catch {
    Write-Host "`n δ������쳣: $($_.Exception.ToString())" -ForegroundColor Red
} finally {
    if (Test-Path $tempFile) { Remove-Item $tempFile }
    Write-Host "`n 1����Զ��ر�..." -ForegroundColor Gray
    Start-Sleep -Seconds 1
}