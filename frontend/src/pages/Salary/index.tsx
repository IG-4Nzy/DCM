// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { Box, Button, Typography, IconButton, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Collapse, Card, CardContent, Tooltip, Paper, Tabs, Tab, MenuItem, Select, FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Switch, Accordion, AccordionSummary, AccordionDetails, Chip, Drawer, Divider } from '@mui/material';
import TextField from '../../components/TextField';
import {
  MdAdd as AddIcon,
  MdDeleteOutline as DeleteIcon,
  MdExpandMore as ExpandMoreIcon,
  MdExpandLess as ExpandLessIcon,
  MdEdit as EditIcon,
  MdCheck as CheckIcon,
  MdChevronLeft as ChevronLeftIcon,
  MdChevronRight as ChevronRightIcon,
  MdAccountBalanceWallet as WalletIcon,
  MdSettings as SettingsIcon,
  MdPrint as PrintIcon,
  MdClose as CloseIcon,
  MdCalendarToday as CalendarTodayIcon,
  MdCardGiftcard as GiftIcon,
  MdRefresh as RefreshIcon,
  MdSync as SyncIcon,
  MdHistory as HistoryIcon,
  MdEmail as MailIcon,
  MdPeople as PeopleIcon,
  MdAttachMoney as MoneyIcon,
  MdLock as LockIcon,
  MdLockOpen as LockOpenIcon,
  MdReceiptLong as ReceiptIcon
} from 'react-icons/md';
import dayjs from 'dayjs';
import request from '../../services/request';
import { useSelector } from 'react-redux';
import { type RootState } from '../../store';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import type { Activity, Template, Member, Group } from './types';
import SalarySplitupModal from './components/SalarySplitupModal';
import { exportHtmlToPdfBase64 } from '../../helpers/exportRosterPdf';

export const distributeInitialConsumedAmount = (
  templateInitialConsumedAmount: number,
  activities: any[],
  maxStaffs: number,
  remainingMonths: number
) => {
  const futureCapacity = maxStaffs * remainingMonths * 30;

  // Calculate limit amounts for each activity
  const limits = activities.map(act => {
    const rate = Number(act.rate) || 0;
    const maxUnits = Number(act.maxUnits) || 0;
    const maxAmount = maxUnits * rate;
    const capForFuture = Math.max(0, maxUnits - futureCapacity);
    const capAmountForFuture = capForFuture * rate;
    return {
      id: act.id,
      rate,
      maxUnits,
      maxAmount,
      capAmountForFuture
    };
  });

  const distributedAmount: Record<string, number> = {};
  activities.forEach(act => {
    distributedAmount[act.id] = 0;
  });

  let remainingToDistribute = templateInitialConsumedAmount;

  // First pass: distribute up to capAmountForFuture proportionally
  const totalCapAmountForFuture = limits.reduce((sum, l) => sum + l.capAmountForFuture, 0);
  if (totalCapAmountForFuture > 0 && remainingToDistribute > 0) {
    const amountToDistribute = Math.min(remainingToDistribute, totalCapAmountForFuture);
    limits.forEach(l => {
      distributedAmount[l.id] += amountToDistribute * l.capAmountForFuture / totalCapAmountForFuture;
    });
    remainingToDistribute -= amountToDistribute;
  }

  // Second pass: distribute to remaining capacity up to maxAmount
  if (remainingToDistribute > 0) {
    const remainingCaps = limits.map(l => ({
      id: l.id,
      remCapAmount: Math.max(0, l.maxAmount - distributedAmount[l.id])
    }));
    const totalRemCapAmount = remainingCaps.reduce((sum, c) => sum + c.remCapAmount, 0);
    if (totalRemCapAmount > 0) {
      const amountToDistribute = Math.min(remainingToDistribute, totalRemCapAmount);
      remainingCaps.forEach(c => {
        distributedAmount[c.id] += amountToDistribute * c.remCapAmount / totalRemCapAmount;
      });
      remainingToDistribute -= amountToDistribute;
    }
  }

  // Now convert distributed amount (₹) back to units for each activity
  const distributedUnits: Record<string, number> = {};
  activities.forEach(act => {
    const rate = Number(act.rate) || 0;
    const distAmt = distributedAmount[act.id] || 0;
    distributedUnits[act.id] = rate > 0 ? distAmt / rate : 0;
  });

  return {
    distributedAmount,
    distributedUnits
  };
};

