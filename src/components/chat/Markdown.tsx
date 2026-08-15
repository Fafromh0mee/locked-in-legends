import { Fragment, type ReactNode } from "react";

/** Renders inline **bold**, *italic* and `code` spans. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-i${i++}`;
    if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { type: "p" | "h"; level?: number; lines: string[] }
  | { type: "ul" | "ol"; items: string[] };

function parse(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    const prev = blocks[blocks.length - 1];

    if (!trimmed) continue;

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({ type: "h", level: heading[1]!.length, lines: [heading[2]!] });
      continue;
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      if (prev && prev.type === "ul") prev.items.push(bullet[1]!);
      else blocks.push({ type: "ul", items: [bullet[1]!] });
      continue;
    }

    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (numbered) {
      if (prev && prev.type === "ol") prev.items.push(numbered[1]!);
      else blocks.push({ type: "ol", items: [numbered[1]!] });
      continue;
    }

    if (prev && prev.type === "p") prev.lines.push(trimmed);
    else blocks.push({ type: "p", lines: [trimmed] });
  }

  return blocks;
}

/** Lightweight markdown renderer for Susu replies (bold, italics, lists, headings). */
export function Markdown({ content }: { content: string }) {
  const blocks = parse(content);

  return (
    <div className="space-y-2.5 text-sm leading-relaxed">
      {blocks.map((block, index) => {
        const key = `b${index}`;
        if (block.type === "h") {
          return (
            <p key={key} className="font-display text-[0.95rem] font-semibold text-foreground">
              {inline(block.lines.join(" "), key)}
            </p>
          );
        }
        if (block.type === "ul" || block.type === "ol") {
          const ListTag = block.type === "ul" ? "ul" : "ol";
          return (
            <ListTag
              key={key}
              className={block.type === "ul" ? "ml-4 list-disc space-y-1.5" : "ml-4 list-decimal space-y-1.5"}
            >
              {block.items.map((item, i) => (
                <li key={`${key}-${i}`} className="pl-1 marker:text-primary/70">
                  {inline(item, `${key}-${i}`)}
                </li>
              ))}
            </ListTag>
          );
        }
        const paragraph = block as { lines: string[] };
        return (
          <p key={key}>
            {paragraph.lines.map((line: string, i: number) => (
              <Fragment key={`${key}-${i}`}>
                {i > 0 && <br />}
                {inline(line, `${key}-${i}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
