import { Link, useLocation } from 'wouter';
import { Home, Terminal, Wrench, Wifi } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

const NAV = [
  { href: '/',         icon: Home,     label: 'Home'     },
  { href: '/terminal', icon: Terminal, label: 'Terminal' },
  { href: '/tools',    icon: Wrench,   label: 'Tools'    },
  { href: '/connect',  icon: Wifi,     label: 'Connect'  },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isTerminal = location === '/terminal';

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      {/* ── Content ── */}
      {/*
        Terminal needs the full viewport with no padding/scroll — it handles
        its own height. All other pages scroll normally with bottom-nav padding.
      */}
      <main
        className={
          isTerminal
            ? 'flex-1 flex flex-col overflow-hidden'
            : 'flex-1 flex flex-col overflow-auto pb-[calc(72px+env(safe-area-inset-bottom,0px))]'
        }
      >
        {children}
      </main>

      {/* ── iOS-style frosted glass bottom tab bar ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 glass-strong z-50"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
      >
        <div className="flex items-center justify-around h-[56px]">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                className="relative flex flex-col items-center justify-center flex-1 h-full gap-[3px] press-scale"
              >
                {active && (
                  <motion.div
                    layoutId="tab-bg"
                    className="absolute inset-x-3 inset-y-2 rounded-xl bg-primary/10"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon
                  className={`w-[22px] h-[22px] transition-colors duration-200 ${
                    active ? 'text-primary' : 'text-muted-foreground'
                  }`}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                <span
                  className={`text-[10px] font-medium tracking-tight transition-colors duration-200 ${
                    active ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
