export interface UserData {
  id: string;
  username: string;
  role: string | string[];
  status: boolean;
  firstName?: string;
  lastName?: string;
  dob?: string;
  mobile?: string;
  bloodGroup?: string;
  address?: string;
  dateOfJoin?: string;
  department?: string;
  is_superuser?: boolean;
  isSuperuser?: boolean;
  isDepartmentHead?: boolean;
}

export interface CreateUserPayload {
  username: string;
  password?: string;
  role: string | string[];
  status: boolean;
  firstName?: string;
  lastName?: string;
  dob?: string;
  mobile?: string;
  bloodGroup?: string;
  address?: string;
  dateOfJoin?: string;
  department?: string;
  isDepartmentHead?: boolean;
}

export interface UpdateUserPayload {
  id: string;
  username: string;
  password?: string;
  role: string | string[];
  status: boolean;
  firstName?: string;
  lastName?: string;
  dob?: string;
  mobile?: string;
  bloodGroup?: string;
  address?: string;
  dateOfJoin?: string;
  department?: string;
  isDepartmentHead?: boolean;
}

export interface UsersState {
  users: UserData[];
  availableRoles: { id: string; name: string }[];
  availableDepartments: any[];
  totalCount: number;
  loading: boolean;
  error: string | null;
}
