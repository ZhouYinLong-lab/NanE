window.NanE = window.NanE || {};
(function(N) {

const mountedAnimations = [];

function fallbackGraphic(container) {
  container.classList.add("lottie-fallback");
  container.innerHTML = `
    <svg viewBox="0 0 320 240" role="img" aria-label="南易互助流转动画静帧">
      <ellipse cx="160" cy="120" rx="110" ry="77" fill="currentColor" opacity="0.08"/>
      <path d="M89 86L160 120L233 86M160 120V186" fill="none" stroke="#25735a" stroke-width="3" stroke-linecap="round" opacity="0.55"/>
      <circle cx="160" cy="120" r="29" fill="#6E0065"/>
      <path d="M146 125l11 9 18-27" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="89" cy="86" r="19" fill="#fff" opacity="0.96"/>
      <path d="M81 86h16M89 78v16" stroke="#6E0065" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="233" cy="86" r="19" fill="#e5f8f3"/>
      <path d="M224 88l7 7 13-18" fill="none" stroke="#25735a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="160" cy="186" r="19" fill="#fff" opacity="0.96"/>
      <circle cx="160" cy="186" r="5" fill="#6E0065" opacity="0.72"/>
      <circle cx="151" cy="186" r="2.8" fill="#6E0065" opacity="0.5"/>
      <circle cx="169" cy="186" r="2.8" fill="#6E0065" opacity="0.5"/>
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
