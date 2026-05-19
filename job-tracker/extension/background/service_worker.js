const BACKEND = 'http://localhost:8000';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message }));
  return true; // keep message channel open for async response
});

async function handleMessage(message) {
  switch (message.type) {
    case 'GET_PROFILES': {
      const res = await fetch(`${BACKEND}/profiles`);
      if (!res.ok) throw new Error(`Backend returned HTTP ${res.status}`);
      return res.json();
    }

    case 'SAVE_JOB': {
      const res = await fetch(`${BACKEND}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message.data),
      });
      if (res.status === 409) {
        const body = await res.json(); // let parse failure propagate as a real error
        return { duplicate: true, existing: body.detail };
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = body.detail;
        throw new Error(typeof detail === 'string' ? detail : `HTTP ${res.status}`);
      }
      return res.json();
    }

    case 'MOVE_JOBS': {
      const res = await fetch(`${BACKEND}/jobs/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message.data),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }

    case 'GET_RESUMES': {
      const res = await fetch(`${BACKEND}/resumes`);
      if (!res.ok) throw new Error(`Backend returned HTTP ${res.status}`);
      return res.json();
    }

    case 'ANALYZE_JOB': {
      const res = await fetch(`${BACKEND}/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message.data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.detail === 'string' ? json.detail : `HTTP ${res.status}`);
      return json;
    }

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}
