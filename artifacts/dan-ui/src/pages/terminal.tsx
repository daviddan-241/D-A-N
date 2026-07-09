import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Settings2, Terminal as TermIcon, ArrowRight,
         WifiOff, Loader, Keyboard } from 'lucide-react';
import { useLocalStorage } from '@/hooks/use-local-storage';

const SAME_ORIGIN_TERMINAL = '/webterm/';

type Availability = 'checking' | 'available' | 'unavailable';

// ── Key injection via API ──────────────────────────────────────────────────────
// Sends keystrokes through the server-side tmux send-keys API.
// This bypasses all iframe/isTrusted/iOS-sandbox limitations entirely.
// The server calls `tmux send-keys -t main:0.0 <key>` inside the container.
async function sendKey(base: string, key: string): Promise<void> {
  try {
    await fetch(`${base}/api/terminal/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
  } catch {
    // Ignore network errors — graceful degradation
  }
}

// ── Key bar button ─────────────────────────────────────────────────────────────
interface KBtnProps {
  label: string;
  sub?: string;
  active?: boolean;
  danger?: boolean;
  onPress: () => void;
}
function KBtn({ label, sub, active, danger, onPress }: KBtnProps) {
  return (
    <button
      type="button"
      onPointerDown={(e) => { e.preventDefault(); onPress(); }}
      className={[
        'flex-shrink-0 flex flex-col items-center justify-center select-none',
        'rounded-[10px] font-mono text-[11px] font-semibold leading-none',
        'transition-all duration-75 active:scale-90 min-w-[38px] h-10 px-2',
        active  ? 'bg-primary text-primary-foreground shadow-glow' :
        danger  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' :
                  'bg-[#2c2c32] text-[#c0c0cc] hover:bg-[#3a3a42]',
      ].join(' ')}
    >
      <span>{label}</span>
      {sub && <span className="text-[8px] opacity-55 mt-[2px]">{sub}</span>}
    </button>
  );
}

// ── iOS Key Bar ────────────────────────────────────────────────────────────────
// Keys are sent via the server-side tmux API so they work regardless of
// iOS keyboard limitations, iframe sandboxing, or isTrusted restrictions.
interface KeyBarProps { base: string }
function KeyBar({ base }: KeyBarProps) {
  const [ctrlActive, setCtrlActive] = useState(false);
  const [altActive, setAltActive]   = useState(false);

  const fire = useCallback(async (key: string) => {
    await sendKey(base, key);
    // Consume sticky modifiers after one key
    setCtrlActive(false);
    setAltActive(false);
  }, [base]);

  // When a modifier is sticky, show the combo strip for that modifier
  const showCtrlCombos = ctrlActive;
  const showAltCombos  = altActive && !ctrlActive;

  return (
    <div className="flex-shrink-0 bg-[#18181c] border-b border-[#2e2e36]">
      {/* Row 1 — modifiers + navigation (always visible) */}
      <div className="flex items-center gap-1.5 px-2 pt-1.5 pb-1 overflow-x-auto scrollbar-none w-max min-w-full">
        <KBtn label="Esc"  onPress={() => fire('escape')} />
        <KBtn label="Tab"  onPress={() => fire('tab')} />
        <div className="w-px h-6 bg-[#3a3a42] flex-shrink-0" />
        <KBtn label="Ctrl" active={ctrlActive}
              onPress={() => { setCtrlActive(v => !v); setAltActive(false); }} />
        <KBtn label="Alt"  active={altActive}
              onPress={() => { setAltActive(v => !v); setCtrlActive(false); }} />
        <div className="w-px h-6 bg-[#3a3a42] flex-shrink-0" />
        <KBtn label="↑" onPress={() => fire('up')} />
        <KBtn label="↓" onPress={() => fire('down')} />
        <KBtn label="←" onPress={() => fire('left')} />
        <KBtn label="→" onPress={() => fire('right')} />
        <div className="w-px h-6 bg-[#3a3a42] flex-shrink-0" />
        {/* Quick-fire combos always in row 1 */}
        <KBtn label="^C" sub="break" danger onPress={() => fire('ctrl+c')} />
        <KBtn label="^D" sub="EOF"   onPress={() => fire('ctrl+d')} />
        <KBtn label="^Z" sub="bg"    onPress={() => fire('ctrl+z')} />
      </div>

      {/* Row 2 — context-sensitive combo strip */}
      <div className="flex items-center gap-1.5 px-2 pb-1.5 overflow-x-auto scrollbar-none w-max min-w-full">
        {showCtrlCombos ? (
          // Ctrl combo strip — tap a letter while Ctrl is sticky
          <>
            <span className="text-[9px] text-primary/70 font-mono font-semibold flex-shrink-0 pr-1">Ctrl+</span>
            {['x','o','a','e','l','r','w','k','u','p','n','f','b','\\'].map(k => (
              <KBtn key={k} label={k === '\\' ? '\\' : k.toUpperCase()}
                    sub={k === 'x' ? 'exit' : k === 'o' ? 'save' : k === 'l' ? 'clear' : k === 'r' ? 'hist' : ''}
                    active onPress={() => fire(`ctrl+${k}`)} />
            ))}
          </>
        ) : showAltCombos ? (
          // Alt/Meta combo strip
          <>
            <span className="text-[9px] text-amber-400/70 font-mono font-semibold flex-shrink-0 pr-1">Alt+</span>
            {['b','f','d','.','/','<','>'].map(k => (
              <KBtn key={k} label={k} active onPress={() => fire(`alt+${k}`)} />
            ))}
          </>
        ) : (
          // Default row 2 — nano/vim shortcuts + common commands
          <>
            <KBtn label="^X" sub="nano exit" onPress={() => fire('ctrl+x')} />
            <KBtn label="^O" sub="nano save" onPress={() => fire('ctrl+o')} />
            <KBtn label="^G" sub="help"      onPress={() => fire('ctrl+g')} />
            <div className="w-px h-6 bg-[#3a3a42] flex-shrink-0" />
            <KBtn label="^A" sub="home"   onPress={() => fire('ctrl+a')} />
            <KBtn label="^E" sub="end"    onPress={() => fire('ctrl+e')} />
            <KBtn label="^W" sub="del wd" onPress={() => fire('ctrl+w')} />
            <KBtn label="^K" sub="kill"   onPress={() => fire('ctrl+k')} />
            <KBtn label="^U" sub="del ln" onPress={() => fire('ctrl+u')} />
            <KBtn label="^R" sub="hist"   onPress={() => fire('ctrl+r')} />
            <KBtn label="^L" sub="clear"  onPress={() => fire('ctrl+l')} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function Terminal() {
  const [devboxUrl, setDevboxUrl] = useLocalStorage('dan_devbox_url', SAME_ORIGIN_TERMINAL);
  const [inputUrl, setInputUrl]   = useState(devboxUrl === SAME_ORIGIN_TERMINAL ? '' : devboxUrl);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [frameKey, setFrameKey]   = useState(0);
  const [availability, setAvailability] = useState<Availability>('checking');
  const [unavailableReason, setUnavailableReason] = useState('');
  const [connected, setConnected] = useState(false);
  const [showKeyBar, setShowKeyBar] = useLocalStorage('dan_keybar', true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  useEffect(() => {
    if (devboxUrl !== SAME_ORIGIN_TERMINAL) {
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

  const reconnect = () => { setConnected(false); setFrameKey(k => k + 1); };

  return (
    <AnimatePresence mode="wait">
      {isConfiguring ? (
        <motion.div key="setup"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
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
                Defaults to the built-in ttyd terminal. Set a custom URL to connect to
                a different devbox.
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
                autoFocus autoCapitalize="none" autoCorrect="off" spellCheck={false}
              />
            </div>
            <button type="submit"
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl transition-all press-scale"
            >
              {inputUrl.trim() ? 'Connect' : 'Use built-in terminal'}
              <ArrowRight className="w-4 h-4" />
            </button>
            {devboxUrl !== SAME_ORIGIN_TERMINAL && (
              <button type="button" onClick={useDefault}
                className="w-full py-3.5 bg-card border border-border/60 text-muted-foreground font-medium rounded-xl hover:text-foreground transition-colors press-scale"
              >
                Cancel
              </button>
            )}
          </form>
        </motion.div>
      ) : (
        <motion.div key="terminal" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col"
          style={{ height: 'calc(100dvh - calc(56px + max(env(safe-area-inset-bottom,0px),8px)))' }}
        >
          {/* ── Top bar ── */}
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
              {devboxUrl === SAME_ORIGIN_TERMINAL ? 'built-in terminal · tmux main' : devboxUrl}
            </span>
            <div className="flex items-center gap-1">
              <button
                onPointerDown={(e) => { e.preventDefault(); setShowKeyBar((v: boolean) => !v); }}
                className={`p-2 rounded-lg transition-colors press-scale ${
                  showKeyBar ? 'text-primary bg-primary/12' : 'text-muted-foreground hover:text-foreground hover:bg-border/60'
                }`}
                title="Toggle key bar"
              >
                <Keyboard className="w-4 h-4" />
              </button>
              <button onClick={reconnect}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-border/60 transition-colors press-scale"
                title="Reconnect"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button onClick={() => setIsConfiguring(true)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-border/60 transition-colors press-scale"
                title="Settings"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── iOS key bar ── */}
          {availability === 'available' && showKeyBar && <KeyBar base={base} />}

          {/* ── Body ── */}
          <div className="flex-1 bg-[#0a0b0f] overflow-hidden relative">
            {availability === 'checking' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader className="w-6 h-6 animate-spin" />
                <p className="text-sm">Connecting to terminal…</p>
              </div>
            )}

            {availability === 'unavailable' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center">
                  <WifiOff className="w-7 h-7 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Terminal not available here</p>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px]">
                    {unavailableReason.includes('TTYD_INTERNAL_PORT')
                      ? 'The web terminal runs only in the live Render container. SSH from the Connect tab — or open your Render URL directly.'
                      : unavailableReason}
                  </p>
                </div>
                <button onClick={reconnect}
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
