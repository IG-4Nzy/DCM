// @ts-nocheck
import request from '../services/request';
import dayjs, { Dayjs } from 'dayjs';

let timeOffsetMs = 0;
let isSynced = false;

export const updateServerTimeOffset = (dateHeader: string) => {
  const serverTime = new Date(dateHeader).getTime();
  if (!isNaN(serverTime)) {
    timeOffsetMs = serverTime - Date.now();
    isSynced = true;
  }
};

export const syncServerTime = async () => {
  if (isSynced) return;
  try {
    const res = await request.get('/api/attendance/server-time');
    if (res.headers && res.headers['date']) {
      updateServerTimeOffset(res.headers['date']);
    } else if (res.data && res.data.currentTime) {
      // Fallback if Date header is missing
      let timeStr = res.data.currentTime;
      if (!timeStr.includes('Z') && !timeStr.includes('+')) {
        timeStr = timeStr + '+05:30'; // Assume IST if naive
      }
      const serverTime = new Date(timeStr).getTime();
      timeOffsetMs = serverTime - Date.now();
      isSynced = true;
    }
  } catch (error) {
    console.error('Failed to sync server time', error);
  }
};

export const getServerTime = (): Dayjs => {
  return dayjs(Date.now() + timeOffsetMs);
};
