import React, { useState, useEffect, useRef } from "react";
import Modal from "../../../components/Modal";
import TextField from "../../../components/TextField";
import {
  Button,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Chip,
} from "@mui/material";
import {
  MdSend,
  MdExpandMore,
  MdPerson,
  MdDateRange,
  MdFlag,
  MdAttachFile,
} from "react-icons/md";
import { useSelector } from "react-redux";
import type { RootState } from "../../../store";
import { API_BASE_URL } from "../../../services/request";
import type { WorkData } from "../model";
import { hasPrivilege } from "../../../helpers/authUtils";
import styles from "./index.module.scss";

interface PropType {
  isOpen: boolean;
  onClose: () => void;
  work: WorkData | null;
  users: any[];
  onUpdate: (payload: any, silent?: boolean) => Promise<void>;
}


const WorkDetailModal = ({
  isOpen,
  onClose,
  work,
  users,
  onUpdate,
}: PropType) => {
  const [newComment, setNewComment] = useState("");
  const [currentStatus, setCurrentStatus] = useState("Pending");
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);
  const currentUser =
    useSelector(
      (state: RootState) =>
        (state?.auth as any)?.user?.username || state?.auth?.username,
    ) || "User";

  const canUpdateWork = hasPrivilege("Update Work");
  const isLocked = currentStatus === "Completed" && !canUpdateWork;
  const canUpdateStatus = hasPrivilege("Work Status Update") && !isLocked;

  const availableStatusOptions = [
    { label: "Pending", value: "Pending" },
    { label: "On Hold", value: "On Hold" },
    { label: "Completed", value: "Completed" },
  ];

  if ((currentStatus === "Completed" || currentStatus === "Closed") && canUpdateWork) {
    availableStatusOptions.push({ label: "Closed", value: "Closed" });
  }

  useEffect(() => {
    if (work) {
      setCurrentStatus(work.status || "Pending");
    }
  }, [work]);

  if (!work) return null;

  const assigneeUser = users.find(
    (u: any) => u.id === work.assignee || u._id === work.assignee,
  );
  const assigneeName = assigneeUser
    ? assigneeUser.username || assigneeUser.name
    : work.assignee
      ? work.assignee
      : "Unassigned";

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "#2e7d32";
      case "On Hold":
        return "#ed6c02";
      case "Assigned":
        return "#1976d2";
      case "Closed":
        return "#424242"; // Dark gray
      default:
        return "#757575"; // Pending
    }
  };

  const handleStatusChange = async (newVal: string) => {
    if (!canUpdateStatus) return;
    if (newVal === currentStatus) return;

    if (
      window.confirm(
        `Are you sure you want to change the status to "${newVal}"?`,
      )
    ) {
      try {
        await onUpdate({
          id: work.id || work._id,
          status: newVal,
        });
        setCurrentStatus(newVal);
      } catch (err) {
        // Error handled in parent
      }
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleStatusSelect = (newVal: string) => {
    handleMenuClose();
    handleStatusChange(newVal);
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    const newCommentObj = {
      text: newComment.trim(),
      user: currentUser,
      timestamp: new Date().toISOString(),
    };

    const updatedComments = [...(work.comments || []), newCommentObj];
    try {
      await onUpdate(
        {
          id: work.id || work._id,
          comments: updatedComments,
        },
        true,
      );
      setNewComment("");
    } catch (err) {
      // Error handled in parent
    }
  };

  return (
    <Modal
      open={isOpen}
      handleClose={onClose}
      title={`Work Ticket: ${work.workName}`}
    >
      <div className={styles.flexContainer}>
        <div className={styles.scrollableArea}>
          {/* Top Metadata Row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <Chip
              icon={<MdPerson />}
              label={`Assignee: ${assigneeName}`}
              variant="outlined"
              sx={{ borderRadius: "8px", fontWeight: 500 }}
            />
            <Chip
              icon={<MdFlag />}
              label={`Priority: ${work.priority}`}
              variant="outlined"
              sx={{
                borderRadius: "8px",
                fontWeight: 500,
                borderColor:
                  work.priority === "High"
                    ? "#d32f2f"
                    : work.priority === "Medium"
                      ? "#ed6c02"
                      : "#2e7d32",
                color:
                  work.priority === "High"
                    ? "#d32f2f"
                    : work.priority === "Medium"
                      ? "#ed6c02"
                      : "#2e7d32",
                "& .MuiChip-icon": { color: "inherit" },
              }}
            />
            <Chip
              icon={<MdDateRange />}
              label={`Due: ${work.dueDate || "No Date"}`}
              variant="outlined"
              sx={{ borderRadius: "8px", fontWeight: 500 }}
            />

            <div style={{ flex: 1, minWidth: "20px" }}></div>

            {/* Status Button Menu */}
            <div>
              <Button
                variant="outlined"
                onClick={(e) => canUpdateStatus && handleMenuClick(e)}
                endIcon={canUpdateStatus ? <MdExpandMore /> : null}
                sx={{
                  color: getStatusColor(currentStatus),
                  borderColor: getStatusColor(currentStatus),
                  fontWeight: "bold",
                  textTransform: "none",
                  borderRadius: "8px",
                  borderWidth: "2px",
                  opacity: canUpdateStatus ? 1 : 0.8,
                  pointerEvents: canUpdateStatus ? "auto" : "none",
                  "&:hover": {
                    borderWidth: "2px",
                    backgroundColor: `${getStatusColor(currentStatus)}10`,
                  },
                }}
              >
                Status: {currentStatus}
              </Button>
              <Menu
                anchorEl={anchorEl}
                open={openMenu}
                onClose={handleMenuClose}
                slotProps={{
                  paper: {
                    sx: {
                      borderRadius: "14px",
                      minWidth: 180,
                      mt: 1,
                      overflow: "hidden",
                      border: "1px solid #e5e7eb",
                      boxShadow: `
          0 10px 25px rgba(0,0,0,0.08),
          0 2px 10px rgba(0,0,0,0.04)
        `,

                      "& .MuiMenuItem-root": {
                        padding: "12px 16px",
                        fontSize: "0.95rem",
                        borderRadius: "8px",
                        margin: "4px 8px",
                        transition: "all 0.2s ease",

                        "&:hover": {
                          backgroundColor: "#f3f4f6",
                        },
                      },
                    },
                  },
                }}
              >
                {availableStatusOptions.map((option) => (
                  <MenuItem
                    key={option.value}
                    onClick={() => handleStatusSelect(option.value)}
                    selected={option.value === currentStatus}
                  >
                    <span
                      style={{
                        color: getStatusColor(option.value),
                        fontWeight: 500,
                      }}
                    >
                      {option.label}
                    </span>
                  </MenuItem>
                ))}
              </Menu>
            </div>
          </div>

          {/* Description Block */}
          <div
            style={{
              backgroundColor: "#f8f9fb",
              padding: "1rem",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              marginBottom: "0.5rem",
            }}
          >
            <label
              style={{
                display: "block",
                fontWeight: 600,
                color: "#637381",
                marginBottom: "0.5rem",
                fontSize: "0.85rem",
              }}
            >
              DESCRIPTION
            </label>
            <div
              style={{
                color: "#212b36",
                fontSize: "0.95rem",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                marginBottom:
                  work.attachments && work.attachments.length > 0 ? "1rem" : 0,
              }}
            >
              {work.description}
            </div>

            {work.attachments && work.attachments.length > 0 && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    color: "#637381",
                    marginBottom: "0.5rem",
                    fontSize: "0.85rem",
                  }}
                >
                  ATTACHMENTS
                </label>
                <div
                  style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
                >
                  {work.attachments.map((file: any, idx: number) => {
                    const filename = file.name || file;
                    const url = file.url || `/${filename}`;
                    return (
                      <Chip
                        key={idx}
                        icon={<MdAttachFile />}
                        label={filename}
                        size="small"
                        variant="outlined"
                        onClick={() =>
                          window.open(`${API_BASE_URL}${url}`, "_blank")
                        }
                        sx={{
                          borderRadius: "6px",
                          backgroundColor: "#fff",
                          borderColor: "#e0e4e8",
                          cursor: "pointer",
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div className={styles.sectionTitle} style={{ marginTop: "0.5rem" }}>
            Comments
          </div>

          <div className={styles.commentsList}>
            {work.comments && work.comments.length > 0 ? (
              work.comments.map((comment, index) => {
                const avatarLetter = (comment.user || "?")[0].toUpperCase();
                return (
                  <div key={index} className={styles.commentRow}>
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: "#1976d2",
                        fontSize: "1rem",
                        mt: 0.5,
                      }}
                    >
                      {avatarLetter}
                    </Avatar>
                    <div className={styles.commentBubble}>
                      <div className={styles.commentHeader}>
                        <span className={styles.commentUser}>
                          {comment.user}
                        </span>
                        <span className={styles.commentTime}>
                          {new Date(comment.timestamp).toLocaleString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                      </div>
                      <div className={styles.commentText}>{comment.text}</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={styles.noComments}>No comments yet.</div>
            )}
          </div>
        </div>

        {/* Fixed Chat Input at the bottom */}
        <div className={styles.fixedChatOption}>
          <TextField
            fullWidth
            size="small"
            placeholder={isLocked ? "Comments are disabled for completed works" : "Add a comment..."}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !isLocked) handleAddComment();
            }}
            disabled={isLocked}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleAddComment}
            disabled={!newComment.trim() || isLocked}
            sx={{ height: 40, minWidth: 40, p: 0 }}
          >
            <MdSend size={20} />
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default WorkDetailModal;
