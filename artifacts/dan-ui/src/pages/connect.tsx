import { motion } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import { Apple, Key, Terminal, Zap, Cloud, Copy, Check, RefreshCw,
         Wifi, WifiOff, Loader, Shield } from 'lucide-react';
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
      watchdog: { restartCount: number; lastRestartAt: string | null; status: string } | null;
    };
    cloudflare: { enabled: boolean; running: boolean };
  };
}

// ── Big copy button ────────────────────────────────────────────────────────────
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
        className={`flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-semibold text-sm transition-all press-scale active:scale-95 ${
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

// ── Status dot ─────────────────────────────────────────────────────────────────
function Dot({ state }: { state: 'live' | 'starting' | 'off' | 'loading' }) {
  if (state === 'loading') return <Loader className="w-3 h-3 text-muted-foreground animate-spin flex-shrink-0" />;
  return (
    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
      state === 'live'     ? 'bg-success animate-pulse' :
      state === 'starting' ? 'bg-amber-500 animate-pulse' :
                             'bg-muted-foreground/40'
    }`} />
  );
}

export function Connect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading]   = useState(true);
  const [polling, setPolling]   = useState(false);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  const fetchStatus = useCallback((quiet = false) => {
    if (!quiet) setLoading(true);
    fetch(`${base}/api/status`)
      .then(r => r.json())
      .then((d: Status) => setStatus(d))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, [base]);

  // Auto-poll every 4 s while bore is enabled but not yet running + no port
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    const boreEnabled = status?.tunnel?.bore?.enabled;
    const boreRunning = status?.tunnel?.bore?.running;
    const hasPort     = Boolean(status?.tunnel?.bore?.connectCommand);

    // Keep polling while bore is enabled but tunnel not yet up or port unknown
    if (boreEnabled && (!boreRunning || !hasPort)) {
      if (!polling) {
        setPolling(true);
        const id = setInterval(() => fetchStatus(true), 4000);
        return () => { clearInterval(id); setPolling(false); };
      }
      return undefined;
    }
    setPolling(false);
    return undefined;
  }, [status, polling, fetchStatus]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const bore     = status?.tunnel?.bore;
  const cf       = status?.tunnel?.cloudflare;
  const boreCmd  = bore?.connectCommand ?? null;
  const borePort = boreCmd?.match(/-p\s+(\d+)/)?.[1] ?? null;
  const boreUp   = bore?.running ?? false;
  const cfUp     = cf?.running ?? false;
  const boreEnabled = bore?.enabled ?? false;

  const sshCmd = boreUp && boreCmd ? boreCmd
    : cfUp     ? `ssh -o "ProxyCommand cloudflared access ssh --hostname %h" devuser@dan.yourdomain.com`
    : boreCmd  ?? (borePort ? `ssh -p ${borePort} devuser@bore.pub` : 'ssh -p ????? devuser@bore.pub');

  const dotState: 'loading' | 'live' | 'starting' | 'off' = loading ? 'loading'
    : boreUp || cfUp ? 'live'
    : boreEnabled    ? 'starting'
    : 'off';

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

  return (
    <motion.div variants={container} initial="hidden" animate="show"
      className="flex flex-col gap-4 p-4 pt-5 max-w-lg mx-auto w-full pb-8"
    >
      {/* ── Page title ── */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Connect</h1>
          <p className="text-xs text-muted-foreground mt-0.5">SSH from a-Shell Mini · all traffic via Tor</p>
        </div>
        <button onClick={() => fetchStatus()} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors press-scale"
        >
          <RefreshCw className={`w-3 h-3 ${loading || polling ? 'animate-spin' : ''}`} />
          {polling ? 'Waiting…' : 'Refresh'}
        </button>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════
          HERO: LIVE SSH COMMAND — the thing they copy into a-Shell Mini
      ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div variants={item}
        className={`rounded-2xl overflow-hidden border-2 transition-colors ${
          boreUp || cfUp ? 'border-success/40 bg-success/5' :
          boreEnabled    ? 'border-amber-500/40 bg-amber-500/5' :
                           'border-border/50 bg-card'
        }`}
      >
        {/* status header */}
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
          <Dot state={dotState} />
          <span className="text-sm font-semibold text-foreground flex-1">
            {boreUp || cfUp ? 'Tunnel live — copy command below'
              : boreEnabled ? 'Waiting for tunnel port…'
              : 'Set BORE_ENABLE=yes on Render'}
          </span>
          {(boreUp || cfUp) && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/15 text-success">LIVE</span>
          )}
        </div>

        {/* BIG PORT NUMBER */}
        {borePort && (
          <div className="flex items-center justify-center px-4 pb-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Port</span>
              <span className="text-5xl font-black font-mono tracking-tighter text-primary tabular-nums">
                {borePort}
              </span>
            </div>
          </div>
        )}
        {boreEnabled && !borePort && (
          <div className="flex items-center justify-center px-4 pb-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Port</span>
              <span className="text-4xl font-black font-mono text-muted-foreground/40 animate-pulse">
                ·····
              </span>
            </div>
          </div>
        )}

        {/* SSH command pill */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-background/60 rounded-xl border border-border/50 px-3 py-2.5 font-mono text-[13px] overflow-x-auto mb-3">
            <span className="text-primary select-none flex-shrink-0">$</span>
            <span className="flex-1 whitespace-nowrap text-foreground">
              {loading ? 'Fetching…' : sshCmd}
            </span>
          </div>
          {!loading && <CopyBtn text={sshCmd} size="lg" />}
        </div>

        {/* Tor badge */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-border/30 bg-background/30">
          <Shield className="w-3 h-3 text-primary/60" />
          <span className="text-[10px] text-muted-foreground">
            Tunnel connection routed through Tor · your real IP is hidden from bore.pub
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
              add <code className="font-mono text-primary/80 text-[10px]">SSH_PUBLIC_KEY</code> → paste → Save
              (auto-redeploys).
            </p>
          </Step>
          <Step n={5} title={`Set up SSH config${borePort ? ` — port ${borePort} pre-filled` : ''}`}>
            <CodeBlock code={sshConfigBlock} />
          </Step>
          <Step n={6} title="Connect with persistent tmux session">
            <CodeBlock code={'ssh dan -t "tmux attach 2>/dev/null || tmux new -s main"'} />
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              Your session stays alive even when you close a-Shell Mini. Reopen and reconnect — same shell, same running processes.
            </p>
          </Step>
        </div>
      </motion.div>

      {/* ── bore.pub tunnel ── */}
      <motion.div variants={item} className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border/40">
          <div className="w-8 h-8 rounded-xl bg-amber-500/12 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">bore.pub Tunnel</h2>
              {boreUp
                ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/12 text-success">Running</span>
                : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/12 text-amber-400">Set BORE_ENABLE=yes</span>
              }
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Zero-config · auto-restarts · Tor-routed</p>
          </div>
        </div>
        <div className="divide-y divide-border/30">
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">Find port after deploy</p>
            <CodeBlock code={'cat ~/.dan_ssh_connect\n# → ssh -p PORT devuser@bore.pub'} />
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">Keep a stable port across restarts</p>
            <p className="text-[11px] text-muted-foreground">Set <code className="font-mono text-primary/80">BORE_SECRET=any-passphrase</code> in Render Environment — same secret = same port every time.</p>
          </div>
        </div>
      </motion.div>

      {/* ── Cloudflare (optional permanent URL) ── */}
      <motion.div variants={item} className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border/40">
          <div className="w-8 h-8 rounded-xl bg-orange-500/12 flex items-center justify-center flex-shrink-0">
            <Cloud className="w-4 h-4 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
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
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Persist across restarts</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Render free tier wipes disk — use GitHub as persistent storage</p>
          </div>
        </div>
        <div className="divide-y divide-border/30">
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">Set on Render</p>
            <CodeBlock code={'GITHUB_TOKEN=ghp_...\nDOTFILES_REPO=github.com/you/dan-dotfiles\nPROJECTS_REPO=github.com/you/dan-projects'} />
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">Sync manually from devbox</p>
            <CodeBlock code="git-sync" />
          </div>
        </div>
      </motion.div>

      {/* ── Pro tip ── */}
      <motion.div variants={item}>
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-muted/30 border border-border/30">
          <Terminal className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="text-foreground font-semibold">From devbox:</span>{' '}
            run <code className="font-mono text-primary/80">tor-ip</code> to confirm your Tor exit node,
            or <code className="font-mono text-primary/80">cat ~/.dan_ssh_connect</code> to see the
            current connection command at any time.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Small reusable step row ────────────────────────────────────────────────────
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
