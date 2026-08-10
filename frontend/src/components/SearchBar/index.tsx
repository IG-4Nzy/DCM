// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { InputAdornment } from '@mui/material';
import { MdSearch as SearchIcon } from 'react-icons/md';
import TextField from '../TextField';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange, placeholder = 'Search...' }) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [localValue, onChange, value]);

  return (
    <TextField
      variant="outlined"
      size="small"
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        },
      }}
      sx={{
        width: { xs: '100%', sm: 250, md: 300 },
        '& .MuiOutlinedInput-root': {
          borderRadius: '8px',
          backgroundColor: '#fff',
        }
      }}
    />
  );
};

export default SearchBar;
