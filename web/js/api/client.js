window.NanE = window.NanE || {};
(function(N) {

const API_BASE = "/api";
const TOKEN_KEY = "nane_web_token";
const USER_KEY = "nane_web_user";

const DEBUG_MODE = (() => {
  const url = new URLSearchParams(window.location.search);
  return url.get("debug") !== null || localStorage.getItem("nane_debug") === "1";
})();

N.API_BASE = API_BASE;
N.TOKEN_KEY = TOKEN_KEY;
N.USER_KEY = USER_KEY;
N.DEBUG_MODE = DEBUG_MODE;

N.saveSession = function saveSession(tokenValue, user) {
  N.state.token = tokenValue || "";
  N.state.user = user || null;
  if (tokenValue) {
    localStorage.setItem(TOKEN_KEY, tokenValue);
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
    N.rememberAgreementAccepted();
  }
};

N.token = function token() {
  return N.state.token || "";
};

N.api = async function api(path, options) {
  if (options === void 0) options = {};
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (N.token()) {
    headers.Authorization = `Bearer ${N.token()}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });
  let data;
  try {
    data = await response.json();
  } catch (jsonError) {
    // Differentiate between JSON parse errors and empty/success responses
    // Server might return non-JSON for 500 errors or proxy errors
    if (response.ok) {
      // Server returned 2xx but body isn't JSON — treat as empty success
      data = {};
    } else {
      // Server error with non-JSON body — throw a meaningful error
      throw new Error(response.status === 500
        ? "服务器内部错误，请稍后重试"
        : "服务器响应异常，请刷新页面重试");
    }
  }
  if (!response.ok) {
    if (response.status === 401) {
      N.clearSession();
      throw new Error("登录已过期，请重新登录");
    }
    throw new Error(data.message || "请求失败");
  }
  return data;
};

N.errmsg = function errmsg(error, fallback) {
  if (!error) return fallback || "操作失败";
  const raw = error.message || String(error);
  const map = {
    "Failed to fetch": "网络连接失败，请检查校园网是否正常",
    "NetworkError": "网络连接失败，请检查校园网是否正常",
    "Unexpected token": "服务器返回异常，请稍后重试",
    "abort": "请求已取消",
    "timeout": "请求超时，请检查网络后重试",
    "Unexpected end of JSON": "服务器响应异常，请刷新页面重试",
  };
  for (const [key, msg] of Object.entries(map)) {
    if (raw.includes(key)) return msg;
  }
  return raw || fallback || "操作失败";
};

N.markdownToHtml = function markdownToHtml(markdown) {
  return N.escapeHtml(markdown)
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^\d+\. (.*)$/gm, "<p class=\"agreement-list\">$1</p>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>")
    .replace(/<p><h/g, "<h")
    .replace(/<\/h([1-3])><\/p>/g, "</h$1>");
};

N.loadAgreement = async function loadAgreement() {
  try {
    const data = await N.api("/legal/agreement");
    N.state.agreementVersion = data.version || N.AGREEMENT_VERSION_FALLBACK;
    N.$("agreementBody").innerHTML = N.markdownToHtml(data.markdown || "协议暂不可用。");
  } catch (error) {
    N.$("agreementBody").textContent = "协议加载失败，请稍后重试。";
  }
};

N.loadLocations = async function loadLocations() {
  try {
    const data = await N.api("/locations");
    N.state.locations = Array.isArray(data.locations) ? data.locations : [];
  } catch (error) {
    N.state.locations = [];
  }
  const campusIndex = N.state.locations.findIndex(campus => campus.name === "仙林校区");
  N.state.publishCampusIndex = campusIndex >= 0 ? campusIndex : 0;
  N.state.profileCampusIndex = N.state.publishCampusIndex;
  const campus = N.currentCampus("publish");
  const buildingIndex = (campus?.buildings || []).findIndex(building => building.name === "南苑 A 栋");
  N.state.publishBuildingIndex = buildingIndex >= 0 ? buildingIndex : 0;
  N.state.profileBuildingIndex = N.state.publishBuildingIndex;
  N.renderLocationSelects("publish");
  N.renderLocationSelects("profile");
};

})(window.NanE);
