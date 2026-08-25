// js/dispense.js

let isProcessingDispense = false; 

function openDispenseForm() {
  if(!State.currentSelectedDrugCode) return;
  const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode);
  const user = JSON.parse(sessionStorage.getItem("currentUser"));
  
  document.getElementById("disp-form-drug-name").innerText = `${drug['藥品名稱']} (${drug['藥品代碼']})`;
  document.getElementById("disp-back-drug-name").innerText = drug['藥品名稱'];
  
  document.getElementById("disp-pharmacist-id").value = user.id;
  document.getElementById("disp-pharmacist-name").value = user.name;
  document.getElementById("disp-unit").value = user.unit || "";
  
  // 預設為調劑(綠色)
  document.getElementById("disp-type-disp").checked = true;
  document.getElementById("disp-type-disp").dispatchEvent(new Event('change', {bubbles: true}));
  
  switchView('dispense');
  document.getElementById("barcode-input").value = "";
  document.getElementById("barcode-input").focus();
  document.getElementById("disp-check-result").classList.add("d-none-important");
  
  renderDispenseHistory(); 
}

// 👉 監聽調劑/退藥 Radio 按鈕切換，動態改變顏色
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('input[name="disp-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const scanCard = document.getElementById("disp-scan-card");
            const scanBody = document.getElementById("disp-scan-body");
            const scanInput = document.getElementById("barcode-input");
            const scanTitle = document.getElementById("disp-scan-title");
            
            if(!scanCard) return;

            if (e.target.value === '調劑') {
                scanCard.className = "card shadow-sm mb-4 border-success";
                scanBody.className = "card-body bg-success bg-opacity-10";
                scanInput.className = "form-control mt-2 border-success form-control-lg text-uppercase fw-bold text-center text-success";
                scanTitle.className = "text-success fw-bold";
                scanTitle.innerHTML = '<i class="bi bi-upc-scan"></i> 條碼掃描區 (調劑模式 - 即時寫入)';
            } else {
                scanCard.className = "card shadow-sm mb-4 border-danger";
                scanBody.className = "card-body bg-danger bg-opacity-10";
                scanInput.className = "form-control mt-2 border-danger form-control-lg text-uppercase fw-bold text-center text-danger";
                scanTitle.className = "text-danger fw-bold";
                scanTitle.innerHTML = '<i class="bi bi-arrow-return-left"></i> 條碼掃描區 (退藥模式 - 即時寫入)';
            }
            scanInput.focus();
        });
    });
});

