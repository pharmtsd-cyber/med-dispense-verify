// js/dispense.js
function openDispenseForm() {
  if(!State.currentSelectedDrugCode) return;
  const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode);
  const user = JSON.parse(sessionStorage.getItem("currentUser"));
  
  document.getElementById("disp-form-drug-name").innerText = `${drug['藥品名稱']} (${drug['藥品代碼']})`;
  document.getElementById("disp-back-drug-name").innerText = drug['藥品名稱'];
  document.getElementById("dispense-form").classList.add("d-none-important"); 
  document.getElementById("disp-check-result").classList.add("d-none-important");
  
  document.getElementById("disp-pharmacist-id").value = user.id;
  document.getElementById("disp-pharmacist-name").value = user.name;
  document.getElementById("disp-unit").value = user.unit || "";
  
  switchView('dispense');
  document.getElementById("barcode-input").value = "";
  document.getElementById("barcode-input").focus();
  
  renderActivePatientsTable(); // 渲染清單
}

// 渲染目前有額度的病人清單
function renderActivePatientsTable() {
  const tbody = document.getElementById("disp-active-patients-table");
  if(!tbody) return;
  
  const code = State.currentSelectedDrugCode;
  let patientStats = {}; // { PID: { allowed: x, used: y, start: date, days: d } }

  // 從快取彙整資料
  State.applications.forEach(app => {
    if(String(app['藥品代碼']).toUpperCase() === code && app['作廢'] !== 'Y') {
      const pid = String(app['病歷號']).toUpperCase();
      if(!patientStats[pid]) patientStats[pid] = { allowed: 0, used: 0, start: app['啟用日期'] || app['申請日期'], days: 0 };
      patientStats[pid].allowed += parseInt(app['申請數量'] || 0);
      patientStats[pid].days = Math.max(patientStats[pid].days, parseInt(app['申請天數'] || 0));
      // 找最新的啟用日期
      if(new Date(app['啟用日期']) > new Date(patientStats[pid].start)) {
        patientStats[pid].start = app['啟用日期'];
      }
    }
  });

  State.dispenseLogs.forEach(log => {
    if(String(log['藥品代碼']).toUpperCase() === code && log['作廢'] !== 'Y') {
      const pid = String(log['病歷號']).toUpperCase();
      if(patientStats[pid]) {
        patientStats[pid].used += parseInt(log['調劑數量'] || 0);
        patientStats[pid].used -= parseInt(log['退藥數量'] || 0);
      }
    }
  });

  let html = "";
  Object.keys(patientStats).forEach(pid => {
    const s = patientStats[pid];
    const remain = s.allowed - s.used;
    if(remain > 0) {
      // 計算區間
      let endStr = "未知";
      if(s.start && s.days > 0) {
        const d = new Date(s.start);
        d.setDate(d.getDate() + s.days);
        endStr = formatAsDate(d);
      }
      html += `<tr>
        <td class="fw-bold text-primary">${pid}</td>
        <td>${formatAsDate(s.start)} ~ ${endStr}</td>
        <td>${s.allowed}</td>
        <td class="fw-bold text-success">${remain}</td>
      </tr>`;
    }
  });
  
  tbody.innerHTML = html || '<tr><td colspan="4" class="text-muted">目前無待發藥之病患</td></tr>';
}

