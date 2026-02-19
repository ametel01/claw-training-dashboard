async function loadData() {
  const res = await fetch('./data.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load data.json');
  return res.json();
}

function statCard(label, value) {
  return `<article class="stat-card"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></article>`;
}

function yesNoChip(label, done, detail = '') {
  const cls = done ? 'chip done' : 'chip';
  return `<span class="${cls}"><i class="dot"></i>${label}${detail ? ` · ${detail}` : ''}</span>`;
}

function renderTotals(totals) {
  const node = document.getElementById('totals');
  node.innerHTML = [
    statCard('Barbell Sessions', totals.barbell_sessions ?? 0),
    statCard('Cardio Sessions', totals.cardio_sessions ?? 0),
    statCard('Rings Sessions', totals.rings_sessions ?? 0),
    statCard('Total Training Days', totals.total_training_days ?? 0),
    statCard('Active Days (14d)', totals.active_days_last_14 ?? 0)
  ].join('');
}

function renderWeekProgress(rows) {
  const node = document.getElementById('weekRows');
  node.innerHTML = rows.map((r) => `
    <article class="week-row">
      <div>
        <div class="week-day">${r.day_name}</div>
        <div class="muted">${r.session_date}</div>
      </div>
      <div>${yesNoChip('Barbell', r.barbell_done, r.main_lift)}</div>
      <div>${yesNoChip('Cardio', r.cardio_done, r.cardio_plan || 'OFF')}</div>
      <div>${yesNoChip('Rings', r.rings_done, r.rings_plan || '-')}</div>
    </article>
  `).join('');
}

function renderDailyTiles(days) {
  const node = document.getElementById('dailyTiles');
  node.innerHTML = days.map((d) => {
    const badges = [
      `<span class="badge ${d.has_cardio ? 'ok' : ''}">Cardio${d.cardio_protocol ? `: ${d.cardio_protocol}` : ''}</span>`,
      `<span class="badge ${d.has_barbell ? 'ok' : ''}">Barbell${d.barbell_lift ? `: ${d.barbell_lift}` : ''}</span>`,
      `<span class="badge ${d.has_rings ? 'ok' : ''}">Rings${d.rings_template ? `: ${d.rings_template}` : ''}</span>`
    ].join('');

    const title = d.has_barbell || d.has_cardio || d.has_rings ? 'Trained' : 'Recovery';
    return `
      <article class="tile">
        <div class="tile-date">${d.session_date}</div>
        <div class="tile-main">${title}</div>
        <div class="tile-flags">${badges}</div>
      </article>
    `;
  }).join('');
}

(async function init() {
  try {
    const data = await loadData();
    renderTotals(data.totals || {});
    renderWeekProgress(data.weekProgress || []);
    renderDailyTiles(data.dailyTiles || []);
    document.getElementById('generatedAt').textContent = `Data generated: ${new Date(data.generatedAt).toLocaleString()}`;
  } catch (err) {
    document.body.innerHTML = `<main class="app"><p>Failed to load dashboard data. Run export script first.</p><pre>${err}</pre></main>`;
  }
})();
