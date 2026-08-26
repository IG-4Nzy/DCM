import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, FormControlLabel, Switch } from '@mui/material';
import TextField from '../../components/TextField';
import Dropdown from '../../components/Dropdown';
import type { IpListModel } from './model';
import { validators } from '../../helpers/validation';

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
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isModalOpen) {
            setErrors({});
        }
    }, [isModalOpen]);

    const handleLocalSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const ipErr = validators.ipv4(ip, 'IP Address');
        const purposeErr = validators.alphanumericGeneral(purpose, 100, 'Purpose');
        
        const newErrors = {
            ip: ipErr,
            purpose: purposeErr
        };
        setErrors(newErrors);

        if (ipErr || purposeErr) {
            return;
        }
        handleSubmit(e);
    };

    return (
        <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold',color:"#333" }}>
                {editingIp ? 'Edit IP' : 'Create IP'}
            </DialogTitle>
            <form onSubmit={handleLocalSubmit}>
                <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                        label="IP Address"
                        value={ip}
                        onChange={(e) => {
                            setIp(e.target.value);
                            setErrors(prev => ({ ...prev, ip: '' }));
                        }}
                        required
                        fullWidth
                        error={!!errors.ip}
                        helperText={errors.ip}
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
                        onChange={(e) => {
                            setPurpose(e.target.value);
                            setErrors(prev => ({ ...prev, purpose: '' }));
                        }}
                        fullWidth
                        multiline
                        rows={3}
                        error={!!errors.purpose}
                        helperText={errors.purpose}
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
