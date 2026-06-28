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

const REVIEW_TAGS = ["沟通顺畅", "按约交接", "物品真实", "及时确认", "友善可信"];
const ISSUE_REVIEW_TAGS = ["物品不符", "未按约时间", "联系方式无效", "沟通不顺", "未完成交接"];

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
  pendingAction: null,
  homeOffset: 0,
  homeHasMore: false,
  pendingReviews: [],
  activeReviewClaimId: "",
  uploadedImageUrls: [],
  imageUploading: false
};

const HOME_PAGE_SIZE = 20;

// Components that animate in on scroll via IntersectionObserver.
// Convention: every visible card/section/row gets a motion-ready class.
// When adding a new component, include its CSS class here.
// TODO: migrate to [data-motion] attribute for self-registration.
const MOTION_CLASSES = new Set([
  "welcome-banner", "search-row", "chips", "section-head",
  "state-card", "form-card", "rules-card", "motion-section",
  "profile-card", "claim-banner", "review-banner", "settings-row",
  "item-card", "claim-banner-row", "review-banner-row", "claim-modal-row",
  "review-target", "review-tags", "review-tag",
  "trust-card", "profile-trust-card",
  "detail-gallery", "detail-meta",
  "contact-field", "contact-box", "notice-line",
  "image-preview", "image-upload-progress", "image-empty",
  "icon-option", "empty-state"
]);

let motionObserver = null;

function $(id) {
  return document.getElementById(id);
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function ensureMotionObserver() {
  if (motionObserver || prefersReducedMotion()) {
    return motionObserver;
  }
  motionObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("motion-visible");
      motionObserver.unobserve(entry.target);
    }
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  return motionObserver;
}

function setMotionIndexes(root = document) {
  const groups = [
    [".item-list", ".item-card, .skeleton-card"],
    [".chips", ".chip, .chip-select"],
    [".review-tags", ".review-tag"],
    ["#pendingClaimsList", ".claim-banner-row"],
    ["#pendingReviewsList", ".review-banner-row"],
    ["#claimsModalBody", ".claim-modal-row"],
    [".claim-panel", ".claim-row"],
    ["#iconGrid", ".icon-option"],
    ["#imagePreviewList", ".image-preview, .image-upload-progress, .image-empty"],
    ["#contactResult", ".contact-box, .claim-button"],
    ["#claimResult", ".contact-box"],
    ["#detailBody", ".detail-gallery, .detail-meta, .item-desc, .trust-card, .notice-line, #contactButton, #contactResult, #shareItemButton, .contact-box, .claim-panel, .owner-actions"]
  ];
  for (const [groupSelector, childSelector] of groups) {
    root.querySelectorAll?.(groupSelector).forEach(group => {
      [...group.querySelectorAll(childSelector)].forEach((item, index) => {
        item.style.setProperty("--motion-index", String(Math.min(index, 8)));
      });
    });
  }
}

function isMotionHidden(element) {
  return element.hidden || Boolean(element.closest("[hidden]"));
}

function motionSelector() {
  return [...MOTION_CLASSES].map(c => `.${c}`).join(",");
}

function prepareMotion(root = document) {
  setMotionIndexes(root);
  const sel = motionSelector();
  const descendants = root.querySelectorAll ? [...root.querySelectorAll(sel)] : [];
  const elements = root.matches?.(sel) ? [root, ...descendants] : descendants;
  const observer = ensureMotionObserver();
  elements.forEach(element => {
    if (isMotionHidden(element) || element.dataset.motionReady === "1") return;
    element.dataset.motionReady = "1";
    element.classList.add("motion-ready");
    if (prefersReducedMotion() || !observer) {
      element.classList.add("motion-visible");
      return;
    }
    observer.observe(element);
  });
}

function refreshMotion(root = document) {
  requestAnimationFrame(() => prepareMotion(root));
}

function showMotionDialog(dialog) {
  if (!dialog) return;
  dialog.classList.remove("is-closing");
  if (!dialog.open) {
    dialog.showModal();
  }
  refreshMotion(dialog);
}

function animateCloseDialog(dialog, options = {}) {
  if (!dialog) return;
  if (prefersReducedMotion() || !dialog.open) {
    if (dialog.open) dialog.close();
    if (options.remove) dialog.remove();
    return;
  }
  dialog.classList.add("is-closing");
  dialog.addEventListener("animationend", () => {
    dialog.classList.remove("is-closing");
    dialog.close();
    if (options.remove) dialog.remove();
  }, { once: true });
}

function closeAndRemoveDialog(dialog) {
  animateCloseDialog(dialog, { remove: true });
}

function pulseElement(element, className) {
  if (!element || prefersReducedMotion()) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  element.addEventListener("animationend", () => element.classList.remove(className), { once: true });
}

function initPressFeedback() {
  document.addEventListener("pointerdown", event => {
    const target = event.target.closest("button, .item-card, .link-button");
    if (!target || target.disabled) return;
    target.classList.add("is-pressing");
    const clear = () => target.classList.remove("is-pressing");
    target.addEventListener("pointerup", clear, { once: true });
    target.addEventListener("pointercancel", clear, { once: true });
    target.addEventListener("pointerleave", clear, { once: true });
    setTimeout(clear, 260);
  });
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
  } else {
    row.hidden = false;
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
  switchView("mine");
  $("authMessage").textContent = text;
  return false;
}

function viewButtonSelector(view) {
  return `.nav-item[data-view="${view}"], .tab[data-view="${view}"]`;
}

function switchView(view) {
  const trigger = document.querySelector(viewButtonSelector(view));
  if (trigger) trigger.click();
}

function closeFilterDropdowns(except = null) {
  document.querySelectorAll("#filterChips .chip-select").forEach(select => {
    if (select === except) return;
    select.classList.remove("open");
    const dropdown = select.querySelector(".chip-dropdown");
    if (dropdown) dropdown.hidden = true;
  });
}

