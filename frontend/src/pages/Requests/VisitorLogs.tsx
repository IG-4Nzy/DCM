import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Box, Paper } from '@mui/material';
import SearchBar from '../../components/SearchBar';
import Table, { type Column } from '../../components/Table';
import { useToast } from '../../contexts/ToastContext';
import { useTableState } from '../../hooks/useTableState';
import { fetchVisitorLogs } from './action';
import type { VisitorLogData } from './model';
import type { RootState } from '../../store';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';

type Order = 'asc' | 'desc';

const VisitorLogs: React.FC = () => {
    const { showToast } = useToast();
    const { isSuperuser } = useSelector((state: RootState) => state.auth);

    const [logs, setLogs] = useState<VisitorLogData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const [page, setPage] = useTableState('visitor_logs_page', 0);
    const [rowsPerPage, setRowsPerPage] = useTableState('visitor_logs_rowsPerPage', 10);
    const [searchQuery, setSearchQuery] = useTableState('visitor_logs_search', '');
    const [order, setOrder] = useTableState<Order>('visitor_logs_order', 'desc');
    const [orderBy, setOrderBy] = useTableState<string>('visitor_logs_orderBy', 'entryTime');

    const hasViewPrivilege = isSuperuser || hasPrivilege(PRIVILEGES.REQUEST_VIEW);

    const loadData = useCallback(async () => {
        if (!hasViewPrivilege) return;
        try {
            setLoading(true);
            const res = await fetchVisitorLogs({
                skip: page * rowsPerPage,
                limit: rowsPerPage,
                search: searchQuery,
            });
            setLogs(res.data);
            setTotalCount(res.total);
        } catch (err: any) {
            showToast(err.message || 'Failed to fetch visitor logs', 'error');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, searchQuery, showToast, hasViewPrivilege]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleRequestSort = (property: string) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const cleanAndFormatTime = (timeStr?: string) => {
        if (!timeStr) return '-';
        const cleaned = timeStr.replace(/\+00:00Z$/, 'Z').replace(/\+00:00$/, 'Z');
        const d = new Date(cleaned);
        return isNaN(d.getTime()) ? timeStr : d.toLocaleString();
    };

    const columns: Column<VisitorLogData>[] = [
        { 
            id: 'visitorName', 
            label: 'Visitor Name', 
            sortable: false,
            render: (row) => row.visitorName || '-'
        },
        {
            id: 'division',
            label: 'Division',
            sortable: false,
            render: (row) => row.division || '-'
        },
        {
            id: 'purpose',
            label: 'Purpose',
            sortable: false,
            render: (row) => row.purpose || '-'
        },
        { 
            id: 'entryTime', 
            label: 'Entry Time', 
            sortable: true,
            render: (row) => cleanAndFormatTime(row.entryTime)
        },
        {
            id: 'exitTime',
            label: 'Exit Time',
            sortable: true,
            render: (row) => cleanAndFormatTime(row.exitTime)
        },
        {
            id: 'loggedBy',
            label: 'Logged By',
            sortable: false,
            render: (row) => row.loggedBy || '-'
        }
    ];

    if (!hasViewPrivilege) {
        return (
            <Box sx={{ p: 3 }}>
                <h2 style={{ margin: 0, color: '#333' }}>Access Denied</h2>
                <p>You do not have permission to view Visitor Logs.</p>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <h2 style={{ margin: 0, color: '#333' }}>Visitor Logs</h2>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2 }}>
                <SearchBar value={searchQuery} onChange={(v) => { setSearchQuery(v); setPage(0); }} placeholder="Search visitor logs by name, division, purpose..." sx={{ width: '400px' }} />
            </Box>

            <Paper sx={{ width: '100%', mb: 2, p: 0, boxShadow: 'none', background: 'transparent' }}>
                <Table
                    columns={columns}
                    data={logs}
                    loading={loading}
                    orderBy={orderBy}
                    order={order}
                    onRequestSort={(prop) => handleRequestSort(prop as string)}
                    page={page}
                    rowsPerPage={rowsPerPage}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    totalCount={totalCount}
                />
            </Paper>
        </Box>
    );
};

export default VisitorLogs;
