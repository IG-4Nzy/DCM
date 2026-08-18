// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, IconButton, FormControl, InputLabel, Select, MenuItem, Typography, Paper, Alert, Tooltip } from '@mui/material';
import TextField from '../../../components/TextField';
import { MdAdd as AddIcon, MdDelete as DeleteIcon, MdClose as CloseIcon } from 'react-icons/md';
import Button from '../../../components/Button';
import type { WorkLogData, WorkLogEntry } from '../model';

interface WorkLogFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingLog: WorkLogData | null;
  users: any[];
  canViewAllLogs: boolean;
  currentUser: string;
  onSubmit: (payload: any) => Promise<void>;
}

export const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return -1;
  const str = timeStr.trim().toUpperCase();
  if (str.includes("AM") || str.includes("PM")) {
    const isPm = str.includes("PM");
    const clean = str.replace("AM", "").replace("PM", "").trim();
    const parts = clean.split(":");
    let hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    if (hours === 12) hours = isPm ? 12 : 0;
    else if (isPm) hours += 12;
    return hours * 60 + minutes;
  }
  const parts = str.split(":");
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
};

export const checkEntriesOverlap = (entries: WorkLogEntry[]): string | null => {
  if (!entries || entries.length === 0) {
    return "At least one time slot update is required.";
  }

  const parsed = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry.startTime || !entry.endTime) {
      return `Time slot #${i + 1} must have both Start Time and End Time.`;
    }
    if (!entry.activity || !entry.activity.trim()) {
      return `Time slot #${i + 1} must have an Activity description.`;
    }

    const startMin = parseTimeToMinutes(entry.startTime);
    const endMin = parseTimeToMinutes(entry.endTime);

    if (startMin < 0 || endMin < 0) {
      return `Time slot #${i + 1} has an invalid time format.`;
    }
    if (startMin >= endMin) {
      return `Time slot #${i + 1}: Start time (${entry.startTime}) must be earlier than End time (${entry.endTime}).`;
    }

    parsed.push({ idx: i + 1, start: startMin, end: endMin, rawStart: entry.startTime, rawEnd: entry.endTime });
  }

  // Sort by start time to check overlaps
  parsed.sort((a, b) => a.start - b.start);
  for (let i = 0; i < parsed.length - 1; i++) {
    const cur = parsed[i];
    const nxt = parsed[i + 1];
    if (cur.end > nxt.start) {
      return `Time overlap detected between Slot (${cur.rawStart} - ${cur.rawEnd}) and Slot (${nxt.rawStart} - ${nxt.rawEnd}).`;
    }
  }

  return null;
};