function setFilterSelectLabel(select, label) {
  const button = select?.querySelector(".chip-select-btn");
  if (!button) return;
  const textNode = [...button.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
  if (textNode) {
    textNode.textContent = `${label} `;
  }
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
  if (!profileComplete()) {
    card.hidden = false;
    $("profileMessage").textContent = "请补全账号资料后再发布或查看联系方式";
  } else {
    $("profileMessage").textContent = "";
  }
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

function compactDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function avatarInitial(name) {
  const text = String(name || "南").trim();
  return escapeHtml(text.slice(0, 1) || "南");
}

function trustSummaryHTML(summary, variant = "compact") {
  const completed = Number(summary?.completedCount || 0);
  const given = Number(summary?.givenCount || 0);
  const received = Number(summary?.receivedCount || 0);
  const tags = Array.isArray(summary?.topTags) ? summary.topTags.slice(0, 3) : [];
  const tagHTML = tags.map(tag => `<span class="trust-tag">${escapeHtml(tag)}</span>`).join("");
  if (variant === "card") {
    return `
      <div class="trust-card">
        <div class="trust-card-head">
          <strong>发布者可信记录</strong>
          <span>已送出 ${escapeHtml(given)} 件 · 已领取 ${escapeHtml(received)} 件</span>
        </div>
        <div class="trust-card-tags">
          ${tagHTML || `<span class="trust-muted">完成履约后会积累评价标签</span>`}
        </div>
      </div>
    `;
  }
  return `
    <div class="trust-summary">
      <span class="trust-count">已完成 ${escapeHtml(completed)} 次互助</span>
      ${tagHTML ? `<span class="trust-tags">${tagHTML}</span>` : `<span class="trust-muted">暂无评价标签</span>`}
    </div>
  `;
}

function profileTrustHTML(summary) {
  const given = Number(summary?.givenCount || 0);
  const received = Number(summary?.receivedCount || 0);
  const tags = Array.isArray(summary?.topTags) ? summary.topTags.slice(0, 3) : [];
  return `
    <div class="profile-trust-card" id="profileTrustCard">
      <div class="profile-trust-stats">
        <span><strong>${escapeHtml(given)}</strong> 次送出</span>
        <span><strong>${escapeHtml(received)}</strong> 次领取</span>
      </div>
      <div class="trust-card-tags">
        ${tags.length ? tags.map(tag => `<span class="trust-tag">${escapeHtml(tag)}</span>`).join("") : `<span class="trust-muted">完成履约评价后，这里会出现你的可信标签</span>`}
      </div>
    </div>
  `;
}

function renderProfileTrust(summary) {
  const profileCard = document.querySelector(".profile-card");
  if (!profileCard) return;
  const existing = $("profileTrustCard");
  if (!summary) {
    existing?.remove();
    return;
  }
  if (existing) {
    existing.outerHTML = profileTrustHTML(summary);
  } else {
    profileCard.insertAdjacentHTML("afterend", profileTrustHTML(summary));
  }
  refreshMotion($("profileTrustCard"));
}

function itemMediaHTML(item) {
  const image = Array.isArray(item.imageUrls) ? item.imageUrls[0] : "";
  if (image) {
    return `
      <div class="item-media">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.closest('.item-media').classList.add('image-failed'); this.remove();">
        <span class="item-type-overlay" aria-label="${escapeHtml(item.itemTypeText || "类型")}">${iconGlyph(item.itemIcon, item.itemType)}</span>
      </div>
    `;
  }
  return `<div class="item-icon">${iconGlyph(item.itemIcon, item.itemType)}</div>`;
}

function itemGalleryHTML(item) {
  const images = Array.isArray(item.imageUrls) ? item.imageUrls.slice(0, 3) : [];
  if (!images.length) {
    return `<div class="item-icon detail-icon">${iconGlyph(item.itemIcon, item.itemType)}</div>`;
  }
  return `
    <div class="detail-gallery">
      ${images.map((url, index) => `<img src="${escapeHtml(url)}" alt="${escapeHtml(item.title)} 图片 ${index + 1}" loading="lazy" onerror="this.remove();">`).join("")}
    </div>
  `;
}

function renderImagePreviews() {
  const list = $("imagePreviewList");
  if (!list) return;
  if (state.imageUploading) {
    list.innerHTML = `
      <div class="image-upload-progress">
        <span>正在处理图片...</span>
        <div class="image-progress-track"><div></div></div>
      </div>
    `;
    refreshMotion(list);
    return;
  }
  if (!state.uploadedImageUrls.length) {
    list.innerHTML = `<div class="image-empty">暂未上传图片</div>`;
    refreshMotion(list);
    return;
  }
  list.innerHTML = state.uploadedImageUrls.map((url, index) => `
    <div class="image-preview">
      <img src="${escapeHtml(url)}" alt="已上传图片 ${index + 1}">
      <button type="button" class="image-remove" data-image-index="${index}" aria-label="移除第 ${index + 1} 张图片">×</button>
    </div>
  `).join("");
  refreshMotion(list);
}

function resetUploadedImages() {
  state.uploadedImageUrls = [];
  if ($("imageInput")) $("imageInput").value = "";
  renderImagePreviews();
}

function fileToCompressedDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("请选择图片文件"));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("单张图片不能超过 8MB"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("图片解析失败"));
      image.onload = () => {
        const maxSide = 1280;
        const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadSelectedImages(files) {
  const message = $("publishMessage");
  const remaining = 3 - state.uploadedImageUrls.length;
  const selected = [...files].slice(0, remaining);
  if (!selected.length) {
    showToast("最多上传 3 张图片", "info");
    return;
  }
  state.imageUploading = true;
  renderImagePreviews();
  message.textContent = "正在上传图片...";
  try {
    for (const file of selected) {
      const dataUrl = await fileToCompressedDataUrl(file);
      const uploaded = await api("/uploads/images", {
        method: "POST",
        body: JSON.stringify({ dataUrl, filename: file.name })
      });
      state.uploadedImageUrls.push(uploaded.url);
      renderImagePreviews();
    }
    message.textContent = "";
    showToast("图片已上传", "success");
  } catch (error) {
    message.textContent = errmsg(error, "图片上传失败");
  } finally {
    state.imageUploading = false;
    $("imageInput").value = "";
    renderImagePreviews();
  }
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
  const trust = item.ownerTrustSummary || {};
  const trustTags = Array.isArray(trust.topTags) ? trust.topTags : [];
  const praiseCount = Number(trust.positiveReviewCount || 0);
  const trustBadge = praiseCount >= 1
    ? `<span class="trust-mini-badge">好评 ${escapeHtml(praiseCount)} 次</span>`
    : "";
  const created = compactDate(item.createdAt);
  return `
    <article class="item-card ${itemExpiredClass(item)}" data-id="${escapeHtml(item.id)}">
      ${itemMediaHTML(item)}
      <div class="item-main">
        <div class="item-title-row">
          <h3>${escapeHtml(item.title)}</h3>
          <div class="item-location">${escapeHtml(item.campus)} · ${escapeHtml(item.building)}${options.showRoom && item.room ? ` · ${escapeHtml(item.room)}` : ""}</div>
        </div>
        <p class="item-desc">${escapeHtml(item.description || "暂未填写补充信息")}</p>
        <div class="badges">${badges.join("")}</div>
        <div class="item-footer">
          <span class="owner-mini">
            <span class="owner-avatar">${avatarInitial(item.ownerName)}</span>
            <span>${escapeHtml(item.ownerName || "南易同学")}</span>
            ${trustBadge}
          </span>
          ${created ? `<time datetime="${escapeHtml(item.createdAt)}">${escapeHtml(created)}</time>` : ""}
        </div>
        ${item.rejectReason ? `<p class="item-desc">驳回原因：${escapeHtml(item.rejectReason)}</p>` : ""}
        ${claimPanel}
        ${ownerActions}
      </div>
    </article>
  `;
}

async function loadHome() {
  const banner = $("welcomeBanner");
  if (banner) banner.hidden = isVerifiedUser();
  $("homeState").textContent = "";
  const moreBtn = $("homeLoadMore");
  if (moreBtn) moreBtn.hidden = true;
  state.homeOffset = 0;
  state.homeHasMore = false;
  const skeletonHTML = '<div class="skeleton-card"><div class="skeleton-icon"></div><div class="skeleton-lines"><div class="skeleton-line w-60"></div><div class="skeleton-line w-80"></div><div class="skeleton-line w-40"></div></div></div>';
  $("itemList").innerHTML = skeletonHTML + skeletonHTML + skeletonHTML;
  try {
    const keyword = $("keywordInput").value.trim();
    const params = new URLSearchParams();
    params.set("limit", HOME_PAGE_SIZE);
    params.set("offset", "0");
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

    state.homeHasMore = data.hasMore;
    state.homeOffset = items.length;

    $("viewerLabel").textContent = `${data.viewer?.campus || "当前校区"} · ${data.viewer?.building || "当前楼栋"} · 优先展示近邻${data.total ? ` · 共 ${data.total} 件` : ""}`;
    if (!items.length) {
      $("homeState").innerHTML = emptyStateHTML(keyword ? "search" : "home");
    } else {
      $("homeState").textContent = "";
    }
    const list = $("itemList");
    list.innerHTML = items.map(item => renderItem(item)).join("");
    refreshMotion(list);
    list.classList.add("list-dirty");
    list.addEventListener("animationend", () => list.classList.remove("list-dirty"), { once: true });
    updateLoadMoreButton();
  } catch (error) {
    $("viewerLabel").textContent = "API 未连接";
    $("homeState").innerHTML = emptyStateHTML("error", errmsg(error, "网络连接失败"));
  }
}

async function loadMoreHome() {
  const btn = $("homeLoadMore");
  if (!btn) return;
  btn.classList.add("is-loading");
  btn.textContent = "加载中...";
  btn.disabled = true;
  try {
    const keyword = $("keywordInput").value.trim();
    const params = new URLSearchParams();
    params.set("limit", HOME_PAGE_SIZE);
    params.set("offset", state.homeOffset);
    if (keyword) params.set("keyword", keyword);
    if (DEBUG_MODE) params.set("debug", "true");

    const data = await api(`/items${params.toString() ? `?${params}` : ""}`);
    state.homeHasMore = data.hasMore;
    state.homeOffset += data.items.length;

    const list = $("itemList");
    list.insertAdjacentHTML("beforeend", data.items.map(item => renderItem(item)).join(""));
    refreshMotion(list);
    list.classList.add("list-dirty");
    list.addEventListener("animationend", () => list.classList.remove("list-dirty"), { once: true });
    updateLoadMoreButton();
  } catch (error) {
    showToast("加载失败，请稍后重试", "error");
  } finally {
    btn.classList.remove("is-loading");
    btn.disabled = false;
  }
}

function updateLoadMoreButton() {
  const btn = $("homeLoadMore");
  if (!btn) return;
  if (state.homeHasMore) {
    btn.hidden = false;
    btn.textContent = "加载更多";
  } else {
    btn.hidden = true;
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
      renderProfileTrust(data.user.trustSummary);
    } else {
      clearSession();
      $("profileName").textContent = "欢迎来访";
      $("profileCampus").textContent = "登录后即可发布物品、查看联系方式";
      $("verifyBadge").textContent = "未登录";
      renderProfileTrust(null);
    }
    syncProfileForm();
  } catch (error) {
    $("profileName").textContent = "暂时无法读取账号";
    $("profileCampus").textContent = "服务连接异常，请稍后重试";
    $("verifyBadge").textContent = "未连接";
    renderProfileTrust(null);
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
  refreshMotion(banner);
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
  refreshMotion($("claimsModalBody"));
  showMotionDialog($("claimsModal"));
}

function refreshClaimsModal() {
  const modal = $("claimsModal");
  if (!modal || !modal.open) return;
  const remaining = $("claimsModalBody").querySelectorAll(".claim-modal-row").length;
  if (remaining <= 1) {
    animateCloseDialog(modal);
    return;
  }
}

function renderPendingReviews(reviews) {
  const banner = $("pendingReviewsBanner");
  const list = $("pendingReviewsList");
  const countEl = $("pendingReviewsCount");
  if (!banner || !list || !countEl) return;
  state.pendingReviews = Array.isArray(reviews) ? reviews : [];
  if (!state.pendingReviews.length) {
    banner.hidden = true;
    list.innerHTML = "";
    return;
  }
  banner.hidden = false;
  countEl.textContent = `${state.pendingReviews.length} 条待评价`;
  list.innerHTML = state.pendingReviews.map(review => `
    <div class="review-banner-row">
      <div class="claim-banner-info">
        <strong>${escapeHtml(review.itemTitle)}</strong>
        <span>${escapeHtml(review.reviewerRole === "owner" ? "领取同学" : "发布同学")}：${escapeHtml(review.revieweeName || "同学")} · ${escapeHtml(review.quantity || 1)}${escapeHtml(review.unit || "件")}</span>
      </div>
      <span class="claim-actions">
        <button type="button" class="primary small" data-review-action="open" data-claim-id="${escapeHtml(review.claimId)}">评价履约</button>
      </span>
    </div>
  `).join("");
  refreshMotion(banner);
}

async function loadPendingReviews() {
  if (!isVerifiedUser()) {
    renderPendingReviews([]);
    return;
  }
  try {
    const data = await api("/me/reviews/pending");
    renderPendingReviews(data.reviews || []);
  } catch (error) {
    renderPendingReviews([]);
    showToast(errmsg(error, "待评价记录加载失败"), "error");
  }
}

function openReviewDialog(claimId) {
  const review = state.pendingReviews.find(item => item.claimId === claimId);
  if (!review) return;
  state.activeReviewClaimId = claimId;
  $("reviewDialogBody").innerHTML = `
    <div class="review-target">
      <strong>${escapeHtml(review.itemTitle)}</strong>
      <span>评价 ${escapeHtml(review.revieweeName || "同学")} 的本次履约</span>
    </div>
    <div class="review-tags" id="reviewTagList">
      ${REVIEW_TAGS.map(tag => `<button type="button" class="review-tag" data-review-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("")}
    </div>
    <label class="checkbox-row review-issue-toggle">
      <input id="reviewIssueInput" type="checkbox">
      <span>本次履约遇到问题</span>
    </label>
    <textarea id="reviewCommentInput" rows="3" maxlength="160" placeholder="可选：补充一句对这次互助的说明"></textarea>
    <div class="form-message" id="reviewMessage"></div>
    <button type="button" class="primary wide" id="submitReviewButton">提交评价</button>
  `;
  refreshMotion($("reviewDialogBody"));
  showMotionDialog($("reviewDialog"));
}

function renderReviewTags(isIssue) {
  const list = $("reviewTagList");
  if (!list) return;
  const tags = isIssue ? ISSUE_REVIEW_TAGS : REVIEW_TAGS;
  list.innerHTML = tags.map(tag => `<button type="button" class="review-tag" data-review-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("");
  refreshMotion(list);
  const comment = $("reviewCommentInput");
  if (comment) {
    comment.placeholder = isIssue ? "可选：说明遇到的问题，便于后续改进" : "可选：补充一句对这次互助的说明";
  }
}

async function submitReview() {
  const claimId = state.activeReviewClaimId;
  if (!claimId) return;
  const selectedTags = [...$("reviewDialogBody").querySelectorAll(".review-tag.active")]
    .map(button => button.dataset.reviewTag);
  const outcome = $("reviewIssueInput")?.checked ? "issue" : "positive";
  const message = $("reviewMessage");
  if (!selectedTags.length) {
    message.textContent = "请至少选择一个履约标签";
    return;
  }
  const submitBtn = $("submitReviewButton");
  submitBtn.disabled = true;
  submitBtn.textContent = "提交中...";
  try {
    await api(`/claims/${encodeURIComponent(claimId)}/reviews`, {
      method: "POST",
      body: JSON.stringify({
        tags: selectedTags,
        outcome,
        comment: $("reviewCommentInput").value.trim()
      })
    });
    animateCloseDialog($("reviewDialog"));
    state.activeReviewClaimId = "";
    showToast("履约评价已提交", "success");
    await Promise.all([loadPendingReviews(), loadHome(), loadMyItems()]);
  } catch (error) {
    message.textContent = errmsg(error, "提交评价失败");
    submitBtn.disabled = false;
    submitBtn.textContent = "提交评价";
  }
}

async function loadMyItems() {
  const container = $("myItemList");
  if (!isVerifiedUser()) {
    container.innerHTML = emptyStateHTML("guest");
    $("pendingClaimsBanner").hidden = true;
    $("pendingReviewsBanner").hidden = true;
    refreshMotion(container);
    return;
  }
  const skHTML = '<div class="skeleton-card"><div class="skeleton-icon"></div><div class="skeleton-lines"><div class="skeleton-line w-60"></div><div class="skeleton-line w-80"></div><div class="skeleton-line w-40"></div></div></div>';
  container.innerHTML = skHTML + skHTML + skHTML;
  try {
    const [data, reviewData] = await Promise.all([
      api("/me/items"),
      api("/me/reviews/pending")
    ]);
    const sorted = [...data.items];
    sorted.sort((a, b) => {
      const aPending = (a.pendingClaimCount || 0) > 0 ? 1 : 0;
      const bPending = (b.pendingClaimCount || 0) > 0 ? 1 : 0;
      return bPending - aPending;
    });
    renderClaimsBanner(sorted);
    renderPendingReviews(reviewData.reviews || []);
    container.innerHTML = sorted.length
      ? sorted.map(item => renderItem(item, { showRoom: true, showStatus: true, showClaims: true, showOwnerActions: true })).join("")
      : emptyStateHTML("mine");
    refreshMotion(container);
    const hasPending = sorted.some(item => (item.pendingClaimCount || 0) > 0);
    if (hasPending && !state.claimsModalShown) {
      state.claimsModalShown = true;
      showClaimsModal(sorted);
    }
  } catch (error) {
    container.innerHTML = `<div class="state-card">${escapeHtml(errmsg(error, "加载失败"))}</div>`;
    $("pendingClaimsBanner").hidden = true;
    $("pendingReviewsBanner").hidden = true;
  }
}

async function openDetail(id) {
  try {
    state.contactViewedForItem = "";
    const data = await api(`/items/${encodeURIComponent(id)}`);
    state.selectedDetail = data.item;
    $("detailTitle").textContent = data.item.title;
    $("detailBody").innerHTML = `
      ${itemGalleryHTML(data.item)}
      <p class="detail-meta">${escapeHtml(data.item.campus)} · ${escapeHtml(data.item.building)}<br>
      ${escapeHtml(data.item.itemTypeText)} · ${escapeHtml(data.item.category)} · 剩余 ${escapeHtml(data.item.quantity)}${escapeHtml(data.item.unit)}<br>
      有效期：${escapeHtml(expiryText(data.item))} · ${escapeHtml(data.item.distanceLabel || "")}</p>
      <p class="item-desc">${escapeHtml(data.item.description || "暂未填写补充信息")}</p>
      ${trustSummaryHTML(data.item.ownerTrustSummary, "card")}
      <div class="notice-line">本平台仅提供信息匹配，不涉及物品流转。领取前请自行检查物品状况与适用性，评估使用风险。平台禁止处方药、管制药品及任何收费行为。</div>
      <button class="primary wide" id="contactButton">${isVerifiedUser() && profileComplete() ? "查看联系方式" : "登录并完善资料后查看联系方式"}</button>
      <div id="contactResult"></div>
      <button class="secondary wide" id="shareItemButton" style="margin-top:8px">复制物品链接分享给同学</button>
    `;
    refreshMotion($("detailBody"));
    const shareBtn = $("detailBody").querySelector("#shareItemButton");
    if (shareBtn) {
      shareBtn.addEventListener("click", () => {
        const url = new URL(window.location.href);
        url.search = new URLSearchParams({ item: id }).toString();
        const urlStr = url.toString();
        const fallbackCopy = (text) => {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); return true; } catch(e) { return false; }
          finally { document.body.removeChild(ta); }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(urlStr).then(() => {
            animateCloseDialog($("detailDialog"));
            showToast("链接已复制，发送给同学即可快速查看", "success");
          }).catch(() => {
            if (!fallbackCopy(urlStr)) showToast("复制失败，请手动复制地址栏链接", "error");
            else { animateCloseDialog($("detailDialog")); showToast("链接已复制", "success"); }
          });
        } else {
          if (fallbackCopy(urlStr)) { animateCloseDialog($("detailDialog")); showToast("链接已复制", "success"); }
          else showToast("复制失败，请手动复制地址栏链接", "error");
        }
      });
    }
    showMotionDialog($("detailDialog"));
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
      ${itemGalleryHTML(data.item)}
      <p class="detail-meta">
        ${escapeHtml(data.item.itemTypeText)} · ${escapeHtml(data.item.category)} · 剩余 ${escapeHtml(data.item.quantity)}${escapeHtml(data.item.unit)}<br>
        ${escapeHtml(data.item.campus)} · ${escapeHtml(data.item.building)}${data.item.room ? ` · ${escapeHtml(data.item.room)}` : ""}<br>
        有效期：${escapeHtml(expiryText(data.item))}<br>
        状态：${escapeHtml(statusText(data.item.status))}${statusLabel}
      </p>
      ${trustSummaryHTML(data.item.ownerTrustSummary, "card")}
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
    refreshMotion($("detailBody"));
    showMotionDialog($("detailDialog"));
  } catch (error) {
    showToast(errmsg(error, "详情加载失败"), "error");
  }
}

