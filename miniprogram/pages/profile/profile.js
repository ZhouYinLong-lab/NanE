const api = require("../../utils/api");
const icons = require("../../utils/icons");

Page({
  data: {
    icons,
    user: {},
    contactLimit: {
      daily: 5,
      used: 0,
      remaining: 5
    },
    apiStatus: "检查中",
    authForm: {
      email: "",
      studentId: "",
      code: "",
      challengeId: ""
    },
    authMessage: "",
    authLoading: false
  },

  onShow() {
    this.loadProfile();
  },

  async loadProfile() {
    try {
      const data = await api.getMe();
      this.setData({
        user: data.user,
        contactLimit: data.contactLimit,
        apiStatus: "已连接"
      });
    } catch (error) {
      this.setData({ apiStatus: "未连接" });
    }
  },

  openMyItems() {
    wx.navigateTo({
      url: "/pages/my-items/my-items"
    });
  },

  onAuthInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`authForm.${field}`]: event.detail.value
    });
  },

  async sendNannaCode() {
    const { email, studentId } = this.data.authForm;
    if (!email && !studentId) {
      wx.showToast({ title: "请填写邮箱或学号", icon: "none" });
      return;
    }
    this.setData({ authLoading: true, authMessage: "正在向小助手发送验证码..." });
    try {
      const data = await api.nannaChallenge({ email, studentId });
      this.setData({
        "authForm.challengeId": data.challengeId || "",
        authMessage: data.message || `验证码已发送至 ${data.maskedTarget || "小助手"}`
      });
      wx.showToast({ title: "验证码已发送", icon: "success" });
    } catch (error) {
      this.setData({ authMessage: error.message || "小助手验证尚未配置或发送失败" });
      wx.showToast({ title: error.message || "发送失败", icon: "none" });
    } finally {
      this.setData({ authLoading: false });
    }
  },

  async verifyNannaCode() {
    const app = getApp();
    const { email, studentId, code, challengeId } = this.data.authForm;
    if (!code) {
      wx.showToast({ title: "请填写验证码", icon: "none" });
      return;
    }
    this.setData({ authLoading: true, authMessage: "正在验证小助手身份..." });
    try {
      const data = await api.nannaVerify({ email, studentId, code, challengeId });
      app.setSession(data.token, data.user);
      this.setData({
        user: data.user,
        authMessage: "校园身份验证成功",
        authForm: {
          email: "",
          studentId: "",
          code: "",
          challengeId: ""
        }
      });
      wx.showToast({ title: "验证成功", icon: "success" });
      this.loadProfile();
    } catch (error) {
      this.setData({ authMessage: error.message || "验证码验证失败" });
      wx.showToast({ title: error.message || "验证失败", icon: "none" });
    } finally {
      this.setData({ authLoading: false });
    }
  },

  switchAccount() {
    const app = getApp();
    app.clearSession();
    app.login();
    this.setData({ authMessage: "已切回 Demo 登录，可重新进行小助手验证" });
    setTimeout(() => this.loadProfile(), 600);
  }
});
