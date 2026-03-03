export const getCalendarDate = (dayCount: number) => {
  // 设定游戏开始日期：2025年9月1日（周一）
  const startDate = new Date(2025, 8, 1); // 8 代表 9月
  
  // 计算当前日期
  const currentDate = new Date(startDate);
  currentDate.setDate(startDate.getDate() + (dayCount - 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const day = currentDate.getDate();
  const dayOfWeek = currentDate.getDay(); // 0 = 周日

  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const weekday = weekdays[dayOfWeek];

  // 简单的季节判断
  let season = "Autumn";
  if (month >= 3 && month <= 5) season = "Spring";
  else if (month >= 6 && month <= 8) season = "Summer";
  else if (month >= 9 && month <= 11) season = "Autumn";
  else season = "Winter";

  return {
    year,
    month,
    day,
    weekday,
    season,
    dayOfWeek
  };
};
