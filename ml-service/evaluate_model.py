"""Evaluate the CAMPS XGBoost model on an 80/20 holdout.

The evaluator is deliberately conservative: it never invents a production
accuracy score when the workbook has no outcome column or when the trained
model is missing. The bundled upload workbook is a roster of academic inputs,
not a labelled modelling dataset. In that case the generated report is an
audit-only report and calls out the proxy-label/data-quality limitation.

Usage:
    python ml-service/evaluate_model.py \
      --dataset public/cse-semester-1-section-a-1000-students.xlsx \
      --model ml-service/model/camps_xgboost.joblib \
      --output ml-service/evaluation_report.json
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split

FEATURES = [
    "attendancePercentage",
    "averageInternalMarks",
    "averageAssignmentScore",
    "previousGpa",
    "participationScore",
]
FEATURE_ALIASES = {
    "attendancePercentage": ["attendancePercentage", "Attendance Percentage", "attendance", "attendance_percentage"],
    "averageInternalMarks": ["averageInternalMarks", "Average Internal Marks", "ia1", "ia2", "average_internal_marks"],
    "averageAssignmentScore": ["averageAssignmentScore", "Average Assignment Score", "assignment_marks", "average_assignment_score"],
    "previousGpa": ["previousGpa", "Previous GPA", "previous_sgpa", "previous_gpa"],
    "participationScore": ["participationScore", "Participation Score", "participation_score"],
}
TARGET_ALIASES = [
    "result",
    "Result",
    "outcome",
    "Outcome",
    "label",
    "Label",
    "target",
    "Target",
    "pass_fail",
    "Pass Fail",
    "prediction",
]
ID_ALIASES = ["USN", "usn", "student_id", "studentId", "id"]


def normalized(value: Any) -> str:
    return "".join(character.lower() for character in str(value) if character.isalnum())


def find_column(columns: list[Any], aliases: list[str]) -> str | None:
    lookup = {normalized(column): str(column) for column in columns}
    for alias in aliases:
        if normalized(alias) in lookup:
            return lookup[normalized(alias)]
    return None


def score_proxy(frame: pd.DataFrame) -> pd.Series:
    """The same five-input transparent fallback used by CAMPS.

    This is only a proxy target when the supplied data has no observed result.
    It must never be presented as measured student outcome data.
    """

    return (
        frame["attendancePercentage"] * 0.30
        + frame["averageInternalMarks"] * 0.25
        + frame["averageAssignmentScore"] * 0.15
        + (frame["previousGpa"] / 10) * 15
        + frame["participationScore"] * 0.15
    )


def encode_target(value: Any) -> int | None:
    if pd.isna(value):
        return None
    if isinstance(value, str):
        value = value.strip().lower()
        if value in {"pass", "passed", "1", "true", "yes", "low risk", "medium risk"}:
            return 1
        if value in {"fail", "failed", "0", "false", "no", "high risk"}:
            return 0
    try:
        number = float(value)
        if number in (0, 1):
            return int(number)
    except (TypeError, ValueError):
        pass
    return None


def load_dataset(dataset_path: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    if dataset_path.suffix.lower() == ".csv":
        source = pd.read_csv(dataset_path)
    else:
        source = pd.read_excel(dataset_path, sheet_name=0)

    metadata: dict[str, Any] = {
        "path": str(dataset_path),
        "rowsBeforeCleaning": int(len(source)),
        "columns": int(len(source.columns)),
        "featureColumns": {},
    }

    feature_columns: dict[str, str] = {}
    missing = []
    for feature, aliases in FEATURE_ALIASES.items():
        column = find_column(list(source.columns), aliases)
        if column is None:
            missing.append(feature)
        else:
            feature_columns[feature] = column
    if missing:
        raise ValueError(f"Dataset is missing required feature columns: {', '.join(missing)}")
    metadata["featureColumns"] = feature_columns

    frame = pd.DataFrame({feature: pd.to_numeric(source[column], errors="coerce") for feature, column in feature_columns.items()})
    for feature, (minimum, maximum) in {
        "attendancePercentage": (0, 100),
        "averageInternalMarks": (0, 100),
        "averageAssignmentScore": (0, 100),
        "previousGpa": (0, 10),
        "participationScore": (0, 100),
    }.items():
        frame.loc[(frame[feature] < minimum) | (frame[feature] > maximum), feature] = np.nan

    target_column = find_column(list(source.columns), TARGET_ALIASES)
    metadata["targetColumn"] = target_column
    metadata["targetSource"] = "observed_dataset_column" if target_column else "missing_proxy_only"
    metadata["targetIsProxy"] = target_column is None

    if target_column:
        frame["target"] = source[target_column].map(encode_target)
    else:
        frame["proxyScore"] = score_proxy(frame)
        frame["target"] = (frame["proxyScore"] >= 60).astype("float64")

    id_column = find_column(list(source.columns), ID_ALIASES)
    metadata["idColumn"] = id_column
    if id_column:
        frame["recordId"] = source[id_column].astype(str)

    before_drop = len(frame)
    frame = frame.dropna(subset=FEATURES + ["target"]).copy()
    frame["target"] = frame["target"].astype(int)
    metadata["rowsDroppedForInvalidValues"] = int(before_drop - len(frame))

    duplicate_subset = FEATURES + ["target"]
    duplicate_feature_count = int(frame.duplicated(subset=duplicate_subset, keep=False).sum())
    duplicate_feature_rows_removed = int(frame.duplicated(subset=duplicate_subset, keep="first").sum())
    duplicate_id_count = 0
    duplicate_id_rows_removed = 0
    if "recordId" in frame:
        duplicate_id_count = int(frame.duplicated(subset=["recordId"], keep=False).sum())
        duplicate_id_rows_removed = int(frame.duplicated(subset=["recordId"], keep="first").sum())
        # A repeated USN is the same learner record even if an input value was
        # edited. Keep one representative before the holdout split.
        frame = frame.drop_duplicates(subset=["recordId"], keep="first")
    metadata["duplicateFeatureTargetRows"] = duplicate_feature_count
    metadata["duplicateIdRows"] = duplicate_id_count
    metadata["duplicateRowsRemovedBeforeSplit"] = duplicate_feature_rows_removed + duplicate_id_rows_removed
    # Exact duplicate feature/target rows can leak across a random split. Keep
    # one representative so the reported holdout is conservative.
    frame = frame.drop_duplicates(subset=duplicate_subset, keep="first").reset_index(drop=True)
    metadata["rowsAfterCleaning"] = int(len(frame))
    metadata["classDistribution"] = {"Fail": int((frame["target"] == 0).sum()), "Pass": int((frame["target"] == 1).sum())}
    return frame, metadata


def safe_metric(function, *args, **kwargs) -> float | None:
    try:
        value = float(function(*args, **kwargs))
        return None if math.isnan(value) else round(value, 6)
    except (ValueError, ZeroDivisionError):
        return None


def counts(values: np.ndarray) -> dict[str, int]:
    return {"Fail": int((values == 0).sum()), "Pass": int((values == 1).sum())}


def metric_bundle(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float | None]:
    return {
        "accuracy": safe_metric(accuracy_score, actual, predicted),
        "precision": safe_metric(precision_score, actual, predicted, zero_division=np.nan),
        "recall": safe_metric(recall_score, actual, predicted, zero_division=np.nan),
        "f1": safe_metric(f1_score, actual, predicted, zero_division=np.nan),
    }


def percentage(value: float | None) -> float | None:
    return None if value is None else round(value * 100, 2)


def as_percent_metrics(metrics: dict[str, float | None] | None) -> dict[str, float | None] | None:
    if metrics is None:
        return None
    return {key: percentage(value) for key, value in metrics.items()}


def split_frame(frame: pd.DataFrame, test_size: float, random_state: int):
    stratify = frame["target"] if frame["target"].nunique() > 1 and frame["target"].value_counts().min() >= 2 else None
    return train_test_split(frame, test_size=test_size, random_state=random_state, stratify=stratify)


def audit_report(frame: pd.DataFrame, metadata: dict[str, Any], model_path: Path, test_size: float, random_state: int, message: str | None = None) -> dict[str, Any]:
    _, test = split_frame(frame, test_size, random_state)
    actual_distribution = counts(test["target"].to_numpy())
    class_counts = frame["target"].value_counts()
    majority_accuracy = float(class_counts.max() / len(frame)) if len(frame) else None
    warnings = []
    if metadata["targetIsProxy"]:
        warnings.append("No observed Pass/Fail target exists in the workbook; labels are only the CAMPS fallback proxy and cannot support a real-world performance claim.")
    if metadata["classDistribution"]["Fail"] == 0 or metadata["classDistribution"]["Pass"] == 0:
        warnings.append("The available dataset contains only one target class. Precision, recall, F1, and a two-class confusion matrix are not meaningful.")
    if metadata["duplicateFeatureTargetRows"] or metadata["duplicateIdRows"]:
        warnings.append("Duplicate feature/target rows or student IDs were detected and deduplicated before splitting to reduce train/test leakage.")
    if message:
        warnings.append(message)
    return {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "status": "audit_only",
        "modelLoaded": False,
        "modelPath": str(model_path),
        "modelName": "XGBoost classifier (not available)",
        "positiveClass": "Pass",
        "split": {"testSize": test_size, "randomState": random_state, "trainRatio": round(1 - test_size, 2), "testRows": int(len(test)), "trainRows": int(len(frame) - len(test))},
        "dataset": metadata,
        "metrics": None,
        "trainMetrics": None,
        "confusionMatrix": None,
        "distributions": {"actualTest": actual_distribution, "predictedTest": None},
        "accuracyComparison": [{"name": "XGBoost", "accuracy": None}, {"name": "Majority baseline", "accuracy": percentage(majority_accuracy)}],
        "fitAssessment": "Overfitting and underfitting cannot be assessed until an observed two-class target and a trained model are available.",
        "checks": {"accuracyIs100": False, "duplicateRows": metadata["duplicateFeatureTargetRows"] + metadata["duplicateIdRows"], "trainTestOverlap": None, "targetLeakageConcern": metadata["targetIsProxy"], "classImbalance": True if len(class_counts) < 2 else bool(class_counts.min() / class_counts.max() < 0.5)},
        "warnings": warnings,
        "analysis": ["A trained model was not evaluated. Supply a labelled dataset with observed Pass/Fail outcomes and a trained XGBoost joblib artifact.", "The majority baseline is shown only to make the dataset imbalance visible."],
        "recommendations": ["Add an observed target column such as Result or Outcome; do not use the same formula to create both labels and model predictions.", "Collect enough Fail examples and evaluate with stratification or repeated cross-validation.", "Keep identifiers out of model features and deduplicate records before splitting.", "Report class-wise precision, recall, F1, and balanced accuracy rather than accuracy alone."],
        "summary": "Evaluation is blocked because the repository currently contains a roster workbook without observed labels and no trained model artifact.",
    }


def evaluate(dataset_path: Path, model_path: Path, output_path: Path, test_size: float, random_state: int) -> dict[str, Any]:
    frame, metadata = load_dataset(dataset_path)
    if not model_path.exists():
        report = audit_report(frame, metadata, model_path, test_size, random_state, f"Model file not found at {model_path}.")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        return report

    loaded = joblib.load(model_path)
    model = loaded.get("model") if isinstance(loaded, dict) and "model" in loaded else loaded
    if not hasattr(model, "predict"):
        raise TypeError("The loaded artifact does not expose predict(). Expected a trained XGBoost classifier or compatible estimator.")

    train, test = split_frame(frame, test_size, random_state)
    x_train, y_train = train[FEATURES], train["target"].to_numpy()
    x_test, y_test = test[FEATURES], test["target"].to_numpy()
    predicted_train = np.asarray(model.predict(x_train)).astype(int)
    predicted_test = np.asarray(model.predict(x_test)).astype(int)
    train_metrics = metric_bundle(y_train, predicted_train)
    test_metrics = metric_bundle(y_test, predicted_test)
    matrix = confusion_matrix(y_test, predicted_test, labels=[0, 1]).tolist()
    class_counts = frame["target"].value_counts()
    majority_accuracy = float(class_counts.max() / len(frame)) if len(frame) else None
    train_signatures = {tuple(row) for row in x_train.to_numpy().tolist()}
    test_signatures = {tuple(row) for row in x_test.to_numpy().tolist()}
    overlap = len(train_signatures & test_signatures)
    gap = None if train_metrics["accuracy"] is None or test_metrics["accuracy"] is None else round(train_metrics["accuracy"] - test_metrics["accuracy"], 6)
    warnings = []
    if metadata["targetIsProxy"]:
        warnings.append("The target was derived from the CAMPS fallback score because the dataset has no observed outcome column; this is not a production validation.")
    if test_metrics["accuracy"] == 1:
        warnings.append("Test accuracy is 100%. Check the target definition, duplicate records, identifiers, feature leakage, and the train/test split before presenting this as generalisation performance.")
    if overlap:
        warnings.append(f"{overlap} exact feature rows occur in both train and test partitions.")
    if metadata["duplicateFeatureTargetRows"] or metadata["duplicateIdRows"]:
        warnings.append("Duplicate feature/target rows or student IDs were detected before the split.")
    if len(class_counts) < 2:
        warnings.append("Only one target class is present; class-wise metrics are undefined and the model cannot learn a meaningful boundary.")

    if gap is not None and gap > 0.10:
        fit_assessment = "Possible overfitting: training accuracy is more than 10 percentage points above test accuracy."
    elif train_metrics["accuracy"] is not None and test_metrics["accuracy"] is not None and train_metrics["accuracy"] < 0.70 and test_metrics["accuracy"] < 0.70:
        fit_assessment = "Possible underfitting: both training and test accuracy are low."
    else:
        fit_assessment = "No strong overfitting signal from the accuracy gap alone; validate with cross-validation and class-wise metrics."

    report = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "status": "evaluated",
        "modelLoaded": True,
        "modelPath": str(model_path),
        "modelName": type(model).__name__,
        "positiveClass": "Pass",
        "features": FEATURES,
        "split": {"testSize": test_size, "randomState": random_state, "trainRatio": round(1 - test_size, 2), "testRows": int(len(test)), "trainRows": int(len(train))},
        "dataset": metadata,
        "metrics": as_percent_metrics(test_metrics),
        "trainMetrics": as_percent_metrics(train_metrics),
        "confusionMatrix": {"labels": ["Fail", "Pass"], "values": matrix},
        "distributions": {"actualTest": counts(y_test), "predictedTest": counts(predicted_test)},
        "accuracyComparison": [{"name": "XGBoost", "accuracy": percentage(test_metrics["accuracy"])}, {"name": "Majority baseline", "accuracy": percentage(majority_accuracy)}],
        "fitAssessment": fit_assessment,
        "checks": {"accuracyIs100": test_metrics["accuracy"] == 1, "duplicateRows": metadata["duplicateFeatureTargetRows"] + metadata["duplicateIdRows"], "trainTestOverlap": overlap, "targetLeakageConcern": metadata["targetIsProxy"] or bool(overlap), "classImbalance": bool(len(class_counts) < 2 or class_counts.min() / class_counts.max() < 0.5)},
        "warnings": warnings,
        "analysis": [fit_assessment, f"Generalisation gap: {percentage(gap)} percentage points." if gap is not None else "Generalisation gap could not be calculated.", "Precision measures how many predicted Pass cases were actually Pass; recall measures how many actual Pass cases were found; F1 balances both; accuracy is the overall correct-classification rate."],
        "recommendations": ["Use a genuinely observed Pass/Fail outcome rather than a formula-derived proxy.", "Use stratified repeated cross-validation and report confidence intervals.", "Balance the target classes with collection, class weights, or careful resampling.", "Keep USN and other identifiers out of features and deduplicate before splitting.", "Tune depth, learning rate, estimators, subsampling, and regularisation using validation data only."],
        "summary": "Model performance was calculated on an unseen 20% holdout; review the warnings before using the numbers in a report." if not metadata["targetIsProxy"] else "Metrics were calculated against a proxy target and must not be presented as real-world model performance.",
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate a trained CAMPS XGBoost model with an 80/20 holdout.")
    parser.add_argument("--dataset", type=Path, default=Path("public/cse-semester-1-section-a-1000-students.xlsx"))
    parser.add_argument("--model", type=Path, default=Path("ml-service/model/camps_xgboost.joblib"))
    parser.add_argument("--output", type=Path, default=Path("ml-service/evaluation_report.json"))
    parser.add_argument("--test-size", type=float, default=0.20)
    parser.add_argument("--random-state", type=int, default=42)
    args = parser.parse_args()
    report = evaluate(args.dataset, args.model, args.output, args.test_size, args.random_state)
    print(json.dumps({"status": report["status"], "modelLoaded": report["modelLoaded"], "metrics": report["metrics"], "dataset": report["dataset"]}, indent=2))


if __name__ == "__main__":
    main()
