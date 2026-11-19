/* ==========================================================================
   Nexora - INTERACTIVE FIRST-TIME USER TUTORIAL (js/tutorial.js)
   Features: Crisp Unblurred Spotlight Cutout, 10-Step Guided Walkthrough,
   Keyboard Navigation (Arrows / Esc), Progress Dots & Replay Anytime
   ========================================================================== */

import { StorageService } from './storage.js';
import { ProjectsModule } from './projects.js';
import { showToast, refreshIcons } from './utils.js';

const TOUR_STEPS = [
  {
    target: null,
    icon: 'sparkles',
    badge: 'Welcome to Nexora',
    title: 'Your Fresh Workspace is Ready!',
    description:
      'Welcome! Your workspace starts completely clean so you can store your own real projects, tasks, and team members. Everything you create is saved automatically in your browser. Let’s take a 60-second tour of how everything works.'
  },
  {
    target: '#sidebar',
    icon: 'layout-dashboard',
    badge: 'Step 1 of 8 • Navigation',
    title: 'Your Workspace Command Sidebar',
    description:
      'Switch instantly between Dashboard, Projects, My Tasks, Kanban Board, Calendar, Team, Notifications, Analytics, and Settings. Live counters keep track of your active items automatically.'
  },
  {
    target: '#topbar-new-project-btn',
    icon: 'folder-plus',
    badge: 'Step 2 of 8 • Projects',
    title: 'Start by Creating a Project',
    description:
      'Click "New Project" anytime to create a project with deadlines, priority levels, status tracking, and assigned team members. You can view projects as glass cards or a table, and archive completed ones.'
  },
  {
    target: '#sidebar-quick-task-btn',
    icon: 'plus-circle',
    badge: 'Step 3 of 8 • Tasks & Subtasks',
    title: 'Add Tasks, Labels & Subtasks',
    description:
      'Use "New Task" to add deliverables linked to any project (or standalone tasks). Inside My Tasks, click "Inspect" on any task to check off subtasks and watch your project progress auto-calculate.'
  },
  {
    target: '.nav-link[data-route="kanban"]',
    icon: 'columns-3',
    badge: 'Step 4 of 8 • Visual Workflow',
    title: 'Drag-and-Drop Kanban Board',
    description:
      'Open the Kanban Board to drag task cards smoothly across To Do, In Progress, In Review, and Completed columns. Every drop updates status and syncs across your Dashboard and Analytics.'
  },
  {
    target: '.nav-link[data-route="calendar"]',
    icon: 'calendar-days',
    badge: 'Step 5 of 8 • Scheduling',
    title: 'Month, Week & Day Calendar',
    description:
      'Track all task due dates and project milestones visually. Click the "+" button on any calendar day to schedule a task directly for that exact date.'
  },
  {
    target: '.nav-link[data-route="analytics"]',
    icon: 'bar-chart-3',
    badge: 'Step 6 of 8 • Insights & Exports',
    title: 'Live Charts & CSV Reports',
    description:
      'Visit Team Management to monitor workload capacity, and open Analytics to view live Chart.js productivity graphs and export full workspace reports as CSV spreadsheets.'
  },
  {
    target: '#global-search-trigger',
    icon: 'search',
    badge: 'Step 7 of 8 • Quick Find',
    title: 'Instant Global Search (Ctrl + K)',
    description:
      'Press Ctrl + K (or Cmd + K on Mac) from anywhere to search across Projects, Tasks, and Team Members with priority, status, and overdue filters.'
  },
  {
    target: '#theme-toggle-btn',
    icon: 'palette',
    badge: 'Step 8 of 8 • Personalize',
    title: 'Light & Dark Glass Themes',
    description:
      'Toggle between Warm Ivory Glass and Obsidian Teal Dark Mode right here. You can also customize your date format, profile picture, and preferences inside Settings.'
  },
  {
    target: null,
    icon: 'rocket',
    badge: 'All Set!',
    title: 'Ready to Build Your First Project?',
    description:
      'You now know everything inside Nexora. You can replay this guide anytime by clicking the "?" help icon in the top bar or inside Settings.',
    isFinal: true
  }
];

