const API_BASE = "/api";
const TOKEN_KEY = "nane_web_token";
const USER_KEY = "nane_web_user";
const AGREEMENT_VERSION_FALLBACK = "v1.0";

const icons = {
  plus: "+",
  bandage: "\uf462",
  notesMedical: "\uf481",
  kitMedical: "\uf479",
  capsules: "\uf46b",
  pills: "\uf484",
  tablets: "\uf490",
  prescriptionBottleMedical: "\uf486",
  temperatureHalf: "\uf2c9",
  maskFace: "\ue1d7",
  shieldVirus: "\ue06c",
  pumpMedical: "\ue06a",
  bottleDroplet: "\ue4c4",
  box: "\uf466",
  boxOpen: "\uf49e",
  droplet: "\uf043",
  handHoldingMedical: "\ue05c",
  heartPulse: "\uf21e",
  syringe: "\uf48e",
  soap: "\ue06e"
};

const DEBUG_MODE = (() => {
  const url = new URLSearchParams(window.location.search);
  return url.get("debug") !== null || localStorage.getItem("nane_debug") === "1";
})();

const iconOptions = [
  ["plus", "通用"],
  ["bandage", "创可贴"],
  ["notesMedical", "护理单"],
  ["kitMedical", "急救包"],
  ["capsules", "胶囊"],
  ["pills", "药丸"],
  ["tablets", "药片"],
  ["prescriptionBottleMedical", "药瓶"],
  ["temperatureHalf", "体温"],
  ["maskFace", "口罩"],
  ["shieldVirus", "防护"],
  ["pumpMedical", "消毒液"],
  ["bottleDroplet", "滴剂"],
  ["box", "盒装"],
  ["boxOpen", "开盒"],
  ["droplet", "液体"],
  ["handHoldingMedical", "互助"],
  ["heartPulse", "健康"],
  ["syringe", "器具"],
  ["soap", "清洁"]
];

const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  user: JSON.parse(localStorage.getItem(USER_KEY) || "null"),
  itemType: "",
  itemCategory: "",
  editingItemId: "",
  claimsModalShown: false,
  contactViewedForItem: "",
  selectedPublishType: "consumable",
  selectedIcon: "plus",
  iconOtherOpen: false,
  selectedDetail: null,
  challengeId: "",
  emailChallengeId: "",
  locations: [],
  publishCampusIndex: 0,
  publishBuildingIndex: 0,
  profileCampusIndex: 0,
  profileBuildingIndex: 0,
  agreementVersion: AGREEMENT_VERSION_FALLBACK,
  pendingAction: null
};

function $(id) {
  return document.getElementById(id);
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const icons = { success: "", error: "", info: "" };
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-msg">${escapeHtml(message)}</span><button class="toast-close" aria-label="关闭">&times;</button>`;
  toast.querySelector(".toast-close").addEventListener("click", e => { e.stopPropagation(); dismissToast(toast); });
  toast.addEventListener("click", () => dismissToast(toast));
  container.appendChild(toast);
  setTimeout(() => dismissToast(toast), 5000);
}

function dismissToast(toast) {
  if (!toast.parentNode) return;
  toast.classList.add("toast-out");
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 250);
}

