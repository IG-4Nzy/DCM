import React, { useState } from 'react';
import dayjs from 'dayjs';
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
  Avatar,
  Tabs,
  Tab
} from '@mui/material';
import { 
  MdAdd as AddIcon, 
  MdRemove as SubtractIcon, 
  MdSend as GiveIcon,
  MdCheckCircle as CheckIcon,
  MdHistory as HistoryIcon,
  MdEdit as EditIcon,
  MdKeyboardReturn as ReturnIcon
} from 'react-icons/md';
import type { InventoryData } from './model';
import Button from '../../components/Button';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../../store';
import { giveInventoryItem, returnInventoryItem } from './action';
import { useToast } from '../../contexts/ToastContext';

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

  const dispatch = useDispatch<AppDispatch>();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'status' | 'history'>('status');
  const [givenTo, setGivenTo] = useState('');
  const [giveDate, setGiveDate] = useState(getLocalDatetime());
  const [returningHolderId, setReturningHolderId] = useState<string | null>(null);
  const [returnDate, setReturnDate] = useState(getLocalDatetime());

  if (!item) return null;

  const handleGiveItemSubmit = async () => {
    if (!givenTo.trim()) {
      showToast('Please specify who the item is being given to', 'error');
      return;
    }
    const result = await dispatch(giveInventoryItem({
      id: (item.id || item._id) as string,
      data: { givenTo: givenTo.trim(), date: giveDate }
    }));
    if (giveInventoryItem.fulfilled.match(result)) {
      showToast(`Successfully checked out item to ${givenTo}`, 'success');
      setGivenTo('');
      setGiveDate(getLocalDatetime());
    } else {
      showToast((result.payload as string) || 'Failed to check out item', 'error');
    }
  };

  const handleReturnItemSubmit = async (holderId: string) => {
    const result = await dispatch(returnInventoryItem({
      id: (item.id || item._id) as string,
      data: { holderId, date: returnDate }
    }));
    if (returnInventoryItem.fulfilled.match(result)) {
      showToast('Successfully returned item', 'success');
      setReturningHolderId(null);
      setReturnDate(getLocalDatetime());
    } else {
      showToast((result.payload as string) || 'Failed to return item', 'error');
    }
  };

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
    if (!dateStr) return '-';
    const cleaned = dateStr.replace(/\+00:00Z$/, 'Z').replace(/\+00:00$/, 'Z');
    const parsed = dayjs(cleaned);
    if (parsed.isValid()) {
      return parsed.format('DD-MM-YYYY h:mm A');
    }
    try {
      const d = new Date(cleaned);
      if (!isNaN(d.getTime())) {
        return dayjs(d).format('DD-MM-YYYY h:mm A');
      }
    } catch {}
    return dateStr;
  };

  const getActionIcon = (action: string) => {
    switch(action) {
      case 'add': return <AddIcon />;
      case 'subtract': return <SubtractIcon />;
      case 'give':
      case 'given': return <GiveIcon />;
      case 'returned': return <ReturnIcon />;
      case 'created': return <CheckIcon />;
      default: return <HistoryIcon />;
    }
  };

  const getActionColor = (action: string) => {
    switch(action) {
      case 'add': return 'success.main';
      case 'subtract': return 'error.main';
      case 'give':
      case 'given': return 'warning.main';
      case 'returned': return 'success.main';
      case 'created': return 'primary.main';
      default: return 'text.secondary';
    }
  };

  const totalHoldersCount = item.currentHolders?.length || 0;
  const availableQuantity = item.quantity - totalHoldersCount;

  return (
    <Modal open={isModalOpen} handleClose={handleCloseModal} title={`Inventory: ${item.itemName}`}>
      {/* Top Details Panel */}
      <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
        <Box sx={{ flex: 1, minWidth: '150px' }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontSize: "0.8rem" }}>
            Total Stock Quantity
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: "bold", fontSize: "1.5rem" }} color="primary.main">
            {item.quantity}
          </Typography>
        </Box>

        {item.isReturnable && (
          <>
            <Box sx={{ flex: 1, minWidth: '150px' }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontSize: "0.8rem" }}>
                Available in Stock
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: "bold", fontSize: "1.5rem" }} color="success.main">
                {availableQuantity}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: '150px' }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontSize: "0.8rem" }}>
                Currently Out
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: "bold", fontSize: "1.5rem" }} color="warning.main">
                {totalHoldersCount}
              </Typography>
            </Box>
          </>
        )}

        <Box sx={{ flex: 2, minWidth: '200px' }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontSize: "0.8rem" }}>
            Description
          </Typography>
          <Typography variant="body2">{item.description || 'N/A'}</Typography>
        </Box>
        <Box sx={{ flex: 1.5, minWidth: '200px' }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontSize: "0.8rem" }}>
            Last Updated
          </Typography>
          <Typography variant="body2">{formatDate(item.lastUpdatedDate)}</Typography>
          <Typography variant="body2" color="text.secondary">By {getUserFullName(item.lastUpdatedBy)}</Typography>
        </Box>

        {!item.isReturnable && hasUpdatePrivilege && (
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

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)}>
          <Tab label="Status & Actions" value="status" sx={{ textTransform: 'none', fontWeight: 'bold' }} />
          <Tab label="History" value="history" sx={{ textTransform: 'none', fontWeight: 'bold' }} />
        </Tabs>
      </Box>

      {/* Tab Panel 1: Status & Actions */}
      {activeTab === 'status' && (
        <Box>
          {!item.isReturnable ? (
            /* Non-returnable Update Stock Form */
            hasUpdatePrivilege && showUpdateForm ? (
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
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Click "Update Stock" above to add or remove quantity.
              </Typography>
            )
          ) : (
            /* Returnable Item Status & Actions */
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* checkout form */}
              {hasUpdatePrivilege && (
                <Paper elevation={0} sx={{ p: 2.5, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2" fontWeight="600" mb={2} color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <GiveIcon color="#ed6c02" /> Give Item (Check-out)
                  </Typography>
                  {availableQuantity <= 0 ? (
                    <Typography variant="body2" color="error" sx={{ fontStyle: 'italic' }}>
                      All stock quantity currently given out. Increase total stock or return items first.
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                      <TextField
                        label="Given To (Receiver Name)"
                        size="small"
                        value={givenTo}
                        onChange={(e) => setGivenTo(e.target.value)}
                        sx={{ minWidth: 200 }}
                        required
                      />

                      <TextField
                        type="datetime-local"
                        label="Date & Time"
                        size="small"
                        value={giveDate}
                        onChange={(e) => setGiveDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />

                      <Button
                        variant="contained"
                        color="warning"
                        onClick={handleGiveItemSubmit}
                        disabled={!givenTo.trim()}
                        sx={{ height: 40, textTransform: 'none', borderRadius: 2 }}
                        startIcon={<GiveIcon />}
                      >
                        Give Item
                      </Button>
                    </Box>
                  )}
                </Paper>
              )}

              {/* current holders section */}
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" mb={2} color="text.primary">
                  Current Holders (Checked Out Items)
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {(!item.currentHolders || item.currentHolders.length === 0) ? (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No active checkouts. All items are currently in stock.
                  </Typography>
                ) : (
                  <List sx={{ bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 0 }}>
                    {item.currentHolders.map((holder, idx) => (
                      <ListItem
                        key={holder.id}
                        divider={idx !== item.currentHolders!.length - 1}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 2,
                          py: 1.5,
                          px: 2
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar sx={{ bgcolor: 'warning.light' }}>
                            <GiveIcon />
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight="600">
                              {holder.givenTo}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Checked out: {formatDate(holder.givenDate)} (by {getUserFullName(holder.givenBy)})
                            </Typography>
                          </Box>
                        </Box>

                        {hasUpdatePrivilege && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {returningHolderId === holder.id ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                                <TextField
                                  type="datetime-local"
                                  label="Return Date & Time"
                                  size="small"
                                  value={returnDate}
                                  onChange={(e) => setReturnDate(e.target.value)}
                                  InputLabelProps={{ shrink: true }}
                                />
                                <Button
                                  variant="contained"
                                  color="success"
                                  size="small"
                                  onClick={() => handleReturnItemSubmit(holder.id)}
                                  sx={{ textTransform: 'none' }}
                                >
                                  Confirm Return
                                </Button>
                                <Button
                                  variant="outlined"
                                  color="inherit"
                                  size="small"
                                  onClick={() => setReturningHolderId(null)}
                                  sx={{ textTransform: 'none' }}
                                >
                                  Cancel
                                </Button>
                              </Box>
                            ) : (
                              <Button
                                variant="outlined"
                                color="success"
                                size="small"
                                startIcon={<ReturnIcon />}
                                onClick={() => {
                                  setReturningHolderId(holder.id);
                                  setReturnDate(getLocalDatetime());
                                }}
                                sx={{ textTransform: 'none', borderRadius: 2 }}
                              >
                                Return Item
                              </Button>
                            )}
                          </Box>
                        )}
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Tab Panel 2: History Log */}
      {activeTab === 'history' && (
        <Box>
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
                        : hist.action === 'give' || hist.action === 'given'
                          ? `Given ${Math.abs(hist.quantityChange)} items to ${hist.givenTo}`
                          : hist.action === 'returned'
                            ? `Returned ${Math.abs(hist.quantityChange)} items from ${hist.givenTo}`
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
        </Box>
      )}
    </Modal>
  );
};

export default InventoryDetailModal;
