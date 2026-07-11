import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Check, Copy } from 'lucide-react';

type Tool = { name: string; category: string; desc: string; cmd: string };

const TOOLS: Tool[] = [
  // Recon
  { name: 'nmap',         category: 'Recon',    desc: 'Network exploration & port scanner',               cmd: 'nmap -sV -sC -p- target' },
  { name: 'masscan',      category: 'Recon',    desc: 'Fast async TCP port scanner (1M pps)',             cmd: 'masscan -p1-65535 target --rate=1000' },
  { name: 'amass',        category: 'Recon',    desc: 'Attack surface mapping & asset discovery',         cmd: 'amass enum -d target.com' },
  { name: 'subfinder',    category: 'Recon',    desc: 'Passive subdomain enumeration',                    cmd: 'subfinder -d target.com -all' },
  { name: 'dnsx',         category: 'Recon',    desc: 'Fast multi-purpose DNS toolkit',                   cmd: 'dnsx -l subdomains.txt -resp -a -aaaa' },
  { name: 'httpx',        category: 'Recon',    desc: 'Fast HTTP probing toolkit',                        cmd: 'httpx -l targets.txt -sc -title -tech-detect' },
  { name: 'nuclei',       category: 'Recon',    desc: 'Template-based vulnerability scanner',             cmd: 'nuclei -u target.com -t cves/ -severity critical,high' },
  { name: 'theHarvester', category: 'Recon',    desc: 'OSINT emails, subdomains & names',                 cmd: 'theHarvester -d target.com -b all' },
  { name: 'whatweb',      category: 'Recon',    desc: 'Web technology fingerprinter',                     cmd: 'whatweb -a 3 target.com' },
  { name: 'waybackurls',  category: 'Recon',    desc: 'Pull URLs from Wayback Machine',                   cmd: 'waybackurls target.com | sort -u' },
  { name: 'gau',          category: 'Recon',    desc: 'Fetch known URLs from multiple sources',           cmd: 'gau target.com | sort -u | tee urls.txt' },
  { name: 'httprobe',     category: 'Recon',    desc: 'Probe a list of hosts for HTTP/S',                 cmd: 'cat hosts.txt | httprobe -prefer-https' },
  { name: 'sherlock',     category: 'Recon',    desc: 'Find social media accounts by username',           cmd: 'sherlock username --timeout 10' },
  { name: 'recon-ng',     category: 'Recon',    desc: 'Full-featured web reconnaissance framework',       cmd: 'recon-ng' },
  // Web
  { name: 'sqlmap',       category: 'Web',      desc: 'Automatic SQL injection tool',                     cmd: "sqlmap -u 'target.com/page?id=1' --dbs --batch" },
  { name: 'nikto',        category: 'Web',      desc: 'Web server scanner',                               cmd: 'nikto -h target.com -C all' },
  { name: 'gobuster',     category: 'Web',      desc: 'Directory / DNS / VHost buster',                   cmd: 'gobuster dir -u target.com -w ~/wordlists/SecLists/Discovery/Web-Content/common.txt' },
  { name: 'feroxbuster',  category: 'Web',      desc: 'Fast recursive content discovery',                 cmd: 'feroxbuster -u target.com -w ~/wordlists/SecLists/Discovery/Web-Content/raft-medium-words.txt' },
  { name: 'ffuf',         category: 'Web',      desc: 'Fast web fuzzer',                                  cmd: 'ffuf -w wordlist.txt -u target.com/FUZZ -mc 200,301,302' },
  { name: 'wfuzz',        category: 'Web',      desc: 'Web application fuzzer',                           cmd: 'wfuzz -c -z file,wordlist.txt --hc 404 target.com/FUZZ' },
  { name: 'dirb',         category: 'Web',      desc: 'Web content scanner',                              cmd: 'dirb http://target.com' },
  { name: 'mitmproxy',    category: 'Web',      desc: 'Interactive TLS intercepting proxy',               cmd: 'mitmproxy --mode transparent' },
  { name: 'sslscan',      category: 'Web',      desc: 'SSL/TLS cipher and cert scanner',                  cmd: 'sslscan target.com:443' },
  // Password
  { name: 'hashcat',      category: 'Password', desc: "World's fastest password recovery",                cmd: 'hashcat -m 0 hash.txt ~/wordlists/rockyou.txt' },
  { name: 'john',         category: 'Password', desc: 'Password cracker with auto-detection',             cmd: 'john --wordlist=~/wordlists/rockyou.txt hash.txt' },
  { name: 'hydra',        category: 'Password', desc: 'Network login brute-forcer',                       cmd: 'hydra -l user -P ~/wordlists/rockyou.txt ssh://target' },
  { name: 'medusa',       category: 'Password', desc: 'Speedy parallel login brute-forcer',               cmd: 'medusa -h target -u user -P ~/wordlists/rockyou.txt -M ssh' },
  { name: 'crunch',       category: 'Password', desc: 'Custom wordlist generator',                        cmd: 'crunch 8 12 abcdef0123456789 -o wordlist.txt' },
  { name: 'hashid',       category: 'Password', desc: 'Hash type identifier',                             cmd: 'hashid "5f4dcc3b5aa765d61d8327deb882cf99"' },
  // Network
  { name: 'tcpdump',      category: 'Network',  desc: 'Command-line packet analyzer',                     cmd: 'tcpdump -i eth0 -w capture.pcap' },
  { name: 'tshark',       category: 'Network',  desc: 'Terminal Wireshark',                               cmd: 'tshark -r capture.pcap -Y "http"' },
  { name: 'netcat',       category: 'Network',  desc: 'TCP/UDP Swiss army knife',                         cmd: 'nc -lvnp 4444' },
  { name: 'socat',        category: 'Network',  desc: 'Multipurpose relay & port forward',                cmd: 'socat TCP4-LISTEN:443,reuseaddr,fork EXEC:/bin/bash' },
  { name: 'proxychains',  category: 'Network',  desc: 'Force TCP connections through Tor/SOCKS',          cmd: 'proxychains nmap -sT target.com' },
  { name: 'arp-scan',     category: 'Network',  desc: 'ARP host discovery on LAN',                        cmd: 'arp-scan --localnet' },
  { name: 'netdiscover',  category: 'Network',  desc: 'Active/passive ARP reconnaissance',                cmd: 'netdiscover -r 192.168.1.0/24' },
  { name: 'ncat',         category: 'Network',  desc: 'Netcat reimplemented with SSL',                    cmd: 'ncat --ssl -lvp 4444' },
  // Exploitation
  { name: 'metasploit',   category: 'Exploit',  desc: 'Penetration testing framework',                    cmd: 'msfconsole -q' },
  { name: 'msfvenom',     category: 'Exploit',  desc: 'Payload generator & encoder',                      cmd: 'msfvenom -p linux/x64/meterpreter/reverse_tcp LHOST=ip LPORT=4444 -f elf -o shell.elf' },
  { name: 'searchsploit', category: 'Exploit',  desc: 'ExploitDB offline search',                         cmd: 'searchsploit apache 2.4 --id' },
  { name: 'beef',         category: 'Exploit',  desc: 'Browser Exploitation Framework',                   cmd: 'cd ~/tools/beef && ./beef' },
  // Forensics
  { name: 'binwalk',      category: 'Forensics', desc: 'Firmware analysis & extraction',                  cmd: 'binwalk -e firmware.bin' },
  { name: 'foremost',     category: 'Forensics', desc: 'File carving / data recovery',                    cmd: 'foremost -i disk.img -o output/' },
  { name: 'strings',      category: 'Forensics', desc: 'Extract printable strings from binary',           cmd: 'strings binary | grep -i password' },
  { name: 'volatility3',  category: 'Forensics', desc: 'Memory forensics framework',                      cmd: 'python3 vol.py -f memory.dmp windows.pslist' },
  { name: 'xxd',          category: 'Forensics', desc: 'Hex dump / binary editor',                        cmd: 'xxd binary | head -20' },
  { name: 'exiftool',     category: 'Forensics', desc: 'Read/write EXIF metadata from files',             cmd: 'exiftool image.jpg' },
  { name: 'steghide',     category: 'Forensics', desc: 'Steganography hide/extract tool',                 cmd: 'steghide extract -sf image.jpg' },
  // Crypto
  { name: 'openssl',      category: 'Crypto',   desc: 'Cryptography & SSL toolkit',                       cmd: 'openssl s_client -connect target.com:443 </dev/null' },
  { name: 'gpg',          category: 'Crypto',   desc: 'OpenPGP encryption & signing',                     cmd: 'gpg --gen-key' },
  // Dev / Util
  { name: 'git',          category: 'Dev',      desc: 'Version control',                                  cmd: 'git clone https://github.com/owner/repo' },
  { name: 'python3',      category: 'Dev',      desc: 'Python 3 interpreter & HTTP server',               cmd: 'python3 -m http.server 8080' },
  { name: 'jq',           category: 'Dev',      desc: 'Lightweight JSON processor',                       cmd: "curl -s api.com | jq '.data[]'" },
  { name: 'ripgrep',      category: 'Dev',      desc: 'Ultra-fast recursive grep',                        cmd: 'rg -i "password" .' },
  { name: 'tmux',         category: 'Dev',      desc: 'Terminal multiplexer',                             cmd: 'tmux new -s main' },
  { name: 'vim',          category: 'Dev',      desc: 'Terminal text editor',                             cmd: 'vim file.txt' },
  // AI — Ollama local models
  { name: 'ollama list',  category: 'AI',       desc: 'Show installed local AI models',                   cmd: 'ollama list' },
  { name: 'ollama run',   category: 'AI',       desc: 'Chat with a local uncensored model',               cmd: 'ollama run dolphin-mistral' },
  { name: 'ollama phi3',  category: 'AI',       desc: 'Run phi3:mini — fast, small local model',          cmd: 'ollama run phi3:mini' },
  { name: 'agent-local',  category: 'AI',       desc: 'Aider coding agent + local Ollama model',          cmd: 'agent-local' },
  { name: 'agent',        category: 'AI',       desc: 'Aider + DeepSeek R1 via Tor (free)',               cmd: 'agent' },
  { name: 'agent-fast',   category: 'AI',       desc: 'Aider + Llama 3.3 via Groq (fast)',                cmd: 'agent-fast' },
  { name: 'aider',        category: 'AI',       desc: 'AI coding assistant (pairs with any model)',        cmd: 'aider --model openrouter/google/gemma-3-27b-it:free' },
  { name: 'dan-agents',   category: 'AI',       desc: 'Launch multi-agent tmux panel',                    cmd: 'dan-agents' },
  // Tunnels
  { name: 'bore',         category: 'Tunnel',   desc: 'Instant TCP tunnel to bore.pub',                   cmd: 'bore local 22 --to bore.pub --secret $BORE_SECRET' },
  { name: 'cloudflared',  category: 'Tunnel',   desc: 'Cloudflare Tunnel client',                         cmd: 'cloudflared tunnel --no-autoupdate run --token $TOKEN' },
  { name: 'dan-connect',  category: 'Tunnel',   desc: 'Show current SSH connect command',                 cmd: 'cat ~/.dan_ssh_connect' },
  // System
  { name: 'apt',          category: 'System',   desc: 'Install any package (sudo auto-added)',             cmd: 'apt install PACKAGE' },
  { name: 'apt search',   category: 'System',   desc: 'Search for available packages',                    cmd: 'apt-cache search keyword' },
  { name: 'htop',         category: 'System',   desc: 'Interactive process viewer',                       cmd: 'htop' },
  { name: 'df',           category: 'System',   desc: 'Disk usage summary',                               cmd: 'df -h' },
  { name: 'free',         category: 'System',   desc: 'Memory usage summary',                             cmd: 'free -h' },
  { name: 'dan-status',   category: 'System',   desc: 'Show D.A.N. startup log',                          cmd: 'dan-status' },
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
  System:   'bg-slate-500/12 text-slate-400',
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
