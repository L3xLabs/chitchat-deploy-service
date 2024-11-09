"use client";
import React, { useState, useEffect } from "react";

const StreamComponent: React.FC = () => {
  const [streamData, setStreamData] = useState<string>("");

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
            setStreamData(
              (prev) => prev + decoder.decode(value, { stream: true })
            );
          }
        }
      } catch (error) {
        console.error("Error during streaming:", error);
      }
    };

    fetchStream();
  }, []);

  return (
    <div>
      <h2>Streaming Data</h2>
      <pre>{streamData}</pre>
    </div>
  );
};

export default StreamComponent;
