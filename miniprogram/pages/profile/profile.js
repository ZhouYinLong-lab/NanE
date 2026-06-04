const api = require("../../utils/api");

Page({
  data: {
    user: {},
    contactLimit: {
      daily: 5,
      used: 0,
      remaining: 5
    },
    apiStatus: "检查中"
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
  }
});
