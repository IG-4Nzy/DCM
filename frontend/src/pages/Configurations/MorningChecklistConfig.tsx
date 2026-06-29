// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Button as MuiButton, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select,
  FormControl, InputLabel, FormControlLabel, Switch, Chip
} from '@mui/material';
import { MdAdd as AddIcon, MdDelete as DeleteIcon, MdEdit as EditIcon, MdRemove as RemoveIcon } from 'react-icons/md';
import SearchBar from '../../components/SearchBar';
import Table, { type Column } from '../../components/Table';
import Button from '../../components/Button';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useSelector } from 'react-redux';
import { type RootState } from '../../store';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';
import {
  fetchMorningChecklistConfig,
  createMorningChecklistConfigField,
  updateMorningChecklistConfigField,
  deleteMorningChecklistConfigField,
} from '../DailyActivities/MorningChecklist/action';

interface ConfigField {
  id: string;
  label: string;
  inputType: string;
  options: string[];
  showRemarks: boolean;
  slNumber: number;
  createdAt?: string;
  updatedAt?: string;
}

const INPUT_TYPES = [
  { value: 'checkbox', label: 'Checkbox (Multiple)' },
  { value: 'dropdown', label: 'Dropdown (Single Select)' },
  { value: 'text', label: 'Text Input' },
];

