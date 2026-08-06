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
| **Research** | Competitor lines with prices, size availability and evidence; trend signals with four indices; a season dossier |
| **Sketches** | Specs per tier, footwear rule checks (last match, welt, shaft entry, stack limits), then black-ink technical sketches |
| **Designs** | Family-specific view sets (sneakers get a medial view, heels a rear view), colourways as SKUs, product variations |
| **Campaign shots** | Top picks scored, then worn on a virtual model and staged in studio and on location |
| **3D showroom** | A four-view turnaround (front / left / back / right) goes to Tripo; you get a GLB you can turn and download |

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

Left to right: Input → Research → Signals → Directions → Designs → Selection → Variations →
Campaign shots → 3D showroom. Collected competitor product photos sit in the research lane; the
line profile fingerprint sits on the input card. The connections are data, not decoration —
line weight into a design card is the signal's weight in `rationale.driving_signals`.

Pan and zoom anywhere. Turn on **Edit** to rewrite any card in place, drop note cards, add lanes,
or hide what you do not want to present — saved per run. Exports to Miro, or to PDF.

## 3D that follows the convention

Tripo's multiview endpoint expects a `[front, left, back, right]` turnaround. The base lateral
render *is* the left view; the other three are edits of it — same shoe, camera rotated, orthographic,
white background. All four slots go up in order, so the reconstruction gets real coverage instead
of guessing the back of the shoe from a single photo. The GLB is viewable on the card and board,
and downloadable from both the card chip and the viewer.

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
server-side; if the direct link is dead it loads the product page and falls back to its `og:image`.
The UI walks the remaining candidates before giving up, so a card with a live product page almost
always has a photo.

---

## Layout

```
src/core/      pipeline, line profile, research clients, board model, PDF builders
src/ui/        wizard, run view, review board, library
server/        Node-only API: images, research, dossier, logo compositing, Tripo
src/samples/   the saved runs behind the hosted demo
docs/          static build for GitHub Pages
```

Design tokens come from `VRINGON UI 시스템 ver3` and live in `src/tokens.css` — 68 colour pairs plus
the spacing and radius scales. Nothing in the stylesheet uses an off-scale value.

## Honest limits

- Sales proxy scores are not calculated. One collection pass gives no time series, so the app says
  "not scored" rather than guessing; adoption stage stays `unknown` until repeat passes exist.
- Series DNA extraction and moodboard PDF parsing are sample data — uploaded files are not read yet.
- Costs are rough and exclude duty, freight, vendor margin and defect rate. Every card says so.
- People in the campaign photography are generated. They are not real, and the app says so on the card.
- Merchant Center / Amazon / eBay / StockX data layers are named in the research prompts as source
  hierarchies, not wired as APIs.
