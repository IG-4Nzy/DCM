import request from '../../../services/request';

const MORNING_CHECKLIST_API = '/api/morning-checklists';
const MORNING_CHECKLIST_CONFIG_API = '/api/morning-checklist-config';

// ─── Morning Checklist CRUD ───

export async function fetchMorningChecklists(params: {
  date?: string;
  department?: string;
  status?: string;
  preparedBy?: string;
  month?: string;
  skip?: number;
  limit?: number;
} = {}) {
  const queryParams = new URLSearchParams();
  if (params.date) queryParams.append('date', params.date);
  if (params.department) queryParams.append('department', params.department);
  if (params.status) queryParams.append('status', params.status);
  if (params.preparedBy) queryParams.append('preparedBy', params.preparedBy);
  if (params.month) queryParams.append('month', params.month);
  if (params.skip !== undefined) queryParams.append('skip', String(params.skip));
  if (params.limit !== undefined) queryParams.append('limit', String(params.limit));

  const res = await request.get(`${MORNING_CHECKLIST_API}?${queryParams.toString()}`);
  return res.data;
}

export async function createMorningChecklist(payload: any) {
  const res = await request.post(MORNING_CHECKLIST_API, payload);
  return res.data;
}

export async function updateMorningChecklist(id: string, payload: any) {
  const res = await request.put(`${MORNING_CHECKLIST_API}/${id}`, payload);
  return res.data;
}

export async function deleteMorningChecklist(id: string) {
  const res = await request.delete(`${MORNING_CHECKLIST_API}/${id}`);
  return res.data;
}

// ─── Morning Checklist Config CRUD ───

export async function fetchMorningChecklistConfig(params: {
  pagination?: boolean;
  skip?: number;
  limit?: number;
} = {}) {
  const queryParams = new URLSearchParams();
  if (params.pagination !== undefined) queryParams.append('pagination', String(params.pagination));
  if (params.skip !== undefined) queryParams.append('skip', String(params.skip));
  if (params.limit !== undefined) queryParams.append('limit', String(params.limit));

  const res = await request.get(`${MORNING_CHECKLIST_CONFIG_API}?${queryParams.toString()}`);
  return res.data;
}

export async function createMorningChecklistConfigField(payload: any) {
  const res = await request.post(MORNING_CHECKLIST_CONFIG_API, payload);
  return res.data;
}

export async function updateMorningChecklistConfigField(id: string, payload: any) {
  const res = await request.put(`${MORNING_CHECKLIST_CONFIG_API}/${id}`, payload);
  return res.data;
}

export async function deleteMorningChecklistConfigField(id: string) {
  const res = await request.delete(`${MORNING_CHECKLIST_CONFIG_API}/${id}`);
  return res.data;
}