const MorningChecklistConfig: React.FC = () => {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { isSuperuser } = useSelector((state: RootState) => state.auth);

  const canView = isSuperuser || hasPrivilege(PRIVILEGES.CONFIGURATION_VIEW) || hasPrivilege(PRIVILEGES.MORNING_CHECKLIST_FIELD_EDIT);
  const canEdit = isSuperuser || hasPrivilege(PRIVILEGES.MORNING_CHECKLIST_FIELD_EDIT);

  const [fields, setFields] = useState<ConfigField[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<ConfigField | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formInputType, setFormInputType] = useState('text');
  const [formOptions, setFormOptions] = useState<string[]>([]);
  const [formShowRemarks, setFormShowRemarks] = useState(false);

  const loadFields = async () => {
    setLoading(true);
    try {
      const res = await fetchMorningChecklistConfig({ pagination: false });
      setFields(res.data || []);
    } catch {
      showToast('Failed to load config fields', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) loadFields();
  }, []);

  const filteredFields = useMemo(() => {
    if (!searchQuery) return fields;
    const q = searchQuery.toLowerCase();
    return fields.filter((f) =>
      f.label.toLowerCase().includes(q) || f.inputType.toLowerCase().includes(q)
    );
  }, [fields, searchQuery]);

  const openCreateModal = () => {
    setEditingField(null);
    setFormLabel('');
    setFormInputType('text');
    setFormOptions([]);
    setFormShowRemarks(false);
    setIsModalOpen(true);
  };

  const openEditModal = (field: ConfigField) => {
    setEditingField(field);
    setFormLabel(field.label);
    setFormInputType(field.inputType);
    setFormOptions([...(field.options || [])]);
    setFormShowRemarks(field.showRemarks);
    setIsModalOpen(true);
  };

  const handleAddOption = () => {
    setFormOptions([...formOptions, '']);
  };

  const handleRemoveOption = (idx: number) => {
    setFormOptions(formOptions.filter((_, i) => i !== idx));
  };

  const handleOptionChange = (idx: number, val: string) => {
    const updated = [...formOptions];
    updated[idx] = val;
    setFormOptions(updated);
  };

  const handleSubmit = async () => {
    if (!formLabel.trim()) {
      showToast('Label is required', 'error');
      return;
    }
    if ((formInputType === 'checkbox' || formInputType === 'dropdown') && formOptions.filter(o => o.trim()).length === 0) {
      showToast('At least one option is required for checkbox/dropdown type', 'error');
      return;
    }

    const payload: any = {
      label: formLabel.trim(),
      inputType: formInputType,
      options: formOptions.filter(o => o.trim()),
      showRemarks: formShowRemarks,
    };

    try {
      if (editingField) {
        payload.slNumber = editingField.slNumber;
        await updateMorningChecklistConfigField(editingField.id, payload);
        showToast('Field updated successfully', 'success');
      } else {
        await createMorningChecklistConfigField(payload);
        showToast('Field created successfully', 'success');
      }
      setIsModalOpen(false);
      loadFields();
    } catch {
      showToast('Failed to save field', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm('Delete this field?', 'This will remove the field from the configuration template. Existing checklists will not be affected.');
    if (!ok) return;
    try {
      await deleteMorningChecklistConfigField(id);
      showToast('Field deleted', 'success');
      loadFields();
    } catch {
      showToast('Failed to delete field', 'error');
    }
  };

  if (!canView) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="textSecondary">Access Denied</Typography>
      </Box>
    );
  }

  const columns: Column[] = [
    { id: 'slNumber', label: '#', width: 60 },
    { id: 'label', label: 'Label', width: 250 },
    {
      id: 'inputType', label: 'Input Type', width: 160,
      render: (row: any) => {
        const t = INPUT_TYPES.find(t => t.value === row.inputType);
        return <Chip label={t?.label || row.inputType} size="small" variant="outlined" />;
      }
    },
    {
      id: 'options', label: 'Options', width: 250,
      render: (row: any) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {(row.options || []).map((o: string, i: number) => (
            <Chip key={i} label={o} size="small" sx={{ fontSize: '0.75rem' }} />
          ))}
          {(!row.options || row.options.length === 0) && <Typography variant="caption" color="textSecondary">-</Typography>}
        </Box>
      )
    },
    {
      id: 'showRemarks', label: 'Remarks', width: 100,
      render: (row: any) => (
        <Chip
          label={row.showRemarks ? 'Yes' : 'No'}
          size="small"
          color={row.showRemarks ? 'success' : 'default'}
        />
      )
    },
    ...(canEdit ? [{
      id: 'actions', label: 'Actions', width: 120,
      render: (row: any) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => openEditModal(row)}>
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }] : []),
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search fields..."
        />
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateModal}
          >
            Add Field
          </Button>
        )}
      </Box>

      <Table
        columns={columns}
        data={filteredFields}
        loading={loading}
        emptyMessage="No fields configured yet. Add your first Morning Checklist field."
        idKey="id"
      />

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#333' }}>
          {editingField ? 'Edit Field' : 'Add New Field'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="Label"
            fullWidth
            required
            value={formLabel}
            onChange={(e) => setFormLabel(e.target.value)}
            placeholder="e.g. UPS Status, AC Working"
          />
          <FormControl fullWidth>
            <InputLabel>Input Type</InputLabel>
            <Select
              value={formInputType}
              label="Input Type"
              onChange={(e) => {
                setFormInputType(e.target.value);
                if (e.target.value === 'text') setFormOptions([]);
              }}
            >
              {INPUT_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {(formInputType === 'checkbox' || formInputType === 'dropdown') && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Options
                </Typography>
                <MuiButton size="small" startIcon={<AddIcon />} onClick={handleAddOption}>
                  Add Option
                </MuiButton>
              </Box>
              {formOptions.map((opt, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={opt}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Option ${idx + 1} (e.g. Working, Not Working)`}
                  />
                  <IconButton size="small" color="error" onClick={() => handleRemoveOption(idx)}>
                    <RemoveIcon />
                  </IconButton>
                </Box>
              ))}
              {formOptions.length === 0 && (
                <Typography variant="caption" color="textSecondary">
                  Click "Add Option" to add values like "Working", "Not Working", etc.
                </Typography>
              )}
            </Box>
          )}

          <FormControlLabel
            control={
              <Switch
                checked={formShowRemarks}
                onChange={(e) => setFormShowRemarks(e.target.checked)}
              />
            }
            label="Show Remarks Field (optional remarks alongside the value)"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <MuiButton onClick={() => setIsModalOpen(false)}>Cancel</MuiButton>
          <MuiButton variant="contained" onClick={handleSubmit}>
            {editingField ? 'Update' : 'Create'}
          </MuiButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MorningChecklistConfig;
