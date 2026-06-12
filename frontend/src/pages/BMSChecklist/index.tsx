import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { jwtDecode } from 'jwt-decode';
import {
  Box, Typography, Tabs, Tab, Button, IconButton, Chip,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import {
  MdAdd, MdDelete, MdDownload, MdCheckCircle, MdHistory, MdExpandMore,
  MdChevronRight, MdSearch, MdSave, MdFilterList, MdViewList, MdViewModule,
  MdDarkMode, MdLightMode, MdRemove
} from 'react-icons/md';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import {
  flattenConfig, unflattenRows,
  DEFAULT_CONFIG
} from './config';
import type { FlatRow, SavedChecklist } from './config';
import { createNewChecklist } from './storage';
import {
  fetchBMSChecklists, createBMSChecklist, updateBMSChecklist, deleteBMSChecklist,
  fetchBMSChecklistConfig
} from './action';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';
import { useToast } from '../../contexts/ToastContext';
import DatePicker from '../../components/DatePicker';

// ─── Tolerance Check ───
function hasDeviation(value: string, bmsReading: string): boolean {
  const v = parseFloat(value);
  const b = parseFloat(bmsReading);
  if (isNaN(v) || isNaN(b) || b === 0) return false;
  return Math.abs((v - b) / b) > 0.10;
}

// ─── Parameter Rule Check ───
function checkRuleFailure(value: string, operator?: string, threshold?: number | string): { failed: boolean; message: string } {
  if (!value || !operator || threshold === undefined || threshold === '') {
    return { failed: false, message: '' };
  }
  const numVal = parseFloat(value);
  const numThreshold = parseFloat(threshold.toString());
  if (isNaN(numVal) || isNaN(numThreshold)) {
    return { failed: false, message: '' };
  }
  
  let failed = false;
  if (operator === '>') {
    failed = numVal > numThreshold;
  } else if (operator === '<') {
    failed = numVal < numThreshold;
  } else if (operator === '>=') {
    failed = numVal >= numThreshold;
  } else if (operator === '<=') {
    failed = numVal <= numThreshold;
  }

  if (failed) {
    return { failed: true, message: `Value cannot be ${operator} ${threshold}` };
  }
  return { failed: false, message: '' };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

type EditableRowField = keyof Pick<FlatRow, 'category' | 'device' | 'parameter' | 'value' | 'bmsReading' | 'unit' | 'remarks'>;

const EMPTY_FIELD: FlatRow = {
  category: '',
  device: '',
  parameter: '',
  value: '',
  bmsReading: '',
  unit: '',
  remarks: '',
};

type ParameterUnitDraft = {
  parameter: string;
  unit: string;
};

const EMPTY_PARAMETER_UNIT: ParameterUnitDraft = {
  parameter: '',
  unit: '',
};

const BMSChecklist: React.FC = () => {
  const { showToast } = useToast();
  const token = useSelector((state: RootState) => state.auth.token);
  const isSuperuser = useSelector((state: RootState) => state.auth.isSuperuser);
  const username = useSelector((state: RootState) => state.auth.username) || 'system';
  const displayName = useSelector((state: RootState) => state.auth.displayName) || username;
  const userDepartment = useMemo(() => {
    if (!token) return 'General';
    try {
      const decoded: any = jwtDecode(token);
      return decoded.department || 'General';
    } catch {
      return 'General';
    }
  }, [token]);

  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));

  const canView = hasPrivilege(PRIVILEGES.BMS_CHECKLIST_VIEW);
  const canCreate = hasPrivilege(PRIVILEGES.BMS_CHECKLIST_CREATE);
  const canUpdate = hasPrivilege(PRIVILEGES.BMS_CHECKLIST_UPDATE);
  const canDelete = hasPrivilege(PRIVILEGES.BMS_CHECKLIST_DELETE);
  const canEditFields = hasPrivilege(PRIVILEGES.BMS_CHECKLIST_FIELD_EDIT);
  const canOpenForEdit = canUpdate || canEditFields;
  const canSaveDraft = canUpdate || canEditFields || canCreate;

  const todayStr = dayjs().format('YYYY-MM-DD');
  const isPastDaySelected = dayjs(selectedDate).isBefore(todayStr, 'day');
  const isFutureDaySelected = dayjs(selectedDate).isAfter(todayStr, 'day');

  const [templateConfig, setTemplateConfig] = useState<any>(DEFAULT_CONFIG);

  const loadTemplate = useCallback(async () => {
    try {
      const res = await fetchBMSChecklistConfig({ department: userDepartment });
      if (res && res.template && Object.keys(res.template).length > 0) {
        setTemplateConfig(res.template);
      } else {
        setTemplateConfig(DEFAULT_CONFIG);
      }
    } catch {
      setTemplateConfig(DEFAULT_CONFIG);
    }
  }, [userDepartment]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  // Tab state: 0 = Active Checklist, 1 = History
  const [activeTab, setActiveTab] = useState(0);

  // Active checklist
  const [checklist, setChecklist] = useState<SavedChecklist | null>(null);
  const [rows, setRows] = useState<FlatRow[]>([]);
  const [preparedBy, setPreparedBy] = useState('');

  const checkCanEdit = useCallback((chk: SavedChecklist): boolean => {
    const todayStr = dayjs().format('YYYY-MM-DD');
    const isToday = chk.date === todayStr;
    const isFuture = dayjs(chk.date).isAfter(todayStr, 'day');
    const isCompleted = chk.status === 'Completed';

    if (isSuperuser) {
      return !isFuture;
    }
    if (isToday) {
      if (isCompleted) {
        const completer = chk.completedBy || chk.createdBy;
        return completer === username;
      }
      return true;
    }
    return false;
  }, [isSuperuser, username]);

  const isViewOnlyMode = useMemo(() => {
    if (!checklist) return false;
    if (isFutureDaySelected) return true;
    if (isPastDaySelected) return !isSuperuser;

    // It's today!
    if (checklist.status === 'Completed') {
      const completer = checklist.completedBy || checklist.createdBy;
      return !isSuperuser && (completer !== username);
    }
    return false;
  }, [checklist, isFutureDaySelected, isPastDaySelected, isSuperuser, username]);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [collapsedDevs, setCollapsedDevs] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [darkMode, setDarkMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(dayjs().format('HH:mm:ss'));
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [newField, setNewField] = useState<FlatRow>(EMPTY_FIELD);
  const [newParameterUnits, setNewParameterUnits] = useState<ParameterUnitDraft[]>([{ ...EMPTY_PARAMETER_UNIT }]);

  // History
  const [history, setHistory] = useState<SavedChecklist[]>([]);
  const [viewingChecklist, setViewingChecklist] = useState<SavedChecklist | null>(null);
  const [viewRows, setViewRows] = useState<FlatRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // ─── Load History ───
  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetchBMSChecklists({ department: userDepartment });
      setHistory(res.data || []);
    } catch {
      setHistory([]);
    }
  }, [userDepartment]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const filteredHistory = useMemo(() => {
    let result = history;
    if (selectedMonth !== 'all') {
      result = result.filter(cl => cl.date && cl.date.startsWith(selectedMonth));
    }
    if (historySearchQuery.trim()) {
      const q = historySearchQuery.toLowerCase();
      result = result.filter(cl => {
        if (!cl.date) return false;
        const formattedDate = dayjs(cl.date).format('DD MMM YYYY').toLowerCase();
        const rawDate = cl.date.toLowerCase();
        return rawDate.includes(q) || formattedDate.includes(q);
      });
    }
    return result;
  }, [history, selectedMonth, historySearchQuery]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    history.forEach(cl => {
      if (cl.date) {
        months.add(dayjs(cl.date).format('YYYY-MM'));
      }
    });
    return Array.from(months).sort().reverse();
  }, [history]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(dayjs().format('HH:mm:ss'));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  // ─── Load Checklist for selected date ───
  const loadChecklistForDate = useCallback(async (dateStr: string) => {
    try {
      const res = await fetchBMSChecklists({
        department: userDepartment,
        date: dateStr,
        limit: 1,
      });
      if (res && res.data && res.data.length > 0) {
        const existing = res.data[0];
        setChecklist(existing);
        setRows(flattenConfig(existing.data));
        setPreparedBy(existing.preparedBy);
      } else {
        setChecklist(null);
        setRows([]);
        setPreparedBy('');
      }
    } catch {
      setChecklist(null);
      setRows([]);
      setPreparedBy('');
    }
  }, [userDepartment]);

  useEffect(() => {
    loadChecklistForDate(selectedDate);
  }, [selectedDate, loadChecklistForDate]);

  // ─── Derived Data ───
  const categories = useMemo(() => {
    const cats = new Set<string>();
    rows.forEach(r => cats.add(r.category));
    return Array.from(cats);
  }, [rows]);

  const deviceOptions = useMemo(() => {
    const devices = new Set<string>();
    rows.forEach((row) => {
      if (!newField.category || row.category === newField.category) {
        devices.add(row.device);
      }
    });
    return Array.from(devices);
  }, [newField.category, rows]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (filterCategory) {
      result = result.filter(r => r.category === filterCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.category.toLowerCase().includes(q) ||
        r.device.toLowerCase().includes(q) ||
        r.parameter.toLowerCase().includes(q)
      );
    }
    return result;
  }, [rows, filterCategory, searchQuery]);

  // ─── New Checklist ───
  const handleNewChecklist = async () => {
    if (!canCreate) return;

    const todayStr = dayjs().format('YYYY-MM-DD');
    const isPast = dayjs(selectedDate).isBefore(todayStr, 'day');
    const isFuture = dayjs(selectedDate).isAfter(todayStr, 'day');

    if (isFuture) {
      showToast('Cannot create checklists for future dates.', 'error');
      return;
    }

    if (isPast && !isSuperuser) {
      showToast('Only superusers can create checklists for past dates.', 'error');
      return;
    }

    // Check only one checklist per day per department
    try {
      const res = await fetchBMSChecklists({
        department: userDepartment,
        date: selectedDate,
        limit: 1,
      });
      const alreadyExists = res && res.data && res.data.length > 0;

      if (!isSuperuser && alreadyExists) {
        showToast(`A checklist has already been created for ${selectedDate} for department "${userDepartment}". Only one checklist is allowed per day per department.`, 'error');
        return;
      }
    } catch {
      showToast('Failed to check existing checklists.', 'error');
      return;
    }

    const newCl = createNewChecklist(displayName, templateConfig, userDepartment, username, selectedDate);
    setChecklist(newCl);
    setRows(flattenConfig(newCl.data));
    setPreparedBy(newCl.preparedBy);
    setCollapsedCats(new Set());
    setCollapsedDevs(new Set());
    setActiveTab(0);
  };

  // ─── Open from History ───
  const handleOpenChecklist = (id: string) => {
    if (!canOpenForEdit) return;
    const cl = history.find(c => c.id === id || (c as any)._id === id);
    if (cl) {
      if (cl.department && cl.department !== userDepartment) {
        showToast('Access Denied: This checklist belongs to another department.', 'error');
        return;
      }
      setChecklist(cl);
      setRows(flattenConfig(cl.data));
      setPreparedBy(cl.preparedBy);
      setSelectedDate(cl.date);
      setCollapsedCats(new Set());
      setCollapsedDevs(new Set());
      setActiveTab(0);
    }
  };

  // ─── View Checklist (read-only from history) ───
  const handleViewChecklist = (id: string) => {
    if (!canView) return;
    const cl = history.find(c => c.id === id || (c as any)._id === id);
    if (cl) {
      if (cl.department && cl.department !== userDepartment) {
        showToast('Access Denied: This checklist belongs to another department.', 'error');
        return;
      }
      setViewingChecklist(cl);
      setViewRows(flattenConfig(cl.data));
    }
  };

  // ─── Save ───
  const handleSave = async (status: 'Draft' | 'Completed' = 'Draft') => {
    if (!checklist || (status === 'Completed' ? !canUpdate : !canSaveDraft)) return;

    if (!checkCanEdit(checklist)) {
      const todayStr = dayjs().format('YYYY-MM-DD');
      const isToday = checklist.date === todayStr;
      const isCompleted = checklist.status === 'Completed';

      if (isToday && isCompleted) {
        showToast('Only the staff who completed this checklist can edit it today.', 'error');
      } else if (!isToday) {
        showToast('Cannot edit previous day checklists.', 'error');
      } else {
        showToast('You do not have permission to edit this checklist.', 'error');
      }
      return;
    }

    const actionText = status === 'Completed' ? 'mark this checklist as completed' : 'save this checklist as draft';
    const confirmed = window.confirm(`Are you sure you want to ${actionText}?`);
    if (!confirmed) return;

    const updatedConfig = unflattenRows(rows);
    const updated: SavedChecklist = {
      ...checklist,
      time: currentTime,
      preparedBy,
      status,
      data: updatedConfig,
      updatedAt: new Date().toISOString(),
    };
    if (status === 'Completed') {
      updated.completedBy = username;
    } else if (checklist.status === 'Completed') {
      updated.completedBy = checklist.completedBy || username;
    }

    try {
      let savedCl: SavedChecklist;
      const clId = checklist.id || (checklist as any)._id;
      const exists = history.some(c => c.id === clId || (c as any)._id === clId);
      if (exists) {
        savedCl = await updateBMSChecklist(clId, updated);
      } else {
        savedCl = await createBMSChecklist(updated);
      }
      setChecklist(savedCl);
      showToast(status === 'Completed' ? 'Checklist marked as completed!' : 'Draft saved successfully!', 'success');
      refreshHistory();
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || 'Failed to save checklist';
      showToast(errMsg, 'error');
    }
  };

  // ─── Delete ───
  const handleDeleteConfirm = async () => {
    if (deleteTarget && canDelete) {
      try {
        await deleteBMSChecklist(deleteTarget);
        if (checklist?.id === deleteTarget || (checklist as any)?._id === deleteTarget) {
          setChecklist(null);
          setRows([]);
        }
        showToast('Checklist deleted successfully', 'success');
        refreshHistory();
      } catch {
        showToast('Failed to delete checklist', 'error');
      } finally {
        setDeleteTarget(null);
      }
    }
  };

  // ─── Row Update ───
  const updateRow = (index: number, field: EditableRowField, newVal: string) => {
    const fieldDefinitionKeys: EditableRowField[] = ['category', 'device', 'parameter', 'unit'];
    const isFieldDefinitionEdit = fieldDefinitionKeys.includes(field);
    if (isFieldDefinitionEdit ? !canEditFields : !canUpdate) return;

    if (checklist) {
      if (!checkCanEdit(checklist)) {
        const todayStr = dayjs().format('YYYY-MM-DD');
        const isToday = checklist.date === todayStr;
        const isFuture = dayjs(checklist.date).isAfter(todayStr, 'day');
        const isCompleted = checklist.status === 'Completed';

        if (isFuture) {
          showToast('Cannot edit future day checklists.', 'error');
        } else if (!isToday) {
          showToast('Cannot edit previous day checklists.', 'error');
        } else if (isCompleted) {
          showToast('Only the staff who completed this checklist can edit it today.', 'error');
        } else {
          showToast('You do not have permission to edit this checklist.', 'error');
        }
        return;
      }
    }

    setRows(prev => {
      const updated = [...prev];
      const targetRow = filteredRows[index];
      const byReference = prev.findIndex(r => r === targetRow);
      const realIdx = byReference >= 0 ? byReference : prev.findIndex(r =>
          r.category === targetRow.category &&
          r.device === targetRow.device &&
          r.parameter === targetRow.parameter
        );

      if (realIdx >= 0) {
        updated[realIdx] = {
          ...updated[realIdx],
          [field]: newVal,
          timestamp: new Date().toISOString(),
        };
      }
      return updated;
    });
  };

  const handleAddField = () => {
    if (!canCreate) return;
    const category = newField.category.trim();
    const device = newField.device.trim();
    const parameters = newParameterUnits
      .map(item => ({
        parameter: item.parameter.trim(),
        unit: item.unit.trim(),
      }))
      .filter(item => item.parameter);

    if (!category || !device || !parameters.length) return;

    const paramNames = parameters.map(p => p.parameter.toLowerCase());
    const duplicates = paramNames.filter((item, index) => paramNames.indexOf(item) !== index);
    if (duplicates.length > 0) {
      showToast(`Duplicate parameters are not allowed: ${Array.from(new Set(duplicates)).join(', ')}`, 'error');
      return;
    }

    const timestamp = new Date().toISOString();
    const newRows = parameters.map(({ parameter, unit }): FlatRow => ({
      ...newField,
      category,
      device,
      parameter,
      unit,
      timestamp,
    }));

    setRows(prev => [...prev, ...newRows]);
    setCollapsedCats(prev => {
      const next = new Set(prev);
      next.delete(category);
      return next;
    });
    setCollapsedDevs(prev => {
      const next = new Set(prev);
      next.delete(`${category}::${device}`);
      return next;
    });
    setFilterCategory('');
    setSearchQuery('');
    setNewField(EMPTY_FIELD);
    setNewParameterUnits([{ ...EMPTY_PARAMETER_UNIT }]);
    setAddFieldOpen(false);
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

  const removeRow = (index: number) => {
    if (!canDelete) return;

    if (checklist) {
      if (!checkCanEdit(checklist)) {
        const todayStr = dayjs().format('YYYY-MM-DD');
        const isToday = checklist.date === todayStr;
        const isFuture = dayjs(checklist.date).isAfter(todayStr, 'day');
        const isCompleted = checklist.status === 'Completed';

        if (isFuture) {
          showToast('Cannot modify future day checklists.', 'error');
        } else if (!isToday) {
          showToast('Cannot modify previous day checklists.', 'error');
        } else if (isCompleted) {
          showToast('Only the staff who completed this checklist can modify it today.', 'error');
        } else {
          showToast('You do not have permission to modify this checklist.', 'error');
        }
        return;
      }
    }

    const targetRow = filteredRows[index];
    setRows(prev => {
      const byReference = prev.findIndex(r => r === targetRow);
      const realIdx = byReference >= 0 ? byReference : prev.findIndex(r =>
        r.category === targetRow.category &&
        r.device === targetRow.device &&
        r.parameter === targetRow.parameter
      );

      if (realIdx < 0) return prev;
      return prev.filter((_, idx) => idx !== realIdx);
    });
  };

  // ─── Collapse Toggles ───
  const toggleCat = (cat: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const toggleDev = (key: string) => {
    setCollapsedDevs(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ─── CSV Export ───
  const handleExportCSV = () => {
    if (!checklist || !canView) return;

    const escapeCSV = (val: string) => {
      if (val === null || val === undefined) return '""';
      const escaped = val.toString().replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const headers = ['SL No', 'Category', 'Device', 'Parameter', 'Value', 'BMS Reading', 'Remarks'];
    const csvRows = [headers.map(escapeCSV).join(',')];

    rows.forEach((row, index) => {
      const valueStr = `${row.value || ''}${row.unit ? ` ${row.unit}` : ''}`.trim();
      const csvRow = [
        (index + 1).toString(),
        row.category || '',
        row.device || '',
        row.parameter || '',
        valueStr,
        row.bmsReading || '',
        row.remarks || ''
      ];
      csvRows.push(csvRow.map(escapeCSV).join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `BMS_Checklist_${checklist.date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV exported successfully!', 'success');
  };

  // ─── Build grouped structure for table rendering ───
  const groupedData = useMemo(() => {
    const groups: { category: string; devices: { device: string; params: (FlatRow & { filteredIdx: number })[] }[] }[] = [];
    const catMap = new Map<string, Map<string, (FlatRow & { filteredIdx: number })[]>>();

    filteredRows.forEach((row, idx) => {
      if (!catMap.has(row.category)) catMap.set(row.category, new Map());
      const devMap = catMap.get(row.category)!;
      if (!devMap.has(row.device)) devMap.set(row.device, []);
      devMap.get(row.device)!.push({ ...row, filteredIdx: idx });
    });

    catMap.forEach((devMap, category) => {
      const devices: { device: string; params: (FlatRow & { filteredIdx: number })[] }[] = [];
      devMap.forEach((params, device) => {
        devices.push({ device, params });
      });
      groups.push({ category, devices });
    });

    return groups;
  }, [filteredRows]);

  // ─── Count stats ───
  const stats = useMemo(() => {
    let total = rows.length;
    let filled = rows.filter(r => r.value.trim() !== '').length;
    let deviations = rows.filter(r => hasDeviation(r.value, r.bmsReading)).length;
    return { total, filled, deviations };
  }, [rows]);

  // ─── Render Checklist Table ───
  const renderChecklistTable = (
    data: typeof groupedData,
    canEditValues: boolean,
    onUpdate?: (index: number, field: EditableRowField, val: string) => void,
    allowDelete = false
  ) => {
    let slNo = 0;
    return (
      <table className={styles.container__table}>
        <thead>
          <tr>
            <th style={{ width: 45 }}>SL</th>
            <th>Category</th>
            <th>Device</th>
            <th>Parameter</th>
            <th style={{ width: 120 }}>Value</th>
            <th style={{ width: 120 }}>BMS Reading</th>
            <th style={{ width: 160 }}>Remarks</th>
            {allowDelete && <th style={{ width: 72 }}>Action</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((catGroup) => {
            const isCatCollapsed = collapsedCats.has(catGroup.category);
            return (
              <React.Fragment key={catGroup.category}>
                {/* Category Header Row */}
                <tr
                  className={styles['container__table--catRow']}
                  onClick={() => toggleCat(catGroup.category)}
                >
                  <td colSpan={allowDelete ? 8 : 7}>
                    <span className={`${styles.container__chevron} ${!isCatCollapsed ? styles.open : ''}`}>
                      {isCatCollapsed ? <MdChevronRight /> : <MdExpandMore />}
                    </span>
                    {catGroup.category}
                    <Chip
                      label={`${catGroup.devices.reduce((a, d) => a + d.params.length, 0)} params`}
                      size="small"
                      sx={{ ml: 1, height: 20, fontSize: 10, fontWeight: 600 }}
                    />
                  </td>
                </tr>

                {!isCatCollapsed && catGroup.devices.map((devGroup) => {
                  const devKey = `${catGroup.category}::${devGroup.device}`;
                  const isDevCollapsed = collapsedDevs.has(devKey);
                  return (
                    <React.Fragment key={devKey}>
                      {/* Device Sub-Header Row */}
                      <tr
                        className={styles['container__table--devRow']}
                        onClick={() => toggleDev(devKey)}
                      >
                        <td colSpan={allowDelete ? 8 : 7}>
                          <span className={`${styles.container__chevron} ${!isDevCollapsed ? styles.open : ''}`}>
                            {isDevCollapsed ? <MdChevronRight /> : <MdExpandMore />}
                          </span>
                          {devGroup.device}
                        </td>
                      </tr>

                      {!isDevCollapsed && devGroup.params.map((row) => {
                        slNo++;
                        const deviation = hasDeviation(row.value, row.bmsReading);
                        return (
                          <tr
                            key={`${row.category}-${row.device}-${row.parameter}`}
                            className={deviation ? styles['container__table--deviation'] : ''}
                            style={{ backgroundColor: slNo % 2 === 0 ? '#f8fafc' : '#fff' }}
                          >
                            <td className={styles['container__table--slCol']}>{slNo}</td>
                            <td>{row.category}</td>
                            <td>{row.device}</td>
                            <td>
                              {row.parameter}
                              {row.unit && <span className={styles['container__table--unit']}>{row.unit}</span>}
                            </td>
                            <td style={checkRuleFailure(row.value, row.ruleOperator, row.ruleValue).failed ? { backgroundColor: '#fee2e2' } : {}}>
                              {canEditValues ? (
                                <input
                                  type="text"
                                  value={row.value}
                                  onChange={(e) => onUpdate?.(row.filteredIdx, 'value', e.target.value)}
                                  placeholder="—"
                                  style={checkRuleFailure(row.value, row.ruleOperator, row.ruleValue).failed ? { color: '#dc2626', fontWeight: 'bold', border: '1px solid #dc2626', backgroundColor: '#fee2e2' } : {}}
                                />
                              ) : (
                                <span style={checkRuleFailure(row.value, row.ruleOperator, row.ruleValue).failed ? { color: '#dc2626', fontWeight: 'bold' } : {}}>{row.value || '—'}</span>
                              )}
                              {checkRuleFailure(row.value, row.ruleOperator, row.ruleValue).failed && (
                                <Tooltip title={checkRuleFailure(row.value, row.ruleOperator, row.ruleValue).message}>
                                  <span style={{ color: '#ef4444', fontWeight: 'bold', marginLeft: '6px', cursor: 'pointer' }}>⚠</span>
                                </Tooltip>
                              )}
                              {deviation && (
                                <Tooltip title="Value deviates more than ±10% from BMS reading">
                                  <span className={styles.container__deviationMark}>!</span>
                                </Tooltip>
                              )}
                            </td>
                            <td className={styles['container__table--bmsVal']}>
                              {canEditValues ? (
                                <input
                                  type="text"
                                  value={row.bmsReading}
                                  onChange={(e) => onUpdate?.(row.filteredIdx, 'bmsReading', e.target.value)}
                                  placeholder="—"
                                />
                              ) : row.bmsReading || '—'}
                            </td>
                            <td>
                              {canEditValues ? (
                                <input
                                  type="text"
                                  value={row.remarks}
                                  onChange={(e) => onUpdate?.(row.filteredIdx, 'remarks', e.target.value)}
                                  placeholder="Add remark..."
                                />
                              ) : (
                                <span>{row.remarks || '—'}</span>
                              )}
                            </td>
                            {allowDelete && (
                              <td>
                                <Tooltip title="Remove field">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => removeRow(row.filteredIdx)}
                                  >
                                    <MdDelete />
                                  </IconButton>
                                </Tooltip>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    );
  };

  const renderChecklistCards = (
    data: typeof groupedData,
    canEditValues: boolean,
    onUpdate?: (index: number, field: EditableRowField, val: string) => void,
    allowDelete = false
  ) => {
    let slNo = 0;

    return (
      <Box className={styles.container__cards}>
        {data.map((catGroup) => {
          const isCatCollapsed = collapsedCats.has(catGroup.category);

          return (
            <section key={catGroup.category} className={styles.container__cardGroup}>
              <button
                type="button"
                className={styles['container__cardGroup--header']}
                onClick={() => toggleCat(catGroup.category)}
              >
                <span className={`${styles.container__chevron} ${!isCatCollapsed ? styles.open : ''}`}>
                  {isCatCollapsed ? <MdChevronRight /> : <MdExpandMore />}
                </span>
                <strong>{catGroup.category}</strong>
                <Chip
                  label={`${catGroup.devices.reduce((a, d) => a + d.params.length, 0)} params`}
                  size="small"
                  sx={{ ml: 'auto', height: 20, fontSize: 10, fontWeight: 600 }}
                />
              </button>

              {!isCatCollapsed && catGroup.devices.map((devGroup) => {
                const devKey = `${catGroup.category}::${devGroup.device}`;
                const isDevCollapsed = collapsedDevs.has(devKey);

                return (
                  <div key={devKey} className={styles.container__deviceBlock}>
                    <button
                      type="button"
                      className={styles['container__deviceBlock--header']}
                      onClick={() => toggleDev(devKey)}
                    >
                      <span className={`${styles.container__chevron} ${!isDevCollapsed ? styles.open : ''}`}>
                        {isDevCollapsed ? <MdChevronRight /> : <MdExpandMore />}
                      </span>
                      <span>{devGroup.device}</span>
                    </button>

                    {!isDevCollapsed && (
                      <div className={styles.container__cardGrid}>
                        {devGroup.params.map((row) => {
                          slNo++;
                          const deviation = hasDeviation(row.value, row.bmsReading);

                          return (
                            <article
                              key={`${row.category}-${row.device}-${row.parameter}`}
                              className={`${styles.container__paramCard} ${deviation ? styles.deviation : ''}`}
                              style={checkRuleFailure(row.value, row.ruleOperator, row.ruleValue).failed ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                            >
                              <div className={styles['container__paramCard--top']}>
                                <span>#{slNo}</span>
                                {checkRuleFailure(row.value, row.ruleOperator, row.ruleValue).failed && (
                                  <Tooltip title={checkRuleFailure(row.value, row.ruleOperator, row.ruleValue).message}>
                                    <span style={{ color: '#ef4444', fontWeight: 'bold', cursor: 'pointer', marginRight: '6px' }}>⚠</span>
                                  </Tooltip>
                                )}
                                {deviation && <span className={styles.container__deviationMark}>!</span>}
                              </div>
                              <h4>
                                {row.parameter}
                                {row.unit && <span>{row.unit}</span>}
                              </h4>
                              <div className={styles['container__paramCard--fields']}>
                                <label>
                                  Value
                                  {canEditValues ? (
                                    <input
                                      type="text"
                                      value={row.value}
                                      onChange={(e) => onUpdate?.(row.filteredIdx, 'value', e.target.value)}
                                      placeholder="-"
                                      style={checkRuleFailure(row.value, row.ruleOperator, row.ruleValue).failed ? { color: '#dc2626', fontWeight: 'bold', border: '1px solid #dc2626', backgroundColor: '#fee2e2' } : {}}
                                    />
                                  ) : (
                                    <strong style={checkRuleFailure(row.value, row.ruleOperator, row.ruleValue).failed ? { color: '#dc2626' } : {}}>{row.value || '-'}</strong>
                                  )}
                                </label>
                                <label>
                                  BMS Reading
                                  {canEditValues ? (
                                    <input
                                      type="text"
                                      value={row.bmsReading}
                                      onChange={(e) => onUpdate?.(row.filteredIdx, 'bmsReading', e.target.value)}
                                      placeholder="-"
                                    />
                                  ) : (
                                    <strong>{row.bmsReading || '-'}</strong>
                                  )}
                                </label>
                                <label>
                                  Remarks
                                  {canEditValues ? (
                                    <input
                                      type="text"
                                      value={row.remarks}
                                      onChange={(e) => onUpdate?.(row.filteredIdx, 'remarks', e.target.value)}
                                      placeholder="Add remark..."
                                    />
                                  ) : (
                                    <strong>{row.remarks || '-'}</strong>
                                  )}
                                </label>
                              </div>
                              {row.timestamp && (
                                <small>Edited {dayjs(row.timestamp).format('DD/MM/YYYY HH:mm')}</small>
                              )}
                              {allowDelete && (
                                <Button
                                  variant="outlined"
                                  color="error"
                                  size="small"
                                  startIcon={<MdDelete />}
                                  onClick={() => removeRow(row.filteredIdx)}
                                  sx={{ textTransform: 'none', borderRadius: '6px', alignSelf: 'flex-start' }}
                                >
                                  Remove Field
                                </Button>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}
      </Box>
    );
  };

  // ─── View Checklist grouped data ───
  const viewGrouped = useMemo(() => {
    if (!viewRows.length) return [];
    const groups: typeof groupedData = [];
    const catMap = new Map<string, Map<string, (FlatRow & { filteredIdx: number })[]>>();
    viewRows.forEach((row, idx) => {
      if (!catMap.has(row.category)) catMap.set(row.category, new Map());
      const devMap = catMap.get(row.category)!;
      if (!devMap.has(row.device)) devMap.set(row.device, []);
      devMap.get(row.device)!.push({ ...row, filteredIdx: idx });
    });
    catMap.forEach((devMap, category) => {
      const devices: { device: string; params: (FlatRow & { filteredIdx: number })[] }[] = [];
      devMap.forEach((params, device) => {
        devices.push({ device, params });
      });
      groups.push({ category, devices });
    });
    return groups;
  }, [viewRows]);

  if (!canView) {
    return (
      <Box className={`${styles.container} ${darkMode ? styles.dark : ''}`}>
        <Box sx={{ textAlign: 'center', py: 8, color: '#64748b' }}>
          <MdCheckCircle style={{ fontSize: 48, marginBottom: 12 }} />
          <Typography variant="h6" sx={{ color: '#334155', mb: 1 }}>
            Access Restricted
          </Typography>
          <Typography variant="body2">
            You need the View BMS Checklist privilege to open this page.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box className={`${styles.container} ${darkMode ? styles.dark : ''}`}>
      {/* Header */}
      <Box className={styles.container__header}>
        <Typography variant="h5" className={styles['container__header--title']}>
          Daily BMS Checklist
        </Typography>
        <Box className={styles['container__header--actions']}>
          <Button
            variant="contained"
            startIcon={<MdAdd />}
            onClick={handleNewChecklist}
            disabled={!canCreate}
            sx={{
              textTransform: 'none', fontWeight: 600, borderRadius: '8px',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 2px 6px rgba(37,99,235,.3)',
            }}
          >
            New Checklist
          </Button>
          <Tooltip title={darkMode ? 'Light mode' : 'Dark mode'}>
            <IconButton
              onClick={() => setDarkMode((prev) => !prev)}
              className={styles.container__iconButton}
            >
              {darkMode ? <MdLightMode /> : <MdDarkMode />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} textColor="primary" indicatorColor="primary">
          <Tab label="Active Checklist" icon={<MdCheckCircle style={{ fontSize: 18 }} />} iconPosition="start" sx={{ fontWeight: 600, textTransform: 'none' }} />
          <Tab label="History" icon={<MdHistory style={{ fontSize: 18 }} />} iconPosition="start" sx={{ fontWeight: 600, textTransform: 'none' }} />
        </Tabs>
      </Box>

      {/* ═══ Tab 0: Active Checklist ═══ */}
      {activeTab === 0 && (
        <>
          {/* Current Date & Server Time Header */}
          <Box sx={{
            mb: 3,
            p: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: '12px',
            background: darkMode ? '#1e293b' : '#f8fafc',
            border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0',
            width: '100%',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b' }}>
                Date:
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                {dayjs().format('dddd, DD MMMM YYYY')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b' }}>
                Server Time:
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, fontFamily: 'monospace', color: darkMode ? '#38bdf8' : '#0284c7', fontSize: '1.1rem' }}>
                {currentTime}
              </Typography>
            </Box>
          </Box>

          {checklist ? (
            <>
              {/* Meta Info */}
              <Box className={styles.container__meta}>
                <Box className={styles['container__meta--field']}>
                  <label>Date</label>
                  <span>{checklist.date}</span>
                </Box>
                <Box className={styles['container__meta--field']}>
                  <label>Time</label>
                  <span>{currentTime}</span>
                </Box>
                <Box className={styles['container__meta--field']}>
                  <label>Prepared By</label>
                  <span>{preparedBy || '-'}</span>
                </Box>
                <Box className={styles['container__meta--field']}>
                  <label>Status</label>
                  <Chip
                    label={checklist.status}
                    size="small"
                    sx={{
                      fontWeight: 600,
                      backgroundColor: checklist.status === 'Completed' ? '#dcfce7' : '#fef3c7',
                      color: checklist.status === 'Completed' ? '#166534' : '#92400e',
                    }}
                  />
                </Box>
                <Box className={styles['container__meta--field']}>
                  <label>Progress</label>
                  <span>{stats.filled} / {stats.total} filled</span>
                </Box>
                {stats.deviations > 0 && (
                  <Box className={styles['container__meta--field']}>
                    <label>Deviations</label>
                    <Chip label={`${stats.deviations} ⚠`} size="small" color="error" sx={{ fontWeight: 600 }} />
                  </Box>
                )}
              </Box>

              {/* Filters & Actions */}
              <Box className={styles.container__filters}>
                <label className={styles.container__filterControl}>
                  <MdSearch />
                  <input
                    type="search"
                    placeholder="Search device, parameter..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </label>
                <label className={styles.container__filterControl}>
                  <MdFilterList />
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                  >
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>

                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>

                  <Button
                    variant={viewMode === 'table' ? 'contained' : 'outlined'}
                    startIcon={<MdViewList />}
                    onClick={() => setViewMode('table')}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
                  >
                    Table
                  </Button>
                  <Button
                    variant={viewMode === 'card' ? 'contained' : 'outlined'}
                    startIcon={<MdViewModule />}
                    onClick={() => setViewMode('card')}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
                  >
                    Cards
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<MdSave />}
                    onClick={() => handleSave('Draft')}
                    disabled={!canSaveDraft || isViewOnlyMode}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
                  >
                    Save Draft
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<MdCheckCircle />}
                    onClick={() => handleSave('Completed')}
                    disabled={!canUpdate || isViewOnlyMode || checklist?.status === 'Completed'}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
                  >
                    Mark Complete
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<MdDownload />}
                    onClick={handleExportCSV}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
                  >
                    Export CSV
                  </Button>
                </Box>
              </Box>

              {viewMode === 'table'
                ? renderChecklistTable(groupedData, canUpdate && !isViewOnlyMode, updateRow, false)
                : renderChecklistCards(groupedData, canUpdate && !isViewOnlyMode, updateRow, false)}
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 8, color: '#94a3b8' }}>
              <MdCheckCircle style={{ fontSize: 48, marginBottom: 12 }} />
              <Typography variant="h6" sx={{ color: '#64748b', mb: 1 }}>
                {isPastDaySelected ? 'No Checklist Recorded' : isFutureDaySelected ? 'Future Date' : 'No Active Checklist'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3 }}>
                {isPastDaySelected 
                  ? 'No checklist was created for this date.' 
                  : isFutureDaySelected 
                    ? 'Checklists cannot be created for future dates.' 
                    : 'Create a new checklist to start recording BMS data, or open one from history.'}
              </Typography>
              {!(isFutureDaySelected || (isPastDaySelected && !isSuperuser)) && (
                <Button
                  variant="contained"
                  startIcon={<MdAdd />}
                  onClick={handleNewChecklist}
                  disabled={!canCreate}
                  sx={{
                    textTransform: 'none', fontWeight: 600, borderRadius: '8px',
                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  }}
                >
                  Create New Checklist
                </Button>
              )}
            </Box>
          )}
        </>
      )}

      {/* ═══ Tab 1: History ═══ */}
      {activeTab === 1 && (
        <>
          {/* Month wise dropdown filter & Search by Prepared By Name */}
          {history.length > 0 && (
            <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569' }}>
                  Filter by Month:
                </Typography>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#fff',
                    fontSize: '0.9rem',
                    minWidth: '150px'
                  }}
                >
                  <option value="all">All Months</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>
                      {dayjs(m + '-01').format('MMMM YYYY')}
                    </option>
                  ))}
                </select>
              </Box>

              <label className={styles.container__filterControl} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MdSearch style={{ fontSize: 20, color: '#64748b' }} />
                <input
                  type="search"
                  placeholder="Search by date..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    width: '240px'
                  }}
                />
              </label>
            </Box>
          )}

          {filteredHistory.length > 0 ? (
            filteredHistory.map(cl => (
              <Box key={cl.id} className={styles['container__history--card']}>
                <Box className={styles['container__history--card--left']}>
                  <h4>BMS Checklist — {dayjs(cl.date).format('DD MMM YYYY')} ({cl.department || 'General'})</h4>
                  <span>Prepared by: {cl.preparedBy} &nbsp;|&nbsp; {dayjs(cl.updatedAt).format('DD/MM/YYYY HH:mm')}</span>
                </Box>
                <Box className={styles['container__history--card--right']}>
                  <span className={`${styles['container__history--badge']} ${cl.status === 'Completed' ? styles.completed : styles.draft}`}>
                    {cl.status}
                  </span>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleViewChecklist(cl.id)}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '6px' }}
                  >
                    View
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    onClick={() => handleOpenChecklist(cl.id)}
                    disabled={!canOpenForEdit}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '6px' }}
                  >
                    Edit
                  </Button>
                  {canDelete && (
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(cl.id); }}
                    >
                      <MdDelete />
                    </IconButton>
                  )}
                </Box>
              </Box>
            ))
          ) : history.length > 0 ? (
            <Box className={styles['container__history--empty']}>
              <MdHistory style={{ fontSize: 48, marginBottom: 12 }} />
              <h3>No Matching Checklists Found</h3>
              <p>Try adjusting your search query or filters.</p>
            </Box>
          ) : (
            <Box className={styles['container__history--empty']}>
              <MdHistory style={{ fontSize: 48, marginBottom: 12 }} />
              <h3>No Saved Checklists</h3>
              <p>Create your first checklist to get started.</p>
            </Box>
          )}
        </>
      )}

      {/* ═══ View Checklist Dialog ═══ */}
      <Dialog
        open={!!viewingChecklist}
        onClose={() => setViewingChecklist(null)}
        maxWidth="xl"
        fullWidth
      >
        {viewingChecklist && (
          <>
            <DialogTitle sx={{ fontWeight: 700,color:"#333" }}>
              BMS Checklist — {dayjs(viewingChecklist.date).format('DD MMM YYYY')}
              <Chip
                label={viewingChecklist.status}
                size="small"
                sx={{
                  ml: 2, fontWeight: 600,
                  backgroundColor: viewingChecklist.status === 'Completed' ? '#dcfce7' : '#fef3c7',
                  color: viewingChecklist.status === 'Completed' ? '#166534' : '#92400e',
                }}
              />
            </DialogTitle>
            <DialogContent>
              <Box className={styles.container__meta} sx={{ mb: 2 }}>
                <Box className={styles['container__meta--field']}>
                  <label>Date</label>
                  <span>{viewingChecklist.date}</span>
                </Box>
                <Box className={styles['container__meta--field']}>
                  <label>Time</label>
                  <span>{viewingChecklist.time}</span>
                </Box>
                <Box className={styles['container__meta--field']}>
                  <label>Prepared By</label>
                  <span>{viewingChecklist.preparedBy}</span>
                </Box>
              </Box>
              {renderChecklistTable(viewGrouped, false)}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setViewingChecklist(null)} sx={{ textTransform: 'none' }}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ═══ Delete Confirmation ═══ */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle sx={{ fontWeight: 600, color: '#333' }}>Delete Checklist</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to permanently delete this checklist? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" sx={{ textTransform: 'none', fontWeight: 600 }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addFieldOpen} onClose={() => setAddFieldOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 ,color:"#333"}}>Add Checklist Field</DialogTitle>
        <DialogContent>
          <Box className={styles.container__fieldDialog}>
            <label>
              Category
              <input
                list="bms-categories"
                value={newField.category}
                onChange={(e) => setNewField(prev => ({ ...prev, category: e.target.value }))}
                placeholder="Server room PAC"
              />
            </label>
            <datalist id="bms-categories">
              {categories.map(category => <option key={category} value={category} />)}
            </datalist>
            <label>
              Device
              <input
                list="bms-devices"
                value={newField.device}
                onChange={(e) => setNewField(prev => ({ ...prev, device: e.target.value }))}
                placeholder="PAC-1"
              />
            </label>
            <datalist id="bms-devices">
              {deviceOptions.map(device => <option key={device} value={device} />)}
            </datalist>
            <Box className={styles.container__parameterUnits}>
              <div className={styles.container__parameterUnitsHeader}>
                <span>Parameter</span>
                <span>Unit</span>
                <span />
              </div>
              {newParameterUnits.map((item, index) => (
                <div className={styles.container__parameterUnitRow} key={index}>
                  <input
                    value={item.parameter}
                    onChange={(e) => updateParameterUnit(index, 'parameter', e.target.value)}
                    placeholder="Temperature"
                  />
                  <input
                    value={item.unit}
                    onChange={(e) => updateParameterUnit(index, 'unit', e.target.value)}
                    placeholder="C"
                  />
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Add parameter">
                      <IconButton size="small" color="primary" onClick={addParameterUnit}>
                        <MdAdd />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remove parameter">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeParameterUnit(index)}
                          disabled={newParameterUnits.length === 1}
                        >
                          <MdRemove />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </div>
              ))}
            </Box>
            <label>
              BMS Reading
              <input
                value={newField.bmsReading}
                onChange={(e) => setNewField(prev => ({ ...prev, bmsReading: e.target.value }))}
                placeholder="Optional"
              />
            </label>
            <label>
              Initial Value
              <input
                value={newField.value}
                onChange={(e) => setNewField(prev => ({ ...prev, value: e.target.value }))}
                placeholder="Optional"
              />
            </label>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddFieldOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            onClick={handleAddField}
            variant="contained"
            disabled={!newField.category.trim() || !newField.device.trim() || !newParameterUnits.some(item => item.parameter.trim())}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Add Field
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BMSChecklist;
