const GIST_FILE = 'nm_todo_data.json';

async function gistLoad(token, gistId) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
  });
  if (!res.ok) throw new Error(`Gist load failed: ${res.status}`);
  const gist = await res.json();
  const file = gist.files[GIST_FILE];
  if (!file) return null;
  return JSON.parse(file.content);
}

async function gistSave(token, gistId, data) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
    body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(data, null, 2) } } })
  });
  if (!res.ok) throw new Error(`Gist save failed: ${res.status}`);
}
