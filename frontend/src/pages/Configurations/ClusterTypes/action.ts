import request from '../../../services/request';
import { type ClusterTypeData,type CreateClusterTypePayload, type UpdateClusterTypePayload } from './model';

const ENDPOINT = '/api/cluster-types';

export const fetchClusterTypes = async (params: { skip?: number, limit?: number, sortBy?: string, order?: string, search?: string, pagination?: boolean }): Promise<{data: ClusterTypeData[], total: number}> => {
    const { skip = 0, limit = 10, sortBy = 'clusterType', order = 'asc', search = '', pagination = true } = params;
    const res = await request.get(ENDPOINT, { params: { skip, limit, sort_by: sortBy, order, search, pagination } });
    return res.data;
};

export const createClusterType = async (payload: CreateClusterTypePayload): Promise<ClusterTypeData> => {
    const res = await request.post(`${ENDPOINT}/`, payload);
    return res.data;
};

export const updateClusterType = async (payload: UpdateClusterTypePayload): Promise<ClusterTypeData> => {
    const { id, ...data } = payload;
    const res = await request.put(`${ENDPOINT}/${id}`, data);
    return res.data;
};

export const deleteClusterType = async (id: string): Promise<void> => {
    await request.delete(`${ENDPOINT}/${id}`);
};
