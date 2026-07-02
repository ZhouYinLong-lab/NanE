$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$screenDir = Join-Path $PSScriptRoot "screens"
$principleDir = Join-Path $PSScriptRoot "principles"
New-Item -ItemType Directory -Force $screenDir | Out-Null
New-Item -ItemType Directory -Force $principleDir | Out-Null

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (!(Test-Path $chrome)) {
  $chrome = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
}
if (!(Test-Path $chrome)) {
  throw "Chrome or Edge was not found."
}

$port = 9226
$userDir = Join-Path $env:TEMP "nane-ppt-assets-chrome"
if (Test-Path $userDir) {
  Remove-Item -LiteralPath $userDir -Recurse -Force
}

$proc = Start-Process -FilePath $chrome -ArgumentList @(
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--remote-debugging-port=$port",
  "--user-data-dir=$userDir",
  "--window-size=1600,900",
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
    Invoke-Cdp "Emulation.setEmulatedMedia" @{ features = @(@{ name = "prefers-color-scheme"; value = "light" }) } | Out-Null
  }

  function Set-DesktopViewport() {
    Invoke-Cdp "Emulation.setDeviceMetricsOverride" @{ width = 1600; height = 900; deviceScaleFactor = 1; mobile = $false } | Out-Null
    Invoke-Cdp "Emulation.setEmulatedMedia" @{ features = @(@{ name = "prefers-color-scheme"; value = "light" }) } | Out-Null
  }

  function Save-Shot($dir, $name) {
    Start-Sleep -Milliseconds 900
    $shot = Invoke-Cdp "Page.captureScreenshot" @{ format = "png"; fromSurface = $true; captureBeyondViewport = $false }
    [IO.File]::WriteAllBytes((Join-Path $dir $name), [Convert]::FromBase64String($shot.result.data))
  }

  function Navigate-App() {
    Invoke-Cdp "Page.navigate" @{ url = "http://127.0.0.1:37878/" } | Out-Null
    Start-Sleep -Seconds 4
    Eval-Js @'
      (() => {
        localStorage.setItem('nane_onboarded','1');
        localStorage.setItem('nane_agreement_accepted','v1.0');
        localStorage.setItem('nane_dark_mode','0');
        document.documentElement.setAttribute('data-theme','light');
        document.querySelector('#onboardingOverlay')?.setAttribute('hidden','');
      })()
'@
  }

  Invoke-Cdp "Page.enable" | Out-Null
  Invoke-Cdp "Runtime.enable" | Out-Null
  Invoke-Cdp "Page.addScriptToEvaluateOnNewDocument" @{ source = "localStorage.setItem('nane_onboarded','1'); localStorage.setItem('nane_agreement_accepted','v1.0'); localStorage.setItem('nane_dark_mode','0');" } | Out-Null

  Set-MobileViewport
  Navigate-App
  Eval-Js @'
    (() => {
      document.querySelector('#welcomeBanner')?.setAttribute('hidden', '');
      window.scrollTo(0, 0);
      const select = document.querySelector('.chip-select[data-type="consumable"]');
      if (select) {
        select.classList.add('open', 'active');
        const dropdown = select.querySelector('.chip-dropdown');
        if (dropdown) dropdown.hidden = false;
        const option = select.querySelector('[data-category="消毒护理"]');
        if (option) option.classList.add('selected');
      }
    })()
'@
  Save-Shot $screenDir "home-filter-mobile-light.png"

  Eval-Js @'
    (() => {
      const N = window.NanE;
      const user = {
        id:'u_showcase', name:'热心小蓝鲸', campus:'鼓楼校区', building:'南园2舍', room:'302',
        is_verified:true, hasAgreement:true, profileComplete:true, hasPassword:true,
        trustSummary:{completedCount:3,givenCount:2,receivedCount:1,positiveReviewCount:5,topTags:['沟通顺畅','按约交接']}
      };
      N.state.user = user;
      N.state.token = 'showcase-token';
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-mine'));
      document.querySelectorAll('.nav-item').forEach(v => v.classList.toggle('active', v.dataset.view === 'mine'));
      document.querySelector('#profileName').textContent = user.name;
      document.querySelector('#profileCampus').textContent = user.campus + ' · ' + user.building + ' · ' + user.room;
      document.querySelector('#verifyBadge').textContent = '校园身份与楼栋已设置';
      document.querySelector('#mineLoginCard').hidden = true;
      document.querySelector('#mineLoggedInContent').hidden = false;
      N.renderProfileTrust(user.trustSummary);
      document.querySelector('#pendingReviewsBanner').hidden = false;
      document.querySelector('#pendingReviewsCount').textContent = '2 条待评价';
      document.querySelector('#pendingReviewsList').innerHTML = '<div class="review-banner-row"><div class="claim-banner-info"><strong>999感冒灵</strong><span>发布同学：热心的小蓝鲸 · 1袋</span></div><span class="claim-actions"><button class="primary small">评价履约</button></span></div><div class="review-banner-row"><div class="claim-banner-info"><strong>体温计</strong><span>领取同学：忧郁的百合 · 1支</span></div><span class="claim-actions"><button class="primary small">评价履约</button></span></div>';
      window.scrollTo(0, 0);
    })()
