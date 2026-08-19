# VRINGON Shoe Agent

An agent for footwear design. It fixes a **Footwear Line Profile** first — last, upper, bottom
unit, construction, price, use — then researches the season, sketches, renders, photographs and
reconstructs the picks in 3D, with every claim traceable back to a source.

**Live demo →** https://jhkim1543.github.io/vringon-design-agent/

The hosted page is read-only. Research and image generation run on a local Node server that is not
part of a static build, so nothing is called from there. Everything a full run produced is saved:
open **History** in the left rail to walk through a finished run, its board, the season dossier and
the PDF exports.

> Jewellery is a separate product: **[vringon-jewelry-agent](https://github.com/jhkim1543/vringon-jewelry-agent)**.
> The two share a lineage but this repository is footwear-only — lasts, fit programmes, bottom
> units, constructions and size-run economics have no jewellery equivalent.

---

## The line comes before the research

The same penny loafer at four price points is four different markets: synthetic + cemented at
KRW 100k, suede moccasin at 200k, full-grain Blake at 400k, Goodyear welt above 600k. A daily
trainer, a max-cushion shoe and a carbon racer never sit in one competitive set either. So before
anything is searched, the run fixes a **Footwear Line Profile**:

```
archetype × use case × last & fit × upper programme × bottom unit
        × construction × performance targets × market & price × season
```

Twelve quick presets (Road running daily, Performance racing, Trail technical, Premium leather
loafer, Chelsea boot, …) fill the profile in one tap; everything stays editable. Values you do not
know stay `unknown` — last dimensions are never decided from product photos. The profile drives the
competitor set, the search terms, the signal schema, the image prompts, the reports and the cache
keys.

## What a run does

| Stage | What comes out |
|---|---|
| **Research** | Competitor lines with prices, size availability and evidence; department-store and luxury-retail bestsellers with photos; trend signals with four indices; a season dossier |
| **Sketches** | Specs per tier, footwear rule checks (last match, welt, shaft entry, stack limits), then black-ink lateral sketches and ink variations off the same form |
| **Designs** | Colour enters here: each sketch becomes a photograph, then family-specific view sets (sneakers get a medial view, heels a rear view), colourways as SKUs, product variations |
| **Campaign shots** | Top picks scored, then worn on a virtual model and staged in studio and on location |
| **3D showroom** | A four-view turnaround becomes a 3D model you can turn on the board and download for CAD |

Sketching and designing are separate on purpose. The form is settled in black ink, where a change is
cheap and the eye is not distracted by colour; only then does each sketch get photographed. Because
the render is an edit of the drawing rather than a fresh generation, the silhouette, panel lines and
outsole carry through instead of drifting.

Each stage is optional. The scope selector says what you get and what it costs before you start.
Rule-rejected specs never reach image generation, identical prompts are served from disk cache, and
a per-run image cap sends anything past it to a diagram. A failed image is isolated to that one cut.

## Tiers mean tooling, not bravado

| Tier | Definition |
|---|---|
| **Core** | Existing last and existing bottom unit. Colour, material and minor upper changes only. |
| **Push** | Keeps either the last or the bottom unit, changes the structure of the other. |
| **Signature** | New last, new outsole mould, new heel or a core technology package. |

The rule engine enforces it: a new outsole mould on a Core piece is a hard reject (S-01), a new
last outside Signature too (S-02, S-03). An outsole mould is priced per size — `mold_count =
size_run` — and the amortisation lands on every card. A 40mm+ stack with a carbon plate gets a
World Athletics eligibility warning (S-14).

## Research rules that footwear forces

- **Lines, not brands.** "Nike Performance Running" and "Nike Lifestyle" are different competitive
  sets. Products that do not match the profile are classified as aspirational / adjacent references,
  never silently dropped.
- **Two price bands.** A primary band for direct comparison inside the same construction tier, and
  an optional adjacent band kept as reference.
- **Size-level stock.** A product can be "in stock" with its core sizes gone. Offered vs available
  sizes are recorded per product; a broken size run is availability, not demand.
- **Rank semantics.** A page position is never stored as a sales rank. Every rank note carries its
  meaning: verified sales rank, retailer bestseller membership, surface position or resale rank.
- **Colourways are SKUs.** One model family is one product entry with a colourway count. Ten
  colourways are never ten designs.
- **Four indices, not one score.** Every signal carries Commercial / Cultural / Forecast /
  Feasibility separately, plus the tooling change it would need (last, bottom mould, upper pattern).
  A culturally strong signal that needs a new mould shows exactly that tension.
- **Co-occurring attributes.** "Chunky" is not a signal. "High stack + wide platform + moderate
  rocker + segmented rubber" is.
- **What the floor is selling, regardless of who you named.** Alongside the brands you enter, every
  run sweeps department-store and luxury-retail bestseller pages — Lotte, SSG, The Hyundai, MUSINSA,
  MR PORTER, Harrods, Selfridges — and brings back whatever carried a bestseller flag at collection
  time, with its photo, price and the exact rank wording. Those enter as commercial leaders.

## Three agent modes

|  | Competitor research | Trend research | Your uploads |
|---|:---:|:---:|:---:|
| **Trend** | yes | yes | — |
| **Series** | — | yes | yes |
| **Moodboard** | — | — | yes |

Series mode locks footwear DNA (last silhouette, toe shape, sole sidewall, icon overlays) and
varies the rest. Moodboard mode translates uploads into footwear grammar — massing to sole
sidewalls, split lines to panels, repeats to tread — and never claims market growth from a PDF.

## The season dossier

Trend research follows the structure used by the MICAM / Livetrend buyer's guides:

- Four data sources, read separately, all year on year: **e-commerce, Instagram, runway, search volume**
- Six risk grades: **Edgy → Early sign → Safe → Big → Stable → Last call**
- Season narrative → four macrotrends → sub-trend chips, growth drivers, palette (Pantone TCX + HEX),
  materials, details, and key items split by women / men / kids
- Focused by the line profile: macro trends only survive if they translate to the selected archetype

A number that could not be verified is shown as a direction — *Surging / Rising / Steady / Softening* —
rather than an invented percentage. The trend report PDF opens with a research fingerprint (mode,
archetype, last, upper, bottom, construction, market, price, season, capture date) and carries
photo pages: observed competitor products and the run's own renders, views and campaign cuts.

## The review board

Left to right: Input → Research → Signals → Directions → Sketches → Designs → Selection →
Variations → Campaign shots → 3D showroom. Collected competitor product photos sit in the research lane; the
line profile fingerprint sits on the input card. The connections are data, not decoration —
line weight into a design card is the signal's weight in `rationale.driving_signals`.

Pan and zoom anywhere. Select a card and drag a corner to resize it; photos and the 3D viewer grow
with the card, and the size is remembered per run. Turn on **Edit** to rewrite any card in place,
drop note cards, add lanes, or hide what you do not want to present. Card text is kept to what a
photo cannot say.

**Export to Miro** asks for your own token the first time — Miro settings, Your apps, create an app
with `boards:read` and `boards:write`, install it to your team, paste the token. It stays in your
browser and never reaches the server, so each person's board lands in their own team. Locally cached
photos are uploaded as files rather than linked, since Miro fetches URLs from its own servers.

## 3D that follows the convention

Reconstruction expects a `[front, left, back, right]` turnaround. The base lateral render *is* the
left view; the other three are edits of it — same shoe, camera rotated, orthographic, white
background. All four slots go up in order, so the model gets real coverage instead of guessing the
back of the shoe from a single photo. The result is viewable on the card and board, and downloadable
for CAD from both the card chip and the viewer.

The UI never names the service behind it. A designer needs to know a 3D model comes out, not which
vendor makes it.

---

## Running it for real

Node 20+ and an OpenAI API key.

```bash
git clone https://github.com/jhkim1543/vringon-design-agent
cd vringon-design-agent
npm install
cp .env.example .env      # then put your keys in
npm run dev               # http://localhost:5188
```

Keys live only in `.env`, which the Node side reads. They never reach the browser bundle
(no `VITE_` prefix anywhere). `.env` and `.cache` are gitignored.

### Keys

| Variable | Needed for |
|---|---|
| `OPENAI_API_KEY` | Research, sketches, renders, variations, worn and concept shots |
| `TRIPO_API_KEY` | 3D showroom (multiview → GLB) |
| `OPENAI_DEEP_RESEARCH_KEY` | Deep research, once your organisation is verified for it |
| `GEMINI_API_KEY` | Optional fallback if an OpenAI image call fails |
| `MIRO_ACCESS_TOKEN` | Optional. Without it, Miro export downloads a build plan instead |

### Models

| Use | Model | Measured |
|---|---|---|
| Design generation, detailed | `gpt-image-2` quality high | 136s |
| Design generation, fast | `gpt-image-1.5` quality high | 29s |
| Research | `gpt-5` + `web_search`, high reasoning effort | working |
| 3D reconstruction | Tripo `multiview_to_model` v2.5, PBR | ~3-5 min |
| Deep research | `o3-deep-research` | 404 until the org is verified |

The UI never names a vendor. It offers **Fast** and **Detailed**, because the two take prompts
differently — one wants short noun phrases, the other wants material and finish described at length.

### Competitor photos

Research returns direct image links, which rot. The `/api/shot` proxy fetches and caches each one
server-side; if the direct link is dead it loads the product page and reads its `og:image`, falling
back through `twitter:image`, `image_src`, preload hints, `itemprop` and JSON-LD. Requests queue per
host with a gap and retry on 429, since consecutive hits draw rate limits. A 403 is a wall and is not
retried.

`node tools/shot-audit.mjs` measures the hit rate across every product ever collected, host by host.
On the last run: 91% (53 direct, 26 via the page, 8 blocked). Every failure was a product whose
research pass returned no image URL, or an expired one, sitting behind a storefront WAF — the image
CDNs themselves are open. So the research prompt requires at least one image URL per product rather
than a scraping subscription.

Samples ship their photos as files. `node tools/freeze-sample-shots.mjs` pulls every remote reference
local, because the static build has no proxy and remote links would show nothing.

---

## Layout — where to look for each stage

Read this before touching anything. Each stage of a run has one file that owns it; comments at the
top of that file explain the *why*, and inline comments mark every place a past bug was closed.

```
STAGE                     OWNS IT                          ALSO TOUCHES
─────────────────────────────────────────────────────────────────────────────────────────────
S0 input                  src/ui/Wizard.tsx                src/core/types.ts (RunParams, FootwearLineProfile,
                                                            LINE_PRESETS, HOME_MARKETS)
                          src/ui/BrandSetup.tsx            src/core/brand.ts (BrandIdentity, MdPersona)
S1 research               server/research-api.mjs          server/markets.mjs (home/reference market, retail
                          server/dossier-api.mjs             rosters, search language)
                                                            server/category-templates.mjs (per-family and
                                                            per-type lenses)
                                                            src/core/research.ts (client, lineForServer,
                                                            toSignals)
S1b signals → hints       src/core/signalSpec.ts           hintApplied / hintBlocked honesty machinery
S2 territories, genomes   server/design-api.mjs            src/core/genome.ts (client, diversityGate,
                                                            genomeToHint, brandSummaryOf)
S2 spec, rules, cost      src/core/packs.ts                SHOE_PROFILE, LAST_LIBRARY, rules S-01..S-11
S2 sketch + outsole sheet src/core/aiClient.ts             sketchPrompt, outsoleSketchPrompt, partsClause
S3 render + N concepts    src/core/pipeline.ts (S3 block)  server/design-api.mjs authorConcepts,
                                                            aiClient conceptRenderPrompt
S3 vision check + repair  src/core/pipeline.ts             server/design-api.mjs verifyRender
S4 selection, MD, gate    src/core/pipeline.ts (S4 block)  server/upload-api.mjs reviewAsMd
S5 campaign, 3D           src/core/pipeline.ts (S5 block)  server/tripo-api.mjs (single image → GLB)
board                     src/core/boardModel.ts           src/ui/Board.tsx (RemixPanel, comments, sync)
                                                            server/board-sync.mjs (SSE room per run)
outputs                   src/core/reportPdf.ts,           src/core/pitch.ts (per-design objections)
                          src/core/dossierPdf.ts
persistence               src/core/store.ts                src/core/boardEdits.ts, src/core/sampleRun.ts
serving                   server/standalone.mjs            server/openai-api.mjs (every /api route)
inference routing         server/inference.mjs             h100/ (in-house GPU serve contract)
sample generation         tools/run-sample.ts              tools/freeze-sample-shots.mjs
```

The pipeline is one file on purpose: `src/core/pipeline.ts`. It reads top to bottom as S1 → S5,
and every gate (`approvalGate` after sketches, `dna-gate` in Series mode, `finalGate` before
campaign/3D spend) is a `Promise` the UI resolves through `PipelineHandle`. Search for `══ S` to
jump between stages.

Prompt layering is deliberate: `sketchPrompt` speaks only in what a line can draw (form,
proportion, panel split, a reserved unmarked area for the logo); `conceptRenderPrompt` and
`renderFromSketchPrompt` add material, colour, finish, hardware — part by part via `partsClause`.
If you add a field to the genome, decide which layer it belongs to before it reaches a prompt.

Caches: research legs cache by prompt hash under `.cache/research`; when you change a research
prompt, bump its prefix (`trend11ft`, `comp9ft`, `pulse4ft`, `brand8ft`, `dossier7ft`, `genome5`, `concepts1`)
or old answers keep being served. Image generation caches by prompt hash under `.cache/images` and
re-runs are never re-billed.

Design tokens come from `VRINGON UI 시스템 ver3` and live in `src/tokens.css` — 68 colour pairs plus
the spacing and radius scales. Nothing in the stylesheet uses an off-scale value.

## Tools — what each one is for

Everything in `tools/` runs standalone with `node` (the `.ts` ones bundle through esbuild first;
each file's header comment has the exact command). None of them are part of the app build.

**Making samples** — these spend real money.

| | |
|---|---|
| `run-sample.ts` | Trend mode, headless. Gates auto-pass, freezes to `src/samples/` |
| `run-sample-series.ts` | Series mode. Needs `fetch-archive.mjs` to have pulled an archive first |
| `run-sample-moodboard.ts` | Moodboard mode. Reads a PDF already in the upload cache |
| `fetch-archive.mjs` | Pulls product photos off public pages into the upload cache, for the series archive |
| `freeze-sample-shots.mjs` | Downloads a sample's remote photos to `public/samples/` and strips tracking params |

**Checking things** — all free, all read-only unless stated.

| | |
|---|---|
| `usage-report.mjs` | Ledger → cost table, per run and per feature. Rates live in its `RATES` block |
| `i18n-audit.mjs` | Finds text bypassing `t()`, display attributes bypassing it, and keys with no dictionary entry |
| `settings-probe.mjs` | Cheap check that brand and MD settings actually change the output — text calls only, no images |
| `shot-audit.mjs` | Which sites gave us product photos and which refused |
| `_audit.ts` | Builds the board model from each sample and reports anomalies |
| `engine-compare.ts` | Same design through both image engines, side by side. Evidence for API-COST-DETAIL §8 |
| `engine-compare-render.ts` | Whether a fast sketch survives into a detail render. Evidence for §9 |

**Maintenance** — these write.

| | |
|---|---|
| `gc-samples.mjs` | Deletes files in `public/samples/` that no sample references. `--check` to look first |
| `migrate-sample.mjs` | Brings a sample frozen before a pipeline fix in line with what the pipeline emits now. `--check` first |

`npm run typecheck` covers `src` and `tools` together — `tsconfig.json` alone only sees `src`, and
esbuild strips types without checking them, so a runner error would otherwise surface only after
launching a two-hour run.

## Honest limits

- Sales proxy scores are not calculated. One collection pass gives no time series, so the app says
  "not scored" rather than guessing; adoption stage stays `unknown` until repeat passes exist.
- Series DNA extraction and moodboard PDF parsing are sample data — uploaded files are not read yet.
- Costs are rough and exclude duty, freight, vendor margin and defect rate. Every card says so.
- People in the campaign photography are generated. They are not real, and the app says so on the card.
- Merchant Center / Amazon / eBay / StockX data layers are named in the research prompts as source
  hierarchies, not wired as APIs.
