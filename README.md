# Instagram Cleaner — Unfollow (main branch)

A **Chrome Manifest V3** extension for reviewing and selectively unfollowing accounts on **your own Instagram account**.

> This repository's **main** branch is the **Unfollow** edition. Other editions:
> - [Remove Likes edition](../../tree/remove-likes)
> - [All-in-One edition](../../tree/all-in-one)

## Install

1. Click **Code → Download ZIP** on this branch, then extract the ZIP.
2. Open Chrome and visit `chrome://extensions`.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and choose the extracted folder containing `manifest.json`.
5. Sign in to your own account at https://www.instagram.com/ and reload the page.

No npm, build, API key, account password, or third-party service is required.

## How to use Unfollow

1. Go to your Instagram profile and click **Following** to open the following-list dialog.
2. Keep the dialog open. Click the extension icon → **Scan loaded items**.
3. Check the accounts to remove or choose **Select all**. Accounts protected by **Protect selected** cannot be included; protection is saved locally.
4. Enter a maximum batch size (**1–25**). Click **Unfollow selected** and confirm the extension's confirmation prompt.
5. Keep the Instagram tab open while the batch runs. Instagram may ask for native confirmation; the extension looks for an **Unfollow** button.
6. Click **Stop** to halt remaining actions. Scroll the following dialog to load more accounts and scan again as needed.

**Important:** Scan only discovers items Instagram currently rendered, not every account you follow. Do not assume a successful count without checking Instagram. The page can change and prevent detection.

## Features

- Scan currently loaded following-list entries; add more by scrolling and rescanning.
- Select, deselect, protect accounts; protected usernames are stored in local Chrome extension storage.
- Small, confirmed batches with a 4.5-second pause and a 25-action upper bound.
- Stop controls and progress/status display.
- Only uses browser-visible Instagram controls; no private API calls or credential collection.

## Known limitations & safety

- Instagram changes its markup frequently. This is a best-effort DOM-assisted tool; some layouts and languages may not work.
- **Only the Instagram web app** is supported. You must be logged in, and the Following dialog must remain open.
- A list item not currently mounted in Instagram's DOM is skipped, not secretly loaded.
- Instagram may impose action limits; the extension does not evade CAPTCHAs, challenges or restrictions.
- Actions such as unfollowing are difficult to reverse. Always inspect your selection.
- This project is not affiliated with Instagram or Meta.

## Branches

| Branch | Use |
| --- | --- |
| `main` | Unfollow accounts |
| `remove-likes` | Select previously liked posts/Reels for Instagram's built-in Unlike flow |
| `all-in-one` | Both tools in one extension |

## Troubleshooting

- **No accounts found:** Open the actual **Following** dialog on your profile, not your home feed, then rescan.
- **Extension cannot contact page:** Reload the Instagram tab after installing or updating the extension.
- **Missing people:** Scroll *inside* Following and scan again.
- **Actions skipped:** Instagram may have changed the page or unloaded the row; scroll back and rescan.
- **Restriction or challenge:** Stop using the extension and follow Instagram's on-screen guidance.

## Privacy

No analytics, tracking pixels, server endpoints, or credential capture. Only the Instagram website is targeted; protected usernames remain in `chrome.storage.local`.

Licensed for personal educational use; review Instagram's terms before operating automation.
