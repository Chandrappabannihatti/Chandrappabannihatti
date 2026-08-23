"""
Standalone prediction helper.

Usage:
    python predict.py 85 8 8.2 8.1 0 42 44
      (attendance_percentage assignment_marks previous_sem_sgpa
       cgpa backlogs ia1 ia2)

The Flask backend loads the same model.pkl bundle via
backend/services/ml_service.py so the API and this script
stay perfectly in sync.
"""
import json
import os
import sys

import joblib
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(HERE, "model.pkl")

_bundle = None


def load_bundle():
    global _bundle
    if _bundle is None:
        if not os.path.exists(MODEL_PATH):
            raise RuntimeError("model.pkl not found. Run: python train.py")
        _bundle = joblib.load(MODEL_PATH)
    return _bundle


def predict(features: dict) -> dict:
    bundle = load_bundle()
    feats = bundle["features"]
    row = [float(features.get(f, 0)) for f in feats]
    X = np.array([row], dtype=float)

    clf = bundle["classifier"]
    reg = bundle["regressor"]
    le = bundle["label_encoder"]

    proba = clf.predict_proba(X)[0]
    cls_idx = int(np.argmax(proba))
    risk_level = str(le.inverse_transform([cls_idx])[0])
    pass_probability = float(np.clip(reg.predict(X)[0], 0, 100))
    confidence = round(float(proba[cls_idx]) * 100, 1)

    return {
        "risk_level": risk_level,
        "pass_probability": round(pass_probability, 1),
        "confidence": confidence,
        "class_probabilities": {
            str(cls): round(float(p) * 100, 1)
            for cls, p in zip(le.classes_, proba)
        },
    }


if __name__ == "__main__":
    if len(sys.argv) >= 8:
        keys = [
            "attendance_percentage", "assignment_marks", "previous_sem_sgpa",
            "cgpa", "backlogs", "ia1", "ia2",
        ]
        feats = {k: float(v) for k, v in zip(keys, sys.argv[1:8])}
    else:  # demo sample
        feats = {
            "attendance_percentage": 85, "assignment_marks": 8,
            "previous_sem_sgpa": 8.2, "cgpa": 8.1, "backlogs": 0,
            "ia1": 42, "ia2": 44,
        }
    feats["avg_ia"] = round((feats["ia1"] + feats["ia2"]) / 2.0, 1)
    print(json.dumps(predict(feats), indent=2))
