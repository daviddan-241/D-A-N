import React from 'react';
import { Link, useLocation } from 'wouter';
import { Terminal, Grid, Phone, Home } from 'lucide-react';
import { motion } from 'framer-motion';

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: '/', icon: Home, label: 'CMD' },
    { href: '/terminal', icon: Terminal, label: 'TERM' },
    { href: '/tools', icon: Grid, label: 'TOOLS' },
    { href: '/connect', icon: Phone, label: 'iOS' },
  ];

  return (
    <div className="flex flex-col min-h-[100dvh] w-full bg-background relative overflow-hidden">
      {/* Top Header - Hidden on small mobile, visible on tablet+ or maybe just minimal on mobile */}
      <header className="flex items-center justify-between p-4 md:px-8 border-b border-border/50 bg-background/80 backdrop-blur-md z-10 hidden md:flex">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="font-mono text-2xl font-bold tracking-[0.2em] text-primary glow-text">
            D·A·N
          </div>
        </Link>
        
        <nav className="flex items-center gap-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-2 text-sm font-mono transition-all duration-200 ${
                  isActive 
                    ? 'text-primary glow-text' 
                    : 'text-muted-foreground hover:text-primary'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative w-full max-w-7xl mx-auto pb-[72px] md:pb-0">
        {children}
      </main>

      {/* iOS-Optimized Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-background/90 backdrop-blur-xl border-t border-border/50 flex items-center justify-around px-2 z-50 pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className="relative flex flex-col items-center justify-center w-16 h-full gap-1 group"
            >
              <Icon 
                className={`w-6 h-6 transition-all duration-300 ${
                  isActive 
                    ? 'text-primary' 
                    : 'text-muted-foreground group-hover:text-primary/70'
                }`} 
              />
              <span 
                className={`text-[10px] font-mono tracking-wider transition-all duration-300 ${
                  isActive 
                    ? 'text-primary' 
                    : 'text-muted-foreground group-hover:text-primary/70'
                }`}
              >
                {item.label}
              </span>
              
              {isActive && (
                <motion.div 
                  layoutId="bottomNavIndicator"
                  className="absolute top-0 w-8 h-[2px] bg-primary glow-box"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                />
              )}
            </Link>
          );
        })}
      </nav>
      
      {/* Global CSS for iOS safe area */}
      <style dangerouslySetInnerHTML={{__html: `
        .pb-safe {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
      `}} />
    </div>
  );
}
