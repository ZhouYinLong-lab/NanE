window.NanE = window.NanE || {};
(function(N) {

N.emptyStateHTML = function emptyStateHTML(type, detail) {
  if (detail === void 0) detail = "";
  const illustrations = {
    search: `<svg width="72" height="72" viewBox="0 0 72 72" fill="none"><circle cx="30" cy="30" r="16" stroke="currentColor" stroke-width="2"/><path d="M42 42l14 14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="30" cy="30" r="6" stroke="currentColor" stroke-width="2" opacity="0.5"/></svg>`,
    home: `<svg width="72" height="72" viewBox="0 0 72 72" fill="none"><path d="M36 10L10 32h6v28h16V44h8v16h16V32h6L36 10z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M28 44h16" stroke="currentColor" stroke-width="2" opacity="0.4"/></svg>`,
    mine: `<svg width="72" height="72" viewBox="0 0 72 72" fill="none"><rect x="14" y="14" width="44" height="50" rx="4" stroke="currentColor" stroke-width="2"/><path d="M14 22h44" stroke="currentColor" stroke-width="2"/><path d="M22 36h28" stroke="currentColor" stroke-width="1.5" opacity="0.5"/><circle cx="50" cy="48" r="3" fill="currentColor" opacity="0.4"/></svg>`,
    error: `<svg width="72" height="72" viewBox="0 0 72 72" fill="none"><circle cx="36" cy="36" r="24" stroke="currentColor" stroke-width="2"/><path d="M28 28l16 16M44 28L28 44" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    guest: `<svg width="72" height="72" viewBox="0 0 72 72" fill="none"><circle cx="28" cy="24" r="10" stroke="currentColor" stroke-width="2"/><path d="M10 58c0-12 8-22 18-22s18 9 18 22" stroke="currentColor" stroke-width="2"/><line x1="48" y1="20" x2="58" y2="30" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="58" y1="20" x2="48" y2="30" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
  };
  const messages = {
    search: `未找到与「${N.escapeHtml(detail)}」相关的物品`,
    home: "附近暂无上架物品，来做第一个分享的人吧",
    mine: `<p style="margin:0 0 16px">还没有发布过物品</p><button class="primary small" id="emptyStatePublishBtn">发布第一件物品</button>`,
    guest: `<p style="margin:0 0 16px">登录后即可查看和管理自己的发布</p><button class="primary small" id="emptyStateLoginBtn">去登录</button>`,
    error: N.escapeHtml(detail) || "网络连接失败，请检查网络后重试"
  };
  return `<div class="empty-state"><div class="empty-state-icon">${illustrations[type] || illustrations.home}</div><div class="empty-state-msg">${messages[type] || messages.home}</div></div>`;
};

})(window.NanE);
