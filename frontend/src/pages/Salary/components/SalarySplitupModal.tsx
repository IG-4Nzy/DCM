// @ts-nocheck
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { MdPrint as PrintIcon } from 'react-icons/md';
import dayjs from 'dayjs';
import styles from './index.module.scss';

const distributeInitialConsumedAmount = (
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

export interface SalarySplitupModalProps {
  open: boolean;
  onClose: () => void;
  splitupGroup: Group | null;
  allGroups?: Group[];
  showAll?: boolean;
  templates: Template[];
  salaryData: Record<string, Group[]>;
  currentMonth: string;
  globalPoStartDate: string | null;
  globalPoEndDate: string | null;
  globalCompanyName: string | null;
  globalPoNumber: string | null;
  displayPeriod: string;
  calculateGroupTotal: (group: Group) => number;
}

const SalarySplitupModal: React.FC<SalarySplitupModalProps> = ({
  open,
  onClose,
  splitupGroup,
  allGroups = [],
  showAll = false,
  templates,
  salaryData,
  currentMonth,
  globalPoStartDate,
  globalPoEndDate,
  globalCompanyName,
  globalPoNumber,
  displayPeriod,
  calculateGroupTotal,
}) => {
  const renderSingleGroupSplitup = (group: Group, isLast: boolean = false) => {
    const template = templates.find(t => t.id === group.templateId);
    if (!template) return null;

    const groupTotal = calculateGroupTotal(group);

    // Calculate deterministic splitup based on remaining units for each activity,
    // shared equally till the contract period ends.
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

      // 1. Calculate target units and cost for each activity
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

      // 2. Allocate the month's group total
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

    return (
      <Box 
        key={group.id} 
        className="splitup-page-block"
        sx={{ 
          p: 3, 
          bgcolor: 'white', 
          color: 'black', 
          pageBreakAfter: isLast ? 'auto' : 'always', 
          breakAfter: isLast ? 'auto' : 'page',
          mb: isLast ? 0 : 4 
        }}
      >
        <header className={styles["header"]}>
          <label className={styles["header__label-poNum"]}>PO NO: {globalPoNumber || 'N/A'}</label>
          <label className={styles["header__label-companyName"]}>Company name: {globalCompanyName || 'Company Name Not Set'}</label>
          <label className={styles["header__label-period"]}>{displayPeriod}</label>
        </header>

        <TableContainer>
          <Table sx={{ border: '1px solid black', '& .MuiTableCell-root': { border: '1px solid black', color: 'black' } }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell colSpan={5} align="center" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                  {template.title || group.name || 'Template'}
                </TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell sx={{ fontWeight: 'bold', whiteSpace: "nowrap" }}>SL NO</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Activity Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Rate (₹)</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Units</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Amount (₹)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {template.activities.map((act, index) => {
                const rate = Number(act.rate) || 0;
                const result = finalSplitupResults[act.id] || { amount: 0, units: 0 };

                return (
                  <TableRow key={act.id} className={styles["splitup__tableRow"]}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{act.name}</TableCell>
                    <TableCell sx={{ textAlign: 'right' }}>{rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell sx={{ textAlign: 'right' }}>{result.units.toFixed(2)}</TableCell>
                    <TableCell sx={{ textAlign: 'right' }}>{result.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell colSpan={3} sx={{ fontWeight: 'bold', textAlign: 'right' }}>Total Amount</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>{groupTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const targetGroups = showAll 
    ? allGroups.filter(g => !!g.templateId) 
    : (splitupGroup ? [splitupGroup] : []);

  const dialogTitleText = showAll
    ? `Print All Splitups (${targetGroups.length} Groups)`
    : `Print Splitup - ${splitupGroup?.name || ''}`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">{dialogTitleText}</Typography>
        {targetGroups.length > 0 && (
          <Button startIcon={<PrintIcon />} variant="contained" onClick={() => window.print()} className="no-print">
            Print / Save PDF
          </Button>
        )}
      </DialogTitle>
      <DialogContent dividers className="print-area">
        <style>
          {`
            @page {
              size: landscape;
              margin: 0;
            }
            .print-area table thead tr {
              height: 24px !important;
            }
            .print-area table thead th, .print-area table thead td {
              white-space: nowrap !important;
              padding-top: 4px !important;
              padding-bottom: 4px !important;
              height: 12px !important;
            }
            @media print {
              body * {
                visibility: hidden;
              }
              .print-area, .print-area * {
                visibility: visible;
              }
              .print-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                padding: 1.6cm !important;
                box-sizing: border-box;
              }
              .splitup-page-block {
                page-break-after: always !important;
                break-after: page !important;
              }
              .splitup-page-block:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}
        </style>

        {targetGroups.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No groups with splitup templates found for this month.
            </Typography>
          </Box>
        ) : (
          targetGroups.map((g, idx) => renderSingleGroupSplitup(g, idx === targetGroups.length - 1))
        )}
      </DialogContent>
      <DialogActions className="no-print">
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SalarySplitupModal;
