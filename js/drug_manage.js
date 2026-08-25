// js/drug_manage.js

let currentCustomCategories = [];

window.renderCustomCategories = function() {
    const container = document.getElementById("custom-categories-container");
    if (!container) return;
    container.innerHTML = "";

    // 自動向下相容舊有資料：將原本的 isBreak 轉換為 type 屬性
    currentCustomCategories.forEach(cat => {
        if (!cat.type) {
            if (cat.name === "初次申請") cat.type = "INITIAL";
            else if (cat.isBreak) cat.type = "BREAK";
            else cat.type = "EXTENSION";
        }
    });

    currentCustomCategories.forEach((cat, idx) => {
        const isInit = (cat.type === "INITIAL"); 
        container.innerHTML += `
            <div class="border rounded p-2 mb-2 ${isInit ? 'bg-primary bg-opacity-10' : 'bg-light'} position-relative shadow-sm">
                <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1" onclick="removeCustomCategory(${idx})"><i class="bi bi-x"></i></button>
                <div class="row g-2 me-4">
                    <div class="col-md-5">
                        <label class="small text-muted fw-bold mb-0">選項文字</label>
                        <input type="text" class="form-control form-control-sm border-primary fw-bold" placeholder="例: 門診初次申請" value="${cat.name}" onchange="currentCustomCategories[${idx}].name = this.value">
                    </div>
                    <div class="col-md-7">
                        <label class="small text-muted fw-bold mb-0">選項描述</label>
                        <input type="text" class="form-control form-control-sm border-info" placeholder="說明文字..." value="${cat.desc || ''}" onchange="currentCustomCategories[${idx}].desc = this.value">
                    </div>
                    <div class="col-6">
                        <label class="small text-muted mb-0">預設天數 (不可大於全局)</label>
                        <input type="number" class="form-control form-control-sm" value="${cat.defDays || 3}" onchange="currentCustomCategories[${idx}].defDays = this.value">
                    </div>
                    <div class="col-6">
                        <label class="small text-muted mb-0">預設數量 (不可大於全局)</label>
                        <input type="number" class="form-control form-control-sm" value="${cat.defQty || 3}" onchange="currentCustomCategories[${idx}].defQty = this.value">
                    </div>
                    
                    <!-- 👉 核心屬性：三種層級的類別屬性 -->
                    <div class="col-12 mt-1">
                        <label class="small text-muted mb-0">類別屬性卡控</label>
                        <select class="form-select form-select-sm border-warning fw-bold" onchange="currentCustomCategories[${idx}].type = this.value; renderCustomCategories();">
                            <option value="INITIAL" ${cat.type === 'INITIAL' ? 'selected' : ''}>🔵 初次類別 (無紀錄時必定且僅能選此類)</option>
                            <option value="EXTENSION" ${cat.type === 'EXTENSION' ? 'selected' : ''}>🟢 一般延伸 (綁定前次日期，合併計算額度)</option>
                            <option value="BREAK" ${cat.type === 'BREAK' ? 'selected' : ''}>🔴 突破限制 (視為新療程，獨立日期與額度)</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    });
};

window.addCustomCategory = function() {
    // 預設給予「一般延伸」
    currentCustomCategories.push({name: "", desc: "", defDays: 3, defQty: 3, type: "EXTENSION"});
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
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">目前無藥品資料。</td></tr>';
    return;
  }

  allDrugs.forEach(drug => {
    if(!drug['藥品代碼']) return; 
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="fw-bold">${drug['藥品代碼']}</td>
      <td>${drug['藥品名稱']}</td>
      <td>${drug['管制天數']} 天</td>
      <td class="text-danger fw-bold">${drug['每次最大申請天數']||0}天 / ${drug['每次最大申請量']||0}支</td>
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
        document.getElementById("drug-global-max-days").value = drug['每次最大申請天數'] || 5;
        document.getElementById("drug-global-max-qty").value = drug['每次最大申請量'] || 5;
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
    
    const globalMaxDays = parseInt(document.getElementById("drug-global-max-days").value || 0);
    const globalMaxQty = parseInt(document.getElementById("drug-global-max-qty").value || 0);
    const validCats = currentCustomCategories.filter(c => c.name.trim() !== "");

    // 👉 終極防呆：確保至少有一個「初次類別」
    const hasInitial = validCats.some(c => c.type === "INITIAL");
    if (!hasInitial) {
        alert("⛔ 儲存失敗！\n您必須至少設定一個「初次類別 (INITIAL)」，否則新病患將無法申請藥品！");
        btnSave.disabled = false;
        btnSave.innerText = "儲存藥品設定";
        return;
    }

    for (let i = 0; i < validCats.length; i++) {
      const cat = validCats[i];
      if (parseInt(cat.defDays) > globalMaxDays || parseInt(cat.defQty) > globalMaxQty) {
        alert(`⛔ 儲存失敗！\n選項【${cat.name}】的預設天數 (${cat.defDays}) 或數量 (${cat.defQty})\n不可超過全局的 最大天數(${globalMaxDays}) 或 數量(${globalMaxQty})！`);
        btnSave.disabled = false;
        btnSave.innerText = "儲存藥品設定";
        return;
      }
    }
    
    const dataObj = {
      "藥品代碼": document.getElementById("drug-code").value.trim().toUpperCase(),
      "藥品名稱": document.getElementById("drug-name").value.trim(),
      "管制天數": document.getElementById("drug-control-days").value,
      "每次最大申請天數": document.getElementById("drug-global-max-days").value,
      "每次最大申請量": document.getElementById("drug-global-max-qty").value,
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
