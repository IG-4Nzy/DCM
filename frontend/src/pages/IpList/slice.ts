import { createSlice } from '@reduxjs/toolkit';
import { fetchIpList, createIp, updateIp, deleteIp } from './action';
import type { IpListModel } from './model';

interface IpListState {
    data: IpListModel[];
    totalCount: number;
    loading: boolean;
    error: string | null;
}

const initialState: IpListState = {
    data: [],
    totalCount: 0,
    loading: false,
    error: null,
};

const ipListSlice = createSlice({
    name: 'ipList',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchIpList.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchIpList.fulfilled, (state, action) => {
                state.loading = false;
                state.data = action.payload.data;
                state.totalCount = action.payload.total;
            })
            .addCase(fetchIpList.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            .addCase(createIp.fulfilled, (state, action) => {
                state.data.unshift(action.payload);
                state.totalCount += 1;
            })
            .addCase(updateIp.fulfilled, (state, action) => {
                const index = state.data.findIndex((item) => (item.id || item._id) === (action.payload.id || action.payload._id));
                if (index !== -1) {
                    state.data[index] = action.payload;
                }
            })
            .addCase(deleteIp.fulfilled, (state, action) => {
                state.data = state.data.filter((item) => (item.id || item._id) !== action.payload);
                state.totalCount -= 1;
            });
    },
});

export default ipListSlice.reducer;
