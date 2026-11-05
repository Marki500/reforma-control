// Old confirmation/recovery links may return to the previous root URL.
// Preserve the complete fragment in the browser, without sending it to a server.
(() => {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const hasAuthReturn = ['access_token', 'refresh_token', 'error_description', 'token_hash'].some(key => hash.has(key) || url.searchParams.has(key)) || url.searchParams.has('code') || url.searchParams.has('invite');
  const installedApp = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (hasAuthReturn || installedApp) window.location.replace(`https://app-reforma.noxumlab.com/${url.search}${url.hash}`);
})();
