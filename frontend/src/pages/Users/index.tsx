import React, { useState, useMemo, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box, Paper, Tooltip, IconButton } from "@mui/material";
import {
  MdAdd as AddIcon,
  MdEdit as EditIcon,
  MdDelete as DeleteIcon,
} from "react-icons/md";
import Button from "../../components/Button";
import SearchBar from "../../components/SearchBar";
import Table, { type Column } from "../../components/Table";
import { useToast } from "../../contexts/ToastContext";
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
import styles from "./index.module.scss";

type Order = "asc" | "desc";

const Users: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    users,
    availableRoles,
    availableDepartments,
    totalCount,
    loading,
    error,
  } = useSelector((state: RootState) => state.users);
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [order, setOrder] = useState<Order>("asc");
  const [orderBy, setOrderBy] = useState<keyof UserData>("username");

  // Modal and Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formStatus, setFormStatus] = useState(true);
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formDob, setFormDob] = useState("");
  const [formMobile, setFormMobile] = useState("");
  const [formBloodGroup, setFormBloodGroup] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formDateOfJoin, setFormDateOfJoin] = useState("");
  const [formDepartment, setFormDepartment] = useState("");

  useEffect(() => {
    dispatch(fetchAllRolesForDropdown());
    dispatch(fetchAllDepartmentsForDropdown());
  }, [dispatch]);

  useEffect(() => {
    dispatch(
      fetchUsers({
        skip: page * rowsPerPage,
        limit: rowsPerPage,
        sortBy: orderBy as string,
        order,
        search: searchQuery,
        showToast,
      }),
    );
  }, [dispatch, showToast, page, rowsPerPage, orderBy, order, searchQuery]);

  const handleOpenModal = (user?: UserData) => {
    if (user) {
      setEditingUser(user);
      setFormUsername(user.username);
      setFormPassword("");
      setFormRole(user.role);
      setFormStatus(user.status);
      setFormFirstName(user.firstName || "");
      setFormLastName(user.lastName || "");
      setFormDob(user.dob || "");
      setFormMobile(user.mobile || "");
      setFormBloodGroup(user.bloodGroup || "");
      setFormAddress(user.address || "");
      setFormDateOfJoin(user.dateOfJoin || "");
      setFormDepartment(user.department || "");
    } else {
      setEditingUser(null);
      setFormUsername("");
      setFormPassword("");
      setFormRole("");
      setFormStatus(true);
      setFormFirstName("");
      setFormLastName("");
      setFormDob("");
      setFormMobile("");
      setFormBloodGroup("");
      setFormAddress("");
      setFormDateOfJoin("");
      setFormDepartment("");
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
            },
            showToast,
          }),
        ).unwrap();
      }
      handleCloseModal();
    } catch (err: any) {
      // Toast shown in thunk
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        await dispatch(deleteUser({ id, showToast })).unwrap();
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
      render: (row) => `${row.firstName || ''} ${row.lastName || ''}`.trim() || '-'
    },
    { id: "department", label: "Department", sortable: true, render: (row) => row.department || '-' },
    { id: "role", label: "Role", sortable: true },
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

  if (hasPrivilege("Update User") || hasPrivilege("Delete User")) {
    columns.push({
      id: "actions",
      label: "Actions",
      align: "right",
      render: (row) => (
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
          {hasPrivilege("Update User") && (
            <Tooltip title="Edit User">
              <IconButton
                size="small"
                color="primary"
                sx={{ backgroundColor: "rgba(25, 118, 210, 0.04)" }}
                onClick={() => handleOpenModal(row)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {hasPrivilege("Delete User") && (
            <Tooltip title="Delete User">
              <IconButton
                size="small"
                color="error"
                sx={{ backgroundColor: "rgba(211, 47, 47, 0.04)" }}
                onClick={() => handleDelete(row.id)}
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
          {hasPrivilege("Create User") && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => handleOpenModal()}
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
          data={users || []}
          orderBy={orderBy as string}
          order={order}
          onRequestSort={(prop) => handleRequestSort(prop as keyof UserData)}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          totalCount={totalCount || 0}
        />
      </Paper>
      <UserFormModal
        isModalOpen={isModalOpen}
        handleCloseModal={handleCloseModal}
        editingUser={editingUser}
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
      />
    </Box>
  );
};

export default Users;
