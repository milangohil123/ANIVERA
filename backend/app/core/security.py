"""Security utilities: Argon2id password hashing and JWT token handling."""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union
from app.core.config import settings

try:
    import jwt  # type: ignore
except ImportError:  # pragma: no cover
    jwt = None

try:
    from passlib.context import CryptContext  # type: ignore
    pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
except ImportError:  # pragma: no cover
    CryptContext = None
    pwd_context = None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against Argon2id hash."""
    if pwd_context is None:
        raise RuntimeError("passlib is not installed. Run `pip install passlib[argon2]`.")
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate Argon2id password hash."""
    if pwd_context is None:
        raise RuntimeError("passlib is not installed. Run `pip install passlib[argon2]`.")
    return pwd_context.hash(password)


def create_access_token(
    subject: Union[str, Any],
    claims: Optional[Dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create signed JWT access token."""
    if jwt is None:
        raise RuntimeError("pyjwt is not installed. Run `pip install pyjwt[crypto]`.")

    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode: Dict[str, Any] = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "type": "access"
    }
    if claims:
        to_encode.update(claims)
        
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(
    subject: Union[str, Any],
    device_id: Optional[str] = None,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create signed JWT refresh token."""
    if jwt is None:
        raise RuntimeError("pyjwt is not installed. Run `pip install pyjwt[crypto]`.")

    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        
    to_encode: Dict[str, Any] = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "type": "refresh"
    }
    if device_id:
        to_encode["device_id"] = device_id
        
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_offline_grant(
    subject: Optional[Union[str, Any]] = None,
    device_id: Optional[Union[str, Any]] = None,
    expires_delta: Optional[timedelta] = None,
    *,
    user_id: Optional[Union[str, Any]] = None
) -> str:
    """Create signed offline authorization grant token valid for up to 7 days."""
    if jwt is None:
        raise RuntimeError("pyjwt is not installed. Run `pip install pyjwt[crypto]`.")

    effective_subject = subject if subject is not None else user_id
    if effective_subject is None:
        raise ValueError("Either 'subject' or 'user_id' must be provided to create_offline_grant.")

    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=settings.OFFLINE_AUTH_VALIDITY_DAYS)

    to_encode: Dict[str, Any] = {
        "sub": str(effective_subject),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "type": "offline_grant"
    }
    if device_id:
        to_encode["device_id"] = str(device_id)

    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    """Decode and validate JWT token."""
    if jwt is None:
        raise RuntimeError("pyjwt is not installed. Run `pip install pyjwt[crypto]`.")

    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM]
    )
