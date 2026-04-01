import { useState, useEffect } from 'react';
import { encryptText } from '../lib/crypto';
import { uploadToGitHub } from '../lib/github';

const DEPARTMENTS = [
  'networking', 'devops', 'python-full-stack', 'mern-stack', 'flutter', 'cyber-security', 'digital-marketing', 'data-science'
];

export function Admin() {
  const [token, setToken] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [dept, setDept] = useState('networking');
  const [filename, setFilename] = useState('');
  const [password, setPassword] = useState('');
  const [content, setContent] = useState('');
  
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem('sys_gh_token') || '');
    setOwner(localStorage.getItem('sys_gh_owner') || '');
    setRepo(localStorage.getItem('sys_gh_repo') || '');
  }, []);

  const handleUpload = async () => {
    if(!token || !owner || !repo || !filename || !password || !content) {
      setStatus({ type: 'error', msg: 'ALL FIELDS ARE STRICTLY REQUIRED.' });
      return;
    }

    localStorage.setItem('sys_gh_token', token);
    localStorage.setItem('sys_gh_owner', owner);
    localStorage.setItem('sys_gh_repo', repo);

    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      const encryptedJsonString = await encryptText(password, content);
      
      const safeFilename = filename.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const targetPath = `${dept}/${safeFilename}.enc`;

      await uploadToGitHub({
        repoOwner: owner,
        repoName: repo,
        path: targetPath,
        content: encryptedJsonString,
        message: `Admin upload: ${targetPath}`,
        token
      });

      setStatus({ type: 'success', msg: `SUCCESS: Encrypted and uploaded to ${targetPath}!` });
      setContent('');
      setFilename('');
      setPassword('');
      
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', msg: `ERROR: ${err.message || 'Failed to push to GitHub.'}` });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-[#010409] border border-white/20 text-white rounded p-3 mb-4 focus:outline-none focus:border-accent font-mono";
  const labelClass = "block text-muted text-sm font-bold mb-2 uppercase tracking-widest";

  return (
    <div className="flex-1 overflow-y-auto p-12 relative z-10 flex flex-col items-center text-left">
      <div className="w-full max-w-4xl bg-surface backdrop-blur-3xl border border-white/10 rounded-xl p-10 shadow-2xl">
        <h2 className="font-display text-2xl text-accent border-b border-white/10 pb-4 mb-8">SECURE EXAM UPLOAD FACILITY</h2>

        <div className="grid grid-cols-2 gap-8 mb-4">
          <div>
            <label className={labelClass}>GitHub Token</label>
            <input type="password" value={token} onChange={e => setToken(e.target.value)} className={inputClass} placeholder="ghp_..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Repo Owner</label>
              <input type="text" value={owner} onChange={e => setOwner(e.target.value)} className={inputClass} placeholder="SynnefoSolutions" />
            </div>
            <div>
              <label className={labelClass}>Repo Name</label>
              <input type="text" value={repo} onChange={e => setRepo(e.target.value)} className={inputClass} placeholder="mock-exams" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-8 mb-4">
          <div className="col-span-1">
            <label className={labelClass}>Department</label>
            <select value={dept} onChange={e => setDept(e.target.value)} className={inputClass}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d.toUpperCase().replace('-', ' ')}</option>)}
            </select>
          </div>
          <div className="col-span-1">
            <label className={labelClass}>Filename (No Ext)</label>
            <input type="text" value={filename} onChange={e => setFilename(e.target.value)} className={inputClass} placeholder="e.g. jan-2024-test" />
          </div>
          <div className="col-span-1">
            <label className={labelClass}>Secret Access Code</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} placeholder="Provided to students at exam time" />
          </div>
        </div>

        <div>
          <label className={labelClass}>Question Paper Markdown Content</label>
          <textarea 
            value={content} 
            onChange={e => setContent(e.target.value)} 
            className={`${inputClass} h-64 font-mono text-sm leading-relaxed`} 
            placeholder="# Question 1&#10;What is a Virtual Machine?" 
          />
        </div>

        {status.msg && (
          <div className={`p-4 rounded border mb-6 font-mono font-bold ${status.type === 'error' ? 'bg-[#f85149]/10 border-[#f85149] text-[#ff7b72]' : 'bg-[#238636]/10 border-[#238636] text-[#3fb950]'}`}>
            {status.msg}
          </div>
        )}

        <button 
          onClick={handleUpload} 
          disabled={loading}
          className="w-full bg-[#238636] hover:bg-[#2ea043] text-white font-bold font-mono tracking-widest p-4 rounded transition-colors disabled:opacity-50"
        >
          {loading ? 'ENCRYPTING & UPLOADING TO GITHUB...' : 'ENCRYPT & SECURE EXAM'}
        </button>
      </div>
    </div>
  );
}
