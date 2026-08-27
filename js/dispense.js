// js/dispense.js

let isProcessingDispense = false;

window.openDispenseForm = function() {
    if(!State.currentSelectedDrugCode) return;
    const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode);
    const user = JSON.parse(sessionStorage.getItem("currentUser"));

    const drugNameEl = document.getElementById("disp-form-drug-name") || document.getElementById("disp-drug-name");
    if(drugNameEl) {
        drugNameEl.innerText = `${drug['藥品名稱']} (${drug['藥品代碼']})`;
    }
    
    const pharIdEl = document.getElementById("disp-pharmacist-id");
    if(pharIdEl) pharIdEl.value = user.id;
    
    const pharNameEl = document.getElementById("disp-pharmacist-name");
    if(pharNameEl) pharNameEl.value = user.name;
    
    const today = new Date();
    const controlDays = parseInt(drug['管制天數'] || 14);
    const startDate = new Date();
    startDate.setDate(today.getDate() - controlDays);
    
    const histStartInput = document.getElementById("disp-hist-start");
    const histEndInput = document.getElementById("disp-hist-end");
    if(histStartInput) histStartInput.value = startDate.toISOString().split('T')[0];
    if(histEndInput) histEndInput.value = today.toISOString().split('T')[0];
    
    const histPidInput = document.getElementById("disp-hist-pid");
    if(histPidInput) histPidInput.value = "";
    
    const resultDiv = document.getElementById("disp-check-result");
    if(resultDiv) resultDiv.classList.add("d-none-important");
    
    const barcodeInput = document.getElementById("barcode-input");
    if(barcodeInput) barcodeInput.value = "";
    
    const noteInput = document.getElementById("disp-note-input");
    if(noteInput) noteInput.value = "";
    
    switchView('dispense');
    renderDispenseHistory(); 
    
    if(barcodeInput) barcodeInput.focus();
};

