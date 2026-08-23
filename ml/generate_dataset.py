"""
Synthetic academic dataset generator.

Generates a realistic labeled dataset for training the XGBoost
risk-prediction model. The label logic encodes common academic
intuition (attendance, IA performance, CGPA and backlogs drive risk)
with controlled noise so the model learns a generalizable boundary.
"""
import numpy as np
import pandas as pd

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

LABELS = ["Low", "Medium", "High"]


def generate(n: int = 2500, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    n_samples = n

    # Latent "academic strength" of a student drives correlated features.
    strength = rng.normal(0.68, 0.17, n_samples)  # 0..1 ish

    def clamp(x, lo, hi):
        return np.clip(x, lo, hi)

    attendance = clamp(rng.normal(strength * 100, 10), 20, 100)
    ia1 = clamp(rng.normal(strength * 50, 7), 5, 50)        # out of 50
    ia2 = clamp(ia1 + rng.normal(1.5, 5), 5, 50)            # out of 50
    avg_ia = (ia1 + ia2) / 2.0
    assignments = clamp(rng.normal(strength * 10, 1.4), 0, 10)  # out of 10
    prev_sgpa = clamp(rng.normal(strength * 10, 0.9), 3.0, 10.0)
    cgpa = clamp(prev_sgpa + rng.normal(0.15, 0.45), 3.0, 10.0)
    backlogs = np.clip(
        rng.poisson(np.clip((1 - strength) * 3.2, 0.05, 5)), 0, 8
    )

    # Composite success score -> pass probability (with noise).
    score = (
        0.15
        + 0.24 * (attendance / 100)
        + 0.16 * (avg_ia / 50)
        + 0.12 * (assignments / 10)
        + 0.20 * (cgpa / 10)
        + 0.16 * (prev_sgpa / 10)
        - 0.12 * np.clip(backlogs, 0, 5) / 5
    )
    score += rng.normal(0, 0.035, n_samples)
    pass_probability = np.clip(score * 100, 3.0, 99.5)

    risk = np.where(
        pass_probability < 55, "High",
        np.where(pass_probability < 75, "Medium", "Low"),
    )

    df = pd.DataFrame(
        {
            "attendance_percentage": np.round(attendance, 1),
            "assignment_marks": np.round(assignments, 1),
            "previous_sem_sgpa": np.round(prev_sgpa, 2),
            "cgpa": np.round(cgpa, 2),
            "backlogs": backlogs.astype(int),
            "ia1": np.round(ia1, 1),
            "ia2": np.round(ia2, 1),
            "avg_ia": np.round(avg_ia, 1),
            "pass_probability": np.round(pass_probability, 2),
            "risk_level": risk,
        }
    )
    return df


if __name__ == "__main__":
    df = generate()
    df.to_csv("dataset.csv", index=False)
    print(f"dataset.csv written: {df.shape[0]} rows x {df.shape[1]} cols")
    print(df["risk_level"].value_counts().to_string())
