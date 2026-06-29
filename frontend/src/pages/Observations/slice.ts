// @ts-nocheck
import { createSlice } from '@reduxjs/toolkit';
import { 
  fetchObservations, createObservation, updateObservation, deleteObservation,
  fetchObservationCategories, createObservationCategory, updateObservationCategory, deleteObservationCategory
} from './action';
import type { ObservationsState } from './model';

const initialState: ObservationsState = {
  observations: [],
  categories: [],
  totalCount: 0,
  loading: false,
  error: null,
};

const observationsSlice = createSlice({
  name: 'observations',
  initialState,
  reducers: {
    clearObservationsState: (state) => {
      state.observations = [];
      state.categories = [];
      state.totalCount = 0;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchObservations
      .addCase(fetchObservations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchObservations.fulfilled, (state, action) => {
        state.loading = false;
        state.observations = action.payload.data;
        state.totalCount = action.payload.total;
      })
      .addCase(fetchObservations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // createObservation
      .addCase(createObservation.fulfilled, (state) => {
        state.loading = false;
      })
      // updateObservation
      .addCase(updateObservation.fulfilled, (state, action) => {
        const index = state.observations.findIndex((obs) => {
          const obsId = obs.id || obs._id;
          const payloadId = action.payload.id || action.payload._id;
          return obsId && payloadId && obsId === payloadId;
        });
        if (index !== -1) {
          state.observations[index] = action.payload;
        }
      })
      // deleteObservation
      .addCase(deleteObservation.fulfilled, (state) => {
        state.loading = false;
      })
      // fetchObservationCategories
      .addCase(fetchObservationCategories.fulfilled, (state, action) => {
        state.categories = action.payload.data;
      })
      // createObservationCategory
      .addCase(createObservationCategory.fulfilled, (state) => {
        state.loading = false;
      })
      // updateObservationCategory
      .addCase(updateObservationCategory.fulfilled, (state, action) => {
        const index = state.categories.findIndex((cat) => {
          const catId = cat.id || cat._id;
          const payloadId = action.payload.id || action.payload._id;
          return catId && payloadId && catId === payloadId;
        });
        if (index !== -1) {
          state.categories[index] = action.payload;
        }
      })
      // deleteObservationCategory
      .addCase(deleteObservationCategory.fulfilled, (state) => {
        state.loading = false;
      });
  },
});

export const { clearObservationsState } = observationsSlice.actions;
export default observationsSlice.reducer;
