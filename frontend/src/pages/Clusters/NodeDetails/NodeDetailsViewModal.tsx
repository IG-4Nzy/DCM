// @ts-nocheck
import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Divider, Grid, LinearProgress } from '@mui/material';
import Button from '../../../components/Button';
import { type NodeDetailsData } from './model';

interface NodeDetailsViewModalProps {
    open: boolean;
    onClose: () => void;
    item: NodeDetailsData | null;
    adminName?: string;
}

const NodeDetailsViewModal: React.FC<NodeDetailsViewModalProps> = ({ open, onClose, item, adminName }) => {
    if (!item) return null;

    // Helper to calculate usage percentage
    const getUsagePercent = (total?: number, available?: number) => {
        if (!total || available === undefined || available === null) return 0;
        const used = total - available;
        return Math.min(100, Math.max(0, Math.round((used / total) * 100)));
    };

    // Helper to render resource indicator
    const renderResource = (label: string, total?: number, available?: number, unit: string = 'GB') => {
        const hasData = total !== undefined && total !== null && total > 0;
        const percent = getUsagePercent(total, available);
        const used = hasData && available !== undefined ? total! - available! : 0;

        let progressColor: 'success' | 'warning' | 'error' = 'success';
        if (percent > 85) {
            progressColor = 'error';
        } else if (percent > 65) {
            progressColor = 'warning';
        }

        return (
            <Box sx={{ mb: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
                    {hasData ? (
                        <Typography variant="body2" color="textSecondary">
                            {used} {unit} / {total} {unit} ({percent}% Used)
                        </Typography>
                    ) : (
                        <Typography variant="body2" color="text.disabled">Not Configured</Typography>
                    )}
                </Box>
                {hasData ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <LinearProgress 
                            variant="determinate" 
                            value={percent} 
                            color={progressColor} 
                            sx={{ flexGrow: 1, height: 8, borderRadius: 4, bgcolor: '#f0f2f5' }}
                        />
                        <Typography variant="caption" sx={{ minWidth: 35, fontWeight: 600, color: `${progressColor}.main` }}>
                            {available} {unit} free
                        </Typography>
                    </Box>
                ) : (
                    <LinearProgress 
                        variant="determinate" 
                        value={0} 
                        sx={{ height: 8, borderRadius: 4, bgcolor: '#f0f2f5', opacity: 0.5 }}
                    />
                )}
            </Box>
        );
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ pb: 1, fontWeight: 'bold', fontSize: '1.25rem', color: '#333' }}>
                Node Details
            </DialogTitle>
            <DialogContent dividers sx={{ backgroundColor: '#fafbfd' }}>
                <Grid container spacing={3} sx={{ py: 1 }}>
                    {/* General Specs */}
                    <Grid size={{xs: 12, md: 6}}   >
                        <Box sx={{ p: 2, height: '100%', bgcolor: '#fff', borderRadius: '12px', border: '1px solid #eef2f6' }}>
                            <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, fontWeight: 600 }}>
                                HARDWARE & IDENTIFICATION
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Grid container spacing={2}>
                                <Grid size={{xs: 6}}  >
                                    <Typography variant="caption" color="textSecondary">Node ID</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#1565c0' }}>{item.nodeId || '--'}</Typography>
                                </Grid>
                                <Grid size={{xs: 6}}  >
                                    <Typography variant="caption" color="textSecondary">SL Number</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.slNumber}</Typography>
                                </Grid>
                                <Grid size={{xs: 6}}  >
                                    <Typography variant="caption" color="textSecondary">Rack</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.rack}</Typography>
                                </Grid>
                                <Grid size={{xs: 6}}  >
                                    <Typography variant="caption" color="textSecondary">Host Name</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.hostName}</Typography>
                                </Grid>
                                <Grid size={{xs: 6}}  >
                                    <Typography variant="caption" color="textSecondary">IP Address</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.ipAddress}</Typography>
                                </Grid>
                                <Grid size={{xs: 6}}  >
                                    <Typography variant="caption" color="textSecondary">Server Model</Typography>
                                    <Typography variant="body2">{item.serverModel}</Typography>
                                </Grid>
                                <Grid size={{xs: 6}}  >
                                    <Typography variant="caption" color="textSecondary">Serial Number</Typography>
                                    <Typography variant="body2">{item.serialNumber}</Typography>
                                </Grid>
                                <Grid size={{xs: 6}}  >
                                    <Typography variant="caption" color="textSecondary">Redundancy Power</Typography>
                                    <Typography variant="body2">{item.redundancyPower}</Typography>
                                </Grid>
                            </Grid>
                        </Box>
                    </Grid>

                    {/* Ownership & Software */}
                    <Grid size={{xs: 12, md: 6}}   >
                        <Box sx={{ p: 2, height: '100%', bgcolor: '#fff', borderRadius: '12px', border: '1px solid #eef2f6' }}>
                            <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, fontWeight: 600 }}>
                                OWNERSHIP & ENVIRONMENT
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Grid container spacing={2}>
                                <Grid size={{xs: 6}}  >
                                    <Typography variant="caption" color="textSecondary">Admin</Typography>
                                    <Typography variant="body2">{adminName || item.admin || '--'}</Typography>
                                </Grid>
                                <Grid size={{xs: 6}}  >
                                    <Typography variant="caption" color="textSecondary">Admin Code</Typography>
                                    <Typography variant="body2">{item.adminCode || '--'}</Typography>
                                </Grid>
                                <Grid size={{xs: 6}}  >
                                    <Typography variant="caption" color="textSecondary">Hypervisor</Typography>
                                    <Typography variant="body2">{item.hypervisor}</Typography>
                                </Grid>
                                <Grid size={{xs: 6}}  >
                                    <Typography variant="caption" color="textSecondary">Cluster Type</Typography>
                                    <Typography variant="body2">{item.clusterType}</Typography>
                                </Grid>
                                <Grid size={{xs: 6}}  >
                                    <Typography variant="caption" color="textSecondary">Indentor</Typography>
                                    <Typography variant="body2">{item.indentor || '--'}</Typography>
                                </Grid>
                                <Grid size={{xs: 6}}  >
                                    <Typography variant="caption" color="textSecondary">Custodian</Typography>
                                    <Typography variant="body2">{item.custodian || '--'}</Typography>
                                </Grid>
                                <Grid size={{xs: 6}}  >
                                    <Typography variant="caption" color="textSecondary">PO Num</Typography>
                                    <Typography variant="body2">{item.poNum || '--'}</Typography>
                                </Grid>
                                <Grid size={{xs: 6}}  >
                                    <Typography variant="caption" color="textSecondary">Asset Num</Typography>
                                    <Typography variant="body2">{item.assetNum || '--'}</Typography>
                                </Grid>
                            </Grid>
                        </Box>
                    </Grid>

                    {/* Resources (Total and Available) */}
                    <Grid size={{xs: 12, md: 6}}   >
                        <Box sx={{ p: 2, height: '100%', bgcolor: '#fff', borderRadius: '12px', border: '1px solid #eef2f6' }}>
                            <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, fontWeight: 600 }}>
                                RESOURCE ALLOCATION & CAPACITIES
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            
                            {renderResource('RAM Capacity', item.totalRam, item.availableRam, 'GB')}
                            {renderResource('Hard Disk Storage', item.totalHardisk, item.availableHardisk, 'GB')}
                            {renderResource('CPU Allocation', item.totalCpu, item.availableCpu, 'GHz')}
                        </Box>
                    </Grid>

                    {/* Applications & Remarks */}
                    <Grid size={{xs: 12, md: 6}}   >
                        <Box sx={{ p: 2, height: '100%', bgcolor: '#fff', borderRadius: '12px', border: '1px solid #eef2f6', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Box>
                                <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 0.5, fontWeight: 600 }}>
                                    APPLICATIONS
                                </Typography>
                                <Divider sx={{ mb: 1 }} />
                                <Typography variant="body2" sx={{ color: '#333' }}>
                                    {item.applications || 'None'}
                                </Typography>
                            </Box>
                            
                            <Box>
                                <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 0.5, fontWeight: 600 }}>
                                    REMARKS
                                </Typography>
                                <Divider sx={{ mb: 1 }} />
                                <Typography variant="body2" sx={{ color: '#555' }}>
                                    {item.remarks || 'None'}
                                </Typography>
                            </Box>
                        </Box>
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} variant="contained" color="primary">
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default NodeDetailsViewModal;
