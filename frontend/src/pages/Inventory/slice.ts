import { createSlice } from '@reduxjs/toolkit';
import { fetchInventory, createInventory, updateInventory, deleteInventory } from './action';
import type { InventoryData } from './model';

interface InventoryState {
  inventory: InventoryData[];
  loading: boolean;
  error: string | null;
  totalCount: number;
}

const initialState: InventoryState = {
  inventory: [],
  loading: false,
  error: null,
  totalCount: 0,
};

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInventory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInventory.fulfilled, (state, action) => {
        state.loading = false;
        state.inventory = action.payload.data;
        state.totalCount = action.payload.total;
      })
      .addCase(fetchInventory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(createInventory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createInventory.fulfilled, (state, action) => {
        state.loading = false;
        state.inventory.unshift(action.payload);
        state.totalCount += 1;
      })
      .addCase(createInventory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(updateInventory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateInventory.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.inventory.findIndex((item) => item.id === action.payload.id || (item as any)._id === (action.payload as any)._id);
        if (index !== -1) {
          state.inventory[index] = action.payload;
        }
      })
      .addCase(updateInventory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(deleteInventory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteInventory.fulfilled, (state, action) => {
        state.loading = false;
        state.inventory = state.inventory.filter((item) => item.id !== action.payload && (item as any)._id !== action.payload);
        state.totalCount -= 1;
      })
      .addCase(deleteInventory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = inventorySlice.actions;
export default inventorySlice.reducer;
