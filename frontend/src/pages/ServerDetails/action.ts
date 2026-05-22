import request from '../../services/request';
import { type ServerDetailsData, type CreateServerDetailsPayload, type UpdateServerDetailsPayload } from './model';

const ENDPOINT = '/api/server-details';

export const fetchServerDetails = async (params: { skip?: number, limit?: number, sortBy?: string, order?: string, search?: string, pagination?: boolean }): Promise<{data: ServerDetailsData[], total: number}> => {
    const { skip = 0, limit = 10, sortBy = 'slNumber', order = 'asc', search = '', pagination = true } = params;
    const res = await request.get(ENDPOINT, { params: { skip, limit, sort_by: sortBy, order, search, pagination } });
    return res.data;
};

export const createServerDetails = async (payload: CreateServerDetailsPayload): Promise<ServerDetailsData> => {
    const res = await request.post(`${ENDPOINT}/`, payload);
    return res.data;
};

export const updateServerDetails = async (payload: UpdateServerDetailsPayload): Promise<ServerDetailsData> => {
    const { id, ...data } = payload;
    const res = await request.put(`${ENDPOINT}/${id}`, data);
    return res.data;
};

export const deleteServerDetails = async (id: string): Promise<void> => {
    await request.delete(`${ENDPOINT}/${id}`);
};
