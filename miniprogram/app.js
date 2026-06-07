const config = require("./config");

App({
  globalData: {
    apiBase: config.apiBase,
    token: "",
    user: null
  },

  onLaunch() {
    const token = wx.getStorageSync("nane_token");
    const user = wx.getStorageSync("nane_user");
    if (token) {
      this.globalData.token = token;
      this.globalData.user = user || null;
      return;
    }
    this.login();
  },

  setSession(token, user) {
    this.globalData.token = token || "";
    this.globalData.user = user || null;
    if (token) {
      wx.setStorageSync("nane_token", token);
      wx.setStorageSync("nane_user", user || {});
    }
  },

  clearSession() {
    this.globalData.token = "";
    this.globalData.user = null;
    wx.removeStorageSync("nane_token");
    wx.removeStorageSync("nane_user");
  },

  login() {
    wx.login({
      success: ({ code }) => {
        wx.request({
          url: `${this.globalData.apiBase}/auth/wx-login`,
          method: "POST",
          data: { code },
          success: ({ data }) => {
            this.setSession(data.token || "demo-token", data.user);
          },
          fail: () => {
            this.globalData.token = "demo-token";
          }
        });
      },
      fail: () => {
        this.globalData.token = "demo-token";
      }
    });
  }
});
