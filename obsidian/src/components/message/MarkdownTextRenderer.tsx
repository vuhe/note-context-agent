import * as React from "react";
const { useRef, useEffect } = React;
import { Component, MarkdownRenderer } from "obsidian";
import { useNoteAgent } from "../../adapters/note-agent";

interface MarkdownTextRendererProps {
  text: string;
}

export function MarkdownTextRenderer({ text }: MarkdownTextRendererProps) {
  const app = useNoteAgent(s => s.obsidianApp)();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !app) return;
    el.empty?.();
    el.classList.add("markdown-rendered");

    // Create a temporary component for the markdown renderer lifecycle
    const component = new Component();
    component.load();

    // Render markdown
    void MarkdownRenderer.render(app, text, el, "", component);

    return () => {
      component.unload();
    };
  }, [text, app]);

  return <div ref={containerRef} className="markdown-text-renderer" />;
}
