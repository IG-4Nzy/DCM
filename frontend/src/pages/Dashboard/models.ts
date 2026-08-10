// @ts-nocheck
export interface ShiftInfo {
  name: string;
  startTime: string;
  endTime: string;
}

export interface DashboardData {
  roasterShifts: any[];
  roasterStatus: string;
  checklists: {
    bms: string;
    morning: string;
    cluster: string;
  };
  showRoasterReminder: boolean;
  pendingWorks: any[];
  pendingRequests: any[];
  observations: any[];
  openObservationsCount: number;
  isDepartmentHead: boolean;
  userDepartment: string;
  userDepartmentName?: string;
  shiftConfig: {
    shiftStart: string;
    lateGracePeriod: number;
    shifts: ShiftInfo[];
  };
  todayAttendance: any[];
  periodicActivities?: any[];
  announcements?: any[];
  openOperationLogs?: any[];
}