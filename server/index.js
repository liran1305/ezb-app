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

דוגמאות רעות (לא ספציפיות מספיק):
- "איך לתקן ברז" (איזה ברז? מטבח? מקלחת? כיור?)
- "תיקון אסלה" (מה צריך לתקן? פלאפר? מכסה? שטיפה?)
- "תיקון מנעול" (לא ברור איזה חלק)

חשוב מאוד: תמיד ציין את המיקום/סוג המדויק של הפריט בשאלה!`;

// Function to remove Israeli brand names for English search
function removeIsraeliBrands(query) {
  const israeliBrands = ['אלקטרה', 'תדיראן', 'אמקור', 'טורנדו', 'electra', 'tadiran', 'amcor', 'tornado'];
  let cleanQuery = query;
  israeliBrands.forEach(brand => {
    cleanQuery = cleanQuery.replace(new RegExp(brand, 'gi'), '').trim();
  });
  return cleanQuery;
}

// Function to translate Hebrew repair terms to English
function translateToEnglish(hebrewQuery) {
  const translations = {
    'איך לתקן': 'how to fix',
    'איך להחליף': 'how to replace',
    'תיקון': 'repair',
    'החלפה': 'replacement',
    'שלט': 'remote',
    'מזגן': 'air conditioner',
    'אייפיל': 'I-Feel',
    'כפתור': 'button',
    'לא עובד': 'not working',
    'תקוע': 'stuck',
    'שבור': 'broken'
  };

  let englishQuery = hebrewQuery;
  Object.entries(translations).forEach(([hebrew, english]) => {
    englishQuery = englishQuery.replace(new RegExp(hebrew, 'g'), english);
  });

  return englishQuery;
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

    // If no Hebrew video found, try English search
    console.log('No Hebrew video found, trying English search...');

    const englishQuery = translateToEnglish(removeIsraeliBrands(query));
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
      finalPrompt += `\n\n⚠️ חשוב מאוד - תיאור קולי מהמשתמש: "${description}"

כללים לטיפול בתיאור הקולי:
1. התמקד במילים הספציפיות שהמשתמש אמר - אם הוא אמר "אייפיל" (I-feel) או שם תכונה מסוימת, הבעיה היא בדיוק בתכונה הזאת, לא בכל המכשיר
2. אם המשתמש ציין תכונה/כפתור/פונקציה ספציפית - הבעיה היא בדיוק בחלק הזה
3. אל תכלל את כל המכשיר - התמקד בחלק המדויק שהמשתמש ציין
4. אם יש חזרות בטקסט (בגלל שגיאות זיהוי קולי), התעלם מהן והתמקד במשפט האחרון והכי ברור
5. חפש מילות מפתח כמו "לא עובד", "תקוע", "שבור" ואת השם של החלק לפניהן

דוגמה: אם המשתמש אמר "שלט מזגן אלקטרה אייפיל לא עובד" - הבעיה היא ספציפית בכפתור/תכונת ה-I-feel, לא בכל השלט.`;
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
