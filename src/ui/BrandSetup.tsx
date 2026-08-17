// ── 브랜드 아이덴티티 설정 · 모든 에이전트 결과에 공통으로 실린다 ──────
import { useRef, useState } from 'react'
import type { BrandIdentity, BrandLogo, MdPersona } from '../core/brand'
import { EMPTY_BRAND, EMPTY_MD, brandPromptClause } from '../core/brand'
import { Tag } from './bits'
import { readLogoStyle, uploadFiles } from '../core/uploads'
import { getLang, LANG_NAME, t } from '../core/i18n'

const PLACEMENTS: { id: BrandLogo['placement']; label: string; forShoe: boolean }[] = [
  { id: 'none', label: 'None', forShoe: true },
  { id: 'tongue', label: 'Tongue', forShoe: true },
  { id: 'heel', label: 'Heel counter', forShoe: true },
  { id: 'side', label: 'Side panel', forShoe: true },
  { id: 'insole', label: 'Insole', forShoe: true },
  { id: 'clasp', label: 'Clasp', forShoe: false },
  { id: 'pendant', label: 'Pendant face', forShoe: false },
]

function TokenList({ label, hint, items, onChange, placeholder }: {
  label: string; hint: string; items: string[]
  onChange: (v: string[]) => void; placeholder: string
}) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (!v || items.includes(v)) return
    onChange([...items, v]); setDraft('')
  }
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <span className="lbl">{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="chiplist">
          {items.map(item => (
            <span className="chip-in" key={item}>
              {item}
              <button onClick={() => onChange(items.filter(x => x !== item))} aria-label={`${t('Remove')} ${item}`}>{t('Remove')}</button>
            </span>
          ))}
          {!items.length && <span className="hint">{hint}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input className="input" style={{ maxWidth: 280 }} placeholder={placeholder}
            value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add() }} />
          <button className="btn btn-ghost btn-sm" onClick={add}>{t('Add')}</button>
        </div>
      </div>
    </div>
  )
}

