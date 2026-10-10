# Instagram Cleaner — Remove Likes (v1.1)

Chrome extension for selecting previously liked Instagram photos, videos and Reels using Instagram's visible **Your activity → Likes** interface.

- [Unfollow edition](https://github.com/yousseffekryk98-droid/instgram-cleaner/tree/main)
- [All-in-One edition](https://github.com/yousseffekryk98-droid/instgram-cleaner/tree/all-in-one)

## Install / update

1. Open this `remove-likes` branch on GitHub → **Code → Download ZIP**.
2. Extract the ZIP. In Chrome, open `chrome://extensions` and enable **Developer mode**.
3. If you installed an older version: **Remove** the old edition, or replace its files and press **Reload** on the extension card. Do not leave two identical editions running.
4. Click **Load unpacked** and select the folder containing `manifest.json`.
5. Reload your Instagram page, then reopen the extension. Reloading the Instagram tab after a code update is essential.

No password or third-party account is needed.

## How to remove your likes

1. Sign in to Instagram at https://www.instagram.com/your_activity/interactions/likes/.
2. Wait for the grid of liked posts and Reels to display.
3. Open the Chrome extension. Click **Scan loaded** (it also attempts a scan when first opened). Unlike v1.0, **it detects visible media thumbnails without requiring a post/Reel link**.
4. Under the list you'll see **X loaded**, **Y selected in extension**, and — where detectable — **Z selected on Instagram**. These counts are *different*: checking an item in the extension does not immediately select it on Instagram.
5. Check individual thumbnails in the extension or click **Select all**. Set a batch size (maximum 25). Click **Select in Instagram** and confirm. The extension attempts to select those loaded items in Instagram.
6. If Instagram's page doesn't provide identifiable selection controls, first **click one thumbnail manually in Instagram** so its **“1 selected”** bar appears, then click **Scan loaded** and try again. You can always complete selection manually using Instagram's own UI.
7. **Review Instagram's selected posts/reels**, not just the extension list. Click **Unlike selected in Instagram** in the extension, confirm, and complete any Instagram confirmation. Or use Instagram's native **Unlike** button directly.
8. Verify the items disappeared from Instagram Likes. Scroll the Instagram grid for more items and click **Scan loaded** again.

**The extension does not claim an unlike succeeded merely because the button was pressed.** It uses visible website controls, and Instagram may require another confirmation or block an action.

## Changes in v1.1

- **Fixed 0 loaded bug:** The old scanner only recognized anchors like `/p/<id>` or `/reel/<id>`. Instagram's activity grid can display thumbnails without those links. v1.1 detects visible, repeated image/video tiles.
- **Fixed Unlike control detection:** Recognizes labels such as `Unlike` and `Unlike (1)`; requires Instagram's native control and an explicit user confirmation in the popup.
- Shows Instagram's native selection count separately from popup selections.
- Verifies native selection increases where Instagram exposes a selected-count indicator.
- Stops rather than guessing if the selection mode or selected state cannot be verified.
- Includes `node --test tests/likes-engine.test.js` regression tests and GitHub Actions.

## Limitations and troubleshooting

- **Only loaded tiles:** Scroll to bring more posts into view and re-scan. It does not access your whole like history automatically.
- **No tiles found:** Wait until the Likes grid loads, scroll into view, and refresh Instagram after installing. Also make sure the URL is `/your_activity/interactions/likes/`.
- **Not selecting:** Instagram may implement native selection differently. Select a thumbnail manually first to turn on selection mode, then retry or use Instagram's controls.
- **Unlike not found:** The extension will report this without claiming success. Use Instagram's own unlike action on the selected-post toolbar. If it doesn't appear, select a post on Instagram first.
- **Changed Instagram design:** Meta can change CSS/DOM; not every layout or localization is guaranteed. Update may be needed.
- **Action restrictions:** Don't use the extension to bypass Instagram's rate limits, account challenges or CAPTCHA. Stop if Instagram restricts activity.

## Privacy

No passwords, outside API requests, or analytics. The extension runs only against Instagram's visible page. Not affiliated with Instagram or Meta.
