window.NanE = window.NanE || {};
(function(N) {

const icons = {
  plus: "+",
  bandage: "",
  notesMedical: "",
  kitMedical: "",
  capsules: "",
  pills: "",
  tablets: "",
  prescriptionBottleMedical: "",
  temperatureHalf: "",
  maskFace: "",
  shieldVirus: "",
  pumpMedical: "",
  bottleDroplet: "",
  box: "",
  boxOpen: "",
  droplet: "",
  handHoldingMedical: "",
  heartPulse: "",
  syringe: "",
  soap: ""
};

const REVIEW_TAGS = ["沟通顺畅", "按约交接", "物品真实", "及时确认", "友善可信"];
const ISSUE_REVIEW_TAGS = ["物品不符", "未按约时间", "联系方式无效", "沟通不顺", "未完成交接"];

const iconOptions = [
  ["plus", "通用"],
  ["bandage", "创可贴"],
  ["notesMedical", "护理单"],
  ["kitMedical", "急救包"],
  ["capsules", "胶囊"],
  ["pills", "药丸"],
  ["tablets", "药片"],
  ["prescriptionBottleMedical", "药瓶"],
  ["temperatureHalf", "体温"],
  ["maskFace", "口罩"],
  ["shieldVirus", "防护"],
  ["pumpMedical", "消毒液"],
  ["bottleDroplet", "滴剂"],
  ["box", "盒装"],
  ["boxOpen", "开盒"],
  ["droplet", "液体"],
  ["handHoldingMedical", "互助"],
  ["heartPulse", "健康"],
  ["syringe", "器具"],
  ["soap", "清洁"]
];

N.icons = icons;
N.REVIEW_TAGS = REVIEW_TAGS;
N.ISSUE_REVIEW_TAGS = ISSUE_REVIEW_TAGS;
N.iconOptions = iconOptions;

N.escapeHtml = function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
};

N.iconGlyph = function iconGlyph(key, itemType) {
  return icons[key] || icons[itemType === "medicine" ? "capsules" : "plus"] || "+";
};

N.avatarInitial = function avatarInitial(name) {
  const text = String(name || "南").trim();
  return N.escapeHtml(text.slice(0, 1) || "南");
};

N.statusText = function statusText(status) {
  return {
    reviewing: "审核中",
    online: "上架中",
    rejected: "已驳回",
    taken_down: "已下架",
    claimed: "已领取",
    expired: "已过期"
  }[status] || status;
};

N.expiryBadge = function expiryBadge(item) {
  if (item.noExpiry) {
    return `<span class="badge success">长期有效</span>`;
  }
  if (!item.expireDate) {
    return "";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${item.expireDate}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) {
    return "";
  }
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  if (days < 0) {
    return `<span class="badge expired-badge">已过期</span>`;
  }
  if (days <= 3) {
    return `<span class="badge urgency-critical">⏳ 还剩 ${days} 天</span>`;
  }
  if (days <= 7) {
    return `<span class="badge urgency-warn">⏳ 还剩 ${days} 天</span>`;
  }
  if (days <= 15) {
    return `<span class="badge warning">还有 ${days} 天到期</span>`;
  }
  return "";
};

N.trustSummaryHTML = function trustSummaryHTML(summary, variant) {
  if (variant === void 0) variant = "compact";
  const completed = Number(summary?.completedCount || 0);
  const given = Number(summary?.givenCount || 0);
  const received = Number(summary?.receivedCount || 0);
  const tags = Array.isArray(summary?.topTags) ? summary.topTags.slice(0, 3) : [];
  const tagHTML = tags.map(tag => `<span class="trust-tag">${N.escapeHtml(tag)}</span>`).join("");
  if (variant === "card") {
    return `
      <div class="trust-card">
        <div class="trust-card-head">
          <strong>发布者可信记录</strong>
          <span>已送出 ${N.escapeHtml(given)} 件 · 已领取 ${N.escapeHtml(received)} 件</span>
        </div>
        <div class="trust-card-tags">
          ${tagHTML || `<span class="trust-muted">完成履约后会积累评价标签</span>`}
        </div>
      </div>
    `;
  }
  return `
    <div class="trust-summary">
      <span class="trust-count">已完成 ${N.escapeHtml(completed)} 次互助</span>
      ${tagHTML ? `<span class="trust-tags">${tagHTML}</span>` : `<span class="trust-muted">暂无评价标签</span>`}
    </div>
  `;
};

N.profileTrustHTML = function profileTrustHTML(summary) {
  const given = Number(summary?.givenCount || 0);
  const received = Number(summary?.receivedCount || 0);
  const tags = Array.isArray(summary?.topTags) ? summary.topTags.slice(0, 3) : [];
  return `
    <div class="profile-trust-card" id="profileTrustCard">
      <div class="profile-trust-stats">
        <span><strong>${N.escapeHtml(given)}</strong> 次送出</span>
        <span><strong>${N.escapeHtml(received)}</strong> 次领取</span>
      </div>
      <div class="trust-card-tags">
        ${tags.length ? tags.map(tag => `<span class="trust-tag">${N.escapeHtml(tag)}</span>`).join("") : `<span class="trust-muted">完成履约评价后，这里会出现你的可信标签</span>`}
      </div>
    </div>
  `;
};

N.itemMediaHTML = function itemMediaHTML(item) {
  const image = Array.isArray(item.imageUrls) ? item.imageUrls[0] : "";
  if (image) {
    return `
      <div class="item-media">
        <img src="${N.escapeHtml(image)}" alt="${N.escapeHtml(item.title)}" loading="lazy" onerror="this.closest('.item-media').classList.add('image-failed'); this.remove();">
        <span class="item-type-overlay" aria-label="${N.escapeHtml(item.itemTypeText || "类型")}">${N.iconGlyph(item.itemIcon, item.itemType)}</span>
      </div>
    `;
  }
  return `<div class="item-icon">${N.iconGlyph(item.itemIcon, item.itemType)}</div>`;
};

N.itemGalleryHTML = function itemGalleryHTML(item) {
  const images = Array.isArray(item.imageUrls) ? item.imageUrls.slice(0, 3) : [];
  if (!images.length) {
    return `<div class="item-icon detail-icon">${N.iconGlyph(item.itemIcon, item.itemType)}</div>`;
  }
  return `
    <div class="detail-gallery">
      ${images.map((url, index) => `<img src="${N.escapeHtml(url)}" alt="${N.escapeHtml(item.title)} 图片 ${index + 1}" loading="lazy" onerror="this.remove();">`).join("")}
    </div>
  `;
};

})(window.NanE);
