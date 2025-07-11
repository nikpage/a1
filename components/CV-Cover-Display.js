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

export default function CV_Cover_Display({ content }) {
  useEffect(() => {
    // Anti-screenshot key blocking
    const handleKeyDown = (e) => {
      if (e.key === 'PrintScreen' ||
          (e.ctrlKey && e.shiftKey && e.key === 'S') ||
          (e.ctrlKey && e.key === 'p')) {
        e.preventDefault();
        return false;
      }
    };

    // Dev tools detection and blur
    const detectDevTools = () => {
      if (window.outerHeight - window.innerHeight > 200 ||
          window.outerWidth - window.innerWidth > 200) {
        document.querySelector('.protected-document')?.style.setProperty('filter', 'blur(5px)');
      } else {
        document.querySelector('.protected-document')?.style.setProperty('filter', 'none');
      }
    };

    // Dynamic blend mode rotation
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
    <div className="max-w-4xl mx-auto bg-white p-8 shadow-sm relative protected-document"
         style={{
           userSelect: 'none',
           WebkitUserSelect: 'none',
           MozUserSelect: 'none',
           msUserSelect: 'none',
           transition: 'filter 0.3s ease'
         }}
         onContextMenu={(e) => e.preventDefault()}
         onDragStart={(e) => e.preventDefault()}>

      {/* Anti-screenshot overlay 1 */}
      <div className="absolute inset-0 pointer-events-none z-10"
           style={{
             background: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,0,0,0.02) 8px, rgba(255,0,0,0.02) 16px)',
             mixBlendMode: 'difference'
           }}>
      </div>

      {/* Anti-screenshot overlay 2 - dynamic */}
      <div className="dynamic-overlay absolute inset-0 pointer-events-none z-15"
           style={{
             background: 'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,255,0,0.015) 4px, rgba(0,255,0,0.015) 8px)',
             mixBlendMode: 'multiply'
           }}>
      </div>

      {/* Watermark */}
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

      {/* Subtle noise pattern */}
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
