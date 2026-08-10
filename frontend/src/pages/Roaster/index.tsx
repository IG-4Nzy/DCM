// @ts-nocheck
import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Autocomplete,
  TextField,
  Tooltip,
  Chip,
  Menu,
  MenuItem,
  IconButton,
  Tabs,
  Tab,
  Paper,
  Switch,
  FormControlLabel,
  FormControl,
  Select,
  InputLabel,
  Drawer,
  Divider,
  Avatar
} from "@mui/material";
import { MdEdit as EditIcon, MdSave as SaveIcon, MdClose as CancelIcon, MdPrint as PrintIcon, MdContentCopy as CopyIcon, MdUndo as UndoIcon, MdHistory as HistoryIcon, MdCalendarToday, MdBusiness, MdDownload as DownloadIcon } from "react-icons/md";
import dayjs, { Dayjs } from "dayjs";
import { getServerTime } from "../../helpers/time";
import isoWeekPlugin from "dayjs/plugin/isoWeek";
import WeekPicker from "../../components/WeekPicker";
import EmailSelectInput from "../../components/EmailSelectInput";
import { exportRosterPdf } from "../../helpers/exportRosterPdf";
import styles from "./index.module.scss";
import { tableHeader } from "./constant";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../contexts/ConfirmContext";
import { hasPrivilege } from "../../helpers/authUtils";
import { PRIVILEGES } from "../../helpers/privileges";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../../store";
import { jwtDecode } from "jwt-decode";
import { validateRoster } from "./validation";
import { fetchUsers, fetchAllDepartmentsForDropdown } from "../Users/action";
import { fetchRostersData, fetchRosterStatusData, updateRosterStatus, resetRosterStatus, createRoster, updateRoster, fetchDutySummary, saveRosterSplitup, fetchRosterHistory, batchSaveRosters } from "./action";
import request from "../../services/request";

dayjs.extend(isoWeekPlugin);

interface RosterData {
  id?: string;
  assignees: string[];
  updatedAt?: string;
  updatedByFullName?: string;
}

