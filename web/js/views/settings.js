window.NanE = window.NanE || {};
(function(N) {

N.clearSession = function clearSession() {
  N.state.token = "";
  N.state.user = null;
  localStorage.removeItem(N.TOKEN_KEY);
  localStorage.removeItem(N.USER_KEY);
};

function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return "密码至少需要 8 位";
  }
  if (password.length > 64) {
    return "密码最多 64 位";
  }
  if (!/[a-zA-Z]/.test(password)) {
    return "密码必须包含至少一个字母";
  }
  if (!/[0-9]/.test(password)) {
    return "密码必须包含至少一个数字";
  }
  return "";
}

function emailFromPasswordPrefix() {
  const prefix = N.$("passwordEmailInput").value.trim().toLowerCase().replace(/@.*$/, "");
  return prefix ? `${prefix}@smail.nju.edu.cn` : "";
}

function emailFromResetPrefix() {
  const prefix = N.$("resetEmailInput").value.trim().toLowerCase().replace(/@.*$/, "");
  return prefix ? `${prefix}@smail.nju.edu.cn` : "";
}

N.switchLoginMode = function switchLoginMode(mode) {
  const codeSection = N.$("codeLoginSection");
  const passwordSection = N.$("passwordLoginSection");
  const forgotSection = N.$("forgotPasswordSection");
  const setPasswordPrompt = N.$("setPasswordPrompt");
  const tabs = document.querySelectorAll(".login-tab");
  const tabsRow = document.querySelector(".login-tabs");
  const nannaDetails = document.querySelector(".secondary-login");
  const cardHeading = document.querySelector("#mineLoginCard h3");

  const allSections = [codeSection, passwordSection, forgotSection, setPasswordPrompt].filter(Boolean);

  // Hide all sections first
  allSections.forEach(s => { s.hidden = true; s.classList.remove("login-section-in"); });
  tabs.forEach(tab => tab.classList.remove("active"));

  let target = null;

  if (mode === "code") {
    target = codeSection;
    const codeTab = document.querySelector('.login-tab[data-login-mode="code"]');
    if (codeTab) codeTab.classList.add("active");
    if (tabsRow) tabsRow.hidden = false;
    if (nannaDetails) nannaDetails.hidden = false;
    if (cardHeading) cardHeading.textContent = "登录 NanE";
  } else if (mode === "password") {
    target = passwordSection;
    const pwTab = document.querySelector('.login-tab[data-login-mode="password"]');
    if (pwTab) pwTab.classList.add("active");
    if (tabsRow) tabsRow.hidden = false;
    if (nannaDetails) nannaDetails.hidden = false;
    if (cardHeading) cardHeading.textContent = "登录 NanE";
  } else if (mode === "forgot") {
    target = forgotSection;
    if (tabsRow) tabsRow.hidden = true;
    if (nannaDetails) nannaDetails.hidden = true;
    if (cardHeading) cardHeading.textContent = "重置密码";
  } else if (mode === "setPassword") {
    target = setPasswordPrompt;
    if (tabsRow) tabsRow.hidden = true;
    if (nannaDetails) nannaDetails.hidden = true;
    if (cardHeading) cardHeading.textContent = "设置登录密码";
  }

  if (target) {
    target.hidden = false;
    target.offsetHeight; // force reflow to avoid flicker
    target.classList.add("login-section-in");
  }

  N.$("authMessage").textContent = "";
};

N.passwordLogin = async function passwordLogin() {
  const message = N.$("authMessage");
  const email = emailFromPasswordPrefix();
  const password = N.$("passwordInput").value;
  const agreement = N.currentAgreementPayload();
  if (!agreement.agreementAccepted) {
    message.textContent = "请先阅读并同意用户协议";
    return;
  }
  if (!email) {
    message.textContent = "请填写南京大学学生邮箱前缀";
    return;
  }
  const pwError = validatePasswordStrength(password);
  if (pwError) {
    message.textContent = pwError;
    return;
  }
  try {
    message.textContent = "正在登录...";
    const data = await N.api("/auth/password/login", {
      method: "POST",
      body: JSON.stringify({ email, password, ...agreement })
    });
    N.saveSession(data.token, data.user);
    message.textContent = "密码登录成功";
    N.switchLoginMode("code");
    await Promise.all([N.loadProfile(), N.loadHome(), N.loadMyItems()]);
    N.syncPublishView();
    N.executePendingAction();
  } catch (error) {
    message.textContent = N.errmsg(error, "密码登录失败");
  }
};

