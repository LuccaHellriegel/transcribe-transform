import { useState, useRef } from "react";
import "./App.css";

async function getChatCompletions(
  key: string,
  system: string,
  transcript: string,
  setLoadingChat: React.Dispatch<React.SetStateAction<boolean>>
) {
  setLoadingChat(true);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: system,
        },
        {
          role: "user",
          content: transcript,
        },
      ],
    }),
  });

  setLoadingChat(false);
  if (!response.ok) {
    console.error(`Error: ${response.statusText}`);
  } else {
    const data = await response.json();
    // Extract the assistant's message content from the response data
    const assistantMessageContent = data.choices[0].message.content;
    return assistantMessageContent;
  }
}

function App() {
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState("");
  const [selectedMic, setSelectedMic] = useState("");
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("transcribeTransformApiKey") || ""
  );
  const [responseText, setResponseText] = useState("-");
  const [loading, setLoading] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false); // Added separate loading state for chat completions
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [chatContent, setChatContent] = useState(
    localStorage.getItem("systemPrompt") ||
      "You are a pro-summarizer and will summarize every transcript that you get."
  );
  const [chatResponse, setChatResponse] = useState("-");
  const audioRecorder = useRef<MediaRecorder | null>(null);

  const startRecording = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioDevices = devices.filter(
      (device) => device.kind === "audioinput"
    );
    setSelectedMic(audioDevices[0].deviceId);

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: selectedMic ? { exact: selectedMic } : undefined },
    });
    audioRecorder.current = new MediaRecorder(stream);
    audioRecorder.current.start();

    const audioChunks: BlobPart[] = [];
    audioRecorder.current.addEventListener(
      "dataavailable",
      (event: BlobEvent) => {
        audioChunks.push(event.data);
      }
    );

    audioRecorder.current.addEventListener("stop", () => {
      const audioBlob = new Blob(audioChunks);
      const audioUrl = URL.createObjectURL(audioBlob);
      setAudioURL(audioUrl);
    });

    setRecording(true);
  };

  const stopRecording = () => {
    if (audioRecorder.current) {
      audioRecorder.current.stop();
      setRecording(false);
    }
  };

  const saveApiKey = (key: string) => {
    localStorage.setItem("transcribeTransformApiKey", key);
  };

  const sendToOpenAI = async () => {
    const formData = new FormData();

    const responseAudio = await fetch(audioURL);
    const audioBlob = await responseAudio.blob();

    formData.append("file", audioBlob, "audio.wav");

    const parameters = {
      model: "whisper-1",
      // Add other parameters as needed
    };

    for (const key in parameters) {
      formData.append(key, parameters[key as keyof typeof parameters]);
    }

    setLoading(true);
    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      console.error(`Error: ${response.statusText}`);
    } else {
      const data = await response.json();
      setResponseText(data.text); // Update the response text with the text from the response
    }
    setLoading(false);
  };

  const handleChatCompletions = async () => {
    const data = await getChatCompletions(
      apiKey,
      chatContent,
      responseText,
      setLoadingChat
    );
    setChatResponse(JSON.stringify(data));
  };

  const handleChatContentChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setChatContent(e.target.value);
    localStorage.setItem("systemPrompt", e.target.value);
  };

  const resetSystemPrompt = () => {
    setChatContent(
      "You are a pro-summarizer and will summarize every transcript that you get."
    );
    localStorage.setItem(
      "systemPrompt",
      "You are a pro-summarizer and will summarize every transcript that you get."
    );
  };

  return (
    <>
      <div
        className="card"
        style={{ display: "flex", flexDirection: "column", gap: "4px" }}
      >
        <button onClick={() => setModalIsOpen(true)}>
          Edit OpenAI API Key {apiKey ? "(found one)" : ""}
        </button>
        {modalIsOpen && (
          <div className="modal">
            <h2>Enter OpenAI API Key</h2>
            <input type="text" onChange={(e) => setApiKey(e.target.value)} />
            <button onClick={() => saveApiKey(apiKey)}>Save</button>
          </div>
        )}
        <hr
          style={{
            width: "100%",
            height: "0.5px",
            backgroundColor: "black",
            margin: "10px 0",
          }}
        />
        <button onClick={recording ? stopRecording : startRecording}>
          {recording ? "Stop Recording" : "Start Recording"}
        </button>
        {audioURL && <audio src={audioURL} controls />}
        <button
          onClick={sendToOpenAI}
          disabled={!audioURL || !apiKey || !audioURL.length}
          style={{
            borderColor:
              !audioURL || !apiKey || !audioURL.length ? "transparent" : "",
            cursor:
              !audioURL || !apiKey || !audioURL.length
                ? "not-allowed"
                : "pointer",
          }}
        >
          Send recording to OpenAI
        </button>
        <div>
          <h3>Transcript</h3>
          {loading && <div>Loading...</div>}
          <div>{responseText}</div>
        </div>
        <hr
          style={{
            width: "100%",
            height: "0.5px",
            backgroundColor: "black",
            margin: "10px 0",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <h3>Transformation System Prompt</h3>
          <button onClick={resetSystemPrompt}>Reset</button>
          <textarea
            style={{
              minHeight: "100px",
              minWidth: "250px",
              resize: "both",
              overflow: "auto",
            }}
            value={chatContent}
            onChange={handleChatContentChange}
          />
        </div>
        <hr
          style={{
            width: "100%",
            height: "0.5px",
            backgroundColor: "black",
            margin: "10px 0",
          }}
        />
        <button
          onClick={handleChatCompletions}
          disabled={!apiKey || responseText === "-"}
          style={{
            borderColor: !apiKey || responseText === "-" ? "transparent" : "",
            cursor: !apiKey || responseText === "-" ? "not-allowed" : "pointer",
          }}
        >
          Transform transcript with GPT-4
        </button>
        <div>
          <h3>Transformed Transcript</h3>
          {loadingChat && <div>Loading...</div>}
          <div>{chatResponse}</div>
        </div>
      </div>
    </>
  );
}

export default App;