const WorkLogFormModal: React.FC<WorkLogFormModalProps> = ({
  isOpen,
  onClose,
  editingLog,
  users,
  canViewAllLogs,
  currentUser,
  onSubmit
}) => {
  const getTodayDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const [date, setDate] = useState<string>(getTodayDate());
  const [selectedUsername, setSelectedUsername] = useState<string>(currentUser);
  const [entries, setEntries] = useState<WorkLogEntry[]>([
    { id: '1', startTime: '09:00', endTime: '10:00', activity: '' }
  ]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (editingLog) {
      setDate(editingLog.date || getTodayDate());
      setSelectedUsername(editingLog.username || currentUser);
      setEntries(
        editingLog.entries && editingLog.entries.length > 0
          ? editingLog.entries.map((e, idx) => ({ ...e, id: e.id || String(idx + 1) }))
          : [{ id: '1', startTime: '09:00', endTime: '10:00', activity: '' }]
      );
    } else {
      setDate(getTodayDate());
      setSelectedUsername(currentUser);
      setEntries([{ id: '1', startTime: '09:00', endTime: '10:00', activity: '' }]);
    }
    setErrorMsg(null);
  }, [editingLog, isOpen, currentUser]);

  const handleAddSlot = () => {
    let nextStart = '10:00';
    let nextEnd = '11:00';
    if (entries.length > 0) {
      const lastEntry = entries[entries.length - 1];
      if (lastEntry.endTime) {
        nextStart = lastEntry.endTime;
        const lastEndMin = parseTimeToMinutes(lastEntry.endTime);
        if (lastEndMin >= 0) {
          const newEndMin = Math.min(lastEndMin + 60, 23 * 60 + 59);
          const hrs = Math.floor(newEndMin / 60).toString().padStart(2, '0');
          const mins = (newEndMin % 60).toString().padStart(2, '0');
          nextEnd = `${hrs}:${mins}`;
        }
      }
    }
    setEntries([
      ...entries,
      { id: String(Date.now()), startTime: nextStart, endTime: nextEnd, activity: '' }
    ]);
  };

  const handleRemoveSlot = (index: number) => {
    if (entries.length <= 1) {
      setErrorMsg("A daily work log must contain at least one time slot.");
      return;
    }
    const updated = entries.filter((_, i) => i !== index);
    setEntries(updated);
    setErrorMsg(checkEntriesOverlap(updated));
  };

  const handleEntryChange = (index: number, field: keyof WorkLogEntry, value: string) => {
    const updated = entries.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry));
    setEntries(updated);
    setErrorMsg(checkEntriesOverlap(updated));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const overlapError = checkEntriesOverlap(entries);
    if (overlapError) {
      setErrorMsg(overlapError);
      return;
    }

    const payload: any = {
      date,
      entries,
      username: selectedUsername
    };

    if (editingLog) {
      payload.id = editingLog.id || editingLog._id;
    }

    await onSubmit(payload);
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', color: "#333" }}>
            {editingLog ? 'Edit Daily Work Log' : 'Create Daily Work Log'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMsg}
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <TextField
              label="Log Date"
              type="date"
              value={date}
              InputLabelProps={{ shrink: true }}
              slotProps={{ inputLabel: { shrink: true } }}
              disabled
              sx={{ minWidth: 200, bgcolor: '#f1f5f9' }}
              helperText="Locked to current day"
            />


          </Box>

          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1.5, color: '#1976d2' }}>
            Time Period Updates (No Overlaps Allowed)
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {entries.map((entry, index) => (
              <Paper
                key={entry.id || index}
                variant="outlined"
                sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  backgroundColor: '#f8fafc',
                  borderColor: '#e2e8f0'
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', minWidth: 24, color: '#64748b' }}>
                  #{index + 1}
                </Typography>

                <TextField
                  label="Start Time"
                  type="time"
                  size="small"
                  value={entry.startTime}
                  onChange={(e) => handleEntryChange(index, 'startTime', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  slotProps={{ inputLabel: { shrink: true } }}
                  inputProps={{ step: 300 }} // 5 min intervals
                  required
                  sx={{ width: 140 }}
                />

                <TextField
                  label="End Time"
                  type="time"
                  size="small"
                  value={entry.endTime}
                  onChange={(e) => handleEntryChange(index, 'endTime', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  slotProps={{ inputLabel: { shrink: true } }}
                  inputProps={{ step: 300 }}
                  required
                  sx={{ width: 140 }}
                />

                <TextField
                  label="Activity Description"
                  size="small"
                  fullWidth
                  value={entry.activity}
                  onChange={(e) => handleEntryChange(index, 'activity', e.target.value)}
                  placeholder="Describe task/activity performed during this period..."
                  required
                />

                <Tooltip title="Remove Time Slot">
                  <span>
                    <IconButton
                      color="error"
                      size="small"
                      disabled={entries.length <= 1}
                      onClick={() => handleRemoveSlot(index)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Paper>
            ))}
          </Box>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-start' }}>
            <Button variant="outlined" color="primary" startIcon={<AddIcon />} onClick={handleAddSlot}>
              Add Time Slot
            </Button>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button variant="outlined" color="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" color="primary" disabled={!!errorMsg}>
            {editingLog ? 'Update Work Log' : 'Create Work Log'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default WorkLogFormModal;