function errmsg(error, fallback) {
  if (!error) return fallback || "操作失败";
  const raw = error.message || String(error);
  const map = {
    "Failed to fetch": "网络连接失败，请检查校园网是否正常",
    "NetworkError": "网络连接失败，请检查校园网是否正常",
    "Unexpected token": "服务器返回异常，请稍后重试",
    "abort": "请求已取消",
    "timeout": "请求超时，请检查网络后重试",
    "Unexpected end of JSON": "服务器响应异常，请刷新页面重试",
  };
  for (const [key, msg] of Object.entries(map)) {
    if (raw.includes(key)) return msg;
  }
  return raw || fallback || "操作失败";
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function token() {
  return state.token || "";
}

function currentAgreementPayload() {
  const storedVer = localStorage.getItem("nane_agreement_accepted");
  const currentVer = state.agreementVersion || AGREEMENT_VERSION_FALLBACK;
  return {
    agreementAccepted: storedVer === currentVer || Boolean($("agreementInput")?.checked),
    agreementVersion: currentVer
  };
}

function rememberAgreementAccepted() {
  localStorage.setItem("nane_agreement_accepted", state.agreementVersion || AGREEMENT_VERSION_FALLBACK);
}

function syncAgreementUI() {
  const row = document.querySelector(".agreement-row");
  const input = $("agreementInput");
  if (!row || !input) return;
  const storedVer = localStorage.getItem("nane_agreement_accepted");
  const currentVer = state.agreementVersion || AGREEMENT_VERSION_FALLBACK;
  if (storedVer === currentVer) {
    row.hidden = true;
    input.checked = false;
  } else {
    row.hidden = false;
    input.checked = false;
  }
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token()) {
    headers.Authorization = `Bearer ${token()}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "请求失败");
  }
  return data;
}

function markdownToHtml(markdown) {
  return escapeHtml(markdown)
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^\d+\. (.*)$/gm, "<p class=\"agreement-list\">$1</p>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>")
    .replace(/<p><h/g, "<h")
    .replace(/<\/h([1-3])><\/p>/g, "</h$1>");
}

async function loadAgreement() {
  try {
    const data = await api("/legal/agreement");
    state.agreementVersion = data.version || AGREEMENT_VERSION_FALLBACK;
    $("agreementBody").innerHTML = markdownToHtml(data.markdown || "协议暂不可用。");
  } catch (error) {
    $("agreementBody").textContent = "协议加载失败，请稍后重试。";
  }
}

function saveSession(tokenValue, user) {
  state.token = tokenValue || "";
  state.user = user || null;
  if (tokenValue) {
    localStorage.setItem(TOKEN_KEY, tokenValue);
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
    rememberAgreementAccepted();
  }
}

function clearSession() {
  state.token = "";
  state.user = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function isVerifiedUser() {
  return Boolean(state.user?.is_verified && state.user?.hasAgreement !== false);
}

function profileComplete() {
  return Boolean(state.user?.profileComplete);
}

function requireVerified(message, pendingAction) {
  if (isVerifiedUser() && profileComplete()) {
    return true;
  }
  const text = message || (isVerifiedUser() ? '请先补全昵称、校区和楼栋' : '请先在「我的」页登录并同意用户协议');
  if (pendingAction) {
    state.pendingAction = pendingAction;
  }
  const activeMineTab = document.querySelector('.tab[data-view="mine"]');
  if (activeMineTab) {
    activeMineTab.click();
  }
  $("authMessage").textContent = text;
  return false;
}

function executePendingAction() {
  if (!state.pendingAction) return false;
  const action = state.pendingAction;
  state.pendingAction = null;
  if (isVerifiedUser() && profileComplete()) {
    showToast("登录成功，继续刚才的操作", "success");
    setTimeout(() => { if (typeof action === "function") action(); }, 600);
    return true;
  }
  return false;
}

function emailFromPrefix() {
  const prefix = $("emailLoginInput").value.trim().toLowerCase().replace(/@.*$/, "");
  return prefix ? `${prefix}@smail.nju.edu.cn` : "";
}

function setSelectionByLocation(kind, campusName, buildingName, roomName = "") {
  const keys = selectionKeys(kind);
  const campusIndex = state.locations.findIndex(campus => campus.name === campusName);
  state[keys.campus] = campusIndex >= 0 ? campusIndex : state[keys.campus];
  const campus = currentCampus(kind);
  const buildingIndex = (campus?.buildings || []).findIndex(building => building.name === buildingName);
  state[keys.building] = buildingIndex >= 0 ? buildingIndex : state[keys.building];
  renderLocationSelects(kind, roomName || "");
}

function syncProfileForm() {
  const card = $("profileFormCard");
  if (!card) return;
  if (!isVerifiedUser()) {
    card.hidden = true;
    return;
  }
  $("nicknameInput").value = state.user?.name || "";
  setSelectionByLocation("profile", state.user?.campus || "仙林校区", state.user?.building || "南苑 A 栋", state.user?.room || "");
  $("profileMessage").textContent = profileComplete() ? "" : "请补全账号资料后再发布或查看联系方式";
  if (state.user && !state.user.hasPassword) {
    switchLoginMode("setPassword");
  }
  syncSettingsAccount();
}

function iconGlyph(key, itemType) {
  return icons[key] || icons[itemType === "medicine" ? "capsules" : "plus"] || "+";
}

function statusText(status) {
  return {
    reviewing: "审核中",
    online: "上架中",
    rejected: "已驳回",
    taken_down: "已下架",
    claimed: "已领取",
    expired: "已过期"
  }[status] || status;
}

function expiryBadge(item) {
  if (item.noExpiry) {
    return `<span class="badge success">长期有效</span>`;
  }
  if (!item.expireDate) {
    return "";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${item.expireDate}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) {
    return "";
  }
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  if (days < 0) {
    return `<span class="badge expired-badge">已过期</span>`;
  }
  if (days <= 3) {
    return `<span class="badge urgency-critical">⏳ 还剩 ${days} 天</span>`;
  }
  if (days <= 7) {
    return `<span class="badge urgency-warn">⏳ 还剩 ${days} 天</span>`;
  }
  if (days <= 15) {
    return `<span class="badge warning">还有 ${days} 天到期</span>`;
  }
  return "";
}

function itemExpiredClass(item) {
  if (item.noExpiry || !item.expireDate) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${item.expireDate}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return "";
  return expiry.getTime() < today.getTime() ? "item-expired" : "";
}

function expiryText(item) {
  if (item.noExpiry) {
    return "长期有效";
  }
  return item.expireDate || "未填写";
}

function renderItem(item, options = {}) {
  const typeClass = `badge badge-${item.itemType || "consumable"}`;
  const badges = [
    `<span class="${typeClass}">${escapeHtml(item.itemTypeText || "耗材")}</span>`,
    `<span class="badge">${escapeHtml(item.category || "应急耗材")}</span>`
  ];
  if (options.showStatus && item.status && item.status !== "online") {
    badges.push(`<span class="badge">${escapeHtml(statusText(item.status))}</span>`);
  }
  const expiry = expiryBadge(item);
  if (expiry) badges.push(expiry);
  const claimPanel = options.showClaims && item.claimRequests?.length
    ? `<div class="claim-panel">
        <div class="claim-title">待确认领取提醒 ${escapeHtml(item.claimRequests.length)} 条</div>
        ${item.claimRequests.map(claim => `
          <div class="claim-row">
            <span>${escapeHtml(claim.requesterName || "同学")} 提醒已领取 ${escapeHtml(claim.quantity || 1)}${escapeHtml(item.unit || "件")}</span>
            <span class="claim-actions">
              <button type="button" class="primary small" data-claim-action="confirm" data-claim-id="${escapeHtml(claim.id)}">确认领取</button>
              <button type="button" class="secondary small" data-claim-action="reject" data-claim-id="${escapeHtml(claim.id)}">忽略</button>
            </span>
          </div>
        `).join("")}
      </div>`
    : "";
  const ownerActions = options.showOwnerActions
    ? `<div class="owner-actions">
        <button type="button" class="primary small" data-owner-action="edit" data-item-id="${escapeHtml(item.id)}">编辑</button>
        <button type="button" class="danger small" data-owner-action="delete" data-item-id="${escapeHtml(item.id)}">删除</button>
      </div>`
    : "";
  return `
    <article class="item-card ${itemExpiredClass(item)}" data-id="${escapeHtml(item.id)}">
      <div class="item-icon">${iconGlyph(item.itemIcon, item.itemType)}</div>
      <div class="item-main">
        <div class="item-title-row">
          <h3>${escapeHtml(item.title)}</h3>
          <div class="item-location">${escapeHtml(item.campus)} · ${escapeHtml(item.building)}${options.showRoom && item.room ? ` · ${escapeHtml(item.room)}` : ""}</div>
        </div>
        <p class="item-desc">${escapeHtml(item.description || "暂未填写补充信息")}</p>
        <div class="badges">${badges.join("")}</div>
        ${item.rejectReason ? `<p class="item-desc">驳回原因：${escapeHtml(item.rejectReason)}</p>` : ""}
        ${claimPanel}
        ${ownerActions}
      </div>
    </article>
  `;
}

async function loadHome() {
  $("homeState").textContent = "";
  const skeletonHTML = '<div class="skeleton-card"><div class="skeleton-icon"></div><div class="skeleton-lines"><div class="skeleton-line w-60"></div><div class="skeleton-line w-80"></div><div class="skeleton-line w-40"></div></div></div>';
  $("itemList").innerHTML = skeletonHTML + skeletonHTML + skeletonHTML;
  try {
    const keyword = $("keywordInput").value.trim();
    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    if (DEBUG_MODE) params.set("debug", "true");

    // Collect active filter chips
    const activeChips = document.querySelectorAll(".chip.active");
    const types = new Set();
    const categories = new Set();
    let hasAll = false;
    activeChips.forEach(c => {
      if (c.dataset.type === "" && c.dataset.category === "") {
        hasAll = true;
      } else {
        if (c.dataset.type) types.add(c.dataset.type);
        if (c.dataset.category) categories.add(c.dataset.category);
      }
    });

    // Determine API params
    let clientFilter = null;
    if (!hasAll) {
      if (types.size === 1) {
        params.set("itemType", [...types][0]);
        if (categories.size === 1) {
          params.set("category", [...categories][0]);
        } else if (categories.size > 1) {
          clientFilter = { categories: [...categories] };
        }
      } else if (types.size > 1) {
        clientFilter = { types: [...types], categories: [...categories] };
      }
    }

    const data = await api(`/items${params.toString() ? `?${params}` : ""}`);
    let items = data.items;

    // Apply client-side filter for multi-select
    if (clientFilter) {
      items = items.filter(item => {
        if (clientFilter.types?.length && clientFilter.categories?.length) {
          return clientFilter.types.includes(item.itemType) || clientFilter.categories.includes(item.category);
        }
        if (clientFilter.types?.length) {
          return clientFilter.types.includes(item.itemType);
        }
        if (clientFilter.categories?.length) {
          return clientFilter.categories.includes(item.category);
        }
        return true;
      });
    }

    $("viewerLabel").textContent = `${data.viewer?.campus || "当前校区"} · ${data.viewer?.building || "当前楼栋"} · 优先展示近邻${items.length ? ` · ${items.length} 件` : ""}`;
    if (!items.length) {
      $("homeState").textContent = keyword ? `未找到与「${keyword}」相关的物品` : "暂无上架物品";
    } else {
      $("homeState").textContent = "";
    }
    const list = $("itemList");
    list.innerHTML = items.map(item => renderItem(item)).join("");
    list.classList.add("list-dirty");
    list.addEventListener("animationend", () => list.classList.remove("list-dirty"), { once: true });
  } catch (error) {
    $("viewerLabel").textContent = "API 未连接";
    $("homeState").textContent = errmsg(error, "API 未连接，请稍后重试");
  }
}

async function loadProfile() {
  try {
    const data = await api("/me");
    state.user = data.user;
    if (data.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      $("profileName").textContent = data.user.name || "南易用户";
      $("profileCampus").textContent = `${data.user.campus || "未设置校区"} · ${data.user.building || "未设置楼栋"}${data.user.room ? ` · ${data.user.room}` : ""}`;
      $("verifyBadge").textContent = data.user.profileComplete ? "校园身份与楼栋已设置" : "请补全楼栋资料";
    } else {
      clearSession();
      $("profileName").textContent = "欢迎来访";
      $("profileCampus").textContent = "登录后即可发布物品、查看联系方式";
      $("verifyBadge").textContent = "未登录";
    }
    syncProfileForm();
  } catch (error) {
    $("profileName").textContent = "暂时无法读取账号";
    $("profileCampus").textContent = "服务连接异常，请稍后重试";
    $("verifyBadge").textContent = "未连接";
  }
}

function optionHtml(value, selectedValue = "") {
  return `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(value)}</option>`;
}

function selectionKeys(kind) {
  return kind === "profile"
    ? { campus: "profileCampusIndex", building: "profileBuildingIndex", campusId: "profileCampusSelect", buildingId: "profileBuildingSelect", roomId: "profileRoomSelect" }
    : { campus: "publishCampusIndex", building: "publishBuildingIndex", campusId: "campusSelect", buildingId: "buildingSelect", roomId: "roomSelect" };
}

function currentCampus(kind = "publish") {
  const keys = selectionKeys(kind);
  return state.locations[state[keys.campus]] || state.locations[0];
}

function currentBuilding(kind = "publish") {
  const keys = selectionKeys(kind);
  const campus = currentCampus(kind);
  return campus?.buildings?.[state[keys.building]] || campus?.buildings?.[0];
}

function renderLocationSelects(kind = "publish", selectedRoom = "") {
  const keys = selectionKeys(kind);
  const campusSelect = $(keys.campusId);
  const buildingSelect = $(keys.buildingId);
  const roomSelect = $(keys.roomId);
  if (!campusSelect || !buildingSelect || !roomSelect) {
    return;
  }
  if (!state.locations.length) {
    campusSelect.innerHTML = optionHtml("仙林校区");
    buildingSelect.innerHTML = optionHtml("南苑 A 栋");
    roomSelect.innerHTML = `<option value="">不填写宿舍号</option>`;
    return;
  }
  const campus = currentCampus(kind);
  const building = currentBuilding(kind);
  campusSelect.innerHTML = state.locations
    .map((item, index) => `<option value="${escapeHtml(item.name)}" ${index === state[keys.campus] ? "selected" : ""}>${escapeHtml(item.name)}</option>`)
    .join("");
  buildingSelect.innerHTML = (campus?.buildings || [])
    .map((item, index) => `<option value="${escapeHtml(item.name)}" ${index === state[keys.building] ? "selected" : ""}>${escapeHtml(item.name)}</option>`)
    .join("");
  roomSelect.innerHTML = `<option value="">不填写宿舍号</option>${(building?.rooms || [])
    .map(room => optionHtml(room, selectedRoom))
    .join("")}`;
}

async function loadLocations() {
  try {
    const data = await api("/locations");
    state.locations = Array.isArray(data.locations) ? data.locations : [];
  } catch (error) {
    state.locations = [];
  }
  const campusIndex = state.locations.findIndex(campus => campus.name === "仙林校区");
  state.publishCampusIndex = campusIndex >= 0 ? campusIndex : 0;
  state.profileCampusIndex = state.publishCampusIndex;
  const campus = currentCampus("publish");
  const buildingIndex = (campus?.buildings || []).findIndex(building => building.name === "南苑 A 栋");
  state.publishBuildingIndex = buildingIndex >= 0 ? buildingIndex : 0;
  state.profileBuildingIndex = state.publishBuildingIndex;
  renderLocationSelects("publish");
  renderLocationSelects("profile");
}

function initDateControls() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;
  $("expireDateInput").setAttribute("min", todayStr);
  $("expireDateInput").value = `${yyyy}-12-31`;
}

function getExpireDate() {
  return $("expireDateInput").value;
}

function setExpireDate(dateStr) {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    $("expireDateInput").value = dateStr;
  }
}

function setDateRowDisabled(disabled) {
  $("expireDateInput").disabled = disabled;
}

function toggleNoExpiry() {
  const checked = $("noExpiryInput").checked;
  setDateRowDisabled(checked);
}

function renderClaimsBanner(items) {
  const banner = $("pendingClaimsBanner");
  const list = $("pendingClaimsList");
  const countEl = $("pendingClaimsCount");
  if (!banner || !list || !countEl) return;
  const allClaims = [];
  for (const item of items) {
    if (item.claimRequests && item.claimRequests.length) {
      for (const claim of item.claimRequests) {
        allClaims.push({ claim, item });
      }
    }
  }
  if (!allClaims.length) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  countEl.textContent = `${allClaims.length} 条待确认`;
  list.innerHTML = allClaims.map(({ claim, item }) => `
    <div class="claim-banner-row">
      <div class="claim-banner-info">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(claim.requesterName || "同学")} 提醒已领取 ${escapeHtml(claim.quantity || 1)}${escapeHtml(item.unit || "件")}</span>
      </div>
      <span class="claim-actions">
        <button type="button" class="primary small" data-claim-action="confirm" data-claim-id="${escapeHtml(claim.id)}">确认领取</button>
        <button type="button" class="secondary small" data-claim-action="reject" data-claim-id="${escapeHtml(claim.id)}">忽略</button>
      </span>
    </div>
  `).join("");
}

function showClaimsModal(items) {
  const allClaims = [];
  for (const item of items) {
    if (item.claimRequests && item.claimRequests.length) {
      for (const claim of item.claimRequests) {
        allClaims.push({ claim, item });
      }
    }
  }
  if (!allClaims.length) {
    return;
  }
  $("claimsModalBody").innerHTML = allClaims.map(({ claim, item }) => `
    <div class="claim-modal-row">
      <div class="claim-modal-info">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(claim.requesterName || "同学")} 提醒已领取 ${escapeHtml(claim.quantity || 1)}${escapeHtml(item.unit || "件")}</span>
      </div>
      <span class="claim-actions">
        <button type="button" class="primary small" data-claim-action="confirm" data-claim-id="${escapeHtml(claim.id)}">确认领取</button>
        <button type="button" class="secondary small" data-claim-action="reject" data-claim-id="${escapeHtml(claim.id)}">忽略</button>
      </span>
    </div>
  `).join("");
  $("claimsModal").showModal();
}

function refreshClaimsModal() {
  const modal = $("claimsModal");
  if (!modal || !modal.open) return;
  const remaining = $("claimsModalBody").querySelectorAll(".claim-modal-row").length;
  if (remaining <= 1) {
    modal.close();
    return;
  }
}

async function loadMyItems() {
  const container = $("myItemList");
  if (!isVerifiedUser()) {
    container.innerHTML = `<div class="state-card">请先登录并同意用户协议，再查看自己的发布。</div>`;
    $("pendingClaimsBanner").hidden = true;
    return;
  }
  const skHTML = '<div class="skeleton-card"><div class="skeleton-icon"></div><div class="skeleton-lines"><div class="skeleton-line w-60"></div><div class="skeleton-line w-80"></div><div class="skeleton-line w-40"></div></div></div>';
  container.innerHTML = skHTML + skHTML + skHTML;
  try {
    const data = await api("/me/items");
    const sorted = [...data.items];
    sorted.sort((a, b) => {
      const aPending = (a.pendingClaimCount || 0) > 0 ? 1 : 0;
      const bPending = (b.pendingClaimCount || 0) > 0 ? 1 : 0;
      return bPending - aPending;
    });
    renderClaimsBanner(sorted);
    container.innerHTML = sorted.length
      ? sorted.map(item => renderItem(item, { showRoom: true, showStatus: true, showClaims: true, showOwnerActions: true })).join("")
      : `<div class="state-card">暂无发布记录</div>`;
    const hasPending = sorted.some(item => (item.pendingClaimCount || 0) > 0);
    if (hasPending && !state.claimsModalShown) {
      state.claimsModalShown = true;
      showClaimsModal(sorted);
    }
  } catch (error) {
    container.innerHTML = `<div class="state-card">${escapeHtml(errmsg(error, "加载失败"))}</div>`;
    $("pendingClaimsBanner").hidden = true;
  }
}

async function openDetail(id) {
  try {
    state.contactViewedForItem = "";
    const data = await api(`/items/${encodeURIComponent(id)}`);
    state.selectedDetail = data.item;
    $("detailTitle").textContent = data.item.title;
    $("detailBody").innerHTML = `
      <div class="item-icon">${iconGlyph(data.item.itemIcon, data.item.itemType)}</div>
      <p class="detail-meta">${escapeHtml(data.item.campus)} · ${escapeHtml(data.item.building)}<br>
      ${escapeHtml(data.item.itemTypeText)} · ${escapeHtml(data.item.category)} · 剩余 ${escapeHtml(data.item.quantity)}${escapeHtml(data.item.unit)}<br>
      有效期：${escapeHtml(expiryText(data.item))} · ${escapeHtml(data.item.distanceLabel || "")}</p>
      <p class="item-desc">${escapeHtml(data.item.description || "暂未填写补充信息")}</p>
      <div class="notice-line">本平台仅提供信息匹配，不涉及物品流转。领取前请自行确认包装完好与有效期，评估使用风险。平台禁止处方药、管制药品及任何收费行为。</div>
      <button class="primary wide" id="contactButton" ${(state.user?.dailyContactRemaining ?? 0) <= 0 && isVerifiedUser() && profileComplete() ? "disabled" : ""}>${isVerifiedUser() && profileComplete() ? ((state.user?.dailyContactRemaining ?? 5) > 0 ? `查看联系方式（今日剩余 <span class="contact-count">${state.user?.dailyContactRemaining ?? 5}</span> 次）` : "今日次数已用完") : "登录并完善资料后查看联系方式"}</button>
      <div id="contactResult"></div>
    `;
    $("detailDialog").showModal();
  } catch (error) {
    showToast(errmsg(error, "详情加载失败"), "error");
  }
}

async function openMyItemDetail(id) {
  try {
    const data = await api(`/me/items/${encodeURIComponent(id)}`);
    state.selectedDetail = data.item;
    state.editingItemId = id;
    $("detailTitle").textContent = data.item.title;
    const statusLabel = data.item.status !== "online" ? ` <span class="badge">${escapeHtml(statusText(data.item.status))}</span>` : "";
    $("detailBody").innerHTML = `
      <div class="item-icon">${iconGlyph(data.item.itemIcon, data.item.itemType)}</div>
      <p class="detail-meta">
        ${escapeHtml(data.item.itemTypeText)} · ${escapeHtml(data.item.category)} · 剩余 ${escapeHtml(data.item.quantity)}${escapeHtml(data.item.unit)}<br>
        ${escapeHtml(data.item.campus)} · ${escapeHtml(data.item.building)}${data.item.room ? ` · ${escapeHtml(data.item.room)}` : ""}<br>
        有效期：${escapeHtml(expiryText(data.item))}<br>
        状态：${escapeHtml(statusText(data.item.status))}${statusLabel}
      </p>
      ${data.item.rejectReason ? `<p class="item-desc">驳回原因：${escapeHtml(data.item.rejectReason)}</p>` : ""}
      <p class="item-desc">${escapeHtml(data.item.description || "暂未填写补充信息")}</p>
      <div class="contact-box">
        微信：${escapeHtml(data.item.contact?.wechat || "未填写")}<br>
        QQ：${escapeHtml(data.item.contact?.qq || "未填写")}
      </div>
      ${data.item.claimRequests?.length ? `
        <div class="claim-panel">
          <div class="claim-title">待确认领取提醒 ${escapeHtml(data.item.claimRequests.length)} 条</div>
          ${data.item.claimRequests.map(claim => `
            <div class="claim-row">
              <span>${escapeHtml(claim.requesterName || "同学")} 提醒已领取 ${escapeHtml(claim.quantity || 1)}${escapeHtml(data.item.unit || "件")}</span>
              <span class="claim-actions">
                <button type="button" class="primary small" data-claim-action="confirm" data-claim-id="${escapeHtml(claim.id)}">确认领取</button>
                <button type="button" class="secondary small" data-claim-action="reject" data-claim-id="${escapeHtml(claim.id)}">忽略</button>
              </span>
            </div>
          `).join("")}
        </div>
      ` : ""}
      <div class="owner-actions">
        <button class="primary small" id="editItemButton">编辑</button>
        <button class="danger small" id="takeDownButton">删除</button>
      </div>
      <div id="ownerActionResult"></div>
    `;
    $("detailDialog").showModal();
  } catch (error) {
    showToast(errmsg(error, "详情加载失败"), "error");
  }
}

function startEditItem() {
  const item = state.selectedDetail;
  if (!item) return;
  $("detailDialog").close();
  const tab = document.querySelector('.tab[data-view="publish"]');
  if (tab) tab.click();
  state.selectedPublishType = item.itemType || "consumable";
  state.selectedIcon = item.itemIcon || "plus";
  state.iconOtherOpen = false;
  document.querySelectorAll(".segment").forEach(button => {
    button.classList.toggle("active", button.dataset.itemType === state.selectedPublishType);
  });
  $("titleInput").value = item.title || "";
  $("quantityInput").value = item.quantity || 1;
  $("unitInput").value = item.unit || "件";
  $("descriptionInput").value = item.description || "";
  $("wechatInput").value = item.contact?.wechat || "";
  $("qqInput").value = item.contact?.qq || "";
  $("medicineCategoryWrap").hidden = item.itemType !== "medicine";
  $("toolCategoryWrap").hidden = item.itemType !== "tool";
  if (item.itemType === "medicine") {
    const catSelect = $("categorySelect");
    if (catSelect) catSelect.value = item.category || "感冒药";
  } else if (item.itemType === "tool") {
    const toolCat = $("toolCategorySelect");
    if (toolCat) toolCat.value = item.category || "常用工具";
  }
  if (item.itemType === "tool") {
    $("typeHint").textContent = "适用于偶尔需要但不常备的小工具，如锤子、镊子、砂纸、热熔胶枪等。建议注明是借用还是赠送。";
  } else if (item.itemType === "medicine") {
    $("typeHint").textContent = "药品仅限非处方常见药品，按大类选择即可。禁止处方药、管制药品及任何收费转让。";
  } else {
    $("typeHint").textContent = "适用于创可贴、碘伏棉签、口罩、消毒用品等低风险应急物品，无需细分品类。";
  }
  if (item.noExpiry) {
    $("noExpiryInput").checked = true;
    setDateRowDisabled(true);
  } else {
    $("noExpiryInput").checked = false;
    setDateRowDisabled(false);
    setExpireDate(item.expireDate || "");
  }
  $("noExpiryWrap").hidden = item.itemType === "medicine";
  if (item.itemType === "tool") $("noExpiryWrap").hidden = false;
  $("useProfileLocationInput").checked = false;
  $("publishLocationFields").hidden = false;
  setSelectionByLocation("publish", item.campus || "仙林校区", item.building || "南苑 A 栋", item.room || "");
  renderIconGrid();
  $("publishMessage").textContent = "正在编辑物品，提交后将重新进入审核";
  document.querySelector(".segment[data-item-type='" + state.selectedPublishType + "']")?.classList.add("active");
  updateCharCounts();
  clearFieldErrors();
}

async function takeDownMyItem() {
  const item = state.selectedDetail;
  if (!item) return;
  if (!confirm("确定要删除这条发布记录吗？上架中或审核中的物品会同时下架。")) return;
  try {
    const data = await api(`/me/items/${encodeURIComponent(item.id)}/delete`, { method: "POST" });
    $("ownerActionResult").innerHTML = `<div class="contact-box">${escapeHtml(data.message || "发布记录已删除。")}</div>`;
    await Promise.all([loadHome(), loadMyItems()]);
    setTimeout(() => $("detailDialog").close(), 1200);
  } catch (error) {
    $("ownerActionResult").innerHTML = `<div class="contact-box">${escapeHtml(errmsg(error, "删除失败"))}</div>`;
  }
}

async function handleListDelete(itemId, button) {
  if (!confirm("确定要删除这条发布记录吗？上架中或审核中的物品会同时下架。")) return;
  button.disabled = true;
  button.textContent = "删除中...";
  try {
    await api(`/me/items/${encodeURIComponent(itemId)}/delete`, { method: "POST" });
    const card = button.closest(".item-card");
    if (card) {
      card.classList.add("card-removing");
      card.addEventListener("animationend", () => {
        Promise.all([loadHome(), loadMyItems()]);
      }, { once: true });
    } else {
      await Promise.all([loadHome(), loadMyItems()]);
    }
  } catch (error) {
    showToast(errmsg(error, "删除失败"), "error");
    button.disabled = false;
    button.textContent = "删除";
  }
}

async function viewContact() {
  if (!state.selectedDetail) return;
  if (!requireVerified("请先登录并同意用户协议，再查看微信或 QQ 联系方式。", () => {
    openDetail(state.selectedDetail?.id).then(() => setTimeout(viewContact, 400));
  })) {
    $("detailDialog").close();
    return;
  }
  if (state.contactViewedForItem === state.selectedDetail.id) return;
  try {
    const data = await api(`/items/${encodeURIComponent(state.selectedDetail.id)}/contact`, { method: "POST" });
    state.contactViewedForItem = state.selectedDetail.id;
    const noteText = data.alreadyViewed
      ? "今天已查看过该联系方式，本次不重复计入次数。"
      : "为保护每位同学的隐私，每日查看次数设有上限。";
    $("contactResult").innerHTML = `
      <div class="contact-box">
        微信：${escapeHtml(data.contact?.wechat || "未填写")}<br>
        QQ：${escapeHtml(data.contact?.qq || "未填写")}<br>
        今日剩余查看次数：<span class="contact-count">${escapeHtml(data.remaining)}</span><br>
        <span class="contact-note">${noteText}</span>
      </div>
      <button class="primary wide claim-button" id="claimButton">我已联系并领取，提醒发布者确认</button>
      <div id="claimResult"></div>
    `;
    loadProfile();
  } catch (error) {
    $("contactResult").innerHTML = `<div class="contact-box">${escapeHtml(errmsg(error, "查看失败"))}</div>`;
  }
}

async function requestClaim() {
  if (!state.selectedDetail) return;
  if (!requireVerified("请先登录并补全账号资料，再提醒发布者确认领取。", () => {
    openDetail(state.selectedDetail?.id).then(() => setTimeout(requestClaim, 400));
  })) {
    $("detailDialog").close();
    return;
  }
  const claimBtn = $("claimButton");
  if (!claimBtn) return;
  claimBtn.disabled = true;
  claimBtn.textContent = "正在发送提醒...";
  try {
    const data = await api(`/items/${encodeURIComponent(state.selectedDetail.id)}/claim`, {
      method: "POST",
      body: JSON.stringify({ quantity: 1 })
    });
    claimBtn.textContent = "您已提醒过发布者确认领取，请等待对方处理";
    claimBtn.classList.add("disabled-claim");
    $("claimResult").innerHTML = `<div class="contact-box">${escapeHtml(data.message || "已发送领取提醒")}</div>`;
  } catch (error) {
    claimBtn.disabled = false;
    claimBtn.textContent = "我已联系并领取，提醒发布者确认";
    $("claimResult").innerHTML = `<div class="contact-box">${escapeHtml(errmsg(error, "发送领取提醒失败"))}</div>`;
  }
}

async function reviewClaimFromButton(button) {
  const claimId = button.dataset.claimId;
  const action = button.dataset.claimAction;
  if (!claimId || !action) return;
  button.disabled = true;
  button.textContent = action === "confirm" ? "确认中..." : "处理中...";
  try {
    const data = await api(`/claims/${encodeURIComponent(claimId)}/${action}`, { method: "POST" });
    if (action === "confirm") {
      button.textContent = "✓ 已确认";
      button.classList.add("claim-confirmed");
      const card = button.closest(".item-card");
      if (card) {
        setTimeout(() => {
          card.classList.add("card-removing");
          card.addEventListener("animationend", () => {
            Promise.all([loadHome(), loadProfile(), loadMyItems()]);
          }, { once: true });
        }, 1200);
      }
    } else {
      await Promise.all([loadHome(), loadProfile(), loadMyItems()]);
    }
  } catch (error) {
    showToast(errmsg(error, "处理失败"), "error");
    button.disabled = false;
    button.textContent = action === "confirm" ? "确认领取" : "忽略";
  }
}

function renderIconGrid() {
  const commonKeys = state.selectedPublishType === "medicine"
    ? ["capsules", "pills", "tablets", "prescriptionBottleMedical"]
    : state.selectedPublishType === "tool"
    ? ["box", "boxOpen", "handHoldingMedical", "heartPulse"]
    : ["plus", "bandage", "pumpMedical", "temperatureHalf"];
  const common = iconOptions.filter(([key]) => commonKeys.includes(key));
  const hidden = iconOptions.filter(([key]) => !commonKeys.includes(key));
  const isHiddenSelected = hidden.some(([key]) => key === state.selectedIcon);
  const commonHtml = common.map(([key]) => `
    <button type="button" class="icon-option ${key === state.selectedIcon ? "active" : ""}" data-icon="${key}" aria-label="选择图标">
      <strong>${iconGlyph(key, state.selectedPublishType)}</strong>
    </button>
  `).join("");
  const otherHtml = `
    <button type="button" class="icon-option ${isHiddenSelected || state.iconOtherOpen ? "active" : ""}" data-toggle-icons="true" aria-label="更多图标">
      <strong></strong>
    </button>
  `;
  const hiddenHtml = state.iconOtherOpen ? `
    <div class="icon-more">
      ${hidden.map(([key]) => `
        <button type="button" class="icon-option ${key === state.selectedIcon ? "active" : ""}" data-icon="${key}" aria-label="选择图标">
          <strong>${iconGlyph(key, state.selectedPublishType)}</strong>
        </button>
      `).join("")}
    </div>
  ` : "";
  $("iconGrid").innerHTML = `${commonHtml}${otherHtml}${hiddenHtml}`;
}

function setPublishType(itemType) {
  state.selectedPublishType = itemType;
  state.selectedIcon = itemType === "medicine" ? "capsules" : (itemType === "tool" ? "box" : "plus");
  state.iconOtherOpen = false;
  $("medicineCategoryWrap").hidden = itemType !== "medicine";
  $("toolCategoryWrap").hidden = itemType !== "tool";
  const today = new Date();
  if (itemType === "tool") {
    $("typeHint").textContent = "适用于偶尔需要但不常备的小工具，如锤子、镊子、砂纸、热熔胶枪等。建议注明是借用还是赠送。";
    $("titleInput").placeholder = "例如：热熔胶枪借用";
    $("noExpiryWrap").hidden = false;
    $("noExpiryInput").checked = true;
    setDateRowDisabled(true);
  } else if (itemType === "medicine") {
    $("typeHint").textContent = "药品仅限非处方常见药品，按大类选择即可。禁止处方药、管制药品及任何收费转让。";
    $("titleInput").placeholder = "例如：未拆封感冒药一盒";
    $("noExpiryWrap").hidden = true;
    $("noExpiryInput").checked = false;
    setDateRowDisabled(false);
    const d = new Date(today);
    d.setFullYear(d.getFullYear() + 1);
    setExpireDate(d.toISOString().slice(0, 10));
  } else {
    $("typeHint").textContent = "适用于创可贴、碘伏棉签、口罩、消毒用品等低风险应急物品，无需细分品类。";
    $("titleInput").placeholder = "例如：碘伏棉签 10 支";
    $("noExpiryWrap").hidden = false;
    $("noExpiryInput").checked = false;
    setDateRowDisabled(false);
    const d = new Date(today);
    d.setDate(d.getDate() + 180);
    setExpireDate(d.toISOString().slice(0, 10));
  }
  clearFieldErrors();
  updateCharCounts();
  document.querySelectorAll(".segment").forEach(button => {
    button.classList.toggle("active", button.dataset.itemType === itemType);
  });
  renderIconGrid();
}

function clearFieldErrors() {
  document.querySelectorAll(".field-error").forEach(el => { el.textContent = ""; });
  document.querySelectorAll(".field-error-border").forEach(el => { el.classList.remove("field-error-border"); });
}

function updateCharCounts() {
  const titleEl = $("titleCount");
  const descEl = $("descriptionCount");
  if (titleEl) {
    const len = ($("titleInput").value || "").length;
    titleEl.textContent = len + "/30";
    titleEl.classList.toggle("over", len > 30);
  }
  if (descEl) {
    const len = ($("descriptionInput").value || "").length;
    descEl.textContent = len + "/200";
    descEl.classList.toggle("over", len > 200);
  }
}

async function submitPublish(event) {
  event.preventDefault();
  const message = $("publishMessage");
  clearFieldErrors();
  message.textContent = "";

  if (!isVerifiedUser()) {
    message.textContent = "请先在「我的」页登录并同意用户协议，再发布互助。";
    requireVerified(message.textContent);
    return;
  }
  if (!profileComplete()) {
    message.textContent = "请先在「我的」页补全昵称、校区和楼栋";
    requireVerified(message.textContent);
    return;
  }

  let hasError = false;
  const title = $("titleInput").value.trim();
  if (!title) {
    $("titleError").textContent = "请填写物品名称";
    hasError = true;
  }

  const quantity = Number($("quantityInput").value);
  if (quantity <= 0 || !Number.isInteger(quantity)) {
    $("quantityError").textContent = "数量至少为 1";
    hasError = true;
  }

  const contactWechat = $("wechatInput").value.trim();
  const contactQq = $("qqInput").value.trim();
  if (!contactWechat && !contactQq) {
    $("wechatError").textContent = "至少填一项";
    $("qqError").textContent = "至少填一项";
    hasError = true;
  }

  if (!$("disclaimerInput").checked) {
    $("disclaimerError").textContent = "请先确认发布声明";
    $("disclaimerRow").classList.add("field-error-border");
    hasError = true;
  }

  if (hasError) return;

  const useProfileLocation = $("useProfileLocationInput").checked;
  const campus = useProfileLocation ? state.user.campus : $("campusSelect").value.trim();
  const building = useProfileLocation ? state.user.building : $("buildingSelect").value.trim();
  const room = useProfileLocation ? state.user.room || "" : $("roomSelect").value.trim();
  const payload = {
    title,
    itemType: state.selectedPublishType,
    itemIcon: state.selectedIcon,
    category: state.selectedPublishType === "medicine" ? $("categorySelect").value : (state.selectedPublishType === "tool" ? $("toolCategorySelect").value : "应急耗材"),
    quantity,
    unit: $("unitInput").value.trim(),
    campus,
    building,
    room,
    expireDate: $("noExpiryInput").checked ? "" : getExpireDate(),
    noExpiry: (state.selectedPublishType === "consumable" || state.selectedPublishType === "tool") && $("noExpiryInput").checked,
    description: $("descriptionInput").value.trim(),
    contactWechat,
    contactQq,
    disclaimerAccepted: true
  };

  const isEdit = Boolean(state.editingItemId);

  // Pre-submit confirmation dialog for new items (skip edit mode)
  if (!isEdit) {
    const confirmed = await showPublishConfirmDialog(payload);
    if (!confirmed) return;
  }

  const submitBtn = document.querySelector("#publishForm button[type=submit]");
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "提交中..."; }
  let result;
  try {
    message.textContent = isEdit ? "正在保存..." : "正在提交...";
    if (isEdit) {
      result = await api(`/me/items/${encodeURIComponent(state.editingItemId)}`, {
        method: "PUT",
        body: JSON.stringify({
          title: payload.title,
          quantity: payload.quantity,
          unit: payload.unit,
          description: payload.description,
          expireDate: payload.expireDate,
          noExpiry: payload.noExpiry,
          contactWechat: payload.contactWechat,
          contactQq: payload.contactQq
        })
      });
      state.editingItemId = "";
    } else {
      result = await api("/items", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }
    message.textContent = "";
    if (isEdit) {
      event.target.reset();
      $("quantityInput").value = "1";
      $("unitInput").value = "件";
      setExpireDate("2026-12-31");
      setDateRowDisabled(false);
      $("noExpiryInput").checked = false;
      $("useProfileLocationInput").checked = true;
      $("publishLocationFields").hidden = true;
      $("disclaimerInput").checked = false;
      setPublishType(state.selectedPublishType);
      renderLocationSelects("publish");
      showToast(result.message || "已保存", "success");
    } else {
      const form = $("publishForm");
      const successCard = $("publishSuccessCard");
      if (form && successCard) {
        form.hidden = true;
        successCard.hidden = false;
        $("publishSuccessTitle").textContent = "发布成功";
        $("publishSuccessDesc").textContent = "你的「" + payload.title + "」已提交确认，通过后同楼同学就能看到了";
        successCard.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    loadMyItems();
  } catch (error) {
    message.textContent = errmsg(error, "提交失败");
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "提交审核"; }
  }
}

async function showPublishConfirmDialog(payload) {
  const expiryText = payload.noExpiry ? "长期有效" : payload.expireDate;
  const typeLabel = payload.itemType === "medicine" ? "药品" : (payload.itemType === "tool" ? "工具" : "耗材");
  const dialog = document.createElement("dialog");
  dialog.className = "confirm-dialog";
  dialog.innerHTML = `
    <div class="confirm-dialog-content">
      <h3>确认发布信息</h3>
      <div class="confirm-summary">
        <div class="confirm-row"><span class="confirm-label">物品名称</span><span>${escapeHtml(payload.title)}</span></div>
        <div class="confirm-row"><span class="confirm-label">类型</span><span>${typeLabel} / ${payload.category}</span></div>
        <div class="confirm-row"><span class="confirm-label">数量</span><span>${payload.quantity} ${payload.unit}</span></div>
        <div class="confirm-row"><span class="confirm-label">校区楼栋</span><span>${payload.campus} ${payload.building}</span></div>
        <div class="confirm-row"><span class="confirm-label">有效期</span><span>${expiryText}</span></div>
      </div>
      <div class="confirm-actions">
        <button class="primary wide" id="confirmSubmitBtn" type="button">确认提交</button>
        <button class="secondary wide" id="confirmBackBtn" type="button">再检查一下</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.showModal();
  return new Promise(resolve => {
    dialog.querySelector("#confirmSubmitBtn").addEventListener("click", () => { dialog.close(); dialog.remove(); resolve(true); });
    dialog.querySelector("#confirmBackBtn").addEventListener("click", () => { dialog.close(); dialog.remove(); resolve(false); });
    dialog.addEventListener("click", event => { if (event.target === dialog) { dialog.close(); dialog.remove(); resolve(false); } });
    dialog.addEventListener("cancel", event => { event.preventDefault(); dialog.close(); dialog.remove(); resolve(false); });
  });
}

