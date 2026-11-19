/* ==========================================================================
   Nexora - FRESH LOCALSTORAGE PERSISTENCE ENGINE (NO DUMMY DATA)
   Every new user starts with a clean workspace and stores their own data.
   ========================================================================== */

import { generateId } from './utils.js';

const KEYS = {
  USERS: 'Nexora_users',
  SESSION: 'Nexora_session',
  PROJECTS: 'Nexora_projects',
  TASKS: 'Nexora_tasks',
  TEAM: 'Nexora_team',
  NOTIFICATIONS: 'Nexora_notifications',
  ACTIVITIES: 'Nexora_activities',
  SETTINGS: 'Nexora_settings',
  FRESH_VERSION: 'Nexora_fresh_v2'
};

function offsetDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function getInitials(name = 'User') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const DEFAULT_SETTINGS = {
  theme: 'light',
  dateFormat: 'MMM DD, YYYY',
  emailNotifications: true,
  deadlineReminders: true,
  overdueAlerts: true,
  compactMode: false,
  tutorialCompleted: false
};

export const StorageService = {
  /**
   * Initializes a completely fresh, empty workspace.
   * Automatically clears legacy v1 demo data once on upgrade.
   */
  init() {
    if (!localStorage.getItem(KEYS.FRESH_VERSION)) {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(KEYS.USERS, JSON.stringify([]));
      localStorage.setItem(KEYS.TEAM, JSON.stringify([]));
      localStorage.setItem(KEYS.PROJECTS, JSON.stringify([]));
      localStorage.setItem(KEYS.TASKS, JSON.stringify([]));
      localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify([]));
      localStorage.setItem(KEYS.ACTIVITIES, JSON.stringify([]));
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      localStorage.setItem(KEYS.FRESH_VERSION, 'true');
    }
  },

  /**
   * Wipes all projects, tasks, notifications & activities while keeping the logged-in user
   */
  clearWorkspaceData() {
    const currentUser = this.getCurrentUser();
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify([]));
    localStorage.setItem(KEYS.TASKS, JSON.stringify([]));
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify([]));
    localStorage.setItem(KEYS.ACTIVITIES, JSON.stringify([]));

    if (currentUser) {
      const ownerMember = {
        id: generateId('mem'),
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role || 'Workspace Owner',
        department: 'Product',
        avatar: currentUser.avatar || getInitials(currentUser.name),
        avatarColor: currentUser.avatarColor || '#17645F'
      };
      localStorage.setItem(KEYS.TEAM, JSON.stringify([ownerMember]));
      this.addNotification('Workspace Cleared', 'All previous projects and tasks were deleted. Ready for a fresh start!', 'project');
    } else {
      localStorage.setItem(KEYS.TEAM, JSON.stringify([]));
    }
    this.emitChange();
  },

  /**
   * Complete factory reset including accounts and session
   */
  resetDemoData() {
    localStorage.clear();
    sessionStorage.clear();
    this.init();
    window.location.href = 'login.html';
  },

  emitChange() {
    window.dispatchEvent(new CustomEvent('Nexora:data-updated'));
  },

  get(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    this.emitChange();
  },

  /**
   * Returns the team member ID belonging to the currently logged-in user
   */
  getDefaultMemberId() {
    const user = this.getCurrentUser();
    const team = this.getTeam();
    if (user) {
      const match = team.find(m => m.email.toLowerCase() === user.email.toLowerCase());
      if (match) return match.id;
    }
    return team[0]?.id || '';
  },

  /* ==================== USERS, AUTH & PROFILE SYNC ==================== */
  getUsers() {
    return this.get(KEYS.USERS, []);
  },

  findUserByEmail(email = '') {
    const normalized = String(email).trim().toLowerCase();
    return this.getUsers().find(u => u.email.toLowerCase() === normalized) || null;
  },

  authenticateUser(email, password) {
    const user = this.findUserByEmail(email);
    if (!user || user.password !== password) return null;
    return user;
  },

  registerUser({ name, email, password, role }) {
    const users = this.getUsers();
    const avatar = getInitials(name);
    const colors = ['#17645F', '#FF6845', '#16A36A', '#F59E0B'];
    const avatarColor = colors[users.length % colors.length];

    const newUser = {
      id: generateId('usr'),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: role || 'Workspace Owner',
      avatar,
      avatarColor,
      avatarUrl: '',
      bio: `${role || 'Workspace Member'} organizing projects in Nexora.`,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));

    // Add newly registered user to Team roster automatically
    const team = this.getTeam();
    if (!team.some(m => m.email.toLowerCase() === newUser.email)) {
      team.push({
        id: generateId('mem'),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: 'Product',
        avatar: newUser.avatar,
        avatarColor: newUser.avatarColor
      });
      localStorage.setItem(KEYS.TEAM, JSON.stringify(team));
    }

    // Trigger tutorial for brand-new users
    const settings = this.getSettings();
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify({ ...settings, tutorialCompleted: false }));

    this.addNotification('Welcome to Nexora!', `Hi ${newUser.name}, your fresh workspace is ready. Create your first project to begin!`, 'project');
    this.emitChange();
    return newUser;
  },

  /**
   * Launches a Guest session in SessionStorage only (auto-logs out when app closes).
   * Projects, tasks, and settings still stay safely saved in LocalStorage.
   */
  createFreshGuestSession() {
    const existingGuest = this.findUserByEmail('guest@Nexora.local');
    if (existingGuest) {
      this.setCurrentUser(existingGuest, false);
      return existingGuest;
    }
    const guestUser = this.registerUser({
      name: 'Guest Workspace',
      email: 'guest@Nexora.local',
      password: 'GuestPassword123!',
      role: 'Workspace Owner' 
    });
    this.setCurrentUser(guestUser, false);
    return guestUser;
  },

  getCurrentUser() {
    try {
      const sessionRaw = sessionStorage.getItem(KEYS.SESSION) || localStorage.getItem(KEYS.SESSION);
      return sessionRaw ? JSON.parse(sessionRaw) : null;
    } catch {
      return null;
    }
  },

  setCurrentUser(user, remember = true) {
    const safeSessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar || getInitials(user.name),
      avatarColor: user.avatarColor || '#17645F',
      avatarUrl: user.avatarUrl || '',
      bio: user.bio || ''
    };
    if (remember) {
      localStorage.setItem(KEYS.SESSION, JSON.stringify(safeSessionUser));
      sessionStorage.removeItem(KEYS.SESSION);
    } else {
      sessionStorage.setItem(KEYS.SESSION, JSON.stringify(safeSessionUser));
      localStorage.removeItem(KEYS.SESSION);
    }
    this.emitChange();
  },

  updateCurrentUserProfile(updates) {
    const current = this.getCurrentUser();
    if (!current) return null;

    const oldEmail = current.email.toLowerCase();
    const nextName = updates.name ? updates.name.trim() : current.name;
    const nextEmail = updates.email ? updates.email.trim().toLowerCase() : current.email;
    const nextRole = updates.role ? updates.role.trim() : current.role;
    const nextAvatar = getInitials(nextName);
    const nextColor = updates.avatarColor || current.avatarColor || '#17645F';
    const nextAvatarUrl = updates.avatarUrl !== undefined ? updates.avatarUrl.trim() : (current.avatarUrl || '');
    const nextBio = updates.bio !== undefined ? updates.bio.trim() : (current.bio || '');

    const updatedUser = {
      ...current,
      name: nextName,
      email: nextEmail,
      role: nextRole,
      avatar: nextAvatar,
      avatarColor: nextColor,
      avatarUrl: nextAvatarUrl,
      bio: nextBio
    };

    const users = this.getUsers().map(u =>
      (u.id === current.id || u.email.toLowerCase() === oldEmail)
        ? { ...u, ...updatedUser }
        : u
    );
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));

    const team = this.getTeam().map(m =>
      m.email.toLowerCase() === oldEmail
        ? { ...m, name: nextName, email: nextEmail, role: nextRole, avatar: nextAvatar, avatarColor: nextColor }
        : m
    );
    localStorage.setItem(KEYS.TEAM, JSON.stringify(team));

    const isSessionStorage = Boolean(sessionStorage.getItem(KEYS.SESSION));
    this.setCurrentUser(updatedUser, !isSessionStorage);
    this.logActivity('updated profile settings for', nextName);
    return updatedUser;
  },

  clearSession() {
    localStorage.removeItem(KEYS.SESSION);
    sessionStorage.removeItem(KEYS.SESSION);
  },

  /* ==================== PROJECTS CRUD ==================== */
  getProjects() {
    return this.get(KEYS.PROJECTS, []);
  },

  getProjectById(projectId) {
    return this.getProjects().find(p => p.id === projectId) || null;
  },

  saveProjects(projects) {
    this.set(KEYS.PROJECTS, projects);
  },

  addProject(projectData) {
    const projects = this.getProjects();
    const status = projectData.status || 'Planning';
    const defaultMemberId = this.getDefaultMemberId();

    const newProject = {
      id: generateId('prj'),
      name: String(projectData.name || '').trim(),
      description: String(projectData.description || '').trim(),
      status,
      priority: projectData.priority || 'Medium',
      startDate: projectData.startDate || new Date().toISOString().split('T')[0],
      dueDate: projectData.dueDate || offsetDate(14),
      members: Array.isArray(projectData.members) && projectData.members.length
        ? projectData.members
        : (defaultMemberId ? [defaultMemberId] : []),
      progress: status === 'Completed' ? 100 : Number(projectData.progress ?? 0),
      archived: false,
      createdAt: new Date().toISOString()
    };
    projects.unshift(newProject);
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
    this.logActivity('created project', newProject.name);
    this.addNotification('New Project Created', `"${newProject.name}" has been added to the workspace.`, 'project');
    this.emitChange();
    return newProject;
  },

  updateProject(projectId, updates) {
    const projects = this.getProjects();
    let updatedProject = null;

    const nextProjects = projects.map(p => {
      if (p.id !== projectId) return p;
      const merged = { ...p, ...updates };
      if (updates.status === 'Completed') {
        merged.progress = 100;
      } else if (updates.progress !== undefined) {
        merged.progress = Math.min(100, Math.max(0, Number(updates.progress)));
      }
      updatedProject = merged;
      return merged;
    });

    if (updatedProject) {
      localStorage.setItem(KEYS.PROJECTS, JSON.stringify(nextProjects));
      this.logActivity('updated project', updatedProject.name);
      this.addNotification('Project Updated', `"${updatedProject.name}" details were updated.`, 'project');
      this.emitChange();
    }
    return updatedProject;
  },

  toggleArchiveProject(projectId) {
    const projects = this.getProjects();
    let target = null;

    const nextProjects = projects.map(p => {
      if (p.id !== projectId) return p;
      target = { ...p, archived: !Boolean(p.archived) };
      return target;
    });

    if (target) {
      localStorage.setItem(KEYS.PROJECTS, JSON.stringify(nextProjects));
      this.logActivity(target.archived ? 'archived project' : 'restored project', target.name);
      this.addNotification(
        target.archived ? 'Project Archived' : 'Project Restored',
        `"${target.name}" was ${target.archived ? 'moved to archives' : 'restored to active portfolio'}.`,
        'project'
      );
      this.emitChange();
    }
    return target;
  },

  deleteProject(projectId) {
    const project = this.getProjectById(projectId);
    if (!project) return false;

    const remainingProjects = this.getProjects().filter(p => p.id !== projectId);
    const remainingTasks = this.getTasks().filter(t => t.projectId !== projectId);

    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(remainingProjects));
    localStorage.setItem(KEYS.TASKS, JSON.stringify(remainingTasks));

    this.logActivity('deleted project', project.name);
    this.addNotification('Project Deleted', `"${project.name}" and its tasks were removed.`, 'project');
    this.emitChange();
    return true;
  },

  syncProjectProgress(projectId) {
    if (!projectId) return;
    const tasks = this.getTasks().filter(t => t.projectId === projectId);
    if (tasks.length === 0) return;

    const completedCount = tasks.filter(t => t.status === 'Completed').length;
    const progress = Math.round((completedCount / tasks.length) * 100);

    const projects = this.getProjects().map(p => {
      if (p.id !== projectId) return p;
      const updatedStatus = progress === 100 ? 'Completed' : (p.status === 'Completed' ? 'Active' : p.status);
      return { ...p, progress, status: updatedStatus };
    });

    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
  },

  /* ==================== TASKS CRUD ==================== */
  getTasks() {
    return this.get(KEYS.TASKS, []);
  },

  getTaskById(taskId) {
    return this.getTasks().find(t => t.id === taskId) || null;
  },

  saveTasks(tasks) {
    this.set(KEYS.TASKS, tasks);
  },

  addTask(taskData) {
    const tasks = this.getTasks();
    const assignedId = taskData.assignedTo || this.getDefaultMemberId();
    const assignee = this.getMemberById(assignedId);

    const newTask = {
      id: generateId('tsk'),
      title: String(taskData.title || '').trim(),
      description: String(taskData.description || '').trim(),
      projectId: taskData.projectId ?? '',
      assignedTo: assignedId,
      status: taskData.status || 'To Do',
      priority: taskData.priority || 'Medium',
      dueDate: taskData.dueDate || offsetDate(5),
      labels: taskData.labels || ['General'],
      subtasks: taskData.subtasks || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    tasks.unshift(newTask);
    localStorage.setItem(KEYS.TASKS, JSON.stringify(tasks));
    if (newTask.projectId) this.syncProjectProgress(newTask.projectId);
    this.logActivity('created task', newTask.title);
    this.addNotification(
      'New Task Created',
      `"${newTask.title}" assigned to ${assignee ? assignee.name : 'your workspace'}.`,
      'assignment'
    );
    this.emitChange();
    return newTask;
  },

  updateTask(taskId, updates) {
    const tasks = this.getTasks();
    let updatedTask = null;

    const nextTasks = tasks.map(t => {
      if (t.id !== taskId) return t;
      updatedTask = { ...t, ...updates, updatedAt: new Date().toISOString() };
      return updatedTask;
    });

    if (updatedTask) {
      localStorage.setItem(KEYS.TASKS, JSON.stringify(nextTasks));
      if (updatedTask.projectId) this.syncProjectProgress(updatedTask.projectId);
      this.logActivity('updated task', updatedTask.title);
      this.emitChange();
    }
    return updatedTask;
  },

  deleteTask(taskId) {
    const task = this.getTaskById(taskId);
    if (!task) return false;
    const remaining = this.getTasks().filter(t => t.id !== taskId);
    localStorage.setItem(KEYS.TASKS, JSON.stringify(remaining));
    if (task.projectId) this.syncProjectProgress(task.projectId);
    this.logActivity('deleted task', task.title);
    this.emitChange();
    return true;
  },

  toggleTaskCompletion(taskId) {
    const tasks = this.getTasks();
    let toggledTask = null;

    const updatedTasks = tasks.map(t => {
      if (t.id !== taskId) return t;
      const nextStatus = t.status === 'Completed' ? 'To Do' : 'Completed';
      toggledTask = { ...t, status: nextStatus, updatedAt: new Date().toISOString() };
      return toggledTask;
    });

    if (toggledTask) {
      localStorage.setItem(KEYS.TASKS, JSON.stringify(updatedTasks));
      if (toggledTask.projectId) this.syncProjectProgress(toggledTask.projectId);
      const verb = toggledTask.status === 'Completed' ? 'completed task' : 'reopened task';
      this.logActivity(verb, toggledTask.title);

      if (toggledTask.status === 'Completed') {
        this.addNotification('Task Completed', `"${toggledTask.title}" was marked as completed.`, 'completion');
      }
      this.emitChange();
    }
    return toggledTask;
  },

  /* ==================== TEAM MANAGEMENT CRUD ==================== */
  getTeam() {
    return this.get(KEYS.TEAM, []);
  },

  getMemberById(memberId) {
    return this.getTeam().find(m => m.id === memberId) || null;
  },

  addTeamMember(memberData) {
    const team = this.getTeam();
    const name = String(memberData.name || '').trim();
    const newMember = {
      id: generateId('mem'),
      name,
      email: String(memberData.email || '').trim().toLowerCase(),
      role: String(memberData.role || 'Team Member').trim(),
      department: memberData.department || 'Engineering',
      avatar: getInitials(name),
      avatarColor: memberData.avatarColor || '#17645F'
    };

    team.push(newMember);
    localStorage.setItem(KEYS.TEAM, JSON.stringify(team));
    this.logActivity('added team member', `${newMember.name} (${newMember.role})`);
    this.addNotification('New Team Member Added', `${newMember.name} joined as ${newMember.role}.`, 'assignment');
    this.emitChange();
    return newMember;
  },

  updateTeamMember(memberId, updates) {
    const team = this.getTeam();
    let updatedMember = null;

    const nextTeam = team.map(m => {
      if (m.id !== memberId) return m;
      const nextName = updates.name ? updates.name.trim() : m.name;
      updatedMember = {
        ...m,
        ...updates,
        name: nextName,
        avatar: getInitials(nextName)
      };
      return updatedMember;
    });

    if (updatedMember) {
      localStorage.setItem(KEYS.TEAM, JSON.stringify(nextTeam));
      this.logActivity('updated team profile for', updatedMember.name);
      this.emitChange();
    }
    return updatedMember;
  },

  deleteTeamMember(memberId) {
    const member = this.getMemberById(memberId);
    if (!member) return false;

    const remainingTeam = this.getTeam().filter(m => m.id !== memberId);
    const fallbackId = remainingTeam[0]?.id || '';

    const updatedTasks = this.getTasks().map(t =>
      t.assignedTo === memberId ? { ...t, assignedTo: fallbackId } : t
    );
    const updatedProjects = this.getProjects().map(p => ({
      ...p,
      members: (p.members || []).filter(id => id !== memberId)
    }));

    localStorage.setItem(KEYS.TEAM, JSON.stringify(remainingTeam));
    localStorage.setItem(KEYS.TASKS, JSON.stringify(updatedTasks));
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(updatedProjects));

    this.logActivity('removed team member', member.name);
    this.emitChange();
    return true;
  },

  /* ==================== NOTIFICATIONS & ACTIVITIES ==================== */
  getNotifications() {
    return this.get(KEYS.NOTIFICATIONS, []);
  },

  addNotification(title, message, type = 'project') {
    const list = this.getNotifications();
    list.unshift({
      id: generateId('ntf'),
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(list));
  },

  markNotificationRead(notifId, readState = true) {
    const list = this.getNotifications().map(n =>
      n.id === notifId ? { ...n, read: Boolean(readState) } : n
    );
    this.set(KEYS.NOTIFICATIONS, list);
  },

  markAllNotificationsRead() {
    const list = this.getNotifications().map(n => ({ ...n, read: true }));
    this.set(KEYS.NOTIFICATIONS, list);
  },

  deleteNotification(notifId) {
    const list = this.getNotifications().filter(n => n.id !== notifId);
    this.set(KEYS.NOTIFICATIONS, list);
  },

  clearReadNotifications() {
    const list = this.getNotifications().filter(n => !n.read);
    this.set(KEYS.NOTIFICATIONS, list);
  },

  getActivities() {
    return this.get(KEYS.ACTIVITIES, []);
  },

  logActivity(action, target) {
    const user = this.getCurrentUser();
    const activities = this.getActivities();
    activities.unshift({
      id: generateId('act'),
      actor: user ? user.name : 'Workspace User',
      action,
      target,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem(KEYS.ACTIVITIES, JSON.stringify(activities.slice(0, 30)));
  },

  /* ==================== SETTINGS ==================== */
  getSettings() {
    return this.get(KEYS.SETTINGS, DEFAULT_SETTINGS);
  },

  updateSettings(partial) {
    const current = this.getSettings();
    const updated = { ...current, ...partial };
    this.set(KEYS.SETTINGS, updated);
    return updated;
  }
};