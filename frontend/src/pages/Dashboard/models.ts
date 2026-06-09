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
  };
  showRoasterReminder: boolean;
  pendingWorks: any[];
  pendingRequests: any[];
  observations: any[];
  openObservationsCount: number;
  isDepartmentHead: boolean;
  userDepartment: string;
  shiftConfig: {
    shiftStart: string;
    lateGracePeriod: number;
    shifts: ShiftInfo[];
  };
  todayAttendance: any[];
}