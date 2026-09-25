/**
 * Sync Service — Frontend
 * 
 * Handles synchronization between local backend and Turso cloud.
 * Auto-syncs on startup and periodically.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.syncInterval = null;
    this.listeners = new Set();
  }

  /**
   * Subscribe to sync status changes
   */
  onStatusChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  notifyListeners(status) {
    this.listeners.forEach(cb => cb(status));
  }

  /**
   * Get auth headers
   */
  getHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  /**
   * Get sync status
   */
  async getStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/sync/status`, {
        headers: this.getHeaders()
      });
      const data = await res.json();
      return data.success ? data.data : null;
    } catch {
      return null;
    }
  }

  /**
   * Get cloud status (Proyecto 2: diagnóstico pre-bootstrap).
   * Indica si la nube Turso está vacía antes de la primera sincronización.
   * Solo lectura; nunca inicia sync.
   */
  async getCloudStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/sync/cloud-status`, {
        headers: this.getHeaders()
      });
      const data = await res.json();
      return data.success ? data.data : null;
    } catch {
      return null;
    }
  }

  /**
   * Push local changes to Turso.
   * admitLocalPush=true solo para primera carga explícita (wizard Proyecto 2):
   * el backend valida bootstrap pendiente + escenario A2 + permisos + colisiones.
   * Por defecto false: comportamiento incremental normal sin cambios.
   */
  async push(since = null, admitLocalPush = false) {
    this.isSyncing = true;
    this.notifyListeners({ syncing: true });

    try {
      const res = await fetch(`${API_BASE}/api/sync/push`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ since, admitLocalPush })
      });
      const data = await res.json();
      this.isSyncing = false;
      this.notifyListeners({ syncing: false, lastResult: data });
      return data;
    } catch (error) {
      this.isSyncing = false;
      this.notifyListeners({ syncing: false, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Pull remote changes from Turso
   */
  async pull(since = null) {
    this.isSyncing = true;
    this.notifyListeners({ syncing: true });

    try {
      const res = await fetch(`${API_BASE}/api/sync/pull`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ since })
      });
      const data = await res.json();
      this.isSyncing = false;
      this.notifyListeners({ syncing: false, lastResult: data });
      return data;
    } catch (error) {
      this.isSyncing = false;
      this.notifyListeners({ syncing: false, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Full bidirectional sync
   */
  async fullSync() {
    this.isSyncing = true;
    this.notifyListeners({ syncing: true });

    try {
      const res = await fetch(`${API_BASE}/api/sync/full`, {
        method: 'POST',
        headers: this.getHeaders()
      });
      const data = await res.json();
      this.isSyncing = false;
      this.notifyListeners({ syncing: false, lastResult: data });
      return data;
    } catch (error) {
      this.isSyncing = false;
      this.notifyListeners({ syncing: false, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Start periodic sync (every 5 minutes)
   */
  startAutoSync(intervalMs = 300000) {
    this.stopAutoSync();
    this.syncInterval = setInterval(() => {
      if (!this.isSyncing) {
        this.fullSync();
      }
    }, intervalMs);
  }

  /**
   * Stop periodic sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

export const syncService = new SyncService();
export default syncService;
