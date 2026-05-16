import React, { useState, useMemo, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Paper, Tooltip, IconButton, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdDelete as DeleteIcon } from 'react-icons/md';
import Button from '../../components/Button';
import SearchBar from '../../components/SearchBar';
import TextField from '../../components/TextField';
import Table, { type Column } from '../../components/Table';
import Modal from '../../components/Modal';
import { useToast } from '../../contexts/ToastContext';
import { fetchUsers, createUser, updateUser, deleteUser } from './action';
import styles from "./index.module.scss";
import type { AppDispatch, RootState } from '../../store';
import type { UserData } from './model';

type Order = 'asc' | 'desc';

const Users: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { users, loading, error } = useSelector((state: RootState) => state.users);
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<keyof UserData>('username');

  // Modal and Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('User');
  const [formStatus, setFormStatus] = useState('Active');

  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  const handleOpenModal = (user?: UserData) => {
    if (user) {
      setEditingUser(user);
      setFormUsername(user.username);
      setFormPassword('');
      setFormRole(user.role);
      setFormStatus(user.status);
    } else {
      setEditingUser(null);
      setFormUsername('');
      setFormPassword('');
      setFormRole('User');
      setFormStatus('Active');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const payload: any = {
          id: editingUser.id,
          username: formUsername,
          role: formRole,
          status: formStatus
        };
        if (formPassword) {
          payload.password = formPassword;
        }
        await dispatch(updateUser(payload)).unwrap();
        showToast('User updated successfully', 'success');
      } else {
        await dispatch(createUser({
          username: formUsername,
          password: formPassword,
          role: formRole,
          status: formStatus
        })).unwrap();
        showToast('User created successfully', 'success');
      }
      handleCloseModal();
    } catch (err: any) {
      showToast(err || 'Failed to save user', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        await dispatch(deleteUser(id)).unwrap();
        showToast('User deleted successfully', 'success');
      } catch(err: any) {
        showToast(err || 'Failed to delete user', 'error');
      }
    }
  }

  const handleRequestSort = (property: keyof UserData) => {
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

  const filteredAndSortedUsers = useMemo(() => {
    if (!users) return [];
    
    let result = users.filter((user) =>
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase())
    );

    result = [...result].sort((a, b) => {
      if (b[orderBy] < a[orderBy]) {
        return order === 'asc' ? 1 : -1;
      }
      if (b[orderBy] > a[orderBy]) {
        return order === 'asc' ? -1 : 1;
      }
      return 0;
    });

    return result;
  }, [users, searchQuery, order, orderBy]);

  const paginatedUsers = filteredAndSortedUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const columns: Column<UserData>[] = [
    { id: 'username', label: 'Username', sortable: true },
    { id: 'role', label: 'Role', sortable: true },
    { 
      id: 'status', 
      label: 'Status', 
      sortable: true,
      render: (row) => (
        <label 
          style={{ 
            color: row.status === 'Active' ? '#2e7d32' : '#d32f2f',
            fontWeight: 'bold',
            fontSize: '0.875rem'
          }}
        >
          {row.status}
        </label>
      )
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Tooltip title="Edit User">
            <IconButton size="small" color="primary" sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }} onClick={() => handleOpenModal(row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete User">
            <IconButton size="small" color="error" sx={{ backgroundColor: 'rgba(211, 47, 47, 0.04)' }} onClick={() => handleDelete(row.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }
  ];

  return (
    <Box className={styles.users} sx={{ p: 3 }}>
      {/* Header Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <label style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          Users
        </label>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <SearchBar 
            value={searchQuery} 
            onChange={setSearchQuery} 
            placeholder="Search users..." 
          />
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<AddIcon />}
            onClick={() => handleOpenModal()}
          >
            Create User
          </Button>
        </Box>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, p: 0, boxShadow: 'none', background: 'transparent' }}>
        {/* Table */}
        <Table
          columns={columns}
          data={paginatedUsers}
          orderBy={orderBy as string}
          order={order}
          onRequestSort={(prop) => handleRequestSort(prop as keyof UserData)}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          totalCount={filteredAndSortedUsers.length}
        />
      </Paper>

      <Modal 
        open={isModalOpen} 
        handleClose={handleCloseModal} 
        title={editingUser ? "Edit User" : "Create User"}
      >
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Username"
            margin="normal"
            value={formUsername}
            onChange={(e) => setFormUsername(e.target.value)}
            required
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            margin="normal"
            value={formPassword}
            onChange={(e) => setFormPassword(e.target.value)}
            required={!editingUser}
            helperText={editingUser ? "Leave blank to keep existing password" : ""}
            sx={{
              '& .MuiFormHelperText-root': {
                color: '#637381'
              }
            }}
          />
          <FormControl fullWidth margin="normal" size="small" sx={{ mt: 2 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={formRole}
              label="Role"
              onChange={(e) => setFormRole(e.target.value as string)}
              sx={{ borderRadius: '8px' }}
            >
              <MenuItem value="User">User</MenuItem>
              <MenuItem value="Manager">Manager</MenuItem>
              <MenuItem value="Super Admin">Super Admin</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal" size="small" sx={{ mt: 2 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={formStatus}
              label="Status"
              onChange={(e) => setFormStatus(e.target.value as string)}
              sx={{ borderRadius: '8px' }}
            >
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Inactive">Inactive</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4, gap: 2 }}>
            <Button variant="text" onClick={handleCloseModal}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary">Save</Button>
          </Box>
        </form>
      </Modal>
    </Box>
  );
};

export default Users;