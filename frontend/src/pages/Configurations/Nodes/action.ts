// @ts-nocheck
import request from '../../../services/request';
import { type NodeData, type CreateNodePayload, type UpdateNodePayload } from './model';

const ENDPOINT = '/api/nodes';

export const fetchNodes = async (params: { skip?: number, limit?: number, sortBy?: string, order?: string, search?: string, clusterId?: string, serverModel?: string, admin?: string, rack?: string, pagination?: boolean }): Promise<{data: NodeData[], total: number}> => {
    const { skip = 0, limit = 10, sortBy = 'node', order = 'asc', search = '', clusterId = '', serverModel = '', admin = '', rack = '', pagination = true } = params;
    const res = await request.get(ENDPOINT, { params: { skip, limit, sort_by: sortBy, order, search, clusterId, serverModel, admin, rack, pagination } });
    return res.data;
};

export const createNode = async (payload: CreateNodePayload): Promise<NodeData> => {
    const res = await request.post(`${ENDPOINT}/`, payload);
    return res.data;
};

export const updateNode = async (payload: UpdateNodePayload): Promise<NodeData> => {
    const { id, ...data } = payload;
    const res = await request.put(`${ENDPOINT}/${id}`, data);
    return res.data;
};

export const deleteNode = async (id: string): Promise<void> => {
    await request.delete(`${ENDPOINT}/${id}`);
};
