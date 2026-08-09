const pageName = document.querySelector("#page-name");
const status = document.querySelector("#status");
const itemsContainer = document.querySelector("#items");
const template = document.querySelector("#item-template");
const clearButton = document.querySelector("#clear");
const searchInput = document.querySelector("#search");

let tabId;
let allItems = [];

function friendlyHost(url) {
  try { return new URL(url).hostname; } catch { return "this page"; }
}

function normalized(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase();
}

function matchesSearch(item, query) {
  if (!query) return true;
  return normalized([item.name, item.source, item.mime, item.url].join(" ")).includes(query);
}

function render() {
  const query = normalized(searchInput.value.trim());
  const items = allItems.filter((item) => matchesSearch(item, query));
  itemsContainer.replaceChildren();
  if (!allItems.length) {
    status.textContent = "No audio links found yet. Start playback, then reopen this popup if needed.";
    return;
  }

  if (!items.length) {
    status.textContent = `No audio links match “${searchInput.value.trim()}”.`;
    return;
  }

  status.textContent = query
    ? `Showing ${items.length} of ${allItems.length} audio link${allItems.length === 1 ? "" : "s"}.`
    : `${items.length} downloadable audio link${items.length === 1 ? "" : "s"} found.`;
  for (const item of items) {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector(".filename").textContent = item.name || "audio-download";
    fragment.querySelector(".metadata").textContent = `${item.source || "Page"} · ${item.mime || "Unknown type"}`;
    const url = fragment.querySelector(".url");
    url.textContent = item.url;
    url.title = item.url;
    const button = fragment.querySelector(".download");
    button.setAttribute("aria-label", `Download ${item.name || "audio"}`);
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
    allItems = [];
    render();
    return;
  }
  tabId = tab.id;
  pageName.textContent = tab.title || friendlyHost(tab.url || "");
  const result = await chrome.runtime.sendMessage({ type: "get-audio", tabId });
  allItems = result?.items || [];
  render();
}

searchInput.addEventListener("input", render);

clearButton.addEventListener("click", async () => {
  if (typeof tabId !== "number") return;
  await chrome.runtime.sendMessage({ type: "clear-audio", tabId });
  allItems = [];
  searchInput.value = "";
  render();
  status.textContent = "Cleared. Reload or play audio to detect it again.";
});

refresh().catch((error) => {
  pageName.textContent = "Extension error";
  status.textContent = error.message || "Could not inspect this tab.";
});
