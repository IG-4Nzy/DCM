import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Button as MuiButton, IconButton, Tooltip,
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
import { flattenConfig, unflattenRows, getChecklistTemplate } from '../BMSChecklist/config';
import type { FlatRow } from '../BMSChecklist/config';

type Order = 'asc' | 'desc';

type ParameterUnitDraft = {
  parameter: string;
  unit: string;
  ruleOperator: string;
  ruleValue: string;
};

const EMPTY_FIELD: FlatRow = {
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
};

const BMSChecklistConfig = () => {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { isSuperuser } = useSelector((state: RootState) => state.auth);

  const canView = isSuperuser || hasPrivilege(PRIVILEGES.CONFIGURATION_VIEW) || hasPrivilege(PRIVILEGES.BMS_CHECKLIST_FIELD_EDIT);
  const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.BMS_CHECKLIST_FIELD_EDIT);
  const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.BMS_CHECKLIST_FIELD_EDIT);
  const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.BMS_CHECKLIST_FIELD_EDIT);

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

  const [rows, setRows] = useState<FlatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Edit parameter rule state
  const [editingRow, setEditingRow] = useState<FlatRow | null>(null);
  const [editUnit, setEditUnit] = useState('');
  const [editRuleOperator, setEditRuleOperator] = useState('');
  const [editRuleValue, setEditRuleValue] = useState('');

  const [newField, setNewField] = useState<FlatRow>(EMPTY_FIELD);
  const [newParameterUnits, setNewParameterUnits] = useState<ParameterUnitDraft[]>([{ ...EMPTY_PARAMETER_UNIT }]);

  const [searchQuery, setSearchQuery] = useTableState('bmsChecklistConfig_search', '');
  const [page, setPage] = useTableState('bmsChecklistConfig_page', 0);
  const [rowsPerPage, setRowsPerPage] = useTableState('bmsChecklistConfig_rowsPerPage', 10);
  const [order, setOrder] = useTableState<Order>('bmsChecklistConfig_order', 'asc');
  const [orderBy, setOrderBy] = useTableState<string>('bmsChecklistConfig_orderBy', 'category');

  // Load existing template configuration
  const loadTemplateData = () => {
    setLoading(true);
    try {
      const template = getChecklistTemplate();
      const flatRows = flattenConfig(template);
      setRows(flatRows);
    } catch (e) {
      showToast('Failed to load checklist template', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplateData();
  }, []);

  const handleOpenModal = () => {
    setNewField(EMPTY_FIELD);
    setNewParameterUnits([{ ...EMPTY_PARAMETER_UNIT }]);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleOpenEditModal = (row: FlatRow) => {
    setEditingRow(row);
    setEditUnit(row.unit || '');
    setEditRuleOperator(row.ruleOperator || '');
    setEditRuleValue(row.ruleValue !== undefined ? row.ruleValue.toString() : '');
  };

  const handleCloseEditModal = () => {
    setEditingRow(null);
  };

  const handleSaveEditRow = () => {
    if (!editingRow) return;

    setRows(prev => prev.map(r => {
      if (r.category === editingRow.category && r.device === editingRow.device && r.parameter === editingRow.parameter) {
        return {
          ...r,
          unit: editUnit.trim(),
          ruleOperator: editRuleOperator,
          ruleValue: editRuleValue.trim() !== '' ? editRuleValue.trim() : '',
        };
      }
      return r;
    }));

    showToast(`Parameter rule updated for ${editingRow.parameter}`, 'success');
    handleCloseEditModal();
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

  const handleAddField = () => {
    const category = newField.category.trim();
    const device = newField.device.trim();
    const parameters = newParameterUnits
      .map(item => ({
        parameter: item.parameter.trim(),
        unit: item.unit.trim(),
        ruleOperator: item.ruleOperator,
        ruleValue: item.ruleValue.trim(),
      }))
      .filter(item => item.parameter);

    if (!category || !device || !parameters.length) {
      showToast('Category, Device, and at least one Parameter must be filled!', 'warning');
      return;
    }

    // Uniqueness validation on added fields
    const paramNames = parameters.map(p => p.parameter.toLowerCase());
    const duplicates = paramNames.filter((item, index) => paramNames.indexOf(item) !== index);
    if (duplicates.length > 0) {
      showToast(`Duplicate parameters are not allowed: ${Array.from(new Set(duplicates)).join(', ')}`, 'error');
      return;
    }

    // Check against existing rows for duplicates
    const existingParams = rows
      .filter(r => r.category.toLowerCase() === category.toLowerCase() && r.device.toLowerCase() === device.toLowerCase())
      .map(r => r.parameter.toLowerCase());

    const alreadyExist = paramNames.filter(name => existingParams.includes(name));
    if (alreadyExist.length > 0) {
      showToast(`Parameters already exist under Category "${category}", Device "${device}": ${alreadyExist.join(', ')}`, 'error');
      return;
    }

    const newRows = parameters.map(({ parameter, unit, ruleOperator, ruleValue }): FlatRow => ({
      category,
      device,
      parameter,
      value: '',
      bmsReading: '',
      unit,
      remarks: '',
      ruleOperator,
      ruleValue: ruleValue !== '' ? ruleValue : '',
    }));

    setRows(prev => [...prev, ...newRows]);
    showToast('Field template configured', 'success');
    handleCloseModal();
  };

  const handleDelete = async (row: FlatRow) => {
    const isConfirmed = await confirm(`Are you sure you want to delete parameter "${row.parameter}" from device "${row.device}"?`, 'Delete Template Parameter');
    if (isConfirmed) {
      setRows(prev => prev.filter(r => 
        !(r.category === row.category && r.device === row.device && r.parameter === row.parameter)
      ));
      showToast('Parameter removed from template', 'success');
    }
  };

  const handleSaveConfig = () => {
    try {
      const nestedConfig = unflattenRows(rows);
      localStorage.setItem('bms_checklist_template', JSON.stringify(nestedConfig));
      showToast('BMS Checklist Template saved successfully!', 'success');
    } catch (e) {
      showToast('Failed to save configuration template', 'error');
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
      const aVal = (a[orderBy as keyof FlatRow] || '').toString().toLowerCase();
      const bVal = (b[orderBy as keyof FlatRow] || '').toString().toLowerCase();
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

  const getRuleDisplay = (row: FlatRow) => {
    if (!row.ruleOperator || row.ruleValue === undefined || row.ruleValue === '') {
      return '-';
    }
    return `Value cannot be ${row.ruleOperator} ${row.ruleValue}`;
  };

  const columns: Column<FlatRow>[] = [
    { id: 'category', label: 'Category', sortable: true },
    { id: 'device', label: 'Device', sortable: true },
    { id: 'parameter', label: 'Parameter', sortable: true },
    { id: 'unit', label: 'Default Unit', sortable: true, render: (row) => row.unit || '-' },
    { id: 'ruleOperator', label: 'Failure Rule Threshold', sortable: false, render: (row) => getRuleDisplay(row) }
  ];

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
          {hasUpdate && (
            <Button
              variant="outlined"
              color="success"
              startIcon={<SaveIcon />}
              onClick={handleSaveConfig}
            >
              Save Template Changes
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
        <DialogTitle sx={{ fontWeight: 'bold' }}>Add Template Field</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Category"
              fullWidth
              required
              placeholder="e.g. Server room PAC"
              value={newField.category}
              onChange={(e) => setNewField(prev => ({ ...prev, category: e.target.value }))}
            />
            <TextField
              label="Device"
              fullWidth
              required
              placeholder="e.g. PAC-1"
              value={newField.device}
              onChange={(e) => setNewField(prev => ({ ...prev, device: e.target.value }))}
            />
          </Box>

          <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 2 }}>
            Parameters, Units & Threshold Rules
          </Typography>

          {newParameterUnits.map((paramUnit, idx) => (
            <Box key={idx} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', p: 1.5, border: '1px solid #f1f5f9', borderRadius: '8px', bgcolor: '#fbfcfd' }}>
              <TextField
                label={`Parameter ${idx + 1}`}
                required
                placeholder="e.g. Temperature"
                value={paramUnit.parameter}
                onChange={(e) => updateParameterUnit(idx, 'parameter', e.target.value)}
                sx={{ flex: 2, minWidth: '150px' }}
              />
              <TextField
                label="Unit"
                placeholder="e.g. °C"
                value={paramUnit.unit}
                onChange={(e) => updateParameterUnit(idx, 'unit', e.target.value)}
                sx={{ flex: 1, minWidth: '80px' }}
              />
              
              <FormControl sx={{ flex: 1.5, minWidth: '110px' }}>
                <InputLabel>Rule Fail Condition</InputLabel>
                <Select
                  value={paramUnit.ruleOperator}
                  label="Rule Fail Condition"
                  onChange={(e) => updateParameterUnit(idx, 'ruleOperator', e.target.value)}
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value=">">Value &gt;</MenuItem>
                  <MenuItem value="<">Value &lt;</MenuItem>
                  <MenuItem value=">=">Value &gt;=</MenuItem>
                  <MenuItem value="<=">Value &lt;=</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Rule Value"
                type="number"
                placeholder="Value threshold"
                value={paramUnit.ruleValue}
                onChange={(e) => updateParameterUnit(idx, 'ruleValue', e.target.value)}
                disabled={!paramUnit.ruleOperator}
                sx={{ flex: 1.2, minWidth: '100px' }}
              />

              <IconButton
                color="error"
                disabled={newParameterUnits.length === 1}
                onClick={() => removeParameterUnit(idx)}
              >
                <RemoveIcon />
              </IconButton>
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
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Configure Parameter: {editingRow?.parameter}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          <Typography variant="body2" color="textSecondary">
            Edit Default Unit and trigger threshold rules under Category "{editingRow?.category}", Device "{editingRow?.device}".
          </Typography>

          <TextField
            label="Unit"
            fullWidth
            placeholder="e.g. °C"
            value={editUnit}
            onChange={(e) => setEditUnit(e.target.value)}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Rule Fail Condition</InputLabel>
              <Select
                value={editRuleOperator}
                label="Rule Fail Condition"
                onChange={(e) => setEditRuleOperator(e.target.value)}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value=">">Value &gt;</MenuItem>
                <MenuItem value="<">Value &lt;</MenuItem>
                <MenuItem value=">=">Value &gt;=</MenuItem>
                <MenuItem value="<=">Value &lt;=</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Threshold Value"
              type="number"
              fullWidth
              placeholder="e.g. 50"
              value={editRuleValue}
              onChange={(e) => setEditRuleValue(e.target.value)}
              disabled={!editRuleOperator}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <MuiButton onClick={handleCloseEditModal} sx={{ textTransform: 'none' }}>Cancel</MuiButton>
          <Button variant="contained" onClick={handleSaveEditRow}>Save Changes</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BMSChecklistConfig;
