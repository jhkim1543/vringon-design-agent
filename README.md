# VRINGON Design Agent

An agent that takes a product brief, researches the season, and carries it through to concept
photography — with every claim traceable back to a source.

**Live demo →** https://jhkim1543.github.io/vringon-design-agent/

The hosted page is read-only. Research and image generation run on a local Node server that is not
part of a static build, so nothing is called from there. Everything a full run produced is saved:
open **History** in the left rail to walk through a finished run, its board, the season dossier and
the PDF exports.

---

## What a run does

| Stage | What comes out |
|---|---|
| **Research** | Competitor products with prices and evidence, trend signals with sources, and a season dossier |
| **Sketches** | Specs per tier, manufacturing rule checks, then black-ink technical sketches |
| **Designs** | Sketches turned into photoreal renders, extra views, and product variations |
| **Worn shots** | Top picks scored, then photographed on a model |
| **Concept shoot** | Worn on a virtual model, staged in studio and on location, plus short clips |

Each stage is optional. The scope selector says what you get and what it costs before you start,
and recalculates as you change the brief.

Rule-rejected specs never reach image generation, identical prompts are served from disk cache, and
a per-run image cap sends anything past it to a diagram. A failed image is isolated to that one cut.

## Three agent modes

|  | Competitor research | Trend research | Your uploads |
|---|:---:|:---:|:---:|
| **Trend** | yes | yes | — |
| **Series** | — | yes | yes |
| **Moodboard** | — | — | yes |

Each mode has its own entry condition. Running without material would produce results nobody can
explain, so the Run button stays locked until the mode has what it needs.

## The season dossier

Trend research follows the structure used by the MICAM / Livetrend buyer's guides:

- Four data sources, read separately, all year on year: **e-commerce, Instagram, runway, search volume**
- Six risk grades: **Edgy → Early sign → Safe → Big → Stable → Last call**
- Season narrative → four macrotrends → sub-trend chips, growth drivers, palette (Pantone TCX + HEX),
  materials, details, and key items split by women / men / kids
- How the last few seasons moved, plus every source listed with a working link

A number that could not be verified is shown as a direction — *Surging / Rising / Steady / Softening* —
rather than an invented percentage. Exports to A4 PDF with the source list intact.

What the dossier finds is carried forward: its materials, details, palette and key-item specs go into
the sketch and render prompts, so the designs answer the research rather than sitting beside it.

## The review board

Left to right: Input → Research → Signals → Directions → Designs → Selection → Variations → Concept shoot.

The connections are data, not decoration. Line weight into a design card is the signal's weight in
`rationale.driving_signals`; a low-confidence signal arrives dashed.

Pan and zoom anywhere on the canvas. Turn on **Edit** to rewrite any card in place, drop note cards,
add lanes, or hide what you do not want to present — saved per run. Exports to Miro, or to PDF.

## Brand identity

Set the logo, signature elements, palette, materials and the things you never do once, and every
image prompt carries the same clause. The logo is not drawn by the model — generators cannot
reproduce a mark accurately — it is composited onto the finished render from the original file.

---

## Running it for real

Node 20+ and an OpenAI API key.

```bash
git clone https://github.com/jhkim1543/vringon-design-agent
cd vringon-design-agent
npm install
cp .env.example .env      # then put your key in
npm run dev               # http://localhost:5188
```

Keys live only in `.env`, which the Node side reads. They never reach the browser bundle
(no `VITE_` prefix anywhere). `.env` and `.cache` are gitignored.

### Keys

| Variable | Needed for |
|---|---|
| `OPENAI_API_KEY` | Research, sketches, renders, variations, worn and concept shots |
| `OPENAI_DEEP_RESEARCH_KEY` | Deep research, once your organisation is verified for it |
| `GEMINI_API_KEY` | Optional fallback if an OpenAI image call fails |
| `MIRO_ACCESS_TOKEN` | Optional. Without it, Miro export downloads a build plan instead |
| `COMFY_URL` | Optional. Concept clips from a local open-source video model |

### Models

| Use | Model | Measured |
|---|---|---|
| Design generation, detailed | `gpt-image-2` quality high | 136s |
| Design generation, fast | `gpt-image-1.5` quality high | 29s |
| Research | `gpt-5` + `web_search`, high reasoning effort | working |
| Deep research | `o3-deep-research` | 404 until the org is verified |

The UI never names a vendor. It offers **Fast** and **Detailed**, because the two take prompts
differently — one wants short noun phrases, the other wants material and finish described at length.

### Deep research

`o3-deep-research` returns 404 until the OpenAI organisation is verified
(Settings → Organization → General). Check with:

```bash
curl -s http://localhost:5188/api/research/deep-check
```

Until it opens, the agent runs a four-step search-and-synthesise pass instead. Once verified, set
`OPENAI_DEEP_RESEARCH=1` and it switches over, falling back automatically if a call fails.

### Concept video

No paid video API. Point `COMFY_URL` at a local [ComfyUI](https://github.com/comfyanonymous/ComfyUI)
running an image-to-video workflow — [LTX-Video](https://github.com/Lightricks/LTX-Video),
[Wan 2.2](https://github.com/Wan-Video/Wan2.2), [CogVideoX](https://github.com/THUDM/CogVideo) and
[Stable Video Diffusion](https://github.com/Stability-AI/generative-models) all work.
See [`workflows/README.md`](workflows/README.md).

Without a GPU there is a fallback that builds a short camera-move clip from the stills. The board
labels it as such, so a camera move is never mistaken for a generated one.

---

## Layout

```
src/core/      pipeline, research clients, board model, PDF builders
src/ui/        wizard, run view, review board, library
server/        Node-only API: images, research, dossier, logo compositing, video
src/samples/   the saved run behind the hosted demo
docs/          static build for GitHub Pages
```

Design tokens come from `VRINGON UI 시스템 ver3` and live in `src/tokens.css` — 68 colour pairs plus
the spacing and radius scales. Nothing in the stylesheet uses an off-scale value. Contrast was
checked across Create, Run and Board in both themes: no element under 3:1.

## Honest limits

- Concept clips in the hosted sample are camera moves, not a video model. No GPU was available here.
- Sales proxy scores are not calculated. One collection pass gives no time series, so the app says
  "not scored" rather than guessing.
- Series DNA extraction and moodboard PDF parsing are sample data — uploaded files are not read yet.
- Costs are rough and exclude duty, freight, vendor margin and defect rate. Every card says so.
- People in the concept photography are generated. They are not real, and the app says so on the card.
