/* ==========================================================================
   Nexora - PWA INSTALL MANAGER & OFFLINE INDICATOR (js/pwa.js)
   Registers sw.js, captures beforeinstallprompt, and tracks online/offline state
   ========================================================================== */

import { showToast, refreshIcons } from './utils.js';

export const PwaModule = {
  deferredPrompt: null,
  isInstalled: false,

  init() {
    this.isInstalled =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    this.registerServiceWorker();
    this.bindInstallEvents();
    this.bindNetworkListeners();
  },

  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (err) {
      console.warn('Nexora Service Worker registration skipped:', err.message);
    }
  },

  bindInstallEvents() {
    const installBtn = document.getElementById('topbar-install-pwa-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      if (installBtn && !this.isInstalled) {
        installBtn.classList.remove('hidden');
        refreshIcons();
      }
    });

    installBtn?.addEventListener('click', () => this.promptInstall());

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.isInstalled = true;
      installBtn?.classList.add('hidden');
      showToast('Nexora Installed!', 'You can now launch Nexora directly from your desktop or home screen.', 'success');
    });
  },

  async promptInstall() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast('Installing Nexora...', 'Setting up your standalone app.', 'info');
      }
      this.deferredPrompt = null;
      document.getElementById('topbar-install-pwa-btn')?.classList.add('hidden');
      return;
    }

    if (this.isInstalled) {
      showToast('Already Installed', 'Nexora is already running as an installed app.', 'info');
    } else {
      showToast(
        'Install Nexora',
        'Use your browser address bar menu ("Install Nexora" or "Add to Home Screen") to install.',
        'info'
      );
    }
  },

  canInstall() {
    return Boolean(this.deferredPrompt) && !this.isInstalled;
  },

  bindNetworkListeners() {
    const pill = document.getElementById('offline-status-pill');

    const syncStatus = (notify = false) => {
      const offline = !navigator.onLine;
      if (pill) {
        pill.classList.toggle('hidden', !offline);
      }
      if (notify) {
        if (offline) {
          showToast('Working Offline', 'Changes continue saving locally in your browser.', 'warning');
        } else {
          showToast('Back Online', 'Your internet connection has been restored.', 'success');
        }
      }
    };

    syncStatus(false);
    window.addEventListener('online', () => syncStatus(true));
    window.addEventListener('offline', () => syncStatus(true));
  }
};