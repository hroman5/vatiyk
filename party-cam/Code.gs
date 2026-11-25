/**
 * Party Cam - guest photo sharing backed by a Google Drive folder.
 *
 * Guests scan a QR code, open this web app in their phone browser, take or pick
 * photos, and watch a live gallery. Every photo is stored in ONE Drive folder
 * that you own.
 *
 * Setup: see README.md. In short: run setup() once, then Deploy > New deployment
 * > Web app (Execute as: Me, Who has access: Anyone).
 */

// ---------------------------------------------------------------------------
// Settings - edit these before you deploy.
// ---------------------------------------------------------------------------
const CONFIG = {
  // Shown at the top of the page and used to name the Drive folder.
  EVENT_TITLE: 'Our Party',

  // Short line shown on the camera screen.
  WELCOME_TEXT: 'Snap a photo and share it with everyone here!',

  // Optional. The ID of one of YOUR existing Drive folders. Open the folder in
  // Drive; the ID is the last part of the address:
  //   https://drive.google.com/drive/folders/<THIS_PART>
  // setup() creates a "Party Cam photos" subfolder inside it and keeps all guest
  // photos there. Only that subfolder is shared, never the rest of your folder.
  // Leave '' to create a new folder in the top level of My Drive instead.
  PARENT_FOLDER_ID: '',

  // Optional. If set, guests must open the link with ?k=THIS_CODE (put it in
  // the QR code) or uploads and the gallery are refused. Leave '' for no code.
  ACCESS_CODE: '',

  // How often (seconds) each open gallery checks for new photos. Lower = more
  // "live" but uses more of your daily Google quota. 8-15 is a good range.
  POLL_SECONDS: 10,

  // Photos are shrunk on the guest's phone before upload (keeps uploads fast on
  // party Wi-Fi). Longest side in pixels, and JPEG quality 0-1.
  MAX_DIMENSION: 2400,
  JPEG_QUALITY: 0.85,

  // Reject any single upload bigger than this (after shrinking).
  MAX_UPLOAD_BYTES: 8 * 1024 * 1024,

  // The gallery shows at most this many of the newest photos.
  MAX_PHOTOS_SHOWN: 500,

  // Projector slideshow: open your link with ?show=1 on the end, e.g.
  //   https://script.google.com/macros/s/.../exec?show=1
  // Seconds each photo stays on screen, and whether to show a small
  // "scan to share" QR code in the corner.
  SLIDE_SECONDS: 6,
  SLIDESHOW_QR: true,

  // Optional banner shown across the bottom of the slideshow, e.g.
  // 'Happy Birthday Daisy!'. Leave '' for no banner.
  SLIDESHOW_CAPTION: '',

  // Order of the slideshow loop: 'newest' (newest photo first, then older ones,
  // then start over) or 'shuffle'. New uploads always jump in right away.
  SLIDESHOW_ORDER: 'newest',

  // "70s TV" photo show: a retro console-TV slideshow of photos from ONE of your
  // Drive folders (for example photos of the guest of honor through the years).
  // Open your link with ?show=tv on the end:  https://script.google.com/macros/s/.../exec?show=tv
  // TV_FOLDER_ID: the folder's ID (the last part of its address in Drive).
  // The photos stay private: they are read with your account and sent only to the TV page.
  TV_FOLDER_ID: '',
  TV_TITLE: '',                          // big title card; '' uses EVENT_TITLE
  TV_SUBTITLE: 'A Special Presentation', // smaller line under the title
  TV_SECONDS: 7,                         // seconds each photo stays on screen
  TV_ORDER: 'chronological',             // 'chronological' (by the date the photo was taken) or 'shuffle'
  TV_SHOW_YEARS: false                   // true shows the year the photo was taken, when known
};

// How long the list of photos is cached on the server. All guests share one
// cached copy, so 100 phones polling cost about one Drive request per interval.
const INDEX_CACHE_SECONDS = 6;

const ALLOWED_MIME_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif'
};

