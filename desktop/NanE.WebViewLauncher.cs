using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace NanE
{
    internal static class Program
    {
        private const string AppUrl = "https://nane.zylatent.com";
        private const string AppTitle = "NanE 南易";

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool SetDllDirectory(string lpPathName);

        [STAThread]
        private static void Main()
        {
            AppDomain.CurrentDomain.AssemblyResolve += ResolveEmbeddedAssembly;
            var runtimeDir = PrepareRuntimeFiles();
            SetDllDirectory(runtimeDir);

            var args = Environment.GetCommandLineArgs();
            if (args.Length >= 3 && args[1] == "--self-test")
            {
                RunSelfTest(args[2], runtimeDir);
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            Application.Run(new MainForm(runtimeDir));
        }

        private static void RunSelfTest(string logPath, string runtimeDir)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(logPath));
                var profileDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "NanE",
                    "self-test-profile");
                Directory.CreateDirectory(profileDir);

                var envTask = CoreWebView2Environment.CreateAsync(null, profileDir);
                envTask.Wait(TimeSpan.FromSeconds(20));
                if (!envTask.IsCompleted || envTask.IsFaulted)
                {
                    if (envTask.Exception != null) throw envTask.Exception;
                    throw new TimeoutException("WebView2 environment creation timed out.");
                }

                File.WriteAllText(
                    logPath,
                    "OK\r\nRuntimeDir=" + runtimeDir + "\r\nLoaderExists=" + File.Exists(Path.Combine(runtimeDir, "WebView2Loader.dll")));
            }
            catch (Exception ex)
            {
                File.WriteAllText(logPath, "FAILED\r\n" + ex);
                Environment.ExitCode = 1;
            }
        }

        private static Assembly ResolveEmbeddedAssembly(object sender, ResolveEventArgs args)
        {
            var requested = new AssemblyName(args.Name).Name + ".dll";
            var resourceName = "NanE.Resources." + requested;
            using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName))
            {
                if (stream == null) return null;
                var bytes = new byte[stream.Length];
                stream.Read(bytes, 0, bytes.Length);
                return Assembly.Load(bytes);
            }
        }

        private static string PrepareRuntimeFiles()
        {
            var dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "NanE",
                "runtime");
            Directory.CreateDirectory(dir);

            ExtractResource("NanE.Resources.WebView2Loader.dll", Path.Combine(dir, "WebView2Loader.dll"));
            return dir;
        }

        private static void ExtractResource(string resourceName, string targetPath)
        {
            using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName))
            {
                if (stream == null) return;
                var bytes = new byte[stream.Length];
                stream.Read(bytes, 0, bytes.Length);
                if (File.Exists(targetPath) && new FileInfo(targetPath).Length == bytes.Length) return;
                File.WriteAllBytes(targetPath, bytes);
            }
        }

        private sealed class MainForm : Form
        {
            private readonly string _runtimeDir;
            private readonly WebView2 _webView;
            private readonly Label _statusLabel;

            public MainForm(string runtimeDir)
            {
                _runtimeDir = runtimeDir;
                Text = AppTitle;
                Width = 1240;
                Height = 820;
                MinimumSize = new Size(960, 640);
                StartPosition = FormStartPosition.CenterScreen;
                BackColor = Color.White;

                using (var iconStream = Assembly.GetExecutingAssembly().GetManifestResourceStream("NanE.Resources.nane.ico"))
                {
                    if (iconStream != null) Icon = new Icon(iconStream);
                }

                _statusLabel = new Label
                {
                    Dock = DockStyle.Fill,
                    Text = "正在打开 NanE 南易...",
                    TextAlign = ContentAlignment.MiddleCenter,
                    Font = new Font("Microsoft YaHei UI", 12F, FontStyle.Regular)
                };
                Controls.Add(_statusLabel);

                _webView = new WebView2
                {
                    Dock = DockStyle.Fill,
                    Visible = false
                };
                Controls.Add(_webView);

                Shown += async delegate { await InitializeWebViewAsync(); };
            }

            private async Task InitializeWebViewAsync()
            {
                try
                {
                    var userData = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                        "NanE",
                        "webview-profile");
                    Directory.CreateDirectory(userData);

                    var env = await CoreWebView2Environment.CreateAsync(null, userData);
                    await _webView.EnsureCoreWebView2Async(env);

                    _webView.CoreWebView2.DocumentTitleChanged += delegate
                    {
                        var title = _webView.CoreWebView2.DocumentTitle;
                        Text = string.IsNullOrWhiteSpace(title) ? AppTitle : title + " - NanE";
                    };

                    _webView.CoreWebView2.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs e)
                    {
                        e.Handled = true;
                        _webView.CoreWebView2.Navigate(e.Uri);
                    };

                    _webView.CoreWebView2.NavigationCompleted += delegate
                    {
                        _statusLabel.Visible = false;
                        _webView.Visible = true;
                    };

                    _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
                    _webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
                    _webView.CoreWebView2.Navigate(AppUrl);
                }
                catch (Exception ex)
                {
                    _statusLabel.Text = "NanE 启动失败。\r\n\r\n" + ex.Message;
                    var button = new Button
                    {
                        Text = "用浏览器打开",
                        Width = 140,
                        Height = 36,
                        Left = (ClientSize.Width - 140) / 2,
                        Top = (ClientSize.Height / 2) + 64,
                        Anchor = AnchorStyles.None
                    };
                    button.Click += delegate
                    {
                        Process.Start(new ProcessStartInfo(AppUrl) { UseShellExecute = true });
                    };
                    Controls.Add(button);
                    button.BringToFront();
                }
            }
        }
    }
}
