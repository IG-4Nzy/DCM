// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Paper, Tooltip, IconButton, FormControl, InputLabel, Select, MenuItem, Checkbox, ListItemText, OutlinedInput, Tabs, Tab, TextField } from '@mui/material';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdDelete as DeleteIcon, MdCheckCircle as ApproveIcon } from 'react-icons/md';
import Button from '../../components/Button';
import SearchBar from '../../components/SearchBar';
import Table, { type Column } from '../../components/Table';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import type { AppDispatch, RootState } from '../../store';
import WorkFormModal from './WorkFormModal';
import WorkDetailModal from './WorkDetailModal';
import WorkLogFormModal from './WorkLogFormModal';
import WorkLogDetailModal from './WorkLogDetailModal';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';
import { getServerTime } from '../../helpers/time';
import request from '../../services/request';
import { useTableState } from '../../hooks/useTableState';
import { jwtDecode } from 'jwt-decode';
import styles from "./index.module.scss";

// Import fetchUsers from users action to populate assignee dropdown
import { fetchUsers } from '../Users/action';
import { fetchDepartments } from '../Departments/action';
import { fetchWorks, createWork, updateWork, deleteWork, transferWork, fetchWorkLogs, createWorkLog, updateWorkLog, deleteWorkLog } from './action';
import type { WorkData, WorkLogData } from './model';
import { parseTimeToMinutes } from './WorkLogFormModal';

type Order = 'asc' | 'desc';
type ActiveTabType = 'works' | 'emergency' | 'work_logs';

const getLoggedInUserDepartment = (): string => {
  try {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded: any = jwtDecode(token);
      return decoded.department || 'All Departments';
    }
  } catch (e) {
    console.error("Error decoding token:", e);
  }
  return 'All Departments';
};

