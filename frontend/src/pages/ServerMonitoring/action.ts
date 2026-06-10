import request from '../../services/request';

export const fetchVCenters = async () => {
  const response = await request.get('/api/vcenter-details/', { params: { pagination: false } });
  console.log("vCenters API response:", response.data);
  return response.data.data || [];
};

export const fetchClusters = async () => {
  const response = await request.get('/api/clusters/', { params: { pagination: false } });
  return response.data.data || [];
};

export const fetchVCenterTelemetry = async (id: string) => {
  const response = await request.get(`/api/vcenter-details/${id}/monitor`);
  console.log("vCenter telemetry API response:", response.data);
  return response.data;
};

export const createVCenter = async (payload: any) => {
  const response = await request.post('/api/vcenter-details/', payload);
  return response.data;
};

export const fetchNodes = async () => {
  const response = await request.get('/api/node-details', { params: { pagination: false } });
  return response.data.data || [];
};

export const deleteVCenter = async (id: string) => {
  await request.delete(`/api/vcenter-details/${id}`);
};

export const fetchVCenterClustersPreview = async (payload: any) => {
  const response = await request.post('/api/vcenter-details/fetch-clusters-preview', payload);
  console.log("vCenter clusters preview API response:", response.data);
  return response.data.clusters || [];
};
