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

  // Merge two catalogs by union of files per department
  const mergeCatalogs = (a: Catalog, b: Catalog): Catalog => {
    const result: Catalog = {};
    for (const dept of DEPARTMENTS) {
      const set = new Set([...(a[dept] || []), ...(b[dept] || [])]);
      result[dept] = Array.from(set);
    }
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
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Update local view AND persist to localStorage for cross-tab sync
      const updatedCatalog = { ...catalog };
      const dArr = updatedCatalog[dept] || [];
      updatedCatalog[dept] = [...dArr, `${safeFilename}.enc`];
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

  const inputClass = "w-full bg-[#0a0a0a] border border-[#2a2a2a] text-[#e5e5e5] rounded-xl p-4 mb-5 focus:outline-none focus:border-[#666] focus:ring-1 focus:ring-[#666] transition-all duration-200 font-sans text-sm";
  const labelClass = "block text-muted text-xs font-semibold mb-2";

  // LOGIN GATEWAY
  if (!isLoggedIn) {
    return (
      <div className="flex-1 overflow-y-auto p-12 relative z-10 flex flex-col items-center justify-center font-sans bg-background">
        <motion.button 
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
          onClick={() => navigate('/')} 
          className="mb-8 text-muted hover:text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 hover:bg-[#1a1a1a]"
        >
          &larr; Return to Portal
        </motion.button>
        <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="w-full max-w-[420px] minimal-panel p-10 flex flex-col gap-2 relative">
          <h2 className="font-sans font-semibold text-[#e5e5e5] text-2xl tracking-tight mb-8 text-center">Faculty Login</h2>
          <div className="text-left relative z-10 flex flex-col gap-1">
            <label className={labelClass}>Master Team Lead Key</label>
            <input type="password" value={token} onChange={e => setToken(e.target.value)} className={inputClass} placeholder="ghp_xxxxxxxxxxxx" />
            
            <label className={labelClass}>Institute Repo Owner</label>
            <input type="text" value={owner} onChange={e => setOwner(e.target.value)} className={inputClass} placeholder="e.g. MatteBlack003" />
            
            <label className={labelClass}>Repository Name</label>
            <input type="text" value={repo} onChange={e => setRepo(e.target.value)} className={inputClass} placeholder="SynnefoVault" />
            
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleLogin} className="w-full bg-[#e5e5e5] text-black p-4 rounded-xl font-semibold hover:bg-white mt-4 shadow-sm transition-all duration-200">Sign In</motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // SYSTEM DASHBOARD
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-[1] overflow-y-auto p-12 relative z-10 font-sans flex gap-10 bg-background max-w-[1400px] w-full mx-auto">
      {/* Upload Panel */}
      <div className="flex-[2] minimal-panel p-10 h-fit">
        <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-6 mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')} 
              className="text-muted hover:text-white text-lg font-medium border border-[#2a2a2a] px-3 py-1 rounded-lg transition-colors hover:bg-[#1a1a1a]"
              title="Return to Portal"
            >
              &larr;
            </button>
            <h2 className="font-sans font-semibold text-2xl tracking-tight text-[#e5e5e5]">Keyring Generator</h2>
          </div>
          <div className="flex gap-3">
            <button onClick={() => fetchLiveCatalog()} className="text-xs font-medium border border-[#2a2a2a] text-[#e5e5e5] px-4 py-2 rounded-lg hover:bg-[#1a1a1a] transition-colors">Refresh</button>
            <button onClick={handleLogout} className="text-xs font-medium border border-[#ff453a]/30 text-[#ff453a] px-4 py-2 rounded-lg hover:bg-[#ff453a]/10 transition-colors">Disconnect</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-6">
          <div>
            <label className={labelClass}>Department</label>
            <select value={dept} onChange={e => setDept(e.target.value)} className={inputClass}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d.replace('-', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Exam Filename</label>
            <input type="text" value={filename} onChange={e => setFilename(e.target.value)} className={inputClass} placeholder="e.g. mock-04" />
          </div>
          <div>
            <label className={labelClass}>Class Size</label>
            <input type="number" min="1" max="200" value={studentCount} onChange={e => setStudentCount(e.target.value === '' ? '' : parseInt(e.target.value, 10))} className={inputClass} placeholder="e.g. 3" />
          </div>
        </div>

        {/* Content Type Toggle */}
        <div className="mb-6">
          <label className={labelClass}>Content Type</label>
          <div className="flex gap-2">
            <button
              onClick={() => { setContentType('markdown'); setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className={`flex-1 p-3 rounded-xl font-medium text-sm border transition-all ${
                contentType === 'markdown'
                  ? 'bg-white text-black border-white'
                  : 'border-[#2a2a2a] text-muted hover:border-[#444] hover:bg-[#1a1a1a]'
              }`}
            >
              Markdown Text
            </button>
            <button
              onClick={() => { setContentType('pdf'); setContent(''); }}
              className={`flex-1 p-3 rounded-xl font-medium text-sm border transition-all ${
                contentType === 'pdf'
                  ? 'bg-white text-black border-white'
                  : 'border-[#2a2a2a] text-muted hover:border-[#444] hover:bg-[#1a1a1a]'
              }`}
            >
              PDF Upload
            </button>
          </div>
        </div>

        {/* Content Input - Markdown or PDF */}
        {contentType === 'markdown' ? (
          <div>
            <label className={labelClass}>Question Paper Markdown</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} className={`${inputClass} min-h-[240px] font-mono text-[13px] leading-relaxed resize-y`} placeholder="# Question 1..." />
          </div>
        ) : (
          <div>
            <label className={labelClass}>Upload Question Paper (PDF)</label>
            <div className={`${inputClass} min-h-[200px] flex flex-col items-center justify-center border-dashed border-[#444] cursor-pointer hover:border-[#666] hover:bg-[#151515] transition-colors`}
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
                <div className="text-center">
                  <div className="text-[#e5e5e5] text-lg mb-2">📄</div>
                  <div className="text-[#e5e5e5] text-sm font-medium">{pdfFile.name}</div>
                  <div className="text-muted text-xs mt-1">{(pdfFile.size / 1024).toFixed(1)} KB</div>
                  <div className="text-muted text-xs mt-3 bg-[#1a1a1a] px-3 py-1 rounded-full border border-[#2a2a2a]">Click to change file</div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-muted text-2xl mb-3">⬆️</div>
                  <div className="text-[#e5e5e5] text-sm font-medium">Click to select PDF</div>
                  <div className="text-muted text-xs mt-1">Maximum generic file size limit applies</div>
                </div>
              )}
            </div>
          </div>
        )}

        {status.msg && (
          <div className={`p-4 rounded-xl border mb-6 text-sm font-medium ${status.type === 'error' ? 'bg-[#ff453a]/10 border-[#ff453a]/30 text-[#ff453a]' : 'bg-[#32d74b]/10 border-[#32d74b]/30 text-[#32d74b]'}`}>
            {status.msg}
          </div>
        )}

        {generatedIds.length > 0 && (
          <div className="mb-6 bg-[#0a0a0a] border border-[#2a2a2a] p-5 rounded-xl h-48 overflow-y-auto">
             <div className="text-[#e5e5e5] text-sm font-medium mb-3">Generated Cryptographic Keys for: {filename || 'exam'}</div>
             <div className="grid grid-cols-4 gap-3 text-muted text-xs font-mono">
               {generatedIds.map(id => <div key={id} className="bg-[#111111] border border-[#2a2a2a] px-3 py-2 rounded-lg select-all text-center">{id}</div>)}
             </div>
          </div>
        )}

        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={handleCreateExam} disabled={loading} className="w-full bg-[#e5e5e5] text-black font-semibold p-4 rounded-xl hover:bg-white shadow-sm disabled:opacity-50 transition-all">
          {loading ? 'Injecting Nodes...' : 'Generate IDs & Secure Exam'}
        </motion.button>
      </div>

      {/* Control Panel (End Exam) */}
      <div className="flex-[1.2] flex flex-col h-fit">
        <div className="minimal-panel p-8 relative overflow-hidden flex-1">
          <h2 className="font-sans font-semibold text-xl text-[#e5e5e5] border-b border-[#2a2a2a] pb-4 mb-6">Live Formations</h2>
          <p className="text-muted text-sm mb-8 leading-relaxed">Clicking End Exam physically deletes the encrypted file payload globally, instantly locking out active hex sessions.</p>
          
          <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-2">
            {Object.entries(catalog).flatMap(([d, files]) => 
              files.map(file => (
                 <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} key={`${d}/${file}`} className="flex justify-between items-center bg-[#0a0a0a] p-4 rounded-xl border border-[#2a2a2a] group hover:border-[#ff453a]/50 transition-colors shadow-sm">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-muted tracking-wider">{d.replace('-', ' ')}</span>
                      <span className="text-[#e5e5e5] text-sm font-medium">{file}</span>
                    </div>
                    <button 
                      onClick={() => setConfirmDelete({ dept: d, file: file })} 
                      disabled={loading} 
                      className="text-xs bg-[#1a1a1a] border border-[#ff453a]/30 text-[#ff453a] hover:bg-[#ff453a] hover:text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200"
                    >
                      End Exam
                    </button>
                 </motion.div>
              ))
            )}
            {Object.values(catalog).flat().length === 0 && (
               <div className="text-muted text-sm text-center py-10 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl border-dashed">No formations active.</div>
            )}
          </div>
        </div>
      </div>

      {/* Physics Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="absolute inset-0 z-[100] bg-[#0a0a0a]/90 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 10, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 10, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} className="bg-[#111111] border border-[#2a2a2a] p-8 rounded-3xl max-w-[420px] w-full shadow-minimal flex flex-col gap-4">
              <h3 className="text-[#ff453a] font-sans font-semibold text-xl text-center mb-2">Confirm Delete Payload</h3>
              <p className="text-muted mb-8 text-center text-sm leading-relaxed">
                Are you sure you want to completely purge <span className="text-[#e5e5e5] bg-[#1a1a1a] px-2 py-0.5 rounded border border-[#2a2a2a] font-mono text-xs">{confirmDelete.file}</span>? This action is permanent.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmDelete(null)} 
                  className="flex-1 p-3.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#e5e5e5] hover:bg-[#222222] rounded-xl font-sans font-semibold transition-all text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => { handleEndExam(confirmDelete.dept, confirmDelete.file); setConfirmDelete(null); }} 
                  className="flex-1 p-3.5 bg-[#ff453a] text-white hover:bg-[#ff3b30] rounded-xl font-sans font-semibold transition-all shadow-sm text-sm"
                >
                  End Exam Now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
