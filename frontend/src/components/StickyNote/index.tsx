import React, { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';
import { Box, IconButton, Paper, Typography, Fab, Tooltip } from '@mui/material';
import { MdClose as CloseIcon, MdStickyNote2 as NoteIcon } from 'react-icons/md';
import request from '../../services/request';
import { useToast } from '../../contexts/ToastContext';
import styles from './index.module.scss';
import { debounce } from 'lodash';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';

const StickyNote: React.FC = () => {
    const { isAuthenticated } = useSelector((state: RootState) => state.auth);
    const [enabled, setEnabled] = useState(false);
    const [isNoteVisible, setIsNoteVisible] = useState(false);
    const [content, setContent] = useState('');
    const [position, setPosition] = useState({ x: 100, y: 100 });
    const [isSaving, setIsSaving] = useState(false);
    const { showToast } = useToast();
    const nodeRef = useRef(null);
    
    // We only load profile once authenticated
    useEffect(() => {
        if (isAuthenticated) {
            fetchProfile();
            const handleProfileUpdate = () => fetchProfile();
            window.addEventListener('profileUpdated', handleProfileUpdate);
            return () => {
                window.removeEventListener('profileUpdated', handleProfileUpdate);
            };
        } else {
            setEnabled(false);
        }
    }, [isAuthenticated]);

    const fetchProfile = async () => {
        try {
            const res = await request.get('/api/auth/me');
            if (res.data.stickyNoteEnabled) {
                setEnabled(true);
                setContent(res.data.stickyNoteContent || '');
                setPosition({ 
                    x: res.data.stickyNotePositionX || 100, 
                    y: res.data.stickyNotePositionY || 100 
                });
            } else {
                setEnabled(false);
                setIsNoteVisible(false);
            }
        } catch (error) {
            console.error("Failed to load sticky note preferences", error);
        }
    };

    const saveChanges = async (newContent: string, newPosition: {x: number, y: number}, isEnabled: boolean) => {
        if (!isAuthenticated) return;
        try {
            setIsSaving(true);
            await request.put('/api/auth/me', {
                stickyNoteContent: newContent,
                stickyNotePositionX: newPosition.x,
                stickyNotePositionY: newPosition.y,
                stickyNoteEnabled: isEnabled
            });
        } catch (error) {
            console.error("Failed to save sticky note", error);
        } finally {
            setIsSaving(false);
        }
    };

    // Debounced save for content changes
    const debouncedSave = useRef(
        debounce((newContent: string, newPosition: {x: number, y: number}, isEnabled: boolean) => {
            saveChanges(newContent, newPosition, isEnabled);
        }, 1000)
    ).current;

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setContent(val);
        debouncedSave(val, position, enabled);
    };

    const handleDragStop = (e: any, data: any) => {
        const newPos = { x: data.x, y: data.y };
        setPosition(newPos);
        debouncedSave(content, newPos, enabled);
    };

    const handleClose = () => {
        setIsNoteVisible(false);
    };
    
    const handleOpen = () => {
        setIsNoteVisible(true);
    };

    if (!enabled) return null;

    return (
        <>
            {/* The Floating Action Button when the note is hidden */}
            {!isNoteVisible && (
                <Tooltip title="Open Sticky Note" placement="left">
                    <Fab 
                        color="secondary" 
                        aria-label="sticky note" 
                        onClick={handleOpen}
                        className={styles.fabButton}
                        sx={{
                            position: 'fixed',
                            bottom: 30,
                            right: 30,
                            zIndex: 9999,
                            backgroundColor: '#fce883',
                            color: '#5c5315',
                            '&:hover': {
                                backgroundColor: '#f5df71'
                            }
                        }}
                    >
                        <NoteIcon size={24} />
                    </Fab>
                </Tooltip>
            )}

            {/* The actual draggable Sticky Note */}
            {isNoteVisible && (
                <Draggable 
                    nodeRef={nodeRef} 
                    handle=".drag-handle" 
                    defaultPosition={position}
                    onStop={handleDragStop}
                >
                    <Paper ref={nodeRef} className={styles.stickyNote} elevation={6}>
                        <Box className={`drag-handle ${styles.header}`}>
                            <Typography variant="caption" className={styles.title}>
                                My Notes {isSaving && <span>(Saving...)</span>}
                            </Typography>
                            <IconButton size="small" onClick={handleClose} className={styles.closeBtn}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>
                        <textarea
                            className={styles.textarea}
                            value={content}
                            onChange={handleContentChange}
                            placeholder="Type your notes here..."
                        />
                    </Paper>
                </Draggable>
            )}
        </>
    );
};

export default StickyNote;
