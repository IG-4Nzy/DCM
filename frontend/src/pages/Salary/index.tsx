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
  DialogActions
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
  MdPrint as PrintIcon
} from 'react-icons/md';
import dayjs from 'dayjs';
import request from '../../services/request';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { useToast } from '../../contexts/ToastContext';

type Activity = {
  id: string;
  name: string;
  rate: number | string;
};

type Template = {
  id: string;
  title: string;
  activities: Activity[];
};

type Member = {
  id: string;
  name: string;
  days: number | string;
};

type Group = {
  id: string;
  name: string;
  perDaySalary: number | string;
  templateId?: string;
  members: Member[];
  updatedBy?: string;
  updatedAt?: string;
};

const Salary = () => {
  const { username, displayName } = useSelector((state: RootState) => state.auth);
  const { showToast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(dayjs().format('YYYY-MM'));
  const [salaryData, setSalaryData] = useState<Record<string, Group[]>>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [startDay, setStartDay] = useState<number>(1);
  const [endDay, setEndDay] = useState<number>(31);
  const [activeTab, setActiveTab] = useState(0);

  const [globalCompanyName, setGlobalCompanyName] = useState('');
  const [globalPoNumber, setGlobalPoNumber] = useState('');
  
  const [splitupGroup, setSplitupGroup] = useState<Group | null>(null);
  const [showSalaryPrint, setShowSalaryPrint] = useState(false);

  useEffect(() => {
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
        }
        if (salaryConfigRes.data) {
          setGlobalCompanyName(salaryConfigRes.data.companyName || '');
          setGlobalPoNumber(salaryConfigRes.data.poNumber || '');
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

  const deleteGroup = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newGroups = groups.filter(g => g.id !== id);
    updateGroupsInState(newGroups);
    saveGroupsToDB(currentMonth, newGroups);
    setEditingGroupIds(editingGroupIds.filter(gId => gId !== id));
    setExpandedGroupIds(expandedGroupIds.filter(gId => gId !== id));
  };

  const toggleEditGroup = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (editingGroupIds.includes(id)) {
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
    }

    setEditingGroupIds(prev => 
      prev.includes(id) ? prev.filter(gId => gId !== id) : [...prev, id]
    );
    if (!editingGroupIds.includes(id) && !expandedGroupIds.includes(id)) {
      setExpandedGroupIds(prev => [...prev, id]);
    }
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
            { id: Date.now().toString(), name: '', days: 0 }
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

  const deleteMember = (groupId: string, memberId: string) => {
    updateGroupsInState(groups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          members: g.members.filter(m => m.id !== memberId)
        };
      }
      return g;
    }));
  };

  const calculateGroupTotal = (group: Group) => {
    return group.members.reduce((sum, member) => sum + ((Number(member.days) || 0) * (Number(group.perDaySalary) || 0)), 0);
  };

  const calculateGrandTotal = () => {
    return groups.reduce((sum, group) => sum + calculateGroupTotal(group), 0);
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
      activities: []
    };
    const newTemplates = [newTemplate, ...templates];
    setTemplates(newTemplates);
    saveTemplatesToDB(newTemplates);
    setEditingTemplateIds([...editingTemplateIds, newTemplate.id]);
  };

  const updateTemplate = (id: string, field: keyof Template, value: any) => {
    setTemplates(templates.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const deleteTemplate = (id: string) => {
    const newTemplates = templates.filter(t => t.id !== id);
    setTemplates(newTemplates);
    saveTemplatesToDB(newTemplates);
    setEditingTemplateIds(editingTemplateIds.filter(tId => tId !== id));
  };

  const toggleEditTemplate = async (id: string) => {
    if (editingTemplateIds.includes(id)) {
      await saveTemplatesToDB(templates);
      showToast('Template saved successfully', 'success');
    }
    setEditingTemplateIds(prev => 
      prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id]
    );
  };

  const addActivity = (templateId: string) => {
    setTemplates(templates.map(t => {
      if (t.id === templateId) {
        return {
          ...t,
          activities: [...t.activities, { id: Date.now().toString(), name: '', rate: 0 }]
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

  const deleteActivity = (templateId: string, activityId: string) => {
    setTemplates(templates.map(t => {
      if (t.id === templateId) {
        return {
          ...t,
          activities: t.activities.filter(a => a.id !== activityId)
        };
      }
      return t;
    }));
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

  const saveGlobalConfig = async () => {
    try {
      await request.post('/api/salary/config', {
        companyName: globalCompanyName,
        poNumber: globalPoNumber
      });
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
                <Typography variant="caption" color="text.secondary" textTransform="uppercase" fontWeight="500">
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
                              <TextField
                                size="small"
                                type="number"
                                label="Per Day Salary (₹)"
                                value={group.perDaySalary} 
                                onChange={(e) => updateGroup(group.id, 'perDaySalary', e.target.value)}
                                sx={{ backgroundColor: 'white' }}
                              />
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
                          <TableContainer component={Box} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
                            <Table size="small">
                              <TableHead sx={{ backgroundColor: 'grey.50' }}>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 600, py: 1 }}>Member Name</TableCell>
                                  <TableCell sx={{ fontWeight: 600, py: 1, width: 140 }}>Days</TableCell>
                                  <TableCell sx={{ fontWeight: 600, py: 1, width: 150, textAlign: 'right' }}>Total (₹)</TableCell>
                                  {isEditing && <TableCell sx={{ width: 60, py: 1, textAlign: 'center' }}>Action</TableCell>}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {group.members.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={isEditing ? 4 : 3} align="center" sx={{ py: 3 }}>
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
                                      <TableCell sx={{ textAlign: 'right', py: isEditing ? 1 : 1.5 }}>
                                        <Typography variant="body2" fontWeight="500">
                                          ₹ {((Number(member.days) || 0) * displayPerDay).toLocaleString('en-IN')}
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
                  value={globalCompanyName}
                  onChange={(e) => setGlobalCompanyName(e.target.value)}
                  sx={{ backgroundColor: 'white' }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField 
                  fullWidth
                  size="small"
                  label="Common PO Number"
                  value={globalPoNumber}
                  onChange={(e) => setGlobalPoNumber(e.target.value)}
                  sx={{ backgroundColor: 'white' }}
                />
              </Grid>
            </Grid>
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" size="small" onClick={saveGlobalConfig} disableElevation>
                Save Settings
              </Button>
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
                          <TextField 
                            size="small" 
                            label="Template Title" 
                            value={template.title} 
                            onChange={(e) => updateTemplate(template.id, 'title', e.target.value)} 
                            sx={{ backgroundColor: 'white' }}
                          />
                        ) : (
                          <Box>
                            <Typography variant="subtitle1" fontWeight="600">{template.title}</Typography>
                            <Typography variant="caption" color="text.secondary">Total Rate: ₹{totalRate} / day</Typography>
                          </Box>
                        )}
                        <Box sx={{ display: 'flex', gap: 1 }}>
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
                                <TableCell sx={{ fontWeight: 600, py: 1, width: 120 }}>Rate (₹)</TableCell>
                                {isEditing && <TableCell sx={{ width: 60, py: 1 }}></TableCell>}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {template.activities.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={isEditing ? 3 : 2} align="center" sx={{ py: 3 }}>
                                    <Typography variant="body2" color="text.secondary">
                                      No activities added.
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ) : (
                                template.activities.map(act => (
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
                                    {isEditing && (
                                      <TableCell>
                                        <IconButton size="small" color="error" onClick={() => deleteActivity(template.id, act.id)}>
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

      {/* Splitup Print Dialog */}
      <Dialog open={!!splitupGroup} onClose={() => setSplitupGroup(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Print Splitup - {splitupGroup?.name}</Typography>
          <Button startIcon={<PrintIcon />} variant="contained" onClick={() => window.print()} className="no-print">
            Print
          </Button>
        </DialogTitle>
        <DialogContent dividers className="print-area">
          <style>
            {`
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
                }
                .no-print {
                  display: none !important;
                }
              }
            `}
          </style>
          
          {splitupGroup && (() => {
            const template = templates.find(t => t.id === splitupGroup.templateId);
            if (!template) return <Typography>Template not found.</Typography>;

            const groupTotal = calculateGroupTotal(splitupGroup);
            
            // Generate random weights for each activity to split the amounts randomly
            // We use seeded random or just Math.random. Since it's a print dialog, 
            // recalculating on open is fine.
            let totalWeight = 0;
            const weights = template.activities.map(() => {
              const w = Math.random() * 0.8 + 0.2; // random weight between 0.2 and 1.0
              totalWeight += w;
              return w;
            });

            return (
              <Box sx={{ p: 4, bgcolor: 'white', color: 'black' }}>
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                  <Typography variant="h5" fontWeight="bold">{globalCompanyName || 'Company Name Not Set'}</Typography>
                  <Typography variant="subtitle1" sx={{ mt: 1 }}>PO Number: {globalPoNumber || 'N/A'}</Typography>
                  <Typography variant="subtitle2" sx={{ mt: 1 }}>Salary Splitup: {splitupGroup.name}</Typography>
                  <Typography variant="body2">Period: {displayPeriod}</Typography>
                </Box>

                <TableContainer>
                  <Table sx={{ border: '1px solid black', '& .MuiTableCell-root': { border: '1px solid black', color: 'black' } }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>Activity Name</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Rate (₹)</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Units</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Amount (₹)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {template.activities.map((act, index) => {
                        const rate = Number(act.rate) || 0;
                        const amount = (weights[index] / totalWeight) * groupTotal;
                        const units = rate > 0 ? (amount / rate) : 0;
                        
                        return (
                          <TableRow key={act.id}>
                            <TableCell>{act.name}</TableCell>
                            <TableCell sx={{ textAlign: 'right' }}>{rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell sx={{ textAlign: 'right' }}>{Math.round(units).toLocaleString('en-IN')}</TableCell>
                            <TableCell sx={{ textAlign: 'right' }}>{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
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
          })()}
        </DialogContent>
        <DialogActions className="no-print">
          <Button onClick={() => setSplitupGroup(null)}>Close</Button>
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
                }
                .no-print {
                  display: none !important;
                }
              }
            `}
          </style>
          
          <Box sx={{ p: 4, bgcolor: 'white', color: 'black' }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography variant="h5" fontWeight="bold">{globalCompanyName || 'Company Name Not Set'}</Typography>
              <Typography variant="subtitle1" sx={{ mt: 1 }}>PO Number: {globalPoNumber || 'N/A'}</Typography>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>Salary Report: Individual Members</Typography>
              <Typography variant="body2">Period: {displayPeriod}</Typography>
            </Box>

            <TableContainer>
              <Table sx={{ border: '1px solid black', '& .MuiTableCell-root': { border: '1px solid black', color: 'black' } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 'bold', width: '50px' }}>Sl No.</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Name of the contract person</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Days</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Total Amount (Rs)</TableCell>
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
                            const amount = days * perDay;
                            totalGrandAmount += amount;
                            return (
                              <TableRow key={member.id}>
                                <TableCell>{slNo++}</TableCell>
                                <TableCell>{member.name}</TableCell>
                                <TableCell sx={{ textAlign: 'center' }}>{days.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</TableCell>
                                <TableCell sx={{ textAlign: 'right' }}>{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              </TableRow>
                            );
                          });
                        })}
                        <TableRow>
                          <TableCell colSpan={3} sx={{ fontWeight: 'bold', textAlign: 'right' }}>Grand Total</TableCell>
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
    </Box>
  );
};

export default Salary;
