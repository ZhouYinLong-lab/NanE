const api = require("../../utils/api");
const locationTools = require("../../utils/locations");
const icons = require("../../utils/icons");

Page({
  data: {
    icons,
    itemTypes: [
      {
        value: "consumable",
        label: "耗材",
        hint: "适用于创可贴、碘伏棉签、防护用品等低风险应急耗材。"
      },
      {
        value: "medicine",
        label: "药品",
        hint: "仅限非处方常见药品笼统分类；禁止处方药、管控药、拆封不明药品和收费转让。"
      }
    ],
    categoriesByType: {
      consumable: ["应急耗材"],
      medicine: ["感冒药", "退烧药", "过敏药", "肠胃药", "其他非处方药"]
    },
    categories: ["应急耗材"],
    itemTypeIndex: 0,
    categoryIndex: 0,
    showCategoryPicker: false,
    typeHint: "适用于创可贴、碘伏棉签、防护用品等低风险应急耗材。",
    titlePlaceholder: "例如：碘伏棉签 10 支",
    iconOptions: icons.itemIconOptions,
    selectedIconLabel: "通用",
    selectedIconGlyph: icons.itemIconGlyph("plus", "consumable"),
    locationText: "",
    locationColumns: [],
    locationSelection: [1, 0, 0],
    locationLabel: "",
    form: {
      title: "",
      itemType: "consumable",
      itemIcon: "plus",
      quantity: "1",
      unit: "件",
      campus: "仙林校区",
      building: "1幢",
      room: "",
      expireDate: "2026-12-31",
      description: "",
      contactWechat: "",
      contactQq: "",
      disclaimerAccepted: false
    },
    submitting: false
  },

  onLoad() {
    this.applyLocationSelection(this.data.locationSelection);
  },

  updateField(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({
      [`form.${key}`]: event.detail.value
    });
  },

  chooseCategory(event) {
    this.setData({ categoryIndex: Number(event.detail.value) });
  },

  chooseItemType(event) {
    const itemTypeIndex = Number(event.currentTarget.dataset.index);
    const itemType = this.data.itemTypes[itemTypeIndex].value;
    const categories = this.data.categoriesByType[itemType];
    this.setData({
      itemTypeIndex,
      categories,
      categoryIndex: 0,
      showCategoryPicker: itemType === "medicine",
      typeHint: this.data.itemTypes[itemTypeIndex].hint,
      titlePlaceholder: itemType === "medicine" ? "例如：未拆封感冒药一盒" : "例如：碘伏棉签 10 支",
      selectedIconLabel: itemType === "medicine" ? "胶囊" : "通用",
      selectedIconGlyph: icons.itemIconGlyph(icons.defaultItemIcon(itemType), itemType),
      "form.itemIcon": icons.defaultItemIcon(itemType),
      "form.itemType": itemType
    });
  },

  chooseIcon(event) {
    const key = event.currentTarget.dataset.key;
    const option = this.data.iconOptions.find(item => item.key === key);
    if (!option) return;
    this.setData({
      selectedIconLabel: option.label,
      selectedIconGlyph: option.glyph,
      "form.itemIcon": option.key
    });
  },

  updateLocationText(event) {
    this.setData({ locationText: event.detail.value });
  },

  applyLocationSelection(selection) {
    const location = locationTools.selectionToLocation(selection);
    const label = location.room ? `${location.campus} · ${location.building} · ${location.room}` : `${location.campus} · ${location.building}`;
    this.setData({
      locationColumns: location.columns,
      locationSelection: location.selection,
      locationLabel: label,
      "form.campus": location.campus,
      "form.building": location.building,
      "form.room": location.room
    });
  },

  onLocationColumnChange(event) {
    const { column, value } = event.detail;
    const next = this.data.locationSelection.slice();
    next[column] = value;
    if (column === 0) {
      next[1] = 0;
      next[2] = 0;
    }
    if (column === 1) {
      next[2] = 0;
    }
    this.applyLocationSelection(next);
  },

  onLocationChange(event) {
    this.applyLocationSelection(event.detail.value);
  },

  parseLocation() {
    if (!this.data.locationText.trim()) {
      wx.showToast({ title: "请输入位置，如 鼓楼 南二 321", icon: "none" });
      return;
    }
    const parsed = locationTools.parseLocationInput(this.data.locationText);
    this.applyLocationSelection(parsed.selection);
    wx.showToast({ title: parsed.message, icon: parsed.matched ? "success" : "none" });
  },

  toggleDisclaimer(event) {
    this.setData({
      "form.disclaimerAccepted": event.detail.value.includes("accepted")
    });
  },

  async submit() {
    const form = this.data.form;
    if (!form.title || !form.quantity || !form.expireDate) {
      wx.showToast({ title: "请补全必填信息", icon: "none" });
      return;
    }
    if (!form.contactWechat.trim() && !form.contactQq.trim()) {
      wx.showToast({ title: "微信或 QQ 至少填写一项", icon: "none" });
      return;
    }
    if (!form.campus || !form.building) {
      wx.showToast({ title: "请选择校区和楼栋", icon: "none" });
      return;
    }
    const selectedCategory = this.data.categories[this.data.categoryIndex];
    if (form.itemType === "medicine" && !this.data.categoriesByType[form.itemType]?.includes(selectedCategory)) {
      wx.showToast({ title: "请选择匹配的物品类型和分类", icon: "none" });
      return;
    }
    if (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) <= 0) {
      wx.showToast({ title: "数量必须是正整数", icon: "none" });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.expireDate)) {
      wx.showToast({ title: "有效期格式为 YYYY-MM-DD", icon: "none" });
      return;
    }
    if (!form.disclaimerAccepted) {
      wx.showToast({ title: "请先确认发布声明", icon: "none" });
      return;
    }

    this.setData({ submitting: true });
    try {
      await api.createItem({
        ...form,
        category: form.itemType === "medicine" ? selectedCategory : "应急耗材",
        quantity: Number(form.quantity)
      });
      wx.showModal({
        title: "已提交审核",
        content: "发布请求已写入服务器数据库。管理员审核通过后会进入首页列表。",
        showCancel: false
      });
      const currentType = this.data.itemTypes[this.data.itemTypeIndex].value;
      const defaultIcon = icons.defaultItemIcon(currentType);
      this.setData({
        "form.title": "",
        "form.itemType": currentType,
        "form.itemIcon": defaultIcon,
        "form.description": "",
        "form.quantity": "1",
        "form.contactWechat": "",
        "form.contactQq": "",
        "form.disclaimerAccepted": false,
        selectedIconLabel: currentType === "medicine" ? "胶囊" : "通用",
        selectedIconGlyph: icons.itemIconGlyph(defaultIcon, currentType)
      });
    } catch (error) {
      wx.showToast({ title: error.message || "提交失败", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
