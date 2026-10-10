# Instagram Cleaner — Remove Likes (v1.3)

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


## v1.3 automatic UI reliability update

- Opens Instagram's native **Select** mode automatically where the page exposes a unique button or plain-text selection control; attempts to click the first visible tile and verify Instagram reports it selected.
- Recognizes more native **Unlike** labels and clickable card wrappers; handles a unique Unlike confirmation in Instagram where available.
- Repeats small Likes batches: select thumbnails → use Instagram's Unlike → verify the page changed → wait → scroll/load more → repeat up to the selected maximum.
- Adds a **Step** field to progress (Scanning / Selecting / Unliking / Loading / Waiting / Stopped) so it is clear where the loop stopped.
- Adds **Copy cleanup diagnostics** (counts and controls only—no usernames, media URLs, or credentials). If Instagram's live UI differs, use this after a failed run and share the output so the selector can be adjusted.
- Includes tests for **three successive automatic Unlike batches**, rather than testing just a single batch. Run `node --test tests/likes-engine.test.js tests/likes-auto.test.js`.

### Install the actual update

Download this branch ZIP, extract it, replace/remove the previous installed extension, and click **Reload** in `chrome://extensions`. Then **refresh the Instagram Likes tab**; an open tab will otherwise still run the older content scripts. You must start an automatic run once and confirm it. After that, popup clicks should not be necessary for each batch on a supported Instagram layout.

Instagram can block bulk activity, require verification, or change the selection/Unlike UI. This update does **not** remove Instagram's limits or guarantee thousands of completed actions. If it stops, read the Step and reason before restarting; do not retry while restricted.

## Automatic cleanup (v1.2)

**New:** In the Likes tab, open **Automatic Likes cleanup**.

1. Download the latest extension files from this branch, replace the old extension folder (or remove/reinstall), then press **Reload** in `chrome://extensions`.
2. **Refresh Instagram's Likes page** at https://www.instagram.com/your_activity/interactions/likes/ after updating.
3. Open the extension. The automatic section has:
   - **Batch size**: 1–20 (default 10).
   - **Maximum likes**: 1–10,000 (default 5,000).
   - **Wait between batches**: 10–120 seconds (default 15 seconds).
4. Check the acknowledgement that the extension will unlike the selected items automatically. Press **Start automatic cleanup** and confirm once.
5. Leave the Instagram Likes tab open. You may close the extension popup; progress is saved locally and appears when you reopen it.
6. The extension attempts to enter Instagram's selection mode, selects liked thumbnails (or starts with your existing manual selection), clicks Instagram's **own native Unlike control**, confirms an Instagram Unlike dialog if one appears, waits for the selection/grid to change, waits between batches, and loads more items by scrolling.
7. Click **Stop** if necessary. You can click **Resume automatic cleanup** after an interruption, but do not resume while Instagram has a restriction or security challenge.

### Important limitations

- **No way to remove Instagram server limits.** If Instagram blocks an action, requires account verification/CAPTCHA, or refuses more unlikes, the extension stops rather than bypassing platform protections. Waiting between actions is not a guarantee against restrictions.
- **No guarantee it will complete 5,000 likes unattended.** Chrome must stay running, the Instagram Likes tab must stay open, and the Instagram interface must continue loading. Reloading/closing the tab interrupts the run. Resuming requires you to click Resume.
- **Best-effort visible UI only.** It does not call hidden APIs, import/export account credentials, simulate private web requests or falsely claim a click equals server-side unlike. "Observed" counts are inferred from Instagram clearing its selection and changing the grid; manually verify your Likes history afterward.
- If Instagram does not allow automatic entry into selection mode, **manually select one post** so the native **1 selected** indicator appears and start again. If no unique Instagram Unlike control appears, use Instagram's own button yourself.
- The extension may stop before finishing if Instagram stops loading more items, changes the interface, or cannot verify a selection/unlike action. If it stops, review the page before resuming.
- Avoid opening two simultaneous cleanup runs in separate Instagram tabs.
- The extension requires an explicit start and initial confirmation. There is no hidden/background account access, and this project is not affiliated with Meta.

Run tests with `node --test tests/likes-engine.test.js tests/likes-auto.test.js`; GitHub Actions also runs these tests.
