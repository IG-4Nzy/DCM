import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Paper, Tooltip, IconButton, MenuItem, Select, FormControl, TextField } from '@mui/material';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdDelete as DeleteIcon } from 'react-icons/md';
import type { AppDispatch, RootState } from '../../store';
import { fetchObservations, createObservation, updateObservation, deleteObservation } from './action';
import { fetchObservationCategories } from './action';
import { fetchDepartments } from '../Departments/action';
import { fetchUsers } from '../Users/action';
import Table, { type Column } from '../../components/Table';
import Button from '../../components/Button';
import SearchBar from '../../components/SearchBar';
import ObservationFormModal from './ObservationFormModal';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useTableState } from '../../hooks/useTableState';

type Order = 'asc' | 'desc';

const ObservationList: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { observations, categories, loading, totalCount } = useSelector((state: RootState) => state.observations);
  const { departments } = useSelector((state: RootState) => state.departments);
  const { users } = useSelector((state: RootState) => state.users);
  const { isSuperuser, privileges, username } = useSelector((state: RootState) => state.auth);

  const [page, setPage] = useTableState('obs_page', 0);
  const [rowsPerPage, setRowsPerPage] = useTableState('obs_rowsPerPage', 5);
  const [order, setOrder] = useTableState<Order>('obs_order', 'desc');
  const [orderBy, setOrderBy] = useTableState<string>('obs_orderBy', 'observationId');
  const [searchQuery, setSearchQuery] = useTableState('obs_search', '');

  const todayStr = new Date().toISOString().split('T')[0];
  const [statusFilter, setStatusFilter] = useTableState('obs_status', 'New');
  const [dateFilter, setDateFilter] = useTableState('obs_date', todayStr);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingObs, setEditingObs] = useState<any>(null);

  const initialFormData = {
    observedDate: '',
    observedTime: '',
    category: '',
    description: '',
    amc: '',
    informedTo: [] as string[],
    informedToOther: '',
    remarks: '',
    status: 'New'
  };
  const [formData, setFormData] = useState(initialFormData);
  const [showOther, setShowOther] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const hasCreatePrivilege = isSuperuser || privileges?.includes('Create Observation');
  const hasUpdatePrivilege = isSuperuser || privileges?.includes('Update Observation');
  const hasDeletePrivilege = isSuperuser || privileges?.includes('Delete Observation');

  useEffect(() => {
    dispatch(fetchObservationCategories({ pagination: false }));
    dispatch(fetchDepartments({ pagination: false }));
    dispatch(fetchUsers({ pagination: false }));
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchObservations({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      search: searchQuery,
      status_filter: statusFilter,
      date_filter: dateFilter || undefined
    }));
  }, [dispatch, page, rowsPerPage, statusFilter, dateFilter, searchQuery]);

  const handleOpenModal = (obs?: any, editMode: boolean = false) => {
    setIsEditMode(editMode);
    if (obs) {
      setEditingObs(obs);
      setFormData({
        observedDate: obs.observedDate,
        observedTime: obs.observedTime || '',
        category: obs.category,
        description: obs.description,
        amc: obs.amc,
        informedTo: Array.isArray(obs.informedTo) ? obs.informedTo : (obs.informedTo ? [obs.informedTo] : []),
        informedToOther: obs.informedToOther || '',
        remarks: obs.remarks || '',
        status: obs.status
      });
      setShowOther(Array.isArray(obs.informedTo) ? obs.informedTo.includes('Other') : obs.informedTo === 'Other');
    } else {
      setIsEditMode(true);
      setEditingObs(null);
      setFormData(initialFormData);
      setShowOther(false);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingObs(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.status === 'Closed' && !formData.remarks?.trim()) {
       alert("Remarks are mandatory when closing an observation.");
       return;
    }

    const payload: any = { ...formData };
    if (!payload.informedTo.includes('Other')) {
      payload.informedToOther = '';
    }

    if (editingObs) {
      await dispatch(updateObservation({ id: editingObs._id || editingObs.id, data: payload }));
    } else {
      payload.loggedBy = username || 'Unknown';
      await dispatch(createObservation(payload));
    }
    handleCloseModal();
    dispatch(fetchObservations({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      search: searchQuery,
      status_filter: statusFilter,
      date_filter: dateFilter || undefined
    }));
  };

  const { confirm } = useConfirm();

  const handleDelete = async (id: string) => {
    if (await confirm("Are you sure you want to delete this observation?", "Delete Observation")) {
      await dispatch(deleteObservation(id));
      dispatch(fetchObservations({
        skip: page * rowsPerPage,
        limit: rowsPerPage,
        search: searchQuery,
        status_filter: statusFilter,
        date_filter: dateFilter || undefined
      }));
    }
  }

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const columns: Column<any>[] = [
    { id: 'observationId', label: 'ID', sortable: true },
    {
      id: 'observedDate',
      label: 'Observed Date & Time',
      sortable: true,
      render: (row) => `${row.observedDate} ${row.observedTime || ''}`.trim()
    },
    { id: 'category', label: 'Category', sortable: true },
    { id: 'description', label: 'Description', sortable: false },
    { id: 'amc', label: 'AMC', sortable: true },
    { 
      id: 'informedTo', 
      label: 'Informed To', 
      sortable: true,
      render: (row) => {
        let informed = Array.isArray(row.informedTo) ? row.informedTo : (row.informedTo ? [row.informedTo] : []);
        let texts = informed.map((item: string) => item === 'Other' ? row.informedToOther : item);
        return texts.filter(Boolean).join(', ') || '-';
      }
    },
    { 
      id: 'loggedBy', 
      label: 'Logged By', 
      sortable: true,
      render: (row) => {
        const u = users.find((user: any) => user.username === row.loggedBy || user.id === row.loggedBy);
        return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username : row.loggedBy;
      }
    },
    {
      id: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <label style={{ color: row.status === 'Closed' ? '#2e7d32' : '#1976d2', fontWeight: 'bold' }}>
          {row.status}
        </label>
      )
    },
  ];

  if (hasUpdatePrivilege || hasDeletePrivilege) {
    columns.push({
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          {hasUpdatePrivilege && (
            <Tooltip title="Edit Observation">
              <IconButton size="small" color="primary" sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }} onClick={(e) => { e.stopPropagation(); handleOpenModal(row, true); }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {hasDeletePrivilege && (
            <Tooltip title="Delete Observation">
              <IconButton size="small" color="error" sx={{ backgroundColor: 'rgba(211, 47, 47, 0.04)' }} onClick={(e) => { e.stopPropagation(); handleDelete(row._id || row.id); }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )
    });
  }

  const categoryOptions = categories.filter((c: any) => c.status).map((c: any) => ({ value: c.name, label: c.name }));
  
  // Find full names for department heads
  const deptHeads = Array.from(new Set(departments.filter((d: any) => d.departmentHead).map((d: any) => d.departmentHead)));
  const informedToOptions = deptHeads.map((dh: any) => {
    const u = users.find((user: any) => user.username === dh || user.id === dh);
    const label = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username : dh;
    return { value: dh, label };
  }).concat([{ value: 'Other', label: 'Other' }]);

  const statusOptions = [{ value: 'New', label: 'New' }, { value: 'Closed', label: 'Closed' }];

  const canClickRow = hasUpdatePrivilege || hasPrivilege(PRIVILEGES.OBSERVATION_VIEW);

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small">
            <Select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              sx={{ minWidth: 150, height: 40 }}
            >
              <MenuItem value="New">New Observations</MenuItem>
              <MenuItem value="Closed">Closed Observations</MenuItem>
              <MenuItem value="">All Observations</MenuItem>
            </Select>
          </FormControl>
          <TextField 
            type="date"
            size="small"
            value={dateFilter} 
            onChange={(e: any) => { setDateFilter(e.target.value); setPage(0); }} 
            InputLabelProps={{ shrink: true }}
          />
          {dateFilter !== todayStr && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => { setDateFilter(todayStr); setPage(0); }}
              sx={{ height: 40 }}
            >
              Today
            </Button>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search observations..." />
          {hasCreatePrivilege && (
            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => handleOpenModal(undefined, true)}>
              Add Observation
            </Button>
          )}
        </Box>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, p: 0, boxShadow: 'none', background: 'transparent' }}>
        <Table
          columns={columns}
          data={observations}
          loading={loading}
          orderBy={orderBy}
          order={order}
          onRequestSort={(prop) => handleRequestSort(prop as string)}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          totalCount={totalCount}
          onRowClick={canClickRow ? (row) => handleOpenModal(row, false) : undefined}
        />
      </Paper>

      <ObservationFormModal
        isModalOpen={isModalOpen}
        handleCloseModal={handleCloseModal}
        editingObs={editingObs}
        isEditMode={isEditMode}
        setIsEditMode={setIsEditMode}
        hasUpdatePrivilege={hasUpdatePrivilege}
        hasCreatePrivilege={hasCreatePrivilege}
        formData={formData}
        setFormData={setFormData}
        showOther={showOther}
        setShowOther={setShowOther}
        categoryOptions={categoryOptions}
        informedToOptions={informedToOptions}
        statusOptions={statusOptions}
        handleSubmit={handleSubmit}
      />
    </Box>
  );
};

export default ObservationList;
