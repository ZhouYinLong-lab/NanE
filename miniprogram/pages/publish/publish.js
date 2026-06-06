const api = require("../../utils/api");
const locationTools = require("../../utils/locations");

Page({
  data: {
    categories: ["退烧降温", "消毒护理", "外伤处理", "防护用品", "其他耗材"],
    categoryIndex: 1,
    locationText: "",
    locationColumns: [],
    locationSelection: [1, 0, 0],
    locationLabel: "",
    form: {
      title: "",
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
    if (!form.contactWechat.trim()) {
      wx.showToast({ title: "请填写微信联系方式", icon: "none" });
      return;
    }
    if (!form.campus || !form.building) {
      wx.showToast({ title: "请选择校区和楼栋", icon: "none" });
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
        category: this.data.categories[this.data.categoryIndex],
        quantity: Number(form.quantity)
      });
      wx.showModal({
        title: "已提交审核",
        content: "发布请求已写入服务器数据库。管理员审核通过后会进入首页列表。",
        showCancel: false
      });
      this.setData({
        "form.title": "",
        "form.description": "",
        "form.quantity": "1",
        "form.contactWechat": "",
        "form.contactQq": "",
        "form.disclaimerAccepted": false
      });
    } catch (error) {
      wx.showToast({ title: error.message || "提交失败", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
