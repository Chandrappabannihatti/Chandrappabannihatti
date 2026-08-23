"""CAMPS prediction service.

The service loads an optional joblib XGBoost model from MODEL_PATH. If no model
is present, it uses the same transparent baseline as the Node demo fallback so
the API remains useful during development.
"""
import os
from pathlib import Path

from flask import Flask, jsonify, request
import joblib
import numpy as np

app = Flask(__name__)
MODEL_PATH = Path(os.getenv("MODEL_PATH", "model/camps_xgboost.joblib"))
FEATURES = ["attendance", "ia1", "ia2", "assignmentMarks", "previousSgpa", "cgpa", "backlogs"]
model = None
if MODEL_PATH.exists():
    model = joblib.load(MODEL_PATH)


def baseline(features):
    score = (
        features["attendance"] * 0.38
        + ((features["ia1"] + features["ia2"]) / 2) * 0.25
        + features["assignmentMarks"] * 0.12
        + features["previousSgpa"] * 4
        + features["cgpa"] * 3
        - features["backlogs"] * 8
    )
    probability = max(24, min(99, round(score)))
    return probability


@app.get("/health")
def health():
    return jsonify({"ok": True, "model_loaded": model is not None, "features": FEATURES})


@app.post("/predict")
def predict():
    payload = request.get_json(silent=True) or {}
    try:
        features = {name: float(payload.get(name, 0)) for name in FEATURES}
    except (TypeError, ValueError):
        return jsonify({"message": "All prediction features must be numeric."}), 422

    if model is not None:
        vector = np.array([[features[name] for name in FEATURES]])
        probability = float(model.predict_proba(vector)[0][1] * 100)
    else:
        probability = baseline(features)
    probability = round(max(0, min(100, probability)))
    risk = "Low" if probability >= 78 else "Medium" if probability >= 58 else "High"
    return jsonify({"risk": risk, "pass_probability": probability, "model": "xgboost" if model is not None else "baseline-fallback", "features": features})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
