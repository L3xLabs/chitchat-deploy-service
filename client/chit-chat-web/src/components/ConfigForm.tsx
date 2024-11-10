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

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && streamOutputRef.current) {
      streamOutputRef.current.scrollTop = streamOutputRef.current.scrollHeight;
    }
  }, [streamData, autoScroll]);

  // Handle manual scroll to detect if user has scrolled up
  const handleScroll = (e: React.UIEvent<HTMLPreElement>) => {
    const element = e.currentTarget;
    const isScrolledToBottom =
      Math.abs(
        element.scrollHeight - element.clientHeight - element.scrollTop
      ) < 50; // Using 50px threshold
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
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold mb-6">Configuration Settings</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="domain"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Domain
            </label>
            <input
              id="domain"
              name="domain"
              type="text"
              value={formData.domain}
              onChange={handleInputChange}
              placeholder="Enter domain"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="accessKeyId"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Access Key ID
            </label>
            <input
              id="accessKeyId"
              name="accessKeyId"
              type="text"
              value={formData.accessKeyId}
              onChange={handleInputChange}
              placeholder="Enter access key ID"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="provider"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Provider
            </label>
            <input
              id="provider"
              name="provider"
              type="text"
              value={formData.provider}
              onChange={handleInputChange}
              placeholder="Enter provider"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="dnsApiKey"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              DNS API Key
            </label>
            <input
              id="dnsApiKey"
              name="dnsApiKey"
              type="text"
              value={formData.dnsApiKey}
              onChange={handleInputChange}
              placeholder="Enter DNS API key"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="dnsSecretApiKey"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              DNS Secret API Key
            </label>
            <input
              id="dnsSecretApiKey"
              name="dnsSecretApiKey"
              type="password"
              value={formData.dnsSecretApiKey}
              onChange={handleInputChange}
              placeholder="Enter DNS secret API key"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={isStreaming}
            className={`w-full py-2 px-4 rounded-md text-white font-medium ${
              isStreaming
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            }`}
          >
            {isStreaming ? "Processing..." : "Submit Configuration"}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6">
          {error}
        </div>
      )}

      {(streamData || isStreaming) && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Stream Output</h2>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoScroll"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <label htmlFor="autoScroll" className="text-sm text-gray-600">
                Auto-scroll
              </label>
            </div>
          </div>
          <pre
            ref={streamOutputRef}
            onScroll={handleScroll}
            className="h-96 overflow-y-auto bg-gray-50 p-4 rounded-md font-mono text-sm whitespace-pre-wrap"
          >
            {streamData}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ConfigForm;
