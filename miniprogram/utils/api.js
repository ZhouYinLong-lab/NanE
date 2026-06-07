const app = getApp();

function request(path, options = {}) {
  const method = options.method || "GET";
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBase}${path}`,
      method,
      data: options.data || {},
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${app.globalData.token || "demo-token"}`
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        reject(res.data || { message: "请求失败" });
      },
      fail(error) {
        reject(error);
      }
    });
  });
}

module.exports = {
  request,
  getItems(params = {}) {
    const query = Object.keys(params)
      .filter(key => params[key])
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join("&");
    return request(`/items${query ? `?${query}` : ""}`);
  },
  getItem(id) {
    return request(`/items/${id}`);
  },
  createItem(data) {
    return request("/items", { method: "POST", data });
  },
  viewContact(id) {
    return request(`/items/${id}/contact`, { method: "POST" });
  },
  getMe() {
    return request("/me");
  },
  getMyItems() {
    return request("/me/items");
  },
  nannaChallenge(data) {
    return request("/auth/nanna/challenge", { method: "POST", data });
  },
  nannaVerify(data) {
    return request("/auth/nanna/verify", { method: "POST", data });
  }
};
