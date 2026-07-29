/* ===================================================================
   NanE Admin — Application Logic
   =================================================================== */

// ===== State =====
let token = localStorage.getItem("nane_admin_token") || "";
let selectedItems = new Set();
let pendingRejectAction = null; // { type: "single", id } | { type: "batch", ids: [...] }
let adminLocations = [];

// ===== DOM helpers =====
function byId(id) { return document.getElementById(id); }

// ===== Escape =====
function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

// ===== Toast =====
function showToast(message, type) {
  if (!type) type = "error";
  var container = byId("toastContainer");
  if (!container) return;
  var toast = document.createElement("div");
  toast.className = "toast" + (type === "error" ? " toast-error" : type === "success" ? " toast-success" : "");
  toast.innerHTML = '<span class="toast-msg">' + escapeHtml(message) + '</span>';
  toast.addEventListener("click", function () {
    toast.classList.add("toast-out");
    setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 250);
  });
  container.appendChild(toast);
  setTimeout(function () {
    if (toast.isConnected) {
      toast.classList.add("toast-out");
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 250);
    }
  }, 4000);
}

// ===== API Client =====
async function api(path, options) {
  if (!options) options = {};
  var headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token
  };
  if (options.headers) {
    for (var key in options.headers) {
      if (options.headers.hasOwnProperty(key)) {
        headers[key] = options.headers[key];
      }
    }
  }
  var res = await fetch(path, {
    method: options.method || "GET",
    headers: headers,
    body: options.body || undefined
  });
  var data = await res.json();
  if (!res.ok) throw new Error(data.message || "请求失败");
  return data;
}

// ===== Status helpers =====
var STATUS_LABELS = {
  reviewing: "待审核",
  online: "上架中",
  rejected: "已驳回",
  taken_down: "已下架",
  claimed: "已领取",
  expired: "已过期"
};

var STATUS_CLASSES = {
  reviewing: "badge-warning",
  online: "badge-success",
  rejected: "badge-danger",
  taken_down: "badge-muted",
  claimed: "badge-info",
  expired: "badge-muted"
};

function formatDateTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("zh-CN");
  } catch (e) {
    return "";
  }
}

// ===== Reports =====
async function loadReports() {
  var container = byId("reports-list");
  if (!container) return;
  var statusVal = (byId("report-status") && byId("report-status").value) || "pending";
  try {
    var data = await api("/api/admin/reports?status=" + encodeURIComponent(statusVal));
    if (data.reports && data.reports.length > 0) {
      container.innerHTML = data.reports.map(renderReportCard).join("");
    } else {
      container.innerHTML = '<div class="empty-state">' + (statusVal === "pending" ? "暂无待处理举报" : "暂无已处理举报") + '</div>';
    }
  } catch (e) {
    container.innerHTML = '<div class="empty-state">加载失败：' + escapeHtml(e.message) + '</div>';
  }
}

function renderReportCard(r) {
  var reasons = { "虚假信息": "#b3261e", "违禁物品": "#c83c1e", "涉及收费": "#b8860b", "骚扰信息": "#6E0065", "其他问题": "#666" };
  var reasonColor = reasons[r.reason] || "#666";
  return '<div class="report-card glass" style="padding:16px;margin-bottom:10px;border-radius:10px;display:flex;gap:12px;align-items:flex-start">' +
    '<span style="background:' + reasonColor + ';color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;white-space:nowrap">' + escapeHtml(r.reason) + '</span>' +
    '<div style="flex:1;min-width:0">' +
      '<div style="font-weight:600;margin-bottom:2px">' + escapeHtml(r.itemTitle) + '</div>' +
      '<div style="font-size:12px;color:var(--muted);margin-bottom:4px">举报人：' + escapeHtml(r.reporterName) + ' · ' + escapeHtml(r.createdAt ? new Date(r.createdAt).toLocaleString("zh-CN") : "") + '</div>' +
      (r.comment ? '<div style="font-size:13px;margin-bottom:4px">' + escapeHtml(r.comment) + '</div>' : '') +
      '<div style="font-size:12px;color:var(--muted)">物品状态：' + escapeHtml(STATUS_LABELS[r.itemStatus] || r.itemStatus) + '</div>' +
    '</div>' +
    (r.reviewedAt ? '' : '<button class="secondary small" onclick="reviewReport(\'' + escapeHtml(r.id) + '\')">已处理</button>') +
  '</div>';
}

