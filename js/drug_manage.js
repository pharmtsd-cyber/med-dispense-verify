// js/drug_manage.js

let currentCustomCategories = [];

window.renderCustomCategories = function() {
    const container = document.getElementById("custom-categories-container");
    if (!container) return;
    container.innerHTML = "";
    
    // 防呆：強制第一筆永遠是初次申請
    if(currentCustomCategories.length === 0 || currentCustomCategories[0].name !== "初次申請") {
        const initCat = currentCustomCategories.find(c => c.name === "初次申請") || {name: "初次申請", desc: "系統強制預設：管制期內第一筆申請必選", defDays: 3, defQty: 3, maxDays: 5, maxQty: 5};
        currentCustomCategories = [initCat, ...currentCustomCategories.filter(c => c.name !== "初次申請")];
    }

    currentCustomCategories.forEach((cat, idx) => {
        const isInit = (idx === 0 && cat.name === "初次申請"); // 第一筆鎖定
        container.innerHTML += `
            <div class="border rounded p-2 mb-2 ${isInit ? 'bg-primary bg-opacity-10' : 'bg-light'} position-relative shadow-sm">
                ${!isInit ? `<button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1" onclick="removeCustomCategory(${idx})"><i class="bi bi-x"></i></button>` : `<span class="badge bg-primary position-absolute top-0 end-0 m-1">系統鎖定必填</span>`}
                <div class="row g-2 me-4">
                    <div class="col-md-5">
                        <label class="small text-muted fw-bold mb-0">選項文字</label>
                        <input type="text" class="form-control form-control-sm border-primary fw-bold" value="${cat.name}" ${isInit ? 'readonly' : `onchange="currentCustomCategories[${idx}].name = this.value"`}>
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
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">目前無藥品資料。</td></tr>';
    return;
  }

  allDrugs.forEach(drug => {
    if(!drug['藥品代碼']) return; 
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="fw-bold">${drug['藥品代碼']}</td>
      <td>${drug['藥品名稱']}</td>
      <td>${drug['管制天數']} 天</td>
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
        // 👉 已經移除對舊欄位 (預設/上限天數量) 的 value 賦值，避免 null 報錯
        document.getElementById("drug-code").value = drug['藥品代碼'];
        document.getElementById("drug-name").value = drug['藥品名稱'];
        document.getElementById("drug-control-days").value = drug['管制天數'];
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
    
    // 👉 儲存時也不再去抓取那 4 個已經刪除的 HTML 元素了
    const dataObj = {
      "藥品代碼": document.getElementById("drug-code").value.trim().toUpperCase(),
      "藥品名稱": document.getElementById("drug-name").value.trim(),
      "管制天數": document.getElementById("drug-control-days").value,
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
