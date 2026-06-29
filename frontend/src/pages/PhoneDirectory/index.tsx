import React, { useEffect, useState } from 'react';
import { Box, Button, IconButton, Paper, Typography } from '@mui/material';
import { MdAdd, MdDelete, MdEdit } from 'react-icons/md';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import Table from '../../components/Table';
import Modal from '../../components/Modal/index';
import TextField from '../../components/TextField';
import SearchBar from '../../components/SearchBar';
import { fetchPhoneDirectory, createPhoneEntry, updatePhoneEntry, deletePhoneEntry } from './action';
import styles from './index.module.scss';
import { useToast } from '../../contexts/ToastContext';
import type { Column } from '../../components/Table';

interface PhoneEntry {
  _id: string;
  id: string;
  name: string;
  contact_number: string;
  remarks?: string;
  createdBy: string;
  createdAt: string;
}

const PhoneDirectory: React.FC = () => {
  const { privileges = [], isSuperuser } = useSelector((state: RootState) => state.auth);
  const { showToast } = useToast();
  
  const canView = privileges.includes("View Phone Directory") || isSuperuser;
  const canCreate = privileges.includes("Create Phone Directory") || isSuperuser;
  const canUpdate = privileges.includes("Update Phone Directory") || isSuperuser;
  const canDelete = privileges.includes("Delete Phone Directory") || isSuperuser;

  const [data, setData] = useState<PhoneEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PhoneEntry | null>(null);
  const [formData, setFormData] = useState({ name: '', contact_number: '', remarks: '' });

  const loadData = async () => {
    if (!canView) return;
    try {
      setLoading(true);
      const skip = (page - 1) * limit;
      const res = await fetchPhoneDirectory({ skip, limit, search });
      const mappedData = res.data.map((item: any) => ({ ...item, id: item._id }));
      setData(mappedData);
      setTotal(res.total);
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to load Phone Directory", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, search, canView]);

  const handleOpenModal = (entry: PhoneEntry | null = null) => {
    if (entry) {
      setEditingEntry(entry);
      setFormData({ name: entry.name, contact_number: entry.contact_number, remarks: entry.remarks || '' });
    } else {
      setEditingEntry(null);
      setFormData({ name: '', contact_number: '', remarks: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEntry) {
        await updatePhoneEntry(editingEntry._id, formData);
        showToast("Entry updated successfully", "success");
      } else {
        await createPhoneEntry(formData);
        showToast("Entry created successfully", "success");
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to save entry", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this entry?")) return;
    try {
      await deletePhoneEntry(id);
      showToast("Entry deleted successfully", "success");
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to delete entry", "error");
    }
  };

  const columns: Column<PhoneEntry>[] = [
    { id: 'name', label: 'Name', render: (item) => item.name },
    { id: 'contact_number', label: 'Contact Number', render: (item) => item.contact_number },
    { id: 'remarks', label: 'Remarks', render: (item) => item.remarks || '-' },
    { 
      id: 'actions', 
      label: 'Actions', 
      render: (item: PhoneEntry) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          {canUpdate && (
            <IconButton size="small" onClick={() => handleOpenModal(item)} color="primary">
              <MdEdit />
            </IconButton>
          )}
          {canDelete && (
            <IconButton size="small" onClick={() => handleDelete(item._id)} color="error">
              <MdDelete />
            </IconButton>
          )}
        </Box>
      ) 
    }
  ];

  if (!canView) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Access Denied. You do not have permission to view the Phone Directory.</Typography>
      </Box>
    );
  }

  return (
    <Box className={styles.container}>
      <Box className={styles.container__header}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>Phone Directory</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search name, number..." />
          {canCreate && (
            <Button variant="contained" startIcon={<MdAdd />} onClick={() => handleOpenModal()}>
              Add Entry
            </Button>
          )}
        </Box>
      </Box>

      <Paper sx={{ width: '100%', overflow: 'hidden', boxShadow: 'none', background: 'transparent' }}>
        <Table 
          columns={columns} 
          data={data} 
          totalCount={total}
          rowsPerPage={limit}
          page={page - 1}
          onPageChange={(e, newPage) => setPage(newPage + 1)}
          onRowsPerPageChange={() => {}}
        />
      </Paper>

      <Modal 
        open={isModalOpen} 
        handleClose={() => setIsModalOpen(false)} 
        maxWidth="xs"
        title={editingEntry ? "Edit Phone Entry" : "Add Phone Entry"}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' ,}}>
          <TextField 
            label="Name" 
            value={formData.name} 
            onChange={(e) => setFormData({...formData, name: e.target.value})} 
            required 
          />
          <TextField 
            label="Contact Number" 
            value={formData.contact_number} 
            onChange={(e) => setFormData({...formData, contact_number: e.target.value})} 
            required 
          />
          <TextField 
            label="Remarks" 
            value={formData.remarks} 
            onChange={(e) => setFormData({...formData, remarks: e.target.value})} 
            multiline
            rows={3}
          />
          <Button type="submit" variant="contained" sx={{ mt: 2 }}>
            {editingEntry ? "Update" : "Save"}
          </Button>
        </form>
      </Modal>
    </Box>
  );
};

export default PhoneDirectory;
