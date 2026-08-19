const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const MID_REGIONS = {
  seoul: { land: '11B00000', temperature: '11B10101' },
  busan: { land: '11H20000', temperature: '11H20201' },
  daegu: { land: '11H10000', temperature: '11H10701' },
  incheon: { land: '11B00000', temperature: '11B20201' },
  gwangju: { land: '11F20000', temperature: '11F20501' },
  daejeon: { land: '11C20000', temperature: '11C20401' },
  ulsan: { land: '11H20000', temperature: '11H20101' },
  sejong: { land: '11C20000', temperature: '11C20404' },
  suwon: { land: '11B00000', temperature: '11B20601' },
  chuncheon: { land: '11D10000', temperature: '11D10301' },
  gangneung: { land: '11D20000', temperature: '11D20501' },
  cheongju: { land: '11C10000', temperature: '11C10301' },
  jeonju: { land: '11F10000', temperature: '11F10201' },
  pohang: { land: '11H10000', temperature: '11H10201' },
  changwon: { land: '11H20000', temperature: '11H20301' },
  jeju: { land: '11G00000', temperature: '11G00201' },
};

export async function onRequestGet({ request, env }) {
  if (!env.KMA_SERVICE_KEY) {
    return json({ error: 'KMA_SERVICE_KEY is not configured. Check the Cloudflare Pages Secret.' }, 500);
  }

  const url = new URL(request.url);
  const nx = Number(url.searchParams.get('nx'));
  const ny = Number(url.searchParams.get('ny'));
  const midRegion = MID_REGIONS[url.searchParams.get('region')];
  if (!Number.isInteger(nx) || !Number.isInteger(ny) || !midRegion) {
    return json({ error: 'Invalid region.' }, 400);
  }

  const shortBase = latestShortBaseTime();
  const midBaseTime = latestMidBaseTime();
  const common = { pageNo: '1', numOfRows: '1000', dataType: 'JSON', authKey: env.KMA_SERVICE_KEY };
  const shortUrl = createUrl('https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst', {
    ...common, base_date: shortBase.baseDate, base_time: shortBase.baseTime, nx: String(nx), ny: String(ny),
  });
  const landUrl = createUrl('https://apihub.kma.go.kr/api/typ02/openApi/MidFcstInfoService/getMidLandFcst', {
    ...common, regId: midRegion.land, tmFc: midBaseTime,
  });
  const temperatureUrl = createUrl('https://apihub.kma.go.kr/api/typ02/openApi/MidFcstInfoService/getMidTa', {
    ...common, regId: midRegion.temperature, tmFc: midBaseTime,
  });

  try {
    const [shortItems, landItems, temperatureItems] = await Promise.all([
      fetchKma(shortUrl), fetchKma(landUrl), fetchKma(temperatureUrl),
    ]);
    return json({
      short: { ...shortBase, items: shortItems },
      mid: { baseTime: midBaseTime, land: landItems[0] || null, temperature: temperatureItems[0] || null },
    });
  } catch (error) {
    return json({ error: error.message || 'Unable to retrieve KMA weather data.' }, 502);
  }
}

function createUrl(endpoint, parameters) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams(parameters);
  return url;
}

async function fetchKma(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  let data;
  try { data = await response.json(); } catch { throw new Error('The KMA API returned an invalid response.'); }
  const header = data?.response?.header;
  if (!response.ok || header?.resultCode !== '00') throw new Error(header?.resultMsg || 'The KMA API request failed.');
  const items = data?.response?.body?.items?.item;
  return Array.isArray(items) ? items : items ? [items] : [];
}

function latestShortBaseTime() {
  const now = new Date(Date.now() + KST_OFFSET_MS);
  const cycles = [2, 5, 8, 11, 14, 17, 20, 23];
  let hour = now.getUTCHours();
  if (now.getUTCMinutes() < 10) hour--;
  let cycle = cycles.filter((value) => value <= hour).pop();
  if (cycle === undefined) { now.setUTCDate(now.getUTCDate() - 1); cycle = 23; }
  const baseDate = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  return { baseDate, baseTime: `${String(cycle).padStart(2, '0')}00` };
}

function latestMidBaseTime() {
  const now = new Date(Date.now() + KST_OFFSET_MS);
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  if (hour < 6 || (hour === 6 && minute < 10)) now.setUTCDate(now.getUTCDate() - 1);
  const cycle = hour < 6 || (hour === 6 && minute < 10) ? '1800' : hour < 18 || (hour === 18 && minute < 10) ? '0600' : '1800';
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}${cycle}`;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}