// ---------------------------------------------------------------------------
// One-time setup. Run this from the editor (select "setup" > Run).
// ---------------------------------------------------------------------------

/**
 * Creates the Drive folder that will hold the photos and remembers its ID.
 * Safe to run again: it reuses the existing folder. The folder is shared as
 * "anyone with the link can view" so the live gallery can show thumbnails.
 */
function setup() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty('FOLDER_ID');
  if (existingId) {
    try {
      const existing = DriveApp.getFolderById(existingId);
      Logger.log('Photo folder already set up: ' + existing.getUrl());
      return;
    } catch (err) {
      Logger.log('Saved folder not found, creating a new one.');
    }
  }

  const folderName = CONFIG.EVENT_TITLE + ' - Party Cam photos';
  let folder;
  if (CONFIG.PARENT_FOLDER_ID) {
    let parent;
    try {
      parent = DriveApp.getFolderById(CONFIG.PARENT_FOLDER_ID);
    } catch (err) {
      throw new Error('PARENT_FOLDER_ID was not found or is not accessible to this account. ' +
          'Copy the ID from the folder\'s address in Drive.');
    }
    folder = parent.createFolder(folderName);
  } else {
    folder = DriveApp.createFolder(folderName);
  }
  props.setProperty('FOLDER_ID', folder.getId());
  try {
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    Logger.log('Could not share the folder (' + err + '). If your Google account ' +
        'blocks link sharing, the gallery thumbnails will not load for guests.');
  }
  Logger.log('Created photo folder: ' + folder.getUrl());
}

// ---------------------------------------------------------------------------
// Web app entry point
// ---------------------------------------------------------------------------

function doGet(e) {
  const params = (e && e.parameter) || {};
  const boot = {
    title: CONFIG.EVENT_TITLE,
    welcome: CONFIG.WELCOME_TEXT,
    code: params.k || '',
    pollMs: Math.max(3, Number(CONFIG.POLL_SECONDS) || 10) * 1000,
    maxDim: CONFIG.MAX_DIMENSION,
    quality: CONFIG.JPEG_QUALITY,
    maxBytes: CONFIG.MAX_UPLOAD_BYTES,
    show: params.show === '1' || params.show === 'true',
    slideMs: Math.max(2, Number(CONFIG.SLIDE_SECONDS) || 6) * 1000,
    shareUrl: CONFIG.SLIDESHOW_QR ? getShareUrl_() : '',
    caption: String(CONFIG.SLIDESHOW_CAPTION || ''),
    order: CONFIG.SLIDESHOW_ORDER === 'shuffle' ? 'shuffle' : 'newest',
    tv: params.show === 'tv',
    tvTitle: String(CONFIG.TV_TITLE || CONFIG.EVENT_TITLE || ''),
    tvSub: String(CONFIG.TV_SUBTITLE || ''),
    tvMs: Math.max(3, Number(CONFIG.TV_SECONDS) || 7) * 1000,
    tvOrder: CONFIG.TV_ORDER === 'shuffle' ? 'shuffle' : 'chronological',
    tvYears: !!CONFIG.TV_SHOW_YEARS
  };

  const template = HtmlService.createTemplateFromFile('Index');
  // Escape "<" so event titles / codes can never close the <script> tag.
  template.boot = JSON.stringify(boot).replace(/</g, '\\u003c');

  return template.evaluate()
      .setTitle(CONFIG.EVENT_TITLE)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

// ---------------------------------------------------------------------------
// Functions the page calls through google.script.run
// ---------------------------------------------------------------------------

/**
 * Saves one photo into the Drive folder.
 * @param {string} code  The event code from the guest's link (may be '').
 * @param {string} base64  The image bytes, base64 encoded (no "data:" prefix).
 * @param {string} mimeType  e.g. "image/jpeg".
 * @return {{id: string, t: number}} The new file's ID and creation time (ms).
 */
function uploadPhoto(code, base64, mimeType) {
  checkCode_(code);

  const ext = ALLOWED_MIME_TYPES[String(mimeType || '').toLowerCase()];
  if (!ext) {
    throw new Error('That file type is not supported. Please send a photo.');
  }
  if (!base64 || typeof base64 !== 'string') {
    throw new Error('No photo data received.');
  }

  const bytes = Utilities.base64Decode(base64);
  if (bytes.length > CONFIG.MAX_UPLOAD_BYTES) {
    throw new Error('That photo is too large.');
  }

  const now = new Date();
  const name = Utilities.formatDate(now, 'UTC', 'yyyyMMdd-HHmmss') + '-' +
      Utilities.getUuid().slice(0, 6) + '.' + ext;
  const blob = Utilities.newBlob(bytes, mimeType, name);

  const file = getFolder_().createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    // Folder-level sharing from setup() normally covers this already.
  }

  return {id: file.getId(), t: file.getDateCreated().getTime()};
}

