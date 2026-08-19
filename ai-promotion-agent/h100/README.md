# 사내 GPU 연동

역할 넷을 사내 H100 으로 옮길 수 있습니다. 리서치(웹 검색)는 옮길 수 없습니다 — GPU 가
검색 색인을 주지는 않기 때문입니다.

| 역할 | 하는 일 | 사내에서 도는가 |
|---|---|---|
| `author` | 영토 계획 · 게놈 저작 · 업로드 분석(로고·시리즈 사진·기획안) | 예 |
| `vision` | 렌더가 설계 의도와 맞는지 눈으로 검사 | 예 |
| `image` | 스케치 · 디자인 · 캠페인 컷 생성과 편집 | 예 |
| `model3d` | 기준 렌더 한 장 → GLB | 예 |
| `research` | 경쟁사·트렌드 딥리서치 | **아니오 — 밖에 남습니다** |

기본값은 전부 바깥입니다. `.env` 에 아무것도 안 적으면 지금과 똑같이 돕니다.

## 1. 텍스트·비전 — vLLM

vLLM 이 OpenAI 호환 서버를 그대로 주므로 별도 어댑터가 필요 없습니다.

```bash
vllm serve <저작용 모델> --port 8000 --max-model-len 32768 --guided-decoding-backend xgrammar
```

`--guided-decoding-backend` 가 중요합니다. 이 앱은 모든 저작 호출에 strict JSON 스키마를
겁니다. 유도 디코딩이 없으면 스키마를 벗어난 응답이 나오고, 그때마다 그 안은 룰베이스
폴백으로 떨어집니다 — 디자인이 비슷해지던 원래 문제로 되돌아갑니다.

비전 모델을 따로 띄우면 `LOCAL_VISION_MODEL` 로 이름만 다르게 잡습니다. 한 장에 두 모델을
같이 못 올리면, 검증(`vision`)은 바깥에 두고 저작(`author`)만 사내로 옮기는 조합도 됩니다.

## 2. 이미지 · 3D — serve.py

표준 API 가 없어서 이 저장소가 서버 쪽까지 같이 갖고 있습니다.

```bash
pip install -r h100/requirements.txt
python h100/serve.py --role image   --port 8100
python h100/serve.py --role model3d --port 8200      # 카드가 두 장 이상일 때만
```

카드가 한 장이면 이미지만 올리세요. 이미지 모델과 3D 생성기를 한 장에 같이 두면 둘 다
느려집니다.

### 계약

다른 서빙 스택(ComfyUI 등)을 이미 쓰고 있다면 `serve.py` 대신 이 네 개만 맞추면 됩니다.

```
GET  /health
     → {ok: bool, model: string}

POST /generate
     {prompt, width, height, seed?}
     → {image_b64}

POST /edit
     {prompt, image_b64, width, height, strength?}
     → {image_b64}
```

```
GET  /health
     → {ok: bool, model: string}

POST /image_to_model
     {image_b64, texture}
     → {job_id}

GET  /job/{job_id}
     → {status: "queued"|"running"|"success"|"failed", progress: 0..100,
        glb_b64?: string, error?: string}
```

`/edit` 는 빼놓지 마세요. 컬러웨이 변형과 로고 합성이 전부 이 경로로 갑니다. 생성만
사내로 옮기고 편집이 없으면 Run 이 절반에서 멈춥니다.

## 3. 켜기

`fashion-agent/.env` 에 적습니다. 키와 마찬가지로 이 파일은 커밋되지 않습니다.

```
INFER_AUTHOR=local
INFER_VISION=local
INFER_IMAGE=local
INFER_3D=local

LOCAL_LLM_URL=http://10.0.0.11:8000/v1
LOCAL_LLM_MODEL=<vllm serve 에 준 모델 이름>
LOCAL_VISION_MODEL=<비전 모델 이름 · 같으면 생략>
LOCAL_IMAGE_URL=http://10.0.0.11:8100
LOCAL_3D_URL=http://10.0.0.11:8200
```

주소가 없으면 `local` 이라고 적어도 바깥으로 나갑니다. 설정 한 줄 때문에 Run 전체가
죽는 것보다 낫다고 봤습니다. 그래서 켠 뒤에는 **반드시 확인하세요**:

```bash
curl -s localhost:5188/api/inference/probe
```

`routes` 가 무엇을 어디로 보내는지, `reachable` 이 실제로 닿는지 같이 나옵니다.
`/api/status` 의 `inference` 필드에도 같은 내용이 실립니다 — 유출 방지가 목적이라면
이 줄이 곧 증거입니다.

## 알려진 구멍

**무드보드 PDF 는 사내로 못 갑니다.** 기획안 PDF 를 그대로 읽는 오픈 서빙이 흔치 않아,
`INFER_AUTHOR=local` 로 두고 PDF 를 올리면 그 호출은 명확한 오류로 멈춥니다(조용히 빈
분석을 내놓지 않습니다). 무드보드 모드를 쓸 때는 `INFER_AUTHOR=hosted` 로 두거나,
PDF 대신 페이지 이미지를 올리세요. 페이지를 이미지로 굽는 단계를 넣으면 이 구멍은
막을 수 있습니다.

**리서치는 계속 밖으로 나갑니다.** 경쟁사 이름·품목·가격대·시즌이 검색 질의로 나갑니다.
브랜드 파일은 안 나가지만 "무엇을 조사하는지"는 나갑니다. 그것도 막아야 한다면 검색
백엔드부터 따로 세워야 하고, 그건 이 연동의 범위 밖입니다.

**품질은 아직 확인되지 않았습니다.** 지금 프롬프트는 바깥 모델의 지시 이행력에 기대고
있습니다 — "신발 한 짝만, 정측면 한 시점만, 글자·로고 없음". 오픈 이미지 모델은 이런
부정 지시를 덜 지킵니다. 바꾸기 전에 `node tools/ab-images.mjs` 로 같은 프롬프트를
양쪽에서 뽑아 나란히 보세요.