const Salary = () => {
  const { username, displayName, isSuperuser } = useSelector((state: RootState) => state.auth);
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const canView = isSuperuser ||
    hasPrivilege(PRIVILEGES.SALARY_CALCULATION_VIEW) ||
    hasPrivilege(PRIVILEGES.SALARY_CALCULATION_UPDATE) ||
    hasPrivilege(PRIVILEGES.SALARY_CALCULATION_CALCULATE);

  const canUpdateConfig = isSuperuser || hasPrivilege(PRIVILEGES.SALARY_CALCULATION_UPDATE);

  const canCalculate = isSuperuser ||
    hasPrivilege(PRIVILEGES.SALARY_CALCULATION_CALCULATE) ||
    hasPrivilege(PRIVILEGES.SALARY_CALCULATION_UPDATE);

  const canAddGroup = isSuperuser ||
    hasPrivilege(PRIVILEGES.SALARY_CALCULATION_CREATE) ||
    hasPrivilege(PRIVILEGES.SALARY_CALCULATION_UPDATE);

  const canDeleteGroup = isSuperuser ||
    hasPrivilege(PRIVILEGES.SALARY_CALCULATION_DELETE) ||
    hasPrivilege(PRIVILEGES.SALARY_CALCULATION_UPDATE);

  const [currentMonth, setCurrentMonth] = useState(dayjs().format('YYYY-MM'));
  const [salaryData, setSalaryData] = useState<Record<string, Group[]>>({});
  const [monthEditables, setMonthEditables] = useState<Record<string, boolean>>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [startDay, setStartDay] = useState<number>(1);
  const [endDay, setEndDay] = useState<number>(31);
  const [maxAllowedDays, setMaxAllowedDays] = useState<number>(26);
  const [activeTab, setActiveTab] = useState(0);
  const [customDates, setCustomDates] = useState<Record<string, { startDate?: string; endDate?: string }>>({});
  const [editingDates, setEditingDates] = useState(false);

  const isCurrentMonthEditable = !!monthEditables[currentMonth];

  const handleToggleMonthEditable = async (checked: boolean) => {
    try {
      await request.post(`/api/salary/${currentMonth}/toggle-editable`, { editable: checked });
      setMonthEditables(prev => ({
        ...prev,
        [currentMonth]: checked
      }));
      showToast(`Month ${dayjs(currentMonth).format('MMMM YYYY')} is now ${checked ? 'Editable' : 'Locked'}`, 'success');
    } catch (e) {
      showToast('Failed to toggle month editable status', 'error');
    }
  };

  const [globalCompanyName, setGlobalCompanyName] = useState('');
  const [globalPoNumber, setGlobalPoNumber] = useState('');
  const [globalPoStartDate, setGlobalPoStartDate] = useState('');
  const [globalPoEndDate, setGlobalPoEndDate] = useState('');
  const [isEditingGeneral, setIsEditingGeneral] = useState(false);
  const [tempCompanyName, setTempCompanyName] = useState('');
  const [tempPoNumber, setTempPoNumber] = useState('');
  const [tempPoStartDate, setTempPoStartDate] = useState('');
  const [tempPoEndDate, setTempPoEndDate] = useState('');

  const [splitupGroup, setSplitupGroup] = useState<Group | null>(null);
  const [reserveModalOpen, setReserveModalOpen] = useState(false);
  const [reserveTargetTemplateId, setReserveTargetTemplateId] = useState<string | null>(null);
  const [reserveTypeState, setReserveTypeState] = useState<'percentage' | 'amount'>('percentage');
  const [reserveValueState, setReserveValueState] = useState<string>('5');
  const [showSalaryPrint, setShowSalaryPrint] = useState(false);
  const [showAllSplitupsModal, setShowAllSplitupsModal] = useState(false);

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [accountsMailEnabled, setAccountsMailEnabled] = useState(true);

  // Bonus tracker state variables
  const [bonusEntries, setBonusEntries] = useState<any[]>([]);
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  const [editingBonusEntry, setEditingBonusEntry] = useState<any | null>(null);
  const [bonusFormName, setBonusFormName] = useState('');
  const [bonusFormAmount, setBonusFormAmount] = useState<string>('0');
  const [bonusFormNotes, setBonusFormNotes] = useState('');
  const [bonusConfigAmount, setBonusConfigAmount] = useState<string>('1000');
  const [bonusHistory, setBonusHistory] = useState<any[]>([]);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [expandedBonusRowIds, setExpandedBonusRowIds] = useState<string[]>([]);

  const toggleExpandBonusRow = (id: string) => {
    setExpandedBonusRowIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const isAllActiveAddedThisMonth = useMemo(() => {
    const activeEntries = bonusEntries.filter(e => !e.resigned);
    if (activeEntries.length === 0) return true;
    const currentMonthStr = dayjs().format('YYYY-MM');
    return activeEntries.every(e => e.lastAddedMonth === currentMonthStr);
  }, [bonusEntries]);

  const fetchBonusEntries = async () => {
    try {
      const [res, historyRes] = await Promise.all([
        request.get('/api/salary/bonus'),
        request.get('/api/salary/bonus/history')
      ]);
      if (res.data) {
        setBonusEntries(res.data);
      }
      if (historyRes.data) {
        setBonusHistory(historyRes.data);
      }
    } catch (e) {
      console.error("Failed to fetch bonus entries and history", e);
    }
  };

  const handleOpenAddBonus = () => {
    setEditingBonusEntry(null);
    setBonusFormName('');
    setBonusFormAmount('0');
    setBonusFormNotes('');
    setIsBonusModalOpen(true);
  };

  const handleOpenEditBonus = (entry: any) => {
    setEditingBonusEntry(entry);
    setBonusFormName(entry.name);
    setBonusFormAmount(String(entry.accumulatedAmount));
    setBonusFormNotes(entry.notes || '');
    setIsBonusModalOpen(true);
  };

  const handleSaveBonusEntry = async () => {
    if (!bonusFormName.trim()) {
      showToast('Employee name is required', 'error');
      return;
    }
    try {
      const id = editingBonusEntry ? editingBonusEntry.id : Date.now().toString();
      const payload = {
        id,
        name: bonusFormName,
        accumulatedAmount: Number(bonusFormAmount) || 0,
        notes: bonusFormNotes,
        resigned: editingBonusEntry ? editingBonusEntry.resigned : false,
        month: currentMonth,
        period: displayPeriod
      };
      await request.post('/api/salary/bonus', payload);
      showToast(editingBonusEntry ? 'Bonus entry updated' : 'Bonus entry created', 'success');
      setIsBonusModalOpen(false);
      fetchBonusEntries();
    } catch (e) {
      showToast('Failed to save bonus entry', 'error');
    }
  };

  const handleDeleteBonusEntry = async (id: string, name: string) => {
    if (await confirm(`Are you sure you want to delete ${name} from the bonus tracker?`, 'Delete Entry')) {
      try {
        await request.delete(`/api/salary/bonus/${id}`);
        showToast('Bonus entry deleted', 'success');
        fetchBonusEntries();
      } catch (e) {
        showToast('Failed to delete bonus entry', 'error');
      }
    }
  };

  const handleToggleResign = async (entry: any) => {
    const actionText = entry.resigned ? 'activate' : 'resign';
    const confirmTitle = entry.resigned ? 'Activate Employee' : 'Resign Employee';
    if (await confirm(`Are you sure you want to ${actionText} ${entry.name}?`, confirmTitle)) {
      try {
        await request.post(`/api/salary/bonus/resign/${entry.id}`);
        showToast(`${entry.name} is now marked as ${entry.resigned ? 'active' : 'resigned'}`, 'success');
        fetchBonusEntries();
      } catch (e) {
        showToast('Failed to toggle resigned status', 'error');
      }
    }
  };

  const handleQuickAdd = async (entry: any) => {
    if (entry.resigned) {
      showToast(`Cannot add bonus to resigned employee`, 'error');
      return;
    }
    const currentMonthStr = dayjs().format('YYYY-MM');
    if (entry.lastAddedMonth === currentMonthStr) {
      showToast(`Already added ₹${bonusConfigAmount} for ${entry.name} this month`, 'warning');
      return;
    }
    try {
      const addAmount = Number(bonusConfigAmount) || 1000;
      const payload = {
        ...entry,
        accumulatedAmount: (entry.accumulatedAmount || 0) + addAmount,
        lastAddedMonth: currentMonthStr,
        month: currentMonth,
        period: displayPeriod
      };
      await request.post('/api/salary/bonus', payload);
      showToast(`Added ₹${addAmount.toLocaleString('en-IN')} to ${entry.name}`, 'success');
      fetchBonusEntries();
    } catch (e) {
      showToast('Failed to add amount', 'error');
    }
  };

  const handleQuickAddAll = async () => {
    const addAmount = Number(bonusConfigAmount) || 1000;
    if (await confirm(`Are you sure you want to add ₹${addAmount.toLocaleString('en-IN')} to everyone who is active?`, 'Quick Add to All Active')) {
      try {
        const res = await request.post('/api/salary/bonus/quick-add-all', {
          amount: addAmount,
          month: currentMonth,
          period: displayPeriod
        });
        showToast(res.data.message || `Successfully added to all active employees`, 'success');
        fetchBonusEntries();
      } catch (e) {
        showToast('Failed to quick add to all', 'error');
      }
    }
  };

  const handleQuickReset = async (entry: any) => {
    if (await confirm(`Reset ${entry.name}'s accumulated bonus to ₹0?`, 'Reset Amount')) {
      try {
        const payload = {
          ...entry,
          accumulatedAmount: 0,
          month: currentMonth,
          period: displayPeriod
        };
        await request.post('/api/salary/bonus', payload);
        showToast(`Reset ${entry.name}'s bonus to ₹0`, 'success');
        fetchBonusEntries();
      } catch (e) {
        showToast('Failed to reset amount', 'error');
      }
    }
  };

  const handleResetAllBonus = async () => {
    if (await confirm('Are you sure you want to reset ALL employee accumulated bonus amounts back to ₹0? (Resigned employees will be removed from the list)', 'Reset All to ₹0')) {
      try {
        await request.post('/api/salary/bonus/reset-all');
        showToast('All bonus amounts reset to ₹0', 'success');
        fetchBonusEntries();
      } catch (e) {
        showToast('Failed to reset bonus amounts', 'error');
      }
    }
  };

  const handleSyncFromSalary = async () => {
    const currentGroups = salaryData[currentMonth] || [];
    const memberNames = new Set<string>();
    currentGroups.forEach(g => {
      g.members.forEach(m => {
        if (m.name && m.name.trim()) {
          memberNames.add(m.name.trim());
        }
      });
    });

    if (memberNames.size === 0) {
      showToast('No employees found in the current month\'s salary sheet to sync.', 'warning');
      return;
    }

    const existingNames = new Set(bonusEntries.map(e => e.name.toLowerCase().trim()));
    const namesToSync = Array.from(memberNames).filter(name => !existingNames.has(name.toLowerCase().trim()));

    if (namesToSync.length === 0) {
      showToast('All employees from the current month\'s salary sheet are already synced.', 'info');
      return;
    }

    try {
      let addedCount = 0;
      for (const name of namesToSync) {
        const payload = {
          id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name,
          accumulatedAmount: 0,
          notes: `Synced from salary group of ${dayjs(currentMonth).format('MMMM YYYY')}`
        };
        await request.post('/api/salary/bonus', payload);
        addedCount++;
      }
      showToast(`Successfully synced ${addedCount} new employee(s)`, 'success');
      fetchBonusEntries();
    } catch (e) {
      showToast('Failed to sync employees', 'error');
    }
  };

  useEffect(() => {
    if (!canView) return;
    const fetchAll = async () => {
      try {
        const [configRes, salaryConfigRes, templatesRes, allSalaryRes, bonusRes, bonusHistoryRes] = await Promise.all([
          request.get('/api/attendance/config'),
          request.get('/api/salary/config'),
          request.get('/api/salary/templates'),
          request.get('/api/salary'),
          request.get('/api/salary/bonus'),
          request.get('/api/salary/bonus/history')
        ]);

        if (configRes.data) {
          setStartDay(configRes.data.startDay || 1);
          setEndDay(configRes.data.endDay || 31);
          setMaxAllowedDays(configRes.data.maxAllowedDays || 26);
        }
        if (salaryConfigRes.data) {
          setGlobalCompanyName(salaryConfigRes.data.companyName || '');
          setGlobalPoNumber(salaryConfigRes.data.poNumber || '');
          setGlobalPoStartDate(salaryConfigRes.data.poStartDate || '');
          setGlobalPoEndDate(salaryConfigRes.data.poEndDate || '');
        }
        if (templatesRes.data) {
          setTemplates(templatesRes.data);
        }
        if (bonusRes.data) {
          setBonusEntries(bonusRes.data);
        }
        if (bonusHistoryRes.data) {
          setBonusHistory(bonusHistoryRes.data);
        }
        if (allSalaryRes.data) {
          const loadedData: Record<string, Group[]> = {};
          const loadedDates: Record<string, { startDate?: string; endDate?: string }> = {};
          const loadedEditables: Record<string, boolean> = {};
          allSalaryRes.data.forEach((s: any) => {
            loadedData[s.month] = s.groups;
            loadedDates[s.month] = { startDate: s.startDate, endDate: s.endDate };
            loadedEditables[s.month] = s.editable ?? false;
          });
          setSalaryData(loadedData);
          setCustomDates(loadedDates);
          setMonthEditables(loadedEditables);
        }
      } catch (e) {
        console.error('Failed to load salary configuration', e);
      }
    };
    fetchAll();
  }, []);

  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [editingGroupIds, setEditingGroupIds] = useState<string[]>([]);
  const [editingTemplateIds, setEditingTemplateIds] = useState<string[]>([]);
  const [originalGroups, setOriginalGroups] = useState<Record<string, Group>>({});
  const [originalTemplates, setOriginalTemplates] = useState<Record<string, Template>>({});

  // loadData() was removed because fetchAll() already fetches all months' data on mount

  if (!canView) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="textSecondary">
          You need the View Salary Calculation privilege to access this feature.
        </Typography>
      </Box>
    );
  }

  let groups = salaryData[currentMonth];
  if (!groups) {
    const monthsWithData = Object.keys(salaryData).sort();
    const previousMonths = monthsWithData.filter(m => m < currentMonth);
    if (previousMonths.length > 0) {
      const mostRecentMonth = previousMonths[previousMonths.length - 1];
      groups = salaryData[mostRecentMonth].map(g => ({
        ...g,
        members: g.members.map(m => ({
          ...m,
          days: 0
        }))
      }));
    } else {
      groups = [];
    }
  }

  const updateGroupsInState = (newGroups: Group[]) => {
    setSalaryData(prev => ({
      ...prev,
      [currentMonth]: newGroups
    }));
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(dayjs(currentMonth).subtract(1, 'month').format('YYYY-MM'));
  };

  const handleNextMonth = () => {
    setCurrentMonth(dayjs(currentMonth).add(1, 'month').format('YYYY-MM'));
  };

  const saveGroupsToDB = async (month: string, newGroups: Group[], start?: string, end?: string) => {
    if (!monthEditables[month]) {
      showToast('Salary calculation for this month is locked', 'error');
      return;
    }
    try {
      const monthData = customDates[month] || {};
      const payload = {
        groups: newGroups,
        startDate: start !== undefined ? start : monthData.startDate,
        endDate: end !== undefined ? end : monthData.endDate
      };
      await request.post(`/api/salary/${month}`, payload);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Failed to save groups to database';
      showToast(msg, 'error');
    }
  };

  const handleUpdateCustomDates = (start: string | undefined, end: string | undefined) => {
    if (!isCurrentMonthEditable) {
      showToast('Salary calculation for this month is locked', 'error');
      return;
    }
    const updated = {
      ...customDates,
      [currentMonth]: { startDate: start, endDate: end }
    };
    setCustomDates(updated);
    const currentGroups = salaryData[currentMonth] || [];
    saveGroupsToDB(currentMonth, currentGroups, start, end);
  };

  const addGroup = () => {
    if (!isCurrentMonthEditable) {
      showToast('Salary calculation for this month is locked', 'error');
      return;
    }
    const newGroup: Group = {
      id: Date.now().toString(),
      name: `Group ${groups.length + 1}`,
      perDaySalary: 0,
      members: []
    };
    const newGroups = [newGroup, ...groups];
    updateGroupsInState(newGroups);
    saveGroupsToDB(currentMonth, newGroups);
    if (!expandedGroupIds.includes(newGroup.id)) {
      setExpandedGroupIds([...expandedGroupIds, newGroup.id]);
    }
    setEditingGroupIds([...editingGroupIds, newGroup.id]);
  };

  const updateGroup = (id: string, field: keyof Group, value: any) => {
    updateGroupsInState(groups.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const deleteGroup = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isCurrentMonthEditable) {
      showToast('Salary calculation for this month is locked', 'error');
      return;
    }
    const groupToDelete = groups.find(g => g.id === id);
    const groupName = groupToDelete?.name || 'this group';
    if (await confirm(`Are you sure you want to delete ${groupName}?`, 'Delete Group')) {
      const newGroups = groups.filter(g => g.id !== id);
      updateGroupsInState(newGroups);
      saveGroupsToDB(currentMonth, newGroups);
      setEditingGroupIds(editingGroupIds.filter(gId => gId !== id));
      setExpandedGroupIds(expandedGroupIds.filter(gId => gId !== id));
    }
  };

  const toggleEditGroup = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isCurrentMonthEditable) {
      showToast('Salary calculation for this month is locked', 'error');
      return;
    }

    if (editingGroupIds.includes(id)) {
      const groupSaving = groups.find(g => g.id === id);
      if (groupSaving && groupSaving.templateId) {
        const stats = getTemplateStats(groupSaving.templateId);
        if (stats && stats.remainingAmount < 0) {
          const confirmed = await confirm(
            `The remaining amount has been depleted. Do you want to utilize the reserved amount of ₹${stats.reservedAmount.toLocaleString('en-IN')}?`,
            'Use Reserved Amount'
          );
          if (!confirmed) {
            return;
          }
        }
      }

      let updatedGroups = groups;
      updatedGroups = groups.map(g => {
        if (g.id === id) {
          return {
            ...g,
            updatedBy: displayName || username || 'system',
            updatedAt: dayjs().toISOString()
          };
        }
        return g;
      });
      updateGroupsInState(updatedGroups);
      await saveGroupsToDB(currentMonth, updatedGroups);
      showToast('Group saved successfully', 'success');
      setOriginalGroups(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } else {
      const groupToEdit = groups.find(g => g.id === id);
      if (groupToEdit) {
        setOriginalGroups(prev => ({
          ...prev,
          [id]: JSON.parse(JSON.stringify(groupToEdit))
        }));
      }
    }

    setEditingGroupIds(prev =>
      prev.includes(id) ? prev.filter(gId => gId !== id) : [...prev, id]
    );
    if (!editingGroupIds.includes(id) && !expandedGroupIds.includes(id)) {
      setExpandedGroupIds(prev => [...prev, id]);
    }
  };

  const handleCancelEditGroup = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const original = originalGroups[id];
    if (original) {
      updateGroupsInState(groups.map(g => g.id === id ? original : g));
      setOriginalGroups(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
    setEditingGroupIds(prev => prev.filter(gId => gId !== id));
  };

  const toggleExpandGroup = (id: string) => {
    setExpandedGroupIds(prev =>
      prev.includes(id) ? prev.filter(gId => gId !== id) : [...prev, id]
    );
  };

  const addMember = (groupId: string) => {
    updateGroupsInState(groups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          members: [
            ...g.members,
            { id: Date.now().toString(), name: '', days: 0, otHours: 0 }
          ]
        };
      }
      return g;
    }));
  };

  const updateMember = (groupId: string, memberId: string, field: keyof Member, value: any) => {
    updateGroupsInState(groups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          members: g.members.map(m => m.id === memberId ? { ...m, [field]: value } : m)
        };
      }
      return g;
    }));
  };

  const deleteMember = async (groupId: string, memberId: string) => {
    const group = groups.find(g => g.id === groupId);
    const member = group?.members.find(m => m.id === memberId);
    const memberName = member?.name || 'this member';
    if (await confirm(`Are you sure you want to delete ${memberName}?`, 'Delete Member')) {
      updateGroupsInState(groups.map(g => {
        if (g.id === groupId) {
          return {
            ...g,
            members: g.members.filter(m => m.id !== memberId)
          };
        }
        return g;
      }));
    }
  };

  const calculateGroupTotal = (group: Group) => {
    return group.members.reduce((sum, member) => {
      const days = Number(member.days) || 0;
      const otHours = Number(member.otHours) || 0;
      const perDay = Number(group.perDaySalary) || 0;
      return sum + (days * perDay) + ((perDay / 8) * otHours);
    }, 0);
  };

  const calculateGrandTotal = () => {
    return groups.reduce((sum, group) => sum + calculateGroupTotal(group), 0);
  };

  const getTemplateStats = (templateId: string | undefined) => {
    if (!templateId) return null;
    const template = templates.find(t => t.id === templateId);
    if (!template) return null;

    const totalAmount = template.activities.reduce((sum, act) => sum + (Number(act.rate) || 0) * (Number(act.maxUnits) || 0), 0);
    const totalAllottedUnits = template.activities.reduce((sum, act) => sum + (Number(act.maxUnits) || 0), 0);

    let reservedAmount = 0;
    if (template.reserveEnabled) {
      const rType = template.reserveType || 'percentage';
      const rVal = template.reserveValue !== undefined ? Number(template.reserveValue) : 5;
      if (rType === 'percentage') {
        reservedAmount = totalAmount * (rVal / 100);
      } else {
        reservedAmount = rVal;
      }
    }

    const templateInitialConsumedAmountVal = Number(template.initialConsumedAmount) || 0;

    const sortedMonths = Object.keys(salaryData)
      .filter(m => {
        if (globalPoStartDate && m < dayjs(globalPoStartDate).format('YYYY-MM')) return false;
        return true;
      })
      .sort();
    const startMonth = sortedMonths.length > 0 ? sortedMonths[0] : currentMonth;
    const remainingMonthsFromStart = globalPoEndDate
      ? Math.max(1, dayjs(globalPoEndDate).endOf('month').diff(dayjs(`${startMonth}-01`).startOf('month'), 'month') + 1)
      : 1;

    const distribution = distributeInitialConsumedAmount(
      templateInitialConsumedAmountVal,
      template.activities,
      Number(template.maxStaffs) || 0,
      remainingMonthsFromStart
    );

    const actualInitialConsumedAmount = Object.values(distribution.distributedAmount).reduce((sum, val) => sum + val, 0);
    const actualInitialConsumedUnits = Object.values(distribution.distributedUnits).reduce((sum, val) => sum + val, 0);

    let consumedAmount = actualInitialConsumedAmount;
    let consumedUnits = actualInitialConsumedUnits;

    // Calculate consumed amount and units across all months in salaryData
    Object.values(salaryData).forEach(gList => {
      gList.forEach(g => {
        if (g.templateId === templateId) {
          g.members.forEach(m => {
            const days = Number(m.days) || 0;
            const otHours = Number(m.otHours) || 0;
            const perDay = Number(g.perDaySalary) || 0;
            consumedAmount += (days * perDay) + ((perDay / 8) * otHours);
            consumedUnits += days + (otHours / 8);
          });
        }
      });
    });

    const remainingAmount = totalAmount - consumedAmount - reservedAmount;
    const remainingUnits = totalAllottedUnits - consumedUnits;

    return {
      totalAmount,
      reservedAmount,
      consumedAmount,
      remainingAmount,
      totalAllottedUnits,
      consumedUnits,
      remainingUnits
    };
  };

  const getAutoPerDaySalary = (group: Group, templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return 0;

    const totalAmount = template.activities.reduce((sum, act) => sum + (Number(act.rate) || 0) * (Number(act.maxUnits) || 0), 0);

    let reservedAmount = 0;
    if (template.reserveEnabled) {
      const rType = template.reserveType || 'percentage';
      const rVal = template.reserveValue !== undefined ? Number(template.reserveValue) : 5;
      if (rType === 'percentage') {
        reservedAmount = totalAmount * (rVal / 100);
      } else {
        reservedAmount = rVal;
      }
    }

    const templateInitialConsumedAmountVal = Number(template.initialConsumedAmount) || 0;

    const sortedMonths = Object.keys(salaryData)
      .filter(m => {
        if (globalPoStartDate && m < dayjs(globalPoStartDate).format('YYYY-MM')) return false;
        return true;
      })
      .sort();
    const startMonth = sortedMonths.length > 0 ? sortedMonths[0] : currentMonth;
    const remainingMonthsFromStart = globalPoEndDate
      ? Math.max(1, dayjs(globalPoEndDate).endOf('month').diff(dayjs(`${startMonth}-01`).startOf('month'), 'month') + 1)
      : 1;

    const distribution = distributeInitialConsumedAmount(
      templateInitialConsumedAmountVal,
      template.activities,
      Number(template.maxStaffs) || 0,
      remainingMonthsFromStart
    );

    const actualInitialConsumedAmount = Object.values(distribution.distributedAmount).reduce((sum, val) => sum + val, 0);

    let consumedAmountPrior = actualInitialConsumedAmount;
    Object.entries(salaryData).forEach(([month, gList]) => {
      if (month === currentMonth) return;
      gList.forEach(g => {
        if (g.templateId === templateId) {
          g.members.forEach(m => {
            const days = Number(m.days) || 0;
            const otHours = Number(m.otHours) || 0;
            const perDay = Number(g.perDaySalary) || 0;
            consumedAmountPrior += (days * perDay) + ((perDay / 8) * otHours);
          });
        }
      });
    });

    const availableAmount = totalAmount - consumedAmountPrior - reservedAmount;

    let currentMonthUnits = 0;
    const currentMonthGroups = salaryData[currentMonth] || [];
    currentMonthGroups.forEach(g => {
      if (g.templateId === templateId) {
        g.members.forEach(m => {
          currentMonthUnits += (Number(m.days) || 0) + ((Number(m.otHours) || 0) / 8);
        });
      }
    });

    const remainingMonths = globalPoEndDate
      ? Math.max(0, dayjs(globalPoEndDate).endOf('month').diff(dayjs(`${currentMonth}-01`).startOf('month'), 'month'))
      : 0;

    const templateMaxDays = template.maxDays !== undefined && template.maxDays !== '' && template.maxDays !== null ? Number(template.maxDays) : maxAllowedDays;
    const futureUnits = (Number(template.maxStaffs) || 0) * remainingMonths * templateMaxDays;

    const divisor = currentMonthUnits + futureUnits;
    if (divisor <= 0) return 0;

    return Math.floor(availableAmount / divisor);
  };

  const getTemplateActivitiesStats = (template: Template) => {
    const sortedMonths = Object.keys(salaryData)
      .filter(m => {
        if (globalPoStartDate && m < dayjs(globalPoStartDate).format('YYYY-MM')) return false;
        return true;
      })
      .sort();

    const templateInitialConsumedAmountVal = Number(template.initialConsumedAmount) || 0;

    const startMonth = sortedMonths.length > 0 ? sortedMonths[0] : currentMonth;
    const remainingMonthsFromStart = globalPoEndDate
      ? Math.max(1, dayjs(globalPoEndDate).endOf('month').diff(dayjs(`${startMonth}-01`).startOf('month'), 'month') + 1)
      : 1;

    const distribution = distributeInitialConsumedAmount(
      templateInitialConsumedAmountVal,
      template.activities,
      Number(template.maxStaffs) || 0,
      remainingMonthsFromStart
    );
    const initialConsumedUnitsMap = distribution.distributedUnits;

    const consumedUnitsMap: Record<string, number> = {};
    template.activities.forEach(act => {
      consumedUnitsMap[act.id] = initialConsumedUnitsMap[act.id] || 0;
    });

    sortedMonths.forEach(m => {
      const templateGroups = salaryData[m]?.filter(g => g.templateId === template.id) || [];
      templateGroups.forEach(g => {
        const mTotal = calculateGroupTotal(g);
        const remainingMonths = globalPoEndDate
          ? Math.max(1, dayjs(globalPoEndDate).endOf('month').diff(dayjs(`${m}-01`).startOf('month'), 'month') + 1)
          : 1;

        let sumTargetCost = 0;
        const targets = template.activities.map(act => {
          const maxUnits = Number(act.maxUnits) || 0;
          const prevConsumed = consumedUnitsMap[act.id] || 0;
          const remUnits = Math.max(0, maxUnits - prevConsumed);
          const targetUnits = remUnits / remainingMonths;
          const rate = Number(act.rate) || 0;
          const targetCost = targetUnits * rate;
          sumTargetCost += targetCost;
          return { id: act.id, rate, targetCost };
        });

        template.activities.forEach((act, idx) => {
          const target = targets[idx];
          let amount = 0;
          if (sumTargetCost > 0) {
            amount = (target.targetCost / sumTargetCost) * mTotal;
          } else {
            amount = mTotal / template.activities.length;
          }
          const units = target.rate > 0 ? (amount / target.rate) : 0;
          consumedUnitsMap[act.id] += units;
        });
      });
    });

    const remainingMonthsNow = globalPoEndDate
      ? Math.max(1, dayjs(globalPoEndDate).endOf('month').diff(dayjs().startOf('month'), 'month') + 1)
      : 1;
    const templateMaxDays = template.maxDays !== undefined && template.maxDays !== '' && template.maxDays !== null ? Number(template.maxDays) : 30;
    const requiredUnitsPerActivity = Number(template.maxStaffs || 0) * remainingMonthsNow * templateMaxDays;

    const stats: Record<string, { remainingUnits: number; consumedUnits: number; isNotEnough: boolean }> = {};
    template.activities.forEach(act => {
      const maxUnits = Number(act.maxUnits) || 0;
      const consumed = consumedUnitsMap[act.id] || 0;
      const remainingUnits = maxUnits - consumed;
      const isNotEnough = remainingUnits < requiredUnitsPerActivity;
      stats[act.id] = { remainingUnits, consumedUnits: consumed, isNotEnough };
    });

    return stats;
  };

  // Template functions
  const saveTemplatesToDB = async (newTemplates: Template[]) => {
    try {
      await request.post('/api/salary/templates', newTemplates);
    } catch (e) {
      showToast('Failed to save templates', 'error');
    }
  };

  const addTemplate = () => {
    const newTemplate: Template = {
      id: Date.now().toString(),
      title: `Template ${templates.length + 1}`,
      activities: [],
      allottedAmount: 0,
      maxStaffs: 0,
      initialConsumedAmount: 0
    };
    const newTemplates = [newTemplate, ...templates];
    setTemplates(newTemplates);
    saveTemplatesToDB(newTemplates);
    setEditingTemplateIds([...editingTemplateIds, newTemplate.id]);
  };

  const updateTemplate = (id: string, field: keyof Template, value: any) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const deleteTemplate = async (id: string) => {
    const templateToDelete = templates.find(t => t.id === id);
    const title = templateToDelete?.title || 'this template';
    if (await confirm(`Are you sure you want to delete ${title}?`, 'Delete Template')) {
      const newTemplates = templates.filter(t => t.id !== id);
      setTemplates(newTemplates);
      saveTemplatesToDB(newTemplates);
      setEditingTemplateIds(editingTemplateIds.filter(tId => tId !== id));
    }
  };

  const toggleEditTemplate = async (id: string) => {
    if (editingTemplateIds.includes(id)) {
      await saveTemplatesToDB(templates);
      showToast('Template saved successfully', 'success');
      setOriginalTemplates(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } else {
      const templateToEdit = templates.find(t => t.id === id);
      if (templateToEdit) {
        setOriginalTemplates(prev => ({
          ...prev,
          [id]: JSON.parse(JSON.stringify(templateToEdit))
        }));
      }
    }
    setEditingTemplateIds(prev =>
      prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id]
    );
  };

  const handleCancelEditTemplate = (id: string) => {
    const original = originalTemplates[id];
    if (original) {
      setTemplates(templates.map(t => t.id === id ? original : t));
      setOriginalTemplates(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
    setEditingTemplateIds(prev => prev.filter(tId => tId !== id));
  };

  const addActivity = (templateId: string) => {
    setTemplates(templates.map(t => {
      if (t.id === templateId) {
        return {
          ...t,
          activities: [...t.activities, { id: Date.now().toString(), name: '', rate: 0, maxUnits: 0 }]
        };
      }
      return t;
    }));
  };

  const updateActivity = (templateId: string, activityId: string, field: keyof Activity, value: any) => {
    setTemplates(templates.map(t => {
      if (t.id === templateId) {
        return {
          ...t,
          activities: t.activities.map(a => a.id === activityId ? { ...a, [field]: value } : a)
        };
      }
      return t;
    }));
  };

  const deleteActivity = async (templateId: string, activityId: string) => {
    const template = templates.find(t => t.id === templateId);
    const activity = template?.activities.find(a => a.id === activityId);
    const actName = activity?.name || 'this activity';
    if (await confirm(`Are you sure you want to delete ${actName}?`, 'Delete Activity')) {
      setTemplates(templates.map(t => {
        if (t.id === templateId) {
          return {
            ...t,
            activities: t.activities.filter(a => a.id !== activityId)
          };
        }
        return t;
      }));
    }
  };

  // Format cycle period string
  const actualStartDay = Math.min(startDay, dayjs(`${currentMonth}-01`).daysInMonth());
  const cycleStartObj = dayjs(`${currentMonth}-01`).date(actualStartDay);

  let cycleEndObj;
  if (startDay === 1) {
    cycleEndObj = dayjs(`${currentMonth}-01`).endOf('month').date(Math.min(endDay, dayjs(`${currentMonth}-01`).daysInMonth()));
  } else {
    const nextMonthObj = dayjs(`${currentMonth}-01`).add(1, 'month');
    cycleEndObj = nextMonthObj.date(Math.min(endDay, nextMonthObj.daysInMonth()));
  }

  const cycleStartStr = cycleStartObj.format('DD MMM YYYY');
  const cycleEndStr = cycleEndObj.format('DD MMM YYYY');
  const monthData = customDates[currentMonth] || {};
  const displayPeriod = (monthData.startDate && monthData.endDate)
    ? `${dayjs(monthData.startDate).format('DD MMM YYYY')} - ${dayjs(monthData.endDate).format('DD MMM YYYY')}`
    : `${cycleStartStr} - ${cycleEndStr}`;

  const handleEditGeneral = () => {
    setTempCompanyName(globalCompanyName);
    setTempPoNumber(globalPoNumber);
    setTempPoStartDate(globalPoStartDate);
    setTempPoEndDate(globalPoEndDate);
    setIsEditingGeneral(true);
  };

  const handleCancelGeneral = () => {
    setIsEditingGeneral(false);
  };

  const saveGlobalConfig = async () => {
    try {
      await request.post('/api/salary/config', {
        companyName: tempCompanyName,
        poNumber: tempPoNumber,
        poStartDate: tempPoStartDate,
        poEndDate: tempPoEndDate
      });
      setGlobalCompanyName(tempCompanyName);
      setGlobalPoNumber(tempPoNumber);
      setGlobalPoStartDate(tempPoStartDate);
      setGlobalPoEndDate(tempPoEndDate);
      setIsEditingGeneral(false);
      showToast('Global configuration saved', 'success');
    } catch (e) {
      showToast('Failed to save configuration', 'error');
    }
  };

  const handleOpenEmailModal = async () => {
    try {
      const checkRes = await request.get('/api/mail-config/accounts-mail-enabled');
      if (checkRes.data && checkRes.data.enabled === false) {
        showToast('Sending Accounts/Salary emails is currently disabled in Mail Configuration.', 'warning');
        return;
      }
    } catch (err) {
      // Continue if check fails
    }

    try {
      const savedRes = await request.get('/api/mail-config/saved-emails?module=accounts');
      if (Array.isArray(savedRes.data) && savedRes.data.length > 0) {
        setEmailRecipients(savedRes.data.join(', '));
      } else {
        const lastSentRes = await request.get('/api/mail-config/last-sent?department=accounts');
        if (lastSentRes.data && lastSentRes.data.emails) {
          setEmailRecipients(lastSentRes.data.emails);
        }
      }
    } catch (err) {
      // ignore error
    }

    const poNum = globalPoNumber || 'N/A';
    const monthData = customDates[currentMonth] || {};
    const startDateStr = monthData.startDate
      ? dayjs(monthData.startDate).format('DD MMM YYYY')
      : cycleStartObj.format('DD MMM YYYY');
    const endDateStr = monthData.endDate
      ? dayjs(monthData.endDate).format('DD MMM YYYY')
      : cycleEndObj.format('DD MMM YYYY');
    const yearStr = monthData.endDate
      ? dayjs(monthData.endDate).format('YYYY')
      : cycleEndObj.format('YYYY');

    const defaultSubject = `Datacenter-${poNum} - Bill ${startDateStr} to ${endDateStr} - ${yearStr}`;
    setEmailSubject(defaultSubject);

    setShowEmailModal(true);
  };

  const generateSalaryReportHtml = () => {
    let totalGrandAmount = 0;
    let slNo = 1;

    let tableRowsHtml = '';
    groups.forEach((group) => {
      const groupTotal = calculateGroupTotal(group);
      totalGrandAmount += groupTotal;

      tableRowsHtml += `
        <tr style="background-color: #e2e8f0; font-weight: bold;">
          <td colspan="5" style="border: 1px solid black; padding: 6px 8px; font-size: 13px;">${group.name}</td>
        </tr>
      `;

      group.members.forEach((member) => {
        const days = Number(member.days) || 0;
        const otHours = Number(member.otHours) || 0;
        const perDayRate = Number(group.perDaySalary) || 0;
        const memberTotal = (days * perDayRate) + (otHours * (perDayRate / 8));

        tableRowsHtml += `
          <tr>
            <td style="border: 1px solid black; padding: 4px 8px; text-align: center;">${slNo++}</td>
            <td style="border: 1px solid black; padding: 4px 8px;">${member.name || ''}</td>
            <td style="border: 1px solid black; padding: 4px 8px; text-align: center;">${days}</td>
            <td style="border: 1px solid black; padding: 4px 8px; text-align: center;">${otHours}</td>
            <td style="border: 1px solid black; padding: 4px 8px; text-align: right;">₹ ${memberTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        `;
      });
    });

    tableRowsHtml += `
      <tr style="background-color: #f1f5f9; font-weight: bold;">
        <td colspan="4" style="border: 1px solid black; padding: 6px 8px; text-align: right;">Grand Total:</td>
        <td style="border: 1px solid black; padding: 6px 8px; text-align: right;">₹ ${totalGrandAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Salary Report: Individual Members</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #1e293b; font-size: 12px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 20px; }
          .header-title { font-size: 20px; font-weight: bold; }
          .header-sub { font-size: 14px; font-weight: 600; color: #475569; margin-top: 4px; }
          .header-right { text-align: right; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid black; padding: 6px 8px; }
          th { background-color: #f8fafc; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="header-title">${globalCompanyName || 'Company Name Not Set'}</div>
            <div class="header-sub">Salary Report: Individual Members</div>
          </div>
          <div class="header-right">
            <div><strong>PO Number:</strong> ${globalPoNumber || 'N/A'}</div>
            <div><strong>Period:</strong> ${displayPeriod}</div>
            <div><strong>Generated:</strong> ${dayjs().format('DD MMM YYYY, HH:mm')}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 50px;">Sl No.</th>
              <th>Name of the contract person</th>
              <th style="width: 80px; text-align: center;">Days</th>
              <th style="width: 100px; text-align: center;">OT Hours</th>
              <th style="width: 150px; text-align: right;">Total Amount (Rs)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;
  };

  const generateSplitupReportHtml = () => {
    const targetGroups = groups.filter(g => !!g.templateId);
    if (targetGroups.length === 0) return null;

    let pagesHtml = '';
    targetGroups.forEach((group, groupIdx) => {
      const template = templates.find(t => t.id === group.templateId);
      if (!template) return;

      const groupTotal = calculateGroupTotal(group);
      const monthSet = new Set(Object.keys(salaryData));
      monthSet.add(currentMonth);
      const sortedMonths = Array.from(monthSet)
        .filter(m => {
          if (m > currentMonth) return false;
          if (globalPoStartDate && m < dayjs(globalPoStartDate).format('YYYY-MM')) return false;
          return true;
        })
        .sort();

      const templateInitialConsumedAmountVal = Number(template.initialConsumedAmount) || 0;
      const startMonth = sortedMonths.length > 0 ? sortedMonths[0] : currentMonth;
      const remainingMonthsFromStart = globalPoEndDate
        ? Math.max(1, dayjs(globalPoEndDate).endOf('month').diff(dayjs(`${startMonth}-01`).startOf('month'), 'month') + 1)
        : 1;

      const distribution = distributeInitialConsumedAmount(
        templateInitialConsumedAmountVal,
        template.activities,
        Number(template.maxStaffs) || 0,
        remainingMonthsFromStart
      );
      const initialConsumedUnitsMap = distribution.distributedUnits;

      const consumedUnitsMap: Record<string, number> = {};
      template.activities.forEach(act => {
        consumedUnitsMap[act.id] = initialConsumedUnitsMap[act.id] || 0;
      });

      let finalSplitupResults: Record<string, { amount: number; units: number }> = {};

      sortedMonths.forEach(m => {
        const g = (m === currentMonth)
          ? group
          : salaryData[m]?.find(gr => gr.name === group.name);

        if (!g) return;

        const mTotal = calculateGroupTotal(g);
        const remainingMonths = globalPoEndDate
          ? Math.max(1, dayjs(globalPoEndDate).endOf('month').diff(dayjs(`${m}-01`).startOf('month'), 'month') + 1)
          : 1;

        let sumTargetCost = 0;
        const targets = template.activities.map(act => {
          const maxUnits = Number(act.maxUnits) || 0;
          const prevConsumed = consumedUnitsMap[act.id] || 0;
          const remUnits = Math.max(0, maxUnits - prevConsumed);
          const targetUnits = remUnits / remainingMonths;
          const rate = Number(act.rate) || 0;
          const targetCost = targetUnits * rate;
          sumTargetCost += targetCost;
          return { id: act.id, rate, targetCost };
        });

        const monthResults: Record<string, { amount: number; units: number }> = {};
        template.activities.forEach((act, idx) => {
          const target = targets[idx];
          let amount = 0;
          if (sumTargetCost > 0) {
            amount = (target.targetCost / sumTargetCost) * mTotal;
          } else {
            amount = mTotal / template.activities.length;
          }
          const units = target.rate > 0 ? (amount / target.rate) : 0;
          monthResults[act.id] = { amount, units };

          consumedUnitsMap[act.id] += units;
        });

        if (m === currentMonth) {
          finalSplitupResults = monthResults;
        }
      });

      let activityRowsHtml = '';
      template.activities.forEach((act, idx) => {
        const rate = Number(act.rate) || 0;
        const result = finalSplitupResults[act.id] || { amount: 0, units: 0 };

        activityRowsHtml += `
          <tr>
            <td style="border: 1px solid black; padding: 4px 8px;">${idx + 1}</td>
            <td style="border: 1px solid black; padding: 4px 8px;">${act.name}</td>
            <td style="border: 1px solid black; padding: 4px 8px; text-align: right;">${rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td style="border: 1px solid black; padding: 4px 8px; text-align: right;">${result.units.toFixed(2)}</td>
            <td style="border: 1px solid black; padding: 4px 8px; text-align: right;">${result.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        `;
      });

      const isLast = groupIdx === targetGroups.length - 1;
      const pageBreakCss = isLast ? '' : 'page-break-after: always; break-after: page;';

      pagesHtml += `
        <div style="padding: 20px; ${pageBreakCss}">
          <div style="display: flex; justify-content: space-between; border-bottom: 2px solid black; padding-bottom: 8px; margin-bottom: 15px; font-size: 12px; font-weight: bold;">
            <div>PO NO: ${globalPoNumber || 'N/A'}</div>
            <div>Company name: ${globalCompanyName || 'Company Name Not Set'}</div>
            <div>Period: ${displayPeriod}</div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th colSpan="5" style="border: 1px solid black; padding: 6px 8px; text-align: center; font-weight: bold; font-size: 14px;">
                  ${template.title || group.name || 'Template'}
                </th>
              </tr>
              <tr style="background-color: #f5f5f5;">
                <th style="border: 1px solid black; padding: 6px 8px; text-align: left; width: 60px;">SL NO</th>
                <th style="border: 1px solid black; padding: 6px 8px; text-align: left;">Activity Name</th>
                <th style="border: 1px solid black; padding: 6px 8px; text-align: right;">Rate (₹)</th>
                <th style="border: 1px solid black; padding: 6px 8px; text-align: right;">Units</th>
                <th style="border: 1px solid black; padding: 6px 8px; text-align: right;">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${activityRowsHtml}
              <tr style="font-weight: bold; background-color: #f8fafc;">
                <td colSpan="3" style="border: 1px solid black; padding: 6px 8px; text-align: right;">Total Amount</td>
                <td colSpan="2" style="border: 1px solid black; padding: 6px 8px; text-align: right;">₹ ${groupTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>All Splitup Reports</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #000; font-size: 12px; }
          @media print {
            .page-break { page-break-after: always; break-after: page; }
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
      </html>
    `;
  };

  const handleSendSalaryEmail = async () => {
    if (!emailRecipients || !emailRecipients.trim()) {
      showToast('Please enter at least one recipient email address', 'warning');
      return;
    }

    try {
      setEmailSending(true);
      const salaryReportHtml = generateSalaryReportHtml();
      const splitupReportHtml = generateSplitupReportHtml();

      let salaryReportPdfBase64 = "";
      let splitupReportPdfBase64 = "";

      try {
        salaryReportPdfBase64 = await exportHtmlToPdfBase64(
          salaryReportHtml,
          `Salary_Report_Individual_Members_${currentMonth}.pdf`
        );
        splitupReportPdfBase64 = await exportHtmlToPdfBase64(
          splitupReportHtml,
          `Salary_All_Splitups_${currentMonth}.pdf`
        );
      } catch (pdfErr) {
        console.error("Client-side PDF generation failed, falling back to server-side render:", pdfErr);
      }

      const res = await request.post(`/api/salary/${currentMonth}/send-email`, {
        emails: emailRecipients,
        subject: emailSubject,
        salaryReportHtml,
        splitupReportHtml,
        salaryReportPdfBase64,
        splitupReportPdfBase64
      });

      showToast(res.data?.message || 'Email successfully sent to Accounts!', 'success');
      setShowEmailModal(false);
    } catch (err: any) {
      showToast(err.response?.data?.detail || err.message || 'Failed to send email', 'error');
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, margin: '0 auto', p: { xs: 2, md: 3 }, fontFamily: '"Inter", sans-serif' }}>

      {/* Modern Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          aria-label="salary tabs"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              minHeight: 48,
              borderRadius: '8px 8px 0 0',
              mr: 1,
              '&.Mui-selected': {
                color: 'primary.main',
                fontWeight: 700
              }
            }
          }}
        >
          <Tab icon={<WalletIcon style={{ fontSize: 20 }} />} iconPosition="start" label="Salary Calculation" />
          <Tab icon={<GiftIcon style={{ fontSize: 20 }} />} iconPosition="start" label="Bonus Tracker" />
          {canUpdateConfig && <Tab icon={<SettingsIcon style={{ fontSize: 20 }} />} iconPosition="start" label="Configuration" />}
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <Box>
          {/* Top Summary Metric Cards */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {/* Grand Total Payout */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                  color: '#ffffff',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}
              >
                <Box sx={{ position: 'absolute', right: -10, top: -10, opacity: 0.15, color: '#38bdf8' }}>
                  <MoneyIcon style={{ fontSize: 90 }} />
                </Box>
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, color: '#94a3b8' }}>
                  Total Payout
                </Typography>
                <Typography variant="h4" fontWeight="800" sx={{ my: 0.5, color: '#38bdf8', letterSpacing: -0.5 }}>
                  ₹ {calculateGrandTotal().toLocaleString('en-IN')}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <Chip label={`${groups.length} Groups`} size="small" sx={{ bgcolor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 600, height: 22, fontSize: 11 }} />
                  <Typography variant="caption" sx={{ color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>For {displayPeriod}</Typography>
                </Box>
              </Paper>
            </Grid>

            {/* Active Staff Members */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  bgcolor: '#ffffff',
                  boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)',
                  border: '1px solid',
                  borderColor: 'grey.200',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': { translateY: '-2px', boxShadow: '0 8px 25px -4px rgba(0,0,0,0.08)' }
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
                      Total Staff Members
                    </Typography>
                    <Typography variant="h4" fontWeight="800" color="text.primary" sx={{ my: 0.5 }}>
                      {groups.reduce((acc, g) => acc + (g.members?.length || 0), 0)}
                    </Typography>
                  </Box>
                  <Box sx={{ bgcolor: '#eff6ff', color: '#2563eb', p: 1.2, borderRadius: 2 }}>
                    <PeopleIcon style={{ fontSize: 24 }} />
                  </Box>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Assigned across {groups.length} active groups
                </Typography>
              </Paper>
            </Grid>

            {/* Purchase Order Info */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  bgcolor: '#ffffff',
                  boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)',
                  border: '1px solid',
                  borderColor: 'grey.200',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': { translateY: '-2px', boxShadow: '0 8px 25px -4px rgba(0,0,0,0.08)' }
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
                      Contract Details
                    </Typography>
                    <Typography variant="h6" fontWeight="700" color="text.primary" sx={{ my: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                      {globalPoNumber || 'No PO Set'}
                    </Typography>
                  </Box>
                  <Box sx={{ bgcolor: '#f0fdf4', color: '#16a34a', p: 1.2, borderRadius: 2 }}>
                    <ReceiptIcon style={{ fontSize: 24 }} />
                  </Box>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {globalCompanyName || 'Company Name Unset'}
                </Typography>
              </Paper>
            </Grid>

            {/* Status / Lock Control */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  bgcolor: isCurrentMonthEditable ? '#f0fdf4' : '#f8fafc',
                  boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)',
                  border: '1px solid',
                  borderColor: isCurrentMonthEditable ? '#bbf7d0' : 'grey.200',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
                      Cycle Status
                    </Typography>
                    <Typography variant="h6" fontWeight="700" color={isCurrentMonthEditable ? 'success.main' : 'text.secondary'} sx={{ my: 0.2 }}>
                      {isCurrentMonthEditable ? 'Editable' : 'Locked'}
                    </Typography>
                  </Box>
                  <Box sx={{ bgcolor: isCurrentMonthEditable ? '#dcfce7' : '#f1f5f9', color: isCurrentMonthEditable ? '#16a34a' : '#64748b', p: 1.2, borderRadius: 2 }}>
                    {isCurrentMonthEditable ? <LockOpenIcon style={{ fontSize: 24 }} /> : <LockIcon style={{ fontSize: 24 }} />}
                  </Box>
                </Box>
                {isSuperuser ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="caption" fontWeight="600" color="text.secondary">
                      Superuser Lock Switch:
                    </Typography>
                    <Switch
                      size="small"
                      checked={isCurrentMonthEditable}
                      onChange={(e) => handleToggleMonthEditable(e.target.checked)}
                      color="success"
                    />
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    {isCurrentMonthEditable ? 'Wage calculation is open.' : 'Wage calculation locked for period.'}
                  </Typography>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* Control Panel Bar */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              mb: 3.5,
              borderRadius: 3,
              bgcolor: '#ffffff',
              border: '1px solid',
              borderColor: 'grey.200',
              boxShadow: '0 4px 20px -2px rgba(0,0,0,0.03)'
            }}
          >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
              {/* Month Selector */}
              <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#f8fafc', border: '1px solid', borderColor: '#e2e8f0', borderRadius: 2.5, p: 0.5 }}>
                <IconButton onClick={handlePreviousMonth} size="small" sx={{ bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', '&:hover': { bgcolor: '#f1f5f9' } }}>
                  <ChevronLeftIcon />
                </IconButton>
                <Box sx={{ px: 2.5, textAlign: 'center', minWidth: 150 }}>
                  <Typography variant="subtitle1" fontWeight="700" color="#0f172a">
                    {dayjs(currentMonth).format('MMMM YYYY')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {displayPeriod}
                  </Typography>
                </Box>
                <IconButton onClick={handleNextMonth} size="small" sx={{ bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', '&:hover': { bgcolor: '#f1f5f9' } }}>
                  <ChevronRightIcon />
                </IconButton>
              </Box>

              {/* Quick Action Buttons */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CalendarTodayIcon />}
                  onClick={() => setEditingDates(!editingDates)}
                  sx={{ borderRadius: 2, textTransform: 'none', px: 2, fontWeight: 600, borderColor: '#cbd5e1', color: '#475569', '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' } }}
                >
                  {editingDates ? "Hide Custom Range" : "Custom Range"}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PrintIcon />}
                  onClick={() => setShowSalaryPrint(true)}
                  sx={{ borderRadius: 2, textTransform: 'none', px: 2, fontWeight: 600, color: '#334155', borderColor: '#cbd5e1', '&:hover': { bgcolor: '#f8fafc' } }}
                >
                  Print PDF
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  size="small"
                  startIcon={<PrintIcon />}
                  onClick={() => setShowAllSplitupsModal(true)}
                  sx={{ borderRadius: 2, textTransform: 'none', px: 2, fontWeight: 600 }}
                >
                  Print All Splitups
                </Button>
                <Button
                  variant="contained"
                  color="info"
                  size="small"
                  startIcon={<MailIcon />}
                  onClick={handleOpenEmailModal}
                  sx={{ borderRadius: 2, textTransform: 'none', px: 2.5, fontWeight: 600, boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)' }}
                >
                  Mail to Accounts
                </Button>
                {canAddGroup && isCurrentMonthEditable && (
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={addGroup}
                    sx={{ borderRadius: 2, textTransform: 'none', px: 2.5, fontWeight: 600, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)' }}
                  >
                    Add Group
                  </Button>
                )}
              </Box>
            </Box>

            {/* Custom Date Range Picker Dropdown */}
            {editingDates && (
              <Box sx={{ mt: 2.5, p: 2.5, bgcolor: '#f8fafc', borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm="auto">
                    <Typography variant="body2" fontWeight="700" color="#334155">
                      Set Specific Billing Range:
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm="auto">
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" fontWeight="600" color="text.secondary">Start:</Typography>
                        <TextField
                          size="small"
                          type="date"
                          value={customDates[currentMonth]?.startDate || ''}
                          onChange={(e) => handleUpdateCustomDates(e.target.value || undefined, customDates[currentMonth]?.endDate)}
                          sx={{ backgroundColor: 'white', width: 155 }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" fontWeight="600" color="text.secondary">End:</Typography>
                        <TextField
                          size="small"
                          type="date"
                          value={customDates[currentMonth]?.endDate || ''}
                          onChange={(e) => handleUpdateCustomDates(customDates[currentMonth]?.startDate, e.target.value || undefined)}
                          sx={{ backgroundColor: 'white', width: 155 }}
                        />
                      </Box>
                      {(customDates[currentMonth]?.startDate || customDates[currentMonth]?.endDate) && (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleUpdateCustomDates(undefined, undefined)}
                          sx={{ textTransform: 'none', fontWeight: 600 }}
                        >
                          Clear Custom Range
                        </Button>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Paper>

          {/* Groups List */}
          {groups.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: 2, backgroundColor: 'grey.50' }}>
              <WalletIcon style={{ fontSize: 48, color: '#bdbdbd', marginBottom: 12 }} />
              <Typography variant="subtitle1" fontWeight="500" color="text.primary" gutterBottom>
                No salary groups configured
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Add a group to start calculating daily wages for this cycle.
              </Typography>
              {canAddGroup && isCurrentMonthEditable && (
                <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={addGroup}>
                  Add Group
                </Button>
              )}
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {groups.map((group) => {
                const groupTotal = calculateGroupTotal(group);
                const isEditing = editingGroupIds.includes(group.id);
                const isExpanded = expandedGroupIds.includes(group.id);

                let displayPerDay = Number(group.perDaySalary) || 0;
                let templateTitle = '';
                if (group.templateId) {
                  const template = templates.find(t => t.id === group.templateId);
                  if (template) {
                    templateTitle = template.title;
                  }
                }

                return (
                  <Grid item xs={12} lg={6} key={group.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: 2,
                        borderColor: isEditing ? 'primary.main' : 'divider',
                        boxShadow: isEditing ? '0 0 0 1px rgba(25, 118, 210, 0.2)' : '0 2px 4px rgba(0,0,0,0.01)',
                        transition: 'all 0.2s ease-in-out'
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          p: 2,
                          backgroundColor: isEditing ? 'rgba(25, 118, 210, 0.02)' : 'grey.50',
                          borderBottom: isExpanded ? '1px solid' : 'none',
                          borderColor: 'divider'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: 1 }}>
                          <IconButton onClick={() => toggleExpandGroup(group.id)} size="small">
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>

                          {isEditing ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, pr: 2 }}>
                              <TextField
                                size="small"
                                label="Group Name"
                                value={group.name}
                                onChange={(e) => updateGroup(group.id, 'name', e.target.value)}
                                sx={{ backgroundColor: 'white' }}
                                disabled={!canUpdateConfig}
                              />
                              <FormControl size="small" sx={{ backgroundColor: 'white' }} disabled={!canUpdateConfig}>
                                <InputLabel>Splitup Template</InputLabel>
                                <Select
                                  value={group.templateId || 'none'}
                                  label="Splitup Template"
                                  onChange={(e) => {
                                    const val = e.target.value === 'none' ? undefined : e.target.value;
                                    updateGroup(group.id, 'templateId', val);
                                  }}
                                >
                                  <MenuItem value="none">
                                    <em>None (Manual Rate)</em>
                                  </MenuItem>
                                  {templates.map(t => (
                                    <MenuItem key={t.id} value={t.id}>{t.title}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <TextField
                                    size="small"
                                    type="number"
                                    label="Per Day Salary (₹)"
                                    value={group.perDaySalary}
                                    onChange={(e) => updateGroup(group.id, 'perDaySalary', e.target.value)}
                                    sx={{ backgroundColor: 'white', flex: 1 }}
                                    disabled={!canUpdateConfig}
                                  />
                                  {group.templateId && canUpdateConfig && (
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      onClick={() => {
                                        const autoVal = getAutoPerDaySalary(group, group.templateId!);
                                        updateGroup(group.id, 'perDaySalary', autoVal);
                                      }}
                                      sx={{ height: 40, textTransform: 'none' }}
                                    >
                                      Auto
                                    </Button>
                                  )}
                                </Box>
                                {(() => {
                                  if (!group.templateId) return null;
                                  const stats = getTemplateStats(group.templateId);
                                  if (!stats) return null;
                                  const template = templates.find(t => t.id === group.templateId);
                                  if (!template) return null;

                                  const remainingMonths = globalPoEndDate
                                    ? Math.max(0, dayjs(globalPoEndDate).endOf('month').diff(dayjs(`${currentMonth}-01`).startOf('month'), 'month'))
                                    : 0;

                                  if (!globalPoEndDate) {
                                    return (
                                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                        Please configure PO End Date in Configurations tab to verify future capacity.
                                      </Typography>
                                    );
                                  }

                                  const perDay = Number(group.perDaySalary) || 0;
                                  const templateMaxDays = template.maxDays !== undefined && template.maxDays !== '' && template.maxDays !== null ? Number(template.maxDays) : maxAllowedDays;
                                  const futureCost = (Number(template.maxStaffs) || 0) * remainingMonths * templateMaxDays * perDay;
                                  const isEnough = stats.remainingAmount >= futureCost;

                                  return (
                                    <Typography variant="caption" color={isEnough ? "success.main" : "error.main"} sx={{ fontWeight: 600, mt: 0.5, display: 'block' }}>
                                      {isEnough
                                        ? `✓ Remaining amount (₹${stats.remainingAmount.toLocaleString('en-IN')}) is sufficient to cover ${template.maxStaffs} staffs for ${remainingMonths} months (Requires ₹${futureCost.toLocaleString('en-IN')}).`
                                        : `✗ Insufficient funds: Remaining amount (₹${stats.remainingAmount.toLocaleString('en-IN')}) cannot cover ${template.maxStaffs} staffs for ${remainingMonths} months (Requires ₹${futureCost.toLocaleString('en-IN')}, Deficit: ₹${(futureCost - stats.remainingAmount).toLocaleString('en-IN')}).`
                                      }
                                    </Typography>
                                  );
                                })()}
                              </Box>
                            </Box>
                          ) : (
                            <Box>
                              <Typography variant="subtitle1" fontWeight="600" onClick={() => toggleExpandGroup(group.id)} sx={{ cursor: 'pointer' }}>
                                {group.name || 'Unnamed Group'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {group.members.length} members &nbsp;&bull;&nbsp; ₹{displayPerDay} / day
                                {templateTitle && ` (${templateTitle})`}
                              </Typography>
                              {group.updatedAt && (
                                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5, fontSize: '0.7rem' }}>
                                  Last updated {dayjs(group.updatedAt).format('DD MMM YYYY, HH:mm')} by {group.updatedBy}
                                </Typography>
                              )}
                              {group.templateId && (() => {
                                const stats = getTemplateStats(group.templateId);
                                if (!stats) return null;
                                const template = templates.find(t => t.id === group.templateId);
                                if (!template) return null;

                                const remainingMonths = globalPoEndDate
                                  ? Math.max(0, dayjs(globalPoEndDate).endOf('month').diff(dayjs(`${currentMonth}-01`).startOf('month'), 'month'))
                                  : 0;

                                if (!globalPoEndDate) return null;

                                const perDay = Number(group.perDaySalary) || 0;
                                const templateMaxDays = template.maxDays !== undefined && template.maxDays !== '' && template.maxDays !== null ? Number(template.maxDays) : maxAllowedDays;
                                const futureCost = (Number(template.maxStaffs) || 0) * remainingMonths * templateMaxDays * perDay;
                                const isEnough = stats.remainingAmount >= futureCost;

                                if (isEnough) return null;

                                return (
                                  <Typography variant="caption" color="error.main" sx={{ fontWeight: 600, mt: 0.5, display: 'block' }}>
                                    ✗ Insufficient funds: Remaining amount (₹{stats.remainingAmount.toLocaleString('en-IN')}) cannot cover {template.maxStaffs} staffs for {remainingMonths} months (Requires ₹{futureCost.toLocaleString('en-IN')}, Deficit: ₹{(futureCost - stats.remainingAmount).toLocaleString('en-IN')}).
                                  </Typography>
                                );
                              })()}
                            </Box>
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pl: 2 }}>
                          {!isEditing && (
                            <Box sx={{ textAlign: 'right', mr: 2 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Total</Typography>
                              <Typography variant="subtitle2" fontWeight="700" color="primary.main">
                                ₹ {groupTotal.toLocaleString('en-IN')}
                              </Typography>
                            </Box>
                          )}

                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {!isEditing && group.templateId && (
                              <Tooltip title="Print Splitup">
                                <IconButton
                                  color="secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSplitupGroup(group);
                                  }}
                                  size="small"
                                >
                                  <PrintIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {isEditing && (
                              <Tooltip title="Cancel">
                                <IconButton
                                  color="warning"
                                  onClick={(e) => handleCancelEditGroup(group.id, e)}
                                  size="small"
                                  sx={{ backgroundColor: 'warning.50' }}
                                >
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {(canCalculate || canUpdateConfig) && isCurrentMonthEditable && (
                              <Tooltip title={isEditing ? "Save" : "Edit"}>
                                <IconButton
                                  color={isEditing ? "success" : "primary"}
                                  onClick={(e) => toggleEditGroup(group.id, e)}
                                  size="small"
                                  sx={{ backgroundColor: isEditing ? 'success.50' : 'primary.50' }}
                                >
                                  {isEditing ? <CheckIcon /> : <EditIcon fontSize="small" />}
                                </IconButton>
                              </Tooltip>
                            )}
                            {canDeleteGroup && isCurrentMonthEditable && (
                              <Tooltip title="Delete">
                                <IconButton color="error" onClick={(e) => deleteGroup(group.id, e)} size="small">
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                      </Box>

                      {/* Group Body */}
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <CardContent sx={{ p: 2, pb: '16px !important' }}>
                          {group.templateId && (() => {
                            const stats = getTemplateStats(group.templateId);
                            if (!stats) return null;
                            const template = templates.find(t => t.id === group.templateId);
                            const remainingMonths = globalPoEndDate ? Math.max(0, dayjs(globalPoEndDate).endOf('month').diff(dayjs(`${currentMonth}-01`).startOf('month'), 'month')) : 0;
                            const perDay = Number(group.perDaySalary) || 0;
                            const templateMaxDays = template?.maxDays !== undefined && template?.maxDays !== '' && template?.maxDays !== null ? Number(template.maxDays) : maxAllowedDays;
                            const futureCost = (Number(template?.maxStaffs) || 0) * remainingMonths * templateMaxDays * perDay;
                            const isEnough = !globalPoEndDate || stats.remainingAmount >= futureCost;
                            return (
                              <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                                <Grid container spacing={2}>
                                  <Grid item xs={6} sm={3}>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Allotted Amount</Typography>
                                    <Typography variant="body2" fontWeight="700">₹ {stats.totalAmount.toLocaleString('en-IN')}</Typography>
                                  </Grid>
                                  <Grid item xs={6} sm={3}>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Reserved Amount ({template?.reserveType === 'amount' ? 'Custom' : `${template?.reserveValue || 5}%`})</Typography>
                                    <Typography variant="body2" fontWeight="700" color={stats.reservedAmount > 0 ? "warning.main" : "text.secondary"}>
                                      {stats.reservedAmount > 0 ? `₹ ${stats.reservedAmount.toLocaleString('en-IN')}` : 'Disabled'}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={6} sm={3}>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Consumed Amount</Typography>
                                    <Typography variant="body2" fontWeight="700" color="primary.main">₹ {stats.consumedAmount.toLocaleString('en-IN')}</Typography>
                                  </Grid>
                                  <Grid item xs={6} sm={3}>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Remaining Amount</Typography>
                                    <Typography variant="body2" fontWeight="700" color={(stats.remainingAmount >= 0 && isEnough) ? "success.main" : "error.main"}>
                                      ₹ {stats.remainingAmount.toLocaleString('en-IN')}
                                    </Typography>
                                  </Grid>

                                  <Grid item xs={6} sm={4}>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Consumed Units</Typography>
                                    <Typography variant="body2" fontWeight="700" color="primary.main">{(stats.consumedUnits || 0).toFixed(2)}</Typography>
                                  </Grid>
                                  <Grid item xs={6} sm={4}>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Remaining Units</Typography>
                                    <Typography variant="body2" fontWeight="700" color={(stats.remainingUnits || 0) >= 0 ? "success.main" : "error.main"}>
                                      {(stats.remainingUnits || 0).toFixed(2)}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={6} sm={4}>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Remaining Months</Typography>
                                    <Typography variant="body2" fontWeight="700">
                                      {globalPoEndDate ? `${remainingMonths} month(s)` : 'N/A'}
                                    </Typography>
                                  </Grid>
                                </Grid>
                              </Box>
                            );
                          })()}
                          <TableContainer component={Box} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
                            <Table size="small">
                              <TableHead sx={{ backgroundColor: 'grey.50' }}>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 600, py: 1 }}>Member Name</TableCell>
                                  <TableCell sx={{ fontWeight: 600, py: 1, width: 100 }}>Days</TableCell>
                                  <TableCell sx={{ fontWeight: 600, py: 1, width: 100 }}>OT Hours</TableCell>
                                  <TableCell sx={{ fontWeight: 600, py: 1, width: 150, textAlign: 'right' }}>Total (₹)</TableCell>
                                  {isEditing && <TableCell sx={{ width: 60, py: 1, textAlign: 'center' }}>Action</TableCell>}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {group.members.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={isEditing ? 5 : 4} align="center" sx={{ py: 3 }}>
                                      <Typography variant="body2" color="text.secondary">
                                        No members added yet. {isEditing && 'Click "Add Member" below.'}
                                      </Typography>
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  group.members.map((member) => (
                                    <TableRow key={member.id} hover>
                                      <TableCell sx={{ py: isEditing ? 1 : 1.5 }}>
                                        {isEditing ? (
                                          <TextField
                                            size="small"
                                            fullWidth
                                            value={member.name}
                                            onChange={(e) => updateMember(group.id, member.id, 'name', e.target.value)}
                                            placeholder="Enter name"
                                          />
                                        ) : (
                                          <Typography variant="body2">{member.name || '-'}</Typography>
                                        )}
                                      </TableCell>
                                      <TableCell sx={{ py: isEditing ? 1 : 1.5 }}>
                                        {isEditing ? (
                                          <TextField
                                            size="small"
                                            type="number"
                                            fullWidth
                                            value={member.days}
                                            onChange={(e) => updateMember(group.id, member.id, 'days', e.target.value)}
                                            inputProps={{ min: 0 }}
                                          />
                                        ) : (
                                          <Typography variant="body2">{member.days || 0}</Typography>
                                        )}
                                      </TableCell>
                                      <TableCell sx={{ py: isEditing ? 1 : 1.5 }}>
                                        {isEditing ? (
                                          <TextField
                                            size="small"
                                            type="number"
                                            fullWidth
                                            value={member.otHours ?? 0}
                                            onChange={(e) => updateMember(group.id, member.id, 'otHours', e.target.value)}
                                            inputProps={{ min: 0 }}
                                          />
                                        ) : (
                                          <Typography variant="body2">{member.otHours || 0}</Typography>
                                        )}
                                      </TableCell>
                                      <TableCell sx={{ textAlign: 'right', py: isEditing ? 1 : 1.5 }}>
                                        <Typography variant="body2" fontWeight="500">
                                          ₹ {(((Number(member.days) || 0) * displayPerDay) + ((displayPerDay / 8) * (Number(member.otHours) || 0))).toLocaleString('en-IN')}
                                        </Typography>
                                      </TableCell>
                                      {isEditing && (
                                        <TableCell align="center" sx={{ py: 1 }}>
                                          <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => deleteMember(group.id, member.id)}
                                          >
                                            <DeleteIcon fontSize="small" />
                                          </IconButton>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </TableContainer>

                          {isEditing && (
                            <Box sx={{ mt: 2 }}>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<AddIcon />}
                                onClick={() => addMember(group.id)}
                                sx={{ textTransform: 'none', borderRadius: 1.5 }}
                              >
                                Add Member
                              </Button>
                            </Box>
                          )}
                        </CardContent>
                      </Collapse>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Box>
      )}

      {activeTab === 1 && (
        <Box>
          {/* Bonus Control Panel */}
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              mb: 3,
              borderRadius: 2,
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
              gap: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              backgroundColor: 'background.paper'
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="h6" fontWeight="700" color="text.primary">
                Onam Bonus Tracker
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Track and manage employee bonuses. Deduct configured amount monthly leading up to Onam, and reset back to ₹0 after Onam.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', width: { xs: '100%', md: 'auto' } }}>
              <TextField
                size="small"
                label="Bonus Amount (₹)"
                type="number"
                value={bonusConfigAmount}
                onChange={(e) => setBonusConfigAmount(e.target.value)}
                sx={{ width: 140, backgroundColor: 'white' }}
                InputProps={{
                  inputProps: { min: 0 }
                }}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<SyncIcon />}
                onClick={handleSyncFromSalary}
                sx={{ borderRadius: 1.5, textTransform: 'none', px: 2, height: 40 }}
              >
                Sync Employees
              </Button>
              <Tooltip title={isAllActiveAddedThisMonth ? "All active employees have already received a bonus this month" : `Quick add ₹${Number(bonusConfigAmount) || 1000} to all active employees`}>
                <span>
                  <Button
                    variant="contained"
                    size="small"
                    color="success"
                    startIcon={<AddIcon />}
                    onClick={handleQuickAddAll}
                    disabled={isAllActiveAddedThisMonth}
                    sx={{ borderRadius: 1.5, textTransform: 'none', px: 2, height: 40, boxShadow: 'none' }}
                  >
                    Quick Add All
                  </Button>
                </span>
              </Tooltip>
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<RefreshIcon />}
                onClick={handleResetAllBonus}
                sx={{ borderRadius: 1.5, textTransform: 'none', px: 2, height: 40 }}
              >
                Reset All to ₹0
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="secondary"
                startIcon={<HistoryIcon />}
                onClick={() => setIsHistoryDrawerOpen(true)}
                sx={{ borderRadius: 1.5, textTransform: 'none', px: 2, height: 40 }}
              >
                View History
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleOpenAddBonus}
                sx={{ borderRadius: 1.5, textTransform: 'none', px: 2, height: 40, boxShadow: 'none' }}
              >
                Add Employee
              </Button>
            </Box>
          </Paper>

          {/* Stats Section */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  Total Tracked Employees
                </Typography>
                <Typography variant="h4" fontWeight="700" sx={{ mt: 1 }}>
                  {bonusEntries.length}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  Total Accumulated Bonus Pool
                </Typography>
                <Typography variant="h4" fontWeight="700" color="primary.main" sx={{ mt: 1 }}>
                  ₹ {bonusEntries.reduce((sum, e) => sum + (e.accumulatedAmount || 0), 0).toLocaleString('en-IN')}
                </Typography>
              </Card>
            </Grid>
          </Grid>

          {/* Bonus Entries Table */}
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Table>
              <TableHead sx={{ backgroundColor: 'grey.50' }}>
                <TableRow>
                  <TableCell sx={{ width: 50 }} />
                  <TableCell sx={{ fontWeight: 600 }}>Employee Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Accumulated Bonus</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Notes / Remarks</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Last Updated By</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 320, textAlign: 'center' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bonusEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                      <GiftIcon style={{ fontSize: 40, color: '#bdbdbd', marginBottom: 12 }} />
                      <Typography variant="subtitle1" fontWeight="500" color="text.primary" gutterBottom>
                        No employee bonuses tracked yet
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Click "Sync Employees" to pull names from the salary sheet, or "Add Employee" to create manually.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  [...bonusEntries]
                    .sort((a, b) => {
                      if (a.resigned && !b.resigned) return 1;
                      if (!a.resigned && b.resigned) return -1;
                      return a.name.localeCompare(b.name);
                    })
                    .map((entry) => {
                      const amt = entry.accumulatedAmount || 0;
                      const isQuickAddDisabled = entry.lastAddedMonth === dayjs().format('YYYY-MM') || entry.resigned;
                      const isExpanded = expandedBonusRowIds.includes(entry.id);
                      return (
                        <React.Fragment key={entry.id}>
                          <TableRow
                            hover
                            sx={{
                              backgroundColor: entry.resigned ? 'rgba(0, 0, 0, 0.03)' : 'inherit',
                              opacity: entry.resigned ? 0.75 : 1
                            }}
                          >
                            <TableCell sx={{ width: 50 }}>
                              <IconButton size="small" onClick={() => toggleExpandBonusRow(entry.id)}>
                                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              </IconButton>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 500 }}>
                              {entry.name}
                              {entry.resigned && (
                                <Chip
                                  size="small"
                                  label="Resigned"
                                  color="error"
                                  sx={{ ml: 1, height: 20, fontSize: '0.75rem', fontWeight: 600 }}
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <Box sx={{
                                display: 'inline-flex', px: 1.5, py: 0.5, borderRadius: 5, fontSize: '0.875rem', fontWeight: 600,
                                backgroundColor: amt > 0 ? 'success.50' : amt < 0 ? 'error.50' : 'grey.100',
                                color: amt > 0 ? 'success.700' : amt < 0 ? 'error.700' : 'text.secondary'
                              }}>
                                ₹ {amt.toLocaleString('en-IN')}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={entry.resigned ? "Inactive (Resigned)" : "Active"}
                                color={entry.resigned ? "default" : "success"}
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell color="text.secondary" sx={{ fontStyle: entry.notes ? 'normal' : 'italic' }}>
                              {entry.notes || 'No notes added'}
                            </TableCell>
                            <TableCell>
                              {entry.updatedBy ? (
                                <Box>
                                  <Typography variant="body2">{entry.updatedBy}</Typography>
                                  {entry.updatedAt && (
                                    <Typography variant="caption" color="text.disabled">
                                      {dayjs(entry.updatedAt).format('DD MMM YYYY, HH:mm')}
                                    </Typography>
                                  )}
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>-</Typography>
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <Tooltip title={entry.resigned ? "Resigned employees cannot receive bonuses" : (entry.lastAddedMonth === dayjs().format('YYYY-MM') ? `Already added for ${dayjs().format('MMMM YYYY')}` : `Quick Add +₹${bonusConfigAmount}`)}>
                                  <span>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="success"
                                      onClick={() => handleQuickAdd(entry)}
                                      disabled={isQuickAddDisabled}
                                      sx={{ textTransform: 'none', px: 1 }}
                                    >
                                      {entry.resigned ? 'Blocked' : (entry.lastAddedMonth === dayjs().format('YYYY-MM') ? '✓ Added' : `+₹${Number(bonusConfigAmount) || 1000}`)}
                                    </Button>
                                  </span>
                                </Tooltip>
                                <Tooltip title={entry.resigned ? "Re-activate Employee" : "Mark as Resigned"}>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color={entry.resigned ? "success" : "error"}
                                    onClick={() => handleToggleResign(entry)}
                                    sx={{ textTransform: 'none', px: 1, minWidth: 80 }}
                                  >
                                    {entry.resigned ? "Activate" : "Resign"}
                                  </Button>
                                </Tooltip>
                                <Tooltip title="Reset to ₹0">
                                  <IconButton
                                    size="small"
                                    color="warning"
                                    onClick={() => handleQuickReset(entry)}
                                  >
                                    <RefreshIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Edit Details">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => handleOpenEditBonus(entry)}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleDeleteBonusEntry(entry.id, entry.name)}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                  <Box sx={{ margin: 2 }}>
                                    <Typography variant="subtitle2" gutterBottom component="div" fontWeight="600">
                                      Monthly Credit Breakdown
                                    </Typography>
                                    <Table size="small" aria-label="additions">
                                      <TableHead sx={{ backgroundColor: 'grey.50' }}>
                                        <TableRow>
                                          <TableCell sx={{ fontWeight: 600 }}>Period / Cycle</TableCell>
                                          <TableCell sx={{ fontWeight: 600 }}>Credited Amount</TableCell>
                                          <TableCell sx={{ fontWeight: 600 }}>Date/Time</TableCell>
                                          <TableCell sx={{ fontWeight: 600 }}>Performed By</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {(!entry.additions || entry.additions.length === 0) ? (
                                          <TableRow>
                                            <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', fontStyle: 'italic', py: 2 }}>
                                              No monthly records found.
                                            </TableCell>
                                          </TableRow>
                                        ) : (
                                          entry.additions.map((add: any, idx: number) => (
                                            <TableRow key={idx}>
                                              <TableCell sx={{ fontWeight: 500 }}>{add.period || add.month}</TableCell>
                                              <TableCell sx={{ color: add.amount >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
                                                {add.amount >= 0 ? '+' : ''}₹{add.amount.toLocaleString('en-IN')}
                                              </TableCell>
                                              <TableCell>{dayjs(add.timestamp).format('DD MMM YYYY, HH:mm')}</TableCell>
                                              <TableCell>{add.updatedBy}</TableCell>
                                            </TableRow>
                                          ))
                                        )}
                                      </TableBody>
                                    </Table>
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </TableContainer>


        </Box>
      )}

      {activeTab === 2 && (
        <Box>
          <Paper variant="outlined" sx={{ p: 3, mb: 4, borderRadius: 2, backgroundColor: 'grey.50' }}>
            <Typography variant="subtitle1" fontWeight="600" sx={{ mb: 2 }}>
              General Settings
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Common Company Name"
                  value={isEditingGeneral ? tempCompanyName : globalCompanyName}
                  onChange={(e) => setTempCompanyName(e.target.value)}
                  disabled={!isEditingGeneral}
                  sx={{ backgroundColor: 'white' }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Common PO Number"
                  value={isEditingGeneral ? tempPoNumber : globalPoNumber}
                  onChange={(e) => setTempPoNumber(e.target.value)}
                  disabled={!isEditingGeneral}
                  sx={{ backgroundColor: 'white' }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="PO Start Date"
                  value={isEditingGeneral ? tempPoStartDate : globalPoStartDate}
                  onChange={(e) => setTempPoStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  disabled={!isEditingGeneral}
                  sx={{ backgroundColor: 'white' }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="PO End Date"
                  value={isEditingGeneral ? tempPoEndDate : globalPoEndDate}
                  onChange={(e) => setTempPoEndDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  disabled={!isEditingGeneral}
                  sx={{ backgroundColor: 'white' }}
                />
              </Grid>
            </Grid>
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              {isEditingGeneral ? (
                <>
                  <Button variant="outlined" size="small" onClick={handleCancelGeneral}>
                    Cancel
                  </Button>
                  <Button variant="contained" size="small" onClick={saveGlobalConfig} disableElevation>
                    Save
                  </Button>
                </>
              ) : (
                <Button variant="contained" size="small" onClick={handleEditGeneral} disableElevation>
                  Edit
                </Button>
              )}
            </Box>
          </Paper>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" fontWeight="600">
              Splitup Templates
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={addTemplate}
              sx={{ borderRadius: 1.5, textTransform: 'none', boxShadow: 'none' }}
            >
              Add Template
            </Button>
          </Box>

          {templates.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: 2, backgroundColor: 'grey.50' }}>
              <SettingsIcon style={{ fontSize: 48, color: '#bdbdbd', marginBottom: 12 }} />
              <Typography variant="subtitle1" fontWeight="500" color="text.primary" gutterBottom>
                No Templates Configured
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Create templates to define a title and map multiple activities and rates.
              </Typography>
              <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={addTemplate}>
                Add Template
              </Button>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {templates.map(template => {
                const isEditing = editingTemplateIds.includes(template.id);
                const totalRate = template.activities.reduce((sum, act) => sum + (Number(act.rate) || 0), 0);

                return (
                  <Grid item xs={12} lg={6} key={template.id}>
                    <Card variant="outlined" sx={{ borderRadius: 2 }}>
                      <Box sx={{ p: 2, backgroundColor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {isEditing ? (
                          <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField
                              size="small"
                              label="Template Title"
                              value={template.title}
                              onChange={(e) => updateTemplate(template.id, 'title', e.target.value)}
                              sx={{ backgroundColor: 'white' }}
                            />
                            <TextField
                              size="small"
                              type="number"
                              label="Max Staffs"
                              value={template.maxStaffs ?? 0}
                              onChange={(e) => updateTemplate(template.id, 'maxStaffs', e.target.value)}
                              sx={{ backgroundColor: 'white', width: 120 }}
                              inputProps={{ min: 0 }}
                            />
                            <TextField
                              size="small"
                              type="number"
                              label="Max Day"
                              value={template.maxDays ?? ''}
                              placeholder={String(maxAllowedDays)}
                              onChange={(e) => updateTemplate(template.id, 'maxDays', e.target.value)}
                              sx={{ backgroundColor: 'white', width: 120 }}
                              inputProps={{ min: 0 }}
                            />
                            <TextField
                              size="small"
                              type="number"
                              label="Initial Consumed Amount (₹)"
                              value={template.initialConsumedAmount ?? 0}
                              onChange={(e) => updateTemplate(template.id, 'initialConsumedAmount', e.target.value)}
                              sx={{ backgroundColor: 'white', width: 220 }}
                              inputProps={{ min: 0 }}
                            />
                            <TextField
                              size="small"
                              disabled
                              label="Calculated Allotted (₹)"
                              value={template.activities.reduce((sum, act) => sum + (Number(act.rate) || 0) * (Number(act.maxUnits) || 0), 0)}
                              sx={{ backgroundColor: 'grey.100', width: 180 }}
                            />
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={!!template.reserveEnabled}
                                    onChange={async (e) => {
                                      const nextChecked = e.target.checked;
                                      if (nextChecked) {
                                        setReserveTargetTemplateId(template.id);
                                        setReserveTypeState(template.reserveType || 'percentage');
                                        setReserveValueState(template.reserveValue !== undefined ? String(template.reserveValue) : '5');
                                        setReserveModalOpen(true);
                                      } else {
                                        const confirmed = await confirm(
                                          `Are you sure you want to disable the reserve amount for this template?`,
                                          'Disable Reserve Amount'
                                        );
                                        if (confirmed) {
                                          updateTemplate(template.id, 'reserveEnabled', false);
                                        }
                                      }
                                    }}
                                    color="primary"
                                  />
                                }
                                label="Reserve Amount"
                                sx={{ ml: 1 }}
                              />
                              {template.reserveEnabled && (
                                <Tooltip title="Configure Reserve Settings">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => {
                                      setReserveTargetTemplateId(template.id);
                                      setReserveTypeState(template.reserveType || 'percentage');
                                      setReserveValueState(template.reserveValue !== undefined ? String(template.reserveValue) : '5');
                                      setReserveModalOpen(true);
                                    }}
                                    sx={{ ml: -0.5 }}
                                  >
                                    <SettingsIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </Box>
                        ) : (() => {
                          const stats = getTemplateStats(template.id);
                          const allotted = stats?.totalAmount ?? 0;
                          const reserved = stats?.reservedAmount ?? 0;
                          const remaining = stats?.remainingAmount ?? 0;
                          return (
                            <Box>
                              <Typography variant="subtitle1" fontWeight="600">{template.title}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                Allotted Amount: ₹{allotted.toLocaleString('en-IN')} &nbsp;&bull;&nbsp; Reserved Amount ({template.reserveType === 'amount' ? 'Custom' : `${template.reserveValue || 5}%`}): {template.reserveEnabled ? `₹${reserved.toLocaleString('en-IN')}` : 'Disabled'} &nbsp;&bull;&nbsp; Remaining Amount: ₹{remaining.toLocaleString('en-IN')} &nbsp;&bull;&nbsp; Max Staffs: {template.maxStaffs || 0} &nbsp;&bull;&nbsp; Max Day: {template.maxDays !== undefined && template.maxDays !== '' && template.maxDays !== null ? template.maxDays : `${maxAllowedDays} (Global)`}
                                {template.initialConsumedAmount !== undefined && template.initialConsumedAmount !== 0 && ` \u00a0\u2022\u00a0 Initial Consumed: ₹${Number(template.initialConsumedAmount).toLocaleString('en-IN')}`}
                              </Typography>
                            </Box>
                          );
                        })()}
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {isEditing && (
                            <Tooltip title="Cancel">
                              <IconButton
                                color="warning"
                                onClick={() => handleCancelEditTemplate(template.id)}
                                size="small"
                                sx={{ backgroundColor: 'warning.50' }}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title={isEditing ? "Save" : "Edit"}>
                            <IconButton
                              color={isEditing ? "success" : "primary"}
                              onClick={() => toggleEditTemplate(template.id)}
                              size="small"
                              sx={{ backgroundColor: isEditing ? 'success.50' : 'primary.50' }}
                            >
                              {isEditing ? <CheckIcon /> : <EditIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton color="error" onClick={() => deleteTemplate(template.id)} size="small">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>

                      <CardContent>
                        <TableContainer component={Box} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
                          <Table size="small">
                            <TableHead sx={{ backgroundColor: 'grey.50' }}>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 600, py: 1 }}>Activity Name</TableCell>
                                <TableCell sx={{ fontWeight: 600, py: 1, width: 100 }}>Rate (₹)</TableCell>
                                <TableCell sx={{ fontWeight: 600, py: 1, width: 100 }}>Max Units</TableCell>
                                <TableCell sx={{ fontWeight: 600, py: 1, width: 120 }}>Consumed Units</TableCell>
                                <TableCell sx={{ fontWeight: 600, py: 1, width: 120 }}>Remaining Units</TableCell>
                                <TableCell sx={{ fontWeight: 600, py: 1, width: 150 }}>Remaining Amount (₹)</TableCell>
                                <TableCell sx={{ fontWeight: 600, py: 1, width: 120, textAlign: 'right' }}>Total (₹)</TableCell>
                                {isEditing && <TableCell sx={{ width: 60, py: 1 }}></TableCell>}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {template.activities.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={isEditing ? 8 : 7} align="center" sx={{ py: 3 }}>
                                    <Typography variant="body2" color="text.secondary">
                                      No activities added.
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ) : (() => {
                                const activityStats = getTemplateActivitiesStats(template);
                                return template.activities.map(act => {
                                  const stats = activityStats[act.id] || { remainingUnits: Number(act.maxUnits) || 0, consumedUnits: 0, isNotEnough: false };
                                  return (
                                    <TableRow key={act.id}>
                                      <TableCell>
                                        {isEditing ? (
                                          <TextField
                                            size="small"
                                            fullWidth
                                            value={act.name}
                                            onChange={(e) => updateActivity(template.id, act.id, 'name', e.target.value)}
                                            placeholder="Activity"
                                          />
                                        ) : (
                                          <Typography variant="body2">{act.name}</Typography>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {isEditing ? (
                                          <TextField
                                            size="small"
                                            type="number"
                                            fullWidth
                                            value={act.rate}
                                            onChange={(e) => updateActivity(template.id, act.id, 'rate', e.target.value)}
                                          />
                                        ) : (
                                          <Typography variant="body2">₹{act.rate}</Typography>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {isEditing ? (
                                          <TextField
                                            size="small"
                                            type="number"
                                            fullWidth
                                            value={act.maxUnits ?? 0}
                                            onChange={(e) => updateActivity(template.id, act.id, 'maxUnits', e.target.value)}
                                            inputProps={{ min: 0 }}
                                          />
                                        ) : (
                                          <Typography variant="body2">{act.maxUnits || 0}</Typography>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <Typography variant="body2">
                                          {stats.consumedUnits.toFixed(2)}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>
                                        <Typography
                                          variant="body2"
                                          fontWeight="600"
                                          color={stats.isNotEnough ? 'error.main' : 'text.primary'}
                                        >
                                          {stats.remainingUnits.toFixed(2)}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>
                                        <Typography variant="body2" fontWeight="500">
                                          ₹ {((stats.remainingUnits || 0) * (Number(act.rate) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </Typography>
                                      </TableCell>
                                      <TableCell sx={{ textAlign: 'right' }}>
                                        <Typography variant="body2" fontWeight="500">
                                          ₹ {((Number(act.rate) || 0) * (Number(act.maxUnits) || 0)).toLocaleString('en-IN')}
                                        </Typography>
                                      </TableCell>
                                      {isEditing && (
                                        <TableCell>
                                          <IconButton size="small" color="error" onClick={() => deleteActivity(template.id, act.id)}>
                                            <DeleteIcon fontSize="small" />
                                          </IconButton>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  );
                                });
                              })()}
                            </TableBody>
                          </Table>
                        </TableContainer>

                        {isEditing && (
                          <Box sx={{ mt: 2 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<AddIcon />}
                              onClick={() => addActivity(template.id)}
                              sx={{ textTransform: 'none', borderRadius: 1.5 }}
                            >
                              Add Activity
                            </Button>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Box>
      )}

      {/* Splitup Print Dialog Component */}
      <SalarySplitupModal
        open={!!splitupGroup || showAllSplitupsModal}
        onClose={() => {
          setSplitupGroup(null);
          setShowAllSplitupsModal(false);
        }}
        splitupGroup={splitupGroup}
        allGroups={groups}
        showAll={showAllSplitupsModal}
        templates={templates}
        salaryData={salaryData}
        currentMonth={currentMonth}
        globalPoStartDate={globalPoStartDate}
        globalPoEndDate={globalPoEndDate}
        globalCompanyName={globalCompanyName}
        globalPoNumber={globalPoNumber}
        displayPeriod={displayPeriod}
        calculateGroupTotal={calculateGroupTotal}
      />

      {/* Send Email to Accounts Modal */}
      <Dialog open={showEmailModal} onClose={() => setShowEmailModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography variant="h6" fontWeight={700}>Send Salary Reports to Accounts</Typography>
          <IconButton onClick={() => setShowEmailModal(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The following 2 PDF reports for period <strong>{displayPeriod}</strong> will be generated and attached to the email:
          </Typography>
          <Box sx={{ bgcolor: '#f8fafc', p: 2, borderRadius: 2, border: '1px solid #e2e8f0', mb: 3 }}>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, fontWeight: 600, color: '#1e293b' }}>
              📄 1. Salary Report: Individual Members (.pdf)
            </Typography>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600, color: '#1e293b' }}>
              📄 2. All Splitup Reports (.pdf - multi-page)
            </Typography>
          </Box>
          <TextField
            label="Email Subject"
            fullWidth
            size="small"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            sx={{ mb: 2 }}
            helperText="Formated as Datacenter-{PO Number} - Bill {Start Date} to {End Date} - {Year}"
          />
          <TextField
            label="Recipient Email Address(es)"
            fullWidth
            size="small"
            multiline
            rows={2}
            value={emailRecipients}
            onChange={(e) => setEmailRecipients(e.target.value)}
            placeholder="e.g. accounts@vssc.gov.in, officer@vssc.gov.in"
            helperText="Separate multiple email addresses with commas."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShowEmailModal(false)} disabled={emailSending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<MailIcon />}
            onClick={handleSendSalaryEmail}
            disabled={emailSending || !emailRecipients.trim()}
          >
            {emailSending ? 'Sending Email & PDFs...' : 'Send Email to Accounts'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Salary Print Dialog */}
      <Dialog open={showSalaryPrint} onClose={() => setShowSalaryPrint(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Print Monthly Salary</Typography>
          <Button startIcon={<PrintIcon />} variant="contained" onClick={() => window.print()} className="no-print">
            Print / Save PDF
          </Button>
        </DialogTitle>
        <DialogContent dividers className="print-area-salary">
          <style>
            {`
              @page {
                size: portrait;
                margin: 0;
              }
              .print-area-salary table thead tr {
                height: 24px !important;
              }
              .print-area-salary table thead th, .print-area-salary table thead td {
                white-space: nowrap !important;
                padding-top: 4px !important;
                padding-bottom: 4px !important;
                height: 12px !important;
              }
              @media print {
                body * {
                  visibility: hidden;
                }
                .print-area-salary, .print-area-salary * {
                  visibility: visible;
                }
                .print-area-salary {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  padding: 1.2cm !important;
                  box-sizing: border-box;
                }
                .no-print {
                  display: none !important;
                }
              }
            `}
          </style>

          <Box sx={{ p: 2, bgcolor: 'white', color: 'black' }}>
            {/* Redesigned professional header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1e293b', pb: 1.5, mb: 3 }}>
              <Box>
                <Typography variant="h5" fontWeight="bold" sx={{ color: '#1e293b', whiteSpace: 'nowrap' }}>
                  {globalCompanyName || 'Company Name Not Set'}
                </Typography>
                <Typography variant="subtitle1" fontWeight="600" sx={{ color: '#475569', mt: 0.5, whiteSpace: 'nowrap' }}>
                  Salary Report: Individual Members
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                  PO Number: <span style={{ fontWeight: 400 }}>{globalPoNumber || 'N/A'}</span>
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155', mt: 0.5, whiteSpace: 'nowrap' }}>
                  Period: <span style={{ fontWeight: 400 }}>{displayPeriod}</span>
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', mt: 0.5, display: 'block', whiteSpace: 'nowrap' }}>
                  Generated: {dayjs().format('DD MMM YYYY, HH:mm')}
                </Typography>
              </Box>
            </Box>

            <TableContainer>
              <Table sx={{ border: '1px solid black', '& .MuiTableCell-root': { border: '1px solid black', color: 'black', py: 0.5, px: 1, fontSize: '0.8rem' } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 'bold', width: '50px' }}>Sl No.</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Name of the contract person</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '80px' }}>Days</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '100px' }}>OT Hours</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', width: '150px' }}>Total Amount (Rs)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    let totalGrandAmount = 0;
                    let slNo = 1;
                    return (
                      <>
                        {groups.map((group) => {
                          const perDay = Number(group.perDaySalary) || 0;
                          return group.members.map((member) => {
                            const days = Number(member.days) || 0;
                            const otHours = Number(member.otHours) || 0;
                            const amount = (days * perDay) + ((perDay / 8) * otHours);
                            totalGrandAmount += amount;
                            return (
                              <TableRow key={member.id}>
                                <TableCell>{slNo++}</TableCell>
                                <TableCell>{member.name}</TableCell>
                                <TableCell sx={{ textAlign: 'center' }}>{days.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</TableCell>
                                <TableCell sx={{ textAlign: 'center' }}>{otHours.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</TableCell>
                                <TableCell sx={{ textAlign: 'right' }}>{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              </TableRow>
                            );
                          });
                        })}
                        <TableRow>
                          <TableCell colSpan={4} sx={{ fontWeight: 'bold', textAlign: 'right' }}>Grand Total</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>{totalGrandAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      </>
                    );
                  })()}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </DialogContent>
        <DialogActions className="no-print">
          <Button onClick={() => setShowSalaryPrint(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={reserveModalOpen}
        onClose={() => setReserveModalOpen(false)}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              p: 1.5,
              minWidth: 400,
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Configure Reserve Amount</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="reserve-type-label">Reservation Type</InputLabel>
              <Select
                labelId="reserve-type-label"
                label="Reservation Type"
                value={reserveTypeState}
                onChange={(e) => {
                  const newType = e.target.value as 'percentage' | 'amount';
                  setReserveTypeState(newType);
                  if (newType === 'percentage') {
                    setReserveValueState('5');
                  } else {
                    const template = templates.find(t => t.id === reserveTargetTemplateId);
                    const totalAllotted = template?.activities.reduce((sum, act) => sum + (Number(act.rate) || 0) * (Number(act.maxUnits) || 0), 0) || 0;
                    setReserveValueState(String(Math.round(totalAllotted * 0.05)));
                  }
                }}
              >
                <MenuItem value="percentage">Percentage (%)</MenuItem>
                <MenuItem value="amount">Custom Fixed Amount (₹)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              size="small"
              type="number"
              label={reserveTypeState === 'percentage' ? "Percentage Value (%)" : "Custom Amount (₹)"}
              value={reserveValueState}
              onChange={(e) => setReserveValueState(e.target.value)}
              inputProps={{ min: 0 }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={() => setReserveModalOpen(false)} color="inherit" sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (reserveTargetTemplateId) {
                setTemplates(prev => prev.map(t => {
                  if (t.id === reserveTargetTemplateId) {
                    return {
                      ...t,
                      reserveEnabled: true,
                      reserveType: reserveTypeState,
                      reserveValue: Number(reserveValueState) || 0
                    };
                  }
                  return t;
                }));
              }
              setReserveModalOpen(false);
            }}
            color="primary"
            variant="contained"
            sx={{ borderRadius: 2 }}
          >
            Save Configuration
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for Adding/Editing Bonus Entry */}
      <Dialog
        open={isBonusModalOpen}
        onClose={() => setIsBonusModalOpen(false)}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              p: 1.5,
              minWidth: 400,
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          {editingBonusEntry ? 'Edit Employee Bonus Details' : 'Add Employee to Bonus Tracker'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1.5 }}>
            <TextField
              fullWidth
              size="small"
              label="Employee Name"
              value={bonusFormName}
              onChange={(e) => setBonusFormName(e.target.value)}
              disabled={!!editingBonusEntry}
            />
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Accumulated Bonus Amount (₹)"
              value={bonusFormAmount}
              onChange={(e) => setBonusFormAmount(e.target.value)}
              disabled={!!editingBonusEntry?.resigned}
              helperText={editingBonusEntry?.resigned ? "This employee is resigned. Bonus amount cannot be updated." : ""}
              error={!!editingBonusEntry?.resigned}
            />
            <TextField
              fullWidth
              size="small"
              label="Notes / Remarks"
              multiline
              rows={3}
              value={bonusFormNotes}
              onChange={(e) => setBonusFormNotes(e.target.value)}
              placeholder="e.g. Onam bonus savings, manual adjustments"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={() => setIsBonusModalOpen(false)} color="inherit" sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveBonusEntry}
            color="primary"
            variant="contained"
            sx={{ borderRadius: 2 }}
          >
            Save Entry
          </Button>
        </DialogActions>
      </Dialog>

      {/* Drawer for History Log */}
      <Drawer
        anchor="right"
        open={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 550 },
            p: 3,
            display: 'flex',
            flexDirection: 'column',
          }
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <HistoryIcon style={{ fontSize: 24, color: '#4f46e5' }} />
            <Typography variant="h6" fontWeight="700" color="text.primary">
              Bonus Action History
            </Typography>
          </Box>
          <IconButton onClick={() => setIsHistoryDrawerOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider sx={{ mb: 3 }} />
        <TableContainer sx={{ flexGrow: 1, overflowY: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Employee</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Details</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>By</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bonusHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary', fontStyle: 'italic' }}>
                    No action log records found.
                  </TableCell>
                </TableRow>
              ) : (
                bonusHistory.map((hist: any) => (
                  <TableRow key={hist.id}>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                      {dayjs(hist.timestamp).format('DD MMM YYYY, HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={hist.action}
                        color={
                          hist.action === 'Created' || hist.action === 'Added' || hist.action === 'Bulk Add' ? 'success' :
                            hist.action === 'Resigned' || hist.action === 'Deleted' ? 'error' :
                              hist.action === 'Reset All' ? 'warning' : 'primary'
                        }
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500, fontSize: '0.8rem' }}>{hist.employee}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{hist.details}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{hist.performedBy}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Drawer>
    </Box>
  );
};

export default Salary;
