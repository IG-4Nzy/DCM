import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import usersReducer from '../pages/Users/slice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    users: usersReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
