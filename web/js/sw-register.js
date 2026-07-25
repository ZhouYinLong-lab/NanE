// Service Worker registration — extracted to a separate file so CSP does not
// require 'unsafe-inline' for the inline script block.
// Skipped on GitHub Pages demo deployments since the fetch() interceptor
// handles all /api/* requests and the SW would conflict.
(function() {
  var host = location.hostname;
  var isGitHubPages = host.indexOf('github') !== -1 || host === 'nane.zylatent.com';
  if (!('serviceWorker' in navigator) || isGitHubPages) return;
  navigator.serviceWorker.register('/web/sw.js').catch(function(error) {
    console.warn('[SW] Registration failed:', error);
  });
})();
