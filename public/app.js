const regions = [
  ['서울', 60, 127, 'seoul'], ['부산', 98, 76, 'busan'], ['대구', 89, 90, 'daegu'], ['인천', 55, 124, 'incheon'],
  ['광주', 58, 74, 'gwangju'], ['대전', 67, 100, 'daejeon'], ['울산', 102, 84, 'ulsan'], ['세종', 66, 103, 'sejong'],
  ['수원', 60, 121, 'suwon'], ['춘천', 73, 134, 'chuncheon'], ['강릉', 92, 131, 'gangneung'], ['청주', 69, 106, 'cheongju'],
  ['전주', 63, 89, 'jeonju'], ['포항', 102, 94, 'pohang'], ['창원', 89, 77, 'changwon'], ['제주', 52, 38, 'jeju'],
];
const regionSelect = document.querySelector('#region');
const dateInput = document.querySelector('#date');
const button = document.querySelector('#search');
const status = document.querySelector('#status');
const forecast = document.querySelector('#forecast');
const template = document.querySelector('#card-template');
const today = new Date();
const localToday = toInputDate(today);
dateInput.value = localToday;
dateInput.min = localToday;
regions.forEach(([name, nx, ny, region]) => regionSelect.add(new Option(name, `${nx},${ny},${region}`)));
button.addEventListener('click', loadWeather);

async function loadWeather() {
  const [nx, ny, region] = regionSelect.value.split(',');
  const start = dateInput.value;
  if (!start) return setStatus('날짜를 선택해 주세요.', true);
  button.disabled = true; forecast.innerHTML = ''; setStatus('기상청 예보를 불러오는 중입니다…');
  try {
    const response = await fetch(`/api/forecast?nx=${nx}&ny=${ny}&region=${region}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '예보를 불러오지 못했습니다.');
    render(data, start);
    setStatus(`${regionSelect.options[regionSelect.selectedIndex].text} · 단기예보 3일 + 중기예보 4일`);
  } catch (error) { setStatus(error.message, true); }
  finally { button.disabled = false; }
}

function render(data, start) {
  forecast.innerHTML = '';
  renderShort(data.short.items, start);
  renderMid(data.mid.land, data.mid.temperature, start);
}

function renderShort(items, start) {
  const dates = [...Array(3)].map((_, index) => addDays(start, index));
  const grouped = Object.groupBy(items, item => item.fcstDate);
  dates.forEach((date, index) => {
    const values = grouped[date] || [];
    const byCategory = Object.groupBy(values, value => value.category);
    const min = firstValue(byCategory.TMN); const max = firstValue(byCategory.TMX);
    const daytime = values.filter(v => v.fcstTime >= '0900' && v.fcstTime <= '1800');
    const precipitation = daytime.find(v => v.category === 'PTY')?.fcstValue || '0';
    const sky = daytime.find(v => v.category === 'SKY')?.fcstValue || '1';
    const pop = Math.max(0, ...values.filter(v => v.category === 'POP').map(v => Number(v.fcstValue)));
    const pcp = values.filter(v => v.category === 'PCP').map(v => v.fcstValue).find(v => v !== '강수없음') || '강수없음';
    appendCard({ date, label: index === 0 ? '동네예보 · 선택한 날' : '동네예보', weather: weatherInfo(precipitation, sky), min, max, pop: `${pop}%`, detail: pcp });
  });
}

function renderMid(land, temperature, start) {
  for (let day = 4; day <= 7; day++) {
    const date = addDays(start, day - 1);
    const am = land?.[`wf${day}Am`] || '예보 준비 중';
    const pm = land?.[`wf${day}Pm`] || am;
    const min = temperature?.[`taMin${day}`];
    const max = temperature?.[`taMax${day}`];
    appendCard({
      date, label: '중기예보 · 권역', weather: { icon: midIcon(`${am} ${pm}`), label: `${am} / ${pm}` }, min, max,
      pop: `${land?.[`rnSt${day}Am`] ?? '-'}%`, detail: `${land?.[`rnSt${day}Pm`] ?? '-'}%`, mid: true,
    });
  }
}

function appendCard({ date, label, weather, min, max, pop, detail, mid = false }) {
  const card = template.content.firstElementChild.cloneNode(true);
  card.querySelector('.day-label').textContent = label;
  card.querySelector('h2').textContent = formatDate(date);
  card.querySelector('.weather-icon').textContent = weather.icon;
  card.querySelector('.weather-name').textContent = weather.label;
  card.querySelector('.temperature strong').textContent = min !== undefined && max !== undefined ? `${min}° / ${max}°` : '예보 준비 중';
  card.querySelector('.temperature span').textContent = min !== undefined && max !== undefined ? '최저 / 최고' : '';
  card.querySelector('.pop').textContent = pop;
  card.querySelector('.pcp').textContent = detail;
  if (mid) {
    const [amLabel, pmLabel] = card.querySelectorAll('dt');
    amLabel.textContent = '오전 강수확률'; pmLabel.textContent = '오후 강수확률';
  }
  forecast.append(card);
}

function firstValue(items) { return items?.[0]?.fcstValue; }
function weatherInfo(pty, sky) { if (pty === '1') return { icon: '🌧️', label: '비' }; if (pty === '2') return { icon: '🌨️', label: '비 또는 눈' }; if (pty === '3') return { icon: '❄️', label: '눈' }; if (pty === '4') return { icon: '🌦️', label: '소나기' }; return sky === '1' ? { icon: '☀️', label: '맑음' } : sky === '3' ? { icon: '🌤️', label: '구름 많음' } : { icon: '☁️', label: '흐림' }; }
function midIcon(weather) { if (/눈/.test(weather)) return '❄️'; if (/비|소나기/.test(weather)) return '🌧️'; if (/흐림/.test(weather)) return '☁️'; if (/구름/.test(weather)) return '🌤️'; return '☀️'; }
function addDays(dateString, days) { const date = new Date(`${dateString}T12:00:00`); date.setDate(date.getDate() + days); return toForecastDate(date); }
function toInputDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function toForecastDate(date) { return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`; }
function formatDate(date) { const d = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}T12:00:00`); return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(d); }
function setStatus(message, isError = false) { status.textContent = message; status.classList.toggle('error', isError); }