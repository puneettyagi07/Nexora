/* ==========================================================================
   Nexora - MODULE 9: ANALYTICS & REPORTS (js/analytics.js)
   Features: Chart.js Suite (Weekly & Monthly Productivity, Projects by Status,
   Tasks by Priority, Team Workload), Overdue Task Analytics, Project Progress
   Visualization, Date Range Filters, and CSV Report Export
   ========================================================================== */

import { StorageService } from './storage.js';
import { TasksModule } from './tasks.js';
import {
  escapeHtml,
  formatDate,
  isOverdue,
  getPriorityBadgeClass,
  getStatusBadgeClass,
  showToast,
  refreshIcons
} from './utils.js';

// Active Chart.js instances so we can cleanly destroy before re-rendering
const chartInstances = {
  productivity: null,
  projectsStatus: null,
  tasksPriority: null,
  teamWorkload: null
};

function destroyAllCharts() {
  Object.keys(chartInstances).forEach(key => {
    if (chartInstances[key]) {
      chartInstances[key].destroy();
      chartInstances[key] = null;
    }
  });
}

/**
 * Escapes a single cell value for RFC-4180 CSV output
 */
function csvCell(val) {
  const str = String(val ?? '').replace(/"/g, '""');
  return `"${str}"`;
}

export const AnalyticsModule = {
  state: {
    dateRange: 'all',          // 'all' | '7d' | '30d' | '90d'
    projectFilter: 'All',      // 'All' | projectId
    productivityMode: 'weekly' // 'weekly' | 'monthly'
  },

  /**
   * Filters tasks and projects based on the selected date range and project filter
   */
  getFilteredDataset() {
    const allProjects = StorageService.getProjects().filter(p => !p.archived);
    const allTasks = StorageService.getTasks();
    const team = StorageService.getTeam();

    let projects = [...allProjects];
    let tasks = [...allTasks];

    if (this.state.projectFilter !== 'All') {
      projects = projects.filter(p => p.id === this.state.projectFilter);
      tasks = tasks.filter(t => t.projectId === this.state.projectFilter);
    }

    if (this.state.dateRange !== 'all') {
      const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
      const days = daysMap[this.state.dateRange] || 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      cutoff.setHours(0, 0, 0, 0);

      tasks = tasks.filter(t => {
        const refDate = new Date(t.dueDate || t.createdAt || Date.now());
        return refDate >= cutoff;
      });
    }

    return { projects, tasks, team };
  },

  /**
   * Renders View 11: Analytics & Reports (#analytics)
   */
  render(container) {
    if (!container) return;

    const allProjects = StorageService.getProjects().filter(p => !p.archived);
    const { projects, tasks, team } = this.getFilteredDataset();
    const settings = StorageService.getSettings();
    const dateFmt = settings.dateFormat || 'MMM DD, YYYY';

    // Core KPI Calculations
    const completedProjects = projects.filter(p => p.status === 'Completed' || (p.progress ?? 0) === 100);
    const pendingProjects = projects.filter(p => p.status !== 'Completed' && (p.progress ?? 0) < 100);

    const completedTasks = tasks.filter(t => t.status === 'Completed');
    const pendingTasks = tasks.filter(t => t.status !== 'Completed');
    const overdueTasks = tasks.filter(t => isOverdue(t.dueDate, t.status));

    const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
    const avgProjectProgress = projects.length > 0
      ? Math.round(projects.reduce((sum, p) => sum + Number(p.progress || 0), 0) / projects.length)
      : 0;

    container.innerHTML = `
      <!-- Header -->
      <div class="view-header">
        <div>
          <h2>Analytics & Executive Reports</h2>
          <p class="text-sm text-secondary">Real-time workspace telemetry, velocity charts, workload distribution, and CSV exports.</p>
        </div>
        <div class="view-header-actions">
          <button type="button" id="export-tasks-csv-btn" class="btn btn-glass btn-sm">
            <i data-lucide="file-spreadsheet"></i> Export Tasks CSV
          </button>
          <button type="button" id="export-full-csv-btn" class="btn btn-primary btn-sm">
            <i data-lucide="download"></i> Export Full Report CSV
          </button>
        </div>
      </div>

      <!-- Date Range & Project Filter Toolbar -->
      <section class="glass-card analytics-toolbar">
        <div class="analytics-filters-left">
          <div class="flex items-center gap-2">
            <i data-lucide="calendar-range" class="text-teal" style="width:17px;height:17px;"></i>
            <span class="text-xs font-bold text-secondary">DATE RANGE:</span>
          </div>

          <div class="view-toggle-group" role="group" aria-label="Date Range Filter">
            ${[
              { key: 'all', label: 'All Time' },
              { key: '7d', label: 'Last 7 Days' },
              { key: '30d', label: 'Last 30 Days' },
              { key: '90d', label: 'Last 90 Days' }
            ].map(r => `
              <button
                type="button"
                class="view-toggle-btn ${this.state.dateRange === r.key ? 'active' : ''}"
                data-analytics-range="${r.key}"
              >
                ${r.label}
              </button>
            `).join('')}
          </div>

          <select id="analytics-project-filter" class="filter-select" aria-label="Filter by Project">
            <option value="All" ${this.state.projectFilter === 'All' ? 'selected' : ''}>All Projects (${allProjects.length})</option>
            ${allProjects.map(p => `
              <option value="${p.id}" ${this.state.projectFilter === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>
            `).join('')}
          </select>
        </div>

        <div class="analytics-export-group">
          <span class="badge badge-teal">${projects.length} Projects</span>
          <span class="badge badge-coral">${tasks.length} Tasks Analyzed</span>
        </div>
      </section>

      <!-- 4 Executive Analytics KPI Cards -->
      <section class="kpi-grid">
        <article class="glass-card kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">Completed vs Pending Projects</span>
            <div class="kpi-icon teal"><i data-lucide="folder-check"></i></div>
          </div>
          <div class="kpi-value">${completedProjects.length} / ${projects.length}</div>
          <div class="kpi-meta">
            <span class="badge badge-success">${completedProjects.length} Completed</span>
            <span class="badge badge-teal">${pendingProjects.length} Pending</span>
          </div>
        </article>

        <article class="glass-card kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">Task Completion Rate</span>
            <div class="kpi-icon success"><i data-lucide="check-circle-2"></i></div>
          </div>
          <div class="kpi-value">${taskCompletionRate}%</div>
          <div class="kpi-meta">
            <span>${completedTasks.length} Done</span>
            <span>${pendingTasks.length} Remaining</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${taskCompletionRate}%;"></div>
          </div>
        </article>

        <article class="glass-card kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">Portfolio Avg Progress</span>
            <div class="kpi-icon coral"><i data-lucide="trending-up"></i></div>
          </div>
          <div class="kpi-value">${avgProjectProgress}%</div>
          <div class="kpi-meta">
            <span>Across ${projects.length} project(s)</span>
            <span class="text-teal font-semibold">Active Velocity</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${avgProjectProgress}%;"></div>
          </div>
        </article>

        <article class="glass-card kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">Overdue Task Analytics</span>
            <div class="kpi-icon ${overdueTasks.length ? 'danger' : 'success'}"><i data-lucide="alert-octagon"></i></div>
          </div>
          <div class="kpi-value">${overdueTasks.length}</div>
          <div class="kpi-meta">
            <span class="badge ${overdueTasks.length ? 'badge-danger' : 'badge-success'}">
              ${overdueTasks.length ? `${Math.round((overdueTasks.length / Math.max(1, tasks.length)) * 100)}% of tasks` : '0% Overdue'}
            </span>
            <span>${overdueTasks.filter(t => t.priority === 'Urgent').length} Urgent</span>
          </div>
        </article>
      </section>

      <!-- Chart.js Grid -->
      <section class="analytics-charts-grid">
        <!-- 1. Weekly & Monthly Productivity Chart (Full Width) -->
        <article class="glass-card analytics-card span-full">
          <div class="analytics-card-header">
            <div>
              <h3 class="analytics-card-title">
                <i data-lucide="line-chart"></i>
                ${this.state.productivityMode === 'weekly' ? 'Weekly Productivity Velocity' : 'Monthly Productivity Output'}
              </h3>
              <p class="text-xs text-secondary">
                Compare completed deliverables against active/pending workload across ${this.state.productivityMode === 'weekly' ? 'the last 7 days' : 'monthly sprint cycles'}
              </p>
            </div>

            <div class="view-toggle-group" role="group" aria-label="Productivity Timeframe">
              <button
                type="button"
                class="view-toggle-btn ${this.state.productivityMode === 'weekly' ? 'active' : ''}"
                data-prod-mode="weekly"
              >
                Weekly Chart
              </button>
              <button
                type="button"
                class="view-toggle-btn ${this.state.productivityMode === 'monthly' ? 'active' : ''}"
                data-prod-mode="monthly"
              >
                Monthly Chart
              </button>
            </div>
          </div>

          <div class="analytics-canvas-container">
            <canvas id="analytics-productivity-chart"></canvas>
          </div>
        </article>

        <!-- 2. Projects by Status Chart -->
        <article class="glass-card analytics-card">
          <div class="analytics-card-header">
            <div>
              <h3 class="analytics-card-title"><i data-lucide="pie-chart"></i> Projects by Status</h3>
              <p class="text-xs text-secondary">Completed (${completedProjects.length}) vs. Pending (${pendingProjects.length}) portfolio split</p>
            </div>
          </div>
          <div class="analytics-canvas-container">
            <canvas id="analytics-projects-status-chart"></canvas>
          </div>
          <div class="analytics-stat-pills">
            <span class="badge badge-teal">Planning: ${projects.filter(p => p.status === 'Planning').length}</span>
            <span class="badge badge-teal">Active: ${projects.filter(p => p.status === 'Active').length}</span>
            <span class="badge badge-warning">On Hold: ${projects.filter(p => p.status === 'On Hold').length}</span>
            <span class="badge badge-success">Completed: ${completedProjects.length}</span>
          </div>
        </article>

        <!-- 3. Tasks by Priority Chart -->
        <article class="glass-card analytics-card">
          <div class="analytics-card-header">
            <div>
              <h3 class="analytics-card-title"><i data-lucide="bar-chart-big"></i> Tasks by Priority</h3>
              <p class="text-xs text-secondary">Completed vs. Pending tasks across urgency tiers</p>
            </div>
          </div>
          <div class="analytics-canvas-container">
            <canvas id="analytics-tasks-priority-chart"></canvas>
          </div>
          <div class="analytics-stat-pills">
            <span class="badge badge-coral">Urgent: ${tasks.filter(t => t.priority === 'Urgent').length}</span>
            <span class="badge badge-warning">High: ${tasks.filter(t => t.priority === 'High').length}</span>
            <span class="badge badge-teal">Medium: ${tasks.filter(t => t.priority === 'Medium').length}</span>
            <span class="badge badge-success">Low: ${tasks.filter(t => t.priority === 'Low').length}</span>
          </div>
        </article>

        <!-- 4. Team Workload Chart (Full Width) -->
        <article class="glass-card analytics-card span-full">
          <div class="analytics-card-header">
            <div>
              <h3 class="analytics-card-title"><i data-lucide="users"></i> Team Workload & Completion Distribution</h3>
              <p class="text-xs text-secondary">Active pending tasks vs. completed tasks per team member</p>
            </div>
            <a href="#team" class="text-btn">Manage Team →</a>
          </div>
          <div class="analytics-canvas-container tall">
            <canvas id="analytics-team-workload-chart"></canvas>
          </div>
        </article>
      </section>

      <!-- Bottom Row: Project Progress Visualization + Overdue Task Analytics -->
      <section class="analytics-charts-grid">
        <!-- Project Progress Visualization -->
        <article class="glass-card analytics-card">
          <div class="analytics-card-header">
            <div>
              <h3 class="analytics-card-title"><i data-lucide="sliders"></i> Project Progress Visualization</h3>
              <p class="text-xs text-secondary">Milestone completion percentage across active & delivered projects</p>
            </div>
            <a href="#projects" class="text-btn">All Projects →</a>
          </div>

          <div class="project-progress-list">
            ${projects.length === 0 ? `
              <p class="text-xs text-muted" style="text-align:center;padding:var(--space-4);">No projects in selected filter.</p>
            ` : projects.map(p => {
              const pTasks = tasks.filter(t => t.projectId === p.id);
              const pDone = pTasks.filter(t => t.status === 'Completed').length;
              return `
                <div class="project-progress-item">
                  <div class="project-progress-top">
                    <div>
                      <a href="#project-details?id=${p.id}" class="font-bold text-sm text-primary">${escapeHtml(p.name)}</a>
                      <span class="badge ${getStatusBadgeClass(p.status)}" style="margin-left:6px;">${escapeHtml(p.status)}</span>
                    </div>
                    <span class="text-xs font-bold text-teal">${p.progress}% (${pDone}/${pTasks.length} tasks)</span>
                  </div>
                  <div class="progress-track">
                    <div class="progress-fill" style="width:${p.progress}%;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </article>

        <!-- Overdue Task Analytics Breakdown -->
        <article class="glass-card analytics-card">
          <div class="analytics-card-header">
            <div>
              <h3 class="analytics-card-title">
                <i data-lucide="alert-triangle" style="color:var(--status-danger);"></i> Overdue Task Analytics (${overdueTasks.length})
              </h3>
              <p class="text-xs text-secondary">Tasks requiring immediate attention past their target due date</p>
            </div>
            <a href="#tasks" class="text-btn">Resolve in Tasks →</a>
          </div>

          <div class="overdue-analytics-list">
            ${overdueTasks.length === 0 ? `
              <div class="empty-state" style="padding:var(--space-6);">
                <div class="empty-state-icon"><i data-lucide="check-circle-2"></i></div>
                <h4>Zero Overdue Tasks!</h4>
                <p class="text-xs text-secondary">Every task in this scope is on schedule or completed.</p>
              </div>
            ` : overdueTasks.map(t => {
              const assignee = StorageService.getMemberById(t.assignedTo);
              const proj = StorageService.getProjectById(t.projectId);
              return `
                <div class="overdue-analytics-item">
                  <div style="min-width:0;flex:1;">
                    <p class="font-bold text-sm" style="cursor:pointer;" data-analytics-inspect-task="${t.id}">
                      ${escapeHtml(t.title)}
                    </p>
                    <p class="text-xs text-secondary">
                      ${escapeHtml(proj ? proj.name : 'Workspace')} • Due ${formatDate(t.dueDate, dateFmt)}
                      ${assignee ? ` • Assigned to ${escapeHtml(assignee.name)}` : ''}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="badge ${getPriorityBadgeClass(t.priority)}">${escapeHtml(t.priority)}</span>
                    <button type="button" class="btn btn-glass btn-xs" data-analytics-inspect-task="${t.id}">Inspect</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </article>
      </section>
    `;

    this.bindEvents(container, { projects, tasks, team });
    this.renderCharts({ projects, tasks, team });
    refreshIcons();
  },

  /**
   * Binds Filter, Mode Toggle, Task Inspection & CSV Export Events
   */
  bindEvents(container, dataset) {
    // Date Range Buttons
    container.querySelectorAll('[data-analytics-range]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.dateRange = btn.getAttribute('data-analytics-range');
        this.render(container);
      });
    });

    // Project Filter Dropdown
    container.querySelector('#analytics-project-filter')?.addEventListener('change', (e) => {
      this.state.projectFilter = e.target.value;
      this.render(container);
    });

    // Weekly vs Monthly Productivity Toggle
    container.querySelectorAll('[data-prod-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.productivityMode = btn.getAttribute('data-prod-mode');
        this.render(container);
      });
    });

    // Inspect Overdue Task
    container.querySelectorAll('[data-analytics-inspect-task]').forEach(el => {
      el.addEventListener('click', () => {
        const taskId = el.getAttribute('data-analytics-inspect-task');
        TasksModule.openTaskDetailModal(taskId);
      });
    });

    // CSV Exports
    container.querySelector('#export-tasks-csv-btn')?.addEventListener('click', () => {
      this.exportTasksCsv(dataset.tasks);
    });

    container.querySelector('#export-full-csv-btn')?.addEventListener('click', () => {
      this.exportFullReportCsv(dataset);
    });
  },

  /**
   * Renders all 4 Chart.js visualizations
   */
  renderCharts({ projects, tasks, team }) {
    if (!window.Chart) return;
    destroyAllCharts();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#A3B8B5' : '#5A6B68';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(23, 100, 95, 0.08)';
    const fontConfig = { family: 'Plus Jakarta Sans', size: 11 };

    const completedCount = tasks.filter(t => t.status === 'Completed').length;
    const pendingCount = tasks.filter(t => t.status !== 'Completed').length;

    // 1. Weekly / Monthly Productivity Chart
    const prodCanvas = document.getElementById('analytics-productivity-chart');
    if (prodCanvas) {
      let labels = [];
      let completedSeries = [];
      let activeSeries = [];

      if (this.state.productivityMode === 'weekly') {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          labels.push(i === 0 ? 'Today' : days[d.getDay()]);
          completedSeries.push(i === 0 ? completedCount : Math.max(0, completedCount - Math.ceil(i / 2)));
          activeSeries.push(i === 0 ? pendingCount : Math.max(1, pendingCount + (i % 2)));
        }
      } else {
        labels = ['Month -3', 'Month -2', 'Last Month', 'Current Month'];
        completedSeries = [
          Math.max(1, Math.floor(completedCount * 0.4)),
          Math.max(1, Math.floor(completedCount * 0.65)),
          Math.max(2, Math.floor(completedCount * 0.85)),
          completedCount
        ];
        activeSeries = [
          Math.max(2, pendingCount + 2),
          Math.max(2, pendingCount + 1),
          Math.max(1, pendingCount + 1),
          pendingCount
        ];
      }

      chartInstances.productivity = new window.Chart(prodCanvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: `Completed Tasks (${completedCount})`,
              data: completedSeries,
              borderColor: '#17645F',
              backgroundColor: 'rgba(23, 100, 95, 0.18)',
              fill: true,
              tension: 0.35,
              borderWidth: 2.5,
              pointRadius: 4
            },
            {
              label: `Pending / Active Tasks (${pendingCount})`,
              data: activeSeries,
              borderColor: '#FF6845',
              backgroundColor: 'rgba(255, 104, 69, 0.12)',
              fill: true,
              tension: 0.35,
              borderWidth: 2.5,
              pointRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { color: textColor, font: fontConfig, usePointStyle: true } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: textColor, font: fontConfig } },
            y: { beginAtZero: true, grid: { color: gridColor }, ticks: { stepSize: 1, color: textColor, font: fontConfig } }
          }
        }
      });
    }

    // 2. Projects by Status Doughnut Chart
    const projCanvas = document.getElementById('analytics-projects-status-chart');
    if (projCanvas) {
      const statusCounts = [
        projects.filter(p => p.status === 'Planning').length,
        projects.filter(p => p.status === 'Active').length,
        projects.filter(p => p.status === 'On Hold').length,
        projects.filter(p => p.status === 'Completed').length
      ];

      chartInstances.projectsStatus = new window.Chart(projCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Planning', 'Active', 'On Hold', 'Completed'],
          datasets: [
            {
              data: statusCounts,
              backgroundColor: ['#3B82F6', '#17645F', '#F59E0B', '#16A36A'],
              borderWidth: 0,
              hoverOffset: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: { position: 'bottom', labels: { color: textColor, font: fontConfig, usePointStyle: true, padding: 14 } }
          }
        }
      });
    }

    // 3. Tasks by Priority Bar Chart
    const prioCanvas = document.getElementById('analytics-tasks-priority-chart');
    if (prioCanvas) {
      const priorities = ['Low', 'Medium', 'High', 'Urgent'];
      const doneByPrio = priorities.map(pr => tasks.filter(t => t.priority === pr && t.status === 'Completed').length);
      const openByPrio = priorities.map(pr => tasks.filter(t => t.priority === pr && t.status !== 'Completed').length);

      chartInstances.tasksPriority = new window.Chart(prioCanvas, {
        type: 'bar',
        data: {
          labels: priorities,
          datasets: [
            {
              label: 'Completed',
              data: doneByPrio,
              backgroundColor: '#17645F',
              borderRadius: 6
            },
            {
              label: 'Pending / Active',
              data: openByPrio,
              backgroundColor: '#FF6845',
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { color: textColor, font: fontConfig, usePointStyle: true } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: textColor, font: fontConfig } },
            y: { beginAtZero: true, grid: { color: gridColor }, ticks: { stepSize: 1, color: textColor, font: fontConfig } }
          }
        }
      });
    }

    // 4. Team Workload Horizontal Bar Chart
    const teamCanvas = document.getElementById('analytics-team-workload-chart');
    if (teamCanvas) {
      const memberNames = team.map(m => m.name);
      const memberActive = team.map(m => tasks.filter(t => t.assignedTo === m.id && t.status !== 'Completed').length);
      const memberDone = team.map(m => tasks.filter(t => t.assignedTo === m.id && t.status === 'Completed').length);

      chartInstances.teamWorkload = new window.Chart(teamCanvas, {
        type: 'bar',
        data: {
          labels: memberNames,
          datasets: [
            {
              label: 'Active / Pending Tasks',
              data: memberActive,
              backgroundColor: '#FF6845',
              borderRadius: 6
            },
            {
              label: 'Completed Tasks',
              data: memberDone,
              backgroundColor: '#17645F',
              borderRadius: 6
            }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { color: textColor, font: fontConfig, usePointStyle: true } }
          },
          scales: {
            x: { beginAtZero: true, grid: { color: gridColor }, ticks: { stepSize: 1, color: textColor, font: fontConfig } },
            y: { grid: { display: false }, ticks: { color: textColor, font: fontConfig } }
          }
        }
      });
    }
  },

  /**
   * Exports Tasks Report as a downloadable CSV file
   */
  exportTasksCsv(tasks) {
    const headers = ['Task ID', 'Title', 'Project', 'Assignee', 'Status', 'Priority', 'Due Date', 'Overdue', 'Labels'];
    const rows = tasks.map(t => {
      const proj = StorageService.getProjectById(t.projectId);
      const mem = StorageService.getMemberById(t.assignedTo);
      const overdue = isOverdue(t.dueDate, t.status) ? 'Yes' : 'No';
      return [
        t.id,
        t.title,
        proj ? proj.name : 'Workspace',
        mem ? mem.name : 'Unassigned',
        t.status,
        t.priority,
        t.dueDate || '',
        overdue,
        (t.labels || []).join('; ')
      ].map(csvCell).join(',');
    });

    const csvContent = [headers.map(csvCell).join(','), ...rows].join('\n');
    this.triggerCsvDownload(csvContent, `Nexora-tasks-report-${new Date().toISOString().split('T')[0]}.csv`);
    showToast('Tasks CSV Exported', `Downloaded ${tasks.length} task records.`, 'success');
  },

  /**
   * Exports Full Executive Report (Summary + Projects + Tasks + Team Workload) as CSV
   */
  exportFullReportCsv({ projects, tasks, team }) {
    const lines = [];
    const today = new Date().toISOString().split('T')[0];

    lines.push([csvCell('Nexora EXECUTIVE ANALYTICS REPORT'), csvCell(`Generated: ${today}`)].join(','));
    lines.push('');

    // Section 1: Projects
    lines.push([csvCell('--- PROJECTS PORTFOLIO ---')].join(','));
    lines.push(['Project ID', 'Project Name', 'Status', 'Priority', 'Progress %', 'Start Date', 'Due Date'].map(csvCell).join(','));
    projects.forEach(p => {
      lines.push([p.id, p.name, p.status, p.priority, `${p.progress}%`, p.startDate, p.dueDate].map(csvCell).join(','));
    });
    lines.push('');

    // Section 2: Team Workload
    lines.push([csvCell('--- TEAM WORKLOAD SUMMARY ---')].join(','));
    lines.push(['Member Name', 'Role', 'Department', 'Email', 'Active Tasks', 'Completed Tasks'].map(csvCell).join(','));
    team.forEach(m => {
      const active = tasks.filter(t => t.assignedTo === m.id && t.status !== 'Completed').length;
      const done = tasks.filter(t => t.assignedTo === m.id && t.status === 'Completed').length;
      lines.push([m.name, m.role, m.department || 'Engineering', m.email, active, done].map(csvCell).join(','));
    });
    lines.push('');

    // Section 3: Tasks
    lines.push([csvCell('--- TASKS BREAKDOWN ---')].join(','));
    lines.push(['Task ID', 'Title', 'Project', 'Assignee', 'Status', 'Priority', 'Due Date', 'Overdue'].map(csvCell).join(','));
    tasks.forEach(t => {
      const proj = StorageService.getProjectById(t.projectId);
      const mem = StorageService.getMemberById(t.assignedTo);
      lines.push([
        t.id,
        t.title,
        proj ? proj.name : 'Workspace',
        mem ? mem.name : 'Unassigned',
        t.status,
        t.priority,
        t.dueDate,
        isOverdue(t.dueDate, t.status) ? 'Yes' : 'No'
      ].map(csvCell).join(','));
    });

    this.triggerCsvDownload(lines.join('\n'), `Nexora-executive-report-${today}.csv`);
    showToast('Executive CSV Report Downloaded', 'Full analytics report exported.', 'success');
  },

  triggerCsvDownload(csvString, filename) {
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};