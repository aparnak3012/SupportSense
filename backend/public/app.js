// SupportSense Frontend Controller

let ticketsData = [];
let activeTicketId = null;
let topTagsChart = null;

// DOM Elements
const ticketsTbody = document.getElementById('tickets-tbody');
const ticketCountEl = document.getElementById('ticket-count');
const filterStatus = document.getElementById('filter-status');
const filterTag = document.getElementById('filter-tag');
const btnRefresh = document.getElementById('btn-refresh');
const btnReingest = document.getElementById('btn-reingest');
const btnMobileReingest = document.getElementById('btn-mobile-reingest');
const btnMobileMenu = document.getElementById('btn-mobile-menu');
const mobileNav = document.getElementById('mobile-nav');
const ticketForm = document.getElementById('ticket-form');
const toastEl = document.getElementById('toast');
const currentYearEl = document.getElementById('current-year');

// Modal Elements
const modalOverlay = document.getElementById('ticket-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalTicketId = document.getElementById('modal-ticket-id');
const modalCustomer = document.getElementById('modal-customer');
const modalText = document.getElementById('modal-text');
const modalTags = document.getElementById('modal-tags');
const modalUrgency = document.getElementById('modal-urgency');
const modalConfidenceVal = document.getElementById('modal-confidence-val');
const modalConfidenceBar = document.getElementById('modal-confidence-bar');
const modalSources = document.getElementById('modal-sources');
const modalAiAnswerSection = document.getElementById('modal-ai-answer-section');
const modalAiAnswer = document.getElementById('modal-ai-answer');
const modalSummarySection = document.getElementById('modal-summary-section');
const modalSummary = document.getElementById('modal-summary');
const modalReplySection = document.getElementById('modal-reply-section');
const modalExistingReply = document.getElementById('modal-existing-reply');
const resolveForm = document.getElementById('resolve-form');
const humanReplyInput = document.getElementById('human_reply_input');

// Report Elements
const btnGenReportHdr = document.getElementById('btn-gen-report-hdr');
const btnGenReport = document.getElementById('btn-generate-report');
const reportPeriod = document.getElementById('report-period');
const metricTotal = document.getElementById('metric-total');
const metricAuto = document.getElementById('metric-auto');
const metricEsc = document.getElementById('metric-esc');
const metricConf = document.getElementById('metric-conf');
const knowledgeGapsList = document.getElementById('knowledge-gaps-list');
const reportInsightText = document.getElementById('report-insight-text');

// Set dynamic copyright year
if (currentYearEl) {
  currentYearEl.textContent = new Date().getFullYear().toString();
}

// Show notification toast with clean styling
function showToast(message, isError = false, duration = 4000) {
  toastEl.textContent = message;
  toastEl.style.borderColor = isError ? '#ef4444' : '#10b981';
  toastEl.style.display = 'block';
  setTimeout(() => {
    toastEl.style.display = 'none';
  }, duration);
}

// Format ISO date
function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Check for unsaved response draft
function checkUnsavedChanges() {
  if (humanReplyInput && humanReplyInput.value.trim().length > 0) {
    return confirm('You have an unsaved reply drafted in this ticket. Discard and leave?');
  }
  return true;
}

// Mobile Menu Toggle
if (btnMobileMenu && mobileNav) {
  btnMobileMenu.addEventListener('click', () => {
    mobileNav.classList.toggle('open');
  });
}

// Tab Switching Helper
function switchTab(targetTabId) {
  if (!checkUnsavedChanges()) return;

  // Update desktop tabs
  document.querySelectorAll('.tab-btn').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-tab') === targetTabId);
  });

  // Update mobile nav links
  document.querySelectorAll('.mobile-nav-link').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('data-tab-target') === targetTabId);
  });

  // Switch content visibility
  document.querySelectorAll('.tab-content').forEach((tc) => {
    const isTarget = tc.id === targetTabId;
    tc.style.display = isTarget ? 'block' : 'none';
    tc.classList.toggle('active', isTarget);
  });

  if (mobileNav) {
    mobileNav.classList.remove('open');
  }

  if (targetTabId === 'reports-view') {
    loadWeeklyReport();
  }
}

// Tab buttons event listeners
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tabId = btn.getAttribute('data-tab');
    switchTab(tabId);
  });
});

document.querySelectorAll('.mobile-nav-link').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const tabId = link.getAttribute('data-tab-target');
    switchTab(tabId);
  });
});

