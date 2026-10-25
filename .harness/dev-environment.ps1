# Dot-source before Windows development/test commands. CI uses its own runner.
$noveliaaRoot = Split-Path $PSScriptRoot -Parent
if ([IO.Path]::GetFullPath($noveliaaRoot) -notlike 'F:\*') {
  throw 'Noveliaa development must run from its verified F-drive checkout.'
}
$noveliaaCache = 'F:/Workspace/Support/tools/local-cache'
$noveliaaNode = 'F:/Workspace/Support/tools/node-24'
$noveliaaJava = 'F:/Workspace/Support/tools/jdk-21/jdk-21.0.11+10'
$noveliaaTemp = Join-Path $noveliaaRoot '.local/tmp'
foreach ($directory in @($noveliaaTemp, "$noveliaaCache/npm-cache", "$noveliaaCache/firebase-emulators", "$noveliaaCache/playwright-browsers")) {
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
}
if (!(Test-Path -LiteralPath "$noveliaaNode/node.exe")) { throw 'F-drive Node runtime is missing.' }
$env:PATH = "$noveliaaNode;$noveliaaJava/bin;" + $env:PATH
$env:JAVA_HOME = $noveliaaJava
$env:TEMP = $noveliaaTemp
$env:TMP = $noveliaaTemp
$env:TMPDIR = $noveliaaTemp
$env:NPM_CONFIG_CACHE = "$noveliaaCache/npm-cache"
$env:NPM_CONFIG_PREFIX = $noveliaaNode
$env:PLAYWRIGHT_BROWSERS_PATH = "$noveliaaCache/playwright-browsers"
$env:FIREBASE_EMULATORS_PATH = "$noveliaaCache/firebase-emulators"
$env:PYTHONPYCACHEPREFIX = Join-Path $noveliaaRoot '.local/python-cache'
