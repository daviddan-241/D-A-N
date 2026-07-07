import { motion } from 'framer-motion';
import { useState } from 'react';
import { RefreshCw, Settings, Terminal as TermIcon, AlertTriangle } from 'lucide-react';
import { useLocalStorage } from '@/hooks/use-local-storage';

export function Terminal() {
  const [devboxUrl, setDevboxUrl] = useLocalStorage('dan_devbox_url', '');
  const [inputUrl, setInputUrl] = useState(devboxUrl);
  const [isConfiguring, setIsConfiguring] = useState(!devboxUrl);
  const [key, setKey] = useState(0); // Used to force iframe reload

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    let finalUrl = inputUrl.trim();
    if (finalUrl && !finalUrl.startsWith('http')) {
      finalUrl = 'http://' + finalUrl;
    }
    setDevboxUrl(finalUrl);
    setIsConfiguring(false);
  };

  const forceReload = () => {
    setKey(k => k + 1);
  };

  if (isConfiguring) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 flex flex-col p-4 md:p-8"
      >
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full gap-6">
          <div className="flex items-center gap-3 mb-4 text-primary">
            <TermIcon className="w-8 h-8" />
            <h1 className="text-2xl font-mono font-bold tracking-wider">DEVBOX SETUP</h1>
          </div>
          
          <div className="p-4 rounded-lg bg-card border border-primary/20 text-sm font-mono text-muted-foreground leading-relaxed">
            Initialize connection to remote ttyd instance. Provide the target URL with port.
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <label className="font-mono text-xs tracking-widest text-primary">ENDPOINT URL</label>
              <input
                type="text"
                placeholder="http://192.168.1.100:7681"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="w-full bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-md p-3 font-mono text-sm outline-none transition-all glow-box"
                autoFocus
              />
            </div>
            
            <button 
              type="submit"
              disabled={!inputUrl.trim()}
              className="w-full p-3 bg-primary text-primary-foreground font-mono font-bold tracking-widest rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              INITIALIZE CONNECTION
            </button>
            
            {devboxUrl && (
              <button
                type="button"
                onClick={() => setIsConfiguring(false)}
                className="w-full p-3 bg-transparent border border-border text-foreground font-mono text-sm rounded-md hover:border-primary/50 transition-all"
              >
                CANCEL
              </button>
            )}
          </form>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-[calc(100dvh-72px)] md:h-[calc(100dvh-73px)] w-full"
    >
      <div className="flex items-center justify-between p-2 md:p-4 bg-card border-b border-border/50">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse glow-box flex-shrink-0"></div>
          <span className="font-mono text-xs text-primary truncate max-w-[200px] md:max-w-md">
            {devboxUrl}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={forceReload}
            className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-primary/10 flex items-center gap-2"
            title="Reconnect"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden md:inline font-mono text-xs">RECONNECT</span>
          </button>
          <button 
            onClick={() => setIsConfiguring(true)}
            className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-primary/10 flex items-center gap-2"
            title="Configure"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden md:inline font-mono text-xs">CONFIG</span>
          </button>
        </div>
      </div>
      
      <div className="flex-1 relative bg-black w-full overflow-hidden">
        {!devboxUrl ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground font-mono p-4 text-center">
            <AlertTriangle className="w-8 h-8 mb-4 text-yellow-500" />
            <p>Connection failed or not configured.</p>
            <button 
              onClick={() => setIsConfiguring(true)}
              className="mt-4 px-4 py-2 border border-border rounded-md hover:text-primary hover:border-primary transition-colors"
            >
              CONFIGURE
            </button>
          </div>
        ) : (
          <iframe
            key={key}
            src={devboxUrl}
            className="w-full h-full border-none bg-black"
            allow="fullscreen; clipboard-read; clipboard-write"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            title="Web Terminal"
          />
        )}
      </div>
    </motion.div>
  );
}
