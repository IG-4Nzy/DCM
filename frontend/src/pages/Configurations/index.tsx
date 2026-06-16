import { useEffect, useState } from 'react';
import styles from './index.module.scss';
import SliderTabSelector from '../../components/SliderTabSelector';
import { CONFIG_SUBTABS, CONFIG_TABS, CONFIG_TABS_PAGES } from './constant';
import { useSelector } from 'react-redux';
import { type RootState } from '../../store';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';

const Configurations = () => {
    const { isSuperuser } = useSelector((state: RootState) => state.auth);

    const isSubTabAllowed = (subTabId: string) => {
        if (isSuperuser) return true;
        switch (subTabId) {
            case 'clusterTypes':
            case 'hypervisors':
            case 'serverModel':
            case 'attendancePeriod':
            case 'notificationSettings':
                return hasPrivilege(PRIVILEGES.CONFIGURATION_VIEW);
            case 'requestRoutings':
                return hasPrivilege(PRIVILEGES.REQUEST_VIEW) || hasPrivilege(PRIVILEGES.CONFIGURATION_VIEW);
            case 'bmsChecklistFields':
                return hasPrivilege(PRIVILEGES.BMS_CHECKLIST_VIEW) || hasPrivilege(PRIVILEGES.BMS_CHECKLIST_FIELD_EDIT) || hasPrivilege(PRIVILEGES.CONFIGURATION_VIEW);
            case 'morningChecklistFields':
                return hasPrivilege(PRIVILEGES.MORNING_CHECKLIST_VIEW) || hasPrivilege(PRIVILEGES.MORNING_CHECKLIST_FIELD_EDIT) || hasPrivilege(PRIVILEGES.CONFIGURATION_VIEW);
            default:
                return false;
        }
    };

    const allowedSubTabs = (tabId: string) => {
        const subTabs = CONFIG_SUBTABS[tabId as keyof typeof CONFIG_SUBTABS] || [];
        return subTabs.filter(st => isSubTabAllowed(st.value));
    };

    const allowedTabs = CONFIG_TABS.filter(tab => allowedSubTabs(tab.value).length > 0);

    const [activeTab, setActiveTab] = useState<string | number>(() => {
        const saved = localStorage.getItem('configurations_activeTab');
        if (saved && allowedTabs.some(tab => String(tab.value) === saved)) {
            return saved;
        }
        return allowedTabs.length > 0 ? allowedTabs[0].value : "";
    });

    const [activeSubTab, setActiveSubTab] = useState<string | number>(() => {
        const saved = localStorage.getItem('configurations_activeSubTab');
        if (saved && activeTab) {
            const subTabs = allowedSubTabs(String(activeTab));
            if (subTabs.some(subTab => String(subTab.value) === saved)) {
                return saved;
            }
        }
        const subTabs = activeTab ? allowedSubTabs(String(activeTab)) : [];
        return subTabs.length > 0 ? subTabs[0].value : "";
    });

    useEffect(() => {
        if (!activeTab) return;
        localStorage.setItem('configurations_activeTab', String(activeTab));
        const subTabs = allowedSubTabs(String(activeTab));
        if (subTabs.length > 0) {
            const hasSubTab = subTabs.some(st => String(st.value) === String(activeSubTab));
            if (!hasSubTab) {
                setActiveSubTab(subTabs[0].value);
            }
        } else {
            setActiveSubTab("");
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeSubTab) {
            localStorage.setItem('configurations_activeSubTab', String(activeSubTab));
        }
    }, [activeSubTab]);

    if (allowedTabs.length === 0) {
        return (
            <div className={styles.container} style={{ padding: '24px', textAlign: 'center' }}>
                <label style={{ color: '#ff4d4f', fontSize: "24px", fontWeight: 'bold' }}>Access Denied</label>
                <p style={{ color: '#666', marginTop: '16px' }}>You do not have privileges to access Configurations.</p>
            </div>
        );
    }

    return (
        <div className={styles.container} style={{ padding: '8px' }}>
            <label style={{ color: '#333', fontSize: "24px" }}>Configurations</label>
            <SliderTabSelector
                tabs={allowedTabs}
                activeTab={activeTab}
                onChange={setActiveTab}
            />

            <SliderTabSelector
                tabs={allowedSubTabs(String(activeTab))}
                activeTab={activeSubTab}
                onChange={setActiveSubTab}
            />
            {activeSubTab && CONFIG_TABS_PAGES[activeSubTab as keyof typeof CONFIG_TABS_PAGES] && (() => {
                const ActivePage = CONFIG_TABS_PAGES[activeSubTab as keyof typeof CONFIG_TABS_PAGES];
                return <ActivePage />;
            })()}
        </div>
    );
};

export default Configurations;