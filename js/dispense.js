// js/dispense.js

let isProcessingDispense = false;

// 👉 這裡把函數名稱改回 HTML 認得的 openDispenseForm
window.openDispenseForm = function() {
    if(!State.currentSelectedDrugCode) return;
    const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode);
    const user = JSON.parse(sessionStorage.getItem("currentUser"));

    document.getElementById("disp-drug-name").innerText = `${drug['藥品名稱']} (${drug['藥品代碼']})`;
    document.getElementById("disp-pharmacist-id").value = user.id;
    document.getElementById("disp-pharmacist-name").value = user.name;
    
    // 👉 預設篩選區間：[今天 - 管制天數] ~ [今天]
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
    renderDispenseLogs();
    document.getElementById("barcode-input").focus();
};

window.renderDispenseLogs = function() {
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
                <td class="small text-muted">${log['領藥號'] || '-'}</td>
            </tr>`;
        }
    });
    tbody.innerHTML = html || '<tr><td colspan="6" class="text-muted">查無符合紀錄</td></tr>';
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
            
            // 只有在快取過期時(15秒後第一次刷)才會等待，連刷時這裡是 0 毫秒
            await window.smartSync(); 
            
            try {
                await runDispenseCheck(pid, qty, type, no, "");
            } catch(err) {
                console.error(err);
            } finally {
                isProcessingDispense = false;
                barcodeInput.disabled = false;
                barcodeInput.value = ""; 
                barcodeInput.focus();
            }
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
  document.getElementById("disp-check-result").innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> 正在檢核...';
  
  await window.smartSync();
  await runDispenseCheck(pid.trim().toUpperCase(), parseInt(qtyStr), type, "手動", note || "");
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

window.runDispenseCheck = async function(pid, qty, type, no, note) {
    const drugCode = State.currentSelectedDrugCode;
    const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === drugCode);
    
    // 計算管制期界線
    const controlDays = parseInt(drug['管制天數'] || 14);
    const today = new Date();
    today.setHours(0,0,0,0);
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - controlDays);
    
    let targetApp = null;
    let availableRemaining = 0;

    if (type === '發藥') {
        // 👉 2. 智慧尋找：過濾出管制期內的所有有效申請單
        let validApps = State.applications.filter(app => {
            if(String(app['病歷號']).toUpperCase() !== pid || String(app['藥品代碼']).toUpperCase() !== drugCode || app['作廢'] === 'Y') return false;
            const actDateStr = formatAsDate(app['啟用日期']) || formatAsDate(app['收單時間']);
            const actDate = new Date(actDateStr);
            actDate.setHours(0,0,0,0);
            return actDate >= cutoffDate; 
        });

        // 依據「啟用日期」由舊到新排序 (先進先出 FIFO 原則)
        validApps.sort((a,b) => {
            const dateA = new Date(formatAsDate(a['啟用日期'] || a['收單時間']));
            const dateB = new Date(formatAsDate(b['啟用日期'] || b['收單時間']));
            return dateA - dateB; 
        });

        // 逐張計算剩餘額度，找到第一張有餘額的舊單
        for (let app of validApps) {
            const basisId = app['申請單號'] || app['收單時間'];
            
            let usedQty = 0;
            State.dispenseLogs.forEach(log => {
                if (String(log['病歷號']).toUpperCase() === pid && 
                    String(log['藥品代碼']).toUpperCase() === drugCode && 
                    log['作廢'] !== 'Y') {
                    if (log['依據單號'] === basisId) {
                        if (log['調劑類別'] === '發藥') usedQty += parseInt(log['數量'] || 0);
                        if (log['調劑類別'] === '退藥') usedQty -= parseInt(log['數量'] || 0);
                    }
                }
            });

            const maxQty = parseInt(app['申請數量'] || 0);
            const rem = maxQty - usedQty;

            // 只要這張單還有剩餘額度，就決定扣它！
            if (rem > 0) {
                targetApp = app;
                availableRemaining = rem;
                break; 
            }
        }

        if (!targetApp) {
            showDispenseResult("error", `檢核失敗！病患 ${pid} 於管制期內查無有效餘額之申請單。`);
            return;
        }

        if (qty > availableRemaining) {
            showDispenseResult("error", `數量不足！刷入量 (${qty}) 大於最早可用單據之剩餘量 (${availableRemaining})。<br><small>請分次刷入或退回重發。</small>`);
            return;
        }
    }

    const now = new Date();
    // 取出找到的該張申請單的單號，做為扣除依據
    const basisIdStr = targetApp ? (targetApp['申請單號'] || targetApp['收單時間']) : '退藥無依據';
    const user = JSON.parse(sessionStorage.getItem("currentUser"));

    const dataObj = {
        "病歷號": pid,
        "藥品代碼": drugCode,
        "調劑類別": type,
        "數量": qty,
        "依據單號": basisIdStr,
        "領藥號": no,
        "調劑時間": formatAsDate(now) + " " + formatAsTime(now),
        "藥師員工編號": user.id,
        "藥師姓名": user.name,
        "處理單位": user.unit || "",
        "調劑備註": note
    };

    // 👉 1. 極速體感 (Optimistic UI 更新)
    // 直接在本地陣列塞入資料並畫在畫面上，不等待伺服器回應！
    State.dispenseLogs.unshift(dataObj);
    document.getElementById("disp-hist-pid").value = pid;
    renderDispenseLogs();

    if (type === '發藥') {
        const newRem = availableRemaining - qty;
        showDispenseResult("success", `✅ 檢核通過！已從單號 [${basisIdStr.substring(0,8)}...] 扣除，該單尚餘: ${newRem} 支`);
    } else {
        showDispenseResult("success", `✅ 退藥紀錄已建立！退回數量: ${qty}`);
    }

    // 👉 把上傳雲端的工作丟到背景執行 (Background POST)
    postData("submitDispenseLog", dataObj).then(res => {
        if(res.status !== 'success') {
            console.error("背景上傳失敗", res);
            alert(`⚠️ 剛剛對病患 ${pid} 的發退藥上傳雲端失敗，請檢查網路！`);
            // 若失敗，自動把畫面上的假資料收回
            State.dispenseLogs = State.dispenseLogs.filter(l => l !== dataObj);
            renderDispenseLogs();
        }
    });
};
