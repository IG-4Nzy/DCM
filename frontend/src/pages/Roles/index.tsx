import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Paper, Tooltip, IconButton} from '@mui/material';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdDelete as DeleteIcon } from 'react-icons/md';
import Button from '../../components/Button';
import SearchBar from '../../components/SearchBar';
import Table, { type Column } from '../../components/Table';
import { useToast } from '../../contexts/ToastContext';
import type { AppDispatch, RootState } from '../../store';
import type { RoleData } from './model';
import RoleFormModal from './RolesFormModal';
import { hasPrivilege } from '../../helpers/authUtils';
import styles from "./index.module.scss";
import { createRole, deleteRole, fetchRoles, updateRole, fetchPrivileges } from './action';

type Order = 'asc' | 'desc';

const Roles: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { roles, availablePrivileges, totalCount, loading, error } = useSelector((state: RootState) => state?.roles);
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<keyof RoleData>('name');

  // Modal and Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleData | null>(null);
  const [formName, setFormName] = useState('');
  const [formStatus, setFormStatus] = useState(true);
  const [formPrivileges, setFormPrivileges] = useState<string[]>([]);

  useEffect(() => {
    dispatch(fetchPrivileges());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchRoles({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      sortBy: orderBy as string,
      order,
      search: searchQuery,
      showToast
    }));
  }, [dispatch, showToast, page, rowsPerPage, orderBy, order, searchQuery]);

  const handleOpenModal = (role?: RoleData) => {
    if (role) {
      setEditingRole(role);
      setFormName(role.name);
      setFormStatus(role.status);
      setFormPrivileges(role.privileges || []);
    } else {
      setEditingRole(null);
      setFormName('');
      setFormStatus(true);
      setFormPrivileges([]);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRole) {
        const payload: any = {
          id: editingRole.id,
          name: formName,
          status: formStatus,
          privileges: formPrivileges
        };
        await dispatch(updateRole({ payload, showToast })).unwrap();
      } else {
        await dispatch(createRole({
          payload: {
            name: formName,
            status: formStatus,
            privileges: formPrivileges
          },
          showToast
        })).unwrap();
      }
      handleCloseModal();
    } catch (err: any) {
      // Toast shown in thunk
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this role?")) {
      try {
        await dispatch(deleteRole({ id, showToast })).unwrap();
      } catch (err: any) {
        // Toast shown in thunk
      }
    }
  }

  const handleRequestSort = (property: keyof RoleData) => {
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

  const columns: Column<RoleData>[] = [
    { id: 'name', label: 'Role Name', sortable: true },
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

  if (hasPrivilege('Update Role') || hasPrivilege('Delete Role')) {
    columns.push({
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          {hasPrivilege('Update Role') && (
            <Tooltip title="Edit Role">
              <IconButton size="small" color="primary" sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }} onClick={() => handleOpenModal(row)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {hasPrivilege('Delete Role') && (
            <Tooltip title="Delete Role">
              <IconButton size="small" color="error" sx={{ backgroundColor: 'rgba(211, 47, 47, 0.04)' }} onClick={() => handleDelete(row.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )
    });
  }

  return (
    <Box className={styles.users} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <label style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          Roles
        </label>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search roles..."
          />
          {hasPrivilege('Create Role') && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => handleOpenModal()}
            >
              Create Role
            </Button>
          )}
        </Box>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, p: 0, boxShadow: 'none', background: 'transparent' }}>
        {/* Table */}
        <Table
          columns={columns}
          data={roles || []}
          orderBy={orderBy as string}
          order={order}
          onRequestSort={(prop) => handleRequestSort(prop as keyof RoleData)}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          totalCount={totalCount || 0}
        />
      </Paper>
      <RoleFormModal
        isModalOpen={isModalOpen}
        handleCloseModal={handleCloseModal}
        editingRole={editingRole}
        setFormName={setFormName}
        formName={formName}
        formStatus={formStatus}
        setFormStatus={setFormStatus}
        formPrivileges={formPrivileges}
        setFormPrivileges={setFormPrivileges}
        availablePrivileges={availablePrivileges}
        handleSubmit={handleSubmit}
      />
    </Box>
  );
};

export default Roles;