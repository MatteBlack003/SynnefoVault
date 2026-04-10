import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Admin } from './pages/Admin';
import { Student } from './pages/Student';

function Shell() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-transparent">
      {/* Absolute Corner Meta-data Indicators */}
      <div className="absolute top-10 left-12 z-50 pointer-events-none select-none">
         <div className="text-3xl font-bold tracking-widest text-[#1a1a1a]">SYNNEFO_VAULT</div>
         <div className="text-xs text-[#666] mt-2 tracking-widest uppercase">/// System Core Node</div>
         <div className="text-[10px] text-[#888] mt-2 opacity-80">Copyright © {new Date().getFullYear()}<br/>Synnefo Inc. All Rights Reserved.</div>
      </div>

      <div className="absolute top-10 right-12 z-50 pointer-events-auto flex items-end flex-col">
         <div className="text-[10px] font-bold tracking-[0.2em] text-[#333] mb-4 uppercase">/// Operating Normal</div>
         <button 
           onClick={() => navigate('/admin')}
           className="relative group bg-[rgba(255,255,255,0.4)] backdrop-blur-xl border border-[rgba(0,0,0,0.05)] px-6 py-3 hover:bg-white transition-all duration-500 hover:shadow-[0_0_40px_rgba(255,255,255,1)] uppercase text-xs tracking-widest font-bold text-[#1a1a1a] overflow-hidden bracket-card"
         >
           [ FACULTY GATEWAY ]
         </button>
         <div className="text-[10px] text-[#666] mt-4 opacity-80 text-right pr-2 border-r border-[#ccc] uppercase">Scroll down to<br/>discover.</div>
      </div>

      <div className="absolute bottom-10 left-12 z-50 pointer-events-none select-none">
        <div className="text-[11px] text-[#666] flex font-bold tracking-widest uppercase items-center gap-3">
          <span>{`{ status }`}</span>
          <span className="w-2.5 h-2.5 rounded-full bg-[#1e90ff] shadow-[0_0_12px_rgba(30,144,255,0.8)] animate-pulse"></span>
          <span className="text-[#1a1a1a]">Secured</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full h-screen flex flex-col pt-40 px-12 pb-12">
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
