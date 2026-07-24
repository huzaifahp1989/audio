export type WeeklyWinnerAnnouncement = {
  id: string;
  winner_name: string;
  madrasah_name: string | null;
  week_start_date: string;
  created_at: string;
};

export type WinnerMonthGroup = {
  monthKey: string;
  year: number;
  month: number;
  label: string;
  winners: WeeklyWinnerAnnouncement[];
};

export function formatWeekLabel(weekStartDate: string): string {
  const start = new Date(`${weekStartDate}T12:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return weekStartDate;

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  return `${fmt(start)} – ${fmt(end)}`;
}

export function formatMonthLabel(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month - 1, 1));
  if (Number.isNaN(date.getTime())) return `${year}-${String(month).padStart(2, '0')}`;
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function groupWinnersByWeek(winners: WeeklyWinnerAnnouncement[]) {
  const map = new Map<string, WeeklyWinnerAnnouncement[]>();
  for (const row of winners) {
    const key = String(row.week_start_date).slice(0, 10);
    const list = map.get(key) || [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([weekStartDate, rows]) => ({ weekStartDate, winners: rows }));
}

export function groupWinnersByMonth(winners: WeeklyWinnerAnnouncement[]): WinnerMonthGroup[] {
  const map = new Map<string, WeeklyWinnerAnnouncement[]>();
  for (const row of winners) {
    const key = String(row.week_start_date).slice(0, 7);
    const list = map.get(key) || [];
    list.push(row);
    map.set(key, list);
  }

  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([monthKey, rows]) => {
      const [yearString, monthString] = monthKey.split('-');
      const year = Number(yearString);
      const month = Number(monthString);
      return {
        monthKey,
        year,
        month,
        label: formatMonthLabel(year, month),
        winners: rows.sort((a, b) => String(b.week_start_date).localeCompare(String(a.week_start_date))),
      };
    });
}
