export interface RoleData {
  id: string;
  name: string;
  status: boolean;
}

export interface CreateRolePayload {
  name: string;
  status: boolean;
}

export interface UpdateRolePayload {
  id: string;
  name: string;
  status: boolean;
}

export interface RolesState {
  roles: RoleData[];
  totalCount: number;
  loading: boolean;
  error: string | null;
}
