import { createAsyncThunk } from '@reduxjs/toolkit';
import request from '../../services/request';
import type { CreateUserPayload, UpdateUserPayload } from './model';

const USERS_ENDPOINT = '/api/users';

export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await request.get(USERS_ENDPOINT);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch users');
    }
  }
);

export const createUser = createAsyncThunk(
  'users/createUser',
  async (payload: CreateUserPayload, { rejectWithValue }) => {
    try {
      const response = await request.post(USERS_ENDPOINT, payload);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to create user');
    }
  }
);

export const updateUser = createAsyncThunk(
  'users/updateUser',
  async (payload: UpdateUserPayload, { rejectWithValue }) => {
    try {
      const { id, ...data } = payload;
      const response = await request.put(`${USERS_ENDPOINT}/${id}`, data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to update user');
    }
  }
);

export const deleteUser = createAsyncThunk(
  'users/deleteUser',
  async (id: string, { rejectWithValue }) => {
    try {
      await request.delete(`${USERS_ENDPOINT}/${id}`);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to delete user');
    }
  }
);