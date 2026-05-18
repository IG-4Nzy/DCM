export interface UserData {
  id: string;
  username: string;
  role: string;
  status: boolean;
}

export interface CreateUserPayload {
  username: string;
  password?: string;
  role: string;
  status: boolean;
}

export interface UpdateUserPayload {
  id: string;
  username: string;
  password?: string;
  role: string;
  status: boolean;
}

export interface UsersState {
  users: UserData[];
  totalCount: number;
  loading: boolean;
  error: string | null;
}
