// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Paper, Tooltip, IconButton } from '@mui/material';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdDelete as DeleteIcon } from 'react-icons/md';
import type { AppDispatch, RootState } from '../../store';
import { fetchObservationCategories, createObservationCategory, updateObservationCategory, deleteObservationCategory } from './action';
import { fetchDepartments } from '../Departments/action';
import { fetchUsers } from '../Users/action';
import { fetchRoles } from '../Roles/action';
import Table, { type Column } from '../../components/Table';
import Button from '../../components/Button';
import SearchBar from '../../components/SearchBar';
import CategoryFormModal from './CategoryFormModal';
import { hasPrivilege } from '../../helpers/authUtils';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useTableState } from '../../hooks/useTableState';

type Order = 'asc' | 'desc';

const CategoryList: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { categories, loading } = useSelector((state: RootState) => state.observations);
  const { isSuperuser, privileges } = useSelector((state: RootState) => state.auth);
  const { departments } = useSelector((state: RootState) => state.departments || { departments: [] });
  const { users } = useSelector((state: RootState) => state.users || { users: [] });
  const { roles } = useSelector((state: RootState) => state.roles || { roles: [] });

  const [page, setPage] = useTableState('category_page', 0);
  const [rowsPerPage, setRowsPerPage] = useTableState('category_rowsPerPage', 10);
  const [order, setOrder] = useTableState<Order>('category_order', 'asc');
  const [orderBy, setOrderBy] = useTableState<string>('category_orderBy', 'name');
  const [searchQuery, setSearchQuery] = useTableState('category_search', '');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formName, setFormName] = useState('');
  const [formStatus, setFormStatus] = useState(true);
  const [formReportsTo, setFormReportsTo] = useState<string[]>([]);
  const [formRemarks, setFormRemarks] = useState('');

  const hasCreate = isSuperuser || privileges?.includes('Create Observation');
  const hasUpdate = isSuperuser || privileges?.includes('Update Observation');
  const hasDelete = isSuperuser || privileges?.includes('Delete Observation');

  useEffect(() => {
    dispatch(fetchObservationCategories({ 
      skip: page * rowsPerPage, 
      limit: rowsPerPage, 
      search: searchQuery 
    }));
    dispatch(fetchDepartments({ pagination: false }));
    dispatch(fetchUsers({ pagination: false }));
    dispatch(fetchRoles({ skip: 0, limit: 1000, sortBy: 'name', order: 'asc', search: '', pagination: false }));
  }, [dispatch, page, rowsPerPage, searchQuery]);

  const handleOpenModal = (category?: any) => {
    if (category) {
      setEditingCategory(category);
      setFormName(category.name);
      setFormStatus(category.status);
      setFormReportsTo(category.reportsTo ? category.reportsTo.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
      setFormRemarks(category.remarks || '');
    } else {
      setEditingCategory(null);
      setFormName('');
      setFormStatus(true);
      setFormReportsTo([]);
      setFormRemarks('');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const reportsToStr = formReportsTo.join(', ');
    if (editingCategory) {
      await dispatch(updateObservationCategory({ 
        id: editingCategory._id || editingCategory.id, 
        data: { name: formName, status: formStatus, reportsTo: reportsToStr, remarks: formRemarks } 
      }));
    } else {
      await dispatch(createObservationCategory({ 
        name: formName, status: formStatus, reportsTo: reportsToStr, remarks: formRemarks 
      }));
    }
    handleCloseModal();
    dispatch(fetchObservationCategories({ skip: page * rowsPerPage, limit: rowsPerPage, search: searchQuery }));
  };

  const { confirm } = useConfirm();

  const handleDelete = async (id: string) => {
    if (await confirm('Are you sure you want to delete this category?', 'Delete Category')) {
      await dispatch(deleteObservationCategory(id));
      dispatch(fetchObservationCategories({ skip: page * rowsPerPage, limit: rowsPerPage, search: searchQuery }));
    }
  };

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
    { id: 'name', label: 'Category Name', sortable: true },
    { id: 'reportsTo', label: 'Reports To', sortable: true, render: (row) => row.reportsTo || '-' },
    { id: 'remarks', label: 'Remarks', sortable: false, render: (row) => row.remarks || '-' },
    { 
      id: 'status', 
      label: 'Status', 
      sortable: true,
      render: (row) => (
        <label style={{ color: row.status ? '#2e7d32' : '#d32f2f', fontWeight: 'bold' }}>
          {row.status ? 'Active' : 'Inactive'}
        </label>
      )
    },
  ];

  if (hasUpdate || hasDelete) {
    columns.push({
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          {hasUpdate && (
            <Tooltip title="Edit Category">
              <IconButton size="small" color="primary" sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }} onClick={(e) => { e.stopPropagation(); handleOpenModal(row); }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {hasDelete && (
            <Tooltip title="Delete Category">
              <IconButton size="small" color="error" sx={{ backgroundColor: 'rgba(211, 47, 47, 0.04)' }} onClick={(e) => { e.stopPropagation(); handleDelete(row._id || row.id); }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )
    });
  }

  // Frontend sorting since API returns all for limit 100
  let displayedCategories = [...categories];
  if (orderBy) {
    displayedCategories.sort((a: any, b: any) => {
      const aVal = a[orderBy];
      const bVal = b[orderBy];
      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }
  
  const paginatedCategories = displayedCategories.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // Build options for multi-select reportsTo dropdown
  const roleOptions = (roles || []).map((r: any) => ({ value: r.name, label: `${r.name} (Role)` }));
  const deptOptions = (departments || []).map((d: any) => ({ value: d.name, label: `${d.name} (Department)` }));
  
  const reportsToOptions = [
    ...roleOptions,
    ...deptOptions
  ];

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <label style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Category Management</label>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search categories..." />
          {hasCreate && (
            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => handleOpenModal()}>
              Add Category
            </Button>
          )}
        </Box>
      </Box>
      
      <Paper sx={{ width: '100%', mb: 2, p: 0, boxShadow: 'none', background: 'transparent' }}>
        <Table 
          columns={columns} 
          data={paginatedCategories} 
          loading={loading}
          orderBy={orderBy}
          order={order}
          onRequestSort={(prop) => handleRequestSort(prop as string)}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          totalCount={categories.length}
          onRowClick={hasUpdate ? (row) => handleOpenModal(row) : undefined}
        />
      </Paper>

      <CategoryFormModal
        isModalOpen={isModalOpen}
        handleCloseModal={handleCloseModal}
        editingCategory={editingCategory}
        formName={formName}
        setFormName={setFormName}
        formStatus={formStatus}
        setFormStatus={setFormStatus}
        formReportsTo={formReportsTo}
        setFormReportsTo={setFormReportsTo}
        reportsToOptions={reportsToOptions}
        formRemarks={formRemarks}
        setFormRemarks={setFormRemarks}
        handleSubmit={handleSubmit}
      />
    </Box>
  );
};

export default CategoryList;
