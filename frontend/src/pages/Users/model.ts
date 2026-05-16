export interface UserData {
  id: string;
  username: string;
  role: string;
  status: string;
}

export interface CreateUserPayload {
  username: string;
  password?: string;
  role: string;
  status: string;
}

export interface UpdateUserPayload {
  id: string;
  username: string;
  password?: string;
  role: string;
  status: string;
}

export interface UsersState {
  users: UserData[];
  loading: boolean;
  error: string | null;
}