document.addEventListener("DOMContentLoaded", () => {
  const barcodeInput = document.getElementById("barcode-input");
  const btnSubmitDisp = document.getElementById("btn-submit-disp");
  const dispForm = document.getElementById("dispense-form");

  if(!barcodeInput) return;

  barcodeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const str = barcodeInput.value.trim().toUpperCase();
      if(!str) return;
      
      if(!document.getElementById("disp-unit").value || !document.getElementById("disp-pharmacist-id").value) {
         alert("請先確認「處理單位」與「作業藥師」已設定！");
         return;
      }

      const parts = str.split(';');
      if (parts.length >= 4) {
        const scannedDrugCode = parts[1];
        if(scannedDrugCode !== State.currentSelectedDrugCode) {
           alert(`⚠️ 條碼解析錯誤：藥袋代碼 (${scannedDrugCode}) 與當前頁面 (${State.currentSelectedDrugCode}) 不符！`);
           barcodeInput.value = "";
           return;
        }
        
        const pid = parts[0];
        const qty = parseInt(parts[3]);
        const type = document.getElementById("disp-type").value;
        
        document.getElementById("disp-patient-id").value = pid;
        document.getElementById("disp-no").value = parts[2];
        document.getElementById("disp-qty").value = qty;
        barcodeInput.value = ""; 
        
        dispForm.classList.remove("d-none-important");
        btnSubmitDisp.disabled = true;
        const resultBox = document.getElementById("disp-check-result");
        resultBox.classList.remove("d-none-important");
        
        // 👉 即時檢核 (不需 await fetch，直接抓取 State 快取，毫秒級完成！)
        let totalAllowed = 0, totalDispensed = 0, totalReturned = 0;
        let historyHtml = "";
        
        State.applications.forEach(app => {
          if(String(app['病歷號']).toUpperCase() === pid && String(app['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode && app['作廢'] !== 'Y') {
            totalAllowed += parseInt(app['申請數量'] || 0);
            const dateStr = formatAsDate(app['申請日期']);
            historyHtml += `<tr><td>${dateStr} <span class="badge bg-primary">${app['申請類別']}</span></td><td class="text-primary fw-bold">+${app['申請數量']}</td><td>-</td><td>-</td></tr>`;
          }
        });

        State.dispenseLogs.forEach(log => {
          if(String(log['病歷號']).toUpperCase() === pid && String(log['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode && log['作廢'] !== 'Y') {
            totalDispensed += parseInt(log['調劑數量'] || 0);
            totalReturned += parseInt(log['退藥數量'] || 0);
            const isDisp = parseInt(log['調劑數量']) > 0;
            const dateStr = formatAsDate(log['調劑日期']) + ' ' + formatAsTime(log['調劑時間']);
            historyHtml += `<tr><td>${dateStr} <span class="badge ${isDisp ? 'bg-success' : 'bg-danger'}">${isDisp ? '調劑' : '退藥'}</span></td><td>-</td><td class="text-success">${isDisp ? log['調劑數量'] : '-'}</td><td class="text-danger">${!isDisp ? log['退藥數量'] : '-'}</td></tr>`;
          }
        });
        
        document.getElementById("disp-history-table").innerHTML = historyHtml || '<tr><td colspan="5" class="text-muted">近期無作業紀錄</td></tr>';

        const currentUsed = totalDispensed - totalReturned;
        const remaining = totalAllowed - currentUsed;
        
        if (type === "調劑") {
          if (totalAllowed === 0) {
            resultBox.className = "alert alert-danger fw-bold";
            resultBox.innerText = "⛔ 阻擋：此病患尚未申請此藥品！";
            return;
          }
          if (qty > remaining) {
            resultBox.className = "alert alert-danger fw-bold";
            resultBox.innerText = `⛔ 阻擋：超量調劑！剩餘額度僅 ${remaining} 支 (欲發 ${qty} 支)`;
            return;
          }
          resultBox.className = "alert alert-success fw-bold";
          resultBox.innerText = `✅ 檢核通過！剩餘額度：${remaining} 支 ➔ 發放後剩餘：${remaining - qty} 支`;
          btnSubmitDisp.disabled = false;
          btnSubmitDisp.classList.remove("d-none-important");
        } else { 
          if (qty > currentUsed) {
            resultBox.className = "alert alert-danger fw-bold";
            resultBox.innerText = `⛔ 阻擋：退藥數量 (${qty}) 大於總已領藥量 (${currentUsed})！`;
            return;
          }
          resultBox.className = "alert alert-success fw-bold";
          resultBox.innerText = `✅ 退藥檢核通過！退入將恢復 ${qty} 支額度。`;
          btnSubmitDisp.disabled = false;
          btnSubmitDisp.classList.remove("d-none-important");
        }
      } else {
        alert("條碼格式不符！");
      }
    }
  });

  dispForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if(!checkNetwork()) return; // 👉 斷線檢查
    
    btnSubmitDisp.disabled = true;
    btnSubmitDisp.innerText = "寫入紀錄中...";
    
    const now = new Date();
    const type = document.getElementById("disp-type").value;
    const qty = parseInt(document.getElementById("disp-qty").value);

    const dataObj = {
      "病歷號": document.getElementById("disp-patient-id").value,
      "藥品代碼": State.currentSelectedDrugCode,
      "選擇調劑或退藥": type,
      "調劑數量": type === "調劑" ? qty : 0,
      "退藥數量": type === "退藥" ? qty : 0,
      "手動或條碼": "條碼掃描",
      "領藥號": document.getElementById("disp-no").value,
      "處理單位": document.getElementById("disp-unit").value,
      "備註": document.getElementById("disp-note").value,
      "調劑日期": formatAsDate(now),
      "調劑時間": formatAsTime(now),
      "藥師員工編號": document.getElementById("disp-pharmacist-id").value,
      "藥師姓名": document.getElementById("disp-pharmacist-name").value
    };

    const res = await postData("submitDispense", dataObj);
    if(res.status === 'success') {
      alert("調劑紀錄已成功儲存！");
      // 👉 成功後直接塞入快取，重新渲染清單
      State.dispenseLogs.push(dataObj);
      renderActivePatientsTable();
      
      dispForm.reset();
      dispForm.classList.add("d-none-important");
      document.getElementById("disp-check-result").classList.add("d-none-important");
      document.getElementById("barcode-input").focus();
      btnSubmitDisp.innerText = "確認寫入紀錄";
    } else {
      alert("錯誤：" + res.message);
      btnSubmitDisp.disabled = false;
      btnSubmitDisp.innerText = "確認寫入紀錄";
    }
  });
});
