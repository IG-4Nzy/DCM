// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box, Paper, Tooltip, IconButton, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import {
  MdAdd as AddIcon,
  MdEdit as EditIcon,
  MdDelete as DeleteIcon,
  MdWarning,
} from "react-icons/md";
import Button from "../../components/Button";
import SearchBar from "../../components/SearchBar";
import Table, { type Column } from "../../components/Table";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../contexts/ConfirmContext";
import { useTableState } from "../../hooks/useTableState";
import request from "../../services/request";
import {
  createUser,
  deleteUser,
  fetchUsers,
  updateUser,
  fetchAllRolesForDropdown,
  fetchAllDepartmentsForDropdown,
} from "./action";
import type { AppDispatch, RootState } from "../../store";
import type { UserData } from "./model";
import UserFormModal from "./UserFormModal";
import { hasPrivilege } from "../../helpers/authUtils";
import { jwtDecode } from "jwt-decode";
import { getServerTime } from "../../helpers/time";
import styles from "./index.module.scss";
import { PRIVILEGES } from "../../helpers/privileges";

type Order = "asc" | "desc";

const getLoggedInUserDepartment = (): string => {
  try {
    const token = localStorage.getItem("token");
    if (token) {
      const decoded: any = jwtDecode(token);
      return decoded.department || "All Departments";
    }
  } catch (e) {
    console.error("Error decoding token:", e);
  }
  return "All Departments";
};

