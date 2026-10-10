# Instagram Cleaner — Remove Likes

This branch contains a **Chrome Manifest V3 extension** for selecting previously liked Instagram posts and Reels through Instagram's own web interface.

- [Unfollow edition (main)](https://github.com/yousseffekryk98-droid/instgram-cleaner/tree/main)
- [All-in-One edition](https://github.com/yousseffekryk98-droid/instgram-cleaner/tree/all-in-one)

## Install the extension

1. In this branch, choose **Code → Download ZIP**, then extract it.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the extracted directory containing `manifest.json`.
5. Log in at https://www.instagram.com/ and reload Instagram before using the extension.

There is no npm install, build step, server, API key, or Instagram-password field.

## Remove likes from posts and videos

1. Click the extension and **Open Instagram** (or navigate to Instagram **Your activity → Interactions → Likes**).
2. On Instagram's Likes activity screen, click **Select** if available.
3. Open the extension popup and click **Scan loaded**. It scans rendered links to posts and Reels, not your entire likes history.
4. Choose entries individually or click **Select all**. Enter a selection limit of up to **25**.
5. Click **Select in Instagram** and confirm the extension prompt.
6. The extension attempts to tick Instagram's visible native selection checkboxes. **Review those selections in Instagram**.
7. After checking the selections on Instagram, click **Unlike selected in Instagram** in the extension and confirm its prompt. The extension clicks Instagram's own Unlike control if it is available. Complete any further Instagram confirmation yourself.
8. Scroll to load more items, scan again and repeat.

## What works and what can fail

- Scans posts and Reels that Instagram has rendered as identifiable links.
- Selects supported native checkbox/role=checkbox controls in the Instagram activity view.
- Supports individually checked items, Select all, Clear and Stop.
- Reports skipped items if Instagram has not exposed a selection checkbox.
- Instagram sometimes implements selection by clicking the card itself, without checkbox elements. In that layout, use Instagram's built-in Select and Unlike manually.
- The Instagram website frequently changes; if the page layout changes, scanning/selection may not work until the extension is updated.
- Actions are capped at 25 attempted selections per batch, not a promise that every item is selected.

## Privacy and safety

No credential collection, analytics or third-party servers. The extension only targets `https://www.instagram.com/*` and uses page controls. The user explicitly confirms the final unlike action in the popup; Instagram may also require its own confirmation. This is not affiliated with Instagram or Meta.

## Troubleshooting

- **No liked items scanned:** Confirm you're on Instagram's Likes page, logged in, and that content has loaded.
- **No checkboxes found:** Use the native Instagram Select mode and manually choose cards; not all layouts expose checkbox controls.
- **Popup can't access Instagram:** Refresh the Instagram page and reopen the extension.
- **Need to stop:** Use Stop in the extension; already-selected checkboxes can be cleared through Instagram.
