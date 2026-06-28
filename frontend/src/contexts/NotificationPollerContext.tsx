import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store';
import { fetchUsers } from '../pages/Users/action';
import { hasPrivilege } from '../helpers/authUtils';
import { PRIVILEGES } from '../helpers/privileges';
import request from '../services/request';
import { useToast } from './ToastContext';
import dayjs from 'dayjs';

interface WorkItem {
  id?: string;
  _id?: string;
  workName: string;
  assignee: string;
  status: string;
  priority: string;
  createdAt: string;
}

interface NotificationPollerContextType {
  works: WorkItem[];
  requests: any[];
  announcements: any[];
  periodicActivities: any[];
  loading: boolean;
  countdown: number;
  soundEnabled: boolean;
  setSoundEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  volume: number;
  setVolume: React.Dispatch<React.SetStateAction<number>>;
  newWorkAlerts: string[];
  newRequestAlerts: string[];
  newAnnouncementAlerts: string[];
  newPeriodicAlerts: string[];
  fetchMonitoredData: (silent?: boolean) => Promise<void>;
}

const NotificationPollerContext = createContext<NotificationPollerContextType | undefined>(undefined);

// Audio and TTS helpers
let sharedAudioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioContext = new AudioContextClass();
    }
  }
  return sharedAudioContext;
};

if (typeof window !== 'undefined') {
  const resumeAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(err => console.error("Failed to resume AudioContext:", err));
    }
  };
  window.addEventListener('click', resumeAudio, { capture: true, passive: true });
  window.addEventListener('keydown', resumeAudio, { capture: true, passive: true });
}

export const playBeep = (volume: number = 0.5) => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    console.error('Failed to play beep sound:', e);
  }
};

export const playTTS = (text: string, volume: number = 0.5) => {
  try {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = volume;

    if (window.speechSynthesis.getVoices) {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const enVoice = voices.find(v => v.lang.startsWith('en') || v.lang.includes('en'));
        if (enVoice) {
          utterance.voice = enVoice;
        }
      }
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.error('Failed to play text to speech:', e);
  }
};

const getStoredAlertedIds = (key: string): Set<string> => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
};

const saveStoredAlertedIds = (key: string, set: Set<string>) => {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.error(e);
  }
};

const triggerDesktopNotification = (title: string, body: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico'
      });
    } catch (e) {
      console.error('Failed to trigger desktop notification:', e);
    }
  }
};

