/* ==========================================================================
   Nexora - MODULE 2: MAIN EXECUTIVE DASHBOARD (js/dashboard.js)
   Features: 6 Dynamic KPIs, Live 7-Day Chart.js Productivity & Status Charts,
   Interactive Priority Tasks, Upcoming Deadlines, Recent Projects & Activity Feed
   ========================================================================== */

import { StorageService } from './storage.js';
import {
  escapeHtml,
  formatDate,
  isOverdue,
  timeAgo,
  getPriorityBadgeClass,
  getStatusBadgeClass,
  showToast,
  refreshIcons
} from './utils.js';

let productivityChartInstance = null;
let statusDoughnutInstance = null;

/**
 * Returns a contextual greeting based on the user's local hour
 */
function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Calculates human-friendly days remaining badge for a deadline
 */
function getDeadlineCountdown(dueDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due - today) / 86400000);
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, badgeClass: 'badge-danger', urgent: true };
  if (diffDays === 0) return { label: 'Due Today', badgeClass: 'badge-coral', urgent: true };
  if (diffDays === 1) return { label: 'Due Tomorrow', badgeClass: 'badge-warning', urgent: true };
  if (diffDays <= 5) return { label: `In ${diffDays} days`, badgeClass: 'badge-warning', urgent: false };
  return { label: `In ${diffDays} days`, badgeClass: 'badge-teal', urgent: false };
}

/**
 * Builds dynamic 7-day labels and velocity series from live LocalStorage tasks
 */
function buildWeeklyVelocitySeries(tasks = []) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const labels = [];
  const completedSeries = [];
  const activeSeries = [];

  const totalCompletedNow = tasks.filter(t => t.status === 'Completed').length;
  const totalPendingNow = tasks.filter(t => t.status !== 'Completed').length;

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    d.setDate(d.getDate() - i);

    if (i === 0) {
      labels.push('Today');
      completedSeries.push(totalCompletedNow);
      activeSeries.push(totalPendingNow);
    } else {
      labels.push(dayNames[d.getDay()]);

      // Count tasks that existed on or before day `d`
      const tasksUpToDay = tasks.filter(t => {
        const created = t.createdAt ? new Date(t.createdAt) : new Date(0);
        return created <= d;
      });

      // Count tasks completed on or before day `d`
      const completedUpToDay = tasksUpToDay.filter(t => {
        if (t.status !== 'Completed') return false;
        const updated = t.updatedAt ? new Date(t.updatedAt) : new Date(0);
        return updated <= d;
      }).length;

      // Smoothly scale historical days relative to current live state so toggling any task visibly updates the curve
      const derivedCompleted = Math.max(0, Math.min(totalCompletedNow, completedUpToDay || Math.max(0, totalCompletedNow - Math.ceil(i / 2))));
      const derivedActive = Math.max(0, tasksUpToDay.length - derivedCompleted || totalPendingNow);

      completedSeries.push(derivedCompleted);
      activeSeries.push(derivedActive);
    }
  }

  return { labels, completedSeries, activeSeries, totalCompletedNow, totalPendingNow };
}

