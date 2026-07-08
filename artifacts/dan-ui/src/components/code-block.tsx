import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CodeBlockProps {
  code: string;
  label?: string;
  language?: string;
}

export function CodeBlock({ code, label }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older Safari
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-muted/40 overflow-hidden">
      {label && (
        <div className="px-4 py-2 border-b border-border/40 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
      )}
      <div className="flex items-center gap-3 p-4">
        <code className="flex-1 font-mono text-sm text-foreground/90 break-all select-all leading-relaxed whitespace-pre-wrap">
          {code}
        </code>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-border/60 transition-colors press-scale"
          aria-label="Copy to clipboard"
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.span
                key="check"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Check className="w-4 h-4 text-success" />
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Copy className="w-4 h-4" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  );
}
