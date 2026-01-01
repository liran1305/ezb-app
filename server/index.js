import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import FormData from "form-data";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load from client/.env
dotenv.config({ path: path.resolve(__dirname, "../client/.env") });

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DIAGNOSIS_PROMPT = `אתה מומחה לתיקוני בית בישראל. המשתמש שלח לך תמונה של בעיה בבית.

נתח את התמונה וספק תשובה בפורמט JSON בלבד (ללא markdown, ללא backticks):

{
  "problem": "תיאור קצר של הבעיה שזיהית",
  "canDIY": true/false,
  "difficultyScore": 1-10,
  "difficultyText": "קל/בינוני/מורכב/צריך איש מקצוע",
  "timeEstimate": "זמן משוער לתיקון",
  "videoSearchQuery": "איך להחליף מחסנית ברז במטבח",
  "steps": [
    "צעד 1...",
    "צעד 2...",
    "צעד 3..."
  ],
  "tools": ["כלי 1", "כלי 2"],
  "materials": [
    {"item": "שם הפריט", "estimatedPrice": "מחיר משוער בשקלים"}
  ],
  "warnings": ["אזהרה 1 אם יש"],
  "whenToCallPro": "מתי כדאי להזמין בעל מקצוע",
  "israeliTip": "טיפ ספציפי לישראל (חנויות, מוצרים מקומיים וכו')"
}

כללים חשובים:
- הוסף שדה "videoSearchQuery" שמכיל שאלה בעברית לחיפוש סרטון הדרכה ביוטיוב
- videoSearchQuery צריך להתחיל ב"איך ל..." או "איך להחליף..." או "איך לתקן..."
- videoSearchQuery צריך להיות ספציפי ביותר לחלק המדויק שצריך לתקן/להחליף
- תמיד ציין את הסוג המדויק של הפריט (לדוגמה: "ברז במטבח", "ברז במקלחת", "ברז בכיור אמבטיה" - לא סתם "ברז")
- אם הבעיה היא טפטוף ברז - כנראה צריך להחליף מחסנית. אם אסלה דולפת - כנראה צריך להחליף פלאפר
- steps צריך להיות מערך של מחרוזות פשוטות (לא אובייקטים)
- אם אתה לא בטוח מה הבעיה, שאל שאלה מבהירה בשדה problem
- תמיד התחשב בבטיחות - חשמל ומים דורשים זהירות
- מחירים בשקלים, חנויות ישראליות (הום סנטר, איקאה, ACE)
- אם הבעיה מסוכנת או מורכבת מדי - המלץ על איש מקצוע
- השב בעברית בלבד
- החזר JSON תקין בלבד, ללא טקסט נוסף

דוגמאות לvideoSearchQuery טובות (בעברית וספציפיות!):
- "איך להחליף מחסנית ברז במטבח" (ברז מטפטף במטבח - צריך החלפת מחסנית)
- "איך להחליף מחסנית ברז במקלחת" (ברז מטפטף במקלחת - לא אותו דבר כמו מטבח!)
- "איך להחליף פלאפר באסלה" (אסלה דולפת)
- "איך להחליף צילינדר מנעול דלת" (מנעול תקוע)
- "איך להחליף מתג אור" (מתג מהבהב)
- "איך לפתוח סתימה בכיור" (כיור סתום)

שלטים רחוקים - כללים מיוחדים:
- אם הבעיה היא בתכונה ספציפית בשלט (I-feel, טיימר, טורבו, וכו'):
  → חפש הסבר על איך להפעיל/להשתמש בתכונה, לא "תיקון"
  → דוגמה: "איך להשתמש בתכונת I-feel במזגן" (לא "איך לתקן I-feel")
  → דוגמה: "איך לכוון טיימר במזגן" (לא "תיקון טיימר")
- אם השלט בכלל לא עובד:
  → "איך להחליף סוללות בשלט מזגן" או "איך לאפס שלט מזגן"

דוגמאות רעות (לא ספציפיות מספיק):
- "איך לתקן ברז" (איזה ברז? מטבח? מקלחת? כיור?)
- "תיקון אסלה" (מה צריך לתקן? פלאפר? מכסה? שטיפה?)
- "תיקון מנעול" (לא ברור איזה חלק)
- "איך לתקן I-feel" (I-feel זו תכונה, לא משהו שמתקנים - צריך הסבר איך להשתמש בה!)

חשוב מאוד: תמיד ציין את המיקום/סוג המדויק של הפריט בשאלה!`;

