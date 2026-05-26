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

  // Sync internal state with external prop changes (e.g. parent resetting state)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce effect to update parent after 500ms of inactivity
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
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon />
          </InputAdornment>
        ),
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
