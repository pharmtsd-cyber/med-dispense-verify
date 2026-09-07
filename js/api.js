// js/api.js

async function fetchData(action) {
  try {
    const timestamp = new Date().getTime();
    const response = await fetch(`${GAS_API_URL}?action=${action}&t=${timestamp}`, {
      method: 'GET',
      cache: 'no-store' // 👉 關鍵：強制繞過防火牆快取
    });
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
      cache: 'no-store', // 👉 關鍵：強制繞過防火牆快取
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // 👉 關鍵：避免觸發嚴格的 CORS Preflight
      body: JSON.stringify({ action: action, data: dataObj })
    });
    return await response.json();
  } catch (error) {
    console.error(`POST ${action} 錯誤:`, error);
    return { status: 'error', message: '網路連線異常' };
  }
}
