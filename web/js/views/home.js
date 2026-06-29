window.NanE = window.NanE || {};
(function(N) {

const HOME_PAGE_SIZE = 20;

N.HOME_PAGE_SIZE = HOME_PAGE_SIZE;

N.renderItem = function renderItem(item, options) {
  if (options === void 0) options = {};
  const typeClass = `badge badge-${item.itemType || "consumable"}`;
  const badges = [
    `<span class="${typeClass}">${N.escapeHtml(item.itemTypeText || "耗材")}</span>`,
    `<span class="badge">${N.escapeHtml(item.category || "应急耗材")}</span>`
  ];
  if (options.showStatus && item.status && item.status !== "online") {
    badges.push(`<span class="badge">${N.escapeHtml(N.statusText(item.status))}</span>`);
  }
  const expiry = N.expiryBadge(item);
  if (expiry) badges.push(expiry);
  const claimPanel = options.showClaims && item.claimRequests?.length
    ? `<div class="claim-panel">
        <div class="claim-title">待确认领取提醒 ${N.escapeHtml(item.claimRequests.length)} 条</div>
        ${item.claimRequests.map(claim => `
          <div class="claim-row">
            <span>${N.escapeHtml(claim.requesterName || "同学")} 提醒已领取 ${N.escapeHtml(claim.quantity || 1)}${N.escapeHtml(item.unit || "件")}</span>
            <span class="claim-actions">
              <button type="button" class="primary small" data-claim-action="confirm" data-claim-id="${N.escapeHtml(claim.id)}">确认领取</button>
              <button type="button" class="secondary small" data-claim-action="reject" data-claim-id="${N.escapeHtml(claim.id)}">忽略</button>
            </span>
          </div>
        `).join("")}
      </div>`
    : "";
  const ownerActions = options.showOwnerActions
    ? `<div class="owner-actions">
        <button type="button" class="primary small" data-owner-action="edit" data-item-id="${N.escapeHtml(item.id)}">编辑</button>
        <button type="button" class="danger small" data-owner-action="delete" data-item-id="${N.escapeHtml(item.id)}">删除</button>
      </div>`
    : "";
  const trust = item.ownerTrustSummary || {};
  const trustTags = Array.isArray(trust.topTags) ? trust.topTags : [];
  const praiseCount = Number(trust.positiveReviewCount || 0);
  const trustBadge = praiseCount >= 1
    ? `<span class="trust-mini-badge">好评 ${N.escapeHtml(praiseCount)} 次</span>`
    : "";
  const created = N.compactDate(item.createdAt);
  return `
    <article class="item-card ${N.itemExpiredClass(item)}" data-id="${N.escapeHtml(item.id)}">
      ${N.itemMediaHTML(item)}
      <div class="item-main">
        <div class="item-title-row">
          <h3>${N.escapeHtml(item.title)}</h3>
          <div class="item-location">${N.escapeHtml(item.campus)} · ${N.escapeHtml(item.building)}${options.showRoom && item.room ? ` · ${N.escapeHtml(item.room)}` : ""}</div>
        </div>
        <p class="item-desc">${N.escapeHtml(item.description || "暂未填写补充信息")}</p>
        <div class="badges">${badges.join("")}${item.quantity > 1 ? `<span class="badge badge-qty">剩 ${N.escapeHtml(item.quantity)}${N.escapeHtml(item.unit || "件")}</span>` : ""}</div>
        <div class="item-footer">
          <span class="owner-mini">
            <span class="owner-avatar">${N.avatarInitial(item.ownerName)}</span>
            <span>${N.escapeHtml(item.ownerName || "南易同学")}</span>
            ${trustBadge}
          </span>
          ${created ? `<time datetime="${N.escapeHtml(item.createdAt)}">${N.escapeHtml(created)}</time>` : ""}
        </div>
        ${item.rejectReason ? `<p class="item-desc">驳回原因：${N.escapeHtml(item.rejectReason)}</p>` : ""}
        ${item.status === "rejected" && options.showOwnerActions ? `<button type="button" class="primary small" data-owner-action="resubmit" data-item-id="${N.escapeHtml(item.id)}" style="margin-top:8px">重新发布</button>` : ""}
        ${claimPanel}
        ${ownerActions}
      </div>
    </article>
  `;
};

N.loadHome = async function loadHome() {
  const banner = N.$("welcomeBanner");
  if (banner) banner.hidden = N.isVerifiedUser();
  N.$("homeState").textContent = "";
  const moreBtn = N.$("homeLoadMore");
  if (moreBtn) moreBtn.hidden = true;
  N.state.homeOffset = 0;
  N.state.homeHasMore = false;
  const skeletonHTML = '<div class="skeleton-card"><div class="skeleton-icon"></div><div class="skeleton-lines"><div class="skeleton-line w-60"></div><div class="skeleton-line w-80"></div><div class="skeleton-line w-40"></div></div></div>';
  N.$("itemList").innerHTML = skeletonHTML + skeletonHTML + skeletonHTML;
  try {
    const keyword = N.$("keywordInput").value.trim();
    const params = new URLSearchParams();
    params.set("limit", HOME_PAGE_SIZE);
    params.set("offset", "0");
    if (keyword) params.set("keyword", keyword);
    if (N.DEBUG_MODE) params.set("debug", "true");

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

    const data = await N.api(`/items${params.toString() ? `?${params}` : ""}`);
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

    // Apply building filter client-side
    if (N.state.buildingFilter) {
      items = items.filter(item => item.building === N.state.buildingFilter);
    }

    N.state.homeHasMore = data.hasMore;
    N.state.homeOffset = items.length;

    N.$("viewerLabel").textContent = `${data.viewer?.campus || "当前校区"} · ${data.viewer?.building || "当前楼栋"} · 优先展示近邻${data.total ? ` · 共 ${data.total} 件` : ""}`;
    if (!items.length) {
      N.$("homeState").innerHTML = N.emptyStateHTML(keyword ? "search" : "home");
    } else {
      N.$("homeState").textContent = "";
    }
    const list = N.$("itemList");
    list.innerHTML = items.map(item => N.renderItem(item)).join("");
    N.refreshMotion(list);
    list.classList.add("list-dirty");
    list.addEventListener("animationend", () => list.classList.remove("list-dirty"), { once: true });
    N.updateLoadMoreButton();
    N.loadActivity();
  } catch (error) {
    N.$("viewerLabel").textContent = "API 未连接";
    N.$("homeState").innerHTML = N.emptyStateHTML("error", N.errmsg(error, "网络连接失败"));
  }
};

N.loadMoreHome = async function loadMoreHome() {
  const btn = N.$("homeLoadMore");
  if (!btn) return;
  btn.classList.add("is-loading");
  btn.textContent = "加载中...";
  btn.disabled = true;
  try {
    const keyword = N.$("keywordInput").value.trim();
    const params = new URLSearchParams();
    params.set("limit", HOME_PAGE_SIZE);
    params.set("offset", N.state.homeOffset);
    if (keyword) params.set("keyword", keyword);
    if (N.DEBUG_MODE) params.set("debug", "true");

    const data = await N.api(`/items${params.toString() ? `?${params}` : ""}`);
    N.state.homeHasMore = data.hasMore;
    N.state.homeOffset += data.items.length;

    const list = N.$("itemList");
    list.insertAdjacentHTML("beforeend", data.items.map(item => N.renderItem(item)).join(""));
    N.refreshMotion(list);
    list.classList.add("list-dirty");
    list.addEventListener("animationend", () => list.classList.remove("list-dirty"), { once: true });
    N.updateLoadMoreButton();
  } catch (error) {
    N.showToast("加载失败，请稍后重试", "error");
  } finally {
    btn.classList.remove("is-loading");
    btn.disabled = false;
  }
};

N.updateLoadMoreButton = function updateLoadMoreButton() {
  const btn = N.$("homeLoadMore");
  if (!btn) return;
  if (N.state.homeHasMore) {
    btn.hidden = false;
    btn.textContent = "加载更多";
  } else {
    btn.hidden = true;
  }
};

N.openDetail = async function openDetail(id) {
  try {
    N.state.contactViewedForItem = "";
    const data = await N.api(`/items/${encodeURIComponent(id)}`);
    N.state.selectedDetail = data.item;
    N.$("detailTitle").textContent = data.item.title;
    N.$("detailBody").innerHTML = `
      ${N.itemGalleryHTML(data.item)}
      <p class="detail-meta">${N.escapeHtml(data.item.campus)} · ${N.escapeHtml(data.item.building)}<br>
      ${N.escapeHtml(data.item.itemTypeText)} · ${N.escapeHtml(data.item.category)} · 剩余 ${N.escapeHtml(data.item.quantity)}${N.escapeHtml(data.item.unit)}<br>
      有效期：${N.escapeHtml(N.expiryText(data.item))} · ${N.escapeHtml(data.item.distanceLabel || "")}</p>
      <p class="item-desc">${N.escapeHtml(data.item.description || "暂未填写补充信息")}</p>
      ${N.trustSummaryHTML(data.item.ownerTrustSummary, "card")}
      <div class="notice-line">本平台仅提供信息匹配，不涉及物品流转。领取前请自行检查物品状况与适用性，评估使用风险。平台禁止处方药、管制药品及任何收费行为。</div>
      <button class="primary wide" id="contactButton">${N.isVerifiedUser() && N.profileComplete() ? "查看联系方式" : "登录并完善资料后查看联系方式"}</button>
      <div id="contactResult"></div>
      <button class="secondary wide" id="shareItemButton" style="margin-top:8px">复制物品链接分享给同学</button>
      <button class="secondary wide" id="reportItemButton" style="margin-top:4px;color:var(--muted)">举报此物品</button>
    `;
    N.refreshMotion(N.$("detailBody"));
    const shareBtn = N.$("detailBody").querySelector("#shareItemButton");
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
            N.animateCloseDialog(N.$("detailDialog"));
            N.showToast("链接已复制，发送给同学即可快速查看", "success");
          }).catch(() => {
            if (!fallbackCopy(urlStr)) N.showToast("复制失败，请手动复制地址栏链接", "error");
            else { N.animateCloseDialog(N.$("detailDialog")); N.showToast("链接已复制", "success"); }
          });
        } else {
          if (fallbackCopy(urlStr)) { N.animateCloseDialog(N.$("detailDialog")); N.showToast("链接已复制", "success"); }
          else N.showToast("复制失败，请手动复制地址栏链接", "error");
        }
      });
    }
    N.showMotionDialog(N.$("detailDialog"));
  } catch (error) {
    N.showToast(N.errmsg(error, "详情加载失败"), "error");
  }
};

