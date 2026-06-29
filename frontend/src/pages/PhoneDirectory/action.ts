import request from '../../services/request';

export const fetchPhoneDirectory = async (params: any) => {
    const { data } = await request.get('/api/phone-directory', { params });
    return data;
};

export const createPhoneEntry = async (payload: any) => {
    const { data } = await request.post('/api/phone-directory', payload);
    return data;
};

export const updatePhoneEntry = async (id: string, payload: any) => {
    const { data } = await request.put(`/api/phone-directory/${id}`, payload);
    return data;
};

export const deletePhoneEntry = async (id: string) => {
    const { data } = await request.delete(`/api/phone-directory/${id}`);
    return data;
};
