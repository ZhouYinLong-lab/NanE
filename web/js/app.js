window.NanE = window.NanE || {};
(function(N) {

const AGREEMENT_VERSION_FALLBACK = "v1.0";

N.AGREEMENT_VERSION_FALLBACK = AGREEMENT_VERSION_FALLBACK;

N.state = {
  token: localStorage.getItem(N.TOKEN_KEY) || "",
  user: JSON.parse(localStorage.getItem(N.USER_KEY) || "null"),
  itemType: "",
  itemCategory: "",
  editingItemId: "",
  claimsModalShown: false,
  contactViewedForItem: "",
  selectedPublishType: "consumable",
  selectedIcon: "plus",
  iconOtherOpen: false,
  selectedDetail: null,
  challengeId: "",
  emailChallengeId: "",
  locations: [],
  publishCampusIndex: 0,
  publishBuildingIndex: 0,
  profileCampusIndex: 0,
  profileBuildingIndex: 0,
  agreementVersion: AGREEMENT_VERSION_FALLBACK,
  pendingAction: null,
  homeOffset: 0,
  homeHasMore: false,
  pendingReviews: [],
  activeReviewClaimId: "",
  activeClaimId: "",
  buildingFilter: "",
  uploadedImageUrls: [],
  imageUploading: false
};

N.$ = function $(id) {
  return document.getElementById(id);
};

function viewButtonSelector(view) {
  return `.nav-item[data-view="${view}"], .tab[data-view="${view}"]`;
}

N.switchView = function switchView(view) {
  const trigger = document.querySelector(viewButtonSelector(view));
  if (trigger) trigger.click();
};

N.closeFilterDropdowns = function closeFilterDropdowns(except) {
  if (except === void 0) except = null;
  document.querySelectorAll("#filterChips .chip-select").forEach(select => {
    if (select === except) return;
    select.classList.remove("open");
    const dropdown = select.querySelector(".chip-dropdown");
    if (dropdown) dropdown.hidden = true;
  });
};

N.setFilterSelectLabel = function setFilterSelectLabel(select, label) {
  const button = select?.querySelector(".chip-select-btn");
  if (!button) return;
  const textNode = [...button.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
  if (textNode) {
    textNode.textContent = `${label} `;
  }
};

function selectionKeys(kind) {
  return kind === "profile"
    ? { campus: "profileCampusIndex", building: "profileBuildingIndex", campusId: "profileCampusSelect", buildingId: "profileBuildingSelect", roomId: "profileRoomSelect" }
    : { campus: "publishCampusIndex", building: "publishBuildingIndex", campusId: "campusSelect", buildingId: "buildingSelect", roomId: "roomSelect" };
}

function currentCampus(kind) {
  if (kind === void 0) kind = "publish";
  const keys = selectionKeys(kind);
  return N.state.locations[N.state[keys.campus]] || N.state.locations[0];
}

function currentBuilding(kind) {
  if (kind === void 0) kind = "publish";
  const keys = selectionKeys(kind);
  const campus = currentCampus(kind);
  return campus?.buildings?.[N.state[keys.building]] || campus?.buildings?.[0];
}

function optionHtml(value, selectedValue) {
  if (selectedValue === void 0) selectedValue = "";
  return `<option value="${N.escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${N.escapeHtml(value)}</option>`;
}

N.currentCampus = currentCampus;
N.currentBuilding = currentBuilding;

N.renderLocationSelects = function renderLocationSelects(kind, selectedRoom) {
  if (kind === void 0) kind = "publish";
  if (selectedRoom === void 0) selectedRoom = "";
  const keys = selectionKeys(kind);
  const campusSelect = N.$(keys.campusId);
  const buildingSelect = N.$(keys.buildingId);
  const roomSelect = N.$(keys.roomId);
  if (!campusSelect || !buildingSelect || !roomSelect) {
    return;
  }
  if (!N.state.locations.length) {
    campusSelect.innerHTML = optionHtml("仙林校区");
    buildingSelect.innerHTML = optionHtml("南苑 A 栋");
    roomSelect.innerHTML = `<option value="">不填写宿舍号</option>`;
    return;
  }
  const campus = currentCampus(kind);
  const building = currentBuilding(kind);
  campusSelect.innerHTML = N.state.locations
    .map((item, index) => `<option value="${N.escapeHtml(item.name)}" ${index === N.state[keys.campus] ? "selected" : ""}>${N.escapeHtml(item.name)}</option>`)
    .join("");
  buildingSelect.innerHTML = (campus?.buildings || [])
    .map((item, index) => `<option value="${N.escapeHtml(item.name)}" ${index === N.state[keys.building] ? "selected" : ""}>${N.escapeHtml(item.name)}</option>`)
    .join("");
  roomSelect.innerHTML = `<option value="">不填写宿舍号</option>${(building?.rooms || [])
    .map(room => optionHtml(room, selectedRoom))
    .join("")}`;
};

N.setSelectionByLocation = function setSelectionByLocation(kind, campusName, buildingName, roomName) {
  if (roomName === void 0) roomName = "";
  const keys = selectionKeys(kind);
  const campusIndex = N.state.locations.findIndex(campus => campus.name === campusName);
  N.state[keys.campus] = campusIndex >= 0 ? campusIndex : N.state[keys.campus];
  const campus = currentCampus(kind);
  const buildingIndex = (campus?.buildings || []).findIndex(building => building.name === buildingName);
  N.state[keys.building] = buildingIndex >= 0 ? buildingIndex : N.state[keys.building];
  N.renderLocationSelects(kind, roomName || "");
};

function initDateControls() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;
  N.$("expireDateInput").setAttribute("min", todayStr);
  N.$("expireDateInput").value = `${yyyy}-12-31`;
}

N.getExpireDate = function getExpireDate() {
  return N.$("expireDateInput").value;
};

N.setExpireDate = function setExpireDate(dateStr) {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    N.$("expireDateInput").value = dateStr;
  }
};

N.setDateRowDisabled = function setDateRowDisabled(disabled) {
  N.$("expireDateInput").disabled = disabled;
};

N.toggleNoExpiry = function toggleNoExpiry() {
  const checked = N.$("noExpiryInput").checked;
  N.setDateRowDisabled(checked);
};

N.currentAgreementPayload = function currentAgreementPayload() {
  const storedVer = localStorage.getItem("nane_agreement_accepted");
  const currentVer = N.state.agreementVersion || AGREEMENT_VERSION_FALLBACK;
  return {
    agreementAccepted: storedVer === currentVer || Boolean(N.$("agreementInput")?.checked),
    agreementVersion: currentVer
  };
};

N.rememberAgreementAccepted = function rememberAgreementAccepted() {
  localStorage.setItem("nane_agreement_accepted", N.state.agreementVersion || AGREEMENT_VERSION_FALLBACK);
};

N.syncAgreementUI = function syncAgreementUI() {
  const row = document.querySelector(".agreement-row");
  const input = N.$("agreementInput");
  if (!row || !input) return;
  const storedVer = localStorage.getItem("nane_agreement_accepted");
  const currentVer = N.state.agreementVersion || AGREEMENT_VERSION_FALLBACK;
  if (storedVer === currentVer) {
    row.hidden = true;
  } else {
    row.hidden = false;
  }
};

function updateCharCounts() {
  const titleEl = N.$("titleCount");
  const descEl = N.$("descriptionCount");
  if (titleEl) {
    const len = (N.$("titleInput").value || "").length;
    titleEl.textContent = len + "/30";
    titleEl.classList.toggle("over", len > 30);
  }
  if (descEl) {
    const len = (N.$("descriptionInput").value || "").length;
    descEl.textContent = len + "/200";
    descEl.classList.toggle("over", len > 200);
  }
}

N.updateCharCounts = updateCharCounts;

function clearFieldErrors() {
  document.querySelectorAll(".field-error").forEach(el => { el.textContent = ""; });
  document.querySelectorAll(".field-error-border").forEach(el => { el.classList.remove("field-error-border"); });
}

N.clearFieldErrors = clearFieldErrors;

function parseUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view") || "";
  const focus = params.get("focus") || "";
  const item = params.get("item") || "";
  return { view, focus, item };
}

