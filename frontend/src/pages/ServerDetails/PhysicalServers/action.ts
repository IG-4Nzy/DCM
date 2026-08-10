// @ts-nocheck
import request from '../../../services/request';

export const fetchPhysicalServers = async (params: any) => {
    const response = await request.get('/api/physical-servers', { params });
    return response.data;
};

export const createPhysicalServer = async (payload: any) => {
    const response = await request.post('/api/physical-servers', payload);
    return response.data;
};

export const updatePhysicalServer = async (id: string, payload: any) => {
    const response = await request.put(`/api/physical-servers/${id}`, payload);
    return response.data;
};

export const deletePhysicalServer = async (id: string) => {
    const response = await request.delete(`/api/physical-servers/${id}`);
    return response.data;
};

export const fetchAllNodes = async (params?: any) => {
    const response = await request.get('/api/nodes/', { params: { pagination: false, ...params } });
    return response.data.data;
};
