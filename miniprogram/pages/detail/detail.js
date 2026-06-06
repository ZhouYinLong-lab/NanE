const api = require("../../utils/api");
const icons = require("../../utils/icons");

Page({
  data: {
    icons,
    id: "",
    item: null,
    contact: null,
    remaining: null,
    loading: true
  },

  onLoad(query) {
    this.setData({ id: query.id || "" });
    this.loadItem(query.id);
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  async loadItem(id) {
    try {
      const data = await api.getItem(id);
      this.setData({ item: data.item, loading: false });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: "详情加载失败", icon: "none" });
    }
  },

  async revealContact() {
    try {
      const data = await api.viewContact(this.data.id);
      this.setData({
        contact: data.contact,
        remaining: data.remaining
      });
      wx.showToast({ title: "联系方式已显示", icon: "none" });
    } catch (error) {
      wx.showToast({ title: error.message || "今日次数已用完", icon: "none" });
    }
  }
});
