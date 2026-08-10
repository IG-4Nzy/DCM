// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Button as MuiButton, IconButton, Tooltip, Checkbox,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select, FormControl, InputLabel
} from '@mui/material';
import { MdAdd as AddIcon, MdDelete as DeleteIcon, MdRemove as RemoveIcon, MdSave as SaveIcon, MdEdit as EditIcon } from 'react-icons/md';
import SearchBar from '../../components/SearchBar';
import Table, { type Column } from '../../components/Table';
import Button from '../../components/Button';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useSelector } from 'react-redux';
import { type RootState } from '../../store';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';
import { useTableState } from '../../hooks/useTableState';
import { jwtDecode } from 'jwt-decode';
import { flattenClusterConfig, unflattenClusterRows, DEFAULT_CLUSTER_CONFIG } from '../ClusterChecklist/config';
import type { ClusterFlatRow, Rule } from '../ClusterChecklist/config';
import { fetchClusterChecklistConfig, saveClusterChecklistConfig } from '../ClusterChecklist/action';

type Order = 'asc' | 'desc';

type ParameterUnitDraft = {
  parameter: string;
  unit: string;
  ruleOperator: string;
  ruleValue: string;
  maxValue: string;
  warningOperator: string;
  warningValue: string;
  warningLabel: string;
  rules?: Rule[];
};

const EMPTY_FIELD: ClusterFlatRow = {
  category: '',
  device: '',
  parameter: '',
  value: '',
  bmsReading: '',
  unit: '',
  remarks: '',
};

const EMPTY_PARAMETER_UNIT: ParameterUnitDraft = {
  parameter: '',
  unit: '',
  ruleOperator: '',
  ruleValue: '',
  maxValue: '',
  warningOperator: '',
  warningValue: '',
  warningLabel: '',
  rules: [],
};