async function sendCode() {
  const message = $("authMessage");
  const email = $("authEmail").value.trim();
  const studentId = $("authStudentId").value.trim();
  const agreement = currentAgreementPayload();
  if (!agreement.agreementAccepted) {
    message.textContent = "请先阅读并同意用户协议";
    return;
  }
  if (!email && !studentId) {
    message.textContent = "请填写邮箱或学号";
    return;
  }
  try {
    message.textContent = "正在向南哪小帮手发送验证码...";
    const data = await api("/auth/nanna/challenge", {
      method: "POST",
      body: JSON.stringify({ email, studentId, ...agreement })
    });
    state.challengeId = data.challengeId || "";
    message.textContent = data.message || `验证码已发送至 ${data.maskedTarget || "南哪小帮手"}`;
  } catch (error) {
    message.textContent = errmsg(error, "发送失败");
  }
}

async function verifyCode() {
  const message = $("authMessage");
  const email = $("authEmail").value.trim();
  const studentId = $("authStudentId").value.trim();
  const code = $("authCode").value.trim();
  const agreement = currentAgreementPayload();
  if (!agreement.agreementAccepted) {
    message.textContent = "请先阅读并同意用户协议";
    return;
  }
  if (!code) {
    message.textContent = "请填写验证码";
    return;
  }
  try {
    message.textContent = "正在验证...";
    const data = await api("/auth/nanna/verify", {
      method: "POST",
      body: JSON.stringify({ email, studentId, code, challengeId: state.challengeId, ...agreement })
    });
    saveSession(data.token, data.user);
    message.textContent = "校园身份验证成功";
    await Promise.all([loadProfile(), loadHome(), loadMyItems()]);
    syncPublishView();
    executePendingAction();
  } catch (error) {
    message.textContent = errmsg(error, "验证失败");
  }
}

