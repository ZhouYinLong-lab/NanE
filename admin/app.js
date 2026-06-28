/* ===================================================================
   NanE Admin — Application Logic
   =================================================================== */

// ===== State =====
let token = localStorage.getItem("nane_admin_token") || "";
let selectedItems = new Set();
let pendingRejectAction = null; // { type: "single", id } | { type: "batch", ids: [...] }

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
  // Hide user metrics for non-super_admin (total users, banned users, new users today)
  if (!canManageAdmins()) {
    ["stat-total-users", "stat-banned-users", "stat-new-users"].forEach(function (id) {
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
  await Promise.all([loadStats(), loadItems()]);
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

// Close dialog on backdrop click
byId("rejectDialog").addEventListener("click", function (e) {
  if (e.target === byId("rejectDialog")) {
    closeRejectDialog();
  }
});

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