N.viewContact = async function viewContact() {
  if (!N.state.selectedDetail) return;
  if (!N.requireVerified("请先登录并同意用户协议，再查看微信或 QQ 联系方式。", () => {
    N.openDetail(N.state.selectedDetail?.id).then(() => setTimeout(N.viewContact, 400));
  })) {
    N.animateCloseDialog(N.$("detailDialog"));
    return;
  }
  if (N.state.contactViewedForItem === N.state.selectedDetail.id) return;
  try {
    const data = await N.api(`/items/${encodeURIComponent(N.state.selectedDetail.id)}/contact`, { method: "POST" });
    N.state.contactViewedForItem = N.state.selectedDetail.id;
    const noteText = data.alreadyViewed
      ? "今天已查看过该联系方式，本次不重复计入次数。"
      : "为保护每位同学的隐私，请不要将联系方式外传。";
    const fields = [];
    if (data.contact?.wechat) fields.push(`<div class="contact-field"><span class="contact-label">微信</span><span class="contact-value">${N.escapeHtml(data.contact.wechat)}</span></div>`);
    if (data.contact?.qq) fields.push(`<div class="contact-field"><span class="contact-label">QQ</span><span class="contact-value">${N.escapeHtml(data.contact.qq)}</span></div>`);
    if (!fields.length) fields.push(`<div class="contact-field"><span class="contact-value">暂未填写联系方式</span></div>`);
    const remainingNote = data.remainingViews !== undefined
      ? ` · 今日还可查看 ${N.escapeHtml(data.remainingViews)} 次`
      : "";
    N.$("contactResult").innerHTML = `
      <div class="contact-box">
        ${fields.join("")}
        <span class="contact-note">${noteText}${remainingNote}</span>
      </div>
      <div class="claim-quantity-row" style="display:flex;align-items:center;gap:8px;margin-top:12px">
        <label for="claimQuantityInput" style="white-space:nowrap;font-size:14px">领取数量</label>
        <input id="claimQuantityInput" type="number" min="1" max="${N.escapeHtml(N.state.selectedDetail.quantity)}" value="1" style="width:70px;text-align:center">
        <span style="font-size:13px;color:var(--muted)">/ ${N.escapeHtml(N.state.selectedDetail.quantity)} ${N.escapeHtml(N.state.selectedDetail.unit || "件")}</span>
      </div>
      <button class="primary wide claim-button" id="claimButton">提醒发布者确认</button>
      <div id="claimResult"></div>
    `;
    N.refreshMotion(N.$("contactResult"));
    const btn = N.$("contactButton");
    if (btn) {
      btn.textContent = "已查看联系方式 ✓";
      btn.disabled = true;
      btn.classList.add("contact-viewed");
    }
    N.loadProfile();
  } catch (error) {
    N.$("contactResult").innerHTML = `<div class="contact-box">${N.escapeHtml(N.errmsg(error, "查看失败"))}</div>`;
    N.refreshMotion(N.$("contactResult"));
  }
};

