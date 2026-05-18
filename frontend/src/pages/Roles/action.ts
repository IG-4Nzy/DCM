import { createAsyncThunk } from '@reduxjs/toolkit';
import request from '../../services/request';
import type { CreateRolePayload, UpdateRolePayload } from './model';
const ROLES_ENDPOINT = '/api/roles';

type ToastFunction = (msg: string, severity?: 'error' | 'success') => void;

interface FetchRolesParams {
  skip: number;
  limit: number;
  sortBy: string;
  order: string;
  search: string;
  showToast?: ToastFunction;
}

export const fetchRoles = createAsyncThunk(
  'roles/fetchRoles',
  async ({ skip, limit, sortBy, order, search, showToast }: FetchRolesParams, { rejectWithValue }) => {
    try {
      const response = await request.get(ROLES_ENDPOINT, {
        params: { skip, limit, sort_by: sortBy, order, search }
      });
      return response.data;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to fetch roles';
      if (showToast) showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);

export const fetchPrivileges = createAsyncThunk(
  'roles/fetchPrivileges',
  async (_, { rejectWithValue }) => {
    try {
      const response = await request.get(`${ROLES_ENDPOINT}/privileges`);
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch privileges');
    }
  }
);

export const createRole = createAsyncThunk(
  'roles/createRole',
  async ({ payload, showToast }: { payload: CreateRolePayload; showToast: ToastFunction }, { rejectWithValue }) => {
    try {
      const response = await request.post(ROLES_ENDPOINT, payload);
      showToast('Role created successfully', 'success');
      return response.data;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to create role';
      showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);

export const updateRole = createAsyncThunk(
  'roles/updateRole',
  async ({ payload, showToast }: { payload: UpdateRolePayload; showToast: ToastFunction }, { rejectWithValue }) => {
    try {
      const { id, ...data } = payload;
      const response = await request.put(`${ROLES_ENDPOINT}/${id}`, data);
      showToast('Role updated successfully', 'success');
      return response.data;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to update role';
      showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);

export const deleteRole = createAsyncThunk(
  'roles/deleteRole',
  async ({ id, showToast }: { id: string; showToast: ToastFunction }, { rejectWithValue }) => {
    try {
      await request.delete(`${ROLES_ENDPOINT}/${id}`);
      showToast('Role deleted successfully', 'success');
      return id;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to delete role';
      showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);