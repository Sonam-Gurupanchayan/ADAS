import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Raw HTML is never rendered (react-markdown default), so supplier-authored notes can't inject markup.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-fw">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
