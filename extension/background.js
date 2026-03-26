const APP_ORIGIN = "http://localhost:3000";

function encodeCapturePayload(payload) {
  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function scrapePage() {
  const readMeta = (key, attribute = "property") =>
    document.querySelector(`meta[${attribute}="${key}"]`)?.getAttribute("content") || "";

  const articleText =
    document.querySelector("article")?.innerText ||
    document.querySelector("main")?.innerText ||
    document.body.innerText ||
    "";

  return {
    sourceUrl: location.href,
    sourceType: /instagram\.com/.test(location.hostname) ? "instagram_reel" : "web",
    pageTitle: document.title,
    imageUrl: readMeta("og:image"),
    captionText: /instagram\.com/.test(location.hostname) ? articleText : "",
    selectionText: window.getSelection()?.toString() || ""
  };
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) {
    return;
  }

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: scrapePage
  });

  if (!result?.sourceUrl) {
    return;
  }

  const encoded = encodeCapturePayload(result);
  const importUrl = `${APP_ORIGIN}/import?url=${encodeURIComponent(result.sourceUrl)}&capture=${encodeURIComponent(encoded)}`;

  chrome.tabs.create({ url: importUrl });
});