if (btnGenReportHdr) {
  btnGenReportHdr.addEventListener('click', () => switchTab('reports-view'));
}

// Load Tickets
async function loadTickets() {
  const status = filterStatus.value;
  const tag = filterTag.value;
  let url = `/api/tickets?status=${encodeURIComponent(status)}&tag=${encodeURIComponent(tag)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    ticketsData = await res.json();
    renderTicketsTable(ticketsData);
  } catch (err) {
    console.error('Error fetching tickets:', err);
    ticketsTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #ef4444; padding: 24px;">Failed to load tickets: ${err.message}</td></tr>`;
  }
}

// Render Table Rows
function renderTicketsTable(tickets) {
  ticketCountEl.textContent = `${tickets.length} ticket${tickets.length === 1 ? '' : 's'} in queue`;

  if (tickets.length === 0) {
    ticketsTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 32px;">No tickets match the selected filters.</td></tr>`;
    return;
  }

  ticketsTbody.innerHTML = tickets.map((t) => {
    const statusClass = `badge-${t.status}`;
    const statusLabel = t.status.replace('_', ' ');
    const urgencyClass = `urgency-${t.urgency || 'low'}`;
    const tagsHtml = (t.tags || []).map((tag) => `<span class="tag-chip">${tag}</span>`).join('') || '<span style="color:var(--text-sub);">-</span>';
    const confVal = typeof t.confidence === 'number' ? Math.round(t.confidence * 100) : null;
    const confColor = confVal !== null ? (confVal >= 60 ? '#10b981' : '#f59e0b') : '#64748b';
    const confBarWidth = confVal !== null ? `${confVal}%` : '0%';

    return `
      <tr class="ticket-row" data-id="${t.id}">
        <td style="font-weight: 700; color: #93c5fd;">#${t.id}</td>
        <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <a href="mailto:${t.customer_email}" style="color: inherit; text-decoration: none;" onclick="event.stopPropagation();">${t.customer_email}</a>
        </td>
        <td style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.text}</td>
        <td>${tagsHtml}</td>
        <td>
          <span class="urgency-badge">
            <span class="urgency-dot ${urgencyClass}"></span>${t.urgency || 'low'}
          </span>
        </td>
        <td>
          <div style="font-weight: 600; color: ${confColor}; font-size: 12px;">${confVal !== null ? `${confVal}%` : '-'}</div>
          <div class="confidence-bar-bg"><div class="confidence-bar-fill" style="width: ${confBarWidth}; background: ${confColor};"></div></div>
        </td>
        <td><span class="badge ${statusClass}">${statusLabel}</span></td>
        <td style="color: var(--text-muted); font-size: 11px; white-space: nowrap;">${formatDate(t.created_at)}</td>
      </tr>
    `;
  }).join('');

  // Row Click Listener
  document.querySelectorAll('.ticket-row').forEach((row) => {
    row.addEventListener('click', () => {
      const id = parseInt(row.getAttribute('data-id'), 10);
      openTicketModal(id);
    });
  });
}

