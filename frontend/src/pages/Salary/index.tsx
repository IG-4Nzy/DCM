// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  IconButton, 
  Grid,
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Collapse,
  Card,
  CardContent,
  Tooltip,
  Paper,
  Tabs,
  Tab,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch
} from '@mui/material';
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
  MdClose as CloseIcon
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

  const canView = isSuperuser || hasPrivilege(PRIVILEGES.SALARY_CALCULATION_VIEW);
  const canManage = isSuperuser || hasPrivilege(PRIVILEGES.SALARY_CALCULATION_CREATE) || hasPrivilege(PRIVILEGES.SALARY_CALCULATION_UPDATE);

  const [currentMonth, setCurrentMonth] = useState(dayjs().format('YYYY-MM'));
  const [salaryData, setSalaryData] = useState<Record<string, Group[]>>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [startDay, setStartDay] = useState<number>(1);
  const [endDay, setEndDay] = useState<number>(31);
  const [maxAllowedDays, setMaxAllowedDays] = useState<number>(26);
  const [activeTab, setActiveTab] = useState(0);

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

  useEffect(() => {
    if (!canView) return;
    const fetchAll = async () => {
      try {
        const [configRes, salaryConfigRes, templatesRes, allSalaryRes] = await Promise.all([
          request.get('/api/attendance/config'),
          request.get('/api/salary/config'),
          request.get('/api/salary/templates'),
          request.get('/api/salary')
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
        if (allSalaryRes.data) {
          const loadedData: Record<string, Group[]> = {};
          allSalaryRes.data.forEach((s: any) => {
            loadedData[s.month] = s.groups;
          });
          setSalaryData(loadedData);
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

  const saveGroupsToDB = async (month: string, newGroups: Group[]) => {
    try {
      await request.post(`/api/salary/${month}`, newGroups);
    } catch (e) {
      showToast('Failed to save groups to database', 'error');
    }
  };

  const addGroup = () => {
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

    const futureUnits = (Number(template.maxStaffs) || 0) * remainingMonths * maxAllowedDays;

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
    const requiredUnitsPerActivity = Number(template.maxStaffs || 0) * remainingMonthsNow * 30;

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
  const displayPeriod = `${cycleStartStr} - ${cycleEndStr}`;

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

  return (
    <Box sx={{ maxWidth: 1100, margin: '0 auto', p: { xs: 2, md: 3 }, fontFamily: '"Inter", sans-serif' }}>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)} aria-label="salary tabs">
          <Tab icon={<WalletIcon />} iconPosition="start" label="Salary Calculation" />
          <Tab icon={<SettingsIcon />} iconPosition="start" label="Configuration" />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <Box>
          {/* Control Panel */}
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              mb: 3, 
              borderRadius: 2,
              display: 'flex', 
              flexDirection: { xs: 'column', md: 'row' }, 
              justifyContent: 'space-between', 
              alignItems: { xs: 'flex-start', md: 'center' },
              gap: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', backgroundColor: 'grey.50', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1, py: 0.5 }}>
                <IconButton onClick={handlePreviousMonth} size="small" color="primary">
                  <ChevronLeftIcon />
                </IconButton>
                <Box sx={{ textAlign: 'center', minWidth: 140, px: 1 }}>
                  <Typography variant="subtitle2" fontWeight="600">
                    {dayjs(currentMonth).format('MMMM YYYY')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {displayPeriod}
                  </Typography>
                </Box>
                <IconButton onClick={handleNextMonth} size="small" color="primary">
                  <ChevronRightIcon />
                </IconButton>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 500 }}>
                  Grand Total
                </Typography>
                <Typography variant="h6" fontWeight="700" color="primary.main">
                  ₹ {calculateGrandTotal().toLocaleString('en-IN')}
                </Typography>
              </Box>
              <Button 
                variant="outlined" 
                size="small" 
                startIcon={<PrintIcon />} 
                onClick={() => setShowSalaryPrint(true)}
                sx={{ borderRadius: 1.5, textTransform: 'none', px: 2, boxShadow: 'none', display: { xs: 'none', sm: 'inline-flex' } }}
              >
                Print PDF
              </Button>
              <Button 
                variant="contained" 
                size="small" 
                startIcon={<AddIcon />} 
                onClick={addGroup}
                sx={{ borderRadius: 1.5, textTransform: 'none', px: 2, boxShadow: 'none' }}
              >
                Add Group
              </Button>
            </Box>
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
              <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={addGroup}>
                Add Group
              </Button>
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
                              />
                              <FormControl size="small" sx={{ backgroundColor: 'white' }}>
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
                                  />
                                  {group.templateId && (
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
                                  const futureCost = (Number(template.maxStaffs) || 0) * remainingMonths * maxAllowedDays * perDay;
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
                            <Tooltip title="Delete">
                              <IconButton color="error" onClick={(e) => deleteGroup(group.id, e)} size="small">
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
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
                                    <Typography variant="body2" fontWeight="700" color={stats.remainingAmount >= 0 ? "success.main" : "error.main"}>
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
                                Allotted Amount: ₹{allotted.toLocaleString('en-IN')} &nbsp;&bull;&nbsp; Reserved Amount ({template.reserveType === 'amount' ? 'Custom' : `${template.reserveValue || 5}%`}): {template.reserveEnabled ? `₹${reserved.toLocaleString('en-IN')}` : 'Disabled'} &nbsp;&bull;&nbsp; Remaining Amount: ₹{remaining.toLocaleString('en-IN')} &nbsp;&bull;&nbsp; Max Staffs: {template.maxStaffs || 0}
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
        open={!!splitupGroup}
        onClose={() => setSplitupGroup(null)}
        splitupGroup={splitupGroup}
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
    </Box>
  );
};

export default Salary;
