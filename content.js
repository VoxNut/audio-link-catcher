(() => {
  const AUDIO_EXTENSIONS = /\.(aac|aiff|alac|ape|au|caf|dff|dsd|dsf|flac|m4a|m4b|m4p|mid|midi|mp1|mp2|mp3|mpc|oga|ogg|opus|ra|ram|snd|tta|wav|weba|wma|wv|m3u|m3u8|pls|xspf)(?:$|[?#])/i;
  let queued = false;

  function absoluteUrl(value) {
    if (!value || /^blob:/i.test(value)) return "";
    try {
      const url = new URL(value, document.baseURI);
      return /^https?:$/i.test(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function cleanName(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function scan() {
    queued = false;
    const found = new Map();
    const add = (url, name, source, mime = "") => {
      const absolute = absoluteUrl(url);
      if (!absolute) return;
      found.set(absolute, { url: absolute, name: cleanName(name), source, mime });
    };

    document.querySelectorAll("audio, video").forEach((media) => {
      const label = media.getAttribute("title") || media.getAttribute("aria-label") || document.title;
      if (media.currentSrc) add(media.currentSrc, label, media.tagName === "AUDIO" ? "Audio element" : "Video element", media.type || "");
      if (media.src) add(media.src, label, media.tagName === "AUDIO" ? "Audio element" : "Video element", media.type || "");
      media.querySelectorAll("source").forEach((source) => {
        add(source.src, label, `${media.tagName.toLowerCase()} source`, source.type || "");
      });
    });

    document.querySelectorAll("a[href], link[href]").forEach((link) => {
      const href = link.getAttribute("href") || "";
      const type = link.getAttribute("type") || "";
      if (AUDIO_EXTENSIONS.test(href) || /^audio\//i.test(type)) {
        add(href, link.getAttribute("download") || link.textContent || document.title, "Page link", type);
      }
    });

    if (found.size) chrome.runtime.sendMessage({ type: "audio-found", items: [...found.values()] });
  }

  function scheduleScan() {
    if (queued) return;
    queued = true;
    setTimeout(scan, 150);
  }

  scheduleScan();
  new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "href", "type"] });
  document.addEventListener("loadedmetadata", scheduleScan, true);
})();
