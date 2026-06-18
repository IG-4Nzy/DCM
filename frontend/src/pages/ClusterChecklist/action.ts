import request from '../../services/request';

const CLUSTER_CHECKLIST_API = '/api/cluster-checklists';
const CLUSTER_CHECKLIST_CONFIG_API = '/api/cluster-checklist-config';

// ─── Cluster Checklist CRUD ───

export async function fetchClusterChecklists(params: {
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

  const res = await request.get(`${CLUSTER_CHECKLIST_API}?${queryParams.toString()}`);
  return res.data;
}

export async function createClusterChecklist(payload: any) {
  const res = await request.post(CLUSTER_CHECKLIST_API, payload);
  return res.data;
}

export async function updateClusterChecklist(id: string, payload: any) {
  const res = await request.put(`${CLUSTER_CHECKLIST_API}/${id}`, payload);
  return res.data;
}

export async function deleteClusterChecklist(id: string) {
  const res = await request.delete(`${CLUSTER_CHECKLIST_API}/${id}`);
  return res.data;
}

// ─── Cluster Checklist Config CRUD ───

export async function fetchClusterChecklistConfig(params: {
  department?: string;
} = {}) {
  const queryParams = new URLSearchParams();
  if (params.department) queryParams.append('department', params.department);

  const res = await request.get(`${CLUSTER_CHECKLIST_CONFIG_API}?${queryParams.toString()}`);
  return res.data;
}

export async function saveClusterChecklistConfig(payload: {
  department: string;
  template: any;
}) {
  const res = await request.post(CLUSTER_CHECKLIST_CONFIG_API, payload);
  return res.data;
}
