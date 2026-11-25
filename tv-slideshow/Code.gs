/**
 * 70s TV Slideshow builder.
 *
 * Builds a Google Slides deck from the photos in ONE Drive folder, styled like a 1970s
 * console TV: color bars ("Please stand by"), a sunburst title card, every photo on the
 * TV screen, and a "To be continued" card. In Google Slides you can present it, or use
 * File > Download > Microsoft PowerPoint (.pptx).
 *
 * This is separate from Party Cam. It makes a normal Slides file in your Drive and
 * nothing is published or shared. The photos are only read with your account.
 *
 * How to use: see README.md. In short, run startBuild() once. For a big folder the script
 * saves its place and keeps going by itself (a timer) until the deck is finished.
 */

// ---------------------------------------------------------------------------
// Settings - edit these before you run startBuild().
// ---------------------------------------------------------------------------
const CONFIG = {
  // The folder with the photos (the last part of its address in Drive).
  PHOTO_FOLDER_ID: '',

  // The folder holding the artwork: tv-background.jpg, tv-screen-fx.png,
  // card-bars.jpg, card-title.jpg, card-end.jpg
  ASSET_FOLDER_ID: '',

  // Where the finished deck is saved. '' keeps it in the top level of My Drive.
  OUTPUT_FOLDER_ID: '',

  // Name of the finished deck.
  DECK_NAME: '70s TV Slideshow',

  // 'chronological' = oldest to newest by the date the camera recorded (photos without a
  // date come last, by file name). 'shuffle' = random order.
  ORDER: 'chronological'
};

// Where the TV screen sits in the 1920 x 1080 artwork, in pixels. Matches the artwork files.
const ART = {
  w: 1920,
  h: 1080,
  hole: {x: 346.84375, y: 255.21875, w: 824.234375, h: 618.171875},
  fx: {x: 330, y: 239, w: 858, h: 651}
};

// Apps Script stops a run after 6 minutes. Work stops a little earlier and a timer
// continues in a minute.
const TIME_BUDGET_MS = 4.5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/** Run this once to build a new deck. */
function startBuild() {
  clearTriggers_();
  const props = PropertiesService.getScriptProperties();
  props.deleteAllProperties();
  props.setProperty('SEED', String(Math.floor(Math.random() * 2147483647)));
  continueBuild();
}

/** Continues a build. Called by startBuild() and then by a timer until the deck is done. */
function continueBuild() {
  const started = Date.now();
  const props = PropertiesService.getScriptProperties();
  clearTriggers_();

  const deckId = props.getProperty('DECK_ID');
  const deck = deckId ? SlidesApp.openById(deckId) : createDeck_(props);
  const photos = listPhotos_(Number(props.getProperty('SEED')) || 1);
  if (!photos.length) {
    throw new Error('No photos were found in the photo folder.');
  }

  const layout = findBlankLayout_(deck);
  const fx = asset_('tv-screen-fx.png');
  let next = Number(props.getProperty('NEXT') || 0);
  while (next < photos.length && Date.now() - started < TIME_BUDGET_MS) {
    try {
      addPhotoSlide_(deck, layout, fx, photos[next]);
    } catch (err) {
      Logger.log('Skipped ' + photos[next].name + ': ' + err.message);
    }
    next++;
    props.setProperty('NEXT', String(next));
  }

  if (next < photos.length) {
    ScriptApp.newTrigger('continueBuild').timeBased().after(60 * 1000).create();
    Logger.log('Built ' + next + ' of ' + photos.length + ' photos. Continuing automatically in about a minute.');
    return;
  }
  finishDeck_(deck, props);
}

// ---------------------------------------------------------------------------
// Building the deck
// ---------------------------------------------------------------------------

function createDeck_(props) {
  const deck = SlidesApp.create(CONFIG.DECK_NAME + ' (building...)');
  props.setProperty('DECK_ID', deck.getId());

  // The TV scene is the background of the blank layout, so every new slide inherits it.
  const layout = findBlankLayout_(deck);
  layout.getBackground().setPictureFill(asset_('tv-background.jpg'));

  // Slide 1: color bars (reusing the deck's first slide). Slide 2: the title card.
  const first = deck.getSlides()[0];
  first.getPageElements().forEach(function (e) { e.remove(); });
  fullImage_(deck, first, 'card-bars.jpg');
  fullImage_(deck, deck.appendSlide(layout), 'card-title.jpg');
  return deck;
}

