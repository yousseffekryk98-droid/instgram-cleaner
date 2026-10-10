# Instagram Cleaner — Not Following Back

A Chrome Manifest V3 extension for finding Instagram accounts **you follow that do not follow you back**, reviewing them, and optionally unfollowing your entire selected queue, one verified browser-visible profile at a time.

**Branch:** `not-following-back` — separate from the existing [`main` Unfollow extension](https://github.com/yousseffekryk98-droid/instgram-cleaner/tree/main). The main branch is unchanged.

## What it does

1. Compares **Instagram's own exported JSON data**: Following minus Followers.
2. Shows non-followers in a searchable list.
3. Allows **select all, individual selection, protect accounts**, and clearing selections.
4. After your explicit confirmation, saves up to 5,000 selected usernames in a queue and opens each profile in turn. The Chrome alarm scheduler wakes the extension for the next account approximately 5 seconds after the prior account finishes while the extension worker stays active, with a 30-second-or-longer Chrome alarm fallback if suspended.
5. Marks an action successful only if the profile visibly changes to **Follow** (or was already not followed), and reports skipped/uncertain actions separately.
6. Provides **Stop**; it does not send private Instagram API requests or attempt to get around action limits.

> **Why an export?** Instagram only renders a subset of a long Followers/Following list. Assuming that an unloaded person is not following you would produce **false positives**. This edition uses the exported lists instead. Exports reflect the **time they were generated**, not live follower status.

## 1. Install (desktop Chrome)

1. In GitHub, switch to the [**not-following-back** branch](https://github.com/yousseffekryk98-droid/instgram-cleaner/tree/not-following-back).
2. Click **Code → Download ZIP** and extract it.
3. On desktop Chrome, open `chrome://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
6. Sign in to **your own account** at https://www.instagram.com/ and refresh the page.

No build, npm, account-password input, or external API key required. **Chrome for Android does not support normal desktop Chrome extensions.**

## 2. Download the correct Instagram data

1. Open Instagram **Settings → Accounts Center → Your information and permissions → Download your information**.
2. Choose your Instagram account and select **Some of your information → Followers and following** (the location/label may vary).
3. Choose **All time** as the date range, and **JSON** (not HTML) for the format.
4. Request/download your data and unzip the downloaded archive.
5. Locate the files in a directory often named `connections/followers_and_following/`:
   - `followers_1.json` — **select every `followers_*.json` if your export contains multiple files**
   - `following.json` — select `following_*.json` too if provided

Use **the same, recently generated export and the same account** for both groups. An incomplete Followers dataset can incorrectly classify people as non-followers. Private accounts are supported only to the extent the export contains their usernames.

### Example data format

Some exports contain:
```json
[
  {
    "title": "",
    "string_list_data": [
      { "href": "https://www.instagram.com/example/", "value": "example", "timestamp": 12345 }
    ]
  }
]
```

The following file may instead contain an object with a `relationships_following` array. The extension supports both common layouts, converts usernames to lowercase, deduplicates names, and rejects unfamiliar or mostly invalid files.

## 3. Compare and review

1. Open the extension. Under **Followers JSON file(s)** select `followers_1.json` and any additional `followers_N.json` files.
2. Under **Following JSON file(s)** select `following.json` or additional `following_N.json` files.
3. Check the box confirming the export is complete, from the same account, and covers **All time**.
4. Click **Compare Followers vs Following**, then confirm saving the *comparison results* in the extension's local Chrome storage.
5. Review the totals for **Followers**, **Following**, and **Not following back**.
6. Search by username, select accounts individually or use **Select all**.
7. Use **Protect selected** to ensure selected names cannot be unfollowed by this extension. Click **Show protected** and then **Unprotect** to reverse this.

There are no unfollows during the compare step. You must explicitly select accounts and start a run.

## 4. Unfollow non-followers

1. Make sure Chrome's Instagram website is signed in to **the same account used to create the JSON export**.
2. Review the checked usernames. Set **Accounts to process** to **0 to process ALL selected** (default), or enter a smaller number (1–5,000).
3. Click **Unfollow selected** and approve the confirmation prompt.
4. The extension creates an Instagram tab and opens each requested profile. It checks the username in the URL before interacting.
5. When it uniquely recognizes **Following** and then **Unfollow**, it clicks those native visible controls. It allows a delay between accounts and does **not** access Instagram's private APIs.
6. The popup shows completed and skipped counts. Click **Stop** to prevent further profiles from being processed; an action already in progress may finish.
7. The queue **continues after ordinary skipped accounts** and remembers the next username even if Chrome suspends its background worker. You can close the popup, but leave Chrome running and do not manually navigate the cleanup tab. Stop explicitly if you wish to pause. Check the progress when reopening the extension.

If Instagram changes its buttons, shows a security challenge, or an unfollow cannot be verified, that account is **skipped rather than claimed as a success**. Never assume the number of accounts reported as processed equals the number actually unfollowed. A success labeled **already-not-following** means Instagram already showed a Follow button.

### Cautions

- Unfollowing is hard to reverse. Confirm exactly who you selected; protect friends you want to keep.
- Instagram may restrict repetitive activity. This extension does **not** bypass limitations, CAPTCHA or login challenges. If you see a restriction, stop and follow Instagram's instructions.
- The exported relationship snapshot may be old. Someone may have followed you after the export. Get a new export if up-to-date results matter.
- A queued Chrome **alarm** handles each new profile, avoiding a single long-running background loop. If Chrome interrupts an action mid-click, that username is marked uncertain/skipped rather than clicked twice; the remaining queue continues. Chrome must remain running and alarms can be delayed, so delivery timing is not exact. This is a best-effort UI assistant, not guaranteed unattended completion.
- Private profiles, localized Instagram UIs, changed layouts, popup timing, and login state can affect operation.
- You cannot use the extension to manipulate an account you are not logged into. **Only use it on your own account.**

## Privacy and storage

- Upload inputs are processed with browser JavaScript **locally**. No follower list or export is uploaded to a remote server.
- It saves only the **non-follower username comparison results**, counts, selected and protected usernames, and last-run status in `chrome.storage.local`. It does not keep raw follower/following JSON documents.
- No analytics, passwords, trackers, or private Instagram endpoints.
- **Clear imported data from this browser** removes comparison results, selections, protections, and progress.
- The extension requests `storage`, `tabs`, **`alarms`**, and `https://www.instagram.com/*` access because it opens Instagram tabs, remembers your selection, schedules the next profile and operates visible Instagram page controls.

## Developer / tests

No dependencies are required. With Node.js 18+ installed:

```bash
node --test tests/compare.test.js tests/queue.test.js
```

The tests cover username normalization, common JSON formats and malformed data, plus alarm-driven multi-account processing, skips, Stop and account restrictions. The profile interaction needs manual live testing on an Instagram account and may break if Instagram changes its markup.

## Other editions

| Branch | Function |
| --- | --- |
| [`main`](https://github.com/yousseffekryk98-droid/instgram-cleaner/tree/main) | Manual selection to unfollow |
| [`remove-likes`](https://github.com/yousseffekryk98-droid/instgram-cleaner/tree/remove-likes) | Manage likes |
| [`all-in-one`](https://github.com/yousseffekryk98-droid/instgram-cleaner/tree/all-in-one) | Following + likes |
| **`not-following-back`** | Export-based follower comparison + selective unfollow |

**Independent project; not endorsed by Instagram or Meta.**

## v1.2 queue fix

Earlier versions ran a long async loop in a Manifest V3 service worker. Chrome may suspend that worker after an account, leaving only the first unfollow completed. Version 1.2 uses a **durable saved queue** and Chrome alarms to wake one account at a time. The queue supports **0 = all selected** (maximum 5,000) and stops for account restrictions. It never attempts to bypass Instagram's limits. Reinstall or reload the extension in `chrome://extensions` **and sign in to the correct Instagram account** before starting a new queue.

## v1.3 — Faster unfollow queue (5-second active interval)

After an account finishes, the extension schedules the next profile **approximately 5 seconds later** using its background worker. Profile loading, Instagram UI confirmations, network delays, and browser scheduling are additional time, so **5 seconds is not a guaranteed per-account completion time**.

Chrome Manifest V3 service workers can sleep, and Chrome alarms cannot reliably wake a worker every 5 seconds. A **30-second or longer fallback** alarm remains in place so a sleeping worker can pick up the saved queue without silently losing progress. The fallback is cancelled when the fast timer works. User Stop cancels both, and Instagram action restrictions still stop the queue. This setting is not an attempt to avoid platform limits.

Update by replacing the extension files, opening `chrome://extensions`, clicking **Reload** on the extension, then refreshing Instagram. Start a new queue after updating; an existing run may have used older timers.
