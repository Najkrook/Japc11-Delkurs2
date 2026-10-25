$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

# A separate demo project and loopback-only services keep this playtest local.
foreach ($port in @(4400, 5001, 8080, 9099, 5178)) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    if ($listener) { throw "Port $port is already in use. Stop the existing preview/emulators before starting this preview." }
}
$firebaseCommand = (Get-Command firebase.cmd -ErrorAction Stop).Source
$firebaseCli = Join-Path (Split-Path $firebaseCommand -Parent) 'node_modules/firebase-tools/lib/bin/firebase.js'
if (!(Test-Path $firebaseCli)) { throw 'Firebase CLI was not found beside firebase.cmd.' }
& npm.cmd run build --prefix functions
if ($LASTEXITCODE -ne 0) { throw 'Functions build failed.' }

$logDir = Join-Path (Get-Location) '.scratch/sushi-game/preview-logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$emulators = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @(
    "`"$firebaseCli`"", 'emulators:start', '--only', 'auth,firestore,functions', '--project', 'demo-japc11-delkurs2'
) -WindowStyle Hidden -PassThru -RedirectStandardOutput "$logDir/emulators.log" -RedirectStandardError "$logDir/emulators-error.log"
$previousEmulators = $env:VITE_FIREBASE_EMULATORS
try {
    Write-Host 'Starting local Firebase emulators...'
    $ready = $false
    for ($attempt = 0; $attempt -lt 90; $attempt++) {
        $emulators.Refresh()
        if ($emulators.HasExited) { throw "Emulators stopped. See $logDir" }
        try {
            $services = Invoke-RestMethod 'http://127.0.0.1:4400/emulators' -TimeoutSec 2
            if ($services.auth -and $services.firestore -and $services.functions -and
                (Select-String -Path "$logDir/emulators.log" -Pattern 'All emulators ready' -Quiet)) {
                $ready = $true
                break
            }
        } catch { }
        Start-Sleep -Seconds 1
    }
    if (!$ready) { throw "Emulators did not become ready. See $logDir" }
    & node scripts/seed-sushi-preview.ts
    if ($LASTEXITCODE -ne 0) { throw 'Preview account setup failed.' }
    $env:VITE_FIREBASE_EMULATORS = 'true'
    Write-Host "`nPlay here: http://127.0.0.1:5178/.scratch/sushi-game/preview.html"
    Write-Host 'Leave this terminal running. Ctrl+C stops the preview. Restarting resets both test profiles.'
    & node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5178 --strictPort --mode test
} finally {
    $env:VITE_FIREBASE_EMULATORS = $previousEmulators
    $emulators.Refresh()
    if (!$emulators.HasExited) {
        & taskkill.exe /PID $emulators.Id /T /F | Out-Null
    }
}
