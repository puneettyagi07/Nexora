/* ==========================================================================
   Nexora - MODULE 8: NOTIFICATION CENTER (js/notifications.js)
   Features: Category Tabs (All, Unread, Assignments, Deadlines, Projects,
   Completions), Mark Read/Unread, Mark All Read, Delete & Alert Generator
   ========================================================================== */

import { StorageService } from './storage.js';
import {
  escapeHtml,
  timeAgo,
  showToast,
  refreshIcons
} from './utils.js';

function getNotificationIconMeta(type) {
  switch (type) {
    case 'overdue':
      return { icon: 'alert-triangle', colorClass: 'danger', label: 'Overdue Alert' };
    case 'deadline':
      return { icon: 'calendar-clock', colorClass: 'warning', label: 'Deadline Reminder' };
    case 'assignment':
      return { icon: 'user-check', colorClass: 'teal', label: 'Task Assignment' };
    case 'completion':
      return { icon: 'check-circle-2', colorClass: 'success', label: 'Task Completed' };
    default:
      return { icon: 'folder-kanban', colorClass: 'coral', label: 'Project Update' };
  }
}

export const NotificationsModule = {
  state: {
    activeTab: 'All', // 'All' | 'Unread' | 'assignment' | 'overdue' | 'project' | 'completion'
    searchQuery: ''
  },

  /**
   * Renders View 10: Notification Center (#notifications)
   */
  render(container) {
    if (!container) return;

    const notifications = StorageService.getNotifications();
    const unreadCount = notifications.filter(n => !n.read).length;

    // Filter by category tab
    let filtered = [...notifications];
    if (this.state.activeTab === 'Unread') {
      filtered = filtered.filter(n => !n.read);
    } else if (this.state.activeTab === 'overdue') {
      filtered = filtered.filter(n => n.type === 'overdue' || n.type === 'deadline');
    } else if (this.state.activeTab !== 'All') {
      filtered = filtered.filter(n => n.type === this.state.activeTab);
    }

    // Filter by search query
    if (this.state.searchQuery.trim()) {
      const q = this.state.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q)
      );
    }

    const tabs = [
      { key: 'All', label: 'All Alerts', count: notifications.length },
      { key: 'Unread', label: 'Unread', count: unreadCount },
      { key: 'assignment', label: 'Assignments', count: notifications.filter(n => n.type === 'assignment').length },
      { key: 'overdue', label: 'Deadlines & Overdue', count: notifications.filter(n => n.type === 'overdue' || n.type === 'deadline').length },
      { key: 'project', label: 'Projects', count: notifications.filter(n => n.type === 'project').length },
      { key: 'completion', label: 'Completed', count: notifications.filter(n => n.type === 'completion').length }
    ];

    container.innerHTML = `
      <!-- Header -->
      <div class="view-header">
        <div>
          <h2>Notification Center</h2>
          <p class="text-sm text-secondary">Real-time workspace alerts for task assignments, deadlines, and project milestones.</p>
        </div>
        <div class="view-header-actions">
          <button type="button" id="notif-mark-all-btn" class="btn btn-glass btn-sm">
            <i data-lucide="check-check"></i> Mark All as Read
          </button>
          <button type="button" id="notif-clear-read-btn" class="btn btn-glass btn-sm">
            <i data-lucide="trash-2"></i> Clear Read
          </button>
        </div>
      </div>

      <!-- Category Tabs -->
      <div class="status-tabs" role="tablist">
        ${tabs.map(t => `
          <button
            type="button"
            class="status-tab ${this.state.activeTab === t.key ? 'active' : ''}"
            data-notif-tab="${t.key}"
          >
            <span>${escapeHtml(t.label)}</span>
            <span class="status-tab-count">${t.count}</span>
          </button>
        `).join('')}
      </div>

      <!-- Search Toolbar -->
      <section class="glass-card filter-toolbar">
        <div class="filter-group-left">
          <div class="filter-search-box">
            <i data-lucide="search"></i>
            <input
              type="search"
              id="notif-search-input"
              class="filter-search-input"
              placeholder="Search notifications..."
              value="${escapeHtml(this.state.searchQuery)}"
            />
          </div>
        </div>
        <span class="text-xs font-semibold text-secondary">${unreadCount} unread notification(s)</span>
      </section>

      <!-- Notification Cards Stack -->
      ${filtered.length === 0 ? `
        <div class="glass-card empty-state">
          <div class="empty-state-icon"><i data-lucide="bell-off"></i></div>
          <h3>You're all caught up!</h3>
          <p class="text-sm text-secondary">No notifications match your current filter.</p>
        </div>
      ` : `
        <div class="Notifications-stack">
          ${filtered.map(n => {
            const meta = getNotificationIconMeta(n.type);
            return `
              <article class="glass-card notif-card ${n.read ? '' : 'unread'}">
                <div class="notif-card-left">
                  <div class="kpi-icon ${meta.colorClass}" style="flex-shrink:0;">
                    <i data-lucide="${meta.icon}"></i>
                  </div>
                  <div style="flex:1;min-width:0;">
                    <div class="flex items-center gap-2" style="flex-wrap:wrap;margin-bottom:4px;">
                      <h4 class="text-sm font-bold">${escapeHtml(n.title)}</h4>
                      <span class="badge badge-${meta.colorClass === 'danger' ? 'danger' : (meta.colorClass === 'warning' ? 'warning' : 'teal')}">
                        ${meta.label}
                      </span>
                      ${!n.read ? `<span class="badge badge-coral">Unread</span>` : ''}
                    </div>
                    <p class="text-sm text-secondary" style="margin-bottom:6px;">${escapeHtml(n.message)}</p>
                    <span class="text-xs text-muted">${timeAgo(n.createdAt)}</span>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="btn btn-glass btn-xs"
                    data-notif-toggle="${n.id}"
                    data-notif-read="${n.read ? 'true' : 'false'}"
                  >
                    ${n.read ? 'Mark Unread' : 'Mark Read'}
                  </button>
                  <button
                    type="button"
                    class="icon-btn text-danger"
                    data-notif-delete="${n.id}"
                    title="Delete Notification"
                  >
                    <i data-lucide="trash-2"></i>
                  </button>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      `}
    `;

    this.bindEvents(container);
    refreshIcons();
  },

  /**
   * Binds Notification Center Events
   */
  bindEvents(container) {
    // Category Tabs
    container.querySelectorAll('[data-notif-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.activeTab = btn.getAttribute('data-notif-tab');
        this.render(container);
      });
    });

    // Search Input
    const searchInput = container.querySelector('#notif-search-input');
    searchInput?.addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value;
      const pos = e.target.selectionStart;
      this.render(container);
      const nextInput = container.querySelector('#notif-search-input');
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(pos, pos);
      }
    });

    // Mark All Read
    container.querySelector('#notif-mark-all-btn')?.addEventListener('click', () => {
      StorageService.markAllNotificationsRead();
      showToast('All Marked as Read', 'Every notification has been marked as read.', 'success');
    });

    // Clear Read Notifications
    container.querySelector('#notif-clear-read-btn')?.addEventListener('click', () => {
      StorageService.clearReadNotifications();
      showToast('Read Notifications Cleared', 'All read notifications were removed.', 'info');
    });

    // Toggle Single Notification Read / Unread
    container.querySelectorAll('[data-notif-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-notif-toggle');
        const currentlyRead = btn.getAttribute('data-notif-read') === 'true';
        StorageService.markNotificationRead(id, !currentlyRead);
      });
    });

    // Delete Single Notification
    container.querySelectorAll('[data-notif-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-notif-delete');
        StorageService.deleteNotification(id);
        showToast('Notification Deleted', 'Alert removed from your notification center.', 'info');
      });
    });
  }
};