/* Dev auto-reload ping. Asks the background to compare dev-stamp.txt every
   few seconds; stops at once on a store install (the background says dev:false). */
(function () {
  "use strict";

  const EVERY_MS = 3000;
  let timer = 0;

  function ping() {
    try {
      chrome.runtime.sendMessage({ type: "notebooktools-dev-check" }, (response) => {
        if (chrome.runtime.lastError || !response?.dev) {
          window.clearInterval(timer);
        }
      });
    } catch (_error) {
      // The extension was reloaded under this page: stop quietly.
      window.clearInterval(timer);
    }
  }

  timer = window.setInterval(ping, EVERY_MS);
  ping();
})();