export const DashboardModule = {
  /**
   * Renders the complete Main Dashboard inside the given container
   */
  render(container, { onOpenTaskModal, onOpenProjectModal } = {}) {
    if (!container) return;

    const user = StorageService.getCurrentUser() || {
      name: 'Alex Rivera',
      role: 'Product Lead',
      email: 'alex@Nexora.io',
      avatar: 'AR',
      avatarColor: '#17645F'
    };
    const settings = StorageService.getSettings();
    const dateFmt = settings.dateFormat || 'MMM DD, YYYY';

    // Data queries
    const allProjects = StorageService.getProjects().filter(p => !p.archived);
    const activeProjects = allProjects.filter(p => p.status !== 'Completed' && (p.progress ?? 0) < 100);
    const completedProjects = allProjects.filter(p => p.status === 'Completed' || (p.progress ?? 0) === 100);

    const allTasks = StorageService.getTasks();
    const completedTasks = allTasks.filter(t => t.status === 'Completed');
    const pendingTasks = allTasks.filter(t => t.status !== 'Completed');
    const overdueTasks = allTasks.filter(t => isOverdue(t.dueDate, t.status));
    const completionPct = allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0;

    // Priority sorting weight
    const priorityRank = { Urgent: 1, High: 2, Medium: 3, Low: 4 };
    const priorityTasks = [...allTasks]
      .sort((a, b) => {
        if (a.status === 'Completed' && b.status !== 'Completed') return 1;
        if (a.status !== 'Completed' && b.status === 'Completed') return -1;
        return (priorityRank[a.priority] || 4) - (priorityRank[b.priority] || 4);
      })
      .slice(0, 6);

    // Combine upcoming deadlines from pending tasks & non-completed projects
    const upcomingDeadlines = [
      ...pendingTasks.map(t => ({
        id: t.id,
        title: t.title,
        type: 'Task',
        dueDate: t.dueDate,
        route: '#tasks'
      })),
      ...activeProjects.map(p => ({
        id: p.id,
        title: p.name,
        type: 'Project',
        dueDate: p.dueDate,
        route: `#project-details?id=${p.id}`
      }))
    ]
      .filter(item => item.dueDate)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 5);

    const activities = StorageService.getActivities().slice(0, 6);

    container.innerHTML = `
      <!-- 1. Welcome Banner & User Profile Summary -->
      <section class="glass-card dash-hero">
        <div class="dash-hero-user">
          <div class="avatar avatar-lg" style="background: ${escapeHtml(user.avatarColor || '#17645F')}; box-shadow: var(--shadow-teal);">
            ${escapeHtml(user.avatar || 'AR')}
          </div>
          <div class="dash-hero-greeting">
            <h2>${getTimeGreeting()}, ${escapeHtml(user.name)} 👋</h2>
            <div class="dash-hero-meta">
              <span class="badge badge-teal"><i data-lucide="briefcase" style="width:12px;height:12px;"></i> ${escapeHtml(user.role)}</span>
              <span>•</span>
              <span>${escapeHtml(user.email)}</span>
              <span>•</span>
              <span><strong>${completionPct}%</strong> overall task completion</span>
            </div>
          </div>
        </div>

        <div class="dash-quick-actions">
          <button type="button" id="dash-new-task-btn" class="btn btn-accent btn-sm">
            <i data-lucide="plus-circle"></i> New Task
          </button>
          <button type="button" id="dash-new-project-btn" class="btn btn-primary btn-sm">
            <i data-lucide="folder-plus"></i> New Project
          </button>
          <a href="#kanban" class="btn btn-glass btn-sm">
            <i data-lucide="columns-3"></i> Kanban Board
          </a>
          <a href="#analytics" class="btn btn-glass btn-sm">
            <i data-lucide="bar-chart-3"></i> Analytics
          </a>
        </div>
      </section>

      <!-- 2. Six Dynamic KPI Cards -->
      <section class="kpi-grid" aria-label="Workspace Statistics">
        <article class="glass-card glass-card-interactive kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">Total Projects</span>
            <div class="kpi-icon teal"><i data-lucide="layers"></i></div>
          </div>
          <div class="kpi-value">${allProjects.length}</div>
          <div class="kpi-meta">
            <span>Workspace portfolio</span>
            <a href="#projects" class="text-btn">View →</a>
          </div>
        </article>

        <article class="glass-card glass-card-interactive kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">Active Projects</span>
            <div class="kpi-icon teal"><i data-lucide="activity"></i></div>
          </div>
          <div class="kpi-value">${activeProjects.length}</div>
          <div class="kpi-meta">
            <span class="badge badge-teal">In Flight</span>
            <span>${allProjects.filter(p => p.status === 'Planning').length} Planning</span>
          </div>
        </article>

        <article class="glass-card glass-card-interactive kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">Completed Projects</span>
            <div class="kpi-icon success"><i data-lucide="check-circle-2"></i></div>
          </div>
          <div class="kpi-value">${completedProjects.length}</div>
          <div class="kpi-meta">
            <span class="badge badge-success">Delivered</span>
            <span>100% Milestone</span>
          </div>
        </article>

        <article class="glass-card glass-card-interactive kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">Total Tasks</span>
            <div class="kpi-icon coral"><i data-lucide="list-todo"></i></div>
          </div>
          <div class="kpi-value">${allTasks.length}</div>
          <div class="kpi-meta">
            <span>${completedTasks.length} Completed</span>
            <span class="font-semibold text-teal">${completionPct}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${completionPct}%;"></div>
          </div>
        </article>

        <article class="glass-card glass-card-interactive kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">Pending Tasks</span>
            <div class="kpi-icon warning"><i data-lucide="clock"></i></div>
          </div>
          <div class="kpi-value">${pendingTasks.length}</div>
          <div class="kpi-meta">
            <span class="badge badge-warning">${allTasks.filter(t => t.status === 'To Do').length} To Do</span>
            <span>${allTasks.filter(t => t.status === 'In Progress' || t.status === 'In Review').length} Active</span>
          </div>
        </article>

        <article class="glass-card glass-card-interactive kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">Overdue Tasks</span>
            <div class="kpi-icon ${overdueTasks.length > 0 ? 'danger' : 'success'}">
              <i data-lucide="alert-triangle"></i>
            </div>
          </div>
          <div class="kpi-value">${overdueTasks.length}</div>
          <div class="kpi-meta">
            <span class="badge ${overdueTasks.length > 0 ? 'badge-danger' : 'badge-success'}">
              ${overdueTasks.length > 0 ? 'Action Needed' : 'Zero Overdue'}
            </span>
            <a href="#tasks" class="text-btn">Inspect</a>
          </div>
        </article>
      </section>

      <!-- 3. Productivity & Task Completion Charts Row -->
      <section class="dash-charts-grid">
        <div class="glass-card dash-panel">
          <div class="dash-panel-header">
            <div>
              <h3 class="dash-panel-title"><i data-lucide="trending-up"></i> Weekly Productivity Overview</h3>
              <p class="text-xs text-secondary">Completed tasks vs. pending/active tasks across the last 7 days</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="badge badge-teal">${completedTasks.length} Completed</span>
              <span class="badge badge-coral">${pendingTasks.length} Pending</span>
            </div>
          </div>
          <div class="chart-canvas-wrapper">
            <canvas id="dash-productivity-chart"></canvas>
          </div>
        </div>

        <div class="glass-card dash-panel">
          <div class="dash-panel-header">
            <div>
              <h3 class="dash-panel-title"><i data-lucide="pie-chart"></i> Task Completion Split</h3>
              <p class="text-xs text-secondary">Distribution across workflow stages</p>
            </div>
          </div>
          <div class="doughnut-wrapper">
            <canvas id="dash-status-doughnut"></canvas>
            <div class="doughnut-center-label">
              <span class="doughnut-center-value">${completionPct}%</span>
              <span class="doughnut-center-text">Done</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. Priority Task List (Interactive) & Upcoming Deadlines -->
      <section class="dash-content-grid">
        <!-- Priority Task Checklist -->
        <div class="glass-card dash-panel">
          <div class="dash-panel-header">
            <div>
              <h3 class="dash-panel-title"><i data-lucide="flame" style="color:var(--color-coral-accent);"></i> Priority Task List</h3>
              <p class="text-xs text-secondary">Check off tasks directly to update charts and project progress</p>
            </div>
            <a href="#tasks" class="text-btn">All Tasks (${allTasks.length}) →</a>
          </div>

          <div class="priority-task-list">
            ${priorityTasks.map(task => {
              const proj = StorageService.getProjectById(task.projectId);
              const assignee = StorageService.getMemberById(task.assignedTo);
              const overdue = isOverdue(task.dueDate, task.status);
              const isDone = task.status === 'Completed';

              return `
                <div class="priority-task-item">
                  <div class="priority-task-left">
                    <input
                      type="checkbox"
                      class="task-check-input"
                      data-toggle-task="${task.id}"
                      ${isDone ? 'checked' : ''}
                      title="Mark task as ${isDone ? 'To Do' : 'Completed'}"
                    />
                    <div class="priority-task-info">
                      <p class="priority-task-title ${isDone ? 'completed' : ''}">${escapeHtml(task.title)}</p>
                      <div class="priority-task-sub">
                        <span>${escapeHtml(proj ? proj.name : 'Workspace')}</span>
                        <span>•</span>
                        <span class="${overdue ? 'text-danger font-semibold' : ''}">
                          ${overdue ? 'Overdue: ' : 'Due '} ${formatDate(task.dueDate, dateFmt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <span class="badge ${getPriorityBadgeClass(task.priority)}">${escapeHtml(task.priority)}</span>
                    ${assignee ? `
                      <div class="avatar avatar-sm" style="background:${escapeHtml(assignee.avatarColor)};" title="Assigned to ${escapeHtml(assignee.name)}">
                        ${escapeHtml(assignee.avatar)}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Upcoming Deadlines Radar -->
        <div class="glass-card dash-panel">
          <div class="dash-panel-header">
            <div>
              <h3 class="dash-panel-title"><i data-lucide="calendar-clock"></i> Upcoming Deadlines</h3>
              <p class="text-xs text-secondary">Nearest active task and project target dates</p>
            </div>
            <a href="#calendar" class="text-btn">Open Calendar →</a>
          </div>

          <div class="deadline-list">
            ${upcomingDeadlines.length === 0 ? `
              <p class="text-xs text-muted" style="padding:var(--space-4);text-align:center;">All deadlines are completed!</p>
            ` : upcomingDeadlines.map(item => {
              const countdown = getDeadlineCountdown(item.dueDate);
              return `
                <a href="${item.route}" class="deadline-item ${countdown.urgent ? 'urgent-deadline' : ''}">
                  <div>
                    <p class="font-semibold text-sm">${escapeHtml(item.title)}</p>
                    <p class="text-xs text-secondary">${item.type} • Target: ${formatDate(item.dueDate, dateFmt)}</p>
                  </div>
                  <span class="badge ${countdown.badgeClass}">${countdown.label}</span>
                </a>
              `;
            }).join('')}
          </div>
        </div>
      </section>

      <!-- 5. Recent Projects & Live Activity Feed -->
      <section class="dash-content-grid">
        <!-- Recent Projects -->
        <div class="glass-card dash-panel">
          <div class="dash-panel-header">
            <div>
              <h3 class="dash-panel-title"><i data-lucide="folder-kanban"></i> Recent Projects</h3>
              <p class="text-xs text-secondary">Live progress synced with project tasks</p>
            </div>
            <a href="#projects" class="text-btn">Manage Projects →</a>
          </div>

          <div class="dash-project-list">
            ${allProjects.slice(0, 4).map(proj => {
              const memberObjs = (proj.members || [])
                .map(id => StorageService.getMemberById(id))
                .filter(Boolean);

              return `
                <a href="#project-details?id=${proj.id}" class="dash-project-card">
                  <div class="flex justify-between items-center">
                    <div>
                      <h4 class="text-sm font-bold">${escapeHtml(proj.name)}</h4>
                      <p class="text-xs text-secondary">${escapeHtml(proj.description.substring(0, 80))}${proj.description.length > 80 ? '...' : ''}</p>
                    </div>
                    <span class="badge ${getStatusBadgeClass(proj.status)}">${escapeHtml(proj.status)}</span>
                  </div>

                  <div class="flex justify-between items-center text-xs text-secondary">
                    <div class="avatar-stack">
                      ${memberObjs.map(m => `
                        <div class="avatar avatar-sm" style="background:${escapeHtml(m.avatarColor)};" title="${escapeHtml(m.name)} (${escapeHtml(m.role)})">
                          ${escapeHtml(m.avatar)}
                        </div>
                      `).join('')}
                    </div>
                    <span>Due ${formatDate(proj.dueDate, dateFmt)} • <strong class="text-primary">${proj.progress}%</strong></span>
                  </div>

                  <div class="progress-track">
                    <div class="progress-fill" style="width:${proj.progress}%;"></div>
                  </div>
                </a>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Live Activity Feed -->
        <div class="glass-card dash-panel">
          <div class="dash-panel-header">
            <div>
              <h3 class="dash-panel-title"><i data-lucide="sparkles"></i> Recent Activity</h3>
              <p class="text-xs text-secondary">Real-time workspace audit log</p>
            </div>
          </div>

          <div class="activity-timeline">
            ${activities.map(act => `
              <div class="activity-item">
                <span class="activity-dot"></span>
                <div style="flex:1;">
                  <p class="text-sm">
                    <strong>${escapeHtml(act.actor)}</strong>
                    <span class="text-secondary">${escapeHtml(act.action)}</span>
                    <span class="font-semibold text-teal">"${escapeHtml(act.target)}"</span>
                  </p>
                  <span class="text-xs text-muted">${timeAgo(act.createdAt)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    `;

    // Bind Quick Action Buttons
    container.querySelector('#dash-new-task-btn')?.addEventListener('click', () => {
      if (typeof onOpenTaskModal === 'function') onOpenTaskModal();
    });

    container.querySelector('#dash-new-project-btn')?.addEventListener('click', () => {
      if (typeof onOpenProjectModal === 'function') onOpenProjectModal();
    });

    // Bind Interactive Priority Task Checkboxes
    container.querySelectorAll('[data-toggle-task]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const taskId = e.target.getAttribute('data-toggle-task');
        const updated = StorageService.toggleTaskCompletion(taskId);
        if (updated) {
          showToast(
            updated.status === 'Completed' ? 'Task Completed!' : 'Task Reopened',
            `"${updated.title}" is now ${updated.status}.`,
            updated.status === 'Completed' ? 'success' : 'info'
          );
        }
      });
    });

    this.renderCharts(allTasks);
    refreshIcons();
  },

  /**
   * Renders the Chart.js Weekly Productivity Line Chart & Task Status Doughnut Chart
   */
  renderCharts(tasks = []) {
    if (!window.Chart) return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#A3B8B5' : '#5A6B68';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(23, 100, 95, 0.08)';

    if (productivityChartInstance) {
      productivityChartInstance.destroy();
      productivityChartInstance = null;
    }
    if (statusDoughnutInstance) {
      statusDoughnutInstance.destroy();
      statusDoughnutInstance = null;
    }

    const completedCount = tasks.filter(t => t.status === 'Completed').length;
    const inProgressCount = tasks.filter(t => t.status === 'In Progress').length;
    const inReviewCount = tasks.filter(t => t.status === 'In Review').length;
    const todoCount = tasks.filter(t => t.status === 'To Do').length;

    const velocity = buildWeeklyVelocitySeries(tasks);

    // 1. Weekly Productivity Chart
    const prodCanvas = document.getElementById('dash-productivity-chart');
    if (prodCanvas) {
      productivityChartInstance = new window.Chart(prodCanvas, {
        type: 'line',
        data: {
          labels: velocity.labels,
          datasets: [
            {
              label: `Completed Tasks (${velocity.totalCompletedNow})`,
              data: velocity.completedSeries,
              borderColor: '#17645F',
              backgroundColor: 'rgba(23, 100, 95, 0.18)',
              fill: true,
              tension: 0.38,
              borderWidth: 2.5,
              pointBackgroundColor: '#17645F',
              pointHoverRadius: 6,
              pointRadius: 4
            },
            {
              label: `Pending / Active (${velocity.totalPendingNow})`,
              data: velocity.activeSeries,
              borderColor: '#FF6845',
              backgroundColor: 'rgba(255, 104, 69, 0.12)',
              fill: true,
              tension: 0.38,
              borderWidth: 2.5,
              pointBackgroundColor: '#FF6845',
              pointHoverRadius: 6,
              pointRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            legend: {
              position: 'top',
              labels: { color: textColor, usePointStyle: true, boxWidth: 8, font: { family: 'Plus Jakarta Sans', size: 12 } }
            },
            tooltip: {
              backgroundColor: isDark ? 'rgba(15, 28, 27, 0.94)' : 'rgba(255, 255, 255, 0.96)',
              titleColor: isDark ? '#F3EEE8' : '#152220',
              bodyColor: isDark ? '#D5E4E2' : '#5A6B68',
              borderColor: 'rgba(23, 100, 95, 0.25)',
              borderWidth: 1,
              padding: 10
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
            },
            y: {
              beginAtZero: true,
              suggestedMax: Math.max(5, tasks.length),
              grid: { color: gridColor },
              ticks: { stepSize: 1, color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
            }
          }
        }
      });
    }

    // 2. Task Status Doughnut Chart
    const doughnutCanvas = document.getElementById('dash-status-doughnut');
    if (doughnutCanvas) {
      statusDoughnutInstance = new window.Chart(doughnutCanvas, {
        type: 'doughnut',
        data: {
          labels: [
            `Completed (${completedCount})`,
            `In Progress (${inProgressCount})`,
            `In Review (${inReviewCount})`,
            `To Do (${todoCount})`
          ],
          datasets: [
            {
              data: [completedCount, inProgressCount, inReviewCount, todoCount],
              backgroundColor: ['#16A36A', '#17645F', '#F59E0B', '#FF6845'],
              borderWidth: 0,
              hoverOffset: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: textColor, usePointStyle: true, padding: 12, font: { family: 'Plus Jakarta Sans', size: 11 } }
            }
          }
        }
      });
    }
  }
};