"use client";

import { motion } from "framer-motion";

/**
 * Hero section: Large "Arc" title in Instrument Serif,
 * a single punchy tagline, and a subtle scroll indicator.
 */
export function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center min-h-[90vh] px-4 sm:px-8">
      {/* Product name */}
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="font-(family-name:--font-display) text-sage-900 leading-none select-none"
        style={{ fontSize: "clamp(80px, 14vw, 180px)" }}
      >
        Arc
      </motion.h1>

      {/* Tagline */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25, ease: "easeOut" }}
        className="font-(family-name:--font-body) text-sage-700 text-lg md:text-xl mt-6 text-center max-w-md"
        style={{ fontWeight: 400 }}
      >
        Ask your database anything.
      </motion.p>

      {/* Subtext */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
        className="font-(family-name:--font-body) text-sage-500 text-sm mt-3 text-center max-w-sm"
        style={{ fontWeight: 300 }}
      >
        A conversational database tool built on{" "}
        <a
          href="https://glove.dterminal.net"
          target="_blank"
          rel="noreferrer"
          className="text-sage-500 hover:text-sage-700"
          style={{ textDecoration: "none", transition: "color 0.2s ease" }}
        >
          Glove
        </a>
        .
      </motion.p>

      {/* CTA download button */}
      <motion.a
        href="#download"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7, ease: "easeOut" }}
        className="font-(family-name:--font-body) bg-sage-900 text-cream-50 hover:bg-sage-700 uppercase tracking-wide mt-10 inline-block"
        style={{
          padding: "14px 32px",
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: "0.05em",
          textDecoration: "none",
          transition: "background 0.2s ease",
        }}
      >
        Download
      </motion.a>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="absolute bottom-6 sm:bottom-12 flex flex-col items-center gap-2"
      >
        <span
          className="font-(family-name:--font-mono) text-sage-300 uppercase tracking-widest"
          style={{ fontSize: "9px" }}
        >
          Scroll
        </span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          className="w-px h-8 bg-sage-200"
        />
      </motion.div>
    </section>
  );
}
