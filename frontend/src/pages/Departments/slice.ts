// @ts-nocheck
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
      .addCase(createDepartment.fulfilled, (state) => {
        state.loading = false;
      })
      
      // Update Department
      .addCase(updateDepartment.fulfilled, (state, action) => {
        const index = state.departments.findIndex(d => {
          const deptId = d.id || (d as any)._id;
          const payloadId = action.payload.id || action.payload._id;
          return deptId && payloadId && deptId === payloadId;
        });
        if (index !== -1) {
          state.departments[index] = { ...state.departments[index], ...action.payload };
        }
      })
      
      // Delete Department
      .addCase(deleteDepartment.fulfilled, (state) => {
        state.loading = false;
      });
  },
});

export default departmentsSlice.reducer;