function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return "密码至少需要 8 位";
  }
  if (password.length > 64) {
    return "密码最多 64 位";
  }
  if (!/[a-zA-Z]/.test(password)) {
    return "密码必须包含至少一个字母";
  }
  if (!/[0-9]/.test(password)) {
    return "密码必须包含至少一个数字";
  }
  return "";
}

function emailFromPasswordPrefix() {
  const prefix = $("passwordEmailInput").value.trim().toLowerCase().replace(/@.*$/, "");
  return prefix ? `${prefix}@smail.nju.edu.cn` : "";
}

function emailFromResetPrefix() {
  const prefix = $("resetEmailInput").value.trim().toLowerCase().replace(/@.*$/, "");
  return prefix ? `${prefix}@smail.nju.edu.cn` : "";
}

function switchLoginMode(mode) {
  const codeSection = $("codeLoginSection");
  const passwordSection = $("passwordLoginSection");
  const forgotSection = $("forgotPasswordSection");
  const setPasswordPrompt = $("setPasswordPrompt");
  const tabs = document.querySelectorAll(".login-tab");

  codeSection.hidden = true;
  passwordSection.hidden = true;
  forgotSection.hidden = true;
  if (setPasswordPrompt) setPasswordPrompt.hidden = true;
  tabs.forEach(tab => tab.classList.remove("active"));

  if (mode === "code") {
    codeSection.hidden = false;
    const codeTab = document.querySelector('.login-tab[data-login-mode="code"]');
    if (codeTab) codeTab.classList.add("active");
  } else if (mode === "password") {
    passwordSection.hidden = false;
    const pwTab = document.querySelector('.login-tab[data-login-mode="password"]');
    if (pwTab) pwTab.classList.add("active");
  } else if (mode === "forgot") {
    forgotSection.hidden = false;
  } else if (mode === "setPassword") {
    if (setPasswordPrompt) setPasswordPrompt.hidden = false;
  }
  $("authMessage").textContent = "";
}

