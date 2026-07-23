const MAX_ITEMS_PER_TAB = 250;

/** @type {Map<number, Map<string, AudioItem>>} */
const audioByTab = new Map();

const AUDIO_MIME_HINTS = [
  "audio/",
  "application/ogg",
  "application/x-ogg",
  "application/vnd.apple.mpegurl",
  "application/x-mpegurl",
  "application/dash+xml"
];

const AUDIO_EXTENSIONS = new Set([
  "aac", "aiff", "alac", "ape", "au", "caf", "dff", "dsd", "dsf", "flac",
  "m4a", "m4b", "m4p", "mid", "midi", "mp1", "mp2", "mp3", "mpc", "oga",
  "ogg", "opus", "ra", "ram", "snd", "tta", "wav", "weba", "wma", "wv",
  "m3u", "m3u8", "pls", "xspf"
]);

/**
 * @typedef {Object} AudioItem
 * @property {string} id
 * @property {string} url
 * @property {string} name
 * @property {string} serverName
 * @property {string} mime
 * @property {string} source
 * @property {number} seenAt
 */

function headerValue(headers, wantedName) {
  return headers?.find((header) => header.name.toLowerCase() === wantedName)?.value || "";
}

function isAudioResponse(contentType, url) {
  const normalizedType = contentType.toLowerCase().split(";", 1)[0].trim();
  return AUDIO_MIME_HINTS.some((hint) => normalizedType.startsWith(hint)) || hasAudioExtension(url);
}

function hasAudioExtension(url) {
  try {
    const pathname = new URL(url).pathname;
    const extension = pathname.split(".").pop()?.toLowerCase();
    return Boolean(extension && AUDIO_EXTENSIONS.has(extension));
  } catch {
    return false;
  }
}

function filenameFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split("/").filter(Boolean).pop();
    if (lastSegment) {
      return decodeURIComponent(lastSegment);
    }
  } catch {
    // A display fallback is supplied below.
  }
  return "audio-download";
}

function filenameFromDisposition(contentDisposition) {
  if (!contentDisposition) return "";

  // RFC 5987: filename*=UTF-8''%E6%97%A5%E6%9C%AC%E8%AA%9E.mp3
  const extended = contentDisposition.match(/filename\*\s*=\s*(?:[A-Za-z0-9!#$&+^_.-]+''|)([^;]+)/i);
  if (extended?.[1]) {
    try {
      return decodeURIComponent(extended[1].trim().replace(/^['\"]|['\"]$/g, ""));
    } catch {
      return extended[1].trim().replace(/^['\"]|['\"]$/g, "");
    }
  }

  const ordinary = contentDisposition.match(/filename\s*=\s*(?:"([^"]+)"|([^;\s]+))/i);
  return ordinary ? ordinary[1] || ordinary[2] : "";
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return url;
  }
}

function itemId(url) {
  return normalizeUrl(url);
}

function addAudio(tabId, candidate) {
  if (tabId < 0 || !candidate?.url || /^blob:/i.test(candidate.url)) return;

  let entries = audioByTab.get(tabId);
  if (!entries) {
    entries = new Map();
    audioByTab.set(tabId, entries);
  }

  const id = itemId(candidate.url);
  const previous = entries.get(id);
  const serverName = filenameFromDisposition(candidate.contentDisposition || "") || previous?.serverName || "";
  const item = {
    id,
    url: normalizeUrl(candidate.url),
    // A server-provided filename is usually more precise than a page title.
    name: serverName || candidate.name || previous?.name || filenameFromUrl(candidate.url),
    serverName,
    mime: candidate.mime || previous?.mime || "Unknown audio type",
    source: candidate.source || previous?.source || "Page",
    seenAt: Date.now()
  };

  entries.set(id, { ...previous, ...item });
  while (entries.size > MAX_ITEMS_PER_TAB) {
    entries.delete(entries.keys().next().value);
  }
}

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0 || details.statusCode >= 400) return;
    const contentType = headerValue(details.responseHeaders, "content-type");
    if (!isAudioResponse(contentType, details.url)) return;

    addAudio(details.tabId, {
      url: details.url,
      mime: contentType || "Audio-like URL",
      contentDisposition: headerValue(details.responseHeaders, "content-disposition"),
      source: "Network"
    });
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

chrome.tabs.onRemoved.addListener((tabId) => audioByTab.delete(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") audioByTab.delete(tabId);
});

function safeDownloadName(rawName, url) {
  let name = String(rawName || filenameFromUrl(url) || "audio-download")
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();

  if (!name) name = "audio-download";
  if (name.length > 180) {
    const dot = name.lastIndexOf(".");
    const extension = dot > 0 ? name.slice(dot, Math.min(name.length, dot + 16)) : "";
    name = `${name.slice(0, 180 - extension.length)}${extension}`;
  }

  if (!/\.[^./]+$/.test(name)) {
    try {
      const extension = new URL(url).pathname.split(".").pop();
      if (extension && extension.length <= 10 && /^[a-z0-9]+$/i.test(extension)) {
        name += `.${extension}`;
      }
    } catch {
      // A filename without an extension is still valid for a download.
    }
  }
  return name;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "audio-found" && sender.tab?.id !== undefined) {
    for (const item of message.items || []) addAudio(sender.tab.id, item);
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "get-audio" && typeof message.tabId === "number") {
    const items = [...(audioByTab.get(message.tabId)?.values() || [])]
      .sort((a, b) => b.seenAt - a.seenAt);
    sendResponse({ items });
    return;
  }

  if (message?.type === "clear-audio" && typeof message.tabId === "number") {
    audioByTab.delete(message.tabId);
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "download-audio") {
    const { url, name } = message;
    if (!url || !/^https?:/i.test(url)) {
      sendResponse({ ok: false, error: "Only direct HTTP(S) audio URLs can be downloaded." });
      return;
    }

    chrome.downloads.download(
      {
        url,
        filename: safeDownloadName(name, url),
        conflictAction: "uniquify",
        saveAs: false
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ ok: true, downloadId });
        }
      }
    );
    return true;
  }
});
