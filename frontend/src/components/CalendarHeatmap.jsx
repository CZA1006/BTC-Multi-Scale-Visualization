const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function colorForReturn(value) {
  if (value === null || value === undefined) {
    return 'var(--heat-neutral)';
  }
  if (value >= 0.04) {
    return 'var(--heat-hot)';
  }
  if (value >= 0.015) {
    return 'var(--heat-warm)';
  }
  if (value <= -0.04) {
    return 'var(--heat-cold)';
  }
  if (value <= -0.015) {
    return 'var(--heat-cool)';
  }
  return 'var(--heat-neutral)';
}

export function CalendarHeatmap({ calendar }) {
  const grouped = calendar.reduce((accumulator, cell) => {
    const key = `${cell.year}-${String(cell.month).padStart(2, '0')}`;
    if (!accumulator[key]) {
      accumulator[key] = [];
    }
    accumulator[key].push(cell);
    return accumulator;
  }, {});

  return (
    <div className="calendar-grid">
      {Object.entries(grouped).map(([key, monthCells]) => {
        const monthIndex = (monthCells[0]?.month ?? 1) - 1;
        return (
          <section className="calendar-month" key={key}>
            <header>
              <span>{MONTH_LABELS[monthIndex]}</span>
              <small>{monthCells[0]?.year}</small>
            </header>
            <div className="calendar-cells">
              {monthCells.map((cell) => (
                <div
                  key={cell.date}
                  className="calendar-cell"
                  title={`${cell.date} | ${((cell.daily_return ?? 0) * 100).toFixed(2)}%`}
                  style={{ background: colorForReturn(cell.daily_return) }}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
