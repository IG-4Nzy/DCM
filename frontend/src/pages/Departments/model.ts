export interface DepartmentData {
  id: string;
  name: string;
  status: boolean;
}

export interface CreateDepartmentPayload {
  name: string;
  status: boolean;
}

export interface UpdateDepartmentPayload {
  id: string;
  name: string;
  status: boolean;
}

export interface DepartmentsState {
  departments: DepartmentData[];
  totalCount: number;
  loading: boolean;
  error: string | null;
}
