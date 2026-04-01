import { useState, useEffect } from 'react';
import { decryptWithKeyring } from '../lib/crypto';
import { marked } from 'marked';
import { Lock, FileText, ChevronRight } from 'lucide-react';

const DEPARTMENTS = [
  'networking', 'devops', 'python-full-stack', 'mern-stack', 'flutter', 'cyber-security', 'digital-marketing', 'data-science'
];

interface Catalog {
  [dept: string]: string[];
}

export function Student() {
  const [catalog, setCatalog] = useState<Catalog>({});
  const [activeDept, setActiveDept] = useState('networking');
  
  const [activeFile, setActiveFile] = useState<{ path: string, name: string } | null>(null);
  const [examCode, setExamCode] = useState(''); // This acts as the Student ID
  const [decryptedHtml, setDecryptedHtml] = useState<string | null>(null);
  
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'catalog.json')
      .then(res => res.json())
      .then(data => setCatalog(data))
      .catch((err) => {
        console.warn('catalog.json not found. Running empty state.', err);
      });
  }, []);

  // DRM & Anti-Cheating Engine Protection Layer
  useEffect(() => {
    if (decryptedHtml && activeFile && examCode) {
      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        alert("SECURITY ENGINE: RIGHT-CLICK DISABLED");
      };
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) {
          if (['c', 'p', 's', 'x', 'a'].includes(e.key.toLowerCase())) {
            e.preventDefault();
            alert("SECURITY ENGINE: ACTION INTERCEPTED AND BLOCKED");
          }
        }
      };

      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('keydown', handleKeyDown);
      document.body.classList.add('select-none'); // Tailwind rule to prevent highlighting

      return () => {
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('keydown', handleKeyDown);
        document.body.classList.remove('select-none');
      };
    }
  }, [decryptedHtml, activeFile, examCode]);

  const handleDecrypt = async () => {
    if (!activeFile || !examCode) return;
    
    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      const res = await fetch(import.meta.env.BASE_URL + activeFile.path);
      if(!res.ok) throw new Error("Could not download the encrypted exam file from the server.");
      
      const payloadString = await res.text();
      
      // Decrypt using the Cryptographic Keyring via Student ID
      const markdown = await decryptWithKeyring(examCode, payloadString);
      
      const htmlContent = marked.parse(markdown) as string;
      setDecryptedHtml(htmlContent);
      
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'ACCESS DENIED: Mathematical Keyring Rejection / Invalid Cryptographic Signature.' });
    } finally {
      setLoading(false);
    }
  };

  const closeViewer = () => {
    setDecryptedHtml(null);
    setActiveFile(null);
    setExamCode('');
    setStatus({ type: '', msg: '' });
  };

  if (decryptedHtml && activeFile) {
    return (
      <div className="flex-1 w-full h-full absolute inset-0 bg-background z-50 overflow-hidden relative">
        
        {/* Dynamic Anti-Cheating Watermark Generator */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-[100] grid grid-cols-4 grid-rows-5 items-center justify-items-center overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="text-4xl font-display text-white transform -rotate-45 whitespace-nowrap">
              {examCode.toUpperCase()}
            </div>
          ))}
        </div>

        <div className="w-full h-full p-12 overflow-y-auto">
          <div className="max-w-4xl mx-auto bg-surface/80 p-12 rounded-2xl border border-white/10 shadow-2xl relative z-10">
            <button onClick={closeViewer} className="absolute top-8 right-8 text-muted hover:text-white font-mono border border-white/20 px-4 py-2 rounded">
              END SESSION
            </button>
            
            <div className="mb-12 border-b border-white/10 pb-6 text-accent font-display tracking-widest uppercase flex justify-between items-end">
              <span>{activeFile.name}</span>
              <span className="text-xs font-mono text-[#f85149]">DRM PROTOCOLS ACTIVE</span>
            </div>
            
            <div className="prose prose-invert prose-blue max-w-none font-ui" dangerouslySetInnerHTML={{ __html: decryptedHtml }} />
          </div>
        </div>
      </div>
    );
  }

  const exams = catalog[activeDept] || [];

  return (
    <div className="flex-1 grid grid-cols-[300px_1fr] relative z-10 w-full">
      <div className="border-r border-white/10 bg-surface/50 backdrop-blur-xl p-6 overflow-y-auto flex flex-col gap-2">
        <div className="font-mono text-muted text-xs tracking-[0.2em] mb-4 uppercase">Directories</div>
        {DEPARTMENTS.map(d => (
          <button
            key={d}
            onClick={() => setActiveDept(d)}
            className={`w-full text-left px-5 py-4 font-ui font-semibold rounded-lg flex justify-between items-center transition-all group border border-transparent ${
              activeDept === d 
                ? 'bg-accent/10 border-accent/20 text-accent outline outline-1 outline-accent/20' 
                : 'hover:bg-white/5 text-gray-300 hover:border-white/10'
            }`}
          >
            <span className="capitalize">{d.replace('-', ' ')}</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${activeDept === d ? 'text-accent opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
          </button>
        ))}
      </div>

      <div className="p-12 flex justify-center items-start">
        <div className="w-full max-w-3xl">
          <h2 className="font-display text-3xl mb-8 border-b border-white/10 pb-6 capitalize text-white flex items-center gap-3">
            <span className="w-8 h-8 rounded bg-accent/20 border border-accent/30 flex items-center justify-center">
              <Lock className="w-4 h-4 text-accent" />
            </span>
            {activeDept.replace('-', ' ')} Exams
          </h2>

          <div className="grid grid-cols-2 gap-4">
            {exams.length === 0 ? (
              <div className="col-span-2 p-8 border border-white/5 bg-white/5 rounded-xl text-center text-muted font-mono text-sm empty-state">
                No encrypted exams currently live on the node.
              </div>
            ) : (
              exams.map(file => (
                <button
                  key={file}
                  onClick={() => setActiveFile({ path: `${activeDept}/${file}`, name: file.replace('.enc', '') })}
                  className="p-6 bg-surface border border-white/10 hover:border-[#f85149]/50 rounded-xl text-left transition-all hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(248,81,73,0.1)] group flex items-start gap-4"
                >
                  <FileText className="w-6 h-6 text-muted group-hover:text-[#f85149] flex-shrink-0" />
                  <div>
                    <div className="text-white font-mono text-sm mb-1">{file.replace('.enc', '')}</div>
                    <div className="text-[#f85149]/60 text-xs flex items-center gap-1 font-mono uppercase tracking-wider">
                      <Lock className="w-3 h-3" /> Keyring Protected
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {activeFile && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center">
          <div className="w-full max-w-md bg-surface border border-[#f85149]/30 p-8 rounded-xl shadow-[0_0_50px_rgba(248,81,73,0.1)] flex flex-col gap-6">
            <div>
              <h3 className="text-[#f85149] font-display text-lg mb-2 flex items-center gap-2">
                 <Lock className="w-4 h-4" /> CRYPTOGRAPHIC LOCK
              </h3>
              <p className="text-muted text-sm leading-relaxed">This payload is locked with a Cryptographic Keyring. You must provide your precise Unique Student ID to interface with the Master Key.</p>
            </div>
            
            <input 
              type="password" 
              autoFocus
              value={examCode}
              onChange={e => setExamCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDecrypt()}
              className="w-full bg-[#010409] border border-white/20 text-white rounded p-4 font-mono text-center tracking-[0.3em] uppercase placeholder:tracking-normal focus:border-[#f85149] focus:outline-none"
              placeholder="e.g. NET-A1"
            />
            
            {status.msg && (
               <div className="text-[#ff7b72] font-mono text-center text-xs bg-[#f85149]/10 border border-[#f85149] p-2 rounded">
                 {status.msg}
               </div>
            )}
            
            <div className="flex gap-3 mt-2">
              <button 
                onClick={() => setActiveFile(null)} 
                className="flex-1 p-3 border border-white/20 text-white hover:bg-white/10 font-bold font-mono rounded"
              >
                ABORT
              </button>
              <button 
                onClick={handleDecrypt} 
                disabled={loading}
                className="flex-[2] p-3 bg-[#f85149]/20 border border-[#f85149] text-[#f85149] hover:bg-[#f85149] hover:text-white font-bold font-mono disabled:opacity-50 transition-colors rounded"
              >
                {loading ? 'PROCESSING...' : 'DECRYPT PAYLOAD'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
