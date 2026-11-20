/**
 * 屏東縣全縣 6 大地政事務所轄區與 33 鄉鎮市地理參考資料
 * 含一至四等控制點／圖根點空間示範資料庫
 */

const PINGTUNG_OFFICES = {
  '屏東地政事務所': ['屏東市', '萬丹鄉', '九如鄉', '長治鄉', '麟洛鄉'],
  '潮州地政事務所': ['潮州鎮', '萬巒鄉', '內埔鄉', '竹田鄉', '新埤鄉', '泰武鄉', '來義鄉', '瑪家鄉'],
  '東港地政事務所': ['東港鎮', '新園鄉', '林邊鄉', '南州鄉', '崁頂鄉', '琉球鄉'],
  '恆春地政事務所': ['恆春鎮', '車城鄉', '滿州鄉', '牡丹鄉'],
  '里港地政事務所': ['里港鄉', '高樹鄉', '鹽埔鄉', '三地門鄉', '霧臺鄉'],
  '枋寮地政事務所': ['枋寮鄉', '佳冬鄉', '春日鄉', '枋山鄉', '獅子鄉']
};

const TOWNSHIPS = [
  { name: '屏東市', office: '屏東地政事務所', lat: 22.6761, lon: 120.4879, h: 24.5, section: '公園段' },
  { name: '萬丹鄉', office: '屏東地政事務所', lat: 22.5892, lon: 120.4894, h: 12.8, section: '萬丹段' },
  { name: '九如鄉', office: '屏東地政事務所', lat: 22.7314, lon: 120.4864, h: 28.4, section: '九如段' },
  { name: '長治鄉', office: '屏東地政事務所', lat: 22.6775, lon: 120.5278, h: 35.2, section: '繁華段' },
  { name: '麟洛鄉', office: '屏東地政事務所', lat: 22.6508, lon: 120.5269, h: 27.6, section: '麟洛段' },

  { name: '潮州鎮', office: '潮州地政事務所', lat: 22.5503, lon: 120.5422, h: 22.1, section: '潮州段' },
  { name: '萬巒鄉', office: '潮州地政事務所', lat: 22.5731, lon: 120.5681, h: 31.4, section: '萬金段' },
  { name: '內埔鄉', office: '潮州地政事務所', lat: 22.6119, lon: 120.5664, h: 42.7, section: '內埔段' },
  { name: '竹田鄉', office: '潮州地政事務所', lat: 22.5858, lon: 120.5439, h: 24.0, section: '竹田段' },
  { name: '新埤鄉', office: '潮州地政事務所', lat: 22.4694, lon: 120.5514, h: 18.5, section: '新埤段' },
  { name: '泰武鄉', office: '潮州地政事務所', lat: 22.5889, lon: 120.6317, h: 385.0, section: '佳平段' },
  { name: '來義鄉', office: '潮州地政事務所', lat: 22.5264, lon: 120.6331, h: 268.4, section: '古樓段' },
  { name: '瑪家鄉', office: '潮州地政事務所', lat: 22.7072, lon: 120.6461, h: 412.6, section: '北葉段' },

  { name: '東港鎮', office: '東港地政事務所', lat: 22.4653, lon: 120.4494, h: 4.2, section: '東港段' },
  { name: '新園鄉', office: '東港地政事務所', lat: 22.5236, lon: 120.4597, h: 7.5, section: '仙吉段' },
  { name: '林邊鄉', office: '東港地政事務所', lat: 22.4358, lon: 120.5144, h: 3.1, section: '林邊段' },
  { name: '南州鄉', office: '東港地政事務所', lat: 22.4903, lon: 120.5086, h: 10.6, section: '溪州段' },
  { name: '崁頂鄉', office: '東港地政事務所', lat: 22.5144, lon: 120.5139, h: 11.9, section: '崁頂段' },
  { name: '琉球鄉', office: '東港地政事務所', lat: 22.3422, lon: 120.3694, h: 38.4, section: '白沙段' },

  { name: '恆春鎮', office: '恆春地政事務所', lat: 22.0039, lon: 120.7436, h: 22.8, section: '恆春段' },
  { name: '車城鄉', office: '恆春地政事務所', lat: 22.0725, lon: 120.7136, h: 14.3, section: '車城段' },
  { name: '滿州鄉', office: '恆春地政事務所', lat: 22.0211, lon: 120.8386, h: 48.2, section: '滿州段' },
  { name: '牡丹鄉', office: '恆春地政事務所', lat: 22.1264, lon: 120.7797, h: 196.5, section: '石門段' },

  { name: '里港鄉', office: '里港地政事務所', lat: 22.7792, lon: 120.4944, h: 46.8, section: '里港段' },
  { name: '高樹鄉', office: '里港地政事務所', lat: 22.8264, lon: 120.6019, h: 88.2, section: '高樹段' },
  { name: '鹽埔鄉', office: '里港地政事務所', lat: 22.7544, lon: 120.5719, h: 54.1, section: '鹽埔段' },
  { name: '三地門鄉', office: '里港地政事務所', lat: 22.7147, lon: 120.6542, h: 215.7, section: '三地段' },
  { name: '霧臺鄉', office: '里港地政事務所', lat: 22.7478, lon: 120.7314, h: 968.3, section: '霧臺段' },

  { name: '枋寮鄉', office: '枋寮地政事務所', lat: 22.3653, lon: 120.5944, h: 11.4, section: '枋寮段' },
  { name: '佳冬鄉', office: '枋寮地政事務所', lat: 22.4167, lon: 120.5519, h: 4.8, section: '佳冬段' },
  { name: '春日鄉', office: '枋寮地政事務所', lat: 22.3711, lon: 120.6292, h: 142.0, section: '春日段' },
  { name: '枋山鄉', office: '枋寮地政事務所', lat: 22.2611, lon: 120.6536, h: 16.5, section: '楓港段' },
  { name: '獅子鄉', office: '枋寮地政事務所', lat: 22.2017, lon: 120.7064, h: 185.2, section: '楓林段' }
];