// Function to translate Hebrew query to English using Claude AI
async function translateToEnglish(hebrewQuery) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Translate this Hebrew YouTube search query to English for finding tutorial videos.

CRITICAL RULES:
1. Remove ALL brand names (Electra/אלקטרה, Tadiran/תדיראן, Amcor/אמקור, Tornado/טורנדו, etc.)
2. Keep it generic - Israeli brands won't have English videos
3. Focus on the device type and problem, not the brand
4. Be VERY SPECIFIC - use exact technical terms like "remote control", "AC remote"
5. For FEATURES (I-feel, timer, turbo), search "how to use" NOT "how to fix"
6. For broken remotes, search "how to fix" or "troubleshoot"

Examples:
"איך להשתמש בתכונת I-feel במזגן" → "how to use AC i-feel function"
"איך לתקן תכונת I-feel בשלט מזגן" → "how to use AC remote i-feel feature"
"איך לכוון טיימר במזגן" → "how to set AC timer"
"שלט מזגן לא עובד" → "AC remote not working troubleshoot"
"איך להחליף סוללות שלט מזגן" → "how to replace AC remote batteries"

Hebrew query: ${hebrewQuery}

English translation:`
      }]
    });

    const englishQuery = response.content[0].text.trim();
    console.log(`AI translated to English: ${englishQuery}`);
    return englishQuery;
  } catch (error) {
    console.error('Translation error:', error);
    // Fallback: just remove Hebrew characters
    return hebrewQuery.replace(/[\u0590-\u05FF]/g, '').trim();
  }
}

// Function to search for YouTube video guide
async function searchYouTubeVideo(query) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      console.log('YouTube API key not found, using search URL fallback');
      return {
        searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
        searchQuery: query
      };
    }

    // Try Hebrew search first
    console.log(`Searching YouTube for: ${query}`);

    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=15&key=${apiKey}&relevanceLanguage=he&regionCode=IL&safeSearch=strict&order=relevance&videoDuration=medium`;

    const response = await fetch(searchUrl);
    const data = await response.json();

    console.log(`Found ${data.items?.length || 0} results`);

    // STRICT Hebrew filter - must have Hebrew characters in title
    if (data.items && data.items.length > 0) {
      const hebrewVideos = data.items.filter(item => /[\u0590-\u05FF]/.test(item.snippet.title));

      console.log(`Found ${hebrewVideos.length} videos with Hebrew titles`);

      if (hebrewVideos.length > 0) {
        // Check if the search query has specific features (like I-feel, timer, etc.)
        const specificFeatures = ['I-feel', 'אייפיל', 'I-Feel', 'טיימר', 'timer', 'טורבו', 'turbo'];
        const queryHasSpecificFeature = specificFeatures.some(feature =>
          query.toLowerCase().includes(feature.toLowerCase())
        );

        // If query has specific feature, video MUST mention it too
        if (queryHasSpecificFeature) {
          const relevantVideo = hebrewVideos.find(item =>
            specificFeatures.some(feature =>
              item.snippet.title.toLowerCase().includes(feature.toLowerCase())
            )
          );

          if (relevantVideo) {
            console.log(`Selected Hebrew video with specific feature: ${relevantVideo.snippet.title}`);
            return {
              videoId: relevantVideo.id.videoId,
              title: relevantVideo.snippet.title,
              searchUrl: `https://www.youtube.com/watch?v=${relevantVideo.id.videoId}`
            };
          } else {
            console.log('No Hebrew video found matching specific feature, trying English...');
            // Continue to English search
          }
        } else {
          // No specific feature - use generic tutorial keywords
          const hebrewTutorialKeywords = ['איך', 'תיקון', 'הדרכה', 'למתחילים', 'החלפה', 'בעצמך'];
          const bestVideo = hebrewVideos.find(item =>
            hebrewTutorialKeywords.some(keyword =>
              item.snippet.title.includes(keyword)
            )
          ) || hebrewVideos[0];

          console.log(`Selected Hebrew video: ${bestVideo.snippet.title}`);
          return {
            videoId: bestVideo.id.videoId,
            title: bestVideo.snippet.title,
            searchUrl: `https://www.youtube.com/watch?v=${bestVideo.id.videoId}`
          };
        }
      }
    }

    // If no Hebrew video found, try English search
    console.log('No Hebrew video found, trying English search...');

    const englishQuery = await translateToEnglish(query);
    console.log(`English search query: ${englishQuery}`);

    const englishSearchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(englishQuery)}&type=video&maxResults=15&key=${apiKey}&relevanceLanguage=en&safeSearch=strict&order=relevance&videoDuration=medium`;

    const englishResponse = await fetch(englishSearchUrl);
    const englishData = await englishResponse.json();

    console.log(`Found ${englishData.items?.length || 0} English results`);

    if (englishData.items && englishData.items.length > 0) {
      // Look for tutorial keywords in English
      const tutorialKeywords = ['how to', 'fix', 'repair', 'replace', 'tutorial', 'guide'];
      const bestEnglishVideo = englishData.items.find(item =>
        tutorialKeywords.some(keyword =>
          item.snippet.title.toLowerCase().includes(keyword)
        )
      ) || englishData.items[0];

      console.log(`Selected English video: ${bestEnglishVideo.snippet.title}`);

      return {
        videoId: bestEnglishVideo.id.videoId,
        title: bestEnglishVideo.snippet.title,
        searchUrl: `https://www.youtube.com/watch?v=${bestEnglishVideo.id.videoId}`
      };
    }

    // If still no video found, return null (no video available)
    console.log('No relevant video found in Hebrew or English');
    return null;
  } catch (error) {
    console.error('YouTube search error:', error);
    return null;
  }
}

