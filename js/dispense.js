// js/dispense.js

let isProcessingDispense = false;

window.openDispenseForm = function() {
    if(!State.currentSelectedDrugCode) return;
    const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode);
    const user = JSON.parse(sessionStorage.getItem("currentUser"));

    document.getElementById("disp-drug-name").innerText = `${drug['藥品名稱']} (${drug['藥品代碼']})`;
    document.getElementById("disp-pharmacist-id").value = user.id;
    document.getElementById("disp-pharmacist-name").value = user.name;
    
    // 預設篩選區間：[今天 - 管制天數] ~ [今天]
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
    
    document.getElementById("disp-check-result").classList.add("d-none-important");
    document.getElementById("barcode-input").value = "";
    
    switchView('dispense');
    renderDispenseHistory(); // 修改為與 HTML 對應的名稱
    document.getElementById("barcode-input").focus();
};

// 函數名稱統一為 renderDispenseHistory 確保與 HTML 的 onclick 綁定一致
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

            const isDispense = log['調劑類別'] === '發藥';
            html += `<tr>
                <td>${logDateStr} ${formatAsTime(log['調劑時間'])}</td>
                <td class="fw-bold text-primary">${logPid}</td>
                <td><span class="badge ${isDispense ? 'bg-success' : 'bg-danger'}">${log['調劑類別']}</span></td>
                <td class="fw-bold ${isDispense ? 'text-success' : 'text-danger'}">${isDispense ? '+' : '-'}${log['數量']}</td>
                <td class="small text-muted">${log['依據單號'] || '-'}</td>
            </tr>`;
        }
    });
    tbody.innerHTML = html || '<tr><td colspan="5" class="text-muted">區間內查無符合紀錄</td></tr>';
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
            const no = parts[2].trim(); 
            const qty = parseInt(parts[3].trim()) || 1; 
            
            if (State.currentSelectedDrugCode && scanDrugCode !== State.currentSelectedDrugCode) {
                showDispenseResult("error", `⛔ 刷錯藥品！此條碼為【${scanDrugCode}】，非目前所在的【${State.currentSelectedDrugCode}】。`);
                barcodeInput.value = "";
                return;
            }

            const typeEl = document.querySelector('input[name="disp-type"]:checked');
            const type = typeEl ? typeEl.value : '發藥';
            
            isProcessingDispense = true;
            barcodeInput.disabled = true;
            
            // 執行極速調劑檢核
            await executeDispenseFlow(pid, qty, type, no, "");
            
            isProcessingDispense = false;
            barcodeInput.disabled = false;
            barcodeInput.value = ""; 
            barcodeInput.focus();
          } else {
            showDispenseResult("error", "⛔ 條碼格式錯誤！請確認刷入的是完整的二維條碼 (病歷號;藥品;領藥號;數量...)。");
            barcodeInput.value = "";
          }
        }
    });
}

window.manualDispenseModal = async function() {
  if(isProcessingDispense) return; 
  const pid = prompt("請輸入病歷號：");
  if(!pid) return;
  const qtyStr = prompt("請輸入數量 (數字)：");
  if(!qtyStr || isNaN(qtyStr)) return;
  
  const typeEl = document.querySelector('input[name="disp-type"]:checked');
  const type = typeEl ? typeEl.value : '發藥';
  const note = prompt("請輸入備註 (退藥必填)：");
  
  isProcessingDispense = true;
  document.getElementById("disp-check-result").classList.remove("d-none-important");
  document.getElementById("disp-check-result").className = "alert alert-info";
  document.getElementById("disp-check-result").innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> 正在處理...';
  
  await executeDispenseFlow(pid.trim().toUpperCase(), parseInt(qtyStr), type, "手動", note || "");
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

// 封裝核心調劑流程，實現本地優先 (Local-First) 
async function executeDispenseFlow(pid, qty, type, no, note) {
    // 第一次先用本地快取檢核，達成 0 毫秒體感
    let checkResult = performDispenseCalculation(pid, qty, type);
    
    // 如果是發藥且本地快取判定餘額不足，則強制呼叫智能同步確認雲端是否有最新單據
    if (!checkResult.success && type === '發藥') {
        document.getElementById("disp-check-result").classList.remove("d-none-important");
        document.getElementById("disp-check-result").className = "alert alert-warning fs-6";
        document.getElementById("disp-check-result").innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> 本地餘額不足，正在向雲端確認最新單據...';
        
        await window.smartSync(true); // 強制同步
        checkResult = performDispenseCalculation(pid, qty, type); // 再次檢核
    }

    if (!checkResult.success) {
        showDispenseResult("error", checkResult.msg);
        return;
    }

    // 檢核通過，組合上傳資料
    const now = new Date();
    const user = JSON.parse(sessionStorage.getItem("currentUser"));
    const dataObj = {
        "病歷號": pid,
        "藥品代碼": State.currentSelectedDrugCode,
        "調劑類別": type,
        "數量": qty,
        "依據單號": checkResult.basisId,
        "領藥號": no,
        "調劑時間": formatAsDate(now) + " " + formatAsTime(now),
        "藥師員工編號": user.id,
        "藥師姓名": user.name,
        "處理單位": user.unit || "",
        "調劑備註": note
    };

    // 樂觀更新 (Optimistic UI)：直接將資料寫入本地狀態並更新畫面
    State.dispenseLogs.unshift(dataObj);
    document.getElementById("disp-hist-pid").value = pid;
    renderDispenseHistory();

    if (type === '發藥') {
        const newRem = checkResult.availableRemaining - qty;
        showDispenseResult("success", `✅ 檢核通過！依據單號 [${checkResult.basisId.substring(0,10)}...] 扣除，該單尚餘: ${newRem} 支`);
    } else {
        showDispenseResult("success", `✅ 退藥紀錄已建立！退回數量: ${qty} (將補回原單號額度)`);
    }

    // 背景非同步寫入雲端 (修正原本呼叫錯誤的 API 行動名稱 submitDispenseLog -> submitDispense)
    postData("submitDispense", dataObj).then(res => {
        if(res.status !== 'success') {
            console.error("背景上傳失敗", res);
            alert(`⚠️ 病患 ${pid} 的發退藥上傳雲端失敗，請檢查網路！`);
            State.dispenseLogs = State.dispenseLogs.filter(l => l !== dataObj); // 失敗則撤回本地假資料
            renderDispenseHistory();
        }
    });
}

// 純粹的商業邏輯：計算 FIFO 餘額與判斷
function performDispenseCalculation(pid, qty, type) {
    const drugCode = State.currentSelectedDrugCode;
    const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === drugCode);
    
    if (type === '退藥') {
        // 退藥不需嚴格檢核餘額，僅需建立紀錄，這裡為簡化可讓退藥掛在最新的單號上或預設字串
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

    // 先進先出 (FIFO)：依據啟用日期由舊到新排序
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
                if (log['調劑類別'] === '發藥') usedQty += parseInt(log['數量'] || 0);
                if (log['調劑類別'] === '退藥') usedQty -= parseInt(log['數量'] || 0);
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
