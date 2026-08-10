// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import { jwtDecode } from 'jwt-decode';
import {
  Box, Typography, Tabs, Tab, Button, Chip, TextField, Tooltip, IconButton,
  FormControl, InputLabel, Select, MenuItem, FormGroup, FormControlLabel, Checkbox,
  Paper, Divider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination
} from '@mui/material';
import { MdSave, MdCheckCircle, MdHistory, MdSearch, MdVisibility, MdEdit, MdDownload } from 'react-icons/md';
import dayjs from 'dayjs';
import { getServerTime } from '../../../helpers/time';
import { hasPrivilege } from '../../../helpers/authUtils';
import { PRIVILEGES } from '../../../helpers/privileges';
import { useToast } from '../../../contexts/ToastContext';
import { exportChecklistPdf } from '../../../helpers/exportChecklistPdf';
import {
  fetchMorningChecklists,
  createMorningChecklist,
  updateMorningChecklist,
  fetchMorningChecklistConfig,
} from './action';
import request from '../../../services/request';
import DaySummary from '../../../components/DaySummary';

interface ConfigField {
  _id: string;
  label: string;
  inputType: string;
  options: string[];
  showRemarks: boolean;
  slNumber: number;
}

interface ChecklistItem {
  fieldId: string;
  label: string;
  inputType: string;
  options: string[];
  value: any;
  remarks: string;
  showRemarks: boolean;
}

interface MorningChecklistData {
  id?: string;
  _id?: string;
  date: string;
  department: string;
  preparedBy: string;
  createdBy: string;
  status: string;
  items: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
  completedBy?: string;
}

