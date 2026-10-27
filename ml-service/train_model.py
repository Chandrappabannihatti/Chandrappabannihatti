"""Train and save the CAMPS XGBoost classifier for later evaluation.

This command intentionally refuses to train when the dataset contains only one
class. The bundled workbook is an academic roster without observed outcomes,
so it should be treated as an audit input until a real Result/Outcome column is
provided.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
from xgboost import XGBClassifier

from evaluate_model import FEATURES, load_dataset, split_frame


def main() -> None:
    parser = argparse.ArgumentParser(description="Train a CAMPS XGBoost classifier on an observed labelled dataset.")
    parser.add_argument("--dataset", type=Path, default=Path("public/cse-semester-1-section-a-1000-students.xlsx"))
    parser.add_argument("--model", type=Path, default=Path("ml-service/model/camps_xgboost.joblib"))
    parser.add_argument("--test-size", type=float, default=0.20)
    parser.add_argument("--random-state", type=int, default=42)
    args = parser.parse_args()

    frame, metadata = load_dataset(args.dataset)
    if frame["target"].nunique() < 2:
        raise SystemExit(
            "Training stopped: the dataset contains only one target class. "
            "Add observed Pass and Fail outcomes before training a classifier."
        )
    if metadata["targetIsProxy"]:
        raise SystemExit(
            "Training stopped: the dataset has no observed target column. "
            "Add a Result/Outcome column instead of training on a formula-derived proxy."
        )

    train, _ = split_frame(frame, args.test_size, args.random_state)
    model = XGBClassifier(
        n_estimators=240,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        min_child_weight=2,
        reg_alpha=0.1,
        reg_lambda=1.0,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=args.random_state,
        n_jobs=1,
    )
    model.fit(train[FEATURES], train["target"])
    args.model.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, args.model)
    metadata_path = args.model.with_suffix(".metadata.json")
    metadata_path.write_text(json.dumps({"features": FEATURES, "dataset": metadata, "trainRows": len(train), "randomState": args.random_state}, indent=2), encoding="utf-8")
    print(f"Saved trained model to {args.model}")
    print(f"Saved metadata to {metadata_path}")


if __name__ == "__main__":
    main()