export const NotificationPollerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, isSuperuser, username } = useSelector((state: RootState) => state.auth);
  const { users = [] } = useSelector((state: RootState) => state.users || { users: [] });

  const canView = isAuthenticated && (
    isSuperuser || 
    hasPrivilege(PRIVILEGES.NOTIFICATION_TRIGGERING_VIEW) || 
    hasPrivilege(PRIVILEGES.NOTIFICATION_TRIGGERING_VIEW_DEPT) || 
    hasPrivilege(PRIVILEGES.NOTIFICATION_TRIGGERING_VIEW_OWN)
  );

  const canViewRequests = isSuperuser || hasPrivilege(PRIVILEGES.REQUEST_VIEW);
  const canViewAnnouncements = isSuperuser || hasPrivilege(PRIVILEGES.ANNOUNCEMENT_VIEW);
  const canViewPeriodicActivities = isSuperuser || hasPrivilege(PRIVILEGES.PERIODIC_ACTIVITY_VIEW);

  const [works, setWorks] = useState<WorkItem[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [periodicActivities, setPeriodicActivities] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(0.5);
  const [countdown, setCountdown] = useState(30);

  const [newWorkAlerts, setNewWorkAlerts] = useState<string[]>([]);
  const [newRequestAlerts, setNewRequestAlerts] = useState<string[]>([]);
  const [newAnnouncementAlerts, setNewAnnouncementAlerts] = useState<string[]>([]);
  const [newPeriodicAlerts, setNewPeriodicAlerts] = useState<string[]>([]);

  const [settings, setSettings] = useState({
    announcement_text: 'new announcement published',
    announcement_sound_type: 'tts',
    announcement_roles: [] as string[],
    work_text: 'new work has been assigned',
    work_sound_type: 'tts',
    work_roles: [] as string[],
    request_text: 'New request has been assigned.',
    request_sound_type: 'tts',
    request_roles: [] as string[],
    periodic_text: 'periodic activity alert',
    periodic_sound_type: 'tts',
    periodic_roles: [] as string[]
  });

  const knownWorkIdsRef = useRef<Set<string>>(new Set());
  const knownRequestIdsRef = useRef<Set<string>>(new Set());
  const knownAnnouncementIdsRef = useRef<Set<string>>(new Set());
  const knownPeriodicActivityIdsRef = useRef<Set<string>>(new Set());

  const isInitialLoadRef = useRef(true);
  const { showToast } = useToast();

  const usersRef = useRef(users);
  const settingsRef = useRef(settings);
  const soundEnabledRef = useRef(soundEnabled);
  const volumeRef = useRef(volume);

  const notificationQueueRef = useRef<('work' | 'request' | 'announcement' | 'periodic')[]>([]);
  const isProcessingQueueRef = useRef<boolean>(false);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const fetchSettings = async () => {
    try {
      const res = await request.get('/api/notifications/settings');
      if (res.data) {
        setSettings(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch notification settings', err);
    }
  };

  const playNotification = async (type: 'work' | 'request' | 'announcement' | 'periodic') => {
    if (!soundEnabledRef.current) return;
    const setts = settingsRef.current;
    const vol = volumeRef.current;

    if (type === 'work') {
      if (setts.work_sound_type === 'beep') {
        playBeep(vol);
      } else {
        playTTS(setts.work_text || 'new work has been assigned', vol);
      }
    } else if (type === 'request') {
      if (setts.request_sound_type === 'beep') {
        playBeep(vol);
      } else {
        playTTS(setts.request_text || 'New request has been assigned.', vol);
      }
    } else if (type === 'periodic') {
      if (setts.periodic_sound_type === 'beep') {
        playBeep(vol);
      } else {
        playTTS(setts.periodic_text || 'periodic activity alert', vol);
      }
    } else if (type === 'announcement') {
      if (setts.announcement_sound_type === 'beep') {
        playBeep(vol);
      } else {
        playTTS(setts.announcement_text || 'new announcement published', vol);
      }
    }
  };

  const processQueue = async () => {
    if (isProcessingQueueRef.current) return;
    if (notificationQueueRef.current.length === 0) return;

    isProcessingQueueRef.current = true;
    while (notificationQueueRef.current.length > 0) {
      const item = notificationQueueRef.current.shift();
      if (item) {
        await playNotification(item);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    isProcessingQueueRef.current = false;
  };

  const fetchMonitoredData = async (silent = false) => {
    if (!canView) return;
    if (!silent) setLoading(true);
    try {
      const currentUsers = usersRef.current;
      const loggedInUser = currentUsers?.find((u: any) => u.username === username);
      const userDept = loggedInUser?.department;

      const isFull = isSuperuser || hasPrivilege(PRIVILEGES.NOTIFICATION_TRIGGERING_VIEW);
      const isDept = hasPrivilege(PRIVILEGES.NOTIFICATION_TRIGGERING_VIEW_DEPT);
      const scope = isFull ? 'all' : (isDept ? 'dept' : 'own');

      // 1. Fetch pending & in progress works
      let pendingList: WorkItem[] = [];
      try {
        const res = await request.get('/api/works', {
          params: {
            skip: 0,
            limit: 100,
            status: 'All'
          }
        });
        const rawList = res.data.data || [];
        pendingList = rawList.filter((work: WorkItem) => work.status === 'Pending' || work.status === 'In Progress');
      } catch (err) {
        console.error('Failed to fetch works', err);
      }

      // Filter works by department, roles, and scope
      const filteredPendingList = pendingList.filter((work) => {
        const assigneeUser = currentUsers.find(
          (u: any) =>
            u.id === work.assignee ||
            u._id === work.assignee ||
            u.username === work.assignee
        );

        // Scope filter
        if (scope === 'own') {
          const isAssigneeMe = work.assignee === username || (assigneeUser && assigneeUser.username === username);
          if (!isAssigneeMe) return false;
        } else if (scope === 'dept') {
          if (userDept && assigneeUser?.department !== userDept) {
            return false;
          }
        } else {
          if (userDept && assigneeUser?.department !== userDept) {
            return false;
          }
        }

        // Roles matching
        const setts = settingsRef.current;
        if (setts.work_roles && setts.work_roles.length > 0) {
          if (!assigneeUser || !assigneeUser.role) return false;
          return setts.work_roles.includes(assigneeUser.role);
        }
        return true;
      });

      // 2. Fetch requests
      let requestsList: any[] = [];
      if (canViewRequests) {
        try {
          const res = await request.get('/api/requests/', {
            params: { skip: 0, limit: 100 }
          });
          requestsList = res.data.data || [];
        } catch (err) {
          console.error('Failed to fetch requests', err);
        }
      }

      const filteredRequestsList = requestsList.filter((req) => {
        if (req.status === 'Completed' || req.status === 'Rejected') {
          return false;
        }

        const requestAssignees = req.currentAssignedUsers || [];
        if (requestAssignees.length === 0) {
          return false;
        }

        // Scope filter
        if (scope === 'own') {
          const isAssignedToMe = requestAssignees.includes(username);
          const isCreatedByMe = req.createdBy === username;
          if (!isAssignedToMe && !isCreatedByMe) return false;
        } else if (scope === 'dept') {
          const creatorUser = currentUsers.find((u: any) => u.username === req.createdBy);
          const isCreatorInDept = !!(creatorUser && creatorUser.department === userDept);
          const isAnyAssigneeInDept = requestAssignees.some((assignee: string) => {
            const uObj = currentUsers.find((u: any) => u.username === assignee);
            return uObj && uObj.department === userDept;
          });
          if (!isCreatorInDept && !isAnyAssigneeInDept) return false;
        }

        // Roles matching
        const setts = settingsRef.current;
        if (setts.request_roles && setts.request_roles.length > 0) {
          return requestAssignees.some((assignee: string) => {
            const uObj = currentUsers.find((u: any) => u.username === assignee);
            return uObj && uObj.role && setts.request_roles.includes(uObj.role);
          });
        }
        return true;
      });

      // 3. Fetch announcements
      let announcementsList: any[] = [];
      if (canViewAnnouncements) {
        try {
          const res = await request.get('/api/announcements', {
            params: { skip: 0, limit: 100 }
          });
          announcementsList = res.data.data || [];
        } catch (err) {
          console.error('Failed to fetch announcements', err);
        }
      }

      const filteredAnnouncementsList = announcementsList.filter((ann) => {
        // Scope filter
        if (scope === 'own') {
          if (ann.createdBy !== username) return false;
        } else if (scope === 'dept') {
          const creatorUser = currentUsers.find((u: any) => u.username === ann.createdBy);
          const isCreatorInDept = !!(creatorUser && creatorUser.department === userDept);
          const isTargetingDept = ann.department === userDept || ann.department === 'All' || !ann.department;
          if (!isCreatorInDept && !isTargetingDept) return false;
        }

        const setts = settingsRef.current;
        if (setts.announcement_roles && setts.announcement_roles.length > 0) {
          const creatorUser = currentUsers.find((u: any) => u.username === ann.createdBy);
          if (!creatorUser || !creatorUser.role) return false;
          return setts.announcement_roles.includes(creatorUser.role);
        }
        return true;
      });

      // 4. Fetch periodic activities
      let periodicActivitiesList: any[] = [];
      if (canViewPeriodicActivities) {
        try {
          const res = await request.get('/api/periodic-activities', {
            params: { skip: 0, limit: 100 }
          });
          periodicActivitiesList = res.data.data || [];
        } catch (err) {
          console.error('Failed to fetch periodic activities', err);
        }
      }

      const filteredPeriodicActivitiesList = periodicActivitiesList.filter((act) => {
        const diffDays = dayjs(act.dueDate).diff(dayjs().startOf('day'), 'day');
        if (diffDays !== 7 && diffDays !== 0) {
          return false;
        }

        // Scope filter
        if (scope === 'own' || scope === 'dept') {
          if (act.department && act.department !== userDept) {
            return false;
          }
        }

        const setts = settingsRef.current;

        // Additional filter for own scope
        if (scope === 'own') {
          const loggedInUserObj = currentUsers.find((u: any) => u.username === username);
          if (setts.periodic_roles && setts.periodic_roles.length > 0) {
            if (!loggedInUserObj || !loggedInUserObj.role || !setts.periodic_roles.includes(loggedInUserObj.role)) {
              return false;
            }
          }
        }

        if (setts.periodic_roles && setts.periodic_roles.length > 0) {
          const dept = act.department;
          if (dept) {
            return currentUsers.some(
              (u: any) =>
                u.department === dept && u.role && setts.periodic_roles.includes(u.role)
            );
          } else {
            return currentUsers.some(
              (u: any) => u.role && setts.periodic_roles.includes(u.role)
            );
          }
        }
        return true;
      });

      const workIds = filteredPendingList.map(w => w.id || w._id || '');
      const requestIds = filteredRequestsList.map(r => r.id || r._id || '');
      const announcementIds = filteredAnnouncementsList.map(a => a.id || a._id || '');
      const periodicActivityIds = filteredPeriodicActivitiesList.map(p => p.id || p._id || '');

      const storedWorkIds = getStoredAlertedIds('alerted_work_ids');
      const storedRequestIds = getStoredAlertedIds('alerted_request_ids');
      const storedAnnouncementIds = getStoredAlertedIds('alerted_announcement_ids');
      const storedPeriodicIds = getStoredAlertedIds('alerted_periodic_ids');

      if (isInitialLoadRef.current) {
        knownWorkIdsRef.current = new Set([...workIds, ...storedWorkIds]);
        knownRequestIdsRef.current = new Set([...requestIds, ...storedRequestIds]);
        knownAnnouncementIdsRef.current = new Set([...announcementIds, ...storedAnnouncementIds]);
        knownPeriodicActivityIdsRef.current = new Set([...periodicActivityIds, ...storedPeriodicIds]);
        
        saveStoredAlertedIds('alerted_work_ids', knownWorkIdsRef.current);
        saveStoredAlertedIds('alerted_request_ids', knownRequestIdsRef.current);
        saveStoredAlertedIds('alerted_announcement_ids', knownAnnouncementIdsRef.current);
        saveStoredAlertedIds('alerted_periodic_ids', knownPeriodicActivityIdsRef.current);
        
        isInitialLoadRef.current = false;
      } else {
        let hasNewWork = false;
        let hasNewRequest = false;
        let hasNewAnnouncement = false;
        let hasNewPeriodicActivity = false;

        const freshWorks: string[] = [];
        const freshRequests: string[] = [];
        const freshAnnouncements: string[] = [];
        const freshPeriodics: string[] = [];

        workIds.forEach(id => {
          if (id && !knownWorkIdsRef.current.has(id)) {
            knownWorkIdsRef.current.add(id);
            freshWorks.push(id);
            hasNewWork = true;
          }
        });
        if (hasNewWork) {
          saveStoredAlertedIds('alerted_work_ids', knownWorkIdsRef.current);
        }

        requestIds.forEach(id => {
          if (id && !knownRequestIdsRef.current.has(id)) {
            knownRequestIdsRef.current.add(id);
            freshRequests.push(id);
            hasNewRequest = true;
          }
        });
        if (hasNewRequest) {
          saveStoredAlertedIds('alerted_request_ids', knownRequestIdsRef.current);
        }

        announcementIds.forEach(id => {
          if (id && !knownAnnouncementIdsRef.current.has(id)) {
            knownAnnouncementIdsRef.current.add(id);
            freshAnnouncements.push(id);
            hasNewAnnouncement = true;
          }
        });
        if (hasNewAnnouncement) {
          saveStoredAlertedIds('alerted_announcement_ids', knownAnnouncementIdsRef.current);
        }

        periodicActivityIds.forEach(id => {
          if (id && !knownPeriodicActivityIdsRef.current.has(id)) {
            knownPeriodicActivityIdsRef.current.add(id);
            freshPeriodics.push(id);
            hasNewPeriodicActivity = true;
          }
        });
        if (hasNewPeriodicActivity) {
          saveStoredAlertedIds('alerted_periodic_ids', knownPeriodicActivityIdsRef.current);
        }

        // Trigger notifications if needed
        const triggerList: ('work' | 'request' | 'announcement' | 'periodic')[] = [];
        if (hasNewWork) triggerList.push('work');
        if (hasNewRequest) triggerList.push('request');
        if (hasNewAnnouncement) triggerList.push('announcement');
        if (hasNewPeriodicActivity) triggerList.push('periodic');

        if (triggerList.length > 0) {
          if (hasNewWork) {
            setNewWorkAlerts(prev => [...prev, ...freshWorks]);
            showToast('New pending work detected!', 'info');
            triggerDesktopNotification('DCM: New Work', settingsRef.current.work_text || 'New work has been assigned.');
          }
          if (hasNewRequest) {
            setNewRequestAlerts(prev => [...prev, ...freshRequests]);
            showToast('New request assigned!', 'info');
            triggerDesktopNotification('DCM: New Request', settingsRef.current.request_text || 'New request has been assigned.');
          }
          if (hasNewAnnouncement) {
            setNewAnnouncementAlerts(prev => [...prev, ...freshAnnouncements]);
            showToast('New announcement published!', 'info');
            triggerDesktopNotification('DCM: New Announcement', settingsRef.current.announcement_text || 'New announcement published.');
          }
          if (hasNewPeriodicActivity) {
            setNewPeriodicAlerts(prev => [...prev, ...freshPeriodics]);
            showToast('New periodic activity alert!', 'info');
            triggerDesktopNotification('DCM: Periodic Activity', settingsRef.current.periodic_text || 'Periodic activity alert.');
          }

          // Add to queue and process
          triggerList.forEach(item => {
            if (!notificationQueueRef.current.includes(item)) {
              notificationQueueRef.current.push(item);
            }
          });
          processQueue();
        }
      }

      // Sort and slice to last 5 data elements
      setWorks(filteredPendingList.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()).slice(0, 5));
      setRequests(filteredRequestsList.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()).slice(0, 5));
      setAnnouncements(filteredAnnouncementsList.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()).slice(0, 5));
      setPeriodicActivities(filteredPeriodicActivitiesList.sort((a, b) => new Date(b.createdAt || b.dueDate || '').getTime() - new Date(a.createdAt || a.dueDate || '').getTime()).slice(0, 5));

    } catch (err) {
      console.error('Failed to fetch monitored data', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      dispatch(fetchUsers({
        pagination: false,
        showToast: undefined
      }));
      fetchSettings();

      // Request browser notification permission
      if ('Notification' in window) {
        if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }
    }
  }, [dispatch, canView]);

  const hasLoadedUsersRef = useRef(false);

  useEffect(() => {
    if (canView && users.length > 0 && !hasLoadedUsersRef.current) {
      hasLoadedUsersRef.current = true;
      fetchMonitoredData();
    }
  }, [canView, users]);

  // Countdown timer for 30 seconds refresh
  useEffect(() => {
    if (!canView) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchMonitoredData(true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [canView]);

  return (
    <NotificationPollerContext.Provider value={{
      works,
      requests,
      announcements,
      periodicActivities,
      loading,
      countdown,
      soundEnabled,
      setSoundEnabled,
      volume,
      setVolume,
      newWorkAlerts,
      newRequestAlerts,
      newAnnouncementAlerts,
      newPeriodicAlerts,
      fetchMonitoredData
    }}>
      {children}
    </NotificationPollerContext.Provider>
  );
};

export const useNotificationPoller = () => {
  const context = useContext(NotificationPollerContext);
  if (context === undefined) {
    throw new Error('useNotificationPoller must be used within a NotificationPollerProvider');
  }
  return context;
};
