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
    <article class="week-row" role="button" tabindex="0" data-date="${r.session_date}">
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
  const today = new Date().toISOString().slice(0, 10);

  const badgeFor = ({ label, planned, done, detail, isPast }) => {
    const text = `${label}${detail ? `: ${detail}` : ''}`;
    let cls = 'badge idle';
    if (planned && done) cls = 'badge done';
    else if (planned && !done && isPast) cls = 'badge missed';
    else if (planned) cls = 'badge planned';
    return `<span class="${cls}">${text}</span>`;
  };

  node.innerHTML = days.map((d) => {
    const isPast = d.session_date < today;

    const plannedBarbell = !!d.planned_barbell_main;
    const plannedCardio = !!d.planned_cardio && d.planned_cardio !== 'OFF';
    const plannedRings = !!d.planned_rings;

    const barbellDetail = plannedBarbell
      ? `${d.planned_barbell_main}${d.planned_barbell_supp ? ` + ${d.planned_barbell_supp} ${d.planned_supp_sets || ''}x${d.planned_supp_reps || ''}` : ''}`.trim()
      : d.barbell_lift;

    const cardioDetail = d.planned_cardio || d.cardio_protocol;
    const ringsDetail = d.planned_rings || d.rings_template;

    const badges = [
      badgeFor({ label: 'Barbell', planned: plannedBarbell, done: !!d.has_barbell, detail: barbellDetail, isPast }),
      badgeFor({ label: 'Cardio', planned: plannedCardio, done: !!d.has_cardio, detail: cardioDetail, isPast }),
      badgeFor({ label: 'Rings', planned: plannedRings, done: !!d.has_rings, detail: ringsDetail, isPast })
    ].join('');

    const completionCount = [d.has_barbell, d.has_cardio, d.has_rings].filter(Boolean).length;
    const title = completionCount ? `Completed: ${completionCount}/3` : (isPast ? 'No logs' : 'Planned');

    return `
      <article class="tile" role="button" tabindex="0" data-date="${d.session_date}">
        <div class="tile-date">${d.session_date}</div>
        <div class="tile-main">${title}</div>
        <div class="tile-flags">${badges}</div>
      </article>
    `;
  }).join('');
}

function section(title, content) {
  return `<section class="detail-section"><h4>${title}</h4>${content}</section>`;
}

function renderBarbellDetails(rows = [], planned = {}) {
  if (!rows.length) {
    if (planned?.planned_barbell_main) {
      const supp = planned?.planned_barbell_supp
        ? ` + ${planned.planned_barbell_supp} ${planned.planned_supp_sets || ''}x${planned.planned_supp_reps || ''}`
        : '';
      return `<p class="muted">No barbell session logged.</p><p><strong>Planned:</strong> ${planned.planned_barbell_main}${supp}</p>`;
    }
    return '<p class="muted">No barbell session logged.</p>';
  }

  const mainRows = rows.filter((r) => r.category === 'main');
  const suppRows = rows.filter((r) => r.category === 'supplemental');

  const mainList = mainRows.map((r) => {
    const note = r.note ? `<div class="detail-note">${r.note}</div>` : '';
    return `<li><strong>${r.lift}</strong> · main set ${r.set_no}: ${r.actual_weight_kg ?? '-'} × ${r.actual_reps ?? '-'}${note}</li>`;
  }).join('');

  let supplementalHtml = '<p class="muted">No supplemental work logged.</p>';
  if (suppRows.length) {
    const byLift = new Map();
    for (const r of suppRows) {
      const key = r.lift || 'Supplemental';
      if (!byLift.has(key)) byLift.set(key, []);
      byLift.get(key).push(r);
    }

    const items = [];
    for (const [lift, arr] of byLift.entries()) {
      const setCount = arr.length;
      const repsSet = [...new Set(arr.map((x) => x.actual_reps).filter((v) => v != null))];
      const weightSet = [...new Set(arr.map((x) => x.actual_weight_kg).filter((v) => v != null))];
      const noteSet = [...new Set(arr.map((x) => x.note).filter(Boolean))];

      const repsText = repsSet.length === 1 ? repsSet[0] : arr.map((x) => x.actual_reps ?? '-').join('/');
      const weightText = weightSet.length === 1 ? ` @ ${weightSet[0]} kg` : '';
      const noteText = noteSet.length ? `<div class="detail-note">${noteSet.join(' · ')}</div>` : '';

      items.push(`<li><strong>${lift}</strong> · supplemental: ${setCount}×${repsText}${weightText}${noteText}</li>`);
    }

    supplementalHtml = `<ul class="detail-list">${items.join('')}</ul>`;
  }

  return `
    ${mainList ? `<h5 class="detail-subtitle">Main</h5><ul class="detail-list">${mainList}</ul>` : '<p class="muted">No main work logged.</p>'}
    <h5 class="detail-subtitle">Supplemental (compressed)</h5>
    ${supplementalHtml}
  `;
}

