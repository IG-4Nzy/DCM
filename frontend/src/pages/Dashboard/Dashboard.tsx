import React, { useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Chip
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { ROUTE_CONSTANTS } from '../../router/constant';
import { MdRefresh, MdArrowForward } from 'react-icons/md';
import { colors, cardSx } from './constants';
import { getStatusColor } from './utils';
import { Icons } from '../../helpers/icons';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { fetchDashboardSummary } from './action';
import {
  KpiCard,
  RosterBanner,
  RosterCard,
  PendingWorksCard,
  ChecklistStatusCard,
  RecentObservationsCard,
  OpenRequestsCard
} from './components';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, error } = useSelector((state: RootState) => state.dashboard);

  const todayStr = useMemo(() => dayjs().format('YYYY-MM-DD'), []);

  const fetchDashboardData = () => {
    dispatch(fetchDashboardSummary(todayStr));
  };

  useEffect(() => {
    fetchDashboardData();
  }, [todayStr]);

  if (loading && !data) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', gap: 2 }}>
        <CircularProgress size={44} thickness={4} sx={{ color: colors.blue }} />
        <Typography variant="body2" sx={{ color: colors.textMuted, fontWeight: 500 }}>
          Loading dashboard...
        </Typography>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={fetchDashboardData}>Retry</Button>
        }>
          {error || 'Error loading dashboard'}
        </Alert>
      </Box>
    );
  }

  const latestObservations = data.observations.slice(0, 5);

  return (
    <Box sx={{ width: '100%', flexGrow: 1, bgcolor: colors.bg, p: { xs: 2, sm: 3, md: 4 }, boxSizing: 'border-box' }}>

      {/* Weekly Roster Reminder Alert Banner */}
      <RosterBanner
        show={data.showRoasterReminder}
        onConfigureClick={() => navigate(ROUTE_CONSTANTS.ROASTER)}
      />



      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: { xs: '24px', md: '30px' }, fontWeight: 800, color: colors.textPrimary, letterSpacing: '-0.5px' }}>
            Dashboard
          </Typography>
          <Typography sx={{ fontSize: '14px', fontWeight: 400, color: colors.textMuted, mt: 0.5 }}>
            Department: <strong style={{ color: colors.textSecondary }}>{data.userDepartment}</strong> — {dayjs().format('dddd, DD MMMM YYYY')}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<MdRefresh />}
          onClick={fetchDashboardData}
          sx={{
            borderRadius: '10px', borderColor: colors.border, color: colors.textSecondary,
            textTransform: 'none', fontWeight: 600, fontSize: '13px', px: 2, py: 1,
            '&:hover': { borderColor: colors.blue, color: colors.blue, bgcolor: colors.blueLight },
          }}
        >
          Refresh
        </Button>
      </Box>

      {/* KPI Cards Row */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 2.5,
          mb: 3,
        }}
      >
        <KpiCard
          title={data.isDepartmentHead ? "Pending Works" : "My Pending Works"}
          value={data.pendingWorks.length}
          icon={<Icons.WorksIcon size={18} />}
          accentColor={colors.blue}
          accentBg={colors.blueLight}
          onClick={() => navigate(ROUTE_CONSTANTS.WORKS)}
        />
        <KpiCard
          title="Open Observations"
          value={data.openObservationsCount}
          icon={<Icons.EyeIcon size={18} />}
          accentColor={colors.red}
          accentBg={colors.redLight}
          onClick={() => navigate(ROUTE_CONSTANTS.OBSERVATIONS)}
        />
        <KpiCard
          title="Morning Checklist"
          value={`${getStatusColor(data.checklists.morning).color === colors.green ? 100 : getStatusColor(data.checklists.morning).color === colors.amber ? 60 : 0}%`}
          icon={<Icons.DailyActivitiesIcon size={18} />}
          accentColor={getStatusColor(data.checklists.morning).color}
          accentBg={getStatusColor(data.checklists.morning).bg}
          onClick={() => navigate(ROUTE_CONSTANTS.DAILY_ACTIVITIES)}
        />
        <KpiCard
          title="BMS Checklist"
          value={`${getStatusColor(data.checklists.bms).color === colors.green ? 100 : getStatusColor(data.checklists.bms).color === colors.amber ? 60 : 0}%`}
          icon={<Icons.BMSChecklistIcon size={18} />}
          accentColor={getStatusColor(data.checklists.bms).color}
          accentBg={getStatusColor(data.checklists.bms).bg}
          onClick={() => navigate(ROUTE_CONSTANTS.BMS_CHECKLIST)}
        />
      </Box>

      {/* Main Content Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        {/* Left Column */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <RosterCard data={data} />
          <PendingWorksCard data={data} onViewAllClick={() => navigate(ROUTE_CONSTANTS.WORKS)} />
          <OpenRequestsCard data={data} onViewAllClick={() => navigate(ROUTE_CONSTANTS.REQUESTS)} />
        </Box>

        {/* Right Column */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {data.periodicActivities && data.periodicActivities.length > 0 && (
            <Card sx={cardSx}>
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography sx={{ fontSize: '15px', fontWeight: 700, color: colors.textPrimary }}>
                    Periodic Activity Alerts
                  </Typography>
                  <Button
                    size="small"
                    endIcon={<MdArrowForward />}
                    onClick={() => navigate(ROUTE_CONSTANTS.PERIODIC_ACTIVITIES)}
                    sx={{ textTransform: 'none', fontWeight: 600, color: colors.blue, fontSize: '13px' }}
                  >
                    View All
                  </Button>
                </Box>
                <Box 
                  sx={{ 
                    maxHeight: '180px', 
                    overflowY: 'auto', 
                    pr: 0.5, 
                    display: 'flex',
                    flexDirection: 'column',
                    '&::-webkit-scrollbar': { width: '4px' }, 
                    '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: '2px' } 
                  }}
                >
                  {data.periodicActivities.map((activity: any, idx: number) => {
                    const isOverdue = activity.daysRemaining < 0;
                    const remainingText = isOverdue
                      ? `Expired ${Math.abs(activity.daysRemaining)}d ago`
                      : activity.daysRemaining === 0
                      ? 'Today!'
                      : `${activity.daysRemaining}d left`;
                      
                    return (
                      <Box
                        key={activity._id || activity.id}
                        sx={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          py: 1.5, borderBottom: idx < (data.periodicActivities || []).length - 1 ? `1px solid ${colors.borderLight}` : 'none',
                        }}
                      >
                        <Box sx={{ pr: 1.5 }}>
                          <Typography sx={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary }}>
                            {activity.name}
                          </Typography>
                          <Typography sx={{ fontSize: '11px', color: colors.textMuted }}>
                            Due: {dayjs(activity.dueDate).format('DD-MM-YYYY')} {activity.remarks ? `· ${activity.remarks}` : ''}
                          </Typography>
                        </Box>
                        <Chip
                          label={remainingText}
                          size="small"
                          sx={{
                            bgcolor: isOverdue ? colors.redLight : activity.daysRemaining === 0 ? colors.amberLight : colors.blueLight,
                            color: isOverdue ? colors.red : activity.daysRemaining === 0 ? colors.amber : colors.blue,
                            fontWeight: 700, border: 'none', height: 22, fontSize: '0.7rem',
                            flexShrink: 0
                          }}
                        />
                      </Box>
                    );
                  })}
                </Box>
              </CardContent>
            </Card>
          )}
          <ChecklistStatusCard
            data={data}
            onMorningClick={() => navigate(ROUTE_CONSTANTS.DAILY_ACTIVITIES)}
            onBmsClick={() => navigate(ROUTE_CONSTANTS.BMS_CHECKLIST)}
          />
          <RecentObservationsCard
            latestObservations={latestObservations}
            onViewAllClick={() => navigate(ROUTE_CONSTANTS.OBSERVATIONS)}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
