import '../styles/globals.css';
import '../styles/cv-cover.css';
import Script from 'next/script';

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Script
        src="https://unpkg.com/html-docx-js/dist/html-docx.min.js"
        strategy="beforeInteractive"
      />
      <Component {...pageProps} />
    </>
  );
}
