window.NanE = window.NanE || {};
(function(N) {

N.isVerifiedUser = function isVerifiedUser() {
  return Boolean(N.state.user?.is_verified && N.state.user?.hasAgreement !== false);
};

N.profileComplete = function profileComplete() {
  return Boolean(N.state.user?.profileComplete);
};

N.requireVerified = function requireVerified(message, pendingAction) {
  if (N.isVerifiedUser() && N.profileComplete()) {
    return true;
  }
  const text = message || (N.isVerifiedUser() ? '请先补全昵称、校区和楼栋' : '请先在「我的」页登录并同意用户协议');
  if (pendingAction) {
    N.state.pendingAction = pendingAction;
  }
  N.switchView("mine");
  N.$("authMessage").textContent = text;
  return false;
};

N.emailFromPrefix = function emailFromPrefix() {
  const prefix = N.$("emailLoginInput").value.trim().toLowerCase().replace(/@.*$/, "");
  return prefix ? `${prefix}@smail.nju.edu.cn` : "";
};

N.executePendingAction = function executePendingAction() {
  if (!N.state.pendingAction) return false;
  const action = N.state.pendingAction;
  N.state.pendingAction = null;
  if (N.isVerifiedUser() && N.profileComplete()) {
    N.showToast("登录成功，继续刚才的操作", "success");
    setTimeout(() => { if (typeof action === "function") action(); }, 600);
    return true;
  }
  return false;
};

})(window.NanE);
