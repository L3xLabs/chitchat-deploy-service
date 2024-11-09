import React, { useState, useEffect, useRef } from "react";

const StreamComponent: React.FC = () => {
  const [streamData, setStreamData] = useState<string>("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchStream = async () => {
      try {
        const response = await fetch("http://your-server-url/stream-endpoint");
        if (!response.ok) {
          throw new Error("Failed to connect to stream");
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No readable stream available");
        }

        const decoder = new TextDecoder("utf-8");
        let done = false;

        while (!done) {
          const { value, done: isDone } = await reader.read();
          done = isDone;
          if (value) {
            setStreamData((prev) => prev + decoder.decode(value));
          }
        }
      } catch (error) {
        console.error("Error during streaming:", error);
      }
    };

    fetchStream();
  }, []);

  // Autoscroll to the end of the stream data whenever new data is added
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamData]);

  return (
    <div
      style={{
        height: "400px",
        overflowY: "auto",
        border: "1px solid #ccc",
        padding: "10px",
      }}
    >
      <h2>Streaming Data</h2>
      <pre>{streamData}</pre>
      <div ref={endRef} />
    </div>
  );
};

export default StreamComponent;
