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
  MenuItem
} from "@mui/material";
import dayjs, { Dayjs } from "dayjs";
import isoWeekPlugin from "dayjs/plugin/isoWeek";
import WeekPicker from "../../components/WeekPicker";
import styles from "./index.module.scss";
import { tableHeader } from "./constant";
import request from "../../services/request";
import { useToast } from "../../contexts/ToastContext";
import { hasPrivilege } from "../../helpers/authUtils";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";
import { jwtDecode } from "jwt-decode";
import { validateRoster } from "./validation";

dayjs.extend(isoWeekPlugin);

interface RosterData {
  id?: string;
  assignees: string[];
  updatedAt?: string;
  updatedByFullName?: string;
}

const RoasterPage: React.FC = () => {
  const [selectedWeek, setSelectedWeek] = useState<Dayjs>(dayjs());
  const [isEditMode, setIsEditMode] = useState(false);
  const [rosterData, setRosterData] = useState<Record<string, RosterData>>({});
  const [users, setUsers] = useState<any[]>([]);
  const [rosterStatus, setRosterStatus] = useState<any>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const { showToast } = useToast();
  const isSuperuser = useSelector((state: RootState) => state.auth.isSuperuser);
  const token = useSelector((state: RootState) => state.auth.token);
  
  const canView = isSuperuser || hasPrivilege("View Roaster");
  const canEdit =
    isSuperuser ||
    hasPrivilege("Create Roaster") ||
    hasPrivilege("Update Roaster");
  const canDelete = isSuperuser || hasPrivilege("Delete Roaster");
  const canApprove = isSuperuser || hasPrivilege("Approve Roaster");

  const userDepartment = token ? (jwtDecode(token) as any).department || "" : "";

  const weekDates = Array.from({ length: 7 }).map((_, index) =>
    selectedWeek.startOf("isoWeek").add(index, "day").format("YYYY-MM-DD")
  );

  const validationErrors = validateRoster(rosterData, weekDates);

  const fetchRosters = async () => {
    const startDate = selectedWeek.startOf("isoWeek").format("YYYY-MM-DD");
    const endDate = selectedWeek.endOf("isoWeek").format("YYYY-MM-DD");
    try {
      const res = await request.get(
        `/api/roasters/?startDate=${startDate}&endDate=${endDate}&limit=100`,
      );
      const data = res.data.data;
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
    } catch (e) {
      console.error(e);
      showToast("Failed to fetch rosters", "error");
    }
  };

  const fetchUsers = async () => {
    try {
      let department = "";
      if (token) {
        const decoded: any = jwtDecode(token);
        department = decoded.department || "";
      }
      
      let url = `/api/users/`;
      if (department) {
        url += `?department=${department}`;
      }
      
      const res = await request.get(url);
      setUsers(res.data.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRosterStatus = async () => {
    if (!userDepartment) return;
    const startDate = selectedWeek.startOf("isoWeek").format("YYYY-MM-DD");
    try {
      const res = await request.get(`/api/roasters/status?weekStartDate=${startDate}&department=${userDepartment}`);
      setRosterStatus(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRosters();
    fetchRosterStatus();
  }, [selectedWeek]);

  useEffect(() => {
    if (users.length === 0) {
      fetchUsers();
    }
  }, []);

  const handleStatusChange = async (newStatus: string) => {
    setAnchorEl(null);
    if (!userDepartment) return;
    const startDate = selectedWeek.startOf("isoWeek").format("YYYY-MM-DD");
    try {
      const res = await request.post('/api/roasters/status', {
        weekStartDate: startDate,
        department: userDepartment,
        status: newStatus
      });
      setRosterStatus(res.data);
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
        if (data.id) {
          await request.put(`/api/roasters/${data.id}`, {
            date,
            shift,
            assignees: data.assignees,
          });
        } else if (data.assignees.length > 0) {
          await request.post(`/api/roasters/`, {
            date,
            shift,
            assignees: data.assignees,
          });
        }
      });
      await Promise.all(promises);
      
      // Automatically reset status to Pending when edits are made
      if (userDepartment) {
        try {
          const startDate = selectedWeek.startOf("isoWeek").format("YYYY-MM-DD");
          const res = await request.post('/api/roasters/status/reset', {
            weekStartDate: startDate,
            department: userDepartment,
            status: "Pending"
          });
          setRosterStatus(res.data);
        } catch (e) {
          console.error("Failed to reset status", e);
        }
      }

      showToast("Roster saved successfully", "success");
      setIsEditMode(false);
      fetchRosters();
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

  return (
    <Box className={styles.container}>
      <header className={styles["container__header"]}>
        <Box
          sx={{
            display: "flex",
            placeItems: "center",
            justifyContent: "center",
            gap: "12px",
          }}
        >
          <Typography
            variant="h5"
            className={styles["container__header--title"]}
            sx={{ marginBottom: "0px !important", fontWeight: "bold" }}
          >
            Duty Roster
          </Typography>
          
        
          {canEdit &&
            (isEditMode ? (
              <Button
                variant="contained"
                color="primary"
                onClick={handleSave}
                size="small"
              >
                Save Roster
              </Button>
            ) : (
              <Button
                variant="outlined"
                color="primary"
                onClick={() => setIsEditMode(true)}
                size="small"
                className="hide-on-print"
              >
                Edit Roster
              </Button>
            ))}

        

          {canApprove && (
            <>
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                className="hide-on-print"
                onClick={(e) => setAnchorEl(e.currentTarget)}
              >
                Update Status
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

            {rosterStatus && (
            <Chip
              label={rosterStatus.status}
              color={rosterStatus.status === 'Approved' ? 'success' : rosterStatus.status === 'Rejected' ? 'error' : 'warning'}
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
          )}

              {/* Last Updated Info */}
          {Object.values(rosterData).some(r => r.updatedAt) && (
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', ml: 2, mr: 2 ,gap: '8px'}}>
              <Typography variant="caption" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                Last updated: {dayjs(Math.max(...Object.values(rosterData).map(r => r.updatedAt ? new Date(r.updatedAt).getTime() : 0))).format('DD MMM YYYY, hh:mm A')}
              </Typography>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold' }}>
                by {Object.values(rosterData).sort((a, b) => (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) - (a.updatedAt ? new Date(a.updatedAt).getTime() : 0))[0]?.updatedByFullName || 'Unknown'}
              </Typography>
            </Box>
          )}

        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!dayjs().isSame(selectedWeek, 'isoWeek') && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setSelectedWeek(dayjs())}
              className="hide-on-print"
            >
              This Week
            </Button>
          )}
          <WeekPicker
            value={selectedWeek}
            onChange={(newVal) => setSelectedWeek(newVal)}
          />
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
                className={
                  styles["container__roasterContainer__table--header-cell"]
                }
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

                  {["Shift-1", "Shift-2", "Shift-3"].map((shift) => {
                    const key = `${dateStr}_${shift}`;
                    const assignees = rosterData[key]?.assignees || [];
                    const otherShiftsAssignees = ["Shift-1", "Shift-2", "Shift-3"]
                      .filter((s) => s !== shift)
                      .flatMap((s) => rosterData[`${dateStr}_${s}`]?.assignees || []);

                    return (
                      <div
                        key={shift}
                        className={
                          styles[
                          "container__roasterContainer__table--body-cell--row2"
                          ]
                        }
                      >
                        {isEditMode ? (
                          <Autocomplete
                            multiple
                            size="small"
                            options={users
                              .map((u) => u.username)
                              .filter((username) => !otherShiftsAssignees.includes(username))
                            }
                            value={assignees}
                            onChange={(e, val) => {
                              if (val.length <= 2) {
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
                            getOptionDisabled={(option) => assignees.length >= 2 && !assignees.includes(option)}
                            sx={{ width: "90%" }}
                            disableCloseOnSelect
                          />
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
