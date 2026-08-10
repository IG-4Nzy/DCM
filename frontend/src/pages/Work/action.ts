// @ts-nocheck
import { createAsyncThunk } from '@reduxjs/toolkit';
import request from '../../services/request';
import type { CreateWorkPayload, UpdateWorkPayload, FetchWorksParams } from './model';

const WORKS_ENDPOINT = '/api/works';

type ToastFunction = (msg: string, severity?: 'error' | 'success') => void;


export const fetchWorks = createAsyncThunk(
  'works/fetchWorks',
  async ({ skip, limit, sortBy, order, search, status, assignee, department, tab, showToast }: FetchWorksParams, { rejectWithValue }) => {
    try {
      const response = await request.get(WORKS_ENDPOINT, {
        params: { skip, limit, sort_by: sortBy, order, search, status, assignee, department, tab }
      });
      return response.data;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to fetch works';
      if (showToast) showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);

export const createWork = createAsyncThunk(
  'works/createWork',
  async ({ payload, showToast }: { payload: CreateWorkPayload; showToast: ToastFunction }, { rejectWithValue }) => {
    try {
      const response = await request.post(WORKS_ENDPOINT, payload);
      showToast('Work created successfully', 'success');
      return response.data;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to create work';
      showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);

export const updateWork = createAsyncThunk(
  'works/updateWork',
  async ({ payload, showToast, silent = false }: { payload: UpdateWorkPayload; showToast: ToastFunction; silent?: boolean }, { rejectWithValue }) => {
    try {
      const { id, ...data } = payload;
      const response = await request.put(`${WORKS_ENDPOINT}/${id}`, data);
      if (!silent) showToast('Work updated successfully', 'success');
      return response.data;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to update work';
      showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);

export const deleteWork = createAsyncThunk(
  'works/deleteWork',
  async ({ id, showToast }: { id: string; showToast: ToastFunction }, { rejectWithValue }) => {
    try {
      await request.delete(`${WORKS_ENDPOINT}/${id}`);
      showToast('Work deleted successfully', 'success');
      return id;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to delete work';
      showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);

export const transferWork = createAsyncThunk(
  'works/transferWork',
  async ({ id, newAssigneeId, reason, showToast }: { id: string; newAssigneeId: string; reason: string; showToast: ToastFunction }, { rejectWithValue }) => {
    try {
      const response = await request.post(`${WORKS_ENDPOINT}/${id}/transfer`, { newAssigneeId, reason });
      showToast('Work transferred successfully', 'success');
      return response.data;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to transfer work';
      showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);

const WORK_LOGS_ENDPOINT = '/api/work-logs';

export const fetchWorkLogs = createAsyncThunk(
  'works/fetchWorkLogs',
  async ({ skip, limit, sortBy, order, search, user, date, department, showToast }: any, { rejectWithValue }) => {
    try {
      const response = await request.get(WORK_LOGS_ENDPOINT, {
        params: { skip, limit, sort_by: sortBy, order, search, user, date, department }
      });
      return response.data;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to fetch work logs';
      if (showToast) showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);

export const createWorkLog = createAsyncThunk(
  'works/createWorkLog',
  async ({ payload, showToast }: { payload: any; showToast: ToastFunction }, { rejectWithValue }) => {
    try {
      const response = await request.post(WORK_LOGS_ENDPOINT, payload);
      showToast('Work log created successfully', 'success');
      return response.data;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to create work log';
      showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);

export const updateWorkLog = createAsyncThunk(
  'works/updateWorkLog',
  async ({ payload, showToast }: { payload: any; showToast: ToastFunction }, { rejectWithValue }) => {
    try {
      const { id, ...data } = payload;
      const response = await request.put(`${WORK_LOGS_ENDPOINT}/${id}`, data);
      showToast('Work log updated successfully', 'success');
      return response.data;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to update work log';
      showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);

export const deleteWorkLog = createAsyncThunk(
  'works/deleteWorkLog',
  async ({ id, showToast }: { id: string; showToast: ToastFunction }, { rejectWithValue }) => {
    try {
      await request.delete(`${WORK_LOGS_ENDPOINT}/${id}`);
      showToast('Work log deleted successfully', 'success');
      return id;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to delete work log';
      showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);

