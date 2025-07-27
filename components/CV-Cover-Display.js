// components/CV-Cover-Display.js

import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

const markdownComponents = {
  h1: ({ node, ...props }) => (
    <h1 className="cv-name" {...props} />
  ),

  h2: ({ node, ...props }) => {
    const isFirstH2 = !node?.parent?.children?.slice(0, node.parent.children.indexOf(node))
      .some(child => child.tagName === 'h2');
    return (
      <div>
        {!isFirstH2 && <div style={{ pageBreakBefore: 'always' }} />}
        <h2 className="cv-section-header" {...props} />
      </div>
    );
  },

  h3: ({ node, ...props }) => (
    <h3 className="cv-job-title" {...props} />
  ),
  h4: ({ node, ...props }) => (
    <h4 className="cv-job-subtitle" {...props} />
  ),

  p: ({ node, children, ...props }) => {
    const isTopLevel = node?.parent?.type === 'root';
    const previousSibling = node?.parent?.children[node.position.index - 1];

    const isHeaderLine = isTopLevel &&
      (previousSibling?.tagName === 'h1' ||
       (previousSibling?.tagName === 'p' &&
        previousSibling?.properties?.className?.includes('text-center') &&
        previousSibling?.properties?.className?.includes('text-lg')));

    const className = isHeaderLine ? "cv-header-subtitle" : "cv-paragraph";

    return (
      <p className={className} {...props}>
        {children}
      </p>
    );
  },

  ul: ({ node, children, ...props }) => {
    const parentText = node?.parent?.children?.find(child =>
      child.tagName === 'h2' || child.tagName === 'h3'
    )?.children?.find(c => c.type === 'text')?.value || '';
    const isTarget = parentText.includes('Core Competencies') || parentText.includes('Key Achievements');

    const className = isTarget ? 'cv-skills-grid' : 'cv-bullet-list';

    return (
      <ul className={className} {...props}>
        {children}
      </ul>
    );
  },
  li: ({ node, ...props }) => (
    <li className="cv-list-item" {...props} />
  ),
  strong: ({ node, ...props }) => (
    <strong className="cv-bold" {...props} />
  ),
  em: ({ node, ...props }) => (
    <em className="cv-italic" {...props} />
  ),
  hr: () => (
    <div style={{ pageBreakBefore: 'always' }} />
  ),
  a: ({ node, ...props }) => (
    <a className="cv-link" {...props} />
  ),
};

export default function CV_Cover_Display({ content }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'PrintScreen' ||
          (e.ctrlKey && e.shiftKey && e.key === 'S') ||
          (e.ctrlKey && e.key === 'p')) {
        e.preventDefault();
        return false;
      }
    };

    const detectDevTools = () => {
      if (window.outerHeight - window.innerHeight > 200 ||
          window.outerWidth - window.innerWidth > 200) {
        document.querySelector('.protected-document')?.style.setProperty('filter', 'blur(5px)');
      } else {
        document.querySelector('.protected-document')?.style.setProperty('filter', 'none');
      }
    };

    const blendModes = ['multiply', 'screen', 'overlay', 'difference', 'color-dodge'];
    let currentModeIndex = 0;

    const rotateBlendMode = () => {
      const overlay = document.querySelector('.dynamic-overlay');
      if (overlay) {
        overlay.style.mixBlendMode = blendModes[currentModeIndex];
        currentModeIndex = (currentModeIndex + 1) % blendModes.length;
      }
    };

    const container = document.querySelector('.relative.z-30');
    if (container) {
      container.scrollTop = 0;
      container.scrollIntoView({ behavior: 'smooth' });
    }

    document.addEventListener('keydown', handleKeyDown);
    const devToolsInterval = setInterval(detectDevTools, 100);
    const blendModeInterval = setInterval(rotateBlendMode, 3000);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearInterval(devToolsInterval);
      clearInterval(blendModeInterval);
    };
  }, [content]);

  if (!content) return null;

  return (
    <div className="cv-doc-container protected-document"
         style={{
           userSelect: 'none',
           WebkitUserSelect: 'none',
           MozUserSelect: 'none',
           msUserSelect: 'none',
           transition: 'filter 0.3s ease'
         }}
         onContextMenu={(e) => e.preventDefault()}
         onDragStart={(e) => e.preventDefault()}>

      <div className="absolute inset-0 pointer-events-none z-10"
           style={{
             background: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,0,0,0.02) 8px, rgba(255,0,0,0.02) 16px)',
             mixBlendMode: 'difference'
           }}>
      </div>

      <div className="dynamic-overlay absolute inset-0 pointer-events-none z-15"
           style={{
             background: 'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,255,0,0.015) 4px, rgba(0,255,0,0.015) 8px)',
             mixBlendMode: 'multiply'
           }}>
      </div>

      <div className="absolute inset-0 pointer-events-none z-20"
           style={{
             backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(`
                <svg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'>
                  <text x='90' y='90' font-family='Arial' font-size='12' fill='rgba(128,128,128,0.03)' text-anchor='middle' transform='rotate(-45 90 90)'>
                    CONFIDENTIAL CV
                  </text>
                </svg>
              `)}")`,
             backgroundRepeat: 'repeat',
             backgroundSize: '180px 180px'
           }}>
      </div>

      <div className="absolute inset-0 pointer-events-none z-25"
           style={{
             background: 'repeating-linear-gradient(135deg, transparent, transparent 2px, rgba(0,0,255,0.005) 2px, rgba(0,0,255,0.005) 4px)',
             mixBlendMode: 'overlay'
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
      </div>

      <style jsx>{`
        .cv-doc-container {
          background-color: #ffffff;
          border: 1px solid #e5e7eb;
          padding: 3rem;
          margin: 2rem auto;
          max-width: 850px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          position: relative;
          font-family: 'Georgia', serif;
        }

        .cv-name {
          font-size: 8rem;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 2rem;
          text-align: center;
          letter-spacing: -0.025em;
        }

        .cv-header-subtitle {
          font-size: 1.25rem;
          color: #6b7280;
          text-align: center;
          margin-bottom: 3rem;
          line-height: 1.6;
        }

        .cv-section-header {
          font-size: 2.25rem;
          font-weight: 600;
          color: #374151;
          margin: 2.5rem 0 1.5rem 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 3px solid #374151;
          padding-bottom: 0.5rem;
          text-align: center;
        }

        .cv-job-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: #1f2937;
          margin: 2rem 0 0.5rem 0;
          text-align: center;
        }

        .cv-job-subtitle {
          font-size: 1.125rem;
          color: #6b7280;
          margin: 0.25rem 0 1rem 0;
          font-style: italic;
        }

        .cv-paragraph {
          font-size: 1rem;
          color: #374151;
          line-height: 1.7;
          margin-bottom: 1rem;
        }

        .cv-skills-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem 4rem;
          list-style: none;
          padding: 0;
          margin: 1.5rem 0;
        }

        .cv-bullet-list {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 1rem 0;
        }

        .cv-list-item {
          color: #374151;
          line-height: 1.6;
          margin-bottom: 0.5rem;
          font-size: 1rem;
        }

        .cv-bold {
          font-weight: 600;
          color: #1f2937;
        }

        .cv-italic {
          font-style: italic;
          color: #6b7280;
        }

        .cv-link {
          color: #3b82f6;
          text-decoration: underline;
        }

        .cv-link:hover {
          color: #1d4ed8;
        }

        @media print {
          .protected-document {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            filter: blur(10px) !important;
          }
        }

        .protected-document {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -khtml-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }

        .protected-document * {
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
