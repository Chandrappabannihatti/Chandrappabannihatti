from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, jwt_required

from extensions import db
from models import Notification, User
from services.helpers import current_user, error

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return error("Email and password are required", 400)

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if user is None or not user.check_password(password):
        return error("Invalid email or password", 401)
    if not user.is_active:
        return error("Account is disabled", 403)

    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role.name, "name": user.name},
    )
    return jsonify({"access_token": token, "user": user.public_dict()})


@auth_bp.get("/me")
@jwt_required()
def me():
    user = current_user()
    if user is None:
        return error("User not found", 404)
    return jsonify({"user": user.public_dict()})


@auth_bp.post("/logout")
@jwt_required()
def logout():
    # Stateless JWT: the client discards the token. Endpoint exists so the
    # frontend can call it and to allow future token block-listing.
    return jsonify({"message": "Logged out successfully"})


@auth_bp.get("/notifications")
@jwt_required()
def notifications():
    user = current_user()
    items = (
        Notification.query.filter_by(user_id=user.id)
        .order_by(Notification.created_at.desc())
        .limit(20)
        .all()
    )
    unread = Notification.query.filter_by(user_id=user.id, is_read=False).count()
    return jsonify({"notifications": [n.dict() for n in items], "unread": unread})


@auth_bp.post("/notifications/read")
@jwt_required()
def mark_notifications_read():
    user = current_user()
    Notification.query.filter_by(user_id=user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"message": "ok"})