async function reviewReport(reportId) {
  try {
    await api("/api/admin/reports/" + encodeURIComponent(reportId) + "/review", { method: "POST" });
    showToast("已标记为已处理", "success");
    loadReports();
    loadStats();
  } catch (e) {
    showToast("操作失败：" + e.message, "error");
  }
}

// ===== Auth =====
async function login() {
  try {
    var data = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        username: byId("username").value,
        password: byId("password").value
      })
    });
    token = data.token;
    localStorage.setItem("nane_admin_token", token);
    // Store admin role from JWT payload
    try {
      var payload = JSON.parse(atob(token.split(".")[1]));
      localStorage.setItem("nane_admin_role", payload.adminRole || "viewer");
    } catch (e) {
      localStorage.setItem("nane_admin_role", "viewer");
    }
    showDashboard();
    loadAll();
  } catch (e) {
    showToast(e.message, "error");
  }
}

function logout() {
  token = "";
  localStorage.removeItem("nane_admin_token");
  localStorage.removeItem("nane_admin_role");
  byId("login-section").style.display = "";
  byId("dashboard").style.display = "none";
  selectedItems.clear();
  byId("admin-management").style.display = "none";
}

function showDashboard() {
  byId("login-section").style.display = "none";
  byId("dashboard").style.display = "block";
  // Select-all checkbox only for roles that can modify
  byId("select-all").closest(".select-all-label").style.display = canModify() ? "" : "none";
  // Batch bar only for roles that can modify
  byId("batch-bar").style.display = canModify() ? "" : "none";
  // Show admin management section if super_admin
  if (canManageAdmins()) {
    byId("admin-management").style.display = "";
    loadAdmins();
  }
  // Reports section always visible for moderator+
  var reportsSection = byId("reports-section");
  if (reportsSection && !canModify()) reportsSection.style.display = "none";
  // Hide user metrics for non-super_admin
  if (!canManageAdmins()) {
    ["stat-total-users", "stat-banned-users", "stat-new-users", "stat-reports"].forEach(function (id) {
      var el = byId(id);
      if (el) el.style.display = "none";
    });
  }
}

// ===== Role Helpers =====
function adminRole() {
  var stored = localStorage.getItem("nane_admin_role");
  if (stored) return stored;
  // Backward compat: old JWT without adminRole defaults to super_admin
  try {
    var payload = JSON.parse(atob(token.split(".")[1]));
    var role = payload.adminRole || "super_admin";
    localStorage.setItem("nane_admin_role", role);
    return role;
  } catch (e) {
    return "viewer";
  }
}
function canModify() {
  return adminRole() === "super_admin" || adminRole() === "moderator";
}
function canManageAdmins() {
  return adminRole() === "super_admin";
}

// ===== Data Loading =====
async function loadAll() {
  await ensureActivityLocations();
  await Promise.all([loadStats(), loadItems(), loadReports(), loadActivityAdmin()]);
}

async function loadStats() {
  try {
    var s = await api("/api/admin/stats");
    byId("s-reviewing").textContent = s.reviewing;
    byId("s-online").textContent = s.online;
    byId("s-offline").textContent = s.offline;
    byId("s-contact").textContent = s.contact_views_today;
    byId("s-claims").textContent = s.confirmed_claims;
    byId("s-reviews").textContent = s.fulfillment_reviews;
    byId("s-total-users").textContent = s.total_users;
    byId("s-banned-users").textContent = s.banned_users;
    byId("s-new-users").textContent = s.new_users_today;
    var reportsEl = byId("s-pending-reports");
    if (reportsEl) reportsEl.textContent = s.pending_reports || 0;
  } catch (e) {
    showToast("加载统计数据失败：" + e.message, "error");
  }
}

