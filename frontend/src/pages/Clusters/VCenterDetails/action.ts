import request from '../../../services/request';
import { type FetchVCenterDetailsParams, type CreateVCenterDetailsPayload, type UpdateVCenterDetailsPayload } from './model';

export const fetchVCenterDetails = async (params: FetchVCenterDetailsParams) => {
    const response = await request.get('/api/vcenter-details/', { params });
    return response.data;
};

export const createVCenterDetails = async (payload: CreateVCenterDetailsPayload) => {
    const response = await request.post('/api/vcenter-details/', payload);
    return response.data;
};

export const updateVCenterDetails = async (id: string, payload: UpdateVCenterDetailsPayload) => {
    const response = await request.put(`/api/vcenter-details/${id}`, payload);
    return response.data;
};

export const deleteVCenterDetails = async (id: string) => {
    const response = await request.delete(`/api/vcenter-details/${id}`);
    return response.data;
};
