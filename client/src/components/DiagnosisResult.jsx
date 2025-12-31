function DiagnosisResult({ diagnosis, image, onReset }) {
  const getDifficultyColor = (score) => {
    if (score <= 3) return "#22c55e"; // green
    if (score <= 6) return "#f59e0b"; // yellow
    return "#ef4444"; // red
  };

  return (
    <div className="diagnosis-result">
      {/* Small image preview */}
      {image && (
        <div className="image-preview">
          <img src={image} alt="הבעיה" />
        </div>
      )}

      {/* THE MAIN ANSWER - Big and clear */}
      <div className="problem-header">
        <h2>{diagnosis.problem}</h2>
        <div 
          className="difficulty-badge"
          style={{ backgroundColor: getDifficultyColor(diagnosis.difficultyScore) }}
        >
          {diagnosis.difficultyText}
        </div>
      </div>

      {/* CAN YOU FIX IT? - The most important info */}
      {diagnosis.canDIY ? (
        <div className="diy-yes">
          ✅ אפשר לתקן לבד!
        </div>
      ) : (
        <div className="diy-no">
          📞 עדיף להזמין בעל מקצוע
        </div>
      )}

      {/* Time estimate */}
      {diagnosis.timeEstimate && (
        <div className="time-estimate">
          ⏱️ זמן: {diagnosis.timeEstimate}
        </div>
      )}

      {/* TUTORIAL VIDEO - One video for the entire repair */}
      {diagnosis.tutorialVideo && (
        <div className="tutorial-video-section">
          <a
            href={diagnosis.tutorialVideo.searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="tutorial-video-btn"
          >
            🎥 ראה סרטון הדרכה מלא
          </a>
          {diagnosis.tutorialVideo.title && (
            <p className="video-title-preview">{diagnosis.tutorialVideo.title}</p>
          )}
        </div>
      )}

      {/* WARNINGS - Show first if dangerous */}
      {diagnosis.warnings && diagnosis.warnings.length > 0 && (
        <div className="warnings">
          <h3>⚠️ זהירות!</h3>
          <ul>
            {diagnosis.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* STEPS - Numbered and clear */}
      {diagnosis.steps && diagnosis.steps.length > 0 && (
        <div className="steps">
          <h3>📝 איך לתקן</h3>
          <ol>
            {diagnosis.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {/* SHOPPING LIST - What to buy */}
      {diagnosis.materials && diagnosis.materials.length > 0 && (
        <div className="materials">
          <h3>🛒 מה לקנות</h3>
          <ul>
            {diagnosis.materials.map((item, i) => (
              <li key={i}>
                <span>{item.item}</span>
                {item.estimatedPrice && (
                  <span className="price">{item.estimatedPrice}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* TOOLS - What you need */}
      {diagnosis.tools && diagnosis.tools.length > 0 && (
        <div className="tools">
          <h3>🔧 כלים</h3>
          <ul>
            {diagnosis.tools.map((tool, i) => (
              <li key={i}><span>{tool}</span></li>
            ))}
          </ul>
        </div>
      )}

      {/* Israeli tip */}
      {diagnosis.israeliTip && (
        <div className="israeli-tip">
          <h3>💡 טיפ</h3>
          <p>{diagnosis.israeliTip}</p>
        </div>
      )}

      {/* When to call pro */}
      {diagnosis.whenToCallPro && !diagnosis.canDIY && (
        <div className="when-to-call">
          <h3>📞 למי להתקשר?</h3>
          <p>{diagnosis.whenToCallPro}</p>
        </div>
      )}

      {/* BIG BUTTON - Try again */}
      <button className="reset-btn" onClick={onReset}>
        📸 צלם בעיה חדשה
      </button>
    </div>
  );
}

export default DiagnosisResult;
