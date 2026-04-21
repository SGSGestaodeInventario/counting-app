import { useEffect, useState } from "react";

export function TypewriterText({ text, speed = 70 }: { text: string; speed?: number }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return (
    <span aria-label={text} className="inline-block min-h-[1em]">
      <span aria-hidden="true">{shown}</span>
      <span aria-hidden="true" className="inline-block w-[2px] h-[0.9em] align-[-0.1em] ml-0.5 bg-current animate-pulse" />
    </span>
  );
}
