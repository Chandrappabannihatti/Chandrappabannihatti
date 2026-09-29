"""CAMPS Average Academic Performance prediction service.

An optional joblib XGBoost model can be mounted at MODEL_PATH. The service
always builds its vector from exactly five inputs; Current GPA is intentionally
stored by CAMPS but is never part of this model contract.
"""
import os
from pathlib import Path

from flask import Flask, jsonify, request
import joblib
import numpy as np

app = Flask(__name__)
MODEL_PATH = Path(os.getenv("MODEL_PATH", "model/camps_xgboost.joblib"))
FEATURES = [
    "attendancePercentage",
    "averageInternalMarks",
    "averageAssignmentScore",
    "previousGpa",
    "participationScore",
]
RANGES = {
    "attendancePercentage": (0, 100),
    "averageInternalMarks": (0, 100),
    "averageAssignmentScore": (0, 100),
    "previousGpa": (0, 10),
    "participationScore": (0, 100),
}
model = None
if MODEL_PATH.exists():
    model = joblib.load(MODEL_PATH)


def academic_score(features):
    return (
        features["attendancePercentage"] * 0.30
        + features["averageInternalMarks"] * 0.25
        + features["averageAssignmentScore"] * 0.15
        + (features["previousGpa"] / 10) * 15
        + features["participationScore"] * 0.15
    )


def classify(score):
    result = "Pass" if score >= 60 else "Fail"
    risk = "Low Risk" if score >= 75 else "Medium Risk" if score >= 55 else "High Risk"
    return result, risk


@app.get("/health")
def health():
    return jsonify({"ok": True, "model_loaded": model is not None, "inputs": FEATURES, "outputs": ["result", "risk"]})


@app.post("/predict")
def predict():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"message": "Prediction input must be a JSON object with exactly five model inputs."}), 422
    unexpected = sorted(set(payload) - set(FEATURES))
    if unexpected:
        return jsonify({"message": f"Only these five model inputs are accepted; remove: {', '.join(unexpected)}."}), 422
    missing = [name for name in FEATURES if name not in payload or payload[name] in (None, "")]
    if missing:
        return jsonify({"message": f"These five model inputs are required: {', '.join(missing)}."}), 422
    try:
        features = {name: float(payload[name]) for name in FEATURES}
    except (TypeError, ValueError):
        return jsonify({"message": "All five Average Academic Performance inputs must be numeric."}), 422
    invalid = [name for name, value in features.items() if not np.isfinite(value) or not (RANGES[name][0] <= value <= RANGES[name][1])]
    if invalid:
        return jsonify({"message": f"Invalid model input: {', '.join(invalid)}."}), 422

    if model is not None:
        vector = np.array([[features[name] for name in FEATURES]])
        score = float(model.predict_proba(vector)[0][1] * 100)
        model_name = "xgboost"
    else:
        score = academic_score(features)
        model_name = "baseline-fallback"
    score = round(max(0, min(100, score)), 2)
    result, risk = classify(score)
    return jsonify({"result": result, "risk": risk, "model": model_name, "inputs": features})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
