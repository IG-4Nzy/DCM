import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Divider,
  Badge,
  Chip
} from '@mui/material';
import { MdFilterList as FilterIcon, MdClose as CloseIcon, MdRefresh as ResetIcon } from 'react-icons/md';

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  onClearAll?: () => void;
  title?: string;
  activeCount?: number;
  children: React.ReactNode;
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  open,
  onClose,
  onClearAll,
  title = "Filter Options",
  activeCount = 0,
  children
}) => {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', sm: 380 },
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.1)',
          }
        }
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e0e0e0',
          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
          color: '#ffffff'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <FilterIcon size={24} />
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
            {title}
          </Typography>
          {activeCount > 0 && (
            <Chip
              label={`${activeCount} Active`}
              size="small"
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.75rem'
              }}
            />
          )}
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.15)' } }}>
          <CloseIcon size={20} />
        </IconButton>
      </Box>

      {/* Body */}
      <Box
        sx={{
          p: 3,
          flexGrow: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
          bgcolor: '#fafafa'
        }}
      >
        {children}
      </Box>

      {/* Footer */}
      <Divider />
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          bgcolor: '#ffffff'
        }}
      >
        {onClearAll && (
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<ResetIcon />}
            onClick={onClearAll}
            disabled={activeCount === 0}
            sx={{
              textTransform: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              color: '#666',
              borderColor: '#ccc'
            }}
          >
            Clear All
          </Button>
        )}
        <Button
          variant="contained"
          color="primary"
          onClick={onClose}
          sx={{
            textTransform: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            px: 3,
            flexGrow: onClearAll ? 0 : 1
          }}
        >
          Apply & Close
        </Button>
      </Box>
    </Drawer>
  );
};

interface FilterGroupProps {
  title: string;
  children: React.ReactNode;
}

export const FilterGroup: React.FC<FilterGroupProps> = ({ title, children }) => {
  return (
    <Box
      sx={{
        bgcolor: '#ffffff',
        p: 2,
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 700,
          color: '#475569',
          fontSize: '0.8rem',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
};

export default FilterDrawer;
