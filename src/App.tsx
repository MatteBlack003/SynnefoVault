import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Admin } from './pages/Admin';
import { Student } from './pages/Student';

function Shell() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const isAdmin   = location.pathname.startsWith('/admin');
  const now       = new Date();
  const timeStr   = now.toLocaleTimeString('en-GB', { hour12: false });
  const dateStr   = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });

  // Mouse position → CSS vars for dot-grid spotlight
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const root = document.documentElement;
      root.style.setProperty('--mouse-x', `${e.clientX}px`);
      root.style.setProperty('--mouse-y', `${e.clientY}px`);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex flex-col bg-bg">

      {/* ── Background layers ── */}
      <div className="grid-base"    aria-hidden />
      <div className="grid-glow"    aria-hidden />
      <div className="cursor-glow"  aria-hidden />
      <div className="viewport-glow" aria-hidden />

      {/* ── Top navigation bar — Igloo style ── */}
      <header className="absolute top-0 left-0 right-0 z-50 px-8 pt-7 pb-0 flex items-start justify-between pointer-events-none select-none">
        {/* Left: brand + system coords */}
        <div className="pointer-events-none">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-accent2 shadow-[0_0_8px_rgba(111,163,224,0.9)]" />
            <span className="text-[11px] font-bold text-ink tracking-[0.25em] uppercase">SYNNEFO_VAULT</span>
            <span className="text-[9px] text-dim tracking-widest uppercase border border-border px-2 py-0.5 rounded-full">v2.1</span>
          </div>
          <div className="flex items-center gap-4 pl-4.5">
            <span className="text-[9px] text-dim tracking-widest uppercase">// Secure Exam Infrastructure</span>
            <span className="text-[9px] text-dim">|</span>
            <span className="text-[9px] text-dim font-mono">{dateStr} · {timeStr}</span>
          </div>
        </div>

        {/* Right: system status + nav */}
        <div className="flex items-center gap-4 pointer-events-auto">
          {/* System status badge */}
          <div className="badge badge-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-accent2 shadow-[0_0_6px_rgba(111,163,224,1)]" />
            SYSTEM NOMINAL
          </div>
          {isAdmin ? (
            <button onClick={() => navigate('/')} className="btn-secondary text-[10px] py-2 px-5">
              ← Student Portal
            </button>
          ) : (
            <button onClick={() => navigate('/admin')} className="btn-secondary text-[10px] py-2 px-5">
              Faculty Gateway →
            </button>
          )}
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="relative z-10 flex flex-col flex-1 pt-24 px-8 pb-6 overflow-hidden h-screen">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="flex flex-1 overflow-hidden h-full"
          >
            <Routes>
              <Route path="/"      element={<Student />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Bottom data strip — Igloo metadata bar ── */}
      <footer className="absolute bottom-0 left-0 right-0 z-50 px-8 py-3 flex items-center justify-between pointer-events-none select-none border-t border-border/50">
        <div className="flex items-center gap-6">
          <span className="text-[9px] text-dim uppercase tracking-widest">// NODE CORE · REGION IN-SOUTH</span>
          <span className="text-[9px] text-dim">ENCRYPTION: AES-256-GCM</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-[9px] text-dim">© {now.getFullYear()} SYNNEFO SOLUTIONS</span>
          <span className="text-[9px] text-dim uppercase tracking-widest">ALL RIGHTS RESERVED</span>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter basename="/SynnefoVault/">
      <Shell />
    </BrowserRouter>
  );
}

export default App;
