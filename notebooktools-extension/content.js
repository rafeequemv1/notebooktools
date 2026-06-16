function getReadablePageText() {
  const main = document.querySelector("main, article") || document.body;
  const text = main ? main.innerText : document.body.innerText;

  return {
    title: document.title || "Untitled page",
    url: window.location.href,
    content: text.replace(/\n{3,}/g, "\n\n").trim()
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "NOTEBOOKTOOLS_GET_PAGE") {
    return false;
  }

  sendResponse(getReadablePageText());
  return true;
});
