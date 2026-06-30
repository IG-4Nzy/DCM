// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Paper, Tooltip, IconButton, FormControl, InputLabel, Select, MenuItem, Checkbox, ListItemText, OutlinedInput, Tabs, Tab } from '@mui/material';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdDelete as DeleteIcon, MdCheckCircle as ApproveIcon } from 'react-icons/md';
import Button from '../../components/Button';
import SearchBar from '../../components/SearchBar';
import Table, { type Column } from '../../components/Table';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import type { AppDispatch, RootState } from '../../store';
import WorkFormModal from './WorkFormModal';
import WorkDetailModal from './WorkDetailModal';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';
import { getServerTime } from '../../helpers/time';
import request from '../../services/request';
import { useTableState } from '../../hooks/useTableState';
import styles from "./index.module.scss";

// Import fetchUsers from users action to populate assignee dropdown
import { fetchUsers } from '../Users/action';
import { fetchDepartments } from '../Departments/action';
import { fetchWorks, createWork, updateWork, deleteWork, transferWork } from './action';
import type { WorkData } from './model';

type Order = 'asc' | 'desc';

const Works: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { users } = useSelector((state: RootState) => state?.users || { users: [] });
  const { username: currentUser, isSuperuser } = useSelector((state: RootState) => state?.auth || { username: '', isSuperuser: false });
  const departments = useSelector((state: RootState) => state?.departments?.departments || []);
  const { showToast } = useToast();

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

  const canFilterByAssignee = isSuperuser || hasPrivilege(PRIVILEGES.WORK_VIEW);
  const canViewEmergency = isSuperuser || hasPrivilege(PRIVILEGES.EMERGENCY_WORK_VIEW);

  const filteredUsersForAssignee = React.useMemo(() => {
    if (!currentUser || !users) return [];
    const loggedInUser = users.find((u) => u.username === currentUser);
    if (!loggedInUser || !loggedInUser.department) {
      return users;
    }
    return users.filter((u) => u.department === loggedInUser.department);
  }, [users, currentUser]);

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
  const [order, setOrder] = useTableState<Order>('work_order', 'asc');
  const [orderBy, setOrderBy] = useTableState<string>('work_orderBy', 'workName');

  const { works, totalCount } = useSelector((state: RootState) => state?.works || { works: [], totalCount: 0 });



  const [activeTab, setActiveTab] = useTableState<'works' | 'emergency'>('work_activeTab', 'works');

  // Modal and Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWork, setEditingWork] = useState<any | null>(null);
  const [isEmergency, setIsEmergency] = useState(false);

  // Detail Modal state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingWork, setViewingWork] = useState<WorkData | null>(null);

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
      tab: activeTab,
      showToast: silent ? undefined : showToast
    }));
  }, [dispatch, page, rowsPerPage, orderBy, order, searchQuery, statusFilter, selectedAssignee, activeTab, showToast]);

  useEffect(() => {
    loadWorks();
  }, [loadWorks]);

  useEffect(() => {
    if (!canViewEmergency && activeTab === 'emergency') {
      setActiveTab('works');
      setPage(0);
    }
  }, [canViewEmergency, activeTab, setActiveTab, setPage]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadWorks(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [loadWorks]);

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
      // Update viewingWork so modal reflects new status/comments without closing
      setViewingWork((prev: any) => ({ ...prev, ...payload }));
    } catch (err: any) {
      // Handled in thunk
    }
  };

  const handleTransferFromDetail = async (id: string, newAssigneeId: string, reason: string) => {
    try {
      const updatedWork = await dispatch(transferWork({ id, newAssigneeId, reason, showToast })).unwrap();
      setViewingWork(updatedWork);
      loadWorks();
    } catch (err: any) {
      // Handled in thunk
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let finalAttachments: { name: string, url: string }[] = [];

      // Differentiate between actual new files and existing string-mapped pseudo-files
      const newFiles = attachments.filter(f => f.size !== undefined);
      const existingFiles = attachments.filter(f => f.size === undefined);

      // Preserve the URLs of existing files that weren't removed
      if (editingWork && editingWork.attachments) {
        finalAttachments = editingWork.attachments.filter((a: any) =>
          existingFiles.some(ef => ef.name === (a.name || a))
        );
      }

      // Upload new files
      if (newFiles.length > 0) {
        const formData = new FormData();
        newFiles.forEach(f => formData.append('files', f));

        // request is from services/request.ts
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

      // Optionally re-fetch to ensure pagination is perfectly synced
      loadWorks();
    } catch (err: any) {
      console.error("Error submitting work:", err);
      if (err.name === 'ReferenceError' || err.isAxiosError) {
        showToast("Error saving ticket: " + (err.message || 'Unknown error'), "error");
      }
    }
  };

  const { confirm } = useConfirm();

  const handleDelete = async (id: string) => {
    if (await confirm("Are you sure you want to delete this work ticket?", "Delete Work")) {
      try {
        await dispatch(deleteWork({ id, showToast })).unwrap();
        // Re-fetch
        loadWorks();
      } catch (err: any) { }
    }
  }

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const columns: Column<WorkData>[] = [
    { id: 'workName', label: 'Work Name', sortable: true },
    {
      id: 'assignee',
      label: 'Assignees',
      sortable: false,
      render: (row) => {
        const rowAssignees = row.assignees || (row.assignee ? [row.assignee] : []);
        if (rowAssignees.length === 0) return "Unassigned";
        const names = rowAssignees.map((assigneeId) => {
          const user = users.find((u: any) => u.id === assigneeId || u._id === assigneeId || u.username === assigneeId);
          if (user) {
            return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || '';
          }
          return "User Removed";
        });
        return names.join(', ');
      }
    },
    {
      id: 'priority',
      label: 'Priority',
      sortable: true,
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
      sortable: true,
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
          if (diffDays === 1 || diffDays === 0) { // 1 day to go or due today
            color = '#ed6c02'; // orange/yellow
            fontWeight = 'bold';
          } else if (diffDays < 0) {
            color = '#d32f2f'; // red
            fontWeight = 'bold';
            const pastDays = Math.abs(diffDays);
            text = `${row.dueDate} (due ${pastDays} day${pastDays > 1 ? 's' : ''})`;
          }
        } else if (showRed) {
          color = '#d32f2f'; // red
          fontWeight = 'bold';
        }

        return <span style={{ color, fontWeight }}>{text}</span>;
      }
    },
    {
      id: 'status',
      label: 'Status',
      sortable: true,
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
                      const commentPayload = {
                        text: `This emergency work ticket was approved by ${currentUser}.`,
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
                    } catch (err) {}
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
            onChange={setSearchQuery}
            placeholder="Search works..."
          />
          {canFilterByAssignee && (
            <FormControl size="small" sx={{ minWidth: 160, bgcolor: '#fff' }}>
              <InputLabel>Assignee</InputLabel>
              <Select
                value={selectedAssignee}
                label="Assignee"
                onChange={(e) => { setSelectedAssignee(e.target.value as string); setPage(0); }}
              >
                <MenuItem value="All">All Assignees</MenuItem>
                {users.map((u: any) => (
                  <MenuItem key={u.id || u._id} value={u.id || u._id}>
                    {u.displayName || u.username}
                  </MenuItem>
                ))}
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
        </Box>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_e, val) => { setActiveTab(val); setPage(0); }}
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
        <Tab label="Works" value="works" />
        {canViewEmergency && <Tab label="Emergency Works" value="emergency" />}
      </Tabs>

      <Paper sx={{ width: '100%', mb: 2, p: 0, boxShadow: 'none', background: 'transparent' }}>
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
    </Box>
  );
};

export default Works;