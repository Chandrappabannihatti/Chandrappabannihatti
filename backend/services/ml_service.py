"""
ML service: loads the XGBoost bundle (ml/model.pkl) and turns
database rows for a student into the model's feature vector.
"""
import json
import os

import joblib
import numpy as np
from flask import current_app
from sqlalchemy import func

from extensions import db
from models import (
    Assignment,
    Attendance,
    Backlog,
    IAMarks,
    MLPrediction,
    SemesterResult,
    Student,
)

_bundle = None


def _load_bundle():
    global _bundle
    if _bundle is None:
        path = current_app.config["ML_MODEL_PATH"] if current_app else os.environ.get(
            "ML_MODEL_PATH"
        )
        if not os.path.exists(path):
            return None
        _bundle = joblib.load(path)
    return _bundle


def reset_bundle():
    global _bundle
    _bundle = None


def load_metrics() -> dict:
    path = current_app.config["ML_METRICS_PATH"]
    if not os.path.exists(path):
        return {}
    with open(path) as fh:
        return json.load(fh)


# ----------------------------------------------------------------------
# Feature engineering from the relational database
# ----------------------------------------------------------------------
def build_features(student: Student) -> dict:
    att = (
        db.session.query(
            func.sum(Attendance.classes_held), func.sum(Attendance.classes_attended)
        )
        .filter(Attendance.student_id == student.id)
        .first()
    )
    held, attended = att[0] or 0, att[1] or 0
    attendance_pct = round(100 * attended / held, 1) if held else 0.0

    ia = (
        db.session.query(func.avg(IAMarks.ia1), func.avg(IAMarks.ia2))
        .filter(IAMarks.student_id == student.id)
        .first()
    )
    ia1, ia2 = round(ia[0] or 0, 1), round(ia[1] or 0, 1)

    assignment_avg = (
        db.session.query(func.avg(Assignment.marks))
        .filter(Assignment.student_id == student.id)
        .scalar()
    ) or 0.0

    results = (
        SemesterResult.query.filter_by(student_id=student.id)
        .order_by(SemesterResult.semester)
        .all()
    )
    if results:
        cgpa = round(sum(r.sgpa for r in results) / len(results), 2)
        prev = [r for r in results if r.semester < student.semester]
        prev_sgpa = prev[-1].sgpa if prev else results[-1].sgpa
    else:
        cgpa, prev_sgpa = 0.0, 0.0

    backlogs = Backlog.query.filter_by(student_id=student.id, status="active").count()

    return {
        "attendance_percentage": attendance_pct,
        "assignment_marks": round(assignment_avg, 1),
        "previous_sem_sgpa": round(float(prev_sgpa), 2),
        "cgpa": round(float(cgpa), 2),
        "backlogs": int(backlogs),
        "ia1": ia1,
        "ia2": ia2,
        "avg_ia": round((ia1 + ia2) / 2.0, 1),
    }


# ----------------------------------------------------------------------
# Prediction
# ----------------------------------------------------------------------
def predict(features: dict) -> dict:
    bundle = _load_bundle()
    if bundle is None:
        return {
            "risk_level": None,
            "pass_probability": None,
            "error": "Model not trained yet. Run ml/train.py",
        }
    feats = bundle["features"]
    X = np.array([[float(features.get(f, 0)) for f in feats]], dtype=float)

    proba = bundle["classifier"].predict_proba(X)[0]
    idx = int(np.argmax(proba))
    risk_level = str(bundle["label_encoder"].inverse_transform([idx])[0])
    pass_probability = float(np.clip(bundle["regressor"].predict(X)[0], 0, 100))

    return {
        "risk_level": risk_level,
        "pass_probability": round(pass_probability, 1),
        "confidence": round(float(proba[idx]) * 100, 1),
        "class_probabilities": {
            str(cls): round(float(p) * 100, 1)
            for cls, p in zip(bundle["label_encoder"].classes_, proba)
        },
    }


def predict_for_student(student: Student, store: bool = True) -> dict:
    """Build features from DB, run model, persist to ml_predictions."""
    features = build_features(student)
    result = predict(features)
    if result.get("risk_level") and store:
        pred = MLPrediction(
            student_id=student.id,
            semester=student.semester,
            risk_level=result["risk_level"],
            pass_probability=result["pass_probability"],
            confidence=result.get("confidence"),
            features_json=json.dumps(features),
        )
        db.session.add(pred)
        db.session.commit()
    result["features"] = features
    return result


def latest_prediction(student_id: int):
    return (
        MLPrediction.query.filter_by(student_id=student_id)
        .order_by(MLPrediction.id.desc())
        .first()
    )


def latest_predictions_map(student_ids):
    """{student_id: MLPrediction} — latest prediction per student."""
    if not student_ids:
        return {}
    sub = (
        db.session.query(func.max(MLPrediction.id).label("max_id"))
        .filter(MLPrediction.student_id.in_(student_ids))
        .group_by(MLPrediction.student_id)
        .subquery()
    )
    preds = MLPrediction.query.join(sub, MLPrediction.id == sub.c.max_id).all()
    return {p.student_id: p for p in preds}


def latest_risk_distribution():
    """Latest prediction per student across the whole institution."""
    sub = (
        db.session.query(func.max(MLPrediction.id).label("max_id"))
        .group_by(MLPrediction.student_id)
        .subquery()
    )
    preds = MLPrediction.query.join(sub, MLPrediction.id == sub.c.max_id).all()
    dist = {"Low": 0, "Medium": 0, "High": 0}
    for p in preds:
        dist[p.risk_level] = dist.get(p.risk_level, 0) + 1
    return dist, dist.get("High", 0)
