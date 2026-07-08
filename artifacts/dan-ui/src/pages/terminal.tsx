import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { RefreshCw, Settings2, Terminal as TermIcon, ArrowRight } from 'lucide-react';
import { useLocalStorage } from '@/hooks/use-local-storage';

export function Terminal() {
  const [devboxUrl, setDevboxUrl] = useLocalStorage('dan_devbox_url', '');
  const [inputUrl, setInputUrl] = useState(devboxUrl);
  const [isConfiguring, setIsConfiguring] = useState(!devboxUrl);
  const [frameKey, setFrameKey] = useState(0);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    let url = inputUrl.trim();
    if (url && !url.startsWith('http')) url = 'https://' + url;
    setDevboxUrl(url);
    setIsConfiguring(false);
  };

  const reconnect = () => setFrameKey(k => k + 1);

  return (
    <AnimatePresence mode="wait">
      {isConfiguring ? (
        <motion.div
          key="setup"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="flex-1 flex flex-col justify-center p-6 max-w-sm mx-auto w-full gap-6"
        >
          {/* Icon + title */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-primary/12 flex items-center justify-center">
              <TermIcon className="w-8 h-8 text-primary" strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Connect Terminal</h1>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Enter your devbox URL — the address of your running ttyd instance.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-1">
                Devbox URL
              </label>
              <input
                type="text"
                placeholder="https://your-devbox.onrender.com"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="w-full bg-card border border-border/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 rounded-xl px-4 py-3.5 font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground pl-1">
                The ttyd web terminal runs on port 7681 by default.
              </p>
            </div>

            <button
              type="submit"
              disabled={!inputUrl.trim()}
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl disabled:opacity-40 transition-all press-scale"
            >
              Connect
              <ArrowRight className="w-4 h-4" />
            </button>

            {devboxUrl && (
              <button
                type="button"
                onClick={() => setIsConfiguring(false)}
                className="w-full py-3.5 bg-card border border-border/60 text-muted-foreground font-medium rounded-xl hover:text-foreground transition-colors press-scale"
              >
                Cancel
              </button>
            )}
          </form>
        </motion.div>
      ) : (
        <motion.div
          key="terminal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col"
          style={{ height: 'calc(100dvh - calc(56px + max(env(safe-area-inset-bottom,0px),8px)))' }}
        >
          {/* Top bar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 bg-card/60 backdrop-blur-sm flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse flex-shrink-0" />
            <span className="flex-1 font-mono text-xs text-muted-foreground truncate">
              {devboxUrl}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={reconnect}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-border/60 transition-colors press-scale"
                title="Reconnect"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsConfiguring(true)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-border/60 transition-colors press-scale"
                title="Settings"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* iframe */}
          <div className="flex-1 bg-[#0a0b0f] overflow-hidden">
            <iframe
              key={frameKey}
              src={devboxUrl}
              className="w-full h-full border-none"
              allow="fullscreen; clipboard-read; clipboard-write"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              title="Web Terminal"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
