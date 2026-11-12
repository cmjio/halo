# Install Halo on Windows: a standalone halo.exe (Bun is built in; nothing else needed).
#
#   irm https://halolang.com/install.ps1 | iex
#
# Options: $env:HALO_VERSION = "0.1.0", $env:HALO_INSTALL = "$HOME\.halo",
# $env:HALO_NO_MODIFY_PATH = "1". It downloads halo-windows-x64.exe from halolang.com/dl,
# checks it against the release's SHA256SUMS, puts it in ~\.halo\bin, and adds that
# folder to your user PATH. ARM64 Windows runs the x64 build.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$base = if ($env:HALO_DOWNLOAD_BASE) { $env:HALO_DOWNLOAD_BASE } else { 'https://halolang.com/dl' }
$installDir = if ($env:HALO_INSTALL) { $env:HALO_INSTALL } else { Join-Path $HOME '.halo' }
$binDir = Join-Path $installDir 'bin'
$asset = 'halo-windows-x64.exe'

if (-not [Environment]::Is64BitOperatingSystem) { throw 'Halo needs 64-bit Windows.' }

$version = $env:HALO_VERSION
if (-not $version) { $version = (Invoke-RestMethod "$base/latest.json").version }
$version = $version.TrimStart('v')
Write-Host "Installing halo $version ($asset)"

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("halo-" + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  # A server that doesn't call SHA256SUMS text (python -m http.server, say) gets bytes back, not a string.
  $sums = (Invoke-WebRequest "$base/$version/SHA256SUMS" -UseBasicParsing).Content
  if ($sums -is [byte[]]) { $sums = [Text.Encoding]::UTF8.GetString($sums) }
  $line = ($sums -split "`n") | Where-Object { ($_ -split '\s+')[1] -eq $asset } | Select-Object -First 1
  if (-not $line) { throw "Halo $version has no $asset build." }
  $expected = ($line -split '\s+')[0].ToLower()

  $exe = Join-Path $tmp 'halo.exe'
  # Tell halolang.com how this install came about, for its download counts (nothing else is sent).
  $via = if ($env:HALO_INSTALLED_VIA) { $env:HALO_INSTALLED_VIA } elseif ($env:CI) { 'ci' } else { 'script' }
  Invoke-WebRequest "$base/$version/${asset}?via=$via" -OutFile $exe -UseBasicParsing
  $actual = (Get-FileHash $exe -Algorithm SHA256).Hash.ToLower()
  if ($actual -ne $expected) { throw "Checksum mismatch for $asset (expected $expected, got $actual). Not installing." }

  New-Item -ItemType Directory -Force -Path $binDir | Out-Null
  Move-Item -Force $exe (Join-Path $binDir 'halo.exe')
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}

$installed = & (Join-Path $binDir 'halo.exe') --version
Write-Host "✓ halo $installed installed to $binDir\halo.exe"

if ($env:HALO_NO_MODIFY_PATH -ne '1') {
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not (($userPath -split ';') -contains $binDir)) {
    [Environment]::SetEnvironmentVariable('Path', ($(if ($userPath) { "$userPath;" } else { '' }) + $binDir), 'User')
    Write-Host "Added $binDir to your user PATH. Open a new terminal to use halo."
  }
  if (-not (($env:Path -split ';') -contains $binDir)) { $env:Path = "$env:Path;$binDir" }
}

Write-Host ''
Write-Host 'Next:'
Write-Host '  halo init my-flow; cd my-flow'
Write-Host '  halo test main.halo --arg topic=tides    # offline, everything mocked'
