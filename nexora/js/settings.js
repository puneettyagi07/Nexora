/* ==========================================================================
   Nexora - MODULE 11: SETTINGS, TUTORIAL REPLAY & USER PROFILE (js/settings.js)
   ========================================================================== */

import { StorageService, getInitials } from './storage.js';
import { TasksModule } from './tasks.js';
import { TutorialModule } from './tutorial.js';
import {
  escapeHtml,
  formatDate,
  timeAgo,
  getPriorityBadgeClass,
  showToast,
  confirmDialog,
  refreshIcons
} from './utils.js';

const AVATAR_COLORS = [
  { hex: '#17645F', name: 'Deep Teal' },
  { hex: '#FF6845', name: 'Coral Orange' },
  { hex: '#16A36A', name: 'Emerald' },
  { hex: '#F59E0B', name: 'Amber' },
  { hex: '#3B82F6', name: 'Ocean Blue' },
  { hex: '#8B5CF6', name: 'Violet' }
];

export const SettingsModule = {
  renderSettings(container) {
    if (!container) return;

    const user = StorageService.getCurrentUser() || {
      name: 'Workspace User',
      email: 'user@Nexora.io',
      role: 'Workspace Owner',
      avatar: 'WU',
      avatarColor: '#17645F',
      avatarUrl: '',
      bio: ''
    };
    const settings = StorageService.getSettings();
    const currentTheme = document.documentElement.getAttribute('data-theme') || settings.theme || 'light';

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h2>Settings & Personalization</h2>
          <p class="text-sm text-secondary">Customize your glass theme, date format, guided tour, and workspace storage.</p>
        </div>
        <div class="view-header-actions">
          <button type="button" id="settings-replay-tour-btn" class="btn btn-accent btn-sm">
            <i data-lucide="compass"></i> Replay Interactive Tutorial
          </button>
          <a href="#profile" class="btn btn-glass btn-sm">
            <i data-lucide="user-circle"></i> View Full Profile
          </a>
        </div>
      </div>

      <div class="settings-grid">
        <div style="display:flex;flex-direction:column;gap:var(--space-6);">
          <!-- Theme Appearance -->
          <section class="glass-card settings-card">
            <h3 class="settings-section-title"><i data-lucide="palette"></i> Appearance & Glass Theme</h3>

            <div class="theme-cards-grid">
              <button type="button" class="theme-option-card ${currentTheme === 'light' ? 'active' : ''}" data-select-theme="light">
                <div class="theme-preview-box theme-preview-light">
                  <span style="width:18px;height:18px;border-radius:50%;background:#17645F;"></span>
                  <span style="width:18px;height:18px;border-radius:50%;background:#FF6845;"></span>
                  <span class="text-xs font-bold">Warm Ivory Glass</span>
                </div>
                <div>
                  <p class="font-bold text-sm">Light Mode (#F3EEE8)</p>
                  <p class="text-xs text-secondary">Warm ivory canvas with frosted white cards.</p>
                </div>
              </button>

              <button type="button" class="theme-option-card ${currentTheme === 'dark' ? 'active' : ''}" data-select-theme="dark">
                <div class="theme-preview-box theme-preview-dark">
                  <span style="width:18px;height:18px;border-radius:50%;background:#269B93;"></span>
                  <span style="width:18px;height:18px;border-radius:50%;background:#FF7857;"></span>
                  <span class="text-xs font-bold">Obsidian Teal Glass</span>
                </div>
                <div>
                  <p class="font-bold text-sm">Dark Mode (#0D1716)</p>
                  <p class="text-xs text-secondary">Deep obsidian teal with luminous borders.</p>
                </div>
              </button>
            </div>

            <div class="form-group" style="margin-top:var(--space-2);">
              <label for="settings-date-format" class="form-label">Date Format Preference</label>
              <select id="settings-date-format" class="form-select">
                <option value="MMM DD, YYYY" ${settings.dateFormat === 'MMM DD, YYYY' ? 'selected' : ''}>MMM DD, YYYY (e.g., Nov 19, 2026)</option>
                <option value="DD/MM/YYYY" ${settings.dateFormat === 'DD/MM/YYYY' ? 'selected' : ''}>DD/MM/YYYY (e.g., 19/11/2026)</option>
                <option value="YYYY-MM-DD" ${settings.dateFormat === 'YYYY-MM-DD' ? 'selected' : ''}>YYYY-MM-DD (e.g., 2026-11-19)</option>
              </select>
            </div>
          </section>

          <!-- Notification & App Preferences -->
          <section class="glass-card settings-card">
            <h3 class="settings-section-title"><i data-lucide="bell-ring"></i> Notification & App Preferences</h3>
            <div class="pref-toggle-list">
              <div class="pref-toggle-row">
                <div>
                  <p class="font-semibold text-sm">Task Assignment Alerts</p>
                  <p class="text-xs text-secondary">Generate notifications when tasks are created or assigned.</p>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="pref-email-notifs" ${settings.emailNotifications !== false ? 'checked' : ''} />
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="pref-toggle-row">
                <div>
                  <p class="font-semibold text-sm">Upcoming Deadline Reminders</p>
                  <p class="text-xs text-secondary">Highlight tasks due soon on Dashboard and Calendar.</p>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="pref-deadline-reminders" ${settings.deadlineReminders !== false ? 'checked' : ''} />
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="pref-toggle-row">
                <div>
                  <p class="font-semibold text-sm">Overdue Task Badges</p>
                  <p class="text-xs text-secondary">Display Coral warning alerts for overdue deliverables.</p>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="pref-overdue-alerts" ${settings.overdueAlerts !== false ? 'checked' : ''} />
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="pref-toggle-row">
                <div>
                  <p class="font-semibold text-sm">Compact Workspace Density</p>
                  <p class="text-xs text-secondary">Tighter card padding for high-density monitors.</p>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="pref-compact-mode" ${settings.compactMode ? 'checked' : ''} />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
          </section>
        </div>

        <div style="display:flex;flex-direction:column;gap:var(--space-6);">
          <!-- Quick Profile Settings -->
          <section class="glass-card settings-card">
            <h3 class="settings-section-title"><i data-lucide="user-cog"></i> Quick Profile Settings</h3>

            <form id="settings-profile-form" class="auth-form">
              <div class="flex items-center gap-4" style="margin-bottom:var(--space-2);">
                <div id="settings-avatar-preview" class="profile-avatar-xl" style="background:${escapeHtml(user.avatarColor || '#17645F')};width:60px;height:60px;font-size:20px;">
                  ${user.avatarUrl
                    ? `<img src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(user.name)}" onerror="this.remove()" />`
                    : escapeHtml(user.avatar || getInitials(user.name))
                  }
                </div>
                <div>
                  <p class="font-bold text-sm" id="settings-preview-name">${escapeHtml(user.name)}</p>
                  <p class="text-xs text-secondary">${escapeHtml(user.role)}</p>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Display Name <span class="required-star">*</span></label>
                <input type="text" name="name" id="settings-name-input" class="form-input" required value="${escapeHtml(user.name)}" />
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label">Email <span class="required-star">*</span></label>
                  <input type="email" name="email" class="form-input" required value="${escapeHtml(user.email)}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Job Title / Role</label>
                  <input type="text" name="role" class="form-input" required value="${escapeHtml(user.role)}" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Profile Picture URL (Optional Preview)</label>
                <input type="url" name="avatarUrl" id="settings-avatar-url-input" class="form-input" placeholder="https://images.unsplash.com/..." value="${escapeHtml(user.avatarUrl || '')}" />
              </div>

              <div class="form-group">
                <label class="form-label">Avatar Badge Color</label>
                <div class="color-swatch-row">
                  ${AVATAR_COLORS.map(c => `
                    <label class="color-swatch-label">
                      <input type="radio" name="avatarColor" value="${c.hex}" ${(user.avatarColor || '#17645F') === c.hex ? 'checked' : ''} />
                      <span style="width:13px;height:13px;border-radius:50%;background:${c.hex};display:inline-block;"></span>
                      <span>${c.name}</span>
                    </label>
                  `).join('')}
                </div>
              </div>

              <button type="submit" class="btn btn-primary btn-sm">
                <i data-lucide="save"></i> Save Profile Changes
              </button>
            </form>
          </section>

          <!-- Workspace Storage Management -->
          <section class="glass-card settings-card">
            <h3 class="settings-section-title"><i data-lucide="database"></i> Workspace Storage & Fresh Reset</h3>
            <p class="text-xs text-secondary" style="line-height:1.6;">
              Your projects, tasks, and preferences are saved privately in your browser's <code>LocalStorage</code>. Export a JSON backup anytime or wipe all workspace items for a clean slate.
            </p>

            <div class="flex items-center gap-3" style="flex-wrap:wrap;">
              <button type="button" id="settings-export-json-btn" class="btn btn-glass btn-sm">
                <i data-lucide="download"></i> Export Backup JSON
              </button>
              <button type="button" id="settings-clear-data-btn" class="btn btn-danger btn-sm">
                <i data-lucide="trash-2"></i> Clear All Workspace Data
              </button>
            </div>
          </section>
        </div>
      </div>
    `;

    this.bindSettingsEvents(container);
    refreshIcons();
  },

  bindSettingsEvents(container) {
    container.querySelector('#settings-replay-tour-btn')?.addEventListener('click', () => {
      window.location.hash = '#dashboard';
      setTimeout(() => TutorialModule.start(0), 150);
    });

    container.querySelectorAll('[data-select-theme]').forEach(card => {
      card.addEventListener('click', () => {
        const theme = card.getAttribute('data-select-theme');
        document.documentElement.setAttribute('data-theme', theme);
        StorageService.updateSettings({ theme });
        const icon = document.getElementById('theme-icon');
        if (icon) icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
        showToast(`${theme === 'dark' ? 'Dark Obsidian' : 'Warm Ivory'} Theme Saved`, 'Preference persisted.', 'success');
      });
    });

    container.querySelector('#settings-date-format')?.addEventListener('change', (e) => {
      StorageService.updateSettings({ dateFormat: e.target.value });
      showToast('Date Format Updated', `Dates will now display as ${e.target.value}.`, 'success');
    });

    container.querySelector('#pref-email-notifs')?.addEventListener('change', (e) => {
      StorageService.updateSettings({ emailNotifications: e.target.checked });
    });

    container.querySelector('#pref-deadline-reminders')?.addEventListener('change', (e) => {
      StorageService.updateSettings({ deadlineReminders: e.target.checked });
    });

    container.querySelector('#pref-overdue-alerts')?.addEventListener('change', (e) => {
      StorageService.updateSettings({ overdueAlerts: e.target.checked });
    });

    container.querySelector('#pref-compact-mode')?.addEventListener('change', (e) => {
      document.body.classList.toggle('compact-mode', e.target.checked);
      StorageService.updateSettings({ compactMode: e.target.checked });
    });

    const nameInput = container.querySelector('#settings-name-input');
    const urlInput = container.querySelector('#settings-avatar-url-input');
    const previewBox = container.querySelector('#settings-avatar-preview');
    const previewName = container.querySelector('#settings-preview-name');

    const updateAvatarPreview = () => {
      const nameVal = nameInput?.value.trim() || 'User';
      const urlVal = urlInput?.value.trim() || '';
      const checkedColor = container.querySelector('input[name="avatarColor"]:checked')?.value || '#17645F';
      if (previewName) previewName.textContent = nameVal;
      if (previewBox) {
        previewBox.style.background = checkedColor;
        previewBox.innerHTML = urlVal
          ? `<img src="${escapeHtml(urlVal)}" alt="Preview" onerror="this.parentElement.textContent='${getInitials(nameVal)}'" />`
          : escapeHtml(getInitials(nameVal));
      }
    };

    nameInput?.addEventListener('input', updateAvatarPreview);
    urlInput?.addEventListener('input', updateAvatarPreview);
    container.querySelectorAll('input[name="avatarColor"]').forEach(r => r.addEventListener('change', updateAvatarPreview));

    container.querySelector('#settings-profile-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      StorageService.updateCurrentUserProfile({
        name: fd.get('name'),
        email: fd.get('email'),
        role: fd.get('role'),
        avatarUrl: fd.get('avatarUrl'),
        avatarColor: fd.get('avatarColor')
      });
      showToast('Profile Saved', 'Your profile updates are live.', 'success');
    });

    container.querySelector('#settings-export-json-btn')?.addEventListener('click', () => {
      const backup = {
        exportedAt: new Date().toISOString(),
        user: StorageService.getCurrentUser(),
        settings: StorageService.getSettings(),
        projects: StorageService.getProjects(),
        tasks: StorageService.getTasks(),
        team: StorageService.getTeam()
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Nexora-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup Downloaded', 'Workspace JSON exported.', 'success');
    });

    container.querySelector('#settings-clear-data-btn')?.addEventListener('click', () => {
      confirmDialog({
        title: 'Clear All Workspace Data?',
        message: 'This will delete all projects, tasks, notifications, and activity logs so you start completely fresh.',
        confirmText: 'Clear Workspace',
        danger: true,
        onConfirm: () => {
          StorageService.clearWorkspaceData();
          showToast('Workspace Cleared', 'All items removed. Ready for a fresh start!', 'success');
        }
      });
    });
  },

  renderProfile(container) {
    if (!container) return;

    const user = StorageService.getCurrentUser() || {
      name: 'Workspace User',
      email: 'user@Nexora.io',
      role: 'Workspace Owner',
      avatar: 'WU',
      avatarColor: '#17645F',
      avatarUrl: '',
      bio: ''
    };

    const settings = StorageService.getSettings();
    const dateFmt = settings.dateFormat || 'MMM DD, YYYY';
    const allTasks = StorageService.getTasks();
    const allProjects = StorageService.getProjects().filter(p => !p.archived);
    const team = StorageService.getTeam();

    const matchedMember =
      team.find(m => m.email.toLowerCase() === user.email.toLowerCase() || m.name.toLowerCase() === user.name.toLowerCase()) ||
      team[0];

    const myTasks = matchedMember ? allTasks.filter(t => t.assignedTo === matchedMember.id) : allTasks;
    const myCompleted = myTasks.filter(t => t.status === 'Completed');
    const myPending = myTasks.filter(t => t.status !== 'Completed');
    const myRate = myTasks.length ? Math.round((myCompleted.length / myTasks.length) * 100) : 0;
    const myProjects = matchedMember ? allProjects.filter(p => (p.members || []).includes(matchedMember.id)) : allProjects;
    const activities = StorageService.getActivities().slice(0, 6);

    container.innerHTML = `
      <section class="glass-card profile-banner">
        <div class="flex items-center gap-4" style="flex-wrap:wrap;">
          <div class="profile-avatar-xl" style="background:${escapeHtml(user.avatarColor || '#17645F')};">
            ${user.avatarUrl
              ? `<img src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(user.name)}" onerror="this.remove()" />`
              : escapeHtml(user.avatar || getInitials(user.name))
            }
          </div>
          <div>
            <div class="flex items-center gap-2" style="margin-bottom:4px;">
              <h2 style="font-size:var(--text-2xl);">${escapeHtml(user.name)}</h2>
              <span class="badge badge-teal">${escapeHtml(user.role)}</span>
            </div>
            <p class="text-sm text-secondary" style="margin-bottom:6px;">
              ${escapeHtml(user.bio || 'Collaborating across projects and sprints in Nexora.')}
            </p>
            <div class="flex items-center gap-3 text-xs text-secondary">
              <span><i data-lucide="mail" style="width:12px;height:12px;vertical-align:-2px;"></i> ${escapeHtml(user.email)}</span>
              <span>•</span>
              <span><strong>${myProjects.length}</strong> Active Projects</span>
              <span>•</span>
              <span><strong>${myRate}%</strong> Personal Task Completion</span>
            </div>
          </div>
        </div>
        <a href="#settings" class="btn btn-glass btn-sm"><i data-lucide="sliders"></i> Preferences</a>
      </section>

      <section class="kpi-grid">
        <article class="glass-card kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">Assigned Projects</span>
            <div class="kpi-icon teal"><i data-lucide="folder-kanban"></i></div>
          </div>
          <div class="kpi-value">${myProjects.length}</div>
          <div class="kpi-meta"><span>Active memberships</span></div>
        </article>

        <article class="glass-card kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">My Assigned Tasks</span>
            <div class="kpi-icon coral"><i data-lucide="check-square"></i></div>
          </div>
          <div class="kpi-value">${myTasks.length}</div>
          <div class="kpi-meta"><span>${myPending.length} Open</span><span>${myCompleted.length} Done</span></div>
        </article>

        <article class="glass-card kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">Completion Rate</span>
            <div class="kpi-icon success"><i data-lucide="award"></i></div>
          </div>
          <div class="kpi-value">${myRate}%</div>
          <div class="progress-track"><div class="progress-fill" style="width:${myRate}%;"></div></div>
        </article>
      </section>

      <div class="settings-grid">
        <section class="glass-card settings-card">
          <h3 class="settings-section-title"><i data-lucide="user-check"></i> Edit Personal Profile</h3>
          <form id="full-profile-form" class="auth-form">
            <div class="form-group">
              <label class="form-label">Full Name <span class="required-star">*</span></label>
              <input type="text" name="name" class="form-input" required value="${escapeHtml(user.name)}" />
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Work Email <span class="required-star">*</span></label>
                <input type="email" name="email" class="form-input" required value="${escapeHtml(user.email)}" />
              </div>
              <div class="form-group">
                <label class="form-label">Role / Title <span class="required-star">*</span></label>
                <input type="text" name="role" class="form-input" required value="${escapeHtml(user.role)}" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Bio / Headline</label>
              <textarea name="bio" rows="3" class="form-textarea">${escapeHtml(user.bio || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Profile Picture URL (Optional)</label>
              <input type="url" name="avatarUrl" class="form-input" value="${escapeHtml(user.avatarUrl || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Avatar Theme Color</label>
              <div class="color-swatch-row">
                ${AVATAR_COLORS.map(c => `
                  <label class="color-swatch-label">
                    <input type="radio" name="avatarColor" value="${c.hex}" ${(user.avatarColor || '#17645F') === c.hex ? 'checked' : ''} />
                    <span style="width:13px;height:13px;border-radius:50%;background:${c.hex};display:inline-block;"></span>
                    <span>${c.name}</span>
                  </label>
                `).join('')}
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-sm"><i data-lucide="check"></i> Update Profile</button>
          </form>
        </section>

        <div style="display:flex;flex-direction:column;gap:var(--space-6);">
          <section class="glass-card dash-panel">
            <div class="dash-panel-header">
              <h3 class="dash-panel-title"><i data-lucide="list-checks"></i> My Assigned Tasks (${myTasks.length})</h3>
              <a href="#tasks" class="text-btn">Open Tasks →</a>
            </div>
            <div class="priority-task-list">
              ${myTasks.length === 0 ? `
                <p class="text-xs text-muted" style="padding:var(--space-4);text-align:center;">No tasks yet. Create your first task from the sidebar!</p>
              ` : myTasks.slice(0, 5).map(t => `
                <div class="priority-task-item" style="cursor:pointer;" data-profile-open-task="${t.id}">
                  <div>
                    <p class="font-semibold text-sm ${t.status === 'Completed' ? 'subtask-done-text' : ''}">${escapeHtml(t.title)}</p>
                    <p class="text-xs text-secondary">Due ${formatDate(t.dueDate, dateFmt)} • ${escapeHtml(t.status)}</p>
                  </div>
                  <span class="badge ${getPriorityBadgeClass(t.priority)}">${escapeHtml(t.priority)}</span>
                </div>
              `).join('')}
            </div>
          </section>

          <section class="glass-card dash-panel">
            <div class="dash-panel-header">
              <h3 class="dash-panel-title"><i data-lucide="history"></i> Workspace Activity Log</h3>
            </div>
            <div class="activity-timeline">
              ${activities.length === 0 ? `
                <p class="text-xs text-muted" style="padding:var(--space-3);text-align:center;">Your recent actions will appear here.</p>
              ` : activities.map(act => `
                <div class="activity-item">
                  <span class="activity-dot"></span>
                  <div>
                    <p class="text-xs">
                      <strong>${escapeHtml(act.actor)}</strong> ${escapeHtml(act.action)}
                      <span class="font-semibold text-teal">"${escapeHtml(act.target)}"</span>
                    </p>
                    <span class="text-xs text-muted">${timeAgo(act.createdAt)}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
        </div>
      </div>
    `;

    container.querySelector('#full-profile-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      StorageService.updateCurrentUserProfile({
        name: fd.get('name'),
        email: fd.get('email'),
        role: fd.get('role'),
        bio: fd.get('bio'),
        avatarUrl: fd.get('avatarUrl'),
        avatarColor: fd.get('avatarColor')
      });
      showToast('Profile Updated!', 'Your profile changes are now live.', 'success');
    });

    container.querySelectorAll('[data-profile-open-task]').forEach(el => {
      el.addEventListener('click', () => {
        TasksModule.openTaskDetailModal(el.getAttribute('data-profile-open-task'));
      });
    });

    refreshIcons();
  }
};