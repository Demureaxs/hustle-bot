'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Megaphone, Settings, Zap } from 'lucide-react';

export function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Prospects', href: '/prospects', icon: Users },
    { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <nav className='w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col h-screen fixed left-0 top-0'>
      {/* Header */}
      <div className='p-6 border-b border-zinc-800'>
        <div className='flex items-center gap-3'>
          <div className='bg-green-500/10 p-2 rounded border border-green-500/20'>
            <Zap className='text-green-500' size={24} />
          </div>
          <div>
            <h1 className='text-xl font-bold tracking-tighter text-white'>
              HUSTLEBOT<span className='text-green-500'>_V2</span>
            </h1>
            <p className='text-[10px] text-zinc-500 uppercase tracking-widest'>Lead Acquisition</p>
          </div>
        </div>
      </div>

      {/* Nav Links */}
      <div className='flex-1 py-6 px-4 space-y-2'>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive ? 'bg-green-900/20 text-green-400 border border-green-900/50' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <item.icon size={18} />
              {item.name}
            </Link>
          );
        })}
      </div>

      {/* Footer Status */}
      <div className='p-4 border-t border-zinc-800'>
        <div className='flex items-center gap-2 text-xs text-zinc-500'>
          <div className='w-2 h-2 rounded-full bg-green-500 animate-pulse' />
          SYSTEM ONLINE
        </div>
      </div>
    </nav>
  );
}
