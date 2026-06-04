const api = require("../../utils/api");

Page({
  data: {
    categories: ["退烧降温", "消毒护理", "外伤处理", "防护用品", "其他耗材"],
    categoryIndex: 1,
    form: {
      title: "",
      quantity: "1",
      unit: "件",
      campus: "仙林校区",
      building: "南苑 A 栋",
      expireDate: "2026-12-31",
      description: ""
    },
    submitting: false
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

  async submit() {
    const form = this.data.form;
    if (!form.title || !form.quantity || !form.expireDate) {
      wx.showToast({ title: "请补全必填信息", icon: "none" });
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
        content: "Demo 已把发布请求写入后端 JSON 数据。审核通过后会进入首页列表。",
        showCancel: false
      });
      this.setData({
        "form.title": "",
        "form.description": "",
        "form.quantity": "1"
      });
    } catch (error) {
      wx.showToast({ title: error.message || "提交失败", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
