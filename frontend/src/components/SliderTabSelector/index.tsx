// @ts-nocheck
import React, { useRef, useEffect, useState } from 'react';
import styles from './index.module.scss';

export interface TabItem {
  id: string;
  label: string;
  value: string | number;
}

interface SliderTabSelectorProps {
  tabs: TabItem[];
  activeTab: string | number;
  onChange: (value: string | number) => void;
}

const SliderTabSelector: React.FC<SliderTabSelectorProps> = ({ tabs, activeTab, onChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const updateSliderPosition = () => {
      const activeIndex = tabs.findIndex(t => t.value === activeTab);
      if (activeIndex !== -1 && containerRef.current) {
        const tabElements = containerRef.current.querySelectorAll(`.${styles.tab}`);
        if (tabElements[activeIndex]) {
          const activeTabElement = tabElements[activeIndex] as HTMLElement;
          setSliderStyle({
            left: activeTabElement.offsetLeft,
            width: activeTabElement.offsetWidth
          });
        }
      }
    };

    updateSliderPosition();
    window.addEventListener('resize', updateSliderPosition);
    return () => window.removeEventListener('resize', updateSliderPosition);
  }, [activeTab, tabs]);

  if (!tabs || tabs.length === 0) return null;

  return (
    <div className={`${styles.container} ${tabs.length === 1 ? styles.singleTab : ''}`} ref={containerRef}>
      <div className={styles.slider} style={sliderStyle} />
      {tabs?.map((tab) => (
        <div
          key={tab.id}
          className={`${styles.tab} ${activeTab === tab.value ? styles.active : ''}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </div>
      ))}
    </div>
  );
};

export default SliderTabSelector;
