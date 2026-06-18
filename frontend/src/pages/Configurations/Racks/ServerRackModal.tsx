import React, { useState, useEffect } from 'react';
import { Box, Checkbox, FormControlLabel, FormGroup, FormLabel, Grid } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Button from '../../../components/Button';
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

    useEffect(() => {
        if (open) {
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
        
        const parsedCapacity = rackCapacity.trim() ? parseInt(rackCapacity, 10) : null;
        const parsedTemperature = temperature.trim() ? parseFloat(temperature) : null;
        
        const payloadData = {
            serverRack: serverRack.trim() ? serverRack : undefined,
            networksAvailable,
            rackCapacity: parsedCapacity,
            temperature: parsedTemperature,
            fanAvailable,
            sparePowerAvailability,
            sparePowerC30: sparePowerC30.trim() ? sparePowerC30 : undefined,
            sparePowerC90: sparePowerC90.trim() ? sparePowerC90 : undefined,
            remarks
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
                        onChange={(e) => setField(e.target.value)}
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
                        onChange={(e) => setRackCapacity(e.target.value)}
                        inputProps={{ min: 0 }}
                    />

                    <TextField
                        fullWidth
                        type="number"
                        label="Temperature (°C)"
                        placeholder="e.g. 24.5"
                        value={temperature}
                        onChange={(e) => setTemperature(e.target.value)}
                        inputProps={{ step: "0.1" }}
                    />

                    <Grid container spacing={2}>
                        <Grid item xs={6}>
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
                        <Grid item xs={6}>
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
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Spare Power C-30"
                                placeholder="e.g. 16 A"
                                value={sparePowerC30}
                                onChange={(e) => setSparePowerC30(e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Spare Power C-90"
                                placeholder="e.g. 16 A"
                                value={sparePowerC90}
                                onChange={(e) => setSparePowerC90(e.target.value)}
                            />
                        </Grid>
                    </Grid>

                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Remarks"
                        placeholder="Enter remarks..."
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                    />
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