async function passwordLogin() {
  const message = $("authMessage");
  const email = emailFromPasswordPrefix();
  const password = $("passwordInput").value;
  const agreement = currentAgreementPayload();
  if (!agreement.agreementAccepted) {
    message.textContent = "请先阅读并同意用户协议";
    return;
  }
  if (!email) {
    message.textContent = "请填写南京大学学生邮箱前缀";
    return;
  }
  const pwError = validatePasswordStrength(password);
  if (pwError) {
    message.textContent = pwError;
    return;
  }
  try {
    message.textContent = "正在登录...";
    const data = await api("/auth/password/login", {
      method: "POST",
      body: JSON.stringify({ email, password, ...agreement })
    });
    saveSession(data.token, data.user);
    message.textContent = "密码登录成功";
    switchLoginMode("code");
    await Promise.all([loadProfile(), loadHome(), loadMyItems()]);
    syncPublishView();
    executePendingAction();
  } catch (error) {
    message.textContent = errmsg(error, "密码登录失败");
  }
}

async function sendResetCode() {
  const message = $("authMessage");
  const email = emailFromResetPrefix();
  if (!email) {
    message.textContent = "请填写南京大学学生邮箱前缀";
    return;
  }
  try {
    message.textContent = "正在发送重置验证码...";
    const data = await api("/auth/password/reset-challenge", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    state.emailChallengeId = data.challengeId || "";
    message.textContent = data.message || "验证码已发送，请查收邮箱";
  } catch (error) {
    message.textContent = errmsg(error, "验证码发送失败");
  }
}

async function resetPassword() {
  const message = $("authMessage");
  const email = emailFromResetPrefix();
  const code = $("resetCodeInput").value.trim();
  const password = $("resetPasswordInput").value;
  if (!email) {
    message.textContent = "请填写南京大学学生邮箱前缀";
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    message.textContent = "请填写 6 位验证码";
    return;
  }
  const pwError = validatePasswordStrength(password);
  if (pwError) {
    message.textContent = pwError;
    return;
  }
  try {
    message.textContent = "正在重置密码...";
    const data = await api("/auth/password/reset", {
      method: "POST",
      body: JSON.stringify({ email, code, password, challengeId: state.emailChallengeId })
    });
    message.textContent = data.message || "密码重置成功";
    switchLoginMode("password");
    $("passwordInput").value = "";
  } catch (error) {
    message.textContent = errmsg(error, "密码重置失败");
  }
}

async function setNewPassword() {
  const message = $("authMessage");
  const password = $("setPasswordInput").value;
  const pwError = validatePasswordStrength(password);
  if (pwError) {
    message.textContent = pwError;
    return;
  }
  try {
    message.textContent = "正在设置密码...";
    const data = await api("/auth/password/set", {
      method: "POST",
      body: JSON.stringify({ password })
    });
    message.textContent = data.message || "密码设置成功";
    $("setPasswordPrompt").hidden = true;
    await loadProfile();
  } catch (error) {
    message.textContent = errmsg(error, "密码设置失败");
  }
}

async function changePassword() {
  const message = $("changePasswordMessage");
  const currentPassword = $("currentPasswordInput").value;
  const newPassword = $("newPasswordInput").value;
  const confirmPassword = $("confirmPasswordInput").value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    message.textContent = "请填写所有密码字段";
    return;
  }
  if (newPassword !== confirmPassword) {
    message.textContent = "两次输入的新密码不一致";
    return;
  }
  const pwError = validatePasswordStrength(newPassword);
  if (pwError) {
    message.textContent = pwError;
    return;
  }
  try {
    message.textContent = "正在修改密码...";
    await api("/auth/password/change", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });
    message.textContent = "密码修改成功";
    $("changePasswordForm").hidden = true;
    $("settingsChangePasswordButton").hidden = false;
    $("currentPasswordInput").value = "";
    $("newPasswordInput").value = "";
    $("confirmPasswordInput").value = "";
  } catch (error) {
    message.textContent = errmsg(error, "密码修改失败");
  }
}

