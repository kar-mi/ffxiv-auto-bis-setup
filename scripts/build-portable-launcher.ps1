param(
  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [string]$IconPath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($IconPath)) {
  $IconPath = Join-Path $PSScriptRoot "..\assets\ffxiv-auto-bis.ico"
}

function Find-CSharpCompiler {
  $command = Get-Command "csc.exe" -ErrorAction SilentlyContinue
  if ($command -ne $null) { return $command.Source }

  $candidates = @(
    (Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"),
    (Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe")
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }

  throw "Could not find csc.exe to build the portable launcher."
}

$source = @'
using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class Program
{
    [STAThread]
    private static int Main()
    {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string binDir = Path.Combine(root, "bin");
        string launcherPath = Path.Combine(binDir, "launcher.exe");

        if (!File.Exists(launcherPath))
        {
            MessageBox.Show(
                "Could not find bin\\launcher.exe.\n\nExtract the full portable zip, then run FFXIVAutoBIS.exe from the extracted folder.",
                "FFXIV Auto BIS",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 1;
        }

        try
        {
            ProcessStartInfo startInfo = new ProcessStartInfo
            {
                FileName = launcherPath,
                WorkingDirectory = binDir,
                UseShellExecute = false,
            };

            Process.Start(startInfo);
            return 0;
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                "Could not start FFXIV Auto BIS.\n\n" + ex.Message,
                "FFXIV Auto BIS",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 1;
        }
    }
}
'@

$sourcePath = Join-Path ([System.IO.Path]::GetTempPath()) ("ffxiv-auto-bis-launcher-" + [System.Guid]::NewGuid().ToString("N") + ".cs")
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null
Remove-Item -LiteralPath $OutputPath -Force -ErrorAction SilentlyContinue
try {
  $resolvedIconPath = (Resolve-Path -LiteralPath $IconPath -ErrorAction Stop).Path
  Set-Content -LiteralPath $sourcePath -Value $source -Encoding UTF8
  $csc = Find-CSharpCompiler
  & $csc `
    "/nologo" `
    "/target:winexe" `
    "/out:$OutputPath" `
    "/win32icon:$resolvedIconPath" `
    "/reference:System.Windows.Forms.dll" `
    $sourcePath
  if ($LASTEXITCODE -ne 0) {
    throw "csc.exe failed with exit code $LASTEXITCODE."
  }
}
finally {
  Remove-Item -LiteralPath $sourcePath -Force -ErrorAction SilentlyContinue
}
