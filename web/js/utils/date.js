window.NanE = window.NanE || {};
(function(N) {

N.expiryText = function expiryText(item) {
  if (item.noExpiry) {
    return "长期有效";
  }
  return item.expireDate || "未填写";
};

N.compactDate = function compactDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

N.itemExpiredClass = function itemExpiredClass(item) {
  if (item.noExpiry || !item.expireDate) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${item.expireDate}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return "";
  return expiry.getTime() < today.getTime() ? "item-expired" : "";
};

})(window.NanE);
