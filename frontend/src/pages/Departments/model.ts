// @ts-nocheck
export interface DepartmentData {
  id: string;
  name: string;
  status: boolean;
  departmentHead?: string;
}

export interface CreateDepartmentPayload {
  name: string;
  status: boolean;
  departmentHead?: string;
}

export interface UpdateDepartmentPayload {
  id: string;
  name: string;
  status: boolean;
  departmentHead?: string;
}

export interface DepartmentsState {
  departments: DepartmentData[];
  totalCount: number;
  loading: boolean;
  error: string | null;
}