const Works: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { users } = useSelector((state: RootState) => state?.users || { users: [] });
  const { username: currentUser, isSuperuser } = useSelector((state: RootState) => state?.auth || { username: '', isSuperuser: false });
  const departments = useSelector((state: RootState) => state?.departments?.departments || []);
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const isDepartmentHeadOfWork = React.useCallback((work: any) => {
    if (!currentUser || !departments || departments.length === 0) return false;

    const headDepts = departments.filter((d: any) => d.departmentHead === currentUser).map((d: any) => d.name);
    if (headDepts.length === 0) return false;

    if (work.createdBy) {
      const creatorUser = users.find((u: any) => u.username === work.createdBy);
      if (creatorUser && headDepts.includes(creatorUser.department)) {
        return true;
      }
    }

    const workAssignees = work.assignees || (work.assignee ? [work.assignee] : []);
    for (const assigneeId of workAssignees) {
      const assigneeUser = users.find((u: any) => u.username === assigneeId || u.id === assigneeId || u._id === assigneeId);
      if (assigneeUser && headDepts.includes(assigneeUser.department)) {
        return true;
      }
    }

    return false;
  }, [currentUser, departments, users]);

  const canFilterByDepartment = isSuperuser || hasPrivilege(PRIVILEGES.WORK_VIEW_ALL_DEPARTMENTS);
  const canFilterByAssignee = isSuperuser || hasPrivilege(PRIVILEGES.WORK_VIEW) || hasPrivilege(PRIVILEGES.WORK_VIEW_ALL_DEPARTMENTS);
  const canViewEmergency = isSuperuser || hasPrivilege(PRIVILEGES.EMERGENCY_WORK_VIEW);
  const canViewWorks = isSuperuser || hasPrivilege(PRIVILEGES.WORK_VIEW) || hasPrivilege(PRIVILEGES.WORK_VIEW_ASSIGNED);

  // Work Log Privileges
  const canViewWorkLogs = isSuperuser || hasPrivilege(PRIVILEGES.WORK_LOG_VIEW) || hasPrivilege(PRIVILEGES.WORK_LOG_VIEW_ALL);
  const canViewAllWorkLogs = isSuperuser || hasPrivilege(PRIVILEGES.WORK_LOG_VIEW_ALL);
  const canCreateWorkLog = isSuperuser || hasPrivilege(PRIVILEGES.WORK_LOG_CREATE);
  const canUpdateWorkLog = isSuperuser || hasPrivilege(PRIVILEGES.WORK_LOG_UPDATE) || canViewAllWorkLogs;
  const canDeleteWorkLog = isSuperuser || hasPrivilege(PRIVILEGES.WORK_LOG_DELETE) || canViewAllWorkLogs;

  const [selectedDepartment, setSelectedDepartment] = useTableState('work_selectedDepartment', getLoggedInUserDepartment());

  const filteredUsersForAssignee = React.useMemo(() => {
    if (!currentUser || !users) return [];
    if (canFilterByDepartment && selectedDepartment !== 'All Departments') {
      return users.filter((u) => u.department === selectedDepartment);
    }
    if (isSuperuser || hasPrivilege(PRIVILEGES.WORK_VIEW_ALL_DEPARTMENTS)) {
      return users;
    }
    const loggedInUser = users.find((u) => u.username === currentUser);
    if (!loggedInUser || !loggedInUser.department) {
      return users;
    }
    return users.filter((u) => u.department === loggedInUser.department);
  }, [users, currentUser, canFilterByDepartment, selectedDepartment, isSuperuser]);

  const [searchQuery, setSearchQuery] = useTableState('work_search', '');

  // Support legacy string values safely
  const [statusFilterVal, setStatusFilter] = useTableState<any>('work_statusFilter', ['Pending', 'In Progress', 'On Hold', 'Completed']);
  const statusFilter = React.useMemo(() => {
    if (typeof statusFilterVal === 'string') {
      if (statusFilterVal === 'All Statuses' || statusFilterVal === 'All') {
        return ['Pending', 'In Progress', 'On Hold', 'Completed', 'Closed'];
      }
      return [statusFilterVal];
    }
    if (Array.isArray(statusFilterVal)) {
      return statusFilterVal;
    }
    return ['Pending', 'In Progress', 'On Hold', 'Completed'];
  }, [statusFilterVal]);

  const [selectedAssignee, setSelectedAssignee] = useTableState('work_selectedAssignee', 'All');

  const [page, setPage] = useTableState('work_page', 0);
  const [rowsPerPage, setRowsPerPage] = useTableState('work_rowsPerPage', 5);
  const [order, setOrder] = useTableState<Order>('work_order', 'desc');
  const [orderBy, setOrderBy] = useTableState<string>('work_orderBy', 'createdAt');

  const { works, totalCount } = useSelector((state: RootState) => state?.works || { works: [], totalCount: 0 });

  // Work Log table and filter state
  const [selectedLogDepartment, setSelectedLogDepartment] = useTableState('worklog_selectedDepartment', getLoggedInUserDepartment());
  const [selectedLogUser, setSelectedLogUser] = useTableState('worklog_selectedUser', 'All');
  const [selectedLogDate, setSelectedLogDate] = useTableState('worklog_selectedDate', '');
  const [workLogPage, setWorkLogPage] = useTableState('worklog_page', 0);
  const [workLogRowsPerPage, setWorkLogRowsPerPage] = useTableState('worklog_rowsPerPage', 5);
  const [workLogOrder, setWorkLogOrder] = useTableState<Order>('worklog_order', 'desc');
  const [workLogOrderBy, setWorkLogOrderBy] = useTableState<string>('worklog_orderBy', 'date');

  // Users filtered by selected work log department
  const filteredUsersForWorkLog = React.useMemo(() => {
    if (!users) return [];
    if (selectedLogDepartment && selectedLogDepartment !== 'All Departments') {
      return users.filter((u: any) => u.department === selectedLogDepartment);
    }
    return users;
  }, [users, selectedLogDepartment]);

  const { workLogs, workLogsTotalCount } = useSelector((state: RootState) => state?.works || { workLogs: [], workLogsTotalCount: 0 });

  const [activeTab, setActiveTab] = useTableState<ActiveTabType>('work_activeTab', 'works');

  // Work Ticket Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWork, setEditingWork] = useState<any | null>(null);
  const [isEmergency, setIsEmergency] = useState(false);

  // Work Ticket Detail Modal state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingWork, setViewingWork] = useState<WorkData | null>(null);

  // Work Log Modal state
  const [isWorkLogModalOpen, setIsWorkLogModalOpen] = useState(false);
  const [editingWorkLog, setEditingWorkLog] = useState<WorkLogData | null>(null);
  const [isWorkLogDetailOpen, setIsWorkLogDetailOpen] = useState(false);
  const [viewingWorkLog, setViewingWorkLog] = useState<WorkLogData | null>(null);

  const [workName, setWorkName] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [priority, setPriority] = useState('Medium');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  useEffect(() => {
    dispatch(fetchUsers({
      pagination: false,
      showToast: undefined
    }));
    dispatch(fetchDepartments({
      limit: 1000
    }));
  }, [dispatch]);

  const loadWorks = React.useCallback((silent = false) => {
    dispatch(fetchWorks({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      sortBy: orderBy,
      order,
      search: searchQuery,
      status: statusFilter.join(','),
      assignee: selectedAssignee === 'All' ? undefined : selectedAssignee,
      department: selectedDepartment === 'All Departments' ? undefined : selectedDepartment,
      tab: activeTab,
      showToast: silent ? undefined : showToast
    }));
  }, [dispatch, page, rowsPerPage, orderBy, order, searchQuery, statusFilter, selectedAssignee, selectedDepartment, activeTab, showToast]);

  const loadWorkLogsData = React.useCallback((silent = false) => {
    dispatch(fetchWorkLogs({
      skip: workLogPage * workLogRowsPerPage,
      limit: workLogRowsPerPage,
      sortBy: workLogOrderBy,
      order: workLogOrder,
      search: searchQuery,
      user: canViewAllWorkLogs ? (selectedLogUser === 'All' ? undefined : selectedLogUser) : undefined,
      date: selectedLogDate || undefined,
      department: canViewAllWorkLogs ? (selectedLogDepartment === 'All Departments' ? undefined : selectedLogDepartment) : undefined,
      showToast: silent ? undefined : showToast
    }));
  }, [dispatch, workLogPage, workLogRowsPerPage, workLogOrderBy, workLogOrder, searchQuery, selectedLogUser, selectedLogDate, selectedLogDepartment, canViewAllWorkLogs, showToast]);

  // Validate and cleanup department selection from localStorage
  useEffect(() => {
    if (departments.length > 0) {
      if (selectedLogDepartment !== 'All Departments') {
        const logDeptExists = departments.some((d: any) => d.id === selectedLogDepartment || d._id === selectedLogDepartment || d.name === selectedLogDepartment);
        if (!logDeptExists) {
          setSelectedLogDepartment(getLoggedInUserDepartment());
        }
      }
      if (selectedDepartment !== 'All Departments') {
        const deptExists = departments.some((d: any) => d.id === selectedDepartment || d._id === selectedDepartment || d.name === selectedDepartment);
        if (!deptExists) {
          setSelectedDepartment(getLoggedInUserDepartment());
        }
      }
    }
  }, [departments, selectedLogDepartment, selectedDepartment, setSelectedLogDepartment, setSelectedDepartment]);

  useEffect(() => {
    if (activeTab === 'work_logs') {
      loadWorkLogsData();
    } else {
      loadWorks();
    }
  }, [activeTab, loadWorks, loadWorkLogsData]);

  useEffect(() => {
    if (!canViewWorks && activeTab === 'works') {
      if (canViewWorkLogs) {
        setActiveTab('work_logs');
      } else if (canViewEmergency) {
        setActiveTab('emergency');
      }
    }
    if (!canViewEmergency && activeTab === 'emergency') {
      setActiveTab(canViewWorks ? 'works' : 'work_logs');
      setPage(0);
    }
    if (!canViewWorkLogs && activeTab === 'work_logs') {
      setActiveTab(canViewWorks ? 'works' : 'emergency');
      setPage(0);
    }
  }, [canViewWorks, canViewEmergency, canViewWorkLogs, activeTab, setActiveTab, setPage]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return;
      if (activeTab === 'work_logs') {
        loadWorkLogsData(true);
      } else {
        loadWorks(true);
      }
    }, 60000); // 60s background sync
    return () => clearInterval(interval);
  }, [activeTab, loadWorks, loadWorkLogsData]);

  const handleOpenModal = (work?: any) => {
    if (work) {
      setEditingWork(work);
      setWorkName(work.workName);
      setAssignees(work.assignees || (work.assignee ? [work.assignee] : []));
      setPriority(work.priority);
      setDueDate(work.dueDate);
      setDescription(work.description);
      setAttachments((work.attachments || []).map((a: any) => ({ name: a.name || a } as File)));
      setIsEmergency(!!work.isEmergency);
    } else {
      setEditingWork(null);
      setWorkName('');
      setAssignees([]);
      setPriority('Medium');
      setDueDate('');
      setDescription('');
      setAttachments([]);
      setIsEmergency(!hasPrivilege(PRIVILEGES.WORK_CREATE) || activeTab === 'emergency');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleOpenDetailModal = (work: WorkData) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setViewingWork(work);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setViewingWork(null);
  };

  const handleUpdateFromDetail = async (payload: any, silent = false) => {
    try {
      await dispatch(updateWork({ payload, showToast, silent })).unwrap();
      setViewingWork((prev: any) => ({ ...prev, ...payload }));
    } catch (err: any) { }
  };

  const handleTransferFromDetail = async (id: string, newAssigneeId: string, reason: string) => {
    try {
      const updatedWork = await dispatch(transferWork({ id, newAssigneeId, reason, showToast })).unwrap();
      setViewingWork(updatedWork);
      loadWorks();
    } catch (err: any) { }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let finalAttachments: { name: string, url: string }[] = [];

      const newFiles = attachments.filter(f => f.size !== undefined);
      const existingFiles = attachments.filter(f => f.size === undefined);

      if (editingWork && editingWork.attachments) {
        finalAttachments = editingWork.attachments.filter((a: any) =>
          existingFiles.some(ef => ef.name === (a.name || a))
        );
      }

      if (newFiles.length > 0) {
        const formData = new FormData();
        newFiles.forEach(f => formData.append('files', f));

        const res = await request.post('/api/works/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        finalAttachments = [...finalAttachments, ...res.data];
      }

      const payload: any = {
        workName,
        assignees,
        priority,
        dueDate,
        description,
        attachments: finalAttachments,
        isEmergency
      };

      if (editingWork) {
        payload.id = editingWork.id || editingWork._id;
        await dispatch(updateWork({ payload, showToast })).unwrap();
      } else {
        await dispatch(createWork({ payload, showToast })).unwrap();
      }
      handleCloseModal();
      loadWorks();
    } catch (err: any) {
      console.error("Error submitting work:", err);
      if (err.name === 'ReferenceError' || err.isAxiosError) {
        showToast("Error saving ticket: " + (err.message || 'Unknown error'), "error");
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (await confirm("Are you sure you want to delete this work ticket?", "Delete Work")) {
      try {
        await dispatch(deleteWork({ id, showToast })).unwrap();
        loadWorks();
      } catch (err: any) { }
    }
  };

  // Work Log Handlers
  const handleOpenWorkLogModal = (log?: WorkLogData) => {
    if (log) {
      setEditingWorkLog(log);
    } else {
      setEditingWorkLog(null);
    }
    setIsWorkLogModalOpen(true);
  };

  const handleWorkLogSubmit = async (payload: any) => {
    try {
      if (editingWorkLog) {
        await dispatch(updateWorkLog({ payload, showToast })).unwrap();
      } else {
        await dispatch(createWorkLog({ payload, showToast })).unwrap();
      }
      setIsWorkLogModalOpen(false);
      setEditingWorkLog(null);
      loadWorkLogsData();
    } catch (err: any) { }
  };

  const handleDeleteWorkLog = async (id: string) => {
    if (await confirm("Are you sure you want to delete this daily work log?", "Delete Work Log")) {
      try {
        await dispatch(deleteWorkLog({ id, showToast })).unwrap();
        loadWorkLogsData();
      } catch (err: any) { }
    }
  };

  const handleOpenWorkLogDetail = (log: WorkLogData) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setViewingWorkLog(log);
    setIsWorkLogDetailOpen(true);
  };

  const handleRequestSort = (property: string) => {
    if (activeTab === 'work_logs') {
      const isAsc = workLogOrderBy === property && workLogOrder === 'asc';
      setWorkLogOrder(isAsc ? 'desc' : 'asc');
      setWorkLogOrderBy(property);
    } else {
      const isAsc = orderBy === property && order === 'asc';
      setOrder(isAsc ? 'desc' : 'asc');
      setOrderBy(property);
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    if (activeTab === 'work_logs') {
      setWorkLogPage(newPage);
    } else {
      setPage(newPage);
    }
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(event.target.value, 10);
    if (activeTab === 'work_logs') {
      setWorkLogRowsPerPage(val);
      setWorkLogPage(0);
    } else {
      setRowsPerPage(val);
      setPage(0);
    }
  };

  const columns: Column<WorkData>[] = [
    {
      id: 'workId',
      label: 'Work ID',
      sortable: false,
      render: (row) => (
        <span style={{ fontWeight: 'bold', color: '#1976d2' }}>
          {row.workId || '-'}
        </span>
      )
    },
    { id: 'workName', label: 'Work Name', sortable: false },
    {
      id: 'assignee',
      label: 'Assignees',
      sortable: false,
      render: (row) => {
        if (row.assigneesFullName) return row.assigneesFullName;
        const rowAssignees = row.assignees || (row.assignee ? [row.assignee] : []);
        if (rowAssignees.length === 0) return "Unassigned";
        const names = rowAssignees.map((assigneeId) => {
          const user = users.find((u: any) => u.id === assigneeId || u._id === assigneeId || u.username === assigneeId);
          if (user) {
            return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || '';
          }
          if (assigneeId && assigneeId.length !== 24) return assigneeId;
          return "User Removed";
        });
        return names.join(', ');
      }
    },
    {
      id: 'priority',
      label: 'Priority',
      sortable: false,
      render: (row) => (
        <label
          style={{
            color: row.priority === 'High' ? '#d32f2f' : row.priority === 'Medium' ? '#ed6c02' : '#2e7d32',
            fontWeight: 'bold',
            fontSize: '0.875rem'
          }}
        >
          {row.priority}
        </label>
      )
    },
    {
      id: 'dueDate',
      label: 'Due Date',
      sortable: false,
      render: (row) => {
        if (!row.dueDate) return '-';

        const today = getServerTime().toDate();
        today.setHours(0, 0, 0, 0);

        const due = new Date(row.dueDate);
        due.setHours(0, 0, 0, 0);

        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        let color = 'inherit';
        let text = row.dueDate;
        let fontWeight = 'normal';

        const isCompleted = row.status === 'Completed' || row.status === 'Closed';

        let showRed = false;
        if (isCompleted && row.completedAt) {
          const completedDate = new Date(row.completedAt);
          completedDate.setHours(0, 0, 0, 0);
          const due = new Date(row.dueDate);
          due.setHours(0, 0, 0, 0);
          if (completedDate.getTime() > due.getTime()) {
            showRed = true;
          }
        }

        if (!isCompleted) {
          if (diffDays === 1 || diffDays === 0) {
            color = '#ed6c02';
            fontWeight = 'bold';
          } else if (diffDays < 0) {
            color = '#d32f2f';
            fontWeight = 'bold';
            const pastDays = Math.abs(diffDays);
            text = `${row.dueDate} (due ${pastDays} day${pastDays > 1 ? 's' : ''})`;
          }
        } else if (showRed) {
          color = '#d32f2f';
          fontWeight = 'bold';
        }

        return <span style={{ color, fontWeight }}>{text}</span>;
      }
    },
    {
      id: 'status',
      label: 'Status',
      sortable: false,
      render: (row) => {
        const s = row.status || 'Pending';
        const color = s === 'Completed' ? '#2e7d32' : s === 'On Hold' ? '#ed6c02' : s === 'Assigned' ? '#1976d2' : '#757575';
        return <label style={{ color, fontWeight: 'bold', fontSize: '0.875rem' }}>{s}</label>;
      }
    },
  ];

  if (
    hasPrivilege(PRIVILEGES.WORK_UPDATE) ||
    hasPrivilege(PRIVILEGES.WORK_DELETE) ||
    hasPrivilege(PRIVILEGES.EMERGENCY_WORK_UPDATE) ||
    hasPrivilege(PRIVILEGES.EMERGENCY_WORK_DELETE) ||
    hasPrivilege(PRIVILEGES.EMERGENCY_WORK_APPROVE) ||
    departments.some((d: any) => d.departmentHead === currentUser)
  ) {
    columns.push({
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          {row.isEmergency && !row.approved && (isSuperuser || hasPrivilege(PRIVILEGES.WORK_UPDATE) || hasPrivilege(PRIVILEGES.EMERGENCY_WORK_APPROVE)) && (
            <Tooltip title="Approve Emergency Work">
              <IconButton
                size="small"
                color="success"
                sx={{ backgroundColor: 'rgba(46, 125, 50, 0.04)' }}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (await confirm("Are you sure you want to approve this emergency work?", "Approve Emergency Work")) {
                    try {
                      const userObj = users.find((u: any) => u.username === currentUser);
                      const fullName = userObj ? `${userObj.firstName || ''} ${userObj.lastName || ''}`.trim() || currentUser : currentUser;
                      const commentPayload = {
                        text: `This emergency work ticket was approved by ${fullName}.`,
                        user: "System",
                        timestamp: new Date().toISOString()
                      };
                      await dispatch(updateWork({
                        payload: {
                          id: row.id || row._id || '',
                          approved: true,
                          comments: [...(row.comments || []), commentPayload]
                        },
                        showToast
                      })).unwrap();
                      loadWorks();
                    } catch (err) { }
                  }
                }}
              >
                <ApproveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {(row.isEmergency ? (hasPrivilege(PRIVILEGES.WORK_UPDATE) || hasPrivilege(PRIVILEGES.EMERGENCY_WORK_UPDATE) || isDepartmentHeadOfWork(row)) : hasPrivilege(PRIVILEGES.WORK_UPDATE)) && (
            <Tooltip title="Edit Work">
              <IconButton size="small" color="primary" sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }} onClick={(e) => { e.stopPropagation(); handleOpenModal(row); }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {(row.isEmergency ? (hasPrivilege(PRIVILEGES.WORK_DELETE) || hasPrivilege(PRIVILEGES.EMERGENCY_WORK_DELETE) || isDepartmentHeadOfWork(row)) : hasPrivilege(PRIVILEGES.WORK_DELETE)) && (
            <Tooltip title="Delete Work">
              <IconButton size="small" color="error" sx={{ backgroundColor: 'rgba(211, 47, 47, 0.04)' }} onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )
    });
  }

  // Work Log Table Columns
  const workLogColumns: Column<WorkLogData>[] = [
    {
      id: 'date',
      label: 'Date',
      sortable: false,
      render: (row) => (
        <span style={{ fontWeight: 'bold', color: '#1976d2' }}>
          {row.date}
        </span>
      )
    },
    {
      id: 'username',
      label: 'User',
      sortable: false,
      render: (row) => (
        <span style={{ fontWeight: 500 }}>
          {row.userFullName || row.username} ({row.username})
        </span>
      )
    },
    {
      id: 'entries',
      label: 'Time Slots & Tracked Time',
      sortable: false,
      render: (row) => {
        let mins = 0;
        (row.entries || []).forEach((e) => {
          const s = parseTimeToMinutes(e.startTime);
          const end = parseTimeToMinutes(e.endTime);
          if (end > s && s >= 0) mins += (end - s);
        });
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        const durStr = hrs > 0 ? (remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`) : `${remMins}m`;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span style={{ fontWeight: 'bold' }}>{(row.entries || []).length} Slots</span>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>({durStr})</span>
          </Box>
        );
      }
    },
    {
      id: 'activities',
      label: 'Activities Summary',
      sortable: false,
      render: (row) => {
        const text = (row.entries || []).map((e) => `[${e.startTime}-${e.endTime}] ${e.activity}`).join(', ');
        return (
          <span style={{ maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', whiteSpace: 'nowrap' }}>
            {text || '-'}
          </span>
        );
      }
    }
  ];

  if (canUpdateWorkLog || canDeleteWorkLog) {
    workLogColumns.push({
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => {
        const isOwn = row.username === currentUser;
        const allowEdit = canViewAllWorkLogs || (isOwn && canUpdateWorkLog);
        const allowDelete = canViewAllWorkLogs || (isOwn && canDeleteWorkLog);
        return (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            {allowEdit && (
              <Tooltip title="Edit Work Log">
                <IconButton
                  size="small"
                  color="primary"
                  sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }}
                  onClick={(e) => { e.stopPropagation(); handleOpenWorkLogModal(row); }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {allowDelete && (
              <Tooltip title="Delete Work Log">
                <IconButton
                  size="small"
                  color="error"
                  sx={{ backgroundColor: 'rgba(211, 47, 47, 0.04)' }}
                  onClick={(e) => { e.stopPropagation(); handleDeleteWorkLog(row.id || row._id || ''); }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        );
      }
    });
  }

  const canClickRow = hasPrivilege(PRIVILEGES.WORK_UPDATE) || hasPrivilege(PRIVILEGES.EMERGENCY_WORK_UPDATE) || hasPrivilege(PRIVILEGES.WORK_VIEW_ASSIGNED) || hasPrivilege(PRIVILEGES.EMERGENCY_WORK_VIEW) || departments.some((d: any) => d.departmentHead === currentUser);

  return (
    <Box className={styles.users} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <label style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          Works
        </label>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <SearchBar
            value={searchQuery}
            onChange={(val) => {
              setSearchQuery(val);
              if (activeTab === 'work_logs') setWorkLogPage(0);
              else setPage(0);
            }}
            placeholder={activeTab === 'work_logs' ? "Search work logs..." : "Search works..."}
          />

          {activeTab !== 'work_logs' && (
            <>
              {canFilterByDepartment && (
                <FormControl size="small" sx={{ minWidth: 160, bgcolor: '#fff' }}>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={selectedDepartment}
                    label="Department"
                    onChange={(e) => { setSelectedDepartment(e.target.value as string); setPage(0); }}
                  >
                    <MenuItem value="All Departments">All Departments</MenuItem>
                    {departments.map((dept: any) => (
                      <MenuItem key={dept.id || dept._id || dept.name} value={dept.id || dept._id || dept.name}>
                        {dept.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              {canFilterByAssignee && (
                <FormControl size="small" sx={{ minWidth: 160, bgcolor: '#fff' }}>
                  <InputLabel>Assignee</InputLabel>
                  <Select
                    value={selectedAssignee}
                    label="Assignee"
                    onChange={(e) => { setSelectedAssignee(e.target.value as string); setPage(0); }}
                  >
                    <MenuItem value="All">All Assignees</MenuItem>
                    {filteredUsersForAssignee.map((user: any) => {
                      const name = (user.firstName || user.lastName) ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : (user.username || user.name);
                      return (
                        <MenuItem key={user.id || user._id || user.username} value={user.id || user._id || user.username}>
                          {name}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              )}
              <FormControl size="small" sx={{ minWidth: 180, bgcolor: '#fff' }}>
                <InputLabel>Status</InputLabel>
                <Select
                  multiple
                  value={statusFilter}
                  onChange={(e) => {
                    const value = e.target.value;
                    const nextVal = typeof value === 'string' ? value.split(',') : value;
                    setStatusFilter(nextVal);
                    setPage(0);
                  }}
                  input={<OutlinedInput label="Status" />}
                  renderValue={(selected) => selected.join(', ')}
                >
                  {['Pending', 'In Progress', 'On Hold', 'Completed', 'Closed'].map((name) => (
                    <MenuItem key={name} value={name}>
                      <Checkbox checked={statusFilter.indexOf(name) > -1} />
                      <ListItemText primary={name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {((activeTab === 'works' && hasPrivilege(PRIVILEGES.WORK_CREATE)) ||
                (activeTab === 'emergency' && (hasPrivilege(PRIVILEGES.WORK_CREATE) || hasPrivilege(PRIVILEGES.EMERGENCY_WORK_CREATE)))) && (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenModal()}
                  >
                    Create Work
                  </Button>
                )}
            </>
          )}

          {activeTab === 'work_logs' && (
            <>
              <TextField
                size="small"
                label="Date Filter"
                type="date"
                value={selectedLogDate}
                onChange={(e) => { setSelectedLogDate(e.target.value); setWorkLogPage(0); }}
                InputLabelProps={{ shrink: true }}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ bgcolor: '#fff', minWidth: 160 }}
              />
              {selectedLogDate && (
                <Button variant="text" size="small" onClick={() => { setSelectedLogDate(''); setWorkLogPage(0); }}>
                  Clear Date
                </Button>
              )}

              {/* Department and User filters only if user has View All Work Logs */}
              {canViewAllWorkLogs && (
                <FormControl size="small" sx={{ minWidth: 160, bgcolor: '#fff' }}>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={selectedLogDepartment}
                    label="Department"
                    onChange={(e) => { setSelectedLogDepartment(e.target.value as string); setSelectedLogUser('All'); setWorkLogPage(0); }}
                  >
                    <MenuItem value="All Departments">All Departments</MenuItem>
                    {departments.map((dept: any) => (
                      <MenuItem key={dept.id || dept._id || dept.name} value={dept.id || dept._id || dept.name}>
                        {dept.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              {canViewAllWorkLogs && (
                <FormControl size="small" sx={{ minWidth: 180, bgcolor: '#fff' }}>
                  <InputLabel>User Filter</InputLabel>
                  <Select
                    value={selectedLogUser}
                    label="User Filter"
                    onChange={(e) => { setSelectedLogUser(e.target.value as string); setWorkLogPage(0); }}
                  >
                    <MenuItem value="All">All Users</MenuItem>
                    {filteredUsersForWorkLog.map((u: any) => {
                      const uname = u.username || u.name;
                      const fname = `${u.firstName || ''} ${u.lastName || ''}`.trim() || uname;
                      return (
                        <MenuItem key={u.id || u._id || uname} value={uname}>
                          {fname} ({uname})
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              )}

              {canCreateWorkLog && (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenWorkLogModal()}
                >
                  Create Work Log
                </Button>
              )}
            </>
          )}
        </Box>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_e, val) => { setActiveTab(val); setPage(0); setWorkLogPage(0); }}
        sx={{
          mb: 3,
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 'bold',
            fontSize: '1.05rem',
          },
          '& .Mui-selected': {
            color: '#1976d2',
          },
          '& .MuiTabs-indicator': {
            backgroundColor: '#1976d2',
            height: 3,
          }
        }}
      >
        {canViewWorks && <Tab label="Works" value="works" />}
        {canViewEmergency && <Tab label="Emergency Works" value="emergency" />}
        {canViewWorkLogs && <Tab label="Work Logs" value="work_logs" />}
      </Tabs>

      <Paper sx={{ width: '100%', mb: 2, p: 0, boxShadow: 'none', background: 'transparent' }}>
        {activeTab === 'work_logs' ? (
          <Table
            columns={workLogColumns}
            data={workLogs || []}
            orderBy={workLogOrderBy}
            order={workLogOrder}
            onRequestSort={(prop) => handleRequestSort(prop as string)}
            page={workLogPage}
            rowsPerPage={workLogRowsPerPage}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            totalCount={workLogsTotalCount || 0}
            onRowClick={(row) => handleOpenWorkLogDetail(row as WorkLogData)}
          />
        ) : (
          <Table
            columns={columns}
            data={works || []}
            orderBy={orderBy}
            order={order}
            onRequestSort={(prop) => handleRequestSort(prop as string)}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            totalCount={totalCount || 0}
            onRowClick={canClickRow ? (row) => handleOpenDetailModal(row as WorkData) : undefined}
          />
        )}
      </Paper>

      <WorkFormModal
        isModalOpen={isModalOpen}
        handleCloseModal={handleCloseModal}
        editingWork={editingWork}
        workName={workName}
        setWorkName={setWorkName}
        assignees={assignees}
        setAssignees={setAssignees}
        priority={priority}
        setPriority={setPriority}
        dueDate={dueDate}
        setDueDate={setDueDate}
        description={description}
        setDescription={setDescription}
        attachments={attachments}
        setAttachments={setAttachments}
        users={filteredUsersForAssignee}
        handleSubmit={handleSubmit}
        isEmergency={isEmergency}
        setIsEmergency={setIsEmergency}
        activeTab={activeTab}
      />

      <WorkDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        work={viewingWork}
        users={filteredUsersForAssignee}
        onUpdate={handleUpdateFromDetail}
        onTransfer={handleTransferFromDetail}
      />

      <WorkLogFormModal
        isOpen={isWorkLogModalOpen}
        onClose={() => setIsWorkLogModalOpen(false)}
        editingLog={editingWorkLog}
        users={users}
        canViewAllLogs={canViewAllWorkLogs}
        currentUser={currentUser}
        onSubmit={handleWorkLogSubmit}
      />

      <WorkLogDetailModal
        isOpen={isWorkLogDetailOpen}
        onClose={() => setIsWorkLogDetailOpen(false)}
        log={viewingWorkLog}
      />
    </Box>
  );
};

export default Works;