function addPhotoSlide_(deck, layout, fxBlob, photo) {
  const blob = fetchPhotoBlob_(photo);              // fetch first: nothing is added if it fails
  const s = deck.getPageWidth() / ART.w;            // artwork pixels -> slide points
  const hole = ART.hole;
  const slide = deck.appendSlide(layout);
  try {
    // Black screen, then the photo fitted inside it, then scanlines/glare/bezel corners on top.
    const back = slide.insertShape(SlidesApp.ShapeType.RECTANGLE,
        hole.x * s, hole.y * s, hole.w * s, hole.h * s);
    back.getFill().setSolidFill('#000000');
    back.getBorder().setTransparent();

    const img = slide.insertImage(blob);
    const w0 = img.getWidth();
    const h0 = img.getHeight();
    const k = Math.min(hole.w * s / w0, hole.h * s / h0);
    const w = w0 * k;
    const h = h0 * k;
    img.setWidth(w).setHeight(h)
        .setLeft(hole.x * s + (hole.w * s - w) / 2)
        .setTop(hole.y * s + (hole.h * s - h) / 2);

    slide.insertImage(fxBlob, ART.fx.x * s, ART.fx.y * s, ART.fx.w * s, ART.fx.h * s);
  } catch (err) {
    slide.remove();
    throw err;
  }
}

function finishDeck_(deck, props) {
  fullImage_(deck, deck.appendSlide(findBlankLayout_(deck)), 'card-end.jpg');
  deck.setName(CONFIG.DECK_NAME);
  if (CONFIG.OUTPUT_FOLDER_ID) {
    DriveApp.getFileById(deck.getId()).moveTo(DriveApp.getFolderById(CONFIG.OUTPUT_FOLDER_ID));
  }
  clearTriggers_();
  props.deleteAllProperties();
  Logger.log('DONE. Your deck: ' + deck.getUrl());
}

function fullImage_(deck, slide, assetName) {
  slide.insertImage(asset_(assetName), 0, 0, deck.getPageWidth(), deck.getPageHeight());
}

function findBlankLayout_(deck) {
  const layouts = deck.getLayouts();
  for (let i = 0; i < layouts.length; i++) {
    if (layouts[i].getLayoutName() === 'BLANK') {
      return layouts[i];
    }
  }
  return layouts[layouts.length - 1];
}

// ---------------------------------------------------------------------------
// Drive helpers
// ---------------------------------------------------------------------------

function asset_(name) {
  if (!CONFIG.ASSET_FOLDER_ID) {
    throw new Error('Set ASSET_FOLDER_ID in CONFIG to the folder that holds the TV artwork.');
  }
  const files = DriveApp.getFolderById(CONFIG.ASSET_FOLDER_ID).getFilesByName(name);
  if (!files.hasNext()) {
    throw new Error('The artwork file "' + name + '" was not found in the asset folder.');
  }
  return files.next().getBlob();
}

/** Photos in the photo folder, in show order: [{id, name, thumb, t}]. */
function listPhotos_(seed) {
  if (!CONFIG.PHOTO_FOLDER_ID) {
    throw new Error('Set PHOTO_FOLDER_ID in CONFIG to the folder with your photos.');
  }
  const query = "'" + CONFIG.PHOTO_FOLDER_ID + "' in parents and trashed = false and mimeType contains 'image/'";
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
      throw new Error('Could not read the photo folder (HTTP ' + res.getResponseCode() + ').');
    }
    const data = JSON.parse(res.getContentText());
    files = files.concat(data.files || []);
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  const photos = files.map(function (f) {
    // EXIF time looks like "2013:07:04 22:07:27".
    const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(
        (f.imageMediaMetadata && f.imageMediaMetadata.time) || '');
    return {
      id: f.id,
      name: f.name || '',
      thumb: f.thumbnailLink || '',
      t: m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : 0
    };
  });
  photos.sort(function (a, b) {
    if (a.t && b.t) { return a.t - b.t; }
    if (a.t) { return -1; }
    if (b.t) { return 1; }
    return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
  });
  return CONFIG.ORDER === 'shuffle' ? seededShuffle_(photos, seed) : photos;
}

/** A browser-friendly copy of the photo, about 1600 px wide (works for iPhone HEIC too). */
function fetchPhotoBlob_(photo) {
  const headers = {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()};
  const urls = [];
  if (photo.thumb) {
    urls.push(photo.thumb.replace(/=s\d+.*$/, '=s1600'));
  }
  urls.push('https://drive.google.com/thumbnail?id=' + encodeURIComponent(photo.id) + '&sz=w1600');

  for (let i = 0; i < urls.length; i++) {
    try {
      const res = UrlFetchApp.fetch(urls[i], {headers: headers, muteHttpExceptions: true});
      const type = String(res.getHeaders()['Content-Type'] || res.getHeaders()['content-type'] || '')
          .split(';')[0];
      if (res.getResponseCode() === 200 && /^image\/(jpeg|png|gif)$/.test(type)) {
        return res.getBlob();
      }
    } catch (err) {
      // Try the next source.
    }
  }

  // Last resort: the original file, if Slides can use it directly.
  const file = DriveApp.getFileById(photo.id);
  const type = file.getMimeType();
  if (/^image\/(jpeg|png|gif)$/.test(type) && file.getSize() < 20 * 1024 * 1024) {
    return file.getBlob();
  }
  throw new Error('could not get a usable copy of this photo');
}

function seededShuffle_(list, seed) {
  let a = seed >>> 0;
  const rand = function () {                       // small deterministic random generator
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
  }
  return out;
}

function clearTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'continueBuild') {
      ScriptApp.deleteTrigger(t);
    }
  });
}
