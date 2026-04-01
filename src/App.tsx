import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ParticleBackground } from './components/ParticleBackground';
import { Admin } from './pages/Admin';
import { Student } from './pages/Student';

function App() {
  return (
    <BrowserRouter>
      {/* Persistent Animated Background */}
      <ParticleBackground />
      
      {/* Foreground UI Layer */}
      <div className="relative z-10 min-h-screen w-full flex flex-col">
        {/* Global Header */}
        <header className="flex justify-between items-center px-8 py-6 border-b border-white/10 bg-background/60 backdrop-blur-md">
          <div className="flex items-center gap-6">
            <h1 className="font-display font-black text-2xl tracking-tighter text-white">SYNNEFO</h1>
            <div className="font-mono text-xs text-muted border-l border-white/10 pl-6 flex flex-col gap-1">
              <div><span className="inline-block w-1.5 h-1.5 bg-[#3fb950] rounded-full mr-1.5 shadow-[0_0_10px_#3fb950]"></span> SECURE NODE LINKED</div>
              <div>AUTH: ZERO_BACKEND_LOCKED</div>
            </div>
          </div>
          <div className="font-display font-black text-lg tracking-widest text-accent border border-accent bg-accent/10 px-4 py-2 rounded">
            MOCK EXAMS
          </div>
        </header>

        {/* Page Content Routes */}
        <main className="flex-1 flex overflow-hidden">
          <Routes>
            <Route path="/" element={<Student />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
