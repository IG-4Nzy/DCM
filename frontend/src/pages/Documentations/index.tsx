import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  IconButton, 
  Tooltip, 
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  CardActions,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import { 
  MdAdd as AddIcon, 
  MdDelete as DeleteIcon, 
  MdEdit as EditIcon, 
  MdSearch as SearchIcon, 
  MdRefresh as RefreshIcon,
  MdCloudUpload as UploadIcon,
  MdInsertDriveFile as FileIcon,
  MdGridView as GridIcon,
  MdList as ListIcon,
  MdDownload as DownloadIcon
} from 'react-icons/md';
import request, { API_BASE_URL } from '../../services/request';
import dayjs from 'dayjs';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';

interface Documentation {
  id?: string;
  _id?: string;
  title: string;
  fileName: string;
  fileUrl: string;
  createdAt: string;
}

const Documentations: React.FC = () => {
  const [docs, setDocs] = useState<Documentation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingDoc, setEditingDoc] = useState<Documentation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const { showToast } = useToast();
  const confirm = useConfirm();

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await request.get('/api/documentations/', {
        params: {
          skip: 0,
          limit: 100,
          search: search || undefined
        }
      });
      setDocs(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to fetch documentations', err);
      showToast('Failed to fetch documentations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [search]);

  const handleRefresh = () => {
    fetchDocs();
  };

  const handleOpenCreateModal = () => {
    setEditingDoc(null);
    setModalTitle('');
    setSelectedFile(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (doc: Documentation) => {
    setEditingDoc(doc);
    setModalTitle(doc.title);
    setSelectedFile(null);
    setIsModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) {
      showToast('Title is required', 'warning');
      return;
    }
    if (!editingDoc && !selectedFile) {
      showToast('Please select a file to upload', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', modalTitle);
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      if (editingDoc) {
        const docId = editingDoc.id || editingDoc._id;
        await request.put(`/api/documentations/${docId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        showToast('Documentation updated successfully', 'success');
      } else {
        await request.post('/api/documentations/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        showToast('Documentation created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchDocs();
    } catch (err) {
      console.error('Error submitting documentation', err);
      showToast('Failed to save documentation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (doc: Documentation) => {
    const docId = doc.id || doc._id;
    if (!docId) return;

    const isConfirmed = await confirm(`Are you sure you want to delete "${doc.title}"?`);
    if (isConfirmed) {
      try {
        await request.delete(`/api/documentations/${docId}`);
        showToast('Documentation deleted successfully', 'success');
        fetchDocs();
      } catch (err) {
        console.error('Failed to delete documentation', err);
        showToast('Failed to delete documentation', 'error');
      }
    }
  };

  const handleDownload = (doc: Documentation) => {
    const fileUrl = `${API_BASE_URL}${doc.fileUrl}`;
    window.open(fileUrl, '_blank');
  };

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Clean Premium Header Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1a202c' }}>
            Documentations
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
            Store, manage, and download administrative guide sheets and project documentations.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Tooltip title="Refresh Page">
            <IconButton onClick={handleRefresh} sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={handleOpenCreateModal}
            sx={{ 
              borderRadius: '8px', 
              textTransform: 'none', 
              fontWeight: '600',
              boxShadow: '0 4px 6px -1px rgba(49, 130, 206, 0.2)'
            }}
          >
            Add Documentation
          </Button>
        </Box>
      </Box>

      {/* Main Filter & List Container */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          borderRadius: 3, 
          border: '1px solid #e2e8f0', 
          bgcolor: '#ffffff',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        }}
      >
        {/* Search Input, View Mode Switcher and Counter */}
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mb: 3, 
            gap: 2, 
            flexWrap: 'wrap' 
          }}
        >
          <TextField
            variant="outlined"
            size="small"
            placeholder="Search documentations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon style={{ color: '#a0aec0', marginRight: '8px' }} />,
            }}
            sx={{ 
              width: '350px',
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
                bgcolor: '#f8fafc'
              }
            }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, val) => val && setViewMode(val)}
              size="small"
              sx={{ bgcolor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}
            >
              <ToggleButton value="grid" sx={{ border: 'none', borderRadius: '6px' }}>
                <GridIcon />
              </ToggleButton>
              <ToggleButton value="list" sx={{ border: 'none', borderRadius: '6px' }}>
                <ListIcon />
              </ToggleButton>
            </ToggleButtonGroup>
            
            <Typography variant="body2" sx={{ fontWeight: '600', color: '#4a5568' }}>
              Total Documents: <span style={{ color: '#3182ce' }}>{total}</span>
            </Typography>
          </Box>
        </Box>

        {/* Loading Spinner */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 10 }}>
            <CircularProgress size={40} />
          </Box>
        ) : docs.length === 0 ? (
          <Box sx={{ py: 10, textAlign: 'center' }}>
            <Typography variant="body1" color="textSecondary" sx={{ mb: 1 }}>
              No documentations found.
            </Typography>
            <Button variant="outlined" size="small" onClick={handleOpenCreateModal} sx={{ borderRadius: '6px' }}>
              Upload your first document
            </Button>
          </Box>
        ) : viewMode === 'grid' ? (
          /* Grid Card View */
          <Grid container spacing={3}>
            {docs.map((doc) => {
              const formattedDate = doc.createdAt 
                ? dayjs(doc.createdAt.replace(/\+00:00Z$/, 'Z').replace(/\+00:00$/, 'Z')).format('DD-MM-YYYY h:mm A')
                : '--';
              return (
                <Grid item xs={12} sm={6} md={4} key={doc.id || doc._id}>
                  <Card 
                    elevation={0}
                    sx={{ 
                      borderRadius: 3, 
                      border: '1px solid #edf2f7', 
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.2s',
                      '&:hover': {
                        borderColor: '#cbd5e0',
                        boxShadow: '0 8px 16px -1px rgba(0, 0, 0, 0.05)'
                      }
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1, display: 'flex', gap: 2, pb: 1 }}>
                      <Box 
                        sx={{ 
                          width: '48px', 
                          height: '48px', 
                          borderRadius: '10px', 
                          bgcolor: '#ebf8ff', 
                          color: '#3182ce',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '24px',
                          flexShrink: 0
                        }}
                      >
                        <FileIcon />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" noWrap sx={{ fontWeight: '700', fontSize: '1.05rem', color: '#2d3748', mb: 0.5 }}>
                          {doc.title}
                        </Typography>
                        <Typography variant="body2" noWrap color="textSecondary" sx={{ fontSize: '0.85rem', mb: 1 }}>
                          {doc.fileName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#a0aec0', display: 'block' }}>
                          Uploaded: {formattedDate}
                        </Typography>
                      </Box>
                    </CardContent>
                    
                    <CardActions sx={{ borderTop: '1px solid #f7fafc', p: 2, justifyContent: 'space-between' }}>
                      <Button 
                        size="small" 
                        variant="light" 
                        startIcon={<DownloadIcon />} 
                        onClick={() => handleDownload(doc)}
                        sx={{ textTransform: 'none', color: '#3182ce', fontWeight: '600' }}
                      >
                        Download
                      </Button>
                      <Box>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleOpenEditModal(doc)} sx={{ color: '#4a5568', mr: 0.5 }}>
                            <EditIcon size={18} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => handleDelete(doc)} sx={{ color: '#e53e3e' }}>
                            <DeleteIcon size={18} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        ) : (
          /* List Table View */
          <Box sx={{ border: '1px solid #edf2f7', borderRadius: '8px', overflow: 'hidden' }}>
            <Box 
              sx={{ 
                display: 'grid', 
                gridTemplateColumns: '2fr 2fr 1.5fr 1fr', 
                bgcolor: '#f8fafc', 
                p: 2, 
                borderBottom: '1px solid #edf2f7',
                fontWeight: 'bold',
                color: '#4a5568',
                fontSize: '0.9rem'
              }}
            >
              <Box>Title</Box>
              <Box>File Name</Box>
              <Box>Uploaded Date</Box>
              <Box sx={{ textAlign: 'right', pr: 2 }}>Actions</Box>
            </Box>
            {docs.map((doc) => {
              const formattedDate = doc.createdAt 
                ? dayjs(doc.createdAt.replace(/\+00:00Z$/, 'Z').replace(/\+00:00$/, 'Z')).format('DD-MM-YYYY h:mm A')
                : '--';
              return (
                <Box 
                  key={doc.id || doc._id}
                  sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: '2fr 2fr 1.5fr 1fr', 
                    p: 2, 
                    alignItems: 'center',
                    borderBottom: '1px solid #edf2f7',
                    '&:last-child': { borderBottom: 'none' },
                    '&:hover': { bgcolor: '#f7fafc' },
                    fontSize: '0.9rem',
                    color: '#2d3748'
                  }}
                >
                  <Box sx={{ fontWeight: '600' }}>{doc.title}</Box>
                  <Box 
                    sx={{ 
                      color: '#3182ce', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 0.5,
                      textDecoration: 'underline' 
                    }}
                    onClick={() => handleDownload(doc)}
                  >
                    <FileIcon size={16} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.fileName}</span>
                  </Box>
                  <Box color="textSecondary">{formattedDate}</Box>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                    <Tooltip title="Download">
                      <IconButton size="small" onClick={() => handleDownload(doc)} sx={{ color: '#3182ce' }}>
                        <DownloadIcon size={18} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleOpenEditModal(doc)} sx={{ color: '#4a5568' }}>
                        <EditIcon size={18} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => handleDelete(doc)} sx={{ color: '#e53e3e' }}>
                        <DeleteIcon size={18} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Paper>

      {/* Form Dialog Modal */}
      <Dialog 
        open={isModalOpen} 
        onClose={() => !submitting && setIsModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: '12px', p: 1 }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.25rem', pb: 1,color:'#333' }}>
          {editingDoc ? 'Edit Documentation' : 'Add Documentation'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField
              label="Document Title"
              variant="outlined"
              fullWidth
              required
              value={modalTitle}
              onChange={(e) => setModalTitle(e.target.value)}
              placeholder="e.g. Server Rack Layout Guide"
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />

            <Box>
              <Typography variant="body2" sx={{ fontWeight: '600', color: '#4a5568', mb: 1 }}>
                File Attachment {editingDoc ? '(Optional)' : ''}
              </Typography>
              <Button
                variant="outlined"
                component="label"
                fullWidth
                startIcon={<UploadIcon />}
                sx={{ 
                  py: 2, 
                  borderStyle: 'dashed', 
                  borderRadius: '8px', 
                  textTransform: 'none',
                  bgcolor: '#f8fafc',
                  color: '#4a5568',
                  borderColor: '#cbd5e0',
                  '&:hover': {
                    bgcolor: '#edf2f7',
                    borderColor: '#a0aec0'
                  }
                }}
              >
                {selectedFile ? 'Change Selected File' : 'Select PDF or Document File'}
                <input
                  type="file"
                  hidden
                  onChange={handleFileChange}
                />
              </Button>
              {selectedFile && (
                <Typography variant="body2" sx={{ color: '#3182ce', mt: 1, fontWeight: '500', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <FileIcon /> {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </Typography>
              )}
              {editingDoc && !selectedFile && (
                <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                  Current: <span style={{ fontFamily: 'monospace' }}>{editingDoc.fileName}</span>
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
            <Button onClick={() => setIsModalOpen(false)} disabled={submitting} sx={{ borderRadius: '8px', textTransform: 'none' }}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={submitting}
              sx={{ 
                borderRadius: '8px', 
                textTransform: 'none',
                px: 3,
                boxShadow: '0 4px 6px -1px rgba(49, 130, 206, 0.2)'
              }}
            >
              {submitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Documentations;
