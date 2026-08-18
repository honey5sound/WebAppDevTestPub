const regions = [
  ['서울', 60, 127], ['부산', 98, 76], ['대구', 89, 90], ['인천', 55, 124], ['광주', 58, 74], ['대전', 67, 100], ['울산', 102, 84], ['세종', 66, 103], ['수원', 60, 121], ['춘천', 73, 134], ['강릉', 92, 131], ['청주', 69, 106], ['전주', 63, 89], ['포항', 102, 94], ['창원', 89, 77], ['제주', 52, 38]
];
const regionSelect = document.querySelector('#region');
const dateInput = document.querySelector('#date');
const button = document.querySelector('#search');
const status = document.querySelector('#status');
const forecast = document.querySelector('#forecast');
const template = document.querySelector('#card-template');
const today = new Date();
const localToday = toDateString(today);
dateInput.value = localToday;
dateInput.min = localToday;
regions.forEach(([name, nx, ny]) => regionSelect.add(new Option(name, `${nx},${ny}`)));
button.addEventListener('click', loadWeather);

async function loadWeather() {
  const [nx, ny] = regionSelect.value.split(',');
  const start = dateInput.value;
  if (!start) return setStatus('날짜를 선택해 주세요.', true);
  button.disabled = true; forecast.innerHTML = ''; setStatus('기상청 예보를 불러오는 중입니다…');
  try {
    const response = await fetch(`/api/forecast?nx=${nx}&ny=${ny}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '예보를 불러오지 못했습니다.');
    render(data.items, start);
    setStatus(`${regionSelect.options[regionSelect.selectedIndex].text} · ${data.baseDate} ${data.baseTime} 발표 예보`);
  } catch (error) { setStatus(error.message, true); }
  finally { button.disabled = false; }
}

function render(items, start) {
  const dates = [...Array(3)].map((_, index) => addDays(start, index));
  const grouped = Object.groupBy(items, item => item.fcstDate);
  forecast.innerHTML = '';
  dates.forEach((date, index) => {
    const values = grouped[date] || [];
    const byCategory = Object.groupBy(values, value => value.category);
    const min = firstValue(byCategory.TMN); const max = firstValue(byCategory.TMX);
    const daytime = values.filter(v => v.fcstTime >= '0900' && v.fcstTime <= '1800');
    const precipitation = daytime.find(v => v.category === 'PTY')?.fcstValue || '0';
    const sky = daytime.find(v => v.category === 'SKY')?.fcstValue || '1';
    const pop = Math.max(0, ...values.filter(v => v.category === 'POP').map(v => Number(v.fcstValue)));
    const pcp = values.filter(v => v.category === 'PCP').map(v => v.fcstValue).find(v => v !== '강수없음') || '강수없음';
    const info = weatherInfo(precipitation, sky);
    const card = template.content.firstElementChild.cloneNode(true);
    card.querySelector('.day-label').textContent = index === 0 ? '선택한 날' : index === 1 ? '다음 날' : '이튿날';
    card.querySelector('h2').textContent = formatDate(date);
    card.querySelector('.weather-icon').textContent = info.icon;
    card.querySelector('.weather-name').textContent = info.label;
    card.querySelector('.temperature strong').textContent = min && max ? `${min}° / ${max}°` : '예보 준비 중';
    card.querySelector('.temperature span').textContent = min && max ? '최저 / 최고' : '';
    card.querySelector('.pop').textContent = `${pop}%`;
    card.querySelector('.pcp').textContent = pcp;
    forecast.append(card);
  });
}
function firstValue(items) { return items?.[0]?.fcstValue; }
function weatherInfo(pty, sky) { if (pty === '1') return { icon: '🌧️', label: '비' }; if (pty === '2') return { icon: '🌨️', label: '비 또는 눈' }; if (pty === '3') return { icon: '❄️', label: '눈' }; if (pty === '4') return { icon: '🌦️', label: '소나기' }; return sky === '1' ? { icon: '☀️', label: '맑음' } : sky === '3' ? { icon: '🌤️', label: '구름 많음' } : { icon: '☁️', label: '흐림' }; }
function addDays(dateString, days) { const date = new Date(`${dateString}T12:00:00`); date.setDate(date.getDate() + days); return toDateString(date); }
function toDateString(date) { return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`; }
function formatDate(date) { const d = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}T12:00:00`); return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(d); }
function setStatus(message, isError = false) { status.textContent = message; status.classList.toggle('error', isError); }
