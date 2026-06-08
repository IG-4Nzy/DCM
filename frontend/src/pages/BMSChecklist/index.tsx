import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, Button, IconButton, Chip,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import {
  MdAdd, MdDelete, MdDownload, MdCheckCircle, MdHistory, MdExpandMore,
  MdChevronRight, MdSearch, MdSave, MdFilterList, MdViewList, MdViewModule,
  MdDarkMode, MdLightMode
} from 'react-icons/md';
import dayjs from 'dayjs';
import { jsPDF } from 'jspdf';
import styles from './index.module.scss';
import {
  flattenConfig, unflattenRows,
  DEFAULT_CONFIG
} from './config';
import type { FlatRow, SavedChecklist } from './config';
import {
  listChecklists, getChecklist, saveChecklist, deleteChecklist,
  createNewChecklist
} from './storage';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';

// ─── Tolerance Check ───
function hasDeviation(value: string, bmsReading: string): boolean {
  const v = parseFloat(value);
  const b = parseFloat(bmsReading);
  if (isNaN(v) || isNaN(b) || b === 0) return false;
  return Math.abs((v - b) / b) > 0.10;
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

const BMSChecklist: React.FC = () => {
  const canView = hasPrivilege(PRIVILEGES.BMS_CHECKLIST_VIEW);
  const canCreate = hasPrivilege(PRIVILEGES.BMS_CHECKLIST_CREATE);
  const canUpdate = hasPrivilege(PRIVILEGES.BMS_CHECKLIST_UPDATE);
  const canDelete = hasPrivilege(PRIVILEGES.BMS_CHECKLIST_DELETE);

  // Tab state: 0 = Active Checklist, 1 = History
  const [activeTab, setActiveTab] = useState(0);

  // Active checklist
  const [checklist, setChecklist] = useState<SavedChecklist | null>(null);
  const [rows, setRows] = useState<FlatRow[]>([]);
  const [preparedBy, setPreparedBy] = useState('');

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [collapsedDevs, setCollapsedDevs] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [darkMode, setDarkMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(dayjs().format('HH:mm'));
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [newField, setNewField] = useState<FlatRow>(EMPTY_FIELD);

  // History
  const [history, setHistory] = useState<SavedChecklist[]>([]);
  const [viewingChecklist, setViewingChecklist] = useState<SavedChecklist | null>(null);
  const [viewRows, setViewRows] = useState<FlatRow[]>([]);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // ─── Load History ───
  const refreshHistory = useCallback(() => {
    setHistory(listChecklists());
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(dayjs().format('HH:mm'));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  // ─── Derived Data ───
  const categories = useMemo(() => {
    const cats = new Set<string>();
    rows.forEach(r => cats.add(r.category));
    return Array.from(cats);
  }, [rows]);

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
  const handleNewChecklist = () => {
    if (!canCreate) return;
    const newCl = createNewChecklist(preparedBy || 'Admin', DEFAULT_CONFIG);
    setChecklist(newCl);
    setRows(flattenConfig(newCl.data));
    setPreparedBy(newCl.preparedBy);
    setCollapsedCats(new Set());
    setCollapsedDevs(new Set());
    setActiveTab(0);
  };

  // ─── Open from History ───
  const handleOpenChecklist = (id: string) => {
    if (!canUpdate) return;
    const cl = getChecklist(id);
    if (cl) {
      setChecklist(cl);
      setRows(flattenConfig(cl.data));
      setPreparedBy(cl.preparedBy);
      setCollapsedCats(new Set());
      setCollapsedDevs(new Set());
      setActiveTab(0);
    }
  };

  // ─── View Checklist (read-only from history) ───
  const handleViewChecklist = (id: string) => {
    if (!canView) return;
    const cl = getChecklist(id);
    if (cl) {
      setViewingChecklist(cl);
      setViewRows(flattenConfig(cl.data));
    }
  };

  // ─── Save ───
  const handleSave = (status: 'Draft' | 'Completed' = 'Draft') => {
    if (!checklist || !canUpdate) return;
    const updatedConfig = unflattenRows(rows);
    const updated: SavedChecklist = {
      ...checklist,
      time: currentTime,
      preparedBy,
      status,
      data: updatedConfig,
      updatedAt: new Date().toISOString(),
    };
    saveChecklist(updated);
    setChecklist(updated);
    refreshHistory();
  };

  // ─── Delete ───
  const handleDeleteConfirm = () => {
    if (deleteTarget && canDelete) {
      deleteChecklist(deleteTarget);
      if (checklist?.id === deleteTarget) {
        setChecklist(null);
        setRows([]);
      }
      refreshHistory();
      setDeleteTarget(null);
    }
  };

  // ─── Row Update ───
  const updateRow = (index: number, field: EditableRowField, newVal: string) => {
    if (!canUpdate) return;
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
    const row: FlatRow = {
      ...newField,
      category: newField.category.trim(),
      device: newField.device.trim(),
      parameter: newField.parameter.trim(),
      unit: newField.unit.trim(),
      timestamp: new Date().toISOString(),
    };

    if (!row.category || !row.device || !row.parameter) return;

    setRows(prev => [...prev, row]);
    setCollapsedCats(prev => {
      const next = new Set(prev);
      next.delete(row.category);
      return next;
    });
    setCollapsedDevs(prev => {
      const next = new Set(prev);
      next.delete(`${row.category}::${row.device}`);
      return next;
    });
    setFilterCategory('');
    setSearchQuery('');
    setNewField(EMPTY_FIELD);
    setAddFieldOpen(false);
  };

  const removeRow = (index: number) => {
    if (!canDelete) return;
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

  // ─── PDF Export ───
  const handleExportPDF = () => {
    if (!checklist || !canView) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const rowHeight = 9;
    const columns = [
      { label: 'SL No', width: 14 },
      { label: 'Category', width: 46 },
      { label: 'Device', width: 48 },
      { label: 'Parameter', width: 50 },
      { label: 'Value', width: 32 },
      { label: 'BMS Reading', width: 34 },
      { label: 'Remarks', width: 59 },
    ];

    const drawHeader = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('Daily BMS Checklist Report', pageWidth / 2, 12, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Date: ${checklist.date}`, margin, 21);
      doc.text(`Time: ${currentTime}`, margin + 52, 21);
      doc.text(`Prepared By: ${preparedBy || '-'}`, margin + 100, 21);
      doc.text('Signature: ______________________________', pageWidth - margin, 21, { align: 'right' });
    };

    const drawTableHeader = (y: number) => {
      let x = margin;
      doc.setFillColor(30, 41, 59);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);

      columns.forEach((column) => {
        doc.rect(x, y, column.width, rowHeight, 'FD');
        doc.text(column.label, x + 2, y + 6);
        x += column.width;
      });

      doc.setTextColor(15, 23, 42);
    };

    const writeCell = (text: string, x: number, y: number, width: number, height: number) => {
      const value = text || '-';
      const lines = doc.splitTextToSize(value, width - 4).slice(0, 2);
      doc.rect(x, y, width, height);
      doc.text(lines, x + 2, y + 4.5);
    };

    drawHeader();
    let y = 28;
    drawTableHeader(y);
    y += rowHeight;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    rows.forEach((row, index) => {
      if (y + rowHeight > pageHeight - 13) {
        doc.addPage();
        drawHeader();
        y = 28;
        drawTableHeader(y);
        y += rowHeight;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
      }

      const rowValues = [
        String(index + 1),
        row.category,
        row.device,
        row.parameter,
        `${row.value || '-'}${row.unit ? ` ${row.unit}` : ''}`,
        row.bmsReading || '-',
        row.remarks || '-',
      ];

      let x = margin;
      const deviation = hasDeviation(row.value, row.bmsReading);
      if (deviation) {
        doc.setFillColor(254, 226, 226);
        doc.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F');
      }

      rowValues.forEach((value, colIndex) => {
        writeCell(value, x, y, columns[colIndex].width, rowHeight);
        x += columns[colIndex].width;
      });

      y += rowHeight;
    });

    doc.save(`BMS_Checklist_${checklist.date}_${currentTime.replace(':', '-')}.pdf`);
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
    editable: boolean,
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
                            <td>
                              {editable ? (
                                <input
                                  type="text"
                                  value={row.category}
                                  onChange={(e) => onUpdate?.(row.filteredIdx, 'category', e.target.value)}
                                />
                              ) : row.category}
                            </td>
                            <td>
                              {editable ? (
                                <input
                                  type="text"
                                  value={row.device}
                                  onChange={(e) => onUpdate?.(row.filteredIdx, 'device', e.target.value)}
                                />
                              ) : row.device}
                            </td>
                            <td>
                              {editable ? (
                                <div className={styles.container__fieldStack}>
                                  <input
                                    type="text"
                                    value={row.parameter}
                                    onChange={(e) => onUpdate?.(row.filteredIdx, 'parameter', e.target.value)}
                                  />
                                  <input
                                    type="text"
                                    value={row.unit}
                                    onChange={(e) => onUpdate?.(row.filteredIdx, 'unit', e.target.value)}
                                    placeholder="Unit"
                                  />
                                </div>
                              ) : (
                                <>
                                  {row.parameter}
                                  {row.unit && <span className={styles['container__table--unit']}>{row.unit}</span>}
                                </>
                              )}
                            </td>
                            <td>
                              {editable ? (
                                <input
                                  type="text"
                                  value={row.value}
                                  onChange={(e) => onUpdate?.(row.filteredIdx, 'value', e.target.value)}
                                  placeholder="—"
                                />
                              ) : (
                                <span>{row.value || '—'}</span>
                              )}
                              {deviation && (
                                <Tooltip title="Value deviates more than ±10% from BMS reading">
                                  <span className={styles.container__deviationMark}>!</span>
                                </Tooltip>
                              )}
                            </td>
                            <td className={styles['container__table--bmsVal']}>
                              {editable ? (
                                <input
                                  type="text"
                                  value={row.bmsReading}
                                  onChange={(e) => onUpdate?.(row.filteredIdx, 'bmsReading', e.target.value)}
                                  placeholder="—"
                                />
                              ) : row.bmsReading || '—'}
                            </td>
                            <td>
                              {editable ? (
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
    editable: boolean,
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
                            >
                              <div className={styles['container__paramCard--top']}>
                                <span>#{slNo}</span>
                                {deviation && <span className={styles.container__deviationMark}>!</span>}
                              </div>
                              <h4>
                                {editable ? (
                                  <input
                                    type="text"
                                    value={row.parameter}
                                    onChange={(e) => onUpdate?.(row.filteredIdx, 'parameter', e.target.value)}
                                  />
                                ) : row.parameter}
                                {editable ? (
                                  <input
                                    type="text"
                                    value={row.unit}
                                    onChange={(e) => onUpdate?.(row.filteredIdx, 'unit', e.target.value)}
                                    placeholder="Unit"
                                  />
                                ) : row.unit && <span>{row.unit}</span>}
                              </h4>
                              <div className={styles['container__paramCard--fields']}>
                                {editable && (
                                  <>
                                    <label>
                                      Category
                                      <input
                                        type="text"
                                        value={row.category}
                                        onChange={(e) => onUpdate?.(row.filteredIdx, 'category', e.target.value)}
                                      />
                                    </label>
                                    <label>
                                      Device
                                      <input
                                        type="text"
                                        value={row.device}
                                        onChange={(e) => onUpdate?.(row.filteredIdx, 'device', e.target.value)}
                                      />
                                    </label>
                                  </>
                                )}
                                <label>
                                  Value
                                  {editable ? (
                                    <input
                                      type="text"
                                      value={row.value}
                                      onChange={(e) => onUpdate?.(row.filteredIdx, 'value', e.target.value)}
                                      placeholder="-"
                                    />
                                  ) : (
                                    <strong>{row.value || '-'}</strong>
                                  )}
                                </label>
                                <label>
                                  BMS Reading
                                  {editable ? (
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
                                  {editable ? (
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
          {checklist ? (
            <>
              {/* Meta Info */}
              <Box className={styles.container__meta}>
                <Box className={styles['container__meta--field']}>
                  <label>Date</label>
                  <input type="date" value={checklist.date} onChange={(e) => setChecklist({ ...checklist, date: e.target.value })} />
                </Box>
                <Box className={styles['container__meta--field']}>
                  <label>Time</label>
                  <span>{currentTime}</span>
                </Box>
                <Box className={styles['container__meta--field']}>
                  <label>Prepared By</label>
                  <input value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} placeholder="Enter name" />
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
                    variant="outlined"
                    startIcon={<MdAdd />}
                    onClick={() => setAddFieldOpen(true)}
                    disabled={!canCreate}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
                  >
                    Add Field
                  </Button>
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
                    disabled={!canUpdate}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
                  >
                    Save Draft
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<MdCheckCircle />}
                    onClick={() => handleSave('Completed')}
                    disabled={!canUpdate}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
                  >
                    Mark Complete
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<MdDownload />}
                    onClick={handleExportPDF}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
                  >
                    Export PDF
                  </Button>
                </Box>
              </Box>

              {viewMode === 'table'
                ? renderChecklistTable(groupedData, canUpdate, updateRow, canDelete)
                : renderChecklistCards(groupedData, canUpdate, updateRow, canDelete)}
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 8, color: '#94a3b8' }}>
              <MdCheckCircle style={{ fontSize: 48, marginBottom: 12 }} />
              <Typography variant="h6" sx={{ color: '#64748b', mb: 1 }}>No Active Checklist</Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3 }}>
                Create a new checklist to start recording BMS data, or open one from history.
              </Typography>
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
            </Box>
          )}
        </>
      )}

      {/* ═══ Tab 1: History ═══ */}
      {activeTab === 1 && (
        <>
          {history.length > 0 ? (
            history.map(cl => (
              <Box key={cl.id} className={styles['container__history--card']}>
                <Box className={styles['container__history--card--left']}>
                  <h4>BMS Checklist — {dayjs(cl.date).format('DD MMM YYYY')}</h4>
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
                    disabled={!canUpdate}
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
        <DialogTitle sx={{ fontWeight: 600 }}>Delete Checklist</DialogTitle>
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
                value={newField.device}
                onChange={(e) => setNewField(prev => ({ ...prev, device: e.target.value }))}
                placeholder="PAC-1"
              />
            </label>
            <label>
              Parameter
              <input
                value={newField.parameter}
                onChange={(e) => setNewField(prev => ({ ...prev, parameter: e.target.value }))}
                placeholder="Temperature"
              />
            </label>
            <label>
              Unit
              <input
                value={newField.unit}
                onChange={(e) => setNewField(prev => ({ ...prev, unit: e.target.value }))}
                placeholder="C, %, V, A"
              />
            </label>
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
            disabled={!newField.category.trim() || !newField.device.trim() || !newField.parameter.trim()}
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
