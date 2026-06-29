// @ts-nocheck
import request from '../../services/request';
import type { RequestData, FetchRequestsResponse } from './model';

interface FetchParams {
  skip?: number;
  limit?: number;
  search?: string;
  completed?: boolean;
  requestType?: string;
  pagination?: boolean;
}

export const fetchRequests = async (params: FetchParams): Promise<FetchRequestsResponse> => {
  const response = await request.get('/api/requests/', { params });
  return response.data;
};

export const createRequest = async (data: Partial<RequestData>): Promise<RequestData> => {
  const response = await request.post('/api/requests/', data);
  return response.data;
};

export const updateRequest = async (id: string, data: Partial<RequestData>): Promise<RequestData> => {
  const response = await request.put(`/api/requests/${id}`, data);
  return response.data;
};

export const advanceRequest = async (id: string, data?: any): Promise<RequestData> => {
  const response = await request.put(`/api/requests/${id}/advance`, data);
  return response.data;
};

export const fetchStagesForType = async (requestType: string): Promise<string[]> => {
  const response = await request.get(`/api/requests/stages/${encodeURIComponent(requestType)}`);
  return response.data.stages || [];
};

export const deleteRequest = async (id: string): Promise<string> => {
  await request.delete(`/api/requests/${id}`);
  return id;
};

export const fetchVisitorLogs = async (params: { skip?: number; limit?: number; search?: string }): Promise<{ data: any[]; total: number }> => {
  const response = await request.get('/api/requests/visitor-logs', { params });
  return response.data;
};

export const fetchRequestLogs = async (id: string): Promise<any[]> => {
  const response = await request.get(`/api/requests/${id}/logs`);
  return response.data;
};

export const sendBackwardRequest = async (id: string, reason: string): Promise<RequestData> => {
  const response = await request.post(`/api/requests/${id}/backward`, { reason });
  return response.data;
};

export const createVisitorLog = async (data: any): Promise<any> => {
  const response = await request.post('/api/requests/visitor-logs', data);
  return response.data;
};

export const updateVisitorLog = async (id: string, data: any): Promise<any> => {
  const response = await request.put(`/api/requests/visitor-logs/${id}`, data);
  return response.data;
};

export const deleteVisitorLog = async (id: string): Promise<any> => {
  const response = await request.delete(`/api/requests/visitor-logs/${id}`);
  return response.data;
};
