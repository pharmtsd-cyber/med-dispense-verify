let isProcessingDispense = false;

window.openDispenseForm = function() {
    if(!State.currentSelectedDrugCode) return;
    const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode);
    const user = JSON.parse(sessionStorage.getItem("currentUser"));

    const drugNameEl = document.getElementById("disp-form-drug-name") || document.getElementById("disp-drug-name");
    if(drugNameEl) drugNameEl.innerText = `${drug['藥品名稱']} (${drug['藥品代碼']})`;
    
    const pharIdEl = document.getElementById("disp-pharmacist-id");
    if(pharIdEl) pharIdEl.value = user.id;
    
    const pharNameEl = document.getElementById("disp-pharmacist-name");
    if(pharNameEl) pharNameEl.value = user.name;
    
    if(user.unit) {
        const unitRadio = document.querySelector(`input[name="disp-unit-radio"][value="${user.unit}"]`);
        if(unitRadio) unitRadio.checked = true;
    }
    
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
        if(String(log['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode) {
            const logPid = String(log['病歷號']).toUpperCase();
            if(pidFilter && !logPid.includes(pidFilter)) return;
            
            const logDateStr = formatAsDate(log['調劑時間']);
            if(startStr && logDateStr < startStr) return;
            if(endStr && logDateStr > endStr) return;

            const isVoid = log['作廢'] === 'Y';
            const logTypeStr = log['調劑類別'] || log['選擇調劑或退藥'] || '調劑';
            const isDispense = logTypeStr.includes('調劑');
            const displayBadgeStr = isDispense ? '調劑' : '退藥';
            
            let displayQty = log['數量'];
            if (displayQty === undefined || displayQty === "") {
                const dQty = parseInt(log['調劑數量']) || 0;
                const rQty = parseInt(log['退藥數量']) || 0;
                displayQty = isDispense ? -(dQty) : rQty;
            }

            const basisId = log['申請單號'];
            let basisHtml = '-';
            if (basisId === undefined || basisId === 'undefined') {
                basisHtml = `<span class="badge bg-danger">缺表頭: 申請單號</span>`;
            } else if (basisId && basisId !== '手動無單號' && basisId !== '退藥紀錄' && basisId !== '無申請單號') {
                basisHtml = `<button class="btn btn-sm ${isVoid ? 'btn-outline-secondary' : 'btn-outline-primary'} py-0 px-2 fw-bold" onclick="showAppDetails('${basisId}')" style="font-size: 0.8rem; border-radius: 12px;"><i class="bi bi-file-earmark-text"></i> ${basisId.substring(0, 12)}${basisId.length > 12 ? '...' : ''}</button>`;
            } else if (basisId) {
                basisHtml = `<span class="small text-muted">${basisId}</span>`;
            }

            let noHtml = log['領藥號'] || '-';
            if (!isDispense && log['退藥號']) {
                noHtml = `${log['領藥號'] || '-'} <br><span class="text-danger small">退: ${log['退藥號']}</span>`;
            }

            const logId = log['調劑流水號'] || log['申請單號']; 
            const actionButtons = `
              <div class="btn-group btn-group-sm shadow-sm">
                ${isVoid 
                  ? `<button class="btn btn-outline-success" onclick="openActionModal('DIS', 'RESTORE', '${logId}')">還原</button>`
                  : `<button class="btn btn-outline-danger" onclick="openActionModal('DIS', 'VOID', '${logId}')">作廢</button>`
                }
              </div>
            `;

            const rowClass = isVoid ? 'bg-light text-muted text-decoration-line-through opacity-75' : '';

            html += `<tr class="${rowClass}">
                <td>${logDateStr} ${formatAsTime(log['調劑時間'])}</td>
                <td class="fw-bold ${isVoid ? '' : 'text-primary'}">${logPid}</td>
                <td><span class="badge ${isVoid ? 'bg-secondary' : (isDispense ? 'bg-success' : 'bg-danger')}">${displayBadgeStr}</span></td>
                <td class="fw-bold ${isVoid ? '' : (isDispense ? 'text-success' : 'text-danger')}">${displayQty > 0 ? '+' : ''}${displayQty}</td>
                <td class="small">${noHtml}</td>
                <td>${basisHtml}</td>
                <td>${actionButtons}</td>
            </tr>`;
        }
    });
    tbody.innerHTML = html || '<tr><td colspan="7" class="text-center text-muted">區間內查無符合紀錄</td></tr>';
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
    
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('manualDispenseModalElement'));
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
            const retNo = document.getElementById("manual-ret-no") ? document.getElementById("manual-ret-no").value.trim() : "";
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
                bootstrap.Modal.getInstance(document.getElementById('manualDispenseModalElement')).hide();
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
    } else {
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
    const unitEl = document.querySelector('input[name="disp-unit-radio"]:checked');
    const selectedUnit = unitEl ? unitEl.value : (user.unit || "");
    
    let basisIdsUsed = [];

    for (let plan of checkResult.deductionPlan) {
        const splitQty = plan.deductQty;
        const splitSignedQty = (type === '調劑') ? -Math.abs(splitQty) : Math.abs(splitQty);
        const basisId = plan.basisId;
        basisIdsUsed.push(basisId.substring(0,10));
        
        const dataObj = {
            "調劑流水號": "", 
            "病歷號": pid,
            "藥品代碼": State.currentSelectedDrugCode,
            "調劑類別": type,
            "選擇調劑或退藥": type === '調劑' ? '調劑發藥' : '退藥作業',
            "手動或條碼": inputMethod,
            "調劑數量": type === '調劑' ? Math.abs(splitQty) : 0, 
            "退藥數量": type === '退藥' ? Math.abs(splitQty) : 0,
            "數量": splitSignedQty,
            "申請單號": basisId, 
            "領藥號": no,
            "退藥號": retNo,      
            "調劑日期": formatAsDate(now),
            "調劑時間": formatAsDate(now) + " " + formatAsTime(now),
            "藥師員工編號": user.id,
            "藥師姓名": user.name,
            "處理單位": selectedUnit,
            "調劑退藥理由": note    
        };

        State.dispenseLogs.unshift(dataObj);

        postData("submitDispense", dataObj).then(res => {
            if(res.status !== 'success') {
                console.error("背景上傳失敗", res);
                alert(`⚠️ 病患 ${pid} 的部分作業上傳雲端失敗，請檢查網路！`);
                State.dispenseLogs = State.dispenseLogs.filter(l => l !== dataObj);
                renderDispenseHistory();
            }
        });
    }

    document.getElementById("disp-hist-pid").value = pid;
    renderDispenseHistory();

    const uniqueBasisIds = [...new Set(basisIdsUsed)].join(', ');

    if (type === '調劑') {
        const newRem = checkResult.totalAvailableRemaining - Math.abs(qty);
        showDispenseResult("success", `✅ 檢核通過！依據單號 [${uniqueBasisIds}...] 扣除共 ${qty} 支，總餘額尚有: ${newRem} 支`);
    } else {
        showDispenseResult("success", `✅ 退藥檢核通過！已將 ${qty} 支額度補回原申請單 [${uniqueBasisIds}...]`);
    }

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
        allPatientApps.sort((a,b) => {
            const dateA = new Date(formatAsDate(a['啟用日期'] || a['收單時間']));
            const dateB = new Date(formatAsDate(b['啟用日期'] || b['收單時間']));
            return dateB - dateA; 
        });

        let appDispensed = [];
        let totalDispensed = 0;

        allPatientApps.forEach(app => {
            const basisId = app['申請單號'] || app['收單時間'];
            let netDispensed = 0;
            State.dispenseLogs.forEach(log => {
                if (String(log['病歷號']).toUpperCase() === pid && String(log['藥品代碼']).toUpperCase() === drugCode && log['作廢'] !== 'Y' && log['申請單號'] === basisId) {
                    netDispensed += parseInt(log['調劑數量'] || 0);
                    netDispensed -= parseInt(log['退藥數量'] || 0);
                }
            });
            if (netDispensed > 0) {
                totalDispensed += netDispensed;
                appDispensed.push({ basisId: basisId, maxReturnable: netDispensed });
            }
        });

        if (qty > totalDispensed) {
            return { success: false, msg: `退藥失敗！欲退數量 (${qty}) 大於此病患目前可退的總發出額度 (${totalDispensed})。` };
        }

        if (originalNo && originalNo !== "手動無單號") {
             let involvedBasisIds = new Set();
             State.dispenseLogs.forEach(log => {
                if (String(log['病歷號']).toUpperCase() === pid && String(log['藥品代碼']).toUpperCase() === drugCode && log['作廢'] !== 'Y' && log['領藥號'] === originalNo) {
                    involvedBasisIds.add(log['申請單號']);
                }
             });
             appDispensed.sort((a, b) => {
                 const aIn = involvedBasisIds.has(a.basisId) ? 1 : 0;
                 const bIn = involvedBasisIds.has(b.basisId) ? 1 : 0;
                 return bIn - aIn; 
             });
        }

        let remainingQtyToReturn = qty;
        let returnPlan = [];

        for (let ad of appDispensed) {
            if (remainingQtyToReturn <= 0) break;
            const returnAmt = Math.min(ad.maxReturnable, remainingQtyToReturn);
            returnPlan.push({ basisId: ad.basisId, deductQty: returnAmt });
            remainingQtyToReturn -= returnAmt;
        }

        return { success: true, deductionPlan: returnPlan, totalAvailableRemaining: totalDispensed };
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
        return actDate >= cutoffDate && actDate <= today; 
    });

    validApps.sort((a,b) => {
        const dateA = new Date(formatAsDate(a['啟用日期'] || a['收單時間']));
        const dateB = new Date(formatAsDate(b['啟用日期'] || b['收單時間']));
        return dateA - dateB; 
    });

    let totalRem = 0;
    let appBalances = [];

    for (let app of validApps) {
        const basisId = app['申請單號'] || app['收單時間'];
        let usedQty = 0;
        
        State.dispenseLogs.forEach(log => {
            if (String(log['病歷號']).toUpperCase() === pid && 
                String(log['藥品代碼']).toUpperCase() === drugCode && 
                log['作廢'] !== 'Y' && 
                log['申請單號'] === basisId) {
                
                usedQty += parseInt(log['調劑數量'] || 0);
                usedQty -= parseInt(log['退藥數量'] || 0);
            }
        });

        const maxQty = parseInt(app['申請數量'] || 0);
        const rem = maxQty - usedQty;

        if (rem > 0) {
            totalRem += rem;
            appBalances.push({ basisId: basisId, rem: rem });
        }
    }

    if (totalRem === 0) {
        return { success: false, msg: `檢核失敗！病患 ${pid} 於管制期內查無已生效且有餘額之申請單。` };
    }

    if (qty > totalRem) {
        return { success: false, msg: `數量不足！刷入量 (${qty}) 大於此病患目前已生效可用單據之總餘額 (${totalRem})。<br><small>請確認是否有跨療程或未生效的申請單。</small>` };
    }

    let remainingQtyToDeduct = qty;
    let deductionPlan = [];

    for (let ab of appBalances) {
        if (remainingQtyToDeduct <= 0) break;
        const deductAmt = Math.min(ab.rem, remainingQtyToDeduct);
        deductionPlan.push({ basisId: ab.basisId, deductQty: deductAmt });
        remainingQtyToDeduct -= deductAmt;
    }

    return { success: true, deductionPlan: deductionPlan, totalAvailableRemaining: totalRem };
}
