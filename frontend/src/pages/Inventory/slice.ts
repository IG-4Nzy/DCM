// @ts-nocheck
import { createSlice } from '@reduxjs/toolkit';
import { fetchInventory, createInventory, updateInventory, editInventoryItem, deleteInventory, giveInventoryItem, returnInventoryItem } from './action';
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
      .addCase(createInventory.fulfilled, (state) => {
        state.loading = false;
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
        const index = state.inventory.findIndex((item) => {
          const itemId = item.id || (item as any)._id;
          const payloadId = action.payload.id || (action.payload as any)._id;
          return itemId && payloadId && itemId === payloadId;
        });
        if (index !== -1) {
          state.inventory[index] = action.payload;
        }
      })
      .addCase(updateInventory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(editInventoryItem.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(editInventoryItem.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.inventory.findIndex((item) => {
          const itemId = item.id || (item as any)._id;
          const payloadId = action.payload.id || (action.payload as any)._id;
          return itemId && payloadId && itemId === payloadId;
        });
        if (index !== -1) {
          state.inventory[index] = action.payload;
        }
      })
      .addCase(editInventoryItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(giveInventoryItem.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(giveInventoryItem.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.inventory.findIndex((item) => {
          const itemId = item.id || (item as any)._id;
          const payloadId = action.payload.id || (action.payload as any)._id;
          return itemId && payloadId && itemId === payloadId;
        });
        if (index !== -1) {
          state.inventory[index] = action.payload;
        }
      })
      .addCase(giveInventoryItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(returnInventoryItem.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(returnInventoryItem.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.inventory.findIndex((item) => {
          const itemId = item.id || (item as any)._id;
          const payloadId = action.payload.id || (action.payload as any)._id;
          return itemId && payloadId && itemId === payloadId;
        });
        if (index !== -1) {
          state.inventory[index] = action.payload;
        }
      })
      .addCase(returnInventoryItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(deleteInventory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteInventory.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(deleteInventory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = inventorySlice.actions;
export default inventorySlice.reducer;
