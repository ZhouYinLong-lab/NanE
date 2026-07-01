$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$outDir = Join-Path $PSScriptRoot "screens"
New-Item -ItemType Directory -Force $outDir | Out-Null

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (!(Test-Path $chrome)) {
  $chrome = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
}
if (!(Test-Path $chrome)) {
  throw "Chrome or Edge was not found."
}

$port = 9224
$userDir = Join-Path $env:TEMP "nane-showcase-chrome"
if (Test-Path $userDir) {
  Remove-Item -LiteralPath $userDir -Recurse -Force
}

$proc = Start-Process -FilePath $chrome -ArgumentList @(
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--remote-debugging-port=$port",
  "--user-data-dir=$userDir",
  "--window-size=390,844",
  "about:blank"
) -PassThru -WindowStyle Hidden

try {
  $version = $null
  for ($i = 0; $i -lt 40; $i++) {
    try {
      $version = Invoke-RestMethod -UseBasicParsing "http://127.0.0.1:$port/json/version"
      break
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }
  if (!$version) {
    throw "Chrome DevTools did not start."
  }

  $page = Invoke-RestMethod -UseBasicParsing -Method Put "http://127.0.0.1:$port/json/new?about:blank"
  $ws = [System.Net.WebSockets.ClientWebSocket]::new()
  $ws.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
  $script:nextId = 0

  function Receive-Json($socket) {
    $stream = [System.IO.MemoryStream]::new()
    $buffer = New-Object byte[] 1048576
    do {
      $segment = [ArraySegment[byte]]::new($buffer)
      $result = $socket.ReceiveAsync($segment, [Threading.CancellationToken]::None).Result
      if ($result.Count -gt 0) {
        $stream.Write($buffer, 0, $result.Count)
      }
    } while (-not $result.EndOfMessage)
    return ([Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json)
  }

  function Invoke-Cdp($method, $params = @{}) {
    $script:nextId += 1
    $payload = @{ id = $script:nextId; method = $method; params = $params } | ConvertTo-Json -Depth 20 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
    $ws.SendAsync([ArraySegment[byte]]::new($bytes), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait()
    while ($true) {
      $message = Receive-Json $ws
      if ($message.id -eq $script:nextId) {
        return $message
      }
    }
  }

  function Eval-Js($js) {
    Invoke-Cdp "Runtime.evaluate" @{ expression = $js; awaitPromise = $true; returnByValue = $true } | Out-Null
  }

  function Set-MobileViewport() {
    Invoke-Cdp "Emulation.setDeviceMetricsOverride" @{ width = 390; height = 844; deviceScaleFactor = 2; mobile = $true } | Out-Null
  }

  function Set-DesktopViewport() {
    Invoke-Cdp "Emulation.setDeviceMetricsOverride" @{ width = 1280; height = 900; deviceScaleFactor = 1; mobile = $false } | Out-Null
  }

  function Save-Shot($name) {
    Start-Sleep -Milliseconds 900
    $shot = Invoke-Cdp "Page.captureScreenshot" @{ format = "png"; fromSurface = $true; captureBeyondViewport = $false }
    [IO.File]::WriteAllBytes((Join-Path $outDir $name), [Convert]::FromBase64String($shot.result.data))
  }

  Invoke-Cdp "Page.enable" | Out-Null
  Invoke-Cdp "Runtime.enable" | Out-Null
  Invoke-Cdp "Page.addScriptToEvaluateOnNewDocument" @{ source = "localStorage.setItem('nane_onboarded','1'); localStorage.setItem('nane_agreement_accepted','v1.0');" } | Out-Null

  Set-MobileViewport
  Invoke-Cdp "Page.navigate" @{ url = "http://127.0.0.1:37878/" } | Out-Null
  Start-Sleep -Seconds 4
  Eval-Js @'
    localStorage.setItem('nane_onboarded','1');
    document.querySelector('#onboardingOverlay')?.setAttribute('hidden','');
    window.scrollTo(0, 0);
    const select = document.querySelector('.chip-select[data-type="consumable"]');
    if (select) {
      select.classList.add('open', 'active');
      const dropdown = select.querySelector('.chip-dropdown');
      if (dropdown) dropdown.hidden = false;
      const option = select.querySelector('[data-category="消毒护理"]');
      if (option) option.classList.add('selected');
    }
'@
  Save-Shot "home-filter-mobile.png"

  Eval-Js @'
    var showcaseUser = { id:'u_showcase', name:'热心小蓝鲸', campus:'鼓楼校区', building:'南园2舍', room:'302', is_verified:true, hasAgreement:true, profileComplete:true, hasPassword:true, trustSummary:{completedCount:3,givenCount:2,receivedCount:1,positiveReviewCount:5,topTags:['沟通顺畅','按约交接']} };
    window.NanE.state.user = showcaseUser;
    window.NanE.state.token = 'showcase-token';
    window.NanE.syncPublishView();
    window.NanE.switchView('publish');
    window.scrollTo(0, 0);
'@
  Save-Shot "publish-form-mobile.png"

  Eval-Js @'
    var showcaseUser = { id:'u_showcase', name:'热心小蓝鲸', campus:'鼓楼校区', building:'南园2舍', room:'302', is_verified:true, hasAgreement:true, profileComplete:true, hasPassword:true, trustSummary:{completedCount:3,givenCount:2,receivedCount:1,positiveReviewCount:5,topTags:['沟通顺畅','按约交接']} };
    window.NanE.state.user = showcaseUser;
    window.NanE.state.token = 'showcase-token';
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-mine')); document.querySelectorAll('.nav-item').forEach(v => v.classList.toggle('active', v.dataset.view === 'mine'));
    document.querySelector('#profileName').textContent = showcaseUser.name;
    document.querySelector('#profileCampus').textContent = showcaseUser.campus + ' · ' + showcaseUser.building + ' · ' + showcaseUser.room;
    document.querySelector('#verifyBadge').textContent = '校园身份与楼栋已设置';
    document.querySelector('#mineLoginCard').hidden = true;
    document.querySelector('#mineLoggedInContent').hidden = false;
    document.querySelector('#pendingReviewsBanner').hidden = false;
    document.querySelector('#pendingReviewsCount').textContent = '2 条待评价';
    document.querySelector('#pendingReviewsList').innerHTML = '<div class="review-banner-row"><div><strong>999感冒灵</strong><p>发布同学：热心的小蓝鲸 · 1袋</p></div><button class="primary small">评价履约</button></div><div class="review-banner-row"><div><strong>体温计</strong><p>领取同学：忧郁的百合 · 1支</p></div><button class="primary small">评价履约</button></div>';
    window.scrollTo(0, 0);
'@
  Save-Shot "mine-trust-mobile.png"

  Set-DesktopViewport
  Invoke-Cdp "Page.navigate" @{ url = "http://127.0.0.1:37878/" } | Out-Null
  Start-Sleep -Seconds 4
  Eval-Js "localStorage.setItem('nane_onboarded','1'); document.querySelector('#onboardingOverlay')?.setAttribute('hidden',''); window.scrollTo(0,0);"
  Save-Shot "home-desktop.png"

  $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", [Threading.CancellationToken]::None).Wait()
} finally {
  if ($proc -and !$proc.HasExited) {
    Stop-Process -Id $proc.Id -Force
  }
}
