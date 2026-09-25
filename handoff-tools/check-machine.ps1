# Checks that a machine has what the Shutter Ace work in HANDOFF-avbco.md needs.
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File handoff-tools\check-machine.ps1
# It only reads; it changes nothing.

$ok = 0; $bad = 0
function Check($name, [bool]$pass, $hint) {
    if ($pass) { Write-Host "  ok    $name"; $script:ok++ }
    else { Write-Host "  MISS  $name" -ForegroundColor Yellow; if ($hint) { Write-Host "        $hint" }; $script:bad++ }
}
function Has($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

Write-Host "Machine"
$arch = $env:PROCESSOR_ARCHITEW6432; if (-not $arch) { $arch = $env:PROCESSOR_ARCHITECTURE }
Write-Host "  info  Windows reports $arch; Node reports $(if (Has node) { node -p process.arch } else { 'no node' })"

Write-Host "Folders the app needs, at these exact paths"
Check 'C:\avbcodev\avbco.fxproject' (Test-Path 'C:\avbcodev\avbco.fxproject') 'copy C:\avbcodev from the old machine'
Check 'C:\avbcodev\data' (Test-Path 'C:\avbcodev\data') 'copy C:\avbcodev\data (the app data)'
Check 'C:\CODEMINE\common50' (Test-Path 'C:\CODEMINE\common50\codemine.vcx') 'copy C:\CODEMINE'
Check 'C:\CODEMINE\custom' (Test-Path 'C:\CODEMINE\custom') 'copy C:\CODEMINE'
Check 'C:\fox\xsource\VFPSource\builders\wbpick.vcx' (Test-Path 'C:\fox\xsource\VFPSource\builders\wbpick.vcx') 'copy C:\fox\xsource (appmain.vcx names it by absolute path)'
Check 'C:\fox\xsource\VFPSource\Wizards\wzcommon\wizctrl.vcx' (Test-Path 'C:\fox\xsource\VFPSource\Wizards\wzcommon\wizctrl.vcx') 'copy C:\fox\xsource'

Write-Host "Visual FoxPro 9"
$vfp = 'C:\Program Files (x86)\Microsoft Visual FoxPro 9'
Check 'vfp9.exe' (Test-Path "$vfp\vfp9.exe") 'install VFP 9 SP2 at its default place (probes and samplesRun need it)'
Check 'Samples\Solution (samplesRun)' (Test-Path "$vfp\Samples\Solution\Forms\objects.scx") 'install VFP 9 with its samples'
Check 'Ffc, Gallery, Wizards' ((Test-Path "$vfp\Ffc") -and (Test-Path "$vfp\Gallery") -and (Test-Path "$vfp\Wizards")) 'install VFP 9 fully'
Check 'VFP registry entry (FoxDev reads HOME() from it)' (Test-Path 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualFoxPro\9.0') 'install VFP 9'

Write-Host "CodeMine registration"
$cm = 'HKCU:\Software\Classes\VirtualStore\MACHINE\SOFTWARE\WOW6432Node\Soft Classics\CodeMine'
Check 'CodeMine key' (Test-Path $cm) 'reg import codemine-virtualstore.reg (from the avbco-transfer folder)'
if (Test-Path $cm) {
    $serial = (Get-ItemProperty $cm -ErrorAction SilentlyContinue).SerialNumber
    Check 'SerialNumber present' ([bool]$serial) 'reg import codemine-virtualstore.reg'
    Check 'Paths\Local = c:\avbcodev\data\' ((Get-ItemProperty "$cm\Paths" -ErrorAction SilentlyContinue).Local -eq 'c:\avbcodev\data\') 'reg import codemine-virtualstore.reg'
}

Write-Host "Tools"
Check 'node' (Has node) 'install Node 24'
if (Has node) { Write-Host "  info  node $(node --version)" }
Check 'cargo / rustup' ((Has cargo) -and (Has rustup)) 'install Rust (stable, MSVC)'
if (Has rustup) { Check 'wasm32-unknown-unknown target' ([bool](rustup target list --installed 2>$null | Select-String wasm32-unknown-unknown)) 'rustup target add wasm32-unknown-unknown (rust-toolchain.toml asks for it too)' }
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vc = (Test-Path $vswhere) -and [bool](& $vswhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null)
Check 'Visual C++ x86/x64 build tools (fllhost, the COM addon)' $vc 'install VS Build Tools with "Desktop development with C++"'
Check 'python' ((Has python) -or (Has py)) 'install Python 3 (handoff-tools)'
Check 'gh' (Has gh) 'install GitHub CLI, then gh auth login'
if (Has gh) { gh auth status *> $null; Check 'gh logged in' ($LASTEXITCODE -eq 0) 'gh auth login' }

Write-Host "Repo"
if (Test-Path .git) {
    $remotes = git remote -v 2>$null | Out-String
    Check 'remote "fork" = jefflroberts/FoxDevStudio' ($remotes -match 'fork\s+https://github.com/jefflroberts/FoxDevStudio') 'git remote add fork https://github.com/jefflroberts/FoxDevStudio.git'
    Check 'remote "origin" = FoxDevCommunity/FoxDevStudio' ($remotes -match 'origin\s+https://github.com/FoxDevCommunity/FoxDevStudio') 'git remote add origin https://github.com/FoxDevCommunity/FoxDevStudio'
    Check 'on avbco-integration' ((git branch --show-current) -eq 'avbco-integration') 'git checkout avbco-integration'
    Check 'node_modules installed' (Test-Path node_modules\vitest) 'npm install'
    Check 'wasm built' (Test-Path src\wasm\foxvm\generated) 'npm run build:wasm'
    Check 'fllhost built' (Test-Path resources\native\win32\fllhost.exe) 'npm run build:fllhost'
} else {
    Write-Host "  info  run this from the repo root to check the repo too"
}

Write-Host ""
Write-Host "$ok ok, $bad missing"