N.requestClaim = async function requestClaim() {
  if (!N.state.selectedDetail) return;
  if (!N.requireVerified("请先登录并补全账号资料，再提醒发布者确认领取。", () => {
    N.openDetail(N.state.selectedDetail?.id).then(() => setTimeout(N.requestClaim, 400));
  })) {
    N.animateCloseDialog(N.$("detailDialog"));
    return;
  }
  const claimBtn = N.$("claimButton");
  if (!claimBtn) return;
  const qtyInput = N.$("claimQuantityInput");
  const claimQuantity = qtyInput ? Math.max(1, Math.min(parseInt(qtyInput.value) || 1, N.state.selectedDetail?.quantity || 1)) : 1;
  claimBtn.disabled = true;
  claimBtn.textContent = "正在发送提醒...";
  try {
    const data = await N.api(`/items/${encodeURIComponent(N.state.selectedDetail.id)}/claim`, {
      method: "POST",
      body: JSON.stringify({ quantity: claimQuantity })
    });
    claimBtn.textContent = "您已提醒过发布者确认领取，请等待对方处理";
    claimBtn.classList.add("disabled-claim");
    N.state.activeClaimId = data.claimRequest?.id || "";
    N.$("claimResult").innerHTML = `
      <div class="contact-box">${N.escapeHtml(data.message || "已发送领取提醒")}</div>
      <button class="secondary wide" id="cancelClaimButton" style="margin-top:8px">取消提醒</button>
    `;
    N.refreshMotion(N.$("claimResult"));
  } catch (error) {
    claimBtn.disabled = false;
    claimBtn.textContent = "提醒发布者确认";
    N.$("claimResult").innerHTML = `<div class="contact-box">${N.escapeHtml(N.errmsg(error, "发送领取提醒失败"))}</div>`;
    N.refreshMotion(N.$("claimResult"));
  }
};

