import Link from 'next/link';

interface MarkdownProps {
  content: string;
}

export default function Markdown({ content }: MarkdownProps) {
  if (!content) return null;

  // Split content into blocks by double newlines
  const blocks = content.split(/\n\n+/);

  return (
    <div className="space-y-4">
      {blocks.map((block, blockIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // 1. Headers
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={blockIdx} className="text-lg sm:text-xl font-bold text-foreground mt-6 mb-2">
              {renderInline(trimmed.slice(4))}
            </h3>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={blockIdx} className="text-xl sm:text-2xl font-black text-foreground mt-8 mb-3">
              {renderInline(trimmed.slice(3))}
            </h2>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h1 key={blockIdx} className="text-2xl sm:text-3xl font-black text-foreground mt-8 mb-4">
              {renderInline(trimmed.slice(2))}
            </h1>
          );
        }

        // 2. Lists
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const items = trimmed.split(/\n[-*]\s+/);
          return (
            <ul key={blockIdx} className="list-disc list-inside space-y-2 text-foreground-secondary pl-4 my-4">
              {items.map((item, itemIdx) => {
                // Remove the prefix from the first item if needed
                const cleanItem = itemIdx === 0 && (item.startsWith('- ') || item.startsWith('* '))
                  ? item.slice(2)
                  : item;
                return (
                  <li key={itemIdx}>
                    {renderInline(cleanItem)}
                  </li>
                );
              })}
            </ul>
          );
        }

        // 3. Paragraphs
        return (
          <p key={blockIdx} className="text-foreground-secondary leading-relaxed">
            {renderInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Validates and classifies URLs for Markdown links.
 * Allows:
 * - Safe external schemes: http://, https://, mailto:
 * - Safe internal routes/links: relative URLs starting with / (excluding // and /\) or #
 * Unsafe schemes (javascript:, data:, vbscript:, file:, etc.) and disallowed formats return isSafe: false.
 */
export function isSafeMarkdownUrl(url: string): {
  isSafe: boolean;
  isExternal: boolean;
  sanitizedUrl: string;
} {
  const trimmedUrl = url?.trim() || '';
  if (!trimmedUrl) {
    return { isSafe: false, isExternal: false, sanitizedUrl: '' };
  }

  const lowerUrl = trimmedUrl.toLowerCase();
  const isExternal =
    lowerUrl.startsWith('http://') ||
    lowerUrl.startsWith('https://') ||
    lowerUrl.startsWith('mailto:');

  const isInternal =
    (trimmedUrl.startsWith('/') &&
      !trimmedUrl.startsWith('//') &&
      !trimmedUrl.startsWith('/\\')) ||
    trimmedUrl.startsWith('#');

  return {
    isSafe: isExternal || isInternal,
    isExternal,
    sanitizedUrl: trimmedUrl,
  };
}

// Inline parser for bold, italics, links, and code
function renderInline(text: string) {
  // Regex pattern for markdown tokens: [link](url), **bold**, *italic*, `code`
  const tokenRegex = /(\[[^\]]*\]\((?:[^()]*|\([^()]*\))*\))|(\*\*.*?\*\*)|(\*.*?\*)|(`.*?`)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Link: [label](url)
    if (part.startsWith('[') && part.includes('](')) {
      const match = part.match(/^\[([\s\S]*?)\]\(([\s\S]*)\)$/) || part.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        const [, label, url] = match;
        const { isSafe, isExternal, sanitizedUrl } = isSafeMarkdownUrl(url);

        // Disallowed schemes (javascript:, data:, etc.) are rendered as plain text
        if (!isSafe) {
          return label;
        }

        const linkProps = isExternal
          ? { target: '_blank', rel: 'noopener noreferrer' }
          : {};
        return (
          <Link
            key={index}
            href={sanitizedUrl}
            className="text-accent hover:underline font-semibold"
            {...linkProps}
          >
            {label}
          </Link>
        );
      }
    }

    // Bold: **text**
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-bold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic: *text*
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={index} className="italic text-foreground">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Inline Code: `code`
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="bg-surface-sunken/60 border border-line/80 px-1.5 py-0.5 rounded text-xs text-accent font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Regular Text
    return part;
  });
}
