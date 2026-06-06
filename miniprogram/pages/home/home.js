const api = require("../../utils/api");
const icons = require("../../utils/icons");

Page({
  data: {
    icons,
    keyword: "",
    category: "全部",
    categories: ["全部", "退烧降温", "消毒护理", "外伤处理", "防护用品"],
    items: [],
    viewer: {},
    loading: true,
    errorMessage: ""
  },

  onShow() {
    this.loadItems();
  },

  async loadItems() {
    this.setData({ loading: true, errorMessage: "" });
    try {
      const data = await api.getItems({
        keyword: this.data.keyword,
        category: this.data.category === "全部" ? "" : this.data.category
      });
      this.setData({
        items: data.items,
        viewer: data.viewer,
        loading: false,
        errorMessage: ""
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || "无法连接 NanE API，请确认后端服务或合法域名配置"
      });
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
