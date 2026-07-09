import { motion } from 'framer-motion';
import { Apple, Key, Link2, Terminal, Zap, Cloud } from 'lucide-react';
import { CodeBlock } from '@/components/code-block';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 30 } },
};

const SECTIONS = [
  {
    id: 'bore',
    icon: Zap,
    accent: 'bg-amber-500/12 text-amber-400',
    badge: 'Zero Config',
    title: 'Quick SSH via bore.pub',
    sub: 'No accounts needed. Works in 30 seconds.',
    steps: [
      {
        label: '1. Set SSH_PUBLIC_KEY on Render',
        note: 'Paste your public key (see the a-Shell Mini section below for how to generate one). bore is already enabled by default.',
      },
      {
        label: '2. After deploy, find your port',
        code: 'cat ~/.dan_ssh_connect\n# → ssh -p 12345 devuser@bore.pub',
      },
      {
        label: '3. Connect from anywhere',
        code: 'ssh -p 12345 devuser@bore.pub',
      },
    ],
  },
  {
    id: 'cloudflare',
    icon: Cloud,
    accent: 'bg-orange-500/12 text-orange-400',
    badge: 'Permanent URL',
    title: 'SSH via Cloudflare Tunnel',
    sub: 'Fixed hostname, free Cloudflare account required.',
    steps: [
      {
        label: '1. Create tunnel in Cloudflare dashboard',
        note: 'dash.cloudflare.com → Zero Trust → Networks → Tunnels → Create. Add public hostname: dan.yourdomain.com → ssh://localhost:22',
      },
      {
        label: '2. Set CLOUDFLARE_TUNNEL_TOKEN on Render',
        code: 'CLOUDFLARE_TUNNEL_TOKEN=eyJ...',
      },
      {
        label: '3. Install cloudflared on your phone/Mac',
        note: 'Download from: developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/',
      },
      {
        label: '4. SSH from anywhere',
        code: 'ssh -o "ProxyCommand cloudflared access ssh --hostname %h" \\\n  devuser@dan.yourdomain.com',
      },
    ],
  },
  {
    id: 'ashell',
    icon: Apple,
    accent: 'bg-blue-500/12 text-blue-400',
    badge: 'iOS Native',
    title: 'Set up a-Shell Mini',
    sub: 'Full SSH client on iPhone — free from the App Store.',
    steps: [
      {
        label: '1. Install a-Shell Mini',
        action: { label: 'Open App Store', url: 'https://apps.apple.com/app/a-shell-mini/id1543537943' },
      },
      {
        label: '2. Generate a key ON your phone (private key never leaves it)',
        code: 'ssh-keygen -t ed25519 -C "iphone"\n# press Enter 3x for defaults',
      },
      {
        label: '3. Copy the public key it prints',
        code: 'cat ~/.ssh/id_ed25519.pub',
      },
      {
        label: '4. Paste it into SSH_PUBLIC_KEY on Render, then redeploy',
        note: 'Render dashboard → your service → Environment → SSH_PUBLIC_KEY → paste → Save (this triggers a redeploy).',
      },
      {
        label: '5. Create SSH config (use the port from ~/.dan_ssh_connect)',
        code: 'cat << EOF > ~/.ssh/config\nHost dan\n  HostName bore.pub\n  Port 12345\n  User devuser\n  IdentityFile ~/.ssh/id_ed25519\n  ServerAliveInterval 60\nEOF',
      },
      {
        label: '6. Connect and attach tmux',
        code: 'ssh dan -t "tmux attach || tmux new -s main"',
      },
    ],
  },
  {
    id: 'persistence',
    icon: Key,
    accent: 'bg-violet-500/12 text-violet-400',
    badge: 'Survival',
    title: 'Persist across restarts',
    sub: 'Render free tier wipes disk on restart — use GitHub as your disk.',
    steps: [
      {
        label: 'Create two private repos on GitHub',
        note: 'One for dotfiles (shell config, SSH keys), one for projects.',
      },
      {
        label: 'Set env vars on Render',
        code: 'GITHUB_TOKEN=ghp_...\nDOTFILES_REPO=github.com/you/dan-dotfiles\nPROJECTS_REPO=github.com/you/dan-projects',
      },
      {
        label: 'Store authorized_keys in dotfiles',
        code: '# In dan-dotfiles repo:\nmkdir -p .ssh\ncat ~/.ssh/id_ed25519.pub > .ssh/authorized_keys',
      },
      {
        label: 'Manual sync anytime',
        code: 'git-sync    # alias for dotfiles-sync.sh',
      },
    ],
  },
];

export function Connect() {
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
          The web terminal already works out of the box — open the Terminal tab.
          For real SSH from your iPhone, Mac, or anywhere, pick an option below.
        </p>
      </motion.div>

      {SECTIONS.map(section => {
        const Icon = section.icon;
        return (
          <motion.div
            key={section.id}
            variants={item}
            className="rounded-2xl border border-border/50 bg-card card-shadow overflow-hidden"
          >
            {/* Section header */}
            <div className="flex items-center gap-3 p-4 border-b border-border/40">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${section.accent}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${section.accent}`}>
                    {section.badge}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{section.sub}</p>
              </div>
            </div>

            {/* Steps */}
            <div className="flex flex-col divide-y divide-border/30">
              {section.steps.map((step, i) => (
                <div key={i} className="p-4 space-y-2">
                  <p className="text-xs font-semibold text-foreground/80">{step.label}</p>
                  {'note' in step && step.note && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.note}</p>
                  )}
                  {'code' in step && step.code && (
                    <CodeBlock code={step.code} />
                  )}
                  {'action' in step && step.action && (
                    <a
                      href={step.action.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/18 transition-colors press-scale"
                    >
                      <Apple className="w-3.5 h-3.5" />
                      {step.action.label}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}

      {/* Quick tip */}
      <motion.div variants={item}>
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-muted/40 border border-border/40">
          <Terminal className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-foreground font-medium">Pro tip:</span> Use tmux so your session
            survives connection drops. Run <code className="font-mono text-primary/80">tmux new -s main</code> on
            first connect, then <code className="font-mono text-primary/80">tmux attach -t main</code> on
            subsequent ones.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
