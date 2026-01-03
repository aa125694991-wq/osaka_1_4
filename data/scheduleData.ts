import { ScheduleEvent } from '../types';

// 2026/1/8 ~ 2026/1/15 的日期陣列
export const INITIAL_DATES = [
  '2026-01-08', // Thu
  '2026-01-09', // Fri
  '2026-01-10', // Sat
  '2026-01-11', // Sun
  '2026-01-12', // Mon
  '2026-01-13', // Tue
  '2026-01-14', // Wed
  '2026-01-15'  // Thu
];

export const INITIAL_EVENTS: ScheduleEvent[] = [
  // --- 第 1 天：1月8日 (週四) ---
  { 
    id: 'd1-1', 
    date: '2026-01-08', 
    time: '12:50', 
    title: '抵達關西機場 (KIX)', 
    location: { name: 'Kansai Airport' }, 
    category: 'transport', 
    notes: '辦理入境手續、領取行李。' 
  },
  { 
    id: 'd1-2', 
    date: '2026-01-08', 
    time: '14:14', 
    title: '搭乘 JR HARUKA 前往京都', 
    location: { name: '關西機場站' }, 
    category: 'transport', 
    notes: '班次：14:14 或 14:44 (約75分鐘)。' 
  },
  { 
    id: 'd1-3', 
    date: '2026-01-08', 
    time: '16:30', 
    title: 'Check-in: Super Hotel 四條河原町', 
    location: { name: 'Super Hotel Shijokawaramachi' }, 
    category: 'accommodation', 
    notes: '交通：從京都站轉地鐵至「四條站」，再轉阪急電鐵至「京都河原町站」6號出口。' 
  },
  { 
    id: 'd1-4', 
    date: '2026-01-08', 
    time: '17:30', 
    title: '暮色漫步：四條大橋、鴨川', 
    location: { name: '四條大橋' }, 
    category: 'sightseeing', 
    notes: '欣賞鴨川夕陽與河畔景色。' 
  },
  { 
    id: 'd1-5', 
    date: '2026-01-08', 
    time: '19:00', 
    title: '晚餐：柚子元 (Yuzugen)', 
    location: { name: '先斗町 柚子元' }, 
    category: 'food', 
    reservationNumber: 'JGN6DU9QYT',
    notes: '地點：先斗町石板小徑內。（手續費已付）' 
  },

  // --- 第 2 天：1月9日 (週五) ---
  { 
    id: 'd2-1', 
    date: '2026-01-09', 
    time: '09:00', 
    title: '和服租借體驗', 
    location: { name: '京都' }, 
    category: 'sightseeing', 
    notes: '換裝與造型。' 
  },
  { 
    id: 'd2-2', 
    date: '2026-01-09', 
    time: '10:30', 
    title: '參拜 清水寺', 
    location: { name: '清水寺' }, 
    category: 'sightseeing', 
    notes: '世界遺產，清水舞台。' 
  },
  { 
    id: 'd2-3', 
    date: '2026-01-09', 
    time: '12:00', 
    title: '午餐：京都祇園うなぎ四代目菊川', 
    location: { name: 'Gion' }, 
    category: 'food', 
    reservationNumber: 'QZ2UKQCC2C' 
  },
  { 
    id: 'd2-4', 
    date: '2026-01-09', 
    time: '14:00', 
    title: '東山古街漫步', 
    location: { name: '二年坂、產寧坂' }, 
    category: 'sightseeing', 
    notes: '散步路線：二年坂 -> 產寧坂 -> 八坂神社。' 
  },
  { 
    id: 'd2-5', 
    date: '2026-01-09', 
    time: '20:00', 
    title: '晚餐：六角ace', 
    location: { name: '六角ace' }, 
    category: 'food', 
    reservationNumber: '64H779' 
  },

  // --- 第 3 天：1月10日 (週六) ---
  { 
    id: 'd3-1', 
    date: '2026-01-10', 
    time: '08:30', 
    title: '伏見稻荷大社', 
    location: { name: '伏見稻荷大社' }, 
    category: 'sightseeing', 
    notes: '08:00 從飯店出發，於「祇園四條站」搭京阪本線。重點：千本鳥居、四十字路口俯瞰景觀。' 
  },
  { 
    id: 'd3-2', 
    date: '2026-01-10', 
    time: '11:30', 
    title: '錦市場 & 午餐', 
    location: { name: '錦市場' }, 
    category: 'food', 
    notes: '美食推薦：京都名代豬排 (四条東洞院店)、豆乳甜甜圈、生魚片串。' 
  },
  { 
    id: 'd3-3', 
    date: '2026-01-10', 
    time: '13:30', 
    title: '二條城', 
    location: { name: '元離宮二條城' }, 
    category: 'sightseeing', 
    notes: '重點：二之丸御殿「鸝鳴地板」。' 
  },
  { 
    id: 'd3-4', 
    date: '2026-01-10', 
    time: '15:00', 
    title: '金閣寺 (鹿苑寺)', 
    location: { name: '金閣寺' }, 
    category: 'sightseeing', 
    notes: '看點：捕捉舍利殿下午的金色倒影。' 
  },
  { 
    id: 'd3-5', 
    date: '2026-01-10', 
    time: '16:15', 
    title: '下鴨神社 & 糾之森', 
    location: { name: '下鴨神社' }, 
    category: 'sightseeing', 
    notes: '京都最古老森林神社。' 
  },
  { 
    id: 'd3-6', 
    date: '2026-01-10', 
    time: '17:00', 
    title: '鴨川跳龜石', 
    location: { name: '出町柳三角洲' }, 
    category: 'sightseeing', 
    notes: '在出町柳三角洲玩跳龜、看夕陽。' 
  },
  { 
    id: 'd3-7', 
    date: '2026-01-10', 
    time: '18:00', 
    title: '平安神宮', 
    location: { name: '平安神宮' }, 
    category: 'sightseeing', 
    notes: '看點：巨大紅色大鳥居。' 
  },
  { 
    id: 'd3-8', 
    date: '2026-01-10', 
    time: '19:00', 
    title: '晚餐：河原町商圈', 
    location: { name: '河原町' }, 
    category: 'food', 
    notes: '推薦：名代 Omen 烏龍沾麵 或 京極かねよ 玉子燒鰻魚飯。' 
  }
];