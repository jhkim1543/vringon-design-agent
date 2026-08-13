# ── 사내 GPU 추론 서버 · 이미지와 3D ──────────────────────────────────
#
# 텍스트·비전은 이 파일이 다루지 않는다. vLLM 이 OpenAI 호환 서버를 그대로 주므로
# 그쪽은 vLLM 을 띄우고 LOCAL_LLM_URL 만 가리키면 된다 (README 참고).
#
# 이 파일이 채우는 것은 표준이 없는 두 가지다:
#   :8100  /health  /generate  /edit          이미지
#   :8200  /health  /image_to_model  /job/{id} 3D
#
# 실행:
#   python serve.py --role image --port 8100
#   python serve.py --role model3d --port 8200
#
# 두 역할을 한 장에 같이 올리지 말 것. H100 80GB 한 장이면 이미지 모델만으로도
# 여유가 많지 않고, 3D 생성기와 겹치면 둘 다 느려진다. 카드가 하나뿐이면
# --role image 만 띄우고 3D 는 당분간 밖에 두는 편이 낫다.

import argparse
import base64
import io
import threading
import time
import uuid

import torch
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()
STATE = {"role": None, "model_name": None, "pipe": None, "edit_pipe": None}


def _b64_png(img) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def _from_b64(s: str):
    from PIL import Image
    return Image.open(io.BytesIO(base64.b64decode(s))).convert("RGB")


# ── 이미지 ────────────────────────────────────────────────────────────

class GenReq(BaseModel):
    prompt: str
    width: int = 1024
    height: int = 1024
    seed: int | None = None


class EditReq(BaseModel):
    prompt: str
    image_b64: str
    width: int = 1024
    height: int = 1024
    # 기준 그림을 얼마나 유지할지. 컬러웨이 변형은 형태를 지켜야 하므로 낮게 잡는다.
    strength: float = 0.45


def load_image_models(model_id: str, edit_model_id: str | None):
    from diffusers import AutoPipelineForText2Image, AutoPipelineForImage2Image

    pipe = AutoPipelineForText2Image.from_pretrained(
        model_id, torch_dtype=torch.bfloat16
    ).to("cuda")
    pipe.set_progress_bar_config(disable=True)

    # 편집은 같은 가중치를 재사용한다. 두 번 올리면 VRAM 만 두 배로 먹는다.
    if edit_model_id and edit_model_id != model_id:
        edit = AutoPipelineForImage2Image.from_pretrained(
            edit_model_id, torch_dtype=torch.bfloat16
        ).to("cuda")
    else:
        edit = AutoPipelineForImage2Image.from_pipe(pipe)
    edit.set_progress_bar_config(disable=True)

    STATE["pipe"], STATE["edit_pipe"], STATE["model_name"] = pipe, edit, model_id


@app.post("/generate")
def generate(r: GenReq):
    gen = None
    if r.seed is not None:
        gen = torch.Generator("cuda").manual_seed(int(r.seed))
    img = STATE["pipe"](
        prompt=r.prompt,
        width=r.width,
        height=r.height,
        num_inference_steps=int(STATE.get("steps", 28)),
        guidance_scale=float(STATE.get("guidance", 3.5)),
        generator=gen,
    ).images[0]
    return {"image_b64": _b64_png(img), "model": STATE["model_name"]}


@app.post("/edit")
def edit(r: EditReq):
    base = _from_b64(r.image_b64).resize((r.width, r.height))
    img = STATE["edit_pipe"](
        prompt=r.prompt,
        image=base,
        strength=float(r.strength),
        num_inference_steps=int(STATE.get("steps", 28)),
        guidance_scale=float(STATE.get("guidance", 3.5)),
    ).images[0]
    return {"image_b64": _b64_png(img), "model": STATE["model_name"]}


# ── 3D ────────────────────────────────────────────────────────────────
#
# 한 장 → GLB. 생성이 수십 초에서 몇 분 걸리므로 job 으로 돌려준다.
# 호출하는 쪽(inference.mjs)은 3초마다 /job/{id} 를 눌러 본다.

JOBS: dict[str, dict] = {}
JOB_LOCK = threading.Lock()


class ModelReq(BaseModel):
    image_b64: str
    texture: bool = True


def load_3d_model(model_id: str):
    # 여기는 쓰는 3D 생성기에 맞춰 바꾼다. 계약은 아래 run_3d 의 입출력뿐이다:
    #   PIL 이미지 한 장을 받아 GLB 바이트를 돌려준다.
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline

    STATE["pipe"] = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(model_id)
    STATE["model_name"] = model_id


def run_3d(img) -> bytes:
    mesh = STATE["pipe"](image=img)[0]
    out = f"/tmp/{uuid.uuid4().hex}.glb"
    mesh.export(out)
    with open(out, "rb") as f:
        return f.read()


def _worker(job_id: str, image_b64: str):
    try:
        with JOB_LOCK:  # 한 장에 두 건을 동시에 올리면 OOM 으로 둘 다 죽는다
            JOBS[job_id].update(status="running", progress=10)
            glb = run_3d(_from_b64(image_b64))
        JOBS[job_id].update(
            status="success", progress=100, glb_b64=base64.b64encode(glb).decode()
        )
    except Exception as e:  # 실패는 실패라고 말한다. 빈 GLB 를 돌려주지 않는다
        JOBS[job_id].update(status="failed", error=str(e)[:300])


@app.post("/image_to_model")
def image_to_model(r: ModelReq):
    job_id = uuid.uuid4().hex
    JOBS[job_id] = {"status": "queued", "progress": 0, "at": time.time()}
    threading.Thread(target=_worker, args=(job_id, r.image_b64), daemon=True).start()
    return {"job_id": job_id}


@app.get("/job/{job_id}")
def job(job_id: str):
    j = JOBS.get(job_id)
    if not j:
        return {"status": "failed", "error": "no such job"}
    # 끝난 job 의 GLB 는 한 번 건네고 버린다. 안 그러면 메모리에 계속 쌓인다.
    if j["status"] == "success":
        out = dict(j)
        JOBS.pop(job_id, None)
        return out
    return {k: v for k, v in j.items() if k != "glb_b64"}


# ── 공통 ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "ok": STATE["pipe"] is not None,
        "role": STATE["role"],
        "model": STATE["model_name"],
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
    }


if __name__ == "__main__":
    import uvicorn

    ap = argparse.ArgumentParser()
    ap.add_argument("--role", choices=["image", "model3d"], required=True)
    ap.add_argument("--port", type=int, default=8100)
    ap.add_argument("--model", default=None)
    ap.add_argument("--edit-model", default=None)
    ap.add_argument("--steps", type=int, default=28)
    ap.add_argument("--guidance", type=float, default=3.5)
    a = ap.parse_args()

    STATE["role"], STATE["steps"], STATE["guidance"] = a.role, a.steps, a.guidance
    if a.role == "image":
        load_image_models(a.model or "black-forest-labs/FLUX.1-dev", a.edit_model)
    else:
        load_3d_model(a.model or "tencent/Hunyuan3D-2")
    uvicorn.run(app, host="0.0.0.0", port=a.port)
