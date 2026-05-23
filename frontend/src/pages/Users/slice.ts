import { createSlice } from '@reduxjs/toolkit';
import { type UsersState } from './model';
import { fetchUsers, createUser, updateUser, deleteUser, fetchAllRolesForDropdown, fetchAllDepartmentsForDropdown } from './action';

const initialState: UsersState = {
  users: [],
  availableRoles: [],
  availableDepartments: [],
  totalCount: 0,
  loading: false,
  error: null,
};

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // fetchUsers
    builder.addCase(fetchUsers.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchUsers.fulfilled, (state, action) => {
      state.loading = false;
      state.users = action.payload.data;
      state.totalCount = action.payload.total;
    });
    builder.addCase(fetchUsers.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // fetchAllRolesForDropdown
    builder.addCase(fetchAllRolesForDropdown.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchAllRolesForDropdown.fulfilled, (state, action) => {
      state.loading = false;
      state.availableRoles = action.payload;
    });
    builder.addCase(fetchAllRolesForDropdown.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // fetchAllDepartmentsForDropdown
    builder.addCase(fetchAllDepartmentsForDropdown.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchAllDepartmentsForDropdown.fulfilled, (state, action) => {
      state.loading = false;
      state.availableDepartments = action.payload.data || action.payload; // Just in case it's paginated or not
    });
    builder.addCase(fetchAllDepartmentsForDropdown.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // createUser
    builder.addCase(createUser.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(createUser.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(createUser.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // updateUser
    builder.addCase(updateUser.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(updateUser.fulfilled, (state, action) => {
      state.loading = false;
      const index = state.users.findIndex((u) => u.id === action.payload.id);
      if (index !== -1) {
        state.users[index] = action.payload;
      }
    });
    builder.addCase(updateUser.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // deleteUser
    builder.addCase(deleteUser.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(deleteUser.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(deleteUser.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
  },
});

export default usersSlice.reducer;
