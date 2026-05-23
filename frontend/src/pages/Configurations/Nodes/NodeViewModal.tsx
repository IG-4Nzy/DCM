import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Divider, Grid, LinearProgress } from '@mui/material';
import Button from '../../../components/Button';
import { type NodeData } from './model';

interface NodeViewModalProps {
    open: boolean;
    onClose: () => void;
    node: NodeData | null;
}

const NodeViewModal: React.FC<NodeViewModalProps> = ({ open, onClose, node }) => {
    if (!node) return null;

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

        // Dynamic color based on utilization
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
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ pb: 1, fontWeight: 'bold', fontSize: '1.25rem' }}>
                Node Details
            </DialogTitle>
            <DialogContent dividers sx={{ backgroundColor: '#fafbfd' }}>
                <Grid container spacing={3} sx={{ py: 1 }}>
                    {/* General Information */}
                    <Grid item xs={12}>
                        <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: '12px', border: '1px solid #eef2f6' }}>
                            <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, fontWeight: 600 }}>
                                GENERAL INFORMATION
                              </Typography>
                              <Divider sx={{ mb: 2 }} />
                              <Grid container spacing={2}>
                                  <Grid item xs={12} sm={6}>
                                      <Typography variant="caption" color="textSecondary">Node Name</Typography>
                                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{node.node}</Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                      <Typography variant="caption" color="textSecondary">Created By</Typography>
                                      <Typography variant="body2">{node.createdBy || '-'}</Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                      <Typography variant="caption" color="textSecondary">Last Updated</Typography>
                                      <Typography variant="body2">
                                          {node.updatedAt ? new Date(node.updatedAt).toLocaleString() : '-'}
                                      </Typography>
                                  </Grid>
                              </Grid>
                        </Box>
                    </Grid>

                    {/* Resources (Total and Available) */}
                    <Grid item xs={12}>
                        <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: '12px', border: '1px solid #eef2f6' }}>
                            <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, fontWeight: 600 }}>
                                RESOURCE ALLOCATION & CAPACITIES
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            
                            {renderResource('RAM Capacity', node.totalRam, node.availableRam, 'GB')}
                            {renderResource('Hard Disk Storage', node.totalHardisk, node.availableHardisk, 'GB')}
                            {renderResource('CPU Allocation', node.totalCpu, node.availableCpu, 'Cores')}
                        </Box>
                    </Grid>

                    {/* Remarks */}
                    {node.remarks && (
                        <Grid item xs={12}>
                            <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: '12px', border: '1px solid #eef2f6' }}>
                                <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, fontWeight: 600 }}>
                                    REMARKS
                                </Typography>
                                <Divider sx={{ mb: 1 }} />
                                <Typography variant="body2" sx={{ color: '#555' }}>
                                    {node.remarks}
                                </Typography>
                            </Box>
                        </Grid>
                    )}
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

export default NodeViewModal;
