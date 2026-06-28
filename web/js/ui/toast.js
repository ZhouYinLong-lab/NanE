window.NanE = window.NanE || {};
(function(N) {

N.showToast = function showToast(message, type) {
  if (type === void 0) type = "info";
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const icons = { success: "", error: "", info: "" };
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-msg">${N.escapeHtml(message)}</span><button class="toast-close" aria-label="关闭">&times;</button>`;
  toast.querySelector(".toast-close").addEventListener("click", e => { e.stopPropagation(); N.dismissToast(toast); });
  toast.addEventListener("click", () => N.dismissToast(toast));
  container.appendChild(toast);
  setTimeout(() => N.dismissToast(toast), 5000);
};

N.dismissToast = function dismissToast(toast) {
  if (!toast.parentNode) return;
  toast.classList.add("toast-out");
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 250);
};

})(window.NanE);
