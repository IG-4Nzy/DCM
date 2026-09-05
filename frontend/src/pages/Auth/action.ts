// @ts-nocheck
import { createAsyncThunk } from '@reduxjs/toolkit';
import request from '../../services/request';
import { loginSuccess } from '../../store/authSlice';

interface LoginPayload {
  credentials: any;
  navigateToDashboard: () => void;
  showToast: (msg: string, severity?: 'error' | 'success') => void;
}

export const loginApi = createAsyncThunk(
  'auth/loginApi',
  async ({ credentials, navigateToDashboard, showToast }: LoginPayload, { dispatch, rejectWithValue }) => {
    try {
      const response = await request.post('/api/auth/login', credentials);
      dispatch(loginSuccess(response.data));
      navigateToDashboard();
      return response.data;
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.detail) {
        const detail = err.response.data.detail;
        if (typeof detail === 'string') {
          showToast(detail, 'error');
        } else if (detail.message && !detail.restricted_token) {
          showToast(detail.message, 'error');
        }
      } else {
        showToast('An error occurred during login.', 'error');
      }
      return rejectWithValue(err.response?.data || 'An error occurred during login.');
    }
  }
);