function startEditItem() {
  const item = state.selectedDetail;
  if (!item) return;
  animateCloseDialog($("detailDialog"));
  switchView("publish");
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
  state.uploadedImageUrls = Array.isArray(item.imageUrls) ? [...item.imageUrls].slice(0, 3) : [];
  renderImagePreviews();
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
    $("publishRulesText").textContent = "常用工具免费借用或赠送。请注明借用时长与归还方式。禁止危险工具及任何收费转让。发布后需经人工审核。";
    $("typeHint").textContent = "适用于偶尔需要但不常备的小工具，如锤子、镊子、砂纸、热熔胶枪等。建议注明是借用还是赠送。";
  } else if (item.itemType === "medicine") {
    $("publishRulesText").textContent = "仅限非处方常见药品，按大类笼统选择。禁止处方药、管制药品、拆封不明药品及任何收费转让。药品须填写有效期。发布后需经人工审核。";
    $("typeHint").textContent = "药品仅限非处方常见药品，按大类选择即可。禁止处方药、管制药品及任何收费转让。";
  } else {
    $("publishRulesText").textContent = "应急耗材免费共享，适用于创可贴、碘伏棉签、口罩、消毒用品等低风险物品。发布后需经人工审核。";
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
  const ok = await showConfirmDialog("确定要删除这条发布记录吗？上架中或审核中的物品会同时下架。");
  if (!ok) return;
  try {
    const data = await api(`/me/items/${encodeURIComponent(item.id)}/delete`, { method: "POST" });
    $("ownerActionResult").innerHTML = `<div class="contact-box">${escapeHtml(data.message || "发布记录已删除。")}</div>`;
    await Promise.all([loadHome(), loadMyItems()]);
    setTimeout(() => animateCloseDialog($("detailDialog")), 1200);
  } catch (error) {
    $("ownerActionResult").innerHTML = `<div class="contact-box">${escapeHtml(errmsg(error, "删除失败"))}</div>`;
  }
}

