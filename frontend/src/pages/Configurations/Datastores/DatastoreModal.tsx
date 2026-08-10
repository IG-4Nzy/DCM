// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Grid,
    MenuItem,
    Box,
    Typography,
    Autocomplete,
    IconButton,
    InputAdornment,
    Chip,
    Paper,
    CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StorageIcon from '@mui/icons-material/Storage';
import FolderIcon from '@mui/icons-material/Folder';
import DnsIcon from '@mui/icons-material/Dns';
import PieChartIcon from '@mui/icons-material/PieChart';
import Dropdown from '../../../components/Dropdown';
import NotesIcon from '@mui/icons-material/Notes';
import { type DatastoreData } from './model';
import { fetchNodesOptions } from './action';

interface DatastoreModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (payload: any) => Promise<void>;
    editingItem?: DatastoreData | null;
}

const DATASTORE_TYPES = [
    "Local Host",
    "NAS",
    "SAN",
    "Shared NFS",
    "VMFS",
    "Other"
];

const DatastoreModal: React.FC<DatastoreModalProps> = ({
    open,
    onClose,
    onSubmit,
    editingItem
}) => {
    const [name, setName] = useState('');
    const [type, setType] = useState('Local Host');
    const [node, setNode] = useState('');
    const [mountPath, setMountPath] = useState('');
    const [capacity, setCapacity] = useState('');
    const [remarks, setRemarks] = useState('');
    const [nodesList, setNodesList] = useState<any[]>([]);
    const [loadingNodes, setLoadingNodes] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setLoadingNodes(true);
            fetchNodesOptions().then(nodes => {
                setNodesList(nodes);
                setLoadingNodes(false);
            }).catch(() => setLoadingNodes(false));

            if (editingItem) {
                setName(editingItem.name || '');
                setType(editingItem.type || 'Local Host');
                setNode(editingItem.node || '');
                setMountPath(editingItem.mountPath || '');
                setCapacity(editingItem.capacity || '');
                setRemarks(editingItem.remarks || '');
            } else {
                setName('');
                setType('Local Host');
                setNode('');
                setMountPath('');
                setCapacity('');
                setRemarks('');
            }
        }
    }, [open, editingItem]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setSubmitting(true);
        try {
            await onSubmit({
                name: name.trim(),
                type: type || 'Local Host',
                node: node.trim() || undefined,
                mountPath: mountPath.trim() || undefined,
                capacity: capacity.trim() || undefined,
                remarks: remarks.trim() || undefined
            });
        } finally {
            setSubmitting(false);
        }
    };

    const filteredNodesList = type === 'Local Host'
        ? nodesList
        : nodesList.filter(n => n.isStorage || (n.type && n.type.toLowerCase() === 'storage'));

    const nodeOptions = Array.from(new Set(
        filteredNodesList
            .map(n => typeof n === 'string' ? n : (n.node || n.nodeId || n.hostName))
            .filter(Boolean)
    ));

    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
            maxWidth="sm" 
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.18)',
                    overflow: 'hidden'
                }
            }}
        >
            {/* Header with Dark Slate Gradient & Glowing Storage Icon */}
            <Box 
                sx={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    color: '#ffffff',
                    px: 3,
                    py: 2.5,
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between'
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box 
                        sx={{
                            width: 44,
                            height: 44,
                            borderRadius: '12px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            backdropFilter: 'blur(8px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(255, 255, 255, 0.15)'
                        }}
                    >
                        <StorageIcon sx={{ color: '#38bdf8', fontSize: 26 }} />
                    </Box>
                    <Box>
                        <Typography variant="h6" fontWeight={700} sx={{ letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                            {editingItem ? 'Edit Storage Datastore' : 'Create New Datastore'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                            Configure storage volume attributes and host assignments
                        </Typography>
                    </Box>
                </Box>
                <IconButton 
                    onClick={onClose}
                    sx={{ 
                        color: '#94a3b8', 
                        ml: 'auto',
                        '&:hover': { color: '#ffffff', background: 'rgba(255, 255, 255, 0.1)' } 
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </Box>

            <form onSubmit={handleSubmit}>
                <DialogContent sx={{ p: 3, background: '#f8fafc' }}>
                    {/* Section 1: Storage Identity */}
                    <Paper elevation={0} sx={{ p: 2.5, mb: 2.5, borderRadius: 2, border: '1px solid #e2e8f0', background: '#ffffff' }}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#334155', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <StorageIcon fontSize="small" sx={{ color: '#0284c7' }} />
                            Storage Identification
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <TextField
                                    label="Datastore Name"
                                    required
                                    fullWidth
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. datastore1_local, NAS_Storage_01"
                                    autoFocus
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <StorageIcon sx={{ color: '#64748b' }} fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>

                            <Grid item xs={12}>
                                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mb: 1, display: 'block' }}>
                                    Select Storage Type
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {DATASTORE_TYPES.map((t) => {
                                        const selected = type === t;
                                        return (
                                            <Chip
                                                key={t}
                                                label={t}
                                                clickable
                                                onClick={() => setType(t)}
                                                color={selected ? 'primary' : 'default'}
                                                variant={selected ? 'filled' : 'outlined'}
                                                sx={{
                                                    fontWeight: selected ? 600 : 500,
                                                    borderRadius: '8px',
                                                    px: 0.5,
                                                    borderColor: selected ? '#0284c7' : '#cbd5e1',
                                                    backgroundColor: selected ? '#0284c7' : '#ffffff',
                                                    color: selected ? '#ffffff' : '#475569',
                                                    '&:hover': {
                                                        backgroundColor: selected ? '#0369a1' : '#f1f5f9'
                                                    }
                                                }}
                                            />
                                        );
                                    })}
                                </Box>
                            </Grid>
                        </Grid>
                    </Paper>

                    {/* Section 2: Host Node & Mount Configuration */}
                    <Paper elevation={0} sx={{ p: 2.5, mb: 2.5, borderRadius: 2, border: '1px solid #e2e8f0', background: '#ffffff' }}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#334155', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DnsIcon fontSize="small" sx={{ color: '#0284c7' }} />
                            Host Node & Mount Path
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <Dropdown
                                    label="Node (Storage Hosts)"
                                    searchable
                                    clearable
                                    fullWidth
                                    options={nodeOptions.map(n => ({ label: n, value: n }))}
                                    value={node}
                                    onChange={(val) => setNode(val || '')}
                                    helperText={type === 'Local Host' ? 'Select host node for local storage' : 'Optional storage node mapping'}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Mount Path"
                                    fullWidth
                                    value={mountPath}
                                    onChange={(e) => setMountPath(e.target.value)}
                                    placeholder="e.g. /mnt/datastore1"
                                    helperText="Mount path or network location"
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <FolderIcon sx={{ color: '#64748b' }} fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>
                        </Grid>
                    </Paper>

                    {/* Section 3: Capacity & Remarks */}
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #e2e8f0', background: '#ffffff' }}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#334155', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PieChartIcon fontSize="small" sx={{ color: '#0284c7' }} />
                            Capacity & Notes
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <TextField
                                    label="Storage Capacity"
                                    fullWidth
                                    value={capacity}
                                    onChange={(e) => setCapacity(e.target.value)}
                                    placeholder="e.g. 2 TB, 500 GB"
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <PieChartIcon sx={{ color: '#64748b' }} fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>

                            <Grid item xs={12}>
                                <TextField
                                    label="Remarks"
                                    fullWidth
                                    multiline
                                    rows={2.5}
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="Add any additional notes or details..."
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                                                <NotesIcon sx={{ color: '#64748b' }} fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>
                        </Grid>
                    </Paper>
                </DialogContent>

                <DialogActions 
                    sx={{ 
                        px: 3, 
                        py: 2, 
                        background: '#ffffff', 
                        borderTop: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between'
                    }}
                >
                    <Button 
                        onClick={onClose} 
                        disabled={submitting}
                        sx={{ 
                            color: '#64748b', 
                            fontWeight: 600,
                            '&:hover': { background: '#f1f5f9' }
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={submitting || !name.trim()}
                        sx={{
                            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                            fontWeight: 600,
                            px: 3,
                            py: 1,
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #0369a1 0%, #075985 100%)',
                                boxShadow: '0 6px 16px rgba(2, 132, 199, 0.35)'
                            }
                        }}
                    >
                        {submitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Datastore'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default DatastoreModal;
