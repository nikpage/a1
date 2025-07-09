// components/CV-Cover-Display.js

import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

const markdownComponents = {
  h1: ({ node, ...props }) => (
    <h1 className="text-4xl font-bold text-gray-900 mb-2 text-center" {...props} />
  ),
  h2: ({ node, ...props }) => {
    const isFirstH2 = !node?.parent?.children?.slice(0, node.parent.children.indexOf(node))
      .some(child => child.tagName === 'h2');
    return (
      <div>
        {!isFirstH2 && <div style={{ pageBreakBefore: 'always' }} />}
        <h2 className="text-lg font-semibold text-blue-700 mt-8 mb-4 uppercase tracking-wide" {...props} />
      </div>
    );
  },
  h3: ({ node, ...props }) => (
    <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-1" {...props} />
  ),
  h4: ({ node, ...props }) => (
    <h4 className="text-base font-medium text-gray-600 mt-1 mb-3" {...props} />
  ),
  p: ({ node, ...props }) => (
    <p className="mb-4 text-gray-700 leading-relaxed text-base" {...props} />
  ),
  ul: ({ node, children, ...props }) => {
    const parentText = node?.parent?.children?.find(child =>
      child.tagName === 'h2' || child.tagName === 'h3'
    )?.children?.find(c => c.type === 'text')?.value || '';
    const isTarget = parentText.includes('Core Competencies') || parentText.includes('Key Achievements');
    return (
      <ul
        className={`${
          isTarget
            ? 'grid grid-cols-2 gap-x-6 gap-y-2 list-none mb-6'
            : 'list-disc pl-5 mb-4 space-y-1'
        }`}
        {...props}
      >
        {children}
      </ul>
    );
  },
  li: ({ node, ...props }) => (
    <li className="text-gray-700 leading-relaxed text-base" {...props} />
  ),
  strong: ({ node, ...props }) => (
    <strong className="font-semibold text-gray-900" {...props} />
  ),
  em: ({ node, ...props }) => (
    <em className="italic text-gray-600" {...props} />
  ),
  hr: () => (
    <div style={{ pageBreakBefore: 'always' }} />
  ),
  a: ({ node, ...props }) => (
    <a className="text-blue-600 hover:text-blue-800 transition-colors" {...props} />
  ),
};

export default function CV_Cover_Display({ content, version, totalVersions }) {
  useEffect(() => {
    const container = document.querySelector('.relative.z-30');
    if (container) {
      container.scrollTop = 0;
      container.scrollIntoView({ behavior: 'smooth' });
    }
  }, [content]);

  if (!content) return null;

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 shadow-sm relative select-none"
         style={{
           userSelect: 'none',
           WebkitUserSelect: 'none',
           MozUserSelect: 'none',
           msUserSelect: 'none',
           transition: 'opacity 0.3s ease-in-out'
         }}
         onContextMenu={(e) => e.preventDefault()}
         onDragStart={(e) => e.preventDefault()}>

      <div className="absolute inset-0 pointer-events-none z-10 opacity-5"
           style={{
             backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(`
               <svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'>
                 <text x='100' y='100' font-family='Arial' font-size='16' fill='gray' text-anchor='middle' transform='rotate(-45 100 100)'>
                   CONFIDENTIAL CV
                 </text>
               </svg>
             `)}")`,
             backgroundRepeat: 'repeat',
             backgroundSize: '200px 200px'
           }}>
      </div>

      <div className="absolute inset-0 pointer-events-none z-20"
           style={{
             background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.01) 10px, rgba(255,255,255,0.01) 20px)',
             mixBlendMode: 'difference'
           }}>
      </div>

      <div className="relative z-30">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={markdownComponents}
        >
          {content}
        </ReactMarkdown>

        <div className="flex flex-col items-center mt-8 space-y-2">
          <div className="text-sm font-bold text-gray-800 mb-2">
            Version {version} of {totalVersions}
          </div>
          <div className="flex items-center justify-center space-x-6">
            <button className="action-btn">{'< Prev'}</button>
            <button className="action-btn">Regenerate</button>
            <button className="action-btn">{'Next >'}</button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media print {
          .select-none {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        .select-none {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -khtml-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
        .select-none * {
          -webkit-user-drag: none;
          -khtml-user-drag: none;
          -moz-user-drag: none;
          -o-user-drag: none;
          user-drag: none;
        }
      `}</style>
    </div>
  );
}
