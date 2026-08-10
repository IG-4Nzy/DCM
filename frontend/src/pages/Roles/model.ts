// @ts-nocheck
export interface RoleData {
  id: string;
  name: string;
  status: boolean;
  privileges: string[];
  lateLoginPrivileges?: string[];
  usersCount?: number;
}

export interface CreateRolePayload {
  name: string;
  status: boolean;
  privileges: string[];
  lateLoginPrivileges?: string[];
  usersCount?: number;
}

export interface UpdateRolePayload {
  id: string;
  name: string;
  status: boolean;
  privileges: string[];
  lateLoginPrivileges?: string[];
  usersCount?: number;
}

export interface RolesState {
  roles: RoleData[];
  availablePrivileges: string[];
  totalCount: number;
  loading: boolean;
  error: string | null;
}
