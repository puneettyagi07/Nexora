/* ==========================================================================
   Nexora - CORE APPLICATION SHELL, ROUTER, COMMAND PALETTE & PWA ENGINE
   ========================================================================== */

import { StorageService } from './storage.js';
import { AuthService } from './auth.js';
import { DashboardModule } from './dashboard.js';
import { ProjectsModule } from './projects.js';
import { TasksModule } from './tasks.js';
import { KanbanModule } from './kanban.js';
import { CalendarModule } from './calendar.js';
import { TeamModule } from './team.js';
import { NotificationsModule } from './notifications.js';
import { AnalyticsModule } from './analytics.js';
import { SearchModule } from './search.js';
import { SettingsModule } from './settings.js';
import { TutorialModule } from './tutorial.js';
import { ShortcutsModule } from './shortcuts.js';
import { PwaModule } from './pwa.js';
import {
  escapeHtml,
  timeAgo,
  showToast,
  closeModal,
  refreshIcons
} from './utils.js';

const ROUTE_META = {
  dashboard: { title: 'Dashboard', subtitle: 'Plan smarter. Collaborate better. Get things done.' },
  projects: { title: 'Projects', subtitle: 'Manage deliverables, timelines, and project progress.' },
  'project-details': { title: 'Project Details', subtitle: 'In-depth overview, assigned team, and project tasks.' },
  tasks: { title: 'My Tasks', subtitle: 'Track priorities, subtasks, and upcoming deadlines.' },
  kanban: { title: 'Kanban Board', subtitle: 'Drag and drop tasks across workflow stages.' },
  calendar: { title: 'Calendar', subtitle: 'Monthly, weekly, and daily schedule of deadlines.' },
  team: { title: 'Team Management', subtitle: 'Collaborate with team members and monitor workload.' },
  notifications: { title: 'Notification Center', subtitle: 'Stay updated on assignments, alerts, and milestones.' },
  analytics: { title: 'Analytics & Reports', subtitle: 'Real-time productivity metrics and CSV exports.' },
  profile: { title: 'User Profile', subtitle: 'Manage your personal profile and workspace identity.' },
  settings: { title: 'Settings', subtitle: 'Customize theme, preferences, and workspace data.' }
};

class NexoraApp {
  constructor() {
    StorageService.init();

    // Initialize Offline PWA Service Worker & Install Listener
    PwaModule.init();

    // Enforce Protected Route Guard
    const activeUser = AuthService.requireAuth();
    if (!activeUser) return;

    this.currentRoute = 'dashboard';
    this.routeParams = new URLSearchParams();
    this.initTheme();
    this.bindShellEvents();
    this.bindCommandBus();
    this.syncShellUI();
    this.handleRouteChange();

    // Initialize Linear-Style Global Keyboard Shortcuts
    ShortcutsModule.init();

    // Auto-launch Interactive Walkthrough for First-Time Users
    TutorialModule.startIfFirstTime();

    window.addEventListener('hashchange', () => this.handleRouteChange());
    window.addEventListener('Nexora:data-updated', () => {
      this.syncShellUI();
      this.renderCurrentRoute();
    });
  }

  /**
   * Handles decoupled workspace commands emitted by Command Palette or Shortcuts
   */
  bindCommandBus() {
    window.addEventListener('Nexora:command', (e) => {
      const action = e.detail?.action;
      if (action === 'toggleTheme') {
        this.toggleTheme();
      } else if (action === 'openShortcuts') {
        ShortcutsModule.openCheatSheet();
      } else if (action === 'replayTour') {
        if (this.currentRoute !== 'dashboard') window.location.hash = '#dashboard';
        setTimeout(() => TutorialModule.start(0), 120);
      } else if (action === 'exportCsv') {
        const dataset = AnalyticsModule.getFilteredDataset();
        AnalyticsModule.exportFullReportCsv(dataset);
      }
    });
  }

  initTheme() {
    const settings = StorageService.getSettings();
    const theme = settings.theme || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.toggle('compact-mode', Boolean(settings.compactMode));
    this.updateThemeIcon(theme);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    StorageService.updateSettings({ theme: next });
    this.updateThemeIcon(next);
    showToast(`${next === 'dark' ? 'Dark Obsidian' : 'Warm Ivory'} Theme Activated`, 'Your theme preference has been saved.');
  }

  updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
      refreshIcons();
    }
  }

  bindShellEvents() {
    const shell = document.getElementById('app-shell');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    document.getElementById('sidebar-collapse-btn')?.addEventListener('click', () => {
      shell.classList.toggle('sidebar-collapsed');
    });

    const closeMobileMenu = () => {
      sidebar.classList.remove('mobile-open');
      backdrop.classList.add('hidden');
    };

    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
      sidebar.classList.add('mobile-open');
      backdrop.classList.remove('hidden');
    });

    document.getElementById('sidebar-close-mobile')?.addEventListener('click', closeMobileMenu);
    backdrop?.addEventListener('click', closeMobileMenu);

    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', closeMobileMenu);
    });

    // Interactive Tutorial Replay Buttons
    const launchTour = () => {
      if (this.currentRoute !== 'dashboard') window.location.hash = '#dashboard';
      setTimeout(() => TutorialModule.start(0), 100);
    };
    document.getElementById('topbar-tour-btn')?.addEventListener('click', launchTour);
    document.getElementById('dropdown-replay-tour-btn')?.addEventListener('click', launchTour);

    // Keyboard Shortcuts Cheat Sheet Buttons
    document.getElementById('topbar-shortcuts-btn')?.addEventListener('click', () => ShortcutsModule.openCheatSheet());
    document.getElementById('dropdown-shortcuts-btn')?.addEventListener('click', () => ShortcutsModule.openCheatSheet());

    document.getElementById('theme-toggle-btn')?.addEventListener('click', () => this.toggleTheme());
    document.getElementById('sidebar-quick-task-btn')?.addEventListener('click', () => TasksModule.openTaskModal());
    document.getElementById('topbar-new-project-btn')?.addEventListener('click', () => ProjectsModule.openProjectModal());

    // Command Palette Trigger
    document.getElementById('global-search-trigger')?.addEventListener('click', () => {
      SearchModule.openGlobalSearchModal();
    });

    const notifBtn = document.getElementById('topbar-notif-btn');
    const notifDropdown = document.getElementById('topbar-notif-dropdown');
    const userBtn = document.getElementById('topbar-user-btn');
    const userDropdown = document.getElementById('topbar-user-dropdown');

    notifBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.add('hidden');
      notifDropdown.classList.toggle('hidden');
    });

    userBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      notifDropdown.classList.add('hidden');
      userDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      notifDropdown?.classList.add('hidden');
      userDropdown?.classList.add('hidden');
    });

    document.getElementById('topbar-mark-all-read')?.addEventListener('click', (e) => {
      e.stopPropagation();
      StorageService.markAllNotificationsRead();
      showToast('Notifications Cleared', 'All notifications marked as read.', 'success');
    });

    document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
    document.getElementById('modal-root')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-root') closeModal();
    });

    const handleLogout = () => {
      StorageService.clearSession();
      showToast('Signed Out', 'Redirecting to login page...', 'info');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 450);
    };
    document.getElementById('sidebar-logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('topbar-logout-btn')?.addEventListener('click', handleLogout);
  }

  syncShellUI() {
    const user = StorageService.getCurrentUser();
    const projects = StorageService.getProjects().filter(p => !p.archived);
    const tasks = StorageService.getTasks();
    const pendingTasks = tasks.filter(t => t.status !== 'Completed');
    const team = StorageService.getTeam();
    const notifications = StorageService.getNotifications();
    const unreadNotifs = notifications.filter(n => !n.read);

    if (user) {
      const sAvatar = document.getElementById('sidebar-user-avatar');
      const tAvatar = document.getElementById('topbar-user-avatar');
      document.getElementById('sidebar-user-name').textContent = user.name;
      document.getElementById('sidebar-user-role').textContent = user.role;
      sAvatar.style.background = user.avatarColor || 'var(--color-coral-accent)';
      sAvatar.innerHTML = user.avatarUrl
        ? `<img src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(user.name)}" onerror="this.remove()" />`
        : escapeHtml(user.avatar || 'TF');

      document.getElementById('topbar-user-name').textContent = user.name;
      tAvatar.style.background = user.avatarColor || 'var(--color-teal-primary)';
      tAvatar.innerHTML = user.avatarUrl
        ? `<img src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(user.name)}" onerror="this.remove()" />`
        : escapeHtml(user.avatar || 'TF');

      document.getElementById('dropdown-user-name').textContent = user.name;
      document.getElementById('dropdown-user-email').textContent = user.email;
    }

    document.getElementById('nav-badge-projects').textContent = projects.length;
    document.getElementById('nav-badge-tasks').textContent = pendingTasks.length;
    document.getElementById('nav-badge-team').textContent = team.length;

    const notifBadge = document.getElementById('nav-badge-notifications');
    const notifDot = document.getElementById('topbar-notif-dot');
    if (unreadNotifs.length > 0) {
      notifBadge.textContent = unreadNotifs.length;
      notifBadge.classList.remove('hidden');
      notifDot.classList.remove('hidden');
    } else {
      notifBadge.classList.add('hidden');
      notifDot.classList.add('hidden');
    }

    const notifListEl = document.getElementById('topbar-notif-list');
    if (notifListEl) {
      if (notifications.length === 0) {
        notifListEl.innerHTML = `<div style="padding:16px;text-align:center;" class="text-xs text-muted">No notifications yet.</div>`;
      } else {
        notifListEl.innerHTML = notifications.slice(0, 5).map(n => `
          <div class="notif-dropdown-item ${n.read ? '' : 'unread'}" data-pop-notif="${n.id}" style="cursor:pointer;">
            <div class="flex justify-between items-center">
              <span class="font-semibold text-xs">${escapeHtml(n.title)}</span>
              <span class="text-xs text-muted">${timeAgo(n.createdAt)}</span>
            </div>
            <p class="text-xs text-secondary">${escapeHtml(n.message)}</p>
          </div>
        `).join('');

        notifListEl.querySelectorAll('[data-pop-notif]').forEach(item => {
          item.addEventListener('click', () => {
            const id = item.getAttribute('data-pop-notif');
            StorageService.markNotificationRead(id, true);
            window.location.hash = '#notifications';
          });
        });
      }
    }
  }

  handleRouteChange() {
    const rawHash = window.location.hash.replace('#', '') || 'dashboard';
    const [routeKey, queryString = ''] = rawHash.split('?');
    this.currentRoute = ROUTE_META[routeKey] ? routeKey : 'dashboard';
    this.routeParams = new URLSearchParams(queryString);

    document.querySelectorAll('.nav-link').forEach(link => {
      const isProjectRoute = (this.currentRoute === 'projects' || this.currentRoute === 'project-details') && link.dataset.route === 'projects';
      link.classList.toggle('active', link.dataset.route === this.currentRoute || isProjectRoute);
    });

    const meta = ROUTE_META[this.currentRoute];
    document.getElementById('topbar-page-title').textContent = meta.title;
    document.getElementById('topbar-page-subtitle').textContent = meta.subtitle;

    this.renderCurrentRoute();
  }

  renderCurrentRoute() {
    const container = document.getElementById('app-view-container');
    if (!container) return;

    switch (this.currentRoute) {
      case 'dashboard':
        DashboardModule.render(container, {
          onOpenTaskModal: () => TasksModule.openTaskModal(),
          onOpenProjectModal: () => ProjectsModule.openProjectModal()
        });
        break;
      case 'projects':
        ProjectsModule.renderProjectsList(container);
        break;
      case 'project-details':
        ProjectsModule.renderProjectDetails(container, this.routeParams.get('id'));
        break;
      case 'tasks':
        TasksModule.render(container);
        break;
      case 'kanban':
        KanbanModule.render(container);
        break;
      case 'calendar':
        CalendarModule.render(container);
        break;
      case 'team':
        TeamModule.render(container);
        break;
      case 'notifications':
        NotificationsModule.render(container);
        break;
      case 'analytics':
        AnalyticsModule.render(container);
        break;
      case 'profile':
        SettingsModule.renderProfile(container);
        break;
      case 'settings':
        SettingsModule.renderSettings(container);
        break;
      default:
        DashboardModule.render(container);
    }

    refreshIcons();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new NexoraApp();
});