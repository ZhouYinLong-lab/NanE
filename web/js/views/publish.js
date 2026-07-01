window.NanE = window.NanE || {};
(function(N) {

N.renderImagePreviews = function renderImagePreviews() {
  const list = N.$("imagePreviewList");
  if (!list) return;
  if (N.state.imageUploading) {
    list.innerHTML = `
      <div class="image-upload-progress">
        <span>正在处理图片...</span>
        <div class="image-progress-track"><div></div></div>
      </div>
    `;
    N.refreshMotion(list);
    return;
  }
  if (!N.state.uploadedImageUrls.length) {
    list.innerHTML = `<div class="image-empty">暂未上传图片</div>`;
    N.refreshMotion(list);
    return;
  }
  list.innerHTML = N.state.uploadedImageUrls.map((url, index) => `
    <div class="image-preview">
      <img src="${N.escapeHtml(url)}" alt="已上传图片 ${index + 1}">
      <button type="button" class="image-remove" data-image-index="${index}" aria-label="移除第 ${index + 1} 张图片">×</button>
    </div>
  `).join("");
  N.refreshMotion(list);
};

N.resetUploadedImages = function resetUploadedImages() {
  N.state.uploadedImageUrls = [];
  if (N.$("imageInput")) N.$("imageInput").value = "";
  N.renderImagePreviews();
};

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

N.uploadSelectedImages = async function uploadSelectedImages(files) {
  const message = N.$("publishMessage");
  const remaining = 3 - N.state.uploadedImageUrls.length;
  const selected = [...files].slice(0, remaining);
  if (!selected.length) {
    N.showToast("最多上传 3 张图片", "info");
    return;
  }
  N.state.imageUploading = true;
  N.renderImagePreviews();
  message.textContent = "正在上传图片...";
  try {
    for (const file of selected) {
      const dataUrl = await fileToCompressedDataUrl(file);
      const uploaded = await N.api("/uploads/images", {
        method: "POST",
        body: JSON.stringify({ dataUrl, filename: file.name })
      });
      N.state.uploadedImageUrls.push(uploaded.url);
      N.renderImagePreviews();
    }
    message.textContent = "";
    N.showToast("图片已上传", "success");
  } catch (error) {
    message.textContent = N.errmsg(error, "图片上传失败");
  } finally {
    N.state.imageUploading = false;
    N.$("imageInput").value = "";
    N.renderImagePreviews();
  }
};

N.renderIconGrid = function renderIconGrid() {
  const commonKeys = N.state.selectedPublishType === "medicine"
    ? ["capsules", "pills", "tablets", "prescriptionBottleMedical"]
    : N.state.selectedPublishType === "tool"
    ? ["box", "boxOpen", "handHoldingMedical", "heartPulse"]
    : ["plus", "bandage", "pumpMedical", "temperatureHalf"];
  const common = N.iconOptions.filter(([key]) => commonKeys.includes(key));
  const hidden = N.iconOptions.filter(([key]) => !commonKeys.includes(key));
  const isHiddenSelected = hidden.some(([key]) => key === N.state.selectedIcon);
  const commonHtml = common.map(([key]) => `
    <button type="button" class="icon-option ${key === N.state.selectedIcon ? "active" : ""}" data-icon="${key}" aria-label="选择图标">
      <strong>${N.iconGlyph(key, N.state.selectedPublishType)}</strong>
    </button>
  `).join("");
  const otherHtml = `
    <button type="button" class="icon-option ${isHiddenSelected || N.state.iconOtherOpen ? "active" : ""}" data-toggle-icons="true" aria-label="更多图标">
      <strong></strong>
    </button>
  `;
  const hiddenHtml = N.state.iconOtherOpen ? `
    <div class="icon-more">
      ${hidden.map(([key]) => `
        <button type="button" class="icon-option ${key === N.state.selectedIcon ? "active" : ""}" data-icon="${key}" aria-label="选择图标">
          <strong>${N.iconGlyph(key, N.state.selectedPublishType)}</strong>
        </button>
      `).join("")}
    </div>
  ` : "";
  N.$("iconGrid").innerHTML = `${commonHtml}${otherHtml}${hiddenHtml}`;
  N.refreshMotion(N.$("iconGrid"));
};

N.currentPublishCategory = function currentPublishCategory() {
  if (N.state.selectedPublishType === "medicine") {
    return N.$("categorySelect").value;
  }
  if (N.state.selectedPublishType === "tool") {
    return N.$("toolCategorySelect").value;
  }
  return N.$("consumableCategorySelect").value;
};

N.setPublishType = function setPublishType(itemType) {
  N.state.selectedPublishType = itemType;
  N.state.selectedIcon = itemType === "medicine" ? "capsules" : (itemType === "tool" ? "box" : "plus");
  N.state.iconOtherOpen = false;
  N.$("consumableCategoryWrap").hidden = itemType !== "consumable";
  N.$("medicineCategoryWrap").hidden = itemType !== "medicine";
  N.$("toolCategoryWrap").hidden = itemType !== "tool";
  const today = new Date();
  if (itemType === "tool") {
    N.$("publishRulesText").textContent = "常用工具免费借用或赠送。请注明借用时长与归还方式。禁止危险工具及任何收费转让。发布后需经人工审核。";
    N.$("typeHint").textContent = "适用于偶尔需要但不常备的小工具，如锤子、镊子、砂纸、热熔胶枪等。建议注明是借用还是赠送。";
    N.$("titleInput").placeholder = "例如：热熔胶枪借用";
    N.$("noExpiryWrap").hidden = false;
    N.$("noExpiryInput").checked = true;
    N.setDateRowDisabled(true);
  } else if (itemType === "medicine") {
    N.$("publishRulesText").textContent = "仅限非处方常见药品，按大类笼统选择。禁止处方药、管制药品、拆封不明药品及任何收费转让。药品须填写有效期。发布后需经人工审核。";
    N.$("typeHint").textContent = "药品仅限非处方常见药品，按大类选择即可。禁止处方药、管制药品及任何收费转让。";
    N.$("titleInput").placeholder = "例如：未拆封感冒药一盒";
    N.$("noExpiryWrap").hidden = true;
    N.$("noExpiryInput").checked = false;
    N.setDateRowDisabled(false);
    const d = new Date(today);
    d.setFullYear(d.getFullYear() + 1);
    N.setExpireDate(d.toISOString().slice(0, 10));
  } else {
    N.$("publishRulesText").textContent = "应急耗材免费共享，适用于创可贴、碘伏棉签、口罩、消毒用品等低风险物品。发布后需经人工审核。";
    N.$("typeHint").textContent = "适用于创可贴、碘伏棉签、口罩、消毒用品等低风险应急物品，请选择最接近的分类。";
    N.$("titleInput").placeholder = "例如：碘伏棉签 10 支";
    N.$("noExpiryWrap").hidden = false;
    N.$("noExpiryInput").checked = false;
    N.setDateRowDisabled(false);
    const d = new Date(today);
    d.setDate(d.getDate() + 180);
    N.setExpireDate(d.toISOString().slice(0, 10));
  }
  N.clearFieldErrors();
  N.updateCharCounts();
  document.querySelectorAll(".segment").forEach(button => {
    button.classList.toggle("active", button.dataset.itemType === itemType);
  });
  N.renderIconGrid();
};

N.syncPublishView = function syncPublishView() {
  const form = N.$("publishForm");
  const guestCard = N.$("publishGuestCard");
  if (!form || !guestCard) return;
  if (N.isVerifiedUser() && N.profileComplete()) {
    form.hidden = false;
    guestCard.hidden = true;
  } else {
    form.hidden = true;
    guestCard.hidden = false;
  }
  N.refreshMotion(N.$("view-publish"));
};

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
        <div class="confirm-row"><span class="confirm-label">物品名称</span><span>${N.escapeHtml(payload.title)}</span></div>
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
  N.showMotionDialog(dialog);
  return new Promise(resolve => {
    dialog.querySelector("#confirmSubmitBtn").addEventListener("click", () => { N.closeAndRemoveDialog(dialog); resolve(true); });
    dialog.querySelector("#confirmBackBtn").addEventListener("click", () => { N.closeAndRemoveDialog(dialog); resolve(false); });
    dialog.addEventListener("click", event => { if (event.target === dialog) { N.closeAndRemoveDialog(dialog); resolve(false); } });
    dialog.addEventListener("cancel", event => { event.preventDefault(); N.closeAndRemoveDialog(dialog); resolve(false); });
  });
}

N.submitPublish = async function submitPublish(event) {
  event.preventDefault();
  const message = N.$("publishMessage");
  N.clearFieldErrors();
  message.textContent = "";

  if (N.state.imageUploading) {
    message.textContent = "图片正在上传中，请稍后提交";
    return;
  }

  if (!N.isVerifiedUser()) {
    message.textContent = "请先在「我的」页登录并同意用户协议，再发布互助。";
    N.requireVerified(message.textContent);
    return;
  }
  if (!N.profileComplete()) {
    message.textContent = "请先在「我的」页补全昵称、校区和楼栋";
    N.requireVerified(message.textContent);
    return;
  }

  let hasError = false;
  const title = N.$("titleInput").value.trim();
  if (!title) {
    N.$("titleError").textContent = "请填写物品名称";
    hasError = true;
  }

  const quantity = Number(N.$("quantityInput").value);
  if (quantity <= 0 || !Number.isInteger(quantity)) {
    N.$("quantityError").textContent = "数量至少为 1";
    hasError = true;
  }

  const contactWechat = N.$("wechatInput").value.trim();
  const contactQq = N.$("qqInput").value.trim();
  if (!contactWechat && !contactQq) {
    N.$("wechatError").textContent = "至少填一项";
    N.$("qqError").textContent = "至少填一项";
    hasError = true;
  }

  if (!N.$("disclaimerInput").checked) {
    N.$("disclaimerError").textContent = "请先确认发布声明";
    N.$("disclaimerRow").classList.add("field-error-border");
    hasError = true;
  }

  if (hasError) return;

  const useProfileLocation = N.$("useProfileLocationInput").checked;
  const campus = useProfileLocation ? N.state.user.campus : N.$("campusSelect").value.trim();
  const building = useProfileLocation ? N.state.user.building : N.$("buildingSelect").value.trim();
  const room = useProfileLocation ? N.state.user.room || "" : N.$("roomSelect").value.trim();
  const payload = {
    title,
    itemType: N.state.selectedPublishType,
    itemIcon: N.state.selectedIcon,
    category: N.currentPublishCategory(),
    quantity,
    unit: N.$("unitInput").value.trim(),
    campus,
    building,
    room,
    expireDate: N.$("noExpiryInput").checked ? "" : N.getExpireDate(),
    noExpiry: (N.state.selectedPublishType === "consumable" || N.state.selectedPublishType === "tool") && N.$("noExpiryInput").checked,
    description: N.$("descriptionInput").value.trim(),
    imageUrls: [...N.state.uploadedImageUrls],
    contactWechat,
    contactQq,
    disclaimerAccepted: true
  };

  const isEdit = Boolean(N.state.editingItemId);

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
      result = await N.api(`/me/items/${encodeURIComponent(N.state.editingItemId)}`, {
        method: "PUT",
        body: JSON.stringify({
          title: payload.title,
          quantity: payload.quantity,
          unit: payload.unit,
          description: payload.description,
          expireDate: payload.expireDate,
          noExpiry: payload.noExpiry,
          category: payload.category,
          imageUrls: payload.imageUrls,
          contactWechat: payload.contactWechat,
          contactQq: payload.contactQq
        })
      });
      N.state.editingItemId = "";
    } else {
      result = await N.api("/items", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }
    message.textContent = "";
    if (isEdit) {
      event.target.reset();
      N.$("quantityInput").value = "1";
      N.$("unitInput").value = "件";
      N.setExpireDate("2026-12-31");
      N.setDateRowDisabled(false);
      N.$("noExpiryInput").checked = false;
      N.$("useProfileLocationInput").checked = true;
      N.$("publishLocationFields").hidden = true;
      N.$("disclaimerInput").checked = false;
      N.resetUploadedImages();
      N.setPublishType(N.state.selectedPublishType);
      N.renderLocationSelects("publish");
      N.showToast(result.message || "已保存", "success");
    } else {
      const form = N.$("publishForm");
      const successCard = N.$("publishSuccessCard");
      if (form && successCard) {
        form.hidden = true;
        successCard.hidden = false;
        N.$("publishSuccessTitle").textContent = "发布成功";
        N.$("publishSuccessDesc").textContent = "你的「" + payload.title + "」已提交确认，审核通常需要 1-2 小时，通过后同楼同学就能看到了";
        successCard.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    N.loadMyItems();
  } catch (error) {
    message.textContent = N.errmsg(error, "提交失败");
    if (isEdit) {
      N.state.editingItemId = ""; // Clear stuck edit state on failure
    }
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "提交审核"; }
  }
};

})(window.NanE);
