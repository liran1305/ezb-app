import { useState, useRef } from "react";
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import DiagnosisResult from "./components/DiagnosisResult";
import "./App.css";

function App() {
  const [image, setImage] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  const handleCapture = async (imageData) => {
    setImage(imageData);
    setLoading(false);
    setError(null);
    setDiagnosis(null);
  };

  const analyzeImage = async (imageData, voiceDescription = null) => {
    setLoading(true);
    setError(null);
    setDiagnosis(null);
    setIsRecordingAudio(false);

    try {
      // In production, use relative URL. In development, use full URL
      const apiUrl = import.meta.env.PROD
        ? '/api/diagnose'
        : (import.meta.env.VITE_API_URL || "http://localhost:4000/api/diagnose");

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageData,
          description: voiceDescription
        }),
      });

      const data = await response.json();

      if (data.success) {
        setDiagnosis(data.diagnosis);
      } else {
        setError(data.error || "משהו השתבש, נסה שוב");
      }
    } catch (err) {
      setError("אין חיבור. בדוק את האינטרנט ונסה שוב.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleCapture(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReset = () => {
    setImage(null);
    setDiagnosis(null);
    setError(null);
    setIsRecordingAudio(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openCamera = async () => {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 90,
      });

      if (photo.dataUrl) {
        handleCapture(photo.dataUrl);
      }
    } catch (error) {
      console.error('Camera error:', error);
      // Fallback to file input if camera fails
      fileInputRef.current?.click();
    }
  };

  const startAudioRecording = async () => {
    try {
      // Use Web Speech API for FREE transcription in Hebrew
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setError("הדפדפן שלך לא תומך בזיהוי קולי. נסה Chrome או Edge.");
        return;
      }

      // Check if we're on HTTPS or localhost
      const isSecureContext = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost';

      if (!isSecureContext) {
        // Web Speech API requires HTTPS on mobile
        alert("זיהוי קולי דורש חיבור מאובטח (HTTPS). נמשיך בלי הקלטה קולית.");
        analyzeImage(image, null);
        return;
      }

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'he-IL'; // Hebrew (Israel)
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      let finalTranscript = '';

      recognitionRef.current.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        finalTranscript = transcript;
        setVoiceTranscript(transcript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);

        // Handle specific errors
        if (event.error === 'not-allowed') {
          alert("גישה למיקרופון נדחתה. אנא אפשר גישה למיקרופון בהגדרות הדפדפן. נמשיך בלי הקלטה קולית.");
          analyzeImage(image, null);
        } else if (event.error === 'no-speech') {
          setError("לא זוהה דיבור. נסה שוב.");
        } else {
          alert(`שגיאה בזיהוי קולי: ${event.error}. נמשיך בלי הקלטה קולית.`);
          analyzeImage(image, null);
        }
        setIsRecordingAudio(false);
      };

      recognitionRef.current.onend = () => {
        console.log('Recording ended. Transcript:', finalTranscript);
        if (finalTranscript && finalTranscript.trim()) {
          analyzeImage(image, finalTranscript);
        } else {
          alert("לא זוהה טקסט. נמשיך בלי הקלטה קולית.");
          analyzeImage(image, null);
        }
      };

      recognitionRef.current.start();
      setIsRecordingAudio(true);
      setVoiceTranscript("");
    } catch (err) {
      console.error('Start recording error:', err);
      alert(`לא ניתן להפעיל את המיקרופון: ${err.message}. נמשיך בלי הקלטה קולית.`);
      analyzeImage(image, null);
    }
  };

  const stopAudioRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      // The onend event will trigger and call analyzeImage
    }
  };


  // IMAGE PREVIEW SCREEN - Start recording immediately
  if (image && !loading && !diagnosis) {
    return (
      <div className="app" dir="rtl">
        <div className="image-preview-screen">
          <div className="image-preview-container">
            <img src={image} alt="התמונה" />
          </div>

          <div className="action-buttons">
            {isRecordingAudio ? (
              <div className="recording-active">
                <div className="recording-pulse">
                  <span className="recording-dot"></span>
                </div>
                <h2>מקליט...</h2>
                <p className="recording-hint">לחץ על הכפתור כדי לעצור</p>
                <button
                  className="big-microphone-btn recording"
                  onClick={stopAudioRecording}
                >
                  <span className="mic-icon">⏹️</span>
                  <span className="btn-text">עצור הקלטה</span>
                </button>
              </div>
            ) : (
              <>
                <button
                  className="big-microphone-btn"
                  onClick={startAudioRecording}
                  disabled={loading}
                >
                  <span className="mic-icon">🎤</span>
                  <span className="btn-text">תאר את הבעיה בקול</span>
                </button>
                <p className="voice-hint">תאר מה לא עובד, מה ראית או שמעת, ומתי זה קרה</p>
              </>
            )}

            <button
              className="cancel-btn"
              onClick={handleReset}
            >
              ↩️ צלם שוב
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MAIN SCREEN - Just a big button
  if (!image && !loading && !diagnosis) {
    return (
      <div className="app" dir="rtl">
        <div className="simple-home">
          <div className="logo">ע.ז.ב</div>
          
          <button className="big-camera-btn" onClick={openCamera}>
            <span className="camera-icon">📸</span>
            <span className="btn-text">צלם את הבעיה</span>
          </button>
          
          <p className="hint">לחץ וצלם תמונה של מה שצריך לתקן</p>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>
      </div>
    );
  }

  // LOADING SCREEN
  if (loading) {
    return (
      <div className="app" dir="rtl">
        <div className="simple-loading">
          <div className="spinner"></div>
          <p>בודק את התמונה...</p>
          <p className="wait-text">רק כמה שניות</p>
        </div>
      </div>
    );
  }

  // ERROR SCREEN
  if (error) {
    return (
      <div className="app" dir="rtl">
        <div className="simple-error">
          <span className="error-icon">😕</span>
          <p className="error-text">{error}</p>
          <button className="big-btn" onClick={handleReset}>
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  // RESULTS SCREEN
  return (
    <div className="app" dir="rtl">
      <DiagnosisResult 
        diagnosis={diagnosis} 
        image={image}
        onReset={handleReset} 
      />
    </div>
  );
}

export default App;
