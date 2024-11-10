"use client";

import React, { useState, useRef, useEffect } from "react";

const ConfigForm = () => {
  const [formData, setFormData] = useState({
    domain: "",
    accessKeyId: "",
    provider: "",
    dnsApiKey: "",
    dnsSecretApiKey: "",
  });

  const [streamData, setStreamData] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");
  const streamOutputRef = useRef<HTMLPreElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && streamOutputRef.current) {
      streamOutputRef.current.scrollTop = streamOutputRef.current.scrollHeight;
    }
  }, [streamData, autoScroll]);

  const handleScroll = (e: React.UIEvent<HTMLPreElement>) => {
    const element = e.currentTarget;
    const isScrolledToBottom =
      Math.abs(
        element.scrollHeight - element.clientHeight - element.scrollTop
      ) < 50;
    setAutoScroll(isScrolledToBottom);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsStreaming(true);
    setStreamData("");
    setAutoScroll(true);

    try {
      const response = await fetch("http://localhost:8000/api/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to connect to stream");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No readable stream available");
      }

      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        if (value) {
          setStreamData((prev) => prev + decoder.decode(value));
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
      console.error("Error during streaming:", error);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-cyan-500/20">
          <h2 className="text-2xl font-bold mb-6 text-cyan-400 tracking-wide">
            Configuration Settings
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { id: "domain", label: "Domain", type: "text" },
              { id: "accessKeyId", label: "Access Key ID", type: "text" },
              { id: "provider", label: "Provider", type: "text" },
              { id: "dnsApiKey", label: "DNS API Key", type: "text" },
              {
                id: "dnsSecretApiKey",
                label: "DNS Secret API Key",
                type: "password",
              },
            ].map((field) => (
              <div key={field.id}>
                <label
                  htmlFor={field.id}
                  className="block text-sm font-medium text-cyan-300 mb-1"
                >
                  {field.label}
                </label>
                <input
                  id={field.id}
                  name={field.id}
                  type={field.type}
                  value={formData[field.id as keyof typeof formData]}
                  onChange={handleInputChange}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  required
                  className="w-full px-4 py-2 bg-gray-700 border border-cyan-500/30 rounded-md 
                           text-gray-100 placeholder-gray-400
                           focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                           hover:border-cyan-500/50 transition-colors"
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={isStreaming}
              className={`w-full py-2 px-4 rounded-md text-gray-900 font-medium
                        transition-all duration-200 ease-in-out
                        ${
                          isStreaming
                            ? "bg-gray-600 cursor-not-allowed"
                            : "bg-cyan-400 hover:bg-cyan-300 hover:shadow-[0_0_15px_rgba(34,211,238,0.5)] focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                        }`}
            >
              {isStreaming ? "Processing..." : "Submit Configuration"}
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500/50 text-red-400 p-4 rounded-md">
            {error}
          </div>
        )}

        {(streamData || isStreaming) && (
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-cyan-500/20">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-cyan-400 tracking-wide">
                Stream Output
              </h2>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autoScroll"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded border-cyan-500/50 bg-gray-700 text-cyan-400 
                           focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-gray-800"
                />
                <label htmlFor="autoScroll" className="text-sm text-cyan-300">
                  Auto-scroll
                </label>
              </div>
            </div>
            <pre
              ref={streamOutputRef}
              onScroll={handleScroll}
              className="h-96 overflow-y-auto bg-gray-900/50 p-4 rounded-md 
                       font-mono text-sm whitespace-pre-wrap text-cyan-100
                       border border-cyan-500/20 shadow-[inset_0_0_15px_rgba(0,0,0,0.5)]"
            >
              {streamData}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfigForm;
