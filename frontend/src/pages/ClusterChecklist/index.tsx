// @ts-nocheck
import request from '../../services/request';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { jwtDecode } from 'jwt-decode';
import {
  Box, Typography, Tabs, Tab, Button, IconButton, Chip,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, TextField
} from '@mui/material';
import {
  MdAdd, MdDelete, MdDownload, MdCheckCircle, MdHistory, MdExpandMore,
  MdChevronRight, MdSearch, MdSave, MdFilterList, MdViewList, MdViewModule,
  MdRemove
} from 'react-icons/md';
import dayjs from 'dayjs';
import { getServerTime } from '../../helpers/time';
import { exportChecklistPdf } from '../../helpers/exportChecklistPdf';
import styles from './index.module.scss';
import {
  flattenClusterConfig, unflattenClusterRows,
  DEFAULT_CLUSTER_CONFIG
} from './config';
import type { ClusterFlatRow, SavedClusterChecklist, Rule } from './config';
import { createNewClusterChecklist } from './storage';
import {
  fetchClusterChecklists, createClusterChecklist, updateClusterChecklist, deleteClusterChecklist,
  fetchClusterChecklistConfig
} from './action';
import { hasPrivilege, hasAnyPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';
import { useToast } from '../../contexts/ToastContext';
import DatePicker from '../../components/DatePicker';
import { useConfirm } from '../../contexts/ConfirmContext';
import DaySummary from '../../components/DaySummary';
import EmailSelectInput from '../../components/EmailSelectInput';

// ─── Tolerance Check ───
function hasDeviation(value: string, bmsReading: string): boolean {
  const v = parseFloat(value);
  const b = parseFloat(bmsReading);
  if (isNaN(v) || isNaN(b) || b === 0) return false;
  return Math.abs((v - b) / b) > 0.10;
}

// ─── Parameter Rule Check ───
function checkRuleFailure(
  value: string,
  operator?: string,
  threshold?: number | string,
  maxValue?: number | string,
  warningOperator?: string,
  warningValue?: number | string,
  warningLabel?: string,
  rules?: Rule[]
): { failed: boolean; warning: boolean; message: string } {
  if (!value) {
    return { failed: false, warning: false, message: '' };
  }
  const numVal = parseFloat(value);
  if (isNaN(numVal)) {
    return { failed: false, warning: false, message: '' };
  }

  // 1. Max Value check (Validation)
  if (maxValue !== undefined && maxValue !== '') {
    const numMax = parseFloat(maxValue.toString());
    if (!isNaN(numMax) && numVal > numMax) {
      return { failed: true, warning: false, message: `Value cannot exceed ${maxValue}` };
    }
  }

  // If dynamic rules array is provided and not empty, check all rules.
  if (rules && rules.length > 0) {
    let activeWarning: { message: string } | null = null;

    for (const rule of rules) {
      if (!rule.operator || rule.value === undefined || rule.value === '') continue;
      const numThreshold = parseFloat(rule.value.toString());
      if (isNaN(numThreshold)) continue;

      let matched = false;
      if (rule.operator === '>') matched = numVal > numThreshold;
      else if (rule.operator === '<') matched = numVal < numThreshold;
      else if (rule.operator === '>=') matched = numVal >= numThreshold;
      else if (rule.operator === '<=') matched = numVal <= numThreshold;

      if (matched) {
        if (rule.type === 'fail') {
          return { failed: true, warning: false, message: `Value cannot be ${rule.operator} ${rule.value}` };
        } else if (rule.type === 'warning' && !activeWarning) {
          activeWarning = {
            message: rule.label ? `Warning: ${rule.label}` : `Warning: Value is ${rule.operator} ${rule.value}`
          };
        }
      }
    }

    if (activeWarning) {
      return { failed: false, warning: true, message: activeWarning.message };
    }

    return { failed: false, warning: false, message: '' };
  }

  // Fallback to legacy fields:
  // 2. Failure check
  if (operator && threshold !== undefined && threshold !== '') {
    const numThreshold = parseFloat(threshold.toString());
    if (!isNaN(numThreshold)) {
      let failed = false;
      if (operator === '>') failed = numVal > numThreshold;
      else if (operator === '<') failed = numVal < numThreshold;
      else if (operator === '>=') failed = numVal >= numThreshold;
      else if (operator === '<=') failed = numVal <= numThreshold;

      if (failed) {
        return { failed: true, warning: false, message: `Value cannot be ${operator} ${threshold}` };
      }
    }
  }

  // 3. Warning check
  if (warningOperator && warningValue !== undefined && warningValue !== '') {
    const numWarning = parseFloat(warningValue.toString());
    if (!isNaN(numWarning)) {
      let warned = false;
      if (warningOperator === '>') warned = numVal > numWarning;
      else if (warningOperator === '<') warned = numVal < numWarning;
      else if (warningOperator === '>=') warned = numVal >= numWarning;
      else if (warningOperator === '<=') warned = numVal <= numWarning;

      if (warned) {
        return {
          failed: false,
          warning: true,
          message: warningLabel ? `Warning: ${warningLabel}` : `Warning: Value is ${warningOperator} ${warningValue}`
        };
      }
    }
  }

  return { failed: false, warning: false, message: '' };
}

type EditableRowField = keyof Pick<ClusterFlatRow, 'category' | 'device' | 'parameter' | 'value' | 'bmsReading' | 'unit' | 'remarks'>;

const EMPTY_FIELD: ClusterFlatRow = {
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

const mergePreviousClusterData = (template: any, prevData: any) => {
  if (!prevData) return template;
  const cloned = JSON.parse(JSON.stringify(template));
  
  const normalizeParam = (val: any) => {
    if (typeof val === 'string') {
      return { value: val, bmsReading: '', remarks: '' };
    }
    return val || { value: '', bmsReading: '', remarks: '' };
  };

  Object.entries(prevData).forEach(([category, devices]: [string, any]) => {
    if (category === '__categoryRemarks__') return;
    if (cloned[category]) {
      Object.entries(devices).forEach(([device, params]: [string, any]) => {
        if (cloned[category][device]) {
          Object.entries(params).forEach(([param, raw]: [string, any]) => {
            if (cloned[category][device][param]) {
              const pPrev = normalizeParam(raw);
              const pCloned = cloned[category][device][param];
              if (typeof pCloned === 'string') {
                cloned[category][device][param] = pPrev.value;
              } else {
                cloned[category][device][param] = {
                  ...pCloned,
                  value: pPrev.value || '',
                  bmsReading: pPrev.bmsReading || '',
                  remarks: pPrev.remarks || '',
                };
              }
            }
          });
        }
      });
    }
  });
  if (prevData.__categoryRemarks__) {
    cloned.__categoryRemarks__ = prevData.__categoryRemarks__;
  }
  return cloned;
};

interface AutoGrowingTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
}

const AutoGrowingTextarea: React.FC<AutoGrowingTextareaProps> = ({ value, onChange, style, ...props }) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  React.useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange?.(e);
        adjustHeight();
      }}
      style={{
        resize: 'none',
        overflowY: 'hidden',
        ...style,
      }}
      {...props}
    />
  );
};

