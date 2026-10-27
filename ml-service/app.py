"""CAMPS Average Academic Performance prediction service.

An optional joblib XGBoost model can be mounted at MODEL_PATH. The service
always builds its vector from exactly five inputs; Current GPA is intentionally
stored by CAMPS but is never part of this model contract. A missing, invalid or
contract-incompatible artifact is reported as unavailable and uses the same
explicit deterministic fallback rather than being presented as XGBoost.
"""
import os
from pathlib import Path

from flask import Flask, jsonify, request
import joblib
import numpy as np

app = Flask(__name__)
DEFAULT_MODEL_PATH = Path(__file__).resolve().parent / "model" / "camps_xgboost.joblib"
MODEL_PATH = Path(os.getenv("MODEL_PATH", str(DEFAULT_MODEL_PATH)))
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
model_error = None
model_feature_order = None

if MODEL_PATH.exists():
    try:
        loaded = joblib.load(MODEL_PATH)
        model = loaded.get("model") if isinstance(loaded, dict) and "model" in loaded else loaded
        if not hasattr(model, "predict_proba"):
            raise ValueError("the loaded artifact does not expose predict_proba()")
        declared_features = getattr(model, "feature_names_in_", None)
        if declared_features is not None:
            model_feature_order = [str(name) for name in declared_features]
            if model_feature_order != FEATURES:
                raise ValueError(f"feature order mismatch: expected {FEATURES}, got {model_feature_order}")
        else:
            # The included trainer uses this exact positional contract. An
            # estimator without feature_names_in_ is accepted only under that
            # documented contract, and health makes the source explicit.
            model_feature_order = FEATURES.copy()
    except Exception as error:  # pragma: no cover - depends on an external artifact
        model = None
        model_feature_order = None
        model_error = type(error).__name__
else:
    model_error = "model_not_found"


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


def positive_class_index(classes):
    """Return the column representing Pass, or None for an unsafe contract."""
    if classes is None:
        return 1
    values = list(classes)
    matches = []
    for index, value in enumerate(values):
        text = str(value).strip().lower()
        if text in {"pass", "passed", "1", "true", "yes"}:
            matches.append(index)
    if len(matches) == 1:
        return matches[0]
    return None


@app.get("/health")
def health():
    return jsonify({
        "ok": True,
        "model_loaded": model is not None,
        "model_path_configured": str(MODEL_PATH),
        "model_error": model_error,
        "feature_order": model_feature_order,
        "feature_order_verified": model is not None and getattr(model, "feature_names_in_", None) is not None,
        "inputs": FEATURES,
        "outputs": ["result", "risk"],
    })


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
        try:
            vector = np.array([[features[name] for name in FEATURES]])
            probabilities = np.asarray(model.predict_proba(vector))
            classes = getattr(model, "classes_", None)
            positive_index = positive_class_index(classes)
            if probabilities.ndim != 2 or probabilities.shape[0] != 1 or positive_index is None or positive_index >= probabilities.shape[1]:
                return jsonify({"message": "The mounted model did not return a usable Pass probability."}), 503
            score = float(probabilities[0][positive_index] * 100)
        except Exception:
            return jsonify({"message": "The mounted model could not produce a prediction."}), 503
        model_name = "xgboost"
    else:
        score = academic_score(features)
        model_name = "deterministic-fallback"
    score = round(max(0, min(100, score)), 2)
    result, risk = classify(score)
    return jsonify({"result": result, "risk": risk, "model": model_name, "inputs": features})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