N.applyUrlParams = async function applyUrlParams() {
  const { view, focus, item } = parseUrlParams();
  if (item && item.startsWith("item_")) {
    try { await N.openDetail(item); } catch (e) { /* item may not exist */ }
    return;
  }
  if (view === "mine") {
    N.switchView("mine");
    if (focus === "claims") {
      await new Promise(resolve => setTimeout(resolve, 300));
      const banner = N.$("pendingClaimsBanner");
      if (banner && !banner.hidden) {
        banner.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }
};

function bindEvents() {
  const viewButtons = document.querySelectorAll(".nav-item[data-view], .tab[data-view]");
  viewButtons.forEach(tab => {
    tab.addEventListener("click", () => {
      viewButtons.forEach(item => item.classList.toggle("active", item.dataset.view === tab.dataset.view));
      document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === `view-${tab.dataset.view}`));
      N.pulseElement(tab, "nav-bump");
      N.refreshMotion(document.querySelector(`#view-${tab.dataset.view}`) || document);
      if (tab.dataset.view === "publish") {
        const successCard = N.$("publishSuccessCard");
        if (successCard) successCard.hidden = true;
        N.syncPublishView();
        N.refreshMotion(N.$("view-publish"));
      }
      if (tab.dataset.view === "mine") {
        N.loadProfile();
        N.loadMyItems();
      }
    });
  });

  N.$("refreshButton").addEventListener("click", () => Promise.all([N.loadHome(), N.loadProfile()]));
  N.$("searchButton").addEventListener("click", N.loadHome);
  N.$("homeLoadMore").addEventListener("click", N.loadMoreHome);
  let searchDebounce;
  N.$("keywordInput").addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(N.loadHome, 300);
  });
  N.$("keywordInput").addEventListener("keydown", event => {
    if (event.key === "Enter") {
      clearTimeout(searchDebounce);
      N.loadHome();
    }
  });
  N.$("filterChips").addEventListener("click", event => {
    const selectButton = event.target.closest(".chip-select-btn");
    if (selectButton) {
      const select = selectButton.closest(".chip-select");
      const dropdown = select.querySelector(".chip-dropdown");
      const willOpen = !select.classList.contains("open");
      N.closeFilterDropdowns(select);
      select.classList.toggle("open", willOpen);
      if (dropdown) dropdown.hidden = !willOpen;
      return;
    }

    const option = event.target.closest(".chip-dropdown li");
    if (option) {
      const select = option.closest(".chip-select");
      if (select?.dataset.filter === "building") {
        const building = option.dataset.building || "";
        select.querySelectorAll("li").forEach(item => item.classList.toggle("selected", item === option));
        N.closeFilterDropdowns();
        N.filterByBuilding(building);
        return;
      }
      const category = option.dataset.category || "";
      document.querySelectorAll("#filterChips .chip").forEach(c => c.classList.remove("active"));
      select.classList.add("active");
      select.dataset.category = category;
      select.querySelectorAll("li").forEach(item => item.classList.toggle("selected", item === option));
      N.setFilterSelectLabel(select, option.textContent.trim());
      N.closeFilterDropdowns();
      N.$("subFilterChips").hidden = true;
      N.loadHome();
      return;
    }

    const chip = event.target.closest(".chip");
    if (!chip || chip.classList.contains("chip-select")) return;
    const isAll = chip.dataset.type === "" && chip.dataset.category === "";
    document.querySelectorAll("#filterChips .chip").forEach(c => c.classList.remove("active"));
    document.querySelectorAll("#filterChips .chip-select").forEach(select => {
      select.dataset.category = "";
      select.querySelectorAll("li").forEach(item => item.classList.remove("selected"));
      const topOption = select.querySelector("li[data-category='']");
      if (topOption) N.setFilterSelectLabel(select, topOption.textContent.trim());
    });
    N.closeFilterDropdowns();
    chip.classList.add("active");
    if (isAll) {
      N.$("subFilterChips").hidden = true;
    } else {
      N.renderSubChips(chip.dataset.type);
    }
    N.loadHome();
  });
  document.addEventListener("click", event => {
    if (!event.target.closest("#filterChips")) N.closeFilterDropdowns();
  });

  N.$("subFilterChips").addEventListener("click", event => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    chip.classList.toggle("active");
    N.loadHome();
  });
  N.$("itemList").addEventListener("click", event => {
    const card = event.target.closest(".item-card");
    if (card) N.openDetail(card.dataset.id);
  });
  // Empty state button delegation
  N.$("homeState").addEventListener("click", event => {
    if (event.target.id === "emptyStatePublishBtn") {
      N.switchView("publish");
    }
  });
  N.$("myItemList").addEventListener("click", async event => {
    const btn = event.target.closest("#emptyStatePublishBtn");
    if (btn) {
      N.switchView("publish");
      return;
    }
    const loginBtn = event.target.closest("#emptyStateLoginBtn");
    if (loginBtn) {
      const loginCard = N.$("mineLoginCard");
      if (loginCard) loginCard.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const claimButton = event.target.closest("[data-claim-action]");
    if (claimButton) {
      event.stopPropagation();
      N.reviewClaimFromButton(claimButton);
      return;
    }
    const ownerButton = event.target.closest("[data-owner-action]");
    if (ownerButton) {
      event.stopPropagation();
      const itemId = ownerButton.dataset.itemId;
      if (ownerButton.dataset.ownerAction === "edit") {
        await N.openMyItemDetail(itemId);
        N.startEditItem();
      } else if (ownerButton.dataset.ownerAction === "resubmit") {
        await N.openMyItemDetail(itemId);
        N.startEditItem();
        N.$("publishMessage").textContent = "正在重新提交被驳回的物品，修改后提交将重新进入审核";
      } else if (ownerButton.dataset.ownerAction === "delete") {
        N.handleListDelete(itemId, ownerButton);
      }
      return;
    }
    const card = event.target.closest(".item-card");
    if (card) N.openMyItemDetail(card.dataset.id);
  });
  N.$("pendingReviewsBanner").addEventListener("click", event => {
    const button = event.target.closest("[data-review-action='open']");
    if (!button) return;
    N.openReviewDialog(button.dataset.claimId);
  });
  N.$("closeDetailButton").addEventListener("click", () => N.animateCloseDialog(N.$("detailDialog")));
  N.$("detailDialog").addEventListener("click", event => {
    if (event.target.closest("#contactButton")) N.viewContact();
    if (event.target.closest("#claimButton")) N.requestClaim();
    if (event.target.closest("#cancelClaimButton")) N.cancelClaim();
    if (event.target.closest("#editItemButton")) N.startEditItem();
    if (event.target.closest("#takeDownButton")) N.takeDownMyItem();
    if (event.target.closest("#reportItemButton")) N.reportItem();
    const claimBtn = event.target.closest("[data-claim-action]");
    if (claimBtn) {
      event.stopPropagation();
      N.reviewClaimFromButton(claimBtn);
    }
  });
  document.querySelectorAll(".segment").forEach(button => {
    button.addEventListener("click", () => N.setPublishType(button.dataset.itemType));
  });
  N.$("iconGrid").addEventListener("click", event => {
    const toggle = event.target.closest("[data-toggle-icons]");
    if (toggle) {
      N.state.iconOtherOpen = !N.state.iconOtherOpen;
      N.renderIconGrid();
      return;
    }
    const button = event.target.closest(".icon-option");
    if (!button) return;
    N.state.selectedIcon = button.dataset.icon;
    N.renderIconGrid();
  });
  N.$("campusSelect").addEventListener("change", event => {
    N.state.publishCampusIndex = Math.max(0, N.state.locations.findIndex(campus => campus.name === event.target.value));
    N.state.publishBuildingIndex = 0;
    N.renderLocationSelects("publish");
  });
  N.$("buildingSelect").addEventListener("change", event => {
    const buildings = (currentCampus("publish")?.buildings) || [];
    N.state.publishBuildingIndex = Math.max(0, buildings.findIndex(building => building.name === event.target.value));
    N.renderLocationSelects("publish");
  });
  N.$("profileCampusSelect").addEventListener("change", event => {
    N.state.profileCampusIndex = Math.max(0, N.state.locations.findIndex(campus => campus.name === event.target.value));
    N.state.profileBuildingIndex = 0;
    N.renderLocationSelects("profile");
  });
  N.$("profileBuildingSelect").addEventListener("change", event => {
    const buildings = (currentCampus("profile")?.buildings) || [];
    N.state.profileBuildingIndex = Math.max(0, buildings.findIndex(building => building.name === event.target.value));
    N.renderLocationSelects("profile");
  });
  N.$("useProfileLocationInput").addEventListener("change", event => {
    if (event.target.checked && (!N.state.user?.campus || !N.state.user?.building)) {
      N.showToast("请先在「我的」页设置校区和楼栋，或取消勾选后手动选择", "info");
      event.target.checked = false;
      N.$("publishLocationFields").hidden = false;
      return;
    }
    N.$("publishLocationFields").hidden = event.target.checked;
  });
  N.$("noExpiryInput").addEventListener("change", N.toggleNoExpiry);
  N.$("publishForm").addEventListener("submit", N.submitPublish);
  N.$("titleInput").addEventListener("input", () => { updateCharCounts(); clearFieldErrors(); });
  N.$("descriptionInput").addEventListener("input", updateCharCounts);
  N.$("imageInput").addEventListener("change", event => N.uploadSelectedImages(event.target.files || []));
  N.$("imagePreviewList").addEventListener("click", event => {
    const removeButton = event.target.closest("[data-image-index]");
    if (!removeButton) return;
    N.state.uploadedImageUrls.splice(Number(removeButton.dataset.imageIndex), 1);
    N.renderImagePreviews();
  });
  N.$("imagePreviewList").addEventListener("dragover", event => {
    event.preventDefault();
    N.$("imagePreviewList").classList.add("is-dragover");
  });
  N.$("imagePreviewList").addEventListener("dragleave", event => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      N.$("imagePreviewList").classList.remove("is-dragover");
    }
  });
  N.$("imagePreviewList").addEventListener("drop", event => {
    event.preventDefault();
    N.$("imagePreviewList").classList.remove("is-dragover");
    N.uploadSelectedImages(event.dataTransfer?.files || []);
  });
  N.$("quantityInput").addEventListener("input", clearFieldErrors);
  N.$("wechatInput").addEventListener("input", clearFieldErrors);
  N.$("qqInput").addEventListener("input", clearFieldErrors);
  N.$("disclaimerInput").addEventListener("change", clearFieldErrors);
  N.$("sendEmailCodeButton").addEventListener("click", N.sendEmailCode);
  N.$("verifyEmailCodeButton").addEventListener("click", N.verifyEmailCode);
  N.$("passwordLoginButton").addEventListener("click", N.passwordLogin);
  N.$("passwordInput").addEventListener("keydown", event => {
    if (event.key === "Enter") N.passwordLogin();
  });
  N.$("sendCodeButton").addEventListener("click", N.sendCode);
  N.$("verifyCodeButton").addEventListener("click", N.verifyCode);
  N.$("saveProfileButton").addEventListener("click", N.saveProfile);
  N.$("loadMineButton").addEventListener("click", N.loadMyItems);
  N.$("openAgreementButton").addEventListener("click", () => {
    document.querySelector("#agreementDialog h3").textContent = "NanE 南易用户协议";
    N.loadAgreement();
    N.showMotionDialog(N.$("agreementDialog"));
  });
  N.$("closeAgreementButton").addEventListener("click", () => N.animateCloseDialog(N.$("agreementDialog")));
  N.$("closeClaimsModalButton").addEventListener("click", () => N.animateCloseDialog(N.$("claimsModal")));
  N.$("claimsModal").addEventListener("click", event => {
    const claimBtn = event.target.closest("[data-claim-action]");
    if (claimBtn) {
      event.stopPropagation();
      const row = claimBtn.closest(".claim-modal-row");
      N.reviewClaimFromButton(claimBtn).then(() => {
        row?.remove();
        N.refreshClaimsModal();
      });
    }
  });
  N.$("closeReviewDialogButton").addEventListener("click", () => N.animateCloseDialog(N.$("reviewDialog")));
  N.$("reviewDialog").addEventListener("click", event => {
    const tagButton = event.target.closest("[data-review-tag]");
    if (tagButton) {
      tagButton.classList.toggle("active");
      const message = N.$("reviewMessage");
      if (message) message.textContent = "";
      return;
    }
    if (event.target.closest("#reviewIssueInput")) {
      N.renderReviewTags(event.target.checked);
      const message = N.$("reviewMessage");
      if (message) message.textContent = "";
      return;
    }
    if (event.target.closest("#submitReviewButton")) {
      N.submitReview();
    }
  });
  document.querySelector(".profile-card").addEventListener("click", () => {
    if (!N.isVerifiedUser()) {
      const loginCard = N.$("mineLoginCard");
      if (loginCard) loginCard.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // Activate settings sub-tab in mine view
    const settingsSubtab = document.querySelector('.mine-subtab[data-mine-view="settings"]');
    if (settingsSubtab) settingsSubtab.click();
    setTimeout(() => {
      const formCard = N.$("profileFormCard");
      if (formCard) {
        formCard.hidden = false;
        formCard.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => N.$("nicknameInput").focus(), 400);
      }
    }, 300);
  });
  document.querySelectorAll(".login-tab").forEach(tab => {
    tab.addEventListener("click", () => N.switchLoginMode(tab.dataset.loginMode));
  });
  N.$("forgotPasswordButton").addEventListener("click", () => N.switchLoginMode("forgot"));
  N.$("backFromForgotButton").addEventListener("click", () => N.switchLoginMode("password"));
  N.$("sendResetCodeButton").addEventListener("click", N.sendResetCode);
  N.$("resetPasswordButton").addEventListener("click", N.resetPassword);
  N.$("resetPasswordInput").addEventListener("keydown", event => {
    if (event.key === "Enter") N.resetPassword();
  });
  N.$("setPasswordButton").addEventListener("click", N.setNewPassword);
  N.$("setPasswordInput").addEventListener("keydown", event => {
    if (event.key === "Enter") N.setNewPassword();
  });
  N.$("skipSetPasswordButton").addEventListener("click", () => {
    N.$("setPasswordPrompt").hidden = true;
    N.switchLoginMode("code");
  });
  N.$("darkModeToggle").addEventListener("change", N.toggleDarkMode);
  N.$("claimEmailToggle").addEventListener("change", N.toggleClaimEmail);
  N.$("settingsEditProfileButton").addEventListener("click", () => {
    N.$("profileFormCard").hidden = false;
    N.$("profileFormCard").scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => N.$("nicknameInput").focus(), 400);
  });
  N.$("pushToggle").addEventListener("change", N.togglePush);
  N.$("settingsExportDataButton").addEventListener("click", N.exportData);
  N.$("settingsDeleteAccountButton").addEventListener("click", N.deleteAccount);
  N.$("settingsChangePasswordButton").addEventListener("click", () => {
    N.$("changePasswordForm").hidden = false;
    N.$("settingsChangePasswordButton").hidden = true;
  });
  N.$("cancelChangePasswordButton").addEventListener("click", () => {
    N.$("changePasswordForm").hidden = true;
    N.$("settingsChangePasswordButton").hidden = false;
    N.$("changePasswordMessage").textContent = "";
  });
  N.$("changePasswordButton").addEventListener("click", N.changePassword);

  // Notification bell
  N.$("notificationBell").addEventListener("click", N.openNotificationPanel);
  N.$("closeNotificationPanel").addEventListener("click", () => N.animateCloseDialog(N.$("notificationPanel")));
  N.$("notificationPanel").addEventListener("click", event => {
    const item = event.target.closest(".notif-item");
    if (item && item.dataset.itemId) {
      N.animateCloseDialog(N.$("notificationPanel"));
      N.openDetail(item.dataset.itemId);
    }
  });

  // Onboarding
  N.$("onboardNext").addEventListener("click", N.onboardNext);
  N.$("onboardSkip").addEventListener("click", N.finishOnboarding);

  // Activity feed click
  N.$("activityFeed").addEventListener("click", event => {
    const item = event.target.closest(".activity-item");
    if (item && item.dataset.itemId) {
      N.openDetail(item.dataset.itemId);
    }
  });

  // Mine sub-tab toggle
  document.querySelectorAll(".mine-subtab").forEach(subtab => {
    subtab.addEventListener("click", () => {
      document.querySelectorAll(".mine-subtab").forEach(s => s.classList.toggle("active", s === subtab));
      const view = subtab.dataset.mineView;
      if (view === "items") {
        N.$("mineItemsPanel").hidden = false;
        N.$("mineSettingsPanel").hidden = true;
      } else if (view === "settings") {
        N.$("mineItemsPanel").hidden = true;
        N.$("mineSettingsPanel").hidden = false;
        N.loadProfile();
        N.loadSettings();
      }
    });
  });

  N.$("settingsLogoutButton").addEventListener("click", async () => {
    const ok = await N.showConfirmDialog("确定要登出吗？");
    if (ok) N.logout();
  });
  // Post-publish confirmation buttons
  const viewMyBtn = N.$("viewMyPublishBtn");
  const continueBtn = N.$("continuePublishBtn");
  if (viewMyBtn) {
    viewMyBtn.addEventListener("click", () => {
      const successCard = N.$("publishSuccessCard");
      const form = N.$("publishForm");
      if (successCard) successCard.hidden = true;
      if (form) form.hidden = false;
      // Reset form for next use
      N.$("publishForm").reset();
      N.$("quantityInput").value = "1";
      N.$("unitInput").value = "件";
      N.setExpireDate("2026-12-31");
      N.setDateRowDisabled(false);
      N.$("noExpiryInput").checked = false;
      N.$("useProfileLocationInput").checked = true;
      N.$("publishLocationFields").hidden = true;
      N.$("disclaimerInput").checked = false;
      N.resetUploadedImages();
      N.setPublishType(N.state.selectedPublishType);
      N.renderLocationSelects("publish");
      N.switchView("mine");
      setTimeout(() => {
        const itemsPanel = N.$("mineItemsPanel");
        if (itemsPanel) itemsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    });
  }
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      const successCard = N.$("publishSuccessCard");
      const form = N.$("publishForm");
      if (successCard) successCard.hidden = true;
      if (form) {
        form.hidden = false;
        form.reset();
        N.$("quantityInput").value = "1";
        N.$("unitInput").value = "件";
        N.setExpireDate("2026-12-31");
        N.setDateRowDisabled(false);
        N.$("noExpiryInput").checked = false;
        N.$("useProfileLocationInput").checked = true;
        N.$("publishLocationFields").hidden = true;
        N.$("disclaimerInput").checked = false;
        N.resetUploadedImages();
        N.setPublishType(N.state.selectedPublishType);
        N.renderLocationSelects("publish");
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  // Publish interstitial CTA buttons
  const goToLoginBtn = N.$("goToLoginFromPublish");
  const goToHomeBtn = N.$("goToHomeFromPublish");
  if (goToLoginBtn) {
    goToLoginBtn.addEventListener("click", () => {
      N.switchView("mine");
      setTimeout(() => {
        const loginCard = N.$("mineLoginCard");
        if (loginCard) loginCard.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    });
  }
  if (goToHomeBtn) {
    goToHomeBtn.addEventListener("click", () => {
      N.switchView("home");
    });
  }
  N.$("settingsAgreementButton")?.addEventListener("click", () => {
    document.querySelector("#agreementDialog h3").textContent = "NanE 南易用户协议";
    N.loadAgreement();
    N.showMotionDialog(N.$("agreementDialog"));
  });
  N.$("settingsPrivacyButton")?.addEventListener("click", async () => {
    try {
      const data = await N.api("/legal/privacy");
      N.$("agreementBody").innerHTML = N.markdownToHtml(data.markdown || "隐私保护指引暂不可用。");
      document.querySelector("#agreementDialog h3").textContent = "NanE 隐私保护指引";
      N.showMotionDialog(N.$("agreementDialog"));
    } catch (error) {
      N.showToast("隐私保护指引加载失败", "error");
    }
  });
  N.$("footerAgreementButton")?.addEventListener("click", async () => {
    document.querySelector("#agreementDialog h3").textContent = "NanE 南易用户协议";
    await N.loadAgreement();
    N.showMotionDialog(N.$("agreementDialog"));
  });
  N.$("footerPrivacyButton")?.addEventListener("click", async () => {
    try {
      const data = await N.api("/legal/privacy");
      N.$("agreementBody").innerHTML = N.markdownToHtml(data.markdown || "隐私保护指引暂不可用。");
      document.querySelector("#agreementDialog h3").textContent = "NanE 隐私保护指引";
      N.showMotionDialog(N.$("agreementDialog"));
    } catch (error) {
      N.showToast("隐私保护指引加载失败", "error");
    }
  });
}

async function init() {
  N.initDarkMode();
  initDateControls();
  N.initPressFeedback();
  bindEvents();
  N.refreshMotion(document);
  N.initLottieAnimations(document);
  await Promise.all([N.loadAgreement(), N.loadLocations()]);
  N.renderIconGrid();
  N.setPublishType("consumable");
  N.renderImagePreviews();
  await Promise.all([N.loadHome(), N.loadProfile()]);
  N.syncPublishView();
  N.refreshMotion(document);
  await N.applyUrlParams();

  // Start notification polling (every 30s when logged in)
  N.pollNotifications();
  N._notifInterval = setInterval(() => N.pollNotifications(), 30000);

  // Show onboarding for first-time visitors
  N.checkOnboarding();

  // Render building filter chips after locations are loaded
  N.renderBuildingChips();

  // Set up push notifications
  N.setupPushNotifications();

  // Set up PWA install prompt
  N.setupInstallPrompt();
}

// ── Web Push ──────────────────────────────────────────────────────

N.setupPushNotifications = async function setupPushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (!N.isVerifiedUser()) return;
  const pref = localStorage.getItem("nane_push_enabled");
  if (pref !== "1") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) {
      // Need to subscribe
      const keyData = await N.api("/me/push/public-key");
      if (!keyData.configured || !keyData.publicKey) return;
      const newSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(keyData.publicKey)
      });
      await N.api("/me/push/subscribe", {
        method: "POST",
        body: JSON.stringify(newSub.toJSON())
      });
    }
  } catch (_) { /* Silently fail; push is optional */ }
};

