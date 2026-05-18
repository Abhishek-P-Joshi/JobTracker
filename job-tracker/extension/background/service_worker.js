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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${res.status}`);
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

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}
