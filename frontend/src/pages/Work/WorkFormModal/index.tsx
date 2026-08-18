// @ts-nocheck
import React from "react";
import Modal from "../../../components/Modal";
import TextField from "../../../components/TextField";
import DatePicker from "../../../components/DatePicker";
import Dropdown from "../../../components/Dropdown";
import { Button, IconButton, FormControlLabel, Checkbox } from "@mui/material";
import { MdClose } from "react-icons/md";
import { PRIORITY_OPTIONS } from "../constant";
import { getServerTime } from "../../../helpers/time";
import { hasPrivilege } from "../../../helpers/authUtils";
import { PRIVILEGES } from "../../../helpers/privileges";
import { validators } from "../../../helpers/validation";
import styles from "./index.module.scss";

interface PropType {
  isModalOpen: boolean;
  handleCloseModal: () => void;
  editingWork: any | null;
  workName: string;
  setWorkName: (value: string) => void;
  assignees: string[];
  setAssignees: (value: string[]) => void;
  priority: string;
  setPriority: (value: string) => void;
  dueDate: string;
  setDueDate: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  attachments: File[];
  setAttachments: (value: File[]) => void;
  users: any[];
  handleSubmit: (e: React.FormEvent) => void;
  isEmergency: boolean;
  setIsEmergency: (value: boolean) => void;
  activeTab: 'works' | 'emergency';
}

const WorkFormModal = ({
  isModalOpen,
  handleCloseModal,
  editingWork,
  workName,
  setWorkName,
  assignees,
  setAssignees,
  priority,
  setPriority,
  dueDate,
  setDueDate,
  description,
  setDescription,
  attachments,
  setAttachments,
  users,
  handleSubmit,
  isEmergency,
  setIsEmergency,
  activeTab,
}: PropType) => {
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (isModalOpen) {
      setErrors({});
    }
  }, [isModalOpen]);

  const handleLocalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const titleErr = validators.alphanumericSpaces(workName, 100, "Title");
    const descErr = validators.maxLength(description, 220, "Description");

    const newErrors = {
      workName: titleErr,
      description: descErr
    };

    setErrors(newErrors);

    if (titleErr || descErr) {
      return;
    }
    handleSubmit(e);
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

  const formattedUsers = (users || []).map((user) => ({
    label: (user.firstName || user.lastName) ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : (user.username || user.name),
    value: user.id || user._id, 
    isOnline: isUserOnline(user),
  }));

  const today = getServerTime().toDate().toISOString().split("T")[0];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments([...attachments, ...Array.from(e.target.files)]);
    }
  };

  const handleRemoveFile = (indexToRemove: number) => {
    setAttachments(attachments.filter((_, index) => index !== indexToRemove));
  };

  return (
    <Modal
      open={isModalOpen}
      handleClose={handleCloseModal}
      title={editingWork ? "Edit Work" : "Create Work"}
    >
      <form onSubmit={handleLocalSubmit} className={styles.formContainer}>
        <div className={styles.row}>
          <TextField
            className={styles.field}
            fullWidth
            label="Title"
            value={workName}
            onChange={(e) => {
              setWorkName(e.target.value);
              setErrors(prev => ({ ...prev, workName: '' }));
            }}
            required
            error={!!errors.workName}
            helperText={errors.workName}
          />

          <Dropdown
            label="Assignees"
            options={formattedUsers}
            value={assignees}
            onChange={setAssignees}
            multiple={true}
            fullWidth={true}
            className={styles.field}
            clearable={true}
            searchable={true}
          />
        </div>

        <div className={styles.row}>
          <Dropdown
            label="Priority"
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={setPriority}
            fullWidth={true}
            required={true}
            className={styles.field}
          />

          <DatePicker
            className={styles.field}
            fullWidth
            label="Due Date"
            value={dueDate}
            onChange={setDueDate}
            minDate={today}
          />
        </div>

        <div className={styles.row} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
          <TextField
            className={styles.field}
            fullWidth
            multiline
            rows={3}
            label="Description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setErrors(prev => ({ ...prev, description: '' }));
            }}
            error={!!errors.description}
            helperText={errors.description}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {description ? description.length : 0} / 220
            </span>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.uploadSection}>
            <Button
              variant="outlined"
              component="label"
              fullWidth
              className={styles.uploadButton}
            >
              Upload Attachments
              <input type="file" hidden multiple onChange={handleFileChange} />
            </Button>

            {attachments.length > 0 ? (
              <div className={styles.fileList}>
                {attachments.map((file, index) => (
                  <div key={index} className={styles.fileItem}>
                    <span className={styles.fileName} title={file.name}>
                      {file.name}
                    </span>
                    <IconButton size="small" onClick={() => handleRemoveFile(index)} color="error">
                      <MdClose size={16} />
                    </IconButton>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.fileInfo}>No files selected</div>
            )}
          </div>
        </div>

        {(activeTab === 'emergency' || (editingWork && editingWork.isEmergency)) && (
          <div className={styles.row}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={isEmergency}
                  onChange={(e) => setIsEmergency(e.target.checked)}
                  color="error"
                  disabled={!!editingWork || !hasPrivilege(PRIVILEGES.WORK_CREATE)}
                />
              }
              label={<span style={{ fontWeight: 'bold', color: '#d32f2f' }}>Mark as Emergency Work (Requires Admin Approval)</span>}
            />
          </div>
        )}

        <div className={styles.actions}>
          <Button variant="text" onClick={handleCloseModal}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" color="primary">
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default WorkFormModal;
