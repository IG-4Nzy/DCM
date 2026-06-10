import React from 'react';
import {
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Paper,
  Box
} from '@mui/material';

export interface Column<T> {
  id: string;
  label: string;
  minWidth?: number;
  align?: 'right' | 'left' | 'center';
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

interface ReusableTableProps<T> {
  columns: Column<T>[];
  data: T[];
  orderBy?: string;
  order?: 'asc' | 'desc';
  onRequestSort?: (property: string) => void;
  page?: number;
  rowsPerPage?: number;
  onPageChange?: (event: unknown, newPage: number) => void;
  onRowsPerPageChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  totalCount?: number;
  onRowClick?: (row: T) => void;
}

function Table<T extends { id?: string | number }>(props: ReusableTableProps<T>) {
  const {
    columns,
    data,
    orderBy,
    order,
    onRequestSort,
    page,
    rowsPerPage,
    onPageChange,
    onRowsPerPageChange,
    totalCount,
    onRowClick
  } = props;

  return (
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        overflow: 'hidden',
        border: '1px solid #e0e0e0',
        borderRadius: '12px',
        padding: "0px",
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}
    >
      <TableContainer className="table-container-scroll" sx={{ flexGrow: 1, overflow: 'auto' }}>
        <MuiTable stickyHeader aria-label="modern table" sx={{ minWidth: { xs: 300, sm: 650 } }}>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align}
                  sx={{
                    minWidth: column.minWidth,
                    backgroundColor: '#f4f6f8',
                    color: '#637381',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: 'none',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {column.sortable && orderBy && order && onRequestSort ? (
                    <TableSortLabel
                      active={orderBy === column.id}
                      direction={orderBy === column.id ? order : 'asc'}
                      onClick={() => onRequestSort(column.id)}
                      sx={{
                        '&.Mui-active': { color: '#212b36' },
                        '& .MuiTableSortLabel-icon': { color: '#212b36 !important' }
                      }}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length > 0 ? (
              data.map((row, index) => {
                const isLast = index === data.length - 1;
                const serialNumber = page !== undefined && rowsPerPage !== undefined
                  ? page * rowsPerPage + index + 1
                  : index + 1;
                return (
                  <TableRow
                    hover
                    role="checkbox"
                    tabIndex={-1}
                    key={row.id || (row as any)._id || index}
                    onClick={() => onRowClick && onRowClick(row)}
                    sx={{
                      cursor: onRowClick ? 'pointer' : 'default',
                      '&:hover': { backgroundColor: '#f9fafb !important' },
                      transition: 'background-color 0.2s ease',
                      '& td': { borderBottom: isLast ? 'none' : '1px solid #f1f3f4' }
                    }}
                  >
                    {columns.map((column) => {
                      const value = column.id === 'slNumber' ? serialNumber : (row as any)[column.id];
                      return (
                        <TableCell
                          key={column.id}
                          align={column.align}
                          sx={{
                            color: '#212b36',
                            fontSize: '0.875rem'
                          }}
                        >
                          {column.render ? column.render(row) : (value === null || value === undefined || value === '' ? '--' : (value as React.ReactNode))}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ borderBottom: 'none' }}>
                  <Box sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#919eab' }}>
                    <label style={{ fontSize: '1.1rem', fontWeight: 500 }}>No data found</label>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </MuiTable>
      </TableContainer>
      {page !== undefined && rowsPerPage !== undefined && totalCount !== undefined && onPageChange && onRowsPerPageChange && (
        <Box sx={{ borderTop: '1px solid #e0e0e0' }}>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={totalCount}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={onPageChange}
            onRowsPerPageChange={onRowsPerPageChange}
            sx={{
              color: '#637381',
              '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                margin: 0,
              }
            }}
          />
        </Box>
      )}
    </Paper>
  );
}

export default Table;
