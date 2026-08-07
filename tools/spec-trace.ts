import { SIGNALS } from '../src/core/samples'
import { deriveSpecHints, drivingFromHint, hintNarrative, reconcileHint, blockedNarrative } from '../src/core/signalSpec'
import { PACKS, profileOf, resetSeq } from '../src/core/packs'
import { makeRng } from '../src/core/rng'
import type { DesignTier, ItemType } from '../src/core/types'

const types = (process.argv.slice(2).length ? process.argv.slice(2) : ['running','derby','chelsea','pump','trail']) as ItemType[]
const tiers: DesignTier[] = ['core','push','signature']
for (const it of types) {
  const athletic = !!profileOf(it).athletic
  console.log('\n=== ' + it + (athletic ? ' (athletic)' : '') + ' ===')
  for (const tier of tiers) {
    const raw = deriveSpecHints(SIGNALS.shoe, tier, athletic)
    resetSeq(); const spec = PACKS.shoe.generateSpec(makeRng(42), tier, it, {}, raw.fields)
    const hint = reconcileHint(raw, spec.hintApplied)
    console.log(` ${tier}: proposed=${Object.keys(raw.fields).join(',')} | applied=${(spec.hintApplied??[]).join(',')||'none'}`)
    console.log(`   driving=${JSON.stringify(drivingFromHint(hint))}`)
    console.log(`   says: ${hintNarrative(hint, SIGNALS.shoe).join(' ') || '(nothing)'}`)
    console.log(`   blocked: ${blockedNarrative(spec.hintBlocked).join(' ') || '(none)'}`)
  }
}
