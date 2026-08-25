// js/drug_manage.js

let currentCustomCategories = [];

// 👉 渲染自訂類別編輯區塊 (加入獨立的天數與數量設定)
window.renderCustomCategories = function() {
    const container = document.getElementById("custom-categories-container");
    if (!container) return;
    container.innerHTML = "";
    currentCustomCategories.forEach((cat, idx) => {
        container.innerHTML += `
            <div class="border rounded p-2 mb-2 bg-light position-relative shadow-sm">
                <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1" onclick="removeCustomCategory(${idx})"><i class="bi bi-x"></i></button>
                <div class="row g-2 me-4">
                    <div class="col-md-5">
                        <label class="small text-muted fw-bold mb-0">選項文字</label>
                        <input type="text" class="form-control form-control-sm border-primary" placeholder="例: 預防性投藥" value="${cat.name || ''}" onchange="currentCustomCategories[${idx}].name = this.value">
                    </div>
                    <div class="col-md-7">
                        <label class="small text-muted fw-bold mb-0">選項描述</label>
                        <input type="text" class="form-control form-control-sm border-info" placeholder="例: 手術前使用..." value="${cat.desc || ''}" onchange="currentCustomCategories[${idx}].desc = this.value">
                    </div>
                    <div class="col-3">
                        <label class="small text-muted mb-0">預設天數</label>
                        <input type="number" class="form-control form-control-sm" value="${cat.defDays || 3}" onchange="currentCustomCategories[${idx}].defDays = this.value">
                    </div>
                    <div class="col-3">
                        <label class="small text-muted mb-0">預設數量</label>
                        <input type="number" class="form-control form-control-sm" value="${cat.defQty || 3}" onchange="currentCustomCategories[${idx}].defQty = this.value">
                    </div>
                    <div class="col-3">
                        <label class="small text-muted mb-0 text-danger">天數上限</label>
                        <input type="number" class="form-control form-control-sm border-danger" value="${cat.maxDays || 5}" onchange="currentCustomCategories[${idx}].maxDays = this.value">
                    </div>
                    <div class="col-3">
                        <label class="small text-muted mb-0 text-danger">數量上限</label>
                        <input type="number" class="form-control form-control-sm border-danger" value="${cat.maxQty || 5}" onchange="currentCustomCategories[${idx}].maxQty = this.value">
                    </div>
                </div>
            </div>
        `;
    });
};

window.addCustomCategory = function() {
    currentCustomCategories.push({name: "", desc: "", defDays: 3, defQty: 3, maxDays: 5, maxQty: 5});
    renderCustomCategories();
};

window.removeCustomCategory = function(idx) {
    currentCustomCategories.splice(idx, 1);
    renderCustomCategories();
};

function renderDrugManageTable() {
  const tableBody = document.getElementById("drug-table-body");
  if(!tableBody) return;
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
        
        try {
            currentCustomCategories = drug['自訂類別'] ? JSON.parse(drug['自訂類別']) : [];
        } catch(e) { currentCustomCategories = []; }
        renderCustomCategories();
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
    
    const validCats = currentCustomCategories.filter(c => c.name.trim() !== "");

    const dataObj = {
      "藥品代碼": document.getElementById("drug-code").value.trim().toUpperCase(),
      "藥品名稱": document.getElementById("drug-name").value.trim(),
      "管制天數": document.getElementById("drug-control-days").value,
      "預設申請天數": document.getElementById("drug-default-days").value,
      "預設申請數量": document.getElementById("drug-default-qty").value,
      "展延天數上限": document.getElementById("drug-max-ext-days").value,
      "展延數量上限": document.getElementById("drug-max-ext-qty").value,
      "啟用狀態": document.getElementById("drug-status").value,
      "自訂類別": JSON.stringify(validCats)
    };

    const res = await postData("saveDrug", dataObj);
    if(res.status === 'success') {
      alert("藥品設定已儲存！");
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
    currentCustomCategories = [];
    renderCustomCategories();
  });
});
