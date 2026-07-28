// @ts-nocheck
import request from '../../../services/request';
import { type GPUData, type CreateGPUPayload, type UpdateGPUPayload } from './model';

const ENDPOINT = '/api/gpus';

export const fetchGPUs = async (params: { skip?: number, limit?: number, sortBy?: string, order?: string, search?: string, pagination?: boolean }): Promise<{data: GPUData[], total: number}> => {
    const { skip = 0, limit = 10, sortBy = 'gpuName', order = 'asc', search = '', pagination = true } = params;
    const res = await request.get(ENDPOINT, { params: { skip, limit, sort_by: sortBy, order, search, pagination } });
    return res.data;
};

export const createGPU = async (payload: CreateGPUPayload): Promise<GPUData> => {
    const res = await request.post(`${ENDPOINT}/`, payload);
    return res.data;
};

export const updateGPU = async (payload: UpdateGPUPayload): Promise<GPUData> => {
    const { id, ...data } = payload;
    const res = await request.put(`${ENDPOINT}/${id}`, data);
    return res.data;
};

export const deleteGPU = async (id: string): Promise<void> => {
    await request.delete(`${ENDPOINT}/${id}`);
};