const Users: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { username: currentUsername } = useSelector((state: RootState) => state.auth);
  const {
    adminUsers,
    availableRoles,
    availableDepartments,
    totalCount,
    loading,
    error,
  } = useSelector((state: RootState) => state.users);
  const { showToast } = useToast();

  const hasViewAll = hasPrivilege(PRIVILEGES.USER_VIEW_ALL);
  const defaultDept = hasViewAll ? "All Departments" : getLoggedInUserDepartment();

  const [searchQuery, setSearchQuery] = useTableState("users_search", "");
  const [selectedDepartment, setSelectedDepartment] = useTableState("users_filter_dept", defaultDept);

  useEffect(() => {
    if (!hasViewAll && selectedDepartment === "All Departments") {
      setSelectedDepartment(getLoggedInUserDepartment());
    }
  }, [hasViewAll, selectedDepartment, setSelectedDepartment]);

  const [selectedRole, setSelectedRole] = useTableState("users_filter_role", "All Roles");
  const [selectedStatus, setSelectedStatus] = useTableState("users_filter_status", "active");
  const [page, setPage] = useTableState("users_page", 0);
  const [rowsPerPage, setRowsPerPage] = useTableState("users_rowsPerPage", 5);
  const [order, setOrder] = useTableState<Order>("users_order", "asc");
  const [orderBy, setOrderBy] = useTableState<keyof UserData>("users_orderBy", "username");

  // Modal and Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<string | string[]>([]);
  const [formStatus, setFormStatus] = useState(true);
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formDob, setFormDob] = useState("");
  const [formMobile, setFormMobile] = useState("");
  const [formBloodGroup, setFormBloodGroup] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formDateOfJoin, setFormDateOfJoin] = useState("");
  const [formDepartment, setFormDepartment] = useState("");

  const [isEditMode, setIsEditMode] = useState(false);
  const [formReplacementFor, setFormReplacementFor] = useState("");
  const [formPassNumber, setFormPassNumber] = useState("");
  const [formIsMonitorUser, setFormIsMonitorUser] = useState(false);
  const [allSystemUsers, setAllSystemUsers] = useState<UserData[]>([]);

  useEffect(() => {
    dispatch(fetchAllRolesForDropdown());
    dispatch(fetchAllDepartmentsForDropdown());
  }, [dispatch]);

  const loadData = React.useCallback(() => {
    dispatch(
      fetchUsers({
        skip: page * rowsPerPage,
        limit: rowsPerPage,
        sortBy: orderBy as string,
        order,
        search: searchQuery,
        department: selectedDepartment === "All Departments" ? "" : selectedDepartment,
        role: selectedRole === "All Roles" ? "" : selectedRole,
        status: selectedStatus,
        showToast,
      }),
    );
  }, [dispatch, showToast, page, rowsPerPage, orderBy, order, searchQuery, selectedDepartment, selectedRole, selectedStatus]);

  useEffect(() => {
    setPage(0);
  }, [selectedDepartment, selectedRole, selectedStatus, searchQuery]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (document.hidden) return;
      loadData();
    }, 60000); // 60s background refresh
    return () => clearInterval(interval);
  }, [loadData]);

  const isUserOnline = (user: UserData) => {
    if (user.status === false) return false;
    if (!user.lastActive) return false;
    try {
      const lastActiveTime = new Date(user.lastActive).getTime();
      const now = Date.now();
      return now - lastActiveTime < 45000;
    } catch (e) {
      return false;
    }
  };

  const loadSystemUsers = async () => {
    try {
      const res = await request.get("/api/users", { params: { pagination: false, status: "all" } });
      setAllSystemUsers(res.data.data || []);
    } catch (err) {
      console.error("Failed to load system users", err);
    }
  };

  const inactiveUsers = useMemo(() => {
    if (!formDepartment) return [];
    const chosenReplacementIds = new Set(
      allSystemUsers
        .filter((u) => u.id !== editingUser?.id)
        .map((u) => u.replacementFor)
        .filter((id): id is string => !!id)
    );
    return allSystemUsers.filter((u) => {
      if (u.status !== false) return false;
      if (u.department !== formDepartment) return false;
      if (chosenReplacementIds.has(u.id)) return false;
      if (editingUser && u.id === editingUser.id) return false;
      return true;
    });
  }, [allSystemUsers, formDepartment, editingUser]);

  const handleViewReplacedUser = async (replacedUserId: string) => {
    try {
      const res = await request.get(`/api/users/${replacedUserId}`);
      const user: UserData = res.data;
      handleOpenModal(user, false);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to fetch relieved user details";
      showToast(msg, "error");
    }
  };

  const handleOpenModal = (user?: UserData, editMode: boolean = false) => {
    setIsEditMode(editMode);
    if (user) {
      setEditingUser(user);
      setFormUsername(user.username);
      setFormPassword("");
      setFormRole(user.role || []);
      setFormStatus(user.status);
      setFormFirstName(user.firstName || "");
      setFormLastName(user.lastName || "");
      setFormDob(user.dob || "");
      setFormMobile(user.mobile || "");
      setFormBloodGroup(user.bloodGroup || "");
      setFormAddress(user.address || "");
      setFormDateOfJoin(user.dateOfJoin || "");
      setFormDepartment(user.department || "");
      setFormReplacementFor(user.replacementFor || "");
      setFormPassNumber(user.passNumber || "");
      setFormIsMonitorUser(user.isMonitorUser || false);
      loadSystemUsers();
    } else {
      setIsEditMode(true);
      setEditingUser(null);
      setFormUsername("");
      setFormPassword("");
      setFormRole([]);
      setFormStatus(true);
      setFormFirstName("");
      setFormLastName("");
      setFormDob("");
      setFormMobile("");
      setFormBloodGroup("");
      setFormAddress("");
      setFormDateOfJoin("");
      setFormDepartment("");
      setFormReplacementFor("");
      setFormPassNumber("");
      setFormIsMonitorUser(false);
      loadSystemUsers();
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation checks
    if (!formUsername) {
      showToast("Username is required", "error");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(formUsername)) {
      showToast("Username must contain alphabets, underscore, and numbers only", "error");
      return;
    }
    if (formUsername.length > 20) {
      showToast("Username must be maximum 20 characters", "error");
      return;
    }
    if (!editingUser && !formPassword) {
      showToast("Password is required", "error");
      return;
    }
    if (formPassword && formPassword.length > 20) {
      showToast("Password must be maximum 20 characters", "error");
      return;
    }
    if (formFirstName && !/^[a-zA-Z0-9_.\s]+$/.test(formFirstName)) {
      showToast("First name must contain alphanumeric characters, spaces, dots, or underscores only", "error");
      return;
    }
    if (formFirstName && formFirstName.length > 20) {
      showToast("First name must be maximum 20 characters", "error");
      return;
    }
    if (formLastName && !/^[a-zA-Z0-9_.\s]+$/.test(formLastName)) {
      showToast("Last name must contain alphanumeric characters, spaces, dots, or underscores only", "error");
      return;
    }
    if (formLastName && formLastName.length > 20) {
      showToast("Last name must be maximum 20 characters", "error");
      return;
    }
    if (formMobile && !/^[0-9,]+$/.test(formMobile)) {
      showToast("Mobile number must contain numbers and commas only", "error");
      return;
    }
    if (formPassNumber && !/^[a-zA-Z0-9]+$/.test(formPassNumber)) {
      showToast("Pass number must be alphanumeric only", "error");
      return;
    }
    if (formPassNumber && formPassNumber.length > 20) {
      showToast("Pass number must be maximum 20 characters", "error");
      return;
    }
    if (formDateOfJoin) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (new Date(formDateOfJoin) > today) {
        showToast("Date of join cannot be a future date", "error");
        return;
      }
    }

    try {
      if (editingUser) {
        const payload: any = {
          id: editingUser.id,
          username: formUsername,
          role: formRole,
          status: formStatus,
          firstName: formFirstName,
          lastName: formLastName,
          dob: formDob,
          mobile: formMobile,
          bloodGroup: formBloodGroup,
          address: formAddress,
          dateOfJoin: formDateOfJoin,
          department: formDepartment,
          replacementFor: formReplacementFor || null,
          passNumber: formPassNumber ? formPassNumber.trim() : "",
          isMonitorUser: formIsMonitorUser,
        };
        if (formPassword) {
          payload.password = formPassword;
        }
        await dispatch(updateUser({ payload, showToast })).unwrap();
      } else {
        await dispatch(
          createUser({
            payload: {
              username: formUsername,
              password: formPassword,
              role: formRole,
              status: formStatus,
              firstName: formFirstName,
              lastName: formLastName,
              dob: formDob,
              mobile: formMobile,
              bloodGroup: formBloodGroup,
              address: formAddress,
              dateOfJoin: formDateOfJoin,
              department: formDepartment,
              replacementFor: formReplacementFor || null,
              passNumber: formPassNumber ? formPassNumber.trim() : "",
              isMonitorUser: formIsMonitorUser,
            },
            showToast,
          }),
        ).unwrap();
      }
      handleCloseModal();
      loadData();
    } catch (err: any) {
      // Toast shown in thunk
    }
  };

  const { confirm } = useConfirm();

  const handleDelete = async (id: string) => {
    if (await confirm("Are you sure you want to delete this user?", "Delete User")) {
      try {
        await dispatch(deleteUser({ id, showToast })).unwrap();
        if (adminUsers.length === 1 && page > 0) {
          setPage(page - 1);
        } else {
          loadData();
        }
      } catch (err: any) {
        // Toast shown in thunk
      }
    }
  };

  const handleRequestSort = (property: keyof UserData) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };



  const columns: Column<UserData>[] = [
    { id: "username", label: "Username", sortable: true },
    {
      id: "fullName",
      label: "Full Name",
      sortable: false,
      render: (row) => {
        const name = `${row.firstName || ''} ${row.lastName || ''}`.trim() || '-';
        const isActivated = row.activated !== false;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span>{name}</span>
            {!isActivated && (
              <Tooltip title="Not Activated" arrow>
                <span>
                  <MdWarning style={{ color: '#f44336', fontSize: '18px', verticalAlign: 'middle', flexShrink: 0 }} />
                </span>
              </Tooltip>
            )}
          </Box>
        );
      }
    },
    { id: "passNumber", label: "Pass Number", sortable: true, render: (row) => row.passNumber || '-' },
    {
      id: "department",
      label: "Department",
      sortable: true,
      render: (row) => {
        if (!row.department) return '-';
        const dept = availableDepartments.find((d: any) => d.id === row.department || d._id === row.department || d.name === row.department);
        return dept ? dept.name : row.department;
      }
    },
    {
      id: "role",
      label: "Role",
      sortable: true,
      render: (row) => {
        if (!row.role) return '-';
        const roleIds = Array.isArray(row.role) ? row.role : [row.role];
        const names = roleIds.map(rid => {
          const r = availableRoles.find((ar: any) => ar.id === rid || ar._id === rid || ar.name === rid);
          return r ? r.name : rid;
        });
        return names.join(", ");
      }
    },
    {
      id: "onlineStatus",
      label: "Activity",
      sortable: false,
      render: (row) => {
        const online = isUserOnline(row);
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: online ? "#4caf50" : "#f44336",
                display: "inline-block",
                boxShadow: online ? "0 0 8px #4caf50" : "none",
              }}
            />
            <span style={{ fontSize: "0.85rem", color: online ? "#2e7d32" : "#757575", fontWeight: 500 }}>
              {online ? "Online" : "Offline"}
            </span>
          </Box>
        );
      }
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      render: (row) => (
        <label
          style={{
            color: row.status ? "#2e7d32" : "#d32f2f",
            fontWeight: "bold",
            fontSize: "0.875rem",
          }}
        >
          {row.status ? "Active" : "Inactive"}
        </label>
      ),
    },
  ];

  if (hasPrivilege(PRIVILEGES.USER_UPDATE) || hasPrivilege(PRIVILEGES.USER_DELETE)) {
    columns.push({
      id: "actions",
      label: "Actions",
      align: "right",
      render: (row) => (
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
          {hasPrivilege(PRIVILEGES.USER_UPDATE) && (
            <Tooltip title="Edit User">
              <IconButton
                size="small"
                color="primary"
                sx={{ backgroundColor: "rgba(25, 118, 210, 0.04)" }}
                onClick={(e) => { e.stopPropagation(); handleOpenModal(row, true); }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {hasPrivilege(PRIVILEGES.USER_DELETE) && (
            <Tooltip title="Delete User">
              <IconButton
                size="small"
                color="error"
                sx={{ backgroundColor: "rgba(211, 47, 47, 0.04)" }}
                onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    });
  }

  return (
    <Box className={styles.users} sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <label style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Users</label>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search users..."
          />
          {hasPrivilege(PRIVILEGES.USER_VIEW_ALL) && (
            <FormControl size="small" sx={{ minWidth: 160, bgcolor: '#fff' }}>
              <InputLabel>Department</InputLabel>
              <Select
                value={selectedDepartment}
                label="Department"
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                <MenuItem value="All Departments">All Departments</MenuItem>
                {availableDepartments.map((dept: any) => (
                  <MenuItem key={dept.id || dept._id || dept.name} value={dept.id || dept._id}>
                    {dept.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <FormControl size="small" sx={{ minWidth: 160, bgcolor: '#fff' }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={selectedRole}
              label="Role"
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <MenuItem value="All Roles">All Roles</MenuItem>
              {availableRoles.map((role: any) => (
                <MenuItem key={role.id || role._id || role.name} value={role.id || role._id}>
                  {role.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160, bgcolor: '#fff' }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={selectedStatus}
              label="Status"
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="all">All</MenuItem>
            </Select>
          </FormControl>
          {hasPrivilege(PRIVILEGES.USER_CREATE) && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => handleOpenModal(undefined, true)}
            >
              Create User
            </Button>
          )}
        </Box>
      </Box>

      <Paper
        sx={{
          width: "100%",
          mb: 2,
          p: 0,
          boxShadow: "none",
          background: "transparent",
        }}
      >
        {/* Table */}
        <Table
          columns={columns}
          data={adminUsers || []}
          orderBy={orderBy as string}
          order={order}
          onRequestSort={(prop) => handleRequestSort(prop as keyof UserData)}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          totalCount={totalCount || 0}
          onRowClick={(hasPrivilege(PRIVILEGES.USER_VIEW_ALL) || hasPrivilege(PRIVILEGES.USER_VIEW_DEPT) || hasPrivilege(PRIVILEGES.USER_UPDATE)) ? (row) => handleOpenModal(row, false) : undefined}
        />
      </Paper>
      <UserFormModal
        isModalOpen={isModalOpen}
        handleCloseModal={handleCloseModal}
        editingUser={editingUser}
        isEditMode={isEditMode}
        setIsEditMode={setIsEditMode}
        hasUpdatePrivilege={hasPrivilege(PRIVILEGES.USER_UPDATE)}
        setFormUsername={setFormUsername}
        formUsername={formUsername}
        formPassword={formPassword}
        setFormPassword={setFormPassword}
        setFormRole={setFormRole}
        formRole={formRole}
        setFormStatus={setFormStatus}
        formStatus={formStatus}
        availableRoles={availableRoles}
        handleSubmit={handleSubmit}
        formFirstName={formFirstName}
        setFormFirstName={setFormFirstName}
        formLastName={formLastName}
        setFormLastName={setFormLastName}
        formDob={formDob}
        setFormDob={setFormDob}
        formMobile={formMobile}
        setFormMobile={setFormMobile}
        formBloodGroup={formBloodGroup}
        setFormBloodGroup={setFormBloodGroup}
        formAddress={formAddress}
        setFormAddress={setFormAddress}
        formDateOfJoin={formDateOfJoin}
        setFormDateOfJoin={setFormDateOfJoin}
        formDepartment={formDepartment}
        setFormDepartment={setFormDepartment}

        availableDepartments={availableDepartments}
        formReplacementFor={formReplacementFor}
        setFormReplacementFor={setFormReplacementFor}
        inactiveUsers={inactiveUsers}
        onViewReplacedUser={handleViewReplacedUser}
        formPassNumber={formPassNumber}
        setFormPassNumber={setFormPassNumber}
        formIsMonitorUser={formIsMonitorUser}
        setFormIsMonitorUser={setFormIsMonitorUser}
      />
    </Box>
  );
};

export default Users;
