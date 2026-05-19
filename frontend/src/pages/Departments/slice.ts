import { createSlice } from '@reduxjs/toolkit';
import { fetchDepartments, createDepartment, updateDepartment, deleteDepartment } from './action';
import type { DepartmentsState } from './model';

const initialState: DepartmentsState = {
  departments: [],
  totalCount: 0,
  loading: false,
  error: null,
};

const departmentsSlice = createSlice({
  name: 'departments',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Fetch Departments
      .addCase(fetchDepartments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDepartments.fulfilled, (state, action) => {
        state.loading = false;
        state.departments = action.payload.data;
        state.totalCount = action.payload.total;
      })
      .addCase(fetchDepartments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Create Department
      .addCase(createDepartment.fulfilled, (state, action) => {
        state.departments.unshift(action.payload);
        state.totalCount += 1;
      })
      
      // Update Department
      .addCase(updateDepartment.fulfilled, (state, action) => {
        const index = state.departments.findIndex(d => d.id === action.payload.id || (d as any)._id === action.payload._id);
        if (index !== -1) {
          state.departments[index] = { ...state.departments[index], ...action.payload };
        }
      })
      
      // Delete Department
      .addCase(deleteDepartment.fulfilled, (state, action) => {
        state.departments = state.departments.filter(d => d.id !== action.payload && (d as any)._id !== action.payload);
        state.totalCount = Math.max(0, state.totalCount - 1);
      });
  },
});

export default departmentsSlice.reducer;
