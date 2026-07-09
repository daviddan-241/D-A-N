import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { useEffect } from 'react';

import { Layout } from '@/components/layout';
import { Home } from '@/pages/home';
import { Terminal } from '@/pages/terminal';
import { Tools } from '@/pages/tools';
import { Connect } from '@/pages/connect';

const queryClient = new QueryClient();

function Router() {
  const [location] = useLocation();
  const onTerminal = location === '/terminal';

  return (
    <Layout>
      {/*
        Terminal is ALWAYS mounted — hidden via CSS only.
        This keeps the iframe (and its ttyd WebSocket) alive when you
        navigate to Home / Tools / Connect and come back. The tmux session
        on the server side also persists across WebSocket reconnects.
      */}
      <div
        style={{
          display: onTerminal ? 'flex' : 'none',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        <Terminal />
      </div>

      {/* All other routes — only rendered when not on /terminal */}
      {!onTerminal && (
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/tools" component={Tools} />
          <Route path="/connect" component={Connect} />
          <Route component={NotFound} />
        </Switch>
      )}
    </Layout>
  );
}

function App() {
  // Force dark mode globally
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