async function handleListDelete(itemId, button) {
  const ok = await showConfirmDialog("确定要删除这条发布记录吗？上架中或审核中的物品会同时下架。");
  if (!ok) return;
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
    animateCloseDialog($("detailDialog"));
    return;
  }
  if (state.contactViewedForItem === state.selectedDetail.id) return;
  try {
    const data = await api(`/items/${encodeURIComponent(state.selectedDetail.id)}/contact`, { method: "POST" });
    state.contactViewedForItem = state.selectedDetail.id;
    const noteText = data.alreadyViewed
      ? "今天已查看过该联系方式，本次不重复计入次数。"
      : "为保护每位同学的隐私，请不要将联系方式外传。";
    const fields = [];
    if (data.contact?.wechat) fields.push(`<div class="contact-field"><span class="contact-label">微信</span><span class="contact-value">${escapeHtml(data.contact.wechat)}</span></div>`);
    if (data.contact?.qq) fields.push(`<div class="contact-field"><span class="contact-label">QQ</span><span class="contact-value">${escapeHtml(data.contact.qq)}</span></div>`);
    if (!fields.length) fields.push(`<div class="contact-field"><span class="contact-value">暂未填写联系方式</span></div>`);
    $("contactResult").innerHTML = `
      <div class="contact-box">
        ${fields.join("")}
        <span class="contact-note">${noteText}</span>
      </div>
      <button class="primary wide claim-button" id="claimButton">我已联系并领取，提醒发布者确认</button>
      <div id="claimResult"></div>
    `;
    refreshMotion($("contactResult"));
    const btn = $("contactButton");
    if (btn) {
      btn.textContent = "已查看联系方式 ✓";
      btn.disabled = true;
      btn.classList.add("contact-viewed");
    }
    loadProfile();
  } catch (error) {
    $("contactResult").innerHTML = `<div class="contact-box">${escapeHtml(errmsg(error, "查看失败"))}</div>`;
    refreshMotion($("contactResult"));
  }
}

