import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, TextField, MenuItem, FormControl, InputLabel, Select } from '@mui/material';
import Button from '../../components/Button';
import type { RequestData } from './model';
import type { RootState, AppDispatch } from '../../store';
import { fetchInventory } from '../Inventory/action';
import { fetchStagesForType } from './action';
import { useToast } from '../../contexts/ToastContext';

interface RequestFormModalProps {
  isModalOpen: boolean;
  handleCloseModal: () => void;
  editingRequest: RequestData | null;
  onSubmit: (data: Partial<RequestData>) => Promise<void>;
  isSuperuser?: boolean;
}

const REQUEST_TYPES = [
  'VM Creation',
  'DC Entry',
  'Hardware Issuance',
  'Hardware Replacement'
];

const RequestFormModal: React.FC<RequestFormModalProps> = ({
  isModalOpen,
  handleCloseModal,
  editingRequest,
  onSubmit,
  isSuperuser
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { showToast } = useToast();
  const { inventory } = useSelector((state: RootState) => state.inventory);

  const [requestType, setRequestType] = useState(REQUEST_TYPES[0]);
  const [description, setDescription] = useState('');
  const [purpose, setPurpose] = useState('');
  const [status, setStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [details, setDetails] = useState<any>({});
  const [configuredStages, setConfiguredStages] = useState<string[]>([]);

  useEffect(() => {
    if (isModalOpen) {
      dispatch(fetchInventory({ pagination: false }));
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
      setRequestType(editingRequest.requestType || editingRequest.category || REQUEST_TYPES[0]);
      setDescription(editingRequest.description || '');
      setPurpose(editingRequest.purpose || '');
      setStatus(editingRequest.status || 'Pending');
      setRemarks(editingRequest.remarks || '');
      setDetails(editingRequest.details || {});
    } else {
      setRequestType(REQUEST_TYPES[0]);
      setDescription('');
      setPurpose('');
      setStatus('');
      setRemarks('');
      setDetails({});
    }
  }, [editingRequest, isModalOpen]);

  const handleDetailChange = (field: string, value: any) => {
    setDetails((prev: any) => ({ ...prev, [field]: value }));
  };

  const getMinDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingRequest && requestType === 'DC Entry' && details.dateTime) {
      const selected = new Date(details.dateTime);
      const now = new Date();
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
    <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
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
              >
                {REQUEST_TYPES.map(type => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>

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
            {requestType === 'VM Creation' && (
              <>
                <TextField label="OS and Version" fullWidth required value={details.osVersion || ''} onChange={(e) => handleDetailChange('osVersion', e.target.value)} />
                <TextField label="RAM" fullWidth required value={details.ram || ''} onChange={(e) => handleDetailChange('ram', e.target.value)} />
                <TextField label="HDD" fullWidth required value={details.hdd || ''} onChange={(e) => handleDetailChange('hdd', e.target.value)} />
                <TextField label="CPU" fullWidth required value={details.cpu || ''} onChange={(e) => handleDetailChange('cpu', e.target.value)} />
                <TextField label="IP (Optional)" fullWidth value={details.ip || ''} onChange={(e) => handleDetailChange('ip', e.target.value)} />
              </>
            )}

            {requestType === 'DC Entry' && (
              <>
                <TextField 
                  label="Date and Time" 
                  type="datetime-local" 
                  fullWidth 
                  required 
                  InputLabelProps={{ shrink: true }}
                  slotProps={{
                    inputLabel: {
                      shrink: true,
                    }
                  }}
                  inputProps={{
                    min: getMinDateTime()
                  }}
                  value={details.dateTime || ''} 
                  onChange={(e) => handleDetailChange('dateTime', e.target.value)} 
                />
              </>
            )}

            {requestType === 'Hardware Issuance' && (
              <>
                <FormControl fullWidth required>
                  <InputLabel>Hardware (from Inventory)</InputLabel>
                  <Select
                    value={details.hardwareId || ''}
                    label="Hardware (from Inventory)"
                    onChange={(e) => handleDetailChange('hardwareId', e.target.value)}
                  >
                    {inventory.map((item: any) => (
                      <MenuItem key={item.id || item._id} value={item.id || item._id}>
                        {item.itemName} (Available: {item.quantity})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField label="Quantity" type="number" fullWidth required InputProps={{ inputProps: { min: 1 } }} value={details.quantity || ''} onChange={(e) => handleDetailChange('quantity', e.target.value)} />
              </>
            )}

            {requestType === 'Hardware Replacement' && (
              <TextField label="Remarks" fullWidth required multiline rows={3} value={details.remarks || ''} onChange={(e) => handleDetailChange('remarks', e.target.value)} />
            )}

            {/* General Description */}
            {requestType !== 'Hardware Replacement' && (
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
