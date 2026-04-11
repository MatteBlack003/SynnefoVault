import { useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Admin } from './pages/Admin';
import { Student } from './pages/Student';

/* ── Snow particles ── */
interface Particle { id: number; x: number; y: number; dur: number; delay: number; dx: number; dy: number; }

function SnowLayer() {
  const particles: Particle[] = useMemo(() =>
    Array.from({ length: 32 }, (_, i) => ({
      id:    i,
      x:     Math.random() * 100,
      y:     20 + Math.random() * 80,
      dur:   6 + Math.random() * 9,
      delay: Math.random() * 10,
      dx:    (Math.random() - 0.5) * 50,
      dy:    -(50 + Math.random() * 90),
    })), []);

  return (
    <div className="fixed inset-0 z-[1] pointer-events-none overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="snow-particle"
          style={{
            left:      `${p.x}%`,
            top:       `${p.y}%`,
            '--dur':   `${p.dur}s`,
            '--delay': `${p.delay}s`,
            '--dx':    `${p.dx}px`,
            '--dy':    `${p.dy}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin  = location.pathname.startsWith('/admin');

  /* Mouse → CSS vars for dot-grid spotlight */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const now     = new Date();
  const timeStr = now.toLocaleTimeString('en-GB', { hour12: false });
  const dateStr = now.toLocaleDateString('en-GB');

  return (
    /* Full-screen container — NOT overflow-hidden so absolute children can escape */
    <div className="min-h-screen w-full relative flex flex-col" style={{ background: 'var(--bg-deep)' }}>

      {/* ── igloo background layers (z: 0) ── */}
      <div className="bg-igloo"        aria-hidden />
      <div className="grid-base"       aria-hidden />
      <div className="grid-glow"       aria-hidden />
      <div className="cursor-glow"     aria-hidden />
      <SnowLayer />
      <div className="viewport-border" aria-hidden />

      {/* ── Header — igloo corner-anchored layout ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-start justify-between px-8 pt-7 select-none"
        style={{ pointerEvents: 'none' }}
      >
        {/* LEFT — brand block */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            className="text-[22px] font-bold leading-none mb-2"
            style={{ color: 'var(--text)', fontFamily: '"IBM Plex Mono", monospace', letterSpacing: '0.05em' }}
          >
            SYNNEFO
          </div>
          <div className="text-[11px] leading-snug" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            // Copyright © 2026
          </div>
          <div className="text-[11px]" style={{ color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
            Synnefo, Inc. All Rights Reserved.
          </div>
        </motion.div>

        {/* RIGHT — console label + nav */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-end gap-2"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="text-[11px]" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
            ////// {isAdmin ? 'Faculty Console' : 'Student Portal'}
          </div>
          <p
            className="text-[11px] text-right leading-relaxed hidden md:block"
            style={{ color: 'var(--text-dim)', maxWidth: '200px', letterSpacing: '0.03em' }}
          >
            {isAdmin
              ? 'Encrypted exam deployment\nsystem for faculty control.'
              : 'Secure cryptographic exam\naccess for registered students.'}
          </p>
          {/* Status + nav in same row */}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="badge badge-accent" style={{ fontSize: '0.57rem' }}>
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: 'var(--accent)', boxShadow: '0 0 5px var(--accent)' }}
              />
              System Nominal
            </span>
            {isAdmin ? (
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/')}
                className="btn-secondary"
                style={{ padding: '5px 14px', fontSize: '0.63rem' }}
              >
                ← Exit
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/admin')}
                className="btn-secondary"
                style={{ padding: '5px 14px', fontSize: '0.63rem' }}
              >
                Faculty →
              </motion.button>
            )}
          </div>
        </motion.div>
      </header>

      {/* ── Main content — relative z-10, sits above bg layers ── */}
      <main className="relative z-10 flex flex-1 pt-[116px] px-6 pb-8" style={{ minHeight: '100vh' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0,  filter: 'blur(0px)' }}
            exit={{    opacity: 0, y: -8,  filter: 'blur(2px)' }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-1 w-full"
            style={{ minHeight: 0 }}
          >
            <Routes>
              <Route path="/"      element={<Student />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Footer strip ── */}
      <footer
        className="fixed bottom-0 left-0 right-0 z-50 px-8 py-3 flex items-center justify-between select-none"
        style={{
          borderTop: '1px solid rgba(26,35,64,0.10)',
          background: 'rgba(168,180,196,0.20)',
          backdropFilter: 'blur(8px)',
          pointerEvents: 'none',
        }}
      >
        <span className="text-[10px]" style={{ color: 'var(--text-dim)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          // AES-256-GCM · Zero Backend · GitHub Pages
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{dateStr} · {timeStr}</span>
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
