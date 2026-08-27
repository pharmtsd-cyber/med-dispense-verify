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
    
    const dispTypeDisp = document.getElementById("disp-type-disp");
    if(dispTypeDisp) {
        dispTypeDisp.checked = true;
        dispTypeDisp.dispatchEvent(new Event('change'));
    }
    
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

            const logTypeStr = log['調劑類別'] || log['選擇調劑或退藥'] || '調劑';
            const isDispense = logTypeStr.includes('調劑');
            const displayBadgeStr = isDispense ? '調劑' : '退藥';
            
            let displayQty = log['數量'];
            if (displayQty === undefined || displayQty === "") {
                const dQty = parseInt(log['調劑數量']) || 0;
                const rQty = parseInt(log['退藥數量']) || 0;
                displayQty = isDispense ? -(dQty) : rQty;
            }

            const basisId = log['依據單號'];
            let basisHtml = '-';
            
            if (basisId === undefined || basisId === 'undefined') {
                basisHtml = `<span class="badge bg-danger">缺表頭: 依據單號</span>`;
            } else if (basisId && basisId !== '手動無單號' && basisId !== '退藥紀錄' && basisId !== '退藥無依據') {
                basisHtml = `<button class="btn btn-sm btn-outline-primary py-0 px-2 fw-bold" onclick="showAppDetails('${basisId}')" style="font-size: 0.8rem; border-radius: 12px;"><i class="bi bi-file-earmark-text"></i> ${basisId.substring(0, 12)}${basisId.length > 12 ? '...' : ''}</button>`;
            } else if (basisId) {
                basisHtml = `<span class="small text-muted">${basisId}</span>`;
            }

            let noHtml = log['領藥號'] || '-';
            if (!isDispense && log['退藥號']) {
                noHtml = `${log['領藥號'] || '-'} <br><span class="text-danger small">退: ${log['退藥號']}</span>`;
            }

            html += `<tr>
                <td>${logDateStr} ${formatAsTime(log['調劑時間'])}</td>
                <td class="fw-bold text-primary">${logPid}</td>
                <td><span class="badge ${isDispense ? 'bg-success' : 'bg-danger'}">${displayBadgeStr}</span></td>
                <td class="fw-bold ${isDispense ? 'text-success' : 'text-danger'}">${displayQty > 0 ? '+' : ''}${displayQty}</td>
                <td class="small text-muted">${noHtml}</td>
                <td>${basisHtml}</td>
            </tr>`;
        }
    });
    tbody.innerHTML = html || '<tr><td colspan="6" class="text-muted">區間內查無符合紀錄</td></tr>';
};

