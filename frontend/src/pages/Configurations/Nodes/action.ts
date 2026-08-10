// @ts-nocheck
import request from '../../../services/request';
import { type NodeData, type CreateNodePayload, type UpdateNodePayload } from './model';

const ENDPOINT = '/api/nodes';

export const fetchNodes = async (params: { skip?: number, limit?: number, sortBy?: string, order?: string, search?: string, clusterId?: string, serverModel?: string, admin?: string, rack?: string, os?: string, custodian?: string, nodeTypeFilter?: string, networkType?: string, pagination?: boolean }): Promise<{data: NodeData[], total: number}> => {
    const { skip = 0, limit = 10, sortBy = 'nodeId', order = 'asc', search = '', clusterId = '', serverModel = '', admin = '', rack = '', os = '', custodian = '', nodeTypeFilter = '', networkType = '', pagination = true } = params;
    const queryParams: any = { skip, limit, sort_by: sortBy, order, pagination };
    if (search) queryParams.search = search;
    if (clusterId) queryParams.clusterId = clusterId;
    if (serverModel) queryParams.serverModel = serverModel;
    if (admin) queryParams.admin = admin;
    if (rack) queryParams.rack = rack;
    if (os) queryParams.os = os;
    if (custodian) queryParams.custodian = custodian;
    if (nodeTypeFilter) queryParams.nodeTypeFilter = nodeTypeFilter;
    if (networkType) queryParams.networkType = networkType;
    
    const res = await request.get(`${ENDPOINT}/`, { params: queryParams });
    return res.data;
};

export const createNode = async (payload: CreateNodePayload): Promise<NodeData> => {
    const res = await request.post(ENDPOINT, payload);
    return res.data;
};

export const updateNode = async (payload: UpdateNodePayload): Promise<NodeData> => {
    const { id, ...data } = payload;
    const res = await request.put(`/api/nodes/${id}`, data);
    return res.data;
};

export const deleteNode = async (id: string): Promise<void> => {
    await request.delete(`/api/nodes/${id}`);
};
