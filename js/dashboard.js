// js/dashboard.js

function renderOverview() {
  const filterCode = document.getElementById("overview-drug-filter").value;
  const container = document.getElementById("overview-content");
  if(!container) return;
  container.innerHTML = ""; 
  
  let drugsToRender = State.activeDrugs;
  if (filterCode !== "ALL") {
    drugsToRender = State.activeDrugs.filter(d => d['藥品代碼'] === filterCode);
  }

  drugsToRender.forEach(drug => {
    const code = drug['藥品代碼'];
    
    let totalPatients = new Set();
    let totalAppQty = 0;
    State.applications.forEach(app => {
      if(String(app['藥品代碼']).toUpperCase() === code && app['作廢'] !== 'Y') {
        totalPatients.add(app['病歷號']);
        totalAppQty += parseInt(app['申請數量'] || 0);
      }
    });

    let totalDispensed = 0;
    let totalReturned = 0;
    State.dispenseLogs.forEach(log => {
      if(String(log['藥品代碼']).toUpperCase() === code && log['作廢'] !== 'Y') {
        totalDispensed += parseInt(log['調劑數量'] || 0);
        totalReturned += parseInt(log['退藥數量'] || 0);
      }
    });

    const sectionHtml = `
      <div class="card shadow-sm border-0 mb-4" id="overview-card-${code}">
        <div class="card-header bg-white border-bottom border-primary border-3 py-3">
          <h5 class="mb-0 fw-bold text-primary"><i class="bi bi-box-seam me-2"></i>${drug['藥品名稱']} (${code})</h5>
        </div>
        <div class="card-body">
          <div class="row text-center mb-4">
            <div class="col-md-3 border-end">
              <div class="text-muted small">申請人數</div><h3 class="text-dark mt-1">${totalPatients.size} 人</h3>
            </div>
            <div class="col-md-3 border-end">
              <div class="text-muted small">累計申請</div><h3 class="text-info mt-1">${totalAppQty} 支</h3>
            </div>
            <div class="col-md-3 border-end">
              <div class="text-muted small">調劑發出</div><h3 class="text-success mt-1">${totalDispensed} 支</h3>
            </div>
            <div class="col-md-3">
              <div class="text-muted small">退回數量</div><h3 class="text-danger mt-1">${totalReturned} 支</h3>
            </div>
          </div>
          <div style="height: 250px; width: 100%;"><canvas id="chart-${code}"></canvas></div>
        </div>
      </div>
    `;
    container.innerHTML += sectionHtml;
  });

  setTimeout(() => {
    drugsToRender.forEach(drug => drawChart(drug['藥品代碼']));
  }, 100);
}

function drawChart(code) {
  const ctx = document.getElementById(`chart-${code}`);
  if(!ctx) return;
  if (State.chartInstances[code]) { State.chartInstances[code].destroy(); }
  State.chartInstances[code] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['08/19', '08/20', '08/21', '08/22', '08/23', '08/24'],
      datasets: [
        { label: '申請量', data: [5, 2, 8, 4, 1, 6], borderColor: '#0dcaf0', tension: 0.3 },
        { label: '調劑量', data: [4, 3, 7, 3, 2, 5], borderColor: '#198754', tension: 0.3 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }
  });
}

function openDrugDashboard(code, name, element) {
  State.currentSelectedDrugCode = code;
  switchView('drug-dashboard', element);
  document.getElementById("current-drug-title").innerText = `${name} (${code})`;
  refreshSingleDrugDashboard();
}

function refreshSingleDrugDashboard() {
  const code = State.currentSelectedDrugCode;
  if(!code) return;
  
  const pidFilter = document.getElementById("single-drug-pid-filter").value.trim().toUpperCase();
  const startDate = document.getElementById("single-drug-date-start").value.replace(/-/g, '/');
  const endDate = document.getElementById("single-drug-date-end").value.replace(/-/g, '/');
  const recordType = document.getElementById("single-drug-record-type").value;
  
  const statsContainer = document.getElementById("drug-dashboard-stats");
  document.getElementById("overview-drug-filter").value = code;
  renderOverview(); 
  
  setTimeout(() => {
    const cardContent = document.getElementById(`overview-card-${code}`);
    if(cardContent && statsContainer) {
       statsContainer.innerHTML = cardContent.innerHTML;
       drawChart(code);
    }
    document.getElementById("overview-drug-filter").value = "ALL";
  }, 150);

  // 👉 綜合渲染歷史清單
  const tableContainer = document.getElementById("single-drug-records-table");
  if(!tableContainer) return;
  
  let records = [];
  
  if(recordType === 'ALL' || recordType === 'APP') {
    State.applications.forEach(app => {
      if(String(app['藥品代碼']).toUpperCase() === code && app['作廢'] !== 'Y') {
        const appPid = String(app['病歷號']).toUpperCase();
        if(pidFilter && !appPid.includes(pidFilter)) return;
        const dt = formatAsDate(app['申請日期']);
        if(startDate && dt < startDate) return;
        if(endDate && dt > endDate) return;
        records.push({ type: 'APP', date: dt, time: app['收單時間'] || '00:00:00', data: app });
      }
    });
  }
  
  if(recordType === 'ALL' || recordType === 'DIS') {
    State.dispenseLogs.forEach(log => {
      if(String(log['藥品代碼']).toUpperCase() === code && log['作廢'] !== 'Y') {
        const logPid = String(log['病歷號']).toUpperCase();
        if(pidFilter && !logPid.includes(pidFilter)) return;
        const dt = formatAsDate(log['調劑日期']);
        if(startDate && dt < startDate) return;
        if(endDate && dt > endDate) return;
        records.push({ type: 'DIS', date: dt, time: log['調劑時間'] || '00:00:00', data: log });
      }
    });
  }
  
  records.sort((a, b) => {
    return new Date(b.date + ' ' + b.time) - new Date(a.date + ' ' + a.time);
  });
  
  let html = `<table class="table table-hover align-middle text-center mb-0"><thead class="table-light small"><tr><th>時間</th><th>病歷號</th><th>動作</th><th>數量</th><th>操作單位/人員</th></tr></thead><tbody>`;
  records.forEach(r => {
    const pid = String(r.data['病歷號']).toUpperCase();
    const user = r.data['藥師姓名'] || '-';
    const unit = r.data['處理單位'] || '-';
    if(r.type === 'APP') {
        html += `<tr><td>${r.date} ${r.time}</td><td class="fw-bold text-primary">${pid}</td><td><span class="badge bg-info text-dark">${r.data['申請類別']}</span></td><td class="fw-bold">+${r.data['申請數量']}</td><td class="small text-muted">${unit} / ${user}</td></tr>`;
    } else {
        const isDisp = parseInt(r.data['調劑數量']) > 0;
        const actionStr = isDisp ? '<span class="badge bg-success">調劑</span>' : '<span class="badge bg-danger">退藥</span>';
        const qty = isDisp ? r.data['調劑數量'] : r.data['退藥數量'];
        const qtyClass = isDisp ? 'text-success' : 'text-danger';
        const sign = isDisp ? '-' : '+';
        html += `<tr><td>${r.date} ${r.time}</td><td class="fw-bold text-primary">${pid}</td><td>${actionStr}</td><td class="fw-bold ${qtyClass}">${sign}${qty}</td><td class="small text-muted">${unit} / ${user}</td></tr>`;
    }
  });
  html += `</tbody></table>`;
  if(records.length === 0) html = '<div class="text-center text-muted py-4">區間內無作業紀錄</div>';
  
  tableContainer.innerHTML = html;
}
