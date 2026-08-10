// @ts-nocheck
import request from '../../../services/request';
import { type ServerModelData, type CreateServerModelPayload, type UpdateServerModelPayload } from './model';

const ENDPOINT = '/api/server-models';

export const fetchServerModels = async (params: { skip?: number, limit?: number, sortBy?: string, order?: string, search?: string, pagination?: boolean }): Promise<{data: ServerModelData[], total: number}> => {
    const { skip = 0, limit = 10, sortBy = 'serverModel', order = 'asc', search = '', pagination = true } = params;
    const res = await request.get(ENDPOINT, { params: { skip, limit, sort_by: sortBy, order, search, pagination } });
    return res.data;
};

export const createServerModel = async (payload: CreateServerModelPayload): Promise<ServerModelData> => {
    const res = await request.post(`${ENDPOINT}/`, payload);
    return res.data;
};

export const updateServerModel = async (payload: UpdateServerModelPayload): Promise<ServerModelData> => {
    const { id, ...data } = payload;
    const res = await request.put(`${ENDPOINT}/${id}`, data);
    return res.data;
};

export const deleteServerModel = async (id: string): Promise<void> => {
    await request.delete(`${ENDPOINT}/${id}`);
};

export const bulkCreateServerModels = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await request.post(`${ENDPOINT}/bulk`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return res.data;
};