'@
  Save-Shot $screenDir "mine-trust-mobile-light.png"

  Set-DesktopViewport
  $nearbyHtml = (Resolve-Path (Join-Path $principleDir "nearby-priority-desktop.html")).Path
  $nearbyUrl = "file:///" + ($nearbyHtml -replace "\\", "/")
  Invoke-Cdp "Page.navigate" @{ url = $nearbyUrl } | Out-Null
  Save-Shot $principleDir "nearby-priority-desktop.png"

  Navigate-App
  Eval-Js @'
    (() => {
      const N = window.NanE;
      const user = {
        id:'u_showcase', name:'热心小蓝鲸', campus:'鼓楼校区', building:'南园2舍', room:'302',
        is_verified:true, hasAgreement:true, profileComplete:true, hasPassword:true
      };
      N.state.user = user;
      N.state.token = 'showcase-token';
      localStorage.setItem(N.USER_KEY, JSON.stringify(user));
      N.syncPublishView();
      N.switchView('publish');
      document.querySelector('[data-item-type="medicine"]')?.click();
      document.querySelector('#titleInput').value = '布洛芬缓释胶囊（未拆封）';
      document.querySelector('#quantityInput').value = '1';
      document.querySelector('#unitInput').value = '盒';
      document.querySelector('#expireDateInput').value = '2026-12-31';
      document.querySelector('#descriptionInput').value = '仅限非处方常见药品，先审核后展示，联系方式不公开。';
      document.querySelector('#wechatInput').value = 'nane_demo';
      document.querySelector('#disclaimerInput').checked = true;
      window.scrollTo(0, 0);
    })()
'@
  Save-Shot $principleDir "safety-boundary-desktop.png"

  Navigate-App
  Eval-Js @'
    (() => {
      const N = window.NanE;
      const user = {
        id:'u_showcase', name:'热心小蓝鲸', campus:'鼓楼校区', building:'南园2舍', room:'302',
        is_verified:true, hasAgreement:true, profileComplete:true, hasPassword:true,
        trustSummary:{completedCount:5,givenCount:3,receivedCount:2,positiveReviewCount:7,topTags:['沟通顺畅','按约交接','友善可信']}
      };
      N.state.user = user;
      N.state.token = 'showcase-token';
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-mine'));
      document.querySelectorAll('.nav-item').forEach(v => v.classList.toggle('active', v.dataset.view === 'mine'));
      document.querySelector('#profileName').textContent = user.name;
      document.querySelector('#profileCampus').textContent = user.campus + ' · ' + user.building + ' · ' + user.room;
      document.querySelector('#verifyBadge').textContent = '校园身份与楼栋已设置';
      document.querySelector('#mineLoginCard').hidden = true;
      document.querySelector('#mineLoggedInContent').hidden = false;
      N.renderProfileTrust(user.trustSummary);
      document.querySelector('#pendingReviewsBanner').hidden = false;
      document.querySelector('#pendingReviewsCount').textContent = '3 条待评价';
      document.querySelector('#pendingReviewsList').innerHTML = '<div class="review-banner-row"><div class="claim-banner-info"><strong>999感冒灵</strong><span>发布同学：热心的小蓝鲸 · 1袋</span></div><span class="claim-actions"><button class="primary small">评价履约</button></span></div><div class="review-banner-row"><div class="claim-banner-info"><strong>体温计</strong><span>领取同学：忧郁的百合 · 1支</span></div><span class="claim-actions"><button class="primary small">评价履约</button></span></div>';
      document.querySelector('#myItemList').innerHTML = N.renderItem({id:'i3', title:'云南白药', campus:'鼓楼校区', building:'南园2舍', room:'302', description:'领取后等待双方评价。', itemType:'medicine', itemTypeText:'药品', category:'其他非处方药', status:'online', quantity:1, unit:'盒', ownerName:'热心小蓝鲸', createdAt:new Date().toISOString(), ownerTrustSummary:user.trustSummary}, {showRoom:true, showStatus:true});
      window.scrollTo(0, 0);
    })()
'@
  Save-Shot $principleDir "trust-record-desktop.png"

  $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", [Threading.CancellationToken]::None).Wait()
} finally {
  if ($proc -and !$proc.HasExited) {
    Stop-Process -Id $proc.Id -Force
  }
}
