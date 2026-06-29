// @ts-nocheck
import request from '../../../services/request';

export const fetchVMDetails = async (params: any) => {
    const response = await request.get('/api/vm-details', { params });
    return response.data;
};

export const createVMDetails = async (payload: any) => {
    const response = await request.post('/api/vm-details', payload);
    return response.data;
};

export const updateVMDetails = async (id: string, payload: any) => {
    const response = await request.put(`/api/vm-details/${id}`, payload);
    return response.data;
};

export const deleteVMDetails = async (id: string) => {
    const response = await request.delete(`/api/vm-details/${id}`);
    return response.data;
};

export const fetchAllNodes = async () => {
    const response = await request.get('/api/nodes/', { params: { pagination: false } });
    return response.data.data;
};
