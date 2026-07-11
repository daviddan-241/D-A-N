import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Apple, Key, Terminal, Zap, Cloud, Copy, Check, RefreshCw,
         Loader, Shield, Wifi, Play } from 'lucide-react';
import { CodeBlock } from '@/components/code-block';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show:  { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 30 } },
};

interface Status {
  ssh: { running: boolean; authorizedKeys: number };
  tunnel: {
    bore: {
      enabled: boolean;
      running: boolean;
      connectCommand: string | null;
      tunnelStatus?: string;
      watchdog: { restartCount: number; lastRestartAt: string | null; status: string } | null;
    };
    cloudflare: { enabled: boolean; running: boolean };
  };
}

function CopyBtn({ text, size = 'sm' }: { text: string; size?: 'sm' | 'lg' }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  if (size === 'lg') {
    return (
      <button type="button" onClick={copy}
        className={`flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-semibold text-sm transition-all press-scale ${
          copied
            ? 'bg-success/20 text-success border border-success/30'
            : 'bg-primary text-primary-foreground shadow-glow hover:opacity-90'
        }`}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        {copied ? 'Copied to clipboard!' : 'Copy SSH command'}
      </button>
    );
  }
  return (
    <button type="button" onClick={copy}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all press-scale ${
        copied ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary hover:bg-primary/18'
      }`}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export function Connect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pollCount, setPollCount]   = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  const fetchStatus = useCallback((quiet = false) => {
    if (!quiet) setLoading(true);
    return fetch(`${base}/api/status`)
      .then(r => r.json())
      .then((d: Status) => { setStatus(d); return d; })
      .catch(() => { setStatus(null); return null; })
      .finally(() => setLoading(false));
  }, [base]);

  // Initial load + passive 15s poll
  useEffect(() => {
    fetchStatus();
    const id = setInterval(() => fetchStatus(true), 15000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  // Active polling while generating
  useEffect(() => {
    if (!generating) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    setPollCount(0);
    pollRef.current = setInterval(async () => {
      setPollCount(c => c + 1);
      const d = await fetchStatus(true);
      if (d?.tunnel?.bore?.connectCommand) {
        setGenerating(false);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    }, 1500);
    // Stop after 60s regardless
    const timeout = setTimeout(() => {
      setGenerating(false);
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }, 60000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      clearTimeout(timeout);
    };
  }, [generating, fetchStatus]);

  const generatePort = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      await fetch(`${base}/api/tunnel/start`, { method: 'POST' });
    } catch {
      // ignore — polling will surface any error
    }
  };

  // Derived
  const bore      = status?.tunnel?.bore;
  const cf        = status?.tunnel?.cloudflare;
  const boreCmd   = bore?.connectCommand ?? null;
  const borePort  = boreCmd?.match(/-p\s+(\d+)/)?.[1] ?? null;
  const boreUp    = Boolean(boreCmd);
  const cfUp      = cf?.running ?? false;
  const boreEnabled = bore?.enabled ?? false;

  const sshCmd = boreCmd ?? (cfUp
    ? `ssh -o "ProxyCommand cloudflared access ssh --hostname %h" devuser@dan.yourdomain.com`
    : 'ssh -p ????? devuser@bore.pub');

  const portPlaceholder = borePort ?? '?????';
  const sshConfigBlock =
`cat << 'EOF' >> ~/.ssh/config
Host dan
  HostName bore.pub
  Port ${portPlaceholder}
  User devuser
  IdentityFile ~/.ssh/id_ed25519
  ServerAliveInterval 60
  ServerAliveCountMax 3
EOF`;

  const heroState: 'live' | 'generating' | 'waiting' | 'off' =
    boreUp || cfUp ? 'live' :
    generating     ? 'generating' :
    boreEnabled    ? 'waiting' :
    'off';

  return (
    <motion.div variants={container} initial="hidden" animate="show"
      className="flex flex-col gap-4 p-4 pt-5 max-w-lg mx-auto w-full pb-8"
    >
      {/* Title */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Connect</h1>
          <p className="text-xs text-muted-foreground mt-0.5">SSH from a-Shell Mini · bore.pub tunnel</p>
        </div>
        <button onClick={() => fetchStatus()} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors press-scale"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </motion.div>

      {/* ═══════════════════════ HERO PORT CARD ═══════════════════════════════ */}
      <motion.div variants={item}
        className={`rounded-2xl overflow-hidden border-2 transition-all ${
          heroState === 'live'       ? 'border-success/40 bg-success/5' :
          heroState === 'generating' ? 'border-primary/40 bg-primary/5' :
          heroState === 'waiting'    ? 'border-amber-500/30 bg-amber-500/5' :
                                       'border-border/50 bg-card'
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
          {heroState === 'generating' ? (
            <Loader className="w-3.5 h-3.5 text-primary animate-spin flex-shrink-0" />
          ) : heroState === 'live' ? (
            <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse flex-shrink-0" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60 flex-shrink-0" />
          )}
          <span className="text-sm font-semibold text-foreground flex-1">
            {heroState === 'live'       ? 'Tunnel live — SSH command ready' :
             heroState === 'generating' ? `Generating port… (${pollCount}s)` :
             heroState === 'waiting'    ? 'Tap to generate your port' :
                                          'Set BORE_ENABLE=yes on Render'}
          </span>
          {heroState === 'live' && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/15 text-success">LIVE</span>
          )}
        </div>

        {/* Big port number */}
        <AnimatePresence mode="wait">
          {borePort ? (
            <motion.div key="port"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center px-4 pb-1"
            >
              <div className="flex items-baseline gap-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Port</span>
                <span className="text-6xl font-black font-mono tracking-tighter text-primary tabular-nums select-all">
                  {borePort}
                </span>
              </div>
            </motion.div>
          ) : heroState === 'generating' ? (
            <motion.div key="generating"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center px-4 pb-2 gap-2"
            >
              <div className="flex items-center gap-1.5">
                {[0,1,2,3,4].map(i => (
                  <motion.span key={i}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
                    className="w-2.5 h-2.5 rounded-full bg-primary"
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Connecting to bore.pub…</p>
            </motion.div>
          ) : boreEnabled ? (
            <motion.div key="waiting"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center justify-center px-4 pb-2"
            >
              <span className="text-4xl font-black font-mono text-muted-foreground/25 tracking-widest">·····</span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* SSH command or Generate button */}
        <div className="px-4 pb-4 space-y-3">
          {boreCmd ? (
            <>
              <div className="flex items-center gap-2 bg-background/60 rounded-xl border border-border/50 px-3 py-2.5 font-mono text-[13px] overflow-x-auto">
                <span className="text-primary select-none flex-shrink-0">$</span>
                <span className="flex-1 whitespace-nowrap text-foreground select-all">{sshCmd}</span>
              </div>
              <CopyBtn text={sshCmd} size="lg" />
              {boreEnabled && (
                <button onClick={generatePort} disabled={generating}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border/50 bg-background/40 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors press-scale disabled:opacity-40"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                  Get a new port
                </button>
              )}
            </>
          ) : boreEnabled ? (
            <button onClick={generatePort} disabled={generating}
              className={`w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-bold text-base transition-all press-scale ${
                generating
                  ? 'bg-primary/20 text-primary border border-primary/30 cursor-wait'
                  : 'bg-primary text-primary-foreground shadow-[0_4px_24px_-6px_hsl(var(--primary)/0.5)] hover:opacity-90 active:scale-95'
              }`}
            >
              {generating
                ? <><Loader className="w-5 h-5 animate-spin" /> Connecting to bore.pub…</>
                : <><Play className="w-5 h-5 fill-current" /> Generate SSH Port</>
              }
            </button>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              Set <code className="font-mono text-primary/80">BORE_ENABLE=yes</code> in Render Environment to activate the tunnel.
            </p>
          )}
        </div>

        {/* Footer badge */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-border/20 bg-background/20">
          <Shield className="w-3 h-3 text-primary/50" />
          <span className="text-[10px] text-muted-foreground">
            SSH is end-to-end encrypted · set <code className="font-mono">BORE_SECRET</code> for a stable port
          </span>
        </div>
      </motion.div>

      {/* ── a-Shell Mini setup ── */}
      <motion.div variants={item} className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border/40">
          <div className="w-8 h-8 rounded-xl bg-blue-500/12 flex items-center justify-center flex-shrink-0">
            <Apple className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">a-Shell Mini Setup</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/12 text-blue-400">iOS</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Free on App Store · real SSH · full terminal</p>
          </div>
        </div>
        <div className="divide-y divide-border/30">
          <Step n={1} title="Install a-Shell Mini">
            <a href="https://apps.apple.com/app/a-shell-mini/id1543537943"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/18 transition-colors press-scale"
            >
              <Apple className="w-3.5 h-3.5" /> Open App Store
            </a>
          </Step>
          <Step n={2} title="Generate a key on your phone">
            <p className="text-[11px] text-muted-foreground mb-2">Private key never leaves your device.</p>
            <CodeBlock code={'ssh-keygen -t ed25519 -C "iphone"\n# press Enter 3× for no passphrase'} />
          </Step>
          <Step n={3} title="Copy your public key">
            <CodeBlock code="cat ~/.ssh/id_ed25519.pub" />
          </Step>
          <Step n={4} title="Paste into Render → SSH_PUBLIC_KEY → redeploy">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Render dashboard → your service → <strong className="text-foreground">Environment</strong> →
              add <code className="font-mono text-primary/80 text-[10px]">SSH_PUBLIC_KEY</code> → paste → Save (auto-redeploys).
            </p>
          </Step>
          <Step n={5} title={borePort ? `Set up SSH config — port ${borePort} pre-filled` : 'Set up SSH config (generate port above first)'}>
            <CodeBlock code={sshConfigBlock} />
          </Step>
          <Step n={6} title="Connect with persistent tmux session">
            <CodeBlock code={'ssh dan -t "tmux attach 2>/dev/null || tmux new -s main"'} />
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              Your session stays alive when you close a-Shell Mini. Reopen and reconnect — same shell, same processes.
            </p>
          </Step>
        </div>
      </motion.div>

      {/* ── bore.pub info ── */}
      <motion.div variants={item} className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border/40">
          <div className="w-8 h-8 rounded-xl bg-amber-500/12 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">bore.pub Tunnel</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Zero-config · auto-restarts · managed by D.A.N.</p>
          </div>
        </div>
        <div className="divide-y divide-border/30">
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">Stable port across restarts</p>
            <p className="text-[11px] text-muted-foreground">
              Set <code className="font-mono text-primary/80">BORE_SECRET=any-passphrase</code> in Render Environment — same secret = same port every time.
            </p>
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">From the devbox shell</p>
            <CodeBlock code={'cat ~/.dan_ssh_connect\n# → ssh -p PORT devuser@bore.pub'} />
          </div>
        </div>
      </motion.div>

      {/* ── Cloudflare (optional permanent URL) ── */}
      <motion.div variants={item} className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border/40">
          <div className="w-8 h-8 rounded-xl bg-orange-500/12 flex items-center justify-center flex-shrink-0">
            <Cloud className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Cloudflare Tunnel</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/12 text-orange-400">Permanent URL</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Fixed hostname — free Cloudflare account required</p>
          </div>
        </div>
        <div className="divide-y divide-border/30">
          <Step n={1} title="Create tunnel in Cloudflare dashboard">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              dash.cloudflare.com → Zero Trust → Networks → Tunnels → Create.<br />
              Add hostname: <code className="font-mono text-primary/80 text-[10px]">dan.yourdomain.com → ssh://localhost:22</code>
            </p>
          </Step>
          <Step n={2} title="Set token on Render">
            <CodeBlock code="CLOUDFLARE_TUNNEL_TOKEN=eyJ..." />
          </Step>
          <Step n={3} title="SSH from anywhere">
            <CodeBlock code={'ssh -o "ProxyCommand cloudflared access ssh --hostname %h" \\\n  devuser@dan.yourdomain.com'} />
          </Step>
        </div>
      </motion.div>

      {/* ── GitHub persistence ── */}
      <motion.div variants={item} className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border/40">
          <div className="w-8 h-8 rounded-xl bg-violet-500/12 flex items-center justify-center flex-shrink-0">
            <Key className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Persist across restarts</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Render free tier wipes disk — use GitHub as persistent storage</p>
          </div>
        </div>
        <div className="divide-y divide-border/30">
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">Set on Render</p>
            <CodeBlock code={'GITHUB_TOKEN=ghp_...\nDOTFILES_REPO=github.com/you/dan-dotfiles'} />
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">Sync manually from devbox</p>
            <CodeBlock code="git-sync" />
          </div>
        </div>
      </motion.div>

      {/* Pro tip */}
      <motion.div variants={item}>
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-muted/30 border border-border/30">
          <Terminal className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="text-foreground font-semibold">Stable port tip:</span>{' '}
            set <code className="font-mono text-primary/80">BORE_SECRET=yourpassphrase</code> on Render.
            Same secret = same port on every restart, so your SSH config never needs updating.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-black flex items-center justify-center flex-shrink-0">
          {n}
        </span>
        <p className="text-xs font-semibold text-foreground/85">{title}</p>
      </div>
      {children}
    </div>
  );
}
