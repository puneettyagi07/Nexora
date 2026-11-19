/* ==========================================================================
   Nexora - AUTHENTICATION MODULE (LOGIN, SIGNUP, FRESH GUEST & ROUTE GUARD)
   Note: Frontend-only authentication using LocalStorage & SessionStorage.
   ========================================================================== */

import { StorageService } from './storage.js';
import { showToast, refreshIcons } from './utils.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AuthService = {
  /**
   * Protects authenticated pages (index.html). Redirects to login.html if no session exists.
   */
  requireAuth() {
    StorageService.init();
    const currentUser = StorageService.getCurrentUser();
    if (!currentUser) {
      window.location.replace('login.html');
      return null;
    }
    return currentUser;
  },

  /**
   * Evaluates password strength on a 0-4 scale
   */
  evaluatePasswordStrength(password = '') {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score++;
    return score;
  }
};

/* ==========================================================================
   AUTH PAGE UI CONTROLLER (Runs only on login.html and signup.html)
   ========================================================================== */
function initAuthPageController() {
  const pageType = document.body.dataset.page;
  if (pageType !== 'login' && pageType !== 'signup') return;

  StorageService.init();

  // Ensure opening the Login page always starts with a clean session state
  if (pageType === 'login') {
    StorageService.clearSession();
  }

  // Apply saved theme
  const settings = StorageService.getSettings();
  const initialTheme = settings.theme || 'light';
  document.documentElement.setAttribute('data-theme', initialTheme);
  updateAuthThemeIcon(initialTheme);

  // Theme Toggle Button
  document.getElementById('auth-theme-toggle')?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    StorageService.updateSettings({ theme: next });
    updateAuthThemeIcon(next);
  });

  // Show / Hide Password Toggles
  document.querySelectorAll('.password-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.innerHTML = `<i data-lucide="${isPassword ? 'eye-off' : 'eye'}"></i>`;
      refreshIcons();
    });
  });

  if (pageType === 'login') {
    setupLoginForm();
  } else if (pageType === 'signup') {
    setupSignupForm();
  }

  refreshIcons();
}

function updateAuthThemeIcon(theme) {
  const icon = document.getElementById('auth-theme-icon');
  if (icon) {
    icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
    refreshIcons();
  }
}

/* --- Field Error Helpers --- */
function setFieldError(inputId, errorId, message) {
  const input = document.getElementById(inputId);
  const errorEl = document.getElementById(errorId);
  if (input) input.classList.add('input-error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }
}

function clearFieldError(inputId, errorId) {
  const input = document.getElementById(inputId);
  const errorEl = document.getElementById(errorId);
  if (input) input.classList.remove('input-error');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }
}

function showGlobalFormError(message) {
  const alertBox = document.getElementById('auth-error-alert');
  const alertText = document.getElementById('auth-error-text');
  if (alertBox && alertText) {
    alertText.textContent = message;
    alertBox.classList.remove('hidden');
  }
}

function hideGlobalFormError() {
  document.getElementById('auth-error-alert')?.classList.add('hidden');
}

/* ==================== LOGIN FORM HANDLER ==================== */
function setupLoginForm() {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const rememberInput = document.getElementById('login-remember');

  // 1-Click Fresh Guest Workspace Button (SessionStorage only)
  document.getElementById('start-guest-btn')?.addEventListener('click', () => {
    StorageService.createFreshGuestSession();
    showToast('Fresh Workspace Ready!', 'Launching your workspace...', 'success');
    setTimeout(() => {
      window.location.href = 'index.html#dashboard';
    }, 450);
  });

  // Help / Forgot Password Helper
  document.getElementById('forgot-password-link')?.addEventListener('click', () => {
    showToast(
      'Local Account Help',
      'Accounts are saved in your browser. Create a new account on Sign Up or click "Start Fresh Guest".',
      'info'
    );
  });

  emailInput?.addEventListener('input', () => clearFieldError('login-email', 'login-email-error'));
  passwordInput?.addEventListener('input', () => clearFieldError('login-password', 'login-password-error'));

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    hideGlobalFormError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const remember = rememberInput ? rememberInput.checked : false;

    let isValid = true;

    if (!email) {
      setFieldError('login-email', 'login-email-error', 'Please enter your work email address.');
      isValid = false;
    } else if (!EMAIL_REGEX.test(email)) {
      setFieldError('login-email', 'login-email-error', 'Please enter a valid email address (e.g., you@company.com).');
      isValid = false;
    }

    if (!password) {
      setFieldError('login-password', 'login-password-error', 'Please enter your password.');
      isValid = false;
    }

    if (!isValid) return;

    const authenticatedUser = StorageService.authenticateUser(email, password);
    if (!authenticatedUser) {
      showGlobalFormError('No matching account found. Please create a free account or click "Start Fresh Guest".');
      showToast('Authentication Failed', 'Please verify your email and password.', 'error');
      return;
    }

    StorageService.setCurrentUser(authenticatedUser, remember);
    StorageService.logActivity('signed in to', 'Nexora Workspace');
    showToast('Welcome back!', `Signed in as ${authenticatedUser.name}. Redirecting...`, 'success');

    setTimeout(() => {
      window.location.href = 'index.html#dashboard';
    }, 450);
  });
}