/**
 * Lists photos, newest first.
 * @param {string} code  The event code from the guest's link (may be '').
 * @param {number} sinceMs  Only photos created after this time (ms). Pass 0
 *     for the full list (used for the first load and periodic resyncs).
 * @return {{photos: Array<{id: string, t: number}>, total: number}}
 */
function listPhotos(code, sinceMs) {
  checkCode_(code);

  const index = getIndex_();
  const since = Number(sinceMs) || 0;
  const photos = since > 0
      ? index.filter(function (p) { return p.t > since; })
      : index.slice(0, CONFIG.MAX_PHOTOS_SHOWN);
  return {photos: photos, total: index.length};
}

/**
 * 70s TV show: the list of photos in TV_FOLDER_ID, in show order.
 * @return {Array<{id: string, y: number}>} y is the year taken, or 0 if unknown.
 */
function tvList(code) {
  checkCode_(code);
  return getTvIndex_().map(function (p) { return {id: p.id, y: p.y}; });
}

/**
 * 70s TV show: one photo as a "data:" URL, sized for a projector (about 1600 px).
 * Read with this account's access, so the folder itself never has to be shared.
 */
function tvPhoto(code, id) {
  checkCode_(code);
  const item = getTvIndex_().filter(function (p) { return p.id === id; })[0];
  if (!item) {
    throw new Error('Photo not found in the TV folder.');
  }

  const headers = {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()};
  const urls = [];
  if (item.thumb) {
    urls.push(item.thumb.replace(/=s\d+.*$/, '=s1600'));
  }
  urls.push('https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w1600');

  for (let i = 0; i < urls.length; i++) {
    try {
      const res = UrlFetchApp.fetch(urls[i], {headers: headers, muteHttpExceptions: true});
      const type = String(res.getHeaders()['Content-Type'] || res.getHeaders()['content-type'] || '');
      if (res.getResponseCode() === 200 && type.indexOf('image/') === 0) {
        return 'data:' + type.split(';')[0] + ';base64,' + Utilities.base64Encode(res.getContent());
      }
    } catch (err) {
      // Try the next source.
    }
  }

  // Last resort: the original file, if it is a browser-friendly image of moderate size.
  const file = DriveApp.getFileById(id);
  const type = file.getMimeType();
  if ((type === 'image/jpeg' || type === 'image/png') && file.getSize() < 6 * 1024 * 1024) {
    return 'data:' + type + ';base64,' + Utilities.base64Encode(file.getBlob().getBytes());
  }
  throw new Error('Could not load that photo.');
}

