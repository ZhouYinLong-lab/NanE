const config = require("./config");

App({
  globalData: {
    apiBase: config.apiBase,
    token: "",
    user: null
  },

  onLaunch() {
    this.login();
  },

  login() {
    wx.login({
      success: ({ code }) => {
        wx.request({
          url: `${this.globalData.apiBase}/auth/wx-login`,
          method: "POST",
          data: { code },
          success: ({ data }) => {
            this.globalData.token = data.token || "demo-token";
            this.globalData.user = data.user;
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
