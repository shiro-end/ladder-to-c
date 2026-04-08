"use client";

interface CodeViewerProps {
  code: string;
}

export default function CodeViewer({ code }: CodeViewerProps) {
  function handleDownload() {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ladder_output.c";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCopy() {
    navigator.clipboard.writeText(code);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 text-white">
        <span className="text-sm font-mono">ladder_output.c</span>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="text-xs px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded transition-colors"
          >
            コピー
          </button>
          <button
            onClick={handleDownload}
            className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded transition-colors"
          >
            ダウンロード
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto p-4 text-sm font-mono text-gray-800 bg-gray-50 max-h-[600px] overflow-y-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}
