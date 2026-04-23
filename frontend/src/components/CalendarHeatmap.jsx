const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function colorForReturn(value) {
  const numericValue = Number(value);
  if (value === null || value === undefined || Number.isNaN(numericValue)) {
    return '#f0f2f5';
  }
  if (numericValue > 0.04) {
    return '#1b7f3a';
  }
  if (numericValue > 0) {
    return '#8fd19e';
  }
  if (numericValue < -0.04) {
    return '#b4233c';
  }
  if (numericValue < 0) {
    return '#f2a7b3';
  }
  return '#f0f2f5';
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
                (() => {
                  const numericReturn = Number(cell.daily_return);
                  const hasValidReturn =
                    cell.daily_return !== null &&
                    cell.daily_return !== undefined &&
                    !Number.isNaN(numericReturn);
                  return (
                    <div
                      key={cell.date}
                      className="calendar-cell"
                      title={`${cell.date} | ${
                        hasValidReturn ? `${(numericReturn * 100).toFixed(2)}%` : 'N/A'
                      }`}
                      style={{ background: colorForReturn(numericReturn) }}
                    />
                  );
                })()
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
