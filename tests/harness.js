const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
global.__html = html;

const blockSet = new Set();
function routes(url, body) {
  if (blockSet.has('binance') && url.includes('binance.com')) throw new Error('451');
  if (url.includes('fapi/v1/exchangeInfo')) {
    return { symbols: [
      { symbol: 'BTCUSDT', baseAsset: 'BTC', status: 'TRADING', quoteAsset: 'USDT', contractType: 'PERPETUAL' },
      { symbol: 'ETHUSDT', baseAsset: 'ETH', status: 'TRADING', quoteAsset: 'USDT', contractType: 'PERPETUAL' },
      { symbol: 'SOLUSDT', baseAsset: 'SOL', status: 'TRADING', quoteAsset: 'USDT', contractType: 'PERPETUAL' },
      { symbol: 'TSLAUSDT', baseAsset: 'TSLA', status: 'TRADING', quoteAsset: 'USDT', contractType: 'TRADIFI_PERPETUAL' },
      { symbol: 'QQQUSDT', baseAsset: 'QQQ', status: 'TRADING', quoteAsset: 'USDT', contractType: 'TRADIFI_PERPETUAL' },
      { symbol: 'AAPLUSDT', baseAsset: 'AAPL', status: 'TRADING', quoteAsset: 'USDT', contractType: 'TRADIFI_PERPETUAL' },
      { symbol: 'NVDAUSDT', baseAsset: 'NVDA', status: 'TRADING', quoteAsset: 'USDT', contractType: 'TRADIFI_PERPETUAL' },
      { symbol: 'MSFTUSDT', baseAsset: 'MSFT', status: 'TRADING', quoteAsset: 'USDT', contractType: 'TRADIFI_PERPETUAL' },
      { symbol: 'AMZNUSDT', baseAsset: 'AMZN', status: 'TRADING', quoteAsset: 'USDT', contractType: 'TRADIFI_PERPETUAL' },
      { symbol: 'GOOGLUSDT', baseAsset: 'GOOGL', status: 'TRADING', quoteAsset: 'USDT', contractType: 'TRADIFI_PERPETUAL' },
    ] };
  }
  if (url.includes('fapi/v1/ticker/24hr')) {
    const sym = (url.match(/symbol=([^&]+)/) || [])[1] || '';
    const t = { BTCUSDT: [70000, 1.5], ETHUSDT: [2500, 2.0], SOLUSDT: [104.03, 1.49], TSLAUSDT: [367.7, 5.32], QQQUSDT: [718.41, 0.25], AAPLUSDT: [190.12, 0.63], NVDAUSDT: [875.2, 1.1], MSFTUSDT: [415.8, 0.3], AMZNUSDT: [186.5, -0.4], GOOGLUSDT: [162.4, 0.2] };
    if (!t[sym]) throw new Error('404');
    return { lastPrice: String(t[sym][0]), priceChangePercent: String(t[sym][1]) };
  }
  if (url.includes('fapi/v1/time')) return { serverTime: Date.now() };
  if (url.includes('api.bybit.com/v5/market/tickers')) {
    const sym = (url.match(/symbol=([^&]+)/) || [])[1] || '';
    const db = { BTCUSDT: ['70000', '0.015'], ETHUSDT: ['2500', '0.02'], SOLUSDT: ['104.03', '0.0149'], AAPLXUSDT: ['190.12', '0.0063'], TSLAXUSDT: ['367.7', '0.0532'] };
    const e = db[sym];
    return { retCode: 0, result: { list: e ? [{ symbol: sym, lastPrice: e[0], price24hPcnt: e[1] }] : [] } };
  }
  if (url.includes('www.okx.com/api/v5/market/ticker')) {
    const inst = (url.match(/instId=([^&]+)/) || [])[1] || '';
    const db = { 'BTC-USDT': ['70000', '68000'], 'ETH-USDT': ['2500', '2450'], 'SOL-USDT': ['104.03', '102.5'] };
    const e = db[inst];
    return { code: '0', data: e ? [{ instId: inst, last: e[0], open24h: e[1] }] : [] };
  }
  if (url.includes('api.coingecko.com/api/v3/search')) {
    const q = decodeURIComponent((url.match(/query=([^&]+)/) || [])[1] || '').toUpperCase();
    const coins = q === 'AAPL' ? [
      { id: 'apple-xstock', symbol: 'AAPL', name: 'Apple xStock' },
      { id: 'apple-coinbase-tokenized-stock', symbol: 'AAPL', name: 'Apple (Coinbase Tokenized Stock)' },
      { id: 'apple', symbol: 'AAPL', name: 'Apple Token' },
    ] : [];
    return { coins };
  }
  if (url.includes('api.coingecko.com/api/v3/simple/price')) {
    const ids = decodeURIComponent((url.match(/ids=([^&]+)/) || [])[1] || '').split(',');
    const db = { bitcoin: { usd: 70000, usd_24h_change: 1.5 }, ethereum: { usd: 2500, usd_24h_change: 2 }, 'apple-coinbase-tokenized-stock': { usd: 228.15, usd_24h_change: 0.63 } };
    const out = {};
    ids.forEach(i => { if (db[i]) out[i] = db[i]; });
    return out;
  }
  throw new Error('unhandled: ' + url);
}