N.enablePush = async function enablePush() {
  if (!("PushManager" in window)) {
    N.showToast("当前浏览器不支持推送通知", "info");
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    N.showToast("需要允许通知权限才能接收推送", "info");
    return;
  }
  localStorage.setItem("nane_push_enabled", "1");
  await N.setupPushNotifications();
  N.showToast("推送通知已开启", "success");
};

N.disablePush = async function disablePush() {
  localStorage.removeItem("nane_push_enabled");
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await N.api("/me/push/unsubscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint: sub.endpoint })
      });
      await sub.unsubscribe();
    }
  } catch (_) {}
  N.showToast("推送通知已关闭", "success");
};

// ── PWA Install Prompt ────────────────────────────────────────────

N._deferredPrompt = null;

N.setupInstallPrompt = function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    N._deferredPrompt = e;
    if (localStorage.getItem("nane_install_dismissed")) return;
    N.showInstallBanner();
  });
  window.addEventListener("appinstalled", () => {
    N._deferredPrompt = null;
    N.dismissInstallBanner();
  });
};

N.showInstallBanner = function showInstallBanner() {
  const existing = document.getElementById("installBanner");
  if (existing) return;
  const banner = document.createElement("div");
  banner.id = "installBanner";
  banner.className = "install-banner";
  banner.innerHTML = `
    <div class="install-banner-inner">
      <span>📱 添加到主屏幕，使用更方便</span>
      <div class="install-banner-actions">
        <button class="secondary small" id="installDismiss">以后再说</button>
        <button class="primary small" id="installNow">立即添加</button>
      </div>
    </div>
  `;
  document.body.appendChild(banner);
  banner.querySelector("#installNow").addEventListener("click", async () => {
    if (!N._deferredPrompt) return;
    N._deferredPrompt.prompt();
    const { outcome } = await N._deferredPrompt.userChoice;
    N._deferredPrompt = null;
    N.dismissInstallBanner();
    localStorage.setItem("nane_install_outcome", outcome);
  });
  banner.querySelector("#installDismiss").addEventListener("click", () => {
    N.dismissInstallBanner();
    localStorage.setItem("nane_install_dismissed", "1");
  });
};

