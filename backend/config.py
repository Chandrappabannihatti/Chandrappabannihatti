import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(BASE_DIR)


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "camps-dev-secret")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "camps-jwt-dev-secret")
    JWT_ACCESS_TOKEN_EXPIRES = 60 * 60 * 12  # 12 hours

    # ------------------------------------------------------------------
    # Database
    #   Demo / default : SQLite (zero setup)
    #   Production     : set DATABASE_URL, e.g.
    #   mysql+pymysql://root:password@localhost:3306/academic_monitoring
    #   (schema + demo data for MySQL live in database/schema.sql and
    #    database/dummy_data.sql)
    # ------------------------------------------------------------------
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "sqlite:///" + os.path.join(REPO_ROOT, "database", "app.db"),
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
    MAX_CONTENT_LENGTH = 8 * 1024 * 1024  # 8 MB uploads
    ML_MODEL_PATH = os.path.join(REPO_ROOT, "ml", "model.pkl")
    ML_METRICS_PATH = os.path.join(REPO_ROOT, "ml", "metrics.json")
