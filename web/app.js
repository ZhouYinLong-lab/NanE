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
  agreementVersion: AGREEMENT_VERSION_FALLBACK
};

function $(id) {
  return document.getElementById(id);
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
  return {
    agreementAccepted: Boolean($("agreementInput")?.checked),
    agreementVersion: state.agreementVersion || AGREEMENT_VERSION_FALLBACK
  };
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

function requireVerified(message) {
  if (isVerifiedUser() && profileComplete()) {
    return true;
  }
  const text = message || (isVerifiedUser() ? "请先补全昵称、校区和楼栋" : "请先在“我的”页登录并同意用户协议");
  const activeMineTab = document.querySelector('.tab[data-view="mine"]');
  if (activeMineTab) {
    activeMineTab.click();
  }
  $("authMessage").textContent = text;
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
  card.hidden = !isVerifiedUser();
  if (!isVerifiedUser()) {
    return;
  }
  $("nicknameInput").value = state.user?.name || "";
  setSelectionByLocation("profile", state.user?.campus || "仙林校区", state.user?.building || "南苑 A 栋", state.user?.room || "");
  $("profileMessage").textContent = profileComplete() ? "" : "请补全账号资料后再发布或查看联系方式";
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
    return `<span class="badge warning">已过期</span>`;
  }
  if (days <= 15) {
    return `<span class="badge warning">还有 ${days} 天到期</span>`;
  }
  return "";
}

function expiryText(item) {
  if (item.noExpiry) {
    return "长期有效";
  }
  return item.expireDate || "未填写";
}

function renderItem(item, options = {}) {
  const badges = [
    `<span class="badge purple">${escapeHtml(item.itemTypeText || "耗材")}</span>`,
    `<span class="badge">${escapeHtml(item.category || "应急耗材")}</span>`
  ];
  if (options.showStatus && item.status && item.status !== "online") {
    badges.push(`<span class="badge">${escapeHtml(statusText(item.status))}</span>`);
  }
  const expiry = expiryBadge(item);
  if (expiry) badges.push(expiry);
  return `
    <article class="item-card" data-id="${escapeHtml(item.id)}">
      <div class="item-icon">${iconGlyph(item.itemIcon, item.itemType)}</div>
      <div class="item-main">
        <div class="item-title-row">
          <h3>${escapeHtml(item.title)}</h3>
          <div class="item-location">${escapeHtml(item.campus)} · ${escapeHtml(item.building)}${options.showRoom && item.room ? ` · ${escapeHtml(item.room)}` : ""}</div>
        </div>
        <p class="item-desc">${escapeHtml(item.description || "发布者暂未填写补充说明。")}</p>
        <div class="badges">${badges.join("")}</div>
        ${item.rejectReason ? `<p class="item-desc">驳回原因：${escapeHtml(item.rejectReason)}</p>` : ""}
      </div>
    </article>
  `;
}

