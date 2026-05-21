import React from "react";
import Modal from "../../../components/Modal";
import TextField from "../../../components/TextField";
import DatePicker from "../../../components/DatePicker";
import Dropdown from "../../../components/Dropdown";
import { Button, IconButton } from "@mui/material";
import { MdClose } from "react-icons/md";
import { PRIORITY_OPTIONS } from "../constant";
import styles from "./index.module.scss";

interface PropType {
  isModalOpen: boolean;
  handleCloseModal: () => void;
  editingWork: any | null;
  workName: string;
  setWorkName: (value: string) => void;
  assignee: string;
  setAssignee: (value: string) => void;
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
}

const WorkFormModal = ({
  isModalOpen,
  handleCloseModal,
  editingWork,
  workName,
  setWorkName,
  assignee,
  setAssignee,
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
}: PropType) => {
  const formattedUsers = (users || []).map((user) => ({
    label: (user.firstName || user.lastName) ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : (user.username || user.name),
    value: user.id || user._id, 
  }));

  const today = new Date().toISOString().split("T")[0];

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
      <form onSubmit={handleSubmit} className={styles.formContainer}>
        <div className={styles.row}>
          <TextField
            className={styles.field}
            fullWidth
            label="Title"
            value={workName}
            onChange={(e) => setWorkName(e.target.value)}
            required
          />

          <Dropdown
            label="Assignee"
            options={formattedUsers}
            value={assignee}
            onChange={setAssignee}
            fullWidth={true}
            className={styles.field}
            clearable={true}
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
            required
          />
        </div>

        <div className={styles.row}>
          <TextField
            className={styles.field}
            fullWidth
            multiline
            rows={3}
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
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
