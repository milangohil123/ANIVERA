"""Pydantic schemas for In-App Notifications domain."""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class NotificationResponse(BaseModel):
    """Notification response item."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    recipient_user_id: uuid.UUID = Field(..., alias="recipientUserId")
    kind: str
    message_key: str = Field(..., alias="messageKey")
    params: Dict[str, Any] = Field(default_factory=dict)
    related_type: Optional[str] = Field(None, alias="relatedType")
    related_id: Optional[str] = Field(None, alias="relatedId")
    status: str
    created_at: datetime = Field(..., alias="createdAt")
    read_at: Optional[datetime] = Field(None, alias="readAt")
    title_gu: Optional[str] = Field(None, alias="titleGu")
    message_gu: Optional[str] = Field(None, alias="messageGu")


class NotificationListResponse(BaseModel):
    """Paginated list of user notifications."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    items: List[NotificationResponse]
    total: int
    unread_count: int = Field(..., alias="unreadCount")


class UnreadCountResponse(BaseModel):
    """Unread notifications count."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    unread_count: int = Field(..., alias="unreadCount")


class NotificationCreate(BaseModel):
    """Internal model for queuing a notification."""
    recipient_user_id: uuid.UUID
    kind: str
    message_key: str
    params: Dict[str, Any] = Field(default_factory=dict)
    related_type: Optional[str] = None
    related_id: Optional[str] = None

