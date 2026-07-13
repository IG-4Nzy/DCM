// @ts-nocheck
import React, { useState, useEffect } from 'react';
import apiClient from '../../services/request';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Divider, Grid, Chip, TextField, FormControl, InputLabel, Select, MenuItem, Checkbox, FormControlLabel } from '@mui/material';
import Button from '../../components/Button';
import type { RequestData, RequestLogData } from './model';
import { fetchUsers } from '../Users/action';
import { fetchClusters } from '../Clusters/action';
import { fetchNodes } from '../ServerMonitoring/action';
import { fetchInventory } from '../Inventory/action';
import { fetchRequestLogs } from './action';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import dayjs from 'dayjs';
import { getServerTime } from '../../helpers/time';

interface RequestViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: RequestData | null;
  onAdvance: (id: string, payload?: any) => Promise<void>;
  onReject: (id: string, remarks: string) => Promise<void>;
  onSendBack: (id: string, reason: string) => Promise<void>;
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
  onSendBack,
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
  const [logs, setLogs] = useState<RequestLogData[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [isSendBackOpen, setIsSendBackOpen] = useState(false);
  const [sendBackReason, setSendBackReason] = useState('');

  // Cluster Selection States
  const [clusters, setClusters] = useState<any[]>([]);
  const [selectedCluster, setSelectedCluster] = useState('');
  const [clusterError, setClusterError] = useState(false);

  // Node Selection States
  const [nodes, setNodes] = useState<any[]>([]);
  const [filteredNodes, setFilteredNodes] = useState<any[]>([]);

  // Assignee Selection States
  const [assigneeSelectionOpen, setAssigneeSelectionOpen] = useState(false);
  const [nextAssignees, setNextAssignees] = useState<string[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [assigneeError, setAssigneeError] = useState(false);
  const [checkingAssignees, setCheckingAssignees] = useState(false);
  const [nextStageName, setNextStageName] = useState('');
  const [selectedNode, setSelectedNode] = useState('');
  const [nodeError, setNodeError] = useState(false);

  const isClusterDeciding = request?.status?.toLowerCase() === 'cluster deciding' || request?.status?.toLowerCase().includes('cluster');

  const [entryTime, setEntryTime] = useState('');
  const [entryTimeError, setEntryTimeError] = useState(false);
  const [exitTime, setExitTime] = useState('');
  const [exitTimeError, setExitTimeError] = useState(false);
  const [keptItemsOnExit, setKeptItemsOnExit] = useState(false);

  const isMarkEntryTime = request?.requestType === 'DC Entry' && (request?.status?.toLowerCase() === 'mark entry time' || request?.status?.toLowerCase().includes('entry'));
  const isMarkExitTime = request?.requestType === 'DC Entry' && (request?.status?.toLowerCase() === 'mark exit time' || request?.status?.toLowerCase().includes('exit'));
  const isVMCreationStage = (request?.requestType === 'VM Creation' || request?.requestType === 'VM Management') && (request?.status?.toLowerCase() === 'vm creation' || request?.status?.toLowerCase().includes('creation'));
  const isVMBackupStage = (request?.requestType === 'VM Creation' || request?.requestType === 'VM Management') && (request?.status?.toLowerCase() === 'vm backup' || request?.status?.toLowerCase().includes('backup'));

  const [backupLocation, setBackupLocation] = useState('');
  const [backupError, setBackupError] = useState(false);
  const [addedToMonitoring, setAddedToMonitoring] = useState(false);

  const requestId = request?.id || request?._id || '';

  useEffect(() => {
    if (isOpen && requestId) {
      dispatch(fetchUsers({ pagination: false }));
      dispatch(fetchInventory({ pagination: false }));

      setLoadingLogs(true);
      fetchRequestLogs(requestId)
        .then(res => {
          setLogs(res || []);
        })
        .catch(() => {
          setLogs([]);
        })
        .finally(() => {
          setLoadingLogs(false);
        });
    }
  }, [isOpen, requestId, dispatch]);

  const hasInitializedRef = React.useRef(false);

  // Initialize form fields when request details are loaded
  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
      return;
    }

    if (isOpen && !hasInitializedRef.current && request && (request.id === requestId || request._id === requestId)) {
      setRemarks('');
      setIpAddress(request.details?.ip || '');
      setIpError(false);
      setBackupLocation(request.details?.backupLocation || '');
      setBackupError(false);
      setAddedToMonitoring(!!request.details?.addedToMonitoring);

      setEntryTime(
        request.details?.entryTime
          ? dayjs(request.details.entryTime).format('YYYY-MM-DDTHH:mm')
          : (request.details?.dateTime
            ? dayjs(request.details.dateTime).format('YYYY-MM-DDTHH:mm')
            : dayjs(request.createdAt || getServerTime().toDate()).format('YYYY-MM-DDTHH:mm'))
      );
      setEntryTimeError(false);
      setExitTime(
        request.details?.exitTime
          ? dayjs(request.details.exitTime).format('YYYY-MM-DDTHH:mm')
          : getServerTime().format('YYYY-MM-DDTHH:mm')
      );
      setExitTimeError(false);
      setKeptItemsOnExit(!!request.details?.keptItemsOnExit);

      if (request.status?.toLowerCase() === 'cluster deciding' || request.status?.toLowerCase().includes('cluster')) {
        fetchClusters({ pagination: false }).then(res => {
          setClusters(res.data || []);
        }).catch(() => {
          setClusters([]);
        });
        const fetchNodes1 = apiClient.get('/api/nodes/', { params: { pagination: false } }).then(res => res.data.data || []);
        const fetchNodes2 = fetchNodes().catch(() => []);
        Promise.all([fetchNodes1, fetchNodes2]).then(([nodesList1, nodesList2]) => {
          const normalized1 = nodesList1.map((n: any) => ({
            ...n,
            hostName: n.node,
            ipAddress: n.ipAddress || ''
          }));
          // Merge lists and de-duplicate by hostName/node name
          const mergedMap = new Map();
          [...normalized1, ...nodesList2].forEach((n: any) => {
            const name = n.hostName || n.node;
            if (name) {
              mergedMap.set(name, n);
            }
          });
          setNodes(Array.from(mergedMap.values()));
        }).catch(() => {
          setNodes([]);
        });
        setSelectedCluster(request.details?.cluster || '');
        setSelectedNode(request.details?.node || '');
        setClusterError(false);
        setNodeError(false);
      }
      hasInitializedRef.current = true;
    }
  }, [isOpen, request, requestId]);

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
  const canAction = isSuperuser || isAssigned;
  const isTerminal = request.status === 'Completed' || request.status === 'Rejected';
  const canSendBack = request && typeof request.currentStageIndex === 'number' && request.currentStageIndex > 0;

  // Check if status is IP Issuance
  const isIpIssuance = request.status?.toLowerCase() === 'ip issuance' || request.status?.toLowerCase().includes('ip');

  const handleConfirmSendBack = async () => {
    if (!sendBackReason.trim()) return;
    setSubmitting(true);
    try {
      await onSendBack(request.id || request._id || '', sendBackReason.trim());
      setIsSendBackOpen(false);
      onClose();
    } catch (err) {
      // Handled in parent
    } finally {
      setSubmitting(false);
    }
  };

  const executeAdvance = async (assignee?: string) => {
    setSubmitting(true);
    try {
      let payload: any = { remarks };
      if (assignee) {
        payload.selectedAssignee = assignee;
      }
      
      if (isIpIssuance) {
        payload.details = { ip: ipAddress.trim() };
      } else if (isVMCreationStage) {
        payload.details = {
          addedToMonitoring: !!addedToMonitoring
        };
      } else if (isVMBackupStage) {
        payload.details = {
          backupLocation: backupLocation.trim()
        };
      } else if (isClusterDeciding) {
        payload.details = {
          cluster: selectedCluster,
          node: selectedNode
        };
      } else if (isMarkEntryTime) {
        payload.details = {
          entryTime: new Date(entryTime).toISOString()
        };
      } else if (isMarkExitTime) {
        const existingEntryTime = request.details?.entryTime || request.details?.dateTime;
        if (existingEntryTime && new Date(exitTime) < new Date(existingEntryTime)) {
          alert('Exit time cannot be earlier than entry time.');
          setExitTimeError(true);
          setSubmitting(false);
          return;
        }
        payload.details = {
          exitTime: new Date(exitTime).toISOString(),
          keptItemsOnExit: !!keptItemsOnExit
        };
      }
      await onAdvance(request.id || request._id || '', payload);
      setAssigneeSelectionOpen(false);
      setSelectedAssignee('');
      onClose();
    } catch (err) {
      // toast is handled in parent
    } finally {
      setSubmitting(false);
    }
  };

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
    if (isMarkEntryTime && !entryTime) {
      setEntryTimeError(true);
      return;
    }
    if (isMarkExitTime && !exitTime) {
      setExitTimeError(true);
      return;
    }
    if (isVMBackupStage && !backupLocation.trim()) {
      setBackupError(true);
      return;
    }

    setCheckingAssignees(true);
    try {
      const res = await apiClient.get(`/api/requests/${request?.id || request?._id}/next-assignees`);
      const assignees = res.data.assignees || [];
      if (assignees.length > 1) {
         setNextAssignees(assignees);
         setNextStageName(res.data.nextStageName || '');
         setAssigneeSelectionOpen(true);
         setCheckingAssignees(false);
         return;
      }
    } catch (err) {
      console.error('Failed to fetch next assignees', err);
    }
    setCheckingAssignees(false);

    // If no selection needed, advance directly
    executeAdvance();
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

  const safeParseDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const cleaned = String(dateStr).replace(/\+00:00Z$/, 'Z').replace(/\+00:00$/, 'Z');
      const d = new Date(cleaned);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString();
    } catch (e) {
      return dateStr;
    }
  };

  const getCreatorName = (usernameVal: string) => {
    const u = users.find((user: any) => user.username === usernameVal);
    const resolvedName = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username : usernameVal;
    if (usernameVal === request.createdBy && request.createdByFullName) {
        return request.createdByFullName;
    }
    return resolvedName;
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
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ pb: 1, fontWeight: 'bold', fontSize: '1.25rem', color: '#333' }}>
        Request Details
      </DialogTitle>
      <DialogContent dividers sx={{ backgroundColor: '#fafbfd' }}>
        <Grid container spacing={3} sx={{ py: 1 }}>
          {/* General info */}
          <Grid size={{xs: 12, md: 6}}   >
            <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: '12px', border: '1px solid #eef2f6', height: '100%' }}>
              <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, fontWeight: 600 }}>
                GENERAL INFORMATION
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid size={{xs: 6}}  >
                  <Typography variant="caption" color="textSecondary">Request Type</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{request.requestType || request.category || '-'}</Typography>
                </Grid>
                <Grid size={{xs: 6}}  >
                  <Typography variant="caption" color="textSecondary">Created By</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{getCreatorName(request.createdBy)}</Typography>
                </Grid>
                <Grid size={{xs: 6}}  >
                  <Typography variant="caption" color="textSecondary">Created At</Typography>
                  <Typography variant="body2">{safeParseDate(request.createdAt)}</Typography>
                </Grid>
                <Grid size={{xs: 6}}  >
                  <Typography variant="caption" color="textSecondary">Last Updated</Typography>
                  <Typography variant="body2">{safeParseDate(request.updatedAt)}</Typography>
                </Grid>
              </Grid>
            </Box>
          </Grid>

          {/* Workflow status */}
          <Grid size={{xs: 12, md: 6}}   >
            <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: '12px', border: '1px solid #eef2f6', height: '100%' }}>
              <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, fontWeight: 600 }}>
                WORKFLOW STATUS
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid size={{xs: 6}}  >
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>Current Status</Typography>
                  <Chip label={request.status} color={getStatusColor(request.status) as any} size="small" sx={{ fontWeight: 600 }} />
                </Grid>
                <Grid size={{xs: 6}}  >
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>Current Assignees</Typography>
                  {request.currentAssignedUsers && request.currentAssignedUsers.length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {request.currentAssignedUsers.map((usernameVal, idx) => {
                        const u = users.find((user: any) => user.username === usernameVal);
                        const displayName = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username : (request.currentAssignedUsersFullName?.[idx] || usernameVal);
                        return (
                          <Chip key={idx} label={displayName} size="small" variant="outlined" color="primary" />
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="textSecondary">-</Typography>
                  )}
                </Grid>
                {request.remarks && (
                  <Grid size={{xs: 12}}  >
                    <Typography variant="caption" color="textSecondary">Last Action Remarks</Typography>
                    <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#555' }}>"{request.remarks}"</Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          </Grid>

          {/* Request Details (Specific Fields) */}
          <Grid size={{xs: 12}}  >
            <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: '12px', border: '1px solid #eef2f6' }}>
              <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, fontWeight: 600 }}>
                REQUEST FIELDS
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Grid container spacing={2}>
                <Grid size={{xs: 12}}  >
                  <Typography variant="caption" color="textSecondary">Purpose</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {request.purpose || request.details?.purpose || '-'}
                  </Typography>
                </Grid>
                <Grid size={{xs: 12}}  ><Divider sx={{ opacity: 0.6 }} /></Grid>

                {(request.requestType === 'VM Creation' || request.requestType === 'VM Management') && (
                  <>
                    <Grid size={{xs: 12, sm: 4}}   >
                      <Typography variant="caption" color="textSecondary">VM Name</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{request.details?.vmName || '-'}</Typography>
                    </Grid>
                    <Grid size={{xs: 12, sm: 4}}   >
                      <Typography variant="caption" color="textSecondary">OS and Version</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{request.details?.osVersion || '-'}</Typography>
                    </Grid>
                    <Grid size={{xs: 12, sm: 4}}   >
                      <Typography variant="caption" color="textSecondary">RAM</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{request.details?.ram ? `${request.details.ram} GB` : '-'}</Typography>
                    </Grid>
                    <Grid size={{xs: 12, sm: 4}}   >
                      <Typography variant="caption" color="textSecondary">HDD</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{request.details?.hdd ? `${request.details.hdd} GB` : '-'}</Typography>
                    </Grid>
                    <Grid size={{xs: 12, sm: 4}}   >
                      <Typography variant="caption" color="textSecondary">CPU (Cores)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{request.details?.cpu || '-'}</Typography>
                    </Grid>
                    <Grid size={{xs: 12, sm: 4}}   >
                      <Typography variant="caption" color="textSecondary">IP Address</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: request.details?.ip ? '#2e7d32' : 'inherit' }}>
                        {request.details?.ip || 'Not Assigned Yet'}
                      </Typography>
                    </Grid>
                    <Grid size={{xs: 12, sm: 4}}   >
                      <Typography variant="caption" color="textSecondary">Decided Cluster</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: request.details?.cluster ? '#1976d2' : 'inherit' }}>
                        {request.details?.cluster || 'Not Decided Yet'}
                      </Typography>
                    </Grid>
                    <Grid size={{xs: 12, sm: 4}}   >
                      <Typography variant="caption" color="textSecondary">Decided Host Node</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: request.details?.node ? '#1976d2' : 'inherit' }}>
                        {request.details?.node || 'Not Decided Yet'}
                      </Typography>
                    </Grid>
                    <Grid size={{xs: 12, sm: 4}}   >
                      <Typography variant="caption" color="textSecondary">Backup Location</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{request.details?.backupLocation || '-'}</Typography>
                    </Grid>
                    <Grid size={{xs: 12, sm: 4}}   >
                      <Typography variant="caption" color="textSecondary">Added to Monitoring</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: request.details?.addedToMonitoring ? '#2e7d32' : '#c62828' }}>
                        {request.details?.addedToMonitoring ? 'Yes' : 'No'}
                      </Typography>
                    </Grid>
                  </>
                )}

                {request.requestType === 'DC Entry' && (
                  <>
                    <Grid size={{xs: 12, sm: 6}}   >
                      <Typography variant="caption" color="textSecondary">Scheduled Date and Time</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {safeParseDate(request.details?.dateTime)}
                      </Typography>
                    </Grid>
                    <Grid size={{xs: 12, sm: 6}}   >
                      <Typography variant="caption" color="textSecondary">Actual Entry Time</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: request.details?.entryTime ? '#2e7d32' : 'inherit' }}>
                        {request.details?.entryTime ? safeParseDate(request.details.entryTime) : 'Not Marked Yet'}
                      </Typography>
                    </Grid>
                    <Grid size={{xs: 12, sm: 6}}   >
                      <Typography variant="caption" color="textSecondary">Actual Exit Time</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: request.details?.exitTime ? '#c62828' : 'inherit' }}>
                        {request.details?.exitTime ? safeParseDate(request.details.exitTime) : 'Not Marked Yet'}
                      </Typography>
                    </Grid>
                    {request.details?.itemsToBring && (
                      <Grid size={{xs: 12, sm: 6}}   >
                        <Typography variant="caption" color="textSecondary">Tools / Items to Bring</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{request.details.itemsToBring}</Typography>
                      </Grid>
                    )}
                    {request.details?.accompanyingPersons && (
                      <Grid size={{xs: 12, sm: 6}}   >
                        <Typography variant="caption" color="textSecondary">Accompanying Persons</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{request.details.accompanyingPersons}</Typography>
                      </Grid>
                    )}
                    {request.details?.itemsToBring && (
                      <Grid size={{xs: 12, sm: 6}}   >
                        <Typography variant="caption" color="textSecondary">Kept Tools / Items on Exit</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: request.details?.keptItemsOnExit ? '#2e7d32' : '#c62828' }}>
                          {request.details?.exitTime ? (request.details?.keptItemsOnExit ? 'Yes' : 'No') : 'Pending Exit'}
                        </Typography>
                      </Grid>
                    )}
                  </>
                )}

                {request.requestType === 'Hardware Issuance' && (() => {
                  const hItem = inventory.find((i: any) => (i.id || i._id) === request.details?.hardwareId);
                  const hName = hItem ? hItem.itemName : (request.details?.hardwareItem || request.details?.hardwareId || '-');
                  return (
                    <>
                      <Grid size={{xs: 12, sm: 6}}   >
                        <Typography variant="caption" color="textSecondary">Hardware Item Name</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{hName || '-'}</Typography>
                      </Grid>
                      <Grid size={{xs: 12, sm: 6}}   >
                        <Typography variant="caption" color="textSecondary">Quantity</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{request.details?.quantity || '-'}</Typography>
                      </Grid>
                    </>
                  );
                })()}

                {request.requestType === 'Hardware Replacement' && (
                  <Grid size={{xs: 12}}  >
                    <Typography variant="caption" color="textSecondary">Replacement Remarks</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{request.details?.remarks || '-'}</Typography>
                  </Grid>
                )}

                {request.description && (
                  <Grid size={{xs: 12}}  >
                    <Typography variant="caption" color="textSecondary">General Description</Typography>
                    <Typography variant="body2">{request.description}</Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          </Grid>

          {/* History Logs */}
          <Grid size={{xs: 12}}  >
            <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: '12px', border: '1px solid #eef2f6' }}>
              <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, fontWeight: 600 }}>
                REQUEST HISTORY LOGS
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {loadingLogs ? (
                <Typography variant="body2" color="textSecondary" sx={{ py: 1 }}>Loading logs...</Typography>
              ) : logs.length === 0 ? (
                <Typography variant="body2" color="textSecondary" sx={{ py: 1 }}>No history logs recorded yet.</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                  {logs.map((log, idx) => (
                    <Box
                      key={log._id || idx}
                      sx={{
                        p: 1.5,
                        bgcolor: '#f8fafc',
                        borderRadius: '8px',
                        borderLeft: `4px solid ${log.action && log.action.includes('Reject') ? '#ef4444' : log.action && (log.action.includes('Advance') || log.action.includes('Completed') || log.action.includes('Advanced') || log.action.includes('Created')) ? '#22c55e' : '#3b82f6'}`
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                          {log.action}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {log.timestamp ? safeParseDate(log.timestamp) : ''}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: '#475569', mb: 0.5 }}>
                        {log.details}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', mt: 0.5 }}>
                        <Typography variant="caption" sx={{ fontStyle: 'italic', color: '#64748b' }}>
                          Performed by: {getCreatorName(log.user)}
                        </Typography>
                        {log.remarks && (
                          <Typography variant="caption" sx={{ fontStyle: 'italic', fontWeight: 500, color: '#64748b' }}>
                            Remarks: "{log.remarks}"
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Grid>

          {/* Action Zone for authorized users */}
          {canAction && !isTerminal && (
            <Grid size={{xs: 12}}  >
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

                  {isVMCreationStage && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, minWidth: 240 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={addedToMonitoring}
                            onChange={(e) => setAddedToMonitoring(e.target.checked)}
                            color="primary"
                          />
                        }
                        label="VM added to monitoring confirmation"
                        sx={{ color: '#374151', alignSelf: 'flex-start' }}
                      />
                    </Box>
                  )}

                  {isVMBackupStage && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, minWidth: 240 }}>
                      <TextField
                        label="VM Backup Path / Location"
                        variant="outlined"
                        fullWidth
                        required
                        error={backupError}
                        helperText={backupError ? "You must provide a VM backup path to advance." : "Enter VM backup directory path"}
                        value={backupLocation}
                        onChange={(e) => {
                          setBackupLocation(e.target.value);
                          if (e.target.value.trim()) setBackupError(false);
                        }}
                        placeholder="e.g. /backups/vms/my-vm"
                        sx={{ bgcolor: '#fff' }}
                      />
                    </Box>
                  )}

                  {isMarkEntryTime && (
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <TextField
                        label="Actual Entry Time"
                        type="datetime-local"
                        variant="outlined"
                        fullWidth
                        required
                        error={entryTimeError}
                        helperText={entryTimeError ? "You must provide actual entry time to advance." : "Enter the actual entry time of the visitor"}
                        value={entryTime}
                        onChange={(e) => {
                          setEntryTime(e.target.value);
                          if (e.target.value) setEntryTimeError(false);
                        }}
                        slotProps={{ 
                          inputLabel: { shrink: true },
                          htmlInput: { min: dayjs().startOf('day').format('YYYY-MM-DDTHH:mm') }
                        }}
                        sx={{ bgcolor: '#fff' }}
                      />
                    </Box>
                  )}

                  {isMarkExitTime && (
                    <Box sx={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <TextField
                        label="Actual Exit Time"
                        type="datetime-local"
                        variant="outlined"
                        fullWidth
                        required
                        error={exitTimeError}
                        helperText={exitTimeError ? "You must provide actual exit time to advance." : "Enter the actual exit time of the visitor"}
                        value={exitTime}
                        onChange={(e) => {
                          setExitTime(e.target.value);
                          if (e.target.value) setExitTimeError(false);
                        }}
                        slotProps={{ 
                          inputLabel: { shrink: true },
                          htmlInput: { min: dayjs().startOf('day').format('YYYY-MM-DDTHH:mm') }
                        }}
                        sx={{ bgcolor: '#fff', mb: 1 }}
                      />
                      {request.details?.itemsToBring && (
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={keptItemsOnExit}
                              onChange={(e) => setKeptItemsOnExit(e.target.checked)}
                              color="primary"
                            />
                          }
                          label="Visitor kept tools/items with them on exit"
                          sx={{ color: '#374151' }}
                        />
                      )}
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
                            MenuProps={{ disablePortal: false }}
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
                            MenuProps={{ disablePortal: true }}
                          >
                            {filteredNodes.map((n: any) => (
                              <MenuItem key={n.id || n._id} value={n.hostName}>
                                {n.hostName} {n.ipAddress ? `(${n.ipAddress})` : ''}
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
        {canAction && !isTerminal && canSendBack && (
          <Button
            onClick={() => {
              setSendBackReason('');
              setIsSendBackOpen(true);
            }}
            variant="outlined"
            color="warning"
            disabled={submitting}
            sx={{ mr: 'auto' }}
          >
            Send Back
          </Button>
        )}
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
              {checkingAssignees || submitting ? 'Processing...' : (isIpIssuance ? 'Submit IP & Approve' : isVMCreationStage ? 'Submit Monitoring Confirmation & Approve' : isVMBackupStage ? 'Submit Backup Path & Approve' : isClusterDeciding ? 'Submit Cluster & Approve' : isMarkEntryTime ? 'Submit Entry Time' : isMarkExitTime ? 'Submit Exit Time & Approve' : 'Approve')}
            </Button>
          </>
        )}
      </DialogActions>

      <Dialog
        open={isSendBackOpen}
        onClose={() => setIsSendBackOpen(false)}
        slotProps={{
          paper: {
            sx: { borderRadius: "12px", p: 1, minWidth: "400px" }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: "bold", color: "#333" }}>Send Back Request</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Typography variant="body2" color="textSecondary">
              Are you sure you want to send this request back to the previous stage and assignees?
            </Typography>
            <TextField
              fullWidth
              label="Reason for Send Back"
              multiline
              rows={3}
              required
              value={sendBackReason}
              onChange={(e) => setSendBackReason(e.target.value)}
              placeholder="Provide reason for sending back..."
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="text" onClick={() => setIsSendBackOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmSendBack}
            disabled={!sendBackReason.trim() || submitting}
          >
            Send Back
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={assigneeSelectionOpen}
        onClose={() => setAssigneeSelectionOpen(false)}
        slotProps={{
          paper: {
            sx: { borderRadius: "12px", p: 1, minWidth: "400px" }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: "bold", color: "#333" }}>Select Assignee for Next Stage</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Typography variant="body2" color="textSecondary">
              The next stage <strong>{nextStageName ? `(${nextStageName})` : ''}</strong> has multiple assignee groups. Please select one to assign this request to.
            </Typography>
            <FormControl fullWidth required error={assigneeError}>
              <InputLabel>Assignee</InputLabel>
              <Select
                value={selectedAssignee}
                label="Assignee"
                onChange={(e) => {
                  setSelectedAssignee(e.target.value as string);
                  setAssigneeError(false);
                }}
              >
                {nextAssignees.map(a => {
                  let label = a;
                  if (a.startsWith('Role:')) {
                    label = `Role: ${a.replace('Role:', '')}`;
                  } else if (a.startsWith('DeptStaffs:')) {
                    label = `Department Staffs: ${a.replace('DeptStaffs:', '')}`;
                  } else if (a.startsWith('SpecificUser:')) {
                    const username = a.replace('SpecificUser:', '');
                    const userObj = users?.find((u: any) => u.username === username);
                    label = userObj ? `Specific User: ${userObj.firstName} ${userObj.lastName} (${username})` : `Specific User: ${username}`;
                  } else if (a === 'RequesterDeptHead') {
                    label = 'Department Head of Requester';
                  }

                  return (
                    <MenuItem key={a} value={a}>
                      {label}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="text" onClick={() => setAssigneeSelectionOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              if (!selectedAssignee) {
                setAssigneeError(true);
                return;
              }
              executeAdvance(selectedAssignee);
            }}
            disabled={submitting}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default RequestViewModal;
