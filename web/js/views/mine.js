window.NanE = window.NanE || {};
(function(N) {

N.renderProfileTrust = function renderProfileTrust(summary) {
  const profileCard = document.querySelector(".profile-card");
  if (!profileCard) return;
  const existing = N.$("profileTrustCard");
  if (!summary) {
    existing?.remove();
    return;
  }
  if (existing) {
    existing.outerHTML = N.profileTrustHTML(summary);
  } else {
    profileCard.insertAdjacentHTML("afterend", N.profileTrustHTML(summary));
  }
  N.refreshMotion(N.$("profileTrustCard"));
};

N.syncProfileForm = function syncProfileForm() {
  const card = N.$("profileFormCard");
  if (!card) return;
  if (!N.isVerifiedUser()) {
    card.hidden = true;
    return;
  }
  N.$("nicknameInput").value = N.state.user?.name || "";
  N.setSelectionByLocation("profile", N.state.user?.campus || "仙林校区", N.state.user?.building || "南苑 A 栋", N.state.user?.room || "");
  if (!N.profileComplete()) {
    card.hidden = false;
    N.$("profileMessage").textContent = "请补全账号资料后再发布或查看联系方式";
  } else {
    N.$("profileMessage").textContent = "";
  }
  if (N.state.user && !N.state.user.hasPassword) {
    N.switchLoginMode("setPassword");
  }
  N.syncSettingsAccount();
};

N.loadProfile = async function loadProfile() {
  try {
    const data = await N.api("/me");
    N.state.user = data.user;
    if (data.user) {
      localStorage.setItem(N.USER_KEY, JSON.stringify(data.user));
      N.$("profileName").textContent = data.user.name || "南易用户";
      N.$("profileCampus").textContent = `${data.user.campus || "未设置校区"} · ${data.user.building || "未设置楼栋"}${data.user.room ? ` · ${data.user.room}` : ""}`;
      N.$("verifyBadge").textContent = data.user.profileComplete ? "校园身份与楼栋已设置" : "请补全楼栋资料";
      N.renderProfileTrust(data.user.trustSummary);
    } else {
      N.clearSession();
      N.$("profileName").textContent = "欢迎来访";
      N.$("profileCampus").textContent = "登录后即可发布物品、查看联系方式";
      N.$("verifyBadge").textContent = "未登录";
      N.renderProfileTrust(null);
    }
    N.syncProfileForm();
  } catch (error) {
    N.$("profileName").textContent = "暂时无法读取账号";
    N.$("profileCampus").textContent = "服务连接异常，请稍后重试";
    N.$("verifyBadge").textContent = "未连接";
    N.renderProfileTrust(null);
  }
};

N.loadMyItems = async function loadMyItems() {
  const container = N.$("myItemList");
  if (!N.isVerifiedUser()) {
    container.innerHTML = N.emptyStateHTML("guest");
    N.$("pendingClaimsBanner").hidden = true;
    N.$("pendingReviewsBanner").hidden = true;
    N.refreshMotion(container);
    return;
  }
  const skHTML = '<div class="skeleton-card"><div class="skeleton-icon"></div><div class="skeleton-lines"><div class="skeleton-line w-60"></div><div class="skeleton-line w-80"></div><div class="skeleton-line w-40"></div></div></div>';
  container.innerHTML = skHTML + skHTML + skHTML;
  try {
    const [data, reviewData] = await Promise.all([
      N.api("/me/items"),
      N.api("/me/reviews/pending")
    ]);
    const sorted = [...data.items];
    sorted.sort((a, b) => {
      const aPending = (a.pendingClaimCount || 0) > 0 ? 1 : 0;
      const bPending = (b.pendingClaimCount || 0) > 0 ? 1 : 0;
      return bPending - aPending;
    });
    N.renderClaimsBanner(sorted);
    N.renderPendingReviews(reviewData.reviews || []);
    container.innerHTML = sorted.length
      ? sorted.map(item => N.renderItem(item, { showRoom: true, showStatus: true, showClaims: true, showOwnerActions: true })).join("")
      : N.emptyStateHTML("mine");
    N.refreshMotion(container);
    const hasPending = sorted.some(item => (item.pendingClaimCount || 0) > 0);
    if (hasPending && !N.state.claimsModalShown) {
      N.state.claimsModalShown = true;
      N.showClaimsModal(sorted);
    }
  } catch (error) {
    container.innerHTML = `<div class="state-card">${N.escapeHtml(N.errmsg(error, "加载失败"))}</div>`;
    N.$("pendingClaimsBanner").hidden = true;
    N.$("pendingReviewsBanner").hidden = true;
  }
};

N.renderClaimsBanner = function renderClaimsBanner(items) {
  const banner = N.$("pendingClaimsBanner");
  const list = N.$("pendingClaimsList");
  const countEl = N.$("pendingClaimsCount");
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
        <strong>${N.escapeHtml(item.title)}</strong>
        <span>${N.escapeHtml(claim.requesterName || "同学")} 提醒已领取 ${N.escapeHtml(claim.quantity || 1)}${N.escapeHtml(item.unit || "件")}</span>
      </div>
      <span class="claim-actions">
        <button type="button" class="primary small" data-claim-action="confirm" data-claim-id="${N.escapeHtml(claim.id)}">确认领取</button>
        <button type="button" class="secondary small" data-claim-action="reject" data-claim-id="${N.escapeHtml(claim.id)}">忽略</button>
      </span>
    </div>
  `).join("");
  N.refreshMotion(banner);
};

N.showClaimsModal = function showClaimsModal(items) {
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
  N.$("claimsModalBody").innerHTML = allClaims.map(({ claim, item }) => `
    <div class="claim-modal-row">
      <div class="claim-modal-info">
        <strong>${N.escapeHtml(item.title)}</strong>
        <span>${N.escapeHtml(claim.requesterName || "同学")} 提醒已领取 ${N.escapeHtml(claim.quantity || 1)}${N.escapeHtml(item.unit || "件")}</span>
      </div>
      <span class="claim-actions">
        <button type="button" class="primary small" data-claim-action="confirm" data-claim-id="${N.escapeHtml(claim.id)}">确认领取</button>
        <button type="button" class="secondary small" data-claim-action="reject" data-claim-id="${N.escapeHtml(claim.id)}">忽略</button>
      </span>
    </div>
  `).join("");
  N.refreshMotion(N.$("claimsModalBody"));
  N.showMotionDialog(N.$("claimsModal"));
};

N.refreshClaimsModal = function refreshClaimsModal() {
  const modal = N.$("claimsModal");
  if (!modal || !modal.open) return;
  const remaining = N.$("claimsModalBody").querySelectorAll(".claim-modal-row").length;
  if (remaining <= 1) {
    N.animateCloseDialog(modal);
    return;
  }
};

N.renderPendingReviews = function renderPendingReviews(reviews) {
  const banner = N.$("pendingReviewsBanner");
  const list = N.$("pendingReviewsList");
  const countEl = N.$("pendingReviewsCount");
  if (!banner || !list || !countEl) return;
  N.state.pendingReviews = Array.isArray(reviews) ? reviews : [];
  if (!N.state.pendingReviews.length) {
    banner.hidden = true;
    list.innerHTML = "";
    return;
  }
  banner.hidden = false;
  countEl.textContent = `${N.state.pendingReviews.length} 条待评价`;
  list.innerHTML = N.state.pendingReviews.map(review => `
    <div class="review-banner-row">
      <div class="claim-banner-info">
        <strong>${N.escapeHtml(review.itemTitle)}</strong>
        <span>${N.escapeHtml(review.reviewerRole === "owner" ? "领取同学" : "发布同学")}：${N.escapeHtml(review.revieweeName || "同学")} · ${N.escapeHtml(review.quantity || 1)}${N.escapeHtml(review.unit || "件")}</span>
      </div>
      <span class="claim-actions">
        <button type="button" class="primary small" data-review-action="open" data-claim-id="${N.escapeHtml(review.claimId)}">评价履约</button>
      </span>
    </div>
  `).join("");
  N.refreshMotion(banner);
};

N.loadPendingReviews = async function loadPendingReviews() {
  if (!N.isVerifiedUser()) {
    N.renderPendingReviews([]);
    return;
  }
  try {
    const data = await N.api("/me/reviews/pending");
    N.renderPendingReviews(data.reviews || []);
  } catch (error) {
    N.renderPendingReviews([]);
    N.showToast(N.errmsg(error, "待评价记录加载失败"), "error");
  }
};

N.openReviewDialog = function openReviewDialog(claimId) {
  const review = N.state.pendingReviews.find(item => item.claimId === claimId);
  if (!review) return;
  N.state.activeReviewClaimId = claimId;
  N.$("reviewDialogBody").innerHTML = `
    <div class="review-target">
      <strong>${N.escapeHtml(review.itemTitle)}</strong>
      <span>评价 ${N.escapeHtml(review.revieweeName || "同学")} 的本次履约</span>
    </div>
    <div class="review-tags" id="reviewTagList">
      ${N.REVIEW_TAGS.map(tag => `<button type="button" class="review-tag" data-review-tag="${N.escapeHtml(tag)}">${N.escapeHtml(tag)}</button>`).join("")}
    </div>
    <label class="checkbox-row review-issue-toggle">
      <input id="reviewIssueInput" type="checkbox">
      <span>本次履约遇到问题</span>
    </label>
    <textarea id="reviewCommentInput" rows="3" maxlength="160" placeholder="可选：补充一句对这次互助的说明"></textarea>
    <div class="form-message" id="reviewMessage"></div>
    <button type="button" class="primary wide" id="submitReviewButton">提交评价</button>
  `;
  N.refreshMotion(N.$("reviewDialogBody"));
  N.showMotionDialog(N.$("reviewDialog"));
};

N.renderReviewTags = function renderReviewTags(isIssue) {
  const list = N.$("reviewTagList");
  if (!list) return;
  const tags = isIssue ? N.ISSUE_REVIEW_TAGS : N.REVIEW_TAGS;
  list.innerHTML = tags.map(tag => `<button type="button" class="review-tag" data-review-tag="${N.escapeHtml(tag)}">${N.escapeHtml(tag)}</button>`).join("");
  N.refreshMotion(list);
  const comment = N.$("reviewCommentInput");
  if (comment) {
    comment.placeholder = isIssue ? "可选：说明遇到的问题，便于后续改进" : "可选：补充一句对这次互助的说明";
  }
};

N.submitReview = async function submitReview() {
  const claimId = N.state.activeReviewClaimId;
  if (!claimId) return;
  const selectedTags = [...N.$("reviewDialogBody").querySelectorAll(".review-tag.active")]
    .map(button => button.dataset.reviewTag);
  const outcome = N.$("reviewIssueInput")?.checked ? "issue" : "positive";
  const message = N.$("reviewMessage");
  if (!selectedTags.length) {
    message.textContent = "请至少选择一个履约标签";
    return;
  }
  const submitBtn = N.$("submitReviewButton");
  submitBtn.disabled = true;
  submitBtn.textContent = "提交中...";
  try {
    await N.api(`/claims/${encodeURIComponent(claimId)}/reviews`, {
      method: "POST",
      body: JSON.stringify({
        tags: selectedTags,
        outcome,
        comment: N.$("reviewCommentInput").value.trim()
      })
    });
    N.animateCloseDialog(N.$("reviewDialog"));
    N.state.activeReviewClaimId = "";
    N.showToast("履约评价已提交", "success");
    await Promise.all([N.loadPendingReviews(), N.loadHome(), N.loadMyItems()]);
  } catch (error) {
    message.textContent = N.errmsg(error, "提交评价失败");
    submitBtn.disabled = false;
    submitBtn.textContent = "提交评价";
  }
};

N.openMyItemDetail = async function openMyItemDetail(id) {
  try {
    const data = await N.api(`/me/items/${encodeURIComponent(id)}`);
    N.state.selectedDetail = data.item;
    N.state.editingItemId = id;
    N.$("detailTitle").textContent = data.item.title;
    const statusLabel = data.item.status !== "online" ? ` <span class="badge">${N.escapeHtml(N.statusText(data.item.status))}</span>` : "";
    N.$("detailBody").innerHTML = `
      ${N.itemGalleryHTML(data.item)}
      <p class="detail-meta">
        ${N.escapeHtml(data.item.itemTypeText)} · ${N.escapeHtml(data.item.category)} · 剩余 ${N.escapeHtml(data.item.quantity)}${N.escapeHtml(data.item.unit)}<br>
        ${N.escapeHtml(data.item.campus)} · ${N.escapeHtml(data.item.building)}${data.item.room ? ` · ${N.escapeHtml(data.item.room)}` : ""}<br>
        有效期：${N.escapeHtml(N.expiryText(data.item))}<br>
        状态：${N.escapeHtml(N.statusText(data.item.status))}${statusLabel}
      </p>
      ${N.trustSummaryHTML(data.item.ownerTrustSummary, "card")}
      ${data.item.rejectReason ? `<p class="item-desc">驳回原因：${N.escapeHtml(data.item.rejectReason)}</p>` : ""}
      <p class="item-desc">${N.escapeHtml(data.item.description || "暂未填写补充信息")}</p>
      <div class="contact-box">
        微信：${N.escapeHtml(data.item.contact?.wechat || "未填写")}<br>
        QQ：${N.escapeHtml(data.item.contact?.qq || "未填写")}
      </div>
      ${data.item.claimRequests?.length ? `
        <div class="claim-panel">
          <div class="claim-title">待确认领取提醒 ${N.escapeHtml(data.item.claimRequests.length)} 条</div>
          ${data.item.claimRequests.map(claim => `
            <div class="claim-row">
              <span>${N.escapeHtml(claim.requesterName || "同学")} 提醒已领取 ${N.escapeHtml(claim.quantity || 1)}${N.escapeHtml(data.item.unit || "件")}</span>
              <span class="claim-actions">
                <button type="button" class="primary small" data-claim-action="confirm" data-claim-id="${N.escapeHtml(claim.id)}">确认领取</button>
                <button type="button" class="secondary small" data-claim-action="reject" data-claim-id="${N.escapeHtml(claim.id)}">忽略</button>
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
    N.refreshMotion(N.$("detailBody"));
    N.showMotionDialog(N.$("detailDialog"));
  } catch (error) {
    N.showToast(N.errmsg(error, "详情加载失败"), "error");
  }
};

N.startEditItem = function startEditItem() {
  const item = N.state.selectedDetail;
  if (!item) return;
  N.animateCloseDialog(N.$("detailDialog"));
  N.switchView("publish");
  N.state.selectedPublishType = item.itemType || "consumable";
  N.state.selectedIcon = item.itemIcon || "plus";
  N.state.iconOtherOpen = false;
  document.querySelectorAll(".segment").forEach(button => {
    button.classList.toggle("active", button.dataset.itemType === N.state.selectedPublishType);
  });
  N.$("titleInput").value = item.title || "";
  N.$("quantityInput").value = item.quantity || 1;
  N.$("unitInput").value = item.unit || "件";
  N.$("descriptionInput").value = item.description || "";
  N.$("wechatInput").value = item.contact?.wechat || "";
  N.$("qqInput").value = item.contact?.qq || "";
  N.state.uploadedImageUrls = Array.isArray(item.imageUrls) ? [...item.imageUrls].slice(0, 3) : [];
  N.renderImagePreviews();
  N.$("medicineCategoryWrap").hidden = item.itemType !== "medicine";
  N.$("toolCategoryWrap").hidden = item.itemType !== "tool";
  if (item.itemType === "medicine") {
    const catSelect = N.$("categorySelect");
    if (catSelect) catSelect.value = item.category || "感冒药";
  } else if (item.itemType === "tool") {
    const toolCat = N.$("toolCategorySelect");
    if (toolCat) toolCat.value = item.category || "常用工具";
  }
  if (item.itemType === "tool") {
    N.$("publishRulesText").textContent = "常用工具免费借用或赠送。请注明借用时长与归还方式。禁止危险工具及任何收费转让。发布后需经人工审核。";
    N.$("typeHint").textContent = "适用于偶尔需要但不常备的小工具，如锤子、镊子、砂纸、热熔胶枪等。建议注明是借用还是赠送。";
  } else if (item.itemType === "medicine") {
    N.$("publishRulesText").textContent = "仅限非处方常见药品，按大类笼统选择。禁止处方药、管制药品、拆封不明药品及任何收费转让。药品须填写有效期。发布后需经人工审核。";
    N.$("typeHint").textContent = "药品仅限非处方常见药品，按大类选择即可。禁止处方药、管制药品及任何收费转让。";
  } else {
    N.$("publishRulesText").textContent = "应急耗材免费共享，适用于创可贴、碘伏棉签、口罩、消毒用品等低风险物品。发布后需经人工审核。";
    N.$("typeHint").textContent = "适用于创可贴、碘伏棉签、口罩、消毒用品等低风险应急物品，无需细分品类。";
  }
  if (item.noExpiry) {
    N.$("noExpiryInput").checked = true;
    N.setDateRowDisabled(true);
  } else {
    N.$("noExpiryInput").checked = false;
    N.setDateRowDisabled(false);
    N.setExpireDate(item.expireDate || "");
  }
  N.$("noExpiryWrap").hidden = item.itemType === "medicine";
  if (item.itemType === "tool") N.$("noExpiryWrap").hidden = false;
  N.$("useProfileLocationInput").checked = false;
  N.$("publishLocationFields").hidden = false;
  N.setSelectionByLocation("publish", item.campus || "仙林校区", item.building || "南苑 A 栋", item.room || "");
  N.renderIconGrid();
  N.$("publishMessage").textContent = "正在编辑物品，提交后将重新进入审核";
  document.querySelector(".segment[data-item-type='" + N.state.selectedPublishType + "']")?.classList.add("active");
  N.updateCharCounts();
  N.clearFieldErrors();
};

N.takeDownMyItem = async function takeDownMyItem() {
  const item = N.state.selectedDetail;
  if (!item) return;
  const ok = await N.showConfirmDialog("确定要删除这条发布记录吗？上架中或审核中的物品会同时下架。");
  if (!ok) return;
  try {
    const data = await N.api(`/me/items/${encodeURIComponent(item.id)}/delete`, { method: "POST" });
    N.$("ownerActionResult").innerHTML = `<div class="contact-box">${N.escapeHtml(data.message || "发布记录已删除。")}</div>`;
    await Promise.all([N.loadHome(), N.loadMyItems()]);
    setTimeout(() => N.animateCloseDialog(N.$("detailDialog")), 1200);
  } catch (error) {
    N.$("ownerActionResult").innerHTML = `<div class="contact-box">${N.escapeHtml(N.errmsg(error, "删除失败"))}</div>`;
  }
};

N.handleListDelete = async function handleListDelete(itemId, button) {
  const ok = await N.showConfirmDialog("确定要删除这条发布记录吗？上架中或审核中的物品会同时下架。");
  if (!ok) return;
  button.disabled = true;
  button.textContent = "删除中...";
  try {
    await N.api(`/me/items/${encodeURIComponent(itemId)}/delete`, { method: "POST" });
    const card = button.closest(".item-card");
    if (card) {
      card.classList.add("card-removing");
      card.addEventListener("animationend", () => {
        Promise.all([N.loadHome(), N.loadMyItems()]).catch(() => {});
      }, { once: true });
    } else {
      await Promise.all([N.loadHome(), N.loadMyItems()]);
    }
  } catch (error) {
    N.showToast(N.errmsg(error, "删除失败"), "error");
    button.disabled = false;
    button.textContent = "删除";
  }
};

N.reviewClaimFromButton = async function reviewClaimFromButton(button) {
  const claimId = button.dataset.claimId;
  const action = button.dataset.claimAction;
  if (!claimId || !action) return;
  button.disabled = true;
  button.textContent = action === "confirm" ? "确认中..." : "处理中...";
  try {
    const data = await N.api(`/claims/${encodeURIComponent(claimId)}/${action}`, { method: "POST" });
    if (action === "confirm") {
      button.textContent = "✓ 已确认";
      button.classList.add("claim-confirmed");
      const card = button.closest(".item-card");
      if (card) {
        setTimeout(() => {
          if (!card.isConnected) return;
          card.classList.add("card-removing");
          card.addEventListener("animationend", () => {
            Promise.all([N.loadHome(), N.loadProfile(), N.loadMyItems()]).catch(() => {});
          }, { once: true });
        }, 1200);
      }
    } else {
      await Promise.all([N.loadHome(), N.loadProfile(), N.loadMyItems()]);
    }
  } catch (error) {
    N.showToast(N.errmsg(error, "处理失败"), "error");
    button.disabled = false;
    button.textContent = action === "confirm" ? "确认领取" : "忽略";
  }
};

})(window.NanE);