N.reportItem = async function reportItem() {
  if (!N.state.selectedDetail) return;
  if (!N.requireVerified("请先登录后再举报。")) return;
  const reasons = ["虚假信息", "违禁物品", "涉及收费", "骚扰信息", "其他问题"];
  const dialog = document.createElement("dialog");
  dialog.className = "confirm-dialog";
  dialog.innerHTML = `
    <div class="confirm-dialog-content" style="max-width:360px">
      <h3>举报物品</h3>
      <p style="margin:0 0 12px;font-size:14px">「${N.escapeHtml(N.state.selectedDetail.title)}」</p>
      <div id="reportReasons" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
        ${reasons.map(r => `<button type="button" class="chip" data-reason="${r}">${r}</button>`).join("")}
      </div>
      <textarea id="reportComment" rows="2" maxlength="200" placeholder="可选：补充说明（200字以内）" style="width:100%;margin-bottom:12px"></textarea>
      <div class="confirm-actions">
        <button class="primary wide" id="submitReportBtn" type="button">提交举报</button>
        <button class="secondary wide" id="cancelReportBtn" type="button">取消</button>
      </div>
      <div class="form-message" id="reportMessage"></div>
    </div>
  `;
  document.body.appendChild(dialog);
  N.showMotionDialog(dialog);
  let selectedReason = "";

  dialog.querySelector("#reportReasons").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-reason]");
    if (!chip) return;
    dialog.querySelectorAll("#reportReasons .chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    selectedReason = chip.dataset.reason;
  });

  dialog.querySelector("#cancelReportBtn").addEventListener("click", () => N.closeAndRemoveDialog(dialog));
  dialog.querySelector("#submitReportBtn").addEventListener("click", async () => {
    const msg = dialog.querySelector("#reportMessage");
    if (!selectedReason) { msg.textContent = "请选择举报原因"; return; }
    try {
      await N.api(`/items/${encodeURIComponent(N.state.selectedDetail.id)}/report`, {
        method: "POST",
        body: JSON.stringify({ reason: selectedReason, comment: dialog.querySelector("#reportComment").value.trim() })
      });
      N.closeAndRemoveDialog(dialog);
      N.showToast("举报已提交，管理员会尽快处理", "success");
    } catch (error) {
      msg.textContent = N.errmsg(error, "举报提交失败");
    }
  });
};

