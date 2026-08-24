// js/dispense.js
function openDispenseForm() {
  if(!State.currentSelectedDrugCode) return;
  const drug = State.activeDrugs.find(d => d['藥品代碼'] === State.currentSelectedDrugCode);
  const user = JSON.parse(sessionStorage.getItem("currentUser"));
  
  document.getElementById("disp-form-drug-name").innerText = `${drug['藥品名稱']} (${drug['藥品代碼']})`;
  document.getElementById("disp-back-drug-name").innerText = drug['藥品名稱'];
  document.getElementById("dispense-form").classList.add("d-none-important"); 
  
  document.getElementById("disp-pharmacist-id").value = user.id;
  document.getElementById("disp-pharmacist-name").value = user.name;
  
  switchView('dispense');
  document.getElementById("barcode-input").value = "";
  document.getElementById("barcode-input").focus();
}

document.addEventListener("DOMContentLoaded", () => {
  const barcodeInput = document.getElementById("barcode-input");
  const btnSubmitDisp = document.getElementById("btn-submit-disp");
  const dispForm = document.getElementById("dispense-form");

  if(!barcodeInput) return;

  barcodeInput.addEventListener("keypress", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const str = barcodeInput.value.trim();
      if(!str) return;
      
      if(!document.getElementById("disp-unit").value || !document.getElementById("disp-pharmacist-id").value) {
         alert("請先確認「處理單位」與「作業藥師」已設定！");
         return;
      }

      const parts = str.split(';');
      if (parts.length >= 4) {
        if(parts[1] !== State.currentSelectedDrugCode) {
           alert(`⚠️ 條碼解析錯誤：藥袋藥品代碼 (${parts[1]}) 與系統當前頁面 (${State.currentSelectedDrugCode}) 不符！`);
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
        document.getElementById("disp-check-result").className = "alert alert-warning fw-bold";
        document.getElementById("disp-check-result").innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>正在與後端連線檢核額度...';
        document.getElementById("disp-history-table").innerHTML = "";

        const apps = await fetchData('getApplications');
        const logs = await fetchData('getDispenseLogs');
        
        let totalAllowed = 0, totalDispensed = 0, totalReturned = 0;
        let historyHtml = "";
        
        apps.forEach(app => {
          if(app['病歷號'] === pid && app['藥品代碼'] === State.currentSelectedDrugCode && app['作廢'] !== 'Y') {
            totalAllowed += parseInt(app['申請數量'] || 0);
            historyHtml += `<tr><td>${app['申請日期']} <span class="badge bg-primary">${app['申請類別']}</span></td><td class="text-primary fw-bold">+${app['申請數量']}</td><td>-</td><td>-</td></tr>`;
          }
        });

        logs.forEach(log => {
          if(log['病歷號'] === pid && log['藥品代碼'] === State.currentSelectedDrugCode && log['作廢'] !== 'Y') {
            totalDispensed += parseInt(log['調劑數量'] || 0);
            totalReturned += parseInt(log['退藥數量'] || 0);
            const isDisp = parseInt(log['調劑數量']) > 0;
            historyHtml += `<tr><td>${log['調劑日期']} <span class="badge ${isDisp ? 'bg-success' : 'bg-danger'}">${isDisp ? '調劑' : '退藥'}</span></td><td>-</td><td class="text-success">${isDisp ? log['調劑數量'] : '-'}</td><td class="text-danger">${!isDisp ? log['退藥數量'] : '-'}</td></tr>`;
          }
        });
        
        document.getElementById("disp-history-table").innerHTML = historyHtml || '<tr><td colspan="4" class="text-muted">近期無此藥品作業紀錄</td></tr>';

        const currentUsed = totalDispensed - totalReturned;
        const remaining = totalAllowed - currentUsed;
        
        if (type === "調劑") {
          if (totalAllowed === 0) {
            document.getElementById("disp-check-result").className = "alert alert-danger fw-bold";
            document.getElementById("disp-check-result").innerText = "⛔ 阻擋：此病患尚未申請此藥品！";
            return;
          }
          if (qty > remaining) {
            document.getElementById("disp-check-result").className = "alert alert-danger fw-bold";
            document.getElementById("disp-check-result").innerText = `⛔ 阻擋：超量調劑！剩餘可用額度僅剩 ${remaining} 支 (欲調劑 ${qty} 支)`;
            return;
          }
          document.getElementById("disp-check-result").className = "alert alert-success fw-bold";
          document.getElementById("disp-check-result").innerText = `✅ 檢核通過！目前剩餘額度：${remaining} 支 ➔ 本次調劑後剩餘：${remaining - qty} 支`;
          btnSubmitDisp.disabled = false;
        } else { 
          if (qty > currentUsed) {
            document.getElementById("disp-check-result").className = "alert alert-danger fw-bold";
            document.getElementById("disp-check-result").innerText = `⛔ 阻擋：退藥數量 (${qty}) 大於總已領藥量 (${currentUsed})！`;
            return;
          }
          document.getElementById("disp-check-result").className = "alert alert-success fw-bold";
          document.getElementById("disp-check-result").innerText = `✅ 退藥檢核通過！本次退入將恢復 ${qty} 支額度。`;
          btnSubmitDisp.disabled = false;
        }
      } else {
        alert("條碼格式不符！");
      }
    }
  });

  dispForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    btnSubmitDisp.disabled = true;
    btnSubmitDisp.innerText = "寫入紀錄中...";
    
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
      "調劑日期": new Date().toLocaleDateString('zh-TW'),
      "調劑時間": new Date().toLocaleTimeString('zh-TW'),
      "藥師員工編號": document.getElementById("disp-pharmacist-id").value,
      "藥師姓名": document.getElementById("disp-pharmacist-name").value
    };

    const res = await postData("submitDispense", dataObj);
    if(res.status === 'success') {
      alert("調劑紀錄已成功儲存！");
      dispForm.reset();
      dispForm.classList.add("d-none-important");
      document.getElementById("barcode-input").focus();
      btnSubmitDisp.innerText = "確認寫入紀錄";
    } else {
      alert("錯誤：" + res.message);
      btnSubmitDisp.disabled = false;
      btnSubmitDisp.innerText = "確認寫入紀錄";
    }
  });
});
