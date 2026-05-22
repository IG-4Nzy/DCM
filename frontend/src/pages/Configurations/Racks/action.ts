import request from '../../../services/request';
import { type ServerRackData, type CreateServerRackPayload, type UpdateServerRackPayload } from './model';

const ENDPOINT = '/api/server-racks';

export const fetchServerRacks = async (params: { skip?: number, limit?: number, sortBy?: string, order?: string, search?: string, pagination?: boolean }): Promise<{data: ServerRackData[], total: number}> => {
    const { skip = 0, limit = 10, sortBy = 'serverRack', order = 'asc', search = '', pagination = true } = params;
    const res = await request.get(ENDPOINT, { params: { skip, limit, sort_by: sortBy, order, search, pagination } });
    return res.data;
};

export const createServerRack = async (payload: CreateServerRackPayload): Promise<ServerRackData> => {
    const res = await request.post(`${ENDPOINT}/`, payload);
    return res.data;
};

export const updateServerRack = async (payload: UpdateServerRackPayload): Promise<ServerRackData> => {
    const { id, ...data } = payload;
    const res = await request.put(`${ENDPOINT}/${id}`, data);
    return res.data;
};

export const deleteServerRack = async (id: string): Promise<void> => {
    await request.delete(`${ENDPOINT}/${id}`);
};
