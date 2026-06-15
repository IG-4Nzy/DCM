import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  type SelectChangeEvent,
  FormHelperText,
  IconButton,
  ListItemText,
} from '@mui/material';
import { MdClear } from 'react-icons/md';

export interface DropdownOption {
  label: string;
  value: string | number;
  isOnline?: boolean;
}

export interface DropdownProps {
  label: string;
  options: DropdownOption[];
  value: any;
  onChange: (value: any) => void;
  multiple?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  helperText?: string;
  error?: boolean;
  size?: 'small' | 'medium';
  sx?: any;
  className?:string;
  clearable?: boolean;
}

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;

const Dropdown: React.FC<DropdownProps> = ({
  label,
  options,
  value,
  onChange,
  multiple = false,
  required = false,
  fullWidth = true,
  disabled = false,
  helperText,
  error = false,
  size = 'medium',
  sx = {},
  className = "",
  clearable = false
}) => {
  const handleChange = (event: SelectChangeEvent<any>) => {
    onChange(event.target.value);
  };

  // Ensure correct value format
  const displayValue = multiple
    ? Array.isArray(value)
      ? value
      : []
    : value || '';

  return (
    <FormControl
      fullWidth={fullWidth}
      required={required}
      error={error}
      disabled={disabled}
      size={size}
      sx={{
        width: fullWidth ? '100%' : { xs: '100%', sm: 300, md: 400 },
        '& .MuiOutlinedInput-root': {
          borderRadius: '8px',
          backgroundColor: '#fff',
        },
        ...sx,
      }}
      className={className}
    >
      <InputLabel>{label}</InputLabel>

      <Select
        multiple={multiple}
        value={displayValue}  
        onChange={handleChange}
        label={label}
        renderValue={
          multiple
            ? (selected) =>
              options
                .filter((opt) =>
                  (selected as any[]).includes(opt.value)
                )
                .map((opt) => opt.label)
                .join(', ')
            : undefined
        }
        MenuProps={{
          disablePortal: true,
          anchorOrigin: {
            vertical: 'bottom',
            horizontal: 'left',
          },
          transformOrigin: {
            vertical: 'top',
            horizontal: 'left',
          },
          slotProps: {
            paper: {
              style: {
                maxHeight:
                  ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
                width: 250,
              },
            },
          },
        }}
        endAdornment={
          clearable && (multiple ? displayValue.length > 0 : displayValue) ? (
            <IconButton
              size="small"
              sx={{ position: 'absolute', right: 28, top: 'calc(50% - 14px)' }}
              onClick={(e) => {
                e.stopPropagation();
                onChange(multiple ? [] : '');
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <MdClear fontSize="small" />
            </IconButton>
          ) : undefined
        }
      >
        {options.map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
          >
            {multiple && (
              <Checkbox
                checked={
                  Array.isArray(displayValue) &&
                  displayValue.includes(option.value)
                }
              />
            )}

            {option.isOnline !== undefined && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: option.isOnline ? "#4caf50" : "#f44336",
                  marginRight: 8,
                  display: "inline-block",
                  boxShadow: option.isOnline ? "0 0 6px #4caf50" : "none",
                }}
              />
            )}

            <ListItemText primary={option.label} />
          </MenuItem>
        ))}
      </Select>

      {helperText && (
        <FormHelperText>{helperText}</FormHelperText>
      )}
    </FormControl>
  );
};

export default Dropdown;