window.showAppDetails = function(appId) {
    // 👉 修正：全面使用「依據單號」來找原申請單
    const app = State.applications.find(a => a['依據單號'] === appId || a['收單時間'] === appId);
    const contentDiv = document.getElementById("appDetailContent");

    if (!app) {
        contentDiv.innerHTML = '<div class="alert alert-warning"><i class="bi bi-exclamation-triangle"></i> 找不到對應的申請單紀錄，可能已被作廢或系統尚未同步。</div>';
    } else {
        contentDiv.innerHTML = `
            <table class="table table-bordered table-sm mb-0 align-middle">
                <tbody>
                    <tr><th class="bg-light text-end" width="30%">依據單號</th><td class="text-secondary font-monospace small">${app['依據單號'] || '-'}</td></tr>
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
            const no = parts[2].trim(); 
            const qty = parseInt(parts[3].trim()) || 1; 
            
            if (State.currentSelectedDrugCode && scanDrugCode !== State.currentSelectedDrugCode) {
                showDispenseResult("error", `⛔ 刷錯藥品！此條碼為【${scanDrugCode}】，非目前所在的【${State.currentSelectedDrugCode}】。`);
                barcodeInput.value = "";
                return;
            }

            const typeEl = document.querySelector('input[name="disp-type"]:checked');
            const type = typeEl ? typeEl.value : '調劑';
            
            let note = document.getElementById("disp-note-input") ? document.getElementById("disp-note-input").value.trim() : "";
            
            let retNo = "";
            if (type === '退藥') {
                retNo = prompt("🔄 您選擇了【退藥作業】\n請輸入「退藥號」：");
                if (!retNo) {
                    barcodeInput.value = "";
                    return; 
                }
            }
            
            isProcessingDispense = true;
            barcodeInput.disabled = true;
            
            await executeDispenseFlow(pid, qty, type, no, retNo, note, "條碼");
            
            isProcessingDispense = false;
            barcodeInput.disabled = false;
            barcodeInput.value = ""; 
            if(document.getElementById("disp-note-input")) document.getElementById("disp-note-input").value = ""; 
            barcodeInput.focus();
          } else {
            showDispenseResult("error", "⛔ 條碼格式錯誤！請確認刷入的是完整的二維條碼。");
            barcodeInput.value = "";
          }
        }
    });
}

window.manualDispenseModal = function() {
    if(isProcessingDispense) return; 
    
    const typeEl = document.querySelector('input[name="disp-type"]:checked');
    const type = typeEl ? typeEl.value : '調劑';
    
    const retGroup = document.getElementById("manual-ret-no-group");
    const retInput = document.getElementById("manual-ret-no");
    if(retGroup && retInput) {
        if (type === '退藥') {
            retGroup.style.display = 'block';
            retInput.required = true;
        } else {
            retGroup.style.display = 'none';
            retInput.required = false;
        }
    }
    
    const form = document.getElementById("manual-dispense-form");
    if(form) form.reset();
    
    const modalEl = document.getElementById('manualDispenseModalElement');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
};

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('input[name="disp-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const isReturn = e.target.value === '退藥';
            const scanCard = document.getElementById('disp-scan-card');
            const scanBody = document.getElementById('disp-scan-body');
            const scanTitle = document.getElementById('disp-scan-title');
            const barcodeInp = document.getElementById('barcode-input');
            const noteInp = document.getElementById('disp-note-input');

            if (isReturn) {
                if(scanCard) scanCard.classList.replace('border-success', 'border-danger');
                if(scanBody) scanBody.classList.replace('bg-success', 'bg-danger');
                if(scanTitle) {
                    scanTitle.classList.replace('text-success', 'text-danger');
                    scanTitle.innerHTML = '<i class="bi bi-upc-scan"></i> 條碼掃描區 (🔴 退藥模式 - 補回額度)';
                }
                if(barcodeInp) barcodeInp.classList.replace('border-success', 'border-danger');
                if(noteInp) noteInp.classList.replace('border-success', 'border-danger');
            } else {
                if(scanCard) scanCard.classList.replace('border-danger', 'border-success');
                if(scanBody) scanBody.classList.replace('bg-danger', 'bg-success');
                if(scanTitle) {
                    scanTitle.classList.replace('text-danger', 'text-success');
                    scanTitle.innerHTML = '<i class="bi bi-upc-scan"></i> 條碼掃描區 (🟢 調劑模式 - 即時寫入)';
                }
                if(barcodeInp) barcodeInp.classList.replace('border-danger', 'border-success');
                if(noteInp) noteInp.classList.replace('border-danger', 'border-success');
            }
        });
    });

    const manualForm = document.getElementById("manual-dispense-form");
    if(manualForm) {
        manualForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if(isProcessingDispense) return;
            
            const typeEl = document.querySelector('input[name="disp-type"]:checked');
            const type = typeEl ? typeEl.value : '調劑';
            
            const pid = document.getElementById("manual-pid").value.trim().toUpperCase();
            const qty = parseInt(document.getElementById("manual-qty").value);
            const no = document.getElementById("manual-no").value.trim();
            
            const retInput = document.getElementById("manual-ret-no");
            const retNo = retInput ? retInput.value.trim() : "";
            const note = document.getElementById("manual-note").value.trim();
            
            isProcessingDispense = true;
            
            const submitBtn = manualForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerText;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>檢核中...';
            
            document.getElementById("disp-check-result").classList.add("d-none-important");
            
            const success = await executeDispenseFlow(pid, qty, type, no || "", retNo, note, "手動");
            
            isProcessingDispense = false;
            submitBtn.disabled = false;
            submitBtn.innerText = originalBtnText;

            if (success) {
                const modalEl = document.getElementById('manualDispenseModalElement');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if(modal) modal.hide();
                manualForm.reset();
            }
        });
    }
});

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

async function executeDispenseFlow(pid, qty, type, no, retNo, note, inputMethod) {
    let checkResult = performDispenseCalculation(pid, qty, type, no);
    
    if (!checkResult.success && type === '調劑') {
        document.getElementById("disp-check-result").classList.remove("d-none-important");
        document.getElementById("disp-check-result").className = "alert alert-warning fs-6";
        document.getElementById("disp-check-result").innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> 本地餘額不足，正在向雲端確認最新單據...';
        
        await window.smartSync(true); 
        checkResult = performDispenseCalculation(pid, qty, type, no); 
    }

    if (!checkResult.success) {
        showDispenseResult("error", checkResult.msg);
        return false;
    }

    const now = new Date();
    const user = JSON.parse(sessionStorage.getItem("currentUser"));
    const signedQty = (type === '調劑') ? -Math.abs(qty) : Math.abs(qty);
    
    const dataObj = {
        "調劑流水號": "", // 後端會自動產生 DIS- 流水號
        "病歷號": pid,
        "藥品代碼": State.currentSelectedDrugCode,
        "調劑類別": type,
        "選擇調劑或退藥": type === '調劑' ? '調劑發藥' : '退藥作業',
        "手動或條碼": inputMethod,
        "調劑數量": type === '調劑' ? Math.abs(qty) : 0, 
        "退藥數量": type === '退藥' ? Math.abs(qty) : 0,
        "數量": signedQty,
        "依據單號": checkResult.basisId, // 👉 成功對接 Application 的主鍵
        "領藥號": no,
        "退藥號": retNo,      
        "調劑日期": formatAsDate(now),
        "調劑時間": formatAsDate(now) + " " + formatAsTime(now),
        "藥師員工編號": user.id,
        "藥師姓名": user.name,
        "處理單位": user.unit || "",
        "調劑備註": note    
    };

    State.dispenseLogs.unshift(dataObj);
    document.getElementById("disp-hist-pid").value = pid;
    renderDispenseHistory();

    if (type === '調劑') {
        const newRem = checkResult.availableRemaining - Math.abs(qty);
        showDispenseResult("success", `✅ 檢核通過！依據單號 [${checkResult.basisId.substring(0,10)}...] 扣除，該單尚餘: ${newRem} 支`);
    } else {
        showDispenseResult("success", `✅ 退藥檢核通過！已將 ${qty} 支額度補回原申請單 [${checkResult.basisId.substring(0,10)}...]`);
    }

    postData("submitDispense", dataObj).then(res => {
        if(res.status !== 'success') {
            console.error("背景上傳失敗", res);
            alert(`⚠️ 病患 ${pid} 的作業上傳雲端失敗，請檢查網路！`);
            State.dispenseLogs = State.dispenseLogs.filter(l => l !== dataObj);
            renderDispenseHistory();
        }
    });
    
    return true; 
}

function performDispenseCalculation(pid, qty, type, originalNo) {
    const drugCode = State.currentSelectedDrugCode;
    const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === drugCode);
    
    let allPatientApps = State.applications.filter(app => {
        return String(app['病歷號']).toUpperCase() === pid && 
               String(app['藥品代碼']).toUpperCase() === drugCode && 
               app['作廢'] !== 'Y';
    });

    if (type === '退藥') {
        let targetApp = null;
        let maxReturnable = 0;

        allPatientApps.sort((a,b) => {
            const dateA = new Date(formatAsDate(a['啟用日期'] || a['收單時間']));
            const dateB = new Date(formatAsDate(b['啟用日期'] || b['收單時間']));
            return dateB - dateA; 
        });

        if (originalNo && originalNo !== "手動無單號") {
            const originalLog = State.dispenseLogs.find(log => {
                const logTypeStr = log['調劑類別'] || log['選擇調劑或退藥'] || '';
                return String(log['病歷號']).toUpperCase() === pid && 
                       String(log['藥品代碼']).toUpperCase() === drugCode && 
                       log['作廢'] !== 'Y' && 
                       log['領藥號'] === originalNo && 
                       logTypeStr.includes('調劑');
            });
            if (originalLog) {
                // 👉 修正：精準使用「依據單號」來關聯
                targetApp = allPatientApps.find(a => (a['依據單號'] || a['收單時間']) === originalLog['依據單號']);
            }
        }

        if (targetApp) {
            const basisId = targetApp['依據單號'] || targetApp['收單時間'];
            let netDispensed = 0;
            State.dispenseLogs.forEach(log => {
                if (String(log['病歷號']).toUpperCase() === pid && String(log['藥品代碼']).toUpperCase() === drugCode && log['作廢'] !== 'Y' && log['依據單號'] === basisId) {
                    netDispensed += parseInt(log['調劑數量'] || 0);
                    netDispensed -= parseInt(log['退藥數量'] || 0);
                }
            });
            maxReturnable = netDispensed;
            if (qty > maxReturnable) targetApp = null; 
        }

        if (!targetApp) {
            for (let app of allPatientApps) {
                const basisId = app['依據單號'] || app['收單時間'];
                let netDispensed = 0;
                State.dispenseLogs.forEach(log => {
                    if (String(log['病歷號']).toUpperCase() === pid && String(log['藥品代碼']).toUpperCase() === drugCode && log['作廢'] !== 'Y' && log['依據單號'] === basisId) {
                        netDispensed += parseInt(log['調劑數量'] || 0);
                        netDispensed -= parseInt(log['退藥數量'] || 0);
                    }
                });
                if (netDispensed >= qty) {
                    targetApp = app;
                    maxReturnable = netDispensed;
                    break;
                }
            }
        }

        if (!targetApp) {
            return { success: false, msg: `退藥失敗！病患 ${pid} 查無可退額度的申請單，或可退額度不足。` };
        }

        return { 
            success: true, 
            basisId: targetApp['依據單號'] || targetApp['收單時間'],
            availableRemaining: maxReturnable 
        };
    }

    const controlDays = parseInt(drug['管制天數'] || 14);
    const today = new Date();
    today.setHours(0,0,0,0);
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - controlDays);
    
    let validApps = allPatientApps.filter(app => {
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
        // 👉 修正：使用「依據單號」作為追蹤基準
        const basisId = app['依據單號'] || app['收單時間'];
        let usedQty = 0;
        
        State.dispenseLogs.forEach(log => {
            if (String(log['病歷號']).toUpperCase() === pid && 
                String(log['藥品代碼']).toUpperCase() === drugCode && 
                log['作廢'] !== 'Y' && 
                log['依據單號'] === basisId) {
                
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
        basisId: targetApp['依據單號'] || targetApp['收單時間'],
        availableRemaining: availableRemaining 
    };
}
