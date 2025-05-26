import React, { useState } from 'react';
import DocViewer from './DocViewer';
import styles from './DocTabs.module.css';

export default function DocTabs({ cv = '', cover = '', onEdit }) {
  const [activeTab, setActiveTab] = useState('cv');

  return (
    <div className={styles['doc-tabs-container']}>
      <div className={styles['tab-bar']}>
        <button
          onClick={() => setActiveTab('cv')}
          className={`${styles.tab} ${activeTab === 'cv' ? styles.active : ''}`}
        >
          CV
        </button>
        <button
          onClick={() => setActiveTab('cover')}
          className={`${styles.tab} ${activeTab === 'cover' ? styles.active : ''}`}
        >
          Cover Letter
        </button>
      </div>

      {activeTab === 'cv' && (
        <DocViewer
          title="CV"
          content={cv}
          onChange={(html) => onEdit?.('cv', html)}
        />
      )}

      {activeTab === 'cover' && (
        <DocViewer
          title="Cover Letter"
          content={cover}
          onChange={(html) => onEdit?.('cover', html)}
        />
      )}
    </div>
  );
}
