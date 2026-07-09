import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Settings2, Terminal as TermIcon, ArrowRight, WifiOff, Loader } from 'lucide-react';
import { useLocalStorage } from '@/hooks/use-local-storage';

const SAME_ORIGIN_TERMINAL = '/webterm/';

type Availability = 'checking' | 'available' | 'unavailable';

export function Terminal() {
  const [devboxUrl, setDevboxUrl] = useLocalStorage('dan_devbox_url', SAME_ORIGIN_TERMINAL);
  const [inputUrl, setInputUrl] = useState(devboxUrl === SAME_ORIGIN_TERMINAL ? '' : devboxUrl);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [availability, setAvailability] = useState<Availability>('checking');
  const [unavailableReason, setUnavailableReason] = useState('');
  const [connected, setConnected] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  // Probe whether ttyd is reachable before showing the iframe
  useEffect(() => {
    if (devboxUrl !== SAME_ORIGIN_TERMINAL) {
      // Custom URL — always show it (user configured it themselves)
      setAvailability('available');
      return;
    }
    setAvailability('checking');
    setConnected(false);
    fetch(`${base}/api/terminal-ping`)
      .then(r => r.json())
      .then((d: { available: boolean; reason?: string }) => {
        setAvailability(d.available ? 'available' : 'unavailable');
        if (!d.available) setUnavailableReason(d.reason ?? 'Terminal not reachable');
      })
      .catch(() => {
        setAvailability('unavailable');
        setUnavailableReason('Could not reach API server');
      });
  }, [devboxUrl, frameKey, base]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    let url = inputUrl.trim();
    if (!url) url = SAME_ORIGIN_TERMINAL;
    else if (!url.startsWith('http')) url = 'https://' + url;
    setDevboxUrl(url);
    setIsConfiguring(false);
  };

  const useDefault = () => {
    setInputUrl('');
    setDevboxUrl(SAME_ORIGIN_TERMINAL);
    setIsConfiguring(false);
  };

  const reconnect = () => {
    setConnected(false);
    setFrameKey(k => k + 1);
  };

  return (
    <AnimatePresence mode="wait">
      {isConfiguring ? (
        <motion.div
          key="setup"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: 'spring' as const, stiffness: 400, damping: 32 }}
          className="flex-1 flex flex-col justify-center p-6 max-w-sm mx-auto w-full gap-6"
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-primary/12 flex items-center justify-center">
              <TermIcon className="w-8 h-8 text-primary" strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Connect Terminal</h1>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Uses the built-in ttyd terminal by default. Point it at a custom devbox URL if needed.
              </p>
            </div>
          </div>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-1">
                Custom devbox URL (optional)
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
                Leave blank to use this app's own /webterm terminal.
              </p>
            </div>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl transition-all press-scale"
            >
              {inputUrl.trim() ? 'Connect' : 'Use built-in terminal'}
              <ArrowRight className="w-4 h-4" />
            </button>
            {devboxUrl !== SAME_ORIGIN_TERMINAL && (
              <button
                type="button"
                onClick={useDefault}
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
            {availability === 'checking' ? (
              <Loader className="w-2 h-2 text-muted-foreground animate-spin flex-shrink-0" />
            ) : availability === 'available' && connected ? (
              <span className="w-2 h-2 rounded-full bg-success animate-pulse flex-shrink-0" />
            ) : availability === 'available' ? (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" />
            )}
            <span className="flex-1 font-mono text-xs text-muted-foreground truncate">
              {devboxUrl === SAME_ORIGIN_TERMINAL ? 'built-in terminal' : devboxUrl}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={reconnect} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-border/60 transition-colors press-scale" title="Reconnect">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button onClick={() => setIsConfiguring(true)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-border/60 transition-colors press-scale" title="Settings">
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 bg-[#0a0b0f] overflow-hidden relative">
            {availability === 'checking' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader className="w-6 h-6 animate-spin" />
                <p className="text-sm">Connecting to terminal…</p>
              </div>
            )}

            {availability === 'unavailable' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center">
                  <WifiOff className="w-7 h-7 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Terminal not available</p>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px]">
                    {unavailableReason.includes('TTYD_INTERNAL_PORT')
                      ? 'ttyd only runs in the live Render container. SSH from your iPhone using the Connect tab, or open the web terminal on your Render URL.'
                      : unavailableReason}
                  </p>
                </div>
                <button
                  onClick={reconnect}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-card border border-border/60 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors press-scale"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry
                </button>
              </motion.div>
            )}

            {availability === 'available' && (
              <iframe
                ref={iframeRef}
                key={frameKey}
                src={devboxUrl}
                className="w-full h-full border-none"
                allow="fullscreen; clipboard-read; clipboard-write"
                // Minimal sandbox — allow-same-origin is required for WebSocket
                // connections back to the same host; allow-popups for ttyd's UI
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                title="Web Terminal"
                onLoad={() => setConnected(true)}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
