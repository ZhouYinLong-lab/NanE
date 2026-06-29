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

N.showTypedConfirmDialog = function showTypedConfirmDialog(options) {
  const config = options || {};
  const phrase = config.phrase || "确认删除";
  const confirmText = config.confirmText || "确认";
  const cancelText = config.cancelText || "取消";
  return new Promise(resolve => {
    const d = document.createElement("dialog");
    d.className = "confirm-dialog";
    d.innerHTML = `<div class="confirm-dialog-content">
      <p style="margin:0 0 16px;line-height:1.6">${N.escapeHtml(config.message || "")}</p>
      <label class="confirm-input">
        <span class="confirm-input-label">${N.escapeHtml(config.label || `请输入「${phrase}」`)}</span>
        <input id="typedConfirmInput" type="text" autocomplete="off" spellcheck="false" placeholder="${N.escapeHtml(phrase)}">
        <span class="confirm-input-hint" id="typedConfirmHint">${N.escapeHtml(config.hint || "输入完全一致后才能继续。")}</span>
      </label>
      <div class="confirm-actions">
        <button class="danger wide" id="typedConfirmYesBtn" type="button" disabled>${N.escapeHtml(confirmText)}</button>
        <button class="secondary wide" id="typedConfirmNoBtn" type="button">${N.escapeHtml(cancelText)}</button>
      </div>
    </div>`;
    document.body.appendChild(d);
    N.showMotionDialog(d);

    const input = d.querySelector("#typedConfirmInput");
    const yes = d.querySelector("#typedConfirmYesBtn");
    const no = d.querySelector("#typedConfirmNoBtn");
    const hint = d.querySelector("#typedConfirmHint");
    const close = value => { N.closeAndRemoveDialog(d); resolve(value); };

    input.addEventListener("input", () => {
      const matched = input.value.trim() === phrase;
      yes.disabled = !matched;
      hint.textContent = matched ? "确认文本已匹配。" : "输入完全一致后才能继续。";
    });
    input.addEventListener("keydown", event => {
      if (event.key === "Enter" && !yes.disabled) close(true);
    });
    yes.addEventListener("click", () => close(true));
    no.addEventListener("click", () => close(false));
    d.addEventListener("click", e => { if (e.target === d) close(false); });
    d.addEventListener("cancel", e => { e.preventDefault(); close(false); });
    setTimeout(() => input.focus(), 80);
  });
};

})(window.NanE);
