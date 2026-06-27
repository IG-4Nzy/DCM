import request from '../services/request';

export const fetchDaySummaryData = async (date: string) => {
  let observations: any[] = [];
  let visitors: any[] = [];

  try {
    const obsRes = await request.get('/api/observations', {
      params: { date_filter: date, pagination: false }
    });
    observations = obsRes.data.data || [];

    const visRes = await request.get('/api/requests/visitor-logs', {
      params: { limit: 500 }
    });
    const allVisitors = visRes.data.data || [];
    visitors = allVisitors.filter((v: any) => v.entryTime && v.entryTime.startsWith(date));
  } catch (err) {
    console.error("Failed to load day summary data", err);
  }

  return { observations, visitors };
};
