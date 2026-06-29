// @ts-nocheck
import { createSlice } from '@reduxjs/toolkit';
import { fetchWorks, createWork, updateWork, deleteWork, transferWork } from './action';
import type { WorkData } from './model';

interface WorksState {
  works: WorkData[];
  totalCount: number;
  loading: boolean;
  error: string | null;
}

const initialState: WorksState = {
  works: [],
  totalCount: 0,
  loading: false,
  error: null,
};

const worksSlice = createSlice({
  name: 'works',
  initialState,
  reducers: {
    clearWorksState: (state) => {
      state.works = [];
      state.totalCount = 0;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchWorks
      .addCase(fetchWorks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWorks.fulfilled, (state, action) => {
        state.loading = false;
        state.works = action.payload.data;
        state.totalCount = action.payload.total;
      })
      .addCase(fetchWorks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // createWork
      .addCase(createWork.fulfilled, (state) => {
        state.loading = false;
      })
      // updateWork
      .addCase(updateWork.fulfilled, (state, action) => {
        const index = state.works.findIndex((work) => {
          const workId = work.id || work._id;
          const payloadId = action.payload.id || action.payload._id;
          return workId && payloadId && workId === payloadId;
        });
        if (index !== -1) {
          state.works[index] = action.payload;
        }
      })
      // transferWork
      .addCase(transferWork.fulfilled, (state, action) => {
        const index = state.works.findIndex((work) => {
          const workId = work.id || work._id;
          const payloadId = action.payload.id || action.payload._id;
          return workId && payloadId && workId === payloadId;
        });
        if (index !== -1) {
          state.works[index] = action.payload;
        }
      })
      // deleteWork
      .addCase(deleteWork.fulfilled, (state) => {
        state.loading = false;
      });
  },
});

export const { clearWorksState } = worksSlice.actions;
export default worksSlice.reducer;
