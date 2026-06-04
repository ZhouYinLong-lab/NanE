const api = require("../../utils/api");

Page({
  data: {
    keyword: "",
    category: "全部",
    categories: ["全部", "退烧降温", "消毒护理", "外伤处理", "防护用品"],
    items: [],
    viewer: {},
    loading: true
  },

  onShow() {
    this.loadItems();
  },

  async loadItems() {
    this.setData({ loading: true });
    try {
      const data = await api.getItems({
        keyword: this.data.keyword,
        category: this.data.category === "全部" ? "" : this.data.category
      });
      this.setData({
        items: data.items,
        viewer: data.viewer,
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: "API 未连接", icon: "none" });
    }
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value });
  },

  onSearch() {
    this.loadItems();
  },

  chooseCategory(event) {
    this.setData({ category: event.currentTarget.dataset.category }, () => this.loadItems());
  },

  openDetail(event) {
    wx.navigateTo({
      url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}`
    });
  }
});
