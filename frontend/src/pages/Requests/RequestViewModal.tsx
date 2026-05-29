import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Divider, Grid, Chip, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import Button from '../../components/Button';
import type { RequestData } from './model';
import { fetchUsers } from '../Users/action';
import { fetchClusters } from '../Clusters/action';
import { fetchNodes } from '../ServerMonitoring/action';
import { fetchInventory } from '../Inventory/action';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';

interface RequestViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: RequestData | null;
  onAdvance: (id: string, payload?: any) => Promise<void>;
  onReject: (id: string, remarks: string) => Promise<void>;
  username: string;
  isSuperuser: boolean;
  hasUpdatePrivilege: boolean;
}

const RequestViewModal: React.FC<RequestViewModalProps> = ({
  isOpen,
  onClose,
  request,
  onAdvance,
  onReject,
  username,
  isSuperuser,
  hasUpdatePrivilege
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { users } = useSelector((state: RootState) => state.users);
  const { inventory } = useSelector((state: RootState) => state.inventory);

  const [ipAddress, setIpAddress] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ipError, setIpError] = useState(false);

  // Cluster Selection States
  const [clusters, setClusters] = useState<any[]>([]);
  const [selectedCluster, setSelectedCluster] = useState('');
  const [clusterError, setClusterError] = useState(false);

  // Node Selection States
  const [nodes, setNodes] = useState<any[]>([]);
  const [filteredNodes, setFilteredNodes] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState('');
  const [nodeError, setNodeError] = useState(false);

  const isClusterDeciding = request?.status?.toLowerCase() === 'cluster deciding' || request?.status?.toLowerCase().includes('cluster');

  const requestId = request?.id || request?._id || '';

  useEffect(() => {
    if (isOpen && requestId) {
      dispatch(fetchUsers({ pagination: false }));
      dispatch(fetchInventory({ pagination: false }));
      setRemarks('');
      setIpAddress(request.details?.ip || '');
      setIpError(false);

      if (request.status?.toLowerCase() === 'cluster deciding' || request.status?.toLowerCase().includes('cluster')) {
        fetchClusters({ pagination: false }).then(res => {
          setClusters(res.data || []);
        }).catch(() => {
          setClusters([]);
        });
        fetchNodes().then(res => {
          setNodes(res || []);
        }).catch(() => {
          setNodes([]);
        });
        setSelectedCluster(request.details?.cluster || '');
        setSelectedNode(request.details?.node || '');
        setClusterError(false);
        setNodeError(false);
      }
    }
  }, [isOpen, requestId, dispatch]);

  // Reactive node filtering based on selected cluster
  useEffect(() => {
    if (selectedCluster && nodes.length > 0 && clusters.length > 0) {
      const clusterObj = clusters.find(c => c.clusterName === selectedCluster);
      const clusterId = clusterObj?.id || clusterObj?._id || '';
      const matchingNodes = nodes.filter((n: any) => String(n.clusterId) === String(clusterId));
      setFilteredNodes(matchingNodes);
      
      // Clear selectedNode if it does not belong to matching nodes
      if (selectedNode && !matchingNodes.some((n: any) => n.hostName === selectedNode)) {
        setSelectedNode('');
      }
    } else {
      setFilteredNodes([]);
    }
  }, [selectedCluster, nodes, clusters]);

  if (!request) return null;

  const isAssigned = request.currentAssignedUsers && request.currentAssignedUsers.includes(username);
  const canAction = isSuperuser || isAssigned || hasUpdatePrivilege;
  const isTerminal = request.status === 'Completed' || request.status === 'Rejected';
  
  // Check if status is IP Issuance
  const isIpIssuance = request.status?.toLowerCase() === 'ip issuance' || request.status?.toLowerCase().includes('ip');

  const handleAdvance = async () => {
    if (isIpIssuance && !ipAddress.trim()) {
      setIpError(true);
      return;
    }
    if (isClusterDeciding && !selectedCluster) {
      setClusterError(true);
      return;
    }
    if (isClusterDeciding && !selectedNode) {
      setNodeError(true);
      return;
    }

    setSubmitting(true);
    try {
      let payload: any = { remarks };
      if (isIpIssuance) {
        payload.details = { ip: ipAddress.trim() };
      } else if (isClusterDeciding) {
        payload.details = { 
          cluster: selectedCluster,
          node: selectedNode
        };
      }
      await onAdvance(request.id || request._id || '', payload);
      onClose();
    } catch (err) {
      // toast is handled in parent
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      await onReject(request.id || request._id || '', remarks);
      onClose();
    } catch (err) {
      // toast is handled in parent
    } finally {
      setSubmitting(false);
    }
  };

  const getCreatorName = (usernameVal: string) => {
    const u = users.find((user: any) => user.username === usernameVal);
    return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username : usernameVal;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'warning';
      case 'In Progress': return 'info';
      case 'Completed': return 'success';
      case 'Rejected': return 'error';
      default: return 'primary';
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1, fontWeight: 'bold', fontSize: '1.25rem'}}>
        Request Details
      </DialogTitle>
      <DialogContent dividers sx={{ backgroundColor: '#fafbfd' }}>
        <Grid container spacing={3} sx={{ py: 1 }}>
          {/* General info */}
          <Grid item xs={12} md={6}>
            <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: '12px', border: '1px solid #eef2f6', height: '100%' }}>
              <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, fontWeight: 600 }}>
                GENERAL INFORMATION
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Request Type</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{request.requestType || request.category || '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Created By</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{getCreatorName(request.createdBy)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Created At</Typography>
                  <Typography variant="body2">{new Date(request.createdAt).toLocaleString()}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Last Updated</Typography>
                  <Typography variant="body2">{new Date(request.updatedAt).toLocaleString()}</Typography>
                </Grid>
              </Grid>
            </Box>
          </Grid>

          {/* Workflow status */}
          <Grid item xs={12} md={6}>
            <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: '12px', border: '1px solid #eef2f6', height: '100%' }}>
              <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, fontWeight: 600 }}>
                WORKFLOW STATUS
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>Current Status</Typography>
                  <Chip label={request.status} color={getStatusColor(request.status) as any} size="small" sx={{ fontWeight: 600 }} />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>Current Assignees</Typography>
                  {request.currentAssignedUsers && request.currentAssignedUsers.length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {request.currentAssignedUsers.map((user, idx) => (
                        <Chip key={idx} label={user} size="small" variant="outlined" color="primary" />
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="textSecondary">-</Typography>
                  )}
                </Grid>
                {request.remarks && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="textSecondary">Last Action Remarks</Typography>
                    <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#555' }}>"{request.remarks}"</Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          </Grid>

          {/* Request Details (Specific Fields) */}
          <Grid item xs={12}>
            <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: '12px', border: '1px solid #eef2f6' }}>
              <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, fontWeight: 600 }}>
                REQUEST FIELDS
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                {request.requestType === 'VM Creation' && (
                  <>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="textSecondary">OS and Version</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{request.details?.osVersion || '-'}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="textSecondary">RAM</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{request.details?.ram ? `${request.details.ram} GB` : '-'}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="textSecondary">HDD</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{request.details?.hdd ? `${request.details.hdd} GB` : '-'}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="textSecondary">CPU (Cores)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{request.details?.cpu || '-'}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="textSecondary">IP Address</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: request.details?.ip ? '#2e7d32' : 'inherit' }}>
                        {request.details?.ip || 'Not Assigned Yet'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="textSecondary">Decided Cluster</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: request.details?.cluster ? '#1976d2' : 'inherit' }}>
                        {request.details?.cluster || 'Not Decided Yet'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="textSecondary">Decided Host Node</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: request.details?.node ? '#1976d2' : 'inherit' }}>
                        {request.details?.node || 'Not Decided Yet'}
                      </Typography>
                    </Grid>
                  </>
                )}

                {request.requestType === 'DC Entry' && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="textSecondary">Date and Time</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {request.details?.dateTime ? new Date(request.details.dateTime).toLocaleString() : '-'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="textSecondary">Purpose</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{request.details?.purpose || request.purpose || '-'}</Typography>
                    </Grid>
                  </>
                )}

                {request.requestType === 'Hardware Issuance' && (() => {
                  const hItem = inventory.find((i: any) => (i.id || i._id) === request.details?.hardwareId);
                  const hName = hItem ? hItem.itemName : request.details?.hardwareId;
                  return (
                    <>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="textSecondary">Hardware Item Name</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{hName || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="textSecondary">Quantity</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{request.details?.quantity || '-'}</Typography>
                      </Grid>
                    </>
                  );
                })()}

                {request.requestType === 'Hardware Replacement' && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="textSecondary">Replacement Remarks</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{request.details?.remarks || '-'}</Typography>
                  </Grid>
                )}

                {request.description && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="textSecondary">General Description</Typography>
                    <Typography variant="body2">{request.description}</Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          </Grid>

          {/* Action Zone for authorized users */}
          {canAction && !isTerminal && (
            <Grid item xs={12}>
              <Box sx={{ p: 2, bgcolor: '#fffde7', borderRadius: '12px', border: '1px solid #ffe082' }}>
                <Typography variant="subtitle2" color="warning.dark" sx={{ mb: 1, fontWeight: 700 }}>
                  WORKFLOW ACTION ZONE
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Box sx={{ display: 'flex', gap: 2, flexWrap: { xs: 'wrap', md: 'nowrap' }, mt: 2 }}>
                  {isIpIssuance && (
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <TextField
                        label="IP Address Assignment"
                        variant="outlined"
                        fullWidth
                        required
                        error={ipError}
                        helperText={ipError ? "You must provide an IP address to advance from this stage." : "Enter the IP address allocated for this request"}
                        value={ipAddress}
                        onChange={(e) => {
                          setIpAddress(e.target.value);
                          if (e.target.value.trim()) setIpError(false);
                        }}
                        placeholder="e.g. 10.41.12.34"
                        sx={{ bgcolor: '#fff' }}
                      />
                    </Box>
                  )}

                  {isClusterDeciding && (
                    <>
                      <Box sx={{ flex: 1, minWidth: 200 }}>
                        <FormControl fullWidth required error={clusterError}>
                          <InputLabel>Choose Cluster</InputLabel>
                          <Select
                            value={selectedCluster}
                            label="Choose Cluster"
                            onChange={(e) => {
                              setSelectedCluster(e.target.value as string);
                              if (e.target.value) setClusterError(false);
                            }}
                            sx={{ bgcolor: '#fff' }}
                          >
                            {clusters.map((c: any) => (
                              <MenuItem key={c.id || c._id} value={c.clusterName}>
                                {c.clusterName} (IP: {c.ipAddress})
                              </MenuItem>
                            ))}
                          </Select>
                          {clusterError && <Typography variant="caption" color="error">You must choose a cluster to advance.</Typography>}
                        </FormControl>
                      </Box>

                      <Box sx={{ flex: 1, minWidth: 200 }}>
                        <FormControl fullWidth required error={nodeError} disabled={!selectedCluster}>
                          <InputLabel>Choose Node</InputLabel>
                          <Select
                            value={selectedNode}
                            label="Choose Node"
                            onChange={(e) => {
                              setSelectedNode(e.target.value as string);
                              if (e.target.value) setNodeError(false);
                            }}
                            sx={{ bgcolor: '#fff' }}
                          >
                            {filteredNodes.map((n: any) => (
                              <MenuItem key={n.id || n._id} value={n.hostName}>
                                {n.hostName} ({n.ipAddress})
                              </MenuItem>
                            ))}
                          </Select>
                          {nodeError && <Typography variant="caption" color="error">You must choose a node to advance.</Typography>}
                        </FormControl>
                      </Box>
                    </>
                  )}

                  <Box sx={{ flex: 1, minWidth: 200 }}>
                    <TextField
                      label="Action Remarks (Optional)"
                      variant="outlined"
                      fullWidth
                      multiline
                      rows={2}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Add any comments for the history log"
                      sx={{ bgcolor: '#fff' }}
                    />
                  </Box>
                </Box>
              </Box>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="text" color="inherit">
          Close
        </Button>
        {canAction && !isTerminal && (
          <>
            <Button
              onClick={handleReject}
              variant="outlined"
              color="error"
              disabled={submitting}
            >
              Reject
            </Button>
            <Button
              onClick={handleAdvance}
              variant="contained"
              color="success"
              disabled={submitting}
            >
              {submitting ? 'Processing...' : (isIpIssuance ? 'Submit IP & Approve' : isClusterDeciding ? 'Submit Cluster & Approve' : 'Approve & Advance')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default RequestViewModal;
