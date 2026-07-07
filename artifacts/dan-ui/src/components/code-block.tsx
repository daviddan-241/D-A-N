import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative flex flex-col w-full rounded-md border border-border/50 bg-card overflow-hidden">
      {label && (
        <div className="flex items-center px-4 py-1.5 bg-muted/30 border-b border-border/50 text-xs font-mono text-muted-foreground">
          {label}
        </div>
      )}
      <div className="flex items-center justify-between p-4">
        <code className="font-mono text-sm text-primary/90 break-all select-all">
          {code}
        </code>
        <button
          onClick={handleCopy}
          className="ml-4 p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
          aria-label="Copy code"
        >
          {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
