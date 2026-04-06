import { useState, useEffect } from 'react';
import { decryptWithKeyring } from '../lib/crypto';
import { fetchFullCatalogFromAPI } from '../lib/github';
import { marked } from 'marked';
import { Lock, FileText, ChevronRight, RefreshCw } from 'lucide-react';

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
      const rawCatalogUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/public/catalog.json`;
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
        ? (import.meta.env.BASE_URL + 'catalog.json')
        : (PAGES_BASE_URL + 'catalog.json');

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
      const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${activeFile.path}`;
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
      if (errMsg.includes('Could not download')) {
        setStatus({ type: 'error', msg: 'ERROR: Could not download the exam file. It may have been removed or the exam has ended.' });
      } else {
        setStatus({ type: 'error', msg: 'ACCESS DENIED: Invalid Student ID — Cryptographic Keyring Rejection.' });
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
      <div className="flex-1 w-full h-full absolute inset-0 bg-background z-50 overflow-hidden relative">
        
        {/* Dynamic Anti-Cheating Watermark Generator */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-[100] grid grid-cols-4 grid-rows-5 items-center justify-items-center overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="text-4xl font-display text-white transform -rotate-45 whitespace-nowrap">
              {examCode.toUpperCase()}
            </div>
          ))}
        </div>

        <div className="w-full h-full flex flex-col">
          <div className="flex justify-between items-center px-8 py-4 bg-surface border-b border-white/10 relative z-[101]">
            <div className="flex items-center gap-4">
              <span className="font-display text-accent tracking-widest uppercase">{activeFile.name}</span>
              <span className="text-xs font-mono text-[#f85149]">DRM PROTOCOLS ACTIVE</span>
            </div>
            <button onClick={closeViewer} className="text-muted hover:text-white font-mono border border-white/20 px-4 py-2 rounded">
              END SESSION
            </button>
          </div>
          <iframe
            src={decryptedPdfUrl}
            className="flex-1 w-full bg-white"
            title="Exam PDF"
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    );
  }

  // Markdown Viewer
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
        <div className="font-mono text-muted text-xs tracking-[0.2em] mb-4 uppercase flex items-center justify-between">
          <span>Directories</span>
          <button onClick={fetchCatalog} className="hover:text-accent transition-colors" title="Refresh exam list">
            <RefreshCw className={`w-3.5 h-3.5 ${catalogLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
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
            <div className="flex items-center gap-2">
              {(catalog[d]?.length || 0) > 0 && (
                <span className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded font-mono">
                  {catalog[d].length}
                </span>
              )}
              <ChevronRight className={`w-4 h-4 transition-transform ${activeDept === d ? 'text-accent opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
            </div>
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

          {catalogLoading ? (
            <div className="col-span-2 p-8 border border-white/5 bg-white/5 rounded-xl text-center text-muted font-mono text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-3 text-accent" />
              Scanning node for live exams...
            </div>
          ) : (
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
          )}
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