// Open Detail Modal
function openTicketModal(id) {
  const ticket = ticketsData.find((t) => t.id === id);
  if (!ticket) return;

  activeTicketId = ticket.id;
  modalTicketId.textContent = `Ticket #${ticket.id}`;
  modalCustomer.innerHTML = `<a href="mailto:${ticket.customer_email}" style="color: #60a5fa; text-decoration: underline;">${ticket.customer_email}</a> &bull; Submitted ${formatDate(ticket.created_at)}`;
  modalText.textContent = ticket.text;

  // Tags & Urgency
  const tagsHtml = (ticket.tags || []).map((t) => `<span class="tag-chip">${t}</span>`).join(' ') || 'None';
  modalTags.innerHTML = tagsHtml;
  modalUrgency.innerHTML = `
    <span class="urgency-badge">
      <span class="urgency-dot urgency-${ticket.urgency || 'low'}"></span>
      Urgency: ${(ticket.urgency || 'low').toUpperCase()}
    </span>
  `;

  // Confidence & Sources
  const confVal = typeof ticket.confidence === 'number' ? Math.round(ticket.confidence * 100) : null;
  const confColor = confVal !== null ? (confVal >= 60 ? '#10b981' : '#f59e0b') : '#64748b';
  modalConfidenceVal.textContent = confVal !== null ? `${confVal}% Confidence` : 'Not Scored';
  modalConfidenceVal.style.color = confColor;
  modalConfidenceBar.style.width = confVal !== null ? `${confVal}%` : '0%';
  modalConfidenceBar.style.background = confColor;

  const sourcesList = ticket.sources && ticket.sources.length > 0
    ? `Cited Sources: ${ticket.sources.join(', ')}`
    : 'No sources cited in answer';
  modalSources.textContent = sourcesList;

  // AI Answer Section
  if (ticket.ai_answer && ticket.ai_answer !== 'INSUFFICIENT_INFO') {
    modalAiAnswerSection.style.display = 'block';
    modalAiAnswer.textContent = ticket.ai_answer;
    modalAiAnswer.style.color = 'var(--text-main)';
  } else {
    modalAiAnswerSection.style.display = 'block';
    modalAiAnswer.textContent = 'INSUFFICIENT_INFO: Relevant company policy facts not found in indexed documentation. Ticket routed for human intervention.';
    modalAiAnswer.style.color = 'var(--status-escalated)';
  }

  // Escalation Summary
  if (ticket.summary) {
    modalSummarySection.style.display = 'block';
    modalSummary.textContent = ticket.summary;
  } else {
    modalSummarySection.style.display = 'none';
  }

  // Existing reply or form
  if (ticket.human_reply) {
    modalExistingReply.style.display = 'block';
    modalExistingReply.innerHTML = `<strong>Agent Response (${formatDate(ticket.resolved_at)}):</strong><br>${ticket.human_reply}`;
    resolveForm.style.display = 'none';
  } else {
    modalExistingReply.style.display = 'none';
    resolveForm.style.display = 'block';
    humanReplyInput.value = '';
  }

  modalOverlay.classList.add('open');
}

// Close Modal with Unsaved Draft Check
function closeModal() {
  if (!checkUnsavedChanges()) return;
  modalOverlay.classList.remove('open');
  activeTicketId = null;
  humanReplyInput.value = '';
}

modalCloseBtn.addEventListener('click', closeModal);

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    closeModal();
  }
});

// Human Agent Resolution Submission
resolveForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!activeTicketId) return;

  const reply = humanReplyInput.value.trim();
  if (!reply) return;

  const submitBtn = document.getElementById('btn-resolve-ticket');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving Response...';

  try {
    const res = await fetch(`/api/tickets/${activeTicketId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ human_reply: reply }),
    });

    if (!res.ok) throw new Error('Failed to resolve ticket');
    const updatedTicket = await res.json();

    showToast(`Ticket #${activeTicketId} successfully resolved and added to feedback records.`);
    humanReplyInput.value = '';
    modalOverlay.classList.remove('open');
    await loadTickets();
  } catch (err) {
    console.error('Error resolving ticket:', err);
    showToast('Failed to resolve ticket: ' + err.message, true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Reply & Resolve Ticket';
  }
});

// Submit New Ticket
ticketForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('customer_email').value.trim();
  const text = document.getElementById('ticket_text').value.trim();
  const submitBtn = document.getElementById('btn-submit-ticket');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Analyzing with Grounded AI...';

  try {
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_email: email, text }),
    });

    if (!res.ok) throw new Error('Failed to process ticket');
    const newTicket = await res.json();

    document.getElementById('ticket_text').value = '';
    showToast(`Ticket #${newTicket.id} processed: Classified as ${newTicket.status.replace('_', ' ')}.`);
    await loadTickets();
    openTicketModal(newTicket.id);
  } catch (err) {
    console.error('Error creating ticket:', err);
    showToast('Error submitting ticket: ' + err.message, true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Process Ticket';
  }
});

// Test Preset Buttons
document.querySelectorAll('.preset-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.getElementById('ticket_text').value = btn.getAttribute('data-query');
  });
});

