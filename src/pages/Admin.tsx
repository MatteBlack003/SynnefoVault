import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { encryptWithKeyring } from '../lib/crypto';
import { uploadToGitHub, deleteFromGitHub, fetchFullCatalogFromAPI, updateCatalogInRepo } from '../lib/github';

const DEPARTMENTS = [
  'networking', 'devops', 'python-full-stack', 'mern-stack', 'flutter', 'cyber-security', 'digital-marketing', 'data-science'
];

const REPO_OWNER = 'MatteBlack003';
const REPO_NAME = 'SynnefoVault';

const CATALOG_STORAGE_KEY = 'synnefo_live_catalog';

interface Catalog {
  [dept: string]: string[];
}

/** Save catalog to localStorage for cross-tab syncing */
function saveCatalogLocally(catalog: Catalog) {
  localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
}

/** Load catalog from localStorage */
function loadCatalogLocally(): Catalog | null {
  const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return null;
}

export function Admin() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{dept: string, file: string} | null>(null);

  // Upload State
  const [dept, setDept] = useState('networking');
  const [filename, setFilename] = useState('');
  const [studentCount, setStudentCount] = useState<number | ''>('');
  const [duration, setDuration] = useState<number | ''>(''); // exam duration in minutes
  const [content, setContent] = useState('');
  const [contentType, setContentType] = useState<'markdown' | 'pdf'>('markdown');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [generatedIds, setGeneratedIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Dashboard Tools
  const [catalog, setCatalog] = useState<Catalog>({});
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('sys_gh_token');
    const o = localStorage.getItem('sys_gh_owner');
    const r = localStorage.getItem('sys_gh_repo');
    if (t && o && r) {
      setToken(t); setOwner(o); setRepo(r);
      setIsLoggedIn(true);
      // Load from localStorage first (instant), then refresh from API
      const localCatalog = loadCatalogLocally();
      if (localCatalog) setCatalog(localCatalog);
      fetchFullCatalogFromAPI(o, r, DEPARTMENTS, t).then(apiCatalog => {
        // Merge: keep anything from local that API doesn't have
        const merged = mergeCatalogs(localCatalog || {}, apiCatalog);
        setCatalog(merged);
        saveCatalogLocally(merged);
      });
    }
  }, []);

  // Merge two catalogs by union of files per department (preserves _durations)
  const mergeCatalogs = (a: Catalog, b: Catalog): Catalog => {
    const result: Catalog = {};
    for (const d of DEPARTMENTS) {
      const set = new Set([...(a[d] || []), ...(b[d] || [])]);
      result[d] = Array.from(set);
    }
    // Merge _durations from both sources
    const durA = (a as Record<string, unknown>)['_durations'] as Record<string, number> || {};
    const durB = (b as Record<string, unknown>)['_durations'] as Record<string, number> || {};
    (result as Record<string, unknown>)['_durations'] = { ...durA, ...durB };
    return result;
  };

  // Fetch live catalog from GitHub API (uses admin token = 5000 req/hr)
  const fetchLiveCatalog = async (authToken?: string) => {
    const effectiveToken = authToken || token;
    const effectiveOwner = owner || REPO_OWNER;
    const effectiveRepo = repo || REPO_NAME;
    const apiCatalog = await fetchFullCatalogFromAPI(effectiveOwner, effectiveRepo, DEPARTMENTS, effectiveToken);
    const localCatalog = loadCatalogLocally();
    const merged = mergeCatalogs(localCatalog || {}, apiCatalog);
    setCatalog(merged);
    saveCatalogLocally(merged);
  };

  const handleLogin = () => {
    if (!token || !owner || !repo) return alert("Enter all credentials first.");
    localStorage.setItem('sys_gh_token', token);
    localStorage.setItem('sys_gh_owner', owner);
    localStorage.setItem('sys_gh_repo', repo);
    setIsLoggedIn(true);
    fetchLiveCatalog(token);
  };

  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    setToken(''); setOwner(''); setRepo('');
  };

  // Generate an array of strictly unique Student IDs
  const generateUniqueIDs = (count: number, prefix: string): string[] => {
    const ids: Set<string> = new Set();
    while (ids.size < count) {
      const randomSegment = Array.from(window.crypto.getRandomValues(new Uint8Array(2)))
        .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      ids.add(`${prefix.toUpperCase()}-${randomSegment}`);
    }
    return Array.from(ids);
  };

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setContent(''); // Clear markdown content if switching to PDF
    } else if (file) {
      setStatus({ type: 'error', msg: 'Only PDF files are accepted.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleCreateExam = async () => {
    const hasContent = contentType === 'pdf' ? pdfFile !== null : content.trim() !== '';
    if(!filename || !hasContent) {
      setStatus({ type: 'error', msg: 'Filename and Content (PDF or Markdown) are strictly required.' });
      return;
    }

    if (typeof studentCount !== 'number' || isNaN(studentCount) || studentCount < 1 || studentCount > 200) {
      setStatus({ type: 'error', msg: 'ERROR: Class size must be a number between 1 and 200.' });
      return;
    }

    if (duration !== '' && (typeof duration !== 'number' || isNaN(duration) || duration < 1 || duration > 600)) {
      setStatus({ type: 'error', msg: 'ERROR: Duration must be between 1 and 600 minutes (or leave blank for no limit).' });
      return;
    }

    setLoading(true);
    setStatus({ type: '', msg: '' });
    setGeneratedIds([]);

    try {
      const newIds = generateUniqueIDs(studentCount, dept.split('-')[0].substring(0, 3));
      
      let payloadContent: string;
      if (contentType === 'pdf' && pdfFile) {
        const base64Data = await readFileAsBase64(pdfFile);
        payloadContent = `PDF:${base64Data}`;
      } else {
        payloadContent = `MD:${content}`;
      }

      const payloadString = await encryptWithKeyring(newIds, payloadContent);
      
      const safeFilename = filename.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const targetPath = `${dept}/${safeFilename}.enc`;

      await uploadToGitHub({
        repoOwner: owner,
        repoName: repo,
        path: targetPath,
        content: payloadString,
        message: `System: Init Exam on ${targetPath}`,
        token
      });

      setStatus({ type: 'success', msg: `SUCCESS: ${targetPath} injected into the Node. Distribute these exact Student IDs to the class:` });
      setGeneratedIds(newIds);
      setContent('');
      setPdfFile(null);
      setFilename('');
      setDuration('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // CRITICAL FIX: Always merge against the freshest localStorage to avoid
      // overwriting other exams that admin's React state may not have loaded yet.
      const freshLocal = loadCatalogLocally() || {};
      const updatedCatalog = mergeCatalogs(freshLocal, catalog);
      const dArr = updatedCatalog[dept] || [];
      if (!dArr.includes(`${safeFilename}.enc`)) {
        updatedCatalog[dept] = [...dArr, `${safeFilename}.enc`];
      }

      // Store duration in _durations map
      if (typeof duration === 'number' && duration > 0) {
        const existing = (updatedCatalog as Record<string, unknown>)['_durations'] as Record<string, number> || {};
        (updatedCatalog as Record<string, unknown>)['_durations'] = { ...existing, [targetPath]: duration };
      }

      setCatalog(updatedCatalog);
      saveCatalogLocally(updatedCatalog);

      // Also commit catalog.json to the repo (for deployed site / other devices)
      try {
        await updateCatalogInRepo({ repoOwner: owner, repoName: repo, catalog: updatedCatalog, token });
      } catch { /* non-critical */ }

    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to push Keyring payload to node.';
      setStatus({ type: 'error', msg: `ERROR: ${message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleEndExam = async (targetDept: string, targetFile: string) => {
    setLoading(true);
    setStatus({ type: '', msg: '' });
    const targetPath = `${targetDept}/${targetFile}`;

    try {
      await deleteFromGitHub({
        repoOwner: owner,
        repoName: repo,
        path: targetPath,
        token
      });
      
      setStatus({ type: 'success', msg: `EXECUTED: ${targetFile} has been entirely deleted from the GitHub node. Access globally revoked.` });
      const updatedCatalog = {
        ...catalog,
        [targetDept]: (catalog[targetDept] || []).filter(f => f !== targetFile)
      };
      // Also remove duration entry if present
      const durations = (updatedCatalog as Record<string, unknown>)['_durations'] as Record<string, number> || {};
      delete durations[targetPath];
      (updatedCatalog as Record<string, unknown>)['_durations'] = durations;

      setCatalog(updatedCatalog);
      saveCatalogLocally(updatedCatalog);

      // Also commit catalog.json to the repo
      try {
        await updateCatalogInRepo({ repoOwner: owner, repoName: repo, catalog: updatedCatalog, token });
      } catch { /* non-critical */ }
    } catch(err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to execute deletion protocol.';
      setStatus({ type: 'error', msg: `ERROR: ${message}` });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-transparent border-b-2 border-charcoal/20 text-charcoal rounded-none px-4 py-3 mb-6 focus:outline-none focus:border-blue-500 transition-all duration-300 font-mono text-sm placeholder:opacity-40";
  const labelClass = "block text-charcoal text-[10px] tracking-widest font-bold mb-2 uppercase";

  // LOGIN GATEWAY
  if (!isLoggedIn) {
    return (
      <div className="flex-1 overflow-y-auto p-12 relative z-10 flex flex-col items-center justify-center bg-transparent">
        <motion.button 
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
          onClick={() => navigate('/')} 
          className="mb-8 text-charcoal hover:bg-black hover:text-white px-6 py-2 border border-charcoal text-xs font-mono font-bold tracking-widest uppercase transition-all flex items-center gap-2 bracket-card"
        >
          [ RETURN_TO_SYSTEM ]
        </motion.button>
        <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="w-full max-w-[480px] bg-white/60 backdrop-blur-3xl p-12 flex flex-col gap-4 relative bracket-card shadow-glow-white border border-white">
          <h2 className="font-mono font-bold text-charcoal text-3xl tracking-[0.2em] mb-10 text-center uppercase">FACULTY_GATEWAY</h2>
          <div className="text-left relative z-10 flex flex-col gap-2">
            <label className={labelClass}>/// Master Team Lead Key</label>
            <input type="password" value={token} onChange={e => setToken(e.target.value)} className={inputClass} placeholder="ghp_xxxxxxxxxxxx" />
            
            <label className={labelClass}>/// Institute Repo Owner</label>
            <input type="text" value={owner} onChange={e => setOwner(e.target.value)} className={inputClass} placeholder="e.g. MatteBlack003" />
            
            <label className={labelClass}>/// Repository Name</label>
            <input type="text" value={repo} onChange={e => setRepo(e.target.value)} className={inputClass} placeholder="SynnefoVault" />
            
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleLogin} className="w-full bg-charcoal text-white tracking-widest p-4 text-xs font-mono font-bold hover:bg-black mt-6 shadow-glow-blue transition-all duration-300 uppercase">[ AUTHENTICATE ]</motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // SYSTEM DASHBOARD
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-[1] overflow-y-auto p-12 relative z-10 flex gap-10 bg-transparent max-w-[1400px] w-full mx-auto font-mono">
      {/* Upload Panel */}
      <div className="flex-[2] bracket-card p-12 h-fit bg-surface">
        <div className="flex justify-between items-center border-b border-charcoal/10 pb-6 mb-8">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigate('/')} 
              className="text-charcoal hover:bg-black hover:text-white font-bold tracking-widest border border-charcoal px-4 py-2 text-xs uppercase transition-colors"
              title="Return to Portal"
            >
              [ ESC ]
            </button>
            <h2 className="font-mono font-bold text-2xl tracking-[0.2em] uppercase text-charcoal">KEY_GENERATOR</h2>
          </div>
          <div className="flex gap-4">
            <button onClick={() => fetchLiveCatalog()} className="text-[10px] font-bold tracking-widest border border-charcoal/20 text-charcoal px-5 py-2 uppercase hover:bg-charcoal hover:text-white transition-colors">[ REFRESH ]</button>
            <button onClick={handleLogout} className="text-[10px] font-bold tracking-widest border border-danger/40 text-danger px-5 py-2 uppercase hover:bg-danger hover:text-white transition-colors">[ DISCONNECT ]</button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8">
          <div>
            <label className={labelClass}>/// Department_Node</label>
            <select value={dept} onChange={e => setDept(e.target.value)} className={inputClass}>
              {DEPARTMENTS.map(d => <option key={d} value={d} className="uppercase tracking-widest text-[#1a1a1a]">{d.replace('-', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>/// Target_File.enc</label>
            <input type="text" value={filename} onChange={e => setFilename(e.target.value)} className={inputClass} placeholder="mock-04" />
          </div>
          <div>
            <label className={labelClass}>/// Class_Size</label>
            <input type="number" min="1" max="200" value={studentCount} onChange={e => setStudentCount(e.target.value === '' ? '' : parseInt(e.target.value, 10))} className={inputClass} placeholder="MAX_200" />
          </div>
          <div>
            <label className={labelClass}>/// Duration_Min <span className="normal-case text-[#aaa] tracking-normal font-normal">(optional)</span></label>
            <input type="number" min="1" max="600" value={duration} onChange={e => setDuration(e.target.value === '' ? '' : parseInt(e.target.value, 10))} className={inputClass} placeholder="e.g. 90" />
          </div>
        </div>

        {/* Content Type Toggle */}
        <div className="mb-8">
          <label className={labelClass}>/// Payload_Format</label>
          <div className="flex gap-4">
            <button
              onClick={() => { setContentType('markdown'); setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className={`flex-1 p-3 font-bold text-[10px] tracking-widest uppercase border transition-all ${
                contentType === 'markdown'
                  ? 'bg-charcoal text-white border-charcoal shadow-glow-blue'
                  : 'border-charcoal/20 text-[#666] hover:border-charcoal hover:bg-white'
              }`}
            >
              [ MD_BUFFER ]
            </button>
            <button
              onClick={() => { setContentType('pdf'); setContent(''); }}
              className={`flex-1 p-3 font-bold text-[10px] tracking-widest uppercase border transition-all ${
                contentType === 'pdf'
                  ? 'bg-charcoal text-white border-charcoal shadow-glow-blue'
                  : 'border-charcoal/20 text-[#666] hover:border-charcoal hover:bg-white'
              }`}
            >
              [ PDF_BUFFER ]
            </button>
          </div>
        </div>

        {/* Content Input - Markdown or PDF */}
        {contentType === 'markdown' ? (
          <div className="mb-8">
            <label className={labelClass}>/// MD_Stream_Data</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} className={`${inputClass} min-h-[240px] font-mono text-[11px] leading-loose resize-y border-x-2 border-t-2 placeholder:tracking-[0.2em]`} placeholder="/// INJECT MARKDOWN HEADERS..." />
          </div>
        ) : (
          <div className="mb-8">
            <label className={labelClass}>/// PDF_Binary_Upload</label>
            <div className={`w-full bg-white/20 border-2 border-charcoal/30 text-charcoal rounded-none p-4 mb-6 transition-all duration-300 font-mono text-sm min-h-[200px] flex flex-col items-center justify-center border-dashed cursor-pointer hover:border-charcoal hover:bg-white/60 hover:shadow-glow-white`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePdfSelect}
                className="hidden"
              />
              {pdfFile ? (
                <div className="text-center font-mono">
                  <div className="text-charcoal text-2xl mb-4 font-bold">[ PDF ]</div>
                  <div className="text-charcoal text-[11px] font-bold tracking-widest uppercase">{pdfFile.name}</div>
                  <div className="text-blue-500 text-[10px] mt-2 mb-4 font-bold tracking-widest uppercase">SIZE: {(pdfFile.size / 1024).toFixed(1)} KB</div>
                  <div className="text-charcoal text-[10px] font-bold uppercase tracking-[0.2em] border border-charcoal px-4 py-2 hover:bg-charcoal hover:text-white transition-colors">/// LOAD_NEW_BINARY</div>
                </div>
              ) : (
                <div className="text-center font-mono">
                  <div className="text-[#666] text-3xl mb-4">+</div>
                  <div className="text-charcoal text-xs font-bold tracking-widest uppercase">INITIALIZE_FILE_UPLOAD</div>
                  <div className="text-[#888] text-[9px] font-bold tracking-[0.1em] mt-2 uppercase">STRICTLY .PDF ONLY</div>
                </div>
              )}
            </div>
          </div>
        )}

        {status.msg && (
          <div className={`p-4 border mb-8 text-[10px] font-bold tracking-widest uppercase ${status.type === 'error' ? 'bg-danger/5 border-danger/40 text-danger' : 'bg-blue-500/5 border-blue-500/40 text-blue-600'}`}>
            /// {status.msg}
          </div>
        )}

        {generatedIds.length > 0 && (
          <div className="mb-8 bg-charcoal/5 border border-charcoal/10 p-6 h-56 overflow-y-auto relative">
             <div className="text-charcoal text-[10px] font-bold tracking-widest mb-4 uppercase border-b border-charcoal/10 pb-2">/// ACTIVE KEYRING MAP</div>
             <div className="grid grid-cols-4 gap-4 text-charcoal text-[11px] font-mono tracking-wider font-bold">
               {generatedIds.map(id => <div key={id} className="bg-white border-l-2 border-charcoal px-3 py-2 select-all text-center shadow-sm">{id}</div>)}
             </div>
          </div>
        )}

        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={handleCreateExam} disabled={loading} className="w-full bg-charcoal text-white text-[11px] uppercase tracking-[0.3em] font-bold p-5 hover:bg-black hover:shadow-glow-blue disabled:opacity-50 transition-all bracket-card border border-charcoal">
          {loading ? '[ INJECTING... ]' : '[ EXECUTE_ENCRYPTION_AND_DEPLOY ]'}
        </motion.button>
      </div>

      {/* Control Panel (End Exam) */}
      <div className="flex-[1.2] flex flex-col h-fit">
        <div className="bracket-card p-10 relative overflow-hidden flex-1 bg-surface">
          <h2 className="font-mono font-bold text-xl text-charcoal tracking-[0.2em] border-b border-charcoal/10 pb-4 mb-6 uppercase">ACTIVE_NODES</h2>
          <p className="text-[#666] text-[10px] tracking-widest uppercase mb-10 leading-loose border-l-2 border-danger/30 pl-4 font-bold">/// WARNING: TERMINATION INSTANTLY PURGES THE PAYLOAD. THIS ACTION CANNOT BE UNDONE.</p>
          
          <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto pr-2">
            {Object.entries(catalog).flatMap(([d, files]) => 
              files.map(file => (
                 <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} key={`${d}/${file}`} className="flex justify-between items-center bg-white p-5 border border-charcoal/10 group hover:border-danger/60 transition-all shadow-sm relative bracket-card">
                    <div className="flex flex-col gap-2">
                       <span className="text-[9px] text-[#888] font-bold tracking-[0.2em] uppercase">/// DIR: {d}</span>
                       <span className="text-charcoal text-sm font-bold tracking-widest uppercase">{file}</span>
                    </div>
                    <button 
                      onClick={() => setConfirmDelete({ dept: d, file: file })} 
                      disabled={loading} 
                      className="text-[10px] border border-danger/40 text-danger hover:bg-danger hover:text-white px-4 py-3 font-bold uppercase tracking-widest transition-all duration-200"
                    >
                      [ PURGE ]
                    </button>
                 </motion.div>
              ))
            )}
            {Object.values(catalog).flat().length === 0 && (
               <div className="text-[#888] text-[10px] font-bold tracking-widest uppercase text-center py-12 bg-charcoal/5 border border-charcoal/10 border-dashed">/// NULL SET</div>
            )}
          </div>
        </div>
      </div>

      {/* Physics Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="absolute inset-0 z-[100] bg-white/40 backdrop-blur-3xl flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 10, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 10, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} className="bg-white/80 border border-danger/20 p-12 max-w-[500px] w-full flex flex-col gap-8 shadow-[0_0_80px_rgba(255,0,0,0.1)] bracket-card">
              <h3 className="text-danger font-mono font-bold text-2xl text-center mb-2 tracking-[0.2em] uppercase">SYS_PURGE_CONFIRM</h3>
              <p className="text-[#666] mb-4 text-center text-[10px] leading-loose font-bold tracking-widest uppercase">
                ARE YOU SURE YOU WANT TO COMPLETELY PURGE <br/><span className="text-charcoal bg-charcoal/5 px-3 py-1 border-l-2 border-charcoal mt-2 inline-block font-mono text-sm shadow-sm">{confirmDelete!.file}</span><br/><br/>THIS IS A LEVEL 0 IRREVERSIBLE COMMAND.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmDelete(null)} 
                  className="flex-1 p-4 bg-transparent border border-charcoal text-charcoal hover:bg-charcoal hover:text-white font-mono font-bold tracking-widest uppercase transition-all text-xs"
                >
                  [ ABORT ]
                </button>
                <button 
                  onClick={() => { handleEndExam(confirmDelete!.dept, confirmDelete!.file); setConfirmDelete(null); }} 
                  className="flex-[1.5] p-4 bg-danger text-white hover:bg-[#cc0000] font-mono font-bold tracking-widest uppercase transition-all shadow-sm text-xs"
                >
                  [ EXECUTE PURGE ]
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
