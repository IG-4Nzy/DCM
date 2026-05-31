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
  IconButton
} from "@mui/material";
import { MdEdit as EditIcon, MdSave as SaveIcon, MdClose as CancelIcon, MdPrint as PrintIcon } from "react-icons/md";
import dayjs, { Dayjs } from "dayjs";
import { getServerTime } from "../../helpers/time";
import isoWeekPlugin from "dayjs/plugin/isoWeek";
import WeekPicker from "../../components/WeekPicker";
import styles from "./index.module.scss";
import { tableHeader } from "./constant";
import { useToast } from "../../contexts/ToastContext";
import { hasPrivilege } from "../../helpers/authUtils";
import { PRIVILEGES } from "../../helpers/privileges";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../../store";
import { jwtDecode } from "jwt-decode";
import { validateRoster } from "./validation";
import { fetchUsers, fetchAllDepartmentsForDropdown } from "../Users/action";
import { fetchRostersData, fetchRosterStatusData, updateRosterStatus, resetRosterStatus, createRoster, updateRoster, fetchDutySummary } from "./action";

dayjs.extend(isoWeekPlugin);

interface RosterData {
  id?: string;
  assignees: string[];
  updatedAt?: string;
  updatedByFullName?: string;
}

const RoasterPage: React.FC = () => {
  const [selectedWeek, setSelectedWeek] = useState<Dayjs>(getServerTime());
  const [isEditMode, setIsEditMode] = useState(false);
  const [rosterData, setRosterData] = useState<Record<string, RosterData>>({});
  const [rosterStatus, setRosterStatus] = useState<any>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [dutySummary, setDutySummary] = useState<any>(null);
  const [savedRosterData, setSavedRosterData] = useState<Record<string, RosterData>>({});

  const dispatch = useDispatch<AppDispatch>();
  const { showToast } = useToast();
  const isSuperuser = useSelector((state: RootState) => state.auth.isSuperuser);
  const token = useSelector((state: RootState) => state.auth.token);
  const { users, availableDepartments: departmentsList } = useSelector((state: RootState) => state.users);
  
  const canView = isSuperuser || hasPrivilege(PRIVILEGES.ROASTER_VIEW);
  const canEdit =
    isSuperuser ||
    hasPrivilege(PRIVILEGES.ROASTER_CREATE) ||
    hasPrivilege(PRIVILEGES.ROASTER_UPDATE);
  const canApprove = isSuperuser || hasPrivilege(PRIVILEGES.ROASTER_APPROVE);
  const userDepartment = token ? (jwtDecode(token) as any).department || "General" : "General";

  const weekDates = Array.from({ length: 7 }).map((_, index) =>
    selectedWeek.startOf("isoWeek").add(index, "day").format("YYYY-MM-DD")
  );

  const validationErrors = validateRoster(rosterData, weekDates);

  const fetchRosters = async () => {
    const startDate = selectedWeek.startOf("isoWeek").format("YYYY-MM-DD");
    const endDate = selectedWeek.endOf("isoWeek").format("YYYY-MM-DD");
    try {
      const data = await dispatch(fetchRostersData({ startDate, endDate, department: userDepartment || '' })).unwrap();
      const newRosterData: Record<string, RosterData> = {};
      data.forEach((r: any) => {
        newRosterData[`${r.date}_${r.shift}`] = {
          id: r.id || r._id,
          assignees: r.assignees,
          updatedAt: r.updatedAt,
          updatedByFullName: r.updatedByFullName
        };
      });
      setRosterData(newRosterData);
      setSavedRosterData(newRosterData);
    } catch (e) {
      console.error(e);
      showToast("Failed to fetch rosters", "error");
    }
  };

  const fetchRosterStatus = async () => {
    if (!userDepartment) return;
    const startDate = selectedWeek.startOf("isoWeek").format("YYYY-MM-DD");
    try {
      const data = await dispatch(fetchRosterStatusData({ weekStartDate: startDate, department: userDepartment })).unwrap();
      setRosterStatus(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSummary = async () => {
    if (!userDepartment) return;
    try {
      const data = await dispatch(fetchDutySummary({ department: userDepartment })).unwrap();
      setDutySummary(data);
    } catch (e) {
      console.error(e);
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
      const isCorrectDept = u.department === userDepartment;
      const isNotSuper = !(u.is_superuser || u.isSuperuser);
      const isCorrectRole = trackedRole === "All Roles" || u.role === trackedRole;
      return isCorrectDept && isNotSuper && isCorrectRole;
    });

    const summaryList = deptUsers.map((u) => {
      const username = u.username;
      const initial = backendCounts.get(username) || { monthDays: 0, weekDays: 0 };

      // 1. Calculate real-time week counts
      const weekDatesAssigned = new Set<string>();
      weekDates.forEach((dateStr) => {
        ["Shift-1", "Shift-2", "Shift-3"].forEach((shift) => {
          const key = `${dateStr}_${shift}`;
          if (rosterData[key]?.assignees?.includes(username)) {
            weekDatesAssigned.add(dateStr);
          }
        });
      });
      const realWeekDays = weekDatesAssigned.size;

      // 2. Calculate real-time month counts
      const savedCycleDates = new Set<string>();
      weekDatesInCycle.forEach((dateStr) => {
        ["Shift-1", "Shift-2", "Shift-3"].forEach((shift) => {
          const key = `${dateStr}_${shift}`;
          if (savedRosterData[key]?.assignees?.includes(username)) {
            savedCycleDates.add(dateStr);
          }
        });
      });
      const savedCount = savedCycleDates.size;

      const currentCycleDates = new Set<string>();
      weekDatesInCycle.forEach((dateStr) => {
        ["Shift-1", "Shift-2", "Shift-3"].forEach((shift) => {
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
    fetchRosters();
    fetchRosterStatus();
    fetchSummary();
  }, [selectedWeek]);

  useEffect(() => {
    let department = "";
    if (token) {
      const decoded: any = jwtDecode(token);
      department = decoded.department || "";
    }
    dispatch(fetchUsers({ department, pagination: false }));
    dispatch(fetchAllDepartmentsForDropdown());
  }, [dispatch, token]);

  const handleStatusChange = async (newStatus: string) => {
    setAnchorEl(null);
    if (!userDepartment) return;
    const startDate = selectedWeek.startOf("isoWeek").format("YYYY-MM-DD");
    try {
      const data = await dispatch(updateRosterStatus({
        weekStartDate: startDate,
        department: userDepartment,
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

  const handleSave = async () => {
    try {
      const promises = Object.entries(rosterData).map(async ([key, data]) => {
        const [date, shift] = key.split("_");
        // Skip past weeks (allow past days within the current week) to prevent past weeks modifications
        if (dayjs(date).isBefore(getServerTime().startOf("isoWeek"), "day")) {
          return;
        }
        if (data.id) {
          await dispatch(updateRoster({
            id: data.id,
            date,
            shift,
            assignees: data.assignees,
            department: userDepartment || 'General',
          })).unwrap();
        } else if (data.assignees.length > 0) {
          await dispatch(createRoster({
            date,
            shift,
            assignees: data.assignees,
            department: userDepartment || 'General',
          })).unwrap();
        }
      });
      await Promise.all(promises);
      
      // Automatically reset status to Pending when edits are made
      if (userDepartment) {
        try {
          const startDate = selectedWeek.startOf("isoWeek").format("YYYY-MM-DD");
          const data = await dispatch(resetRosterStatus({
            weekStartDate: startDate,
            department: userDepartment,
            status: "Pending"
          })).unwrap();
          setRosterStatus(data);
        } catch (e) {
          console.error("Failed to reset status", e);
        }
      }

      showToast("Roster saved successfully", "success");
      setIsEditMode(false);
      fetchRosters();
      fetchSummary();
    } catch (e) {
      console.error(e);
      showToast("Failed to save roster", "error");
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

  const hasRosterData = Object.values(rosterData).some((r) => r.id);

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
              <Box sx={{ display: 'flex', gap: 1 }}>
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
                <Tooltip title="Cancel Edit">
                  <IconButton
                    color="error"
                    onClick={() => {
                      setIsEditMode(false);
                      fetchRosters(); // reset unsaved changes
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
                  onClick={() => setIsEditMode(true)}
                  size="small"
                  className="hide-on-print"
                  sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }}
                >
                  <EditIcon />
                </IconButton>
              </Tooltip>
            ))}

        

          {canApprove && rosterStatus?.status !== "Approved" && hasRosterData && (
            <>
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                className="hide-on-print"
                onClick={(e) => setAnchorEl(e.currentTarget)}
                sx={{ width: '150px', height: '32px', fontSize: '12px' }}
              >
                Approve/Reject
              </Button>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
              >
                <MenuItem onClick={() => handleStatusChange("Approved")}>Approve</MenuItem>
                <MenuItem onClick={() => handleStatusChange("Rejected")}>Reject</MenuItem>
              </Menu>
            </>
          )}

            {rosterStatus && hasRosterData && (
            <Chip
              label={rosterStatus.status}
              color={rosterStatus.status === 'Approved' ? 'success' : rosterStatus.status === 'Rejected' ? 'error' : 'warning'}
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
          )}

              {/* Last Updated Info */}
          {Object.values(rosterData).some(r => r.updatedAt) && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', ml: 2, mr: 2 ,gap: '0px'}}>
              <Typography variant="caption" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                Roster last updated: {dayjs(Math.max(...Object.values(rosterData).map(r => r.updatedAt ? new Date(r.updatedAt).getTime() : 0))).format('DD MMM YYYY, hh:mm A')}
              </Typography>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold' }}>
                by {Object.values(rosterData).sort((a, b) => (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) - (a.updatedAt ? new Date(a.updatedAt).getTime() : 0))[0]?.updatedByFullName || 'Unknown'}
              </Typography>
            </Box>
          )}

        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
        </Box>
      </header>

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

        <section className={styles["container__roasterContainer__table"]}>
          <article
            className={styles["container__roasterContainer__table--header"]}
          >
            {tableHeader?.map((header) => (
              <div
                key={header}
                className={`${styles["container__roasterContainer__table--header-cell"]} ${header === "Leave" ? "hide-on-print" : ""}`}
              >
                <label>{header}</label>
              </div>
            ))}
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

                  {["Shift-1", "Shift-2", "Shift-3", "Leave"].map((shift) => {
                    const key = `${dateStr}_${shift}`;
                    const assignees = rosterData[key]?.assignees || [];
                    const otherShiftsAssignees = ["Shift-1", "Shift-2", "Shift-3", "Leave"]
                      .filter((s) => s !== shift)
                      .flatMap((s) => rosterData[`${dateStr}_${s}`]?.assignees || []);

                    return (
                      <div
                        key={shift}
                        className={`${styles["container__roasterContainer__table--body-cell--row2"]} ${shift === "Leave" ? "hide-on-print" : ""}`}
                      >
                        {isEditMode && !dayjs(dateStr).isBefore(getServerTime().startOf("isoWeek"), "day") ? (
                          <Autocomplete
                            multiple
                            size="small"
                            options={users
                              .filter((u) => {
                                const deptHeads = departmentsList.map((d: any) => d.departmentHead).filter(Boolean);
                                const isSuper = u.is_superuser || u.isSuperuser;
                                const isDeptHead = deptHeads.includes(u.username) || deptHeads.includes(u.id) || deptHeads.includes(u._id);
                                return !isSuper && !isDeptHead && u.department === userDepartment && !otherShiftsAssignees.includes(u.username);
                              })
                              .map((u) => u.username)
                            }
                            getOptionLabel={(option) => getUserDisplayName(option)}
                            value={assignees}
                            onChange={(e, val) => {
                              if (shift === "Leave" || val.length <= 2) {
                                setRosterData((prev) => ({
                                  ...prev,
                                  [key]: { ...(prev[key] || {}), assignees: val },
                                }));
                              } else {
                                showToast("Maximum 2 persons per shift allowed", "warning");
                              }
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
                                    e.shift === shift &&
                                    e.username === option
                                );
                                return (
                                  <Tooltip title={error ? error.reason : ""} key={option}>
                                    <Chip
                                      {...getTagProps({ index })}
                                      label={option}
                                      color={error ? "error" : "default"}
                                    />
                                  </Tooltip>
                                );
                              })
                            }
                            getOptionDisabled={(option) => shift !== "Leave" && assignees.length >= 2 && !assignees.includes(option)}
                            sx={{ width: "90%" }}
                            disableCloseOnSelect
                          />
                        ) : shift === "Leave" ? (
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, p: 1, justifyContent: "center", width: "100%", height: "100%", alignItems: "center" }}>
                            {assignees.length > 0 ? (
                              assignees.map((a) => (
                                <Chip key={a} label={getUserDisplayName(a)} color="error" variant="outlined" size="small" />
                              ))
                            ) : (
                              <label style={{ display: "flex", flex: "1", border: "none", alignItems: "center", justifyContent: "center" }}>-</label>
                            )}
                          </Box>
                        ) : (
                          <>
                            {assignees.length > 0 ? (
                              <Tooltip
                                title={
                                  validationErrors.find(
                                    (e) =>
                                      e.date === dateStr &&
                                      e.shift === shift &&
                                      e.username === assignees[0]
                                  )?.reason || ""
                                }
                              >
                                <label
                                  style={{
                                    color: validationErrors.some(
                                      (e) =>
                                        e.date === dateStr &&
                                        e.shift === shift &&
                                        e.username === assignees[0]
                                    )
                                      ? "red"
                                      : "inherit",
                                  }}
                                >
                                  {getUserDisplayName(assignees[0])}
                                </label>
                              </Tooltip>
                            ) : (
                              <label>-</label>
                            )}

                            {assignees.length > 1 ? (
                              <Tooltip
                                title={
                                  validationErrors.find(
                                    (e) =>
                                      e.date === dateStr &&
                                      e.shift === shift &&
                                      e.username === assignees[1]
                                  )?.reason || ""
                                }
                              >
                                <label
                                  style={{
                                    color: validationErrors.some(
                                      (e) =>
                                        e.date === dateStr &&
                                        e.shift === shift &&
                                        e.username === assignees[1]
                                    )
                                      ? "red"
                                      : "inherit",
                                  }}
                                >
                                  {getUserDisplayName(assignees[1])}
                                </label>
                              </Tooltip>
                            ) : (
                              <label>-</label>
                            )}
                          </>
                        )}
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
                    {item.weekDays}
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


    </Box>
  );
};

export default RoasterPage;
