// @ts-nocheck
import React, { useState, useEffect } from "react";
import Modal from "../../../components/Modal";
import TextField from "../../../components/TextField";
import {
  Button,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  InputLabel,
  FormControl,
  Box,
  IconButton,
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
import request, { API_BASE_URL } from "../../../services/request";
import type { WorkData } from "../model";
import { hasPrivilege } from "../../../helpers/authUtils";
import { PRIVILEGES } from "../../../helpers/privileges";
import { useConfirm } from "../../../contexts/ConfirmContext";
import { getServerTime } from "../../../helpers/time";
import { ROUTE_CONSTANTS } from "../../../router/constant";
import styles from "./index.module.scss";

interface PropType {
  isOpen: boolean;
  onClose: () => void;
  work: WorkData | null;
  users: any[];
  onUpdate: (payload: any, silent?: boolean) => Promise<void>;
  onTransfer: (id: string, newAssigneeId: string, reason: string) => Promise<void>;
}


const WorkDetailModal = ({
  isOpen,
  onClose,
  work,
  users,
  onUpdate,
  onTransfer,
}: PropType) => {
  const [newComment, setNewComment] = useState("");
  const [currentStatus, setCurrentStatus] = useState("Pending");
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferAssignee, setTransferAssignee] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showCommentHashMenu, setShowCommentHashMenu] = useState(false);
  const [commentHashSearch, setCommentHashSearch] = useState("");
  const [allObservations, setAllObservations] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      setShowCommentHashMenu(false);
      request.get("/api/observations/?pagination=false")
        .then((res) => {
          if (res.data?.data) {
            setAllObservations(res.data.data);
          } else if (Array.isArray(res.data)) {
            setAllObservations(res.data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const commentObsSuggestions = React.useMemo(() => {
    if (!commentHashSearch) return allObservations.slice(0, 10);
    const query = commentHashSearch.toLowerCase();
    return allObservations.filter((obs: any) => 
      (obs.observationId && obs.observationId.toLowerCase().includes(query)) ||
      (obs.description && obs.description.toLowerCase().includes(query)) ||
      (obs.category && obs.category.toLowerCase().includes(query))
    ).slice(0, 10);
  }, [allObservations, commentHashSearch]);
  const openMenu = Boolean(anchorEl);
  const currentUser =
    useSelector(
      (state: RootState) =>
        (state?.auth as any)?.user?.username || state?.auth?.username,
    ) || "User";

  const isSuperuser = useSelector(
    (state: RootState) => !!(state?.auth as any)?.user?.isSuperuser || !!state?.auth?.isSuperuser
  );

  const departments = useSelector((state: RootState) => state?.departments?.departments || []);
  const { confirm } = useConfirm();

  const isDeptHeadOfWork = React.useMemo(() => {
    if (!work || !currentUser || !departments || departments.length === 0) return false;
    const headDepts = departments.filter((d: any) => d.departmentHead === currentUser).map((d: any) => d.name);
    if (headDepts.length === 0) return false;

    if (work.createdBy) {
      const creatorUser = users.find((u: any) => u.username === work.createdBy);
      if (creatorUser && headDepts.includes(creatorUser.department)) {
        return true;
      }
    }

    const workAssignees = work.assignees || (work.assignee ? [work.assignee] : []);
    for (const assigneeId of workAssignees) {
      const assigneeUser = users.find((u: any) => u.username === assigneeId || u.id === assigneeId || u._id === assigneeId);
      if (assigneeUser && headDepts.includes(assigneeUser.department)) {
        return true;
      }
    }

    return false;
  }, [work, currentUser, departments, users]);

  const isEmergency = !!work?.isEmergency;
  const canUpdateWork = isEmergency 
    ? (hasPrivilege(PRIVILEGES.WORK_UPDATE) || hasPrivilege(PRIVILEGES.EMERGENCY_WORK_UPDATE) || isDeptHeadOfWork)
    : hasPrivilege(PRIVILEGES.WORK_UPDATE);
  const isCompletedOrClosed = currentStatus === "Completed" || currentStatus === "Closed";
  const isLocked = isCompletedOrClosed && !isSuperuser;
  
  const workAssignees = work?.assignees || (work?.assignee ? [work.assignee] : []);
  const assigneeUsers = users.filter(
    (u: any) => workAssignees.includes(u.id) || workAssignees.includes(u._id) || workAssignees.includes(u.username)
  );
  
  const isAssignee = assigneeUsers.some((u) => u.username === currentUser);
  const hasStatusUpdate = canUpdateWork || 
    (hasPrivilege(PRIVILEGES.WORK_VIEW_ASSIGNED) && isAssignee) ||
    (isEmergency && hasPrivilege(PRIVILEGES.EMERGENCY_WORK_VIEW) && isAssignee);
  const canUpdateStatus = hasStatusUpdate && !isLocked;

  const availableStatusOptions = [
    { label: "Pending", value: "Pending" },
    { label: "In Progress", value: "In Progress" },
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

  const canTransfer = (isAssignee || canUpdateWork) && currentStatus !== "Completed" && currentStatus !== "Closed";

  const handleApprove = async () => {
    if (!work) return;
    try {
      const userObj = users.find((u: any) => u.username === currentUser);
      const fullName = userObj ? `${userObj.firstName || ''} ${userObj.lastName || ''}`.trim() || currentUser : currentUser;
      const commentPayload = {
        text: `This emergency work ticket was approved by ${fullName}.`,
        user: "System",
        timestamp: new Date().toISOString()
      };
      await onUpdate({
        id: work.id || work._id,
        approved: true,
        comments: [...(work.comments || []), commentPayload]
      });
    } catch (err) {
      // Handled
    }
  };

  const handleConfirmTransfer = async () => {
    if (!work || !transferAssignee || !transferReason.trim()) return;
    try {
      await onTransfer(work.id || work._id!, transferAssignee, transferReason.trim());
      setIsTransferring(false);
    } catch (err) {
      // Handled in parent/toast
    }
  };

  const formatCreatedTime = (w: WorkData) => {
    if (w.createdAt) {
      try {
        return new Date(w.createdAt).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch (e) {
        return w.createdAt;
      }
    }
    const idStr = w.id || w._id;
    if (idStr && idStr.length === 24) {
      try {
        const timestamp = parseInt(idStr.substring(0, 8), 16) * 1000;
        return new Date(timestamp).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch (e) {
        // ignore
      }
    }
    return "Unknown";
  };

  const isUserOnline = (user: any) => {
    if (!user.lastActive) return false;
    try {
      const lastActiveTime = new Date(user.lastActive).getTime();
      const now = getServerTime().toDate().getTime();
      return now - lastActiveTime < 45000;
    } catch (e) {
      return false;
    }
  };

  if (!work) return null;

  const assigneeNames = assigneeUsers.map(
    (u) => `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || u.name
  );
  
  let fallbackName = "Unassigned";
  if (assigneeNames.length > 0) {
    fallbackName = assigneeNames.join(", ");
  } else if (workAssignees.length > 0) {
    // If it's a 24-char hex string (ObjectId), say User Removed. Otherwise it might be a username.
    fallbackName = workAssignees.map(a => (a && a.length !== 24) ? a : "User Removed").join(", ");
  }
  
  const assigneeName = work.assigneesFullName || fallbackName;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "#2e7d32";
      case "On Hold":
        return "#ed6c02";
      case "In Progress":
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
      await confirm(
        `Are you sure you want to change the status to "${newVal}"?`,
        "Change Status"
      )
    ) {
      try {
        const payload: any = {
          id: work.id || work._id,
          status: newVal,
        };
        if (newVal === "Completed" || newVal === "Closed") {
          payload.completedAt = getServerTime().toDate().toISOString().split("T")[0];
        } else {
          payload.completedAt = "";
        }
        await onUpdate(payload);
        setCurrentStatus(newVal);
      } catch (err) {
        // Error handled in parent
      }
    }
  };

  const handleDownloadAttachment = async (url: string, filename: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      const response = await fetch(`${API_BASE_URL}${url}`);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(`${API_BASE_URL}${url}`, "_blank");
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
    if ((!newComment.trim() && !commentFile) || isLocked || isUploading) return;

    setIsUploading(true);
    let uploadedFileDetails = null;

    if (commentFile) {
      const fd = new FormData();
      fd.append('files', commentFile);
      try {
        const res = await request.post('/api/works/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.data && res.data.length > 0) {
          uploadedFileDetails = res.data[0];
        }
      } catch (err) {
        console.error("Upload failed", err);
        setIsUploading(false);
        return;
      }
    }

    const newCommentObj: any = {
      text: newComment.trim(),
      user: currentUser,
      timestamp: getServerTime().toDate().toISOString(),
    };

    if (uploadedFileDetails) {
      newCommentObj.attachment = uploadedFileDetails;
    }

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
      setCommentFile(null);
    } catch (err) {
      // Error handled in parent
    } finally {
      setIsUploading(false);
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
            {work.isEmergency && (
              <Chip
                label={work.approved ? "Emergency Work (Approved)" : "Emergency Work (Pending Approval)"}
                color={work.approved ? "success" : "error"}
                sx={{ borderRadius: "8px", fontWeight: "bold" }}
              />
            )}
            <Chip
              icon={<MdPerson />}
              label={`Assignee: ${assigneeName}`}
              variant="outlined"
              sx={{ borderRadius: "8px", fontWeight: 500 }}
            />
            {canTransfer && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setTransferAssignee("");
                  setTransferReason("");
                  setIsTransferring(true);
                }}
                sx={{
                  borderRadius: "8px",
                  textTransform: "none",
                  fontWeight: "bold",
                  borderColor: "#1976d2",
                  color: "#1976d2",
                  px: 2,
                  height: 32,
                  fontSize: "0.85rem",
                  "&:hover": {
                    backgroundColor: "rgba(25, 118, 210, 0.04)"
                  }
                }}
              >
                Transfer Work
              </Button>
            )}
            {work.isEmergency && !work.approved && (isSuperuser || hasPrivilege(PRIVILEGES.WORK_UPDATE) || hasPrivilege(PRIVILEGES.EMERGENCY_WORK_APPROVE)) && (
              <Button
                variant="contained"
                size="small"
                color="success"
                onClick={handleApprove}
                sx={{
                  borderRadius: "8px",
                  textTransform: "none",
                  fontWeight: "bold",
                  px: 2,
                  height: 32,
                  fontSize: "0.85rem",
                  backgroundColor: "#2e7d32",
                  "&:hover": {
                    backgroundColor: "#1b5e20"
                  }
                }}
              >
                Approve Emergency Work
              </Button>
            )}
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
              label={`Created: ${formatCreatedTime(work)}`}
              variant="outlined"
              sx={{ borderRadius: "8px", fontWeight: 500 }}
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
              {(() => {
                const text = work.description || "";
                const regex = /(#(?:OBS-\d{4}-\d{4}|[a-fA-F0-9]{24}))/g;
                const parts = text.split(regex);
                return parts.map((part, i) => {
                  if (part.match(regex)) {
                    const obsId = part.substring(1);
                    return (
                      <Chip
                        key={i}
                        label={part}
                        size="small"
                        color="secondary"
                        onClick={() => {
                          onClose();
                          window.location.href = `${ROUTE_CONSTANTS.OBSERVATIONS}?obsId=${encodeURIComponent(obsId)}`;
                        }}
                        sx={{
                          mx: 0.5,
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          height: '22px'
                        }}
                      />
                    );
                  }
                  return part;
                });
              })()}
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
                          handleDownloadAttachment(url, filename)
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
              [...work.comments].reverse().map((comment, index) => {
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
                          {(() => {
                            const uObj = users.find((u: any) => u.username === comment.user);
                            if (uObj) {
                              const fullName = `${uObj.firstName || ""} ${uObj.lastName || ""}`.trim();
                              return fullName || comment.user;
                            }
                            return comment.user;
                          })()}
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
                      <div className={styles.commentText} style={{ whiteSpace: 'pre-wrap' }}>
                        {(() => {
                          const text = comment.text || "";
                          const regex = /(#(?:OBS-\d{4}-\d{4}|[a-fA-F0-9]{24}))/g;
                          const parts = text.split(regex);
                          return parts.map((part, i) => {
                            if (part.match(regex)) {
                              const obsId = part.substring(1);
                              return (
                                <Chip
                                  key={i}
                                  label={part}
                                  size="small"
                                  color="secondary"
                                  onClick={() => {
                                    onClose();
                                    window.location.href = `${ROUTE_CONSTANTS.OBSERVATIONS}?obsId=${encodeURIComponent(obsId)}`;
                                  }}
                                  sx={{
                                    mx: 0.5,
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    height: '20px'
                                  }}
                                />
                              );
                            }
                            return part;
                          });
                        })()}
                      </div>
                      {comment.attachment && (
                        <Chip
                          icon={<MdAttachFile />}
                          label={comment.attachment.name || "Attachment"}
                          size="small"
                          onClick={() => handleDownloadAttachment(comment.attachment?.url, comment.attachment.name || "Attachment")}
                          sx={{ mt: 1, backgroundColor: 'rgba(0,0,0,0.05)', cursor: 'pointer' }}
                        />
                      )}
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
        <div style={{ display: 'flex', flexDirection: 'column', padding: '12px 16px', borderTop: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
          {commentFile && (
            <Box sx={{ mb: 1, display: 'flex' }}>
              <Chip 
                label={commentFile.name} 
                onDelete={() => setCommentFile(null)} 
                size="small" 
                color="primary" 
                variant="outlined" 
              />
            </Box>
          )}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <IconButton
              component="label"
              disabled={isLocked || isUploading}
              sx={{ minWidth: '40px', width: '40px', height: '40px', borderRadius: '50%', color: '#637381' }}
            >
              <MdAttachFile size={20} />
              <input
                type="file"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setCommentFile(e.target.files[0]);
                  }
                  e.target.value = '';
                }}
              />
            </IconButton>
            <div style={{ flex: 1, position: 'relative' }}>
              <TextField
                fullWidth
                size="small"
                multiline
                maxRows={4}
                placeholder={isLocked ? "Comments are disabled for completed works" : "Add a comment (type # to tag observation)..."}
                value={newComment}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewComment(val);
                  const match = val.match(/#([a-zA-Z0-9-]*)$/);
                  if (match) {
                    setCommentHashSearch(match[1]);
                    setShowCommentHashMenu(true);
                  } else {
                    setShowCommentHashMenu(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isLocked && !showCommentHashMenu) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                disabled={isLocked || isUploading}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
              />
              {showCommentHashMenu && (
                <Paper
                  elevation={4}
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1300,
                    maxHeight: 180,
                    overflowY: 'auto',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    marginBottom: '4px',
                    backgroundColor: '#ffffff'
                  }}
                >
                  {commentObsSuggestions.length > 0 ? (
                    commentObsSuggestions.map((obs: any) => (
                      <Box
                        key={obs._id || obs.id}
                        onClick={() => {
                          const updated = newComment.replace(/#([a-zA-Z0-9-]*)$/, `#${obs.observationId || obs._id} `);
                          setNewComment(updated);
                          setShowCommentHashMenu(false);
                        }}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          '&:hover': { backgroundColor: '#f1f5f9' }
                        }}
                      >
                        <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#1976d2' }}>
                          #{obs.observationId || obs._id} ({obs.category})
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                          {obs.description}
                        </span>
                      </Box>
                    ))
                  ) : (
                    <div style={{ padding: '8px 12px', fontSize: '0.85rem', color: '#94a3b8' }}>
                      No matching observations found
                    </div>
                  )}
                </Paper>
              )}
            </div>
            <Button
              variant="contained"
              color="primary"
              onClick={handleAddComment}
              disabled={(!newComment.trim() && !commentFile) || isLocked || isUploading}
              sx={{ height: 40, minWidth: 40, p: 0, borderRadius: '50%' }}
            >
              <MdSend size={20} />
            </Button>
          </div>
        </div>
      </div>
      <Dialog 
        open={isTransferring} 
        onClose={() => setIsTransferring(false)}
        slotProps={{
          paper: {
            sx: { borderRadius: "12px", p: 1, minWidth: "400px" }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: "bold", color: "#333" }}>Transfer Work Assignment</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>New Assignee</InputLabel>
              <Select
                value={transferAssignee}
                label="New Assignee"
                onChange={(e) => setTransferAssignee(e.target.value)}
                sx={{ borderRadius: "8px" }}
              >
                {(users || [])
                  .filter((u) => u.username !== currentUser)
                  .map((u) => {
                    const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || u.name;
                    const online = isUserOnline(u);
                    return (
                      <MenuItem key={u.id || u._id} value={u.id || u._id}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            backgroundColor: online ? "#4caf50" : "#f44336",
                            marginRight: 8,
                            display: "inline-block",
                            boxShadow: online ? "0 0 6px #4caf50" : "none",
                          }}
                        />
                        {name} ({u.username})
                      </MenuItem>
                    );
                  })
                }
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Reason for Transfer"
              multiline
              rows={3}
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="Provide reason for transfer..."
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="text" onClick={() => setIsTransferring(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={handleConfirmTransfer}
            disabled={!transferAssignee || !transferReason.trim()}
          >
            Transfer
          </Button>
        </DialogActions>
      </Dialog>
    </Modal>
  );
};

export default WorkDetailModal;
