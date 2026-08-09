// 리포트·도시에 덱을 실제로 만들어 HTML로 떨군다. 겹침과 빈칸은 브라우저에서 잰다.
import { readFileSync, writeFileSync } from 'node:fs'
import { trendDeckHtml } from '../src/core/reportPdf'
import { dossierDeckHtml } from '../src/core/dossierPdf'
import { DECK_CSS } from '../src/core/deck'
const st = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const wrap = (title: string, inner: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${DECK_CSS}</style></head><body>${inner}</body></html>`
try { const r = trendDeckHtml(st); writeFileSync(process.argv[3], wrap(r.title, r.html)); console.log('report ok') } catch (e) { console.log('report FAIL', (e as Error).message) }
try { const d = dossierDeckHtml(st); writeFileSync(process.argv[4], wrap(d.title, d.html)); console.log('dossier ok') } catch (e) { console.log('dossier FAIL', (e as Error).message) }
