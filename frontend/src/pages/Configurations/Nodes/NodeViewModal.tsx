import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Divider, Grid } from '@mui/material';
import Button from '../../../components/Button';
import { type NodeData } from './model';

interface NodeViewModalProps {
    open: boolean;
    onClose: () => void;
    node: NodeData | null;
}

const NodeViewModal: React.FC<NodeViewModalProps> = ({ open, onClose, node }) => {
    if (!node) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ pb: 1, fontWeight: 'bold', fontSize: '1.25rem', color: '#333' }}>
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

                    {/* Server details */}
                    <Grid item xs={12}>
                        <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: '12px', border: '1px solid #eef2f6' }}>
                            <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, fontWeight: 600 }}>
                                SERVER DETAILS
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="caption" color="textSecondary">Server Model</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{node.serverModel || '-'}</Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="caption" color="textSecondary">Serial Number</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{node.serialNumber || '-'}</Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="caption" color="textSecondary">Custodian</Typography>
                                    <Typography variant="body2">{node.custodian || '-'}</Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="caption" color="textSecondary">Admin</Typography>
                                    <Typography variant="body2">{node.admin || '-'}</Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="caption" color="textSecondary">Asset Number</Typography>
                                    <Typography variant="body2">{node.assetNumber || '-'}</Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="caption" color="textSecondary">RAID Configuration</Typography>
                                    <Typography variant="body2">
                                        {node.raidConfiguration && node.raidConfiguration.length > 0
                                            ? node.raidConfiguration.join(', ')
                                            : '-'}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Box>
                    </Grid>

                    {/* Resources (Total) */}
                    <Grid item xs={12}>
                        <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: '12px', border: '1px solid #eef2f6' }}>
                            <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, fontWeight: 600 }}>
                                RESOURCE CAPACITIES
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={4}>
                                    <Typography variant="caption" color="textSecondary">Total RAM</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{node.totalRam !== undefined && node.totalRam !== null ? `${node.totalRam} GB` : '-'}</Typography>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <Typography variant="caption" color="textSecondary">Total HDD</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{node.totalHardisk !== undefined && node.totalHardisk !== null ? `${node.totalHardisk} GB` : '-'}</Typography>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <Typography variant="caption" color="textSecondary">Total CPU</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{node.totalCpu !== undefined && node.totalCpu !== null ? `${node.totalCpu} GHz` : '-'}</Typography>
                                </Grid>
                            </Grid>
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
