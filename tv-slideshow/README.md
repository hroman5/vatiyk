# 70s TV Slideshow

Builds a **Google Slides deck** from the photos in one Drive folder, styled like a 1970s console
TV: color bars ("Please stand by"), a sunburst title card, every photo on the TV screen, and
"To be continued". It is **separate from Party Cam** (guest uploads and the shared gallery).
Photos are only read with your own Google account; nothing is shared or published.

## Files

| File | Purpose |
| --- | --- |
| `Code.gs` | The builder script. Settings are at the top (`CONFIG`). |
| `assets/tv-background.jpg` | The TV scene used as the slide background. |
| `assets/tv-screen-fx.png` | Scanlines, glare and bezel corners laid over each photo. |

You also need three title cards named `card-bars.jpg`, `card-title.jpg` and `card-end.jpg`
(1920 x 1080), in the same Drive folder as the two assets. They carry the opening color bars, the
title text, and "To be continued"; make them with your own wording.

## Use it

1. Put the artwork files (the two in `assets/` plus the three cards) in one Drive folder.
2. At <https://script.google.com> create a new project and paste in `Code.gs`.
3. Fill in `CONFIG`: `PHOTO_FOLDER_ID` (your photos), `ASSET_FOLDER_ID` (the artwork folder),
   optionally `OUTPUT_FOLDER_ID` and `DECK_NAME`. A folder ID is the last part of its address in Drive.
4. Run **startBuild**, approve the permissions, and wait. Large folders take 10-20 minutes; the script
   saves its place and continues by itself with a timer. The finished deck loses its "(building...)" name.

## Show it

Google Slides > **Slideshow**, or **File > Share > Publish to web** with auto-advance for a hands-free
loop, or **File > Download > Microsoft PowerPoint (.pptx)**.

Photos run oldest to newest by the date the camera recorded (undated photos last, by file name).
Set `ORDER: 'shuffle'` for random order. Each photo keeps its whole frame, with black bars like a real TV.
