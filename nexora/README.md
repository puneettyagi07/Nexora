# Nexora — Advanced Project Management SaaS Platform

> **"Plan smarter. Collaborate better. Get things done."**

Nexora is a commercial-grade, offline-capable Progressive Web App (PWA) for project management built strictly with **HTML5, CSS3, and Vanilla ES6+ JavaScript Modules**—with zero frontend frameworks. Designed with a custom **Warm Ivory (`#F3EEE8`), Deep Teal Green (`#17645F`), and Coral Orange (`#FF6845`) Glassmorphism** aesthetic, Nexora delivers a clean, private workspace inspired by Linear, Notion, Trello, and ClickUp.

---

## Live Demo & Onboarding

* **Live Deployment:** `https://your-nexora-deployment.vercel.app` *(Update after deployment)*
* **Clean-Slate Start:** Nexora starts completely empty so every user can create and store their own real projects, tasks, and team members.
* **Quick Access:** Create a free local account on `signup.html` or click **"Start Fresh Guest"** on `login.html` to enter immediately.
* **Built-In Walkthrough:** First-time users automatically receive a 10-step spotlight tutorial explaining every feature (replayable anytime via the `?` icon in the top bar).

> **Local Storage Notice:** Nexora is a frontend-only portfolio application. Accounts, sessions, and workspace data are stored privately in your browser's `LocalStorage` and `SessionStorage`. Do not enter real production passwords.

---

## Key Features (14 Modules • 13 Views)

1. **Authentication & Fresh Session Guard (`login.html`, `signup.html`)**
   * Split-screen glassmorphic auth pages with real-time email/password validation, 4-stage password strength meter, show/hide password toggles, 1-click Guest Workspace entry, and protected route guards. Always opens at `login.html` when relaunched.
2. **Interactive First-Time User Tutorial (`js/tutorial.js`)**
   * 10-step guided spotlight walkthrough with crisp cutout highlighting, keyboard arrow navigation, progress dots, and 1-click replay from the top bar or Settings.
3. **Linear-Style Command Palette & Keyboard Shortcuts (`js/search.js`, `js/shortcuts.js`)**
   * Press **`Ctrl + K`** (or **`/`**) to execute quick commands (`> New Task`, `> Switch Theme`, `> Export CSV`, `> Install App`) or search Projects, Tasks, and Team Members with `↑`/`↓`/`Enter` navigation.
   * Supports single-key shortcuts (`N`, `P`, `T`, `?`) and two-key **`G` + key** navigation chords (`G D` Dashboard, `G K` Kanban, `G C` Calendar, `G A` Analytics) with a live chord indicator pill and Cheat Sheet modal.
4. **Installable Offline PWA (`manifest.json`, `sw.js`, `js/pwa.js`)**
   * Custom SVG app icon, Service Worker pre-caching for full offline usage, live Offline status indicator pill, and a one-click **"Install App"** button for standalone desktop/mobile installation.
5. **Executive Dashboard (`#dashboard`)**
   * Personalized greeting, 6 dynamic KPI cards, live 7-day Chart.js Weekly Productivity & Task Completion charts, 1-click Priority Task checklist, Upcoming Deadlines countdown, Recent Projects cards, and live Activity Feed.
6. **Project Management & Project Details (`#projects`, `#project-details`)**
   * Cards Grid & Responsive Table view toggle, full CRUD, multi-member assignment, Archive & Restore workflow, Status/Priority filters, sorting, and a dedicated Project Details view with auto-synced completion progress.
7. **Task Management System (`#tasks`)**
   * List & Table views, full CRUD modal, standalone or project-linked tasks, custom labels, interactive **Subtask Checklists** with live progress bars, inline status switching, multi-facet filtering, and sorting.
8. **Interactive Kanban Board (`#kanban`)**
   * 4 workflow columns (`To Do`, `In Progress`, `In Review`, `Completed`) powered by the native **HTML5 Drag and Drop API**, drop-zone highlights, live column counts, quick team avatar filters, and instant persistence.
9. **Interactive Calendar (`#calendar`)**
   * Custom-built **Monthly, Weekly, and Daily** calendar views displaying Task due dates and Project milestones, Prev/Today/Next navigation, event filtering, 1-click task scheduling on any date, and an Upcoming Deadlines sidebar.
10. **Team Management (`#team`)**
    * Team directory in Cards and Table views, role/department filtering, live workload utilization bars, one-click email copy, direct task assignment, and Add/Edit/Remove member modals.
11. **Notification Center (`#notifications`)**
    * Topbar notification popover + full Notification Center with category tabs (`All`, `Unread`, `Assignments`, `Deadlines & Overdue`, `Projects`, `Completed`), mark read/unread, mark all read, and automated CRUD event triggers.
12. **Analytics & CSV Reports (`#analytics`)**
    * 4 dynamic Chart.js visualizations (Weekly/Monthly Productivity, Projects by Status, Tasks by Priority, Team Workload), Overdue Task Analytics, Date Range filtering, and RFC-4180 **CSV Report Export**.
13. **Settings & User Profile (`#settings`, `#profile`)**
    * Persistent Light (**Warm Ivory Glass**) & Dark (**Obsidian Teal Glass**) themes, global Date Format selector, Notification & Compact Mode toggles, live Avatar URL/color preview, Workspace JSON backup export, and Clear Workspace Data.

---

## Design System

| Token | Light Mode (Warm Ivory Glass) | Dark Mode (Obsidian Teal Glass) | Usage |
| :--- | :--- | :--- | :--- |
| **Background Canvas** | `#F3EEE8` | `#0D1716` | Main workspace backdrop with ambient mesh orbs |
| **Primary Brand** | `#17645F` | `#269B93` | Sidebar active states, primary CTAs, progress fills |
| **Accent / Action** | `#FF6845` | `#FF7857` | High-priority badges, "+ New Task" CTAs, unread dots |
| **Glass Surface** | `rgba(255, 255, 255, 0.68)` | `rgba(22, 38, 36, 0.68)` | Frosted cards with `backdrop-filter: blur(16px)` |
| **Typography** | Plus Jakarta Sans & JetBrains Mono | Plus Jakarta Sans & JetBrains Mono | Clean commercial SaaS hierarchy |

---

## Folder Structure

```text
nexora/
├── index.html
├── login.html
├── signup.html
├── manifest.json
├── sw.js
├── README.md
├── assets/
│   ├── icons/
│   │   └── icon.svg
│   └── images/
├── css/
│   ├── variables.css
│   ├── style.css
│   ├── dashboard.css
│   ├── components.css
│   ├── forms.css
│   ├── kanban.css
│   ├── calendar.css
│   ├── analytics.css
│   └── responsive.css
└── js/
    ├── app.js
    ├── auth.js
    ├── storage.js
    ├── utils.js
    ├── dashboard.js
    ├── projects.js
    ├── tasks.js
    ├── kanban.js
    ├── calendar.js
    ├── team.js
    ├── notifications.js
    ├── analytics.js
    ├── search.js
    ├── settings.js
    ├── tutorial.js
    ├── shortcuts.js
    └── pwa.js