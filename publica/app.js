const demoPath = './data/demo-report.json';

const el = (id) => document.getElementById(id);
const statusEl = el('status');

const renderActions = (counts) => {
  const container = el('actions');
  container.innerHTML = '';
  Object.entries(counts).forEach(([key, value]) => {
    const chip = document.createElement('div');
    chip.className = 'action-chip';
    chip.textContent = `${key}: ${value}`;
    container.appendChild(chip);
  });
};

const renderList = (containerId, items, formatter) => {
  const container = el(containerId);
  container.innerHTML = '';
  if (!items || items.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'No data';
    container.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const li = document.createElement('li');
    li.innerHTML = formatter(item);
    container.appendChild(li);
  });
};

const renderHourly = (hourly) => {
  const container = el('hourly');
  container.innerHTML = '';
  const max = Math.max(1, ...hourly.map((h) => h.tx));
  hourly.forEach((h) => {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = `${Math.max(8, (h.tx / max) * 140)}px`;
    bar.title = `${h.hour}h: ${h.tx}`;
    const label = document.createElement('span');
    label.textContent = h.tx > 0 ? h.tx : '';
    bar.appendChild(label);
    container.appendChild(bar);
  });
};

const renderTxSamples = (samples) => {
  const container = el('txSamples');
  container.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'row header';
  header.innerHTML = '<div>Signature</div><div>Time</div><div>Action</div><div>Programs</div>';
  container.appendChild(header);

  if (!samples || samples.length === 0) {
    const row = document.createElement('div');
    row.className = 'row';
    row.textContent = 'No transactions';
    container.appendChild(row);
    return;
  }

  samples.forEach((s) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div class="mono">${s.signature}</div>
      <div>${s.time || '-'}</div>
      <div>${s.action}</div>
      <div>${(s.programs || []).join(', ')}</div>
    `;
    container.appendChild(row);
  });
};

const render = (report) => {
  el('wallet').textContent = report.metadata.address;
  el('window').textContent = `${report.metadata.days} days`;
  el('start').textContent = report.metadata.startTime || '-';
  el('end').textContent = report.metadata.endTime || '-';
  el('generated').textContent = report.metadata.generatedAt || '-';
  el('totalTx').textContent = report.summary.totalTx;
  el('totalFees').textContent = report.summary.totalFeesSol.toFixed(4);
  el('scanned').textContent = report.metadata.txScanned;

  renderActions(report.summary.actionCounts);

  renderList('topTokens', report.topTokens, (t) => {
    return `<span class="mono">${t.mint}</span><span>${t.transfers} tx</span>`;
  });

  renderList('topCounterparties', report.topCounterparties, (c) => {
    return `<span class="mono">${c.address}</span><span>${c.transfers} tx</span>`;
  });

  renderHourly(report.hourlyActivity || []);
  renderTxSamples(report.txSamples || []);
};

const setStatus = (msg) => {
  statusEl.textContent = msg;
};

const runReport = async () => {
  const address = el('addressInput').value.trim();
  const days = Number(el('daysInput').value || '30');
  const rpc = el('rpcInput').value.trim();
  if (!address) {
    alert('Enter a wallet address');
    return;
  }
  setStatus('Generating report... (may take a few seconds)');
  const params = new URLSearchParams({ address, days: String(days) });
  if (rpc) params.set('rpc', rpc);
  const res = await fetch(`/api/report?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    if (text.includes('429')) {
      throw new Error('RPC rate limited (429). Try again or provide a dedicated RPC URL.');
    }
    throw new Error(text || 'Failed to generate report');
  }
  const report = await res.json();
  render(report);
  setStatus('Report generated via local API.');
};

const loadDemo = async () => {
  const res = await fetch(demoPath);
  if (!res.ok) throw new Error('Failed to load demo');
  const report = await res.json();
  render(report);
  setStatus('Demo loaded.');
};

const loadFile = async (file) => {
  const text = await file.text();
  const report = JSON.parse(text);
  render(report);
};

el('reloadBtn').addEventListener('click', () => {
  loadDemo().catch((err) => alert(err.message));
});

el('fileInput').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  loadFile(file).catch((err) => alert(`Error: ${err.message}`));
});

el('runBtn').addEventListener('click', () => {
  runReport().catch((err) => {
    alert(err.message);
    setStatus('Failed to generate report.');
  });
});

setStatus('Ready. Load demo or run with your address.');
el('addressInput').value = '';
