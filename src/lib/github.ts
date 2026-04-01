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

  // Convert string to base64 properly (Unicode safe)
  const encodedContent = btoa(unescape(encodeURIComponent(content)));

  // 1. Check if file already exists to get its SHA (required for modifying existing files)
  let sha: string | undefined = undefined;
  
  try {
    const res = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (res.ok) {
      const data = await res.json();
      sha = data.sha;
    }
  } catch (err) {
    // Expected to fail if file does not exist
  }

  // 2. Upload/Update the file
  const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message,
      content: encodedContent,
      sha
    })
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.message || 'Failed to upload to GitHub');
  }

  return response.json();
}
