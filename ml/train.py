"""
Training pipeline for the academic risk-prediction model.

Workflow:
  dataset -> validation -> preprocessing -> feature engineering
  -> train/test split -> XGBoost (classifier + regressor)
  -> evaluation -> save artifacts (model.pkl, metrics.json)

Run:  python train.py
"""
import json
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    precision_score,
    r2_score,
    recall_score,
    root_mean_squared_error,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier, XGBRegressor

HERE = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(HERE, "dataset.csv")
MODEL_PATH = os.path.join(HERE, "model.pkl")
METRICS_PATH = os.path.join(HERE, "metrics.json")

FEATURES = [
    "attendance_percentage",
    "assignment_marks",
    "previous_sem_sgpa",
    "cgpa",
    "backlogs",
    "ia1",
    "ia2",
    "avg_ia",
]


def load_and_validate(path: str) -> pd.DataFrame:
    if not os.path.exists(path):
        raise SystemExit(f"Dataset not found at {path}. Run generate_dataset.py first.")
    df = pd.read_csv(path)
    missing = [c for c in FEATURES + ["risk_level", "pass_probability"] if c not in df.columns]
    if missing:
        raise SystemExit(f"Dataset is missing required columns: {missing}")
    df = df.dropna(subset=FEATURES + ["risk_level", "pass_probability"]).reset_index(drop=True)
    return df


def train():
    print("[1/5] Loading and validating dataset ...")
    df = load_and_validate(DATASET_PATH)
    print(f"      {len(df)} valid samples")

    print("[2/5] Preprocessing & feature engineering ...")
    # avg_ia engineered feature (kept in sync with dataset; recompute for safety)
    df["avg_ia"] = ((df["ia1"] + df["ia2"]) / 2.0).round(1)
    X = df[FEATURES].astype(float)

    le = LabelEncoder()
    y_cls = le.fit_transform(df["risk_level"])          # High/Medium/Low -> 0/1/2
    y_reg = df["pass_probability"].astype(float)

    print("[3/5] Train/test split (80/20, stratified) ...")
    X_tr, X_te, yc_tr, yc_te, yr_tr, yr_te = train_test_split(
        X, y_cls, y_reg, test_size=0.2, random_state=42, stratify=y_cls
    )

    print("[4/5] Training XGBoost classifier + regressor ...")
    clf = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="multi:softprob",
        num_class=len(le.classes_),
        eval_metric="mlogloss",
        random_state=42,
        n_jobs=-1,
    )
    clf.fit(X_tr, yc_tr)

    reg = XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="reg:squarederror",
        random_state=42,
        n_jobs=-1,
    )
    reg.fit(X_tr, yr_tr)

    print("[5/5] Evaluating ...")
    yc_pred = clf.predict(X_te)
    yr_pred = np.clip(reg.predict(X_te), 0, 100)

    acc = accuracy_score(yc_te, yc_pred)
    prec = precision_score(yc_te, yc_pred, average="weighted", zero_division=0)
    rec = recall_score(yc_te, yc_pred, average="weighted", zero_division=0)
    f1 = f1_score(yc_te, yc_pred, average="weighted", zero_division=0)
    cm = confusion_matrix(yc_te, yc_pred).tolist()
    report = classification_report(
        yc_te, yc_pred, target_names=list(le.classes_), zero_division=0
    )
    mae = mean_absolute_error(yr_te, yr_pred)
    rmse = root_mean_squared_error(yr_te, yr_pred)
    r2 = r2_score(yr_te, yr_pred)

    importances = clf.feature_importances_
    feature_importance = sorted(
        [{"feature": f, "importance": round(float(i), 4)} for f, i in zip(FEATURES, importances)],
        key=lambda d: d["importance"],
        reverse=True,
    )

    metrics = {
        "algorithm": "XGBoost (XGBClassifier + XGBRegressor)",
        "samples": int(len(df)),
        "train_samples": int(len(X_tr)),
        "test_samples": int(len(X_te)),
        "classes": list(le.classes_),
        "features": FEATURES,
        "classifier": {
            "accuracy": round(acc, 4),
            "precision_weighted": round(prec, 4),
            "recall_weighted": round(rec, 4),
            "f1_weighted": round(f1, 4),
            "confusion_matrix": cm,
            "report": report,
        },
        "regressor": {
            "target": "pass_probability",
            "mae": round(mae, 3),
            "rmse": round(rmse, 3),
            "r2": round(r2, 4),
        },
        "feature_importance": feature_importance,
    }

    bundle = {
        "classifier": clf,
        "regressor": reg,
        "label_encoder": le,
        "features": FEATURES,
        "metrics": metrics,
    }
    joblib.dump(bundle, MODEL_PATH)
    with open(METRICS_PATH, "w") as fh:
        json.dump(metrics, fh, indent=2)

    print(f"      Classification accuracy : {acc:.4f}")
    print(f"      Weighted F1             : {f1:.4f}")
    print(f"      Pass-prob R2            : {r2:.4f}  (RMSE {rmse:.2f})")
    print(f"Artifacts saved -> {MODEL_PATH}, {METRICS_PATH}")


if __name__ == "__main__":
    train()
