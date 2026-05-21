import { createAsyncThunk } from '@reduxjs/toolkit';
import request from '../../services/request';
import type { 
  ObservationData, FetchObservationsResponse,
  ObservationCategoryData, FetchObservationCategoriesResponse 
} from './model';

const handleAxiosError = (error: any) => error?.response?.data?.detail || error?.message || 'An error occurred';

interface FetchParams {
  skip?: number;
  limit?: number;
  search?: string;
  status_filter?: string;
  date_filter?: string;
  pagination?: boolean;
}

export const fetchObservations = createAsyncThunk<FetchObservationsResponse, FetchParams, { rejectValue: string }>(
  'observations/fetchObservations',
  async (params, { rejectWithValue }) => {
    try {
      const response = await request.get('/api/observations', { params });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(handleAxiosError(error));
    }
  }
);

export const createObservation = createAsyncThunk<ObservationData, Partial<ObservationData>, { rejectValue: string }>(
  'observations/createObservation',
  async (observationData, { rejectWithValue }) => {
    try {
      const response = await request.post('/api/observations', observationData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(handleAxiosError(error));
    }
  }
);

export const updateObservation = createAsyncThunk<ObservationData, { id: string; data: Partial<ObservationData> }, { rejectValue: string }>(
  'observations/updateObservation',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await request.put(`/api/observations/${id}`, data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(handleAxiosError(error));
    }
  }
);

export const deleteObservation = createAsyncThunk<string, string, { rejectValue: string }>(
  'observations/deleteObservation',
  async (id, { rejectWithValue }) => {
    try {
      await request.delete(`/api/observations/${id}`);
      return id;
    } catch (error: any) {
      return rejectWithValue(handleAxiosError(error));
    }
  }
);

export const fetchObservationCategories = createAsyncThunk<FetchObservationCategoriesResponse, FetchParams, { rejectValue: string }>(
  'observations/fetchCategories',
  async (params, { rejectWithValue }) => {
    try {
      const response = await request.get('/api/observations/categories', { params });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(handleAxiosError(error));
    }
  }
);

export const createObservationCategory = createAsyncThunk<ObservationCategoryData, Partial<ObservationCategoryData>, { rejectValue: string }>(
  'observations/createCategory',
  async (categoryData, { rejectWithValue }) => {
    try {
      const response = await request.post('/api/observations/categories', categoryData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(handleAxiosError(error));
    }
  }
);

export const updateObservationCategory = createAsyncThunk<ObservationCategoryData, { id: string; data: Partial<ObservationCategoryData> }, { rejectValue: string }>(
  'observations/updateCategory',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await request.put(`/api/observations/categories/${id}`, data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(handleAxiosError(error));
    }
  }
);

export const deleteObservationCategory = createAsyncThunk<string, string, { rejectValue: string }>(
  'observations/deleteCategory',
  async (id, { rejectWithValue }) => {
    try {
      await request.delete(`/api/observations/categories/${id}`);
      return id;
    } catch (error: any) {
      return rejectWithValue(handleAxiosError(error));
    }
  }
);
