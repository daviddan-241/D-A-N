import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import {
  ChevronRight, Clock, Lock, Layers, Terminal,
  Wrench, Wifi, Zap, CheckCircle2, XCircle, LoaderCircle, Copy, Check, RefreshCw,
} from 'lucide-react';
import { CodeBlock } from '@/components/code-block';

interface Stats {
  status: 'online' | 'offline';
  uptime: number;
  platform: string;
  auth: string;
  toolCount: number;
}

interface SystemStatus {
  ssh: { running: boolean; configured: boolean; authorizedKeys: number };
  tunnel: {
    bore: {
      enabled: boolean;
      running: boolean;
      connectCommand: string | null;
      watchdog: { restartCount: number; lastRestartAt: string | null; status: string } | null;
    };
    cloudflare: { enabled: boolean; running: boolean };
  };
  autoInstall: { enabled: boolean; done: boolean; running: boolean; lastLogLine: string | null };
}

type Tri = 'ok' | 'warn' | 'bad';

function CopyButton({ text, fullWidth = false }: { text: string; fullWidth?: boolean }) {
  const [copied, setCopied] = useState(false);
  const doCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable — ignore
    }
  };
  if (fullWidth) {
    return (
      <button
        type="button"
        onClick={doCopy}
        className={`flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-semibold text-sm transition-all press-scale active:scale-95 ${
          copied
            ? 'bg-success/20 text-success border border-success/30'
            : 'bg-primary text-primary-foreground shadow-glow hover:opacity-90'
        }`}
      >
        {copied ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Copy className="w-4 h-4" strokeWidth={2} />}
        {copied ? 'Copied!' : 'Copy SSH command'}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={doCopy}
      className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-colors ${
        copied ? 'bg-success/15 text-success' : 'bg-muted/60 text-muted-foreground hover:text-foreground'
      }`}
      aria-label="Copy SSH command"
    >
      {copied ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> : <Copy className="w-3.5 h-3.5" strokeWidth={2} />}
    </button>
  );
}

function StatusRow({
  label, state, sub, copyText,
}: { label: string; state: Tri; sub: string; copyText?: string | null }) {
  const Icon = state === 'ok' ? CheckCircle2 : state === 'warn' ? LoaderCircle : XCircle;
  const color = state === 'ok' ? 'text-success' : state === 'warn' ? 'text-amber-500' : 'text-destructive';
  return (
    <div className="flex items-center gap-3 py-2.5 px-1">
      <Icon className={`w-4 h-4 flex-shrink-0 ${color} ${state === 'warn' ? 'animate-spin' : ''}`} strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground truncate font-mono">{sub}</p>
      </div>
      {copyText ? <CopyButton text={copyText} /> : null}
    </div>
  );
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 400, damping: 30 } },
};

export function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  const fetchStatus = () => {
    fetch(`${base}/api/status`)
      .then(r => r.json())
      .then((d: SystemStatus) => setStatus(d))
      .catch(() => setStatus(null))
      .finally(() => setStatusLoading(false));
  };

  const restartTunnel = async () => {
    setRestarting(true);
    try {
      await fetch(`${base}/api/status/restart-tunnel`, { method: 'POST' });
    } catch {
      // ignore — status poll below will reflect the real state
    }
    setTimeout(() => {
      fetchStatus();
      setRestarting(false);
    }, 4000);
  };

  // Extract just the port number from the full ssh command
  const boreCmd = status?.tunnel.bore.connectCommand ?? null;
  const borePort = boreCmd?.match(/-p\s+(\d+)/)?.[1] ?? null;
  const tunnelLive = (status?.tunnel.bore.running && Boolean(borePort)) || status?.tunnel.cloudflare.running;

  useEffect(() => {
    fetch(`${base}/api/stats`)
      .then(r => r.json())
      .then((d) =>
        setStats({
          status: 'online',
          uptime: d.uptime ?? 0,
          platform: d.platform ?? 'Ubuntu 24.04',
          auth: d.auth ?? 'Key-only',
          toolCount: d.toolCount ?? 50,
        })
      )
      .catch(() =>
        setStats({ status: 'offline', uptime: 0, platform: 'Ubuntu 24.04', auth: 'Key-only', toolCount: 50 })
      )
      .finally(() => setLoading(false));

    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statCards = [
    {
      icon: Clock,
      label: 'Uptime',
      value: loading ? '—' : stats?.status === 'online' ? formatUptime(stats.uptime) : '—',
    },
    {
      icon: Lock,
      label: 'Auth',
      value: stats?.auth ?? 'Key-only',
    },
    {
      icon: Layers,
      label: 'OS',
      value: stats?.platform ?? 'Ubuntu 24.04',
    },
    {
      icon: Wrench,
      label: 'Tools',
      value: stats ? `${stats.toolCount}+` : '50+',
    },
  ];

  const quickLinks = [
    {
      icon: Terminal,
      label: 'Open Terminal',
      sub: 'Browser-based ttyd shell',
      href: '/terminal',
      accent: true,
    },
    {
      icon: Wrench,
      label: 'Tool Arsenal',
      sub: `${stats?.toolCount ?? 50}+ pre-installed tools`,
      href: '/tools',
      accent: false,
    },
    {
      icon: Wifi,
      label: 'Connect from iOS',
      sub: 'SSH via Cloudflare or bore',
      href: '/connect',
      accent: false,
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-5 p-4 pt-8 max-w-lg mx-auto w-full"
    >
      {/* ── Header ── */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">D·A·N</h1>
          <p className="text-sm text-muted-foreground font-medium mt-0.5">Dynamic Access Node</p>
        </div>
        <motion.div
          animate={loading ? {} : { scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
            loading
              ? 'bg-muted/60 text-muted-foreground'
              : stats?.status === 'online'
              ? 'bg-success/12 text-success'
              : 'bg-destructive/12 text-destructive'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              loading
                ? 'bg-muted-foreground animate-pulse'
                : stats?.status === 'online'
                ? 'bg-success animate-pulse'
                : 'bg-destructive'
            }`}
          />
          {loading ? 'Checking…' : stats?.status === 'online' ? 'Online' : 'Offline'}
        </motion.div>
      </motion.div>

      {/* ── Stat cards ── */}
      <motion.div variants={item} className="grid grid-cols-2 gap-3">
        {statCards.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="flex items-center gap-3 p-4 rounded-2xl bg-card card-shadow border border-border/50"
          >
            <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
              <Icon className="w-4 h-4 text-primary" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
              <p className="text-sm font-semibold text-foreground truncate">{value}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── SSH Connection Hero ── */}
      {status?.tunnel.bore.enabled && (
        <motion.div variants={item}
          className={`rounded-2xl overflow-hidden border-2 transition-colors ${
            tunnelLive
              ? 'border-success/40 bg-success/5'
              : 'border-amber-500/30 bg-amber-500/5'
          }`}
        >
          {/* header row */}
          <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              tunnelLive ? 'bg-success animate-pulse' : 'bg-amber-500 animate-pulse'
            }`} />
            <span className="text-sm font-semibold text-foreground flex-1">
              {tunnelLive ? 'SSH tunnel live' : statusLoading ? 'Checking tunnel…' : 'Waiting for port…'}
            </span>
            {tunnelLive && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/15 text-success">LIVE</span>
            )}
          </div>

          {/* big port number */}
          <div className="flex items-center justify-center px-4 py-1">
            {borePort ? (
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Port</span>
                <span className="text-5xl font-black font-mono tracking-tighter text-primary tabular-nums select-all">
                  {borePort}
                </span>
              </div>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Port</span>
                <span className="text-4xl font-black font-mono text-muted-foreground/30 animate-pulse">·····</span>
              </div>
            )}
          </div>

          {/* command + copy button */}
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 bg-background/60 rounded-xl border border-border/50 px-3 py-2.5 font-mono text-[13px] overflow-x-auto mb-3">
              <span className="text-primary select-none flex-shrink-0">$</span>
              <span className="flex-1 whitespace-nowrap text-foreground select-all">
                {statusLoading ? 'Fetching…' : (boreCmd ?? (status?.tunnel.cloudflare.running ? 'ssh devuser@<your-tunnel>' : 'Waiting for bore.pub port…'))}
              </span>
            </div>
            {!statusLoading && boreCmd && (
              <CopyButton text={boreCmd} fullWidth />
            )}
          </div>
        </motion.div>
      )}

      {/* ── System status ── */}
      <motion.div variants={item} className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          System Status
        </p>
        <div className="rounded-2xl bg-card card-shadow border border-border/50 divide-y divide-border/40 px-3">
          <StatusRow
            label="SSH server"
            state={statusLoading ? 'warn' : status?.ssh.running ? (status.ssh.configured ? 'ok' : 'warn') : 'bad'}
            sub={
              statusLoading
                ? 'Checking…'
                : !status
                ? 'Unable to reach status endpoint'
                : !status.ssh.running
                ? 'sshd is not running'
                : status.ssh.configured
                ? `Running · ${status.ssh.authorizedKeys} key(s) authorized`
                : 'Running · no SSH_PUBLIC_KEY set yet'
            }
          />
          <StatusRow
            label="Real SSH tunnel"
            state={
              statusLoading
                ? 'warn'
                : status?.tunnel.bore.running || status?.tunnel.cloudflare.running
                ? 'ok'
                : status?.tunnel.bore.enabled || status?.tunnel.cloudflare.enabled
                ? 'warn'
                : 'bad'
            }
            sub={
              statusLoading
                ? 'Checking…'
                : status?.tunnel.bore.running && status.tunnel.bore.connectCommand
                ? status.tunnel.bore.connectCommand
                : status?.tunnel.cloudflare.running
                ? 'Cloudflare Tunnel active'
                : status?.tunnel.bore.enabled || status?.tunnel.cloudflare.enabled
                ? 'Enabled, starting…'
                : 'Set BORE_ENABLE=yes to activate'
            }
            copyText={status?.tunnel.bore.running ? status.tunnel.bore.connectCommand : null}
          />
          {status?.tunnel.bore.enabled && status.tunnel.bore.watchdog && (
            <StatusRow
              label="Tunnel watchdog"
              state={
                status.tunnel.bore.watchdog.status === "failed"
                  ? "bad"
                  : status.tunnel.bore.watchdog.restartCount > 0
                  ? "warn"
                  : "ok"
              }
              sub={
                status.tunnel.bore.watchdog.restartCount > 0
                  ? `Auto-restarted ${status.tunnel.bore.watchdog.restartCount} time(s) · last at ${new Date(
                      status.tunnel.bore.watchdog.lastRestartAt ?? ""
                    ).toLocaleString()}`
                  : "Watching · no restarts needed"
              }
              copyText={null}
            />
          )}
          <StatusRow
            label="Tool auto-install"
            state={
              statusLoading
                ? 'warn'
                : status?.autoInstall.done
                ? 'ok'
                : status?.autoInstall.running
                ? 'warn'
                : status?.autoInstall.enabled
                ? 'warn'
                : 'bad'
            }
            sub={
              statusLoading
                ? 'Checking…'
                : status?.autoInstall.done
                ? 'All extra tools installed'
                : status?.autoInstall.running
                ? (status.autoInstall.lastLogLine ?? 'Installing in background…')
                : status?.autoInstall.enabled
                ? 'Queued for first boot'
                : 'Set AUTO_INSTALL_EXTRAS=yes to enable'
            }
          />
        </div>
        {status?.tunnel.bore.enabled ? (
          <button
            type="button"
            disabled={restarting}
            onClick={restartTunnel}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border/50 bg-card text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-border transition-all press-scale disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${restarting ? 'animate-spin' : ''}`} strokeWidth={2} />
            {restarting ? 'Restarting tunnel…' : 'Restart SSH tunnel'}
          </button>
        ) : null}
      </motion.div>

      {/* ── Quick connect ── */}
      <motion.div variants={item} className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Quick Connect
        </p>
        <CodeBlock
          label="SSH"
          code={
            status?.tunnel.bore.running && status.tunnel.bore.connectCommand
              ? status.tunnel.bore.connectCommand
              : status?.tunnel.cloudflare.running
              ? `ssh -o "ProxyCommand cloudflared access ssh --hostname %h" devuser@<your-tunnel-host>`
              : statusLoading
              ? 'Fetching SSH command…'
              : 'ssh -p <port> devuser@bore.pub  # see /connect for setup'
          }
        />
      </motion.div>

      {/* ── Quick links ── */}
      <motion.div variants={item} className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Quick Access
        </p>
        <div className="flex flex-col gap-2">
          {quickLinks.map(({ icon: Icon, label, sub, href, accent }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-4 p-4 rounded-2xl border transition-all press-scale ${
                accent
                  ? 'bg-primary text-primary-foreground border-primary/40 shadow-[0_4px_24px_-6px_hsl(var(--primary)/0.4)]'
                  : 'bg-card border-border/50 text-foreground card-shadow hover:border-border'
              }`}
            >
              <div
                className={`w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 ${
                  accent ? 'bg-white/15' : 'bg-primary/10'
                }`}
              >
                <Icon className={`w-5 h-5 ${accent ? 'text-white' : 'text-primary'}`} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${accent ? 'text-white' : 'text-foreground'}`}>
                  {label}
                </p>
                <p className={`text-xs mt-0.5 ${accent ? 'text-white/70' : 'text-muted-foreground'}`}>
                  {sub}
                </p>
              </div>
              <ChevronRight
                className={`w-4 h-4 flex-shrink-0 ${accent ? 'text-white/60' : 'text-muted-foreground'}`}
              />
            </Link>
          ))}
        </div>
      </motion.div>

      {/* ── Footer ── */}
      <motion.div variants={item}>
        <div className="flex items-center gap-2 px-1">
          <Zap className="w-3 h-3 text-primary" />
          <p className="text-xs text-muted-foreground">
            Hardened Ubuntu 24.04 · SSH key-only · fail2ban
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
