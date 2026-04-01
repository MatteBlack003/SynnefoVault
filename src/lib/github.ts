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
  } catch (err) {}

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
    const errData = await deleteRes.json();
    throw new Error(errData.message || 'Failed to physically delete exam file.');
  }

  return deleteRes.json();
}
