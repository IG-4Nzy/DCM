import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Paper, Tooltip, IconButton, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdDelete as DeleteIcon } from 'react-icons/md';
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
import request from '../../services/request';
import { useTableState } from '../../hooks/useTableState';
import styles from "./index.module.scss";

// Import fetchUsers from users action to populate assignee dropdown
import { fetchUsers } from '../Users/action';
import { fetchWorks, createWork, updateWork, deleteWork, transferWork } from './action';
import type { WorkData } from './model';

type Order = 'asc' | 'desc';

const Works: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { users } = useSelector((state: RootState) => state?.users || { users: [] });
  const currentUser = useSelector((state: RootState) => state?.auth?.username);
  const { showToast } = useToast();

  const filteredUsersForAssignee = React.useMemo(() => {
    if (!currentUser || !users) return [];
    const loggedInUser = users.find((u) => u.username === currentUser);
    if (!loggedInUser || !loggedInUser.department) {
      return users;
    }
    return users.filter((u) => u.department === loggedInUser.department);
  }, [users, currentUser]);

  const [searchQuery, setSearchQuery] = useTableState('work_search', '');
  const [statusFilter, setStatusFilter] = useTableState('work_statusFilter', 'All Statuses');
  const [page, setPage] = useTableState('work_page', 0);
  const [rowsPerPage, setRowsPerPage] = useTableState('work_rowsPerPage', 5);
  const [order, setOrder] = useTableState<Order>('work_order', 'asc');
  const [orderBy, setOrderBy] = useTableState<string>('work_orderBy', 'workName');

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setPage(0);
  };

  const { works, totalCount } = useSelector((state: RootState) => state?.works || { works: [], totalCount: 0 });

  // Modal and Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWork, setEditingWork] = useState<any | null>(null);
  
  // Detail Modal state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingWork, setViewingWork] = useState<WorkData | null>(null);

  const [workName, setWorkName] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  useEffect(() => {
    dispatch(fetchUsers({
      pagination: false,
      showToast: undefined
    }));
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchWorks({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      sortBy: orderBy,
      order,
      search: searchQuery,
      status: statusFilter,
      showToast
    }));
  }, [dispatch, page, rowsPerPage, orderBy, order, searchQuery, statusFilter, showToast]);

  const handleOpenModal = (work?: any) => {
    if (work) {
      setEditingWork(work);
      setWorkName(work.workName);
      setAssignee(work.assignee);
      setPriority(work.priority);
      setDueDate(work.dueDate);
      setDescription(work.description);
      setAttachments((work.attachments || []).map((a: any) => ({ name: a.name || a } as File)));
    } else {
      setEditingWork(null);
      setWorkName('');
      setAssignee('');
      setPriority('Medium');
      setDueDate('');
      setDescription('');
      setAttachments([]);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleOpenDetailModal = (work: WorkData) => {
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
      dispatch(fetchWorks({
        skip: page * rowsPerPage,
        limit: rowsPerPage,
        sortBy: orderBy,
        order,
        search: searchQuery,
        status: statusFilter
      }));
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
        assignee,
        priority,
        dueDate,
        description,
        attachments: finalAttachments 
      };

      if (editingWork) {
        payload.id = editingWork.id || editingWork._id;
        await dispatch(updateWork({ payload, showToast })).unwrap();
      } else {
        await dispatch(createWork({ payload, showToast })).unwrap();
      }
      handleCloseModal();
      
      // Optionally re-fetch to ensure pagination is perfectly synced
      dispatch(fetchWorks({
        skip: page * rowsPerPage,
        limit: rowsPerPage,
        sortBy: orderBy,
        order,
        search: searchQuery,
        status: statusFilter
      }));
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
        dispatch(fetchWorks({
          skip: page * rowsPerPage,
          limit: rowsPerPage,
          sortBy: orderBy,
          order,
          search: searchQuery,
          status: statusFilter
        }));
      } catch (err: any) {}
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
      label: 'Assignee', 
      sortable: true,
      render: (row) => {
        if (!row.assignee) return "Unassigned";
        const user = users.find((u: any) => u.id === row.assignee || u._id === row.assignee || u.username === row.assignee);
        if (user) {
          return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || '';
        }
        return "User Removed";
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
        
        const today = new Date();
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

  if (hasPrivilege(PRIVILEGES.WORK_UPDATE) || hasPrivilege(PRIVILEGES.WORK_DELETE)) {
    columns.push({
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          {hasPrivilege(PRIVILEGES.WORK_UPDATE) && (
            <Tooltip title="Edit Work">
              <IconButton size="small" color="primary" sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }} onClick={(e) => { e.stopPropagation(); handleOpenModal(row); }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {hasPrivilege(PRIVILEGES.WORK_DELETE) && (
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

  const canClickRow = hasPrivilege(PRIVILEGES.WORK_UPDATE) || hasPrivilege(PRIVILEGES.WORK_VIEW_ASSIGNED);

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
          <FormControl size="small" sx={{ minWidth: 160, bgcolor: '#fff' }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => handleStatusFilterChange(e.target.value as string)}
            >
              <MenuItem value="All Statuses">All Statuses</MenuItem>
              <MenuItem value="Pending">Pending</MenuItem>
              <MenuItem value="On Hold">On Hold</MenuItem>
              <MenuItem value="Completed">Completed</MenuItem>
              <MenuItem value="Closed">Closed</MenuItem>
            </Select>
          </FormControl>
          {hasPrivilege(PRIVILEGES.WORK_CREATE) && (
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
        assignee={assignee}
        setAssignee={setAssignee}
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