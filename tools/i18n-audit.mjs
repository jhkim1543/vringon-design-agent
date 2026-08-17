// ── 화면에 나오는데 번역을 안 타는 문자열을 찾는다 ──────────────────────
//
// i18n 은 영문 원문을 키로 쓴다. 그래서 t() 로 감싸지 않은 문자열은 사전에 있든 없든
// 영어 그대로 화면에 남는다. 언어를 KR 로 바꿔도 그 부분만 영어인 이유가 이것이다.
//
// 여기서 보는 것 셋:
//   ① t() 를 안 거치는 JSX 텍스트 노드      >Brand identity<
//   ② t() 를 안 거치는 사용자 표시 속성      placeholder / title / aria-label
//   ③ t() 는 거치는데 사전에 없는 키          t('Foo') 인데 KO/JA 에 'Foo' 가 없다
//
// 사용: node tools/i18n-audit.mjs            요약
//       node tools/i18n-audit.mjs --list     빠진 문자열 전부
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const showAll = process.argv.includes('--list')

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

// 사전 키 수집 · 원문을 키로 쓰므로 'key': 'value' 의 key 만 모으면 된다
function dictKeys(file) {
  const s = readFileSync(join(ROOT, file), 'utf8')
  const keys = new Set()
  for (const m of s.matchAll(/^\s*'((?:[^'\\]|\\.)+)':/gm)) keys.add(m[1].replace(/\\'/g, "'"))
  for (const m of s.matchAll(/^\s*"((?:[^"\\]|\\.)+)":/gm)) keys.add(m[1].replace(/\\"/g, '"'))
  return keys
}
const KO = dictKeys('src/core/i18n.ts')
const JA = dictKeys('src/core/i18n.ja.ts')

// 영어처럼 보이는가 · 한글/가나가 있으면 원문이 이미 그 언어이므로 대상이 아니다
const isEnglish = (s) => /[A-Za-z]/.test(s) && !/[가-힣぀-ヿ一-鿿]/.test(s)
// 코드처럼 보이는 것은 화면 텍스트가 아니다
const looksCode = (s) => /^[\s{}()[\];:,.<>/*+=|&!?-]*$/.test(s) || /^[a-z_]+$/.test(s) || /^\d/.test(s)

const files = walk(join(ROOT, 'src')).filter(f => !/i18n/.test(f))
const jsxText = [], attrText = [], missingKo = [], missingJa = []

for (const abs of files) {
  const rel = relative(ROOT, abs).replace(/\\/g, '/')
  const src = readFileSync(abs, 'utf8')
  const lines = src.split('\n')

  lines.forEach((line, i) => {
    const at = `${rel}:${i + 1}`
    // ③ t() 는 쓰는데 사전에 없는 키
    for (const m of line.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)+)'/g)) {
      const key = m[1].replace(/\\'/g, "'")
      if (!isEnglish(key)) continue
      if (!KO.has(key)) missingKo.push({ at, key })
      if (!JA.has(key)) missingJa.push({ at, key })
    }
    // ① JSX 텍스트 노드 · >텍스트<
    for (const m of line.matchAll(/>([^<>{}\n]{3,})</g)) {
      const txt = m[1].trim()
      if (!txt || !isEnglish(txt) || looksCode(txt)) continue
      if (!/[A-Za-z]{3,}/.test(txt)) continue
      jsxText.push({ at, txt })
    }
    // ② 사용자에게 보이는 속성
    for (const m of line.matchAll(/\b(placeholder|title|aria-label)=["']([^"'{]{3,})["']/g)) {
      const txt = m[2].trim()
      if (!isEnglish(txt) || looksCode(txt)) continue
      attrText.push({ at, attr: m[1], txt })
    }
  })
}

const byFile = (rows) => {
  const m = {}
  for (const r of rows) { const f = r.at.split(':')[0]; m[f] = (m[f] || 0) + 1 }
  return Object.entries(m).sort((a, b) => b[1] - a[1])
}

console.log(`사전: KO ${KO.size}개 · JA ${JA.size}개`)
console.log(`\n① t() 를 안 거치는 JSX 텍스트 ${jsxText.length}건`)
for (const [f, n] of byFile(jsxText)) console.log(`   ${String(n).padStart(3)}  ${f}`)
console.log(`\n② t() 를 안 거치는 표시 속성 ${attrText.length}건`)
for (const [f, n] of byFile(attrText)) console.log(`   ${String(n).padStart(3)}  ${f}`)
console.log(`\n③ t() 는 쓰는데 사전에 없는 키 · KO ${missingKo.length}건 · JA ${missingJa.length}건`)
for (const [f, n] of byFile(missingJa)) console.log(`   JA ${String(n).padStart(3)}  ${f}`)

if (showAll) {
  console.log('\n──────── ① JSX 텍스트 ────────')
  for (const r of jsxText) console.log(`${r.at}\n   ${r.txt}`)
  console.log('\n──────── ② 속성 ────────')
  for (const r of attrText) console.log(`${r.at} [${r.attr}]\n   ${r.txt}`)
  console.log('\n──────── ③ 사전에 없는 키 (KO) ────────')
  for (const r of missingKo) console.log(`${r.at}\n   ${r.key}`)
  console.log('\n──────── ③ 사전에 없는 키 (JA) ────────')
  for (const r of missingJa) console.log(`${r.at}\n   ${r.key}`)
}
