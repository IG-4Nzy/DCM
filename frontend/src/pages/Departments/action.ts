// @ts-nocheck
import { createAsyncThunk } from '@reduxjs/toolkit';
import request from '../../services/request';
import type { CreateDepartmentPayload, UpdateDepartmentPayload } from './model';

export const fetchDepartments = createAsyncThunk(
  'departments/fetchDepartments',
  async ({ skip = 0, limit = 10, sortBy = 'name', order = 'asc', search = '', showToast }: {
    skip?: number;
    limit?: number;
    sortBy?: string;
    order?: 'asc' | 'desc';
    search?: string;
    showToast?: (msg: string, type: 'success' | 'error') => void;
  }, { rejectWithValue }) => {
    try {
      const response = await request.get('/api/departments/', {
        params: { skip, limit, sort_by: sortBy, order, search }
      });
      return response.data;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to fetch departments';
      showToast?.(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);

export const createDepartment = createAsyncThunk(
  'departments/createDepartment',
  async ({ payload, showToast }: { payload: CreateDepartmentPayload; showToast: (msg: string, type: 'success' | 'error') => void }, { rejectWithValue }) => {
    try {
      const response = await request.post('/api/departments/', payload);
      showToast('Department created successfully', 'success');
      return response.data;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to create department';
      showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);

export const updateDepartment = createAsyncThunk(
  'departments/updateDepartment',
  async ({ payload, showToast }: { payload: UpdateDepartmentPayload; showToast: (msg: string, type: 'success' | 'error') => void }, { rejectWithValue }) => {
    try {
      const { id, ...updateData } = payload;
      const response = await request.put(`/api/departments/${id}`, updateData);
      showToast('Department updated successfully', 'success');
      return response.data;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to update department';
      showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);

export const deleteDepartment = createAsyncThunk(
  'departments/deleteDepartment',
  async ({ id, showToast }: { id: string; showToast: (msg: string, type: 'success' | 'error') => void }, { rejectWithValue }) => {
    try {
      await request.delete(`/api/departments/${id}`);
      showToast('Department deleted successfully', 'success');
      return id;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to delete department';
      showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);
