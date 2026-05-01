param(
  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"

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

Remove-Item -LiteralPath $OutputPath -Force -ErrorAction SilentlyContinue
Add-Type `
  -TypeDefinition $source `
  -ReferencedAssemblies "System.Windows.Forms" `
  -OutputAssembly $OutputPath `
  -OutputType WindowsApplication
