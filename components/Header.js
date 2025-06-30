// Header.js
import Image from 'next/image';

export default function Header() {
  return (
    <header className="flex items-center justify-between py-8 px-6 mb-8 border-b border-accent bg-bg">
      <div className="flex items-center">
        <Image
          src="/logo_cvprp+trans.png"
          alt="CV App Logo"
          width={120}
          height={60}
          className="h-16 w-auto object-contain"
          priority
        />
      </div>
    </header>
  );
}