N.sendResetCode = async function sendResetCode() {
  const message = N.$("authMessage");
  const email = emailFromResetPrefix();
  if (!email) {
    message.textContent = "请填写南京大学学生邮箱前缀";
    return;
  }
  try {
    message.textContent = "正在发送重置验证码...";
    const data = await N.api("/auth/password/reset-challenge", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    N.state.emailChallengeId = data.challengeId || "";
    message.textContent = data.message || "验证码已发送，请查收邮箱";
  } catch (error) {
    message.textContent = N.errmsg(error, "验证码发送失败");
  }
};

N.resetPassword = async function resetPassword() {
  const message = N.$("authMessage");
  const email = emailFromResetPrefix();
  const code = N.$("resetCodeInput").value.trim();
  const password = N.$("resetPasswordInput").value;
  if (!email) {
    message.textContent = "请填写南京大学学生邮箱前缀";
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    message.textContent = "请填写 6 位验证码";
    return;
  }
  const pwError = validatePasswordStrength(password);
  if (pwError) {
    message.textContent = pwError;
    return;
  }
  try {
    message.textContent = "正在重置密码...";
    const data = await N.api("/auth/password/reset", {
      method: "POST",
      body: JSON.stringify({ email, code, password, challengeId: N.state.emailChallengeId })
    });
    message.textContent = data.message || "密码重置成功";
    N.switchLoginMode("password");
    N.$("passwordInput").value = "";
  } catch (error) {
    message.textContent = N.errmsg(error, "密码重置失败");
  }
};

N.setNewPassword = async function setNewPassword() {
  const message = N.$("authMessage");
  const password = N.$("setPasswordInput").value;
  const pwError = validatePasswordStrength(password);
  if (pwError) {
    message.textContent = pwError;
    return;
  }
  try {
    message.textContent = "正在设置密码...";
    const data = await N.api("/auth/password/set", {
      method: "POST",
      body: JSON.stringify({ password })
    });
    message.textContent = data.message || "密码设置成功";
    N.$("setPasswordPrompt").hidden = true;
    await N.loadProfile();
  } catch (error) {
    message.textContent = N.errmsg(error, "密码设置失败");
  }
};

N.changePassword = async function changePassword() {
  const message = N.$("changePasswordMessage");
  const currentPassword = N.$("currentPasswordInput").value;
  const newPassword = N.$("newPasswordInput").value;
  const confirmPassword = N.$("confirmPasswordInput").value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    message.textContent = "请填写所有密码字段";
    return;
  }
  if (newPassword !== confirmPassword) {
    message.textContent = "两次输入的新密码不一致";
    return;
  }
  const pwError = validatePasswordStrength(newPassword);
  if (pwError) {
    message.textContent = pwError;
    return;
  }
  try {
    message.textContent = "正在修改密码...";
    await N.api("/auth/password/change", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });
    message.textContent = "密码修改成功";
    N.$("changePasswordForm").hidden = true;
    N.$("settingsChangePasswordButton").hidden = false;
    N.$("currentPasswordInput").value = "";
    N.$("newPasswordInput").value = "";
    N.$("confirmPasswordInput").value = "";
  } catch (error) {
    message.textContent = N.errmsg(error, "密码修改失败");
  }
};

N.sendCode = async function sendCode() {
  const message = N.$("authMessage");
  const email = N.$("authEmail").value.trim();
  const studentId = N.$("authStudentId").value.trim();
  const agreement = N.currentAgreementPayload();
  if (!agreement.agreementAccepted) {
    message.textContent = "请先阅读并同意用户协议";
    return;
  }
  if (!email && !studentId) {
    message.textContent = "请填写邮箱或学号";
    return;
  }
  try {
    message.textContent = "正在向南哪小帮手发送验证码...";
    const data = await N.api("/auth/nanna/challenge", {
      method: "POST",
      body: JSON.stringify({ email, studentId, ...agreement })
    });
    N.state.challengeId = data.challengeId || "";
    message.textContent = data.message || `验证码已发送至 ${data.maskedTarget || "南哪小帮手"}`;
  } catch (error) {
    message.textContent = N.errmsg(error, "发送失败");
  }
};

