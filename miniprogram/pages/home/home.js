const api = require("../../utils/api");
const icons = require("../../utils/icons");

Page({
  data: {
    iconBell: icons.bell,
    iconFilter: icons.filter,
    iconHandHoldingHeart: icons.handHoldingHeart,
    iconLocationDot: icons.locationDot,
    iconMagnifyingGlass: icons.magnifyingGlass,
    iconNotesMedical: icons.notesMedical,
    iconShieldHeart: icons.shieldHeart,
    iconCircleInfo: icons.circleInfo,
    keyword: "",
    showSearch: false,
    itemType: "",
    category: "全部",
    activeChip: "building",
    filterChips: [
      { key: "building", label: "同楼栋（本楼栋）", itemType: "", category: "" },
      { key: "campus", label: "同校区（本校区）", itemType: "", category: "" },
      { key: "medicine", label: "非处方药品", itemType: "medicine", category: "" },
      { key: "consumable", label: "应急耗材", itemType: "consumable", category: "" }
    ],
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
        itemType: this.data.itemType,
        category: this.data.category === "全部" ? "" : this.data.category
      });
      this.setData({
        items: data.items.map(item => ({
          ...item,
          itemIconGlyph: icons.itemIconGlyph(item.itemIcon, item.itemType)
        })),
        viewer: data.viewer,
        filterChips: this.buildFilterChips(data.viewer),
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

  buildFilterChips(viewer = {}) {
    return [
      { key: "building", label: `同楼栋（${viewer.building || "本楼栋"}）`, itemType: "", category: "" },
      { key: "campus", label: `同校区（${viewer.campus || "本校区"}）`, itemType: "", category: "" },
      { key: "medicine", label: "非处方药品", itemType: "medicine", category: "" },
      { key: "consumable", label: "应急耗材", itemType: "consumable", category: "" }
    ];
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value });
  },

  onSearch() {
    this.loadItems();
  },

  toggleSearch() {
    this.setData({ showSearch: !this.data.showSearch });
  },

  chooseFilter(event) {
    const chip = this.data.filterChips.find(item => item.key === event.currentTarget.dataset.key);
    if (!chip) return;
    this.setData({
      activeChip: chip.key,
      itemType: chip.itemType || "",
      category: chip.category || "全部"
    }, () => this.loadItems());
  },

  openDetail(event) {
    wx.navigateTo({
      url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}`
    });
  }
});
