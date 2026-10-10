# Instagram Cleaner — All-in-One

A **Chrome Manifest V3** extension combining the **Unfollow manager** and **Remove Likes assistant**.

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
2. In the extension, switch to **Liked content** and click **Scan loaded**.
3. Press Instagram's own **Select** control to reveal selectable cards if available.
4. Check the desired posts/Reels in the popup, or choose **Select all**.
5. Set the limit (1–25), press **Select in Instagram**, and confirm.
6. Review the actual selections on Instagram and press Instagram's native **Unlike** button to finish. Unlike is **not** automatically clicked.
7. Scroll and rescan for more items.

## Important limitations

- The tool sees only Instagram items currently rendered in the page, not your full historical data.
- DOM markup, labels and native checkbox controls vary and can change without notice.
- Likes selection works only where native checkboxes are detectable; otherwise complete selection manually on Instagram.
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
