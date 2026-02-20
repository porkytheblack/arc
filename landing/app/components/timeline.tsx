"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { AppClone } from "./app-clone";
import type { FeatureSection } from "../mock-data";

/* ------------------------------------------------------------------ */
/* Single timeline node                                                */
/* ------------------------------------------------------------------ */

function TimelineNode({
  section,
  index,
}: {
  section: FeatureSection;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-120px" });

  /* Alternate text side on desktop: odd left, even right.
     On mobile everything stacks vertically. */
  const isEven = index % 2 === 0;

  return (
    <div ref={ref} className="relative">
      {/* ---- Dot on the timeline line ---- */}
      <div
        className="absolute left-4 md:left-1/2 md:-translate-x-1/2 z-10"
        style={{ top: 0 }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={isInView ? { scale: 1 } : { scale: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          style={{
            width: 12,
            height: 12,
            background: "#4a6b4a",
            border: "2px solid #fefdfb",
            outline: "2px solid #dce5dc",
          }}
        />
      </div>

      {/* ---- Content area ---- */}
      <div
        className={`
          grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-16
          pl-10 sm:pl-12 md:pl-0
          min-h-0 md:min-h-[640px]
        `}
      >
        {/* Text side */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className={`
            flex flex-col justify-center
            ${isEven ? "md:order-1 md:pr-16 md:text-right" : "md:order-2 md:pl-16"}
          `}
        >
          {/* Step number */}
          <span
            className="font-(family-name:--font-mono) text-sage-300 uppercase tracking-widest"
            style={{ fontSize: 11, letterSpacing: "0.15em" }}
          >
            {section.label}
          </span>

          {/* Title */}
          <h2
            className="font-(family-name:--font-display) text-sage-900 mt-2 text-2xl md:text-[32px]"
          >
            {section.title}
          </h2>

          {/* Description */}
          <p
            className="font-(family-name:--font-body) text-sage-700 mt-3"
            style={{ fontSize: 15, lineHeight: 1.7, fontWeight: 400 }}
          >
            {section.description}
          </p>
        </motion.div>

        {/* App clone side */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.5, delay: 0.25, ease: "easeOut" }}
          className={`
            flex items-center
            ${isEven ? "md:order-2" : "md:order-1"}
          `}
        >
          <AppClone
            messages={section.conversation}
            showTyping={index === 0}
          />
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vertical timeline container                                         */
/* ------------------------------------------------------------------ */

export function Timeline({ sections }: { sections: FeatureSection[] }) {
  return (
    <section className="relative py-16 md:py-40 overflow-hidden px-4 sm:px-8 md:px-0">
      {/* The vertical line */}
      <div
        className="absolute left-[19px] md:left-1/2 md:-translate-x-px top-0 bottom-0 w-px bg-sage-100"
        aria-hidden="true"
      />

      {/* Timeline nodes */}
      <div className="flex flex-col gap-16 md:gap-40 relative z-1">
        {sections.map((section, i) => (
          <TimelineNode key={section.id} section={section} index={i} />
        ))}
      </div>
    </section>
  );
}
