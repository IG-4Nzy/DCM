// @ts-nocheck
import React, { useState, useEffect } from 'react';
import Modal from '../../components/Modal';
import TextField from '../../components/TextField';
import { Button, FormControlLabel, Checkbox } from '@mui/material';
import { getServerTime } from '../../helpers/time';
import type { InventoryData } from './model';

interface PropType {
  isModalOpen: boolean;
  handleCloseModal: () => void;
  onSubmit: (data: any) => void;
  editingItem?: InventoryData | null;
}

const InventoryFormModal: React.FC<PropType> = ({
  isModalOpen,
  handleCloseModal,
  onSubmit,
  editingItem
}) => {
  const getLocalDatetime = () => {
    const now = getServerTime().toDate();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getLocalDatetime());
  const [isReturnable, setIsReturnable] = useState(false);
  const [almiraNumber, setAlmiraNumber] = useState('');
  const [rackNumber, setRackNumber] = useState('');

  useEffect(() => {
    if (isModalOpen) {
      if (editingItem) {
        setItemName(editingItem.itemName || '');
        setQuantity(editingItem.quantity || 0);
        setDescription(editingItem.description || '');
        setDate(editingItem.lastUpdatedDate ? editingItem.lastUpdatedDate.slice(0, 16) : getLocalDatetime());
        setIsReturnable(!!editingItem.isReturnable);
        setAlmiraNumber(editingItem.almiraNumber || '');
        setRackNumber(editingItem.rackNumber || '');
      } else {
        setItemName('');
        setQuantity(1);
        setDescription('');
        setDate(getLocalDatetime());
        setIsReturnable(false);
        setAlmiraNumber('');
        setRackNumber('');
      }
    }
  }, [isModalOpen, editingItem]);

  const validateItemName = (v: string) => {
    if (!v) return "";
    if (!/^[a-zA-Z0-9\s]+$/.test(v)) return "Item name must be alphanumeric with spaces only";
    if (v.length > 20) return "Item name must be maximum 20 characters";
    return "";
  };
  const validateAlmiraNumber = (v: string) => {
    if (!v) return "";
    if (!/^[a-zA-Z0-9]+$/.test(v)) return "Almira number must be alphanumeric only";
    if (v.length > 5) return "Almira number must be maximum 5 characters";
    return "";
  };
  const validateRackNumber = (v: string) => {
    if (!v) return "";
    if (!/^[a-zA-Z0-9]+$/.test(v)) return "Rack number must be alphanumeric only";
    if (v.length > 5) return "Rack number must be maximum 5 characters";
    return "";
  };
  const validateQuantity = (v: number) => {
    if (v === undefined || v === null || isNaN(v)) return "Quantity is required";
    if (v < 0) return "Quantity must be greater than or equal to 0";
    if (!Number.isInteger(v)) return "Quantity must be an integer";
    return "";
  };
  const validateDescription = (v: string) => {
    if (!v) return "";
    if (v.length > 220) return "Description must be maximum 220 characters";
    return "";
  };
  const validateDate = (v: string) => {
    if (!v) return "Date is required";
    const selectedDate = new Date(v);
    const now = new Date();
    now.setMinutes(now.getMinutes() - 5);
    if (selectedDate < now) return "Date and time cannot be in the past";
    return "";
  };

  const itemNameErr = validateItemName(itemName);
  const almiraErr = validateAlmiraNumber(almiraNumber);
  const rackErr = validateRackNumber(rackNumber);
  const quantityErr = validateQuantity(quantity);
  const dateErr = !editingItem ? validateDate(date) : "";
  const descErr = validateDescription(description);

  const isFormInvalid = !!itemNameErr || !!almiraErr || !!rackErr || !!quantityErr || !!dateErr || !!descErr || !itemName || !date;

  const handleSubmit = () => {
    if (isFormInvalid) return;
    onSubmit({ itemName, quantity, description, date, isReturnable, almiraNumber, rackNumber });
    handleCloseModal();
  };

  return (
    <Modal
      open={isModalOpen}
      handleClose={handleCloseModal}
      title={editingItem ? "Edit Item" : "Create New Item"}
    >
      <TextField
        label="Item Name"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
        required
        fullWidth
        style={{ marginBottom: '1rem' }}
        error={!!itemNameErr}
        helperText={itemNameErr}
        inputProps={{ maxLength: 20 }}
      />
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <TextField
          label="Almira Number"
          value={almiraNumber}
          onChange={(e) => setAlmiraNumber(e.target.value)}
          fullWidth
          error={!!almiraErr}
          helperText={almiraErr}
          inputProps={{ maxLength: 5 }}
        />
        <TextField
          label="Rack Number"
          value={rackNumber}
          onChange={(e) => setRackNumber(e.target.value)}
          fullWidth
          error={!!rackErr}
          helperText={rackErr}
          inputProps={{ maxLength: 5 }}
        />
      </div>
      <TextField
        label="Quantity"
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
        required
        fullWidth
        style={{ marginBottom: '1rem' }}
        error={!!quantityErr}
        helperText={quantityErr}
      />
      <TextField
        label="Date & Time"
        type="datetime-local"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
        fullWidth
        style={{ marginBottom: '1rem' }}
        error={!!dateErr}
        helperText={dateErr}
        slotProps={{
          htmlInput: {
            min: !editingItem ? getLocalDatetime() : undefined
          }
        }}
      />
      
      <FormControlLabel
        control={
          <Checkbox
            checked={isReturnable}
            onChange={(e) => setIsReturnable(e.target.checked)}
            color="primary"
          />
        }
        label="Returnable Item"
        style={{ marginBottom: '1rem', display: 'block' }}
      />

      <TextField
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        fullWidth
        multiline
        rows={4}
        style={{ marginBottom: '1.5rem' }}
        showCount={true}
        error={!!descErr}
        helperText={descErr}
        inputProps={{ maxLength: 220 }}
      />
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
        <Button onClick={handleCloseModal} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={isFormInvalid}
        >
          {editingItem ? "Save" : "Create"}
        </Button>
      </div>
    </Modal>
  );
};

export default InventoryFormModal;
