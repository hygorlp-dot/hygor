These are byte-identical copies of the official operational fonts in
`public/fonts/marcell/`. Their source and license are documented there.
Report preparation now reuses the public WOFF2 files through `report-fonts.js`,
with a persistent browser cache when available. This avoids a second base64
copy in application JavaScript. Completed report HTML still embeds both fonts:
pop-up printing and saved documents need no external font URL. These copies
remain as reference assets for byte-identity checks; they are not bundled.
