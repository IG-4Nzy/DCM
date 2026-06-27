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
  OpenRequestsCard,
  RecentOperationLogsCard
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

  const activeAnnouncements = useMemo(() => {
    return (data?.announcements || []).filter((ann: any) => ann.daysRemaining === null || ann.daysRemaining >= 0);
  }, [data?.announcements]);

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
    <Box sx={{ width: '100%', flexGrow: 1, bgcolor: colors.bg, p: { xs: 2, sm: 3, md: 4 }, pb: { xs: 8, md: 9 }, boxSizing: 'border-box' }}>

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
                      ? 'Expired'
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
          {activeAnnouncements && activeAnnouncements.length > 0 && (
            <Card sx={cardSx}>
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography sx={{ fontSize: '15px', fontWeight: 700, color: colors.textPrimary }}>
                    Announcements
                  </Typography>
                  <Button
                    size="small"
                    endIcon={<MdArrowForward />}
                    onClick={() => navigate(ROUTE_CONSTANTS.ANNOUNCEMENTS)}
                    sx={{ textTransform: 'none', fontWeight: 600, color: colors.blue, fontSize: '13px' }}
                  >
                    View All
                  </Button>
                </Box>
                <Box 
                  sx={{ 
                    maxHeight: '220px', 
                    overflowY: 'auto', 
                    pr: 0.5, 
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    '&::-webkit-scrollbar': { width: '4px' }, 
                    '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: '2px' } 
                  }}
                >
                  {activeAnnouncements.map((ann: any, idx: number) => {
                    const daysLeft = ann.daysRemaining;
                    const isCritical = daysLeft !== null && daysLeft <= 2;
                    const dateText = ann.date ? dayjs(ann.date).format('DD-MM-YYYY') : '';

                    return (
                      <Box
                        key={ann._id || ann.id}
                        sx={{
                          pb: idx < (data.announcements || []).length - 1 ? 1.5 : 0,
                          borderBottom: idx < (data.announcements || []).length - 1 ? `1px solid ${colors.borderLight}` : 'none',
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                          <Typography sx={{ fontSize: '13px', fontWeight: 700, color: colors.textPrimary }}>
                            {ann.title}
                          </Typography>
                          {ann.date && (
                            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
                              <Typography sx={{ fontSize: '11px', color: colors.textMuted }}>
                                {dateText}
                              </Typography>
                              {daysLeft !== null && daysLeft <= 5 && (
                                <Chip
                                  label={daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                                  size="small"
                                  sx={{
                                    bgcolor: isCritical ? colors.redLight : colors.blueLight,
                                    color: isCritical ? colors.red : colors.blue,
                                    fontWeight: 700, border: 'none', height: 18, fontSize: '0.65rem',
                                    ml: 0.5
                                  }}
                                />
                              )}
                            </Box>
                          )}
                        </Box>
                        <Typography sx={{ fontSize: '12px', color: colors.textSecondary, whiteSpace: 'pre-wrap' }}>
                          {ann.description}
                        </Typography>
                        <Typography sx={{ fontSize: '10px', color: colors.textMuted, mt: 0.5, textAlign: 'right' }}>
                          Published by {ann.createdByFullName || (ann.createdBy ? `@${ann.createdBy}` : 'System')}
                        </Typography>
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
            onClusterClick={() => navigate(ROUTE_CONSTANTS.CLUSTER_CHECKLIST)}
          />
          <RecentObservationsCard
            latestObservations={latestObservations}
            onViewAllClick={() => navigate(ROUTE_CONSTANTS.OBSERVATIONS)}
          />
          <RecentOperationLogsCard
            openOperationLogs={data.openOperationLogs || []}
            onViewAllClick={() => navigate(ROUTE_CONSTANTS.OPERATION_LOGS)}
          />
        </Box>
      </Box>

      {/* Fixed Running Announcements Bar at Bottom */}
      {activeAnnouncements && activeAnnouncements.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: '46px',
            bgcolor: 'rgba(239, 246, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            borderTop: '1.5px solid #bfdbfe',
            py: 0,
            px: 3,
            display: 'flex',
            alignItems: 'center',
            zIndex: 1100,
            boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.05)',
            boxSizing: 'border-box'
          }}
        >
          {/* <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: '#2563eb',
              color: '#fff',
              px: 1.5,
              py: 0.5,
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              mr: 2,
              zIndex: 2,
              boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
              flexShrink: 0
            }}
          >
            ANNOUNCEMENTS
          </Box> */}
          <Box
            sx={{
              width: '100%',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Box
              sx={{
                display: 'inline-block',
                pl: '100%',
                animation: 'marquee 30s linear infinite',
                fontSize: '13px',
                fontWeight: 600,
                color: '#1e40af',
                '&:hover': {
                  animationPlayState: 'paused'
                },
                '@keyframes marquee': {
                  '0%': { transform: 'translate3d(0, 0, 0)' },
                  '100%': { transform: 'translate3d(-100%, 0, 0)' }
                }
              }}
            >
              {activeAnnouncements.map((ann: any) => {
                const daysLeft = ann.daysRemaining;
                const showDaysLeft = daysLeft !== null && daysLeft <= 5;
                const dateText = ann.date ? ` (Due: ${dayjs(ann.date).format('DD-MM-YYYY')}${showDaysLeft ? `, ${daysLeft === 0 ? 'Today!' : `${daysLeft}d left`}` : ''})` : '';
                return (
                  <span key={ann._id || ann.id} style={{ marginRight: '3.5rem', display: 'inline-block' }}>
                    📢 <strong>{ann.title}</strong>: {ann.description}{dateText}
                  </span>
                );
              })}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default Dashboard;
