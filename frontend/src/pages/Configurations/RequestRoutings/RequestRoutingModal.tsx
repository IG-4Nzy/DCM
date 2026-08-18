// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, MenuItem, FormControl, InputLabel, Select, IconButton, Typography, Divider, ListSubheader, Checkbox, ListItemText } from '@mui/material';
import TextField from '../../../components/TextField';
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

const SELECT_MENU_PROPS = {
  disableScrollLock: true,
  PaperProps: {
    sx: { maxHeight: 300 },
  },
};

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
  const roles = useSelector((state: RootState) => state.roles?.roles || []);
  const departments = useSelector((state: RootState) => state.departments?.departments || []);
  const users = useSelector((state: RootState) => state.users?.users || []);

  const [requestTypes, setRequestTypes] = useState<string[]>([
    'VM Creation',
    'DC Entry',
    'Hardware Issuance',
    'Hardware Replacement'
  ]);
  const [requestType, setRequestType] = useState('');
  const [stages, setStages] = useState<RequestRoutingStage[]>([]);
  const [stageErrors, setStageErrors] = useState<string[]>([]);
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
      setStageErrors((editingItem.stages || []).map(() => ''));
    } else {
      setRequestType(requestTypes[0] || 'VM Creation');
      setStages([]);
      setStageErrors([]);
    }
  }, [editingItem, open]);

  const addStage = () => {
    setStages([...stages, { stageName: '', order: stages.length + 1, assignmentType: 'Role', assignedTo: '' }]);
    setStageErrors([...stageErrors, '']);
  };

  const removeStage = (index: number) => {
    const updated = stages.filter((_, i) => i !== index);
    setStages(updated.map((s, i) => ({ ...s, order: i + 1 })));
    setStageErrors(stageErrors.filter((_, i) => i !== index));
  };

  const moveStageUp = (index: number) => {
    if (index === 0) return;
    const updated = [...stages];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setStages(updated.map((s, i) => ({ ...s, order: i + 1 })));

    const updatedErrs = [...stageErrors];
    const tempErr = updatedErrs[index];
    updatedErrs[index] = updatedErrs[index - 1];
    updatedErrs[index - 1] = tempErr;
    setStageErrors(updatedErrs);
  };

  const moveStageDown = (index: number) => {
    if (index === stages.length - 1) return;
    const updated = [...stages];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setStages(updated.map((s, i) => ({ ...s, order: i + 1 })));

    const updatedErrs = [...stageErrors];
    const tempErr = updatedErrs[index];
    updatedErrs[index] = updatedErrs[index + 1];
    updatedErrs[index + 1] = tempErr;
    setStageErrors(updatedErrs);
  };

  const updateStage = (index: number, field: keyof RequestRoutingStage, value: any) => {
    setStages((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setStageErrors((prev) => {
      const updated = [...prev];
      updated[index] = '';
      return updated;
    });
  };

  const updateStageFields = (index: number, fields: Partial<RequestRoutingStage>) => {
    setStages((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...fields };
      return updated;
    });
  };

  const handleAssigneeChange = (index: number, values: string[] | string) => {
    const vals = Array.isArray(values) ? values : (values ? [values] : []);
    setStages((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], assignmentType: 'Mixed', assignedTo: vals };
      return updated;
    });
  };

  const addConditionalAssignment = (stageIndex: number) => {
    setStages((prev) => {
      const updated = [...prev];
      const currentRules = updated[stageIndex]?.conditionalAssignments || [];
      updated[stageIndex] = {
        ...updated[stageIndex],
        conditionalAssignments: [
          ...currentRules,
          { conditionField: 'networkType', conditionValue: 'Intranet', assignmentType: 'Mixed', assignedTo: [] }
        ]
      };
      return updated;
    });
  };

  const removeConditionalAssignment = (stageIndex: number, ruleIndex: number) => {
    setStages((prev) => {
      const updated = [...prev];
      const currentRules = updated[stageIndex]?.conditionalAssignments || [];
      updated[stageIndex] = {
        ...updated[stageIndex],
        conditionalAssignments: currentRules.filter((_, i) => i !== ruleIndex)
      };
      return updated;
    });
  };

  const updateConditionalAssignment = (stageIndex: number, ruleIndex: number, field: string, value: any) => {
    setStages((prev) => {
      const updated = [...prev];
      const currentRules = [...(updated[stageIndex]?.conditionalAssignments || [])];
      currentRules[ruleIndex] = { ...currentRules[ruleIndex], [field]: value };
      updated[stageIndex] = {
        ...updated[stageIndex],
        conditionalAssignments: currentRules
      };
      return updated;
    });
  };

  const updateConditionalAssignmentFields = (stageIndex: number, ruleIndex: number, fields: Record<string, any>) => {
    setStages((prev) => {
      const updated = [...prev];
      const currentRules = [...(updated[stageIndex]?.conditionalAssignments || [])];
      currentRules[ruleIndex] = { ...currentRules[ruleIndex], ...fields };
      updated[stageIndex] = {
        ...updated[stageIndex],
        conditionalAssignments: currentRules
      };
      return updated;
    });
  };

  const getRuleAssigneeValue = (rule: any): string[] => {
    let items: string[] = [];
    if (Array.isArray(rule.assignedTo)) {
      items = rule.assignedTo;
    } else if (typeof rule.assignedTo === 'string' && rule.assignedTo) {
      items = [rule.assignedTo];
    } else {
      return [];
    }
    return items.map((item) => normalizeAssigneeValue(item, rule as any)).filter(Boolean);
  };

  const normalizeAssigneeValue = (val: string, stage: RequestRoutingStage): string => {
    if (!val) return '';
    if (val === 'Requester' || val === 'RequesterDeptHead') return val;
    if (val.startsWith('Role:') || val.startsWith('DeptStaffs:') || val.startsWith('SpecificUser:')) {
      return val;
    }
    if (roles && roles.some((r: any) => r.name === val)) return `Role:${val}`;
    if (departments && departments.some((d: any) => d.name === val)) return `DeptStaffs:${val}`;
    if (users && users.some((u: any) => u.username === val)) return `SpecificUser:${val}`;

    if (stage.assignmentType === 'Role') return `Role:${val}`;
    if (stage.assignmentType === 'DeptStaffs') return `DeptStaffs:${val}`;
    if (stage.assignmentType === 'SpecificUser') return `SpecificUser:${val}`;
    return val;
  };

  // Get the current combined value array for the assignee select
  const getAssigneeValue = (stage: RequestRoutingStage): string[] => {
    let items: string[] = [];
    if (Array.isArray(stage.assignedTo)) {
      items = stage.assignedTo;
    } else if (typeof stage.assignedTo === 'string' && stage.assignedTo) {
      items = [stage.assignedTo];
    } else if (stage.assignmentType === 'Requester') {
      return ['Requester'];
    } else if (stage.assignmentType === 'RequesterDeptHead') {
      return ['RequesterDeptHead'];
    } else {
      return [];
    }

    return items.map((item) => normalizeAssigneeValue(item, stage)).filter(Boolean);
  };

  const formatAssigneeLabel = (val: string): string => {
    if (val === 'Requester') return '🔄 Requester';
    if (val === 'RequesterDeptHead') return '🔄 Department Head of Requester';
    if (val.startsWith('Role:')) return `⚙️ ${val.replace('Role:', '')}`;
    if (val.startsWith('DeptStaffs:')) return `👥 ${val.replace('DeptStaffs:', '')} Staffs`;
    if (val.startsWith('SpecificUser:')) return `👤 ${val.replace('SpecificUser:', '')}`;
    return val;
  };

  const renderAssigneeSelectOptions = (stage: RequestRoutingStage) => {
    const selectedValues = getAssigneeValue(stage);
    return (
      [
        <ListSubheader key="hdr-auto" sx={{ fontWeight: 700, color: 'primary.main', backgroundColor: 'background.paper' }}>
          Auto Assignment
        </ListSubheader>,
        ...SPECIAL_ASSIGNEES.map((sa) => (
          <MenuItem key={sa.value} value={sa.value} sx={{ pl: 2 }}>
            <Checkbox size="small" checked={selectedValues.indexOf(sa.value) > -1} />
            <ListItemText primary={`🔄 ${sa.label}`} />
          </MenuItem>
        )),

        <ListSubheader key="hdr-dept" sx={{ fontWeight: 700, color: 'secondary.main', backgroundColor: 'background.paper' }}>
          Department - Staffs
        </ListSubheader>,
        ...departments.map((dept: any) => {
          const val = `DeptStaffs:${dept.name}`;
          return (
            <MenuItem key={`dept-${dept.id || dept._id}`} value={val} sx={{ pl: 2 }}>
              <Checkbox size="small" checked={selectedValues.indexOf(val) > -1} />
              <ListItemText primary={`👥 ${dept.name} - Staffs`} />
            </MenuItem>
          );
        }),

        <ListSubheader key="hdr-role" sx={{ fontWeight: 700, color: 'info.main', backgroundColor: 'background.paper' }}>
          Specific Role
        </ListSubheader>,
        ...roles.map((role: any) => {
          const val = `Role:${role.name}`;
          return (
            <MenuItem key={role.id || role._id} value={val} sx={{ pl: 2 }}>
              <Checkbox size="small" checked={selectedValues.indexOf(val) > -1} />
              <ListItemText primary={`⚙️ ${role.name}`} />
            </MenuItem>
          );
        }),

        <ListSubheader key="hdr-users" sx={{ fontWeight: 700, color: 'success.main', backgroundColor: 'background.paper' }}>
          Specific Users
        </ListSubheader>,
        ...(users || []).map((user: any) => {
          const val = `SpecificUser:${user.username}`;
          const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
          return (
            <MenuItem key={user.id || user._id} value={val} sx={{ pl: 2 }}>
              <Checkbox size="small" checked={selectedValues.indexOf(val) > -1} />
              <ListItemText primary={`👤 ${displayName} (${user.username})`} />
            </MenuItem>
          );
        })
      ]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let hasError = false;
    const newErrors = stages.map((stage) => {
      if (!stage.stageName) return "Status Name is required";
      if (!/^[a-zA-Z\s]+$/.test(stage.stageName)) return "Status Name must contain alphabets and spaces only";
      if (stage.stageName.length > 20) return "Status Name must be maximum 20 characters";
      return "";
    });

    setStageErrors(newErrors);
    if (newErrors.some(err => err !== "")) {
      return;
    }

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
                MenuProps={SELECT_MENU_PROPS}
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
                  flexDirection: 'column',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'action.hover',
                }}
              >
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', width: '100%' }}>
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
                    error={!!stageErrors[index]}
                    helperText={stageErrors[index]}
                  />

                  <FormControl size="small" sx={{ minWidth: 240 }}>
                    <InputLabel>Default Assignee</InputLabel>
                    <Select
                      multiple
                      value={getAssigneeValue(stage)}
                      label="Default Assignee"
                      onChange={(e) => handleAssigneeChange(index, e.target.value as string[])}
                      renderValue={(selected) => (selected as string[]).map(formatAssigneeLabel).join(', ')}
                      MenuProps={SELECT_MENU_PROPS}
                    >
                      {renderAssigneeSelectOptions(stage)}
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

                {/* Stage Execution Condition Section */}
                <Box sx={{ width: '100%', pt: 1, borderTop: '1px dashed #cfd8dc', display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="caption" fontWeight={700} color="secondary.main" sx={{ minWidth: 130 }}>
                    ⚡ Run Stage Only If:
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Condition Field</InputLabel>
                    <Select
                      value={stage.conditionField || ''}
                      label="Condition Field"
                      onChange={(e) => {
                        const newField = e.target.value;
                        let val = '';
                        if (newField === 'networkType') val = 'Internet';
                        else if (newField === 'firstInternetDeployment') val = 'true';
                        else if (newField === 'operationType') val = 'Migration';
                        else if (newField === 'requestType') val = 'VM Creation';

                        updateStageFields(index, {
                          conditionField: newField,
                          conditionValue: val,
                        });
                      }}
                      MenuProps={SELECT_MENU_PROPS}
                    >
                      <MenuItem value="">Always Run (No Condition)</MenuItem>
                      <MenuItem value="networkType">Network Type (networkType)</MenuItem>
                      <MenuItem value="firstInternetDeployment">First Internet Deployment (firstInternetDeployment)</MenuItem>
                      <MenuItem value="operationType">Operation Type (operationType)</MenuItem>
                      <MenuItem value="requestType">Request Type (requestType)</MenuItem>
                      <MenuItem value="purpose">Purpose (purpose)</MenuItem>
                    </Select>
                  </FormControl>

                  {stage.conditionField && (
                    <>
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Operator</InputLabel>
                        <Select
                          value={stage.conditionOperator || 'equals'}
                          label="Operator"
                          onChange={(e) => updateStage(index, 'conditionOperator', e.target.value)}
                          MenuProps={SELECT_MENU_PROPS}
                        >
                          <MenuItem value="equals">Equals (==)</MenuItem>
                          <MenuItem value="not_equals">Not Equals (!=)</MenuItem>
                        </Select>
                      </FormControl>
                      
                      {(() => {
                        const optionsMap: Record<string, { value: string; label: string }[]> = {
                          networkType: [
                            { value: 'Internet', label: 'Internet' },
                            { value: 'Intranet', label: 'Intranet' },
                          ],
                          firstInternetDeployment: [
                            { value: 'true', label: 'True (First Internet Deployment)' },
                            { value: 'false', label: 'False (Direct Intranet)' },
                          ],
                          operationType: [
                            { value: 'Migration', label: 'Migration' },
                            { value: 'Clone', label: 'Clone' },
                            { value: 'Snapshot', label: 'Snapshot' },
                            { value: 'Template', label: 'Template' },
                            { value: 'Backup', label: 'Backup' },
                            { value: 'Resource Upgrade', label: 'Resource Upgrade' },
                            { value: 'Delete VM', label: 'Delete VM' },
                            { value: 'Others', label: 'Others' },
                          ],
                          requestType: [
                            { value: 'VM Creation', label: 'VM Creation' },
                            { value: 'VM Management', label: 'VM Management' },
                            { value: 'DC Entry', label: 'DC Entry' },
                            { value: 'Hardware Issuance', label: 'Hardware Issuance' },
                            { value: 'Hardware Replacement', label: 'Hardware Replacement' },
                          ],
                        };

                        const fieldOptions = optionsMap[stage.conditionField];
                        if (fieldOptions) {
                          return (
                            <FormControl size="small" sx={{ minWidth: 180 }}>
                              <InputLabel>Expected Value</InputLabel>
                              <Select
                                value={stage.conditionValue || ''}
                                label="Expected Value"
                                onChange={(e) => updateStage(index, 'conditionValue', e.target.value)}
                                MenuProps={SELECT_MENU_PROPS}
                              >
                                {fieldOptions.map((opt) => (
                                  <MenuItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          );
                        } else {
                          return (
                            <TextField
                              label="Expected Value"
                              size="small"
                              placeholder="Enter expected value..."
                              value={stage.conditionValue || ''}
                              onChange={(e) => updateStage(index, 'conditionValue', e.target.value)}
                              sx={{ width: 180 }}
                            />
                          );
                        }
                      })()}
                    </>
                  )}
                </Box>

                {/* Conditional Status Assignment Section */}
                <Box sx={{ width: '100%', pt: 1, borderTop: '1px dashed #cfd8dc', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" fontWeight={700} color="primary.main">
                      🔀 Conditional Status Assignments (Override Assignee based on condition):
                    </Typography>
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => addConditionalAssignment(index)}
                      type="button"
                      sx={{ fontSize: '0.75rem', py: 0 }}
                    >
                      Add Rule
                    </Button>
                  </Box>

                  {(stage.conditionalAssignments || []).map((rule, ruleIdx) => (
                    <Box key={ruleIdx} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', backgroundColor: '#f8fafc', p: 1, borderRadius: 1, border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                      <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel>If Field</InputLabel>
                        <Select
                          value={rule.conditionField || ''}
                          label="If Field"
                          onChange={(e) => {
                            const newField = e.target.value;
                            let val = '';
                            if (newField === 'networkType') val = 'Internet';
                            else if (newField === 'firstInternetDeployment') val = 'true';
                            else if (newField === 'operationType') val = 'Migration';
                            else if (newField === 'requestType') val = 'VM Creation';

                            updateConditionalAssignmentFields(index, ruleIdx, {
                              conditionField: newField,
                              conditionValue: val,
                            });
                          }}
                          MenuProps={SELECT_MENU_PROPS}
                        >
                          <MenuItem value="networkType">Network Type (networkType)</MenuItem>
                          <MenuItem value="firstInternetDeployment">First Internet Deployment (firstInternetDeployment)</MenuItem>
                          <MenuItem value="operationType">Operation Type (operationType)</MenuItem>
                          <MenuItem value="requestType">Request Type (requestType)</MenuItem>
                          <MenuItem value="purpose">Purpose (purpose)</MenuItem>
                        </Select>
                      </FormControl>

                      {(() => {
                        const optionsMap: Record<string, { value: string; label: string }[]> = {
                          networkType: [
                            { value: 'Internet', label: 'Internet' },
                            { value: 'Intranet', label: 'Intranet' },
                          ],
                          firstInternetDeployment: [
                            { value: 'true', label: 'True (First Internet Deployment)' },
                            { value: 'false', label: 'False (Direct Intranet)' },
                          ],
                          operationType: [
                            { value: 'Migration', label: 'Migration' },
                            { value: 'Clone', label: 'Clone' },
                            { value: 'Snapshot', label: 'Snapshot' },
                            { value: 'Template', label: 'Template' },
                            { value: 'Backup', label: 'Backup' },
                            { value: 'Resource Upgrade', label: 'Resource Upgrade' },
                            { value: 'Delete VM', label: 'Delete VM' },
                            { value: 'Others', label: 'Others' },
                          ],
                          requestType: [
                            { value: 'VM Creation', label: 'VM Creation' },
                            { value: 'VM Management', label: 'VM Management' },
                            { value: 'DC Entry', label: 'DC Entry' },
                            { value: 'Hardware Issuance', label: 'Hardware Issuance' },
                            { value: 'Hardware Replacement', label: 'Hardware Replacement' },
                          ],
                        };

                        const fieldOptions = optionsMap[rule.conditionField];
                        if (fieldOptions) {
                          return (
                            <FormControl size="small" sx={{ minWidth: 160 }}>
                              <InputLabel>Equals Value</InputLabel>
                              <Select
                                value={rule.conditionValue || ''}
                                label="Equals Value"
                                onChange={(e) => updateConditionalAssignment(index, ruleIdx, 'conditionValue', e.target.value)}
                                MenuProps={SELECT_MENU_PROPS}
                              >
                                {fieldOptions.map((opt) => (
                                  <MenuItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          );
                        } else {
                          return (
                            <TextField
                              label="Equals Value"
                              size="small"
                              placeholder="Enter value..."
                              value={rule.conditionValue || ''}
                              onChange={(e) => updateConditionalAssignment(index, ruleIdx, 'conditionValue', e.target.value)}
                              sx={{ width: 160 }}
                            />
                          );
                        }
                      })()}

                      <FormControl size="small" sx={{ minWidth: 220, flex: 1 }}>
                        <InputLabel>Assign To</InputLabel>
                        <Select
                          multiple
                          value={getRuleAssigneeValue(rule)}
                          label="Assign To"
                          onChange={(e) => {
                            const vals = Array.isArray(e.target.value) ? e.target.value : [e.target.value];
                            updateConditionalAssignment(index, ruleIdx, 'assignedTo', vals);
                            updateConditionalAssignment(index, ruleIdx, 'assignmentType', 'Mixed');
                          }}
                          renderValue={(selected) => (selected as string[]).map(formatAssigneeLabel).join(', ')}
                          MenuProps={SELECT_MENU_PROPS}
                        >
                          {renderAssigneeSelectOptions(rule as any)}
                        </Select>
                      </FormControl>

                      <IconButton size="small" color="error" onClick={() => removeConditionalAssignment(index, ruleIdx)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
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
