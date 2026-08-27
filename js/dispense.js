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
  
  if(user.unit) {
    const radio = document.querySelector(`input[name="disp-unit-radio"][value="${user.unit}"]`);
    if(radio) radio.checked = true;
  }
  
  document.getElementById("disp-type-disp").checked = true;
  document.getElementById("disp-type-disp").dispatchEvent(new Event('change', {bubbles: true}));
  
  switchView('dispense');
  document.getElementById("barcode-input").value = "";
  document.getElementById("barcode-input").focus();
  document.getElementById("disp-check-result").classList.add("d-none-important");
  
  renderDispenseHistory(); 
}

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
  const tbody = document.getElementById("disp-history-table");
  if(!tbody) return;
  
  let pidFilter = forcePid || document.getElementById("disp-hist-pid").value.trim().toUpperCase();
  if(forcePid) document.getElementById("disp-hist-pid").value = pidFilter;
  
  const startStr = document.getElementById("disp-hist-start").value.replace(/-/g, '/');
  const endStr = document.getElementById("disp-hist-end").value.replace(/-/g, '/');
  
  // 👉 修復：排序過濾時間
  let sortedLogs = [...State.dispenseLogs].sort((a,b) => new Date(formatAsDate(b['調劑日期'])+' '+(formatAsTime(b['調劑時間'])||'00:00:00')) - new Date(formatAsDate(a['調劑日期'])+' '+(formatAsTime(a['調劑時間'])||'00:00:00')));
  
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
      
      // 👉 修復：渲染時過濾時間
      html += `<tr>
        <td>${logDateStr} ${formatAsTime(log['調劑時間'])}</td>
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
            
            // 👉 修復：尋找最新依據時過濾時間
            if(!latestApp || new Date(formatAsDate(a['申請日期'])+' '+(formatAsTime(a['收單時間'])||'00:00:00')) > new Date(formatAsDate(latestApp['申請日期'])+' '+(formatAsTime(latestApp['收單時間'])||'00:00:00'))) {
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
  const { latestApp } = calculatePatientQuota(pid, State.currentSelectedDrugCode);
  const contentBox = document.getElementById("appDetailContent");
  if(latestApp) {
    // 👉 修復：如果單號沒有，就代表是快取的資料，並正確顯示啟用日期
    const appNo = latestApp['申請單號'] ? latestApp['申請單號'] : '剛成立單據(系統拋轉中)';
    contentBox.innerHTML = `
      <ul class="list-group">
        <li class="list-group-item"><b>依據單號：</b><span class="text-danger fw-bold">${appNo}</span></li>
        <li class="list-group-item"><b>收單時間：</b>${formatAsDate(latestApp['申請日期'])} ${formatAsTime(latestApp['收單時間'])}</li>
        <li class="list-group-item"><b>病歷號：</b><span class="text-primary fw-bold">${latestApp['病歷號']}</span></li>
        <li class="list-group-item"><b>單據類別：</b><span class="badge bg-primary fs-6">${latestApp['申請類別']}</span></li>
        <li class="list-group-item"><b>啟用日期：</b>${formatAsDate(latestApp['啟用日期']) || '-'}</li>
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
    
    const unitEl = document.querySelector('input[name="disp-unit-radio"]:checked');
    const processUnit = unitEl ? unitEl.value : "";

    const now = new Date();
    const dataObj = {
      "病歷號": pid,
      "藥品代碼": State.currentSelectedDrugCode,
      "選擇調劑或退藥": type,
      "調劑數量": type === "調劑" ? qty : 0,
      "退藥數量": type === "退藥" ? qty : 0,
      "手動或條碼": no ? "條碼掃描" : "手動輸入",
      "領藥號": no || "-",
      "處理單位": processUnit,
      "備註": note || "",
      "調劑日期": formatAsDate(now),
      // 👉 修正重點：儲存時強制給予「完整日期 + 時間」
      "調劑時間": formatAsDate(now) + " " + formatAsTime(now),
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
    const unitEl = document.querySelector('input[name="disp-unit-radio"]:checked');
    if(!unitEl || !document.getElementById("disp-pharmacist-id").value) {
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
  
  const type = document.querySelector('input[name="disp-type"]:checked').value;
  const note = prompt("請輸入備註 (退藥必填)：");
  
  isProcessingDispense = true;
  
  // 👉 手動輸入時也進行智能同步
  document.getElementById("disp-check-result").classList.remove("d-none-important");
  document.getElementById("disp-check-result").className = "alert alert-info";
  document.getElementById("disp-check-result").innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> 正在與雲端同步最新資料...';
  await window.smartSync();
  
  await runDispenseCheck(pid.trim().toUpperCase(), parseInt(qtyStr), type, null, note);
  isProcessingDispense = false;
};

document.addEventListener("DOMContentLoaded", () => {
  const barcodeInput = document.getElementById("barcode-input");
  if(!barcodeInput) return;

// 請在 js/dispense.js 找到這段並完全替換：

  barcodeInput.addEventListener("keypress", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        
        if(isProcessingDispense) return;
        
        const str = barcodeInput.value.trim().toUpperCase();
        if(!str) return;
        
        const parts = str.split(';');
        
        // 依據您的格式，至少需要前 4 段資料
        if (parts.length >= 4) {
          
          // 👇 精準對應您的真實條碼格式
          const pid = parts[0].trim();                      // [0] 病歷號 (如: 1038391)
          const scanDrugCode = parts[1].trim();             // [1] 藥品代碼 (如: IRE*D1)
          const no = parts[2].trim();                       // [2] 領藥號 (如: 80048)
          const qty = parseInt(parts[3].trim()) || 1;       // [3] 數量 (如: 2)
          // parts[4] (條碼ID) 與 parts[5] (用法) 暫時不需傳入檢核，留存即可
          
          // 👉 終極防呆：確保刷入的藥，跟目前畫面所在的藥品專區是一樣的！
          if (State.currentSelectedDrugCode && scanDrugCode !== State.currentSelectedDrugCode) {
              alert(`⛔ 刷錯藥品了！\n您目前停留在【${State.currentSelectedDrugCode}】的專區，\n但條碼顯示這支藥是【${scanDrugCode}】！\n請切換至正確的藥品專區再行發藥。`);
              barcodeInput.value = "";
              return;
          }
  
          const typeEl = document.querySelector('input[name="disp-type"]:checked');
          const type = typeEl ? typeEl.value : '發藥';
          
          isProcessingDispense = true;
          barcodeInput.disabled = true;
          
          barcodeInput.placeholder = "雲端檢核中...";
          await window.smartSync(); 
          
          try {
              // 把拆解出來的病歷號、數量、領藥號傳入檢核系統
              await runDispenseCheck(pid, qty, type, no, "");
          } catch(err) {
              console.error(err);
          } finally {
              isProcessingDispense = false;
              barcodeInput.disabled = false;
              barcodeInput.value = ""; 
              barcodeInput.placeholder = "確認上方設定無誤後，請刷入藥袋條碼...";
              barcodeInput.focus();
          }
        } else {
          alert("⛔ 條碼格式錯誤！請確認刷入的是完整的二維條碼 (至少包含: 病歷號;藥品;領藥號;數量)。");
          barcodeInput.value = "";
        }
      }
  });
});
