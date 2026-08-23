from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from services import ml_service
from services.helpers import error

ml_bp = Blueprint("ml", __name__, url_prefix="/api/ml")


@ml_bp.post("/predict")
@jwt_required()
def predict():
    data = request.get_json(silent=True) or {}
    features = {
        "attendance_percentage": data.get("attendance_percentage"),
        "assignment_marks": data.get("assignment_marks"),
        "previous_sem_sgpa": data.get("previous_sem_sgpa"),
        "cgpa": data.get("cgpa"),
        "backlogs": data.get("backlogs", 0),
        "ia1": data.get("ia1"),
        "ia2": data.get("ia2"),
    }
    missing = [k for k, v in features.items() if v is None]
    if missing:
        return error(f"Missing features: {', '.join(missing)}", 400)
    try:
        features = {k: float(v) for k, v in features.items()}
    except (TypeError, ValueError):
        return error("All features must be numeric", 400)
    features["avg_ia"] = round((features["ia1"] + features["ia2"]) / 2.0, 1)

    result = ml_service.predict(features)
    if result.get("error"):
        return error(result["error"], 503)
    result["features"] = features
    return jsonify(result)


@ml_bp.get("/feature-importance")
@jwt_required()
def feature_importance():
    metrics = ml_service.load_metrics()
    return jsonify(
        {
            "feature_importance": metrics.get("feature_importance", []),
            "algorithm": metrics.get("algorithm"),
        }
    )


@ml_bp.get("/model-metrics")
@jwt_required()
def model_metrics():
    metrics = ml_service.load_metrics()
    if not metrics:
        return error("Model not trained yet. Run ml/train.py", 503)
    return jsonify(metrics)
