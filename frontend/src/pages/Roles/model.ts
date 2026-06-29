// @ts-nocheck
export interface RoleData {
  id: string;
  name: string;
  status: boolean;
  privileges: string[];
}

export interface CreateRolePayload {
  name: string;
  status: boolean;
  privileges: string[];
}

export interface UpdateRolePayload {
  id: string;
  name: string;
  status: boolean;
  privileges: string[];
}

export interface RolesState {
  roles: RoleData[];
  availablePrivileges: string[];
  totalCount: number;
  loading: boolean;
  error: string | null;
}
