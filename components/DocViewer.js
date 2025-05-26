import { useRef, useEffect } from 'react';
import { marked } from 'marked';
import styles from './DocViewer.module.css';

export default function DocViewer({ title = 'Document', content = '', onChange }) {
  const viewerRef = useRef();

  useEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.innerHTML = marked.parse(content || '');
    }
  }, [content]);

  const handleInput = () => {
    if (onChange && viewerRef.current) {
      onChange(viewerRef.current.innerHTML);
    }
  };

  return (
    <div className={styles['doc-container']}>
      <h2 className={styles['doc-title']}>{title}</h2>
      <div
        ref={viewerRef}
        className={`${styles['doc-viewer']} ${styles['editable-text']}`}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
      />
      <svg className={styles['watermark-overlay']} viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" opacity="0.05" fontSize="40" transform="rotate(-30, 200, 200)">
          Confidential
        </text>
      </svg>
    </div>
  );
}
