// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, TextField, MenuItem, FormControl, InputLabel, Select,
  IconButton, Typography, Divider, ListSubheader
} from '@mui/material';
import { MdAdd as AddIcon, MdDelete as DeleteIcon, MdArrowUpward, MdArrowDownward } from 'react-icons/md';
import Button from '../../../components/Button';
import type { RequestRoutingData, RequestRoutingStage } from './model';
import type { RootState, AppDispatch } from '../../../store';
import { fetchRoles } from '../../Roles/action';
import { fetchDepartments } from '../../Departments/action';
import { fetchUsers } from '../../Users/action';
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
  const { data: users } = useSelector((state: RootState) => state.users);

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
      dispatch(fetchUsers({ skip: 0, limit: 1000, pagination: false }));
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

  const moveStageUp = (index: number) => {
    if (index === 0) return;
    const updated = [...stages];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setStages(updated.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const moveStageDown = (index: number) => {
    if (index === stages.length - 1) return;
    const updated = [...stages];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setStages(updated.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const updateStage = (index: number, field: keyof RequestRoutingStage, value: any) => {
    const updated = [...stages];
    updated[index] = { ...updated[index], [field]: value };
    setStages(updated);
  };

  const handleAssigneeChange = (index: number, values: string[] | string) => {
    const updated = [...stages];
    const vals = Array.isArray(values) ? values : [values];
    
    // If it is just one Special assignment, we can keep it as is, or just always map to Mixed.
    // Wait, let's always map to Mixed if it's an array for simplicity and flexibility.
    updated[index] = { ...updated[index], assignmentType: 'Mixed', assignedTo: vals as any };
    setStages(updated);
  };

  // Get the current combined value for the assignee select
  const getAssigneeValue = (stage: RequestRoutingStage): string[] => {
    if (stage.assignmentType === 'Mixed' && Array.isArray(stage.assignedTo)) {
      return stage.assignedTo;
    }
    const val = stage.assignedTo || '';
    if (stage.assignmentType === 'Requester') return ['Requester'];
    if (stage.assignmentType === 'RequesterDeptHead') return ['RequesterDeptHead'];
    if (stage.assignmentType === 'DeptStaffs' && val) return [`DeptStaffs:${val}`];
    if (stage.assignmentType === 'Role' && val) return [`Role:${val}`];
    if (stage.assignmentType === 'SpecificUser' && val) return [`SpecificUser:${val}`];
    if (stage.assignmentType === 'TargetApproverDeptStaffs') return ['RequesterDeptHead']; // fallback
    return [];
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
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <IconButton size="small" disabled={index === 0} onClick={() => moveStageUp(index)} type="button" sx={{ padding: '2px' }}>
                    <MdArrowUpward fontSize="small" />
                  </IconButton>
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    sx={{ textAlign: 'center', color: 'primary.main', my: 0.5 }}
                  >
                    {index + 1}
                  </Typography>
                  <IconButton size="small" disabled={index === stages.length - 1} onClick={() => moveStageDown(index)} type="button" sx={{ padding: '2px' }}>
                    <MdArrowDownward fontSize="small" />
                  </IconButton>
                </Box>

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
                    multiple
                    value={getAssigneeValue(stage)}
                    label="Assignee"
                    onChange={(e) => handleAssigneeChange(index, e.target.value as string[])}
                    renderValue={(selected) => (selected as string[]).join(', ')}
                  >

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

                    {/* Specific Users */}
                    <ListSubheader sx={{ fontWeight: 700, color: 'success.main', backgroundColor: 'background.paper' }}>
                      Specific Users
                    </ListSubheader>
                    {users && users.map((user: any) => (
                      <MenuItem key={user.id || user._id} value={`SpecificUser:${user.username}`} sx={{ pl: 3 }}>
                        👤 {user.firstName} {user.lastName} ({user.username})
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
