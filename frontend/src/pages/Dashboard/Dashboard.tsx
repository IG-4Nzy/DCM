import React from 'react';
import styles from "./index.module.scss";
import wordings from '../../helpers/wordings';

const Dashboard: React.FC = () => {
  return (
    <main className={styles.dashboard}>
      <label>{wordings.comingSoon}</label>
    </main>
  );
};

export default Dashboard;