function renderCardioDetails(rows = [], planned = {}) {
  if (!rows.length) {
    if (planned?.planned_cardio && planned.planned_cardio !== 'OFF') {
      return `<p class="muted">No cardio session logged.</p><p><strong>Planned:</strong> ${planned.planned_cardio}</p>`;
    }
    return '<p class="muted">No cardio session logged.</p>';
  }
  const head = rows[0];
  const intervals = rows.filter((r) => r.interval_no != null);
  const intervalList = intervals.length
    ? `<ul class="detail-list">${intervals.map((r) => `<li>Interval ${r.interval_no}: ${r.work_min}m hard / ${r.easy_min}m easy @ ${r.target_speed_kmh ?? '-'} km/h${r.achieved_hr ? ` · HR ${r.achieved_hr}` : ''}</li>`).join('')}</ul>`
    : '<p class="muted">No interval breakdown stored.</p>';

  return `
    <p><strong>${head.protocol}</strong> · ${head.duration_min ?? '-'} min${head.max_hr ? ` · max HR ${head.max_hr}` : ''}</p>
    ${head.notes ? `<p class="detail-note">${head.notes}</p>` : ''}
    ${intervalList}
  `;
}

function renderRingsDetails(rows = [], planned = {}) {
  if (!rows.length) {
    if (planned?.planned_rings) {
      return `<p class="muted">No rings session logged.</p><p><strong>Planned:</strong> Template ${planned.planned_rings}</p>`;
    }
    return '<p class="muted">No rings session logged.</p>';
  }
  const tpl = rows[0].template || '-';
  const list = rows.filter((r) => r.item_no != null).map((r) => `<li>${r.item_no}. ${r.exercise}${r.result_text ? ` · ${r.result_text}` : ''}</li>`).join('');
  return `
    <p><strong>Template ${tpl}</strong></p>
    ${list ? `<ul class="detail-list">${list}</ul>` : '<p class="muted">No exercise logs stored.</p>'}
  `;
}

function bindDetailClicks(details, dailyTiles = []) {
  const modal = document.getElementById('detailModal');
  const title = document.getElementById('detailTitle');
  const body = document.getElementById('detailBody');
  const closeBtn = document.getElementById('detailClose');

  function close() {
    modal.classList.remove('open');
  }

  const planByDate = Object.fromEntries((dailyTiles || []).map((d) => [d.session_date, d]));

  function openForDate(date) {
    title.textContent = `Training details · ${date}`;

    const barbell = details?.barbellByDate?.[date] || [];
    const cardio = details?.cardioByDate?.[date] || [];
    const rings = details?.ringsByDate?.[date] || [];
    const planned = planByDate?.[date] || {};

    body.innerHTML = [
      section('Barbell', renderBarbellDetails(barbell, planned)),
      section('Cardio', renderCardioDetails(cardio, planned)),
      section('Rings', renderRingsDetails(rings, planned))
    ].join('');

    modal.classList.add('open');
  }

  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  document.querySelectorAll('.tile, .week-row').forEach((el) => {
    const open = () => openForDate(el.dataset.date);
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });
}

(async function init() {
  try {
    const data = await loadData();
    renderTotals(data.totals || {});
    renderWeekProgress(data.weekProgress || []);
    renderDailyTiles(data.dailyTiles || []);
    bindDetailClicks(data.details || {}, data.dailyTiles || []);
    document.getElementById('generatedAt').textContent = `Data generated: ${new Date(data.generatedAt).toLocaleString()}`;
  } catch (err) {
    document.body.innerHTML = `<main class="app"><p>Failed to load dashboard data. Run export script first.</p><pre>${err}</pre></main>`;
  }
})();
