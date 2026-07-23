const pageName = document.querySelector("#page-name");
const status = document.querySelector("#status");
const itemsContainer = document.querySelector("#items");
const template = document.querySelector("#item-template");
const clearButton = document.querySelector("#clear");

let tabId;

function friendlyHost(url) {
  try { return new URL(url).hostname; } catch { return "this page"; }
}

function render(items) {
  itemsContainer.replaceChildren();
  if (!items.length) {
    status.textContent = "No audio links found yet. Start playback, then reopen this popup if needed.";
    return;
  }

  status.textContent = `${items.length} downloadable audio link${items.length === 1 ? "" : "s"} found.`;
  for (const item of items) {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector(".filename").textContent = item.name || "audio-download";
    fragment.querySelector(".metadata").textContent = `${item.source || "Page"} · ${item.mime || "Unknown type"}`;
    fragment.querySelector(".url").textContent = item.url;
    const button = fragment.querySelector(".download");
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Starting…";
      const result = await chrome.runtime.sendMessage({ type: "download-audio", url: item.url, name: item.name });
      if (result?.ok) {
        button.textContent = "Started";
      } else {
        button.disabled = false;
        button.textContent = "Retry";
        status.textContent = result?.error || "The browser could not start this download.";
      }
    });
    itemsContainer.append(fragment);
  }
}

async function refresh() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    pageName.textContent = "No active tab";
    render([]);
    return;
  }
  tabId = tab.id;
  pageName.textContent = tab.title || friendlyHost(tab.url || "");
  const result = await chrome.runtime.sendMessage({ type: "get-audio", tabId });
  render(result?.items || []);
}

clearButton.addEventListener("click", async () => {
  if (typeof tabId !== "number") return;
  await chrome.runtime.sendMessage({ type: "clear-audio", tabId });
  render([]);
  status.textContent = "Cleared. Reload or play audio to detect it again.";
});

refresh().catch((error) => {
  pageName.textContent = "Extension error";
  status.textContent = error.message || "Could not inspect this tab.";
});
