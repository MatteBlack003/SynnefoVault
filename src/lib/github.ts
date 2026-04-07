export interface GitHubUploadParams {
  repoOwner: string;
  repoName: string;
  path: string;
  message: string;
  content: string; // The raw string content (e.g. JSON string). We will Base64 map it internally.
  token: string;
}

export async function uploadToGitHub(params: GitHubUploadParams) {
  const { repoOwner, repoName, path, message, content, token } = params;
  const encodedContent = btoa(unescape(encodeURIComponent(content)));

  let sha: string | undefined = undefined;
  try {
    const res = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (res.ok) {
      const data = await res.json();
      sha = data.sha;
    }
  } catch {
    // File doesn't exist yet, which is fine — we'll create it
  }

  const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message, content: encodedContent, sha })
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.message || 'Failed to upload to GitHub');
  }

  return response.json();
}

/**
 * Used by Team Leaders to permanently wipe the exam from the servers to revoke access.
 */
export async function deleteFromGitHub(params: {
  repoOwner: string;
  repoName: string;
  path: string;
  token: string;
}) {
  const { repoOwner, repoName, path, token } = params;

  // 1. You MUST GET the sha of the file before you can DELETE it on GitHub
  const res = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' },
    cache: 'no-store'
  });

  if (!res.ok) {
    if (res.status === 404) return; // Already deleted
    const err = await res.json();
    throw new Error(err.message || 'Could not locate file to end exam.');
  }
  
  const data = await res.json();
  const sha = data.sha;

  // 2. Perform the DELETE
  const deleteRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `Admin execution: END STATUS on ${path}`,
      sha: sha
    })
  });

  if (!deleteRes.ok) {
    let errMsg = 'Failed to physically delete exam file.';
    try {
      const errData = await deleteRes.json();
      errMsg = errData.message || errMsg;
    } catch { /* response may not have JSON body */ }
    throw new Error(errMsg);
  }

  // GitHub DELETE can return 200 (with JSON body) or 204 (no content)
  if (deleteRes.status === 204) return {};
  return deleteRes.json();
}

/**
 * Updates the catalog.json file in the repo so it always reflects the current state.
 * This is called after every admin upload/delete action.
 * The student page reads this via raw.githubusercontent.com (no rate limits).
 */
export async function updateCatalogInRepo(params: {
  repoOwner: string;
  repoName: string;
  catalog: Record<string, string[]>;
  token: string;
}) {
  const { repoOwner, repoName, catalog, token } = params;
  const catalogContent = JSON.stringify(catalog, null, 2);

  await uploadToGitHub({
    repoOwner,
    repoName,
    path: 'public/catalog.json',
    content: catalogContent,
    message: 'System: Auto-update catalog.json',
    token
  });
}

/**
 * Fetches the full exam catalog using a SINGLE GitHub API call (Git Trees API).
 * This returns the entire repo file tree, from which we filter .enc files.
 * Uses 1 API request instead of 8 (one per department), staying well within
 * the unauthenticated rate limit of 60 requests/hour.
 */
export async function fetchFullCatalogFromAPI(
  repoOwner: string,
  repoName: string,
  departments: string[],
  token?: string
): Promise<Record<string, string[]>> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const catalog: Record<string, string[]> = {};
  for (const d of departments) {
    catalog[d] = [];
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/git/trees/main?recursive=1`,
      { headers, cache: 'no-store' }
    );

    if (!res.ok) return catalog;

    const data: { tree: Array<{ path: string; type: string }> } = await res.json();

    for (const item of data.tree) {
      if (item.type !== 'blob' || !item.path.endsWith('.enc')) continue;

      // item.path looks like "networking/test.enc"
      const parts = item.path.split('/');
      if (parts.length === 2) {
        const dept = parts[0];
        const filename = parts[1];
        if (catalog[dept] !== undefined) {
          catalog[dept].push(filename);
        }
      }
    }
  } catch {
    // Network error — return whatever we have (empty catalog)
  }

  return catalog;
}

/**
 * Lists .enc files in a department folder from the GitHub repo.
 * Works without authentication for public repos.
 * If a token is provided, it will be used (higher rate limits).
 */
export async function listEncFiles(
  repoOwner: string,
  repoName: string,
  dept: string,
  token?: string
): Promise<string[]> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${dept}`,
      { headers, cache: 'no-store' }
    );

    if (!res.ok) {
      // 404 means the folder doesn't exist yet — no exams for this dept
      if (res.status === 404) return [];
      return [];
    }

    const items: Array<{ name: string; type: string }> = await res.json();
    return items
      .filter(item => item.type === 'file' && item.name.endsWith('.enc'))
      .map(item => item.name);
  } catch {
    return [];
  }
}

