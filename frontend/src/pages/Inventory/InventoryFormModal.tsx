import React, { useState, useEffect } from 'react';
import Modal from '../../components/Modal';
import TextField from '../../components/TextField';
import { Button, FormControlLabel, Checkbox } from '@mui/material';
import { getServerTime } from '../../helpers/time';

interface PropType {
  isModalOpen: boolean;
  handleCloseModal: () => void;
  onSubmit: (data: any) => void;
}

const InventoryFormModal: React.FC<PropType> = ({
  isModalOpen,
  handleCloseModal,
  onSubmit,
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
      setItemName('');
      setQuantity(1);
      setDescription('');
      setDate(getLocalDatetime());
      setIsReturnable(false);
      setAlmiraNumber('');
      setRackNumber('');
    }
  }, [isModalOpen]);

  const handleSubmit = () => {
    if (!itemName) return;
    onSubmit({ itemName, quantity, description, date, isReturnable, almiraNumber, rackNumber });
    handleCloseModal();
  };

  return (
    <Modal
      open={isModalOpen}
      handleClose={handleCloseModal}
      title="Create New Item"
    >
      <TextField
        label="Item Name"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
        required
        fullWidth
        style={{ marginBottom: '1rem' }}
      />
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <TextField
          label="Almira Number"
          value={almiraNumber}
          onChange={(e) => setAlmiraNumber(e.target.value)}
          fullWidth
        />
        <TextField
          label="Rack Number"
          value={rackNumber}
          onChange={(e) => setRackNumber(e.target.value)}
          fullWidth
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
      />
      <TextField
        label="Date & Time"
        type="datetime-local"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
        fullWidth
        style={{ marginBottom: '1rem' }}
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
      />
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
        <Button onClick={handleCloseModal} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={!itemName || quantity <= 0 || !date}
        >
          Create
        </Button>
      </div>
    </Modal>
  );
};

export default InventoryFormModal;