async function loadItems() {
  var container = byId("items");
  var statusValue = byId("item-status").value || "reviewing";
  // Reset selections
  selectedItems.clear();
  byId("select-all").checked = false;
  updateBatchBar();
  try {
    var data = await api("/api/admin/items?status=" + encodeURIComponent(statusValue));
    if (data.items && data.items.length > 0) {
      container.innerHTML = data.items.map(function (item) {
        return renderItemCard(item);
      }).join("");
    } else {
      container.innerHTML = '<div class="empty-state">暂无数据</div>';
    }
  } catch (e) {
    container.innerHTML = '<div class="empty-state">加载失败：' + escapeHtml(e.message) + '</div>';
  }
}

// ===== Building Activity =====
async function ensureActivityLocations() {
  if (adminLocations.length > 0) return;
  var campusSelect = byId("activity-campus");
  var buildingSelect = byId("activity-building");
  if (!campusSelect || !buildingSelect) return;
  try {
    var data = await api("/api/locations");
    adminLocations = Array.isArray(data.locations) ? data.locations : [];
    campusSelect.innerHTML = adminLocations.map(function (campus, index) {
      return '<option value="' + index + '">' + escapeHtml(campus.name) + '</option>';
    }).join("");
    var defaultIndex = adminLocations.findIndex(function (campus) { return campus.name === "仙林校区"; });
    campusSelect.value = String(defaultIndex >= 0 ? defaultIndex : 0);
    onActivityCampusChange(false);
  } catch (e) {
    var list = byId("activity-admin-list");
    if (list) list.innerHTML = '<div class="empty-state">楼栋数据加载失败：' + escapeHtml(e.message) + '</div>';
  }
}

function onActivityCampusChange(shouldLoad) {
  if (shouldLoad === undefined) shouldLoad = true;
  var campusSelect = byId("activity-campus");
  var buildingSelect = byId("activity-building");
  if (!campusSelect || !buildingSelect) return;
  var campus = adminLocations[Number(campusSelect.value)] || adminLocations[0];
  var buildings = campus && Array.isArray(campus.buildings) ? campus.buildings : [];
  buildingSelect.innerHTML = buildings.map(function (building, index) {
    return '<option value="' + index + '">' + escapeHtml(building.name) + '</option>';
  }).join("");
  if (buildings.length) buildingSelect.value = "0";
  if (shouldLoad) loadActivityAdmin();
}

async function loadActivityAdmin() {
  var list = byId("activity-admin-list");
  var campusSelect = byId("activity-campus");
  var buildingSelect = byId("activity-building");
  if (!list || !campusSelect || !buildingSelect) return;
  if (!adminLocations.length) {
    list.innerHTML = '<div class="empty-state">正在加载楼栋数据...</div>';
    return;
  }
  var campus = adminLocations[Number(campusSelect.value)] || adminLocations[0];
  var building = campus && campus.buildings ? campus.buildings[Number(buildingSelect.value)] : null;
  if (!campus || !building) {
    list.innerHTML = '<div class="empty-state">请选择校区和楼栋</div>';
    return;
  }
  var limit = (byId("activity-limit") && byId("activity-limit").value) || "20";
  try {
    var data = await api(
      "/api/admin/activity?campus=" + encodeURIComponent(campus.name) +
      "&building=" + encodeURIComponent(building.name) +
      "&limit=" + encodeURIComponent(limit)
    );
    renderActivitySummary(data.summary || {});
    if (data.activities && data.activities.length > 0) {
      list.innerHTML = data.activities.map(renderActivityRow).join("");
    } else {
      list.innerHTML = '<div class="empty-state">该楼栋暂无动态</div>';
    }
  } catch (e) {
    list.innerHTML = '<div class="empty-state">动态加载失败：' + escapeHtml(e.message) + '</div>';
  }
}