window.renderDispenseHistory = function() {
    const tbody = document.getElementById("disp-history-table");
    if(!tbody) return;
    const pidFilter = document.getElementById("disp-hist-pid").value.trim().toUpperCase();
    const startStr = document.getElementById("disp-hist-start").value.replace(/-/g, '/');
    const endStr = document.getElementById("disp-hist-end").value.replace(/-/g, '/');
    
    let sortedLogs = [...State.dispenseLogs].sort((a,b) => {
        const timeA = new Date(formatAsDate(a['調劑時間'])+' '+(formatAsTime(a['調劑時間'])||'00:00:00'));
        const timeB = new Date(formatAsDate(b['調劑時間'])+' '+(formatAsTime(b['調劑時間'])||'00:00:00'));
        return timeB - timeA; 
    });
    
    let html = "";
    sortedLogs.forEach(log => {
        if(String(log['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode && log['作廢'] !== 'Y') {
            const logPid = String(log['病歷號']).toUpperCase();
            if(pidFilter && !logPid.includes(pidFilter)) return;
            
            const logDateStr = formatAsDate(log['調劑時間']);
            if(startStr && logDateStr < startStr) return;
            if(endStr && logDateStr > endStr) return;

            // 👉 修正：判斷字眼改為 '調劑'
            const isDispense = log['調劑類別'] === '調劑';
            
            const basisId = log['依據單號'];
            let basisHtml = '-';
            if (basisId && basisId !== '手動' && basisId !== '退藥紀錄' && basisId !== '退藥無依據') {
                basisHtml = `<button class="btn btn-sm btn-outline-primary py-0 px-2 fw-bold" onclick="showAppDetails('${basisId}')" style="font-size: 0.8rem; border-radius: 12px;"><i class="bi bi-file-earmark-text"></i> ${basisId.substring(0, 12)}${basisId.length > 12 ? '...' : ''}</button>`;
            } else if (basisId) {
                basisHtml = `<span class="small text-muted">${basisId}</span>`;
            }

            // 數量直接讀取資料庫存好的正負數 (+2 或 -2)
            html += `<tr>
                <td>${logDateStr} ${formatAsTime(log['調劑時間'])}</td>
                <td class="fw-bold text-primary">${logPid}</td>
                <td><span class="badge ${isDispense ? 'bg-success' : 'bg-danger'}">${log['調劑類別']}</span></td>
                <td class="fw-bold ${isDispense ? 'text-success' : 'text-danger'}">${log['數量'] > 0 ? '+' : ''}${log['數量']}</td>
                <td>${basisHtml}</td>
            </tr>`;
        }
    });
    tbody.innerHTML = html || '<tr><td colspan="5" class="text-muted">區間內查無符合紀錄</td></tr>';
};

window.showAppDetails = function(appId) {
    const app = State.applications.find(a => a['申請單號'] === appId || a['收單時間'] === appId);
    const contentDiv = document.getElementById("appDetailContent");

    if (!app) {
        contentDiv.innerHTML = '<div class="alert alert-warning"><i class="bi bi-exclamation-triangle"></i> 找不到對應的申請單紀錄，可能已被作廢或系統尚未同步。</div>';
    } else {
        contentDiv.innerHTML = `
            <table class="table table-bordered table-sm mb-0 align-middle">
                <tbody>
                    <tr><th class="bg-light text-end" width="30%">申請單號</th><td class="text-secondary font-monospace small">${app['申請單號'] || '-'}</td></tr>
                    <tr><th class="bg-light text-end">病歷號</th><td class="fw-bold text-primary fs-6">${app['病歷號']}</td></tr>
                    <tr><th class="bg-light text-end">藥品代碼</th><td class="fw-bold">${app['藥品代碼']}</td></tr>
                    <tr><th class="bg-light text-end">申請類別</th><td><span class="badge bg-info text-dark">${app['申請類別']}</span></td></tr>
                    <tr><th class="bg-light text-end">申請數量</th><td><span class="text-muted">${app['申請天數']} 天</span> / <span class="fw-bold text-danger fs-6">${app['申請數量']} 支</span></td></tr>
                    <tr><th class="bg-light text-end">啟用日期</th><td class="fw-bold text-success">${formatAsDate(app['啟用日期']) || '-'}</td></tr>
                    <tr><th class="bg-light text-end">建單時間</th><td class="small text-muted">${formatAsDate(app['收單時間'])} ${formatAsTime(app['收單時間'])}</td></tr>
                    <tr><th class="bg-light text-end">藥師 / 單位</th><td>${app['藥師姓名']} <span class="text-muted small">(${app['處理單位']})</span></td></tr>
                    <tr><th class="bg-light text-end">主管簽核</th><td>${app['主管核准人'] ? `<span class="badge bg-warning text-dark"><i class="bi bi-pen"></i> ${app['主管核准人']}</span>` : '<span class="text-muted small">無</span>'}</td></tr>
                    <tr><th class="bg-light text-end">備註說明</th><td>${app['申請備註'] || '<span class="text-muted small">-</span>'}</td></tr>
                </tbody>
            </table>
        `;
    }
    const modalEl = document.getElementById('appDetailModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
};

const barcodeInput = document.getElementById("barcode-input");
if(barcodeInput) {
    barcodeInput.addEventListener("keypress", async (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if(isProcessingDispense) return;
          
          const str = barcodeInput.value.trim().toUpperCase();
          if(!str) return;
          
          const parts = str.split(';');
          if (parts.length >= 4) {
            const pid = parts[0].trim();
            const scanDrugCode = parts[1].trim(); 
            let no = parts[2].trim(); 
            const qty = parseInt(parts[3].trim()) || 1; 
            
            if (State.currentSelectedDrugCode && scanDrugCode !== State.currentSelectedDrugCode) {
                showDispenseResult("error", `⛔ 刷錯藥品！此條碼為【${scanDrugCode}】，非目前所在的【${State.currentSelectedDrugCode}】。`);
                barcodeInput.value = "";
                return;
            }

            const typeEl = document.querySelector('input[name="disp-type"]:checked');
            const type = typeEl ? typeEl.value : '調劑';
            
            // 👉 讀取畫面上的備註欄位
            let note = document.getElementById("disp-note-input") ? document.getElementById("disp-note-input").value.trim() : "";
            
            // 👉 退藥強制攔截機制：必須輸入退藥號與理由
            if (type === '退藥') {
                const retNo = prompt("🔄 您選擇了【退藥作業】\n請輸入「退藥號」：");
                if (!retNo) {
                    barcodeInput.value = "";
                    return; // 放棄退藥
                }
                no = retNo; // 覆蓋條碼原有的領藥號，改存退藥號
                
                if (!note) {
                    note = prompt("請輸入「退藥理由」(必填)：");
                    if (!note) {
                        alert("⛔ 退藥必須填寫理由！操作已取消。");
                        barcodeInput.value = "";
                        return;
                    }
                }
            }
            
            isProcessingDispense = true;
            barcodeInput.disabled = true;
            
            await executeDispenseFlow(pid, qty, type, no, note);
            
            isProcessingDispense = false;
            barcodeInput.disabled = false;
            barcodeInput.value = ""; 
            if(document.getElementById("disp-note-input")) document.getElementById("disp-note-input").value = ""; // 清空備註
            barcodeInput.focus();
          } else {
            showDispenseResult("error", "⛔ 條碼格式錯誤！請確認刷入的是完整的二維條碼。");
            barcodeInput.value = "";
          }
        }
    });
}

window.manualDispenseModal = async function() {
  if(isProcessingDispense) return; 
  
  const typeEl = document.querySelector('input[name="disp-type"]:checked');
  const type = typeEl ? typeEl.value : '調劑';
  
  const pid = prompt("請輸入病歷號：");
  if(!pid) return;
  const qtyStr = prompt("請輸入數量 (數字)：");
  if(!qtyStr || isNaN(qtyStr)) return;
  
  // 👉 依據模式要求輸入領藥號或退藥號
  const no = prompt(`請輸入 ${type === '調劑' ? '領藥號' : '退藥號'}：`);
  if (!no && type === '退藥') {
      alert("⛔ 退藥必須填寫退藥號！");
      return;
  }
  
  const note = prompt(`請輸入 ${type === '調劑' ? '調劑備註' : '退藥理由 (必填)'}：`);
  if(type === '退藥' && !note) {
      alert("⛔ 退藥必須填寫理由！");
      return;
  }
  
  isProcessingDispense = true;
  document.getElementById("disp-check-result").classList.remove("d-none-important");
  document.getElementById("disp-check-result").className = "alert alert-info";
  document.getElementById("disp-check-result").innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> 正在處理...';
  
  await executeDispenseFlow(pid.trim().toUpperCase(), parseInt(qtyStr), type, no || "手動無單號", note || "");
  isProcessingDispense = false;
};

function showDispenseResult(status, htmlMsg) {
    const resDiv = document.getElementById("disp-check-result");
    resDiv.classList.remove("d-none-important");
    if(status === 'success') {
        resDiv.className = "alert alert-success fs-5 fw-bold shadow-sm";
        resDiv.innerHTML = `<i class="bi bi-check-circle-fill"></i> ${htmlMsg}`;
    } else if (status === 'error') {
        resDiv.className = "alert alert-danger fs-5 fw-bold shadow-sm";
        resDiv.innerHTML = `<i class="bi bi-x-circle-fill"></i> ${htmlMsg}`;
    }
}

async function executeDispenseFlow(pid, qty, type, no, note) {
    let checkResult = performDispenseCalculation(pid, qty, type);
    
    if (!checkResult.success && type === '調劑') {
        document.getElementById("disp-check-result").classList.remove("d-none-important");
        document.getElementById("disp-check-result").className = "alert alert-warning fs-6";
        document.getElementById("disp-check-result").innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> 本地餘額不足，正在向雲端確認最新單據...';
        
        await window.smartSync(true); 
        checkResult = performDispenseCalculation(pid, qty, type); 
    }

    if (!checkResult.success) {
        showDispenseResult("error", checkResult.msg);
        return;
    }

    const now = new Date();
    const user = JSON.parse(sessionStorage.getItem("currentUser"));
    
    // 👉 核心邏輯：依照您的需求，計算庫存的「正負差值」
    const signedQty = (type === '調劑') ? -Math.abs(qty) : Math.abs(qty);
    
    const dataObj = {
        "病歷號": pid,
        "藥品代碼": State.currentSelectedDrugCode,
        "調劑類別": type,
        "調劑數量": type === '調劑' ? Math.abs(qty) : 0, 
        "退藥數量": type === '退藥' ? Math.abs(qty) : 0,
        "數量": signedQty,  // 👉 資料庫這裡會寫入 -2 或 +2
        "依據單號": checkResult.basisId,
        "領藥號": no,       // 👉 發藥存領藥號，退藥存退藥號
        "調劑日期": formatAsDate(now),
        "調劑時間": formatAsDate(now) + " " + formatAsTime(now),
        "藥師員工編號": user.id,
        "藥師姓名": user.name,
        "處理單位": user.unit || "",
        "調劑備註": note    // 👉 寫入備註或退藥理由
    };

    State.dispenseLogs.unshift(dataObj);
    document.getElementById("disp-hist-pid").value = pid;
    renderDispenseHistory();

    if (type === '調劑') {
        const newRem = checkResult.availableRemaining - Math.abs(qty);
        showDispenseResult("success", `✅ 檢核通過！依據單號 [${checkResult.basisId.substring(0,10)}...] 扣除，該單尚餘: ${newRem} 支`);
    } else {
        showDispenseResult("success", `✅ 退藥紀錄已建立！退回數量: +${qty} (將補回原單號額度)`);
    }

    postData("submitDispense", dataObj).then(res => {
        if(res.status !== 'success') {
            console.error("背景上傳失敗", res);
            alert(`⚠️ 病患 ${pid} 的發退藥上傳雲端失敗，請檢查網路！`);
            State.dispenseLogs = State.dispenseLogs.filter(l => l !== dataObj);
            renderDispenseHistory();
        }
    });
}

function performDispenseCalculation(pid, qty, type) {
    const drugCode = State.currentSelectedDrugCode;
    const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === drugCode);
    
    if (type === '退藥') {
        return { success: true, basisId: "退藥紀錄", availableRemaining: 0 };
    }

    const controlDays = parseInt(drug['管制天數'] || 14);
    const today = new Date();
    today.setHours(0,0,0,0);
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - controlDays);
    
    let validApps = State.applications.filter(app => {
        if(String(app['病歷號']).toUpperCase() !== pid || String(app['藥品代碼']).toUpperCase() !== drugCode || app['作廢'] === 'Y') return false;
        const actDateStr = formatAsDate(app['啟用日期']) || formatAsDate(app['收單時間']);
        const actDate = new Date(actDateStr);
        actDate.setHours(0,0,0,0);
        return actDate >= cutoffDate; 
    });

    validApps.sort((a,b) => {
        const dateA = new Date(formatAsDate(a['啟用日期'] || a['收單時間']));
        const dateB = new Date(formatAsDate(b['啟用日期'] || b['收單時間']));
        return dateA - dateB; 
    });

    let targetApp = null;
    let availableRemaining = 0;

    for (let app of validApps) {
        const basisId = app['申請單號'] || app['收單時間'];
        let usedQty = 0;
        
        State.dispenseLogs.forEach(log => {
            if (String(log['病歷號']).toUpperCase() === pid && 
                String(log['藥品代碼']).toUpperCase() === drugCode && 
                log['作廢'] !== 'Y' && 
                log['依據單號'] === basisId) {
                
                // 👉 修正：讀取絕對值來計算已被發出的餘額 (退藥時會自動扣減回補)
                usedQty += parseInt(log['調劑數量'] || 0);
                usedQty -= parseInt(log['退藥數量'] || 0);
            }
        });

        const maxQty = parseInt(app['申請數量'] || 0);
        const rem = maxQty - usedQty;

        if (rem > 0) {
            targetApp = app;
            availableRemaining = rem;
            break; 
        }
    }

    if (!targetApp) {
        return { success: false, msg: `檢核失敗！病患 ${pid} 於管制期內查無有效餘額之申請單。` };
    }
    if (qty > availableRemaining) {
        return { success: false, msg: `數量不足！刷入量 (${qty}) 大於最早可用單據之剩餘量 (${availableRemaining})。<br><small>請分次刷入或退回重開。</small>` };
    }

    return { 
        success: true, 
        basisId: targetApp['申請單號'] || targetApp['收單時間'],
        availableRemaining: availableRemaining 
    };
}