export default function BrandSetup({ brand, onSave, onClose }: {
  brand: BrandIdentity
  onSave: (b: BrandIdentity) => void
  onClose: () => void
}) {
  const [b, setB] = useState<BrandIdentity>(brand)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = <K extends keyof BrandIdentity>(k: K, v: BrandIdentity[K]) => setB(p => ({ ...p, [k]: v }))
  const md: MdPersona = b.md ?? EMPTY_MD
  const setMd = (patch: Partial<MdPersona>) => setB(p => ({ ...p, md: { ...(p.md ?? EMPTY_MD), ...patch } }))

  const readLogo = (f: File) => {
    const r = new FileReader()
    r.onload = () => set('logo', {
      name: f.name, dataUrl: String(r.result),
      placement: b.logo?.placement ?? 'none', scale: b.logo?.scale ?? 'subtle',
      references: b.logo?.references, style: null,   // 로고가 바뀌면 옛 배치 규칙은 못 믿는다
    })
    r.readAsDataURL(f)
  }

  // 로고가 이미 적용된 제품 사진 · 올리면 그 배치 방식을 읽어 온다
  const [refBusy, setRefBusy] = useState(false)
  const [refError, setRefError] = useState<string | null>(null)
  const takeRefs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!picked.length || !b.logo) return
    setRefBusy(true); setRefError(null)
    try {
      const { ok, failed } = await uploadFiles(picked)
      if (failed.length) setRefError(`${failed.length} ${t('could not be read')} · ${failed[0]}`)
      if (!ok.length) return
      const refs = [...(b.logo.references ?? []), ...ok]
      // 로고 원본도 함께 올려 둔다. 모델이 "이 마크"를 알아야 사진에서 그걸 찾는다.
      let logoId: string | undefined
      try {
        const blob = await (await fetch(b.logo.dataUrl)).blob()
        const up = await uploadFiles([new File([blob], b.logo.name, { type: blob.type || 'image/png' })])
        logoId = up.ok[0]?.id
      } catch { /* 원본을 못 올려도 참고 사진만으로 읽을 수 있다 */ }
      const style = await readLogoStyle({
        logoId, referenceIds: refs.map(r => r.id),
        itemTypeEn: 'footwear', langName: LANG_NAME[getLang()],
      })
      set('logo', { ...b.logo, references: refs, style })
    } catch (err) {
      setRefError(String((err as Error).message).slice(0, 160))
    } finally {
      setRefBusy(false)
    }
  }

  const [color, setColor] = useState({ name: '', hex: '#444AE8' })
  const addColor = () => {
    const n = color.name.trim() || color.hex
    if (b.colorPalette.some(c => c.hex === color.hex)) return
    set('colorPalette', [...b.colorPalette, { name: n, hex: color.hex }])
    setColor({ name: '', hex: '#444AE8' })
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-h">
          <div>
            <h2>{t('Brand identity')}</h2>
            <p className="hint">{t('Whatever you put here rides along with every result, whichever agent you run. The agent decides the spec first; your brand rules sit on top of it.')}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('Close')}</button>
        </div>

        <div className="modal-body">
          <div className="wcard">
            <h3><span className="n">1</span> {t('Basics')}</h3>
            <div className="row"><span className="lbl">{t('Name')}</span>
              <input className="input" style={{ maxWidth: 280 }} value={b.brandName}
                placeholder={t('e.g. VRINGON')} onChange={e => set('brandName', e.target.value)} />
            </div>
            <div className="row"><span className="lbl">{t('One line')}</span>
              <input className="input" style={{ flex: 1 }} value={b.tagline}
                placeholder={t('The brand in one sentence')} onChange={e => set('tagline', e.target.value)} />
            </div>
          </div>

          {/* MD 페르소나 · 결과를 고르는 사람.
              "MD처럼 평가해"라고만 하면 누구에게나 통하는 말이 돌아온다. 실제 MD의 판단은
              자기가 책임지는 숫자에서 나오므로, 판단을 가르는 것만 묻는다. */}
          <div className="wcard">
            <h3><span className="n">2</span> {t('The MD who picks')}</h3>
            <p className="hint" style={{ marginTop: -4 }}>{t('Fill this in and the selection stage stops being a metric ranking. A buyer with this brief reviews every candidate, says what they would order and what they would not, and why. Leave it empty and selection falls back to the numbers alone.')}</p>
            <div className="row"><span className="lbl">{t('Who')}</span>
              <input className="input" style={{ flex: 1 }} value={md.role}
                placeholder={t('e.g. Department store womenswear buyer, 8 years')}
                onChange={e => setMd({ role: e.target.value })} />
            </div>
            <div className="row"><span className="lbl">{t('Channel')}</span>
              <input className="input" style={{ flex: 1 }} value={md.channel}
                placeholder={t('e.g. Lotte main store, 2nd floor, no online')}
                onChange={e => setMd({ channel: e.target.value })} />
            </div>
            <div className="row"><span className="lbl">{t('Customer')}</span>
              <input className="input" style={{ flex: 1 }} value={md.customer}
                placeholder={t('e.g. Women 30-45 buying for work, not for weekends')}
                onChange={e => setMd({ customer: e.target.value })} />
            </div>
            <div className="row"><span className="lbl">{t('Price band')}</span>
              <input className="input" style={{ maxWidth: 280 }} value={md.priceBandKrw}
                placeholder={t('e.g. KRW 250k-450k retail')}
                onChange={e => setMd({ priceBandKrw: e.target.value })} />
            </div>
            <div className="row"><span className="lbl">{t('Risk')}</span>
              <div className="chiprow">
                {(['conservative', 'balanced', 'aggressive'] as const).map(r => (
                  <button key={r} className={`pick sm ${md.riskAppetite === r ? 'on' : ''}`}
                    onClick={() => setMd({ riskAppetite: r })}>
                    {t(r === 'conservative' ? 'Plays safe' : r === 'balanced' ? 'Balanced' : 'Bets on new')}
                  </button>
                ))}
              </div>
            </div>
            <TokenList label={t('Judged on')} hint={t('The numbers this person answers for')}
              items={md.kpis} onChange={v => setMd({ kpis: v })}
              placeholder={t('e.g. 65% full-price sell-through')} />
            <TokenList label={t('Burned by')} hint={t('What failed last season. Without this the review stays textbook')}
              items={md.pastMisses} onChange={v => setMd({ pastMisses: v })}
              placeholder={t('e.g. chunky soles sat unsold')} />
            <TokenList label={t('Never buys')} hint={t('Instant no')}
              items={md.dealBreakers} onChange={v => setMd({ dealBreakers: v })}
              placeholder={t('e.g. over 400g per shoe')} />
            <TokenList label={t('Sits beside')} hint={t('What it competes with on the floor')}
              items={md.competingOnFloor} onChange={v => setMd({ competingOnFloor: v })}
              placeholder={t('e.g. Marc Jacobs, Stuart Weitzman')} />
          </div>

          <div className="wcard">
            <h3><span className="n">3</span> {t('Logo')}</h3>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <span className="lbl">{t('File')}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {b.logo ? (
                  <div className="logo-row">
                    <div className="logo-prev"><img src={b.logo.dataUrl} alt={t('Logo')} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{b.logo.name}</div>
                      <div className="hint">{t('The file stays in this browser. When a render needs the mark, the image is sent to the server to composite it, and that composite is cached there.')}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => set('logo', null)}>{t('Remove')}</button>
                  </div>
                ) : (
                  <label className="dropzone">
                    <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg" hidden
                      onChange={e => { const f = e.target.files?.[0]; if (f) readLogo(f) }} />
                    {t('Drop a logo file')}
                    <span className="dz-sub">{t('PNG or SVG. A transparent background composites cleanly.')}</span>
                  </label>
                )}
              </div>
            </div>

            {b.logo && (<>
              <div className="row"><span className="lbl">{t('Placement')}</span>
                <div className="chiprow">
                  {PLACEMENTS.filter(p => p.forShoe).map(p => (
                    <button key={p.id} className={`pick sm ${b.logo!.placement === p.id ? 'on' : ''}`}
                      onClick={() => set('logo', { ...b.logo!, placement: p.id })}>{t(p.label)}</button>
                  ))}
                </div>
              </div>
              <div className="row"><span className="lbl">{t('Weight')}</span>
                <div className="chiprow">
                  {(['subtle', 'normal', 'bold'] as const).map(s => (
                    <button key={s} className={`pick sm ${b.logo!.scale === s ? 'on' : ''}`}
                      onClick={() => set('logo', { ...b.logo!, scale: s })}>
                      {t(s === 'subtle' ? 'Subtle' : s === 'normal' ? 'Normal' : 'Bold')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="row">
                <label className="chk">
                  <input type="checkbox" checked={b.applyLogoToImages}
                    onChange={e => set('applyLogoToImages', e.target.checked)} />
                  {t('Leave the logo area empty in generated images')}
                </label>
              </div>
              <div className="row">
                <span className="hint">{t("Generators can't reproduce a logo accurately. With this on, nothing is drawn there and the spot you picked is left clean. Composite the real file onto it afterwards.")}</span>
              </div>

              {/* 로고 파일만으로는 평면 합성밖에 못 한다. 실제 제품에서 마크가 어떻게 앉는지를
                  보여 주면 그 방식을 읽어 렌더가 형태로 그려 낸다. */}
              <div className="row"><span className="lbl">{t('How it sits')}</span>
                <div style={{ flex: 1 }}>
                  <label className="dropzone" style={{ minHeight: 64 }}>
                    <input type="file" multiple accept="image/png,image/jpeg,image/webp" hidden
                      onChange={e => void takeRefs(e)} />
                    {t(refBusy ? 'Reading how the mark is applied…' : 'Add product photos that already carry this logo')}
                    <span className="dz-sub">{t('The agent copies how the mark sits on these, instead of pasting a flat file')}</span>
                  </label>
                  {refError && <p className="hint" style={{ color: 'var(--danger)' }}>{refError}</p>}
                  {!!b.logo.references?.length && (
                    <div className="chiplist quick" style={{ marginTop: 6 }}>
                      {b.logo.references.map((f, i) => (
                        <span className="chip-in" key={f.id + i}>{f.name}
                          <button aria-label={t('Remove')} onClick={() => set('logo', {
                            ...b.logo!,
                            references: b.logo!.references!.filter((_, j) => j !== i),
                            style: null,
                          })}>{t('Remove')}</button>
                        </span>
                      ))}
                    </div>
                  )}
                  {b.logo.style && (
                    <div className="logo-style">
                      <b>{t('Read from your photos')}</b>
                      <div>{b.logo.style.placement_description}</div>
                      <div>{b.logo.style.scale_note} · {b.logo.style.integration}</div>
                      <div>{b.logo.style.colour_treatment}</div>
                      {b.logo.style.not_seen && <div className="hint">{t('Not visible in these photos')}: {b.logo.style.not_seen}</div>}
                    </div>
                  )}
                </div>
              </div>
            </>)}
          </div>

          <div className="wcard">
            <h3><span className="n">4</span> {t('Brand rules')}</h3>
            <TokenList label={t('Signature elements')} hint={t('The shapes people recognise you by')}
              placeholder={t('e.g. angular metal plate at the heel')}
              items={b.signatureElements} onChange={v => set('signatureElements', v)} />
            <TokenList label={t('Materials')} hint={t('What you use often')}
              placeholder={t('e.g. brushed steel')}
              items={b.materials} onChange={v => set('materials', v)} />
            <TokenList label={t('Feel')} hint={t('How the result should read')}
              placeholder={t('e.g. restrained, structural')}
              items={b.toneWords} onChange={v => set('toneWords', v)} />
            <TokenList label={t('Never')} hint={t('Things you never do. Breaking one flags the card.')}
              placeholder={t('e.g. patent leather, printed logo')}
              items={b.forbidden} onChange={v => set('forbidden', v)} />

            <div className="row" style={{ alignItems: 'flex-start' }}>
              <span className="lbl">{t('Palette')}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="chiplist">
                  {b.colorPalette.map(c => (
                    <span className="chip-in" key={c.hex}>
                      <i className="swatch" style={{ background: c.hex }} />
                      {c.name}
                      <button onClick={() => set('colorPalette', b.colorPalette.filter(x => x.hex !== c.hex))}>{t('Remove')}</button>
                    </span>
                  ))}
                  {!b.colorPalette.length && <span className="hint">{t('Brand colours')}</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                  <input type="color" className="colorpick" value={color.hex}
                    onChange={e => setColor(c => ({ ...c, hex: e.target.value }))} />
                  <input className="input" style={{ maxWidth: 180 }} placeholder={t('Colour name')}
                    value={color.name} onChange={e => setColor(c => ({ ...c, name: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') addColor() }} />
                  <button className="btn btn-ghost btn-sm" onClick={addColor}>{t('Add')}</button>
                </div>
              </div>
            </div>
          </div>

          <div className="wcard">
            <h3><span className="n">5</span> {t('Prompt preview')}</h3>
            <p className="hint" style={{ marginBottom: 8 }}>{t('This sentence is appended to every image prompt.')}</p>
            <pre className="promptprev">{brandPromptClause(b) || t('Nothing set yet')}</pre>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost btn-sm" onClick={() => setB(EMPTY_BRAND)}>{t('Reset')}</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {b.brandName && <Tag kind="ok">{b.brandName}</Tag>}
            <button className="btn btn-primary" onClick={() => { onSave(b); onClose() }}>{t('Save')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
