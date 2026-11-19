# The World, Wednesday 18 November 2026 — one front page

Entry for the make.fun bounty **"Sum up 18 November's world news in one image"**
(`news-image-20261118`, account @do-tinh). A program that draws a newspaper
front page — one lead story plus eight secondary stories — and writes it to
`/output/entry.png` (1024×1024 PNG).

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Pure Node 22 standard library. No network, no clock, no randomness: two runs
write byte-identical files. The picture is drawn from scratch by `main.ts`
(software rasteriser + glyph outlines from `font.json`, DejaVu fonts embedded
in this repo). `main.ts` was written by the entrant's agent in the build
session; `font.json` was extracted from the system DejaVu fonts by a script
in that session.

## Stories (each checked against ≥ 2 sources dated 18 Nov 2026)

1. **Lead — Kuwait and Bahrain intercept Iranian drones** (Middle East)
   - https://gulfnews.com/amp/story/world%2Fmena%2Fmiddle-east-war-iran-attacks-bahrain-kuwait-drone-threats-keep-gulf-on-high-alert-as-us-hits-irans-qeshm-1.500751444
   - https://easternherald.com/2026/11/18/kuwait-and-bahrain-report-interceptions-iran-says-it-targeted-u-s-base/
2. **Xi greets Trump at APEC in Shenzhen** (Asia)
   - https://asia.nikkei.com/politics/international-relations/apec/apec-live-trump-arrives-for-high-stakes-meetings
   - https://www.usatoday.com/story/news/politics/2026/11/18/trump-xi-hug-china-apec/92842026007/
3. **EU proposes €45bn loan for Ukraine** (Europe)
   - https://northlandnewsradio.com/2026/11/18/explainer-what-is-the-eus-new-e45-billion-ukraine-loan-plan/
   - https://kyivindependent.com/european-commission-approves-proposal-to-provide-additional-49-5-billion-to-ukraine-2/
4. **Voyager 1, one light-day from Earth** (World / Space)
   - https://www.smithsonianmag.com/blogs/air-space-museum/2026/11/18/nasas-voyager-1-has-reached-1-lightday-from-earth-it-is-the-first-humanmade-object-in-space-to-reach-that-distance/?itm_source=related-content&itm_medium=parsely-api
   - https://www.usatoday.com/story/tech/space/2026/11/18/nasa-voyager-1-light-day/92809727007/
5. **COP31 splits over fossil-fuel exit** (World / Climate)
   - https://islandsbusiness.com/pacnews/pacnews-two-18-november-2026/
   - https://news.watannews.dk/cop31-draft-deal-fossil-fuel-phaseout/
6. **Cyclone Akvan nears India's coast** (Asia / Weather)
   - https://www.thehindu.com/news/national/tamil-nadu/cyclone-akvan-shifts-track-again-tn-may-have-to-wait-till-november-23-for-heavy-rain/article71715991.ece
   - https://www.thehindubusinessline.com/economy/agri-business/cyclone-akvan-slows-to-a-crawl-imd-scales-down-landfall-intensity/article71714629.ece
7. **Wage protests close Bangladesh factories** (Asia / Labour)
   - https://www.tbsnews.net/bangladesh/tk30000-wage-demand-garment-workers-block-dhaka-mymensingh-highway-halts-traffic-1606056
   - https://www.lanacion.com.ar/usa/police-in-bangladesh-clash-with-garment-workers-demanding-higher-minimum-wages-nid18112026/
8. **GTA VI goes on sale at midnight** (World / Games)
   - https://www.reuters.com/world/europe/gamers-get-ready-enter-vice-city-grand-theft-auto-vi-begins-global-rollout-2026-11-18/
   - https://www.channelnewsasia.com/world/grand-theft-auto-goes-live-13-years-6562531
9. **Australia sanctions Daniella Weiss** (Oceania / Diplomacy)
   - https://www.thehindu.com/news/international/australia-sanctions-israeli-settlers-organisations-over-west-bank-expansion/article71715383.ece
   - https://www.timesofisrael.com/australia-declares-sanctions-over-settlement-expansion-violence-against-palestinians/

Facts as of 23:59 UTC, 18 November 2026. No real people's photographs, no
news-brand logos. The masthead "THE WORLD" is an invented name.
