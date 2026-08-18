const http = require('http');
const fs = require('fs');
const path = require('path');

loadEnv();

const port = Number(process.env.PORT || 3000);
const serviceKey = process.env.KMA_SERVICE_KEY;
const publicDir = path.join(__dirname, 'public');
const MIME_TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/forecast') return getForecast(url, res);
  if (url.pathname === '/') return sendFile(res, 'index.html');
  if (url.pathname.startsWith('/')) return sendFile(res, url.pathname.slice(1));
  sendJson(res, 404, { error: '찾을 수 없는 주소입니다.' });
}).listen(port, () => console.log(`날씨 사이트 실행 중: http://localhost:${port}`));

async function getForecast(url, res) {
  if (!serviceKey || serviceKey === 'YOUR_SERVICE_KEY') {
    return sendJson(res, 500, { error: 'KMA_SERVICE_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.' });
  }
  const nx = Number(url.searchParams.get('nx'));
  const ny = Number(url.searchParams.get('ny'));
  if (!Number.isInteger(nx) || !Number.isInteger(ny)) return sendJson(res, 400, { error: '올바른 지역 좌표가 아닙니다.' });

  const { baseDate, baseTime } = latestBaseTime();
  const apiUrl = new URL('https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst');
  apiUrl.search = new URLSearchParams({ authKey: serviceKey, pageNo: '1', numOfRows: '1000', dataType: 'JSON', base_date: baseDate, base_time: baseTime, nx: String(nx), ny: String(ny) });
  try {
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
    if (response.status === 403) {
      throw new Error('기상청 API 허브가 접근을 거절했습니다(403). API 허브에서 이 인증키에 “단기예보” 활용 권한이 승인됐는지 확인해 주세요.');
    }
    const data = await response.json();
    const header = data?.response?.header;
    if (!response.ok || header?.resultCode !== '00') throw new Error(header?.resultMsg || '기상청 API 요청에 실패했습니다.');
    sendJson(res, 200, { baseDate, baseTime, items: data.response.body.items.item });
  } catch (error) {
    sendJson(res, 502, { error: error.message || '기상청 데이터를 가져오지 못했습니다.' });
  }
}

function latestBaseTime() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
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

function sendFile(res, relativePath) {
  const filePath = path.resolve(publicDir, relativePath);
  if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return sendJson(res, 404, { error: '파일을 찾을 수 없습니다.' });
  res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}
function sendJson(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([\w]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}
