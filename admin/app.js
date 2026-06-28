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
    showDashboard();
    loadAll();
  } catch (e) {
    showToast(e.message, "error");
  }
}

function logout() {
  token = "";
  localStorage.removeItem("nane_admin_token");
  byId("login-section").style.display = "";
  byId("dashboard").style.display = "none";
  selectedItems.clear();
}

function showDashboard() {
  byId("login-section").style.display = "none";
  byId("dashboard").style.display = "block";
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

  // Determine which action buttons to show
  var actionsHtml = "";
  if (item.status === "reviewing") {
    actionsHtml =
      '<button class="primary small" onclick="reviewItem(\'' + id + "','approve')\">通过</button>" +
      '<button class="secondary small" onclick="reviewItem(\'' + id + "','reject')\">驳回</button>";
  } else if (item.status === "online") {
    actionsHtml =
      '<button class="secondary small" onclick="reviewItem(\'' + id + "','reject')\">驳回</button>" +
      '<button class="danger small" onclick="reviewItem(\'' + id + "','take-down')\">下架</button>";
  }

  return (
    '<div class="item-card" data-id="' + id + '">' +
      '<label class="item-checkbox-label">' +
        '<input type="checkbox" class="item-checkbox" data-id="' + id + '" onchange="toggleItem(\'' + id + '\')">' +
      "</label>" +
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
          "<span> &middot; 图片 " + imageCount + " 张</span>" +
        "</div>" +
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
  showDashboard();
  loadAll().catch(function () {
    // Token may be expired — show login
    showToast("登录已过期，请重新登录", "error");
    logout();
  });
}
