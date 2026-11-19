/* ==========================================================================
   Nexora - REUSABLE UTILITY FUNCTIONS, TOASTS & MODAL SYSTEM
   ========================================================================== */

export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatDate(dateStr, format = 'MMM DD, YYYY') {
  if (!dateStr) return 'No date';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const day = String(date.getDate()).padStart(2, '0');
  const monthIndex = date.getMonth();
  const year = date.getFullYear();
  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (format === 'DD/MM/YYYY') return `${day}/${String(monthIndex + 1).padStart(2, '0')}/${year}`;
  if (format === 'YYYY-MM-DD') return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${day}`;
  return `${monthsShort[monthIndex]} ${day}, ${year}`;
}

export function isOverdue(dueDateStr, status = '') {
  if (!dueDateStr || status === 'Completed') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

export function timeAgo(isoDate) {
  if (!isoDate) return '';
  const diffSeconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diffSeconds < 60) return 'Just now';
  const mins = Math.floor(diffSeconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getPriorityBadgeClass(priority) {
  switch (priority) {
    case 'Urgent': return 'badge-coral';
    case 'High': return 'badge-warning';
    case 'Medium': return 'badge-teal';
    default: return 'badge-success';
  }
}

export function getStatusBadgeClass(status) {
  switch (status) {
    case 'Completed': return 'badge-success';
    case 'In Progress':
    case 'Active': return 'badge-teal';
    case 'In Review':
    case 'On Hold': return 'badge-warning';
    default: return 'badge-coral';
  }
}

export function showToast(title, message = '', type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div style="flex:1;">
      <p class="font-semibold text-sm">${escapeHtml(title)}</p>
      ${message ? `<p class="text-xs text-secondary">${escapeHtml(message)}</p>` : ''}
    </div>
    <button type="button" class="icon-btn" style="width:24px;height:24px;" aria-label="Close Toast">&times;</button>
  `;

  toast.querySelector('button').addEventListener('click', () => toast.remove());
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 4000);
}

export function openModal({ title, bodyHtml, footerHtml = '', onRender = null }) {
  const root = document.getElementById('modal-root');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  const footerEl = document.getElementById('modal-footer');

  if (!root || !titleEl || !bodyEl || !footerEl) return;

  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  footerEl.innerHTML = footerHtml;
  footerEl.style.display = footerHtml ? 'flex' : 'none';

  root.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
  if (typeof onRender === 'function') onRender(bodyEl, footerEl);
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) root.classList.add('hidden');
}

/**
 * Displays a custom glassmorphic confirmation dialog and invokes onConfirm()
 */
export function confirmDialog({
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  danger = true,
  onConfirm = () => {}
}) {
  openModal({
    title,
    bodyHtml: `
      <div style="display:flex;align-items:flex-start;gap:var(--space-3);">
        <div class="kpi-icon ${danger ? 'danger' : 'teal'}" style="flex-shrink:0;">
          <i data-lucide="${danger ? 'alert-triangle' : 'help-circle'}"></i>
        </div>
        <div>
          <p class="text-sm text-primary" style="line-height:1.6;">${escapeHtml(message)}</p>
          <p class="text-xs text-muted" style="margin-top:6px;">This change will immediately update your workspace storage.</p>
        </div>
      </div>
    `,
    footerHtml: `
      <button type="button" class="btn btn-glass btn-sm" id="confirm-cancel-btn">Cancel</button>
      <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-sm" id="confirm-proceed-btn">${escapeHtml(confirmText)}</button>
    `,
    onRender: (_bodyEl, footerEl) => {
      footerEl.querySelector('#confirm-cancel-btn')?.addEventListener('click', closeModal);
      footerEl.querySelector('#confirm-proceed-btn')?.addEventListener('click', () => {
        closeModal();
        onConfirm();
      });
    }
  });
}

export function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}