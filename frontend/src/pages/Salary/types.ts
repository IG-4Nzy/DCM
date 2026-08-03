export type Activity = {
  id: string;
  name: string;
  rate: number | string;
  maxUnits?: number | string;
};

export type Template = {
  id: string;
  title: string;
  activities: Activity[];
  allottedAmount?: number | string;
  maxStaffs?: number | string;
};

export type Member = {
  id: string;
  name: string;
  days: number | string;
  otHours?: number | string;
};

export type Group = {
  id: string;
  name: string;
  perDaySalary: number | string;
  templateId?: string;
  members: Member[];
  updatedBy?: string;
  updatedAt?: string;
};
