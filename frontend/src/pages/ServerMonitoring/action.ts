// @ts-nocheck
import request from '../../services/request';

export const fetchVCenters = async () => {
  const response = await request.get('/api/vcenter-details/', { params: { pagination: false } });
  return response.data.data || [];
};

export const fetchClusters = async () => {
  const response = await request.get('/api/clusters/', { params: { pagination: false } });
  return response.data.data || [];
};

export const fetchVCenterTelemetry = async (id: string) => {
  const response = await request.get(`/api/vcenter-details/${id}/monitor`);
  return response.data;
};

export const createVCenter = async (payload: any) => {
  const response = await request.post('/api/vcenter-details/', payload);
  return response.data;
};

export const fetchNodes = async () => {
  const response = await request.get('/api/node-details/', { params: { pagination: false } });
  return response.data.data || [];
};

export const deleteVCenter = async (id: string) => {
  await request.delete(`/api/vcenter-details/${id}`);
};

export const fetchVCenterClustersPreview = async (payload: any) => {
  const response = await request.post('/api/vcenter-details/fetch-clusters-preview', payload);
  return response.data.clusters || [];
};

export const triggerManualVCenterRefresh = async (id: string) => {
  const response = await request.post(`/api/vcenter-details/${id}/refresh`, {}, { timeout: 30000 });
  return response.data;
};

export const triggerManualRefreshAllVCenters = async () => {
  const response = await request.post('/api/vcenter-details/refresh-all', {}, { timeout: 30000 });
  return response.data;
};

export const fetchVCenterConfig = async () => {
  const response = await request.get('/api/vcenter-details/config');
  return response.data;
};
