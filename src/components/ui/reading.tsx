/** Typographic treatment only: retains the exact upstream formatted string. */
export function Reading({ value }: { value: string }) {
  const pieces = /^(.*?)(\s*)(kWh|kW|Wh|W|%|V|A|Hz|°C|°F)$/.exec(value);
  return pieces ? (
    <>
      <span className="reading-number" key={value}>
        {pieces[1]}
      </span>
      <span className="reading-unit">
        {pieces[2]}
        {pieces[3]}
      </span>
    </>
  ) : (
    <span className="reading-number" key={value}>
      {value}
    </span>
  );
}