// Knowledge Base Re-Ingestion Action
async function handleReingest(buttonEl) {
  buttonEl.disabled = true;
  const originalText = buttonEl.textContent;
  buttonEl.textContent = 'Syncing Knowledge Base...';

  try {
    const res = await fetch('/api/kb/reingest', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Re-ingestion failed');
    showToast(`Knowledge base synchronized: ${data.chunks_stored} chunks indexed across ${data.files_processed ? data.files_processed.length : 6} documents.`);
  } catch (err) {
    console.error('Re-ingest error:', err);
    showToast('Knowledge base sync failed: ' + err.message, true);
  } finally {
    buttonEl.disabled = false;
    buttonEl.textContent = originalText;
  }
}

if (btnReingest) {
  btnReingest.addEventListener('click', () => handleReingest(btnReingest));
}

if (btnMobileReingest) {
  btnMobileReingest.addEventListener('click', () => handleReingest(btnMobileReingest));
}

// Queue Filters
filterStatus.addEventListener('change', loadTickets);
filterTag.addEventListener('change', loadTickets);
btnRefresh.addEventListener('click', loadTickets);

// Weekly Analytics Report
async function loadWeeklyReport(forceGenerate = false) {
  const url = forceGenerate ? '/api/reports/generate' : '/api/reports/weekly';
  const method = forceGenerate ? 'POST' : 'GET';

  try {
    const res = await fetch(url, { method });
    if (!res.ok) throw new Error('Failed to fetch report');
    const report = await res.json();
    renderReport(report);
  } catch (err) {
    console.error('Error loading report:', err);
    reportInsightText.textContent = 'Failed to load report data: ' + err.message;
  }
}

if (btnGenReport) {
  btnGenReport.addEventListener('click', async () => {
    btnGenReport.disabled = true;
    btnGenReport.textContent = 'Generating Analytics...';
    try {
      await loadWeeklyReport(true);
      showToast('New weekly operational report generated successfully.');
    } catch (err) {
      showToast('Failed to generate report: ' + err.message, true);
    } finally {
      btnGenReport.disabled = false;
      btnGenReport.textContent = 'Generate Report Now';
    }
  });
}

function renderReport(report) {
  if (!report) return;

  reportPeriod.textContent = `Reporting Period: ${formatDate(report.week_start)} to ${formatDate(report.week_end)} (Report ID #${report.id || 1})`;

  metricTotal.textContent = report.total_tickets || 0;
  metricAuto.textContent = `${report.auto_resolved_pct || 0}%`;
  metricEsc.textContent = `${report.escalated_pct || 0}%`;
  metricConf.textContent = report.avg_confidence ? report.avg_confidence.toFixed(2) : '0.00';

  reportInsightText.textContent = report.insight || 'No analytical commentary available.';

  // Knowledge Gaps List
  const gaps = report.knowledge_gaps || [];
  if (gaps.length === 0) {
    knowledgeGapsList.innerHTML = `<p style="color: var(--text-muted); font-size: 13px;">No knowledge gaps identified in this reporting cycle.</p>`;
  } else {
    knowledgeGapsList.innerHTML = gaps.map((g) => `
      <div class="knowledge-gap-item">
        <div>
          <strong style="color: var(--status-escalated); text-transform: uppercase; font-size: 12px;">${g.tag}</strong>
          <span style="color: var(--text-muted); font-size: 11px; margin-left: 6px;">(${g.escalated_count} of ${g.total_tag_tickets} tickets escalated)</span>
        </div>
        <div style="font-weight: 700; color: #f87171;">
          ${g.escalation_rate_pct}% escalation rate
        </div>
      </div>
    `).join('');
  }

  // Render Chart.js
  const topTags = report.top_tags || [];
  const labels = topTags.map((t) => t.tag);
  const currentCounts = topTags.map((t) => t.count);
  const prevCounts = topTags.map((t) => t.prev_count);

  const canvas = document.getElementById('topTagsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (topTagsChart) {
    topTagsChart.destroy();
  }

  topTagsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length > 0 ? labels : ['No Data'],
      datasets: [
        {
          label: 'Current 7 Days',
          data: currentCounts.length > 0 ? currentCounts : [0],
          backgroundColor: '#0284c7',
          borderRadius: 4,
        },
        {
          label: 'Prior 7 Days',
          data: prevCounts.length > 0 ? prevCounts : [0],
          backgroundColor: '#38bdf8',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#0369a1', font: { size: 11, weight: '700' } },
        },
      },
      scales: {
        x: {
          ticks: { color: '#0369a1', font: { size: 11, weight: '600' } },
          grid: { color: '#e0f2fe' },
        },
        y: {
          ticks: { color: '#0369a1', stepSize: 1, font: { size: 11, weight: '600' } },
          grid: { color: '#e0f2fe' },
          beginAtZero: true,
        },
      },
    },
  });
}

// Initial Load
loadTickets();