/** Photos in TV_FOLDER_ID with their taken-time, oldest first. Cached for 5 minutes. */
function getTvIndex_() {
  if (!CONFIG.TV_FOLDER_ID) {
    throw new Error('The TV show is not set up. Put the photo folder\'s ID in TV_FOLDER_ID in Code.gs.');
  }
  const cache = CacheService.getScriptCache();
  const cached = cache.get('tvindex');
  if (cached) {
    return JSON.parse(cached);
  }

  const query = "'" + CONFIG.TV_FOLDER_ID + "' in parents and trashed = false and mimeType contains 'image/'";
  let files = [];
  let pageToken = '';
  do {
    const url = 'https://www.googleapis.com/drive/v3/files' +
        '?q=' + encodeURIComponent(query) +
        '&fields=' + encodeURIComponent('nextPageToken,files(id,name,thumbnailLink,imageMediaMetadata(time))') +
        '&pageSize=1000' +
        (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const res = UrlFetchApp.fetch(url, {
      headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) {
      throw new Error('Could not read the TV photo folder (HTTP ' + res.getResponseCode() + ').');
    }
    const data = JSON.parse(res.getContentText());
    files = files.concat(data.files || []);
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  const items = files.map(function (f) {
    // EXIF time looks like "2013:07:04 22:07:27".
    const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(
        (f.imageMediaMetadata && f.imageMediaMetadata.time) || '');
    const t = m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : 0;
    return {id: f.id, name: f.name || '', thumb: f.thumbnailLink || '', t: t,
            y: t ? new Date(t).getUTCFullYear() : 0};
  });
  // Dated photos first (oldest to newest), then undated ones by file name.
  items.sort(function (a, b) {
    if (a.t && b.t) { return a.t - b.t; }
    if (a.t) { return -1; }
    if (b.t) { return 1; }
    return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
  });

  try {
    cache.put('tvindex', JSON.stringify(items), 300);
  } catch (err) {
    // Too many photos for the cache; read Drive each time instead.
  }
  return items;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkCode_(code) {
  if (CONFIG.ACCESS_CODE && String(code || '') !== String(CONFIG.ACCESS_CODE)) {
    throw new Error('This link is missing its event code. Please scan the QR code again.');
  }
}

/** The guest link (with the event code, if any) shown as a QR in the slideshow. */
function getShareUrl_() {
  let url = '';
  try {
    url = ScriptApp.getService().getUrl() || '';
  } catch (err) {
    return '';
  }
  if (url && CONFIG.ACCESS_CODE) {
    url += (url.indexOf('?') === -1 ? '?' : '&') + 'k=' + encodeURIComponent(CONFIG.ACCESS_CODE);
  }
  return url;
}

function getFolderId_() {
  const id = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  if (!id) {
    throw new Error('Party Cam is not set up yet. Run setup() once in the Apps Script editor.');
  }
  return id;
}

function getFolder_() {
  return DriveApp.getFolderById(getFolderId_());
}

/**
 * Returns [{id, t}] for every image in the folder, newest first. Cached for a
 * few seconds and shared by all guests so Drive is not hit on every poll.
 */
function getIndex_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('index');
  if (cached) {
    return JSON.parse(cached);
  }

  const index = fetchIndex_();
  try {
    cache.put('index', JSON.stringify(index), INDEX_CACHE_SECONDS);
  } catch (err) {
    // The cache holds ~100 KB per entry (roughly 1,500 photos). Past that we
    // simply skip caching and read Drive each time.
  }
  return index;
}

function fetchIndex_() {
  const folderId = getFolderId_();
  const query = "'" + folderId + "' in parents and trashed = false and mimeType contains 'image/'";
  const photos = [];
  let pageToken = '';

  do {
    const url = 'https://www.googleapis.com/drive/v3/files' +
        '?q=' + encodeURIComponent(query) +
        '&fields=' + encodeURIComponent('nextPageToken,files(id,createdTime)') +
        '&orderBy=' + encodeURIComponent('createdTime desc') +
        '&pageSize=1000' +
        (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');

    const response = UrlFetchApp.fetch(url, {
      headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
      muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) {
      throw new Error('Could not read the photo folder (HTTP ' + response.getResponseCode() + ').');
    }

    const data = JSON.parse(response.getContentText());
    (data.files || []).forEach(function (f) {
      photos.push({id: f.id, t: Date.parse(f.createdTime)});
    });
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return photos;
}
