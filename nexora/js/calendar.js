/* ==========================================================================
   Nexora - MODULE 6: INTERACTIVE CALENDAR (js/calendar.js)
   Features: Monthly, Weekly & Daily Views, Prev/Today/Next Navigation,
   Dynamic Task & Project Deadlines, Add Task on Date, Upcoming Deadlines
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

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Formats a Date object as local YYYY-MM-DD without UTC timezone drift
 */
function toDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses a YYYY-MM-DD string into a local Date object
 */
function parseDateKey(dateStr) {
  if (!dateStr) return new Date();
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export const CalendarModule = {
  state: {
    viewMode: 'month', // 'month' | 'week' | 'day'
    cursorDate: new Date(),
    selectedDateKey: toDateKey(new Date()),
    eventFilter: 'all' // 'all' | 'tasks' | 'projects'
  },

  /**
   * Collects all calendar events from stored Tasks and Projects
   */
  getAllCalendarEvents() {
    const events = [];

    if (this.state.eventFilter === 'all' || this.state.eventFilter === 'tasks') {
      const tasks = StorageService.getTasks();
      tasks.forEach(task => {
        if (!task.dueDate) return;
        events.push({
          id: task.id,
          title: task.title,
          dateKey: task.dueDate,
          kind: 'task',
          status: task.status,
          priority: task.priority,
          assignedTo: task.assignedTo,
          projectId: task.projectId
        });
      });
    }

    if (this.state.eventFilter === 'all' || this.state.eventFilter === 'projects') {
      const projects = StorageService.getProjects().filter(p => !p.archived);
      projects.forEach(proj => {
        if (!proj.dueDate) return;
        events.push({
          id: proj.id,
          title: `${proj.name} (Deadline)`,
          rawName: proj.name,
          dateKey: proj.dueDate,
          kind: 'project',
          status: proj.status,
          priority: proj.priority,
          progress: proj.progress
        });
      });
    }

    return events;
  },

  /**
   * Returns a human-readable header title for the current Month, Week, or Day
   */
  getPeriodTitle() {
    const d = this.state.cursorDate;
    if (this.state.viewMode === 'month') {
      return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    }
    if (this.state.viewMode === 'week') {
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const fmtStart = `${MONTHS[start.getMonth()].substring(0, 3)} ${start.getDate()}`;
      const fmtEnd = `${MONTHS[end.getMonth()].substring(0, 3)} ${end.getDate()}, ${end.getFullYear()}`;
      return `${fmtStart} – ${fmtEnd}`;
    }
    return formatDate(toDateKey(d), 'MMM DD, YYYY');
  },

  /**
   * Renders View 8: Calendar (#calendar)
   */
  render(container) {
    if (!container) return;

    const events = this.getAllCalendarEvents();
    const todayKey = toDateKey(new Date());
    const settings = StorageService.getSettings();
    const dateFmt = settings.dateFormat || 'MMM DD, YYYY';

    // Group events by YYYY-MM-DD key
    const eventsByDate = {};
    events.forEach(ev => {
      if (!eventsByDate[ev.dateKey]) eventsByDate[ev.dateKey] = [];
      eventsByDate[ev.dateKey].push(ev);
    });

    // Selected day events & Upcoming deadlines (next 30 days)
    const selectedEvents = eventsByDate[this.state.selectedDateKey] || [];
    const upcomingEvents = events
      .filter(ev => ev.status !== 'Completed')
      .sort((a, b) => new Date(a.dateKey) - new Date(b.dateKey))
      .slice(0, 7);

    container.innerHTML = `
      <!-- View Header -->
      <div class="view-header">
        <div>
          <h2>Workspace Calendar</h2>
          <p class="text-sm text-secondary">Visualize task due dates and project milestones across month, week, and day views.</p>
        </div>
        <div class="view-header-actions">
          <button type="button" id="cal-schedule-task-btn" class="btn btn-accent btn-sm">
            <i data-lucide="calendar-plus"></i> Schedule Task
          </button>
        </div>
      </div>

      <!-- Calendar Navigation & View Mode Toolbar -->
      <section class="glass-card calendar-toolbar">
        <div class="calendar-nav-group">
          <div class="calendar-nav-buttons">
            <button type="button" id="cal-prev-btn" class="cal-nav-btn" title="Previous">
              <i data-lucide="chevron-left"></i>
            </button>
            <button type="button" id="cal-today-btn" class="cal-nav-btn">Today</button>
            <button type="button" id="cal-next-btn" class="cal-nav-btn" title="Next">
              <i data-lucide="chevron-right"></i>
            </button>
          </div>

          <h3 class="calendar-period-title">${escapeHtml(this.getPeriodTitle())}</h3>
        </div>

        <div class="calendar-controls-right">
          <select id="cal-event-filter" class="filter-select" aria-label="Filter Calendar Events">
            <option value="all" ${this.state.eventFilter === 'all' ? 'selected' : ''}>All Deadlines</option>
            <option value="tasks" ${this.state.eventFilter === 'tasks' ? 'selected' : ''}>Task Deadlines Only</option>
            <option value="projects" ${this.state.eventFilter === 'projects' ? 'selected' : ''}>Project Deadlines Only</option>
          </select>

          <div class="view-toggle-group" role="group" aria-label="Calendar View Mode">
            <button type="button" class="view-toggle-btn ${this.state.viewMode === 'month' ? 'active' : ''}" data-cal-view="month">
              <i data-lucide="calendar"></i> Month
            </button>
            <button type="button" class="view-toggle-btn ${this.state.viewMode === 'week' ? 'active' : ''}" data-cal-view="week">
              <i data-lucide="columns-3"></i> Week
            </button>
            <button type="button" class="view-toggle-btn ${this.state.viewMode === 'day' ? 'active' : ''}" data-cal-view="day">
              <i data-lucide="clock"></i> Day
            </button>
          </div>
        </div>
      </section>

      <!-- Main Calendar + Right Deadlines Sidebar -->
      <div class="calendar-workspace">
        <section class="glass-card calendar-main-card">
          ${this.state.viewMode === 'month'
            ? this.renderMonthView(eventsByDate, todayKey)
            : this.state.viewMode === 'week'
            ? this.renderWeekView(eventsByDate, todayKey)
            : this.renderDayView(eventsByDate, todayKey, dateFmt)
          }

          <!-- Color Legend -->
          <div class="cal-legend">
            <span class="cal-legend-item">
              <span class="cal-legend-dot" style="background:var(--color-teal-primary);"></span> Task Deadline
            </span>
            <span class="cal-legend-item">
              <span class="cal-legend-dot" style="background:var(--color-coral-accent);"></span> Urgent / Today
            </span>
            <span class="cal-legend-item">
              <span class="cal-legend-dot" style="background:var(--status-warning);"></span> Project Milestone
            </span>
            <span class="cal-legend-item">
              <span class="cal-legend-dot" style="background:var(--status-success);"></span> Completed
            </span>
          </div>
        </section>

        <!-- Right Sidebar: Selected Date Agenda & Upcoming Deadlines -->
        <aside class="calendar-side-panel">
          <!-- Selected Day Agenda Card -->
          <section class="glass-card dash-panel">
            <div class="dash-panel-header">
              <div>
                <h3 class="dash-panel-title">
                  <i data-lucide="calendar-check"></i> ${formatDate(this.state.selectedDateKey, dateFmt)}
                </h3>
                <p class="text-xs text-secondary">${selectedEvents.length} scheduled item(s)</p>
              </div>
              <button
                type="button"
                class="btn btn-accent btn-xs"
                data-cal-add-on-date="${this.state.selectedDateKey}"
                title="Add task on this date"
              >
                + Task
              </button>
            </div>

            <div class="deadline-list">
              ${selectedEvents.length === 0 ? `
                <p class="text-xs text-muted" style="padding:var(--space-3) 0;text-align:center;">
                  No deadlines on this date. Click <strong>+ Task</strong> to schedule one.
                </p>
              ` : selectedEvents.map(ev => `
                <div
                  class="deadline-item ${ev.priority === 'Urgent' ? 'urgent-deadline' : ''}"
                  style="cursor:pointer;"
                  data-cal-event-kind="${ev.kind}"
                  data-cal-event-id="${ev.id}"
                >
                  <div>
                    <p class="font-semibold text-xs">${escapeHtml(ev.title)}</p>
                    <p class="text-xs text-secondary">${ev.kind === 'project' ? 'Project Milestone' : `Task • ${ev.status}`}</p>
                  </div>
                  <span class="badge ${getPriorityBadgeClass(ev.priority)}">${escapeHtml(ev.priority)}</span>
                </div>
              `).join('')}
            </div>
          </section>

          <!-- Upcoming Deadlines Section -->
          <section class="glass-card dash-panel">
            <div class="dash-panel-header">
              <div>
                <h3 class="dash-panel-title"><i data-lucide="alarm-clock"></i> Upcoming Deadlines</h3>
                <p class="text-xs text-secondary">Active tasks & projects by target date</p>
              </div>
            </div>

            <div class="deadline-list">
              ${upcomingEvents.length === 0 ? `
                <p class="text-xs text-muted" style="text-align:center;">No pending deadlines.</p>
              ` : upcomingEvents.map(ev => {
                const overdue = isOverdue(ev.dateKey, ev.status);
                return `
                  <div
                    class="deadline-item ${overdue || ev.priority === 'Urgent' ? 'urgent-deadline' : ''}"
                    style="cursor:pointer;"
                    data-cal-event-kind="${ev.kind}"
                    data-cal-event-id="${ev.id}"
                  >
                    <div style="min-width:0;flex:1;">
                      <p class="font-semibold text-xs" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${escapeHtml(ev.title)}
                      </p>
                      <p class="text-xs ${overdue ? 'text-danger font-semibold' : 'text-secondary'}">
                        ${overdue ? 'Overdue: ' : ''}${formatDate(ev.dateKey, dateFmt)}
                      </p>
                    </div>
                    <span class="badge ${ev.kind === 'project' ? 'badge-warning' : getPriorityBadgeClass(ev.priority)}">
                      ${ev.kind === 'project' ? 'Project' : escapeHtml(ev.priority)}
                    </span>
                  </div>
                `;
              }).join('')}
            </div>
          </section>
        </aside>
      </div>
    `;

    this.bindEvents(container);
    refreshIcons();
  },

  /**
   * 1. Renders Monthly Calendar Grid (42 cells = 6 weeks)
   */
  renderMonthView(eventsByDate, todayKey) {
    const year = this.state.cursorDate.getFullYear();
    const month = this.state.cursorDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const startOffset = firstDayOfMonth.getDay(); // 0 (Sun) - 6 (Sat)
    const gridStartDate = new Date(year, month, 1 - startOffset);

    const cellsHtml = [];
    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(gridStartDate);
      cellDate.setDate(gridStartDate.getDate() + i);

      const dateKey = toDateKey(cellDate);
      const isCurrentMonth = cellDate.getMonth() === month;
      const isToday = dateKey === todayKey;
      const isSelected = dateKey === this.state.selectedDateKey;
      const dayEvents = eventsByDate[dateKey] || [];

      cellsHtml.push(`
        <div
          class="cal-day-cell ${isCurrentMonth ? '' : 'outside-month'} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}"
          data-cal-select-date="${dateKey}"
        >
          <div class="cal-day-header">
            <span class="cal-day-number" title="${dateKey}">${cellDate.getDate()}</span>
            <button
              type="button"
              class="cal-day-add-btn"
              data-cal-add-on-date="${dateKey}"
              title="Add task due on ${dateKey}"
            >
              <i data-lucide="plus"></i>
            </button>
          </div>

          <div class="cal-day-events">
            ${dayEvents.map(ev => {
              const pillClass =
                ev.kind === 'project' ? 'event-project' :
                ev.status === 'Completed' ? 'event-task completed' :
                ev.priority === 'Urgent' ? 'event-task urgent' : 'event-task';

              return `
                <div
                  class="cal-event-pill ${pillClass}"
                  data-cal-event-kind="${ev.kind}"
                  data-cal-event-id="${ev.id}"
                  title="${escapeHtml(ev.title)} (${escapeHtml(ev.priority)})"
                >
                  <span>${escapeHtml(ev.title)}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `);
    }

    return `
      <div class="cal-weekdays-row">
        ${WEEKDAYS_SHORT.map(day => `<div class="cal-weekday-label">${day}</div>`).join('')}
      </div>
      <div class="cal-month-grid">
        ${cellsHtml.join('')}
      </div>
    `;
  },

  /**
   * 2. Renders Weekly Calendar View (7 Day Columns)
   */
  renderWeekView(eventsByDate, todayKey) {
    const startOfWeek = new Date(this.state.cursorDate);
    startOfWeek.setDate(this.state.cursorDate.getDate() - this.state.cursorDate.getDay());

    const colsHtml = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + i);
      const dateKey = toDateKey(dayDate);
      const isToday = dateKey === todayKey;
      const dayEvents = eventsByDate[dateKey] || [];

      colsHtml.push(`
        <div class="cal-week-col ${isToday ? 'is-today' : ''}" data-cal-select-date="${dateKey}">
          <div class="cal-week-col-header">
            <div>
              <span class="cal-week-day-name">${WEEKDAYS_SHORT[dayDate.getDay()]}</span>
              <span class="cal-week-day-num">${dayDate.getDate()}</span>
            </div>
            <button
              type="button"
              class="icon-btn"
              style="width:26px;height:26px;"
              data-cal-add-on-date="${dateKey}"
              title="Add task on ${dateKey}"
            >
              <i data-lucide="plus"></i>
            </button>
          </div>

          <div class="cal-week-events">
            ${dayEvents.length === 0 ? `
              <p class="text-xs text-muted" style="margin-top:var(--space-4);text-align:center;">No deadlines</p>
            ` : dayEvents.map(ev => `
              <div
                class="cal-week-card ${ev.kind === 'project' ? 'project' : (ev.priority === 'Urgent' ? 'urgent' : '')}"
                data-cal-event-kind="${ev.kind}"
                data-cal-event-id="${ev.id}"
              >
                <div class="flex justify-between items-center" style="margin-bottom:4px;">
                  <span class="badge ${ev.kind === 'project' ? 'badge-warning' : getPriorityBadgeClass(ev.priority)}">
                    ${ev.kind === 'project' ? 'Project' : escapeHtml(ev.priority)}
                  </span>
                </div>
                <p class="font-semibold text-xs ${ev.status === 'Completed' ? 'subtask-done-text' : ''}">
                  ${escapeHtml(ev.title)}
                </p>
              </div>
            `).join('')}
          </div>
        </div>
      `);
    }

    return `<div class="cal-week-grid">${colsHtml.join('')}</div>`;
  },

  /**
   * 3. Renders Daily Calendar View (Single Day Detailed Breakdown)
   */
  renderDayView(eventsByDate, todayKey, dateFmt) {
    const activeKey = toDateKey(this.state.cursorDate);
    const dayEvents = eventsByDate[activeKey] || [];
    const isToday = activeKey === todayKey;

    return `
      <div class="cal-day-view">
        <div class="cal-day-banner">
          <div>
            <div class="flex items-center gap-2">
              <h3 style="font-size:var(--text-xl);">${formatDate(activeKey, dateFmt)}</h3>
              ${isToday ? `<span class="badge badge-coral">Today</span>` : ''}
            </div>
            <p class="text-xs text-secondary" style="margin-top:4px;">
              ${dayEvents.length} deliverable(s) scheduled for this date.
            </p>
          </div>

          <button type="button" class="btn btn-accent btn-sm" data-cal-add-on-date="${activeKey}">
            <i data-lucide="plus-circle"></i> Add Task for ${formatDate(activeKey, dateFmt)}
          </button>
        </div>

        ${dayEvents.length === 0 ? `
          <div class="empty-state" style="padding:var(--space-8);">
            <div class="empty-state-icon"><i data-lucide="calendar-plus"></i></div>
            <h4>No deadlines scheduled for ${formatDate(activeKey, dateFmt)}</h4>
            <p class="text-xs text-secondary">Click the button above to schedule a task for this day.</p>
          </div>
        ` : `
          <div class="cal-day-schedule-list">
            ${dayEvents.map(ev => {
              const assignee = ev.assignedTo ? StorageService.getMemberById(ev.assignedTo) : null;
              const isDone = ev.status === 'Completed';

              return `
                <div class="priority-task-item">
                  <div class="priority-task-left">
                    ${ev.kind === 'task' ? `
                      <input
                        type="checkbox"
                        class="task-check-input"
                        data-cal-toggle-task="${ev.id}"
                        ${isDone ? 'checked' : ''}
                      />
                    ` : `
                      <div class="kpi-icon warning" style="width:28px;height:28px;">
                        <i data-lucide="folder"></i>
                      </div>
                    `}
                    <div
                      class="priority-task-info"
                      style="cursor:pointer;"
                      data-cal-event-kind="${ev.kind}"
                      data-cal-event-id="${ev.id}"
                    >
                      <p class="priority-task-title ${isDone ? 'completed' : ''}">${escapeHtml(ev.title)}</p>
                      <div class="priority-task-sub">
                        <span class="badge ${getStatusBadgeClass(ev.status)}">${escapeHtml(ev.status)}</span>
                        <span>•</span>
                        <span>${ev.kind === 'project' ? 'Project Milestone' : 'Task Deliverable'}</span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <span class="badge ${getPriorityBadgeClass(ev.priority)}">${escapeHtml(ev.priority)}</span>
                    ${assignee ? `
                      <div class="avatar avatar-sm" style="background:${escapeHtml(assignee.avatarColor)};" title="${escapeHtml(assignee.name)}">
                        ${escapeHtml(assignee.avatar)}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  },

  /**
   * Binds Navigation, View Mode, Date Selection, Task Creation & Event Inspection
   */
  bindEvents(container) {
    // Top "Schedule Task" button
    container.querySelector('#cal-schedule-task-btn')?.addEventListener('click', () => {
      TasksModule.openTaskModal({ dueDate: this.state.selectedDateKey });
    });

    // Previous Period
    container.querySelector('#cal-prev-btn')?.addEventListener('click', () => {
      const d = new Date(this.state.cursorDate);
      if (this.state.viewMode === 'month') d.setMonth(d.getMonth() - 1);
      else if (this.state.viewMode === 'week') d.setDate(d.getDate() - 7);
      else d.setDate(d.getDate() - 1);

      this.state.cursorDate = d;
      this.state.selectedDateKey = toDateKey(d);
      this.render(container);
    });

    // Next Period
    container.querySelector('#cal-next-btn')?.addEventListener('click', () => {
      const d = new Date(this.state.cursorDate);
      if (this.state.viewMode === 'month') d.setMonth(d.getMonth() + 1);
      else if (this.state.viewMode === 'week') d.setDate(d.getDate() + 7);
      else d.setDate(d.getDate() + 1);

      this.state.cursorDate = d;
      this.state.selectedDateKey = toDateKey(d);
      this.render(container);
    });

    // Today Button
    container.querySelector('#cal-today-btn')?.addEventListener('click', () => {
      const now = new Date();
      this.state.cursorDate = now;
      this.state.selectedDateKey = toDateKey(now);
      this.render(container);
    });

    // Event Type Filter
    container.querySelector('#cal-event-filter')?.addEventListener('change', (e) => {
      this.state.eventFilter = e.target.value;
      this.render(container);
    });

    // View Switcher (Month / Week / Day)
    container.querySelectorAll('[data-cal-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.viewMode = btn.getAttribute('data-cal-view');
        this.state.cursorDate = parseDateKey(this.state.selectedDateKey);
        this.render(container);
      });
    });

    // Select a Date Cell
    container.querySelectorAll('[data-cal-select-date]').forEach(cell => {
      cell.addEventListener('click', (e) => {
        if (e.target.closest('[data-cal-add-on-date]') || e.target.closest('[data-cal-event-id]')) return;
        const dateKey = cell.getAttribute('data-cal-select-date');
        this.state.selectedDateKey = dateKey;
        this.state.cursorDate = parseDateKey(dateKey);
        this.render(container);
      });
    });

    // Add Task on Specific Date
    container.querySelectorAll('[data-cal-add-on-date]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dateKey = btn.getAttribute('data-cal-add-on-date');
        this.state.selectedDateKey = dateKey;
        TasksModule.openTaskModal({ dueDate: dateKey });
      });
    });

    // Inspect Task or Project Event
    container.querySelectorAll('[data-cal-event-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const kind = el.getAttribute('data-cal-event-kind');
        const id = el.getAttribute('data-cal-event-id');

        if (kind === 'project') {
          window.location.hash = `#project-details?id=${id}`;
        } else {
          TasksModule.openTaskDetailModal(id);
        }
      });
    });

    // Toggle Task Completion inside Daily View
    container.querySelectorAll('[data-cal-toggle-task]').forEach(chk => {
      chk.addEventListener('change', (e) => {
        e.stopPropagation();
        const taskId = chk.getAttribute('data-cal-toggle-task');
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
  }
};