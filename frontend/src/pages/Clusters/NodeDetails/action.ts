import request from '../../../services/request';
import { type NodeDetailsData, type CreateNodeDetailsPayload, type UpdateNodeDetailsPayload } from './model';

const ENDPOINT = '/api/node-details';

export const fetchNodeDetails = async (params: { clusterId: string, skip?: number, limit?: number, sortBy?: string, order?: string, search?: string, pagination?: boolean }): Promise<{data: NodeDetailsData[], total: number}> => {
    const { clusterId, skip = 0, limit = 10, sortBy = 'slNumber', order = 'asc', search = '', pagination = true } = params;
    const res = await request.get(ENDPOINT, { params: { clusterId, skip, limit, sort_by: sortBy, order, search, pagination } });
    return res.data;
};

export const createNodeDetails = async (payload: CreateNodeDetailsPayload): Promise<NodeDetailsData> => {
    const res = await request.post(`${ENDPOINT}/`, payload);
    return res.data;
};

export const updateNodeDetails = async (payload: UpdateNodeDetailsPayload): Promise<NodeDetailsData> => {
    const { id, ...data } = payload;
    const res = await request.put(`${ENDPOINT}/${id}`, data);
    return res.data;
};

export const deleteNodeDetails = async (id: string): Promise<void> => {
    await request.delete(`${ENDPOINT}/${id}`);
};
