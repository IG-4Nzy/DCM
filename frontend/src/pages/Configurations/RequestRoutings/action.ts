import request from '../../../services/request';
import type { RequestRoutingData, CreateRequestRoutingPayload, UpdateRequestRoutingPayload } from './model';

const ENDPOINT = '/api/request-routings';

export const fetchRequestRoutings = async (params: {
  skip?: number;
  limit?: number;
  search?: string;
  pagination?: boolean;
}): Promise<{ data: RequestRoutingData[]; total: number }> => {
  const res = await request.get(`${ENDPOINT}/`, { params });
  return res.data;
};

export const createRequestRouting = async (payload: CreateRequestRoutingPayload): Promise<RequestRoutingData> => {
  const res = await request.post(`${ENDPOINT}/`, payload);
  return res.data;
};

export const updateRequestRouting = async (payload: UpdateRequestRoutingPayload): Promise<RequestRoutingData> => {
  const { id, ...data } = payload;
  const res = await request.put(`${ENDPOINT}/${id}`, data);
  return res.data;
};

export const deleteRequestRouting = async (id: string): Promise<void> => {
  await request.delete(`${ENDPOINT}/${id}`);
};
