import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, TextField, MenuItem, FormControl, InputLabel, Select,
  IconButton, Typography, Divider, ListSubheader
} from '@mui/material';
import { MdAdd as AddIcon, MdDelete as DeleteIcon } from 'react-icons/md';
import Button from '../../../components/Button';
import type { RequestRoutingData, RequestRoutingStage } from './model';
import type { RootState, AppDispatch } from '../../../store';
import { fetchRoles } from '../../Roles/action';
import { fetchDepartments } from '../../Departments/action';
import request from '../../../services/request';


// Special assignment types
const SPECIAL_ASSIGNEES = [
  { value: 'Requester', label: 'Requester', type: 'special' },
  { value: 'RequesterDeptHead', label: 'Department Head of Requester', type: 'special' },
];

interface RequestRoutingModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  editingItem: RequestRoutingData | null;
}

const RequestRoutingModal: React.FC<RequestRoutingModalProps> = ({
  open,
  onClose,
  onSubmit,
  editingItem,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { roles } = useSelector((state: RootState) => state.roles);
  const { departments } = useSelector((state: RootState) => state.departments);

  const [requestTypes, setRequestTypes] = useState<string[]>([
    'VM Creation',
    'DC Entry',
    'Hardware Issuance',
    'Hardware Replacement'
  ]);
  const [requestType, setRequestType] = useState('');
  const [stages, setStages] = useState<RequestRoutingStage[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchRequestTypes = useCallback(async () => {
    try {
      const res = await request.get('/api/requests/types');
      if (res.data && Array.isArray(res.data)) {
        setRequestTypes(res.data.map((t: any) => t.name));
      }
    } catch (err) {
      console.error('Failed to fetch request types:', err);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchRequestTypes();
      dispatch(fetchRoles({ skip: 0, limit: 1000, sortBy: 'name', order: 'asc', search: '', pagination: false }));
      dispatch(fetchDepartments({ skip: 0, limit: 1000 }));
    }
  }, [open, fetchRequestTypes, dispatch]);

  useEffect(() => {
    if (editingItem) {
      setRequestType(editingItem.requestType);
      setStages(editingItem.stages || []);
    } else {
      setRequestType(requestTypes[0] || '');
      setStages([]);
    }
  }, [editingItem, open, requestTypes]);

  const addStage = () => {
    setStages([...stages, { stageName: '', order: stages.length + 1, assignmentType: 'Role', assignedTo: '' }]);
  };

  const removeStage = (index: number) => {
    const updated = stages.filter((_, i) => i !== index);
    setStages(updated.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const updateStage = (index: number, field: keyof RequestRoutingStage, value: any) => {
    const updated = [...stages];
    updated[index] = { ...updated[index], [field]: value };
    setStages(updated);
  };

  const handleAssigneeChange = (index: number, value: string) => {
    const updated = [...stages];
    // Check if it's a special assignment type
    const isSpecial = SPECIAL_ASSIGNEES.some(s => s.value === value);
    const isDeptStaffs = value.startsWith('DeptStaffs:');
    const isRole = value.startsWith('Role:');

    if (isSpecial) {
      updated[index] = { ...updated[index], assignmentType: value, assignedTo: '' };
    } else if (isDeptStaffs) {
      const deptName = value.replace('DeptStaffs:', '');
      updated[index] = { ...updated[index], assignmentType: 'DeptStaffs', assignedTo: deptName };
    } else if (isRole) {
      const roleName = value.replace('Role:', '');
      updated[index] = { ...updated[index], assignmentType: 'Role', assignedTo: roleName };
    } else {
      // Specific user
      updated[index] = { ...updated[index], assignmentType: 'SpecificUser', assignedTo: value };
    }
    setStages(updated);
  };

  // Get the current combined value for the assignee select
  const getAssigneeValue = (stage: RequestRoutingStage) => {
    if (stage.assignmentType === 'Requester') return 'Requester';
    if (stage.assignmentType === 'RequesterDeptHead') return 'RequesterDeptHead';
    if (stage.assignmentType === 'DeptStaffs' && stage.assignedTo) return `DeptStaffs:${stage.assignedTo}`;
    if (stage.assignmentType === 'Role' && stage.assignedTo) return `Role:${stage.assignedTo}`;
    // Legacy support
    if (stage.assignmentType === 'TargetApproverDeptStaffs') return 'RequesterDeptHead'; // fallback
    return stage.assignedTo || '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: any = {
        requestType,
        stages: stages.map((s, i) => ({ ...s, order: i + 1 })),
      };
      if (editingItem) {
        payload.id = editingItem.id || editingItem._id;
      }
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ color: '#333' }}>{editingItem ? 'Edit Request Routing' : 'Create Request Routing'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Request Type</InputLabel>
              <Select
                value={requestType}
                label="Request Type"
                onChange={(e) => setRequestType(e.target.value)}
                disabled={!!editingItem}
              >
                {requestTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Statuses / Stages
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={addStage}
                type="button"
              >
                Add Status
              </Button>
            </Box>

            {stages.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                No statuses added yet. Click "Add Status" to define the workflow stages.
              </Typography>
            )}

            {stages.map((stage, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  gap: 2,
                  alignItems: 'center',
                  p: 1.5,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'action.hover',
                }}
              >
                <Typography
                  variant="body2"
                  fontWeight={700}
                  sx={{ minWidth: 28, textAlign: 'center', color: 'primary.main' }}
                >
                  {index + 1}
                </Typography>

                <TextField
                  label="Status Name"
                  size="small"
                  required
                  value={stage.stageName}
                  onChange={(e) => updateStage(index, 'stageName', e.target.value)}
                  sx={{ flex: 1 }}
                />

                <FormControl size="small" sx={{ minWidth: 260 }}>
                  <InputLabel>Assignee</InputLabel>
                  <Select
                    value={getAssigneeValue(stage)}
                    label="Assignee"
                    onChange={(e) => handleAssigneeChange(index, e.target.value as string)}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>

                    {/* Special assignment types */}
                    <ListSubheader sx={{ fontWeight: 700, color: 'primary.main', backgroundColor: 'background.paper' }}>
                      Auto Assignment
                    </ListSubheader>
                    {SPECIAL_ASSIGNEES.map((sa) => (
                      <MenuItem key={sa.value} value={sa.value} sx={{ pl: 3 }}>
                        🔄 {sa.label}
                      </MenuItem>
                    ))}

                    {/* Department Staffs */}
                    <ListSubheader sx={{ fontWeight: 700, color: 'secondary.main', backgroundColor: 'background.paper' }}>
                      Department - Staffs
                    </ListSubheader>
                    {departments.map((dept: any) => (
                      <MenuItem key={`dept-${dept.id || dept._id}`} value={`DeptStaffs:${dept.name}`} sx={{ pl: 3 }}>
                        👥 {dept.name} - Staffs
                      </MenuItem>
                    ))}

                    {/* Specific roles */}
                    <ListSubheader sx={{ fontWeight: 700, color: 'info.main', backgroundColor: 'background.paper' }}>
                      Specific Role
                    </ListSubheader>
                    {roles.map((role: any) => (
                      <MenuItem key={role.id || role._id} value={`Role:${role.name}`} sx={{ pl: 3 }}>
                        ⚙️ {role.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <IconButton
                  size="small"
                  color="error"
                  onClick={() => removeStage(index)}
                  type="button"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} variant="text" color="inherit">
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

export default RequestRoutingModal;