N.verifyCode = async function verifyCode() {
  const message = N.$("authMessage");
  const email = N.$("authEmail").value.trim();
  const studentId = N.$("authStudentId").value.trim();
  const code = N.$("authCode").value.trim();
  const agreement = N.currentAgreementPayload();
  if (!agreement.agreementAccepted) {
    message.textContent = "请先阅读并同意用户协议";
    return;
  }
  if (!code) {
    message.textContent = "请填写验证码";
    return;
  }
  try {
    message.textContent = "正在验证...";
    const data = await N.api("/auth/nanna/verify", {
      method: "POST",
      body: JSON.stringify({ email, studentId, code, challengeId: N.state.challengeId, ...agreement })
    });
    N.saveSession(data.token, data.user);
    message.textContent = "校园身份验证成功";
    await Promise.all([N.loadProfile(), N.loadHome(), N.loadMyItems()]);
    N.syncPublishView();
    N.executePendingAction();
  } catch (error) {
    message.textContent = N.errmsg(error, "验证失败");
  }
};

N.sendEmailCode = async function sendEmailCode() {
  const message = N.$("authMessage");
  const email = N.emailFromPrefix();
  const agreement = N.currentAgreementPayload();
  if (!agreement.agreementAccepted) {
    message.textContent = "请先阅读并同意用户协议";
    return;
  }
  if (!email) {
    message.textContent = "请填写南京大学学生邮箱前缀";
    return;
  }
  try {
    message.textContent = "正在发送邮箱验证码...";
    const data = await N.api("/auth/email/challenge", {
      method: "POST",
      body: JSON.stringify({ email, ...agreement })
    });
    N.state.emailChallengeId = data.challengeId || "";
    message.textContent = data.message || "验证码已发送，请查收邮箱";
  } catch (error) {
    message.textContent = N.errmsg(error, "验证码发送失败");
  }
};

N.verifyEmailCode = async function verifyEmailCode() {
  const message = N.$("authMessage");
  const email = N.emailFromPrefix();
  const code = N.$("emailCodeInput").value.trim();
  const agreement = N.currentAgreementPayload();
  if (!agreement.agreementAccepted) {
    message.textContent = "请先阅读并同意用户协议";
    return;
  }
  if (!email) {
    message.textContent = "请填写南京大学学生邮箱前缀";
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    message.textContent = "请填写 6 位邮箱验证码";
    return;
  }
  try {
    message.textContent = "正在验证邮箱验证码...";
    const data = await N.api("/auth/email/verify", {
      method: "POST",
      body: JSON.stringify({ email, code, challengeId: N.state.emailChallengeId, ...agreement })
    });
    N.saveSession(data.token, data.user);
    message.textContent = "邮箱登录成功";
    if (data.user && !data.user.hasPassword) {
      N.switchLoginMode("setPassword");
      message.textContent = "邮箱登录成功，建议设置密码方便下次登录";
    } else {
      N.switchLoginMode("code");
    }
    await Promise.all([N.loadProfile(), N.loadHome(), N.loadMyItems()]);
    N.syncPublishView();
    N.executePendingAction();
  } catch (error) {
    message.textContent = N.errmsg(error, "验证码验证失败");
  }
};