const RoasterPage: React.FC = () => {
  const [selectedWeek, setSelectedWeek] = useState<Dayjs>(getServerTime());
  const [editModes, setEditModes] = useState<Record<string, boolean>>({});
  const [rosterDataByWeek, setRosterDataByWeek] = useState<Record<string, Record<string, RosterData>>>({});
  const [rosterStatus, setRosterStatus] = useState<any>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [dutySummary, setDutySummary] = useState<any>(null);
  const [savedRosterDataByWeek, setSavedRosterDataByWeek] = useState<Record<string, Record<string, RosterData>>>({});
  const [activeTab, setActiveTab] = useState<number>(0);
  const [localSplitups, setLocalSplitups] = useState<any>({});
  const [officerEmails, setOfficerEmails] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [hasMappedEmails, setHasMappedEmails] = useState(false);
  const [rosterMailEnabled, setRosterMailEnabled] = useState(true);

  useEffect(() => {
    const checkMappedEmails = async () => {
      try {
        const res = await request.get('/api/mail-config/saved-emails?module=roster');
        if (Array.isArray(res.data) && res.data.length > 0) {
          setHasMappedEmails(true);
          setOfficerEmails(res.data.join(', '));
        }
      } catch (err) {
        console.error("Error checking mapped emails:", err);
      }
    };
    checkMappedEmails();

    const checkMailEnabled = async () => {
      try {
        const res = await request.get('/api/mail-config/roster-mail-enabled');
        setRosterMailEnabled(res.data.enabled !== false);
      } catch (e) {
        console.error("Error checking mail enabled:", e);
      }
    };
    checkMailEnabled();
  }, []);

  const currentWeekKey = selectedWeek.startOf("isoWeek").format("YYYY-MM-DD");
  const isEditMode = !!editModes[currentWeekKey];
  const rosterData = rosterDataByWeek[currentWeekKey] || {};

  const dispatch = useDispatch<AppDispatch>();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [rosterHistory, setRosterHistory] = useState<Record<string, Record<string, RosterData>[]>>({});
  const [splitupHistory, setSplitupHistory] = useState<any[]>([]);
  const isSuperuser = useSelector((state: RootState) => state.auth.isSuperuser);
  const token = useSelector((state: RootState) => state.auth.token);
  const role = useSelector((state: RootState) => state.auth.role);
  const { users, availableDepartments: departmentsList } = useSelector((state: RootState) => state.users);
  
  const canView = isSuperuser || hasPrivilege(PRIVILEGES.ROASTER_VIEW) || hasPrivilege(PRIVILEGES.VIEW_ALL_ROASTER);
  const hasViewAllRoaster = isSuperuser || hasPrivilege(PRIVILEGES.VIEW_ALL_ROASTER);
  const canEdit =
    isSuperuser ||
    hasPrivilege(PRIVILEGES.ROASTER_CREATE) ||
    hasPrivilege(PRIVILEGES.ROASTER_UPDATE);
  const canApprove = isSuperuser || hasPrivilege(PRIVILEGES.ROASTER_APPROVE);
  const tokenSub = token ? (jwtDecode(token) as any).sub : "";
  const tokenDept = token ? (jwtDecode(token) as any).department || "General" : "General";
  const currentUserObj = users.find(u => u.username === tokenSub);
  const userDepartment = currentUserObj ? currentUserObj.department : tokenDept;

  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [mappedDepartment, setMappedDepartment] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserRoleMapping = async () => {
      try {
        const response = await request.get('/api/roasters/role-mappings');
        const mappings = response.data || [];
        const userRoles = Array.isArray(role) ? role : [role];
        const userMapping = mappings.find((m: any) => 
          userRoles.includes(m.roleName) || userRoles.includes(m.roleId)
        );
        if (userMapping) {
          setMappedDepartment(userMapping.departmentName);
        }
      } catch (e) {
        console.error("Failed to fetch role mappings", e);
      }
    };
    if (role && !isSuperuser) {
      fetchUserRoleMapping();
    }
  }, [role, isSuperuser]);

  useEffect(() => {
    if (userDepartment && !selectedDepartment) {
      setSelectedDepartment(userDepartment);
    }
  }, [userDepartment]);

  const activeDepartment = mappedDepartment || selectedDepartment || userDepartment || '';

  const activeDeptObj = (departmentsList || []).find((d: any) => 
    d.name === activeDepartment || 
    (d._id && String(d._id) === String(activeDepartment)) || 
    (d.id && String(d.id) === String(activeDepartment))
  );
  const displayDepartmentValue = activeDeptObj ? activeDeptObj.name : activeDepartment;

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    const hr = parseInt(parts[0]);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const displayHr = hr % 12 || 12;
    return `${displayHr.toString().padStart(2, '0')}:${parts[1]} ${ampm}`;
  };

  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<any | null>(null);

  const loadHistory = async () => {
    if (!activeDepartment) return;
    const startDate = selectedWeek.startOf("isoWeek").format("YYYY-MM-DD");
    const endDate = selectedWeek.endOf("isoWeek").format("YYYY-MM-DD");
    try {
      const res = await dispatch(fetchRosterHistory({ department: activeDepartment, startDate, endDate })).unwrap();
      setHistoryList(res || []);
    } catch (e) {
      console.error("Failed to load roaster history", e);
    }
  };

  const historyChangesMap = React.useMemo(() => {
    if (!selectedHistory || !selectedHistory.changes) return {};
    const map: Record<string, { previousAssignees: string[]; newAssignees: string[]; previousNotes?: string; newNotes?: string }> = {};
    selectedHistory.changes.forEach((c: any) => {
      map[`${c.date}_${c.shift}`] = c;
    });
    return map;
  }, [selectedHistory]);

  const weekDates = Array.from({ length: 7 }).map((_, index) =>
    selectedWeek.startOf("isoWeek").add(index, "day").format("YYYY-MM-DD")
  );

  const rows = dutySummary?.rosterRows && dutySummary.rosterRows.length > 0
    ? dutySummary.rosterRows
    : [
        { name: "Shift 1 Row 1", mappedShift: "Shift-1" },
        { name: "Shift 1 Row 2", mappedShift: "Shift-1" },
        { name: "Shift 2 Row 1", mappedShift: "Shift-2" },
        { name: "Shift 2 Row 2", mappedShift: "Shift-2" },
        { name: "Shift 3 Row 1", mappedShift: "Shift-3" },
        { name: "Shift 3 Row 2", mappedShift: "Shift-3" },
        { name: "Leave", mappedShift: "Leave" }
      ];

  const uniqueShifts = ["Shift-1", "Shift-2", "Shift-3", "Leave"];

  const validationErrors = validateRoster(rosterData, weekDates, rows, dutySummary?.shifts, dutySummary?.validationRules);



  const fetchRosters = async () => {
    if (!activeDepartment) return;
    const prevSundayStr = selectedWeek.startOf("isoWeek").subtract(1, "day").format("YYYY-MM-DD");
    const startDate = selectedWeek.startOf("isoWeek").format("YYYY-MM-DD");
    const endDate = selectedWeek.endOf("isoWeek").format("YYYY-MM-DD");
    try {
      const data = await dispatch(fetchRostersData({ startDate: prevSundayStr, endDate, department: activeDepartment })).unwrap();
      const newRosterData: Record<string, RosterData> = {};
      data.forEach((r: any) => {
        if (weekDates.includes(r.date) || r.date === prevSundayStr) {
          newRosterData[`${r.date}_${r.shift}`] = {
            id: r.id || r._id,
            assignees: r.assignees,
            updatedAt: r.updatedAt,
            updatedByFullName: r.updatedByFullName
          };
        }
      });
      setSavedRosterDataByWeek((prev) => ({ ...prev, [currentWeekKey]: newRosterData }));
      setRosterDataByWeek((prev) => {
        if (prev[currentWeekKey] && editModes[currentWeekKey]) {
          return prev;
        }
        return { ...prev, [currentWeekKey]: newRosterData };
      });
    } catch (e) {
      console.error(e);
      showToast("Failed to fetch rosters", "error");
    }
  };

  const fetchRosterStatus = async () => {
    if (!activeDepartment) return;
    const startDate = selectedWeek.startOf("isoWeek").format("YYYY-MM-DD");
    try {
      const data = await dispatch(fetchRosterStatusData({ weekStartDate: startDate, department: activeDepartment })).unwrap();
      setRosterStatus(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSummary = async () => {
    if (!activeDepartment) return;
    try {
      const dateStr = selectedWeek.startOf("isoWeek").format("YYYY-MM-DD");
      const data = await dispatch(fetchDutySummary({ department: activeDepartment, date: dateStr })).unwrap();
      setDutySummary(data);
      if (data && data.splitups) {
        setLocalSplitups(data.splitups);
      } else {
        setLocalSplitups({});
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSplitupChange = (username: string, weekLabel: string, value: number) => {
    setLocalSplitups((prev: any) => ({
      ...prev,
      [username]: {
        ...(prev[username] || {}),
        [weekLabel]: value
      }
    }));
  };

  const handleSaveSplitup = async () => {
    if (!activeDepartment || !dutySummary?.cycleStart) return;
    try {
      await dispatch(saveRosterSplitup({
        department: activeDepartment,
        cycleStart: dutySummary.cycleStart,
        splitups: localSplitups
      })).unwrap();
      showToast('Roaster splitup targets saved successfully', 'success');
      setEditModes(prev => ({ ...prev, [currentWeekKey]: false }));
      fetchSummary();
    } catch (err: any) {
      showToast(typeof err === 'string' ? `Failed to save splitup targets: ${err}` : 'Failed to save splitup targets', 'error');
    }
  };

  const getRealtimeSummary = () => {
    if (!dutySummary) return [];

    const cycleStart = dutySummary.cycleStart;
    const cycleEnd = dutySummary.cycleEnd;
    const weekDatesInCycle = weekDates.filter(d => d >= cycleStart && d <= cycleEnd);

    // Create a map of existing backend summary counts
    const backendCounts = new Map<string, { monthDays: number, weekDays: number }>();
    if (dutySummary.summary) {
      dutySummary.summary.forEach((item: any) => {
        backendCounts.set(item.username, {
          monthDays: item.monthDays,
          weekDays: item.weekDays
        });
      });
    }

    // We want to calculate the summary for all users in the current department with the configured tracked role
    const trackedRole = dutySummary.trackedRole || "All Roles";
    const deptUsers = users.filter((u) => {
      const activeDeptObj = (departmentsList || []).find((d: any) => 
        d.name === activeDepartment || 
        (d._id && String(d._id) === String(activeDepartment)) || 
        (d.id && String(d.id) === String(activeDepartment))
      );
      const activeDeptName = activeDeptObj ? activeDeptObj.name : activeDepartment;
      const activeDeptId = activeDeptObj ? String(activeDeptObj._id || activeDeptObj.id) : activeDepartment;

      const userDeptObj = (departmentsList || []).find((d: any) => 
        (d._id && String(d._id) === String(u.department)) || 
        (d.id && String(d.id) === String(u.department)) || 
        d.name === u.department
      );
      const userDeptName = userDeptObj ? userDeptObj.name : u.department;
      const userDeptId = userDeptObj ? String(userDeptObj._id || userDeptObj.id) : u.department;

      const isCorrectDept = 
        u.department === activeDepartment || 
        userDeptId === activeDeptId || 
        userDeptName === activeDeptName;

      const isNotSuper = !(u.is_superuser || u.isSuperuser);
      const isCorrectRole = trackedRole === "All Roles" || (Array.isArray(u.role) ? u.role.includes(trackedRole) : u.role === trackedRole);
      return isCorrectDept && isNotSuper && isCorrectRole;
    });

    const shiftNames = uniqueShifts.filter(s => s !== "Leave");

    const summaryList = deptUsers.map((u) => {
      const username = u.username;
      const initial = backendCounts.get(username) || { monthDays: 0, weekDays: 0 };

      // 1. Calculate real-time week counts
      const weekDatesAssigned = new Set<string>();
      weekDates.forEach((dateStr) => {
        shiftNames.forEach((shift) => {
          const key = `${dateStr}_${shift}`;
          if (rosterData[key]?.assignees?.includes(username)) {
            weekDatesAssigned.add(dateStr);
          }
        });
      });
      const realWeekDays = weekDatesAssigned.size;

      // 2. Calculate real-time month counts
      const savedRosterData = savedRosterDataByWeek[currentWeekKey] || {};
      const savedCycleDates = new Set<string>();
      weekDatesInCycle.forEach((dateStr) => {
        shiftNames.forEach((shift) => {
          const key = `${dateStr}_${shift}`;
          if (savedRosterData[key]?.assignees?.includes(username)) {
            savedCycleDates.add(dateStr);
          }
        });
      });
      const savedCount = savedCycleDates.size;

      const currentCycleDates = new Set<string>();
      weekDatesInCycle.forEach((dateStr) => {
        shiftNames.forEach((shift) => {
          const key = `${dateStr}_${shift}`;
          if (rosterData[key]?.assignees?.includes(username)) {
            currentCycleDates.add(dateStr);
          }
        });
      });
      const currentCount = currentCycleDates.size;

      const realMonthDays = Math.max(0, initial.monthDays - savedCount + currentCount);

      return {
        username,
        weekDays: realWeekDays,
        monthDays: realMonthDays
      };
    });

    return summaryList.sort((a, b) => a.username.localeCompare(b.username));
  };

  useEffect(() => {
    if (activeDepartment) {
      fetchRosters();
      fetchRosterStatus();
      fetchSummary();
    }
  }, [selectedWeek, activeDepartment]);

  useEffect(() => {
    dispatch(fetchUsers({ department: activeDepartment || undefined, pagination: false }));
    dispatch(fetchAllDepartmentsForDropdown());
  }, [dispatch, token, activeDepartment]);

  const handleStatusChange = async (newStatus: string) => {
    setAnchorEl(null);
    if (!activeDepartment) return;
    const startDate = selectedWeek.startOf("isoWeek").format("YYYY-MM-DD");
    try {
      const data = await dispatch(updateRosterStatus({
        weekStartDate: startDate,
        department: activeDepartment,
        status: newStatus
      })).unwrap();
      setRosterStatus(data);
      if (newStatus !== "Pending") {
        showToast("Status updated", "success");
      }
    } catch (e) {
      console.error(e);
      if (newStatus !== "Pending") {
        showToast("Failed to update status", "error");
      }
    }
  };

  const getUserDisplayName = (username: string) => {
    const user = users.find((u) => u.username === username);
    if (user) {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      return fullName ? fullName : username;
    }
    return username;
  };

  const handleCopyPreviousRoster = async () => {
    const isConfirmed = await confirm(
      "Are you sure you want to copy the roster from the previous week? This will overwrite your current unsaved changes for this week.",
      "Copy Previous Week Roster"
    );
    if (!isConfirmed) return;

    const prevWeek = selectedWeek.subtract(1, "week");
    const startDate = prevWeek.startOf("isoWeek").format("YYYY-MM-DD");
    const endDate = prevWeek.endOf("isoWeek").format("YYYY-MM-DD");
    try {
      const data = await dispatch(fetchRostersData({ startDate, endDate, department: activeDepartment })).unwrap();
      const prevRoster: Record<string, string[]> = {};
      data.forEach((r: any) => {
        prevRoster[`${r.date}_${r.shift}`] = r.assignees;
      });

      // Save snapshot for undo
      const currentSnapshot = rosterDataByWeek[currentWeekKey] || {};
      setRosterHistory(prev => ({
        ...prev,
        [currentWeekKey]: [...(prev[currentWeekKey] || []), currentSnapshot]
      }));

      // Now copy to the current week
      const currentRosterData = { ...currentSnapshot };
      const currentWeekDays = Array.from({ length: 7 }).map((_, index) =>
        selectedWeek.startOf("isoWeek").add(index, "day")
      );
      const prevWeekDays = Array.from({ length: 7 }).map((_, index) =>
        prevWeek.startOf("isoWeek").add(index, "day")
      );

      currentWeekDays.forEach((currDay, idx) => {
        const currDateStr = currDay.format("YYYY-MM-DD");
        const prevDateStr = prevWeekDays[idx].format("YYYY-MM-DD");

        uniqueShifts.forEach((shift) => {
          const prevKey = `${prevDateStr}_${shift}`;
          const currKey = `${currDateStr}_${shift}`;
          const prevAssignees = prevRoster[prevKey] || [];
          
          currentRosterData[currKey] = {
            ...currentRosterData[currKey],
            assignees: prevAssignees,
          };
        });
      });

      setRosterDataByWeek((prev) => ({
        ...prev,
        [currentWeekKey]: currentRosterData
      }));
      showToast("Copied roster from previous week. Please save changes.", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to copy previous roster", "error");
    }
  };

  const handleUndoRoster = () => {
    const historyList = rosterHistory[currentWeekKey] || [];
    if (historyList.length === 0) return;
    const previousState = historyList[historyList.length - 1];
    setRosterDataByWeek(prev => ({
      ...prev,
      [currentWeekKey]: previousState
    }));
    setRosterHistory(prev => ({
      ...prev,
      [currentWeekKey]: historyList.slice(0, historyList.length - 1)
    }));
    showToast("Reverted to previous roster state.", "info");
  };

  const handleCopyPreviousSplitup = async () => {
    if (!activeDepartment || !dutySummary?.cycleStart) return;
    const isConfirmed = await confirm(
      "Are you sure you want to copy the roster splitup targets from the previous cycle?",
      "Copy Previous Splitup"
    );
    if (!isConfirmed) return;

    try {
      const dateInPrevCycle = dayjs(dutySummary.cycleStart).subtract(15, 'days').format('YYYY-MM-DD');
      const prevData = await dispatch(fetchDutySummary({ department: activeDepartment, date: dateInPrevCycle })).unwrap();
      if (prevData && prevData.splitups && Object.keys(prevData.splitups).length > 0) {
        setSplitupHistory(prev => [...prev, localSplitups]);
        setLocalSplitups(prevData.splitups);
        showToast("Copied splitup targets from previous month. Please save changes.", "success");
      } else {
        showToast("No previous splitup targets found to copy.", "warning");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to copy previous splitup targets", "error");
    }
  };

  const handleUndoSplitup = () => {
    if (splitupHistory.length === 0) return;
    const previousState = splitupHistory[splitupHistory.length - 1];
    setLocalSplitups(previousState);
    setSplitupHistory(prev => prev.slice(0, prev.length - 1));
    showToast("Reverted to previous splitup state.", "info");
  };

  const handleSave = async () => {
    if (validationErrors && validationErrors.length > 0) {
      const err = validationErrors[0];
      showToast(`Validation Error: ${getUserDisplayName(err.username)} - ${err.reason} (${err.date})`, "error");
      return;
    }
    try {
      const currentRosterData = rosterDataByWeek[currentWeekKey] || {};
      const items = Object.entries(currentRosterData)
        .filter(([key]) => {
          const date = key.split("_")[0];
          return weekDates.includes(date);
        })
        .map(([key, data]) => {
          const [date, shift] = key.split("_");
          return {
            date,
            shift,
            assignees: data.assignees ? data.assignees.filter(Boolean) : [],
            notes: (data as any).notes
          };
        });

      const startDate = selectedWeek.startOf("isoWeek").format("YYYY-MM-DD");
      await dispatch(batchSaveRosters({
        department: activeDepartment || 'General',
        items,
        weekStartDate: startDate
      })).unwrap();

      showToast("Roster saved successfully", "success");
      setEditModes(prev => ({ ...prev, [currentWeekKey]: false }));
      fetchRosters();
      fetchRosterStatus();
      fetchSummary();
      loadHistory();
    } catch (e: any) {
      console.error(e);
      showToast(typeof e === 'string' ? `Failed to save roster: ${e}` : "Failed to save roster", "error");
    }
  };

  const handleSendRosterEmail = async () => {
    if (!officerEmails) {
      showToast("Please enter at least one email address", "warning");
      return;
    }
    const isConfirmed = await confirm(
      `Are you sure you want to send this week's roster to the following email(s)?\n\n${officerEmails}`,
      "Confirm Send Email"
    );
    if (!isConfirmed) return;

    try {
      setEmailLoading(true);
      const startDate = selectedWeek.startOf("isoWeek").format("YYYY-MM-DD");
      
      const element = document.querySelector(`.${styles.container__roasterContainer}`) as HTMLElement;
      if (!element) {
        showToast("Roster element not found on page.", "error");
        return;
      }

      element.classList.add(styles.container__generatingPdf);
      
      let pdfBase64 = "";
      try {
        pdfBase64 = await exportRosterPdf({
          element: element,
          filename: `Duty_Roster_${displayDepartmentValue.replace(/[^a-zA-Z0-9]/g, '_')}_${startDate}.pdf`
        });
      } finally {
        element.classList.remove(styles.container__generatingPdf);
      }

      await request.post("/api/roasters/send-email", {
        emails: officerEmails,
        department: activeDepartment || 'General',
        weekStartDate: startDate,
        pdfBase64: pdfBase64
      });
      showToast("Roster email sent successfully!", "success");
      setOfficerEmails("");
      fetchRosterStatus();
    } catch (e: any) {
      console.error(e);
      showToast(e.response?.data?.detail || "Failed to send email", "error");
    } finally {
      setEmailLoading(false);
    }
  };

  if (!canView) {
    return (
      <Box className={styles.container} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Typography variant="h6" color="textSecondary">
          You do not have permission to view the Duty Roster.
        </Typography>
      </Box>
    );
  }

  const currentWeekRosterEntries = Object.entries(rosterData)
    .filter(([key]) => weekDates.some(d => key.startsWith(d)))
    .map(([_, v]) => v)
    .filter(r => r && r.updatedAt);

  let lastUpdatedTime: number | null = null;
  let lastUpdatedBy: string | null = null;

  currentWeekRosterEntries.forEach(r => {
    const t = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
    if (t > (lastUpdatedTime || 0)) {
      lastUpdatedTime = t;
      lastUpdatedBy = r.updatedByFullName || null;
    }
  });

  if (rosterStatus && rosterStatus.updatedAt) {
    const t = new Date(rosterStatus.updatedAt).getTime();
    if (t > (lastUpdatedTime || 0)) {
      lastUpdatedTime = t;
      lastUpdatedBy = rosterStatus.updatedByFullName || null;
    }
  }

  const isRosterApproved = rosterStatus?.status === 'Approved';
  const hasEmailBeenSent = rosterStatus?.emailSent === true;

  const hasRosterData = Object.entries(rosterData)
    .filter(([key]) => weekDates.some(d => key.startsWith(d)))
    .some(([_, r]) => r.id);

  const cleanDisplayName = (name?: string | null) => {
    if (!name) return 'Unknown';
    return name.replace(/\s*\([0-9a-fA-F]{24}[^)]*\)/g, '').trim() || name;
  };

  return (
    <Box className={styles.container}>
      <header className={styles["container__header"]}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
          }}
        >
          <Typography
            variant="h6"
            className={styles["container__header--title"]}
            sx={{ marginBottom: "0px !important", fontWeight: "bold" }}
          >
            Duty Roster
          </Typography>
          
        
           {canEdit &&
            (isEditMode ? (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                 {activeTab === 0 ? (
                   <Tooltip title="Save Roster">
                     <IconButton
                       color="primary"
                       onClick={handleSave}
                       size="small"
                       sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }}
                     >
                       <SaveIcon />
                     </IconButton>
                   </Tooltip>
                 ) : (
                   <Tooltip title="Save Roster Splitup">
                     <IconButton
                       color="primary"
                       onClick={handleSaveSplitup}
                       size="small"
                       sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }}
                     >
                       <SaveIcon />
                     </IconButton>
                   </Tooltip>
                 )}
                 {activeTab === 0 ? (
                   <>
                     <Tooltip title="Copy Previous Roster">
                       <IconButton
                         color="primary"
                         onClick={handleCopyPreviousRoster}
                         size="small"
                         sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }}
                       >
                         <CopyIcon />
                       </IconButton>
                     </Tooltip>
                     {(rosterHistory[currentWeekKey] || []).length > 0 && (
                       <Tooltip title="Undo Copy / Revert">
                         <IconButton
                           color="warning"
                           onClick={handleUndoRoster}
                           size="small"
                           sx={{ backgroundColor: 'rgba(237, 108, 2, 0.08)' }}
                         >
                           <UndoIcon />
                         </IconButton>
                       </Tooltip>
                     )}
                   </>
                 ) : (
                   <>
                     <Tooltip title="Copy Previous Roster Splitup">
                       <IconButton
                         color="primary"
                         onClick={handleCopyPreviousSplitup}
                         size="small"
                         sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }}
                       >
                         <CopyIcon />
                       </IconButton>
                     </Tooltip>
                     {splitupHistory.length > 0 && (
                       <Tooltip title="Undo Copy / Revert">
                         <IconButton
                           color="warning"
                           onClick={handleUndoSplitup}
                           size="small"
                           sx={{ backgroundColor: 'rgba(237, 108, 2, 0.08)' }}
                         >
                           <UndoIcon />
                         </IconButton>
                       </Tooltip>
                     )}
                   </>
                 )}
                <Tooltip title="Cancel Edit">
                  <IconButton
                    color="error"
                    onClick={() => {
                      setEditModes(prev => ({ ...prev, [currentWeekKey]: false }));
                      setRosterDataByWeek(prev => ({
                        ...prev,
                        [currentWeekKey]: savedRosterDataByWeek[currentWeekKey] || {}
                      }));
                      if (dutySummary && dutySummary.splitups) {
                        setLocalSplitups(dutySummary.splitups);
                      } else {
                        setLocalSplitups({});
                      }
                    }}
                    size="small"
                    sx={{ backgroundColor: 'rgba(211, 47, 47, 0.04)' }}
                  >
                    <CancelIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            ) : (
              <Tooltip title="Edit Roster">
                <IconButton
                  color="primary"
                  onClick={() => setEditModes(prev => ({ ...prev, [currentWeekKey]: true }))}
                  size="small"
                  className="hide-on-print"
                  sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }}
                >
                  <EditIcon />
                </IconButton>
              </Tooltip>
            ))}

        

            {rosterStatus && hasRosterData && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip
                  label={rosterStatus.status}
                  color={rosterStatus.status === 'Approved' ? 'success' : rosterStatus.status === 'Rejected' ? 'error' : 'warning'}
                  size="small"
                  sx={{ fontWeight: 'bold' }}
                />
                {canApprove && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={rosterStatus.status === 'Approved'}
                        onChange={(e) => handleStatusChange(e.target.checked ? 'Approved' : 'Pending')}
                        color="success"
                        size="small"
                      />
                    }
                    label={<Typography sx={{ fontSize: '12px' }}>{rosterStatus.status === 'Approved' ? 'Approved' : 'Approve Roster'}</Typography>}
                    className="hide-on-print"
                    sx={{ ml: 1 }}
                  />
                )}
              </Box>
            )}

              {/* Last Updated Info */}
          {lastUpdatedTime && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', ml: 2, mr: 2 ,gap: '0px'}}>
              <Typography variant="caption" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                Roster last updated: {dayjs(lastUpdatedTime).format('DD MMM YYYY, hh:mm A')}
              </Typography>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold' }}>
                by {cleanDisplayName(lastUpdatedBy)}
              </Typography>
            </Box>
          )}

        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {hasViewAllRoaster && (
            <FormControl size="small" className="hide-on-print" sx={{ minWidth: 160 }} disabled={!!mappedDepartment}>
              <InputLabel id="roaster-dept-label" sx={{ fontSize: '12px' }}>Department</InputLabel>
              <Select
                labelId="roaster-dept-label"
                value={displayDepartmentValue}
                label="Department"
                onChange={(e) => setSelectedDepartment(e.target.value)}
                sx={{ fontSize: '12px', height: '32px' }}
              >
                {mappedDepartment ? (
                  <MenuItem value={mappedDepartment} sx={{ fontSize: '12px' }}>
                    {mappedDepartment}
                  </MenuItem>
                ) : (
                  Array.from(new Set([
                    ...((departmentsList || []).map((d: any) => typeof d === 'string' ? d : d.name).filter(Boolean)),
                    ...(displayDepartmentValue ? [displayDepartmentValue] : [])
                  ])).map((deptName) => (
                    <MenuItem key={deptName} value={deptName} sx={{ fontSize: '12px' }}>
                      {deptName}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          )}
          {!getServerTime().isSame(selectedWeek, 'isoWeek') && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setSelectedWeek(getServerTime())}
              className="hide-on-print"
              sx={{ width: '100px', height: '32px', fontSize: '12px' }}
            >
              This Week
            </Button>
          )}
          <WeekPicker
            value={selectedWeek}
            onChange={(newVal) => setSelectedWeek(newVal)}
          />
          <Button
            variant={isHistoryOpen ? "contained" : "outlined"}
            size="small"
            onClick={() => {
              setIsHistoryOpen(!isHistoryOpen);
              if (!isHistoryOpen) loadHistory();
            }}
            className="hide-on-print"
            sx={{ height: '32px', fontSize: '12px', gap: '4px' }}
          >
            <HistoryIcon size={16} /> History {historyList.length > 0 ? `(${historyList.length})` : ''}
          </Button>
          <Tooltip title="Print Roster">
            <IconButton
              className="hide-on-print"
              onClick={() => window.print()}
              size="small"
              sx={{ color: 'primary.main' }}
            >
              <PrintIcon size={20} />
            </IconButton>
          </Tooltip>

          {rosterMailEnabled && (
            <Box className="hide-on-print" sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
              {!hasMappedEmails && (
                <EmailSelectInput
                  placeholder="Officer email(s)"
                  value={officerEmails}
                  onChange={(val) => setOfficerEmails(val)}
                  department={activeDepartment || 'General'}
                  module="roster"
                  size="small"
                  height="32px"
                  width="210px"
                />
              )}
              <Tooltip title={
                !isRosterApproved 
                  ? "Roster must be approved before sending email" 
                  : hasEmailBeenSent 
                    ? "Roster email has already been sent for this approval" 
                    : "Send roster email with PDF"
              }>
                <span>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleSendRosterEmail}
                    disabled={emailLoading || !officerEmails || !isRosterApproved || hasEmailBeenSent}
                    sx={{ height: '32px', fontSize: '11px', whiteSpace: 'nowrap' }}
                  >
                    {emailLoading ? "Sending..." : "Send Mail"}
                  </Button>
                </span>
              </Tooltip>
            </Box>
          )}
        </Box>
      </header>

      <Tabs
        value={activeTab}
        onChange={(e, val) => setActiveTab(val)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
        className="hide-on-print"
      >
        <Tab label="Duty Roster" />
        <Tab label="Roaster Splitup" />
      </Tabs>

      {activeTab === 0 && (
        <section className={styles["container__roasterContainer"]}>
        <header className={styles["container__roasterContainer__header"]}>
          <label
            className={styles["container__roasterContainer__header__label"]}
          >
            {"VSSC/DCS/2026"}
          </label>
          <label
            className={styles["container__roasterContainer__header__label"]}
          >
            {"SCHEDULE FOR ROUND THE CLOCK MANNING OF DATA CENTRE FACILITY"}
          </label>
          <label
            className={styles["container__roasterContainer__header__label"]}
          >
            {`CITG VSSC From ${selectedWeek.startOf("isoWeek").format("DD-MM-YYYY")} to ${selectedWeek.endOf("isoWeek").format("DD-MM-YYYY")}`}
          </label>
          <label
            className={styles["container__roasterContainer__header__label"]}
          >
            {
              "The contract staff identified by respective contractors for operations in DCS FACILITY for shift duty and holidays are as follows."
            }
          </label>
        </header>

        {validationErrors.length > 0 && (
          <Box
            sx={{
              my: 2,
              p: 1.5,
              borderRadius: '8px',
              backgroundColor: '#fef2f2',
              border: '1.5px solid #ef4444',
              color: '#991b1b',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.12)'
            }}
            className="hide-on-print"
          >
            <Box sx={{ fontSize: '20px' }}>⚠️</Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#991b1b', fontSize: '13px' }}>
                {validationErrors.length} Shift Policy {validationErrors.length === 1 ? 'Violation' : 'Violations'} Detected
              </Typography>
              <Typography variant="caption" sx={{ color: '#b91c1c', display: 'block', mt: 0.25 }}>
                {validationErrors.map(e => `${getUserDisplayName(e.username)} (${e.date} - ${e.shift}): ${e.reason}`).join(' • ')}
              </Typography>
            </Box>
          </Box>
        )}

        <section className={styles["container__roasterContainer__table"]}>
          <article
            className={styles["container__roasterContainer__table--header"]}
          >
            {["Day", ...uniqueShifts].map((shiftName) => {
              const isLeave = shiftName === "Leave";
              const cfgShift = dutySummary?.shifts?.find((s: any) => s.name === shiftName);
              let headerLabel = shiftName;
              if (shiftName === "Shift-1") {
                headerLabel = "Shift-1 (06-30 AM to 2:30 PM)";
              } else if (shiftName === "Shift-2") {
                headerLabel = "Shift - 2 (02:30 PM to 10:30 PM)";
              } else if (shiftName === "Shift-3") {
                headerLabel = "Shift - 3 (10:30 PM to 06:30 AM)";
              } else if (cfgShift) {
                headerLabel = `${shiftName} (${formatTime(cfgShift.startTime)} to ${formatTime(cfgShift.endTime)})`;
              }
              return (
                <div
                  key={shiftName}
                  className={`${styles["container__roasterContainer__table--header-cell"]} ${isLeave ? "hide-on-print" : ""}`}
                >
                  <label>{headerLabel}</label>
                </div>
              );
            })}
          </article>

          <article
            className={styles["container__roasterContainer__table--body"]}
          >
            {Array.from({ length: 7 }).map((_, index) => {
              const currentDay = selectedWeek
                .startOf("isoWeek")
                .add(index, "day");
              const dateStr = currentDay.format("YYYY-MM-DD");
              return (
                <aside
                  key={index}
                  className={
                    styles["container__roasterContainer__table--body-cell"]
                  }
                  style={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "#f5f5f5" }}
                >
                  <div
                    className={
                      styles[
                      "container__roasterContainer__table--body-cell--row1"
                      ]
                    }
                  >
                    <label>{currentDay.format("DD/MM/YY")}</label>
                    <label>{currentDay.format("dddd")}</label>
                  </div>

                  {uniqueShifts.map((shiftName) => {
                    const key = `${dateStr}_${shiftName}`;
                    const assignees = rosterData[key]?.assignees || [];
                    const otherShiftsAssignees = uniqueShifts
                      .filter((s) => s !== shiftName)
                      .flatMap((s) => rosterData[`${dateStr}_${s}`]?.assignees || []);

                    const isLeave = shiftName === "Leave";
                    const historyChange = historyChangesMap[key];

                    const historyTooltipContent = historyChange ? (
                      <Tooltip
                        title={`Past Value before change by ${selectedHistory?.changedByFullName || 'User'} on ${dayjs(selectedHistory?.timestamp).format("DD MMM YYYY, hh:mm A")}`}
                        arrow
                      >
                        <Box
                          sx={{
                            position: 'absolute',
                            top: '-12px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 25,
                            backgroundColor: '#ed6c02',
                            color: '#ffffff',
                            px: 1,
                            py: 0.2,
                            borderRadius: '10px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                            cursor: 'pointer'
                          }}
                        >
                          Past: {historyChange.previousAssignees && historyChange.previousAssignees.length > 0 ? historyChange.previousAssignees.map(getUserDisplayName).join(', ') : 'Empty'}
                        </Box>
                      </Tooltip>
                    ) : null;

                    if (isLeave) {
                      return (
                        <div
                          key={shiftName}
                          className={`${styles["container__roasterContainer__table--body-cell--row2"]} hide-on-print`}
                          style={{
                            position: 'relative',
                            border: historyChange ? '2px solid #ed6c02' : undefined,
                            backgroundColor: historyChange ? '#fff8e1' : undefined
                          }}
                        >
                          {historyTooltipContent}
                          {isEditMode && (isSuperuser || !dayjs(dateStr).isBefore(getServerTime().startOf("isoWeek"), "day")) ? (
                            <Autocomplete
                              multiple
                              size="small"
                              options={users
                                .filter((u) => {
                                  const deptHeads = departmentsList.map((d: any) => d.departmentHead).filter(Boolean);
                                  const isSuper = u.is_superuser || u.isSuperuser;
                                  const isDeptHead = deptHeads.includes(u.username) || deptHeads.includes(u.id) || deptHeads.includes(u._id);
                                  const trackedRole = dutySummary?.trackedRole || "All Roles";
                                  const isCorrectRole = trackedRole === "All Roles" || (Array.isArray(u.role) ? u.role.includes(trackedRole) : u.role === trackedRole);
                                  return !isSuper && !isDeptHead && u.department === userDepartment && isCorrectRole && !otherShiftsAssignees.includes(u.username);
                                })
                                .map((u) => u.username)
                              }
                              getOptionLabel={(option) => getUserDisplayName(option)}
                              value={assignees}
                              onChange={(e, val) => {
                                setRosterDataByWeek((prev) => ({
                                  ...prev,
                                  [currentWeekKey]: {
                                    ...(prev[currentWeekKey] || {}),
                                    [key]: { ...(prev[currentWeekKey]?.[key] || {}), assignees: val }
                                  }
                                }));
                              }}
                              renderInput={(params) => (
                                <TextField {...params} variant="standard" />
                              )}
                              // @ts-ignore
                              renderTags={(value, getTagProps) =>
                                value.map((option, index) => {
                                  const error = validationErrors.find(
                                    (e) =>
                                      e.date === dateStr &&
                                      e.shift === shiftName &&
                                      e.username === option
                                  );
                                  return (
                                    <Tooltip title={error ? error.reason : ""} key={option} arrow>
                                      <Chip
                                        {...getTagProps({ index })}
                                        label={getUserDisplayName(option)}
                                        color={error ? "error" : "default"}
                                        sx={error ? { backgroundColor: '#d32f2f', color: '#ffffff', fontWeight: 700 } : {}}
                                      />
                                    </Tooltip>
                                  );
                                })
                              }
                              sx={{ width: "90%" }}
                            />
                          ) : (
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, p: 1, justifyContent: "center", width: "100%", height: "100%", alignItems: "center" }}>
                              {assignees.length > 0 ? (
                                assignees.map((a) => (
                                  <Chip key={a} label={getUserDisplayName(a)} color="error" variant="outlined" size="small" />
                                ))
                              ) : (
                                <label style={{ display: "flex", flex: "1", border: "none", alignItems: "center", justifyContent: "center" }}>-</label>
                              )}
                            </Box>
                          )}
                        </div>
                      );
                    }

                    const normStr = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    let shiftRows = rows
                      .filter(r => normStr(r.name).includes(normStr(shiftName)))
                      .sort((a, b) => a.name.localeCompare(b.name));
                    if (shiftRows.length === 0) {
                      shiftRows = [
                        { name: `${shiftName.replace('-', ' ')} Row 1`, mappedShift: shiftName },
                        { name: `${shiftName.replace('-', ' ')} Row 2`, mappedShift: shiftName }
                      ];
                    }

                    return (
                      <div
                        key={shiftName}
                        className={styles["container__roasterContainer__table--body-cell--row2"]}
                        style={{
                          position: 'relative',
                          border: historyChange ? '2px solid #ed6c02' : undefined,
                          backgroundColor: historyChange ? '#fff8e1' : undefined
                        }}
                      >
                        {historyTooltipContent}
                        {shiftRows.map((row, slotIdx) => {
                          const username = assignees[slotIdx];
                          const error = validationErrors.find(
                            (e) =>
                              e.date === dateStr &&
                              e.shift === shiftName &&
                              e.username === username
                          );

                          if (isEditMode && (isSuperuser || !dayjs(dateStr).isBefore(getServerTime().startOf("isoWeek"), "day"))) {
                            const sameShiftOtherSlots = assignees.filter((_, idx) => idx !== slotIdx);
                            const excludedUsernames = [...otherShiftsAssignees, ...sameShiftOtherSlots];
                            return (
                              <label key={slotIdx}>
                                <Autocomplete
                                  size="small"
                                  options={users
                                    .filter((u) => {
                                      const deptHeads = departmentsList.map((d: any) => d.departmentHead).filter(Boolean);
                                      const isSuper = u.is_superuser || u.isSuperuser;
                                      const isDeptHead = deptHeads.includes(u.username) || deptHeads.includes(u.id) || deptHeads.includes(u._id);
                                      const trackedRole = dutySummary?.trackedRole || "All Roles";
                                      const isCorrectRole = trackedRole === "All Roles" || (Array.isArray(u.role) ? u.role.includes(trackedRole) : u.role === trackedRole);
                                      return !isSuper && !isDeptHead && u.department === userDepartment && isCorrectRole && !excludedUsernames.includes(u.username);
                                    })
                                    .map((u) => u.username)
                                  }
                                  getOptionLabel={(option) => getUserDisplayName(option)}
                                  value={username || null}
                                  onChange={(e, val) => {
                                    const newAssignees = [...assignees];
                                    newAssignees[slotIdx] = val || "";
                                    setRosterDataByWeek((prev) => ({
                                      ...prev,
                                      [currentWeekKey]: {
                                        ...(prev[currentWeekKey] || {}),
                                        [key]: { ...(prev[currentWeekKey]?.[key] || {}), assignees: newAssignees }
                                      }
                                    }));
                                  }}
                                  renderInput={(params) => (
                                    <Tooltip title={error ? `${getUserDisplayName(username)}: ${error.reason}` : ""} arrow placement="top">
                                      <TextField
                                        {...params}
                                        variant="standard"
                                        error={Boolean(error)}
                                        placeholder={row.name}
                                        sx={{
                                          '& input': {
                                            fontSize: '12px',
                                            textAlign: 'center',
                                            color: error ? '#d32f2f !important' : 'inherit',
                                            fontWeight: error ? 700 : 'normal'
                                          },
                                          '& .MuiInput-underline:after': {
                                            borderBottomColor: error ? '#d32f2f !important' : undefined
                                          },
                                          backgroundColor: error ? 'rgba(211, 47, 47, 0.15)' : 'transparent',
                                          borderRadius: '4px',
                                          p: error ? '2px 4px' : 0,
                                          border: error ? '1.5px solid #d32f2f' : 'none'
                                        }}
                                      />
                                    </Tooltip>
                                  )}
                                  // @ts-ignore
                                  renderTags={() => null}
                                  sx={{ width: '90%' }}
                                />
                              </label>
                            );
                          } else {
                            // View mode
                            return (
                              <label
                                key={slotIdx}
                                style={{
                                  color: error ? "red" : "inherit",
                                  fontWeight: error ? 700 : 500,
                                }}
                              >
                                {username ? (
                                  <Tooltip title={error ? error.reason : ""}>
                                    <span>{getUserDisplayName(username)}</span>
                                  </Tooltip>
                                ) : (
                                  "-"
                                )}
                              </label>
                            );
                          }
                        })}
                      </div>
                    );
                  })}
                </aside>
              );
            })}
          </article>
        </section>

        {dutySummary && getRealtimeSummary().length > 0 && (
          <section className="duty-summary-section hide-on-print" style={{ borderTop: "1px solid #333", padding: "16px 24px", pageBreakInside: "avoid" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 2, textAlign: "center", textDecoration: "underline", textTransform: "uppercase", fontSize: "14px", color: "#333" }}>
              Staff Duty Summary Count
            </Typography>
            <div style={{ display: "flex", flexDirection: "column", width: "100%", border: "1px solid #333", borderRadius: "4px", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ display: "flex", backgroundColor: "#f5f5f5", borderBottom: "1px solid #333", fontWeight: "bold", fontSize: "13px" }}>
                <div style={{ flex: 2, padding: "8px 12px", borderRight: "1px solid #333" }}>Staff Name</div>
                <div style={{ flex: 1, padding: "8px 12px", borderRight: "1px solid #333", textAlign: "center" }}>
                  Current Week Days Count<br />
                  <span style={{ fontSize: "11px", fontWeight: "normal", color: "#555" }}>
                    ({dayjs(dutySummary.weekStart).format("DD/MM/YY")} to {dayjs(dutySummary.weekEnd).format("DD/MM/YY")})
                  </span>
                </div>
                <div style={{ flex: 1, padding: "8px 12px", textAlign: "center" }}>
                  Monthly Cycle Days Count<br />
                  <span style={{ fontSize: "11px", fontWeight: "normal", color: "#555" }}>
                    ({dayjs(dutySummary.cycleStart).format("DD/MM/YY")} to {dayjs(dutySummary.cycleEnd).format("DD/MM/YY")})
                  </span>
                </div>
              </div>
              {/* Body */}
              {getRealtimeSummary().map((item: any, idx: number, arr: any[]) => (
                <div key={idx} style={{ display: "flex", borderBottom: idx === arr.length - 1 ? "none" : "1px solid #333", fontSize: "13px", alignItems: "center" }}>
                  <div style={{ flex: 2, padding: "8px 12px", borderRight: "1px solid #333", fontWeight: 500 }}>
                    {getUserDisplayName(item.username)}
                  </div>
                  <div style={{ flex: 1, padding: "8px 12px", borderRight: "1px solid #333", textAlign: "center", fontWeight: "bold" }}>
                    {(() => {
                      const currentWeekStart = selectedWeek.startOf("isoWeek").format("YYYY-MM-DD");
                      const currentWeekLabel = dutySummary?.weeks?.find((w: any) => w.start === currentWeekStart)?.label;
                      const totalWeeksCount = dutySummary?.weeks ? dutySummary.weeks.length : 1;
                      const defaultTargetPerWeek = dutySummary?.maxAllowedDays ? Math.round(dutySummary.maxAllowedDays / totalWeeksCount) : 0;
                      const userSplitups = localSplitups[item.username] || {};
                      const targetVal = (currentWeekLabel && userSplitups[currentWeekLabel] !== undefined)
                        ? userSplitups[currentWeekLabel]
                        : defaultTargetPerWeek;
                      return `${item.weekDays} / ${targetVal}`;
                    })()}
                  </div>
                  <div style={{ flex: 1, padding: "8px 12px", textAlign: "center", fontWeight: "bold" }}>
                    {item.monthDays}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className={styles["container__roasterContainer__footer"]}>
          <label
            className={
              styles["container__roasterContainer__footer--kindlyLabel"]
            }
          >
            {
              "* Kindly permit the persons on shift 3 from 08:00 PM and shift 2 from 09:00 am onwards."
            }
          </label>
          <article
            className={styles["container__roasterContainer__footer--section1"]}
          >
            <label>{"MANAGER DCS"}</label>
            <label>{"Approved By"}</label>
          </article>

          <article
            className={styles["container__roasterContainer__footer--section2"]}
          >
            <aside
              className={
                styles["container__roasterContainer__footer--section2--left"]
              }
            >
              <label>{"CC:Asst.Commandant"}</label>
              <label>{"CC:Head,TOMD"}</label>
              <label>{"CC:Duty Officer"}</label>
              <label>{"CC:File"}</label>
            </aside>

            <aside
              className={
                styles["container__roasterContainer__footer--section2--right"]
              }
            >
              <label>{"SUJITH S"}</label>
              <label>{"GD,CITG"}</label>
            </aside>
          </article>
        </footer>
      </section>
      )}

      {activeTab === 1 && (
        <section style={{ paddingBottom: '40px' }} className="hide-on-print">
          <Paper sx={{ p: 3, borderRadius: '8px', boxShadow: 'none', border: '1px solid #ddd' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>
                Roaster Splitup (Monthly Cycle: {dayjs(dutySummary?.cycleStart).format('DD MMM YYYY')} - {dayjs(dutySummary?.cycleEnd).format('DD MMM YYYY')})
              </Typography>
            </Box>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '12px', fontWeight: 'bold' }}>Staff Name</th>
                    {dutySummary?.weeks?.map((week: any) => (
                      <th key={week.label} style={{ padding: '12px', fontWeight: 'bold', textAlign: 'center' }}>
                        {week.label}
                      </th>
                    ))}
                    <th style={{ padding: '12px', fontWeight: 'bold', textAlign: 'center' }}>Total Scheduled</th>
                    <th style={{ padding: '12px', fontWeight: 'bold', textAlign: 'center' }}>Monthly Target</th>
                    <th style={{ padding: '12px', fontWeight: 'bold', textAlign: 'center' }}>Remaining Required</th>
                  </tr>
                </thead>
                <tbody>
                   {dutySummary?.summary?.map((item: any, idx: number) => {
                    const totalWeeksCount = dutySummary.weeks ? dutySummary.weeks.length : 1;
                    const targetPerWeek = Math.round(dutySummary.maxAllowedDays / totalWeeksCount);
                    
                    const userSplitups = localSplitups[item.username] || {};
                    let userMonthlyTarget = 0;
                    dutySummary?.weeks?.forEach((week: any) => {
                      const targetVal = userSplitups[week.label] !== undefined ? userSplitups[week.label] : targetPerWeek;
                      userMonthlyTarget += Number(targetVal);
                    });

                    const remaining = Math.max(0, userMonthlyTarget - item.monthDays);
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee', backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '12px', fontWeight: 500 }}>{getUserDisplayName(item.username)}</td>
                        {dutySummary?.weeks?.map((week: any) => {
                          const scheduled = item.weeksBreakdown?.[week.label] || 0;
                          const targetVal = userSplitups[week.label] !== undefined ? userSplitups[week.label] : targetPerWeek;
                          const haveToTake = Math.max(0, targetVal - scheduled);
                          return (
                            <td key={week.label} style={{ padding: '12px', textAlign: 'center' }}>
                              {isEditMode ? (
                                <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                  <TextField
                                    type="number"
                                    size="small"
                                    value={targetVal}
                                    onChange={(e) => {
                                      let val = parseInt(e.target.value, 10);
                                      if (isNaN(val)) val = 0;
                                      if (val < 0) val = 0;
                                      if (val > 7) val = 7;
                                      handleSplitupChange(item.username, week.label, val);
                                    }}
                                    slotProps={{ htmlInput: { min: 0, max: 7, style: { textAlign: 'center', padding: '4px 8px', width: '50px', fontWeight: 'bold' } } }}
                                  />
                                  <span style={{ fontSize: '10px', color: '#777' }}>Scheduled: {scheduled}</span>
                                </Box>
                              ) : (
                                <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{targetVal}</span>
                                  <span style={{ fontSize: '10px', color: '#777' }}>Scheduled: {scheduled}</span>
                                </Box>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '15px' }}>{item.monthDays}</td>
                        <td style={{ padding: '12px', textAlign: 'center', color: '#555', fontWeight: 'bold' }}>{userMonthlyTarget}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <Chip
                            label={remaining > 0 ? `${remaining} days` : 'Achieved'}
                            color={remaining > 0 ? 'warning' : 'success'}
                            size="small"
                            sx={{ fontWeight: 'bold' }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Paper>
        </section>
      )}

      {/* Roaster Change History Right Sidebar Drawer */}
      <Drawer
        anchor="right"
        open={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 420 },
            backgroundColor: '#f8fafc',
            boxShadow: '-8px 0 32px rgba(15, 23, 42, 0.12)',
            display: 'flex',
            flexDirection: 'column',
          }
        }}
      >
        {/* Sleek Dark/Indigo Gradient Header */}
        <Box
          sx={{
            p: 2.5,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            position: 'relative',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 10px rgba(99, 102, 241, 0.4)',
                }}
              >
                <HistoryIcon size={22} color="#ffffff" />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.3px', color: '#ffffff' }}>
                  Roster Audit Trail
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '11px', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <MdBusiness size={12} /> {displayDepartmentValue}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={`${historyList.length} ${historyList.length === 1 ? 'Edit' : 'Edits'}`}
                size="small"
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  color: '#e2e8f0',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  height: 24,
                }}
              />
              <IconButton size="small" onClick={() => setIsHistoryOpen(false)} sx={{ color: '#94a3b8', '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.1)' } }}>
                <CancelIcon size={20} />
              </IconButton>
            </Box>
          </Box>

          {/* Sub Header Date Info */}
          <Box
            sx={{
              mt: 2,
              pt: 1.5,
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#cbd5e1',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <MdCalendarToday size={13} style={{ color: '#818cf8' }} />
              <span>
                {selectedWeek.startOf("isoWeek").format("DD MMM")} – {selectedWeek.endOf("isoWeek").format("DD MMM YYYY")}
              </span>
            </Box>
            {selectedHistory && (
              <Button
                size="small"
                onClick={() => setSelectedHistory(null)}
                sx={{
                  color: '#fbbf24',
                  fontSize: '11px',
                  textTransform: 'none',
                  p: 0,
                  minWidth: 'auto',
                  fontWeight: 700,
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                Clear Preview
              </Button>
            )}
          </Box>
        </Box>

        {/* Content Container */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Selected History Active Diff Banner */}
          {selectedHistory && (
            <Box
              sx={{
                p: 2,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #fffbe6 0%, #fef3c7 100%)',
                border: '1.5px solid #f59e0b',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip
                    label="PREVIEWING SNAPSHOT"
                    size="small"
                    sx={{
                      bgcolor: '#f59e0b',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '9px',
                      height: 18,
                      letterSpacing: '0.5px'
                    }}
                  />
                  <Typography variant="caption" sx={{ color: '#92400e', fontWeight: 700, fontSize: '11px' }}>
                    {dayjs(selectedHistory.timestamp).format("DD MMM, hh:mm A")}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#78350f', fontSize: '12.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Modified by {selectedHistory.changedByFullName || selectedHistory.changedBy}
                </Typography>
                <Typography variant="caption" sx={{ color: '#b45309', fontSize: '11px' }}>
                  Cells highlighted in grid with past values
                </Typography>
              </Box>
              <Button
                size="small"
                variant="contained"
                onClick={() => setSelectedHistory(null)}
                sx={{
                  bgcolor: '#d97706',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '11px',
                  textTransform: 'none',
                  borderRadius: '8px',
                  px: 1.5,
                  py: 0.5,
                  flexShrink: 0,
                  '&:hover': { bgcolor: '#b45309' }
                }}
              >
                Reset View
              </Button>
            </Box>
          )}

          {/* Timeline Roster Audit List */}
          {historyList.length === 0 ? (
            <Box
              sx={{
                py: 8,
                px: 3,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
              }}
            >
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                }}
              >
                <HistoryIcon size={28} />
              </Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#334155' }}>
                No Roster Changes Recorded
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontSize: '13px', maxWidth: 260 }}>
                Modifications to duty shifts or assignees for this week will automatically generate audit logs here.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ position: 'relative', pl: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Timeline Connector Bar */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 14,
                  bottom: 14,
                  left: 7,
                  width: '2px',
                  bgcolor: '#e2e8f0',
                  borderRadius: '1px',
                }}
              />

              {historyList.map((item) => {
                const isSelected = selectedHistory?.id === item.id;
                const authorName = item.changedByFullName || item.changedBy || 'System User';
                const authorInitials = authorName
                  .split(' ')
                  .map((n: string) => n.charAt(0))
                  .join('')
                  .substring(0, 2)
                  .toUpperCase() || 'U';

                return (
                  <Box key={item.id} sx={{ position: 'relative' }}>
                    {/* Timeline Node Dot */}
                    <Box
                      sx={{
                        position: 'absolute',
                        left: -21,
                        top: 16,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        bgcolor: isSelected ? '#f59e0b' : '#6366f1',
                        border: '3px solid #ffffff',
                        boxShadow: isSelected ? '0 0 0 3px rgba(245, 158, 11, 0.25)' : '0 0 0 2px rgba(99, 102, 241, 0.15)',
                        zIndex: 2,
                        transition: 'all 0.2s ease',
                      }}
                    />

                    <Paper
                      elevation={0}
                      onClick={() => setSelectedHistory(isSelected ? null : item)}
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        borderRadius: '14px',
                        border: isSelected ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                        bgcolor: isSelected ? '#fffdf5' : '#ffffff',
                        boxShadow: isSelected ? '0 8px 24px rgba(245, 158, 11, 0.12)' : '0 2px 8px rgba(15, 23, 42, 0.04)',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          borderColor: isSelected ? '#f59e0b' : '#818cf8',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
                        }
                      }}
                    >
                      {/* Item Header */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              fontSize: '12px',
                              fontWeight: 800,
                              bgcolor: isSelected ? '#fef3c7' : '#e0e7ff',
                              color: isSelected ? '#b45309' : '#3730a3',
                              border: isSelected ? '1.5px solid #f59e0b' : '1.5px solid #c7d2fe',
                            }}
                          >
                            {authorInitials}
                          </Avatar>
                          <Box>
                            <Typography sx={{ fontWeight: 800, fontSize: '13px', color: '#1e293b', lineHeight: 1.2 }}>
                              {authorName}
                            </Typography>
                            <Typography sx={{ fontSize: '11px', color: '#64748b', mt: 0.25 }}>
                              {dayjs(item.timestamp).format("DD MMM YYYY · hh:mm A")}
                            </Typography>
                          </Box>
                        </Box>
                        <Chip
                          label={isSelected ? "Selected" : "Compare Diff"}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '10px',
                            fontWeight: 800,
                            bgcolor: isSelected ? '#f59e0b' : '#f1f5f9',
                            color: isSelected ? '#ffffff' : '#475569',
                            border: isSelected ? 'none' : '1px solid #cbd5e1',
                            transition: 'all 0.15s ease',
                          }}
                        />
                      </Box>

                      {/* Changes breakdown chips */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1.5 }}>
                        {(item.changes || []).map((c: any, cIdx: number) => {
                          const prevText = c.previousAssignees?.length ? c.previousAssignees.map(getUserDisplayName).join(', ') : 'Unassigned';
                          const newText = c.newAssignees?.length ? c.newAssignees.map(getUserDisplayName).join(', ') : 'Unassigned';

                          return (
                            <Box
                              key={cIdx}
                              sx={{
                                p: 1.25,
                                borderRadius: '10px',
                                bgcolor: isSelected ? '#ffffff' : '#f8fafc',
                                border: '1px solid #e2e8f0',
                                fontSize: '12px',
                              }}
                            >
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                                <Chip
                                  label={`${dayjs(c.date).format("DD MMM")} · ${c.shift}`}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    bgcolor: '#e0e7ff',
                                    color: '#3730a3',
                                    borderRadius: '6px'
                                  }}
                                />
                              </Box>

                              {/* Diff Row */}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', fontSize: '11.5px' }}>
                                <Box sx={{ p: '2px 8px', borderRadius: '6px', bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 600 }}>
                                  {prevText}
                                </Box>
                                <Typography sx={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>➔</Typography>
                                <Box sx={{ p: '2px 8px', borderRadius: '6px', bgcolor: '#dcfce7', color: '#166534', fontWeight: 700 }}>
                                  {newText}
                                </Box>
                              </Box>

                              {c.previousNotes !== c.newNotes && (
                                <Typography sx={{ fontSize: '10.5px', color: '#64748b', mt: 0.75, fontStyle: 'italic' }}>
                                  Notes updated: "{c.previousNotes || 'None'}" ➔ "{c.newNotes || 'None'}"
                                </Typography>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    </Paper>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Drawer>

    </Box>
  );
};

export default RoasterPage;
