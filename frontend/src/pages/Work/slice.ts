// @ts-nocheck
import { createSlice } from '@reduxjs/toolkit';
import { fetchWorks, createWork, updateWork, deleteWork, transferWork, fetchWorkLogs, createWorkLog, updateWorkLog, deleteWorkLog } from './action';
import type { WorkData, WorkLogData } from './model';

interface WorksState {
  works: WorkData[];
  totalCount: number;
  workLogs: WorkLogData[];
  workLogsTotalCount: number;
  loading: boolean;
  error: string | null;
}

const initialState: WorksState = {
  works: [],
  totalCount: 0,
  workLogs: [],
  workLogsTotalCount: 0,
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
      state.workLogs = [];
      state.workLogsTotalCount = 0;
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
      })
      // fetchWorkLogs
      .addCase(fetchWorkLogs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWorkLogs.fulfilled, (state, action) => {
        state.loading = false;
        state.workLogs = action.payload.data;
        state.workLogsTotalCount = action.payload.total;
      })
      .addCase(fetchWorkLogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createWorkLog.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(updateWorkLog.fulfilled, (state, action) => {
        const index = state.workLogs.findIndex((log) => {
          const logId = log.id || log._id;
          const payloadId = action.payload.id || action.payload._id;
          return logId && payloadId && logId === payloadId;
        });
        if (index !== -1) {
          state.workLogs[index] = action.payload;
        }
      })
      .addCase(deleteWorkLog.fulfilled, (state) => {
        state.loading = false;
      });
  },
});

export const { clearWorksState } = worksSlice.actions;
export default worksSlice.reducer;
