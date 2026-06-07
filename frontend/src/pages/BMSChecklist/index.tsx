import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, Button, IconButton, Chip, TextField as MuiTextField,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import {
  MdAdd, MdDelete, MdDownload, MdCheckCircle, MdHistory, MdExpandMore,
  MdChevronRight, MdSearch, MdSave, MdFilterList
} from 'react-icons/md';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import {
  ChecklistConfig, FlatRow, flattenConfig, unflattenRows,
  DEFAULT_CONFIG, SavedChecklist
} from './config';
import {
  listChecklists, getChecklist, saveChecklist, deleteChecklist,
  createNewChecklist
} from './storage';

// ─── Tolerance Check ───
function hasDeviation(value: string, bmsReading: string): boolean {
  const v = parseFloat(value);
  const b = parseFloat(bmsReading);
  if (isNaN(v) || isNaN(b) || b === 0) return false;
  return Math.abs((v - b) / b) > 0.10;
}

const BMSChecklist: React.FC = () => {
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

  // History
  const [history, setHistory] = useState<SavedChecklist[]>([]);
  const [viewingChecklist, setViewingChecklist] = useState<SavedChecklist | null>(null);
  const [viewRows, setViewRows] = useState<FlatRow[]>([]);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  // ─── Load History ───
  const refreshHistory = useCallback(() => {
    setHistory(listChecklists());
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

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
    const cl = getChecklist(id);
    if (cl) {
      setViewingChecklist(cl);
      setViewRows(flattenConfig(cl.data));
    }
  };

  // ─── Save ───
  const handleSave = (status: 'Draft' | 'Completed' = 'Draft') => {
    if (!checklist) return;
    const updatedConfig = unflattenRows(rows);
    const updated: SavedChecklist = {
      ...checklist,
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
    if (deleteTarget) {
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
  const updateRow = (index: number, field: 'value' | 'remarks', newVal: string) => {
    setRows(prev => {
      const updated = [...prev];
      // Find original index in full rows array
      const targetRow = filteredRows[index];
      const realIdx = prev.findIndex(r =>
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
  const handleExportPDF = async () => {
    if (!checklist) return;
    // Dynamic import to avoid bundling if unused
    const html2pdf = (await import('html2pdf.js')).default;
    const element = printRef.current;
    if (!element) return;

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `BMS_Checklist_${checklist.date}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    html2pdf().set(opt).from(element).save();
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
    onUpdate?: (index: number, field: 'value' | 'remarks', val: string) => void
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
                  <td colSpan={7}>
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
                        <td colSpan={7}>
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
                                  <span style={{ color: '#dc2626', marginLeft: 4, fontSize: 12 }}>⚠</span>
                                </Tooltip>
                              )}
                            </td>
                            <td className={styles['container__table--bmsVal']}>
                              {row.bmsReading || '—'}
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

  return (
    <Box className={styles.container}>
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
                  <span>{checklist.time}</span>
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
                <MuiTextField
                  size="small"
                  placeholder="Search device, parameter..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{ startAdornment: <MdSearch style={{ marginRight: 6, color: '#94a3b8' }} /> }}
                  sx={{ width: 260 }}
                />
                <MuiTextField
                  select
                  size="small"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  SelectProps={{ native: true }}
                  sx={{ width: 200 }}
                  InputProps={{ startAdornment: <MdFilterList style={{ marginRight: 6, color: '#94a3b8' }} /> }}
                >
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </MuiTextField>

                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<MdSave />}
                    onClick={() => handleSave('Draft')}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
                  >
                    Save Draft
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<MdCheckCircle />}
                    onClick={() => handleSave('Completed')}
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

              {/* Printable Table Area */}
              <div ref={printRef}>
                {/* PDF Header (only visible in PDF) */}
                <div style={{ display: 'none' }} className="pdf-header">
                  <h2 style={{ textAlign: 'center', marginBottom: 4 }}>Daily BMS Checklist Report</h2>
                  <p style={{ textAlign: 'center', fontSize: 13, color: '#475569' }}>
                    Date: {checklist.date} &nbsp;|&nbsp; Time: {checklist.time} &nbsp;|&nbsp; Prepared By: {preparedBy}
                  </p>
                  <hr style={{ margin: '12px 0' }} />
                </div>

                {renderChecklistTable(groupedData, true, updateRow)}

                {/* PDF Signature (only visible in PDF) */}
                <div style={{ display: 'none' }} className="pdf-signature">
                  <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', padding: '0 40px' }}>
                    <div>
                      <p style={{ borderTop: '1px solid #333', paddingTop: 8, width: 200, textAlign: 'center' }}>Prepared By</p>
                    </div>
                    <div>
                      <p style={{ borderTop: '1px solid #333', paddingTop: 8, width: 200, textAlign: 'center' }}>Verified By</p>
                    </div>
                  </div>
                </div>
              </div>
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
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '6px' }}
                  >
                    Edit
                  </Button>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(cl.id); }}
                  >
                    <MdDelete />
                  </IconButton>
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
            <DialogTitle sx={{ fontWeight: 700 }}>
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
    </Box>
  );
};

export default BMSChecklist;
