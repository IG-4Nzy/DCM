// localStorage-based persistence fallback for Cluster Checklists
// Structured to allow easy swap to backend API later.

import type { SavedClusterChecklist, ClusterChecklistConfig } from './config';
import { getServerTime } from '../../helpers/time';

const STORAGE_KEY = 'cluster_checklists';

function getAll(): SavedClusterChecklist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(checklists: SavedClusterChecklist[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(checklists));
}

export function generateId(): string {
  return `cluster_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function listChecklists(): SavedClusterChecklist[] {
  return getAll().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getChecklist(id: string): SavedClusterChecklist | null {
  return getAll().find(c => c.id === id) || null;
}

export function saveChecklist(checklist: SavedClusterChecklist): void {
  const all = getAll();
  const idx = all.findIndex(c => c.id === checklist.id);
  if (idx >= 0) {
    all[idx] = { ...checklist, updatedAt: getServerTime().toDate().toISOString() };
  } else {
    all.push({ ...checklist, createdAt: getServerTime().toDate().toISOString(), updatedAt: getServerTime().toDate().toISOString() });
  }
  saveAll(all);
}

export function deleteChecklist(id: string): void {
  saveAll(getAll().filter(c => c.id !== id));
}

export function createNewClusterChecklist(preparedBy: string, config: ClusterChecklistConfig, department: string, createdBy: string, customDate?: string): SavedClusterChecklist {
  const now = getServerTime().toDate();
  return {
    id: generateId(),
    date: customDate || now.toISOString().split('T')[0],
    time: now.toTimeString().split(' ')[0].substring(0, 5),
    preparedBy,
    status: 'Draft',
    data: JSON.parse(JSON.stringify(config)),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    department,
    createdBy,
  };
}
