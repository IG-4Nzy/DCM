import { useEffect, useState } from 'react';
import styles from './index.module.scss';
import SliderTabSelector from '../../components/SliderTabSelector';
import { CONFIG_SUBTABS, CONFIG_TABS, CONFIG_TABS_PAGES } from './constant';


const Configurations = () => {
    const [activeTab, setActiveTab] = useState<string | number>(() => {
        const saved = localStorage.getItem('configurations_activeTab');
        if (saved && CONFIG_TABS.some(tab => String(tab.value) === saved)) {
            return saved;
        }
        return CONFIG_TABS[0].value;
    });

    const [activeSubTab, setActiveSubTab] = useState<string | number>(() => {
        const saved = localStorage.getItem('configurations_activeSubTab');
        if (saved) {
            const subTabs = CONFIG_SUBTABS[activeTab as keyof typeof CONFIG_SUBTABS];
            if (subTabs && subTabs.some(subTab => String(subTab.value) === saved)) {
                return saved;
            }
        }
        return "";
    });

    useEffect(() => {
        localStorage.setItem('configurations_activeTab', String(activeTab));
        const subTabs = CONFIG_SUBTABS[activeTab as keyof typeof CONFIG_SUBTABS];
        if (subTabs && subTabs.length > 0) {
            const hasSubTab = subTabs.some(st => String(st.value) === String(activeSubTab));
            if (!hasSubTab) {
                setActiveSubTab(subTabs[0].value);
            }
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeSubTab) {
            localStorage.setItem('configurations_activeSubTab', String(activeSubTab));
        }
    }, [activeSubTab]);

    return (
        <div className={styles.container} style={{ padding: '8px' }}>
            <label style={{ color: '#333', fontSize: "24px" }}>Configurations</label>
            <SliderTabSelector
                tabs={CONFIG_TABS}
                activeTab={activeTab}
                onChange={setActiveTab}
            />

            <SliderTabSelector
                tabs={CONFIG_SUBTABS[activeTab as keyof typeof CONFIG_SUBTABS]}
                activeTab={activeSubTab}
                onChange={setActiveSubTab}
            />
            {activeSubTab && CONFIG_TABS_PAGES[activeSubTab as keyof typeof CONFIG_TABS_PAGES] && (() => {
                const ActivePage = CONFIG_TABS_PAGES[activeSubTab as keyof typeof CONFIG_TABS_PAGES];
                return <ActivePage />;
            })()}
        </div>
    );
}

export default Configurations