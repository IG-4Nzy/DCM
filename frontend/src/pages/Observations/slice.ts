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
      .addCase(createObservation.fulfilled, (state, action) => {
        state.observations.unshift(action.payload);
        state.totalCount += 1;
      })
      // updateObservation
      .addCase(updateObservation.fulfilled, (state, action) => {
        const index = state.observations.findIndex((obs) => obs.id === action.payload.id || obs._id === action.payload._id);
        if (index !== -1) {
          state.observations[index] = action.payload;
        }
      })
      // deleteObservation
      .addCase(deleteObservation.fulfilled, (state, action) => {
        state.observations = state.observations.filter((obs) => obs.id !== action.payload && obs._id !== action.payload);
        state.totalCount -= 1;
      })
      // fetchObservationCategories
      .addCase(fetchObservationCategories.fulfilled, (state, action) => {
        state.categories = action.payload.data;
      })
      // createObservationCategory
      .addCase(createObservationCategory.fulfilled, (state, action) => {
        state.categories.push(action.payload);
      })
      // updateObservationCategory
      .addCase(updateObservationCategory.fulfilled, (state, action) => {
        const index = state.categories.findIndex((cat) => cat.id === action.payload.id || cat._id === action.payload._id);
        if (index !== -1) {
          state.categories[index] = action.payload;
        }
      })
      // deleteObservationCategory
      .addCase(deleteObservationCategory.fulfilled, (state, action) => {
        state.categories = state.categories.filter((cat) => cat.id !== action.payload && cat._id !== action.payload);
      });
  },
});

export const { clearObservationsState } = observationsSlice.actions;
export default observationsSlice.reducer;
