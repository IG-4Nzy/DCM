// @ts-nocheck
import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Paper, Tooltip, IconButton, Button, Tabs, Tab, Chip } from '@mui/material';
import { MdAdd as AddIcon, MdDelete as DeleteIcon, MdUploadFile as UploadIcon, MdEdit as EditIcon } from 'react-icons/md';
import SearchBar from '../../components/SearchBar';
import Table, { type Column } from '../../components/Table';
import { useToast } from '../../contexts/ToastContext';
import { fetchInventory, createInventory, updateInventory, editInventoryItem, deleteInventory, bulkCreateInventory } from './action';
import { useConfirm } from '../../contexts/ConfirmContext';
import type { AppDispatch, RootState } from '../../store';
import type { InventoryData } from './model';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';
import { fetchUsers } from '../Users/action';
import { useTableState } from '../../hooks/useTableState';
import InventoryFormModal from './InventoryFormModal';
import InventoryDetailModal from './InventoryDetailModal';

type Order = 'asc' | 'desc';

const Inventory: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { inventory, loading, totalCount } = useSelector((state: RootState) => state.inventory);
  const { isSuperuser, privileges } = useSelector((state: RootState) => state.auth);
  const { users } = useSelector((state: RootState) => state.users);

  const [page, setPage] = useTableState('inventory_page', 0);
  const [rowsPerPage, setRowsPerPage] = useTableState('inventory_rowsPerPage', 5);
  const [order, setOrder] = useTableState<Order>('inventory_order', 'desc');
  const [orderBy, setOrderBy] = useTableState<string>('inventory_orderBy', 'lastUpdatedDate');
  const [searchQuery, setSearchQuery] = useTableState('inventory_search', '');

  const [activeTab, setActiveTab] = useTableState<'general' | 'returnable'>('inventory_activeTab', 'general');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryData | null>(null);

  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.INVENTORY_CREATE);
  const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.INVENTORY_UPDATE);
  const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.INVENTORY_DELETE);
  const canClickRow = hasUpdate || hasPrivilege(PRIVILEGES.INVENTORY_VIEW_ALL) || hasPrivilege(PRIVILEGES.INVENTORY_VIEW_DEPT);

  const getFetchParams = () => {
    const params: any = {
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      search: searchQuery,
      sort_by: orderBy,
      order: order,
    };
    if (!searchQuery.trim()) {
      params.isReturnable = activeTab === 'returnable';
    }
    return params;
  };

  useEffect(() => {
    dispatch(fetchUsers({ pagination: false }));
    dispatch(fetchInventory(getFetchParams()));
  }, [dispatch, page, rowsPerPage, searchQuery, orderBy, order, activeTab]);

  useEffect(() => {
    if (searchQuery.trim() && activeTab === 'general' && inventory && inventory.length > 0) {
      const hasReturnable = inventory.some(item => item.isReturnable === true);
      if (hasReturnable) {
        setActiveTab('returnable');
      }
    }
  }, [inventory, searchQuery, activeTab, setActiveTab]);

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

  const handleDelete = async (id: string) => {
    if (await confirm('Are you sure you want to delete this item?')) {
      const result = await dispatch(deleteInventory(id));
      if (deleteInventory.fulfilled.match(result)) {
        showToast('Item deleted successfully', 'success');
      } else {
        showToast((result.payload as string) || 'Failed to delete item', 'error');
      }
      dispatch(fetchInventory(getFetchParams()));
    }
  };

  const handleFormSubmit = async (data: any) => {
    if (selectedItem) {
      const result = await dispatch(editInventoryItem({ id: selectedItem.id || (selectedItem as any)._id, data }));
      if (editInventoryItem.fulfilled.match(result)) {
        showToast('Item updated successfully', 'success');
      } else {
        showToast((result.payload as string) || 'Failed to update item', 'error');
      }
    } else {
      const result = await dispatch(createInventory(data));
      if (createInventory.fulfilled.match(result)) {
        showToast('Item created successfully', 'success');
      } else {
        showToast((result.payload as string) || 'Failed to create item', 'error');
      }
    }
    dispatch(fetchInventory(getFetchParams()));
  };

  const handleUpdateItem = async (id: string, data: any) => {
    await dispatch(updateInventory({ id, data }));
    showToast('Item updated successfully', 'success');
  };

  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Optional: add loading state
    const resultAction = await dispatch(bulkCreateInventory(file));
    if (bulkCreateInventory.fulfilled.match(resultAction)) {
      showToast('Bulk upload successful', 'success');
      dispatch(fetchInventory(getFetchParams()));
    } else {
      showToast(resultAction.payload as string || 'Bulk upload failed', 'error');
    }
    // reset input
    event.target.value = '';
  };

  // Keep selected item synced with store
  useEffect(() => {
    if (selectedItem) {
      const updatedItem = inventory.find(i => (i.id || i._id) === (selectedItem.id || selectedItem._id));
      if (updatedItem) {
        setSelectedItem(updatedItem as InventoryData);
      }
    }
  }, [inventory, selectedItem]);

  const columns: Column<InventoryData>[] = [
    { id: 'itemName', label: 'Item Name', sortable: true },
    { id: 'almiraNumber', label: 'Almira Number', sortable: true },
    { id: 'rackNumber', label: 'Rack Number', sortable: true },
    { 
      id: 'quantity', 
      label: 'Quantity', 
      sortable: true,
      render: (row: InventoryData) => {
        if (row.isReturnable) {
          const out = row.currentHolders?.length || 0;
          const avail = row.quantity - out;
          return `${avail} / ${row.quantity} Available`;
        }
        return row.quantity;
      }
    },
  ];

  if (activeTab === 'returnable') {
    columns.push({
      id: 'status',
      label: 'Status',
      sortable: false,
      render: (row: InventoryData) => {
        const out = row.currentHolders?.length || 0;
        const avail = row.quantity - out;
        if (out === 0) {
          return <Chip label="In Stock" color="success" size="small" variant="outlined" />;
        } else if (avail === 0) {
          return <Chip label="All Checked Out" color="error" size="small" />;
        } else {
          return <Chip label={`${out} Out`} color="warning" size="small" />;
        }
      }
    });

    columns.push({
      id: 'currentHolders',
      label: 'Current Holders',
      sortable: false,
      render: (row: InventoryData) => {
        if (!row.currentHolders || row.currentHolders.length === 0) {
          return <span style={{ color: '#999', fontStyle: 'italic' }}>None</span>;
        }
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {row.currentHolders.map((h, i) => (
              <Chip 
                key={i} 
                label={h.givenTo} 
                size="small" 
                sx={{ 
                  backgroundColor: 'rgba(237, 108, 2, 0.08)', 
                  color: '#ed6c02', 
                  fontWeight: 600,
                  fontSize: '0.75rem' 
                }} 
              />
            ))}
          </Box>
        );
      }
    });
  }

  columns.push(
    { id: 'description', label: 'Description', sortable: false },
    { 
      id: 'lastUpdatedDate', 
      label: 'Last Updated Date', 
      sortable: true,
      render: (row: any) => {
        if (!row.lastUpdatedDate) return '-';
        const cleaned = row.lastUpdatedDate.replace(/\+00:00Z$/, 'Z').replace(/\+00:00$/, 'Z');
        const parsed = dayjs(cleaned);
        if (parsed.isValid()) {
          return parsed.format('DD-MM-YYYY h:mm A');
        }
        try {
          const d = new Date(cleaned);
          if (!isNaN(d.getTime())) {
            return dayjs(d).format('DD-MM-YYYY h:mm A');
          }
        } catch {}
        return row.lastUpdatedDate;
      }
    },
    { 
      id: 'lastUpdatedBy', 
      label: 'Last Updated By', 
      sortable: true,
      render: (row: any) => {
        if (!row.lastUpdatedBy) return '-';
        const user = users.find((u: any) => u.username === row.lastUpdatedBy);
        return user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : row.lastUpdatedBy;
      }
    }
  );

  if (hasUpdate || hasDelete) {
    columns.push({
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row: any) => (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          {hasUpdate && (
            <Tooltip title="Edit Item">
              <IconButton size="small" color="primary" sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }} onClick={(e) => { e.stopPropagation(); setSelectedItem(row); setIsFormModalOpen(true); }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {hasDelete && (
            <Tooltip title="Delete Item">
              <IconButton size="small" color="error" sx={{ backgroundColor: 'rgba(211, 47, 47, 0.04)' }} onClick={(e) => { e.stopPropagation(); handleDelete(row.id || row._id); }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    });
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <h2 style={{ margin: 0 ,color:"#333"}}>Inventory</h2>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, val) => { setSearchQuery(''); setActiveTab(val); setPage(0); }} aria-label="inventory tabs">
          <Tab label="General Inventory" value="general" sx={{ textTransform: 'none', fontWeight: 'bold' }} />
          <Tab label="Returnable Items" value="returnable" sx={{ textTransform: 'none', fontWeight: 'bold' }} />
        </Tabs>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search inventory..." />
        </Box>

        {hasCreate && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              component="label"
              variant="outlined"
              color="primary"
              startIcon={<UploadIcon />}
            >
              Bulk Upload
              <input
                type="file"
                hidden
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleBulkUpload}
              />
            </Button>
            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => { setSelectedItem(null); setIsFormModalOpen(true); }}>
              Add Item
            </Button>
          </Box>
        )}
      </Box>

      <Paper sx={{ width: '100%', mb: 2, p: 0, boxShadow: 'none', background: 'transparent' }}>
        <Table
          columns={columns}
          data={inventory}
          orderBy={orderBy}
          order={order}
          onRequestSort={handleRequestSort}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          totalCount={totalCount}
          onRowClick={canClickRow ? (row) => { setSelectedItem(row as InventoryData); setIsDetailModalOpen(true); } : undefined}
        />
      </Paper>

      <InventoryFormModal
        isModalOpen={isFormModalOpen}
        handleCloseModal={() => { setIsFormModalOpen(false); setSelectedItem(null); }}
        onSubmit={handleFormSubmit}
        editingItem={selectedItem}
      />

      <InventoryDetailModal
        isModalOpen={isDetailModalOpen}
        handleCloseModal={() => { setIsDetailModalOpen(false); setSelectedItem(null); }}
        item={selectedItem}
        onUpdate={handleUpdateItem}
        hasUpdatePrivilege={hasUpdate}
        users={users}
      />
    </Box>
  );
};

export default Inventory;