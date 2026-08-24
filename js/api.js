// js/api.js
async function fetchData(action) {
  try {
    const response = await fetch(`${GAS_API_URL}?action=${action}`);
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
      body: JSON.stringify({ action: action, data: dataObj })
    });
    return await response.json();
  } catch (error) {
    console.error(`POST ${action} 錯誤:`, error);
    return { status: 'error', message: '網路連線異常' };
  }
}