N.dismissInstallBanner = function dismissInstallBanner() {
  const banner = document.getElementById("installBanner");
  if (banner) banner.remove();
};

function urlB64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// ── Notification center ──────────────────────────────────────────

N._lastNotifTime = "";

N.pollNotifications = async function pollNotifications() {
  if (!N.isVerifiedUser()) {
    N.updateNotifBadge(0);
    return;
  }
  try {
    const params = N._lastNotifTime ? `?since=${encodeURIComponent(N._lastNotifTime)}` : "";
    const data = await N.api(`/me/notifications/feed${params}`);
    if (data.events?.length && data.total) {
      N.updateNotifBadge(data.total);
      N._lastNotifTime = data.events[0]?.createdAt || N._lastNotifTime;
      // Cache latest events for the panel
      N._cachedNotifs = data.events.slice(0, 20);
    }
  } catch (error) {
    // Silently ignore polling errors
  }
};

N.updateNotifBadge = function updateNotifBadge(count) {
  const badge = N.$("notificationBadge");
  if (!badge) return;
  const num = Number(count) || 0;
  badge.textContent = num > 99 ? "99+" : num;
  badge.hidden = num <= 0;
};

N.openNotificationPanel = function openNotificationPanel() {
  N.updateNotifBadge(0);
  const list = N.$("notificationList");
  if (!list) return;
  const events = N._cachedNotifs || [];
  if (!events.length) {
    list.innerHTML = '<div class="notif-empty">暂无新消息</div>';
  } else {
    list.innerHTML = events.map(e => {
      const timeStr = N.compactDate(e.createdAt) || "";
      const dotClass = e.type.replace(/_/g, "-");
      return `
        <div class="notif-item" data-item-id="${N.escapeHtml(e.itemId || "")}">
          <span class="notif-dot ${dotClass}"></span>
          <div class="notif-body">
            <strong>${N.escapeHtml(e.title)}</strong>
            <span>${N.escapeHtml(e.detail)}</span>
          </div>
          ${timeStr ? `<span class="notif-time">${N.escapeHtml(timeStr)}</span>` : ""}
        </div>
      `;
    }).join("");
  }
  N.showMotionDialog(N.$("notificationPanel"));
};

// ── Onboarding ────────────────────────────────────────────────────

N.checkOnboarding = function checkOnboarding() {
  if (localStorage.getItem("nane_onboarded")) return;
  N.$("onboardingOverlay").hidden = false;
};

N._onboardStep = 0;

N.onboardNext = function onboardNext() {
  const steps = document.querySelectorAll(".onboard-step");
  const dots = document.querySelectorAll(".onboard-dot");
  N._onboardStep++;
  if (N._onboardStep >= steps.length) {
    N.finishOnboarding();
    return;
  }
  steps.forEach(s => s.classList.remove("active"));
  dots.forEach(d => d.classList.remove("active"));
  steps[N._onboardStep].classList.add("active");
  dots[N._onboardStep].classList.add("active");
  if (N._onboardStep >= steps.length - 1) {
    N.$("onboardNext").textContent = "开始使用";
  }
};

N.finishOnboarding = function finishOnboarding() {
  N.$("onboardingOverlay").hidden = true;
  localStorage.setItem("nane_onboarded", "1");
};

init();

})(window.NanE);
