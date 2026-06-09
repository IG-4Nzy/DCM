import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  AvatarGroup,
  Tooltip,
  LinearProgress
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { Icons } from '../../helpers/icons';
import { ROUTE_CONSTANTS } from '../../router/constant';
import request from '../../services/request';
import { MdRefresh, MdTrendingUp, MdArrowForward } from 'react-icons/md';

// ==========================================
// Types & Interfaces
// ==========================================
interface ShiftInfo {
  name: string;
  startTime: string;
  endTime: string;
}

interface DashboardData {
  roasterShifts: any[];
  roasterStatus: string;
  checklists: {
    bms: string;
    morning: string;
  };
  showRoasterReminder: boolean;
  pendingWorks: any[];
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

// ==========================================
// Design Tokens
// ==========================================
const colors = {
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  blue: '#2563EB',
  blueLight: '#EFF6FF',
  green: '#16A34A',
  greenLight: '#F0FDF4',
  amber: '#F59E0B',
  amberLight: '#FFFBEB',
  red: '#DC2626',
  redLight: '#FEF2F2',
  purple: '#7C3AED',
  purpleLight: '#F5F3FF',
};

const cardSx = {
  bgcolor: colors.cardBg,
  border: `1px solid ${colors.border}`,
  borderRadius: '16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
  backgroundImage: 'none',
  transition: 'box-shadow 0.2s, transform 0.15s',
  '&:hover': {
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
};

// ==========================================
// Helper Functions
// ==========================================
const getChecklistPct = (status: string): number => {
  if (status === 'Completed') return 100;
  if (status === 'Draft') return 60;
  return 0;
};

const getStatusColor = (status: string) => {
  if (status === 'Completed') return { color: colors.green, bg: colors.greenLight };
  if (status === 'Draft') return { color: colors.amber, bg: colors.amberLight };
  return { color: colors.red, bg: colors.redLight };
};

const getPriorityColor = (priority: string) => {
  switch (priority?.toLowerCase()) {
    case 'high': return colors.red;
    case 'medium': return colors.amber;
    case 'low': return colors.green;
    default: return colors.textMuted;
  }
};

// ==========================================
// KPI Card Component
// ==========================================
interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  accentColor: string;
  accentBg: string;
  onClick?: () => void;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon, accentColor, accentBg, onClick }) => (
  <Card sx={{ ...cardSx, cursor: onClick ? 'pointer' : 'default', flex: 1, minWidth: 0 }} onClick={onClick}>
    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
        <Typography sx={{ fontSize: '13px', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {title}
        </Typography>
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: '10px', bgcolor: accentBg, color: accentColor,
        }}>
          {icon}
        </Box>
      </Box>
      <Typography sx={{ fontSize: '32px', fontWeight: 800, color: colors.textPrimary, lineHeight: 1.1, letterSpacing: '-0.5px' }}>
        {value}
      </Typography>
    </CardContent>
  </Card>
);