async function loadHome() {
  $("homeState").textContent = "正在加载...";
  $("itemList").innerHTML = "";
  try {
    const keyword = $("keywordInput").value.trim();
    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    if (state.itemType) params.set("itemType", state.itemType);
    const data = await api(`/items${params.toString() ? `?${params}` : ""}`);
    $("viewerLabel").textContent = `${data.viewer?.campus || "当前校区"} · ${data.viewer?.building || "当前楼栋"} · 优先展示近邻`;
    $("homeState").textContent = data.items.length ? "" : "暂无上架物品";
    $("itemList").innerHTML = data.items.map(item => renderItem(item)).join("");
  } catch (error) {
    $("homeState").textContent = error.message || "无法连接 NanE API";
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
      $("dailyLimit").textContent = data.contactLimit?.daily ?? 5;
      $("remainingLimit").textContent = data.contactLimit?.remaining ?? 0;
    } else {
      clearSession();
      $("profileName").textContent = "游客模式";
      $("profileCampus").textContent = "可浏览物品，登录后可发布和查看联系方式";
      $("verifyBadge").textContent = "未登录";
      $("dailyLimit").textContent = 5;
      $("remainingLimit").textContent = 0;
    }
    syncProfileForm();
    $("apiStatus").textContent = "已连接";
  } catch (error) {
    $("apiStatus").textContent = "未连接";
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

function toggleNoExpiry() {
  const checked = $("noExpiryInput").checked;
  $("expireInput").disabled = checked;
  $("expireInput").required = !checked;
}

async function loadMyItems() {
  const container = $("myItemList");
  if (!isVerifiedUser()) {
    container.innerHTML = `<div class="state-card">请先登录并同意用户协议，再查看自己的发布。</div>`;
    return;
  }
  container.innerHTML = `<div class="state-card">正在加载...</div>`;
  try {
    const data = await api("/me/items");
    container.innerHTML = data.items.length
      ? data.items.map(item => renderItem(item, { showRoom: true, showStatus: true })).join("")
      : `<div class="state-card">暂无发布记录</div>`;
  } catch (error) {
    container.innerHTML = `<div class="state-card">${escapeHtml(error.message || "加载失败")}</div>`;
  }
}

async function openDetail(id) {
  try {
    const data = await api(`/items/${encodeURIComponent(id)}`);
    state.selectedDetail = data.item;
    $("detailTitle").textContent = data.item.title;
    $("detailBody").innerHTML = `
      <div class="item-icon">${iconGlyph(data.item.itemIcon, data.item.itemType)}</div>
      <p class="detail-meta">${escapeHtml(data.item.campus)} · ${escapeHtml(data.item.building)}<br>
      ${escapeHtml(data.item.itemTypeText)} · ${escapeHtml(data.item.category)} · 剩余 ${escapeHtml(data.item.quantity)}${escapeHtml(data.item.unit)}<br>
      有效期：${escapeHtml(expiryText(data.item))} · ${escapeHtml(data.item.distanceLabel || "")}</p>
      <p class="item-desc">${escapeHtml(data.item.description || "发布者暂未填写补充说明。")}</p>
      <div class="notice-line">免费互助信息撮合；禁止处方药、管控药和收费交易。领取前请自行确认包装、有效期和适用风险。</div>
      <button class="primary wide" id="contactButton">${isVerifiedUser() && profileComplete() ? "查看联系方式" : "登录并补全资料后查看微信 / QQ"}</button>
      <div id="contactResult"></div>
    `;
    $("detailDialog").showModal();
  } catch (error) {
    alert(error.message || "详情加载失败");
  }
}

async function viewContact() {
  if (!state.selectedDetail) return;
  if (!requireVerified("请先登录并同意用户协议，再查看微信或 QQ 联系方式。")) {
    $("detailDialog").close();
    return;
  }
  try {
    const data = await api(`/items/${encodeURIComponent(state.selectedDetail.id)}/contact`, { method: "POST" });
    $("contactResult").innerHTML = `
      <div class="contact-box">
        微信：${escapeHtml(data.contact?.wechat || "未填写")}<br>
        QQ：${escapeHtml(data.contact?.qq || "未填写")}<br>
        今日剩余查看次数：${escapeHtml(data.remaining)}
      </div>
    `;
    loadProfile();
  } catch (error) {
    $("contactResult").innerHTML = `<div class="contact-box">${escapeHtml(error.message || "查看失败")}</div>`;
  }
}

function renderIconGrid() {
  const commonKeys = state.selectedPublishType === "medicine"
    ? ["capsules", "pills", "tablets", "prescriptionBottleMedical"]
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
  state.selectedIcon = itemType === "medicine" ? "capsules" : "plus";
  state.iconOtherOpen = false;
  $("medicineCategoryWrap").hidden = itemType !== "medicine";
  $("typeHint").textContent = itemType === "medicine"
    ? "药品只允许非处方常见药品笼统分类；禁止处方药、管控药、拆封不明药品和收费转让。"
    : "耗材无需选择细分类，适用于创可贴、碘伏棉签、防护用品等低风险应急物品。";
  $("titleInput").placeholder = itemType === "medicine" ? "例如：未拆封感冒药一盒" : "例如：碘伏棉签 10 支";
  $("noExpiryWrap").hidden = itemType === "medicine";
  if (itemType === "medicine") {
    $("noExpiryInput").checked = false;
    $("expireInput").disabled = false;
    $("expireInput").required = true;
  }
  document.querySelectorAll(".segment").forEach(button => {
    button.classList.toggle("active", button.dataset.itemType === itemType);
  });
  renderIconGrid();
}

async function submitPublish(event) {
  event.preventDefault();
  const message = $("publishMessage");
  if (!isVerifiedUser()) {
    message.textContent = "请先在“我的”页登录并同意用户协议，再发布互助。";
    requireVerified(message.textContent);
    return;
  }
  if (!profileComplete()) {
    message.textContent = "请先在“我的”页补全昵称、校区和楼栋";
    requireVerified(message.textContent);
    return;
  }
  const contactWechat = $("wechatInput").value.trim();
  const contactQq = $("qqInput").value.trim();
  if (!contactWechat && !contactQq) {
    message.textContent = "微信或 QQ 至少填写一项";
    return;
  }
  if (!$("disclaimerInput").checked) {
    message.textContent = "请先确认发布声明";
    return;
  }
  const useProfileLocation = $("useProfileLocationInput").checked;
  const campus = useProfileLocation ? state.user.campus : $("campusSelect").value.trim();
  const building = useProfileLocation ? state.user.building : $("buildingSelect").value.trim();
  const room = useProfileLocation ? state.user.room || "" : $("roomSelect").value.trim();
  const payload = {
    title: $("titleInput").value.trim(),
    itemType: state.selectedPublishType,
    itemIcon: state.selectedIcon,
    category: state.selectedPublishType === "medicine" ? $("categorySelect").value : "应急耗材",
    quantity: Number($("quantityInput").value),
    unit: $("unitInput").value.trim(),
    campus,
    building,
    room,
    expireDate: $("noExpiryInput").checked ? "" : $("expireInput").value,
    noExpiry: state.selectedPublishType === "consumable" && $("noExpiryInput").checked,
    description: $("descriptionInput").value.trim(),
    contactWechat,
    contactQq,
    disclaimerAccepted: true
  };
  try {
    message.textContent = "正在提交...";
    const data = await api("/items", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    message.textContent = data.message || "已提交审核";
    event.target.reset();
    $("quantityInput").value = "1";
    $("unitInput").value = "件";
    $("expireInput").value = "2026-12-31";
    $("expireInput").disabled = false;
    $("expireInput").required = true;
    $("noExpiryInput").checked = false;
    setPublishType(state.selectedPublishType);
    $("useProfileLocationInput").checked = true;
    $("publishLocationFields").hidden = true;
    renderLocationSelects("publish");
    loadMyItems();
  } catch (error) {
    message.textContent = error.message || "提交失败";
  }
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
    message.textContent = error.message || "发送失败";
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
  } catch (error) {
    message.textContent = error.message || "验证失败";
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
    message.textContent = error.message || "验证码发送失败";
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
    await Promise.all([loadProfile(), loadHome(), loadMyItems()]);
  } catch (error) {
    message.textContent = error.message || "验证码验证失败";
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
    await Promise.all([loadProfile(), loadHome()]);
  } catch (error) {
    message.textContent = error.message || "保存失败";
  }
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(item => item.classList.toggle("active", item === tab));
      document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === `view-${tab.dataset.view}`));
      if (tab.dataset.view === "mine") {
        loadProfile();
        loadMyItems();
      }
    });
  });

  $("refreshButton").addEventListener("click", () => Promise.all([loadHome(), loadProfile()]));
  $("searchButton").addEventListener("click", loadHome);
  $("keywordInput").addEventListener("keydown", event => {
    if (event.key === "Enter") loadHome();
  });
  $("filterChips").addEventListener("click", event => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    state.itemType = chip.dataset.type || "";
    document.querySelectorAll(".chip").forEach(item => item.classList.toggle("active", item === chip));
    loadHome();
  });
  $("itemList").addEventListener("click", event => {
    const card = event.target.closest(".item-card");
    if (card) openDetail(card.dataset.id);
  });
  $("myItemList").addEventListener("click", event => {
    const card = event.target.closest(".item-card");
    if (card) openDetail(card.dataset.id);
  });
  $("closeDetailButton").addEventListener("click", () => $("detailDialog").close());
  $("detailDialog").addEventListener("click", event => {
    if (event.target.id === "contactButton") viewContact();
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
  $("sendEmailCodeButton").addEventListener("click", sendEmailCode);
  $("verifyEmailCodeButton").addEventListener("click", verifyEmailCode);
  $("sendCodeButton").addEventListener("click", sendCode);
  $("verifyCodeButton").addEventListener("click", verifyCode);
  $("saveProfileButton").addEventListener("click", saveProfile);
  $("loadMineButton").addEventListener("click", loadMyItems);
  $("openAgreementButton").addEventListener("click", () => $("agreementDialog").showModal());
  $("closeAgreementButton").addEventListener("click", () => $("agreementDialog").close());
}

async function init() {
  bindEvents();
  await Promise.all([loadAgreement(), loadLocations()]);
  renderIconGrid();
  setPublishType("consumable");
  await Promise.all([loadHome(), loadProfile()]);
}

init();
