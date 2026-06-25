"""Comparação facial (assist do KYC) — documento × selfie via OpenCV.

Detecta o rosto (YuNet) em cada imagem, extrai o embedding (SFace) e devolve a
**similaridade de cosseno** (-1..1; maior = mais parecido). É APENAS um auxílio
à decisão humana (a equipe aprova/recusa), nunca aprova sozinho.

Tolerante a falha: se a lib/modelos não estiverem disponíveis ou um rosto não
for detectado, retorna ``score=None`` (a revisão segue manual). O ``import cv2``
é **lazy** para nunca derrubar o boot do backend.
"""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger("faztudo.facematch")

_MODELS_DIR = Path(__file__).resolve().parent.parent / "ml" / "models"
_YUNET = str(_MODELS_DIR / "yunet.onnx")
_SFACE = str(_MODELS_DIR / "sface.onnx")

# Limiar de cosseno do SFace para "mesma pessoa" (referência OpenCV).
COSINE_THRESHOLD = 0.363

_detector = None
_recognizer = None


def _models():
    global _detector, _recognizer
    if _detector is None:
        import cv2

        _detector = cv2.FaceDetectorYN.create(
            _YUNET, "", (320, 320), score_threshold=0.6
        )
        _recognizer = cv2.FaceRecognizerSF.create(_SFACE, "")
    return _detector, _recognizer


def _embedding(img_bytes: bytes):
    """Embedding do MAIOR rosto da imagem, ou ``None`` se nenhum rosto."""
    import cv2
    import numpy as np

    arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return None
    det, rec = _models()
    h, w = img.shape[:2]
    det.setInputSize((w, h))
    _, faces = det.detect(img)
    if faces is None or len(faces) == 0:
        return None
    face = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)[0]
    return rec.feature(rec.alignCrop(img, face))


def compare_faces(doc_bytes: bytes, selfie_bytes: bytes) -> dict:
    """Compara o rosto do documento com o da selfie.

    Retorna ``{score, doc_face, selfie_face, threshold, available}`` — ``score``
    em -1..1 (ou ``None`` se algum rosto não foi detectado / lib indisponível).
    """
    base = {"threshold": COSINE_THRESHOLD, "available": True}
    try:
        import cv2

        fd = _embedding(doc_bytes)
        fs = _embedding(selfie_bytes)
        if fd is None or fs is None:
            return {
                **base,
                "score": None,
                "doc_face": fd is not None,
                "selfie_face": fs is not None,
            }
        _, rec = _models()
        score = float(rec.match(fd, fs, cv2.FaceRecognizerSF_FR_COSINE))
        return {
            **base,
            "score": round(score, 3),
            "doc_face": True,
            "selfie_face": True,
        }
    except Exception:  # noqa: BLE001 - assist; nunca quebra a revisão do KYC
        logger.exception("Falha na comparação facial do KYC")
        return {
            "threshold": COSINE_THRESHOLD,
            "available": False,
            "score": None,
            "doc_face": False,
            "selfie_face": False,
        }
