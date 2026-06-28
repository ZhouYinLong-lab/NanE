window.NanE = window.NanE || {};
(function(N) {

N.showConfirmDialog = function showConfirmDialog(message, confirmText, cancelText) {
  if (confirmText === void 0) confirmText = "确定";
  if (cancelText === void 0) cancelText = "取消";
  return new Promise(resolve => {
    const d = document.createElement("dialog");
    d.className = "confirm-dialog";
    d.innerHTML = `<div class="confirm-dialog-content">
      <p style="margin:0 0 18px;line-height:1.6">${N.escapeHtml(message)}</p>
      <div class="confirm-actions">
        <button class="primary wide" id="confirmYesBtn" type="button">${N.escapeHtml(confirmText)}</button>
        <button class="secondary wide" id="confirmNoBtn" type="button">${N.escapeHtml(cancelText)}</button>
      </div>
    </div>`;
    document.body.appendChild(d);
    N.showMotionDialog(d);
    d.querySelector("#confirmYesBtn").addEventListener("click", () => { N.closeAndRemoveDialog(d); resolve(true); });
    d.querySelector("#confirmNoBtn").addEventListener("click", () => { N.closeAndRemoveDialog(d); resolve(false); });
    d.addEventListener("click", e => { if (e.target === d) { N.closeAndRemoveDialog(d); resolve(false); } });
    d.addEventListener("cancel", e => { e.preventDefault(); N.closeAndRemoveDialog(d); resolve(false); });
  });
};

})(window.NanE);
