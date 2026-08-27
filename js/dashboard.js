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

    let totalDispensed = 0, totalReturned = 0;
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
          <div style="height: 350px; width: 100%;"><canvas id="chart-overview-${code}" data-chart-code="${code}"></canvas></div>
        </div>
      </div>
    `;
    container.innerHTML += sectionHtml;
  });

  setTimeout(() => {
    drugsToRender.forEach(drug => drawMixedChart(drug['藥品代碼'], 'overview'));
  }, 100);
}

function drawMixedChart(code, prefix) {
  const canvasId = `chart-${prefix}-${code}`;
  const ctx = document.getElementById(canvasId);
  if(!ctx) return;

  if (State.chartInstances[canvasId]) { State.chartInstances[canvasId].destroy(); }

  const startStr = document.getElementById(`${prefix === 'overview' ? 'overview' : 'single-drug'}-date-start`).value.replace(/-/g, '/');
  const endStr = document.getElementById(`${prefix === 'overview' ? 'overview' : 'single-drug'}-date-end`).value.replace(/-/g, '/');
  
  let labels = [];
  let curr = new Date(startStr);
  const end = new Date(endStr);
  while(curr <= end && labels.length < 31) { 
      labels.push(formatAsDate(curr));
      curr.setDate(curr.getDate() + 1);
  }

  let dataApp = [], dataDisp = [], dataRet = [], dataActual = [], dataPat = [];
  
  labels.forEach(dateLabel => {
      let dApp = 0, dDisp = 0, dRet = 0;
      let patSet = new Set();

      State.applications.forEach(app => {
          // 👉 修正：使用 收單時間 作為圖表比對基準 (資料庫沒有申請日期這個表頭)
          if(String(app['藥品代碼']).toUpperCase() === code && app['作廢'] !== 'Y' && formatAsDate(app['收單時間']) === dateLabel) {
              dApp += parseInt(app['申請數量'] || 0);
              patSet.add(app['病歷號']);
          }
      });

      State.dispenseLogs.forEach(log => {
          // 👉 修正：統一使用 調劑時間 作為圖表比對基準
          if(String(log['藥品代碼']).toUpperCase() === code && log['作廢'] !== 'Y' && formatAsDate(log['調劑時間']) === dateLabel) {
              dDisp += parseInt(log['調劑數量'] || 0);
              dRet += parseInt(log['退藥數量'] || 0);
              patSet.add(log['病歷號']);
          }
      });

      dataApp.push(dApp);
      dataDisp.push(dDisp);
      dataRet.push(dRet);
      dataActual.push(dDisp - dRet); 
      dataPat.push(patSet.size); 
  });

  State.chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar', 
    data: {
      labels: labels,
      datasets: [
        { type: 'line', label: '每日人數 (人)', data: dataPat, borderColor: '#fd7e14', backgroundColor: '#fd7e14', borderWidth: 2, tension: 0.3, yAxisID: 'y1', order: 1 },
        { type: 'line', label: '實際用量 (支)', data: dataActual, borderColor: '#6f42c1', backgroundColor: '#6f42c1', borderWidth: 2, tension: 0.3, yAxisID: 'y', order: 1 },
        { type: 'bar', label: '申請量', data: dataApp, backgroundColor: 'rgba(13, 202, 240, 0.7)', yAxisID: 'y', order: 2 },
        { type: 'bar', label: '調劑量', data: dataDisp, backgroundColor: 'rgba(25, 135, 84, 0.7)', yAxisID: 'y', order: 2 },
        { type: 'bar', label: '退藥量', data: dataRet, backgroundColor: 'rgba(220, 53, 69, 0.7)', yAxisID: 'y', order: 2 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        y: { type: 'linear', position: 'left', title: { display: true, text: '數量 (支)' } },
        y1: { type: 'linear', position: 'right', title: { display: true, text: '人數' }, grid: { drawOnChartArea: false }, ticks: { stepSize: 1, precision: 0 } }
      }
    }
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
       let newHtml = cardContent.innerHTML.replace(`id="chart-overview-${code}"`, `id="chart-single-${code}"`);
       statsContainer.innerHTML = newHtml;
       drawMixedChart(code, 'single');
    }
    document.getElementById("overview-drug-filter").value = "ALL";
  }, 150);

  const tableContainer = document.getElementById("single-drug-records-table");
  if(!tableContainer) return;
  
  let records = [];
  if(recordType === 'ALL' || recordType === 'APP') {
    State.applications.forEach(app => {
      if(String(app['藥品代碼']).toUpperCase() === code && app['作廢'] !== 'Y') {
        const appPid = String(app['病歷號']).toUpperCase();
        if(pidFilter && !appPid.includes(pidFilter)) return;
        // 👉 修正：使用 收單時間 篩選
        const dt = formatAsDate(app['收單時間']);
        if(startDate && dt < startDate) return;
        if(endDate && dt > endDate) return;
        records.push({ type: 'APP', date: dt, time: formatAsTime(app['收單時間']) || '00:00:00', data: app });
      }
    });
  }
  
  if(recordType === 'ALL' || recordType === 'DIS') {
    State.dispenseLogs.forEach(log => {
      if(String(log['藥品代碼']).toUpperCase() === code && log['作廢'] !== 'Y') {
        const logPid = String(log['病歷號']).toUpperCase();
        if(pidFilter && !logPid.includes(pidFilter)) return;
        // 👉 修正：使用 調劑時間 篩選
        const dt = formatAsDate(log['調劑時間']);
        if(startDate && dt < startDate) return;
        if(endDate && dt > endDate) return;
        records.push({ type: 'DIS', date: dt, time: formatAsTime(log['調劑時間']) || '00:00:00', data: log });
      }
    });
  }
  
  records.sort((a, b) => new Date(b.date + ' ' + b.time) - new Date(a.date + ' ' + a.time));
  
  let html = `<table class="table table-hover align-middle text-center mb-0"><thead class="table-light small"><tr><th>時間</th><th>病歷號</th><th>動作</th><th>數量</th><th>單號 / 領藥號</th><th>操作單位/人員</th></tr></thead><tbody>`;
  records.forEach(r => {
    const pid = String(r.data['病歷號']).toUpperCase();
    const user = r.data['藥師姓名'] || '-';
    const unit = r.data['處理單位'] || '-';
    if(r.type === 'APP') {
        html += `<tr>
            <td>${r.date} ${r.time}</td>
            <td class="fw-bold text-primary">${pid}</td>
            <td><span class="badge bg-info text-dark">${r.data['申請類別']}</span></td>
            <td class="fw-bold text-primary">+${r.data['申請數量']}</td>
            <td class="small font-monospace">${r.data['依據單號'] || r.data['申請單號'] || '-'}</td>
            <td class="small text-muted">${unit} / ${user}</td>
        </tr>`;
    } else {
        const isDisp = parseInt(r.data['調劑數量']) > 0 || (r.data['數量'] < 0);
        const actionStr = isDisp ? '<span class="badge bg-success">調劑</span>' : '<span class="badge bg-danger">退藥</span>';
        const qty = isDisp ? (r.data['調劑數量'] || Math.abs(r.data['數量'])) : (r.data['退藥數量'] || Math.abs(r.data['數量']));
        const qtyClass = isDisp ? 'text-success' : 'text-danger';
        const sign = isDisp ? '-' : '+';
        let noHtml = r.data['領藥號'] || '-';
        if (!isDisp && r.data['退藥號']) noHtml += ` <br><span class="text-danger small">退: ${r.data['退藥號']}</span>`;

        html += `<tr>
            <td>${r.date} ${r.time}</td>
            <td class="fw-bold text-primary">${pid}</td>
            <td>${actionStr}</td>
            <td class="fw-bold ${qtyClass}">${sign}${qty}</td>
            <td class="small font-monospace">${noHtml}</td>
            <td class="small text-muted">${unit} / ${user}</td>
        </tr>`;
    }
  });
  html += `</tbody></table>`;
  if(records.length === 0) html = '<div class="text-center text-muted py-4">區間內無作業紀錄</div>';
  tableContainer.innerHTML = html;
}
