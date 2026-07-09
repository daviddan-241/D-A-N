import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Settings2, Terminal as TermIcon, ArrowRight, WifiOff, Loader, Keyboard } from 'lucide-react';
import { useLocalStorage } from '@/hooks/use-local-storage';

const SAME_ORIGIN_TERMINAL = '/webterm/';

type Availability = 'checking' | 'available' | 'unavailable';
type StickyMod = 'ctrl' | 'alt' | null;

// ── Key injection ─────────────────────────────────────────────────────────────
// xterm.js listens for keyboard events on its hidden helper textarea.
// Since /webterm is same-origin we can access the iframe's document directly.
function sendToXterm(
  iframe: HTMLIFrameElement | null,
  key: string,
  opts: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean } = {}
): boolean {
  if (!iframe?.contentDocument) return false;
  const doc = iframe.contentDocument;
  // xterm.js renders a hidden textarea it uses for input capture
  const el = doc.querySelector<HTMLTextAreaElement>('.xterm-helper-textarea');
  if (!el) return false;

  el.focus();
  const code =
    key.length === 1
      ? `Key${key.toUpperCase()}`
      : key; // 'Escape', 'Tab', 'ArrowUp', etc.

  const init: KeyboardEventInit = {
    key,
    code,
    bubbles: true,
    cancelable: true,
    ctrlKey: opts.ctrlKey ?? false,
    altKey: opts.altKey ?? false,
    shiftKey: opts.shiftKey ?? false,
  };
  el.dispatchEvent(new KeyboardEvent('keydown', init));
  el.dispatchEvent(new KeyboardEvent('keyup', init));
  return true;
}

