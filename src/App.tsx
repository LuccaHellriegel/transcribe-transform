import { useState, useRef } from "react";
import "./App.css";

function App() {
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState("");
  const [selectedMic, setSelectedMic] = useState("");
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("transcribeTransformApiKey") || ""
  );
  const [responseText, setResponseText] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalIsOpen, setModalIsOpen] = useState(false);
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

  return (
    <>
      <div
        className="card"
        style={{ display: "flex", flexDirection: "column" }}
      >
        {!apiKey && (
          <button onClick={() => setModalIsOpen(true)}>
            Set OpenAI API Key
          </button>
        )}
        {modalIsOpen && (
          <div className="modal">
            <h2>Enter OpenAI API Key</h2>
            <input type="text" onChange={(e) => setApiKey(e.target.value)} />
            <button onClick={() => saveApiKey(apiKey)}>Save</button>
          </div>
        )}
        <button onClick={recording ? stopRecording : startRecording}>
          {recording ? "Stop Recording" : "Start Recording"}
        </button>
        {audioURL && <audio src={audioURL} controls />}
        <button onClick={sendToOpenAI} disabled={!audioURL || !apiKey}>
          Send to OpenAI
        </button>
        {loading && <div>Loading...</div>}
        <div>{responseText}</div>
      </div>
    </>
  );
}

export default App;
