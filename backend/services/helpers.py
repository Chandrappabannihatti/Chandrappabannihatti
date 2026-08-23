import functools

from flask import jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from models import User


def role_required(*roles):
    """JWT + role guard. Usage: @role_required("admin", "teacher")"""
    def decorator(fn):
        @functools.wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            claims = get_jwt()
            role = claims.get("role")
            if role not in roles:
                return jsonify({"error": "Forbidden: insufficient role"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def current_user():
    uid = get_jwt_identity()
    if uid is None:
        return None
    return User.query.get(int(uid))


def error(message, status=400, **extra):
    payload = {"error": message}
    payload.update(extra)
    return jsonify(payload), status
