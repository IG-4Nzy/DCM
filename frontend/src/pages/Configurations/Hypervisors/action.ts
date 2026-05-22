import request from '../../../services/request';
import { type HypervisorData, type CreateHypervisorPayload, type UpdateHypervisorPayload } from './model';

const ENDPOINT = '/api/hypervisors';

export const fetchHypervisors = async (params: { skip?: number, limit?: number, sortBy?: string, order?: string, search?: string, pagination?: boolean }): Promise<{data: HypervisorData[], total: number}> => {
    const { skip = 0, limit = 10, sortBy = 'hypervisor', order = 'asc', search = '', pagination = true } = params;
    const res = await request.get(ENDPOINT, { params: { skip, limit, sort_by: sortBy, order, search, pagination } });
    return res.data;
};

export const createHypervisor = async (payload: CreateHypervisorPayload): Promise<HypervisorData> => {
    const res = await request.post(`${ENDPOINT}/`, payload);
    return res.data;
};

export const updateHypervisor = async (payload: UpdateHypervisorPayload): Promise<HypervisorData> => {
    const { id, ...data } = payload;
    const res = await request.put(`${ENDPOINT}/${id}`, data);
    return res.data;
};

export const deleteHypervisor = async (id: string): Promise<void> => {
    await request.delete(`${ENDPOINT}/${id}`);
};