const dom = new JSDOM(html, {
  url: 'https://localhost/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.fetch = (url, opts) => {
      url = String(url);
      let data;
      try { data = routes(url, opts && opts.body); } catch (e) { return Promise.reject(e); }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data), text: () => Promise.resolve(JSON.stringify(data)) });
    };
    window.__block = a => { blockSet.clear(); a.forEach(x => blockSet.add(x)); };
    window.HTMLElement.prototype.scrollIntoView = () => {};
    window.WebSocket = function () { this.close = () => {}; this.onclose = null; this.onmessage = null; this.onerror = null; };
    window.WebSocket.prototype.send = () => {};
  },
});

const window = dom.window;
const document = dom.window.document;
const wait = ms => new Promise(r => setTimeout(r, ms));
const errs = [];
dom.window.addEventListener('error', e => errs.push(String(e.message || e)));
const g = code => dom.window.eval(code);
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? ' -> ' + detail : '')); }
}

(async () => {
  await wait(4000);

  // 1. smoke: grid + prices
  check('그리드 렌더', document.querySelectorAll('.grid-cell').length > 100);
  check('시세 수신', g("Object.keys(prices).length > 0"), JSON.stringify(g('prices')));

  // 2. Share button removed
  check('Share 버튼 제거됨', !document.querySelector('.btn-share') && !html.includes('btn-share'));

  // 3. alignment: CSS rule effective (block display) + class applied
  const styleText = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
  const ccRule = styleText.match(/\.grid-cell \.cell-content \{[^}]*\}/);
  check('cell-content display:block', !!ccRule && ccRule[0].includes('display: block'), ccRule && ccRule[0]);
  window.setSelection(2, 2, false);
  g("cellData['2C'] = 'abc'; renderGrid();");
  document.getElementById('btnAlignCenter').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  check('정렬: cellStyles 반영', g("cellStyles['2C'] && cellStyles['2C'].align") === 'center', JSON.stringify(g("cellStyles['2C']")));
  check('정렬: DOM 클래스', !!document.querySelector('.grid-cell[data-row="2"][data-col="2"].cell-align-center'));
  const span = document.querySelector('.grid-cell[data-row="2"][data-col="2"] .cell-content');
  check('정렬: span이 block', dom.window.getComputedStyle(span).display === 'block', dom.window.getComputedStyle(span).display);

  // 4. plain number format resets $/%/,
  g("cellData['3C'] = '$1,234.50'; cellData['3D'] = '12.34%'; cellData['3E'] = '1,234,567'; renderGrid();");
  window.setSelection(3, 2, false);
  window.setSelection(3, 4, true);
  document.getElementById('btnFmtPlain').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  check('123: 통화/백분율/콤마 원복', g("cellData['3C']") === '1234.5' && g("cellData['3D']") === '12.34' && g("cellData['3E']") === '1234567',
    g("cellData['3C']") + ' | ' + g("cellData['3D']") + ' | ' + g("cellData['3E']"));

  // 5. deleteCols = Excel-like shift
  g("cellData['5A'] = 'a'; cellData['5B'] = 'b'; cellData['5C'] = 'c'; delete cellData['5D']; renderGrid();");
  g("deleteCols(1, 1);");
  check('열삭제: 우측이 좌로 시프트', g("cellData['5A']") === 'a' && g("cellData['5B']") === 'c' && g("cellData['5C'] === undefined"),
    g("cellData['5A']") + '/' + g("cellData['5B']") + '/' + g("cellData['5C']"));
  g("undo();");
  check('열삭제: Undo 복원', g("cellData['5A']") === 'a' && g("cellData['5B']") === 'b' && g("cellData['5C']") === 'c',
    g("cellData['5B']") + '/' + g("cellData['5C']"));

  // 5t. title persists
  const h1t = document.querySelector('.header-title h1');
  h1t.textContent = 'Q3 Budget';
  h1t.dispatchEvent(new window.Event('blur'));
  check('타이틀 저장(localStorage+document.title)', window.localStorage.getItem('docTitle') === 'Q3 Budget' && document.title === 'Q3 Budget',
    window.localStorage.getItem('docTitle') + ' | ' + document.title);
  h1t.textContent = '   ';
  h1t.dispatchEvent(new window.Event('blur'));
  check('빈 타이틀은 기본값 복원', window.localStorage.getItem('docTitle') === 'Untitled spreadsheet', window.localStorage.getItem('docTitle'));

  // 5u. insert column shifts right
  g("cellData['5A'] = 'a'; cellData['5B'] = 'b'; delete cellData['5C']; delete cellData['5D']; renderGrid();");
  g("insertCol(1);");
  check('열삽입: 우측이 우로 시프트', g("cellData['5A']") === 'a' && g("cellData['5B'] === undefined") === true && g("cellData['5C']") === 'b',
    g("cellData['5B']") + '/' + g("cellData['5C']"));
  g("undo();");
  check('열삽입: Undo 복원', g("cellData['5B']") === 'b' && g("cellData['5C'] === undefined") === true, g("cellData['5B']") + '/' + g("cellData['5C']"));

  // 5z. budget column uses real formulas (row1 = AAPL 200 inv, price 190.12)
  g("updateMarketData(false);");
  check('Budget 셀 = 수식', g("cellData['1F']") === '=C2*E2', g("cellData['1F']"));
  check('Project Name 시드 프리필(코드리시)', g("cellData['1B']") === 'Apex' && g("cellData['0B']") === 'Project Name', g("cellData['1B']") + '/' + g("cellData['0B']"));
  check('수식 계산 표시', g("displayValue('1F')").replace(/,/g, '') === '38024', g("displayValue('1F')") + ' C=' + g("cellData['1C']") + ' E=' + g("cellData['1E']"));
  g("cellData['1E'] = '100'; renderGrid();");
  check('재고 수정 시 예산 자동 재계산', g("displayValue('1F')").replace(/,/g, '') === '19012', g("displayValue('1F')"));
  g("cellData['1F'] = '=C2*2'; renderGrid();");
  g("updateMarketData(false);");
  check('커스텀 수식 보존(틱 후)', g("cellData['1F']") === '=C2*2' && g("displayValue('1F')") === '380.24', g("cellData['1F']") + ' -> ' + g("displayValue('1F')"));
  g("cellData['1F'] = '=C2*E2'; cellData['1E'] = '200'; renderGrid();");

  // 5r. coming-soon dummy menus
  document.querySelector('[data-menu="extensions"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const soonItems = Array.from(document.querySelectorAll('.menu-dropdown .md-item')).map(d => d.textContent);
  check('Extensions 메뉴 열림', soonItems.includes('Add-ons'), soonItems.join(','));
  Array.from(document.querySelectorAll('.menu-dropdown .md-item')).find(d => d.textContent === 'Add-ons').dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  check('준비중 토스트', document.getElementById('toast').textContent.includes('coming soon'), document.getElementById('toast').textContent);
  check('클릭 후 메뉴 닫힘', !document.querySelector('.menu-dropdown'));

  // 5s. columns extend to Z
  check('Z열 존재', !!document.querySelector('.grid-cell[data-col="25"]') && g("COL_HEADERS[25]") === 'Z');
  g("cellData['26A'] = '7'; cellData['26B'] = '8'; cellData['26H'] = '=A27+B27'; renderGrid();");
  check('H열 수식 계산', g("displayValue('26H')") === '15', g("displayValue('26H')"));
  g("cellData['26I'] = '=SUM(A27:B27)'; renderGrid();");
  check('I열 SUM 범위', g("displayValue('26I')") === '15', g("displayValue('26I')"));

  // 5x. column insertion keeps market writes mapped (refresh bug regression)
  g("updateMarketData(false);");
  g("insertCol(1);");
  g("updateMarketData(false);");
  check('삽입열에 시세 미기록', g("cellData['1B'] === undefined") === true && g("cellData['1D']") === '190.12', g("cellData['1B']") + '/' + g("cellData['1D']"));
  check('삽입 후 수식 열 추적', g("cellData['1G']") === '=D2*F2', g("cellData['1G']"));
  g("saveLayout();");
  check('colMap 영속화', (JSON.parse(window.localStorage.getItem('sheetLayout')).colMap || {}).price === 3);
  g("undo();");
  check('Undo로 colMap 복원', g("colMap.price") === 2 && g("cellData['1C']") === '190.12', g("colMap.price") + '/' + g("cellData['1C']"));

  // 5w. reset after inserted column keeps alignment
  window.confirm = () => true;
  g("insertCol(1);");
  g("resetTextFormatting();");
  check('Reset: 헤더 라벨 colMap 정렬', g("cellData['0D']") === 'Budget (USD)' && g("cellData['0B'] === undefined") === true, g("cellData['0B']") + '/' + g("cellData['0D']"));
  check('Reset: 시세 정상 위치', g("cellData['1D']") === '190.12', g("cellData['1D']"));
  g("resetEverything();");
  await wait(4000);
  check('Reset everything: 전 초기화(열 구조 포함)', g("colMap.price") === 2 && g("cellData['0C']") === 'Budget (USD)', g("colMap.price") + '/' + g("cellData['0C']"));
  check('Reset everything: 라벨 기본 배치(A~G)', g("cellData['0A']") === 'Code' && g("cellData['0G']") === 'Status' && g("cellData['0H'] === undefined") === true, String(g("cellData['0H']")));
  check('Reset everything: 시세 기본 위치', g("cellData['1C']") === '190.12', g("cellData['1C']"));
  const h1r = document.querySelector('.header-title h1');
  h1r.textContent = 'Q3 Plan';
  h1r.dispatchEvent(new window.Event('blur'));
  g("resetEverything();");
  check('Reset everything: 타이틀도 초기화', h1r.textContent === 'Untitled spreadsheet' && window.localStorage.getItem('docTitle') === null, h1r.textContent + '/' + window.localStorage.getItem('docTitle'));
  g("localStorage.setItem('dataSource', 'coingecko');");
  g("resetEverything();");
  await wait(4000);
  check('Reset everything: 설정도 초기화', g("dataSource") === 'binance' && window.localStorage.getItem('dataSource') === 'binance',
    g("dataSource"));
  g("openApiSourcesModal();");
  const srcOv = document.querySelector('.modal-overlay');
  check('API Sources 모달(타이틀/Finnhub 없음)', !!srcOv && srcOv.querySelector('h2').textContent === 'API Sources' && !srcOv.textContent.includes('Finnhub') && !srcOv.querySelector('.m-keywrap'), srcOv && srcOv.querySelector('h2').textContent);
  srcOv.remove();

  // 5v. reload (Ctrl+R) keeps an inserted empty column untouched
  g("updateMarketData(false);");
  g("insertCol(1); saveData(); saveLayout();");
  g("initCellData();");
  check('Reload 시드: 추가 열 무침범', g("cellData['0B'] === undefined") === true && g("cellData['1B'] === undefined") === true && g("cellData['0D']") === 'Budget (USD)' && g("cellData['1D']") === '190.12',
    g("cellData['0B']") + '/' + g("cellData['1B']") + '/' + g("cellData['0D']") + '/' + g("cellData['1D']"));
  g("undo();");
  window.setSelection(8, 2, false);
  const evS = new window.Event('paste', { bubbles: true, cancelable: true });
  const sHtml = '<style>.s1{font-weight:700;background-color:rgb(255, 235, 150)}.s2{font-style:italic}</style><table><tr><td class="s1"><span>cls</span></td><td class="s2"><span style=\"color:rgb(204, 0, 0)\">sp</span></td></tr></table>';
  Object.defineProperty(evS, 'clipboardData', { value: { getData: t => t === 'text/html' ? sHtml : 'cls\tsp' } });
  document.activeElement && document.activeElement.blur();
  document.dispatchEvent(evS);
  check('시트식 class/span 서식 복원', g("cellStyles['8C'].bold") === true && g("cellStyles['8C'].fill") === 'rgb(255, 235, 150)' && g("cellStyles['8D'].italic") === true && g("cellStyles['8D'].color") === 'rgb(204, 0, 0)',
    JSON.stringify(g("cellStyles['8C']")) + '|' + JSON.stringify(g("cellStyles['8D']")));
  g("undo();");

  // 5x1b. paste INTO edit mode upgrades to styled grid paste
  window.startEdit(8, 2);
  const evE = new window.Event('paste', { bubbles: true, cancelable: true });
  const eHtml = "<meta charset='utf-8'><table><tr><td style='font-weight:700'>EB</td><td style='text-align:center'>EC</td></tr></table>";
  Object.defineProperty(evE, 'clipboardData', { value: { getData: t => t === 'text/html' ? eHtml : 'EB\tEC' } });
  document.querySelector('.cell-editor').dispatchEvent(evE);
  check('편집 중 표 붙여넣기 → 서식 배치', g("cellData['8C']") === 'EB' && g("cellStyles['8C'].bold") === true && g("cellStyles['8D'].align") === 'center' && g('editingCell') === null,
    g("cellData['8C']") + '|' + JSON.stringify(g("cellStyles['8C']")));
  g("undo();");

  // 5x1c. real Excel CF_HTML format paste
  window.setSelection(8, 2, false);
  const evX = new window.Event('paste', { bubbles: true, cancelable: true });
  const xHtml = "Version:1.1\r\nStartHTML:0000000239\r\nSourceURL:file:///C:/temp/b.xlsx\r\n<HTML><HEAD><style id=\"Excel1 Styles\"><!--\n.xl65 {font-weight:700; color:#1F4E78;}\n--></style></HEAD><BODY><table><tr><td class=xl65 style='font-weight:700;color:#1F4E78;background:#FFFF00;font-size:11.0pt'>EBold</td><td x-align=\"right\" style='font-size:14.0pt;font-family:Calibri'>ERight</td></tr></table></BODY></HTML>";
  Object.defineProperty(evX, 'clipboardData', { value: { getData: t => t === 'text/html' ? xHtml : 'EBold\tERight' } });
  document.activeElement && document.activeElement.blur();
  document.dispatchEvent(evX);
  check('엑셀 CF_HTML 서식 복원', g("cellStyles['8C'].bold") === true && g("cellStyles['8C'].fill") === '#FFFF00' && g("cellStyles['8C'].fontSize") === undefined && g("cellStyles['8D'].align") === 'right' && g("cellStyles['8D'].fontSize") === 19 && g("cellStyles['8D'].fontFamily") === undefined,
    JSON.stringify(g("cellStyles['8C']")) + '|' + JSON.stringify(g("cellStyles['8D']")));
  g("undo();");

  // 5x1d. paste with no selection lands at first data cell
  g("selectedCell = null; selRange = null;");
  const evN = new window.Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(evN, 'clipboardData', { value: { getData: t => t === 'text/html' ? '<table><tr><td style=\"font-weight:700\">TOP</td></tr></table>' : 'TOP' } });
  document.activeElement && document.activeElement.blur();
  document.dispatchEvent(evN);
  check('선택 없이 붙여넣기 → 첫 데이터 셀', g("cellData['1A']") === 'TOP' && g("cellStyles['1A'].bold") === true, g("cellData['1A']") + '|' + JSON.stringify(g("cellStyles['1A']")));
  g("undo();");

  // 5x1e. legacy HTML tags: bgcolor attr, <font color>, <b>, <i>, <u>
  window.setSelection(8, 2, false);
  const evL = new window.Event('paste', { bubbles: true, cancelable: true });
  const lHtml = '<table><tr><td bgcolor="#FFFF00"><b>boldcell</b></td><td><font color="#ff0000">redfont</font></td><td><i>i</i><u>u</u>mix</td></tr></table>';
  Object.defineProperty(evL, 'clipboardData', { value: { getData: t => t === 'text/html' ? lHtml : 'boldcell\tredfont\tmix' } });
  document.activeElement && document.activeElement.blur();
  document.dispatchEvent(evL);
  check('레거시 태그 서식 복원', g("cellStyles['8C'].fill") === '#FFFF00' && g("cellStyles['8C'].bold") === true && g("cellStyles['8D'].color") === '#ff0000' && g("cellStyles['8E'].italic") === true && g("cellStyles['8E'].underline") === true,
    JSON.stringify(g("cellStyles['8C']")) + '|' + JSON.stringify(g("cellStyles['8D']")) + '|' + JSON.stringify(g("cellStyles['8E']")));
  g("undo();");

  // 5x2. type-to-edit (Excel/Sheets style)
  g("document.activeElement && document.activeElement.blur();");
  window.setSelection(6, 2, false);
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'h', bubbles: true, cancelable: true }));
  const tEd = document.querySelector('.cell-editor');
  check('타이핑 즉시 편집 진입(내용 치환)', !!tEd && tEd.value === 'h', tEd && tEd.value);
  g("commitEdit();");
  check('타이핑 입력 커밋', g("cellData['6C']") === 'h', g("cellData['6C']"));
  window.setSelection(6, 2, false);
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  check('Tab 우측 이동', g("selectedCell.col") === 3 && g("selectedCell.row") === 6, JSON.stringify(g('selectedCell')));

  // 5z. click inside active editor keeps it open
  g("startEdit(6, 2); document.querySelector('.cell-editor').value = 'keep';");
  const edZ = document.querySelector('.cell-editor');
  edZ.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0, cancelable: true }));
  check('입력창 내 클릭 유지', edZ.isConnected === true && g("editingCell !== null") === true, edZ.isConnected + '/' + g("editingCell !== null"));
  g("cancelEdit();");

  // 5x3. Excel-style border menu
  window.setSelection(4, 1, false);
  window.setSelection(5, 2, true);
  g("applyBorder('outer');");
  const bdO = g("cellStyles['4B'].bd");
  check('보더 outer: 외곽만', bdO.t === 1 && bdO.l === 1 && !bdO.b && !bdO.r, JSON.stringify(bdO));
  const bdO2 = g("cellStyles['5C'].bd");
  check('보더 outer: 반대편 모서리', bdO2.b === 1 && bdO2.r === 1 && !bdO2.t && !bdO2.l, JSON.stringify(bdO2));
  g("applyBorder('thickOuter');");
  check('보더 thick outer', g("cellStyles['4B'].bd.t") === 2.5, String(g("cellStyles['4B'].bd.t")));
  g("applyBorder('all');");
  const bdA = g("cellStyles['4B'].bd");
  check('보더 all: 전변', bdA.t === 1 && bdA.b === 1 && bdA.l === 1 && bdA.r === 1, JSON.stringify(bdA));
  g("applyBorder('innerV');");
  check('보더 innerV: 내부 세로선', g("cellStyles['4C'].bd.l") === 1 && g("cellStyles['4C'].bd.r") === 1, JSON.stringify(g("cellStyles['4C'].bd")));
  g("applyBorder('all');");
  const cBB = document.querySelector('[data-row=\"4\"][data-col=\"1\"]');
  const cCB = document.querySelector('[data-row=\"4\"][data-col=\"2\"]');
  const cAA = document.querySelector('[data-row=\"3\"][data-col=\"1\"]');
  check('공유 변 단일선(실제 border)', cCB.style.borderLeft === '' && cCB.style.borderRight === '1px solid #5f6368' && cBB.style.borderBottom === '1px solid #5f6368' && cAA.style.borderBottom === '1px solid #5f6368' && cCB.style.borderTop === '1px solid #5f6368',
    [cCB.style.borderLeft, cCB.style.borderRight, cBB.style.borderBottom, cAA.style.borderBottom, cCB.style.borderTop].join('|'));
  g("applyBorder('none');");
  check('보더 none: 전멸', g("cellStyles['4B'] === undefined || cellStyles['4B'].bd === undefined") === true, JSON.stringify(g("cellStyles['4B'] || {}")));
  g("toggleBorderMenu();");
  check('보더 메뉴 열림', document.querySelectorAll('.bd-item').length === 11, String(document.querySelectorAll('.bd-item').length));
  g("closeBorderMenu();");

  // 5x4. toolbar sync buttons
  check('툴바 Auto/Refresh 존재', !!document.querySelector('.toolbar #btnLive') && !!document.querySelector('.toolbar #btnRefresh'), '');
  document.getElementById('btnLive').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('Auto Sync 토글', document.getElementById('btnLive').classList.contains('on') === true, document.getElementById('btnLive').className);
  document.getElementById('btnLive').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('Auto Sync 해제', document.getElementById('btnLive').classList.contains('on') === false, document.getElementById('btnLive').className);

  // 5y1. Esc Esc closes border menu; single Esc keeps it open
  g("toggleBorderMenu(); lastEscTime = 0;");
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Esc 1회: 보더 메뉴 유지', !!g('borderMenu'), String(!!g('borderMenu')));
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Esc 2회: 보더 메뉴 닫힘', !g('borderMenu'), String(!!g('borderMenu')));
  g("startEdit(6, 2);");
  document.querySelector('.cell-editor').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  check('편집 중 Esc: 취소+보스키 비발동', g('editingCell === null') === true && g('lastEscTime') === 0, String(g('lastEscTime')));

  // 5y2. privacy surface: no external font, no coinbase calls in page
  check('외부 폰트 로드 없음', !document.querySelector('link[href*="fonts.googleapis"]') && !global.__html.includes('fonts.googleapis'), '');
  check('페이지 내 Coinbase API 호출 없음', !global.__html.includes('api.coinbase.com'), '');

  // 5y3. autocomplete footer: change source button
  g("startEdit(6, 0);");
  check('드롭다운에 Change source 버튼', !!document.querySelector('#acPanel .ac-src-btn'), '');
  document.querySelector('#acPanel .ac-src-btn').dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  check('버튼 클릭 시 소스 모달 오픈', !!document.querySelector('.modal-overlay') && !document.querySelector('#acPanel.show'), String(!!document.querySelector('.modal-overlay')));
  document.querySelector('.modal-overlay').remove();
  g("cancelEdit();");

  // 5y4. Excel/Sheets TSV paste + copy to system clipboard
  Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: t => { global.__clip = t; return Promise.resolve(); } }, configurable: true });
  window.setSelection(8, 0, false);
  window.setSelection(9, 1, true);
  g("copySelection(false);");
  check('복사 시 시스템 클립보드 TSV', typeof global.__clip === 'string' && global.__clip.includes('\t'), JSON.stringify(global.__clip));
  window.setSelection(8, 2, false);
  const evP = new window.Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(evP, 'clipboardData', { value: { getData: () => 'hello\t12\nworld\t34' } });
  document.activeElement && document.activeElement.blur();
  document.dispatchEvent(evP);
  check('TSV 붙여넣기 배치', g("cellData['8C']") === 'hello' && g("cellData['8D']") === '12' && g("cellData['9C']") === 'world' && g("cellData['9D']") === '34',
    [g("cellData['8C']"), g("cellData['8D']"), g("cellData['9C']"), g("cellData['9D']")].join('|'));
  check('붙여넣기 후 선택영역 확장', g("selRange.r2") === 9 && g("selRange.c2") === 3, JSON.stringify(g('selRange')));
  g("undo();");
  check('붙여넣기 Undo', g("cellData['8C'] === undefined") === true, String(g("cellData['8C']")));
  window.setSelection(8, 2, false);
  const evH = new window.Event('paste', { bubbles: true, cancelable: true });
  const hHtml = '<meta charset="utf-8"><table><tr><td style="font-weight:700;text-align:center;background-color:rgb(255, 242, 204);color:rgb(155, 89, 182)">bold1</td><td style="font-style:italic">ital</td></tr></table>';
  Object.defineProperty(evH, 'clipboardData', { value: { getData: t => t === 'text/html' ? hHtml : 'bold1\tital' } });
  document.activeElement && document.activeElement.blur();
  document.dispatchEvent(evH);
  check('HTML 서식 복원', g("cellStyles['8C'].bold") === true && g("cellStyles['8C'].align") === 'center' && g("cellStyles['8C'].fill") === 'rgb(255, 242, 204)' && g("cellStyles['8D'].italic") === true,
    JSON.stringify(g("cellStyles['8C']")) + '|' + JSON.stringify(g("cellStyles['8D']")));
  g("undo();");

  // 5y6. avatar -> Buy Me a Coffee modal
  document.getElementById('avatarBtn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const bmcOv = document.querySelector('.modal-overlay');
  check('BMC 모달 열림', !!bmcOv && bmcOv.querySelector('h2').textContent === 'Buy Me a Coffee' && !!bmcOv.querySelector('.m-btn.primary'), bmcOv && bmcOv.querySelector('h2').textContent);
  g("lastEscTime = 0;");
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('BMC 모달 Esc 닫힘', !document.querySelector('.modal-overlay'));

  // 5y4b. Mobile tap-to-edit
  g("selectCell(1, colMap.inv);");
  const tapCell = g("getCellElement(1, colMap.inv)");
  window.eval('var _neeOrig = nearSelEdge;');
  window.eval('nearSelEdge = () => false;');
  document.dispatchEvent(new window.Event('touchstart'));
  const tev = new window.MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
  Object.defineProperty(tev, 'target', { value: tapCell });
  const origSel = tapCell.getAttribute('data-r');
  tapCell.dispatchEvent(tev);
  check('터치 탭(선택된 셀 재탭) -> 편집 시작', !!document.querySelector('.cell-editor'), '');
  g("cancelEdit(); nearSelEdge = () => true;");
  window.eval('nearSelEdge = _neeOrig;');

  // 5y4c. Mobile menu toggle
  check('menu toggle 버튼 존재', !!document.getElementById('menuToggle'), '');
  document.getElementById('menuToggle').click();
  check('클릭 -> 메뉴 열림(open)', document.querySelector('.header-menu').classList.contains('open'), '');
  document.querySelector('.menu-item[data-menu="file"]').click();
  check('메뉴 항목 클릭 -> 드로어 닫힘', !document.querySelector('.header-menu').classList.contains('open'), '');
  document.getElementById('fileMenu') && document.getElementById('fileMenu').classList.remove('show');

  // 5y4e. Mobile toolbar restructure
  window.matchMedia = q => ({ matches: q.includes('768'), addListener(){}, removeListener(){} });
  g("buildMobileToolbar();");
  const tbEl = document.querySelector('.toolbar');
  check('도구모바일: More 버튼 생성', !!document.getElementById('tbMore'), '');
  check('More 팝업에 Print/서식 이동', document.querySelector('.tb-more-pop').contains(document.getElementById('btnPrint')), '');
  check('core에 Undo~Paste', document.querySelector('.tb-core').contains(document.getElementById('btnPaste')) && document.querySelector('.tb-core').contains(document.getElementById('btnUndo')), '');
  check('Auto/Refresh 우측고정(tb-fixed)', document.getElementById('btnLive').classList.contains('tb-fixed') && tbEl.lastElementChild.id === 'btnRefresh', tbEl.lastElementChild.id);
  document.getElementById('tbMore').click();
  check('More 탭 -> 팝업 열림', document.querySelector('.tb-more-pop').classList.contains('show'), '');
  document.body.click();
  check('바깥 탭 -> 닫힘', !document.querySelector('.tb-more-pop').classList.contains('show'), '');
  window.matchMedia = undefined;

  // 5y4d. Mobile ac bottom sheet
  window.matchMedia = q => ({ matches: q.includes('768'), addListener(){}, removeListener(){} });
  g("selectCell(6, colMap.code); startEdit(6, colMap.code);");
  check('모바일: 드롭다운이 바텀시트로', document.getElementById('acPanel').classList.contains('ac-sheet') && !!document.querySelector('.ac-backdrop'), '');
  document.querySelector('.ac-backdrop').dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  check('배경 탭 -> 시트 닫힘', !document.getElementById('acPanel').classList.contains('show') && !document.querySelector('.ac-backdrop'), '');
  g("if (editingCell) cancelEdit();");
  window.matchMedia = undefined;

  // 5y6a. CoinGecko tokenized stocks
  g("localStorage.removeItem('cgStockIds'); applyDataSource('coingecko');");
  await g("refreshMarket(true)");
  check('CG: tokenized stock fetch', g("prices['AAPL'] && prices['AAPL'].src === 'coingecko' && prices['AAPL'].price === 228.15"), JSON.stringify(g("prices['AAPL']")));
  check('CG: stock id cache (우선순위 coinbase-tokenized)', g("JSON.parse(localStorage.getItem('cgStockIds')).AAPL") === 'apple-coinbase-tokenized-stock', g("localStorage.getItem('cgStockIds')"));
  check('CG: crypto 유지', g("prices['BTC'] && prices['BTC'].price === 70000"), JSON.stringify(g("prices['BTC']")));
  g("applyDataSource('binance');");
  await g("refreshMarket(true)");

  // 5y6b. Bybit / OKX sources
  check('SRC_META with Bybit/OKX', g("SRC_META.some(m => m[0] === 'bybit') && SRC_META.some(m => m[0] === 'okx')"), '');
  g("applyDataSource('bybit');");
  await g("refreshMarket(true)");
  check('Bybit: crypto fetch', g("prices['BTC'] && prices['BTC'].src === 'bybit' && prices['BTC'].price === 70000"), JSON.stringify(g("prices['BTC']")));
  check('Bybit: 24h change %', Math.abs(g("prices['BTC'].change") - 1.5) < 0.001, String(g("prices['BTC'].change")));
  check('Bybit: xStocks stock fetch', g("prices['AAPL'] && prices['AAPL'].src === 'bybit' && prices['AAPL'].price === 190.12"), JSON.stringify(g("prices['AAPL']")));
  g("applyDataSource('okx');");
  await g("refreshMarket(true)");
  check('OKX: crypto fetch', g("prices['BTC'] && prices['BTC'].src === 'okx' && prices['BTC'].price === 70000"), JSON.stringify(g("prices['BTC']")));
  check('OKX: change from open24h', Math.abs(g("prices['BTC'].change") - (70000/68000-1)*100) < 0.001, String(g("prices['BTC'].change")));
  g("applyDataSource('binance');");
  await g("refreshMarket(true)");

  // 5y7. CoinGecko attribution credit
  check('크레딧 요소 존재', !!document.getElementById('cgCredit'), '');
  g("dataSource = 'coingecko'; renderGrid();");
  check('coingecko 소스 시 크레딧 표시', document.getElementById('cgCredit').hidden === false, String(document.getElementById('cgCredit').hidden));
  g("dataSource = 'binance'; renderGrid();");
  check('기타 소스 시 숨김', document.getElementById('cgCredit').hidden === true, String(document.getElementById('cgCredit').hidden));

  // 5y. Esc cancels edit without saving
  g("cellData['6C'] = 'keep'; renderGrid();");
  window.startEdit(6, 2);
  const ed6 = document.querySelector('.cell-editor');
  ed6.value = 'zap';
  ed6.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await wait(50);
  check('Esc: 편집 취소(미저장)', g("cellData['6C']") === 'keep' && g('editingCell') === null, g("cellData['6C']"));

  // 5x. Help menu + quick guide modal + Esc closes
  document.querySelector('[data-menu="help"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const helpItems = Array.from(document.querySelectorAll('.menu-dropdown .md-item')).map(d => d.textContent);
  check('Help 메뉴 열림', helpItems.includes('Quick guide'), helpItems.join(','));
  Array.from(document.querySelectorAll('.menu-dropdown .md-item')).find(d => d.textContent === 'Quick guide').dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  const helpOv = document.querySelector('.modal-overlay');
  check('Quick guide 모달', !!helpOv && helpOv.textContent.includes('Binance') && helpOv.textContent.includes('Esc') && !helpOv.textContent.includes('Formulas'), helpOv && helpOv.textContent.slice(0, 60));
  check('Quick guide 헤더(로고 없음/타이틀 좌/빌드 우)', !!helpOv && !helpOv.querySelector('.hg-head svg') && helpOv.querySelector('.hg-head h2').textContent === 'Quick guide' && !!helpOv.querySelector('.hg-head .hg-tag'), helpOv && helpOv.querySelector('.hg-head').innerHTML.slice(0, 40));
  const gotIt = Array.from(document.querySelectorAll('.m-btnrow .m-btn')).find(b => b.textContent === 'Got it');
  check('Got it 버튼 우측 배치', !!gotIt && gotIt.closest('.m-btnrow') !== null, String(!!gotIt));
  if (gotIt) gotIt.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('Got it 클릭 시 닫힘', !document.querySelector('.modal-overlay'));
  g("openHelpModal();");
  g("lastEscTime = 0;");
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Esc 1회: 모달 유지(편집과 비혼동)', !!document.querySelector('.modal-overlay'));
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Esc 2회 연속: 모달 닫힘', !document.querySelector('.modal-overlay'));
  document.querySelector('[data-menu="file"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  check('File 메뉴 열림', !!document.querySelector('.menu-dropdown'));
  g("lastEscTime = 0;");
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Esc 1회: 메뉴 유지', !!document.querySelector('.menu-dropdown'));
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Esc 2회 연속: 메뉴 닫힘', !document.querySelector('.menu-dropdown'));

  // 5w. built-in self-test harness
  const c2Before = g("cellData['2C']");
  const res = await g("runSelfTest()");
  const fails = g("JSON.stringify(window.__selfTestResults.filter(r => r[1] !== 'PASS'))");
  check('내장 셀프테스트 전부 통과', res === g("window.__selfTestResults.length + '/' + window.__selfTestResults.length") && fails === '[]', res + ' fails=' + fails);
  check('테스트 후 사용자 데이터 복구', g("cellData['2C']") === c2Before, c2Before + ' -> ' + g("cellData['2C']"));
  check('셀프테스트 결과 모달', !!document.querySelector('.modal-overlay') && document.querySelector('.modal-overlay').textContent.includes('Self-test'));
  document.querySelector('.modal-overlay').remove();

  // 5v. title single-line editing
  const h1 = document.querySelector('.header-title h1');
  const before = h1.textContent;
  const ev = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  h1.dispatchEvent(ev);
  check('타이틀 Enter 줄바꿈 차단', ev.defaultPrevented && h1.querySelector('br') === null && h1.textContent === before, h1.innerHTML.slice(0, 60));

  // 6. no runtime errors flag
  check('런타임 에러 없음', errs.length === 0, errs.join(' | '));

  console.log('\n' + pass + '/' + (pass + fail) + ' passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('TEST CRASH: ' + (e && e.stack || e)); process.exit(1); });
