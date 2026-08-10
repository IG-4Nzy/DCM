// @ts-nocheck
import React, { useState } from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';

import Users from '../Users';
import Roles from '../Roles';
import Departments from '../Departments';

const UsersAndRoles: React.FC = () => {
    const { isSuperuser, privileges } = useSelector((state: RootState) => state.auth);

    const canViewUsers = isSuperuser || hasPrivilege(PRIVILEGES.USER_VIEW_ALL) || hasPrivilege(PRIVILEGES.USER_VIEW_DEPT);
    const canViewRoles = isSuperuser || hasPrivilege(PRIVILEGES.ROLE_VIEW);
    const canViewDepts = isSuperuser || hasPrivilege(PRIVILEGES.DEPARTMENT_VIEW);

    const availableTabs = [
        ...(canViewUsers ? [{ id: 'users', label: 'Users' }] : []),
        ...(canViewRoles ? [{ id: 'roles', label: 'Roles' }] : []),
        ...(canViewDepts ? [{ id: 'departments', label: 'Departments' }] : []),
    ];

    const [activeTab, setActiveTab] = useState<string>(() => {
        return availableTabs.length > 0 ? availableTabs[0].id : '';
    });

    if (availableTabs.length === 0) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h5" color="error">Access Denied</Typography>
                <Typography variant="body1" sx={{ mt: 1 }}>You do not have privileges to view Users, Roles, or Departments.</Typography>
            </Box>
        );
    }

    const currentTab = availableTabs.some(t => t.id === activeTab) ? activeTab : availableTabs[0].id;

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 2, bgcolor: '#fff' }}>
                <Tabs
                    value={currentTab}
                    onChange={(_, val) => setActiveTab(val)}
                    textColor="primary"
                    indicatorColor="primary"
                >
                    {canViewUsers && <Tab label="Users" value="users" sx={{ fontWeight: 600 }} />}
                    {canViewRoles && <Tab label="Roles" value="roles" sx={{ fontWeight: 600 }} />}
                    {canViewDepts && <Tab label="Departments" value="departments" sx={{ fontWeight: 600 }} />}
                </Tabs>
            </Box>

            <Box sx={{ p: 0 }}>
                {currentTab === 'users' && <Users />}
                {currentTab === 'roles' && <Roles />}
                {currentTab === 'departments' && <Departments />}
            </Box>
        </Box>
    );
};

export default UsersAndRoles;
