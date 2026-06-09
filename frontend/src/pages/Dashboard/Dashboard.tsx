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
  Tooltip
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { Icons } from '../../helpers/icons';
import { ROUTE_CONSTANTS } from '../../router/constant';
import request from '../../services/request';
import { MdRefresh } from 'react-icons/md';

// ==========================================
// Types & Interfaces
// ==========================================
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
}

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
}

interface ChecklistProgressProps {
  title: string;
  status: string;
  onClick: () => void;
}

// ==========================================
// Helper Functions (Pure functions)
// ==========================================
const getChecklistPercentage = (status: string): string => {
  if (status === 'Completed') return '100%';
  if (status === 'Draft') return '60%';
  return '0%';
};

const getChecklistTextColor = (status: string): string => {
  if (status === 'Completed') return '#16A34A'; // success
  if (status === 'Draft') return '#F59E0B'; // warning
  return '#DC2626'; // danger
};

const getPriorityColor = (priority: string): string => {
  switch (priority?.toLowerCase()) {
    case 'high': return '#DC2626';
    case 'medium': return '#F59E0B';
    case 'low': return '#16A34A';
    default: return '#64748B';
  }
};

// ==========================================
// Reusable Child Components
// ==========================================
const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon, iconBgColor, iconColor }) => {
  return (
    <Card sx={{ 
      flex: 1, 
      bgcolor: '#FFFFFF', 
      border: '1px solid #E2E8F0', 
      borderRadius: '12px', 
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)', 
      backgroundImage: 'none'
    }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#64748B' }}>
            {title}
          </Typography>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: 32, 
            height: 32, 
            borderRadius: '6px', 
            bgcolor: iconBgColor,
            color: iconColor 
          }}>
            {icon}
          </Box>
        </Box>
        <Typography sx={{ fontSize: '36px', fontWeight: 700, color: '#0F172A', lineHeight: 1.1 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
};

const ChecklistProgressCard: React.FC<ChecklistProgressProps> = ({ title, status, onClick }) => {
  const pct = status === 'Completed' ? 100 : status === 'Draft' ? 60 : 0;
  const filledCount = Math.round(pct / 10);
  const emptyCount = 10 - filledCount;
  const blocks = '█'.repeat(filledCount) + '░'.repeat(emptyCount);
  const color = getChecklistTextColor(status);

  return (
    <Box 
      onClick={onClick}
      sx={{ 
        border: '1px solid #E2E8F0', 
        borderRadius: '12px', 
        p: 2.5, 
        mb: 2, 
        bgcolor: '#FFFFFF',
        cursor: 'pointer',
        transition: 'border-color 0.2s',
        '&:hover': {
          borderColor: '#CBD5E1'
        }
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#0F172A', fontSize: '14px' }}>
          {title}
        </Typography>
        <Chip
          label={status}
          size="small"
          sx={{
            bgcolor: `${color}15`,
            color: color,
            fontWeight: '600',
            border: `1px solid ${color}30`,
            height: 22,
            fontSize: '0.75rem'
          }}
        />
      </Box>
      <Box display="flex" alignItems="center" gap={1.5} mb={1}>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.1rem', letterSpacing: '1px', color: color, lineHeight: 1 }}>
          {blocks}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: '700', color: color, fontSize: '0.9rem' }}>
          {pct}%
        </Typography>
      </Box>
      <Box sx={{ width: '100%', height: 6, bgcolor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: color, borderRadius: 3 }} />
      </Box>
    </Box>
  );
};

// ==========================================
// Main Page Component
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
        <CircularProgress size={50} thickness={4} />
        <Typography variant="body1" color="textSecondary" fontWeight="500">
          Loading dashboard metrics...
        </Typography>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box p={4}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={fetchDashboardData}>
            Retry
          </Button>
        }>
          {error || 'Error loading dashboard'}
        </Alert>
      </Box>
    );
  }

  const latestObservations = data.observations.slice(0, 5);

  return (
    <Box sx={{ width: '100%', flexGrow: 1, display: 'flex', flexDirection: 'column', bgcolor: '#f8fafc', p: 4, boxSizing: 'border-box' }}>
      {/* 1. Friday Roster Reminder Banner */}
      {data.showRoasterReminder && (
        <Alert
          severity="warning"
          icon={<Icons.RoasterIcon style={{ fontSize: '1.75rem', color: '#F59E0B' }} />}
          sx={{
            mb: 3,
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            background: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            alignItems: 'center',
            '& .MuiAlert-message': {
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2
            }
          }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight="700" color="#F59E0B">
              Weekly Roster Reminder
            </Typography>
            <Typography variant="body2" color="textSecondary">
              It is Friday! Please ensure that the roster for the upcoming week has been configured, reviewed, and submitted for approval.
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="warning"
            size="small"
            onClick={() => navigate(ROUTE_CONSTANTS.ROASTER)}
            sx={{ 
              fontWeight: 'bold', 
              textTransform: 'none', 
              borderRadius: '8px', 
              bgcolor: '#F59E0B', 
              color: '#FFFFFF',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#D97706', boxShadow: 'none' } 
            }}
          >
            Configure Roster
          </Button>
        </Alert>
      )}

      {/* Top Header Section */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h1" sx={{ fontSize: '32px', fontWeight: 700, color: '#0F172A' }}>
            Operational Dashboard
          </Typography>
          <Typography sx={{ fontSize: '14px', fontWeight: 400, color: '#64748B', mt: 0.5 }}>
            Department: <strong>{data.userDepartment}</strong> — {dayjs().format('dddd, DD MMMM YYYY')}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<MdRefresh />}
          onClick={fetchDashboardData}
          sx={{
            borderRadius: '8px',
            borderColor: '#E2E8F0',
            color: '#64748B',
            textTransform: 'none',
            fontWeight: '600',
            fontSize: '14px',
            px: 2,
            py: 1,
            '&:hover': {
              borderColor: '#CBD5E1',
              bgcolor: '#F8FAFC',
            }
          }}
        >
          Refresh
        </Button>
      </Box>

      {/* KPI Row (4 equal cards) */}
      <Box display="flex" gap={3} mb={3} flexWrap="wrap" sx={{ width: '100%' }}>
        <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(25% - 18px)' }, display: 'flex' }}>
          <KpiCard
            title={data.isDepartmentHead ? "Pending Works" : "My Pending Works"}
            value={data.pendingWorks.length}
            icon={<Icons.WorksIcon size={16} />}
            iconBgColor="#2563EB15"
            iconColor="#2563EB"
          />
        </Box>
        <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(25% - 18px)' }, display: 'flex' }}>
          <KpiCard
            title="Open Observations"
            value={data.openObservationsCount}
            icon={<Icons.EyeIcon size={16} />}
            iconBgColor="#DC262615"
            iconColor="#DC2626"
          />
        </Box>
        <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(25% - 18px)' }, display: 'flex' }}>
          <KpiCard
            title="Morning Checklist Status"
            value={getChecklistPercentage(data.checklists.morning)}
            icon={<Icons.DailyActivitiesIcon size={16} />}
            iconBgColor={`${getChecklistTextColor(data.checklists.morning)}15`}
            iconColor={getChecklistTextColor(data.checklists.morning)}
          />
        </Box>
        <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(25% - 18px)' }, display: 'flex' }}>
          <KpiCard
            title="BMS Checklist Status"
            value={getChecklistPercentage(data.checklists.bms)}
            icon={<Icons.BMSChecklistIcon size={16} />}
            iconBgColor={`${getChecklistTextColor(data.checklists.bms)}15`}
            iconColor={getChecklistTextColor(data.checklists.bms)}
          />
        </Box>
      </Box>

      {/* Main Content Sections */}
      <Box display="flex" gap={3} flexWrap="wrap" sx={{ width: '100%', alignItems: 'stretch' }}>
        {/* Left Column (8 columns equivalent) */}
        <Box sx={{ width: { xs: '100%', md: 'calc(66.67% - 16px)' }, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box display="flex" flexDirection="column" gap={3}>
            {/* Today's Roster Shift Table */}
            <Card sx={{ bgcolor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', backgroundImage: 'none' }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography sx={{ fontSize: '18px', fontWeight: 600, color: '#0F172A', mb: 2 }}>
                  Today's Roster
                </Typography>
                {data.roasterShifts.length === 0 ? (
                  <Box py={3} textAlign="center">
                    <Typography variant="body2" color="textSecondary">
                      No shifts configured for this department today.
                    </Typography>
                  </Box>
                ) : (
                  <TableContainer sx={{ border: 'none', boxShadow: 'none', bgcolor: 'transparent' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                          <TableCell sx={{ fontWeight: 600, color: '#475569', py: 1.5, fontSize: '13px', borderBottom: '1px solid #E2E8F0' }}>Shift</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: '#475569', py: 1.5, fontSize: '13px', borderBottom: '1px solid #E2E8F0' }}>Department</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: '#475569', py: 1.5, fontSize: '13px', borderBottom: '1px solid #E2E8F0' }}>Assignees</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: '#475569', py: 1.5, fontSize: '13px', borderBottom: '1px solid #E2E8F0' }}>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.roasterShifts.map((roaster) => (
                          <TableRow key={roaster._id} sx={{ '&:last-child td': { border: 0 } }}>
                            <TableCell sx={{ py: 1.5, color: '#0F172A', fontWeight: 500, fontSize: '14px', borderBottom: '1px solid #F1F5F9' }}>
                              Shift {roaster.shift}
                            </TableCell>
                            <TableCell sx={{ py: 1.5, color: '#475569', fontSize: '14px', borderBottom: '1px solid #F1F5F9' }}>
                              {roaster.department || 'General'}
                            </TableCell>
                            <TableCell sx={{ py: 1.5, borderBottom: '1px solid #F1F5F9' }}>
                              <AvatarGroup max={4} sx={{ justifyContent: 'flex-start', '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.75rem' } }}>
                                {roaster.assigneeDetails?.map((assignee: any, idx: number) => (
                                  <Tooltip title={assignee.fullName} key={assignee.username || idx}>
                                    <Avatar sx={{ bgcolor: '#2563EB', fontWeight: 'bold' }}>
                                      {assignee.initials}
                                    </Avatar>
                                  </Tooltip>
                                ))}
                              </AvatarGroup>
                            </TableCell>
                            <TableCell sx={{ py: 1.5, borderBottom: '1px solid #F1F5F9' }}>
                              <Chip
                                label={data.roasterStatus}
                                size="small"
                                sx={{
                                  bgcolor: data.roasterStatus === 'Approved' ? '#16A34A15' : data.roasterStatus === 'Submitted' ? '#F59E0B15' : '#DC262615',
                                  color: data.roasterStatus === 'Approved' ? '#16A34A' : data.roasterStatus === 'Submitted' ? '#F59E0B' : '#DC2626',
                                  fontWeight: '600',
                                  border: `1px solid ${data.roasterStatus === 'Approved' ? '#16A34A30' : data.roasterStatus === 'Submitted' ? '#F59E0B30' : '#DC262630'}`,
                                  height: 22,
                                  fontSize: '0.75rem'
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

            {/* Pending Works Clean Task List */}
            <Card sx={{ bgcolor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', backgroundImage: 'none' }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography sx={{ fontSize: '18px', fontWeight: 600, color: '#0F172A', mb: 2 }}>
                  Pending Works
                </Typography>
                {data.pendingWorks.length === 0 ? (
                  <Box py={3} textAlign="center">
                    <Typography variant="body2" color="textSecondary">
                      No pending works or tasks found.
                    </Typography>
                  </Box>
                ) : (
                  <TableContainer sx={{ border: 'none', boxShadow: 'none', bgcolor: 'transparent' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                          <TableCell sx={{ fontWeight: 600, color: '#475569', py: 1.5, fontSize: '13px', borderBottom: '1px solid #E2E8F0' }}>Task Name</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: '#475569', py: 1.5, fontSize: '13px', borderBottom: '1px solid #E2E8F0' }}>Assignee</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: '#475569', py: 1.5, fontSize: '13px', borderBottom: '1px solid #E2E8F0' }}>Due Date</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: '#475569', py: 1.5, fontSize: '13px', borderBottom: '1px solid #E2E8F0' }}>Priority</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.pendingWorks.map((work) => (
                          <TableRow 
                            key={work._id} 
                            onClick={() => navigate(ROUTE_CONSTANTS.WORKS)}
                            sx={{ 
                              cursor: 'pointer', 
                              '&:hover': { bgcolor: '#F8FAFC' }, 
                              '&:last-child td': { border: 0 } 
                            }}
                          >
                            <TableCell sx={{ py: 1.5, color: '#0F172A', fontWeight: 500, fontSize: '14px', borderBottom: '1px solid #F1F5F9' }}>
                              {work.workName}
                            </TableCell>
                            <TableCell sx={{ py: 1.5, borderBottom: '1px solid #F1F5F9' }}>
                              <Tooltip title={work.assigneeName || 'Unassigned'}>
                                <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: '#2563EB', fontWeight: 'bold' }}>
                                  {work.assigneeInitials || 'UN'}
                                </Avatar>
                              </Tooltip>
                            </TableCell>
                            <TableCell sx={{ py: 1.5, color: '#475569', fontSize: '14px', borderBottom: '1px solid #F1F5F9' }}>
                              {work.dueDate ? dayjs(work.dueDate).format('DD MMM YYYY') : 'No Date'}
                            </TableCell>
                            <TableCell sx={{ py: 1.5, borderBottom: '1px solid #F1F5F9' }}>
                              <Chip
                                label={work.priority}
                                size="small"
                                sx={{
                                  bgcolor: `${getPriorityColor(work.priority)}15`,
                                  color: getPriorityColor(work.priority),
                                  fontWeight: '600',
                                  border: `1px solid ${getPriorityColor(work.priority)}30`,
                                  height: 22,
                                  fontSize: '0.75rem'
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
        </Box>

        {/* Right Column (4 columns equivalent) */}
        <Box sx={{ width: { xs: '100%', md: 'calc(33.33% - 8px)' }, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box display="flex" flexDirection="column" gap={3}>
            {/* Checklist Status */}
            <Card sx={{ bgcolor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', backgroundImage: 'none' }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography sx={{ fontSize: '18px', fontWeight: 600, color: '#0F172A', mb: 2 }}>
                  Checklist Status
                </Typography>
                <ChecklistProgressCard
                  title="Morning Checklist"
                  status={data.checklists.morning}
                  onClick={() => navigate(ROUTE_CONSTANTS.DAILY_ACTIVITIES)}
                />
                <ChecklistProgressCard
                  title="BMS Checklist"
                  status={data.checklists.bms}
                  onClick={() => navigate(ROUTE_CONSTANTS.DAILY_ACTIVITIES)}
                />
              </CardContent>
            </Card>

            {/* Recent Observations */}
            <Card sx={{ bgcolor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', backgroundImage: 'none' }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography sx={{ fontSize: '18px', fontWeight: 600, color: '#0F172A', mb: 2 }}>
                  Recent Observations
                </Typography>
                {latestObservations.length === 0 ? (
                  <Box py={3} textAlign="center">
                    <Typography variant="body2" color="textSecondary">
                      No observations logged for today.
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    <TableContainer sx={{ border: 'none', boxShadow: 'none', bgcolor: 'transparent' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                            <TableCell sx={{ fontWeight: 600, color: '#475569', py: 1.5, fontSize: '13px', borderBottom: '1px solid #E2E8F0' }}>ID</TableCell>
                            <TableCell sx={{ fontWeight: 600, color: '#475569', py: 1.5, fontSize: '13px', borderBottom: '1px solid #E2E8F0' }}>Category</TableCell>
                            <TableCell sx={{ fontWeight: 600, color: '#475569', py: 1.5, fontSize: '13px', borderBottom: '1px solid #E2E8F0' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 600, color: '#475569', py: 1.5, fontSize: '13px', borderBottom: '1px solid #E2E8F0' }}>Time</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {latestObservations.map((obs) => (
                            <TableRow key={obs._id} sx={{ '&:last-child td': { border: 0 } }}>
                              <TableCell sx={{ py: 1.5, color: '#0F172A', fontWeight: 600, fontSize: '14px', borderBottom: '1px solid #F1F5F9' }}>
                                {obs.observationId}
                              </TableCell>
                              <TableCell sx={{ py: 1.5, color: '#475569', fontSize: '14px', borderBottom: '1px solid #F1F5F9' }}>
                                {obs.category}
                              </TableCell>
                              <TableCell sx={{ py: 1.5, borderBottom: '1px solid #F1F5F9' }}>
                                <Chip
                                  label={obs.status}
                                  size="small"
                                  sx={{
                                    bgcolor: obs.status === 'Resolved' ? '#16A34A15' : '#DC262615',
                                    color: obs.status === 'Resolved' ? '#16A34A' : '#DC2626',
                                    fontWeight: '600',
                                    border: `1px solid ${obs.status === 'Resolved' ? '#16A34A30' : '#DC262630'}`,
                                    height: 20,
                                    fontSize: '0.75rem'
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={{ py: 1.5, color: '#64748B', fontSize: '12px', borderBottom: '1px solid #F1F5F9' }}>
                                {obs.observedTime}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <Box mt={2}>
                      <Button
                        variant="text"
                        onClick={() => navigate(ROUTE_CONSTANTS.OBSERVATIONS)}
                        sx={{
                          textTransform: 'none',
                          fontWeight: '600',
                          color: '#2563EB',
                          fontSize: '14px',
                          p: 0,
                          '&:hover': {
                            bgcolor: 'transparent',
                            textDecoration: 'underline'
                          }
                        }}
                      >
                        View All Observations →
                      </Button>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