N.saveProfile = async function saveProfile() {
  const message = N.$("profileMessage");
  if (!N.isVerifiedUser()) {
    message.textContent = "请先登录";
    return;
  }
  const payload = {
    name: N.$("nicknameInput").value.trim(),
    campus: N.$("profileCampusSelect").value,
    building: N.$("profileBuildingSelect").value,
    room: N.$("profileRoomSelect").value
  };
  if (!payload.name) {
    message.textContent = "请填写昵称";
    return;
  }
  try {
    message.textContent = "正在保存...";
    const data = await N.api("/me/profile", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    N.saveSession(N.state.token, data.user);
    message.textContent = data.message || "账号资料已更新";
    N.$("profileFormCard").hidden = true;
    await Promise.all([N.loadProfile(), N.loadHome()]);
    N.syncPublishView();
    N.executePendingAction();
  } catch (error) {
    message.textContent = N.errmsg(error, "保存失败");
  }
};

function applyDarkMode(enabled) {
  document.documentElement.setAttribute("data-theme", enabled ? "dark" : "light");
  localStorage.setItem("nane_dark_mode", enabled ? "1" : "0");
}

N.initDarkMode = function initDarkMode() {
  const saved = localStorage.getItem("nane_dark_mode");
  let enabled;
  if (saved !== null) {
    enabled = saved === "1";
  } else {
    enabled = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  if (N.$("darkModeToggle")) N.$("darkModeToggle").checked = enabled;
  applyDarkMode(enabled);
};

N.toggleDarkMode = async function toggleDarkMode() {
  applyDarkMode(N.$("darkModeToggle").checked);
};

N.toggleClaimEmail = async function toggleClaimEmail() {
  const enabled = N.$("claimEmailToggle").checked;
  try {
    await N.api("/me/notifications", {
      method: "PUT",
      body: JSON.stringify({ claimEmailEnabled: enabled })
    });
  } catch (error) {
    N.$("claimEmailToggle").checked = !enabled;
  }
};

N.loadNotificationPrefs = async function loadNotificationPrefs() {
  if (!N.isVerifiedUser()) return;
  try {
    const data = await N.api("/me/notifications");
    if (N.$("claimEmailToggle")) N.$("claimEmailToggle").checked = data.claimEmailEnabled !== false;
  } catch (error) {
    // defaults remain
  }
};

N.syncSettingsAccount = function syncSettingsAccount() {
  const loginCard = N.$("mineLoginCard");
  const loggedInContent = N.$("mineLoggedInContent");
  if (!loginCard || !loggedInContent) return;
  if (N.isVerifiedUser()) {
    loginCard.hidden = true;
    loggedInContent.hidden = false;
  } else {
    loginCard.hidden = false;
    loggedInContent.hidden = true;
    N.syncAgreementUI();
  }
  N.refreshMotion(N.$("view-mine"));
};

N.logout = function logout() {
  N.clearSession();
  N.switchLoginMode("code");
  N.$("authMessage").textContent = "已登出";
  N.syncSettingsAccount();
  N.syncPublishView();
  N.loadProfile();
  N.loadMyItems();
};

N.exportData = async function exportData() {
  try {
    N.showToast("正在导出数据...", "info");
    const data = await N.api("/me/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nane-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    N.showToast("数据已下载", "success");
  } catch (error) {
    N.showToast(N.errmsg(error, "导出失败"), "error");
  }
};

N.deleteAccount = async function deleteAccount() {
  const ok = await N.showTypedConfirmDialog({
    message: "确定要注销账号吗？此操作不可撤销。你的发布记录将被隐藏，个人信息将被清除。",
    phrase: "确认删除",
    label: "请输入「确认删除」以继续",
    confirmText: "确认注销",
    cancelText: "取消"
  });
  if (!ok) return;
  try {
    const data = await N.api("/me/delete", {
      method: "POST",
      body: JSON.stringify({ confirm: "确认删除" })
    });
    N.showToast(data.message || "账号已注销", "success");
    N.clearSession();
    N.syncSettingsAccount();
    N.syncPublishView();
    N.loadProfile();
    N.loadMyItems();
  } catch (error) {
    N.showToast(N.errmsg(error, "注销失败"), "error");
  }
};

N.togglePush = async function togglePush() {
  const enabled = N.$("pushToggle").checked;
  if (enabled) {
    await N.enablePush();
    if (localStorage.getItem("nane_push_enabled") !== "1") {
      N.$("pushToggle").checked = false;
    }
  } else {
    await N.disablePush();
  }
};

N.loadSettings = async function loadSettings() {
  N.syncSettingsAccount();
  await N.loadNotificationPrefs();
  // Sync push toggle
  if (N.$("pushToggle")) {
    N.$("pushToggle").checked = localStorage.getItem("nane_push_enabled") === "1";
  }
};

})(window.NanE);