async function requestClaim() {
  if (!state.selectedDetail) return;
  if (!requireVerified("请先登录并补全账号资料，再提醒发布者确认领取。", () => {
    openDetail(state.selectedDetail?.id).then(() => setTimeout(requestClaim, 400));
  })) {
    animateCloseDialog($("detailDialog"));
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
    refreshMotion($("claimResult"));
  } catch (error) {
    claimBtn.disabled = false;
    claimBtn.textContent = "我已联系并领取，提醒发布者确认";
    $("claimResult").innerHTML = `<div class="contact-box">${escapeHtml(errmsg(error, "发送领取提醒失败"))}</div>`;
    refreshMotion($("claimResult"));
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
  refreshMotion($("iconGrid"));
}

function setPublishType(itemType) {
  state.selectedPublishType = itemType;
  state.selectedIcon = itemType === "medicine" ? "capsules" : (itemType === "tool" ? "box" : "plus");
  state.iconOtherOpen = false;
  $("medicineCategoryWrap").hidden = itemType !== "medicine";
  $("toolCategoryWrap").hidden = itemType !== "tool";
  const today = new Date();
  if (itemType === "tool") {
    $("publishRulesText").textContent = "常用工具免费借用或赠送。请注明借用时长与归还方式。禁止危险工具及任何收费转让。发布后需经人工审核。";
    $("typeHint").textContent = "适用于偶尔需要但不常备的小工具，如锤子、镊子、砂纸、热熔胶枪等。建议注明是借用还是赠送。";
    $("titleInput").placeholder = "例如：热熔胶枪借用";
    $("noExpiryWrap").hidden = false;
    $("noExpiryInput").checked = true;
    setDateRowDisabled(true);
  } else if (itemType === "medicine") {
    $("publishRulesText").textContent = "仅限非处方常见药品，按大类笼统选择。禁止处方药、管制药品、拆封不明药品及任何收费转让。药品须填写有效期。发布后需经人工审核。";
    $("typeHint").textContent = "药品仅限非处方常见药品，按大类选择即可。禁止处方药、管制药品及任何收费转让。";
    $("titleInput").placeholder = "例如：未拆封感冒药一盒";
    $("noExpiryWrap").hidden = true;
    $("noExpiryInput").checked = false;
    setDateRowDisabled(false);
    const d = new Date(today);
    d.setFullYear(d.getFullYear() + 1);
    setExpireDate(d.toISOString().slice(0, 10));
  } else {
    $("publishRulesText").textContent = "应急耗材免费共享，适用于创可贴、碘伏棉签、口罩、消毒用品等低风险物品。发布后需经人工审核。";
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

function renderSubChips(itemType) {
  const sub = $("subFilterChips");
  if (!sub) return;
  const categories = {
    consumable: ["应急耗材", "退烧降温", "消毒护理", "外伤处理", "防护用品", "其他耗材"],
    medicine: ["感冒药", "退烧药", "过敏药", "肠胃药", "其他非处方药"],
    tool: ["常用工具", "维修工具", "手工工具", "清洁工具", "其他工具"]
  };
  const list = categories[itemType] || [];
  sub.innerHTML = list.map(cat =>
    `<button class="chip chip-sub" data-type="${itemType}" data-category="${cat}">${cat}</button>`
  ).join("");
  sub.hidden = false;
  refreshMotion(sub);
}

function emptyStateHTML(type, detail = "") {
  const illustrations = {
    search: `<svg width="72" height="72" viewBox="0 0 72 72" fill="none"><circle cx="30" cy="30" r="16" stroke="currentColor" stroke-width="2"/><path d="M42 42l14 14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="30" cy="30" r="6" stroke="currentColor" stroke-width="2" opacity="0.5"/></svg>`,
    home: `<svg width="72" height="72" viewBox="0 0 72 72" fill="none"><path d="M36 10L10 32h6v28h16V44h8v16h16V32h6L36 10z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M28 44h16" stroke="currentColor" stroke-width="2" opacity="0.4"/></svg>`,
    mine: `<svg width="72" height="72" viewBox="0 0 72 72" fill="none"><rect x="14" y="14" width="44" height="50" rx="4" stroke="currentColor" stroke-width="2"/><path d="M14 22h44" stroke="currentColor" stroke-width="2"/><path d="M22 36h28" stroke="currentColor" stroke-width="1.5" opacity="0.5"/><circle cx="50" cy="48" r="3" fill="currentColor" opacity="0.4"/></svg>`,
    error: `<svg width="72" height="72" viewBox="0 0 72 72" fill="none"><circle cx="36" cy="36" r="24" stroke="currentColor" stroke-width="2"/><path d="M28 28l16 16M44 28L28 44" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    guest: `<svg width="72" height="72" viewBox="0 0 72 72" fill="none"><circle cx="28" cy="24" r="10" stroke="currentColor" stroke-width="2"/><path d="M10 58c0-12 8-22 18-22s18 9 18 22" stroke="currentColor" stroke-width="2"/><line x1="48" y1="20" x2="58" y2="30" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="58" y1="20" x2="48" y2="30" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
  };
  const messages = {
    search: `未找到与「${escapeHtml(detail)}」相关的物品`,
    home: "附近暂无上架物品，来做第一个分享的人吧",
    mine: `<p style="margin:0 0 16px">还没有发布过物品</p><button class="primary small" id="emptyStatePublishBtn">发布第一件物品</button>`,
    guest: `<p style="margin:0 0 16px">登录后即可查看和管理自己的发布</p><button class="primary small" id="emptyStateLoginBtn">去登录</button>`,
    error: escapeHtml(detail) || "网络连接失败，请检查网络后重试"
  };
  return `<div class="empty-state"><div class="empty-state-icon">${illustrations[type] || illustrations.home}</div><div class="empty-state-msg">${messages[type] || messages.home}</div></div>`;
}

function showConfirmDialog(message, confirmText = "确定", cancelText = "取消") {
  return new Promise(resolve => {
    const d = document.createElement("dialog");
    d.className = "confirm-dialog";
    d.innerHTML = `<div class="confirm-dialog-content">
      <p style="margin:0 0 18px;line-height:1.6">${escapeHtml(message)}</p>
      <div class="confirm-actions">
        <button class="primary wide" id="confirmYesBtn" type="button">${escapeHtml(confirmText)}</button>
        <button class="secondary wide" id="confirmNoBtn" type="button">${escapeHtml(cancelText)}</button>
      </div>
    </div>`;
    document.body.appendChild(d);
    showMotionDialog(d);
    d.querySelector("#confirmYesBtn").addEventListener("click", () => { closeAndRemoveDialog(d); resolve(true); });
    d.querySelector("#confirmNoBtn").addEventListener("click", () => { closeAndRemoveDialog(d); resolve(false); });
    d.addEventListener("click", e => { if (e.target === d) { closeAndRemoveDialog(d); resolve(false); } });
    d.addEventListener("cancel", e => { e.preventDefault(); closeAndRemoveDialog(d); resolve(false); });
  });
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
    imageUrls: [...state.uploadedImageUrls],
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
          imageUrls: payload.imageUrls,
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
      resetUploadedImages();
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
  const contactParts = [];
  if (payload.contactWechat) contactParts.push(`微信 ${payload.contactWechat}`);
  if (payload.contactQq) contactParts.push(`QQ ${payload.contactQq}`);
  const contactText = contactParts.join(" / ") || "未填写";
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
        <div class="confirm-row"><span class="confirm-label">图片</span><span>${payload.imageUrls.length ? `${payload.imageUrls.length} 张` : "未上传"}</span></div>
        <div class="confirm-row"><span class="confirm-label">联系方式</span><span>${contactText}</span></div>
      </div>
      <div class="confirm-actions">
        <button class="primary wide" id="confirmSubmitBtn" type="button">确认提交</button>
        <button class="secondary wide" id="confirmBackBtn" type="button">再检查一下</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  showMotionDialog(dialog);
  return new Promise(resolve => {
    dialog.querySelector("#confirmSubmitBtn").addEventListener("click", () => { closeAndRemoveDialog(dialog); resolve(true); });
    dialog.querySelector("#confirmBackBtn").addEventListener("click", () => { closeAndRemoveDialog(dialog); resolve(false); });
    dialog.addEventListener("click", event => { if (event.target === dialog) { closeAndRemoveDialog(dialog); resolve(false); } });
    dialog.addEventListener("cancel", event => { event.preventDefault(); closeAndRemoveDialog(dialog); resolve(false); });
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
  const tabsRow = document.querySelector(".login-tabs");
  const nannaDetails = document.querySelector(".secondary-login");
  const cardHeading = document.querySelector("#mineLoginCard h3");

  const allSections = [codeSection, passwordSection, forgotSection, setPasswordPrompt].filter(Boolean);

  // Hide all sections first
  allSections.forEach(s => { s.hidden = true; s.classList.remove("login-section-in"); });
  tabs.forEach(tab => tab.classList.remove("active"));

  let target = null;

  if (mode === "code") {
    target = codeSection;
    const codeTab = document.querySelector('.login-tab[data-login-mode="code"]');
    if (codeTab) codeTab.classList.add("active");
    if (tabsRow) tabsRow.hidden = false;
    if (nannaDetails) nannaDetails.hidden = false;
    if (cardHeading) cardHeading.textContent = "登录 NanE";
  } else if (mode === "password") {
    target = passwordSection;
    const pwTab = document.querySelector('.login-tab[data-login-mode="password"]');
    if (pwTab) pwTab.classList.add("active");
    if (tabsRow) tabsRow.hidden = false;
    if (nannaDetails) nannaDetails.hidden = false;
    if (cardHeading) cardHeading.textContent = "登录 NanE";
  } else if (mode === "forgot") {
    target = forgotSection;
    if (tabsRow) tabsRow.hidden = true;
    if (nannaDetails) nannaDetails.hidden = true;
    if (cardHeading) cardHeading.textContent = "重置密码";
  } else if (mode === "setPassword") {
    target = setPasswordPrompt;
    if (tabsRow) tabsRow.hidden = true;
    if (nannaDetails) nannaDetails.hidden = true;
    if (cardHeading) cardHeading.textContent = "设置登录密码";
  }

  if (target) {
    target.hidden = false;
    target.offsetHeight; // force reflow to avoid flicker
    target.classList.add("login-section-in");
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
  let enabled;
  if (saved !== null) {
    enabled = saved === "1";
  } else {
    enabled = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
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
  refreshMotion($("view-publish"));
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
  refreshMotion($("view-mine"));
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
  const viewButtons = document.querySelectorAll(".nav-item[data-view], .tab[data-view]");
  viewButtons.forEach(tab => {
    tab.addEventListener("click", () => {
      viewButtons.forEach(item => item.classList.toggle("active", item.dataset.view === tab.dataset.view));
      document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === `view-${tab.dataset.view}`));
      pulseElement(tab, "nav-bump");
      refreshMotion(document.querySelector(`#view-${tab.dataset.view}`) || document);
      if (tab.dataset.view === "publish") {
        const successCard = $("publishSuccessCard");
        if (successCard) successCard.hidden = true;
        syncPublishView();
        refreshMotion($("view-publish"));
      }
      if (tab.dataset.view === "mine") {
        loadProfile();
        loadMyItems();
      }
    });
  });

  $("refreshButton").addEventListener("click", () => Promise.all([loadHome(), loadProfile()]));
  $("searchButton").addEventListener("click", loadHome);
  $("homeLoadMore").addEventListener("click", loadMoreHome);
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
    const selectButton = event.target.closest(".chip-select-btn");
    if (selectButton) {
      const select = selectButton.closest(".chip-select");
      const dropdown = select.querySelector(".chip-dropdown");
      const willOpen = !select.classList.contains("open");
      closeFilterDropdowns(select);
      select.classList.toggle("open", willOpen);
      if (dropdown) dropdown.hidden = !willOpen;
      return;
    }

    const option = event.target.closest(".chip-dropdown li");
    if (option) {
      const select = option.closest(".chip-select");
      const category = option.dataset.category || "";
      document.querySelectorAll("#filterChips .chip").forEach(c => c.classList.remove("active"));
      select.classList.add("active");
      select.dataset.category = category;
      select.querySelectorAll("li").forEach(item => item.classList.toggle("selected", item === option));
      setFilterSelectLabel(select, option.textContent.trim());
      closeFilterDropdowns();
      $("subFilterChips").hidden = true;
      loadHome();
      return;
    }

    const chip = event.target.closest(".chip");
    if (!chip || chip.classList.contains("chip-select")) return;
    const isAll = chip.dataset.type === "" && chip.dataset.category === "";
    document.querySelectorAll("#filterChips .chip").forEach(c => c.classList.remove("active"));
    document.querySelectorAll("#filterChips .chip-select").forEach(select => {
      select.dataset.category = "";
      select.querySelectorAll("li").forEach(item => item.classList.remove("selected"));
      const topOption = select.querySelector("li[data-category='']");
      if (topOption) setFilterSelectLabel(select, topOption.textContent.trim());
    });
    closeFilterDropdowns();
    chip.classList.add("active");
    if (isAll) {
      $("subFilterChips").hidden = true;
    } else {
      renderSubChips(chip.dataset.type);
    }
    loadHome();
  });
  document.addEventListener("click", event => {
    if (!event.target.closest("#filterChips")) closeFilterDropdowns();
  });

  $("subFilterChips").addEventListener("click", event => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    chip.classList.toggle("active");
    loadHome();
  });
  $("itemList").addEventListener("click", event => {
    const card = event.target.closest(".item-card");
    if (card) openDetail(card.dataset.id);
  });
  // Empty state button delegation
  $("homeState").addEventListener("click", event => {
    if (event.target.id === "emptyStatePublishBtn") {
      switchView("publish");
    }
  });
  $("myItemList").addEventListener("click", async event => {
    const btn = event.target.closest("#emptyStatePublishBtn");
    if (btn) {
      switchView("publish");
      return;
    }
    const loginBtn = event.target.closest("#emptyStateLoginBtn");
    if (loginBtn) {
      const loginCard = $("mineLoginCard");
      if (loginCard) loginCard.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
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
  $("pendingReviewsBanner").addEventListener("click", event => {
    const button = event.target.closest("[data-review-action='open']");
    if (!button) return;
    openReviewDialog(button.dataset.claimId);
  });
  $("closeDetailButton").addEventListener("click", () => animateCloseDialog($("detailDialog")));
  $("detailDialog").addEventListener("click", event => {
    if (event.target.closest("#contactButton")) viewContact();
    if (event.target.closest("#claimButton")) requestClaim();
    if (event.target.closest("#editItemButton")) startEditItem();
    if (event.target.closest("#takeDownButton")) takeDownMyItem();
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
    if (event.target.checked && (!state.user?.campus || !state.user?.building)) {
      showToast("请先在「我的」页设置校区和楼栋，或取消勾选后手动选择", "info");
      event.target.checked = false;
      $("publishLocationFields").hidden = false;
      return;
    }
    $("publishLocationFields").hidden = event.target.checked;
  });
  $("noExpiryInput").addEventListener("change", toggleNoExpiry);
  $("publishForm").addEventListener("submit", submitPublish);
  $("titleInput").addEventListener("input", () => { updateCharCounts(); clearFieldErrors(); });
  $("descriptionInput").addEventListener("input", updateCharCounts);
  $("imageInput").addEventListener("change", event => uploadSelectedImages(event.target.files || []));
  $("imagePreviewList").addEventListener("click", event => {
    const removeButton = event.target.closest("[data-image-index]");
    if (!removeButton) return;
    state.uploadedImageUrls.splice(Number(removeButton.dataset.imageIndex), 1);
    renderImagePreviews();
  });
  $("imagePreviewList").addEventListener("dragover", event => {
    event.preventDefault();
    $("imagePreviewList").classList.add("is-dragover");
  });
  $("imagePreviewList").addEventListener("dragleave", event => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      $("imagePreviewList").classList.remove("is-dragover");
    }
  });
  $("imagePreviewList").addEventListener("drop", event => {
    event.preventDefault();
    $("imagePreviewList").classList.remove("is-dragover");
    uploadSelectedImages(event.dataTransfer?.files || []);
  });
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
    showMotionDialog($("agreementDialog"));
  });
  $("closeAgreementButton").addEventListener("click", () => animateCloseDialog($("agreementDialog")));
  $("closeClaimsModalButton").addEventListener("click", () => animateCloseDialog($("claimsModal")));
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
  $("closeReviewDialogButton").addEventListener("click", () => animateCloseDialog($("reviewDialog")));
  $("reviewDialog").addEventListener("click", event => {
    const tagButton = event.target.closest("[data-review-tag]");
    if (tagButton) {
      tagButton.classList.toggle("active");
      const message = $("reviewMessage");
      if (message) message.textContent = "";
      return;
    }
    if (event.target.closest("#reviewIssueInput")) {
      renderReviewTags(event.target.checked);
      const message = $("reviewMessage");
      if (message) message.textContent = "";
      return;
    }
    if (event.target.closest("#submitReviewButton")) {
      submitReview();
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

  $("settingsLogoutButton").addEventListener("click", async () => {
    const ok = await showConfirmDialog("确定要登出吗？");
    if (ok) logout();
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
      resetUploadedImages();
      setPublishType(state.selectedPublishType);
      renderLocationSelects("publish");
      switchView("mine");
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
        resetUploadedImages();
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
      switchView("mine");
      setTimeout(() => {
        const loginCard = $("mineLoginCard");
        if (loginCard) loginCard.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    });
  }
  if (goToHomeBtn) {
    goToHomeBtn.addEventListener("click", () => {
      switchView("home");
    });
  }
  $("settingsAgreementButton")?.addEventListener("click", () => {
    document.querySelector("#agreementDialog h3").textContent = "NanE 南易用户协议";
    loadAgreement();
    showMotionDialog($("agreementDialog"));
  });
  $("settingsPrivacyButton")?.addEventListener("click", async () => {
    try {
      const data = await api("/legal/privacy");
      $("agreementBody").innerHTML = markdownToHtml(data.markdown || "隐私保护指引暂不可用。");
      document.querySelector("#agreementDialog h3").textContent = "NanE 隐私保护指引";
      showMotionDialog($("agreementDialog"));
    } catch (error) {
      showToast("隐私保护指引加载失败", "error");
    }
  });
  $("footerAgreementButton")?.addEventListener("click", async () => {
    document.querySelector("#agreementDialog h3").textContent = "NanE 南易用户协议";
    await loadAgreement();
    showMotionDialog($("agreementDialog"));
  });
  $("footerPrivacyButton")?.addEventListener("click", async () => {
    try {
      const data = await api("/legal/privacy");
      $("agreementBody").innerHTML = markdownToHtml(data.markdown || "隐私保护指引暂不可用。");
      document.querySelector("#agreementDialog h3").textContent = "NanE 隐私保护指引";
      showMotionDialog($("agreementDialog"));
    } catch (error) {
      showToast("隐私保护指引加载失败", "error");
    }
  });
}

function parseUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view") || "";
  const focus = params.get("focus") || "";
  const item = params.get("item") || "";
  return { view, focus, item };
}

async function applyUrlParams() {
  const { view, focus, item } = parseUrlParams();
  if (item && item.startsWith("item_")) {
    try { await openDetail(item); } catch (e) { /* item may not exist */ }
    return;
  }
  if (view === "mine") {
    switchView("mine");
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
  initPressFeedback();
  bindEvents();
  refreshMotion(document);
  await Promise.all([loadAgreement(), loadLocations()]);
  renderIconGrid();
  setPublishType("consumable");
  renderImagePreviews();
  await Promise.all([loadHome(), loadProfile()]);
  syncPublishView();
  refreshMotion(document);
  await applyUrlParams();
}

init();