/* ==================== SIGNUP FORM HANDLER ==================== */
function setupSignupForm() {
  const form = document.getElementById('signup-form');
  const nameInput = document.getElementById('signup-name');
  const roleInput = document.getElementById('signup-role');
  const emailInput = document.getElementById('signup-email');
  const passwordInput = document.getElementById('signup-password');
  const confirmInput = document.getElementById('signup-confirm');
  const rememberInput = document.getElementById('signup-remember');

  // Live Password Strength Meter
  passwordInput?.addEventListener('input', () => {
    clearFieldError('signup-password', 'signup-password-error');
    const val = passwordInput.value;
    const score = AuthService.evaluatePasswordStrength(val);
    const bars = [
      document.getElementById('strength-bar-1'),
      document.getElementById('strength-bar-2'),
      document.getElementById('strength-bar-3'),
      document.getElementById('strength-bar-4')
    ];
    const label = document.getElementById('strength-label');

    const classes = ['weak', 'fair', 'good', 'strong'];
    const labels = [
      'Too short (min. 8 characters)',
      'Weak — add numbers or uppercase letters',
      'Fair — good start, add a symbol or longer phrase',
      'Good — strong workspace password',
      'Strong — excellent security'
    ];

    bars.forEach((bar, index) => {
      if (!bar) return;
      bar.className = 'strength-bar';
      if (index < score) {
        bar.classList.add(classes[Math.max(0, score - 1)]);
      }
    });

    if (label) {
      label.textContent = val.length === 0 ? 'Enter at least 8 characters' : labels[score];
    }
  });

  nameInput?.addEventListener('input', () => clearFieldError('signup-name', 'signup-name-error'));
  emailInput?.addEventListener('input', () => clearFieldError('signup-email', 'signup-email-error'));
  confirmInput?.addEventListener('input', () => clearFieldError('signup-confirm', 'signup-confirm-error'));

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    hideGlobalFormError();

    const name = nameInput.value.trim();
    const role = roleInput.value;
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;
    const remember = rememberInput ? rememberInput.checked : false;

    let isValid = true;

    if (name.length < 2) {
      setFieldError('signup-name', 'signup-name-error', 'Please enter your full name (at least 2 characters).');
      isValid = false;
    }

    if (!email || !EMAIL_REGEX.test(email)) {
      setFieldError('signup-email', 'signup-email-error', 'Please enter a valid work email address.');
      isValid = false;
    } else if (StorageService.findUserByEmail(email)) {
      setFieldError('signup-email', 'signup-email-error', 'An account with this email already exists. Try signing in.');
      isValid = false;
    }

    if (password.length < 8) {
      setFieldError('signup-password', 'signup-password-error', 'Password must be at least 8 characters long.');
      isValid = false;
    } else if (!/\d/.test(password)) {
      setFieldError('signup-password', 'signup-password-error', 'Password must include at least one number.');
      isValid = false;
    }

    if (confirmPassword !== password) {
      setFieldError('signup-confirm', 'signup-confirm-error', 'Passwords do not match.');
      isValid = false;
    }

    if (!isValid) {
      showGlobalFormError('Please fix the highlighted errors below to create your account.');
      return;
    }

    const newUser = StorageService.registerUser({ name, email, password, role });
    StorageService.setCurrentUser(newUser, remember);
    StorageService.logActivity('created a fresh workspace as', newUser.role);

    showToast('Workspace Created!', `Welcome to Nexora, ${newUser.name}!`, 'success');

    setTimeout(() => {
      window.location.href = 'index.html#dashboard';
    }, 500);
  });
}

document.addEventListener('DOMContentLoaded', initAuthPageController);