# Instagram Cleaner — All-in-One (v1.2)

A **Chrome Manifest V3** extension combining the **Unfollow manager** and **Remove Likes assistant**. Likes grid scanning was improved in **v1.1** to detect thumbnail tiles even without `/p/` or `/reel/` links.

- [Unfollow-only (main)](https://github.com/yousseffekryk98-droid/instgram-cleaner/tree/main)
- [Remove Likes only](https://github.com/yousseffekryk98-droid/instgram-cleaner/tree/remove-likes)

## Install

1. Choose **Code → Download ZIP** on this `all-in-one` branch and extract it.
2. Go to `chrome://extensions` in Chrome, enable **Developer mode** and click **Load unpacked**.
3. Choose the folder containing `manifest.json`.
4. Sign in to https://www.instagram.com/ and refresh the website.

All functionality runs locally in your browser; there is no build process or Instagram login inside the extension.

## Tool 1 — Unfollow

1. On your Instagram profile, open the **Following** list.
2. Open the extension, select the **Following** tab and click **Scan loaded**.
3. Select the desired accounts. Optionally **Protect selected** to save protected usernames locally.
4. Set the limit (1–25), click **Unfollow selected**, and confirm the popup.
5. Keep the page open. The extension uses visible Following and Instagram's Unfollow confirmation buttons, with pauses between actions.
6. Use **Stop** to halt further actions. For more accounts, scroll the Instagram Following dialog and scan again.

## Tool 2 — Remove Likes

1. Open **Your activity → Interactions → Likes** on Instagram.
2. In the extension, switch to **Liked content** and click **Scan loaded**. This now discovers visible photo/Reel thumbnails even when Instagram doesn't render post links.
3. If Instagram has no visible **Select** control, click one thumbnail on Instagram to activate the **1 selected** bar, then click **Scan loaded** again.
4. Check the desired posts/Reels in the popup, or choose **Select all**.
5. Set the limit (1–25), press **Select in Instagram**, and confirm. The extension displays separate counts for items selected in the popup and items selected on Instagram.
6. Review the actual selections on Instagram. Click **Unlike selected in Instagram** in the extension, confirm the popup, and finish any further Instagram confirmation. Alternatively press Instagram's own **Unlike** button manually. The extension does not claim success without verification.
7. Scroll and rescan for more items.

## Important limitations

- The tool sees only Instagram items currently rendered in the page, not your full historical data.
- DOM markup, labels and native checkbox controls vary and can change without notice.
- Likes selection now also tries thumbnail-card clicks when Instagram's native selected-count UI is detected. If it cannot verify the selection, it stops rather than guessing; select manually on Instagram.
- Instagram may limit activity. The extension does not bypass account restrictions, login challenges or security checks.
- Unfollow is hard to undo. Always carefully review the selected people.
- While the extension is running, do not navigate the active Instagram tab away from the relevant list.

## Privacy

No password capture, external analytics, remote servers or direct Instagram private API use. Protected usernames are saved to Chrome's local extension storage. This independent project is not associated with Instagram or Meta.

## Branches

| Branch | Edition |
|---|---|
| `main` | Unfollow only |
| `remove-likes` | Liked content selection assistant |
| `all-in-one` | Both features |

## Likes scanner regression tests

Run `node --test tests/likes-engine.test.js` (Node.js 18+) to test the thumbnail scanner and native-selection state. These are mocked DOM tests; real Instagram can change without notice.

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