// ── Key bar button ────────────────────────────────────────────────────────────
interface KBtnProps {
  label: string;
  sublabel?: string;
  active?: boolean;
  wide?: boolean;
  onPress: () => void;
}
function KBtn({ label, sublabel, active, wide, onPress }: KBtnProps) {
  return (
    <button
      type="button"
      onPointerDown={(e) => { e.preventDefault(); onPress(); }}
      className={[
        'flex-shrink-0 flex flex-col items-center justify-center select-none rounded-lg',
        'text-[11px] font-mono font-semibold leading-none transition-colors active:scale-95',
        wide ? 'px-3 min-w-[52px] h-9' : 'min-w-[36px] w-9 h-9',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-[#2a2a2e] text-[#c8c8d0] hover:bg-[#38383f]',
      ].join(' ')}
    >
      <span>{label}</span>
      {sublabel && <span className="text-[8px] opacity-60 mt-0.5">{sublabel}</span>}
    </button>
  );
}

// ── iOS key bar ───────────────────────────────────────────────────────────────
interface KeyBarProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}
function KeyBar({ iframeRef }: KeyBarProps) {
  const [sticky, setSticky] = useState<StickyMod>(null);

  const fire = useCallback(
    (key: string, opts: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean } = {}) => {
      sendToXterm(iframeRef.current, key, opts);
      setSticky(null); // consume sticky after one key
    },
    [iframeRef]
  );

  const combo = (letter: string, mod: StickyMod) =>
    fire(letter, { ctrlKey: mod === 'ctrl', altKey: mod === 'alt' });

  const toggleSticky = (mod: StickyMod) =>
    setSticky(prev => (prev === mod ? null : mod));

  // When Ctrl/Alt is sticky, show contextual combo keys; otherwise show nav keys
  const showCombos = sticky !== null;

  return (
    <div className="flex-shrink-0 bg-[#1a1a1e] border-b border-[#333338] overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-1.5 px-2 py-1.5 w-max">
        {/* Always-visible: modifiers */}
        <KBtn label="Esc" onPress={() => fire('Escape')} />
        <KBtn label="Tab" onPress={() => fire('Tab')} />
        <div className="w-px h-5 bg-[#444] flex-shrink-0" />
        <KBtn
          label="Ctrl"
          active={sticky === 'ctrl'}
          onPress={() => toggleSticky('ctrl')}
        />
        <KBtn
          label="Alt"
          active={sticky === 'alt'}
          onPress={() => toggleSticky('alt')}
        />
        <div className="w-px h-5 bg-[#444] flex-shrink-0" />

        {showCombos ? (
          // Ctrl/Alt combo strip — most useful sequences
          <>
            <KBtn label={`${sticky === 'ctrl' ? '^' : 'M-'}C`} sublabel="break" onPress={() => combo('c', sticky)} />
            <KBtn label={`${sticky === 'ctrl' ? '^' : 'M-'}D`} sublabel="EOF" onPress={() => combo('d', sticky)} />
            <KBtn label={`${sticky === 'ctrl' ? '^' : 'M-'}Z`} sublabel="bg" onPress={() => combo('z', sticky)} />
            <KBtn label={`${sticky === 'ctrl' ? '^' : 'M-'}X`} sublabel={sticky === 'ctrl' ? 'cut/exit' : ''} onPress={() => combo('x', sticky)} />
            <KBtn label={`${sticky === 'ctrl' ? '^' : 'M-'}O`} sublabel={sticky === 'ctrl' ? 'save' : ''} onPress={() => combo('o', sticky)} />
            <KBtn label={`${sticky === 'ctrl' ? '^' : 'M-'}A`} sublabel="home" onPress={() => combo('a', sticky)} />
            <KBtn label={`${sticky === 'ctrl' ? '^' : 'M-'}E`} sublabel="end" onPress={() => combo('e', sticky)} />
            <KBtn label={`${sticky === 'ctrl' ? '^' : 'M-'}L`} sublabel="clear" onPress={() => combo('l', sticky)} />
            <KBtn label={`${sticky === 'ctrl' ? '^' : 'M-'}W`} sublabel={sticky === 'ctrl' ? 'del wrd' : ''} onPress={() => combo('w', sticky)} />
            <KBtn label={`${sticky === 'ctrl' ? '^' : 'M-'}K`} sublabel={sticky === 'ctrl' ? 'kill' : ''} onPress={() => combo('k', sticky)} />
            <KBtn label={`${sticky === 'ctrl' ? '^' : 'M-'}U`} sublabel={sticky === 'ctrl' ? 'del line' : ''} onPress={() => combo('u', sticky)} />
            <KBtn label={`${sticky === 'ctrl' ? '^' : 'M-'}R`} sublabel={sticky === 'ctrl' ? 'hist' : ''} onPress={() => combo('r', sticky)} />
            {sticky === 'ctrl' && (
              <KBtn label="^\\" sublabel="quit" onPress={() => fire('\\', { ctrlKey: true })} />
            )}
          </>
        ) : (
          // Navigation + common utility strip
          <>
            <KBtn label="↑" onPress={() => fire('ArrowUp')} />
            <KBtn label="↓" onPress={() => fire('ArrowDown')} />
            <KBtn label="←" onPress={() => fire('ArrowLeft')} />
            <KBtn label="→" onPress={() => fire('ArrowRight')} />
            <div className="w-px h-5 bg-[#444] flex-shrink-0" />
            <KBtn label="^C" sublabel="break" active={false} onPress={() => fire('c', { ctrlKey: true })} />
            <KBtn label="^D" sublabel="EOF" onPress={() => fire('d', { ctrlKey: true })} />
            <KBtn label="^Z" sublabel="bg" onPress={() => fire('z', { ctrlKey: true })} />
            <KBtn label="^X" sublabel="nano" onPress={() => fire('x', { ctrlKey: true })} />
            <KBtn label="^O" sublabel="save" onPress={() => fire('o', { ctrlKey: true })} />
            <KBtn label="^L" sublabel="clear" onPress={() => fire('l', { ctrlKey: true })} />
            <KBtn label="^R" sublabel="hist" onPress={() => fire('r', { ctrlKey: true })} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function Terminal() {
  const [devboxUrl, setDevboxUrl] = useLocalStorage('dan_devbox_url', SAME_ORIGIN_TERMINAL);
  const [inputUrl, setInputUrl] = useState(devboxUrl === SAME_ORIGIN_TERMINAL ? '' : devboxUrl);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
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

  const useDefault = () => { setInputUrl(''); setDevboxUrl(SAME_ORIGIN_TERMINAL); setIsConfiguring(false); };
  const reconnect = () => { setConnected(false); setFrameKey(k => k + 1); };

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
              {/* Toggle key bar */}
              <button
                onClick={() => setShowKeyBar(v => !v)}
                className={`p-2 rounded-lg transition-colors press-scale ${showKeyBar ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-border/60'}`}
                title="Toggle key bar"
              >
                <Keyboard className="w-4 h-4" />
              </button>
              <button onClick={reconnect} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-border/60 transition-colors press-scale" title="Reconnect">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button onClick={() => setIsConfiguring(true)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-border/60 transition-colors press-scale" title="Settings">
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* iOS key bar — shown when available and toggled on */}
          {availability === 'available' && showKeyBar && (
            <KeyBar iframeRef={iframeRef} />
          )}

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
                      ? 'The web terminal only runs in the live Render container. Use SSH from the Connect tab, or visit your Render URL directly.'
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
