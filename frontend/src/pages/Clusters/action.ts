import request from '../../services/request';
import { type FetchClustersParams, type CreateClusterPayload, type UpdateClusterPayload } from './model';

export const fetchClusters = async (params: FetchClustersParams) => {
    const response = await request.get('/api/clusters/', { params });
    return response.data;
};

export const createCluster = async (payload: CreateClusterPayload) => {
    const response = await request.post('/api/clusters/', payload);
    return response.data;
};

export const updateCluster = async (id: string, payload: UpdateClusterPayload) => {
    const response = await request.put(`/api/clusters/${id}`, payload);
    return response.data;
};

export const deleteCluster = async (id: string) => {
    const response = await request.delete(`/api/clusters/${id}`);
    return response.data;
};

export const bulkCreateClusters = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await request.post('/api/clusters/bulk', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};
