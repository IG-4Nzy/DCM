// @ts-nocheck
import request from '../../services/request';

const BMS_CHECKLIST_API = '/api/bms-checklists';
const BMS_CHECKLIST_CONFIG_API = '/api/bms-checklist-config';

// ─── BMS Checklist CRUD ───

export async function fetchBMSChecklists(params: {
  status?: string;
  preparedBy?: string;
  department?: string;
  date?: string;
  skip?: number;
  limit?: number;
} = {}) {
  const queryParams = new URLSearchParams();
  if (params.status) queryParams.append('status', params.status);
  if (params.preparedBy) queryParams.append('preparedBy', params.preparedBy);
  if (params.department) queryParams.append('department', params.department);
  if (params.date) queryParams.append('date', params.date);
  if (params.skip !== undefined) queryParams.append('skip', String(params.skip));
  if (params.limit !== undefined) queryParams.append('limit', String(params.limit));

  const res = await request.get(`${BMS_CHECKLIST_API}?${queryParams.toString()}`);
  return res.data;
}

export async function createBMSChecklist(payload: any) {
  const res = await request.post(BMS_CHECKLIST_API, payload);
  return res.data;
}

export async function updateBMSChecklist(id: string, payload: any) {
  const res = await request.put(`${BMS_CHECKLIST_API}/${id}`, payload);
  return res.data;
}

export async function deleteBMSChecklist(id: string) {
  const res = await request.delete(`${BMS_CHECKLIST_API}/${id}`);
  return res.data;
}

// ─── BMS Checklist Config CRUD ───

export async function fetchBMSChecklistConfig(params: {
  department?: string;
} = {}) {
  const queryParams = new URLSearchParams();
  if (params.department) queryParams.append('department', params.department);

  const res = await request.get(`${BMS_CHECKLIST_CONFIG_API}?${queryParams.toString()}`);
  return res.data;
}

export async function saveBMSChecklistConfig(payload: {
  department: string;
  template: any;
}) {
  const res = await request.post(BMS_CHECKLIST_CONFIG_API, payload);
  return res.data;
}