export const TutorialModule = {
  isActive: false,
  currentStepIndex: 0,
  overlayEl: null,
  backdropEl: null,
  spotlightEl: null,
  cardEl: null,
  boundKeyHandler: null,
  boundResizeHandler: null,

  startIfFirstTime() {
    const settings = StorageService.getSettings();
    if (!settings.tutorialCompleted) {
      setTimeout(() => this.start(0), 350);
    }
  },

  start(stepIndex = 0) {
    if (this.isActive) this.destroy();

    this.isActive = true;
    this.currentStepIndex = stepIndex;

    this.overlayEl = document.createElement('div');
    this.overlayEl.id = 'tutorial-overlay-root';
    this.overlayEl.className = 'tutorial-overlay-root';
    this.overlayEl.innerHTML = `
      <div class="tutorial-backdrop" id="tutorial-backdrop"></div>
      <div class="tutorial-spotlight hidden" id="tutorial-spotlight"></div>
      <div class="tutorial-card glass-card" id="tutorial-card" role="dialog" aria-modal="true" aria-label="Nexora Interactive Tutorial"></div>
    `;

    document.body.appendChild(this.overlayEl);
    this.backdropEl = this.overlayEl.querySelector('#tutorial-backdrop');
    this.spotlightEl = this.overlayEl.querySelector('#tutorial-spotlight');
    this.cardEl = this.overlayEl.querySelector('#tutorial-card');

    this.boundKeyHandler = (e) => {
      if (!this.isActive) return;
      if (e.key === 'Escape') this.finish(false);
      if (e.key === 'ArrowRight') this.next();
      if (e.key === 'ArrowLeft') this.prev();
    };
    this.boundResizeHandler = () => {
      if (this.isActive) this.positionCurrentStep();
    };

    window.addEventListener('keydown', this.boundKeyHandler);
    window.addEventListener('resize', this.boundResizeHandler);

    this.renderStep();
  },

  renderStep() {
    const step = TOUR_STEPS[this.currentStepIndex];
    if (!step || !this.cardEl) return;

    const total = TOUR_STEPS.length;
    const isFirst = this.currentStepIndex === 0;
    const isLast = this.currentStepIndex === total - 1;

    this.cardEl.innerHTML = `
      <div class="tutorial-card-top">
        <span class="badge badge-coral">
          <i data-lucide="${step.icon}" style="width:12px;height:12px;"></i>
          ${step.badge}
        </span>
        <button type="button" class="icon-btn" id="tour-skip-x" title="Skip Tutorial" aria-label="Close Tutorial">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="tutorial-card-body">
        <h3>${step.title}</h3>
        <p>${step.description}</p>
      </div>

      <div class="tutorial-dots">
        ${TOUR_STEPS.map((_, idx) => `
          <span class="tutorial-dot ${idx === this.currentStepIndex ? 'active' : (idx < this.currentStepIndex ? 'done' : '')}"></span>
        `).join('')}
      </div>

      <div class="tutorial-card-footer">
        <button type="button" class="text-btn" id="tour-skip-btn">
          ${isLast ? 'Close' : 'Skip Tour'}
        </button>

        <div class="flex items-center gap-2">
          ${!isFirst ? `
            <button type="button" class="btn btn-glass btn-sm" id="tour-prev-btn">
              <i data-lucide="arrow-left"></i> Back
            </button>
          ` : ''}

          ${isLast ? `
            <button type="button" class="btn btn-accent btn-sm" id="tour-create-first-btn">
              <i data-lucide="folder-plus"></i> Create First Project
            </button>
            <button type="button" class="btn btn-primary btn-sm" id="tour-finish-btn">
              Start Exploring
            </button>
          ` : `
            <button type="button" class="btn btn-primary btn-sm" id="tour-next-btn">
              Next <i data-lucide="arrow-right"></i>
            </button>
          `}
        </div>
      </div>
    `;

    this.cardEl.querySelector('#tour-skip-x')?.addEventListener('click', () => this.finish(false));
    this.cardEl.querySelector('#tour-skip-btn')?.addEventListener('click', () => this.finish(false));
    this.cardEl.querySelector('#tour-prev-btn')?.addEventListener('click', () => this.prev());
    this.cardEl.querySelector('#tour-next-btn')?.addEventListener('click', () => this.next());
    this.cardEl.querySelector('#tour-finish-btn')?.addEventListener('click', () => this.finish(true));
    this.cardEl.querySelector('#tour-create-first-btn')?.addEventListener('click', () => {
      this.finish(true);
      ProjectsModule.openProjectModal();
    });

    refreshIcons();
    this.positionCurrentStep();
  },

  positionCurrentStep() {
    const step = TOUR_STEPS[this.currentStepIndex];
    if (!step || !this.cardEl || !this.spotlightEl || !this.backdropEl) return;

    const targetEl = step.target ? document.querySelector(step.target) : null;
    const rect = targetEl ? targetEl.getBoundingClientRect() : null;
    const isVisibleTarget = rect && rect.width > 0 && rect.height > 0 && window.innerWidth > 768;

    if (isVisibleTarget) {
      // Hide blurred backdrop so the targeted button inside the cutout stays 100% sharp & bright
      this.backdropEl.classList.add('hidden');
      this.spotlightEl.classList.remove('hidden');

      const pad = 6;
      this.spotlightEl.style.top = `${Math.max(4, rect.top - pad)}px`;
      this.spotlightEl.style.left = `${Math.max(4, rect.left - pad)}px`;
      this.spotlightEl.style.width = `${rect.width + pad * 2}px`;
      this.spotlightEl.style.height = `${rect.height + pad * 2}px`;

      this.cardEl.classList.remove('centered');
      const cardWidth = Math.min(410, window.innerWidth - 32);
      const cardHeight = this.cardEl.offsetHeight || 270;

      let left = rect.right + 20;
      let top = rect.top;

      if (left + cardWidth > window.innerWidth - 16) {
        if (rect.bottom + cardHeight + 24 < window.innerHeight) {
          left = Math.min(Math.max(16, rect.left), window.innerWidth - cardWidth - 16);
          top = rect.bottom + 20;
        } else {
          left = Math.max(16, rect.left - cardWidth - 20);
          top = Math.min(Math.max(16, rect.top), window.innerHeight - cardHeight - 16);
        }
      }

      top = Math.min(Math.max(16, top), window.innerHeight - cardHeight - 16);

      this.cardEl.style.top = `${top}px`;
      this.cardEl.style.left = `${left}px`;
      this.cardEl.style.transform = 'none';
    } else {
      // Show soft blurred backdrop only on centered Welcome & Final steps (no target button)
      this.backdropEl.classList.remove('hidden');
      this.spotlightEl.classList.add('hidden');
      this.cardEl.classList.add('centered');
      this.cardEl.style.top = '50%';
      this.cardEl.style.left = '50%';
      this.cardEl.style.transform = 'translate(-50%, -50%)';
    }
  },

  next() {
    if (this.currentStepIndex < TOUR_STEPS.length - 1) {
      this.currentStepIndex++;
      this.renderStep();
    } else {
      this.finish(true);
    }
  },

  prev() {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.renderStep();
    }
  },

  finish(completed = true) {
    StorageService.updateSettings({ tutorialCompleted: true });
    this.destroy();
    if (completed) {
      showToast('Tutorial Complete!', 'You can replay the tour anytime from the "?" icon in the top bar.', 'success');
    }
  },

  destroy() {
    this.isActive = false;
    if (this.boundKeyHandler) window.removeEventListener('keydown', this.boundKeyHandler);
    if (this.boundResizeHandler) window.removeEventListener('resize', this.boundResizeHandler);
    if (this.overlayEl && this.overlayEl.parentElement) {
      this.overlayEl.remove();
    }
    this.overlayEl = null;
    this.backdropEl = null;
    this.spotlightEl = null;
    this.cardEl = null;
  }
};