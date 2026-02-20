"use client";

export function Footer() {
  return (
    <footer
      className="flex justify-center items-center gap-1.5 border-t border-sage-100"
      style={{ padding: "24px 16px" }}
    >
      <span
        className="font-(family-name:--font-mono) text-sage-300 uppercase"
        style={{ fontSize: 9, letterSpacing: "0.1em" }}
      >
        POWERED BY
      </span>
      <a
        href="https://glove.dterminal.net"
        target="_blank"
        rel="noreferrer"
        className="font-(family-name:--font-display) text-sage-500 hover:text-sage-700"
        style={{
          fontSize: 12,
          textDecoration: "none",
          transition: "color 0.2s ease",
        }}
      >
        Glove
      </a>
      <span
        className="font-(family-name:--font-mono) text-sage-300"
        style={{ fontSize: 9 }}
      >
        &middot;
      </span>
      <a
        href="https://dterminal.net"
        target="_blank"
        rel="noreferrer"
        className="font-(family-name:--font-mono) text-sage-300 hover:text-sage-500"
        style={{
          fontSize: 9,
          letterSpacing: "0.05em",
          textDecoration: "none",
          transition: "color 0.2s ease",
        }}
      >
        dterminal.net
      </a>
    </footer>
  );
}
