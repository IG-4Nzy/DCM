import { createAsyncThunk } from '@reduxjs/toolkit';
import request from '../../services/request';

export const fetchInventory = createAsyncThunk(
  'inventory/fetchInventory',
  async (params: { skip?: number; limit?: number; search?: string; sort_by?: string; order?: string }, { rejectWithValue }) => {
    try {
      const response = await request.get('/api/inventory', { params });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch inventory');
    }
  }
);

export const createInventory = createAsyncThunk(
  'inventory/createInventory',
  async (data: { itemName: string; quantity: number; description: string; date: string }, { rejectWithValue }) => {
    try {
      const response = await request.post('/api/inventory', data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to create item');
    }
  }
);

export const updateInventory = createAsyncThunk(
  'inventory/updateInventory',
  async ({ id, data }: { id: string; data: { quantityChange: number; action: string; givenTo?: string; date: string } }, { rejectWithValue }) => {
    try {
      const response = await request.put(`/api/inventory/${id}`, data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to update item');
    }
  }
);

export const deleteInventory = createAsyncThunk(
  'inventory/deleteInventory',
  async (id: string, { rejectWithValue }) => {
    try {
      await request.delete(`/api/inventory/${id}`);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to delete item');
    }
  }
);

export const bulkCreateInventory = createAsyncThunk(
  'inventory/bulkCreateInventory',
  async (file: File, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await request.post('/api/inventory/bulk', formData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to bulk create items');
    }
  }
);