function renderDispenseHistory(forcePid = null) {
  // ...維持原本歷史渲染邏輯 (與前一個版本完全相同，此處省略以省字數)...
  const tbody = document.getElementById("disp-history-table");
  if(!tbody) return;
  
  let pidFilter = forcePid || document.getElementById("disp-hist-pid").value.trim().toUpperCase();
  if(forcePid) document.getElementById("disp-hist-pid").value = pidFilter;
  
  const startStr = document.getElementById("disp-hist-start").value.replace(/-/g, '/');
  const endStr = document.getElementById("disp-hist-end").value.replace(/-/g, '/');
  
  let sortedLogs = [...State.dispenseLogs].sort((a,b) => new Date(b['調劑日期']+' '+(b['調劑時間']||'00:00:00')) - new Date(a['調劑日期']+' '+(a['調劑時間']||'00:00:00')));
  
  let html = "";
  sortedLogs.forEach((log) => {
    if(String(log['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode && log['作廢'] !== 'Y') {
      const logPid = String(log['病歷號']).toUpperCase();
      if(pidFilter && !logPid.includes(pidFilter)) return;
      
      const logDateStr = formatAsDate(log['調劑日期']);
      if(startStr && logDateStr < startStr) return;
      if(endStr && logDateStr > endStr) return;

      const isDisp = parseInt(log['調劑數量']) > 0;
      const qty = isDisp ? log['調劑數量'] : log['退藥數量'];
      const typeHtml = isDisp ? `<span class="badge bg-success">調劑</span>` : `<span class="badge bg-danger">退藥</span>`;
      
      html += `<tr>
        <td>${logDateStr} ${log['調劑時間'] || ''}</td>
        <td class="fw-bold text-primary">${logPid}</td>
        <td>${typeHtml}</td>
        <td class="fw-bold">${qty}</td>
        <td><button type="button" class="btn btn-sm btn-outline-info" onclick="viewAppDetail('${logPid}')">📄 檢視依據</button></td>
      </tr>`;
    }
  });
  tbody.innerHTML = html || '<tr><td colspan="5" class="text-muted">查無符合紀錄</td></tr>';
}

function calculatePatientQuota(pid, drugCode) {
    let cycleMap = {}; 
    let latestApp = null; 
    
    State.applications.forEach(a => {
        if(String(a['病歷號']).toUpperCase() === pid && String(a['藥品代碼']).toUpperCase() === drugCode && a['作廢'] !== 'Y') {
            const sDate = formatAsDate(a['啟用日期'] || a['申請日期']);
            const qty = parseInt(a['申請數量'] || 0);
            
            if(!cycleMap[sDate] || qty > cycleMap[sDate]) cycleMap[sDate] = qty;
            
            if(!latestApp || new Date(formatAsDate(a['申請日期'])+' '+(a['收單時間']||'00:00:00')) > new Date(formatAsDate(latestApp['申請日期'])+' '+(latestApp['收單時間']||'00:00:00'))) {
                latestApp = a;
            }
        }
    });

    let totalAllowed = 0;
    Object.values(cycleMap).forEach(q => totalAllowed += q);

    let totalDispensed = 0, totalReturned = 0;
    State.dispenseLogs.forEach(log => {
      if(String(log['病歷號']).toUpperCase() === pid && String(log['藥品代碼']).toUpperCase() === drugCode && log['作廢'] !== 'Y') {
        totalDispensed += parseInt(log['調劑數量'] || 0);
        totalReturned += parseInt(log['退藥數量'] || 0);
      }
    });
    
    return { totalAllowed, totalDispensed, totalReturned, currentUsed: totalDispensed - totalReturned, latestApp };
}

window.viewAppDetail = function(pid) {
  // ...維持不變...
  const { latestApp } = calculatePatientQuota(pid, State.currentSelectedDrugCode);
  const contentBox = document.getElementById("appDetailContent");
  if(latestApp) {
    contentBox.innerHTML = `
      <ul class="list-group">
        <li class="list-group-item"><b>依據單號：</b><span class="text-danger fw-bold">${latestApp['申請單號'] || '剛成立單據(系統拋轉中)'}</span></li>
        <li class="list-group-item"><b>收單時間：</b>${latestApp['申請日期']} ${latestApp['收單時間']||''}</li>
        <li class="list-group-item"><b>病歷號：</b><span class="text-primary fw-bold">${latestApp['病歷號']}</span></li>
        <li class="list-group-item"><b>單據類別：</b><span class="badge bg-primary fs-6">${latestApp['申請類別']}</span></li>
        <li class="list-group-item"><b>啟用日期：</b>${latestApp['啟用日期'] || '-'}</li>
        <li class="list-group-item"><b>核准天數/數量：</b>${latestApp['申請天數']} 天 / <span class="fw-bold text-success">${latestApp['申請數量']} 支</span></li>
        <li class="list-group-item"><b>處理單位：</b>${latestApp['處理單位']}</li>
        <li class="list-group-item"><b>開單藥師：</b>${latestApp['藥師姓名']}</li>
      </ul>
    `;
  } else {
    contentBox.innerHTML = '<div class="alert alert-warning">查無相關申請單依據。</div>';
  }
  new bootstrap.Modal(document.getElementById('appDetailModal')).show();
};

async function processDispense(pid, qty, type, no, note) {
    if(!checkNetwork()) return false;
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
      renderDispenseHistory(pid); 
      return true;
    } else {
      alert("寫入失敗：" + res.message);
      return false;
    }
}

async function runDispenseCheck(pid, qty, type, no, note) {
    if(!document.getElementById("disp-unit").value || !document.getElementById("disp-pharmacist-id").value) {
       alert("請先確認「處理單位」與「作業藥師」已設定！"); return false;
    }
    
    const resultBox = document.getElementById("disp-check-result");
    resultBox.classList.remove("d-none-important");
    
    const { totalAllowed, currentUsed } = calculatePatientQuota(pid, State.currentSelectedDrugCode);
    const remaining = totalAllowed - currentUsed;
    
    if (type === "調劑") {
      if (totalAllowed === 0 || qty > remaining) {
        resultBox.className = "alert alert-danger fw-bold fs-5 shadow-sm";
        resultBox.innerHTML = `⛔ 阻擋：${totalAllowed === 0 ? '尚未申請此藥品' : '超量調劑 (剩餘 ' + remaining + ' 支，欲發 ' + qty + ' 支)'}`;
        renderDispenseHistory(pid); 
        return false;
      }
      resultBox.className = "alert alert-success fw-bold fs-5 shadow-sm";
      resultBox.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> ✅ 額度足夠！剩餘 ${remaining} ➔ 發出後剩餘 ${remaining - qty}，正在自動寫入紀錄...`;
    } else { 
      if (qty > currentUsed) {
        resultBox.className = "alert alert-danger fw-bold fs-5 shadow-sm";
        resultBox.innerHTML = `⛔ 阻擋：退藥數量 (${qty}) 大於總已領藥量 (${currentUsed})！`;
        renderDispenseHistory(pid);
        return false;
      }
      resultBox.className = "alert alert-success fw-bold fs-5 shadow-sm";
      resultBox.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> ✅ 退藥檢核通過！正在自動寫入紀錄...`;
    }
    
    const success = await processDispense(pid, qty, type, no, note);
    if(success) {
      resultBox.innerHTML = resultBox.innerHTML.replace('<span class="spinner-border spinner-border-sm me-2"></span>', '💾');
    } else {
      resultBox.innerHTML = "❌ 寫入發生錯誤，請重試。";
    }
    return success;
}

window.manualDispenseModal = async function() {
  if(isProcessingDispense) return; 
  const pid = prompt("請輸入病歷號：");
  if(!pid) return;
  const qtyStr = prompt("請輸入數量 (數字)：");
  if(!qtyStr || isNaN(qtyStr)) return;
  
  // 👉 取得目前點選的 Radio (調劑或退藥)
  const type = document.querySelector('input[name="disp-type"]:checked').value;
  const note = prompt("請輸入備註 (退藥必填)：");
  
  isProcessingDispense = true;
  await runDispenseCheck(pid.trim().toUpperCase(), parseInt(qtyStr), type, null, note);
  isProcessingDispense = false;
};

document.addEventListener("DOMContentLoaded", () => {
  const barcodeInput = document.getElementById("barcode-input");
  if(!barcodeInput) return;

  barcodeInput.addEventListener("keypress", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      
      if(isProcessingDispense) {
          console.warn("系統處理中，忽略重複刷入的條碼");
          return;
      }
      
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
        const type = document.querySelector('input[name="disp-type"]:checked').value;
        const no = parts[2];
        
        isProcessingDispense = true;
        barcodeInput.disabled = true;
        barcodeInput.placeholder = "處理中，請稍候...";
        
        try {
            await runDispenseCheck(pid, qty, type, no, "");
        } catch(err) {
            console.error("調劑處理錯誤", err);
        } finally {
            isProcessingDispense = false;
            barcodeInput.disabled = false;
            barcodeInput.value = ""; 
            barcodeInput.placeholder = "確認上方設定無誤後，請刷入藥袋條碼...";
            barcodeInput.focus();
        }
      } else {
        alert("條碼格式不符！");
        barcodeInput.value = "";
      }
    }
  });
});
