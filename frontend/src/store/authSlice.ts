// @ts-nocheck
import { createSlice,type PayloadAction } from '@reduxjs/toolkit';
import { LOCAL_STORAGE_PARAMETERS } from '../helpers/constants';
import { getItemFromLocalstorage, removeItemFromLocalstorage, setItemToLocalstorage } from '../helpers/utils';

interface AuthState {
  token: string | null;
  role: string | string[] | null;
  username: string | null;
  displayName: string | null;
  privileges: string[];
  isSuperuser: boolean;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  token: getItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.TOKEN),
  role: getItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.ROLE),
  username: getItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.USERNAME),
  displayName: getItemFromLocalstorage('displayName'),
  privileges: JSON.parse(getItemFromLocalstorage('PRIVILEGES') || '[]'),
  isSuperuser: getItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.IS_SUPERUSER) === true,
  isAuthenticated: !!getItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.TOKEN),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess(state, action: PayloadAction<{ token: string; role: string | string[]; username: string; displayName?: string; privileges: string[], isSuperuser: boolean }>) {
      state.token = action.payload.token;
      state.role = action.payload.role;
      state.username = action.payload.username;
      state.displayName = action.payload.displayName || action.payload.username;
      state.privileges = action.payload.privileges || [];
      state.isSuperuser = action.payload.isSuperuser;
      state.isAuthenticated = true;
      setItemToLocalstorage(LOCAL_STORAGE_PARAMETERS.TOKEN, action.payload.token);
      setItemToLocalstorage(LOCAL_STORAGE_PARAMETERS.ROLE, action.payload.role);
      setItemToLocalstorage(LOCAL_STORAGE_PARAMETERS.USERNAME, action.payload.username);
      setItemToLocalstorage('displayName', action.payload.displayName || action.payload.username);
      setItemToLocalstorage('PRIVILEGES', JSON.stringify(action.payload.privileges || []));
      setItemToLocalstorage(LOCAL_STORAGE_PARAMETERS.IS_SUPERUSER, action.payload.isSuperuser);
    },
    logout(state) {
      state.token = null;
      state.role = null;
      state.username = null;
      state.displayName = null;
      state.privileges = [];
      state.isSuperuser = false;
      state.isAuthenticated = false;
      removeItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.TOKEN);
      removeItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.ROLE);
      removeItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.USERNAME);
      removeItemFromLocalstorage('displayName');
      removeItemFromLocalstorage('PRIVILEGES');
      removeItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.IS_SUPERUSER);
    },
  },
});

export const { loginSuccess, logout } = authSlice.actions;
export default authSlice.reducer;
