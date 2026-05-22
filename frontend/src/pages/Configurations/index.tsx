import { useEffect, useState } from 'react';
import styles from './index.module.scss';
import SliderTabSelector from '../../components/SliderTabSelector';
import { CONFIG_SUBTABS, CONFIG_TABS, CONFIG_TABS_PAGES } from './constant';


const Configurations = () => {
    const [activeTab, setActiveTab] = useState<string | number>(CONFIG_TABS[0].value);
    const [activeSubTab, setActiveSubTab] = useState<string | number>("")

    useEffect(() => {
        const subTabs = CONFIG_SUBTABS[activeTab as keyof typeof CONFIG_SUBTABS];
        if (subTabs && subTabs.length > 0) {
            setActiveSubTab(subTabs[0].value);
        }
    }, [activeTab]);

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