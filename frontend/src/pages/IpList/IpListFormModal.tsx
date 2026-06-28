import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControlLabel,
    Switch,
} from '@mui/material';
import Dropdown from '../../components/Dropdown';
import type { IpListModel } from './model';

interface IpListFormModalProps {
    isModalOpen: boolean;
    handleCloseModal: () => void;
    editingIp: IpListModel | null;
    ip: string;
    setIp: (v: string) => void;
    purpose: string;
    setPurpose: (v: string) => void;
    takenBy: string;
    setTakenBy: (v: string) => void;
    isUsed: boolean;
    setIsUsed: (v: boolean) => void;
    users: any[];
    handleSubmit: (e: React.FormEvent) => void;
}

const IpListFormModal: React.FC<IpListFormModalProps> = ({
    isModalOpen,
    handleCloseModal,
    editingIp,
    ip,
    setIp,
    purpose,
    setPurpose,
    takenBy,
    setTakenBy,
    isUsed,
    setIsUsed,
    users,
    handleSubmit
}) => {
    return (
        <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold',color:"#333" }}>
                {editingIp ? 'Edit IP' : 'Create IP'}
            </DialogTitle>
            <form onSubmit={handleSubmit}>
                <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                        label="IP Address"
                        value={ip}
                        onChange={(e) => setIp(e.target.value)}
                        required
                        fullWidth
                    />
                    <FormControlLabel
                        control={
                            <Switch
                                checked={isUsed}
                                onChange={(e) => {
                                    setIsUsed(e.target.checked);
                                    if (!e.target.checked) {
                                        setTakenBy('');
                                    }
                                }}
                                color="primary"
                            />
                        }
                        label="Is Used"
                    />
                    <TextField
                        label="Purpose"
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                    />
                    {isUsed && (
                        <Dropdown
                            label="Taken By"
                            value={takenBy}
                            onChange={(val) => setTakenBy(val)}
                            options={users.map(u => ({
                                label: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username,
                                value: u.username
                            }))}
                            fullWidth
                            clearable
                            searchable
                        />
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseModal} color="inherit">
                        Cancel
                    </Button>
                    <Button type="submit" variant="contained" color="primary">
                        Save
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default IpListFormModal;
