// js/drug_manage.js

function renderDrugManageTable() {
  const tableBody = document.getElementById("drug-table-body");
  if(!tableBody) return;
  
  // 👉 直接取用在 main.js 開機時預載好的全域快取
  const allDrugs = State.allDrugs || [];
  tableBody.innerHTML = '';
  
  if (allDrugs.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" class="text-center">目前無藥品資料。</td></tr>';
    return;
  }

  allDrugs.forEach(drug => {
    if(!drug['藥品代碼']) return; 
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="fw-bold">${drug['藥品代碼']}</td>
      <td>${drug['藥品名稱']}</td>
      <td>${drug['管制天數']} 天</td>
      <td>${drug['預設申請天數']} / ${drug['預設申請數量']}</td>
      <td>${drug['展延天數上限']} / ${drug['展延數量上限']}</td>
      <td><span class="badge ${String(drug['啟用狀態']).toUpperCase() === 'Y' ? 'bg-success' : 'bg-danger'}">${String(drug['啟用狀態']).toUpperCase() === 'Y' ? '啟用' : '停用'}</span></td>
      <td><button class="btn btn-sm btn-outline-primary btn-edit-drug" data-code="${drug['藥品代碼']}">編輯</button></td>
    `;
    tableBody.appendChild(tr);
  });

  document.querySelectorAll(".btn-edit-drug").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const code = e.target.getAttribute("data-code");
      const drug = State.allDrugs.find(d => String(d['藥品代碼']).toUpperCase() === String(code).toUpperCase());
      if (drug) {
        document.getElementById("drug-code").value = drug['藥品代碼'];
        document.getElementById("drug-name").value = drug['藥品名稱'];
        document.getElementById("drug-control-days").value = drug['管制天數'];
        document.getElementById("drug-default-days").value = drug['預設申請天數'];
        document.getElementById("drug-default-qty").value = drug['預設申請數量'];
        document.getElementById("drug-max-ext-days").value = drug['展延天數上限'];
        document.getElementById("drug-max-ext-qty").value = drug['展延數量上限'];
        document.getElementById("drug-status").value = String(drug['啟用狀態']).toUpperCase() || 'Y';
        document.getElementById("drug-code").setAttribute("readonly", true);
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const drugForm = document.getElementById("drug-form");
  if(!drugForm) return;

  drugForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnSave = document.getElementById("btn-save-drug");
    btnSave.disabled = true;
    btnSave.innerText = "儲存中...";

    const dataObj = {
      "藥品代碼": document.getElementById("drug-code").value.trim().toUpperCase(),
      "藥品名稱": document.getElementById("drug-name").value.trim(),
      "管制天數": document.getElementById("drug-control-days").value,
      "預設申請天數": document.getElementById("drug-default-days").value,
      "預設申請數量": document.getElementById("drug-default-qty").value,
      "展延天數上限": document.getElementById("drug-max-ext-days").value,
      "展延數量上限": document.getElementById("drug-max-ext-qty").value,
      "啟用狀態": document.getElementById("drug-status").value
    };

    const res = await postData("saveDrug", dataObj);
    if(res.status === 'success') {
      alert("藥品設定已儲存！");
      // 👉 儲存完後重新把最新資料庫抓回快取，並即時重繪表格
      State.allDrugs = await fetchData('getAllDrugs');
      renderDrugManageTable(); 
      document.getElementById("btn-clear-drug").click();
    } else {
      alert("錯誤：" + res.message);
    }
    btnSave.disabled = false;
    btnSave.innerText = "儲存藥品設定";
  });

  document.getElementById("btn-clear-drug").addEventListener("click", () => {
    drugForm.reset();
    document.getElementById("drug-code").removeAttribute("readonly");
  });
});
