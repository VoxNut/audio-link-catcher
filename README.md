# Audio Link Catcher

A small Manifest V3 extension for Microsoft Edge and Google Chrome. It detects direct audio sources used by the current tab and starts browser-native downloads from its popup.

## What it detects

- `audio`, `video`, and nested `source` elements, including sources inserted after the page loads.
- Direct audio links on a page (known audio and playlist extensions).
- Network responses whose content type identifies them as audio, plus common audio/playlist URL extensions.
- Direct links even when their filename extension is unusual or missing, as long as the server labels the response with an audio MIME type.

Detected URLs are held only in the extension's memory for the current tab; they are cleared when navigating or closing that tab.

## Unicode filenames

The extension prefers the server's `Content-Disposition` filename, then the page-provided name, then the URL filename. It keeps Unicode (for example `日本語.mp3`, `中文歌曲.flac`, or `Beyoncé – Déjà Vu.m4a`) and only replaces characters that Windows cannot use in a filename.

## Install in Microsoft Edge

1. Download or clone this repository.
2. Open `edge://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this repository folder.
5. Pin **Audio Link Catcher**, open an audio page, start playback if needed, then choose a detected item and click **Download**.

For Chrome, follow the same process at `chrome://extensions`.

## Important limits

This tool downloads direct, browser-accessible HTTP(S) files. It cannot extract DRM-protected media, bypass a site login or paywall, or turn encrypted/segmented streaming playback into a single audio file. Browser `blob:`/MediaSource streams do not expose a stable downloadable source URL, so they are intentionally excluded.

Please use it only for audio you are permitted to download.

## Development

No build step or dependencies are required. After changing source files, click **Reload** on the extension card in Edge/Chrome.

## License

MIT. See [LICENSE](LICENSE).
