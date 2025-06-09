// /components/cardTools.js

import React from 'react';
import {
  LayoutDashboard,
  FileText,
  CheckCircle2,
  Briefcase,
  BookOpen,
  User
} from 'lucide-react';

const tools = [
  { key: 'dashboard', icon: <LayoutDashboard size={28} />, label: 'Dashboard' },
  { key: 'cvmeta', icon: <FileText size={28} />, label: 'CV Data' },
  { key: 'cvreview', icon: <CheckCircle2 size={28} />, label: 'CV Review' },
  { key: 'jobmeta', icon: <Briefcase size={28} />, label: 'Job Data' },
  { key: 'docs', icon: <BookOpen size={28} />, label: 'Documents' },
  { key: 'user', icon: <User size={28} />, label: 'User' }
];

export default function CardTools({ active, onSelect }) {
  return (
    <aside
      style={{
        width: 70,
        minWidth: 70,
        background: 'linear-gradient(to bottom, var(--primary-blue) 0%, var(--base-white) 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 20,
        position: 'fixed',
        top: 60,
        left: 0,
        bottom: 0,
        zIndex: 9,
        borderRight: 'none',
      }}
    >
      {tools.map(({ key, icon, label }) => (
        <button
          key={key}
          onClick={() => onSelect?.(key)}
          title={label}
          style={{
            width: 50,
            height: 50,
            margin: '14px 0',
            background: active === key
              ? 'var(--primary-blue)'
              : 'rgba(255,255,255,0.40)',
            border: 'none',
            borderRadius: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: active === key
              ? '0 2px 8px 0 rgba(11,75,127,0.12)'
              : 'none',
            transition: 'background 0.18s, box-shadow 0.18s'
          }}
        >
          {React.cloneElement(icon, {
            color: active === key ? '#fff' : 'var(--primary-blue)'
          })}
        </button>
      ))}
    </aside>
  );
}