async function sendEmailCode() {
  const message = $("authMessage");
  const email = emailFromPrefix();
  const agreement = currentAgreementPayload();
  if (!agreement.agreementAccepted) {
    message.textContent = "请先阅读并同意用户协议";
    return;
  }
  if (!email) {
    message.textContent = "请填写南京大学学生邮箱前缀";
    return;
  }
  try {
    message.textContent = "正在发送邮箱验证码...";
    const data = await api("/auth/email/challenge", {
      method: "POST",
      body: JSON.stringify({ email, ...agreement })
    });
    state.emailChallengeId = data.challengeId || "";
    message.textContent = data.message || "验证码已发送，请查收邮箱";
  } catch (error) {
    message.textContent = errmsg(error, "验证码发送失败");
  }
}

async function verifyEmailCode() {
  const message = $("authMessage");
  const email = emailFromPrefix();
  const code = $("emailCodeInput").value.trim();
  const agreement = currentAgreementPayload();
  if (!agreement.agreementAccepted) {
    message.textContent = "请先阅读并同意用户协议";
    return;
  }
  if (!email) {
    message.textContent = "请填写南京大学学生邮箱前缀";
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    message.textContent = "请填写 6 位邮箱验证码";
    return;
  }
  try {
    message.textContent = "正在验证邮箱验证码...";
    const data = await api("/auth/email/verify", {
      method: "POST",
      body: JSON.stringify({ email, code, challengeId: state.emailChallengeId, ...agreement })
    });
    saveSession(data.token, data.user);
    message.textContent = "邮箱登录成功";
    if (data.user && !data.user.hasPassword) {
      switchLoginMode("setPassword");
      message.textContent = "邮箱登录成功，建议设置密码方便下次登录";
    } else {
      switchLoginMode("code");
    }
    await Promise.all([loadProfile(), loadHome(), loadMyItems()]);
    syncPublishView();
    executePendingAction();
  } catch (error) {
    message.textContent = errmsg(error, "验证码验证失败");
  }
}

