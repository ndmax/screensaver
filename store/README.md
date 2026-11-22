# Chrome Web Store images

Made by `npm run store-images` (`scripts/store-images.mjs`) from the built
extension in headless Chromium. Rerun it after UI changes. Listing text is in
[docs/store-listing.md](../docs/store-listing.md).

| File | Upload as |
| --- | --- |
| `screenshots/1-zoom.png` … `5-dark.png` (1280×800) | Screenshots, in this order |
| `promo-small-440x280.png` | Small promo tile (required) |
| `promo-marquee-1400x560.png` | Marquee promo tile (optional) |

The screensaver shots show real photos loaded from local folders. In
`4-photo-sources.png` the script replaces the temporary folder path it used
with `/home/me/Pictures`, the same example the Add folder field shows.

## Photo credits

The photos are downloaded from Wikimedia Commons into `store/photos/`
(ignored by git) the first time the script runs. All are public domain or
CC0, so no attribution is required; credited here anyway.

| Folder / file | Photo | Author | License |
| --- | --- | --- | --- |
| Northern Ireland/murlough-bay.jpg | [Murlough Bay](https://commons.wikimedia.org/wiki/File:Murlough_bay_(48770060832).jpg) | Salvatore Gerace | CC0 |
| Venezuela/san-juan-valley.jpg | [San Juan Valley, Isla Margarita](https://commons.wikimedia.org/wiki/File:San_Juan_Valley.jpg) | Wilfredor | CC0 |
| Greece/karystos-harbour.jpg | [Bourtzi castle harbour, Karystos](https://commons.wikimedia.org/wiki/File:Bourtzi_castle_harbour_Karystos_Euboea_Greece.jpg) | Jebulon | CC0 |
| Greece/messara-plain.jpg | [Mount Ida and the Messara plain, Crete](https://commons.wikimedia.org/wiki/File:Mount_Ida_chain_Messara_plain_from_Phaistos_Crete_Greece.jpg) | Jebulon | CC0 |
| Sweden/trommekilen-sunset.jpg | [Sunset over Trommekilen](https://commons.wikimedia.org/wiki/File:Sunset_over_Trommekilen_from_Norrkila_6.jpg) | W.carter | CC0 |
| Sweden/gullmarsskogen.jpg | [Beech and ferns in Gullmarsskogen](https://commons.wikimedia.org/wiki/File:Beech_and_ferns_in_Gullmarsskogen.jpg) | W.carter | CC0 |
| Utah/west-desert-dunes.jpg | [Utah Dunes, West Desert District](https://commons.wikimedia.org/wiki/File:Utah_Dunes_Landscape_-_West_Desert_District.jpg) | Bureau of Land Management – Utah / Bob Wick | Public domain |
