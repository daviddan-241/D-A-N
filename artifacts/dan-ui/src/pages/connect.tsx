import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Apple, Key, Link2, Terminal, Zap, Cloud, Copy, Check, RefreshCw, Wifi } from 'lucide-react';
import { CodeBlock } from '@/components/code-block';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 30 } },
};

interface TunnelStatus {
  bore: {
    enabled: boolean;
    running: boolean;
    connectCommand: string | null;
    watchdog: { restartCount: number; lastRestartAt: string | null; status: string } | null;
  };
  cloudflare: { enabled: boolean; running: boolean };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all press-scale ${
        copied ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary hover:bg-primary/18'
      }`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export function Connect() {
  const [tunnel, setTunnel] = useState<TunnelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  const fetchStatus = () => {
    setLoading(true);
    fetch(`${base}/api/status`)
      .then(r => r.json())
      .then((d) => { setTunnel(d.tunnel); })
      .catch(() => setTunnel(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStatus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Extract port from bore connect command: "ssh -p 12345 devuser@bore.pub"
  const boreCmd = tunnel?.bore.connectCommand ?? null;
  const borePort = boreCmd?.match(/-p\s+(\d+)/)?.[1] ?? null;
  const boreRunning = tunnel?.bore.running ?? false;
  const cfRunning = tunnel?.cloudflare.running ?? false;

  // Pre-filled commands — prefer bore, fall back to Cloudflare if bore is down
  const portPlaceholder = borePort ?? '12345';
  const sshCmd = boreRunning && boreCmd
    ? boreCmd
    : cfRunning
    ? `ssh -o "ProxyCommand cloudflared access ssh --hostname %h" devuser@dan.yourdomain.com`
    : boreCmd ?? `ssh -p ${portPlaceholder} devuser@bore.pub`;
  const sshConfigBlock =
    `cat << 'EOF' > ~/.ssh/config\nHost dan\n  HostName bore.pub\n  Port ${portPlaceholder}\n  User devuser\n  IdentityFile ~/.ssh/id_ed25519\n  ServerAliveInterval 60\n  ServerAliveCountMax 3\nEOF`;
  const sshTmux = `ssh dan -t "tmux attach 2>/dev/null || tmux new -s main"`;

  const tunnelBadge = boreRunning
    ? { label: 'Live', color: 'bg-success/15 text-success' }
    : cfRunning
    ? { label: 'Cloudflare Live', color: 'bg-orange-500/15 text-orange-400' }
    : tunnel?.bore.enabled
    ? { label: 'Starting…', color: 'bg-amber-500/15 text-amber-400' }
    : { label: 'Not enabled', color: 'bg-muted/60 text-muted-foreground' };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-5 p-4 pt-6 max-w-lg mx-auto w-full pb-6"
    >
      <motion.div variants={item}>
        <h1 className="text-xl font-bold text-foreground">Connect</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real SSH from your iPhone via a-Shell Mini. Commands are auto-filled with your live tunnel port.
        </p>
      </motion.div>

      {/* ── Live SSH command banner ── */}
      <motion.div variants={item} className="rounded-2xl border border-border/50 bg-card card-shadow overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border/40">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/12 text-primary">
            <Wifi className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-foreground">Live SSH Command</h2>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tunnelBadge.color}`}>
                {loading ? '…' : tunnelBadge.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {boreRunning
                ? `Port ${borePort} is live — paste this into a-Shell Mini`
                : cfRunning
                ? 'Cloudflare tunnel is active'
                : 'Set BORE_ENABLE=yes on Render to activate'}
            </p>
          </div>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors press-scale"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-2 bg-muted/30 rounded-xl px-3 py-2.5 font-mono text-xs text-foreground overflow-x-auto">
            <span className="text-primary select-none flex-shrink-0">$</span>
            <span className="flex-1 whitespace-nowrap">{loading ? 'Fetching…' : sshCmd}</span>
          </div>
          {!loading && <div className="flex justify-end"><CopyButton text={sshCmd} /></div>}
        </div>
      </motion.div>

      {/* ── a-Shell Mini setup ── */}
      <motion.div variants={item} className="rounded-2xl border border-border/50 bg-card card-shadow overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border/40">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-500/12 text-blue-400">
            <Apple className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">a-Shell Mini Setup</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/12 text-blue-400">iOS</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Full SSH from iPhone — free from App Store</p>
          </div>
        </div>
        <div className="flex flex-col divide-y divide-border/30">
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">1. Install a-Shell Mini</p>
            <a
              href="https://apps.apple.com/app/a-shell-mini/id1543537943"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/18 transition-colors press-scale"
            >
              <Apple className="w-3.5 h-3.5" />
              Open App Store
            </a>
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">2. Generate a key on your phone</p>
            <p className="text-xs text-muted-foreground">The private key never leaves your device.</p>
            <CodeBlock code={'ssh-keygen -t ed25519 -C "iphone"\n# press Enter 3× for defaults'} />
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">3. Copy your public key</p>
            <CodeBlock code="cat ~/.ssh/id_ed25519.pub" />
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">4. Paste into SSH_PUBLIC_KEY on Render, then redeploy</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Render dashboard → your service → Environment → <code className="font-mono text-primary/80">SSH_PUBLIC_KEY</code> → paste → Save (triggers redeploy automatically).
            </p>
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">
              5. Create SSH config
              {borePort && <span className="text-primary ml-1">(port {borePort} pre-filled)</span>}
            </p>
            <CodeBlock code={sshConfigBlock} />
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">6. Connect with persistent tmux session</p>
            <CodeBlock code={sshTmux} />
          </div>
        </div>
      </motion.div>

      {/* ── bore.pub (zero config) ── */}
      <motion.div variants={item} className="rounded-2xl border border-border/50 bg-card card-shadow overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border/40">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-500/12 text-amber-400">
            <Zap className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">bore.pub Tunnel</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/12 text-amber-400">Zero Config</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Enabled by default — set BORE_ENABLE=yes on Render</p>
          </div>
        </div>
        <div className="flex flex-col divide-y divide-border/30">
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">Find your port after deploy</p>
            <CodeBlock code={'cat ~/.dan_ssh_connect\n# → ssh -p <PORT> devuser@bore.pub'} />
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">
              Your current command
              {boreRunning && <span className="text-success ml-1">● live</span>}
            </p>
            <CodeBlock code={sshCmd} />
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">Keep stable port across restarts</p>
            <CodeBlock code={'BORE_SECRET=any-random-string  # set in Render Environment'} />
          </div>
        </div>
      </motion.div>

      {/* ── Cloudflare ── */}
      <motion.div variants={item} className="rounded-2xl border border-border/50 bg-card card-shadow overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border/40">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-500/12 text-orange-400">
            <Cloud className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Cloudflare Tunnel</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/12 text-orange-400">Permanent URL</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Fixed hostname, free Cloudflare account required</p>
          </div>
        </div>
        <div className="flex flex-col divide-y divide-border/30">
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">1. Create tunnel in Cloudflare dashboard</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              dash.cloudflare.com → Zero Trust → Networks → Tunnels → Create.
              Add public hostname: <code className="font-mono text-primary/80">dan.yourdomain.com → ssh://localhost:22</code>
            </p>
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">2. Set token on Render</p>
            <CodeBlock code="CLOUDFLARE_TUNNEL_TOKEN=eyJ..." />
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">3. SSH from anywhere</p>
            <CodeBlock code={'ssh -o "ProxyCommand cloudflared access ssh --hostname %h" \\\n  devuser@dan.yourdomain.com'} />
          </div>
        </div>
      </motion.div>

      {/* ── Persistence ── */}
      <motion.div variants={item} className="rounded-2xl border border-border/50 bg-card card-shadow overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border/40">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-violet-500/12 text-violet-400">
            <Key className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Persist across restarts</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Render free tier wipes disk — use GitHub as your disk</p>
          </div>
        </div>
        <div className="flex flex-col divide-y divide-border/30">
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">Set these on Render</p>
            <CodeBlock code={'GITHUB_TOKEN=ghp_...\nDOTFILES_REPO=github.com/you/dan-dotfiles\nPROJECTS_REPO=github.com/you/dan-projects'} />
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground/80">Manual sync anytime (inside devbox)</p>
            <CodeBlock code="git-sync" />
          </div>
        </div>
      </motion.div>

      {/* ── Pro tip ── */}
      <motion.div variants={item}>
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-muted/40 border border-border/40">
          <Terminal className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-foreground font-medium">Pro tip:</span> Use{' '}
            <code className="font-mono text-primary/80">{'ssh dan -t "tmux attach 2>/dev/null || tmux new -s main"'}</code>{' '}
            so your session survives connection drops and you always land in tmux.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