const MorningChecklist: React.FC = () => {
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

  const canView = hasPrivilege(PRIVILEGES.MORNING_CHECKLIST_VIEW);
  const canCreate = hasPrivilege(PRIVILEGES.MORNING_CHECKLIST_CREATE);
  const canUpdate = hasPrivilege(PRIVILEGES.MORNING_CHECKLIST_UPDATE);

  const todayStr = getServerTime().format('YYYY-MM-DD');

  // Sub-tabs: 0 = Active Checklist, 1 = History
  const [activeTab, setActiveTab] = useState(0);

  const [selectedDate, setSelectedDate] = useState<string>(getServerTime().format('YYYY-MM-DD'));

  // Active checklist data
  const [checklist, setChecklist] = useState<MorningChecklistData | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [configFields, setConfigFields] = useState<ConfigField[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // History state
  const [historyList, setHistoryList] = useState<MorningChecklistData[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyMonth, setHistoryMonth] = useState(getServerTime().format('YYYY-MM'));
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(0);
  const [historyRowsPerPage, setHistoryRowsPerPage] = useState(25);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [viewingChecklist, setViewingChecklist] = useState<MorningChecklistData | null>(null);

  const checkCanEdit = useCallback((chk: MorningChecklistData): boolean => {
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
      return completer === username && diffDays <= 1;
    }

    if (isToday || diffDays <= 1) {
      return true;
    }
    return false;
  }, [isSuperuser, username]);

  const handleOpenChecklist = (item: MorningChecklistData) => {
    setChecklist(item);
    setItems(item.items || []);
    setSelectedDate(item.date);
    setActiveTab(0);
  };

  // Load config fields
  const loadConfig = useCallback(async () => {
    try {
      const res = await fetchMorningChecklistConfig({ pagination: false });
      setConfigFields(res.data || []);
    } catch {
      setConfigFields([]);
    }
  }, []);

  // Load checklist for selected date
  const loadTodayChecklist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMorningChecklists({
        date: selectedDate,
        department: userDepartment,
        limit: 1,
      });
      if (res.data && res.data.length > 0) {
        const existing = res.data[0];
        setChecklist(existing);
        setItems(existing.items || []);
      } else {
        setChecklist(null);
        // Pre-populate items from config
        if (configFields.length > 0) {
          setItems(configFields.map((f) => ({
            fieldId: f._id,
            label: f.label,
            inputType: f.inputType,
            options: f.options || [],
            value: f.inputType === 'checkbox' ? [] : '',
            remarks: '',
            showRemarks: f.showRemarks,
          })));
        }
      }
    } catch {
      showToast('Failed to load checklist', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, userDepartment, configFields, showToast]);

  // Load history
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params: any = {
        department: userDepartment,
        skip: historyPage * historyRowsPerPage,
        limit: historyRowsPerPage,
      };
      if (historyMonth) params.month = historyMonth;
      if (historySearch) params.preparedBy = historySearch;
      const res = await fetchMorningChecklists(params);
      setHistoryList(res.data || []);
      setHistoryTotal(res.total || 0);
    } catch {
      setHistoryList([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [userDepartment, historyMonth, historySearch, historyPage, historyRowsPerPage]);

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
    loadConfig();
    loadDepartments();
  }, [loadConfig, loadDepartments]);

  useEffect(() => {
    if (configFields.length > 0 && activeTab === 0) {
      loadTodayChecklist();
    }
  }, [configFields, activeTab, loadTodayChecklist]);

  useEffect(() => {
    if (activeTab === 1) {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  // Handle item value change
  const handleItemChange = (index: number, field: 'value' | 'remarks', newValue: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: newValue };
      return updated;
    });
  };

  // Handle checkbox toggle
  const handleCheckboxToggle = (itemIndex: number, option: string) => {
    setItems((prev) => {
      const updated = [...prev];
      const current = Array.isArray(updated[itemIndex].value) ? [...updated[itemIndex].value] : [];
      const idx = current.indexOf(option);
      if (idx >= 0) {
        current.splice(idx, 1);
      } else {
        current.push(option);
      }
      updated[itemIndex] = { ...updated[itemIndex], value: current };
      return updated;
    });
  };

  // Save / Create
  const handleSave = async (markComplete = false) => {
    const isPast = dayjs(selectedDate).isBefore(getServerTime().format('YYYY-MM-DD'), 'day');
    const isFuture = dayjs(selectedDate).isAfter(getServerTime().format('YYYY-MM-DD'), 'day');
    const isCompleted = checklist?.status === 'Completed';
    const completer = checklist?.completedBy || checklist?.createdBy;
    const isReadOnly = isSuperuser
      ? isFuture
      : (isPast || isFuture || (isCompleted ? completer !== username : false));
    if (isReadOnly) {
      showToast('You do not have permission to edit this checklist.', 'error');
      return;
    }



    setSaving(true);
    try {
      const payload: any = {
        date: selectedDate,
        department: userDepartment,
        preparedBy: displayName,
        status: markComplete ? 'Completed' : 'Draft',
        items,
      };

      const clId = checklist?.id || checklist?._id;
      if (clId) {
        if (markComplete) {
          payload.completedBy = username;
        } else if (checklist.status === 'Completed') {
          payload.completedBy = checklist.completedBy || username;
        } else {
          payload.completedBy = checklist.completedBy;
        }
        await updateMorningChecklist(clId, payload);
        showToast(markComplete ? 'Checklist completed!' : 'Checklist saved!', 'success');
      } else {
        if (markComplete) {
          payload.completedBy = username;
        }
        await createMorningChecklist(payload);
        showToast('Checklist created!', 'success');
      }
      await loadTodayChecklist();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to save checklist';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!canView && !isSuperuser) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="textSecondary">Access Denied</Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          You do not have the required privilege to view Morning Checklist.
        </Typography>
      </Box>
    );
  }

  const renderFieldInput = (item: ChecklistItem, index: number, readOnly: boolean) => {
    switch (item.inputType) {
      case 'checkbox':
        return (
          <FormGroup row>
            {(item.options || []).map((opt) => (
              <FormControlLabel
                key={opt}
                control={
                  <Checkbox
                    size="small"
                    checked={Array.isArray(item.value) && item.value.includes(opt)}
                    onChange={() => !readOnly && handleCheckboxToggle(index, opt)}
                    disabled={readOnly}
                  />
                }
                label={<span style={{ fontSize: '0.85rem' }}>{opt}</span>}
              />
            ))}
          </FormGroup>
        );
      case 'dropdown':
        return (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <Select
              value={item.value || ''}
              onChange={(e) => !readOnly && handleItemChange(index, 'value', e.target.value)}
              displayEmpty
              disabled={readOnly}
              sx={{ fontSize: '0.85rem' }}
            >
              <MenuItem value="" disabled><em>Select...</em></MenuItem>
              {(item.options || []).map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      default: // text
        return (
          <TextField
            size="small"
            value={item.value || ''}
            onChange={(e) => !readOnly && handleItemChange(index, 'value', e.target.value)}
            disabled={readOnly}
            placeholder="Enter value..."
            sx={{ minWidth: 180 }}
          />
        );
    }
  };

  // ─── ACTIVE CHECKLIST TAB ───
  const renderActiveChecklist = () => {
    const isPast = dayjs(selectedDate).isBefore(getServerTime().format('YYYY-MM-DD'), 'day');
    const isFuture = dayjs(selectedDate).isAfter(getServerTime().format('YYYY-MM-DD'), 'day');
    const isCompleted = checklist?.status === 'Completed';
    const completer = checklist?.completedBy || checklist?.createdBy;
    const readOnly = isSuperuser
      ? isFuture
      : (isPast || isFuture || (isCompleted ? completer !== username : false));

    return (
      <Box>
        {/* Date header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
              {dayjs(selectedDate).format('dddd, MMMM D, YYYY')}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Server Time: {getServerTime().format('hh:mm:ss A')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {checklist && (
              <Chip
                label={checklist.status}
                color={checklist.status === 'Completed' ? 'success' : 'warning'}
                size="small"
                sx={{ fontWeight: 600 }}
              />
            )}
            {checklist && (
              <Typography variant="caption" color="textSecondary" sx={{ alignSelf: 'center' }}>
                Prepared by: {checklist.preparedBy}
              </Typography>
            )}
          </Box>
        </Box>

        {loading ? (
          <Typography color="textSecondary" sx={{ py: 4, textAlign: 'center' }}>Loading...</Typography>
        ) : items.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: '12px' }}>
            <Typography color="textSecondary">
              No fields configured yet. Please configure Morning Checklist fields from the Configurations page.
            </Typography>
          </Paper>
        ) : (
          <>
            <TableContainer component={Paper} sx={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                    <TableCell sx={{ fontWeight: 700, width: 50 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Value</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={item.fieldId || idx} sx={{ '&:nth-of-type(odd)': { bgcolor: '#fafbfc' } }}>
                      <TableCell sx={{ color: '#64748b', fontWeight: 600 }}>{idx + 1}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                          {item.label}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {renderFieldInput(item, idx, readOnly)}
                      </TableCell>
                      <TableCell>
                        {item.showRemarks ? (
                          <TextField
                            size="small"
                            value={item.remarks || ''}
                            onChange={(e) => !readOnly && handleItemChange(idx, 'remarks', e.target.value)}
                            disabled={readOnly}
                            placeholder="Remarks..."
                            multiline
                            maxRows={2}
                            sx={{ minWidth: 150 }}
                          />
                        ) : (
                          <Typography variant="caption" color="textSecondary">-</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Action Buttons */}
            {!readOnly && (canCreate || canUpdate || isSuperuser) && (
              <Box sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  startIcon={<MdSave />}
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
                >
                  {saving ? 'Saving...' : 'Save Draft'}
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<MdCheckCircle />}
                  onClick={() => handleSave(true)}
                  disabled={saving || checklist?.status === 'Completed'}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
                >
                  {saving ? 'Saving...' : 'Mark Complete'}
                </Button>
              </Box>
            )}

            <DaySummary date={selectedDate} />
          </>
        )}
      </Box>
    );
  };

  // ─── HISTORY TAB ───
  const renderHistory = () => {
    return (
      <Box>
        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            type="month"
            label="Filter by Month"
            value={historyMonth}
            onChange={(e) => {
              setHistoryMonth(e.target.value);
              setHistoryPage(0);
            }}
            slotProps={{ inputLabel: { shrink: true } }}
            size="small"
            sx={{ minWidth: 180 }}
          />
          <TextField
            label="Search by name or date"
            value={historySearch}
            onChange={(e) => {
              setHistorySearch(e.target.value);
              setHistoryPage(0);
            }}
            size="small"
            placeholder="Name or YYYY-MM-DD"
            slotProps={{ input: { startAdornment: <MdSearch style={{ marginRight: 4, color: '#94a3b8' }} /> } }}
            sx={{ minWidth: 240 }}
          />
        </Box>

        {historyLoading ? (
          <Typography color="textSecondary" sx={{ py: 4, textAlign: 'center' }}>Loading history...</Typography>
        ) : historyList.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: '12px' }}>
            <Typography color="textSecondary">No checklists found for this period.</Typography>
          </Paper>
        ) : (
          <>
            <TableContainer component={Paper} sx={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                    <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Prepared By</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Created At</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historyList.map((item, idx) => (
                    <TableRow key={item.id || item._id} hover>
                      <TableCell>{historyPage * historyRowsPerPage + idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{item.date}</TableCell>
                      <TableCell>{item.preparedBy}</TableCell>
                      <TableCell>
                        <Chip
                          label={item.status}
                          color={item.status === 'Completed' ? 'success' : 'warning'}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell>{item.createdAt ? dayjs(item.createdAt).format('DD/MM/YYYY hh:mm A') : '-'}</TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        <Tooltip title="View Checklist">
                          <IconButton size="small" onClick={() => setViewingChecklist(item)}>
                            <MdVisibility />
                          </IconButton>
                        </Tooltip>
                        {checkCanEdit(item) && (
                          <Tooltip title="Edit Checklist">
                            <IconButton size="small" color="primary" onClick={() => handleOpenChecklist(item)}>
                              <MdEdit />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={historyTotal}
              page={historyPage}
              onPageChange={(_, p) => setHistoryPage(p)}
              rowsPerPage={historyRowsPerPage}
              rowsPerPageOptions={[25, 50, 100]}
              onRowsPerPageChange={(e) => {
                setHistoryRowsPerPage(parseInt(e.target.value, 10));
                setHistoryPage(0);
              }}
            />
          </>
        )}

        {/* View Modal */}
        {viewingChecklist && (
          <Box sx={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            bgcolor: 'rgba(0,0,0,0.5)', zIndex: 1300,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }} onClick={() => setViewingChecklist(null)}>
            <Paper sx={{ maxWidth: 700, width: '90%', maxHeight: '80vh', overflow: 'auto', p: 3, borderRadius: '16px' }} onClick={(e) => e.stopPropagation()}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Morning Checklist — {viewingChecklist.date}
                </Typography>
                <Chip label={viewingChecklist.status} color={viewingChecklist.status === 'Completed' ? 'success' : 'warning'} size="small" />
              </Box>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Prepared by: {viewingChecklist.preparedBy}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                      <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Value</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(viewingChecklist.items || []).map((itm, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{itm.label}</TableCell>
                        <TableCell>
                          {Array.isArray(itm.value) ? itm.value.join(', ') : (itm.value || '-')}
                        </TableCell>
                        <TableCell>{itm.remarks || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <DaySummary date={viewingChecklist.date} />

              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<MdDownload />}
                  onClick={() => {
                    if (!viewingChecklist) return;
                    const pdfRows = (viewingChecklist.items || []).map((itm, idx) => [
                      idx + 1,
                      itm.label,
                      Array.isArray(itm.value) ? itm.value.join(', ') : (itm.value || '-'),
                      itm.remarks || '-',
                    ]);
                    exportChecklistPdf({
                      title: 'Morning Checklist',
                      date: viewingChecklist.date,
                      preparedBy: viewingChecklist.preparedBy,
                      status: viewingChecklist.status,
                      department: departments.find(d => d.id === viewingChecklist.department)?.name || viewingChecklist.department,
                      completedBy: viewingChecklist.completedBy,
                      columns: ['#', 'Item', 'Value', 'Remarks'],
                      rows: pdfRows,
                      fileName: `Morning_Checklist_${viewingChecklist.date}`,
                      includeDaySummary: true,
                    });
                  }}
                  sx={{ borderRadius: '8px', textTransform: 'none' }}
                >
                  Export PDF
                </Button>
                <Button variant="outlined" onClick={() => setViewingChecklist(null)} sx={{ borderRadius: '8px', textTransform: 'none' }}>
                  Close
                </Button>
              </Box>
            </Paper>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box>
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab
          label="Active Checklist"
          icon={<MdCheckCircle />}
          iconPosition="start"
          sx={{ textTransform: 'none', fontWeight: 600 }}
        />
        <Tab
          label="History"
          icon={<MdHistory />}
          iconPosition="start"
          sx={{ textTransform: 'none', fontWeight: 600 }}
        />
      </Tabs>

      {activeTab === 0 && renderActiveChecklist()}
      {activeTab === 1 && renderHistory()}
    </Box>
  );
};

export default MorningChecklist;