async function saveProfile() {
  const message = $("profileMessage");
  if (!isVerifiedUser()) {
    message.textContent = "请先登录";
    return;
  }
  const payload = {
    name: $("nicknameInput").value.trim(),
    campus: $("profileCampusSelect").value,
    building: $("profileBuildingSelect").value,
    room: $("profileRoomSelect").value
  };
  if (!payload.name) {
    message.textContent = "请填写昵称";
    return;
  }
  try {
    message.textContent = "正在保存...";
    const data = await api("/me/profile", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    saveSession(state.token, data.user);
    message.textContent = data.message || "账号资料已更新";
    $("profileFormCard").hidden = true;
    await Promise.all([loadProfile(), loadHome()]);
    syncPublishView();
    executePendingAction();
  } catch (error) {
    message.textContent = errmsg(error, "保存失败");
  }
}

function applyDarkMode(enabled) {
  document.documentElement.setAttribute("data-theme", enabled ? "dark" : "light");
  localStorage.setItem("nane_dark_mode", enabled ? "1" : "0");
}

function initDarkMode() {
  const saved = localStorage.getItem("nane_dark_mode");
  const enabled = saved === "1";
  if ($("darkModeToggle")) $("darkModeToggle").checked = enabled;
  applyDarkMode(enabled);
}

async function toggleDarkMode() {
  applyDarkMode($("darkModeToggle").checked);
}

async function toggleClaimEmail() {
  const enabled = $("claimEmailToggle").checked;
  try {
    await api("/me/notifications", {
      method: "PUT",
      body: JSON.stringify({ claimEmailEnabled: enabled })
    });
  } catch (error) {
    $("claimEmailToggle").checked = !enabled;
  }
}

async function loadNotificationPrefs() {
  if (!isVerifiedUser()) return;
  try {
    const data = await api("/me/notifications");
    if ($("claimEmailToggle")) $("claimEmailToggle").checked = data.claimEmailEnabled !== false;
  } catch (error) {
    // defaults remain
  }
}

function syncPublishView() {
  const form = $("publishForm");
  const guestCard = $("publishGuestCard");
  if (!form || !guestCard) return;
  if (isVerifiedUser() && profileComplete()) {
    form.hidden = false;
    guestCard.hidden = true;
  } else {
    form.hidden = true;
    guestCard.hidden = false;
  }
}

function syncSettingsAccount() {
  const loginCard = $("mineLoginCard");
  const loggedInContent = $("mineLoggedInContent");
  if (!loginCard || !loggedInContent) return;
  if (isVerifiedUser()) {
    loginCard.hidden = true;
    loggedInContent.hidden = false;
  } else {
    loginCard.hidden = false;
    loggedInContent.hidden = true;
    syncAgreementUI();
  }
}

function logout() {
  clearSession();
  switchLoginMode("code");
  $("authMessage").textContent = "已登出";
  syncSettingsAccount();
  syncPublishView();
  loadProfile();
  loadMyItems();
}

async function loadSettings() {
  syncSettingsAccount();
  await loadNotificationPrefs();
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(item => item.classList.toggle("active", item === tab));
      document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === `view-${tab.dataset.view}`));
      if (tab.dataset.view === "publish") {
        const successCard = $("publishSuccessCard");
        if (successCard) successCard.hidden = true;
        syncPublishView();
      }
      if (tab.dataset.view === "mine") {
        loadProfile();
        loadMyItems();
      }
    });
  });

  $("refreshButton").addEventListener("click", () => Promise.all([loadHome(), loadProfile()]));
  $("searchButton").addEventListener("click", loadHome);
  let searchDebounce;
  $("keywordInput").addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(loadHome, 300);
  });
  $("keywordInput").addEventListener("keydown", event => {
    if (event.key === "Enter") {
      clearTimeout(searchDebounce);
      loadHome();
    }
  });
  $("filterChips").addEventListener("click", event => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    const isAll = chip.dataset.type === "" && chip.dataset.category === "";
    // Toggle this chip
    chip.classList.toggle("active");
    if (isAll && chip.classList.contains("active")) {
      // "全部" activated: deactivate all others
      document.querySelectorAll(".chip").forEach(c => {
        if (c !== chip) c.classList.remove("active");
      });
    } else if (!isAll) {
      // Specific chip toggled: deactivate "全部"
      const allChip = document.querySelector('.chip[data-type=""][data-category=""]');
      if (allChip) allChip.classList.remove("active");
    }
    // If nothing active, activate "全部"
    if (!document.querySelector(".chip.active")) {
      const allChip = document.querySelector('.chip[data-type=""][data-category=""]');
      if (allChip) allChip.classList.add("active");
    }
    loadHome();
  });
  $("itemList").addEventListener("click", event => {
    const card = event.target.closest(".item-card");
    if (card) openDetail(card.dataset.id);
  });
  $("myItemList").addEventListener("click", async event => {
    const claimButton = event.target.closest("[data-claim-action]");
    if (claimButton) {
      event.stopPropagation();
      reviewClaimFromButton(claimButton);
      return;
    }
    const ownerButton = event.target.closest("[data-owner-action]");
    if (ownerButton) {
      event.stopPropagation();
      const itemId = ownerButton.dataset.itemId;
      if (ownerButton.dataset.ownerAction === "edit") {
        await openMyItemDetail(itemId);
        startEditItem();
      } else if (ownerButton.dataset.ownerAction === "delete") {
        handleListDelete(itemId, ownerButton);
      }
      return;
    }
    const card = event.target.closest(".item-card");
    if (card) openMyItemDetail(card.dataset.id);
  });
  $("closeDetailButton").addEventListener("click", () => $("detailDialog").close());
  $("detailDialog").addEventListener("click", event => {
    if (event.target.id === "contactButton") viewContact();
    if (event.target.id === "claimButton") requestClaim();
    if (event.target.id === "editItemButton") startEditItem();
    if (event.target.id === "takeDownButton") takeDownMyItem();
    const claimBtn = event.target.closest("[data-claim-action]");
    if (claimBtn) {
      event.stopPropagation();
      reviewClaimFromButton(claimBtn);
    }
  });
  document.querySelectorAll(".segment").forEach(button => {
    button.addEventListener("click", () => setPublishType(button.dataset.itemType));
  });
  $("iconGrid").addEventListener("click", event => {
    const toggle = event.target.closest("[data-toggle-icons]");
    if (toggle) {
      state.iconOtherOpen = !state.iconOtherOpen;
      renderIconGrid();
      return;
    }
    const button = event.target.closest(".icon-option");
    if (!button) return;
    state.selectedIcon = button.dataset.icon;
    renderIconGrid();
  });
  $("campusSelect").addEventListener("change", event => {
    state.publishCampusIndex = Math.max(0, state.locations.findIndex(campus => campus.name === event.target.value));
    state.publishBuildingIndex = 0;
    renderLocationSelects("publish");
  });
  $("buildingSelect").addEventListener("change", event => {
    const buildings = currentCampus("publish")?.buildings || [];
    state.publishBuildingIndex = Math.max(0, buildings.findIndex(building => building.name === event.target.value));
    renderLocationSelects("publish");
  });
  $("profileCampusSelect").addEventListener("change", event => {
    state.profileCampusIndex = Math.max(0, state.locations.findIndex(campus => campus.name === event.target.value));
    state.profileBuildingIndex = 0;
    renderLocationSelects("profile");
  });
  $("profileBuildingSelect").addEventListener("change", event => {
    const buildings = currentCampus("profile")?.buildings || [];
    state.profileBuildingIndex = Math.max(0, buildings.findIndex(building => building.name === event.target.value));
    renderLocationSelects("profile");
  });
  $("useProfileLocationInput").addEventListener("change", event => {
    $("publishLocationFields").hidden = event.target.checked;
  });
  $("noExpiryInput").addEventListener("change", toggleNoExpiry);
  $("publishForm").addEventListener("submit", submitPublish);
  $("titleInput").addEventListener("input", () => { updateCharCounts(); clearFieldErrors(); });
  $("descriptionInput").addEventListener("input", updateCharCounts);
  $("quantityInput").addEventListener("input", clearFieldErrors);
  $("wechatInput").addEventListener("input", clearFieldErrors);
  $("qqInput").addEventListener("input", clearFieldErrors);
  $("disclaimerInput").addEventListener("change", clearFieldErrors);
  $("sendEmailCodeButton").addEventListener("click", sendEmailCode);
  $("verifyEmailCodeButton").addEventListener("click", verifyEmailCode);
  $("passwordLoginButton").addEventListener("click", passwordLogin);
  $("passwordInput").addEventListener("keydown", event => {
    if (event.key === "Enter") passwordLogin();
  });
  $("sendCodeButton").addEventListener("click", sendCode);
  $("verifyCodeButton").addEventListener("click", verifyCode);
  $("saveProfileButton").addEventListener("click", saveProfile);
  $("loadMineButton").addEventListener("click", loadMyItems);
  $("openAgreementButton").addEventListener("click", () => {
    document.querySelector("#agreementDialog h3").textContent = "NanE 南易用户协议";
    loadAgreement();
    $("agreementDialog").showModal();
  });
  $("closeAgreementButton").addEventListener("click", () => $("agreementDialog").close());
  $("closeClaimsModalButton").addEventListener("click", () => $("claimsModal").close());
  $("claimsModal").addEventListener("click", event => {
    const claimBtn = event.target.closest("[data-claim-action]");
    if (claimBtn) {
      event.stopPropagation();
      const row = claimBtn.closest(".claim-modal-row");
      reviewClaimFromButton(claimBtn).then(() => {
        row?.remove();
        refreshClaimsModal();
      });
    }
  });
  document.querySelector(".profile-card").addEventListener("click", () => {
    if (!isVerifiedUser()) {
      const loginCard = $("mineLoginCard");
      if (loginCard) loginCard.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // Activate settings sub-tab in mine view
    const settingsSubtab = document.querySelector('.mine-subtab[data-mine-view="settings"]');
    if (settingsSubtab) settingsSubtab.click();
    setTimeout(() => {
      const formCard = $("profileFormCard");
      if (formCard) {
        formCard.hidden = false;
        formCard.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => $("nicknameInput").focus(), 400);
      }
    }, 300);
  });
  document.querySelectorAll(".login-tab").forEach(tab => {
    tab.addEventListener("click", () => switchLoginMode(tab.dataset.loginMode));
  });
  $("forgotPasswordButton").addEventListener("click", () => switchLoginMode("forgot"));
  $("backFromForgotButton").addEventListener("click", () => switchLoginMode("password"));
  $("sendResetCodeButton").addEventListener("click", sendResetCode);
  $("resetPasswordButton").addEventListener("click", resetPassword);
  $("resetPasswordInput").addEventListener("keydown", event => {
    if (event.key === "Enter") resetPassword();
  });
  $("setPasswordButton").addEventListener("click", setNewPassword);
  $("setPasswordInput").addEventListener("keydown", event => {
    if (event.key === "Enter") setNewPassword();
  });
  $("skipSetPasswordButton").addEventListener("click", () => {
    $("setPasswordPrompt").hidden = true;
    switchLoginMode("code");
  });
  $("darkModeToggle").addEventListener("change", toggleDarkMode);
  $("claimEmailToggle").addEventListener("change", toggleClaimEmail);
  $("settingsEditProfileButton").addEventListener("click", () => {
    $("profileFormCard").hidden = false;
    $("profileFormCard").scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => $("nicknameInput").focus(), 400);
  });
  $("settingsChangePasswordButton").addEventListener("click", () => {
    $("changePasswordForm").hidden = false;
    $("settingsChangePasswordButton").hidden = true;
  });
  $("cancelChangePasswordButton").addEventListener("click", () => {
    $("changePasswordForm").hidden = true;
    $("settingsChangePasswordButton").hidden = false;
    $("changePasswordMessage").textContent = "";
  });
  $("changePasswordButton").addEventListener("click", changePassword);

  // Mine sub-tab toggle
  document.querySelectorAll(".mine-subtab").forEach(subtab => {
    subtab.addEventListener("click", () => {
      document.querySelectorAll(".mine-subtab").forEach(s => s.classList.toggle("active", s === subtab));
      const view = subtab.dataset.mineView;
      if (view === "items") {
        $("mineItemsPanel").hidden = false;
        $("mineSettingsPanel").hidden = true;
      } else if (view === "settings") {
        $("mineItemsPanel").hidden = true;
        $("mineSettingsPanel").hidden = false;
        loadProfile();
        loadSettings();
      }
    });
  });

  $("settingsLogoutButton").addEventListener("click", () => {
    if (confirm("确定要登出吗？")) logout();
  });
  // Post-publish confirmation buttons
  const viewMyBtn = $("viewMyPublishBtn");
  const continueBtn = $("continuePublishBtn");
  if (viewMyBtn) {
    viewMyBtn.addEventListener("click", () => {
      const successCard = $("publishSuccessCard");
      const form = $("publishForm");
      if (successCard) successCard.hidden = true;
      if (form) form.hidden = false;
      // Reset form for next use
      $("publishForm").reset();
      $("quantityInput").value = "1";
      $("unitInput").value = "件";
      setExpireDate("2026-12-31");
      setDateRowDisabled(false);
      $("noExpiryInput").checked = false;
      $("useProfileLocationInput").checked = true;
      $("publishLocationFields").hidden = true;
      $("disclaimerInput").checked = false;
      setPublishType(state.selectedPublishType);
      renderLocationSelects("publish");
      const mineTab = document.querySelector('.tab[data-view="mine"]');
      if (mineTab) mineTab.click();
      setTimeout(() => {
        const itemsPanel = $("mineItemsPanel");
        if (itemsPanel) itemsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    });
  }
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      const successCard = $("publishSuccessCard");
      const form = $("publishForm");
      if (successCard) successCard.hidden = true;
      if (form) {
        form.hidden = false;
        form.reset();
        $("quantityInput").value = "1";
        $("unitInput").value = "件";
        setExpireDate("2026-12-31");
        setDateRowDisabled(false);
        $("noExpiryInput").checked = false;
        $("useProfileLocationInput").checked = true;
        $("publishLocationFields").hidden = true;
        $("disclaimerInput").checked = false;
        setPublishType(state.selectedPublishType);
        renderLocationSelects("publish");
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  // Publish interstitial CTA buttons
  const goToLoginBtn = $("goToLoginFromPublish");
  const goToHomeBtn = $("goToHomeFromPublish");
  if (goToLoginBtn) {
    goToLoginBtn.addEventListener("click", () => {
      const mineTab = document.querySelector('.tab[data-view="mine"]');
      if (mineTab) mineTab.click();
      setTimeout(() => {
        const loginCard = $("mineLoginCard");
        if (loginCard) loginCard.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    });
  }
  if (goToHomeBtn) {
    goToHomeBtn.addEventListener("click", () => {
      const homeTab = document.querySelector('.tab[data-view="home"]');
      if (homeTab) homeTab.click();
    });
  }
  $("settingsAgreementButton").addEventListener("click", () => {
    document.querySelector("#agreementDialog h3").textContent = "NanE 南易用户协议";
    loadAgreement();
    $("agreementDialog").showModal();
  });
  $("settingsPrivacyButton").addEventListener("click", async () => {
    try {
      const data = await api("/legal/privacy");
      $("agreementBody").innerHTML = markdownToHtml(data.markdown || "隐私保护指引暂不可用。");
      document.querySelector("#agreementDialog h3").textContent = "NanE 隐私保护指引";
      $("agreementDialog").showModal();
    } catch (error) {
      showToast("隐私保护指引加载失败", "error");
    }
  });
}

function parseUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view") || "";
  const focus = params.get("focus") || "";
  return { view, focus };
}

async function applyUrlParams() {
  const { view, focus } = parseUrlParams();
  if (view === "mine") {
    const mineTab = document.querySelector('.tab[data-view="mine"]');
    if (mineTab) mineTab.click();
    if (focus === "claims") {
      await new Promise(resolve => setTimeout(resolve, 300));
      const banner = $("pendingClaimsBanner");
      if (banner && !banner.hidden) {
        banner.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }
}

async function init() {
  initDarkMode();
  initDateControls();
  bindEvents();
  await Promise.all([loadAgreement(), loadLocations()]);
  renderIconGrid();
  setPublishType("consumable");
  await Promise.all([loadHome(), loadProfile()]);
  syncPublishView();
  await applyUrlParams();
}

init();
