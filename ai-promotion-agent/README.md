# AI 프로모션 에이전트 (씨앗)

신발 디자인 에이전트(`../`)의 소스를 그대로 복제한 출발점이다. **아직 프로모션 제품이 아니다** —
파이프라인·서버·보드·정직성 장치가 전부 신발 어휘로 쓰여 있고, 그걸 프로모션 어휘로 바꾸는 것이
이 폴더에서 할 일이다.

지금 상태로 `npm install && npm run dev` 하면 뜬다. 다만 위저드가 신발을 묻고, 조사가 신발을
찾고, 게놈이 토캡과 미드솔을 저작한다.

---

## 무엇을 복제했고 무엇을 뺐나

**가져온 것** — 소스 전부 (1.4MB)

```
src/core      파이프라인 S1~S5, 타입, i18n, 재시도(net.ts), 저장소, 브랜드/MD
src/ui        위저드, 실행 화면, 보드, 리포트, 브랜드 설정 · 반응형 포함
server        조사·저작·비전·이미지·3D API, 사용량 장부, 추론 라우터
tools         샘플 러너, 감사 도구, 비용 리포트
h100          로컬 GPU 추론 계약 (opt-in · 기본은 hosted)
workflows     ComfyUI i2v 워크플로
```

**뺀 것** — 신발 데모의 산출물 (490MB)

`public/samples`(이미지·GLB 254MB) · `docs/`(배포 빌드 246MB) · `src/samples/*.json`(신발 Run 3종).
프로모션 에이전트에 신발 사진이 들어갈 이유가 없고, 저장소가 두 배가 된다.
`src/core/sampleRun.ts` 는 샘플 파일이 없으면 조용히 넘어가므로 앱은 그대로 뜬다.

---

## 반드시 갈아야 하는 것 — 신발이 박혀 있는 자리

주얼리 이식 가이드(`../JEWELRY-PORT-GUIDE.md`)가 같은 작업을 신발→주얼리로 설명한다.
그 문서의 §8 「실제로 물린 함정 여덟 개」는 품목이 무엇이든 그대로 겪는다. 먼저 읽을 것.

| 자리 | 지금 | 프로모션에서는 |
|---|---|---|
| `src/core/types.ts` `TAXONOMY` | 신발 6계열 × 세부 유형 | 프로모션 유형 분류 (캠페인·런칭·시즌오프·콜라보…) |
| `src/core/types.ts` `FootwearLineProfile` | 라스트·어퍼·바텀·공법 | 프로모션 정의 (채널·기간·예산·타깃·목표 지표) |
| `src/core/packs.ts` | 힐 높이·패널 수·공법 범위, 계열별 뷰셋 | 프로모션 자산 규격 (배너 사이즈·영상 길이·플랫폼 규격) |
| `server/category-templates.mjs` | 계열별 조사 렌즈 (컵솔·폭싱…) | 채널별 조사 렌즈 (전환율·CTR·크리에이티브 관습) |
| `server/design-api.mjs` `GENOME_SCHEMA` | 7파트 × form/material | 프로모션 게놈 (헤드라인·비주얼·CTA·오퍼 구조) |
| `server/dossier-api.mjs` | 시즌 도시에 (매크로 4개) | 캠페인 도시에 — 시즌 대신 **캠페인 주기**가 축 |
| `src/core/aiClient.ts` | 선화→렌더 2층 프롬프트, 파트별 소재 | 프로모션 자산 프롬프트 (레이아웃→비주얼) |
| `src/core/brand.ts` MD 페르소나 | 바이어 (정상판매율·소진 주수) | 마케터 페르소나 (ROAS·CPA·채널 KPI) |

**그대로 써도 되는 것** — 품목과 무관한 기계:

`src/core/net.ts`(재시도) · `server/usage-ledger.mjs`(사용량 장부) · `server/inference.mjs`(라우터) ·
`server/markets.mjs`(시장 모델) · `src/core/i18n*.ts`(3개 국어) · `src/core/store.ts` ·
정직성 장치 전부 (`hintApplied`/`hintBlocked`, 출처 등급, 비전 검증, 사람 게이트).

---

## 먼저 할 일 셋

1. **`.env` 를 만든다.** `.env.example` 을 복사하고 키를 넣는다. 키는 절대 커밋하지 않는다 —
   `.gitignore` 4·5행이 막고 있다.
2. **`TAXONOMY` 와 라인 프로필부터 바꾼다.** 그 둘이 조사·프롬프트·캐시 키를 전부 관통하므로,
   여기를 안 바꾸고 뒤를 손대면 신발 검색어가 계속 나간다.
3. **`npm run typecheck` 로 확인한다.** `src` 와 `tools` 를 함께 본다 — esbuild 는 타입을
   지우기만 하므로, 이게 없으면 러너 오류가 두 시간짜리 Run 을 띄운 뒤에야 나온다.

---

## 비용을 미리 알고 시작할 것

`../API-COST-ANALYSIS.md` 와 `../API-COST-DETAIL.md` 에 신발 기준 실측이 있다.
Run 하나가 **$10~18**, 그중 **이미지가 55~80%** 다. 프로모션은 자산 장수가 신발보다 많을 수 있으니
`imageBudget` 과 `campaignShots` 를 먼저 정하고 시작하라.

`node tools/usage-report.mjs` 가 실제 쓴 토큰·장수를 Run 별로 뽑는다. 서버가 호출마다
`.cache/usage/<날짜>.jsonl` 에 적는다.
