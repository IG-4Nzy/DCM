import React, { useState, useEffect } from 'react';
import { Box, Checkbox, FormControlLabel, FormGroup, FormLabel, Grid } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Button from '../../../components/Button';
import { validators } from '../../../helpers/validation';
import { type ServerRackData, type CreateServerRackPayload, type UpdateServerRackPayload } from './model';

interface ServerRackModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: CreateServerRackPayload | UpdateServerRackPayload) => void;
    editingItem: ServerRackData | null;
}

const ServerRackModal: React.FC<ServerRackModalProps> = ({ open, onClose, onSubmit, editingItem }) => {
    const [serverRack, setField] = useState('');
    const [networksAvailable, setNetworksAvailable] = useState<string[]>([]);
    const [rackCapacity, setRackCapacity] = useState('');
    const [temperature, setTemperature] = useState('');
    const [fanAvailable, setFanAvailable] = useState(false);
    const [sparePowerAvailability, setSparePowerAvailability] = useState(false);
    const [sparePowerC30, setSparePowerC30] = useState('');
    const [sparePowerC90, setSparePowerC90] = useState('');
    const [remarks, setRemarks] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (open) {
            setErrors({});
            if (editingItem) {
                setField(editingItem.serverRack || '');
                setNetworksAvailable(editingItem.networksAvailable || []);
                setRackCapacity(editingItem.rackCapacity !== undefined && editingItem.rackCapacity !== null ? String(editingItem.rackCapacity) : '');
                setTemperature(editingItem.temperature !== undefined && editingItem.temperature !== null ? String(editingItem.temperature) : '');
                setFanAvailable(!!editingItem.fanAvailable);
                setSparePowerAvailability(!!editingItem.sparePowerAvailability);
                setSparePowerC30(editingItem.sparePowerC30 || '');
                setSparePowerC90(editingItem.sparePowerC90 || '');
                setRemarks(editingItem.remarks || '');
            } else {
                setField('');
                setNetworksAvailable([]);
                setRackCapacity('');
                setTemperature('');
                setFanAvailable(false);
                setSparePowerAvailability(false);
                setSparePowerC30('');
                setSparePowerC90('');
                setRemarks('');
            }
        }
    }, [open, editingItem]);

    const handleNetworkChange = (network: string, checked: boolean) => {
        if (checked) {
            setNetworksAvailable([...networksAvailable, network]);
        } else {
            setNetworksAvailable(networksAvailable.filter((n) => n !== network));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const rackErr = validators.alphanumericSpaces(serverRack, 50, "Server Rack Name");
        
        let capacityErr = '';
        if (rackCapacity.trim()) {
            const val = parseInt(rackCapacity, 10);
            if (isNaN(val) || val < 0 || val > 100) {
                capacityErr = "Rack capacity must be between 0 and 100 U";
            }
        }
        
        let tempErr = '';
        if (temperature.trim()) {
            const val = parseFloat(temperature);
            if (isNaN(val) || val < -50 || val > 100) {
                tempErr = "Temperature must be between -50°C and 100°C";
            }
        }

        const c30Err = validators.alphanumericSpaces(sparePowerC30, 50, "Spare Power C-30");
        const c90Err = validators.alphanumericSpaces(sparePowerC90, 50, "Spare Power C-90");
        const remarksErr = validators.alphanumericGeneral(remarks, 125, "Remarks");

        const newErrors = {
            serverRack: rackErr,
            rackCapacity: capacityErr,
            temperature: tempErr,
            sparePowerC30: c30Err,
            sparePowerC90: c90Err,
            remarks: remarksErr
        };

        setErrors(newErrors);

        if (Object.values(newErrors).some(err => !!err)) {
            return;
        }

        const parsedCapacity = rackCapacity.trim() ? parseInt(rackCapacity, 10) : null;
        const parsedTemperature = temperature.trim() ? parseFloat(temperature) : null;
        
        const payloadData = {
            serverRack: serverRack.trim() ? serverRack.trim() : undefined,
            networksAvailable,
            rackCapacity: parsedCapacity,
            temperature: parsedTemperature,
            fanAvailable,
            sparePowerAvailability,
            sparePowerC30: sparePowerC30.trim() ? sparePowerC30.trim() : undefined,
            sparePowerC90: sparePowerC90.trim() ? sparePowerC90.trim() : undefined,
            remarks: remarks.trim()
        };

        if (editingItem) {
            onSubmit({ id: editingItem.id, ...payloadData });
        } else {
            onSubmit(payloadData);
        }
    };

    return (
        <Modal
            open={open}
            handleClose={onClose}
            title={editingItem ? 'Edit Server Rack' : 'Add Server Rack'}
            maxWidth="sm"
        >
            <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
                    <TextField
                        fullWidth
                        label="Server Rack Name"
                        placeholder="Rack A1"
                        value={serverRack}
                        onChange={(e) => {
                            setField(e.target.value);
                            setErrors(prev => ({ ...prev, serverRack: '' }));
                        }}
                        required
                        error={!!errors.serverRack}
                        helperText={errors.serverRack}
                    />

                    <Box>
                        <FormLabel sx={{ display: 'block', mb: 1, fontWeight: 500, fontSize: '0.875rem' }}>
                            Networks Available
                        </FormLabel>
                        <FormGroup row>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={networksAvailable.includes('internet')}
                                        onChange={(e) => handleNetworkChange('internet', e.target.checked)}
                                    />
                                }
                                label="Internet"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={networksAvailable.includes('intranet')}
                                        onChange={(e) => handleNetworkChange('intranet', e.target.checked)}
                                    />
                                }
                                label="Intranet"
                            />
                        </FormGroup>
                    </Box>

                    <TextField
                        fullWidth
                        type="number"
                        label="Rack Capacity (U)"
                        placeholder="e.g. 42"
                        value={rackCapacity}
                        onChange={(e) => {
                            setRackCapacity(e.target.value);
                            setErrors(prev => ({ ...prev, rackCapacity: '' }));
                        }}
                        slotProps={{ htmlInput: { min: 0 } }}
                        error={!!errors.rackCapacity}
                        helperText={errors.rackCapacity}
                    />

                    <TextField
                        fullWidth
                        type="number"
                        label="Temperature (°C)"
                        placeholder="e.g. 24.5"
                        value={temperature}
                        onChange={(e) => {
                            setTemperature(e.target.value);
                            setErrors(prev => ({ ...prev, temperature: '' }));
                        }}
                        slotProps={{ htmlInput: { step: "0.1" } }}
                        error={!!errors.temperature}
                        helperText={errors.temperature}
                    />

                    <Grid container spacing={2}>
                        <Grid size={{xs: 6}}  >
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={fanAvailable}
                                        onChange={(e) => setFanAvailable(e.target.checked)}
                                    />
                                }
                                label="Fan Available?"
                            />
                        </Grid>
                        <Grid size={{xs: 6}}  >
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={sparePowerAvailability}
                                        onChange={(e) => setSparePowerAvailability(e.target.checked)}
                                    />
                                }
                                label="Spare Power Available?"
                            />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2}>
                        <Grid size={{xs: 6}}  >
                            <TextField
                                fullWidth
                                label="Spare Power C-30"
                                placeholder="e.g. 16 A"
                                value={sparePowerC30}
                                onChange={(e) => {
                                    setSparePowerC30(e.target.value);
                                    setErrors(prev => ({ ...prev, sparePowerC30: '' }));
                                }}
                                error={!!errors.sparePowerC30}
                                helperText={errors.sparePowerC30}
                            />
                        </Grid>
                        <Grid size={{xs: 6}}  >
                            <TextField
                                fullWidth
                                label="Spare Power C-90"
                                placeholder="e.g. 16 A"
                                value={sparePowerC90}
                                onChange={(e) => {
                                    setSparePowerC90(e.target.value);
                                    setErrors(prev => ({ ...prev, sparePowerC90: '' }));
                                }}
                                error={!!errors.sparePowerC90}
                                helperText={errors.sparePowerC90}
                            />
                        </Grid>
                    </Grid>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Remarks"
                            placeholder="Enter remarks..."
                            value={remarks}
                            onChange={(e) => {
                                setRemarks(e.target.value);
                                setErrors(prev => ({ ...prev, remarks: '' }));
                            }}
                            error={!!errors.remarks}
                            helperText={errors.remarks}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {remarks ? remarks.length : 0} / 125
                            </span>
                        </div>
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
                    <Button variant="text" onClick={onClose} style={{ color: '#637381' }}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="contained" color="primary">
                        {editingItem ? 'Update' : 'Save'}
                    </Button>
                </Box>
            </form>
        </Modal>
    );
};

export default ServerRackModal;
