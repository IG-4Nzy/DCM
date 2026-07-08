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
    }
  }, [isModalOpen, dispatch]);

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
  }, [editingRequest, isModalOpen, requestTypes]);

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

    if (!editingRequest && currentRequestType === 'DC Entry' && details.dateTime) {
      const selected = new Date(details.dateTime);
      const now = getServerTime().toDate();
      // Use 1 minute buffer to account for minor system delays
      if (selected < new Date(now.getTime() - 60000)) {
        showToast('Please select a date and time in the present or future.', 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: Partial<RequestData> = {
        requestType,
        description,
        purpose,
        details
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
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="State the purpose of this request"
            />

            {/* Dynamic Fields based on Request Type */}
            {currentRequestType === 'VM Creation' && (
              <>
                {!editingRequest ? (
                  <>
                    <TextField label="VM Name" fullWidth required value={details.vmName || ''} onChange={(e) => handleDetailChange('vmName', e.target.value)} />
                    <TextField label="OS and Version" fullWidth required value={details.osVersion || ''} onChange={(e) => handleDetailChange('osVersion', e.target.value)} />
                    <TextField label="RAM" fullWidth required value={details.ram || ''} onChange={(e) => handleDetailChange('ram', e.target.value)} />
                    <TextField label="HDD" fullWidth required value={details.hdd || ''} onChange={(e) => handleDetailChange('hdd', e.target.value)} />
                    <TextField label="CPU" fullWidth required value={details.cpu || ''} onChange={(e) => handleDetailChange('cpu', e.target.value)} />
                    <TextField label="IP (Optional)" fullWidth value={details.ip || ''} onChange={(e) => handleDetailChange('ip', e.target.value)} />
                  </>
                ) : (
                  <>
                    <TextField label="VM Name" fullWidth disabled value={details.vmName || ''} />
                    <TextField label="OS and Version" fullWidth disabled value={details.osVersion || ''} />
                    <TextField label="RAM" fullWidth disabled value={details.ram || ''} />
                    <TextField label="HDD" fullWidth disabled value={details.hdd || ''} />
                    <TextField label="CPU" fullWidth disabled value={details.cpu || ''} />
                  </>
                )}
              </>
            )}

            {currentRequestType === 'DC Entry' && (
              <>
                <TextField 
                  label="Date and Time" 
                  type="datetime-local" 
                  fullWidth 
                  required 
                  slotProps={{ inputLabel: { shrink: true } }}
                  slotProps={{
                    inputLabel: {
                      shrink: true,
                    }
                  }}
                  slotProps={{ htmlInput: {
                    min: getMinDateTime()
                  } }}
                  value={details.dateTime || ''} 
                  onChange={(e) => handleDetailChange('dateTime', e.target.value)} 
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
                      onChange={(e) => handleDetailChange('ip', e.target.value)}
                      placeholder="e.g. 192.168.1.10"
                      sx={{ mt: 1 }}
                    />

                    <TextField
                      label="VM Backup Path"
                      fullWidth
                      required
                      value={details.backupLocation || ''}
                      onChange={(e) => handleDetailChange('backupLocation', e.target.value)}
                      placeholder="e.g. /backups/vms/my-vm"
                      sx={{ mt: 1 }}
                    />
                    
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