// ==========================================
// Checklist Progress Card
// ==========================================
interface ChecklistCardProps {
  title: string;
  status: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const ChecklistCard: React.FC<ChecklistCardProps> = ({ title, status, icon, onClick }) => {
  const pct = getChecklistPct(status);
  const { color, bg } = getStatusColor(status);

  return (
    <Box
      onClick={onClick}
      sx={{
        border: `1px solid ${colors.border}`,
        borderRadius: '14px',
        p: 2.5,
        bgcolor: colors.cardBg,
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': { borderColor: color, boxShadow: `0 2px 12px ${color}20`, transform: 'translateY(-1px)' }
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Box display="flex" alignItems="center" gap={1}>
          <Box sx={{ color, fontSize: 18, display: 'flex' }}>{icon}</Box>
          <Typography sx={{ fontWeight: 600, color: colors.textPrimary, fontSize: '14px' }}>
            {title}
          </Typography>
        </Box>
        <Chip
          label={status || 'Not Started'}
          size="small"
          sx={{
            bgcolor: bg, color, fontWeight: 700, border: `1px solid ${color}30`,
            height: 24, fontSize: '0.7rem', letterSpacing: '0.3px',
          }}
        />
      </Box>
      <Box display="flex" alignItems="center" gap={1.5}>
        <Box sx={{ flex: 1 }}>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{
              height: 8, borderRadius: 4, bgcolor: `${color}15`,
              '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: color },
            }}
          />
        </Box>
        <Typography sx={{ fontWeight: 700, color, fontSize: '13px', minWidth: 36, textAlign: 'right' }}>
          {pct}%
        </Typography>
      </Box>
    </Box>
  );
};

// ==========================================
// Section Header
// ==========================================
const SectionHeader: React.FC<{ title: string; action?: React.ReactNode }> = ({ title, action }) => (
  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
    <Typography sx={{ fontSize: '17px', fontWeight: 700, color: colors.textPrimary }}>
      {title}
    </Typography>
    {action}
  </Box>
);

// ==========================================
// Table Styles
// ==========================================
const thSx = { fontWeight: 700, color: colors.textSecondary, py: 1.5, fontSize: '12px', borderBottom: `1px solid ${colors.border}`, textTransform: 'uppercase' as const, letterSpacing: '0.3px' };
const tdSx = { py: 1.5, fontSize: '14px', borderBottom: `1px solid ${colors.borderLight}` };

// ==========================================
// Main Dashboard Component
// ==========================================
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const todayStr = useMemo(() => dayjs().format('YYYY-MM-DD'), []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await request.get(`/api/dashboard/summary?date=${todayStr}`);
      setData(res.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch dashboard summary:', err);
      setError('Could not load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [todayStr]);

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="80vh" gap={2}>
        <CircularProgress size={44} thickness={4} sx={{ color: colors.blue }} />
        <Typography variant="body2" sx={{ color: colors.textMuted, fontWeight: 500 }}>
          Loading dashboard...
        </Typography>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box p={4}>
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

      {/* ═══ Roster Reminder Banner ═══ */}
      {data.showRoasterReminder && (
        <Alert
          severity="warning"
          icon={<Icons.RoasterIcon style={{ fontSize: '1.5rem', color: colors.amber }} />}
          sx={{
            mb: 3, borderRadius: '14px', border: `1px solid ${colors.amber}30`, background: colors.amberLight,
            boxShadow: 'none', alignItems: 'center',
            '& .MuiAlert-message': { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 },
          }}
        >
          <Box>
            <Typography variant="subtitle2" fontWeight={700} color={colors.amber}>Weekly Roster Reminder</Typography>
            <Typography variant="body2" color="textSecondary">
              Please ensure the upcoming week's roster is configured, reviewed, and submitted for approval.
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            onClick={() => navigate(ROUTE_CONSTANTS.ROASTER)}
            sx={{
              fontWeight: 700, textTransform: 'none', borderRadius: '10px',
              bgcolor: colors.amber, color: '#fff', boxShadow: 'none',
              '&:hover': { bgcolor: '#D97706', boxShadow: 'none' },
            }}
          >
            Configure Roster
          </Button>
        </Alert>
      )}

      {/* ═══ Page Header ═══ */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography sx={{ fontSize: { xs: '24px', md: '30px' }, fontWeight: 800, color: colors.textPrimary, letterSpacing: '-0.5px' }}>
            Operational Dashboard
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

      {/* ═══ KPI Cards Row ═══ */}
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
          value={`${getChecklistPct(data.checklists.morning)}%`}
          icon={<Icons.DailyActivitiesIcon size={18} />}
          accentColor={getStatusColor(data.checklists.morning).color}
          accentBg={getStatusColor(data.checklists.morning).bg}
          onClick={() => navigate(ROUTE_CONSTANTS.DAILY_ACTIVITIES)}
        />
        <KpiCard
          title="BMS Checklist"
          value={`${getChecklistPct(data.checklists.bms)}%`}
          icon={<Icons.BMSChecklistIcon size={18} />}
          accentColor={getStatusColor(data.checklists.bms).color}
          accentBg={getStatusColor(data.checklists.bms).bg}
          onClick={() => navigate(ROUTE_CONSTANTS.BMS_CHECKLIST)}
        />
      </Box>

      {/* ═══ Main Content Grid ═══ */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        {/* ─── Left Column ─── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* Today's Roster — Shift-wise */}
          <Card sx={cardSx}>
            <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
              <SectionHeader
                title="Today's Roster"
                action={
                  <Chip
                    label={data.roasterStatus || 'N/A'}
                    size="small"
                    sx={{
                      bgcolor: data.roasterStatus === 'Approved' ? colors.greenLight : data.roasterStatus === 'Submitted' ? colors.amberLight : colors.redLight,
                      color: data.roasterStatus === 'Approved' ? colors.green : data.roasterStatus === 'Submitted' ? colors.amber : colors.red,
                      fontWeight: 700, border: 'none', height: 24, fontSize: '0.7rem',
                    }}
                  />
                }
              />
              {(() => {
                const activeRows = data.shiftConfig?.rosterRows && data.shiftConfig.rosterRows.length > 0
                  ? data.shiftConfig.rosterRows
                  : [
                      { name: 'Shift 1 Row 1', mappedShift: 'Shift-1' },
                      { name: 'Shift 1 Row 2', mappedShift: 'Shift-1' },
                      { name: 'Shift 2 Row 1', mappedShift: 'Shift-2' },
                      { name: 'Shift 2 Row 2', mappedShift: 'Shift-2' },
                      { name: 'Shift 3 Row 1', mappedShift: 'Shift-3' },
                      { name: 'Shift 3 Row 2', mappedShift: 'Shift-3' }
                    ];

                // Get the shifts configured in the system, defaulting to standard Shifts 1, 2, and 3
                const configuredShifts = data.shiftConfig?.shifts || [
                  { name: 'Shift 1', startTime: '07:00', endTime: '15:00' },
                  { name: 'Shift 2', startTime: '09:00', endTime: '17:00' },
                  { name: 'Shift 3', startTime: '15:00', endTime: '23:00' }
                ];

                const shiftsToRender = configuredShifts.filter(
                  (s: ShiftInfo) => s.name && s.name !== 'Leave' && s.name !== 'None'
                );

                const formatTime = (timeStr: string) => {
                  if (!timeStr) return '';
                  const parts = timeStr.split(':');
                  if (parts.length < 2) return timeStr;
                  const hr = parseInt(parts[0]);
                  const ampm = hr >= 12 ? 'PM' : 'AM';
                  const displayHr = hr % 12 || 12;
                  return `${displayHr.toString().padStart(2, '0')}:${parts[1]} ${ampm}`;
                };

                return (
                  <Box display="flex" flexDirection="column" gap={1.5} sx={{ py: 1 }}>
                    {shiftsToRender.map((sInfo: ShiftInfo) => {
                      const sName = sInfo.name;
                      const startTime = sInfo.startTime ? formatTime(sInfo.startTime) : '09:00 AM';
                      const endTime = sInfo.endTime ? formatTime(sInfo.endTime) : '05:00 PM';

                      const staffNames: string[] = [];
                      const rosterColumns = ['Shift-1', 'Shift-2', 'Shift-3'];

                      rosterColumns.forEach((colShift) => {
                        const colRows = [
                          activeRows.find((r: any) => r.name === `${colShift.replace('-', ' ')} Row 1`) || { name: `${colShift.replace('-', ' ')} Row 1`, mappedShift: colShift },
                          activeRows.find((r: any) => r.name === `${colShift.replace('-', ' ')} Row 2`) || { name: `${colShift.replace('-', ' ')} Row 2`, mappedShift: colShift }
                        ];

                        const matchedRoaster = data.roasterShifts.find(
                          (r: any) => r.shift === colShift && r.department === data.userDepartment
                        );

                        colRows.forEach((row: any, rIdx: number) => {
                          const rowMappedShift = row.mappedShift;
                          const isMatch = rowMappedShift && (
                            rowMappedShift === sName || 
                            rowMappedShift.replace(/\s+/g, '-') === sName.replace(/\s+/g, '-')
                          );
                          if (isMatch) {
                            const a = matchedRoaster?.assigneeDetails?.[rIdx];
                            if (a?.fullName) {
                              staffNames.push(a.fullName);
                            }
                          }
                        });
                      });

                      const staffNameStr = staffNames.length > 0 ? staffNames.join(', ') : 'Unassigned';

                      return (
                        <Box 
                          key={sName} 
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 1.5,
                            py: 0.5,
                          }}
                        >
                          <Typography sx={{ fontWeight: 600, fontSize: '14px', color: colors.textPrimary, minWidth: '150px' }}>
                            {startTime} — {endTime}
                          </Typography>
                          <Typography sx={{ fontSize: '14px', color: colors.textMuted }}>
                            -
                          </Typography>
                          <Typography sx={{ fontWeight: staffNames.length > 0 ? 500 : 400, fontSize: '14px', color: staffNames.length > 0 ? colors.textPrimary : '#94A3B8' }}>
                            {staffNameStr}
                          </Typography>
                        </Box>
                      );
                    })}

                    {/* Show Leave row if someone is marked on leave */}
                    {(() => {
                      const leaveRoaster = data.roasterShifts.find(
                        (r: any) => r.shift === 'Leave' && r.department === data.userDepartment
                      );
                      const leaveAssignees = leaveRoaster?.assigneeDetails || [];
                      const leaveNames = leaveAssignees
                        .map((a: any) => a.fullName)
                        .filter((name): name is string => !!name);

                      if (leaveNames.length === 0) return null;

                      return (
                        <Box 
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 1.5,
                            py: 0.5,
                            mt: 0.5,
                            borderTop: `1px dashed ${colors.border || '#E2E8F0'}`,
                            pt: 1,
                          }}
                        >
                          <Typography sx={{ fontWeight: 600, fontSize: '14px', color: colors.red || '#EF4444', minWidth: '150px' }}>
                            On Leave
                          </Typography>
                          <Typography sx={{ fontSize: '14px', color: colors.textMuted }}>
                            -
                          </Typography>
                          <Typography sx={{ fontWeight: 500, fontSize: '14px', color: colors.red || '#EF4444' }}>
                            {leaveNames.join(', ')}
                          </Typography>
                        </Box>
                      );
                    })()}
                  </Box>
                );
              })()}
            </CardContent>
          </Card>

          {/* Pending Works */}
          <Card sx={cardSx}>
            <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
              <SectionHeader
                title="Pending Works"
                action={
                  <Button
                    size="small"
                    endIcon={<MdArrowForward />}
                    onClick={() => navigate(ROUTE_CONSTANTS.WORKS)}
                    sx={{ textTransform: 'none', fontWeight: 600, color: colors.blue, fontSize: '13px' }}
                  >
                    View All
                  </Button>
                }
              />
              {data.pendingWorks.length === 0 ? (
                <Box py={4} textAlign="center">
                  <Typography variant="body2" color="textSecondary">No pending works.</Typography>
                </Box>
              ) : (
                <TableContainer sx={{ border: 'none', boxShadow: 'none', bgcolor: 'transparent' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={thSx}>Task Name</TableCell>
                        <TableCell sx={thSx}>Assignee</TableCell>
                        <TableCell sx={thSx}>Due Date</TableCell>
                        <TableCell sx={thSx}>Priority</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.pendingWorks.map((work, idx) => (
                        <TableRow
                          key={work._id}
                          onClick={() => navigate(ROUTE_CONSTANTS.WORKS)}
                          sx={{
                            cursor: 'pointer', bgcolor: idx % 2 === 0 ? 'transparent' : '#FAFBFC',
                            '&:hover': { bgcolor: colors.blueLight }, '&:last-child td': { border: 0 },
                          }}
                        >
                          <TableCell sx={{ ...tdSx, color: colors.textPrimary, fontWeight: 600 }}>
                            {work.workName}
                          </TableCell>
                          <TableCell sx={tdSx}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Tooltip title={work.assigneeName || 'Unassigned'}>
                                <Avatar sx={{ width: 28, height: 28, fontSize: '0.7rem', bgcolor: colors.purple, fontWeight: 700 }}>
                                  {work.assigneeInitials || 'UN'}
                                </Avatar>
                              </Tooltip>
                              <Typography sx={{ fontSize: '13px', color: colors.textPrimary }}>
                                {work.assigneeName || 'Unassigned'}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ ...tdSx, color: colors.textSecondary }}>
                            {work.dueDate ? dayjs(work.dueDate).format('DD MMM YYYY') : '—'}
                          </TableCell>
                          <TableCell sx={tdSx}>
                            <Chip
                              label={work.priority}
                              size="small"
                              sx={{
                                bgcolor: `${getPriorityColor(work.priority)}12`,
                                color: getPriorityColor(work.priority),
                                fontWeight: 700, border: 'none', height: 22, fontSize: '0.7rem',
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* ─── Right Column ─── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* Checklist Status */}
          <Card sx={cardSx}>
            <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
              <SectionHeader title="Checklist Status" />
              <Box display="flex" flexDirection="column" gap={2}>
                <ChecklistCard
                  title="Morning Checklist"
                  status={data.checklists.morning}
                  icon={<Icons.DailyActivitiesIcon />}
                  onClick={() => navigate(ROUTE_CONSTANTS.DAILY_ACTIVITIES)}
                />
                <ChecklistCard
                  title="BMS Checklist"
                  status={data.checklists.bms}
                  icon={<Icons.BMSChecklistIcon />}
                  onClick={() => navigate(ROUTE_CONSTANTS.BMS_CHECKLIST)}
                />
              </Box>
            </CardContent>
          </Card>

          {/* Recent Observations */}
          <Card sx={cardSx}>
            <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
              <SectionHeader
                title="Recent Observations"
                action={
                  <Button
                    size="small"
                    endIcon={<MdArrowForward />}
                    onClick={() => navigate(ROUTE_CONSTANTS.OBSERVATIONS)}
                    sx={{ textTransform: 'none', fontWeight: 600, color: colors.blue, fontSize: '13px' }}
                  >
                    View All
                  </Button>
                }
              />
              {latestObservations.length === 0 ? (
                <Box py={4} textAlign="center">
                  <Typography variant="body2" color="textSecondary">No observations logged today.</Typography>
                </Box>
              ) : (
                <Box>
                  {latestObservations.map((obs, idx) => (
                    <Box
                      key={obs._id}
                      sx={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        py: 1.5, borderBottom: idx < latestObservations.length - 1 ? `1px solid ${colors.borderLight}` : 'none',
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary }}>
                          {obs.observationId}
                        </Typography>
                        <Typography sx={{ fontSize: '11px', color: colors.textMuted }}>
                          {obs.category} · {obs.observedTime}
                        </Typography>
                      </Box>
                      <Chip
                        label={obs.status}
                        size="small"
                        sx={{
                          bgcolor: obs.status === 'Resolved' ? colors.greenLight : colors.redLight,
                          color: obs.status === 'Resolved' ? colors.green : colors.red,
                          fontWeight: 700, border: 'none', height: 22, fontSize: '0.7rem',
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
