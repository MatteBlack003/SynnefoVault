import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Admin } from './pages/Admin';
import { Student } from './pages/Student';

function Shell() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-bg flex flex-col">
      {/* Corner meta — top-left */}
      <div className="absolute top-8 left-10 z-50 pointer-events-none select-none">
        <div className="text-lg font-bold tracking-[0.2em] text-ink uppercase">SYNNEFO_VAULT</div>
        <div className="text-[10px] text-muted mt-1 tracking-widest uppercase">/// Secure Exam System</div>
        <div className="text-[10px] text-dim mt-1">© {new Date().getFullYear()} Synnefo Inc.</div>
      </div>

      {/* Corner meta — top-right */}
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

      {/* Content area */}
      <div className="relative z-10 w-full h-screen flex flex-col pt-36 px-10 pb-8">
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Student />} />
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
