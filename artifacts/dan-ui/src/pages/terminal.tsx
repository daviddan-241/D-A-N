/**
 * Terminal — fullscreen ttyd iframe with a full iOS key bar
 *
 * Design goal: the iframe fills the entire screen with zero dead chrome.
 * A thin floating pill sits at the top-right with status + controls.
 * The iOS key bar slides up from the bottom — hidden by default, toggled
 * by tapping the keyboard icon in the floating pill.
 *
 * Keys & text are sent via POST /api/terminal/keys and /api/terminal/text
 * → tmux send-keys on the server, completely bypassing iOS's isTrusted /
 * iframe keyboard restrictions.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Settings2, Terminal as TermIcon, ArrowRight,
         WifiOff, Loader, Keyboard, ChevronDown, Send, ClipboardPaste, Check,
         ArrowUp, ArrowDown, ArrowLeft, CornerDownLeft, X as XIcon } from 'lucide-react';
import { useLocalStorage } from '@/hooks/use-local-storage';

const SAME_ORIGIN_TERMINAL = '/webterm/';

type Availability = 'checking' | 'available' | 'unavailable';

// ── Keystroke API ───────────────────────────────────────────────────────────────
async function sendKey(base: string, key: string): Promise<void> {
  try {
    await fetch(`${base}/api/terminal/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
  } catch { /* ignore — graceful degradation */ }
}

