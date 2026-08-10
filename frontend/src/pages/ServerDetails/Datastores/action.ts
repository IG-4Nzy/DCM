// @ts-nocheck
import request from '../../../services/request';

const ENDPOINT = '/api/datastores';

export const fetchDatastores = async (params: any) => {
    const response = await request.get(ENDPOINT, { params });
    return response.data;
};

export const createDatastore = async (payload: any) => {
    const response = await request.post(`${ENDPOINT}/`, payload);
    return response.data;
};

export const updateDatastore = async (id: string, payload: any) => {
    const response = await request.put(`${ENDPOINT}/${id}`, payload);
    return response.data;
};

export const deleteDatastore = async (id: string) => {
    const response = await request.delete(`${ENDPOINT}/${id}`);
    return response.data;
};
