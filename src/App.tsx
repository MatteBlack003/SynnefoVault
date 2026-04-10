import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Admin } from './pages/Admin';
import { Student } from './pages/Student';

function Shell() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-[#e5e5e5] font-sans selection:bg-[#333] selection:text-white relative overflow-hidden">
      {/* Background Soft Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-white/[0.02] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-white/[0.01] blur-[100px] pointer-events-none" />

      {/* Global Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, type: 'spring', bounce: 0, damping: 20 }}
        className="flex justify-between items-center px-10 py-5 border-b border-white/5 bg-background/80 backdrop-blur-md z-50 sticky top-0"
      >
        <div className="flex items-center gap-6">
          <h1 className="font-sans font-semibold text-xl tracking-tight text-white flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-white text-black flex items-center justify-center font-bold text-xs select-none">S</span>
            SynnefoVault
          </h1>
          <div className="text-xs text-muted border-l border-white/10 pl-6 flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-[#3fb950]" />
             <span>System Secured</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/admin')}
            className="text-xs font-medium text-muted hover:text-white px-4 py-2 rounded-full hover:bg-white/5 transition-colors"
          >
            Faculty Gateway
          </motion.button>
          <div className="text-xs font-semibold text-background bg-[#e5e5e5] px-4 py-2 rounded-full select-none cursor-default shadow-sm border border-transparent">
            MOCK EXAMS
          </div>
        </div>
      </motion.header>

      {/* Page Content Routes */}
      <main className="flex-1 flex w-full max-w-[1600px] mx-auto z-10 relative">
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Student />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </AnimatePresence>
      </main>
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
