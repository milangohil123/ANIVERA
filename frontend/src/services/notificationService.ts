/**
 * PashuRakshak Botad — Client In-App Notification Service.
 *
 * Implements Part 7:
 * - Persistent in-app notifications.
 * - Header bell unread badge polling.
 * - Gujarati localized messages with Western digits.
 * - Mark single / mark all as read.
 */

export interface InAppNotification {
  id: string;
  recipientUserId: string;
  kind: string;
  messageKey: string;
  params: Record<string, unknown>;
  relatedType?: string;
  relatedId?: string;
  status: 'UNREAD' | 'READ' | 'DISMISSED';
  createdAt: string;
  readAt?: string;
  titleGu?: string;
  messageGu?: string;
}

export interface NotificationListResult {
  items: InAppNotification[];
  total: number;
  unreadCount: number;
}

export class NotificationService {
  /**
   * Fetch paginated notifications for current user.
   */
  async listNotifications(
    apiBaseUrl: string,
    authToken: string,
    statusFilter?: string,
    offset: number = 0,
    limit: number = 50
  ): Promise<NotificationListResult> {
    let url = `${apiBaseUrl}/api/v1/notifications?offset=${offset}&limit=${limit}`;
    if (statusFilter) {
      url += `&status=${statusFilter}`;
    }

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to load notifications: HTTP ${res.status}`);
    }

    return await res.json();
  }

  /**
   * Get unread notifications count for header badge.
   */
  async getUnreadCount(apiBaseUrl: string, authToken: string): Promise<number> {
    const res = await fetch(`${apiBaseUrl}/api/v1/notifications/unread-count`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!res.ok) {
      return 0;
    }

    const data = await res.json();
    return data.unreadCount || 0;
  }

  /**
   * Mark single notification as read.
   */
  async markAsRead(
    apiBaseUrl: string,
    authToken: string,
    notificationId: string
  ): Promise<InAppNotification> {
    const res = await fetch(`${apiBaseUrl}/api/v1/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to mark notification as read: HTTP ${res.status}`);
    }

    return await res.json();
  }

  /**
   * Mark all unread notifications as read.
   */
  async markAllAsRead(apiBaseUrl: string, authToken: string): Promise<number> {
    const res = await fetch(`${apiBaseUrl}/api/v1/notifications/read-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to mark all as read: HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.marked_count || 0;
  }
}

export const notificationService = new NotificationService();

