import { motion } from 'framer-motion';
import { Terminal, Activity, Shield, Cpu, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { CodeBlock } from '@/components/code-block';

export function Home() {
  const stats = [
    { icon: Activity, label: 'UPTIME', value: '24/7' },
    { icon: Shield, label: 'AUTH', value: 'KEY-ONLY' },
    { icon: Cpu, label: 'OS', value: 'UBUNTU 24.04' },
    { icon: Terminal, label: 'TOOLS', value: '50+' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 flex flex-col p-4 md:p-8"
    >
      <div className="md:hidden flex items-center justify-between mb-8">
        <div className="font-mono text-xl font-bold tracking-[0.2em] text-primary glow-text">
          D·A·N
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse glow-box"></div>
          <span className="font-mono text-xs text-primary">ONLINE</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full gap-12">
        <div className="flex flex-col items-center text-center space-y-6">
          <motion.h1 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5, type: 'spring' }}
            className="text-6xl md:text-8xl font-black tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-b from-primary to-primary/40 glow-text mb-4"
          >
            D·A·N
          </motion.h1>
          <p className="text-lg text-muted-foreground font-mono tracking-widest uppercase text-sm">
            Dynamic Access Node
          </p>
          
          <div className="hidden md:flex items-center gap-3 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse glow-box"></div>
            <span className="font-mono text-xs text-primary uppercase tracking-wider">System Online</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + (i * 0.1) }}
              className="flex flex-col items-center justify-center p-4 bg-card border border-border/50 rounded-lg hover:border-primary/50 transition-colors group"
            >
              <stat.icon className="w-5 h-5 text-muted-foreground mb-3 group-hover:text-primary transition-colors" />
              <div className="text-xs font-mono text-muted-foreground mb-1">{stat.label}</div>
              <div className="font-mono font-bold text-foreground group-hover:text-primary transition-colors">{stat.value}</div>
            </motion.div>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm tracking-widest text-muted-foreground">QUICK CONNECT</h2>
          </div>
          
          <CodeBlock 
            label="SSH COMMAND"
            code="ssh -i ~/.ssh/dan_ed25519 root@dan.local" 
          />

          <Link 
            href="/terminal"
            className="flex items-center justify-between w-full p-4 mt-6 bg-primary text-primary-foreground font-mono font-bold tracking-widest rounded-lg hover:bg-primary/90 transition-all glow-box group"
          >
            <span>OPEN TERMINAL</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
