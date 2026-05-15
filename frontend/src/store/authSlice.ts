import { createSlice,type PayloadAction } from '@reduxjs/toolkit';
import { LOCAL_STORAGE_PARAMETERS } from '../helpers/constants';
import { getItemFromLocalstorage, removeItemFromLocalstorage, setItemToLocalstorage } from '../helpers/utils';

interface AuthState {
  token: string | null;
  role: string | null;
  username: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  token: getItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.TOKEN),
  role: getItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.ROLE),
  username: getItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.USERNAME),
  isAuthenticated: !!getItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.TOKEN),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess(state, action: PayloadAction<{ token: string; role: string; username: string }>) {
      state.token = action.payload.token;
      state.role = action.payload.role;
      state.username = action.payload.username;
      state.isAuthenticated = true;
      setItemToLocalstorage(LOCAL_STORAGE_PARAMETERS.TOKEN, action.payload.token);
      setItemToLocalstorage(LOCAL_STORAGE_PARAMETERS.ROLE, action.payload.role);
      setItemToLocalstorage(LOCAL_STORAGE_PARAMETERS.USERNAME, action.payload.username);
    },
    logout(state) {
      state.token = null;
      state.role = null;
      state.username = null;
      state.isAuthenticated = false;
      removeItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.TOKEN);
      removeItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.ROLE);
      removeItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.USERNAME);
    },
  },
});

export const { loginSuccess, logout } = authSlice.actions;
export default authSlice.reducer;
