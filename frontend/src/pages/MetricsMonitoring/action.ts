// @ts-nocheck
import request from '../../services/request';

const BASE = '/api/metrics-monitoring';

// ── Applications ──

export const fetchApplications = async (params: { skip?: number; limit?: number; search?: string }) => {
  const response = await request.get(`${BASE}/`, { params });
  return response.data;
};

export const createApplication = async (payload: { name: string; description?: string; targets?: any[] }) => {
  const response = await request.post(`${BASE}/`, payload);
  return response.data;
};

export const getApplication = async (id: string) => {
  const response = await request.get(`${BASE}/${id}`);
  return response.data;
};

export const updateApplication = async (id: string, payload: { name?: string; description?: string }) => {
  const response = await request.put(`${BASE}/${id}`, payload);
  return response.data;
};

export const deleteApplication = async (id: string) => {
  const response = await request.delete(`${BASE}/${id}`);
  return response.data;
};

// ── Targets ──

export const addTarget = async (appId: string, payload: { ip: string; port: number; exporterType: string; monitoringTypes: string[]; label?: string }) => {
  const response = await request.post(`${BASE}/${appId}/targets`, payload);
  return response.data;
};

export const updateTarget = async (appId: string, targetIdx: number, payload: any) => {
  const response = await request.put(`${BASE}/${appId}/targets/${targetIdx}`, payload);
  return response.data;
};

export const deleteTarget = async (appId: string, targetIdx: number) => {
  const response = await request.delete(`${BASE}/${appId}/targets/${targetIdx}`);
  return response.data;
};

// ── Live Scrape ──

export const liveScrapeApplication = async (appId: string) => {
  const response = await request.get(`${BASE}/${appId}/live`, { timeout: 30000 });
  return response.data;
};

export const liveScrapeTarget = async (appId: string, targetIdx: number) => {
  const response = await request.get(`${BASE}/${appId}/targets/${targetIdx}/live`, { timeout: 15000 });
  return response.data;
};
