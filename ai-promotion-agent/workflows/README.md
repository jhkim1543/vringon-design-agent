# 컨셉 영상 · 오픈소스 백엔드 붙이기

영상은 유료 API를 쓰지 않는다. 로컬에 **ComfyUI**를 띄우고 오픈 웨이트 모델을 물리면
`/api/video/generate` 가 자동으로 그쪽을 쓴다. 안 떠 있으면 스틸에서 카메라 무빙만 있는
클립으로 대체된다(그 사실을 UI와 보드 카드에 그대로 적는다).

## 1. ComfyUI 설치

<https://github.com/comfyanonymous/ComfyUI> · GPL-3.0

```bash
git clone https://github.com/comfyanonymous/ComfyUI
cd ComfyUI
pip install -r requirements.txt
python main.py --listen 127.0.0.1 --port 8188
```

## 2. 이미지→영상 모델 고르기

전부 오픈 웨이트다. VRAM에 맞춰 고른다.

| 모델 | 저장소 | 라이선스 | VRAM 기준 |
|---|---|---|---|
| **LTX-Video** | <https://github.com/Lightricks/LTX-Video> | 오픈 웨이트 | 12GB~ · 가장 빠름 |
| **Wan 2.2 I2V** | <https://github.com/Wan-Video/Wan2.2> | Apache-2.0 | 16GB~ · 품질 좋음 |
| **CogVideoX** | <https://github.com/THUDM/CogVideo> | Apache-2.0 | 18GB~ |
| **Stable Video Diffusion** | <https://github.com/Stability-AI/generative-models> | SAI 커뮤니티 | 12GB~ |

체크포인트를 `ComfyUI/models/checkpoints/` 에 넣는다.

## 3. 워크플로 저장

ComfyUI에서 image-to-video 그래프를 구성한 뒤 **Save (API Format)** 으로 내보낸다.
저장한 JSON에서 아래 세 곳을 자리표시자로 바꾼다.

- 입력 이미지 노드의 `image` 값 → `"%IMAGE%"`
- 프롬프트 노드의 `text` 값 → `"%PROMPT%"`
- 샘플러의 `seed` 값 → `"%SEED%"`

그 파일을 이 폴더에 둔다. 예: `workflows/i2v.json`

## 4. .env

```
COMFY_URL=http://127.0.0.1:8188
COMFY_I2V_WORKFLOW=workflows/i2v.json
```

서버를 다시 띄우면 `/api/video/probe` 가 `available: true` 를 돌려주고,
그때부터 컨셉 영상이 실제 모델 출력으로 바뀐다.

## 지금 상태

이 개발 환경에는 GPU가 없어 위 모델을 직접 돌려 검증하지 못했다.
어댑터(업로드 → 큐 → 폴링 → 결과 내려받기)와 폴백은 동작을 확인했다.
