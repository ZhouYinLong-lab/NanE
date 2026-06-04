const api = require("../../utils/api");

const statusText = {
  online: "上架中",
  reviewing: "审核中",
  rejected: "未通过",
  expired: "已下架"
};

Page({
  data: {
    items: [],
    loading: true
  },

  onShow() {
    this.loadItems();
  },

  async loadItems() {
    this.setData({ loading: true });
    try {
      const data = await api.getMyItems();
      this.setData({
        items: data.items.map(item => ({
          ...item,
          statusText: statusText[item.status] || item.status
        })),
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  openDetail(event) {
    wx.navigateTo({
      url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}`
    });
  }
});
