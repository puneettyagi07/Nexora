/* ==========================================================================
   Nexora - LINEAR-STYLE KEYBOARD SHORTCUTS & CHEAT SHEET (js/shortcuts.js)
   Features: Single-Key Actions (N, P, T, /, ?), Two-Key "G + Key" Navigation
   Chords with Live Indicator Pill, and Glassmorphic Shortcuts Cheat Sheet
   ========================================================================== */

import { TasksModule } from './tasks.js';
import { ProjectsModule } from './projects.js';
import { SearchModule } from './search.js';
import { openModal, closeModal, refreshIcons } from './utils.js';

const GO_TO_ROUTES = {
  d: { hash: '#dashboard', label: 'Dashboard' },
  p: { hash: '#projects', label: 'Projects' },
  t: { hash: '#tasks', label: 'My Tasks' },
  k: { hash: '#kanban', label: 'Kanban Board' },
  c: { hash: '#calendar', label: 'Calendar' },
  m: { hash: '#team', label: 'Team Management' },
  n: { hash: '#notifications', label: 'Notifications' },
  a: { hash: '#analytics', label: 'Analytics & Reports' },
  s: { hash: '#settings', label: 'Settings' },
  u: { hash: '#profile', label: 'User Profile' }
};

export const ShortcutsModule = {
  chordPending: false,
  chordTimer: null,
  chordPillEl: null,

  init() {
    this.createChordIndicator();
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
  },

  createChordIndicator() {
    if (document.getElementById('shortcut-chord-pill')) return;
    const pill = document.createElement('div');
    pill.id = 'shortcut-chord-pill';
    pill.className = 'shortcut-chord-pill hidden';
    pill.innerHTML = `<kbd class="kbd-key">G</kbd> <span>then press D, P, T, K, C, M, N, A, or S...</span>`;
    document.body.appendChild(pill);
    this.chordPillEl = pill;
  },

  showChordIndicator() {
    this.chordPending = true;
    this.chordPillEl?.classList.remove('hidden');
    clearTimeout(this.chordTimer);
    this.chordTimer = setTimeout(() => this.clearChord(), 1100);
  },

  clearChord() {
    this.chordPending = false;
    clearTimeout(this.chordTimer);
    this.chordPillEl?.classList.add('hidden');
  },

  isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable
    );
  },

  isOverlayOpen() {
    const modal = document.getElementById('modal-root');
    const tour = document.getElementById('tutorial-overlay-root');
    const modalOpen = modal && !modal.classList.contains('hidden');
    return Boolean(modalOpen || tour);
  },

  handleKeyDown(e) {
    const key = e.key.toLowerCase();

    // 1. Always allow Ctrl+K / Cmd+K to open the Command Palette
    if ((e.metaKey || e.ctrlKey) && key === 'k') {
      e.preventDefault();
      this.clearChord();
      SearchModule.openGlobalSearchModal();
      return;
    }

    // 2. Escape closes active modals or pending chords
    if (e.key === 'Escape') {
      this.clearChord();
      closeModal();
      return;
    }

    // Ignore shortcuts when typing in inputs or when a modal/tutorial is active
    if (this.isTypingTarget(e.target) || this.isOverlayOpen() || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    // 3. Handle Second Key in a "G + ..." Navigation Chord
    if (this.chordPending) {
      e.preventDefault();
      const destination = GO_TO_ROUTES[key];
      this.clearChord();
      if (destination) {
        window.location.hash = destination.hash;
      }
      return;
    }

    // 4. Start "G" Navigation Chord
    if (key === 'g') {
      e.preventDefault();
      this.showChordIndicator();
      return;
    }

    // 5. Single-Key Linear-Style Power Actions
    if (key === 'n') {
      e.preventDefault();
      TasksModule.openTaskModal();
    } else if (key === 'p') {
      e.preventDefault();
      ProjectsModule.openProjectModal();
    } else if (key === 't') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('Nexora:command', { detail: { action: 'toggleTheme' } }));
    } else if (e.key === '/') {
      e.preventDefault();
      SearchModule.openGlobalSearchModal();
    } else if (e.key === '?') {
      e.preventDefault();
      this.openCheatSheet();
    }
  },

  /**
   * Opens the Glassmorphic Keyboard Shortcuts Cheat Sheet Modal
   */
  openCheatSheet() {
    openModal({
      title: 'Keyboard Shortcuts & Command Palette',
      bodyHtml: `
        <div class="shortcuts-sheet">
          <p class="text-xs text-secondary" style="margin-bottom:var(--space-3);">
            Navigate Nexora at keyboard speed. Shortcuts automatically pause while typing in forms.
          </p>

          <div class="shortcuts-grid">
            <!-- Quick Actions Column -->
            <div class="shortcuts-group">
              <h4 class="shortcuts-group-title">Quick Actions</h4>
              <div class="shortcut-row">
                <span>Open Command Palette</span>
                <div class="kbd-combo"><kbd class="kbd-key">Ctrl</kbd> + <kbd class="kbd-key">K</kbd></div>
              </div>
              <div class="shortcut-row">
                <span>Quick Search</span>
                <div class="kbd-combo"><kbd class="kbd-key">/</kbd></div>
              </div>
              <div class="shortcut-row">
                <span>Create New Task</span>
                <div class="kbd-combo"><kbd class="kbd-key">N</kbd></div>
              </div>
              <div class="shortcut-row">
                <span>Create New Project</span>
                <div class="kbd-combo"><kbd class="kbd-key">P</kbd></div>
              </div>
              <div class="shortcut-row">
                <span>Toggle Light / Dark Theme</span>
                <div class="kbd-combo"><kbd class="kbd-key">T</kbd></div>
              </div>
              <div class="shortcut-row">
                <span>Keyboard Shortcuts Help</span>
                <div class="kbd-combo"><kbd class="kbd-key">?</kbd></div>
              </div>
              <div class="shortcut-row">
                <span>Close Modal / Palette</span>
                <div class="kbd-combo"><kbd class="kbd-key">Esc</kbd></div>
              </div>
            </div>

            <!-- Go-To Navigation Chords Column -->
            <div class="shortcuts-group">
              <h4 class="shortcuts-group-title">Navigation Chords (Press G, then key)</h4>
              <div class="shortcut-row">
                <span>Go to Dashboard</span>
                <div class="kbd-combo"><kbd class="kbd-key">G</kbd> <span class="text-muted">then</span> <kbd class="kbd-key">D</kbd></div>
              </div>
              <div class="shortcut-row">
                <span>Go to Projects</span>
                <div class="kbd-combo"><kbd class="kbd-key">G</kbd> <span class="text-muted">then</span> <kbd class="kbd-key">P</kbd></div>
              </div>
              <div class="shortcut-row">
                <span>Go to My Tasks</span>
                <div class="kbd-combo"><kbd class="kbd-key">G</kbd> <span class="text-muted">then</span> <kbd class="kbd-key">T</kbd></div>
              </div>
              <div class="shortcut-row">
                <span>Go to Kanban Board</span>
                <div class="kbd-combo"><kbd class="kbd-key">G</kbd> <span class="text-muted">then</span> <kbd class="kbd-key">K</kbd></div>
              </div>
              <div class="shortcut-row">
                <span>Go to Calendar</span>
                <div class="kbd-combo"><kbd class="kbd-key">G</kbd> <span class="text-muted">then</span> <kbd class="kbd-key">C</kbd></div>
              </div>
              <div class="shortcut-row">
                <span>Go to Team Management</span>
                <div class="kbd-combo"><kbd class="kbd-key">G</kbd> <span class="text-muted">then</span> <kbd class="kbd-key">M</kbd></div>
              </div>
              <div class="shortcut-row">
                <span>Go to Analytics</span>
                <div class="kbd-combo"><kbd class="kbd-key">G</kbd> <span class="text-muted">then</span> <kbd class="kbd-key">A</kbd></div>
              </div>
              <div class="shortcut-row">
                <span>Go to Settings</span>
                <div class="kbd-combo"><kbd class="kbd-key">G</kbd> <span class="text-muted">then</span> <kbd class="kbd-key">S</kbd></div>
              </div>
            </div>
          </div>
        </div>
      `,
      footerHtml: `
        <button type="button" class="btn btn-primary btn-sm" id="close-shortcuts-btn">Got It</button>
      `,
      onRender: (_bodyEl, footerEl) => {
        footerEl.querySelector('#close-shortcuts-btn')?.addEventListener('click', closeModal);
        refreshIcons();
      }
    });
  }
};