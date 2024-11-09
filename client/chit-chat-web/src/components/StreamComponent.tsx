"use client";

import React, { useState, useEffect, useRef } from "react";

const StreamComponent: React.FC = () => {
  const [streamData, setStreamData] = useState<string>("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchStream = async () => {
      try {
        const response = await fetch("http://localhost:8000/api/setup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            domain: process.env.NEXT_PUBLIC_DOMAIN,
            accessKeyId: process.env.NEXT_PUBLIC_ACCESS_KEY_ID,
            // secretAccessKey: process.env.NEXT_PUBLIC_SECRET_ACCESS_KEY,
            provider: process.env.NEXT_PUBLIC_PROVIDER,
            dnsApiKey: process.env.NEXT_PUBLIC_DNS_API_KEY,
            dnsSecretApiKey: process.env.NEXT_PUBLIC_DNS_SECRET_API_KEY,
          }),
        });
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
