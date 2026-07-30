// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, TextField, MenuItem, FormControl, InputLabel, Select, Checkbox, FormControlLabel } from '@mui/material';
import Button from '../../components/Button';
import type { RequestData } from './model';
import type { RootState, AppDispatch } from '../../store';
import { fetchInventory } from '../Inventory/action';
import { fetchStagesForType } from './action';
import { useToast } from '../../contexts/ToastContext';

import request from '../../services/request';
import { getServerTime } from '../../helpers/time';

interface RequestFormModalProps {
  isModalOpen: boolean;
  handleCloseModal: () => void;
  editingRequest: RequestData | null;
  onSubmit: (data: Partial<RequestData>) => Promise<void>;
  isSuperuser?: boolean;
  requestTypes: string[];
}

const RequestFormModal: React.FC<RequestFormModalProps> = ({
  isModalOpen,
  handleCloseModal,
  editingRequest,
  onSubmit,
  isSuperuser,
  requestTypes
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { inventory } = useSelector((state: RootState) => state.inventory);
  const { username } = useSelector((state: RootState) => state.auth);

  const [requestType, setRequestType] = useState('');
  const [description, setDescription] = useState('');
  const [purpose, setPurpose] = useState('');
  const [status, setStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [details, setDetails] = useState<any>({});
  const [configuredStages, setConfiguredStages] = useState<string[]>([]);
  const [clustersList, setClustersList] = useState<any[]>([]);
  const [nodesList, setNodesList] = useState<any[]>([]);
  const [vmsList, setVmsList] = useState<any[]>([]);

  const currentRequestType = editingRequest ? (editingRequest.requestType || editingRequest.category || '') : requestType;

  useEffect(() => {
    if (isModalOpen) {
      dispatch(fetchInventory({ pagination: false }));
      
      // Fetch clusters for dropdown
      request.get('/api/clusters/', { params: { pagination: false } })
        .then(res => setClustersList(res.data.data || []))
        .catch(err => console.error('Failed to load clusters for request', err));

      // Fetch nodes for dropdown
      request.get('/api/nodes/', { params: { pagination: false } })
        .then(res => setNodesList(res.data.data || []))
        .catch(err => console.error('Failed to load nodes for request', err));

      // Fetch VMs for dropdown (only lists that user's VMs)
      request.get('/api/vm-details/', { params: { pagination: false, admin: username } })
        .then(res => setVmsList(res.data.data || []))
        .catch(err => console.error('Failed to load VMs for request', err));
    }
  }, [isModalOpen, dispatch, username]);

  // Fetch stages whenever request type changes
  useEffect(() => {
    const loadStages = async () => {
      const type = editingRequest ? (editingRequest.requestType || editingRequest.category || '') : requestType;
      if (type) {
        try {
          const stages = await fetchStagesForType(type);
          setConfiguredStages(stages);
        } catch {
          setConfiguredStages([]);
        }
      }
    };
    if (isModalOpen) {
      loadStages();
    }
  }, [isModalOpen, requestType, editingRequest]);

  useEffect(() => {
    if (isModalOpen) {
      if (editingRequest) {
        setRequestType(editingRequest.requestType || editingRequest.category || (requestTypes[0] || ''));
        setDescription(editingRequest.description || '');
        setPurpose(editingRequest.purpose || '');
        setStatus(editingRequest.status || 'Pending');
        setRemarks(editingRequest.remarks || '');
        setDetails(editingRequest.details || {});
      } else {
        setRequestType(requestTypes[0] || '');
        setDescription('');
        setPurpose('');
        setStatus('');
        setRemarks('');
        setDetails({});
      }
    }
  }, [isModalOpen, editingRequest]);

  useEffect(() => {
    if (isModalOpen && !requestType && requestTypes.length > 0 && !editingRequest) {
      setRequestType(requestTypes[0]);
    }
  }, [requestTypes, isModalOpen, requestType, editingRequest]);

  const handleDetailChange = (field: string, value: any) => {
    setDetails((prev: any) => ({ ...prev, [field]: value }));
  };

  const getMinDateTime = () => {
    const now = getServerTime().toDate();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingRequest && currentRequestType === 'DC Entry' && (details.dateTime || details.entryTime)) {
      const selected = new Date(details.entryTime || details.dateTime);
      const now = getServerTime().toDate();
      // Use 1 minute buffer to account for minor system delays
      if (selected < new Date(now.getTime() - 60000)) {
        showToast('Please select an entry time in the present or future.', 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      const finalDetails = { ...details };
      if (currentRequestType === 'VM Creation' && !finalDetails.networkType) {
        finalDetails.networkType = 'Internet';
      }

      const payload: Partial<RequestData> = {
        requestType,
        description,
        purpose,
        details: finalDetails
      };

      if (editingRequest) {
        payload.status = status;
        payload.remarks = remarks;
      }

      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog 
      open={isModalOpen} 
      onClose={handleCloseModal} 
      disableEnforceFocus
      maxWidth="sm" 
      fullWidth
    >
      <DialogTitle sx={{ pb: 1, fontWeight: 'bold', fontSize: '1.25rem',color:"#333"}}>{editingRequest ? 'Edit Request' : 'Create Request'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Request Type</InputLabel>
              <Select
                value={requestType}
                label="Request Type"
                onChange={(e) => {
                  setRequestType(e.target.value);
                  setDetails({});
                }}
                disabled={!!editingRequest}
                MenuProps={{ disablePortal: true }}
              >
                {requestTypes.map(type => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ display: 'none' }} />

            <TextField
              label="Purpose"
              fullWidth
              required
              multiline
              rows={2}
              value={purpose}
              onChange={(e) => {
                const newPurpose = e.target.value;
                setPurpose(newPurpose);
                if (currentRequestType === 'VM Creation' && !editingRequest) {
                  const purpStr = newPurpose.trim().replace(/\s+/g, '');
                  const osStr = (details.osVersion || '').trim().replace(/\s+/g, '');
                  let ipPortion = '';
                  if (details.ip) {
                    const parts = details.ip.trim().split('.');
                    if (parts.length >= 2) {
                      ipPortion = parts.slice(-2).join('.');
                    } else {
                      ipPortion = details.ip.trim();
                    }
                  }
                  const nameParts = [purpStr, osStr, ipPortion].filter(Boolean);
                  if (nameParts.length > 0) {
                    handleDetailChange('vmName', nameParts.join('_'));
                  }
                }
              }}
              placeholder="State the purpose of this request"
            />

            {/* Dynamic Fields based on Request Type */}
            {currentRequestType === 'VM Creation' && (
              <>
                <FormControl fullWidth required>
                  <InputLabel>Network Type</InputLabel>
                  <Select
                    value={details.networkType || 'Internet'}
                    label="Network Type"
                    disabled={editingRequest && !isSuperuser && !editingRequest.currentAssignedUsers?.includes(username)}
                    onChange={(e) => handleDetailChange('networkType', e.target.value)}
                    MenuProps={{ disablePortal: true }}
                  >
                    <MenuItem value="Internet">Internet</MenuItem>
                    <MenuItem value="Intranet">Intranet</MenuItem>
                  </Select>
                </FormControl>

                <TextField 
                  label="OS and Version" 
                  fullWidth 
                  required 
                  disabled={editingRequest && !isSuperuser && !editingRequest.currentAssignedUsers?.includes(username)}
                  value={details.osVersion || ''} 
                  onChange={(e) => {
                    const newOs = e.target.value;
                    handleDetailChange('osVersion', newOs);
                    
                    const purpStr = (purpose || '').trim().replace(/\s+/g, '');
                    const osStr = newOs.trim().replace(/\s+/g, '');
                    let ipPortion = '';
                    if (details.ip) {
                      const parts = details.ip.trim().split('.').filter(Boolean);
                      if (parts.length >= 2) {
                        ipPortion = parts.slice(-2).join('.');
                      } else {
                        ipPortion = details.ip.trim();
                      }
                    }
                    const nameParts = [purpStr, osStr, ipPortion].filter(Boolean);
                    if (nameParts.length > 0) {
                      handleDetailChange('vmName', nameParts.join('_'));
                    }
                  }} 
                />
                <TextField 
                  label="IP (Assign or Update)" 
                  fullWidth 
                  disabled={editingRequest && !isSuperuser && !editingRequest.currentAssignedUsers?.includes(username)}
                  value={details.ip || ''} 
                  onChange={(e) => {
                    const newIp = e.target.value;
                    handleDetailChange('ip', newIp);

                    const purpStr = (purpose || '').trim().replace(/\s+/g, '');
                    const osStr = (details.osVersion || '').trim().replace(/\s+/g, '');
                    let ipPortion = '';
                    if (newIp) {
                      const parts = newIp.trim().split('.').filter(Boolean);
                      if (parts.length >= 2) {
                        ipPortion = parts.slice(-2).join('.');
                      } else {
                        ipPortion = newIp.trim();
                      }
                    }
                    const nameParts = [purpStr, osStr, ipPortion].filter(Boolean);
                    if (nameParts.length > 0) {
                      handleDetailChange('vmName', nameParts.join('_'));
                    }
                  }} 
                />
                <TextField 
                  label="VM Name (Auto-generated)" 
                  fullWidth 
                  required 
                  disabled={editingRequest && !isSuperuser && !editingRequest.currentAssignedUsers?.includes(username)}
                  value={details.vmName || ''} 
                  onChange={(e) => handleDetailChange('vmName', e.target.value)} 
                  helperText={
                    editingRequest
                      ? "Auto-updates with IP (Purpose_OS_IPLastTwo). Editable by assigned creators/approvers."
                      : "Auto-generated format: Purpose_OS_IP"
                  }
                />
                <TextField label="RAM" fullWidth required disabled={editingRequest && !isSuperuser && !editingRequest.currentAssignedUsers?.includes(username)} value={details.ram || ''} onChange={(e) => handleDetailChange('ram', e.target.value)} />
                <TextField label="HDD" fullWidth required disabled={editingRequest && !isSuperuser && !editingRequest.currentAssignedUsers?.includes(username)} value={details.hdd || ''} onChange={(e) => handleDetailChange('hdd', e.target.value)} />
                <TextField label="CPU" fullWidth required disabled={editingRequest && !isSuperuser && !editingRequest.currentAssignedUsers?.includes(username)} value={details.cpu || ''} onChange={(e) => handleDetailChange('cpu', e.target.value)} />
              </>
            )}

            {currentRequestType === 'VM Management' && (
              <>
                {!editingRequest ? (
                  <>
                    <FormControl fullWidth required>
                      <InputLabel>Select VM</InputLabel>
                      <Select
                        value={details.vmId || ''}
                        label="Select VM"
                        onChange={(e) => {
                          const selectedVm = vmsList.find(v => (v.id || v._id) === e.target.value);
                          setDetails((prev: any) => ({
                            ...prev,
                            vmId: e.target.value,
                            vmName: selectedVm ? (selectedVm.applications || selectedVm.vmId || '') : '',
                            osVersion: selectedVm ? (selectedVm.osAndExpiry || '') : '',
                            ram: selectedVm ? (selectedVm.ram || '') : '',
                            hdd: selectedVm ? (selectedVm.hdd || '') : '',
                            cpu: selectedVm ? (selectedVm.cpu || '') : '',
                            ip: selectedVm ? (selectedVm.ipAddress || '') : '',
                          }));
                        }}
                        MenuProps={{ disablePortal: true }}
                      >
                        {vmsList.map((vm: any) => (
                          <MenuItem key={vm.id || vm._id} value={vm.id || vm._id}>
                            {vm.vmId ? `[${vm.vmId}] ` : ''}{vm.applications || 'Unnamed VM'} {vm.ipAddress ? `(${vm.ipAddress})` : ''}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {details.vmId && (
                      <>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          <TextField label="OS and Version" fullWidth disabled value={details.osVersion || ''} sx={{ flex: 1, minWidth: 150 }} />
                          <TextField label="IP Address" fullWidth disabled value={details.ip || ''} sx={{ flex: 1, minWidth: 150 }} />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          <TextField label="Current RAM" disabled value={details.ram || ''} sx={{ flex: 1, minWidth: 100 }} />
                          <TextField label="Current HDD" disabled value={details.hdd || ''} sx={{ flex: 1, minWidth: 100 }} />
                          <TextField label="Current CPU" disabled value={details.cpu || ''} sx={{ flex: 1, minWidth: 100 }} />
                        </Box>

                        <FormControl fullWidth required>
                          <InputLabel>Operation Type</InputLabel>
                          <Select
                            value={details.operationType || ''}
                            label="Operation Type"
                            onChange={(e) => {
                              const opType = e.target.value;
                              setDetails((prev: any) => ({
                                ...prev,
                                operationType: opType,
                                // Reset operation-specific fields
                                newRam: undefined,
                                newHdd: undefined,
                                newCpu: undefined,
                                migrationCluster: undefined,
                                migrationNode: undefined,
                                cloneName: undefined,
                                snapshotName: undefined,
                                templateName: undefined,
                                backupName: undefined,
                              }));
                            }}
                            MenuProps={{ disablePortal: true }}
                          >
                            <MenuItem value="Migration">Migration</MenuItem>
                            <MenuItem value="Clone">Clone</MenuItem>
                            <MenuItem value="Snapshot">Snapshot</MenuItem>
                            <MenuItem value="Template">Template</MenuItem>
                            <MenuItem value="Backup">Backup</MenuItem>
                            <MenuItem value="Resource Upgrade">Resource Upgrade</MenuItem>
                            <MenuItem value="Others">Others</MenuItem>
                          </Select>
                        </FormControl>

                        {/* Resource Upgrade: new RAM, HDD, CPU fields */}
                        {details.operationType === 'Resource Upgrade' && (
                          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            <TextField
                              label="New RAM"
                              required
                              value={details.newRam || ''}
                              onChange={(e) => handleDetailChange('newRam', e.target.value)}
                              placeholder="e.g. 16 GB"
                              sx={{ flex: 1, minWidth: 100 }}
                            />
                            <TextField
                              label="New HDD"
                              required
                              value={details.newHdd || ''}
                              onChange={(e) => handleDetailChange('newHdd', e.target.value)}
                              placeholder="e.g. 500 GB"
                              sx={{ flex: 1, minWidth: 100 }}
                            />
                            <TextField
                              label="New CPU"
                              required
                              value={details.newCpu || ''}
                              onChange={(e) => handleDetailChange('newCpu', e.target.value)}
                              placeholder="e.g. 8 Cores"
                              sx={{ flex: 1, minWidth: 100 }}
                            />
                          </Box>
                        )}

                        {/* Migration: choose cluster and node */}
                        {details.operationType === 'Migration' && (
                          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            <FormControl required sx={{ flex: 1, minWidth: 200 }}>
                              <InputLabel>Target Cluster</InputLabel>
                              <Select
                                value={details.migrationCluster || ''}
                                label="Target Cluster"
                                onChange={(e) => {
                                  handleDetailChange('migrationCluster', e.target.value);
                                  handleDetailChange('migrationNode', '');
                                }}
                                MenuProps={{ disablePortal: true }}
                              >
                                {clustersList.map((c: any) => (
                                  <MenuItem key={c.id || c._id} value={c.id || c._id}>
                                    {c.clusterName}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <FormControl required sx={{ flex: 1, minWidth: 200 }} disabled={!details.migrationCluster}>
                              <InputLabel>Target Node</InputLabel>
                              <Select
                                value={details.migrationNode || ''}
                                label="Target Node"
                                onChange={(e) => handleDetailChange('migrationNode', e.target.value)}
                                MenuProps={{ disablePortal: true }}
                              >
                                {nodesList
                                  .filter((n: any) => !details.migrationCluster || n.clusterId === details.migrationCluster)
                                  .map((n: any) => (
                                    <MenuItem key={n.id || n._id} value={n.node || n.hostName}>
                                      {n.node || n.hostName}
                                    </MenuItem>
                                  ))}
                              </Select>
                            </FormControl>
                          </Box>
                        )}

                        {/* Clone: clone name */}
                        {details.operationType === 'Clone' && (
                          <TextField
                            label="Clone Name"
                            fullWidth
                            required
                            value={details.cloneName || ''}
                            onChange={(e) => handleDetailChange('cloneName', e.target.value)}
                            placeholder="Enter clone name"
                          />
                        )}

                        {/* Snapshot: snapshot name */}
                        {details.operationType === 'Snapshot' && (
                          <TextField
                            label="Snapshot Name"
                            fullWidth
                            required
                            value={details.snapshotName || ''}
                            onChange={(e) => handleDetailChange('snapshotName', e.target.value)}
                            placeholder="Enter snapshot name"
                          />
                        )}

                        {/* Template: template name */}
                        {details.operationType === 'Template' && (
                          <TextField
                            label="Template Name"
                            fullWidth
                            required
                            value={details.templateName || ''}
                            onChange={(e) => handleDetailChange('templateName', e.target.value)}
                            placeholder="Enter template name"
                          />
                        )}

                        {/* Backup: backup name */}
                        {details.operationType === 'Backup' && (
                          <TextField
                            label="Backup Name"
                            fullWidth
                            required
                            value={details.backupName || ''}
                            onChange={(e) => handleDetailChange('backupName', e.target.value)}
                            placeholder="Enter backup name"
                          />
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <TextField label="VM Name" fullWidth disabled value={details.vmName || ''} />
                    <TextField label="Operation Type" fullWidth disabled value={details.operationType || '-'} />
                    {details.operationType === 'Resource Upgrade' && (
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <TextField label="New RAM" disabled value={details.newRam || ''} sx={{ flex: 1 }} />
                        <TextField label="New HDD" disabled value={details.newHdd || ''} sx={{ flex: 1 }} />
                        <TextField label="New CPU" disabled value={details.newCpu || ''} sx={{ flex: 1 }} />
                      </Box>
                    )}
                    {details.operationType === 'Migration' && (
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <TextField label="Target Cluster" disabled value={details.migrationCluster || ''} sx={{ flex: 1 }} />
                        <TextField label="Target Node" disabled value={details.migrationNode || ''} sx={{ flex: 1 }} />
                      </Box>
                    )}
                    {details.operationType === 'Clone' && <TextField label="Clone Name" fullWidth disabled value={details.cloneName || ''} />}
                    {details.operationType === 'Snapshot' && <TextField label="Snapshot Name" fullWidth disabled value={details.snapshotName || ''} />}
                    {details.operationType === 'Template' && <TextField label="Template Name" fullWidth disabled value={details.templateName || ''} />}
                    {details.operationType === 'Backup' && <TextField label="Backup Name" fullWidth disabled value={details.backupName || ''} />}
                    <TextField label="OS and Version" fullWidth disabled value={details.osVersion || ''} />
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <TextField label="RAM" disabled value={details.ram || ''} sx={{ flex: 1 }} />
                      <TextField label="HDD" disabled value={details.hdd || ''} sx={{ flex: 1 }} />
                      <TextField label="CPU" disabled value={details.cpu || ''} sx={{ flex: 1 }} />
                    </Box>
                  </>
                )}
              </>
            )}

            {currentRequestType === 'DC Entry' && (
              <>
                <TextField 
                  label="Entry Time" 
                  type="datetime-local" 
                  fullWidth 
                  required 
                  slotProps={{
                    inputLabel: {
                      shrink: true,
                    },
                    htmlInput: {
                      min: getMinDateTime()
                    }
                  }}
                  value={details.entryTime || details.dateTime || ''} 
                  onChange={(e) => {
                    handleDetailChange('entryTime', e.target.value);
                    handleDetailChange('dateTime', e.target.value);
                  }} 
                />
                <TextField
                  label="Tools / Items to bring (Optional)"
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="e.g. Laptop, screwdriver, patch cords, etc."
                  value={details.itemsToBring || ''}
                  onChange={(e) => handleDetailChange('itemsToBring', e.target.value)}
                />
                <TextField
                  label="Accompanying Persons (Optional)"
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Name of those who are accompanying with you"
                  value={details.accompanyingPersons || ''}
                  onChange={(e) => handleDetailChange('accompanyingPersons', e.target.value)}
                />
              </>
            )}

            {currentRequestType === 'Hardware Issuance' && (
              <>
                <TextField
                  label="Hardware Item"
                  fullWidth
                  required
                  value={details.hardwareItem || details.hardwareId || ''}
                  onChange={(e) => handleDetailChange('hardwareItem', e.target.value)}
                  placeholder="Type the hardware item you need"
                />
                <TextField label="Quantity" type="number" fullWidth required slotProps={{ htmlInput: { min: 1 } }} value={details.quantity || ''} onChange={(e) => handleDetailChange('quantity', e.target.value)} />
              </>
            )}

            {currentRequestType === 'Hardware Replacement' && (
              <TextField label="Remarks" fullWidth required multiline rows={3} value={details.remarks || ''} onChange={(e) => handleDetailChange('remarks', e.target.value)} />
            )}

            {/* General Description */}
            {currentRequestType !== 'Hardware Replacement' && (
              <TextField
                label="General Description (Optional)"
                fullWidth
                multiline
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}

            {/* Status - only shown when editing, using configured stages */}
            {editingRequest && (
              <>
                <FormControl fullWidth required>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={status}
                    label="Status"
                    onChange={(e) => setStatus(e.target.value)}
                    MenuProps={{ disablePortal: true }}
                    disabled={!isSuperuser && (!editingRequest?.currentAssignedUsers || !editingRequest.currentAssignedUsers.includes(username))}
                  >
                    {configuredStages.length > 0 ? (
                      configuredStages.map((stage) => (
                        <MenuItem key={stage} value={stage}>{stage}</MenuItem>
                      ))
                    ) : (
                      <>
                        <MenuItem value="Pending">Pending</MenuItem>
                        <MenuItem value="In Progress">In Progress</MenuItem>
                      </>
                    )}
                    <MenuItem value="Completed">Completed</MenuItem>
                    <MenuItem value="Rejected">Rejected</MenuItem>
                  </Select>
                </FormControl>

                {status === 'Completed' && currentRequestType === 'VM Creation' && (
                  <>
                    <FormControl fullWidth required sx={{ mt: 1 }}>
                      <InputLabel>Cluster</InputLabel>
                      <Select
                        value={details.cluster || ''}
                        label="Cluster"
                        onChange={(e) => handleDetailChange('cluster', e.target.value)}
                        MenuProps={{ disablePortal: true }}
                      >
                        {clustersList.map((c: any) => (
                          <MenuItem key={c.id || c._id} value={c.clusterName}>
                            {c.clusterName}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth required sx={{ mt: 1 }}>
                      <InputLabel>Node (Physical Host)</InputLabel>
                      <Select
                        value={details.node || ''}
                        label="Node (Physical Host)"
                        onChange={(e) => handleDetailChange('node', e.target.value)}
                        MenuProps={{ disablePortal: true }}
                      >
                        {nodesList.map((n: any) => (
                          <MenuItem key={n.id || n._id} value={n.node}>
                            {n.node}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <TextField
                      label="IP Address"
                      fullWidth
                      required
                      value={details.ip || ''}
                      onChange={(e) => {
                        const newIp = e.target.value;
                        handleDetailChange('ip', newIp);
                        if (currentRequestType === 'VM Creation') {
                          const purpStr = (purpose || '').trim().replace(/\s+/g, '');
                          const osStr = (details.osVersion || '').trim().replace(/\s+/g, '');
                          let ipPortion = '';
                          if (newIp) {
                            const parts = newIp.trim().split('.');
                            if (parts.length >= 2) {
                              ipPortion = parts.slice(-2).join('.');
                            } else {
                              ipPortion = newIp.trim();
                            }
                          }
                          const nameParts = [purpStr, osStr, ipPortion].filter(Boolean);
                          if (nameParts.length > 0) {
                            handleDetailChange('vmName', nameParts.join('_'));
                          }
                        }
                      }}
                      placeholder="e.g. 192.168.1.10"
                      sx={{ mt: 1 }}
                    />

                    <TextField
                      label="Backup Name"
                      fullWidth
                      required
                      value={details.backupName || ''}
                      onChange={(e) => handleDetailChange('backupName', e.target.value)}
                      placeholder="e.g. Daily Backup"
                      sx={{ mt: 1 }}
                    />
                    <FormControl fullWidth required sx={{ mt: 1 }}>
                      <InputLabel>Backup Node</InputLabel>
                      <Select
                        value={details.backupNode || ''}
                        label="Backup Node"
                        onChange={(e) => handleDetailChange('backupNode', e.target.value)}
                        MenuProps={{ disablePortal: true }}
                      >
                        {nodesList.map((n: any) => (
                          <MenuItem key={n.id || n._id} value={n.node}>
                            {n.node}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl fullWidth required sx={{ mt: 1 }}>
                      <InputLabel>Backup Storage</InputLabel>
                      <Select
                        value={details.backupStorage || ''}
                        label="Backup Storage"
                        onChange={(e) => handleDetailChange('backupStorage', e.target.value)}
                        MenuProps={{ disablePortal: true }}
                      >
                        {nodesList.filter((n: any) => n.type === 'storage' || n.isStorage).map((n: any) => (
                          <MenuItem key={n.id || n._id} value={n.node}>
                            {n.node}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl fullWidth required sx={{ mt: 1 }}>
                      <InputLabel>Datastore</InputLabel>
                      <Select
                        value={details.datastore || ''}
                        label="Datastore"
                        onChange={(e) => handleDetailChange('datastore', e.target.value)}
                        MenuProps={{ disablePortal: true }}
                      >
                      </Select>
                    </FormControl>
                    
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={!!details.addedToMonitoring}
                          onChange={(e) => handleDetailChange('addedToMonitoring', e.target.checked)}
                          color="primary"
                        />
                      }
                      label="VM added to monitoring confirmation"
                      sx={{ mt: 0.5, color: '#374151' }}
                    />
                  </>
                )}

                <TextField
                  label="Remarks"
                  fullWidth
                  multiline
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal} variant="text" color="inherit">
            Cancel
          </Button>
          <Button type="submit" variant="contained" color="primary" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default RequestFormModal;
