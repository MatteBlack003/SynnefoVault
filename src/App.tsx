import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Admin } from './pages/Admin';
import { Student } from './pages/Student';

function Shell() {
  const navigate = useNavigate();

  // Track mouse position → update CSS vars on :root
  // The CSS grid-highlight layer uses these to create the spotlight effect
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const root = document.documentElement;
      root.style.setProperty('--mouse-x', `${e.clientX}px`);
      root.style.setProperty('--mouse-y', `${e.clientY}px`);
    };
    window.addEventListener('mousemove', move, { passive: true });
    return () => window.removeEventListener('mousemove', move);
  }, []);

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-bg flex flex-col">

      {/* ── Grid layers (z-0) ── */}
      {/* Base dim dots — always visible */}
      <div className="grid-base" aria-hidden />
      {/* Lit dots near cursor — masked by mouse radial */}
      <div className="grid-glow" aria-hidden />
      {/* Soft cursor glow blob */}
      <div className="cursor-glow" aria-hidden />

      {/* ── Corner meta — top-left (z-50) ── */}
      <div className="absolute top-8 left-10 z-50 pointer-events-none select-none">
        <div className="text-lg font-bold tracking-[0.2em] text-ink uppercase">SYNNEFO_VAULT</div>
        <div className="text-[10px] text-muted mt-1 tracking-widest uppercase">/// Secure Exam System</div>
        <div className="text-[10px] text-dim mt-1">© {new Date().getFullYear()} Synnefo Inc.</div>
      </div>

      {/* ── Corner meta — top-right (z-50) ── */}
      <div className="absolute top-8 right-10 z-50 pointer-events-auto flex flex-col items-end gap-3">
        <div className="text-[10px] font-bold tracking-widest text-muted uppercase">/// System Nominal</div>
        <button
          onClick={() => navigate('/admin')}
          className="btn-secondary text-[10px] px-5 py-2"
        >
          Faculty Gateway
        </button>
        <div className="flex items-center gap-2 mt-1">
          <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
          <span className="text-[10px] text-muted uppercase tracking-widest">Secured</span>
        </div>
      </div>

      {/* ── Main content (z-10) ── */}
      <div className="relative z-10 w-full h-screen flex flex-col pt-36 px-10 pb-8">
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/"      element={<Student />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </AnimatePresence>
      </div>
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
