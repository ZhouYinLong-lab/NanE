window.NanE = window.NanE || {};
(function(N) {

const MOTION_CLASSES = new Set([
  "welcome-banner", "search-row", "chips", "section-head",
  "state-card", "form-card", "rules-card", "motion-section",
  "profile-card", "claim-banner", "review-banner", "settings-row",
  "item-card", "claim-banner-row", "review-banner-row", "claim-modal-row",
  "review-target", "review-tags", "review-tag",
  "trust-card", "profile-trust-card",
  "detail-gallery", "detail-meta",
  "contact-field", "contact-box", "notice-line",
  "image-preview", "image-upload-progress", "image-empty",
  "icon-option", "empty-state"
]);

let motionObserver = null;

N.MOTION_CLASSES = MOTION_CLASSES;

N.prefersReducedMotion = function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
};

function ensureMotionObserver() {
  if (motionObserver || N.prefersReducedMotion()) {
    return motionObserver;
  }
  motionObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("motion-visible");
      motionObserver.unobserve(entry.target);
    }
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  return motionObserver;
}

N.motionSelector = function motionSelector() {
  return [...MOTION_CLASSES].map(c => `.${c}`).join(",");
};

N.setMotionIndexes = function setMotionIndexes(root) {
  if (root === void 0) root = document;
  const groups = [
    [".item-list", ".item-card, .skeleton-card"],
    [".chips", ".chip, .chip-select"],
    [".review-tags", ".review-tag"],
    ["#pendingClaimsList", ".claim-banner-row"],
    ["#pendingReviewsList", ".review-banner-row"],
    ["#claimsModalBody", ".claim-modal-row"],
    [".claim-panel", ".claim-row"],
    ["#iconGrid", ".icon-option"],
    ["#imagePreviewList", ".image-preview, .image-upload-progress, .image-empty"],
    ["#contactResult", ".contact-box, .claim-button"],
    ["#claimResult", ".contact-box"],
    ["#detailBody", ".detail-gallery, .detail-meta, .item-desc, .trust-card, .notice-line, #contactButton, #contactResult, #shareItemButton, .contact-box, .claim-panel, .owner-actions"]
  ];
  for (const [groupSelector, childSelector] of groups) {
    root.querySelectorAll?.(groupSelector).forEach(group => {
      [...group.querySelectorAll(childSelector)].forEach((item, index) => {
        item.style.setProperty("--motion-index", String(Math.min(index, 8)));
      });
    });
  }
};

N.isMotionHidden = function isMotionHidden(element) {
  return element.hidden || Boolean(element.closest("[hidden]"));
};

N.prepareMotion = function prepareMotion(root) {
  if (root === void 0) root = document;
  N.setMotionIndexes(root);
  const sel = N.motionSelector();
  const descendants = root.querySelectorAll ? [...root.querySelectorAll(sel)] : [];
  const elements = root.matches?.(sel) ? [root, ...descendants] : descendants;
  const observer = ensureMotionObserver();
  elements.forEach(element => {
    if (N.isMotionHidden(element) || element.dataset.motionReady === "1") return;
    element.dataset.motionReady = "1";
    element.classList.add("motion-ready");
    if (N.prefersReducedMotion() || !observer) {
      element.classList.add("motion-visible");
      return;
    }
    observer.observe(element);
  });
};

N.refreshMotion = function refreshMotion(root) {
  if (root === void 0) root = document;
  requestAnimationFrame(() => N.prepareMotion(root));
};

N.showMotionDialog = function showMotionDialog(dialog) {
  if (!dialog) return;
  dialog.classList.remove("is-closing");
  if (!dialog.open) {
    dialog.showModal();
  }
  N.refreshMotion(dialog);
};

N.animateCloseDialog = function animateCloseDialog(dialog, options) {
  if (options === void 0) options = {};
  if (!dialog) return;
  if (N.prefersReducedMotion() || !dialog.open) {
    if (dialog.open) dialog.close();
    if (options.remove) dialog.remove();
    return;
  }
  dialog.classList.add("is-closing");
  dialog.addEventListener("animationend", () => {
    dialog.classList.remove("is-closing");
    dialog.close();
    if (options.remove) dialog.remove();
  }, { once: true });
};

N.closeAndRemoveDialog = function closeAndRemoveDialog(dialog) {
  N.animateCloseDialog(dialog, { remove: true });
};

N.pulseElement = function pulseElement(element, className) {
  if (!element || N.prefersReducedMotion()) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  element.addEventListener("animationend", () => element.classList.remove(className), { once: true });
};

N.initPressFeedback = function initPressFeedback() {
  document.addEventListener("pointerdown", event => {
    const target = event.target.closest("button, .item-card, .link-button");
    if (!target || target.disabled) return;
    target.classList.add("is-pressing");
    const clear = () => target.classList.remove("is-pressing");
    target.addEventListener("pointerup", clear, { once: true });
    target.addEventListener("pointercancel", clear, { once: true });
    target.addEventListener("pointerleave", clear, { once: true });
    setTimeout(clear, 260);
  });
};

})(window.NanE);
