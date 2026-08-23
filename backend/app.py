import os

from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from extensions import db, jwt


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    CORS(app, resources={r"/api/*": {"origins": "*"}})
    db.init_app(app)
    jwt.init_app(app)

    from routes.admin import admin_bp
    from routes.auth import auth_bp
    from routes.ml_routes import ml_bp
    from routes.parent import parent_bp
    from routes.student import student_bp
    from routes.teacher import teacher_bp

    for bp in (auth_bp, admin_bp, teacher_bp, student_bp, parent_bp, ml_bp):
        app.register_blueprint(bp)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "CAMPS API"})

    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(500)
    def server_error(exc):
        return jsonify({"error": "Internal server error", "detail": str(exc)}), 500

    @jwt.unauthorized_loader
    def missing_token(reason):
        app.logger.warning("JWT rejected request: %s", reason)
        return jsonify({"error": "Missing or invalid token", "detail": reason}), 401

    @jwt.invalid_token_loader
    def invalid_token(reason):
        app.logger.warning("JWT invalid: %s", reason)
        return jsonify({"error": "Invalid token", "detail": reason}), 401

    @jwt.expired_token_loader
    def expired_token(jwt_header, jwt_payload):
        return jsonify({"error": "Token has expired"}), 401

    with app.app_context():
        db.create_all()

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