const ClusterChecklist: React.FC = () => {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const token = useSelector((state: RootState) => state.auth.token);
  const isSuperuser = useSelector((state: RootState) => state.auth.isSuperuser);
  const privileges = useSelector((state: RootState) => state.auth.privileges);
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

  const [selectedDate, setSelectedDate] = useState<string>(getServerTime().format('YYYY-MM-DD'));

  const canView = hasAnyPrivilege([PRIVILEGES.CLUSTER_CHECKLIST_VIEW, PRIVILEGES.CLUSTER_CHECKLIST_VIEW_ALL_DEPT]);
  const canCreate = hasPrivilege(PRIVILEGES.CLUSTER_CHECKLIST_CREATE);
  const canUpdate = hasPrivilege(PRIVILEGES.CLUSTER_CHECKLIST_UPDATE);
  const canDelete = hasPrivilege(PRIVILEGES.CLUSTER_CHECKLIST_DELETE);
  const canEditFields = hasPrivilege(PRIVILEGES.CLUSTER_CHECKLIST_FIELD_EDIT);
  const canViewAllDept = isSuperuser || hasPrivilege(PRIVILEGES.CLUSTER_CHECKLIST_VIEW_ALL_DEPT, privileges || []);
  const canOpenForEdit = canUpdate || canEditFields;
  const canSaveDraft = canUpdate || canEditFields || canCreate;

  const todayStr = getServerTime().format('YYYY-MM-DD');
  const isPastDaySelected = dayjs(selectedDate).isBefore(todayStr, 'day');
  const isFutureDaySelected = dayjs(selectedDate).isAfter(todayStr, 'day');

  const [templateConfig, setTemplateConfig] = useState<any>(DEFAULT_CLUSTER_CONFIG);

  const loadTemplate = useCallback(async () => {
    try {
      const res = await fetchClusterChecklistConfig({ department: userDepartment });
      if (res && res.template && Object.keys(res.template).length > 0) {
        setTemplateConfig(res.template);
      } else {
        setTemplateConfig(DEFAULT_CLUSTER_CONFIG);
      }
    } catch {
      setTemplateConfig(DEFAULT_CLUSTER_CONFIG);
    }
  }, [userDepartment]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const [departments, setDepartments] = useState<any[]>([]);
  const loadDepartments = useCallback(async () => {
    try {
      const res = await request.get('/api/departments', {
        params: { pagination: false }
      });
      if (res.data && res.data.data) {
        setDepartments(res.data.data.map((d: any) => ({ id: d.id || d._id, name: d.name })));
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  // Tab state: 0 = Active Checklist, 1 = History
  const [activeTab, setActiveTab] = useState(0);

  // Active checklist
  const [checklist, setChecklist] = useState<SavedClusterChecklist | null>(null);
  const [rows, setRows] = useState<ClusterFlatRow[]>([]);
  const [preparedBy, setPreparedBy] = useState('');

  const checkCanEdit = useCallback((chk: SavedClusterChecklist): boolean => {
    const todayStr = getServerTime().format('YYYY-MM-DD');
    const isToday = chk.date === todayStr;
    const isFuture = dayjs(chk.date).isAfter(todayStr, 'day');
    const diffDays = Math.abs(dayjs(todayStr).diff(dayjs(chk.date), 'day'));
    const isCompleted = chk.status === 'Completed';

    if (isSuperuser) {
      return !isFuture;
    }

    if (diffDays > 1) {
      return false;
    }

    if (isCompleted) {
      const completer = chk.completedBy || chk.createdBy;
      return completer === username;
    }

    if (isToday || diffDays <= 1) {
      return true;
    }
    return false;
  }, [isSuperuser, username]);

  const isViewOnlyMode = useMemo(() => {
    if (!checklist) return false;
    const todayStr = getServerTime().format('YYYY-MM-DD');
    const diffDays = Math.abs(dayjs(todayStr).diff(dayjs(checklist.date), 'day'));

    if (isSuperuser) {
      return isFutureDaySelected;
    }

    if (diffDays > 1) {
      return true;
    }
    if (checklist.status === 'Completed') {
      const completer = checklist.completedBy || checklist.createdBy;
      return completer !== username;
    }
    if (isFutureDaySelected) return true;
    if (isPastDaySelected && diffDays > 1) return true;

    return false;
  }, [checklist, isFutureDaySelected, isPastDaySelected, isSuperuser, username]);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [emailList, setEmailList] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [hasMappedEmails, setHasMappedEmails] = useState(false);
  const [dailyChecklistMailEnabled, setDailyChecklistMailEnabled] = useState(true);

  useEffect(() => {
    const checkMappedEmails = async () => {
      try {
        const res = await request.get('/api/mail-config/saved-emails?module=daily');
        if (Array.isArray(res.data) && res.data.length > 0) {
          setHasMappedEmails(true);
          setEmailList(res.data.join(', '));
        }
      } catch (err) {
        console.error("Error checking mapped emails:", err);
      }
    };
    checkMappedEmails();

    const checkMailEnabled = async () => {
      try {
        const res = await request.get('/api/mail-config/checklist-mail-enabled');
        setDailyChecklistMailEnabled(res.data.dailyEnabled !== false);
      } catch (e) {
        console.error("Error checking checklist mail enabled:", e);
      }
    };
    checkMailEnabled();
  }, []);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [collapsedDevs, setCollapsedDevs] = useState<Set<string>>(new Set());
  const [categoryRemarks, setCategoryRemarks] = useState<{[cat: string]: string}>({});
  const [viewCategoryRemarks, setViewCategoryRemarks] = useState<{[cat: string]: string}>({});
  const [filterCategory, setFilterCategory] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const darkMode = false;
  const [currentTime, setCurrentTime] = useState(getServerTime().format('HH:mm:ss'));
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [newField, setNewField] = useState<ClusterFlatRow>(EMPTY_FIELD);
  const [newParameterUnits, setNewParameterUnits] = useState<ParameterUnitDraft[]>([{ ...EMPTY_PARAMETER_UNIT }]);

  // History
  const [history, setHistory] = useState<SavedClusterChecklist[]>([]);
  const [viewingChecklist, setViewingChecklist] = useState<SavedClusterChecklist | null>(null);
  const [viewRows, setViewRows] = useState<ClusterFlatRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // ─── Load History ───
  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetchClusterChecklists({ department: canViewAllDept ? undefined : userDepartment });
      setHistory(res.data || []);
    } catch {
      setHistory([]);
    }
  }, [userDepartment, isSuperuser, privileges]);

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
      setCurrentTime(getServerTime().format('HH:mm:ss'));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  // ─── Load Checklist for selected date ───
  const loadChecklistForDate = useCallback(async (dateStr: string) => {
    try {
      const res = await fetchClusterChecklists({
        department: userDepartment,
        date: dateStr,
        limit: 1,
      });
      if (res && res.data && res.data.length > 0) {
        const existing = res.data[0];
        setChecklist(existing);
        setRows(flattenClusterConfig(existing.data));
        setPreparedBy(existing.preparedBy);
        setCategoryRemarks(existing.data?.__categoryRemarks__ || {});
      } else {
        setChecklist(null);
        setRows([]);
        setPreparedBy('');
        setCategoryRemarks({});
      }
    } catch {
      setChecklist(null);
      setRows([]);
      setPreparedBy('');
      setCategoryRemarks({});
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

    const todayStr = getServerTime().format('YYYY-MM-DD');
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
      const res = await fetchClusterChecklists({
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

    // Fetch the previous checklist's data to auto-populate
    let prevChecklistData = null;
    try {
      const resPrev = await fetchClusterChecklists({
        department: userDepartment,
        limit: 50,
      });
      if (resPrev && resPrev.data && resPrev.data.length > 0) {
        const found = resPrev.data.find((cl: any) => dayjs(cl.date).isBefore(dayjs(selectedDate), 'day'));
        if (found) {
          prevChecklistData = found.data;
        }
      }
    } catch (prevErr) {
      console.warn("Failed to fetch previous Cluster checklist:", prevErr);
    }

    const mergedConfig = mergePreviousClusterData(templateConfig, prevChecklistData);
    const newCl = createNewClusterChecklist(displayName, mergedConfig, userDepartment, username, selectedDate);
    setChecklist(newCl);
    setRows(flattenClusterConfig(newCl.data));
    setCategoryRemarks(newCl.data?.__categoryRemarks__ || {});
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
      if (cl.department && cl.department !== userDepartment && !isSuperuser) {
        showToast('Access Denied: This checklist belongs to another department.', 'error');
        return;
      }
      setChecklist(cl);
      setRows(flattenClusterConfig(cl.data));
      setCategoryRemarks(cl.data?.__categoryRemarks__ || {});
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
      if (cl.department && cl.department !== userDepartment && !canViewAllDept) {
        showToast('Access Denied: This checklist belongs to another department.', 'error');
        return;
      }
      setViewingChecklist(cl);
      setViewRows(flattenClusterConfig(cl.data));
      setViewCategoryRemarks(cl.data?.__categoryRemarks__ || {});
    }
  };

  // ─── Save ───
  const handleSave = async (status: 'Draft' | 'Completed' = 'Draft') => {
    if (!checklist || (status === 'Completed' ? !canUpdate : !canSaveDraft)) return;

    if (!checkCanEdit(checklist)) {
      const todayStr = getServerTime().format('YYYY-MM-DD');
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

    if (status === 'Completed') {
      let hasErrors = false;
      const errorsList: string[] = [];
      const warningsList: string[] = [];

      rows.forEach(row => {
        const checkRes = checkRuleFailure(row.value, row.ruleOperator, row.ruleValue, row.maxValue, row.warningOperator, row.warningValue, row.warningLabel, row.rules);
        if (checkRes.failed) {
          hasErrors = true;
          errorsList.push(`${row.device} -> ${row.parameter}: ${checkRes.message}`);
        } else if (checkRes.warning) {
          warningsList.push(`${row.device} -> ${row.parameter}: ${checkRes.message}`);
        }
      });

      if (hasErrors) {
        showToast(`Cannot submit checklist due to validation errors:\n${errorsList.join('\n')}`, 'error');
        return;
      }

      if (warningsList.length > 0) {
        const confirmed = await confirm(
          `There are validation warnings:\n${warningsList.join('\n')}\n\nDo you want to proceed and submit anyway?`,
          'Validation Warnings'
        );
        if (!confirmed) {
          return;
        }
      }
    }

    const updatedConfig = unflattenClusterRows(rows);
    if (Object.keys(categoryRemarks).length > 0) {
      (updatedConfig as any).__categoryRemarks__ = categoryRemarks;
    }
    const updated: SavedClusterChecklist = {
      ...checklist,
      time: currentTime,
      preparedBy,
      status,
      data: updatedConfig,
      updatedAt: getServerTime().toDate().toISOString(),
    };
    if (status === 'Completed') {
      updated.completedBy = username;
    } else if (checklist.status === 'Completed') {
      updated.completedBy = checklist.completedBy || username;
    }

    try {
      let savedCl: SavedClusterChecklist;
      const clId = checklist.id || (checklist as any)._id;
      const exists = clId && !clId.startsWith('cluster_');
      if (exists) {
        savedCl = await updateClusterChecklist(clId, updated);
      } else {
        savedCl = await createClusterChecklist(updated);
      }
      setChecklist(savedCl);
      showToast(status === 'Completed' ? 'Checklist marked as completed!' : 'Draft saved successfully!', 'success');
      refreshHistory();
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || 'Failed to save checklist';
      showToast(errMsg, 'error');
    }
  };

  const handleSendEmail = async () => {
    if (!checklist) return;
    const clId = checklist.id || (checklist as any)._id;
    if (!clId || clId.startsWith('cluster_')) {
      showToast('Please save the checklist as a draft or complete it first.', 'warning');
      return;
    }
    if (!emailList) {
      showToast('Please enter at least one email address.', 'warning');
      return;
    }
    const isConfirmed = await confirm(
      `Are you sure you want to send this Cluster checklist report to the following email(s)?\n\n${emailList}`,
      "Confirm Send Email"
    );
    if (!isConfirmed) return;

    try {
      setEmailLoading(true);
      let slNo = 0;
      const pdfRows = rows.map(row => {
        slNo++;
        return [slNo, row.category, row.device, row.parameter, row.value || '-', row.unit || '-', row.remarks || '-'];
      });
      const pdfBase64 = await exportChecklistPdf({
        title: 'Cluster Checklist',
        date: checklist.date,
        time: checklist.time,
        preparedBy: checklist.preparedBy,
        status: checklist.status,
        department: departments.find(d => d.id === checklist.department)?.name || checklist.department,
        completedBy: checklist.completedBy,
        columns: ['#', 'Category', 'Fields Group', 'Parameter', 'Value', 'Unit', 'Remarks'],
        rows: pdfRows,
        categoryRemarks: categoryRemarks,
        fileName: `Cluster_Checklist_${checklist.date}`,
        includeDaySummary: true,
        outputBase64: true,
      });

      await request.post(`/api/cluster-checklists/${clId}/send-email`, {
        emails: emailList,
        pdfBase64: pdfBase64
      });
      showToast('Checklist email sent successfully!', 'success');
      setEmailList('');
    } catch (e: any) {
      console.error(e);
      showToast(e.response?.data?.detail || 'Failed to send email.', 'error');
    } finally {
      setEmailLoading(false);
    }
  };

  // ─── Delete ───
  const handleDeleteConfirm = async () => {
    if (deleteTarget && canDelete) {
      try {
        await deleteClusterChecklist(deleteTarget);
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
        const todayStr = getServerTime().format('YYYY-MM-DD');
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
          timestamp: getServerTime().toDate().toISOString(),
        };
      }
      return updated;
    });
  };

  const handleAddField = () => {
    if (!canCreate) return;
    const category = newField.category.trim();
    const device = newField.device.trim();
    let parameters = newParameterUnits
      .map(item => ({
        parameter: item.parameter.trim(),
        unit: item.unit.trim(),
      }))
      .filter(item => item.parameter);

    if (!parameters.length) {
      parameters = [{ parameter: '', unit: '' }];
    }

    if (!category || !device) return;

    const paramNames = parameters.map(p => p.parameter.toLowerCase());
    const duplicates = paramNames.filter((item, index) => paramNames.indexOf(item) !== index);
    if (duplicates.length > 0) {
      showToast(`Duplicate parameters are not allowed: ${Array.from(new Set(duplicates)).join(', ')}`, 'error');
      return;
    }

    const timestamp = getServerTime().toDate().toISOString();
    const newRows = parameters.map(({ parameter, unit }): ClusterFlatRow => ({
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
        const todayStr = getServerTime().format('YYYY-MM-DD');
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

    const headers = ['SL No', 'Category Name', 'Fields Group', 'Parameter', 'Cluster Reading', 'Remarks'];
    const csvRows = [headers.map(escapeCSV).join(',')];

    rows.forEach((row, index) => {
      const valueStr = `${row.value || ''}${row.unit ? ` ${row.unit}` : ''}`.trim();
      const csvRow = [
        (index + 1).toString(),
        row.category || '',
        row.device || '',
        row.parameter || '',
        valueStr,
        row.remarks || ''
      ];
      csvRows.push(csvRow.map(escapeCSV).join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Cluster_Checklist_${checklist.date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV exported successfully!', 'success');
  };

  // ─── Build grouped structure for table rendering ───
  const groupedData = useMemo(() => {
    const groups: { category: string; devices: { device: string; params: (ClusterFlatRow & { filteredIdx: number })[] }[] }[] = [];
    const catMap = new Map<string, Map<string, (ClusterFlatRow & { filteredIdx: number })[]>>();

    filteredRows.forEach((row, idx) => {
      if (!catMap.has(row.category)) catMap.set(row.category, new Map());
      const devMap = catMap.get(row.category)!;
      if (!devMap.has(row.device)) devMap.set(row.device, []);
      devMap.get(row.device)!.push({ ...row, filteredIdx: idx });
    });

    catMap.forEach((devMap, category) => {
      const devices: { device: string; params: (ClusterFlatRow & { filteredIdx: number })[] }[] = [];
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
    let deviations = 0;
    return { total, filled, deviations };
  }, [rows]);

  // ─── Render Checklist Table ───
  const renderChecklistTable = (
    data: typeof groupedData,
    canEditValues: boolean,
    onUpdate?: (index: number, field: EditableRowField, val: string) => void,
    allowDelete = false,
    remarksMap: {[cat: string]: string} = {}
  ) => {
    let slNo = 0;
    return (
      <table className={styles.container__table}>
        <thead>
          <tr>
            <th style={{ width: 45 }}>SL</th>
            <th>Category Name</th>
            <th>Fields Group</th>
            <th>Parameter</th>
            <th style={{ width: 150 }}>Cluster Reading</th>
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
                  <td colSpan={allowDelete ? 7 : 6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
                      <span className={`${styles.container__chevron} ${!isCatCollapsed ? styles.open : ''}`}>
                        {isCatCollapsed ? <MdChevronRight /> : <MdExpandMore />}
                      </span>
                      <span style={{ fontWeight: 700 }}>
                        {catGroup.category}
                      </span>
                      <Chip
                        label={`${catGroup.devices.reduce((a, d) => a + d.params.length, 0)} params`}
                        size="small"
                        sx={{ height: 20, fontSize: 10, fontWeight: 600 }}
                      />
                      
                      <Box sx={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }} onClick={(e: any) => e.stopPropagation()}>
                        <Typography variant="caption" sx={{ color: '#d97706', fontWeight: 700, mb: 0.5, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          ⚠ Warning / Remarks
                        </Typography>
                        <AutoGrowingTextarea
                          placeholder="Enter warnings or remarks here..."
                          value={remarksMap[catGroup.category] || ''}
                          onChange={(e: any) => {
                            const val = e.target.value;
                            if (onUpdate) {
                              setCategoryRemarks(prev => ({ ...prev, [catGroup.category]: val }));
                            } else {
                              setViewCategoryRemarks(prev => ({ ...prev, [catGroup.category]: val }));
                            }
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            width: '320px',
                            fontSize: '12px',
                            fontWeight: 'normal',
                            color: '#334155',
                            backgroundColor: '#ffffff',
                            minHeight: '40px',
                            fontFamily: 'inherit',
                            outline: 'none',
                          }}
                          disabled={!canEditValues}
                        />
                      </Box>
                    </Box>
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
                        <td colSpan={allowDelete ? 7 : 6}>
                          <span className={`${styles.container__chevron} ${!isDevCollapsed ? styles.open : ''}`}>
                            {isDevCollapsed ? <MdChevronRight /> : <MdExpandMore />}
                          </span>
                          {devGroup.device}
                        </td>
                      </tr>

                      {!isDevCollapsed && devGroup.params.map((row) => {
                        if (row.parameter === '') return null;
                        slNo++;
                        const deviation = false;
                        const checkRes = checkRuleFailure(row.value, row.ruleOperator, row.ruleValue, row.maxValue, row.warningOperator, row.warningValue, row.warningLabel, row.rules);
                        const tdStyle = checkRes.failed
                          ? { backgroundColor: '#fee2e2' }
                          : checkRes.warning
                            ? { backgroundColor: '#fffbeb' }
                            : {};
                        const inputStyle = checkRes.failed
                          ? { color: '#dc2626', fontWeight: 'bold', border: '1px solid #dc2626', backgroundColor: '#fee2e2' }
                          : checkRes.warning
                            ? { color: '#b45309', fontWeight: 'bold', border: '1px solid #d97706', backgroundColor: '#fffbeb' }
                            : {};
                        const spanStyle = checkRes.failed
                          ? { color: '#dc2626', fontWeight: 'bold' }
                          : checkRes.warning
                            ? { color: '#b45309', fontWeight: 'bold' }
                            : {};

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
                            <td style={tdStyle}>
                              {canEditValues ? (
                                <input
                                  type="text"
                                  value={row.value}
                                  onChange={(e) => onUpdate?.(row.filteredIdx, 'value', e.target.value)}
                                  placeholder="—"
                                  style={inputStyle}
                                />
                              ) : (
                                <span style={spanStyle}>{row.value || '—'}</span>
                              )}
                              {(checkRes.failed || checkRes.warning) && (
                                <Tooltip title={checkRes.message}>
                                  <span style={{ color: checkRes.failed ? '#ef4444' : '#d97706', backgroundColor: checkRes.failed ? '#fee2e2' : '#fef3c7', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8em', fontWeight: 'bold', marginLeft: '6px', cursor: 'pointer' }}>
                                    ⚠ {checkRes.failed ? 'Failed' : 'Warning'}
                                  </span>
                                </Tooltip>
                              )}
                            </td>
                            <td>
                              {canEditValues ? (
                               <AutoGrowingTextarea
                                  value={row.remarks}
                                  onChange={(e: any) => onUpdate?.(row.filteredIdx, 'remarks', e.target.value)}
                                  placeholder="Add remark..."
                                />
                              ) : (
                                <span style={{ whiteSpace: 'pre-wrap' }}>{row.remarks || '—'}</span>
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
    allowDelete = false,
    remarksMap: {[cat: string]: string} = {}
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
                  sx={{ ml: 1, height: 20, fontSize: 10, fontWeight: 600 }}
                />

                <Box sx={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }} onClick={(e: any) => e.stopPropagation()}>
                  <Typography variant="caption" sx={{ color: '#d97706', fontWeight: 700, mb: 0.5, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ⚠ Warning / Remarks
                  </Typography>
                  <AutoGrowingTextarea
                    placeholder="Enter warnings or remarks here..."
                    value={remarksMap[catGroup.category] || ''}
                    onChange={(e: any) => {
                      const val = e.target.value;
                      if (onUpdate) {
                        setCategoryRemarks(prev => ({ ...prev, [catGroup.category]: val }));
                      } else {
                        setViewCategoryRemarks(prev => ({ ...prev, [catGroup.category]: val }));
                      }
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      width: '320px',
                      fontSize: '12px',
                      fontWeight: 'normal',
                      color: '#334155',
                      backgroundColor: '#ffffff',
                      minHeight: '40px',
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                    disabled={!canEditValues}
                  />
                </Box>
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
                          if (row.parameter === '') return null;
                          slNo++;
                          const deviation = false;

                          const checkRes = checkRuleFailure(row.value, row.ruleOperator, row.ruleValue, row.maxValue, row.warningOperator, row.warningValue, row.warningLabel, row.rules);
                          const cardStyle = checkRes.failed
                            ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' }
                            : checkRes.warning
                              ? { borderColor: '#f59e0b', backgroundColor: '#fffbeb' }
                              : {};
                          const inputStyle = checkRes.failed
                            ? { color: '#dc2626', fontWeight: 'bold', border: '1px solid #dc2626', backgroundColor: '#fee2e2' }
                            : checkRes.warning
                              ? { color: '#b45309', fontWeight: 'bold', border: '1px solid #d97706', backgroundColor: '#fffbeb' }
                              : {};
                          const strongStyle = checkRes.failed
                            ? { color: '#dc2626' }
                            : checkRes.warning
                              ? { color: '#b45309' }
                              : {};

                          return (
                            <article
                              key={`${row.category}-${row.device}-${row.parameter}`}
                              className={`${styles.container__paramCard} ${deviation ? styles.deviation : ''}`}
                              style={cardStyle}
                            >
                              <div className={styles['container__paramCard--top']}>
                                <span>#{slNo}</span>
                                {(checkRes.failed || checkRes.warning) && (
                                  <Tooltip title={checkRes.message}>
                                    <span style={{ color: checkRes.failed ? '#ef4444' : '#d97706', backgroundColor: checkRes.failed ? '#fee2e2' : '#fef3c7', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8em', fontWeight: 'bold', cursor: 'pointer', marginRight: '6px' }}>
                                      ⚠ {checkRes.failed ? 'Failed' : 'Warning'}
                                    </span>
                                  </Tooltip>
                                )}
                              </div>
                              <h4>
                                {row.parameter}
                                {row.unit && <span>{row.unit}</span>}
                              </h4>
                              <div className={styles['container__paramCard--fields']}>
                                <label>
                                  Cluster Reading
                                  {canEditValues ? (
                                    <input
                                      type="text"
                                      value={row.value}
                                      onChange={(e) => onUpdate?.(row.filteredIdx, 'value', e.target.value)}
                                      placeholder="-"
                                      style={inputStyle}
                                    />
                                  ) : (
                                    <strong style={strongStyle}>{row.value || '-'}</strong>
                                  )}
                                </label>
                                <label>
                                  Remarks
                                  {canEditValues ? (
                                    <AutoGrowingTextarea
                                      value={row.remarks}
                                      onChange={(e: any) => onUpdate?.(row.filteredIdx, 'remarks', e.target.value)}
                                      placeholder="Add remark..."
                                    />
                                  ) : (
                                    <strong style={{ whiteSpace: 'pre-wrap' }}>{row.remarks || '-'}</strong>
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
    const catMap = new Map<string, Map<string, (ClusterFlatRow & { filteredIdx: number })[]>>();
    viewRows.forEach((row, idx) => {
      if (!catMap.has(row.category)) catMap.set(row.category, new Map());
      const devMap = catMap.get(row.category)!;
      if (!devMap.has(row.device)) devMap.set(row.device, []);
      devMap.get(row.device)!.push({ ...row, filteredIdx: idx });
    });
    catMap.forEach((devMap, category) => {
      const devices: { device: string; params: (ClusterFlatRow & { filteredIdx: number })[] }[] = [];
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
            You need the View Cluster Checklist privilege to open this page.
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
          Daily Cluster Checklist
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
                    placeholder="Search fields group, parameter..."
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
                  
                  {checklist && dailyChecklistMailEnabled && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, borderLeft: '1px solid #cbd5e1', pl: 2, ml: 1 }}>
                      {!hasMappedEmails && (
                        <EmailSelectInput
                          placeholder="Mails..."
                          value={emailList}
                          onChange={(val) => setEmailList(val)}
                          department={departments.find(d => d.id === checklist?.department)?.name || checklist?.department || 'General'}
                          module="daily"
                          size="small"
                          height="36.5px"
                          width="180px"
                        />
                      )}
                      <Button
                        variant="contained"
                        onClick={handleSendEmail}
                        disabled={emailLoading || !emailList}
                        sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px', height: '36.5px', fontSize: '11px', whiteSpace: 'nowrap' }}
                      >
                        {emailLoading ? "Sending..." : "Send Mail"}
                      </Button>
                    </Box>
                  )}
                </Box>
              </Box>

              {viewMode === 'table'
                ? renderChecklistTable(groupedData, canUpdate && !isViewOnlyMode, updateRow, false, categoryRemarks)
                : renderChecklistCards(groupedData, canUpdate && !isViewOnlyMode, updateRow, false, categoryRemarks)}

              <DaySummary date={selectedDate} />
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
                    : 'Create a new checklist to start recording cluster checklist data, or open one from history.'}
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
                  <h4>Cluster Checklist — {dayjs(cl.date).format('DD MMM YYYY')} ({departments.find(d => d.id === cl.department)?.name || cl.department || 'General'})</h4>
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
                  {canOpenForEdit && checkCanEdit(cl) && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      onClick={() => handleOpenChecklist(cl.id)}
                      sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '6px' }}
                    >
                      Edit
                    </Button>
                  )}
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
              Cluster Checklist — {dayjs(viewingChecklist.date).format('DD MMM YYYY')} ({departments.find(d => d.id === viewingChecklist.department)?.name || viewingChecklist.department || 'General'})
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
              {renderChecklistTable(viewGrouped, false, undefined, false, viewCategoryRemarks)}
              <DaySummary date={viewingChecklist.date} />
            </DialogContent>
            <DialogActions>
              <Button
                variant="outlined"
                startIcon={<MdDownload />}
                onClick={() => {
                  if (!viewingChecklist || !viewRows.length) return;
                  let slNo = 0;
                  const pdfRows = viewRows.map(row => {
                    slNo++;
                    return [slNo, row.category, row.device, row.parameter, row.value || '-', row.unit || '-', row.remarks || '-'];
                  });
                  exportChecklistPdf({
                    title: 'Cluster Checklist',
                    date: viewingChecklist.date,
                    time: viewingChecklist.time,
                    preparedBy: viewingChecklist.preparedBy,
                    status: viewingChecklist.status,
                    department: departments.find(d => d.id === viewingChecklist.department)?.name || viewingChecklist.department,
                    completedBy: viewingChecklist.completedBy,
                    columns: ['#', 'Category', 'Fields Group', 'Parameter', 'Value', 'Unit', 'Remarks'],
                    rows: pdfRows,
                    categoryRemarks: viewCategoryRemarks,
                    fileName: `Cluster_Checklist_${viewingChecklist.date}`,
                    includeDaySummary: true,
                  });
                }}
                sx={{ textTransform: 'none', mr: 1 }}
              >
                Export PDF
              </Button>
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
              Category Name
              <input
                list="cluster-categories"
                value={newField.category}
                onChange={(e) => setNewField(prev => ({ ...prev, category: e.target.value }))}
                placeholder="VMware Cluster"
              />
            </label>
            <datalist id="cluster-categories">
              {categories.map(category => <option key={category} value={category} />)}
            </datalist>
            <label>
              Fields Group
              <input
                list="cluster-devices"
                value={newField.device}
                onChange={(e) => setNewField(prev => ({ ...prev, device: e.target.value }))}
                placeholder="VDI Cluster"
              />
            </label>
            <datalist id="cluster-devices">
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
                    placeholder="Host Nodes"
                  />
                  <input
                    value={item.unit}
                    onChange={(e) => updateParameterUnit(index, 'unit', e.target.value)}
                    placeholder="Nodes"
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
              Cluster Reading
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
            disabled={!newField.category.trim() || !newField.device.trim()}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Add Field
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClusterChecklist;