const ClusterChecklistConfig = () => {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { isSuperuser, token } = useSelector((state: RootState) => state.auth);

  const userDepartment = useMemo(() => {
    if (!token) return 'General';
    try {
      const decoded: any = jwtDecode(token);
      return decoded.department || 'General';
    } catch {
      return 'General';
    }
  }, [token]);

  const canView = isSuperuser || hasPrivilege(PRIVILEGES.CONFIGURATION_VIEW) || hasPrivilege(PRIVILEGES.CLUSTER_CHECKLIST_FIELD_EDIT);
  const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.CLUSTER_CHECKLIST_FIELD_EDIT);
  const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.CLUSTER_CHECKLIST_FIELD_EDIT);
  const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.CLUSTER_CHECKLIST_FIELD_EDIT);

  if (!canView) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="textSecondary">
          Access Denied
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          You do not have the required configurations view privilege.
        </Typography>
      </Box>
    );
  }

  const [rows, setRows] = useState<ClusterFlatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Edit parameter rule state
  const [editingRow, setEditingRow] = useState<ClusterFlatRow | null>(null);
  const [editUnit, setEditUnit] = useState('');
  const [editRuleOperator, setEditRuleOperator] = useState('');
  const [editRuleValue, setEditRuleValue] = useState('');
  const [editMaxValue, setEditMaxValue] = useState('');
  const [editWarningOperator, setEditWarningOperator] = useState('');
  const [editWarningValue, setEditWarningValue] = useState('');
  const [editWarningLabel, setEditWarningLabel] = useState('');
  const [editRules, setEditRules] = useState<Rule[]>([]);

  const [newField, setNewField] = useState<ClusterFlatRow>(EMPTY_FIELD);
  const [newParameterUnits, setNewParameterUnits] = useState<ParameterUnitDraft[]>([{ ...EMPTY_PARAMETER_UNIT }]);

  const [searchQuery, setSearchQuery] = useTableState('clusterChecklistConfig_search', '');
  const [page, setPage] = useTableState('clusterChecklistConfig_page', 0);
  const [rowsPerPage, setRowsPerPage] = useTableState('clusterChecklistConfig_rowsPerPage', 10);
  const [order, setOrder] = useTableState<Order>('clusterChecklistConfig_order', 'asc');
  const [orderBy, setOrderBy] = useTableState<string>('clusterChecklistConfig_orderBy', 'category');

  const getRowKey = (row: ClusterFlatRow) => `${row.category}|${row.device}|${row.parameter}`;
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedRows(new Set());
  }, [searchQuery, page, rowsPerPage, userDepartment]);

  // Load existing template configuration
  const loadTemplateData = async () => {
    setLoading(true);
    try {
      const res = await fetchClusterChecklistConfig({ department: userDepartment });
      if (res && res.template && Object.keys(res.template).length > 0) {
        const flatRows = flattenClusterConfig(res.template);
        setRows(flatRows);
      } else {
        const flatRows = flattenClusterConfig(DEFAULT_CLUSTER_CONFIG);
        setRows(flatRows);
      }
    } catch (e) {
      showToast('Failed to load checklist template', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplateData();
  }, [userDepartment]);

  const handleOpenModal = () => {
    setNewField(EMPTY_FIELD);
    setNewParameterUnits([{ ...EMPTY_PARAMETER_UNIT }]);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleOpenEditModal = (row: ClusterFlatRow) => {
    setEditingRow(row);
    setEditUnit(row.unit || '');
    setEditMaxValue(row.maxValue !== undefined ? row.maxValue.toString() : '');
    
    let initialRules = row.rules ? [...row.rules] : [];
    if (initialRules.length === 0) {
      if (row.ruleOperator && row.ruleValue !== undefined && row.ruleValue !== '') {
        initialRules.push({
          type: 'fail',
          operator: row.ruleOperator,
          value: row.ruleValue,
        });
      }
      if (row.warningOperator && row.warningValue !== undefined && row.warningValue !== '') {
        initialRules.push({
          type: 'warning',
          operator: row.warningOperator,
          value: row.warningValue,
          label: row.warningLabel,
        });
      }
    }
    setEditRules(initialRules);
  };

  const handleCloseEditModal = () => {
    setEditingRow(null);
  };

  const saveTemplate = async (updatedRows: ClusterFlatRow[]) => {
    try {
      const nestedConfig = unflattenClusterRows(updatedRows);
      await saveClusterChecklistConfig({ department: userDepartment, template: nestedConfig });
      showToast('Cluster Checklist Template saved successfully!', 'success');
    } catch (e) {
      showToast('Failed to save configuration template', 'error');
    }
  };

  const handleSaveEditRow = async () => {
    if (!editingRow) return;

    const firstFail = editRules.find(ru => ru.type === 'fail');
    const firstWarning = editRules.find(ru => ru.type === 'warning');

    const updated = rows.map(r => {
      if (r.category === editingRow.category && r.device === editingRow.device && r.parameter === editingRow.parameter) {
        return {
          ...r,
          unit: editUnit.trim(),
          ruleOperator: firstFail?.operator || '',
          ruleValue: firstFail?.value !== undefined && firstFail.value !== '' ? firstFail.value : '',
          maxValue: editMaxValue.trim() !== '' ? editMaxValue.trim() : '',
          warningOperator: firstWarning?.operator || '',
          warningValue: firstWarning?.value !== undefined && firstWarning.value !== '' ? firstWarning.value : '',
          warningLabel: firstWarning?.label || '',
          rules: editRules,
        };
      }
      return r;
    });

    setRows(updated);
    showToast(`Parameter rule updated for ${editingRow.parameter}`, 'success');
    handleCloseEditModal();
    await saveTemplate(updated);
  };

  const addEditRule = () => {
    setEditRules(prev => [...prev, { type: 'fail', operator: '>', value: '', label: '' }]);
  };

  const updateEditRule = (index: number, field: keyof Rule, val: any) => {
    setEditRules(prev => prev.map((ru, idx) => idx === index ? { ...ru, [field]: val } : ru));
  };

  const removeEditRule = (index: number) => {
    setEditRules(prev => prev.filter((_, idx) => idx !== index));
  };

  const addFieldRule = (paramIdx: number) => {
    setNewParameterUnits(prev => prev.map((pu, idx) => {
      if (idx === paramIdx) {
        const rules = pu.rules ? [...pu.rules] : [];
        return {
          ...pu,
          rules: [...rules, { type: 'fail', operator: '>', value: '', label: '' }]
        };
      }
      return pu;
    }));
  };

  const updateFieldRule = (paramIdx: number, ruleIdx: number, field: keyof Rule, val: any) => {
    setNewParameterUnits(prev => prev.map((pu, idx) => {
      if (idx === paramIdx) {
        const rules = pu.rules ? pu.rules.map((ru, rIdx) => rIdx === ruleIdx ? { ...ru, [field]: val } : ru) : [];
        return { ...pu, rules };
      }
      return pu;
    }));
  };

  const removeFieldRule = (paramIdx: number, ruleIdx: number) => {
    setNewParameterUnits(prev => prev.map((pu, idx) => {
      if (idx === paramIdx) {
        const rules = pu.rules ? pu.rules.filter((_, rIdx) => rIdx !== ruleIdx) : [];
        return { ...pu, rules };
      }
      return pu;
    }));
  };

  const updateParameterUnit = (index: number, field: keyof ParameterUnitDraft, value: string) => {
    setNewParameterUnits(prev => prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const addParameterUnit = () => {
    setNewParameterUnits(prev => [...prev, { ...EMPTY_PARAMETER_UNIT }]);
  };

  const removeParameterUnit = (index: number) => {
    setNewParameterUnits(prev => prev.length === 1 ? prev : prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleAddField = async () => {
    const category = newField.category.trim() || 'General';
    const devicesRaw = newField.device.trim() || 'General';
    let parameters = newParameterUnits
      .map(item => ({
        parameter: item.parameter.trim(),
        unit: item.unit.trim(),
        ruleOperator: item.ruleOperator,
        ruleValue: item.ruleValue.trim(),
        maxValue: item.maxValue.trim(),
        warningOperator: item.warningOperator,
        warningValue: item.warningValue.trim(),
        warningLabel: item.warningLabel.trim(),
        rules: item.rules || [],
      }))
      .filter(item => item.parameter);

    if (!parameters.length) {
      parameters = [{
        parameter: '',
        unit: '',
        ruleOperator: '',
        ruleValue: '',
        maxValue: '',
        warningOperator: '',
        warningValue: '',
        warningLabel: '',
        rules: [],
      }];
    }

    const devices = devicesRaw.split(',').map(d => d.trim()).filter(Boolean);
    if (!devices.length) {
      showToast('At least one valid fields group must be specified!', 'warning');
      return;
    }

    // Uniqueness validation on added fields
    const paramNames = parameters.map(p => p.parameter.toLowerCase()).filter(Boolean);
    const duplicates = paramNames.filter((item, index) => paramNames.indexOf(item) !== index);
    if (duplicates.length > 0) {
      showToast(`Duplicate parameters are not allowed: ${Array.from(new Set(duplicates)).join(', ')}`, 'error');
      return;
    }

    // Check against existing rows for duplicates
    const alreadyExistErrors: string[] = [];
    devices.forEach(device => {
      const existingParams = rows
        .filter(r => r.category.toLowerCase() === category.toLowerCase() && r.device.toLowerCase() === device.toLowerCase())
        .map(r => r.parameter.toLowerCase());

      const alreadyExist = paramNames.filter(name => existingParams.includes(name));
      if (alreadyExist.length > 0) {
        alreadyExistErrors.push(`Fields Group "${device}": ${alreadyExist.join(', ')}`);
      }
    });

    if (alreadyExistErrors.length > 0) {
      showToast(`Parameters already exist under Category Name "${category}":\n${alreadyExistErrors.join('\n')}`, 'error');
      return;
    }

    const newRows: ClusterFlatRow[] = [];
    devices.forEach(device => {
      parameters.forEach(({ parameter, unit, ruleOperator, ruleValue, maxValue, warningOperator, warningValue, warningLabel, rules }) => {
        const firstFail = rules.find(r => r.type === 'fail');
        const firstWarning = rules.find(r => r.type === 'warning');
        newRows.push({
          category,
          device, // Fields group name
          parameter,
          value: '',
          bmsReading: '',
          unit,
          remarks: '',
          ruleOperator: firstFail?.operator || ruleOperator || '',
          ruleValue: firstFail?.value !== undefined && firstFail.value !== '' ? firstFail.value : (ruleValue !== '' ? ruleValue : ''),
          maxValue: maxValue !== '' ? maxValue : '',
          warningOperator: firstWarning?.operator || warningOperator || '',
          warningValue: firstWarning?.value !== undefined && firstWarning.value !== '' ? firstWarning.value : (warningValue !== '' ? warningValue : ''),
          warningLabel: firstWarning?.label || warningLabel || '',
          rules,
        });
      });
    });

    const updated = [...rows, ...newRows];
    setRows(updated);
    showToast('Field template configured', 'success');
    handleCloseModal();
    await saveTemplate(updated);
  };

  const handleDelete = async (row: ClusterFlatRow) => {
    const isConfirmed = await confirm(`Are you sure you want to delete parameter "${row.parameter}" from fields group "${row.device}"?`, 'Delete Template Parameter');
    if (isConfirmed) {
      const updated = rows.filter(r =>
        !(r.category === row.category && r.device === row.device && r.parameter === row.parameter)
      );
      setRows(updated);
      showToast('Parameter removed from template', 'success');
      await saveTemplate(updated);
    }
  };

  const handleGroupDelete = async () => {
    const isConfirmed = await confirm(`Are you sure you want to delete the ${selectedRows.size} selected parameter(s)?`, 'Group Delete Parameters');
    if (isConfirmed) {
      const updated = rows.filter(r => !selectedRows.has(getRowKey(r)));
      setRows(updated);
      setSelectedRows(new Set());
      showToast('Selected parameters removed from template', 'success');
      await saveTemplate(updated);
    }
  };

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const filteredRows = useMemo(() => {
    if (!searchQuery) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(r =>
      r.category.toLowerCase().includes(q) ||
      r.device.toLowerCase().includes(q) ||
      r.parameter.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      const aVal = (a[orderBy as keyof ClusterFlatRow] || '').toString().toLowerCase();
      const bVal = (b[orderBy as keyof ClusterFlatRow] || '').toString().toLowerCase();
      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredRows, orderBy, order]);

  const paginatedRows = useMemo(() => {
    const start = page * rowsPerPage;
    return sortedRows.slice(start, start + rowsPerPage);
  }, [sortedRows, page, rowsPerPage]);

  const isAllSelected = paginatedRows.length > 0 && paginatedRows.every(r => selectedRows.has(getRowKey(r)));
  const isSomeSelected = paginatedRows.some(r => selectedRows.has(getRowKey(r))) && !isAllSelected;

  const handleSelectAllChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = new Set(selectedRows);
    if (event.target.checked) {
      paginatedRows.forEach(r => next.add(getRowKey(r)));
    } else {
      paginatedRows.forEach(r => next.delete(getRowKey(r)));
    }
    setSelectedRows(next);
  };

  const handleRowSelectChange = (row: ClusterFlatRow, checked: boolean) => {
    const next = new Set(selectedRows);
    const key = getRowKey(row);
    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    setSelectedRows(next);
  };

  const getRuleDisplay = (row: ClusterFlatRow) => {
    const rulesList = row.rules || [];
    const rules: string[] = [];
    if (row.maxValue !== undefined && row.maxValue !== '') {
      rules.push(`Max: ${row.maxValue}`);
    }

    if (rulesList.length > 0) {
      rulesList.forEach(r => {
        if (r.type === 'fail') {
          rules.push(`Fail: ${r.operator} ${r.value}`);
        } else {
          rules.push(`Warn: ${r.operator} ${r.value}${r.label ? ` (${r.label})` : ''}`);
        }
      });
    } else {
      if (row.ruleOperator && row.ruleValue !== undefined && row.ruleValue !== '') {
        rules.push(`Fail: ${row.ruleOperator} ${row.ruleValue}`);
      }
      if (row.warningOperator && row.warningValue !== undefined && row.warningValue !== '') {
        rules.push(`Warn: ${row.warningOperator} ${row.warningValue}${row.warningLabel ? ` (${row.warningLabel})` : ''}`);
      }
    }
    return rules.length > 0 ? rules.join(' | ') : '-';
  };

  const columns: Column<ClusterFlatRow>[] = [];

  if (hasDelete) {
    columns.push({
      id: 'select',
      label: (
        <Checkbox
          indeterminate={isSomeSelected}
          checked={isAllSelected}
          onChange={handleSelectAllChange}
          size="small"
        />
      ),
      sortable: false,
      render: (row) => (
        <Checkbox
          checked={selectedRows.has(getRowKey(row))}
          onChange={(e) => handleRowSelectChange(row, e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          size="small"
        />
      )
    });
  }

  columns.push(
    { id: 'category', label: 'Category Name', sortable: true },
    { id: 'device', label: 'Fields Group', sortable: true },
    { id: 'parameter', label: 'Parameter', sortable: true },
    { id: 'unit', label: 'Default Unit', sortable: true, render: (row) => row.unit || '-' },
    { id: 'ruleOperator', label: 'Validation/Warning Rules', sortable: false, render: (row) => getRuleDisplay(row) }
  );

  if (hasUpdate || hasDelete) {
    columns.push({
      id: 'actions',
      label: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          {hasUpdate && (
            <Tooltip title="Configure Rule">
              <IconButton size="small" color="primary" sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }} onClick={(e) => { e.stopPropagation(); handleOpenEditModal(row); }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {hasDelete && (
            <Tooltip title="Delete Parameter">
              <IconButton size="small" color="error" sx={{ backgroundColor: 'rgba(211, 47, 47, 0.04)' }} onClick={(e) => { e.stopPropagation(); handleDelete(row); }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )
    });
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <SearchBar
            value={searchQuery}
            onChange={(v) => { setSearchQuery(v); setPage(0); }}
            placeholder="Search template fields..."
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {hasDelete && selectedRows.size > 0 && (
            <Button
              variant="contained"
              color="error"
              onClick={handleGroupDelete}
            >
              Delete Selected ({selectedRows.size})
            </Button>
          )}
          {hasCreate && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleOpenModal}
            >
              Add Template Field
            </Button>
          )}
        </Box>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, p: 0, boxShadow: 'none', background: 'transparent' }}>
        <Table
          columns={columns}
          data={paginatedRows}
          totalCount={sortedRows.length}
          page={page}
          rowsPerPage={rowsPerPage}
          orderBy={orderBy}
          order={order}
          onRequestSort={handleRequestSort}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Add Template Field Dialog */}
      <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', color: '#333' }}>Add Template Field</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Category Name"
              fullWidth
              placeholder="e.g. VMware Cluster"
              value={newField.category}
              onChange={(e) => setNewField(prev => ({ ...prev, category: e.target.value }))}
            />
            <TextField
              label="Fields Group(s)"
              fullWidth
              placeholder="e.g. VDI Cluster, Production Cluster"
              helperText="Enter multiple fields groups separated by commas to add them all at once"
              value={newField.device}
              onChange={(e) => setNewField(prev => ({ ...prev, device: e.target.value }))}
            />
          </Box>

          <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 2 }}>
            Parameters & Units
          </Typography>

          {newParameterUnits.map((paramUnit, idx) => (
            <Box key={idx} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', p: 1.5, border: '1px solid #f1f5f9', borderRadius: '8px', bgcolor: '#fbfcfd' }}>
              {/* Parameter Row */}
              <Box sx={{ display: 'flex', gap: 1.5, width: '100%', alignItems: 'center' }}>
                <TextField
                  label={`Parameter ${idx + 1}`}
                  placeholder="e.g. Host Nodes"
                  value={paramUnit.parameter}
                  onChange={(e) => updateParameterUnit(idx, 'parameter', e.target.value)}
                  sx={{ flex: 3 }}
                />
                <TextField
                  label="Unit"
                  placeholder="e.g. Nodes"
                  value={paramUnit.unit}
                  onChange={(e) => updateParameterUnit(idx, 'unit', e.target.value)}
                  sx={{ flex: 1.5 }}
                />
                <TextField
                  label="Max Value"
                  type="number"
                  placeholder="Max allowed"
                  value={paramUnit.maxValue}
                  onChange={(e) => updateParameterUnit(idx, 'maxValue', e.target.value)}
                  sx={{ flex: 1.2 }}
                />
                <IconButton
                  color="error"
                  disabled={newParameterUnits.length === 1}
                  onClick={() => removeParameterUnit(idx)}
                >
                  <RemoveIcon />
                </IconButton>
              </Box>

              {/* Dynamic Rules Section */}
              <Box sx={{ width: '100%', pl: 2, borderLeft: '3px solid #cbd5e1', mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569' }}>
                    Rules (Fail/Warning Conditions)
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => addFieldRule(idx)}
                    sx={{ py: 0.5, fontSize: '0.75rem', textTransform: 'none' }}
                  >
                    Add Rule
                  </Button>
                </Box>

                {(!paramUnit.rules || paramUnit.rules.length === 0) ? (
                  <Typography variant="caption" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                    No rules added yet. Parameter will only check for input values.
                  </Typography>
                ) : (
                  paramUnit.rules.map((rule, ruleIdx) => (
                    <Box key={ruleIdx} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', p: 1, border: '1px solid #e2e8f0', borderRadius: '6px', bgcolor: '#fff' }}>
                      <FormControl size="small" sx={{ width: 100 }}>
                        <InputLabel>Type</InputLabel>
                        <Select
                          value={rule.type}
                          label="Type"
                          onChange={(e) => updateFieldRule(idx, ruleIdx, 'type', e.target.value)}
                        >
                          <MenuItem value="fail">Fail</MenuItem>
                          <MenuItem value="warning">Warning</MenuItem>
                        </Select>
                      </FormControl>

                      <FormControl size="small" sx={{ width: 120 }}>
                        <InputLabel>Condition</InputLabel>
                        <Select
                          value={rule.operator}
                          label="Condition"
                          onChange={(e) => updateFieldRule(idx, ruleIdx, 'operator', e.target.value)}
                        >
                          <MenuItem value=">">Value &gt;</MenuItem>
                          <MenuItem value="<">Value &lt;</MenuItem>
                          <MenuItem value=">=">Value &gt;=</MenuItem>
                          <MenuItem value="<=">Value &lt;=</MenuItem>
                        </Select>
                      </FormControl>

                      <TextField
                        label="Value"
                        type="number"
                        size="small"
                        value={rule.value}
                        onChange={(e) => updateFieldRule(idx, ruleIdx, 'value', e.target.value)}
                        sx={{ width: 90 }}
                      />

                      {rule.type === 'warning' && (
                        <TextField
                          label="Warning Label"
                          size="small"
                          placeholder="e.g. Temperature high"
                          value={rule.label || ''}
                          onChange={(e) => updateFieldRule(idx, ruleIdx, 'label', e.target.value)}
                          sx={{ flex: 1 }}
                        />
                      )}

                      <IconButton
                        color="error"
                        onClick={() => removeFieldRule(idx, ruleIdx)}
                        size="small"
                      >
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))
                )}
              </Box>
            </Box>
          ))}

          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={addParameterUnit}
            sx={{ alignSelf: 'flex-start', mt: 1 }}
          >
            Add Parameter Group
          </Button>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <MuiButton onClick={handleCloseModal} sx={{ textTransform: 'none' }}>Cancel</MuiButton>
          <Button variant="contained" onClick={handleAddField}>Add to Template</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Single Parameter Rule Dialog */}
      <Dialog open={!!editingRow} onClose={handleCloseEditModal} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', color: '#333' }}>
          Configure Parameter: {editingRow?.parameter}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          <Typography variant="body2" color="textSecondary">
            Edit Default Unit and validation/warning rules under Category Name "{editingRow?.category}", Fields Group "{editingRow?.device}".
          </Typography>

          <TextField
            label="Unit"
            fullWidth
            placeholder="e.g. Nodes"
            value={editUnit}
            onChange={(e) => setEditUnit(e.target.value)}
          />

          <TextField
            label="Max Value (for validation)"
            type="number"
            fullWidth
            placeholder="e.g. 100"
            value={editMaxValue}
            onChange={(e) => setEditMaxValue(e.target.value)}
          />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#334155' }}>
              Validation & Warning Rules
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={addEditRule}
              sx={{ textTransform: 'none' }}
            >
              Add Rule
            </Button>
          </Box>

          {(!editRules || editRules.length === 0) ? (
            <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic', pl: 1 }}>
              No rules added yet. Parameter will only check for input values.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {editRules.map((rule, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', p: 1.5, border: '1px solid #e2e8f0', borderRadius: '6px', bgcolor: '#f8fafc' }}>
                  <FormControl size="small" sx={{ width: 100 }}>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={rule.type}
                      label="Type"
                      onChange={(e) => updateEditRule(idx, 'type', e.target.value)}
                    >
                      <MenuItem value="fail">Fail</MenuItem>
                      <MenuItem value="warning">Warning</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ width: 110 }}>
                    <InputLabel>Condition</InputLabel>
                    <Select
                      value={rule.operator}
                      label="Condition"
                      onChange={(e) => updateEditRule(idx, 'operator', e.target.value)}
                    >
                      <MenuItem value=">">Value &gt;</MenuItem>
                      <MenuItem value="<">Value &lt;</MenuItem>
                      <MenuItem value=">=">Value &gt;=</MenuItem>
                      <MenuItem value="<=">Value &lt;=</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    label="Value"
                    type="number"
                    size="small"
                    value={rule.value}
                    onChange={(e) => updateEditRule(idx, 'value', e.target.value)}
                    sx={{ width: 90 }}
                  />

                  {rule.type === 'warning' && (
                    <TextField
                      label="Label"
                      size="small"
                      placeholder="Warning Label"
                      value={rule.label || ''}
                      onChange={(e) => updateEditRule(idx, 'label', e.target.value)}
                      sx={{ flex: 1 }}
                    />
                  )}

                  <IconButton
                    color="error"
                    onClick={() => removeEditRule(idx)}
                    size="small"
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <MuiButton onClick={handleCloseEditModal} sx={{ textTransform: 'none' }}>Cancel</MuiButton>
          <Button variant="contained" onClick={handleSaveEditRow}>Save Changes</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClusterChecklistConfig;
