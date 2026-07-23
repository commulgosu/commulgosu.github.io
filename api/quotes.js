const allowedOrigins = new Set([
  'https://commulgosu.github.io',
  'https://commulgosu-github-io.vercel.app'
]);

const instruments = [
  { symbol: '005930', name: '삼성전자', type: 'stock' },
  { symbol: '000660', name: 'SK하이닉스', type: 'stock' },
  { symbol: '379800', name: 'KODEX 미국S&P500', type: 'etf' },
  { symbol: '379810', name: 'KODEX 미국나스닥100', type: 'etf' }
];

const apiBase = 'https://openapi.koreainvestment.com:9443';
let tokenCache = { value: '', expiresAt: 0 };

function setCors(res, origin) {
  if (allowedOrigins.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

function parseNumber(value) {
  const number = Number(String(value ?? '').replace(/[,%]/g, '').trim());
  return Number.isFinite(number) ? number : null;
}

function isKoreanMarketSession() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(values.weekday);
  const minutes = Number(values.hour) * 60 + Number(values.minute);
  return weekday && minutes >= 540 && minutes < 930;
}

function koreanTimeNow() {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'medium'
  }).format(new Date());
}

async function getAccessToken() {
  const appKey = process.env.KIS_APPKEY;
  const appSecret = process.env.KIS_APPSECRET;
  if (!appKey || !appSecret) return null;
  if (tokenCache.value && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;

  const response = await fetch(`${apiBase}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ grant_type: 'client_credentials', appkey: appKey, appsecret: appSecret })
  });
  if (!response.ok) return null;
  const data = await response.json();
  if (typeof data.access_token !== 'string' || !data.access_token) return null;
  tokenCache = { value: data.access_token, expiresAt: Date.now() + Math.max(Number(data.expires_in || 3600) - 60, 60) * 1000 };
  return tokenCache.value;
}

async function requestQuote(token, instrument) {
  const etf = instrument.type === 'etf';
  const path = etf ? '/uapi/etfetn/v1/quotations/inquire-price' : '/uapi/domestic-stock/v1/quotations/inquire-price';
  const trId = etf ? 'FHPST02400000' : 'FHKST01010100';
  const response = await fetch(`${apiBase}${path}?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${encodeURIComponent(instrument.symbol)}`, {
    headers: {
      Accept: 'application/json',
      'content-type': 'application/json; charset=UTF-8',
      authorization: `Bearer ${token}`,
      appkey: process.env.KIS_APPKEY,
      appsecret: process.env.KIS_APPSECRET,
      tr_id: trId,
      custtype: 'P'
    }
  });
  if (!response.ok) return null;
  const body = await response.json();
  const output = body?.output || body?.output1;
  if (!output) return null;
  const price = parseNumber(output.stck_prpr || output.etf_prpr || output.nav);
  const changeRate = parseNumber(output.prdy_ctrt || output.etf_prdy_ctrt);
  if (price === null || price <= 0 || changeRate === null) return null;
  return { symbol: instrument.symbol, name: instrument.name, price, changeRate };
}

module.exports = async function handler(req, res) {
  setCors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  if (!isKoreanMarketSession()) return res.status(200).json({ marketOpen: false, timezone: 'Asia/Seoul', updatedAt: koreanTimeNow(), quotes: [] });

  try {
    const token = await getAccessToken();
    if (!token) return res.status(200).json({ marketOpen: true, timezone: 'Asia/Seoul', updatedAt: koreanTimeNow(), quotes: [] });
    const results = await Promise.all(instruments.map((instrument) => requestQuote(token, instrument)));
    return res.status(200).json({ marketOpen: true, timezone: 'Asia/Seoul', updatedAt: koreanTimeNow(), quotes: results.filter(Boolean) });
  } catch {
    return res.status(200).json({ marketOpen: true, timezone: 'Asia/Seoul', updatedAt: koreanTimeNow(), quotes: [] });
  }
};
