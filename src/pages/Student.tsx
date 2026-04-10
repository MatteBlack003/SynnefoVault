import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { decryptWithKeyring } from '../lib/crypto';
import { fetchFullCatalogFromAPI } from '../lib/github';
import { marked } from 'marked';
import { Lock, ChevronRight, RefreshCw } from 'lucide-react';

const DEPARTMENTS = [
  'networking', 'devops', 'python-full-stack', 'mern-stack', 'flutter', 'cyber-security', 'digital-marketing', 'data-science'
];

const REPO_OWNER = 'MatteBlack003';
const REPO_NAME = 'SynnefoVault';

// The deployed GitHub Pages URL where catalog.json is served (no rate limits)
const PAGES_BASE_URL = `https://${REPO_OWNER.toLowerCase()}.github.io/${REPO_NAME}/`;

const CATALOG_STORAGE_KEY = 'synnefo_live_catalog';

interface Catalog {
  [dept: string]: string[];
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};
const itemVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export function Student() {
  const [catalog, setCatalog] = useState<Catalog>({});
  const [activeDept, setActiveDept] = useState('networking');
  const [catalogLoading, setCatalogLoading] = useState(true);
  
  const [activeFile, setActiveFile] = useState<{ path: string, name: string } | null>(null);
  const [examCode, setExamCode] = useState(''); // This acts as the Student ID
  const [decryptedHtml, setDecryptedHtml] = useState<string | null>(null);
  const [decryptedPdfUrl, setDecryptedPdfUrl] = useState<string | null>(null);
  
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);

  /** Check if a catalog has any exams */
  const hasExams = (c: Catalog): boolean => Object.values(c).some(files => files.length > 0);

  /**
   * Catalog fetch strategy (checked in priority order):
   * 1. localStorage (instant — set by admin tab in the same browser)
   * 2. raw.githubusercontent.com/catalog.json (always fresh, no rate limits)
   * 3. Local/deployed catalog.json
   * 4. Git Trees API (last resort, 1 request)
   */
  const fetchCatalog = async () => {
    setCatalogLoading(true);

    // Step 1: Check localStorage first (instant, set by admin page)
    try {
      const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
      if (raw) {
        const data: Catalog = JSON.parse(raw);
        if (hasExams(data)) {
          setCatalog(data);
          setCatalogLoading(false);
          return; // We have good data, no need to fetch externally
        }
      }
    } catch { /* corrupt localStorage, continue to network sources */ }

    // Step 2: Fetch catalog.json from raw.githubusercontent.com
    try {
      const rawCatalogUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/public/catalog.json?t=${Date.now()}`;
      const res = await fetch(rawCatalogUrl, { cache: 'no-store' });
      if (res.ok) {
        const data: Catalog = await res.json();
        if (hasExams(data)) {
          setCatalog(data);
          setCatalogLoading(false);
          return;
        }
      }
    } catch { /* failed, try next */ }

    // Step 3: Fallback to local/deployed catalog.json
    try {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const catalogUrl = isLocal 
        ? (import.meta.env.BASE_URL + `catalog.json?t=${Date.now()}`)
        : (PAGES_BASE_URL + `catalog.json?t=${Date.now()}`);

      const res = await fetch(catalogUrl, { cache: 'no-store' });
      if (res.ok) {
        const data: Catalog = await res.json();
        if (hasExams(data)) {
          setCatalog(data);
          setCatalogLoading(false);
          return;
        }
      }
    } catch { /* failed, try next */ }

    // Step 4: Git Trees API as last resort (1 request)
    try {
      const liveCatalog = await fetchFullCatalogFromAPI(REPO_OWNER, REPO_NAME, DEPARTMENTS);
      setCatalog(liveCatalog);
    } catch {
      console.warn('All catalog sources failed.');
    }

    setCatalogLoading(false);
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  // Live Kill Switch Daemon (Instant boot and real-time reflection)
  useEffect(() => {
    // 1. Storage Listener for Instant Local Revocation (Same machine/network testing)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CATALOG_STORAGE_KEY && e.newValue) {
        try {
          const freshCatalog: Catalog = JSON.parse(e.newValue);
          setCatalog(freshCatalog); // update UI
          
          if (activeFile) {
            const [dept, fileName] = activeFile.path.split('/');
            if (!freshCatalog[dept] || !freshCatalog[dept].includes(fileName)) {
              alert("ADMINISTRATOR INITIATED PURGE: EXAM SESSION FORCE TERMINATED.");
              closeViewer();
            }
          }
        } catch { /* parsing fail */ }
      }
    };
    window.addEventListener('storage', handleStorage);

    // 2. Active Polling for Globally Distributed Readers
    let interval: ReturnType<typeof setInterval>;
    if (activeFile) {
      interval = setInterval(async () => {
        try {
          const rawCatalogUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/public/catalog.json?t=${Date.now()}`;
          const res = await fetch(rawCatalogUrl, { cache: 'no-store' });
          if (res.ok) {
            const freshCatalog: Catalog = await res.json();
            const [dept, fileName] = activeFile.path.split('/');
            if (!freshCatalog[dept] || !freshCatalog[dept].includes(fileName)) {
              alert("ADMINISTRATOR INITIATED PURGE: EXAM SESSION FORCE TERMINATED.");
              closeViewer();
            }
          }
        } catch { /* network fail, ignore */ }
      }, 20000); // 20s poller
    }

    return () => {
      window.removeEventListener('storage', handleStorage);
      if (interval) clearInterval(interval);
    };
  }, [activeFile]);

  // DRM & Anti-Cheating Engine Protection Layer
  useEffect(() => {
    if ((decryptedHtml || decryptedPdfUrl) && activeFile && examCode) {
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
  }, [decryptedHtml, decryptedPdfUrl, activeFile, examCode]);

  const handleDecrypt = async () => {
    if (!activeFile || !examCode) return;
    
    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      // Fetch the .enc file directly from GitHub raw content
      // Appending Date.now() bypasses GitHub's heavily aggressive Fastly edge node caches
      // so when a file is physically deleted, the cache isn't erroneously served for 5 minutes.
      const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${activeFile.path}?t=${Date.now()}`;
      const res = await fetch(rawUrl, { cache: 'no-store' });
      if(!res.ok) throw new Error("Could not download the encrypted exam file from the server.");
      
      const payloadString = await res.text();
      
      // Decrypt using the Cryptographic Keyring via Student ID
      const decryptedContent = await decryptWithKeyring(examCode, payloadString);

      // Detect content type from the marker prefix
      if (decryptedContent.startsWith('PDF:')) {
        const base64Data = decryptedContent.substring(4);
        // Convert base64 to blob URL for rendering
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        setDecryptedPdfUrl(blobUrl);
        setDecryptedHtml(null);
      } else {
        // Strip the MD: prefix if present, or treat as raw markdown for backwards compat
        const markdown = decryptedContent.startsWith('MD:') 
          ? decryptedContent.substring(3) 
          : decryptedContent;
        const htmlContent = marked.parse(markdown) as string;
        setDecryptedHtml(htmlContent);
        setDecryptedPdfUrl(null);
      }
      
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg.includes('Could not download') || errMsg.includes('Failed to fetch')) {
        setStatus({ type: 'error', msg: 'ERROR [NETWORK_FETCH]: Could not download the encrypted exam file. Ensure it exists on the active branch and your network is strong.' });
      } else {
        setStatus({ type: 'error', msg: 'ERROR [ACCESS_DENIED]: Invalid Student ID or Passkey provided. Cryptographic Keyring matched 0 entities.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const closeViewer = () => {
    // Revoke any blob URLs to prevent memory leaks
    if (decryptedPdfUrl) {
      URL.revokeObjectURL(decryptedPdfUrl);
    }
    setDecryptedHtml(null);
    setDecryptedPdfUrl(null);
    setActiveFile(null);
    setExamCode('');
    setStatus({ type: '', msg: '' });
  };

  // PDF Viewer
  if (decryptedPdfUrl && activeFile) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }} className="flex-1 w-full h-full absolute inset-0 bg-background z-50 overflow-hidden">
        
        {/* Dynamic Anti-Cheating Watermark Generator */}
        <div className="absolute inset-0 pointer-events-none opacity-5 z-[100] grid grid-cols-4 grid-rows-5 items-center justify-items-center overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="text-4xl font-mono text-charcoal transform -rotate-45 whitespace-nowrap font-bold tracking-widest">
              {examCode.toUpperCase()}
            </div>
          ))}
        </div>

        <div className="w-full h-full flex flex-col">
          <div className="flex justify-between items-center px-8 py-4 bg-surface backdrop-blur-xl border-b border-charcoal/10 relative z-[101]">
            <div className="flex items-center gap-6">
              <span className="font-mono font-bold text-charcoal tracking-widest uppercase text-xl">{activeFile.name}</span>
              <span className="text-[10px] font-mono text-danger tracking-[0.2em] uppercase font-bold animate-pulse">/// DRM ACTIVE</span>
            </div>
            <button onClick={closeViewer} className="text-charcoal hover:bg-black hover:text-white font-mono font-bold text-xs tracking-widest px-6 py-2 uppercase transition-all bracket-card">
              [ TERMINATE ]
            </button>
          </div>
          <iframe
            src={decryptedPdfUrl}
            className="flex-1 w-full bg-white relative z-[99]"
            title="Exam PDF"
          />
        </div>
      </motion.div>
    );
  }

  // Markdown Viewer
  if (decryptedHtml && activeFile) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 10 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="flex-1 w-full h-full absolute inset-0 bg-background z-50 overflow-y-auto">
        <div className="w-full max-w-4xl mx-auto p-12 min-h-screen flex flex-col pt-24 pb-32">
          <div className="flex justify-between items-center mb-16 border-b border-charcoal/10 pb-8">
            <div className="flex items-center gap-6">
              <div className="text-charcoal font-mono text-3xl font-bold tracking-[0.1em] uppercase">
                {activeFile.name}
              </div>
              <span className="text-[10px] font-mono text-danger tracking-[0.2em] uppercase font-bold animate-pulse">/// DRM ACTIVE</span>
            </div>
            <button onClick={closeViewer} className="text-charcoal hover:bg-black hover:text-white font-mono font-bold text-xs tracking-widest px-6 py-3 uppercase transition-all bracket-card border border-charcoal/20">
              [ TERMINATE ]
            </button>
          </div>
          <div className="prose prose-lg max-w-none text-charcoal font-mono prose-headings:font-mono prose-h1:text-charcoal prose-a:text-blue-500 leading-loose" dangerouslySetInnerHTML={{ __html: decryptedHtml }} />
        </div>
      </motion.div>
    );
  }

  const exams = catalog[activeDept] || [];

  return (
    <div className="flex-1 grid grid-cols-[300px_1fr] relative z-10 w-full gap-8">
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="border-r border-[#1a1a1a]/10 bg-transparent p-6 overflow-y-auto flex flex-col gap-2">
        <div className="text-[#666] text-[10px] font-bold tracking-[0.2em] mb-8 uppercase flex items-center justify-between border-b border-[#1a1a1a]/10 pb-4">
          <span>/// Directories</span>
          <button onClick={fetchCatalog} className="hover:text-black transition-colors" title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${catalogLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {DEPARTMENTS.map(d => (
          <motion.button
            variants={itemVariants}
            key={d}
            onClick={() => setActiveDept(d)}
            className={`w-full text-left px-4 py-3 font-mono text-xs font-bold uppercase tracking-widest rounded-none flex justify-between items-center transition-all duration-300 group bracket-card ${
              activeDept === d 
                ? 'bg-white text-black shadow-glow-white border-white' 
                : 'bg-transparent text-[#666] hover:bg-white/50 border-transparent hover:border-white'
            }`}
          >
            <span className="">{d.replace('-', ' ')}</span>
            <div className="flex items-center gap-2">
              <ChevronRight className={`w-4 h-4 transition-all duration-300 opacity-50 ${activeDept === d ? 'translate-x-1 text-black' : 'opacity-0 -translate-x-2 group-hover:translate-x-0 group-hover:opacity-100'}`} />
            </div>
          </motion.button>
        ))}
      </motion.div>

      <div className="p-8 flex justify-center items-start overflow-y-auto bg-transparent">
        <div className="w-full max-w-5xl">
          <motion.h2 initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="font-mono font-bold text-4xl mb-12 border-b border-[#1a1a1a]/10 pb-6 text-charcoal uppercase tracking-[0.2em] flex items-center gap-4">
            {activeDept.replace('-', ' ')}
            <span className="text-xs font-mono text-muted tracking-wide opacity-50 self-end mb-2">/// {exams.length} NODE{exams.length !== 1 ? 'S' : ''} DETECTED</span>
          </motion.h2>

          {catalogLoading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-16 bracket-card hover-glow text-center text-charcoal font-mono text-xs flex flex-col items-center">
              <RefreshCw className="w-6 h-6 animate-spin mb-6 text-blue-500" />
              <div className="tracking-[0.2em] font-bold">SYNCING PROTOCOLS...</div>
            </motion.div>
          ) : (
            <motion.div key={`${activeDept}-${exams.length}`} variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 gap-8">
              {exams.length === 0 ? (
                <motion.div variants={cardVariants} className="col-span-2 p-16 bracket-card text-center text-charcoal font-mono text-xs uppercase tracking-[0.2em]">
                  <span className="opacity-50">/// Null Sector</span>
                </motion.div>
              ) : (
                exams.map((file, i) => (
                  <motion.button
                    variants={cardVariants}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    key={file}
                    onClick={() => setActiveFile({ path: `${activeDept}/${file}`, name: file.replace('.enc', '') })}
                    className="p-8 bracket-card hover-glow text-left flex flex-col justify-between min-h-[160px] group"
                  >
                    <div className="flex justify-between items-start w-full mb-6">
                      <div className="text-[10px] text-[#888] font-mono tracking-widest border border-[#888]/30 px-2 py-1 uppercase group-hover:border-blue-400 group-hover:text-blue-500 transition-colors">
                        ID_{String(i + 1).padStart(3, '0')}
                      </div>
                      <Lock className="w-4 h-4 text-[#888] group-hover:text-blue-500 transition-colors" />
                    </div>
                    <div>
                      <div className="text-charcoal font-mono font-bold text-xl uppercase tracking-widest leading-tight mb-2 truncate">
                        {file.replace('.enc', '')}
                      </div>
                      <div className="text-[#666] text-[10px] uppercase tracking-[0.2em] opacity-80">
                        {`[ `}ENCRYPTED PAYLOAD{` ]`}
                      </div>
                    </div>
                  </motion.button>
                ))
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* The Igloo Decryption Modal */}
      <AnimatePresence>
        {activeFile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="absolute inset-0 z-50 bg-white/30 backdrop-blur-3xl flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 10, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 10, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className="w-full max-w-[480px] bg-white/70 border border-white p-10 shadow-glow-white flex flex-col gap-8 bracket-card">
              <div className="text-center mt-2">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-glow-blue border border-[#ccc]">
                  <Lock className="w-6 h-6 text-blue-500" />
                </div>
                <h3 className="text-charcoal font-mono font-bold text-2xl mb-3 tracking-[0.2em] uppercase">
                   ACCESS REQUEST
                </h3>
                <p className="text-[#666] text-[10px] tracking-widest leading-loose max-w-[280px] mx-auto uppercase">/// TARGET: {activeFile.name}<br/>/// AUTHORIZATION REQUIRED</p>
              </div>
              
              <div>
                <input 
                  type="password" 
                  autoFocus
                  value={examCode}
                  onChange={e => setExamCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDecrypt()}
                  className="w-full bg-transparent border-b-2 border-charcoal/20 text-charcoal rounded-none px-4 py-4 font-mono text-2xl text-center tracking-[0.3em] focus:border-blue-500 focus:outline-none transition-all duration-300 placeholder:opacity-20 placeholder:text-charcoal/50"
                  placeholder="CODE"
                />
              </div>
              
              <AnimatePresence>
                {status.msg && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-danger font-mono tracking-widest uppercase text-center text-[10px] font-bold">
                    [ ! ] {status.msg}
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="flex gap-4 mt-4">
                <button 
                  onClick={() => setActiveFile(null)} 
                  className="flex-1 px-4 py-4 bg-transparent border border-charcoal text-charcoal hover:bg-charcoal hover:text-white font-bold font-mono text-xs tracking-widest uppercase transition-all"
                >
                  [ ABORT ]
                </button>
                <button 
                  onClick={handleDecrypt} 
                  disabled={loading || !examCode}
                  className="flex-1 px-4 py-4 bg-charcoal text-white hover:bg-black font-bold font-mono text-xs tracking-widest uppercase disabled:opacity-50 transition-all shadow-glow-blue"
                >
                  {loading ? '[ VERIFYING... ]' : '[ INITIATE ]'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