function renderActivitySummary(summary) {
  byId("activity-online").textContent = summary.onlineItems || 0;
  byId("activity-claims").textContent = summary.confirmedClaims || 0;
  byId("activity-owners").textContent = summary.activeOwners || 0;
  byId("activity-recent").textContent = summary.recentActivities || 0;
  byId("activity-last").textContent = summary.lastActivityAt
    ? "最近动态：" + formatDateTime(summary.lastActivityAt)
    : "暂无最近动态";
}

function renderActivityRow(activity) {
  var isClaimed = activity.eventType === "claimed";
  var eventLabel = isClaimed ? "已领取" : "新分享";
  var eventClass = isClaimed ? "badge-info" : "badge-success";
  var actor = isClaimed
    ? escapeHtml(activity.claimerName || "同学") + " 领取了 " + escapeHtml(activity.ownerName || "同学") + " 的物品"
    : escapeHtml(activity.ownerName || "同学") + " 分享了物品";
  return '<div class="activity-admin-row">' +
    '<span class="badge ' + eventClass + '">' + eventLabel + '</span>' +
    '<div class="activity-admin-main">' +
      '<strong>' + escapeHtml(activity.itemTitle || "未命名物品") + '</strong>' +
      '<span>' + actor + '</span>' +
      '<small>' + escapeHtml(activity.category || "") + ' · ' + escapeHtml(STATUS_LABELS[activity.itemStatus] || activity.itemStatus || "") + ' · ' + escapeHtml(formatDateTime(activity.eventTime)) + '</small>' +
    '</div>' +
    '<button class="secondary small" onclick="focusAdminItem(\'' + escapeHtml(activity.itemId) + '\')">定位物品</button>' +
  '</div>';
}

async function focusAdminItem(itemId) {
  var statusSelect = byId("item-status");
  if (statusSelect) statusSelect.value = "all";
  await loadItems();
  var card = Array.prototype.find.call(document.querySelectorAll(".item-card"), function (item) {
    return item.getAttribute("data-id") === itemId;
  });
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("item-card-focus");
    setTimeout(function () { card.classList.remove("item-card-focus"); }, 1600);
  } else {
    showToast("已切换到全部物品，但当前列表中未找到该物品", "info");
  }
}

