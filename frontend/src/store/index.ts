import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import usersReducer from '../pages/Users/slice';
import rolesReducer from '../pages/Roles/slice';
import worksReducer from '../pages/Work/slice';
import departmentsReducer from '../pages/Departments/slice';
import observationsReducer from '../pages/Observations/slice';
import inventoryReducer from '../pages/Inventory/slice';
import dashboardReducer from '../pages/Dashboard/slice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    users: usersReducer,
    roles: rolesReducer,
    works: worksReducer,
    departments: departmentsReducer,
    observations: observationsReducer,
    inventory: inventoryReducer,
    dashboard: dashboardReducer
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
