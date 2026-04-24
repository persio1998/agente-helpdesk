import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MessageMarkdown({ content }) {
  return (
    <div className="message-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
