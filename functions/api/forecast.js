const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export async function onRequestGet({ request, env }) {
  if (!env.KMA_SERVICE_KEY) {
    return json({ error: 'KMA_SERVICE_KEY is not configured. Check the Cloudflare Pages Secret.' }, 500);
  }

  const url = new URL(request.url);
  const nx = Number(url.searchParams.get('nx'));
  const ny = Number(url.searchParams.get('ny'));
  if (!Number.isInteger(nx) || !Number.isInteger(ny)) {
    return json({ error: 'Invalid region coordinates.' }, 400);
  }

  const { baseDate, baseTime } = latestBaseTime();
  const apiUrl = new URL('https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst');
  apiUrl.search = new URLSearchParams({
    authKey: env.KMA_SERVICE_KEY,
    pageNo: '1',
    numOfRows: '1000',
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx: String(nx),
    ny: String(ny),
  });

  try {
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(10_000) });
    const data = await response.json();
    const header = data?.response?.header;
    if (!response.ok || header?.resultCode !== '00') {
      throw new Error(header?.resultMsg || 'The KMA API request failed.');
    }
    return json({ baseDate, baseTime, items: data.response.body?.items?.item || [] });
  } catch (error) {
    return json({ error: error.message || 'Unable to retrieve KMA weather data.' }, 502);
  }
}

function latestBaseTime() {
  const now = new Date(Date.now() + KST_OFFSET_MS);
  const cycles = [2, 5, 8, 11, 14, 17, 20, 23];
  let hour = now.getUTCHours();
  if (now.getUTCMinutes() < 10) hour--;
  let cycle = cycles.filter((value) => value <= hour).pop();
  if (cycle === undefined) {
    now.setUTCDate(now.getUTCDate() - 1);
    cycle = 23;
  }
  const baseDate = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  return { baseDate, baseTime: `${String(cycle).padStart(2, '0')}00` };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}