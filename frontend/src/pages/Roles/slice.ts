// @ts-nocheck
import { createSlice } from '@reduxjs/toolkit';
import { type RolesState } from './model';
import { fetchRoles, createRole, updateRole, deleteRole, fetchPrivileges } from './action';

const initialState: RolesState = {
  roles: [],
  availablePrivileges: [],
  totalCount: 0,
  loading: false,
  error: null,
};

const rolesSlice = createSlice({
  name: 'roles',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // fetchRoles
    builder.addCase(fetchRoles.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchRoles.fulfilled, (state, action) => {
      state.loading = false;
      state.roles = action.payload.data;
      state.totalCount = action.payload.total;
    });
    builder.addCase(fetchRoles.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // fetchPrivileges
    builder.addCase(fetchPrivileges.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchPrivileges.fulfilled, (state, action) => {
      state.loading = false;
      state.availablePrivileges = action.payload;
    });
    builder.addCase(fetchPrivileges.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // createRole
    builder.addCase(createRole.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(createRole.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(createRole.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // updateRole
    builder.addCase(updateRole.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(updateRole.fulfilled, (state, action) => {
      state.loading = false;
      const index = state?.roles?.findIndex((r) => r.id === action.payload.id);
      if (index !== -1) {
        state.roles[index] = action.payload;
      }
    });
    builder.addCase(updateRole.rejected, (state, action) => {
      state.loading = false;
      state.error = action?.payload as string;
    });

    // deleteRole
    builder.addCase(deleteRole.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(deleteRole.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(deleteRole.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
  },
});

export default rolesSlice.reducer;
