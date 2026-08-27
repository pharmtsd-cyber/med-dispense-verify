// js/api.js

async function fetchData(action) {
  try {
    // 保留時間戳記 (Cache-Buster)，這是最安全且不會觸發 CORS 的反快取寫法
    const timestamp = new Date().getTime();
    
    // 👉 移除自訂 headers，單純靠網址的不同來強制抓取最新資料
    const response = await fetch(`${GAS_API_URL}?action=${action}&t=${timestamp}`);
    
    const result = await response.json();
    if (result.status === 'success') return result.data;
    console.error(`GET ${action} 錯誤:`, result.message);
    return [];
  } catch (error) {
    console.error(`API 連線錯誤 (${action}):`, error);
    return [];
  }
}

async function postData(action, dataObj) {
  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      // 維持最單純的寫法，避免觸發 Google 的 Preflight CORS 檢查
      body: JSON.stringify({ action: action, data: dataObj })
    });
    return await response.json();
  } catch (error) {
    console.error(`POST ${action} 錯誤:`, error);
    return { status: 'error', message: '網路連線異常' };
  }
}
