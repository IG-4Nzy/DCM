import { createAsyncThunk } from '@reduxjs/toolkit';
import request from '../../services/request';

export const fetchRostersData = createAsyncThunk(
  'roaster/fetchRostersData',
  async ({ startDate, endDate, department }: { startDate: string; endDate: string; department: string }, { rejectWithValue }) => {
    try {
      const res = await request.get(`/api/roasters/?startDate=${startDate}&endDate=${endDate}&department=${department}`);
      return res.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch rosters');
    }
  }
);

export const fetchRosterStatusData = createAsyncThunk(
  'roaster/fetchRosterStatus',
  async ({ weekStartDate, department }: { weekStartDate: string; department: string }, { rejectWithValue }) => {
    try {
      const res = await request.get(`/api/roasters/status?weekStartDate=${weekStartDate}&department=${department}`);
      return res.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch roster status');
    }
  }
);

export const updateRosterStatus = createAsyncThunk(
  'roaster/updateRosterStatus',
  async ({ weekStartDate, department, status }: { weekStartDate: string; department: string; status: string }, { rejectWithValue }) => {
    try {
      const res = await request.post('/api/roasters/status', { weekStartDate, department, status });
      return res.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to update roster status');
    }
  }
);

export const resetRosterStatus = createAsyncThunk(
  'roaster/resetRosterStatus',
  async ({ weekStartDate, department, status }: { weekStartDate: string; department: string; status: string }, { rejectWithValue }) => {
    try {
      const res = await request.post('/api/roasters/status/reset', { weekStartDate, department, status });
      return res.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to reset roster status');
    }
  }
);

export const createRoster = createAsyncThunk(
  'roaster/createRoster',
  async ({ date, shift, assignees, department }: { date: string; shift: string; assignees: string[]; department: string }, { rejectWithValue }) => {
    try {
      const res = await request.post(`/api/roasters/`, { date, shift, assignees, department });
      return res.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to create roster');
    }
  }
);

export const updateRoster = createAsyncThunk(
  'roaster/updateRoster',
  async ({ id, date, shift, assignees, department }: { id: string; date: string; shift: string; assignees: string[]; department: string }, { rejectWithValue }) => {
    try {
      const res = await request.put(`/api/roasters/${id}`, { date, shift, assignees, department });
      return res.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to update roster');
    }
  }
);

export const fetchDutySummary = createAsyncThunk(
  'roaster/fetchDutySummary',
  async ({ department, date }: { department: string; date?: string }, { rejectWithValue }) => {
    try {
      let url = `/api/roasters/duty-summary?department=${department}`;
      if (date) {
        url += `&date=${date}`;
      }
      const res = await request.get(url);
      return res.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch duty summary');
    }
  }
);

export const saveRosterSplitup = createAsyncThunk(
  'roaster/saveRosterSplitup',
  async ({ department, cycleStart, splitups }: { department: string; cycleStart: string; splitups: any }, { rejectWithValue }) => {
    try {
      const res = await request.post('/api/roasters/duty-summary/splitup', { department, cycleStart, splitups });
      return res.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to save roster splitup');
    }
  }
);


