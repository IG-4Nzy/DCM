import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Paper, Tooltip, IconButton } from '@mui/material';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdDelete as DeleteIcon } from 'react-icons/md';
import Button from '../../components/Button';
import SearchBar from '../../components/SearchBar';
import Table, { type Column } from '../../components/Table';
import { useToast } from '../../contexts/ToastContext';
import { fetchDepartments, createDepartment, updateDepartment, deleteDepartment } from './action';
import type { AppDispatch, RootState } from '../../store';
import type { DepartmentData } from './model';
import { hasPrivilege } from '../../helpers/authUtils';
import styles from "./index.module.scss";
import DepartmentFormModal from './DepartmentFormModal';

type Order = 'asc' | 'desc';

const Departments: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { departments, totalCount, loading } = useSelector((state: RootState) => state.departments);
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<keyof DepartmentData>('name');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<DepartmentData | null>(null);
  const [formName, setFormName] = useState('');
  const [formStatus, setFormStatus] = useState(true);

  useEffect(() => {
    dispatch(fetchDepartments({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      sortBy: orderBy as string,
      order,
      search: searchQuery,
      showToast
    }));
  }, [dispatch, showToast, page, rowsPerPage, orderBy, order, searchQuery]);

  const handleOpenModal = (department?: DepartmentData) => {
    if (department) {
      setEditingDepartment(department);
      setFormName(department.name);
      setFormStatus(department.status);
    } else {
      setEditingDepartment(null);
      setFormName('');
      setFormStatus(true);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => setIsModalOpen(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDepartment) {
        await dispatch(updateDepartment({
          payload: { id: editingDepartment.id || (editingDepartment as any)._id, name: formName, status: formStatus },
          showToast
        })).unwrap();
      } else {
        await dispatch(createDepartment({
          payload: { name: formName, status: formStatus },
          showToast
        })).unwrap();
      }
      handleCloseModal();
    } catch (err: any) {
      // Handled in thunk
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this department?")) {
      try {
        await dispatch(deleteDepartment({ id, showToast })).unwrap();
      } catch (err: any) {
        // Handled in thunk
      }
    }
  };

  const handleRequestSort = (property: keyof DepartmentData) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const columns: Column<DepartmentData>[] = [
    { id: 'name', label: 'Department Name', sortable: true },
    {
      id: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <label
          style={{
            color: row.status ? '#2e7d32' : '#d32f2f',
            fontWeight: 'bold',
            fontSize: '0.875rem'
          }}
        >
          {row.status ? 'Active' : 'Inactive'}
        </label>
      )
    }
  ];

  if (hasPrivilege('Update Department') || hasPrivilege('Delete Department')) {
    columns.push({
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          {hasPrivilege('Update Department') && (
            <Tooltip title="Edit Department">
              <IconButton size="small" color="primary" sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }} onClick={() => handleOpenModal(row)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {hasPrivilege('Delete Department') && (
            <Tooltip title="Delete Department">
              <IconButton size="small" color="error" sx={{ backgroundColor: 'rgba(211, 47, 47, 0.04)' }} onClick={() => handleDelete(row.id || (row as any)._id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )
    });
  }

  return (
    <Box className={styles.departments} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <label style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          Departments
        </label>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search departments..." />
          {hasPrivilege('Create Department') && (
            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => handleOpenModal()}>
              Create Department
            </Button>
          )}
        </Box>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, p: 0, boxShadow: 'none', background: 'transparent' }}>
        <Table
          columns={columns}
          data={departments || []}
          orderBy={orderBy as string}
          order={order}
          onRequestSort={(prop) => handleRequestSort(prop as keyof DepartmentData)}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          totalCount={totalCount || 0}
        />
      </Paper>

      <DepartmentFormModal
        isModalOpen={isModalOpen}
        handleCloseModal={handleCloseModal}
        editingDepartment={editingDepartment}
        formName={formName}
        setFormName={setFormName}
        formStatus={formStatus}
        setFormStatus={setFormStatus}
        handleSubmit={handleSubmit}
      />
    </Box>
  );
};

export default Departments;