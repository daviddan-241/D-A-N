import { motion } from 'framer-motion';
import { Terminal, Apple, Wifi, Key, Link2 } from 'lucide-react';
import { CodeBlock } from '@/components/code-block';

export function Connect() {
  const steps = [
    {
      icon: Apple,
      title: 'INSTALL A-SHELL MINI',
      desc: 'Get the lightweight iOS terminal emulator from the App Store. It provides a full local environment with SSH capabilities.',
      action: 'Download on App Store'
    },
    {
      icon: Key,
      title: 'IMPORT SSH KEY',
      desc: 'Transfer your private key to your iPhone securely (via iCloud Drive or encrypted note), then move it to a-Shell\'s .ssh directory.',
      cmd: 'mkdir -p ~/.ssh\ncp ~/Documents/id_ed25519 ~/.ssh/\nchmod 600 ~/.ssh/id_ed25519'
    },
    {
      icon: Link2,
      title: 'CONFIGURE HOST',
      desc: 'Set up your SSH config for quick one-word connection to your devbox.',
      cmd: 'cat << EOF > ~/.ssh/config\nHost dan\n  HostName your-ip-or-domain\n  User root\n  IdentityFile ~/.ssh/id_ed25519\n  Port 22\nEOF'
    },
    {
      icon: Terminal,
      title: 'CONNECT & ATTACH',
      desc: 'Connect to the box and immediately attach to your persistent tmux session.',
      cmd: 'ssh dan -t "tmux attach || tmux new"'
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col p-4 md:p-8 h-full max-w-4xl mx-auto w-full"
    >
      <div className="mb-8">
        <h1 className="text-2xl font-mono font-bold tracking-widest text-primary glow-text flex items-center gap-3 mb-2">
          <Wifi className="w-6 h-6" />
          iOS CONNECTION
        </h1>
        <p className="text-muted-foreground font-mono text-sm">
          Establish a secure, persistent link from your mobile device to the D.A.N. instance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-24">
        <div className="space-y-8">
          {steps.map((step, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.15 }}
              className="relative pl-8 border-l border-border/50"
            >
              <div className="absolute left-[-16px] top-0 p-1.5 bg-background border border-primary text-primary rounded-full glow-box">
                <step.icon className="w-4 h-4" />
              </div>
              
              <h3 className="font-mono font-bold text-foreground mb-2 flex items-center gap-2">
                <span className="text-primary text-xs">0{idx + 1}.</span> {step.title}
              </h3>
              
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {step.desc}
              </p>
              
              {step.cmd && (
                <div className="mt-2">
                  <CodeBlock code={step.cmd} />
                </div>
              )}
              
              {step.action && (
                <button className="mt-2 text-xs font-mono uppercase tracking-wider text-primary border border-primary/30 px-4 py-2 rounded hover:bg-primary/10 transition-colors">
                  {step.action}
                </button>
              )}
            </motion.div>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col gap-6"
        >
          <div className="bg-card border border-border/50 rounded-xl p-6 flex flex-col items-center justify-center min-h-[300px] gap-6 group hover:border-primary/50 transition-colors">
            <div className="w-48 h-48 border-2 border-dashed border-primary/30 rounded-lg flex items-center justify-center bg-primary/5 relative overflow-hidden group-hover:border-primary/60 transition-colors">
              <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(0,255,255,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%,100%_100%] animate-[gradient_3s_linear_infinite]" />
              
              {/* QR Pattern Simulation */}
              <div className="grid grid-cols-4 gap-1 w-24 h-24 opacity-20">
                {Array.from({length: 16}).map((_, i) => (
                  <div key={i} className={`bg-primary ${Math.random() > 0.5 ? 'rounded-sm' : ''} ${Math.random() > 0.7 ? 'opacity-0' : 'opacity-100'}`} />
                ))}
              </div>
              
              <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-primary font-bold tracking-widest bg-background/50 backdrop-blur-sm">
                SCAN FOR URL
              </div>
            </div>
            
            <p className="text-center font-mono text-xs text-muted-foreground uppercase tracking-widest max-w-[200px]">
              Point iOS Camera to inject Web Terminal URL directly
            </p>
          </div>

          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg flex items-start gap-3">
            <div className="mt-1 w-2 h-2 rounded-full bg-primary animate-pulse glow-box flex-shrink-0" />
            <p className="text-xs font-mono text-primary/80 leading-relaxed">
              For best experience, add D.A.N. to your iOS Home Screen. Open in Safari, tap Share, and select "Add to Home Screen" to launch in full-screen standalone mode.
            </p>
          </div>
        </motion.div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes gradient {
          0% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}} />
    </motion.div>
  );
}