// ===== Item Card Rendering =====
function renderItemCard(item) {
  var id = escapeHtml(item.id);
  var title = escapeHtml(item.title);
  var statusLabel = STATUS_LABELS[item.status] || item.status;
  var statusClass = STATUS_CLASSES[item.status] || "badge-muted";
  var description = escapeHtml(item.description);
  var expireText = item.noExpiry ? "长期有效" : escapeHtml(item.expireDate);
  var imageCount = (item.imageUrls || []).length;
  var iconName = escapeHtml(item.itemIcon || "");
  var typeText = escapeHtml(item.itemTypeText || "");
  var category = escapeHtml(item.category || "");
  var campus = escapeHtml(item.campus || "");
  var building = escapeHtml(item.building || "");
  var roomText = item.room ? '<span class="meta-chip">' + escapeHtml(item.room) + "</span>" : "";
  var quantity = escapeHtml(item.quantity);
  var unit = escapeHtml(item.unit || "个");
  var ownerName = escapeHtml(item.ownerName || "未知");
  var wechat = item.contact ? escapeHtml(item.contact.wechat || "未填") : "未填";
  var qq = item.contact ? escapeHtml(item.contact.qq || "未填") : "未填";
  var rejectHtml = "";
  if (item.rejectReason) {
    rejectHtml = '<div class="reject-reason">驳回原因：' + escapeHtml(item.rejectReason) + "</div>";
  }

  // Determine which action buttons to show (only for super_admin and moderator)
  var actionsHtml = "";
  if (canModify()) {
    if (item.status === "reviewing") {
      actionsHtml =
        '<button class="primary small" onclick="reviewItem(\'' + id + "','approve')\">通过</button>" +
        '<button class="secondary small" onclick="reviewItem(\'' + id + "','reject')\">驳回</button>";
    } else if (item.status === "online") {
      actionsHtml =
        '<button class="secondary small" onclick="reviewItem(\'' + id + "','reject')\">驳回</button>" +
        '<button class="danger small" onclick="reviewItem(\'' + id + "','take-down')\">下架</button>";
    }
  }

  // Checkbox only for roles that can modify
  var checkboxHtml = canModify()
    ? '<label class="item-checkbox-label"><input type="checkbox" class="item-checkbox" data-id="' + id + '" onchange="toggleItem(\'' + id + '\')"></label>'
    : "";

  return (
    '<div class="item-card" data-id="' + id + '">' +
      checkboxHtml +
      '<div class="item-content">' +
        '<div class="item-header">' +
          '<h3>' + title + "</h3>" +
          '<span class="badge ' + statusClass + '">' + statusLabel + "</span>" +
        "</div>" +
        '<p class="item-desc">' + description + "</p>" +
        '<div class="item-meta">' +
          (iconName ? '<span class="meta-chip">' + iconName + "</span>" : "") +
          (typeText ? '<span class="meta-chip">' + typeText + "</span>" : "") +
          (category ? '<span class="meta-chip">' + category + "</span>" : "") +
          (campus ? '<span class="meta-chip">' + campus + "</span>" : "") +
          (building ? '<span class="meta-chip">' + building + "</span>" : "") +
          roomText +
        "</div>" +
        '<div class="item-meta">' +
          "<span>余 " + quantity + " " + unit + "</span>" +
          "<span> &middot; 有效期 " + expireText + "</span>" +
        "</div>" +
        (imageCount > 0 ? '<div class="item-thumbnails">' +
          (item.imageUrls || []).map(function(url) {
            return '<img src="' + escapeHtml(url) + '" alt="审核图片" loading="lazy" onclick="window.open(\'' + escapeHtml(url) + '\')" title="点击查看原图">';
          }).join("") +
        "</div>" : "") +
        '<div class="item-owner">' +
          "<span>发布者：" + ownerName + "</span>" +
          "<span>微信 " + wechat + "</span>" +
          "<span>QQ " + qq + "</span>" +
        "</div>" +
        rejectHtml +
        (actionsHtml ? '<div class="item-actions">' + actionsHtml + "</div>" : "") +
      "</div>" +
    "</div>"
  );
}

// ===== Batch Selection =====
function toggleSelectAll() {
  var checked = byId("select-all").checked;
  var checkboxes = document.querySelectorAll(".item-checkbox");
  checkboxes.forEach(function (cb) {
    cb.checked = checked;
    var id = cb.getAttribute("data-id");
    if (checked) {
      selectedItems.add(id);
    } else {
      selectedItems.delete(id);
    }
  });
  updateBatchBar();
}

function toggleItem(id) {
  var cb = document.querySelector('.item-checkbox[data-id="' + id + '"]');
  if (cb && cb.checked) {
    selectedItems.add(id);
  } else {
    selectedItems.delete(id);
  }
  var allCbs = document.querySelectorAll(".item-checkbox");
  var checkedCbs = document.querySelectorAll(".item-checkbox:checked");
  byId("select-all").checked = allCbs.length > 0 && allCbs.length === checkedCbs.length;
  updateBatchBar();
}

function updateBatchBar() {
  var count = selectedItems.size;
  byId("selected-count").textContent = "已选择 " + count + " 项";
  byId("batch-bar").hidden = count === 0;
}

