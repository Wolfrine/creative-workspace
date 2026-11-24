# Dot-source before Windows development/test commands. CI uses its own runner.
$noveliaaRoot = Split-Path $PSScriptRoot -Parent
if ([IO.Path]::GetFullPath($noveliaaRoot) -notlike 'F:\*') {
  throw 'Noveliaa development must run from its verified F-drive checkout.'
}
$noveliaaCache = 'H:/Workspace/Caches'
$noveliaaNode = 'F:/Workspace/Support/tools/node-24'
$noveliaaJava = 'F:/Workspace/Support/tools/jdk-21/jdk-21.0.11+10'
$noveliaaTemp = 'H:/Workspace/Temp/Noveliaa'
$noveliaaNpmPrefix = 'H:/Workspace/Runtimes/Noveliaa/npm-global'
$noveliaaPlaywright = 'H:/Workspace/Runtimes/playwright'
$noveliaaPythonCache = Join-Path $noveliaaCache 'Noveliaa/python'
foreach ($directory in @($noveliaaTemp, "$noveliaaCache/npm", "$noveliaaCache/firebase-emulators", $noveliaaPlaywright, $noveliaaNpmPrefix, $noveliaaPythonCache)) {
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
}
if (!(Test-Path -LiteralPath "$noveliaaNode/node.exe")) { throw 'F-drive Node runtime is missing.' }
$env:PATH = "$noveliaaNode;$noveliaaNpmPrefix;$noveliaaJava/bin;" + $env:PATH
$env:JAVA_HOME = $noveliaaJava
$env:TEMP = $noveliaaTemp
$env:TMP = $noveliaaTemp
$env:TMPDIR = $noveliaaTemp
$env:NPM_CONFIG_CACHE = "$noveliaaCache/npm"
$env:NPM_CONFIG_PREFIX = $noveliaaNpmPrefix
$env:PLAYWRIGHT_BROWSERS_PATH = $noveliaaPlaywright
$env:FIREBASE_EMULATORS_PATH = "$noveliaaCache/firebase-emulators"
$env:PYTHONPYCACHEPREFIX = $noveliaaPythonCache
