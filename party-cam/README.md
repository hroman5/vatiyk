# Party Cam

Guests scan a QR code, and their phone opens a page where they can take or pick
photos. Every photo is saved into a folder in **your Google Drive**, and a **live
gallery** on the same page shows everyone's photos as they arrive. No app to
install, no accounts for guests, no hosting to pay for.

It runs as a Google Apps Script web app under your Google account.

## What's in this folder

| File | Purpose |
| --- | --- |
| `Code.gs` | Server code: saves photos to Drive and lists them for the gallery. **Settings are at the top.** |
| `Index.html` | The guest page: camera, upload progress, live gallery, full-screen viewer. |
| `appsscript.json` | Project settings (permissions, "anyone can open"). Optional when pasting by hand. |
| `qr.html` | Open in any browser to make a printable QR poster. Works offline. |

## Setup (about 10 minutes)

### 1. Create the project
1. Go to <https://script.google.com> signed in as the Google account that owns the Drive folder, and click **New project**.
2. Name it (for example "Party Cam").
3. Replace everything in the default `Code.gs` file with the contents of `Code.gs` from this folder.
4. Click **+** next to *Files* > **HTML**, name it exactly `Index`, and paste in the contents of `Index.html`.
5. Optional: *Project Settings* > tick **Show "appsscript.json" manifest file in editor**, then paste in `appsscript.json`.

### 2. Choose where photos go
At the top of `Code.gs`, edit `CONFIG`:

- `EVENT_TITLE` and `WELCOME_TEXT`: what guests see.
- `PARENT_FOLDER_ID`: **to use one of your own folders**, open it in Drive and copy the
  last part of the address (`https://drive.google.com/drive/folders/`**`THIS_PART`**).
  Leave it empty to create a new folder in the top level of My Drive.

  Party Cam creates a **"... - Party Cam photos" subfolder inside your folder** and
  puts every guest photo there. Only that subfolder is shared by link, never the
  rest of your folder.
- `ACCESS_CODE` (optional): a word that must be in the link. See "Keeping it private".

### 3. Run setup once
1. In the editor's function dropdown choose **setup**, then click **Run**.
2. Google asks you to authorize the script. Click *Review permissions*, choose your
   account, and if you see "Google hasn't verified this app" click **Advanced** >
   **Go to Party Cam (unsafe)**. This is your own script; the warning appears for
   every personal Apps Script project. Click **Allow**.
3. Open *Execution log*. It prints the link to your photo folder. Open it to check it's where you expect.

### 4. Deploy
1. **Deploy** > **New deployment** > gear icon > **Web app**.
2. *Execute as*: **Me**. *Who has access*: **Anyone**.
3. **Deploy**, then copy the **Web app URL** (it ends in `/exec`).

### 5. Test it like a guest
Open the URL on a phone (ideally in a private/incognito tab so you're not signed in
to Google, like a guest). Take a photo. It should appear in the Gallery tab and in
your Drive folder within a few seconds.

### 6. Make the QR poster
Open `qr.html` in your browser, paste the Web app URL (and the event code if you
set one), then **Print poster** or **Save QR as image**.

## During and after the party

- **Remove a photo:** delete it from the Drive folder. It disappears from guests'
  galleries within about two minutes.
- **Download everything:** in Drive, right-click the photo folder > **Download**
  (Google zips it for you).
- **Turn it off:** in the editor, **Deploy** > **Manage deployments** > **Archive**
  the deployment. The link stops working and the photos stay in your Drive. Also
  turn off the folder's link sharing (right-click the photo folder > Share >
  General access > Restricted).
- **Changed the code?** Editing doesn't update the live link. Use **Deploy** >
  **Manage deployments** > pencil > Version: **New version** > Deploy. The URL stays the same.

## Keeping it private

- Anyone with the link can upload and view, so only show the QR code to your guests.
- For more protection, set `ACCESS_CODE` in `Code.gs` (for example `'rosie2026'`),
  redeploy, and paste the same code into `qr.html`. The QR code then carries
  `?k=rosie2026`, and the page and server refuse requests without it. It stops
  strangers who guess or find the base link, but anyone who scans the QR code has the code.
- The photo subfolder is shared as "anyone with the link can view" so the gallery
  thumbnails load. Its address is long and unguessable, but treat it like any link
  shared that way.

## Limits to know about

- **Photos only.** Videos are not supported.
- **Photos are resized** on the guest's phone to 2400 px on the long side (JPEG) so
  uploads are fast on party Wi-Fi. Change `MAX_DIMENSION` / `JPEG_QUALITY` in
  `Code.gs` if you want bigger.
- **Crowd size:** the live gallery shares one cached copy of the photo list, so it is
  built for a typical party (roughly up to 100-150 guests at once). Very large events
  can hit Google's Apps Script limits (concurrent requests and daily quotas); if that
  happens, raise `POLL_SECONDS`.
- **Storage:** photos use your Google Drive space (15 GB free on a personal account).
- **Google Workspace accounts** (work or school) can block "anyone with the link"
  sharing. If thumbnails don't load for guests, the admin setting is the cause.
  A personal Gmail account works without changes.
- **HEIC:** iPhones normally convert to JPEG in the browser. If a phone sends HEIC
  untouched, the file is saved but some devices can't preview it.
- The gallery shows the newest 500 photos (`MAX_PHOTOS_SHOWN`); all photos are
  still in Drive.
