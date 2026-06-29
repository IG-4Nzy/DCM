// @ts-nocheck
import request from '../../../services/request';
import { type FetchADDetailsParams, type CreateADDetailsPayload, type UpdateADDetailsPayload } from './model';

export const fetchADDetails = async (params: FetchADDetailsParams) => {
    const response = await request.get('/api/ad-details/', { params });
    return response.data;
};

export const createADDetails = async (payload: CreateADDetailsPayload) => {
    const response = await request.post('/api/ad-details/', payload);
    return response.data;
};

export const updateADDetails = async (id: string, payload: UpdateADDetailsPayload) => {
    const response = await request.put(`/api/ad-details/${id}`, payload);
    return response.data;
};

export const deleteADDetails = async (id: string) => {
    const response = await request.delete(`/api/ad-details/${id}`);
    return response.data;
};