// ===== Single Review Actions =====
function reviewItem(id, action) {
  if (action === "reject") {
    pendingRejectAction = { type: "single", id: id };
    byId("reject-reason").value = "不符合发布规范";
    byId("rejectDialog").showModal();
    return;
  }
  doReview(id, action, "");
}

async function doReview(id, action, reason) {
  try {
    await api("/api/admin/items/" + id + "/" + action, {
      method: "POST",
      body: JSON.stringify({ reason: reason })
    });
    var label = action === "approve" ? "已通过" : action === "reject" ? "已驳回" : "已下架";
    showToast(label, "success");
    loadAll();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ===== Batch Actions =====
function batchAction(action) {
  var ids = Array.from(selectedItems);
  if (ids.length === 0) return;
  if (action === "reject") {
    pendingRejectAction = { type: "batch", ids: ids };
    byId("reject-reason").value = "不符合发布规范";
    byId("rejectDialog").showModal();
    return;
  }
  doBatchAction(ids, action, "");
}

async function doBatchAction(ids, action, reason) {
  try {
    await api("/api/admin/items/batch", {
      method: "POST",
      body: JSON.stringify({ ids: ids, action: action, reason: reason })
    });
    showToast("批量操作成功", "success");
    selectedItems.clear();
    updateBatchBar();
    loadAll();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ===== Admin Management =====
async function loadAdmins() {
  try {
    var data = await api("/api/admin/admins");
    var listEl = byId("admin-list");
    if (!data.admins || data.admins.length === 0) {
      listEl.innerHTML = '<div class="empty-state">暂无管理员</div>';
      return;
    }
    var currentUsername = "";
    try {
      var p = JSON.parse(atob(token.split(".")[1]));
      currentUsername = p.username || "";
    } catch (e) {}
    listEl.innerHTML = data.admins.map(function (a) {
      var roleLabel = a.role === "super_admin" ? "超级管理员" : a.role === "moderator" ? "审核员" : "观察员";
      var isSelf = a.username === currentUsername;
      var deleteBtn = isSelf
        ? '<span class="admin-self-tag">当前登录</span>'
        : '<button class="danger small" onclick="deleteAdmin(\'' + escapeHtml(a.id) + '\')">删除</button>';
      return '<div class="admin-row">' +
        '<span class="admin-name">' + escapeHtml(a.username) + '</span>' +
        '<span class="admin-role-pill admin-role-' + escapeHtml(a.role) + '">' + roleLabel + '</span>' +
        '<span class="admin-row-actions">' + deleteBtn + '</span>' +
        '</div>';
    }).join("");
  } catch (e) {
    showToast("加载管理员列表失败：" + e.message, "error");
  }
}

async function createAdmin() {
  var username = byId("new-admin-username").value.trim();
  var password = byId("new-admin-password").value.trim();
  var role = byId("new-admin-role").value;
  if (!username || !password) {
    showToast("请填写用户名和密码", "error");
    return;
  }
  try {
    await api("/api/admin/admins", {
      method: "POST",
      body: JSON.stringify({ username: username, password: password, role: role })
    });
    showToast("管理员添加成功", "success");
    byId("new-admin-username").value = "";
    byId("new-admin-password").value = "";
    byId("new-admin-role").value = "viewer";
    loadAdmins();
  } catch (e) {
    showToast("添加管理员失败：" + e.message, "error");
  }
}

async function deleteAdmin(id) {
  if (!confirm("确定要删除该管理员吗？")) return;
  try {
    await api("/api/admin/admins/" + encodeURIComponent(id), {
      method: "DELETE"
    });
    showToast("管理员已删除", "success");
    loadAdmins();
  } catch (e) {
    showToast("删除管理员失败：" + e.message, "error");
  }
}

// ===== Reject Dialog =====
function closeRejectDialog() {
  byId("rejectDialog").close();
  pendingRejectAction = null;
}

function submitReject() {
  if (!pendingRejectAction) return;
  var reason = byId("reject-reason").value.trim() || "未通过审核";
  if (pendingRejectAction.type === "single") {
    doReview(pendingRejectAction.id, "reject", reason);
  } else if (pendingRejectAction.type === "batch") {
    doBatchAction(pendingRejectAction.ids, "reject", reason);
  }
  closeRejectDialog();
}

// ===== Event Binding for CSP compatibility =====
// Replace inline onclick handlers with event listeners so CSP doesn't require 'unsafe-inline'.

function bindAdminEvents() {
  // Login
  var loginBtn = byId("adminLoginBtn");
  if (loginBtn) loginBtn.addEventListener("click", login);

  // Logout
  var logoutBtn = byId("adminLogoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  // Status select
  var statusSelect = byId("item-status");
  if (statusSelect) statusSelect.addEventListener("change", loadItems);

  // Refresh button
  var refreshBtn = byId("adminRefreshBtn");
  if (refreshBtn) refreshBtn.addEventListener("click", loadAll);

  // Select all
  var selectAll = byId("select-all");
  if (selectAll) selectAll.addEventListener("change", toggleSelectAll);

  // Batch actions
  document.querySelectorAll("[data-batch]").forEach(function(btn) {
    var action = btn.getAttribute("data-batch");
    if (action) {
      btn.addEventListener("click", function() { batchAction(action); });
    }
  });

  // Reject dialog
  var rejectDialog = byId("rejectDialog");
  var dialogCancelBtn = byId("rejectCancelBtn");
  if (dialogCancelBtn) dialogCancelBtn.addEventListener("click", closeRejectDialog);
  var dialogCloseBtn = rejectDialog ? rejectDialog.querySelector(".dialog-close") : null;
  if (dialogCloseBtn) dialogCloseBtn.addEventListener("click", closeRejectDialog);
  var confirmRejectBtn = byId("rejectConfirmBtn");
  if (confirmRejectBtn) confirmRejectBtn.addEventListener("click", submitReject);

  // Report status select
  var reportStatus = byId("report-status");
  if (reportStatus) reportStatus.addEventListener("change", loadReports);

  // Activity controls
  var activityCampus = byId("activity-campus");
  if (activityCampus) activityCampus.addEventListener("change", function() { onActivityCampusChange(true); });
  var activityBuilding = byId("activity-building");
  if (activityBuilding) activityBuilding.addEventListener("change", loadActivityAdmin);
  var activityLimit = byId("activity-limit");
  if (activityLimit) activityLimit.addEventListener("change", loadActivityAdmin);
  var activityRefreshBtn = byId("activityRefreshBtn");
  if (activityRefreshBtn) activityRefreshBtn.addEventListener("click", loadActivityAdmin);

  // Admin management
  var createAdminBtn = byId("create-admin-btn");
  if (createAdminBtn) createAdminBtn.addEventListener("click", createAdmin);

  // Reject dialog backdrop click
  if (rejectDialog) {
    rejectDialog.addEventListener("click", function (e) {
      if (e.target === rejectDialog) {
        closeRejectDialog();
      }
    });
  }
}

// Bind events after DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindAdminEvents);
} else {
  bindAdminEvents();
}

// Auto-login on page load (keep existing logic)

// ===== Auto-login on page load =====
if (token) {
  // Extract role from token if not already stored
  if (!localStorage.getItem("nane_admin_role")) {
    try {
      var p = JSON.parse(atob(token.split(".")[1]));
      localStorage.setItem("nane_admin_role", p.adminRole || "viewer");
    } catch (e) {
      localStorage.setItem("nane_admin_role", "viewer");
    }
  }
  showDashboard();
  loadAll().catch(function () {
    // Token may be expired — show login
    showToast("登录已过期，请重新登录", "error");
    logout();
  });
  if (canManageAdmins()) {
    loadAdmins();
  }
}
