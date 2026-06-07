const API_BASE = "/api";
const TOKEN_KEY = "nane_web_token";
const USER_KEY = "nane_web_user";

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
  selectedDetail: null,
  challengeId: ""
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
  return state.token || "demo-token";
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "请求失败");
  }
  return data;
}

function saveSession(tokenValue, user) {
  state.token = tokenValue || "";
  state.user = user || null;
  if (tokenValue) {
    localStorage.setItem(TOKEN_KEY, tokenValue);
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
  }
}

async function ensureDemoLogin() {
  if (state.token) return;
  const data = await api("/auth/wx-login", {
    method: "POST",
    body: JSON.stringify({ code: "web-demo" })
  });
  saveSession(data.token, data.user);
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

function renderItem(item, options = {}) {
  const badges = [
    `<span class="badge purple">${escapeHtml(item.itemTypeText || "耗材")}</span>`,
    `<span class="badge">${escapeHtml(item.category || "应急耗材")}</span>`,
    `<span class="badge">数量：${escapeHtml(item.quantity)}${escapeHtml(item.unit)}</span>`
  ];
  if (item.distanceLabel) badges.push(`<span class="badge">${escapeHtml(item.distanceLabel)}</span>`);
  if (item.status) badges.push(`<span class="badge">${escapeHtml(statusText(item.status))}</span>`);
  if (item.expireDate) badges.push(`<span class="badge">${escapeHtml(item.expireDate)} 到期</span>`);
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
    localStorage.setItem(USER_KEY, JSON.stringify(data.user || {}));
    $("profileName").textContent = data.user?.name || "Demo 用户";
    $("profileCampus").textContent = `${data.user?.campus || "仙林校区"} · ${data.user?.building || "南苑 A 栋"}`;
    $("verifyBadge").textContent = data.user?.is_verified ? "小助手校园身份已认证" : "校园身份认证 Demo";
    $("dailyLimit").textContent = data.contactLimit?.daily ?? 5;
    $("remainingLimit").textContent = data.contactLimit?.remaining ?? 5;
    $("apiStatus").textContent = "已连接";
  } catch (error) {
    $("apiStatus").textContent = "未连接";
  }
}

async function loadMyItems() {
  const container = $("myItemList");
  container.innerHTML = `<div class="state-card">正在加载...</div>`;
  try {
    const data = await api("/me/items");
    container.innerHTML = data.items.length
      ? data.items.map(item => renderItem(item, { showRoom: true })).join("")
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
      有效期：${escapeHtml(data.item.expireDate)} · ${escapeHtml(data.item.distanceLabel || "")}</p>
      <p class="item-desc">${escapeHtml(data.item.description || "发布者暂未填写补充说明。")}</p>
      <div class="notice-line">免费互助信息撮合；禁止处方药、管控药和收费交易。领取前请自行确认包装、有效期和适用风险。</div>
      <button class="primary wide" id="contactButton">查看联系方式</button>
      <div id="contactResult"></div>
    `;
    $("detailDialog").showModal();
  } catch (error) {
    alert(error.message || "详情加载失败");
  }
}

async function viewContact() {
  if (!state.selectedDetail) return;
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
  $("iconGrid").innerHTML = iconOptions.map(([key, label]) => `
    <button type="button" class="icon-option ${key === state.selectedIcon ? "active" : ""}" data-icon="${key}">
      <strong>${iconGlyph(key, state.selectedPublishType)}</strong>
      <span>${escapeHtml(label)}</span>
    </button>
  `).join("");
}

function setPublishType(itemType) {
  state.selectedPublishType = itemType;
  state.selectedIcon = itemType === "medicine" ? "capsules" : "plus";
  $("medicineCategoryWrap").hidden = itemType !== "medicine";
  $("typeHint").textContent = itemType === "medicine"
    ? "药品只允许非处方常见药品笼统分类；禁止处方药、管控药、拆封不明药品和收费转让。"
    : "耗材无需选择细分类，适用于创可贴、碘伏棉签、防护用品等低风险应急物品。";
  $("titleInput").placeholder = itemType === "medicine" ? "例如：未拆封感冒药一盒" : "例如：碘伏棉签 10 支";
  document.querySelectorAll(".segment").forEach(button => {
    button.classList.toggle("active", button.dataset.itemType === itemType);
  });
  renderIconGrid();
}

async function submitPublish(event) {
  event.preventDefault();
  const message = $("publishMessage");
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
  const payload = {
    title: $("titleInput").value.trim(),
    itemType: state.selectedPublishType,
    itemIcon: state.selectedIcon,
    category: state.selectedPublishType === "medicine" ? $("categorySelect").value : "应急耗材",
    quantity: Number($("quantityInput").value),
    unit: $("unitInput").value.trim(),
    campus: $("campusInput").value.trim(),
    building: $("buildingInput").value.trim(),
    room: $("roomInput").value.trim(),
    expireDate: $("expireInput").value,
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
    $("campusInput").value = payload.campus || "仙林校区";
    $("buildingInput").value = payload.building || "南苑 A 栋";
    $("expireInput").value = "2026-12-31";
    setPublishType(state.selectedPublishType);
    loadMyItems();
  } catch (error) {
    message.textContent = error.message || "提交失败";
  }
}

async function sendCode() {
  const message = $("authMessage");
  const email = $("authEmail").value.trim();
  const studentId = $("authStudentId").value.trim();
  if (!email && !studentId) {
    message.textContent = "请填写邮箱或学号";
    return;
  }
  try {
    message.textContent = "正在向小助手发送验证码...";
    const data = await api("/auth/nanna/challenge", {
      method: "POST",
      body: JSON.stringify({ email, studentId })
    });
    state.challengeId = data.challengeId || "";
    message.textContent = data.message || `验证码已发送至 ${data.maskedTarget || "小助手"}`;
  } catch (error) {
    message.textContent = error.message || "发送失败";
  }
}

async function verifyCode() {
  const message = $("authMessage");
  const email = $("authEmail").value.trim();
  const studentId = $("authStudentId").value.trim();
  const code = $("authCode").value.trim();
  if (!code) {
    message.textContent = "请填写验证码";
    return;
  }
  try {
    message.textContent = "正在验证...";
    const data = await api("/auth/nanna/verify", {
      method: "POST",
      body: JSON.stringify({ email, studentId, code, challengeId: state.challengeId })
    });
    saveSession(data.token, data.user);
    message.textContent = "校园身份验证成功";
    await Promise.all([loadProfile(), loadHome(), loadMyItems()]);
  } catch (error) {
    message.textContent = error.message || "验证失败";
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
    const button = event.target.closest(".icon-option");
    if (!button) return;
    state.selectedIcon = button.dataset.icon;
    renderIconGrid();
  });
  $("publishForm").addEventListener("submit", submitPublish);
  $("sendCodeButton").addEventListener("click", sendCode);
  $("verifyCodeButton").addEventListener("click", verifyCode);
  $("loadMineButton").addEventListener("click", loadMyItems);
}

async function init() {
  bindEvents();
  renderIconGrid();
  setPublishType("consumable");
  try {
    await ensureDemoLogin();
  } catch (error) {
    // The rest of the app can still show API errors in-place.
  }
  await Promise.all([loadHome(), loadProfile()]);
}

init();
