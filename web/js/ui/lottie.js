window.NanE = window.NanE || {};
(function(N) {

const mountedAnimations = [];

function fallbackGraphic(container) {
  container.classList.add("lottie-fallback");
  container.innerHTML = `
    <svg viewBox="0 0 320 240" role="img" aria-label="南易互助流转动画静帧">
      <ellipse cx="160" cy="120" rx="116" ry="83" fill="currentColor" opacity="0.08"/>
      <ellipse cx="160" cy="120" rx="107" ry="67" fill="none" stroke="#25735a" stroke-width="3" opacity="0.42"/>
      <circle cx="160" cy="120" r="35" fill="#6E0065"/>
      <path d="M146 118l12 12 25-29" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="40" y="48" width="78" height="48" rx="14" fill="#fff" opacity="0.94"/>
      <rect x="206" y="48" width="74" height="44" rx="13" fill="#e5f8f3"/>
      <rect x="122" y="174" width="78" height="46" rx="14" fill="#fff" opacity="0.94"/>
    </svg>`;
}

N.initLottieAnimations = function initLottieAnimations(root) {
  const scope = root || document;
  const containers = scope.querySelectorAll("[data-lottie-src]");
  if (!containers.length) return;

  containers.forEach(container => {
    if (container.dataset.lottieMounted === "1") return;
    container.dataset.lottieMounted = "1";

    if (!window.lottie || typeof window.lottie.loadAnimation !== "function") {
      fallbackGraphic(container);
      return;
    }

    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    fetch(container.dataset.lottieSrc, { cache: "force-cache" })
      .then(response => {
        if (!response.ok) throw new Error("lottie asset unavailable");
        return response.json();
      })
      .then(animationData => {
        const animation = window.lottie.loadAnimation({
          container,
          renderer: "svg",
          loop: !reduceMotion,
          autoplay: !reduceMotion,
          animationData,
          rendererSettings: {
            preserveAspectRatio: "xMidYMid meet",
            progressiveLoad: true
          }
        });
        if (reduceMotion) animation.goToAndStop(44, true);
        mountedAnimations.push(animation);
      })
      .catch(() => fallbackGraphic(container));
  });
};

N.destroyLottieAnimations = function destroyLottieAnimations() {
  while (mountedAnimations.length) {
    const animation = mountedAnimations.pop();
    if (animation && typeof animation.destroy === "function") animation.destroy();
  }
};

})(window.NanE);
