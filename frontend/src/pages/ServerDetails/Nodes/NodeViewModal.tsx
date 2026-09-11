// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Divider, Grid } from '@mui/material';
import { useSelector } from 'react-redux';
import { type RootState } from '../../../store';
import Button from '../../../components/Button';
import { type NodeData } from './model';
import request from '../../../services/request';

interface NodeViewModalProps {
    open: boolean;
    onClose: () => void;
    node: NodeData | null;
    adminName?: string;
}

const NodeViewModal: React.FC<NodeViewModalProps> = ({ open, onClose, node, adminName }) => {
    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});

    useEffect(() => {
        if (open && !adminName) {
            request.get('/api/users/', { params: { pagination: false } })
                .then((res) => {
                    const map: Record<string, string> = {};
                    const list = res.data?.data || [];
                    list.forEach((u: any) => {
                        const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
                        const displayName = fullName || u.username;
                        if (u._id) map[u._id] = displayName;
                        if (u.id) map[u.id] = displayName;
                        if (u.username) map[u.username] = displayName;
                    });
                    setUsersMap(map);
                })
                .catch(() => {});
        }
    }, [open, adminName]);

    const resolvedAdminName = useMemo(() => {
        if (adminName) return adminName;
        if (!node || !node.admin) return '-';
        const adminArr = Array.isArray(node.admin) ? node.admin : [node.admin];
        return adminArr.map((a: string) => usersMap[a] || a).join(", ") || '-';
    }, [adminName, node, usersMap]);

    if (!node) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ pb: 1, fontWeight: 'bold', fontSize: '1.25rem', color: '#333' }}>
                Node Details
            </DialogTitle>
            <DialogContent dividers sx={{ backgroundColor: '#fafbfd' }}>
                <Grid container spacing={3} sx={{ py: 1 }}>
                    {/* General Information */}
                    <Grid size={{xs: 12}}  >
                        <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: '12px', border: '1px solid #eef2f6' }}>
                            <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, fontWeight: 600 }}>
                                GENERAL INFORMATION
                              </Typography>
                              <Divider sx={{ mb: 2 }} />
                              <Grid container spacing={2}>
                                  <Grid size={{xs: 12, sm: 6}}   >
                                      <Typography variant="caption" color="textSecondary">Node Name</Typography>
                                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{node.node}</Typography>
                                  </Grid>
                                  <Grid size={{xs: 12, sm: 6}}   >
                                      <Typography variant="caption" color="textSecondary">IP Address</Typography>
                                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#3182ce' }}>{node.ip || '-'}</Typography>
                                  </Grid>
                                  <Grid size={{xs: 12, sm: 6}}   >
                                      <Typography variant="caption" color="textSecondary">Type</Typography>
                                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{node.isStorage ? 'Storage' : node.isAppliance ? 'Appliance' : 'Node'}{node.isPhysical ? ' (Physical Server)' : ''}</Typography>
                                  </Grid>
                                  <Grid size={{xs: 12, sm: 6}}   >
                                      <Typography variant="caption" color="textSecondary">Operating System</Typography>
                                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{node.os || '-'}</Typography>
                                  </Grid>
                                  <Grid size={{xs: 12, sm: 6}}   >
                                      <Typography variant="caption" color="textSecondary">Created By</Typography>
                                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{usersMap[node.createdBy] || node.createdBy || '-'}</Typography>
                                  </Grid>
                                  <Grid size={{xs: 12, sm: 6}}   >
                                      <Typography variant="caption" color="textSecondary">Created At</Typography>
                                      <Typography variant="body2">
                                          {node.createdAt ? new Date(node.createdAt).toLocaleString() : '-'}
                                      </Typography>
                                  </Grid>
                                  <Grid size={{xs: 12, sm: 6}}   >
                                      <Typography variant="caption" color="textSecondary">Updated By</Typography>
                                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{usersMap[node.updatedBy] || node.updatedBy || '-'}</Typography>
                                  </Grid>
                                  <Grid size={{xs: 12, sm: 6}}   >
                                      <Typography variant="caption" color="textSecondary">Last Updated</Typography>
                                      <Typography variant="body2">
                                          {node.updatedAt ? new Date(node.updatedAt).toLocaleString() : '-'}
                                      </Typography>
                                  </Grid>
                              </Grid>
                        </Box>
                    </Grid>

                    {/* Server details */}
                    <Grid size={{xs: 12}}  >
                        <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: '12px', border: '1px solid #eef2f6' }}>
                            <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, fontWeight: 600 }}>
                                SERVER DETAILS
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Grid container spacing={2}>
                                <Grid size={{xs: 12, sm: 6}}   >
                                    <Typography variant="caption" color="textSecondary">Server Model</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{node.serverModel || '-'}</Typography>
                                </Grid>
                                <Grid size={{xs: 12, sm: 6}}   >
                                    <Typography variant="caption" color="textSecondary">Serial Number</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{node.serialNumber || '-'}</Typography>
                                </Grid>
                                <Grid size={{xs: 12, sm: 6}}   >
                                    <Typography variant="caption" color="textSecondary">Server Rack</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#2b6cb0' }}>{node.rack || '-'}</Typography>
                                </Grid>
                                <Grid size={{xs: 12, sm: 6}}   >
                                    <Typography variant="caption" color="textSecondary">Rack Position</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#2b6cb0' }}>{node.rackPosition || '-'}</Typography>
                                </Grid>
                                <Grid size={{xs: 12, sm: 6}}   >
                                    <Typography variant="caption" color="textSecondary">Rack Units (U)</Typography>
                                    <Typography variant="body2">{node.rackUnits !== undefined && node.rackUnits !== null ? node.rackUnits : '-'}</Typography>
                                </Grid>
                                <Grid size={{xs: 12, sm: 6}}   >
                                    <Typography variant="caption" color="textSecondary">Custodian</Typography>
                                    <Typography variant="body2">{node.custodian || '-'}</Typography>
                                </Grid>
                                <Grid size={{xs: 12, sm: 6}}   >
                                    <Typography variant="caption" color="textSecondary">Admin</Typography>
                                    <Typography variant="body2">{resolvedAdminName}</Typography>
                                </Grid>
                                <Grid size={{xs: 12, sm: 6}}   >
                                    <Typography variant="caption" color="textSecondary">Asset Number</Typography>
                                    <Typography variant="body2">{node.assetNumber || '-'}</Typography>
                                </Grid>
                                <Grid size={{xs: 12}}  >
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
                    <Grid size={{xs: 12}}  >
                        <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: '12px', border: '1px solid #eef2f6' }}>
                            <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, fontWeight: 600 }}>
                                RESOURCE CAPACITIES
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Grid container spacing={2}>
                                <Grid size={{xs: 12, sm: 3}}   >
                                    <Typography variant="caption" color="textSecondary">Total RAM</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{node.totalRam !== undefined && node.totalRam !== null ? `${node.totalRam} GB` : '-'}</Typography>
                                </Grid>
                                <Grid size={{xs: 12, sm: 3}}   >
                                    <Typography variant="caption" color="textSecondary">Total HDD</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{node.totalHardisk !== undefined && node.totalHardisk !== null ? `${node.totalHardisk} GB` : '-'}</Typography>
                                </Grid>
                                <Grid size={{xs: 12, sm: 3}}   >
                                    <Typography variant="caption" color="textSecondary">Total CPU</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{node.totalCpu !== undefined && node.totalCpu !== null ? `${node.totalCpu} GHz` : '-'}</Typography>
                                </Grid>
                                <Grid size={{xs: 12, sm: 3}}   >
                                    <Typography variant="caption" color="textSecondary">GPU</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{node.gpu || '-'}</Typography>
                                </Grid>
                            </Grid>
                        </Box>
                    </Grid>

                    {/* Remarks */}
                    {node.remarks && (
                        <Grid size={{xs: 12}}  >
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
