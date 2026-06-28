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
        <div class="badges">${badges.join("")}</div>
        <div class="item-footer">
          <span class="owner-mini">
            <span class="owner-avatar">${N.avatarInitial(item.ownerName)}</span>
            <span>${N.escapeHtml(item.ownerName || "南易同学")}</span>
            ${trustBadge}
          </span>
          ${created ? `<time datetime="${N.escapeHtml(item.createdAt)}">${N.escapeHtml(created)}</time>` : ""}
        </div>
        ${item.rejectReason ? `<p class="item-desc">驳回原因：${N.escapeHtml(item.rejectReason)}</p>` : ""}
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
    N.$("contactResult").innerHTML = `
      <div class="contact-box">
        ${fields.join("")}
        <span class="contact-note">${noteText}</span>
      </div>
      <button class="primary wide claim-button" id="claimButton">我已联系并领取，提醒发布者确认</button>
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
  claimBtn.disabled = true;
  claimBtn.textContent = "正在发送提醒...";
  try {
    const data = await N.api(`/items/${encodeURIComponent(N.state.selectedDetail.id)}/claim`, {
      method: "POST",
      body: JSON.stringify({ quantity: 1 })
    });
    claimBtn.textContent = "您已提醒过发布者确认领取，请等待对方处理";
    claimBtn.classList.add("disabled-claim");
    N.$("claimResult").innerHTML = `<div class="contact-box">${N.escapeHtml(data.message || "已发送领取提醒")}</div>`;
    N.refreshMotion(N.$("claimResult"));
  } catch (error) {
    claimBtn.disabled = false;
    claimBtn.textContent = "我已联系并领取，提醒发布者确认";
    N.$("claimResult").innerHTML = `<div class="contact-box">${N.escapeHtml(N.errmsg(error, "发送领取提醒失败"))}</div>`;
    N.refreshMotion(N.$("claimResult"));
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