app.post("/api/diagnose", async (req, res) => {
  try {
    const { image, description } = req.body;

    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    // Remove data URL prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    // Build the message content array
    const messageContent = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: base64Data,
        },
      },
    ];

    // Build the prompt with voice description if available
    let finalPrompt = DIAGNOSIS_PROMPT;
    if (description && description.trim()) {
      console.log('Voice description:', description);
      finalPrompt += `\n\n⚠️⚠️⚠️ חשוב ביותר - תיאור קולי מהמשתמש: "${description}"

כללים קריטיים לטיפול בתיאור הקולי:
1. אם יש חזרות בטקסט (בגלל שגיאות זיהוי קולי), התעלם מהן והסתכל על המילים הייחודיות
2. אם המשתמש ציין תכונה/כפתור/פונקציה ספציפית (כמו "אייפיל", "I-feel", "טיימר", "טורבו" וכו') - זו הבעיה המדויקת!
3. ב-videoSearchQuery חייב להופיע שם התכונה הספציפית שהמשתמש ציין - אל תכתוב "שלט לא עובד" אם המשתמש אמר "I-feel לא עובד"
4. אם המשתמש אמר "אייפיל" או "I-feel" - ה-videoSearchQuery חייב לכלול "I-feel" או "אייפיל"
5. problem ו-videoSearchQuery חייבים לכלול את התכונה הספציפית שהמשתמש ציין

דוגמאות:
- משתמש אמר: "שלט מזגן אייפיל לא עובד"
  → problem: "כפתור/תכונת I-feel בשלט המזגן לא עובד"
  → videoSearchQuery: "איך לתקן תכונת I-feel בשלט מזגן"

- משתמש אמר: "טיימר של המזגן לא עובד"
  → problem: "טיימר בשלט המזגן לא עובד"
  → videoSearchQuery: "איך לתקן טיימר בשלט מזגן"`;
    }

    messageContent.push({
      type: "text",
      text: finalPrompt,
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: messageContent,
        },
      ],
    });

    const textContent = response.content.find((block) => block.type === "text");
    const resultText = textContent?.text || "";

    // Parse JSON response
    let diagnosis;
    try {
      diagnosis = JSON.parse(resultText);
    } catch {
      // If JSON parsing fails, return raw text
      diagnosis = {
        problem: resultText,
        canDIY: false,
        difficultyScore: 5,
        difficultyText: "לא ניתן לקבוע",
        steps: [],
        tools: [],
        materials: [],
        warnings: ["לא הצלחתי לנתח את התמונה כראוי"],
      };
    }

    // Fetch ONE YouTube video for the entire repair process
    if (diagnosis.videoSearchQuery) {
      const videoData = await searchYouTubeVideo(diagnosis.videoSearchQuery);

      if (videoData) {
        diagnosis.tutorialVideo = videoData;
      } else {
        // No video found - provide helpful message
        diagnosis.tutorialVideo = {
          noVideo: true,
          message: "לא נמצא סרטון הדרכה ספציפי לבעיה זו. מומלץ לחפש ביוטיוב באנגלית או להתייעץ עם בעל מקצוע.",
          searchQuery: diagnosis.videoSearchQuery
        };
      }

      delete diagnosis.videoSearchQuery; // Remove the search query from response
    }

    res.json({ success: true, diagnosis });
  } catch (error) {
    console.error("Diagnosis error:", error);
    res.status(500).json({ error: "Failed to analyze image" });
  }
});

// Serve React app for any other routes (in production)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