N.filterByBuilding = function filterByBuilding(building) {
  N.state.buildingFilter = building || "";
  N.updateBuildingFilterSelect();
  N.loadHome();
};

N.updateBuildingFilterSelect = function updateBuildingFilterSelect() {
  const select = N.$("buildingFilterSelect");
  if (!select) return;
  const selected = N.state.buildingFilter || "";
  select.classList.toggle("active", Boolean(selected));
  select.querySelectorAll("[data-building]").forEach(option => {
    option.classList.toggle("selected", (option.dataset.building || "") === selected);
  });
};

N.renderBuildingChips = function renderBuildingChips() {
  const select = N.$("buildingFilterSelect");
  const dropdown = N.$("buildingFilterDropdown");
  const filterChips = N.$("filterChips");
  if (!select || !dropdown) return;
  const user = N.state.user || {};
  const locations = N.state.locations || [];
  const campus = locations.find(c => c.name === (user.campus || "仙林校区"));
  const buildings = campus?.buildings || [];

  if (buildings.length <= 1) {
    select.hidden = true;
    filterChips?.classList.remove("has-building-filter");
    N.state.buildingFilter = "";
    return;
  }

  select.hidden = false;
  filterChips?.classList.add("has-building-filter");
  if (N.state.buildingFilter && !buildings.some(building => building.name === N.state.buildingFilter)) {
    N.state.buildingFilter = "";
  }
  dropdown.innerHTML = `<li data-building="">全部楼栋</li>${buildings
    .map(building => `<li data-building="${N.escapeHtml(building.name)}">${N.escapeHtml(building.name)}</li>`)
    .join("")}`;
  N.updateBuildingFilterSelect();
};

N.cancelClaim = async function cancelClaim() {
  const cancelBtn = N.$("cancelClaimButton");
  if (!cancelBtn) return;
  const claimId = N.state.activeClaimId;
  if (!claimId) {
    N.showToast("未找到待取消的领取提醒", "info");
    return;
  }
  cancelBtn.disabled = true;
  cancelBtn.textContent = "取消中...";
  try {
    await N.api(`/claims/${encodeURIComponent(claimId)}/cancel`, { method: "POST" });
    N.state.activeClaimId = "";
    N.$("claimResult").innerHTML = `<div class="contact-box">已取消领取提醒</div>`;
    N.showToast("已取消领取提醒", "success");
  } catch (error) {
    N.showToast(N.errmsg(error, "取消失败"), "error");
    cancelBtn.disabled = false;
    cancelBtn.textContent = "取消提醒";
  }
};

N.loadActivity = async function loadActivity() {
  const feed = N.$("activityFeed");
  const head = N.$("activitySectionHead");
  if (!feed || !head) return;
  const user = N.state.user;
  const campus = user?.campus || "仙林校区";
  const building = user?.building || "";
  if (!building || building === "未设置楼栋") {
    feed.innerHTML = "";
    head.hidden = true;
    return;
  }
  try {
    const data = await N.api(`/activity?campus=${encodeURIComponent(campus)}&building=${encodeURIComponent(building)}&limit=10`);
    N.$("activityLabel").textContent = `${data.campus} · ${data.building} · 最近分享与互助`;
    if (!data.activities?.length) {
      feed.innerHTML = "";
      head.hidden = true;
      return;
    }
    head.hidden = false;
    feed.innerHTML = data.activities.map(a => {
      const icon = a.eventType === "claimed" ? "" : "";
      const text = a.eventType === "claimed"
        ? `${N.escapeHtml(a.claimerName || "同学")} 领了 ${N.escapeHtml(a.ownerName || "同学")} 的「${N.escapeHtml(a.itemTitle)}」`
        : `${N.escapeHtml(a.ownerName || "同学")} 分享了「${N.escapeHtml(a.itemTitle)}」`;
      return `
        <div class="activity-item" data-item-id="${N.escapeHtml(a.itemId)}">
          <div class="act-icon">${icon}</div>
          <div class="act-title">${text}</div>
          <div class="act-meta">${N.escapeHtml(N.compactDate(a.eventTime) || "")}</div>
        </div>
      `;
    }).join("");
    N.refreshMotion(feed);
  } catch (error) {
    feed.innerHTML = "";
    head.hidden = true;
  }
};

N.renderSubChips = function renderSubChips(itemType) {
  const sub = N.$("subFilterChips");
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
  N.refreshMotion(sub);
};

})(window.NanE);