// Deterministic pseudo-random helper so points stay consistent across reloads
function seededOffset(seed, scale) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return ((x - Math.floor(x)) - 0.5) * scale;
}

function buildInitialControlPoints() {
  const points = [
    // 一等控制點（國家基本控制點 / 衛星追蹤站）
    {
      id: 'PT-A001',
      name: '屏東衛星追蹤站 (PTNG)',
      order: 1,
      township: '屏東市',
      office: '屏東地政事務所',
      authority: '內政部國土測繪中心',
      section: '和平段',
      lat: 22.668421,
      lon: 120.478512,
      h: 31.42,
      monument: '強制歸心不鏽鋼觀測墩',
      status: '正常',
      installDate: '2016-05-18',
      note: '屋頂強制歸心站，對空通視極佳，24小時連續接收 GNSS 觀測資料。'
    },
    {
      id: 'PT-A002',
      name: '潮州一等控制點',
      order: 1,
      township: '潮州鎮',
      office: '潮州地政事務所',
      authority: '內政部國土測繪中心',
      section: '光華段',
      lat: 22.553812,
      lon: 120.545920,
      h: 26.85,
      monument: '一等衛星控制點銅標',
      status: '正常',
      installDate: '2014-11-04',
      note: '位於潮州公有建物頂樓女兒牆旁，通視良好。'
    },
    {
      id: 'PT-A003',
      name: '恆春氣象站 (HENC)',
      order: 1,
      township: '恆春鎮',
      office: '恆春地政事務所',
      authority: '內政部國土測繪中心',
      section: '城南段',
      lat: 22.003745,
      lon: 120.746318,
      h: 28.91,
      monument: '強制歸心不鏽鋼柱',
      status: '正常',
      installDate: '2012-08-22',
      note: '南臺灣重要一等基準點，周邊無高大遮蔽物。'
    },
    {
      id: 'PT-A004',
      name: '小琉球燈塔一等點',
      order: 1,
      township: '琉球鄉',
      office: '東港地政事務所',
      authority: '內政部國土測繪中心',
      section: '大福段',
      lat: 22.332195,
      lon: 120.371240,
      h: 82.14,
      monument: '花崗岩一等三角點標石',
      status: '正常',
      installDate: '2009-03-15',
      note: '離島高程與平面聯測基準點，可遠眺台灣本島海岸線。'
    },
    {
      id: 'PT-A005',
      name: '高樹北端一等點',
      order: 1,
      township: '高樹鄉',
      office: '里港地政事務所',
      authority: '內政部國土測繪中心',
      section: '新豐段',
      lat: 22.842150,
      lon: 120.612480,
      h: 105.60,
      monument: '一等衛星控制點銅標',
      status: '正常',
      installDate: '2015-07-10',
      note: '屏北平原與高雄六龜交界控制網基準點。'
    },
    {
      id: 'PT-A006',
      name: '鵝鑾鼻一等基準點',
      order: 1,
      township: '恆春鎮',
      office: '恆春地政事務所',
      authority: '內政部國土測繪中心',
      section: '鵝鑾段',
      lat: 21.902235,
      lon: 120.852910,
      h: 39.74,
      monument: '不鏽鋼一等控制點標',
      status: '正常',
      installDate: '2017-04-09',
      note: '台灣本島最南端控制點，海風鹽蝕需定期檢視保護蓋。'
    },
    {
      id: 'PT-A007',
      name: '枋寮南端一等點',
      order: 1,
      township: '枋寮鄉',
      office: '枋寮地政事務所',
      authority: '內政部國土測繪中心',
      section: '水底寮段',
      lat: 22.382910,
      lon: 120.596120,
      h: 18.23,
      monument: '一等衛星控制點銅標',
      status: '正常',
      installDate: '2018-09-12',
      note: '屏南走廊幹線控制點，台1線旁公有設施頂部。'
    }
  ];

  // 為全縣 33 鄉鎮市自動生成具代表性的二、三、四等控制點／圖根點
  let seq2 = 101;
  let seq3 = 301;
  let seq4 = 4001;

  TOWNSHIPS.forEach((tw, idx) => {
    // 每 2 個鄉鎮至少 1 個二等控制點
    if (idx % 2 === 0) {
      points.push({
        id: `PT-B${seq2++}`,
        name: `${tw.name.replace(/[鄉鎮市]/, '')}二等衛星點`,
        order: 2,
        township: tw.name,
        office: tw.office,
        authority: '內政部國土測繪中心／縣府地政處',
        section: tw.section,
        lat: +(tw.lat + seededOffset(idx * 3 + 1, 0.018)).toFixed(6),
        lon: +(tw.lon + seededOffset(idx * 3 + 2, 0.018)).toFixed(6),
        h: +(tw.h + Math.abs(seededOffset(idx * 3 + 3, 12))).toFixed(2),
        monument: '二等衛星控制點銅標',
        status: idx % 14 === 0 ? '待複測' : '正常',
        installDate: '2019-06-20',
        note: `位於${tw.name}${tw.section}公有廳舍或學校頂樓，車輛可直達。`
      });
    }

    // 每個鄉鎮配置 1~2 個三等加密控制點
    const count3 = idx % 3 === 0 ? 2 : 1;
    for (let j = 0; j < count3; j++) {
      points.push({
        id: `PT-C${seq3++}`,
        name: `${tw.name.replace(/[鄉鎮市]/, '')}加密-${j + 1}`,
        order: 3,
        township: tw.name,
        office: tw.office,
        authority: `屏東縣政府地政處（${tw.office}）`,
        section: tw.section,
        lat: +(tw.lat + seededOffset(idx * 7 + j * 5 + 11, 0.026)).toFixed(6),
        lon: +(tw.lon + seededOffset(idx * 7 + j * 5 + 12, 0.026)).toFixed(6),
        h: +(tw.h + Math.abs(seededOffset(idx * 7 + j * 5 + 13, 8))).toFixed(2),
        monument: '三等加密控制點鋼標',
        status: (idx + j) % 19 === 0 ? '遺失' : '正常',
        installDate: '2021-03-14',
        note: `${tw.office}轄區加密控制點，埋設於道路安全島或橋台護欄。`
      });
    }

    // 每個鄉鎮配置 2 個四等控制點／地籍圖根點
    for (let k = 0; k < 2; k++) {
      points.push({
        id: `PT-D${seq4++}`,
        name: `${tw.section}圖根-${k + 1}`,
        order: 4,
        township: tw.name,
        office: tw.office,
        authority: tw.office,
        section: tw.section,
        lat: +(tw.lat + seededOffset(idx * 11 + k * 4 + 21, 0.032)).toFixed(6),
        lon: +(tw.lon + seededOffset(idx * 11 + k * 4 + 22, 0.032)).toFixed(6),
        h: +(tw.h + Math.abs(seededOffset(idx * 11 + k * 4 + 23, 5))).toFixed(2),
        monument: k === 0 ? '圖根點不鏽鋼釘' : '水泥樁圖根點',
        status: (idx + k) % 17 === 0 ? '待複測' : '正常',
        installDate: '2023-08-05',
        note: `地籍測量及土地複丈常用圖根點，位於${tw.section}巷道交會處路面。`
      });
    }
  });

  return points;
}

const INITIAL_CONTROL_POINTS = buildInitialControlPoints();
