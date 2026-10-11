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
      // 👉 雙重作廢檢查
      if(String(app['藥品代碼']).toUpperCase() === code && app['作廢'] !== 'Y' && app['異動'] !== '作廢') {
        totalPatients.add(app['病歷號']);
        totalAppQty += parseInt(app['申請數量'] || 0);
      }
    });

    let totalDispensed = 0, totalReturned = 0;
    State.dispenseLogs.forEach(log => {
      // 👉 雙重作廢檢查
      if(String(log['藥品代碼']).toUpperCase() === code && log['作廢'] !== 'Y' && log['異動'] !== '作廢') {
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
          <div style="height: 200px; width: 100%; margin-bottom: 20px;"><canvas id="chart-overview-line-${code}" data-chart-code="${code}"></canvas></div>
          <div style="height: 300px; width: 100%;"><canvas id="chart-overview-${code}" data-chart-code="${code}"></canvas></div>
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
  const canvasLineId = `chart-${prefix}-line-${code}`; // 👉 新增的人數圖表 ID
  
  const ctx = document.getElementById(canvasId);
  const ctxLine = document.getElementById(canvasLineId); 
  if(!ctx) return;

  // 清除舊圖表
  if (State.chartInstances[canvasId]) { State.chartInstances[canvasId].destroy(); }
  if (State.chartInstances[canvasLineId]) { State.chartInstances[canvasLineId].destroy(); }

  const startStr = document.getElementById(`${prefix === 'overview' ? 'overview' : 'single-drug'}-date-start`).value.replace(/-/g, '/');
  const endStr = document.getElementById(`${prefix === 'overview' ? 'overview' : 'single-drug'}-date-end`).value.replace(/-/g, '/');
  
  let labels = [];
  let curr = new Date(startStr);
  const end = new Date(endStr);
  while(curr <= end) { 
      labels.push(formatAsDate(curr));
      curr.setDate(curr.getDate() + 1);
  }

  let dataApp = [], dataDisp = [], dataRet = [], dataActual = [], dataPat = [];
  
  labels.forEach(dateLabel => {
      let dApp = 0, dDisp = 0, dRet = 0;
      let patSet = new Set();

      State.applications.forEach(app => {
          if(String(app['藥品代碼']).toUpperCase() === code && app['作廢'] !== 'Y' && app['異動'] !== '作廢' && formatAsDate(app['收單時間']) === dateLabel) {
              dApp += parseInt(app['申請數量'] || 0);
              patSet.add(app['病歷號']);
          }
      });

      State.dispenseLogs.forEach(log => {
          if(String(log['藥品代碼']).toUpperCase() === code && log['作廢'] !== 'Y' && log['異動'] !== '作廢' && formatAsDate(log['調劑時間']) === dateLabel) {
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

  // 👉 第一張圖：畫人數折線圖
  if (ctxLine) {
      State.chartInstances[canvasLineId] = new Chart(ctxLine, {
        type: 'line', 
        data: {
          labels: labels,
          datasets: [
            { type: 'line', label: '每日人數 (人)', data: dataPat, borderColor: '#fd7e14', backgroundColor: 'rgba(253, 126, 20, 0.2)', borderWidth: 2, tension: 0.3, fill: true }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
          scales: {
            y: { type: 'linear', position: 'left', title: { display: true, text: '人數' }, beginAtZero: true, ticks: { stepSize: 1, precision: 0 } }
          }
        }
      });
  }

  // 👉 第二張圖：畫數量直條圖
  State.chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar', 
    data: {
      labels: labels,
      datasets: [
        { type: 'line', label: '實際用量 (支)', data: dataActual, borderColor: '#6f42c1', backgroundColor: '#6f42c1', borderWidth: 2, tension: 0.3, order: 1 },
        { type: 'bar', label: '申請量', data: dataApp, backgroundColor: 'rgba(13, 202, 240, 0.7)', order: 2 },
        { type: 'bar', label: '調劑量', data: dataDisp, backgroundColor: 'rgba(25, 135, 84, 0.7)', order: 2 },
        { type: 'bar', label: '退藥量', data: dataRet, backgroundColor: 'rgba(220, 53, 69, 0.7)', order: 2 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        y: { type: 'linear', position: 'left', title: { display: true, text: '數量 (支)' }, beginAtZero: true }
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
  
  // 👉 1. 計算區間內所有申請單的「剩餘用量」
  let trackingList = [];
  State.applications.forEach(app => {
      if (String(app['藥品代碼']).toUpperCase() === code && app['作廢'] !== 'Y' && app['異動'] !== '作廢') {
          const actDateStr = formatAsDate(app['啟用日期']) || formatAsDate(app['收單時間']);
          
          // 若有設定日期區間，則只追蹤區間內的申請單
          if (startDate && actDateStr < startDate) return;
          if (endDate && actDateStr > endDate) return;

          const basisId = app['申請單號'] || app['收單時間'];
          let usedQty = 0;

          // 計算此張申請單已被調劑扣除的數量
          State.dispenseLogs.forEach(log => {
              if (String(log['藥品代碼']).toUpperCase() === code && log['作廢'] !== 'Y' && log['異動'] !== '作廢' && log['申請單號'] === basisId) {
                  usedQty += parseInt(log['調劑數量'] || 0);
                  usedQty -= parseInt(log['退藥數量'] || 0);
              }
          });

          const maxQty = parseInt(app['申請數量'] || 0);
          const rem = maxQty - usedQty;

          // 若還有剩，就加入追蹤清單
          if (rem > 0) {
              trackingList.push({
                  pid: String(app['病歷號']).toUpperCase(),
                  actDate: actDateStr,
                  maxQty: maxQty,
                  remQty: rem,
                  basisId: basisId
              });
          }
      }
  });

  // 👉 2. 組合追蹤卡片的 HTML
  let trackingHtml = `
    <div class="card shadow-sm border-warning mb-4">
      <div class="card-header bg-warning bg-opacity-25 border-warning fw-bold text-dark d-flex justify-content-between align-items-center">
        <span><i class="bi bi-person-lines-fill"></i> 剩餘額度追蹤清單 (依上方日期區間)</span>
        <span class="badge bg-danger fs-6 shadow-sm">共 ${trackingList.length} 筆未領完</span>
      </div>
      <div class="card-body p-0" style="max-height: 250px; overflow-y: auto;">
        <table class="table table-hover align-middle text-center mb-0">
          <thead class="table-light small" style="position: sticky; top: 0; z-index: 1;">
            <tr><th>病歷號</th><th>初次申請(啟用)日</th><th>申請數量</th><th>剩餘數量</th><th>申請單號</th></tr>
          </thead>
          <tbody>
  `;

  if (trackingList.length > 0) {
      // 依日期排序 (舊到新)
      trackingList.sort((a,b) => new Date(a.actDate) - new Date(b.actDate));
      trackingList.forEach(t => {
          trackingHtml += `
            <tr>
              <td class="fw-bold text-primary">${t.pid}</td>
              <td>${t.actDate}</td>
              <td>${t.maxQty} 支</td>
              <td class="fw-bold text-danger">${t.remQty} 支</td>
              <td class="small font-monospace text-muted">${t.basisId.substring(0, 12)}</td>
            </tr>
          `;
      });
  } else {
      trackingHtml += `<tr><td colspan="5" class="text-muted py-3">此區間內無尚未領完的申請紀錄</td></tr>`;
  }
  trackingHtml += `</tbody></table></div></div>`;

  renderOverview(); 
  
  setTimeout(() => {
    const cardContent = document.getElementById(`overview-card-${code}`);
    if(cardContent && statsContainer) {
       let newHtml = cardContent.innerHTML
           .replace(`id="chart-overview-${code}"`, `id="chart-single-${code}"`)
           .replace(`id="chart-overview-line-${code}"`, `id="chart-single-line-${code}"`);
           
       // 👉 3. 把「追蹤卡片 HTML」接在「圖表 HTML」的上方，一起塞進容器
       statsContainer.innerHTML = trackingHtml + newHtml;
       drawMixedChart(code, 'single');
    }
    document.getElementById("overview-drug-filter").value = "ALL";
  }, 150);

  const tableContainer = document.getElementById("single-drug-records-table");
  if(!tableContainer) return;
  
  let records = [];
  if(recordType === 'ALL' || recordType === 'APP') {
    State.applications.forEach(app => {
      if(String(app['藥品代碼']).toUpperCase() === code) {
        const appPid = String(app['病歷號']).toUpperCase();
        if(pidFilter && !appPid.includes(pidFilter)) return;
        const dt = formatAsDate(app['收單時間']);
        if(startDate && dt < startDate) return;
        if(endDate && dt > endDate) return;
        records.push({ type: 'APP', date: dt, time: formatAsTime(app['收單時間']) || '00:00:00', data: app });
      }
    });
  }
  
  if(recordType === 'ALL' || recordType === 'DIS') {
    State.dispenseLogs.forEach(log => {
      if(String(log['藥品代碼']).toUpperCase() === code) {
        const logPid = String(log['病歷號']).toUpperCase();
        if(pidFilter && !logPid.includes(pidFilter)) return;
        const dt = formatAsDate(log['調劑時間']);
        if(startDate && dt < startDate) return;
        if(endDate && dt > endDate) return;
        records.push({ type: 'DIS', date: dt, time: formatAsTime(log['調劑時間']) || '00:00:00', data: log });
      }
    });
  }
  
  records.sort((a, b) => new Date(b.date + ' ' + b.time) - new Date(a.date + ' ' + a.time));
  
  // 👉 加上 sticky top 讓表頭在往下滾動時不會消失
  let html = `<table class="table table-hover align-middle text-center mb-0"><thead class="table-light small" style="position: sticky; top: 0; z-index: 1;"><tr><th>時間</th><th>病歷號</th><th>動作</th><th>數量</th><th>單號 / 領藥號</th><th>操作單位/人員</th><th>異動</th></tr></thead><tbody>`;
  
  records.forEach(r => {
    const pid = String(r.data['病歷號']).toUpperCase();
    const user = r.data['藥師姓名'] || '-';
    const unit = r.data['處理單位'] || '-';
    
    // 👉 雙重作廢檢查
    const isVoid = r.data['作廢'] === 'Y' || r.data['異動'] === '作廢';
    const rowClass = isVoid ? 'bg-light text-muted text-decoration-line-through opacity-75' : '';
    
    const logId = r.type === 'APP' ? r.data['申請單號'] : (r.data['調劑流水號'] || r.data['申請單號']);

    // 👉 拔除還原與修改按鈕，只留作廢與已作廢標籤
    const actionButtons = isVoid 
      ? `<span class="badge bg-secondary opacity-75">已作廢</span>`
      : `<div class="btn-group btn-group-sm shadow-sm">
           <button class="btn btn-outline-danger" onclick="openActionModal('${r.type}', 'VOID', '${logId}')">作廢</button>
         </div>`;

    if(r.type === 'APP') {
        html += `<tr class="${rowClass}">
            <td>${r.date} ${r.time}</td>
            <td class="fw-bold ${isVoid ? '' : 'text-primary'}">${pid}</td>
            <td><span class="badge ${isVoid ? 'bg-secondary' : 'bg-info text-dark'}">${r.data['申請類別']}</span></td>
            <td class="fw-bold ${isVoid ? '' : 'text-primary'}">+${r.data['申請數量']}</td>
            <td class="small font-monospace">${r.data['依據單號'] || r.data['申請單號'] || '-'}</td>
            <td class="small">${unit} / ${user}</td>
            <td>${actionButtons}</td>
        </tr>`;
    } else {
        const isDisp = parseInt(r.data['調劑數量']) > 0 || (r.data['數量'] < 0);
        const actionStr = isVoid ? `<span class="badge bg-secondary">${isDisp ? '調劑' : '退藥'}</span>` : (isDisp ? '<span class="badge bg-success">調劑</span>' : '<span class="badge bg-danger">退藥</span>');
        const qty = isDisp ? (r.data['調劑數量'] || Math.abs(r.data['數量'])) : (r.data['退藥數量'] || Math.abs(r.data['數量']));
        const qtyClass = isVoid ? '' : (isDisp ? 'text-success' : 'text-danger');
        const sign = isDisp ? '-' : '+';
        let noHtml = r.data['領藥號'] || '-';
        if (!isDisp && r.data['退藥號']) noHtml += ` <br><span class="text-danger small">退: ${r.data['退藥號']}</span>`;

        html += `<tr class="${rowClass}">
            <td>${r.date} ${r.time}</td>
            <td class="fw-bold ${isVoid ? '' : 'text-primary'}">${pid}</td>
            <td>${actionStr}</td>
            <td class="fw-bold ${qtyClass}">${sign}${qty}</td>
            <td class="small font-monospace">${noHtml}</td>
            <td class="small">${unit} / ${user}</td>
            <td>${actionButtons}</td>
        </tr>`;
    }
  });
  html += `</tbody></table>`;
  if(records.length === 0) html = '<div class="text-center text-muted py-4">區間內無作業紀錄</div>';
  tableContainer.innerHTML = html;
}
