import request from '../../../services/request';

export const fetchDatastores = async (params: any) => {
    const res = await request.get('/api/datastores/', { params });
    return res.data;
};

export const createDatastore = async (payload: any) => {
    const res = await request.post('/api/datastores/', payload);
    return res.data;
};

export const updateDatastore = async (id: string, payload: any) => {
    const res = await request.put(`/api/datastores/${id}`, payload);
    return res.data;
};

export const deleteDatastore = async (id: string) => {
    const res = await request.delete(`/api/datastores/${id}`);
    return res.data;
};

export const fetchNodesOptions = async () => {
    try {
        const res = await request.get('/api/nodes/', { params: { pagination: false } });
        return res.data?.data || [];
    } catch {
        return [];
    }
};
