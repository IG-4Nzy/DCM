import { createAsyncThunk } from '@reduxjs/toolkit';
import request from '../../services/request';
import type { CreateUserPayload, UpdateUserPayload } from './model';

const USERS_ENDPOINT = '/api/users';

type ToastFunction = (msg: string, severity?: 'error' | 'success') => void;

interface FetchUsersParams {
  skip: number;
  limit: number;
  sortBy: string;
  order: string;
  search: string;
  showToast?: ToastFunction;
}

export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async ({ skip, limit, sortBy, order, search, showToast }: FetchUsersParams, { rejectWithValue }) => {
    try {
      const response = await request.get(USERS_ENDPOINT, {
        params: { skip, limit, sort_by: sortBy, order, search }
      });
      return response.data;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to fetch users';
      if (showToast) showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);

export const createUser = createAsyncThunk(
  'users/createUser',
  async ({ payload, showToast }: { payload: CreateUserPayload; showToast: ToastFunction }, { rejectWithValue }) => {
    try {
      const response = await request.post(USERS_ENDPOINT, payload);
      showToast('User created successfully', 'success');
      return response.data;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to create user';
      showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);

export const updateUser = createAsyncThunk(
  'users/updateUser',
  async ({ payload, showToast }: { payload: UpdateUserPayload; showToast: ToastFunction }, { rejectWithValue }) => {
    try {
      const { id, ...data } = payload;
      const response = await request.put(`${USERS_ENDPOINT}/${id}`, data);
      showToast('User updated successfully', 'success');
      return response.data;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to update user';
      showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);

export const deleteUser = createAsyncThunk(
  'users/deleteUser',
  async ({ id, showToast }: { id: string; showToast: ToastFunction }, { rejectWithValue }) => {
    try {
      await request.delete(`${USERS_ENDPOINT}/${id}`);
      showToast('User deleted successfully', 'success');
      return id;
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to delete user';
      showToast(msg, 'error');
      return rejectWithValue(msg);
    }
  }
);