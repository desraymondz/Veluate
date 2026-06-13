from datetime import datetime, timezone


def serialize_utc_datetime(value: datetime) -> str:
    """Emit timezone-aware ISO strings so browsers parse UTC correctly."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()