async function sendText(base: string, text: string): Promise<void> {
  try {
    await fetch(`${base}/api/terminal/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch { /* ignore */ }
}

// ── Quick-command chips ─────────────────────────────────────────────────────────
const QUICK_CMDS = [
  { label: 'sudo', cmd: 'sudo ' },
  { label: 'apt install', cmd: 'apt install ' },
  { label: 'apt update', cmd: 'apt update && apt upgrade -y' },
  { label: 'ollama list', cmd: 'ollama list' },
  { label: 'ollama run', cmd: 'ollama run phi3:mini' },
  { label: 'agent-local', cmd: 'agent-local' },
  { label: 'ls -la', cmd: 'ls -la' },
  { label: 'htop', cmd: 'htop' },
  { label: 'tmux', cmd: 'tmux new -s work' },
  { label: 'bore port', cmd: 'cat ~/.dan_ssh_connect' },
];

// ── Key button ──────────────────────────────────────────────────────────────────
interface KBtnProps {
  label: string;
  sub?: string;
  wide?: boolean;
  active?: boolean;
  danger?: boolean;
  onPress: () => void;
}
function KBtn({ label, sub, wide, active, danger, onPress }: KBtnProps) {
  return (
    <button
      type="button"
      onPointerDown={(e) => { e.preventDefault(); onPress(); }}
      className={[
        'flex-shrink-0 flex flex-col items-center justify-center select-none',
        'rounded-[9px] font-mono leading-none transition-all duration-75 active:scale-90',
        'h-[38px]',
        wide ? 'min-w-[56px] px-3 text-[11px] font-bold' : 'min-w-[36px] px-1.5 text-[11px] font-semibold',
        active  ? 'bg-primary text-primary-foreground' :
        danger  ? 'bg-red-500/25 text-red-400 hover:bg-red-500/35' :
                  'bg-[#1e1e28] text-[#b8b8cc] hover:bg-[#2a2a36] active:bg-[#333344]',
      ].join(' ')}
    >
      <span>{label}</span>
      {sub && <span className="text-[8px] opacity-50 mt-[1px]">{sub}</span>}
    </button>
  );
}

// ── iOS Key bar ─────────────────────────────────────────────────────────────────
interface KeyBarProps { base: string; onClose: () => void }
function KeyBar({ base, onClose }: KeyBarProps) {
  const [ctrlActive, setCtrlActive] = useState(false);
  const [altActive,  setAltActive]  = useState(false);
  const [inputText,  setInputText]  = useState('');
  const [activeTab,  setActiveTab]  = useState<'keys' | 'type' | 'cmds'>('keys');

  const fire = useCallback(async (key: string) => {
    await sendKey(base, key);
    setCtrlActive(false);
    setAltActive(false);
  }, [base]);

  const fireText = useCallback(async (text: string) => {
    await sendText(base, text);
  }, [base]);

  const submitInput = async () => {
    if (!inputText) return;
    await fireText(inputText + '\n');
    setInputText('');
  };

  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring' as const, stiffness: 500, damping: 40 }}
      className="absolute bottom-0 left-0 right-0 z-30 bg-[#141418]/97 backdrop-blur-md border-t border-white/8 pb-safe"
    >
      {/* drag-to-close pill */}
      <button
        type="button"
        onPointerDown={(e) => { e.preventDefault(); onClose(); }}
        className="flex items-center justify-center w-full pt-2 pb-1"
        aria-label="Hide key bar"
      >
        <div className="w-10 h-1 rounded-full bg-white/20" />
      </button>

      {/* Tab row */}
      <div className="flex gap-1 px-3 pb-2">
        {(['keys', 'type', 'cmds'] as const).map(tab => (
          <button
            key={tab}
            onPointerDown={(e) => { e.preventDefault(); setActiveTab(tab); }}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              activeTab === tab
                ? 'bg-primary/20 text-primary'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            {tab === 'keys' ? '⌨ Keys' : tab === 'type' ? '✏ Type' : '⚡ Cmds'}
          </button>
        ))}
      </div>

      {/* ── Keys tab ── */}
      {activeTab === 'keys' && (
        <>
          {/* Row 1 — navigation + quick combos */}
          <div className="flex items-center gap-1 px-2 pb-1 overflow-x-auto scrollbar-none w-max min-w-full">
            <KBtn label="Esc"  onPress={() => fire('escape')} />
            <KBtn label="Tab"  onPress={() => fire('tab')} />
            <KBtn label="↩" wide onPress={() => fire('enter')} />
            <div className="w-px h-5 bg-white/10 flex-shrink-0" />
            <KBtn label="Ctrl" active={ctrlActive}
                  onPress={() => { setCtrlActive(v => !v); setAltActive(false); }} />
            <KBtn label="Alt"  active={altActive}
                  onPress={() => { setAltActive(v => !v); setCtrlActive(false); }} />
            <div className="w-px h-5 bg-white/10 flex-shrink-0" />
            <KBtn label="↑" onPress={() => fire('up')} />
            <KBtn label="↓" onPress={() => fire('down')} />
            <KBtn label="←" onPress={() => fire('left')} />
            <KBtn label="→" onPress={() => fire('right')} />
            <div className="w-px h-5 bg-white/10 flex-shrink-0" />
            <KBtn label="^C" sub="int" danger onPress={() => fire('ctrl+c')} />
            <KBtn label="^D" sub="eof"        onPress={() => fire('ctrl+d')} />
            <KBtn label="^Z" sub="bg"         onPress={() => fire('ctrl+z')} />
          </div>

          {/* Row 2 — context-sensitive */}
          <div className="flex items-center gap-1 px-2 pb-2 overflow-x-auto scrollbar-none w-max min-w-full">
            {ctrlActive ? (
              <>
                <span className="text-[9px] text-primary/70 font-mono font-bold flex-shrink-0 pr-1 self-center">Ctrl+</span>
                {['a','e','x','o','g','l','r','w','k','u','p','n','f','b','\\'].map(k => (
                  <KBtn key={k} label={k === '\\' ? '\\\\' : k.toUpperCase()} active onPress={() => fire(`ctrl+${k}`)} />
                ))}
              </>
            ) : altActive ? (
              <>
                <span className="text-[9px] text-amber-400/70 font-mono font-bold flex-shrink-0 pr-1 self-center">Alt+</span>
                {['b','f','d','.','/','<','>'].map(k => (
                  <KBtn key={k} label={k} active onPress={() => fire(`alt+${k}`)} />
                ))}
              </>
            ) : (
              // Nano / readline shortcuts
              <>
                <KBtn label="^X" sub="exit"  onPress={() => fire('ctrl+x')} />
                <KBtn label="^O" sub="save"  onPress={() => fire('ctrl+o')} />
                <KBtn label="^G" sub="help"  onPress={() => fire('ctrl+g')} />
                <div className="w-px h-5 bg-white/10 flex-shrink-0" />
                <KBtn label="^A" sub="home"  onPress={() => fire('ctrl+a')} />
                <KBtn label="^E" sub="end"   onPress={() => fire('ctrl+e')} />
                <KBtn label="^W" sub="del▸"  onPress={() => fire('ctrl+w')} />
                <KBtn label="^K" sub="kill"  onPress={() => fire('ctrl+k')} />
                <KBtn label="^U" sub="del◂"  onPress={() => fire('ctrl+u')} />
                <KBtn label="^R" sub="hist"  onPress={() => fire('ctrl+r')} />
                <KBtn label="^L" sub="clr"   onPress={() => fire('ctrl+l')} />
                <div className="w-px h-5 bg-white/10 flex-shrink-0" />
                <KBtn label="Home" wide onPress={() => fire('home')} />
                <KBtn label="End"  wide onPress={() => fire('end')} />
                <KBtn label="PgUp" wide onPress={() => fire('pageup')} />
                <KBtn label="PgDn" wide onPress={() => fire('pagedown')} />
              </>
            )}
          </div>
        </>
      )}

      {/* ── Type tab — full text input for mobile ── */}
      {activeTab === 'type' && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-[10px] text-white/40 px-1">
            Type a command and tap ↩ Send. Runs in your tmux session.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitInput(); } }}
              placeholder="apt install nmap"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1 bg-[#1e1e28] border border-white/10 rounded-xl px-3 py-2.5 font-mono text-sm text-white placeholder:text-white/25 outline-none focus:border-primary/50"
            />
            <button
              onPointerDown={(e) => { e.preventDefault(); submitInput(); }}
              className="flex items-center justify-center w-12 h-[42px] rounded-xl bg-primary text-primary-foreground flex-shrink-0 active:opacity-70"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          {/* Paste single char shortcuts */}
          <div className="flex gap-1 flex-wrap">
            {['sudo ', 'apt install ', 'cd ~', 'ls -la', 'cat ', 'nano ', 'vim ', 'python3 '].map(s => (
              <button
                key={s}
                onPointerDown={(e) => { e.preventDefault(); setInputText(t => t + s); }}
                className="px-2.5 py-1 rounded-lg bg-[#1e1e28] text-[10px] font-mono text-white/60 hover:text-white/90 border border-white/8"
              >
                {s.trim()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Cmds tab — quick command chips ── */}
      {activeTab === 'cmds' && (
        <div className="px-3 pb-3 space-y-1.5">
          <p className="text-[10px] text-white/40 px-1 pb-0.5">
            Tap to run instantly in your tmux session.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_CMDS.map(({ label, cmd }) => (
              <button
                key={label}
                onPointerDown={(e) => { e.preventDefault(); fireText(cmd + '\n'); }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1e1e28] border border-white/8 text-[11px] font-mono text-white/70 hover:text-white hover:border-primary/30 active:opacity-60 text-left"
              >
                <span className="text-primary/60">$</span>
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Setup screen ────────────────────────────────────────────────────────────────
interface SetupProps {
  current: string;
  onSave: (url: string) => void;
  onBack?: () => void;
}
function SetupScreen({ current, onSave, onBack }: SetupProps) {
  const [inputUrl, setInputUrl] = useState(current === SAME_ORIGIN_TERMINAL ? '' : current);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let url = inputUrl.trim();
    if (!url) url = SAME_ORIGIN_TERMINAL;
    else if (!url.startsWith('http')) url = 'https://' + url;
    onSave(url);
  };
  return (
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
          <h1 className="text-xl font-bold">Connect Terminal</h1>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Defaults to the built-in ttyd terminal. Set a custom URL to point to another devbox.
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-1">
            Custom devbox URL (optional)
          </label>
          <input
            type="text" placeholder="https://your-devbox.onrender.com"
            value={inputUrl} onChange={(e) => setInputUrl(e.target.value)}
            className="w-full bg-card border border-border/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 rounded-xl px-4 py-3.5 font-mono text-sm placeholder:text-muted-foreground outline-none transition-all"
            autoFocus autoCapitalize="none" autoCorrect="off" spellCheck={false}
          />
        </div>
        <button type="submit"
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl transition-all press-scale"
        >
          {inputUrl.trim() ? 'Connect to custom URL' : 'Use built-in terminal'}
          <ArrowRight className="w-4 h-4" />
        </button>
        {onBack && (
          <button type="button" onClick={onBack}
            className="w-full py-3 bg-card border border-border/50 text-muted-foreground font-medium rounded-xl hover:text-foreground transition-colors press-scale"
          >
            Cancel
          </button>
        )}
      </form>
    </motion.div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────────
export function Terminal() {
  const [devboxUrl, setDevboxUrl]   = useLocalStorage('dan_devbox_url', SAME_ORIGIN_TERMINAL);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [frameKey, setFrameKey]     = useState(0);
  const [availability, setAvailability] = useState<Availability>('checking');
  const [unavailableReason, setUnavailableReason] = useState('');
  const [connected, setConnected]   = useState(false);
  const [showKeyBar, setShowKeyBar] = useLocalStorage<boolean>('dan_keybar', false);
  const [pasted, setPasted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      await sendText(base, text);
      setPasted(true);
      setTimeout(() => setPasted(false), 1200);
    } catch {
      // Clipboard permission denied/unavailable — open the key bar's Type
      // tab so the user can paste into a normal <input> instead, which iOS
      // always supports via long-press, even when the Clipboard API is blocked.
      setShowKeyBar(true);
    }
  }, [base, setShowKeyBar]);

  // NOTE: the control pill and quick-bar below used to auto-hide after 3s of
  // inactivity, tracked by an onPointerDown handler on the wrapper div. That
  // never worked in practice: the ttyd iframe is a separate document/origin,
  // so taps *inside* it (i.e. virtually all taps, since the iframe is
  // full-bleed) never bubble up to this page's event handlers. The controls
  // would vanish 3s after load and never come back — the user was left with
  // only iOS's bare default keyboard accessory bar. Controls are now always
  // rendered, full stop.

  // Ping terminal availability
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

  const reconnect = () => { setConnected(false); setFrameKey(k => k + 1); };

  const handleSave = (url: string) => {
    setDevboxUrl(url);
    setIsConfiguring(false);
  };

  if (isConfiguring) {
    return (
      <AnimatePresence mode="wait">
        <SetupScreen
          current={devboxUrl}
          onSave={handleSave}
          onBack={() => setIsConfiguring(false)}
        />
      </AnimatePresence>
    );
  }

  return (
    <div
      className="relative flex flex-col bg-[#0a0a0f]"
      style={{ height: 'calc(100dvh - calc(56px + max(env(safe-area-inset-bottom,0px),8px)))' }}
    >
      {/* ── Full-bleed iframe ── */}
      {availability === 'available' && (
        <iframe
          ref={iframeRef}
          key={frameKey}
          src={devboxUrl}
          className="absolute inset-0 w-full h-full border-none"
          allow="fullscreen; clipboard-read; clipboard-write; presentation"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-presentation"
          title="Web Terminal"
          onLoad={() => setConnected(true)}
        />
      )}

      {/* ── Loading overlay ── */}
      {availability === 'checking' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground bg-[#0a0a0f]">
          <Loader className="w-6 h-6 animate-spin" />
          <p className="text-sm">Connecting…</p>
        </div>
      )}

      {/* ── Unavailable overlay ── */}
      {availability === 'unavailable' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center bg-[#0a0a0f]"
        >
          <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center">
            <WifiOff className="w-7 h-7 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Terminal not available here</p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px]">
              {unavailableReason.includes('TTYD_INTERNAL_PORT')
                ? 'The web terminal only runs in the live Render container. SSH from the Connect tab instead.'
                : unavailableReason}
            </p>
          </div>
          <button onClick={reconnect}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-card border border-border/50 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors press-scale"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </motion.div>
      )}

      {/* ── Floating control pill — always visible, never auto-hides ── */}
      <AnimatePresence>
        {(
          <motion.div
            key="pill"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="absolute top-2 right-2 z-20 flex items-center gap-0.5 bg-black/70 backdrop-blur-md border border-white/10 rounded-2xl px-1.5 py-1"
          >
            {/* Status dot */}
            {availability === 'checking' ? (
              <Loader className="w-2 h-2 text-white/40 animate-spin mx-1.5" />
            ) : availability === 'available' && connected ? (
              <span className="w-2 h-2 rounded-full bg-success mx-1.5" />
            ) : availability === 'available' ? (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse mx-1.5" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-destructive mx-1.5" />
            )}

            {/* Paste from clipboard — sends copied text straight into the shell */}
            <button
              onPointerDown={(e) => { e.preventDefault(); pasteFromClipboard(); }}
              className={`p-1.5 rounded-xl transition-colors ${
                pasted ? 'text-success' : 'text-white/50 hover:text-white/80'
              }`}
              title="Paste from clipboard"
            >
              {pasted ? <Check className="w-3.5 h-3.5" /> : <ClipboardPaste className="w-3.5 h-3.5" />}
            </button>

            {/* Keyboard toggle */}
            <button
              onPointerDown={(e) => { e.preventDefault(); setShowKeyBar((v: boolean) => !v); }}
              className={`p-1.5 rounded-xl transition-colors ${
                showKeyBar ? 'text-primary' : 'text-white/50 hover:text-white/80'
              }`}
              title="Toggle key bar"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>

            {/* Reconnect */}
            <button onClick={reconnect}
              className="p-1.5 rounded-xl text-white/50 hover:text-white/80 transition-colors"
              title="Reconnect"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Settings */}
            <button onClick={() => setIsConfiguring(true)}
              className="p-1.5 rounded-xl text-white/50 hover:text-white/80 transition-colors"
              title="Settings"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Full key bar (Ctrl/Alt combos, Type tab, quick cmds) — opened via the pill ── */}
      <AnimatePresence>
        {availability === 'available' && showKeyBar && (
          <KeyBar key="keybar" base={base} onClose={() => setShowKeyBar(false)} />
        )}
      </AnimatePresence>

      {/* ── Always-on quick bar — a-Shell-style icon row, stays put right above
          the native iOS keyboard so you never have to leave it just to hit
          Tab/Esc/Ctrl+C/arrows/paste. Independent of the full key bar above. ── */}
      {availability === 'available' && !showKeyBar && (
        <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-center gap-1 px-2 py-1.5 pb-safe bg-[#141418]/95 backdrop-blur-md border-t border-white/8">
          <QuickBtn icon={<span className="font-mono text-[13px] leading-none">↹</span>} title="Tab" onPress={() => sendKey(base, 'tab')} />
          <QuickBtn icon={<XIcon className="w-4 h-4" />} title="Esc" onPress={() => sendKey(base, 'escape')} />
          <QuickBtn icon={<span className="font-mono text-[11px] font-bold leading-none">^C</span>} title="Ctrl+C" onPress={() => sendKey(base, 'ctrl+c')} />
          <div className="w-px h-5 bg-white/10" />
          <QuickBtn icon={<ArrowLeft className="w-4 h-4" />} title="Left" onPress={() => sendKey(base, 'left')} />
          <QuickBtn icon={<ArrowUp className="w-4 h-4" />} title="Up" onPress={() => sendKey(base, 'up')} />
          <QuickBtn icon={<ArrowDown className="w-4 h-4" />} title="Down" onPress={() => sendKey(base, 'down')} />
          <QuickBtn icon={<ArrowRight className="w-4 h-4" />} title="Right" onPress={() => sendKey(base, 'right')} />
          <div className="w-px h-5 bg-white/10" />
          <QuickBtn icon={pasted ? <Check className="w-4 h-4 text-success" /> : <ClipboardPaste className="w-4 h-4" />} title="Paste" onPress={pasteFromClipboard} />
          <QuickBtn icon={<CornerDownLeft className="w-4 h-4" />} title="Enter" onPress={() => sendKey(base, 'enter')} />
          <div className="w-px h-5 bg-white/10" />
          <QuickBtn icon={<Keyboard className="w-4 h-4" />} title="More keys" onPress={() => setShowKeyBar(true)} />
        </div>
      )}
    </div>
  );
}

// ── Quick bar icon button ────────────────────────────────────────────────────────
function QuickBtn({ icon, title, onPress }: { icon: React.ReactNode; title: string; onPress: () => void }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => { e.preventDefault(); onPress(); }}
      title={title}
      aria-label={title}
      className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl text-white/70 hover:text-white active:bg-white/10 active:scale-90 transition-all"
    >
      {icon}
    </button>
  );
}
