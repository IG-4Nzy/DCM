import request from '../services/request';
import dayjs, { Dayjs } from 'dayjs';

let timeOffsetMs = 0;
let isSynced = false;

export const syncServerTime = async () => {
  if (isSynced) return;
  try {
    const start = Date.now();
    const res = await request.get('/api/attendance/server-time');
    const end = Date.now();
    const latency = (end - start) / 2;
    if (res.data && res.data.currentTime) {
      const serverTime = new Date(res.data.currentTime).getTime();
      const localTime = end - latency;
      timeOffsetMs = serverTime - localTime;
      isSynced = true;
    }
  } catch (error) {
    console.error('Failed to sync server time', error);
  }
};

export const getServerTime = (): Dayjs => {
  return dayjs(Date.now() + timeOffsetMs);
};
