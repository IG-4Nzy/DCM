import React, { useState } from 'react';
import Modal from '../../components/Modal';
import { 
  Box, 
  Typography, 
  TextField, 
  Divider, 
  Paper, 
  MenuItem, 
  Select, 
  FormControl, 
  InputLabel,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar
} from '@mui/material';
import { 
  MdAdd as AddIcon, 
  MdRemove as SubtractIcon, 
  MdSend as GiveIcon,
  MdCheckCircle as CheckIcon,
  MdHistory as HistoryIcon,
  MdEdit as EditIcon
} from 'react-icons/md';
import type { InventoryData } from './model';
import Button from '../../components/Button';

interface PropType {
  isModalOpen: boolean;
  handleCloseModal: () => void;
  item: InventoryData | null;
  onUpdate: (id: string, data: { quantityChange: number; action: string; givenTo?: string; date: string }) => void;
  hasUpdatePrivilege: boolean;
  users?: any[];
}

const InventoryDetailModal: React.FC<PropType> = ({
  isModalOpen,
  handleCloseModal,
  item,
  onUpdate,
  hasUpdatePrivilege,
  users = []
}) => {
  const [actionType, setActionType] = useState<'add' | 'subtract'>('add');
  const [quantity, setQuantity] = useState(1);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  
  const getLocalDatetime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };
  
  const [date, setDate] = useState(getLocalDatetime());

  if (!item) return null;

  const getUserFullName = (username: string) => {
    const userObj = users.find(u => u.username === username);
    if (userObj) {
      const full = `${userObj.firstName || ''} ${userObj.lastName || ''}`.trim();
      return full || username;
    }
    return username;
  };

  const handleUpdate = () => {
    let qChange = quantity;
    if (actionType === 'subtract') {
      qChange = -quantity;
    }

    onUpdate(item.id || item._id as string, {
      quantityChange: qChange,
      action: actionType,
      date
    });
    
    // Reset form
    setQuantity(1);
    setDate(getLocalDatetime());
    setShowUpdateForm(false);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const getActionIcon = (action: string) => {
    switch(action) {
      case 'add': return <AddIcon />;
      case 'subtract': return <SubtractIcon />;
      case 'give': return <GiveIcon />;
      case 'created': return <CheckIcon />;
      default: return <HistoryIcon />;
    }
  };

  const getActionColor = (action: string) => {
    switch(action) {
      case 'add': return 'success.main';
      case 'subtract': return 'error.main';
      case 'give': return 'info.main';
      case 'created': return 'primary.main';
      default: return 'text.secondary';
    }
  };

  return (
    <Modal open={isModalOpen} handleClose={handleCloseModal} title={`Inventory: ${item.itemName}`}>
      <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
        <Box sx={{ flex: 1, minWidth: '150px' }}>
          <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing={1}>Quantity in Stock</Typography>
          <Typography variant="h6" fontWeight="bold" color="primary.main">{item.quantity}</Typography>
        </Box>
        <Box sx={{ flex: 2, minWidth: '200px' }}>
          <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing={1}>Description</Typography>
          <Typography variant="body2">{item.description || 'N/A'}</Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: '200px' }}>
          <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing={1}>Last Updated</Typography>
          <Typography variant="body2">{formatDate(item.lastUpdatedDate)}</Typography>
          <Typography variant="body2" color="text.secondary">By {getUserFullName(item.lastUpdatedBy)}</Typography>
        </Box>
        
        {hasUpdatePrivilege && (
          <Box sx={{ ml: 'auto' }}>
            <Button 
              variant={showUpdateForm ? "outlined" : "contained"} 
              color="primary" 
              startIcon={<EditIcon />}
              onClick={() => setShowUpdateForm(!showUpdateForm)}
              size="small"
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              {showUpdateForm ? "Cancel Update" : "Update Stock"}
            </Button>
          </Box>
        )}
      </Box>

      {hasUpdatePrivilege && showUpdateForm && (
        <Paper elevation={0} sx={{ p: 2.5, mb: 4, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight="600" mb={2} color="text.primary">Record Stock Change</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Action</InputLabel>
              <Select
                value={actionType}
                label="Action"
                onChange={(e) => setActionType(e.target.value as any)}
              >
                <MenuItem value="add">Add Stock</MenuItem>
                <MenuItem value="subtract">Subtract Stock</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              type="number"
              label="Quantity"
              size="small"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              inputProps={{ min: 1 }}
              sx={{ width: 100 }}
            />

            <TextField
              type="datetime-local"
              label="Date & Time"
              size="small"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            <Tooltip title="Submit Update">
              <span>
                <IconButton 
                  color="primary" 
                  onClick={handleUpdate}
                  sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, width: 40, height: 40 }}
                  disabled={quantity <= 0 || (actionType !== 'add' && quantity > item.quantity)}
                >
                  <CheckIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Paper>
      )}

      <Typography variant="subtitle1" fontWeight="bold" mb={1} color="text.secondary">History Log</Typography>
      <Divider sx={{ mb: 2 }} />
      
      <List sx={{ maxHeight: 350, overflow: 'auto', bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        {[...(item.history || [])].reverse().map((hist, idx) => (
          <ListItem key={idx} alignItems="flex-start" divider={idx !== (item.history?.length || 1) - 1}>
            <ListItemAvatar>
              <Avatar sx={{ bgcolor: getActionColor(hist.action), color: 'white' }}>
                {getActionIcon(hist.action)}
              </Avatar>
            </ListItemAvatar>
            <ListItemText 
              primary={
                <Typography variant="body2" fontWeight="600">
                  {hist.action === 'created' 
                    ? `Initial stock added: ${hist.quantityChange} items`
                    : hist.action === 'give'
                      ? `Given ${Math.abs(hist.quantityChange)} items to ${hist.givenTo}`
                      : `${hist.action === 'add' ? 'Added' : 'Subtracted'} ${Math.abs(hist.quantityChange)} items`
                  }
                </Typography>
              }
              secondary={
                <React.Fragment>
                  <Typography component="span" variant="body2" color="text.primary">
                    {formatDate(hist.date)}
                  </Typography>
                  {` — Action by ${getUserFullName(hist.user)}. Remaining stock: ${hist.remainingQuantity}`}
                </React.Fragment>
              }
            />
          </ListItem>
        ))}
      </List>
    </Modal>
  );
};

export default InventoryDetailModal;
