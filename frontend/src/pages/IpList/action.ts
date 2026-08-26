import { createAsyncThunk } from '@reduxjs/toolkit';
import request from '../../services/request';
import type { IpListModel } from './model';

export const fetchIpList = createAsyncThunk(
    'ipList/fetchIpList',
    async (params: { skip: number; limit: number; search?: string; isUsed?: boolean; takenBy?: string }, { rejectWithValue }) => {
        try {
            const queryParams = new URLSearchParams();
            queryParams.append('skip', params.skip.toString());
            queryParams.append('limit', params.limit.toString());
            if (params.search) queryParams.append('search', params.search);
            if (params.isUsed !== undefined) queryParams.append('isUsed', params.isUsed.toString());
            if (params.takenBy) queryParams.append('takenBy', params.takenBy);

            const res = await request.get(`/api/ip-list?${queryParams.toString()}`);
            return res.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.detail || error.message);
        }
    }
);

export const createIp = createAsyncThunk(
    'ipList/createIp',
    async (payload: Omit<IpListModel, 'id' | '_id' | 'createdAt' | 'updatedAt'>, { rejectWithValue }) => {
        try {
            const res = await request.post('/api/ip-list', payload);
            return res.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.detail || error.message);
        }
    }
);

export const updateIp = createAsyncThunk(
    'ipList/updateIp',
    async ({ id, payload }: { id: string; payload: Partial<IpListModel> }, { rejectWithValue }) => {
        try {
            const res = await request.put(`/api/ip-list/${id}`, payload);
            return res.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.detail || error.message);
        }
    }
);

export const deleteIp = createAsyncThunk(
    'ipList/deleteIp',
    async (id: string, { rejectWithValue }) => {
        try {
            await request.delete(`/api/ip-list/${id}`);
            return id;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.detail || error.message);
        }
    }
);
