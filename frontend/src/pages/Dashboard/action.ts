import { createAsyncThunk } from '@reduxjs/toolkit';
import request from '../../services/request';

export const fetchDashboardSummary = createAsyncThunk(
  'dashboard/fetchSummary',
  async (date: string, { rejectWithValue }) => {
    try {
      const res = await request.get(`/api/dashboard/summary?date=${date}`);
      return res.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch dashboard summary');
    }
  }
);
