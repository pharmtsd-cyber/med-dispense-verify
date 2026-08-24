// js/dispense.js

function openDispenseForm() {
  if(!State.currentSelectedDrugCode) return;
  const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode);
  const user = JSON.parse(sessionStorage.getItem("currentUser"));
  
  document.getElementById("disp-form-drug-name").innerText = `${drug['藥品名稱']} (${drug['藥品代碼']})`;
  document.getElementById("disp-back-drug-name").innerText = drug['藥品名稱'];
  
  document.getElementById("disp-pharmacist-id").value = user.id;
  document.getElementById("disp-pharmacist-name").value = user.name;
  document.getElementById("disp-unit").value = user.unit || "";
  
  switchView('dispense');
  document.getElementById("barcode-input").value = "";
  document.getElementById("barcode-input").focus();
  document.getElementById("disp-check-result").classList.add("d-none-important");
  
  // 預設載入近兩天紀錄
  renderDispenseHistory(); 
}

// 渲染調劑歷史/病歷號關聯清單
function renderDispenseHistory(forcePid = null) {
  const tbody = document.getElementById("disp-history-table");
  if(!tbody) return;
  
  let pidFilter = forcePid || document.getElementById("disp-hist-pid").value.trim().toUpperCase();
  if(forcePid) document.getElementById("disp-hist-pid").value = pidFilter; // 同步UI
  
  const startStr = document.getElementById("disp-hist-start").value;
  const endStr = document.getElementById("disp-hist-end").value;
  
  // 依照時間排序 (最新的在最前)
  let sortedLogs = [...State.dispenseLogs].reverse();
  
  let html = "";
  sortedLogs.forEach((log, index) => {
    if(String(log['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode && log['作廢'] !== 'Y') {
      const logPid = String(log['病歷號']).toUpperCase();
      if(pidFilter && !logPid.includes(pidFilter)) return;
      
      const logDateStr = formatAsDate(log['調劑日期']).replace(/\//g, '-');
      if(startStr && logDateStr < startStr) return;
      if(endStr && logDateStr > endStr) return;

      const isDisp = parseInt(log['調劑數量']) > 0;
      const qty = isDisp ? log['調劑數量'] : log['退藥數量'];
      const typeHtml = isDisp ? `<span class="badge bg-success">調劑</span>` : `<span class="badge bg-danger">退藥</span>`;
      
      html += `<tr>
        <td>${log['調劑日期']} ${log['調劑時間']}</td>
        <td class="fw-bold text-primary">${logPid}</td>
        <td>${typeHtml}</td>
        <td class="fw-bold">${qty}</td>
        <td><button class="btn btn-sm btn-outline-info" onclick="viewAppDetail('${logPid}')">📄 檢視依據</button></td>
      </tr>`;
    }
  });
  tbody.innerHTML = html || '<tr><td colspan="5" class="text-muted">查無符合紀錄</td></tr>';
}

// 顯示檢核依據 (抓出該 PID 管制期內最新的申請單)
function viewAppDetail(pid) {
  const drugCode = State.currentSelectedDrugCode;
  const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === drugCode);
  const controlDays = parseInt(drug['管制天數'] || 14);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - controlDays);
  
  let latestApp = null;
  
  State.applications.forEach(app => {
    if(String(app['病歷號']).toUpperCase() === pid && String(app['藥品代碼']).toUpperCase() === drugCode && app['作廢'] !== 'Y') {
      const appDate = new Date(app['申請日期']);
      if(appDate >= cutoffDate) {
        if(!latestApp || appDate > new Date(latestApp['申請日期'])) {
          latestApp = app;
        }
      }
    }
  });

  const contentBox = document.getElementById("appDetailContent");
  if(latestApp) {
    contentBox.innerHTML = `
      <ul class="list-group">
        <li class="list-group-item"><b>申請單號 / 時間：</b>${latestApp['申請單號'] || '-'} / ${latestApp['申請日期']}</li>
        <li class="list-group-item"><b>病歷號：</b>${latestApp['病歷號']}</li>
        <li class="list-group-item"><b>申請類別：</b><span class="badge bg-primary">${latestApp['申請類別']}</span></li>
        <li class="list-group-item"><b>啟用日期：</b>${latestApp['啟用日期'] || '-'}</li>
        <li class="list-group-item"><b>天數 / 數量：</b>${latestApp['申請天數']} 天 / ${latestApp['申請數量']} 支</li>
        <li class="list-group-item"><b>處理單位：</b>${latestApp['處理單位']}</li>
        <li class="list-group-item"><b>開單藥師：</b>${latestApp['藥師姓名']}</li>
      </ul>
    `;
  } else {
    contentBox.innerHTML = '<div class="alert alert-warning">查無管制期內之申請紀錄，或已過期。</div>';
  }
  
  const modal = new bootstrap.Modal(document.getElementById('appDetailModal'));
  modal.show();
}

// 處理實際寫入邏輯
async function processDispense(pid, qty, type, no, note) {
    if(!checkNetwork()) return;
    
    const now = new Date();
    const dataObj = {
      "病歷號": pid,
      "藥品代碼": State.currentSelectedDrugCode,
      "選擇調劑或退藥": type,
      "調劑數量": type === "調劑" ? qty : 0,
      "退藥數量": type === "退藥" ? qty : 0,
      "手動或條碼": no ? "條碼掃描" : "手動輸入",
      "領藥號": no || "-",
      "處理單位": document.getElementById("disp-unit").value,
      "備註": note || "",
      "調劑日期": formatAsDate(now),
      "調劑時間": formatAsTime(now),
      "藥師員工編號": document.getElementById("disp-pharmacist-id").value,
      "藥師姓名": document.getElementById("disp-pharmacist-name").value
    };

    const res = await postData("submitDispense", dataObj);
    if(res.status === 'success') {
      State.dispenseLogs.push(dataObj);
      renderDispenseHistory(pid); // 更新畫面並鎖定此PID
    } else {
      alert("寫入失敗：" + res.message);
    }
}

// 手動輸入模式
function manualDispenseModal() {
  const pid = prompt("請輸入病歷號：");
  if(!pid) return;
  const qtyStr = prompt("請輸入數量 (數字)：");
  if(!qtyStr || isNaN(qtyStr)) return;
  const qty = parseInt(qtyStr);
  const type = document.getElementById("disp-type").value;
  const note = prompt("請輸入備註 (退藥必填)：");
  
  // 觸發檢核
  runDispenseCheck(pid.trim().toUpperCase(), qty, type, null, note);
}

// 核心檢核邏輯
async function runDispenseCheck(pid, qty, type, no, note) {
    if(!document.getElementById("disp-unit").value || !document.getElementById("disp-pharmacist-id").value) {
       alert("請先確認「處理單位」與「作業藥師」已設定！"); return;
    }
    
    const resultBox = document.getElementById("disp-check-result");
    resultBox.classList.remove("d-none-important");
    resultBox.className = "alert alert-warning fw-bold";
    resultBox.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>檢核中...';

    // 取得病患額度
    let totalAllowed = 0, totalDispensed = 0, totalReturned = 0;
    
    State.applications.forEach(app => {
      if(String(app['病歷號']).toUpperCase() === pid && String(app['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode && app['作廢'] !== 'Y') {
        totalAllowed += parseInt(app['申請數量'] || 0);
      }
    });

    State.dispenseLogs.forEach(log => {
      if(String(log['病歷號']).toUpperCase() === pid && String(log['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode && log['作廢'] !== 'Y') {
        totalDispensed += parseInt(log['調劑數量'] || 0);
        totalReturned += parseInt(log['退藥數量'] || 0);
      }
    });
    
    const currentUsed = totalDispensed - totalReturned;
    const remaining = totalAllowed - currentUsed;
    
    if (type === "調劑") {
      if (totalAllowed === 0 || qty > remaining) {
        resultBox.className = "alert alert-danger fw-bold";
        resultBox.innerText = `⛔ 阻擋：${totalAllowed === 0 ? '尚未申請此藥品' : '超量調劑 (剩餘 ' + remaining + ')'}`;
        renderDispenseHistory(pid); // 擋下也顯示歷史
        return;
      }
      resultBox.className = "alert alert-success fw-bold";
      resultBox.innerText = `✅ 檢核通過並自動送出！剩餘額度：${remaining - qty} 支`;
    } else { 
      if (qty > currentUsed) {
        resultBox.className = "alert alert-danger fw-bold";
        resultBox.innerText = `⛔ 阻擋：退藥數量 (${qty}) 大於總已領藥量 (${currentUsed})！`;
        renderDispenseHistory(pid);
        return;
      }
      resultBox.className = "alert alert-success fw-bold";
      resultBox.innerText = `✅ 退藥檢核通過並自動送出！退入將恢復 ${qty} 支額度。`;
    }
    
    // 檢核通過，直接呼叫 API 寫入
    await processDispense(pid, qty, type, no, note);
}

document.addEventListener("DOMContentLoaded", () => {
  const barcodeInput = document.getElementById("barcode-input");
  if(!barcodeInput) return;

  barcodeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const str = barcodeInput.value.trim().toUpperCase();
      if(!str) return;
      
      const parts = str.split(';');
      if (parts.length >= 4) {
        const scannedDrugCode = parts[1];
        if(scannedDrugCode !== State.currentSelectedDrugCode) {
           alert(`⚠️ 條碼解析錯誤：藥袋代碼 (${scannedDrugCode}) 與當前頁面 (${State.currentSelectedDrugCode}) 不符！`);
           barcodeInput.value = ""; return;
        }
        
        const pid = parts[0];
        const qty = parseInt(parts[3]);
        const type = document.getElementById("disp-type").value;
        const no = parts[2];
        barcodeInput.value = ""; 
        
        // 執行即時檢核與寫入
        runDispenseCheck(pid, qty, type, no, "");
      } else {
        alert("條碼格式不符！");
      }
    }
  });
});
