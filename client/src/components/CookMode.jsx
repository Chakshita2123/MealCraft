import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Play, Pause, RotateCcw } from 'lucide-react';
import './CookMode.css';

// Regex to extract time from step text
const TIME_REGEX = /(\d+)[\s-]*(?:to[\s-]*\d+[\s-]*)?(minutes?|mins?|hours?|hrs?|seconds?|secs?)/gi;

const extractTimeFromText = (text) => {
  const match = TIME_REGEX.exec(text);
  if (!match) return null;

  const amount = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  let totalSeconds = 0;
  if (unit.includes('hour')) totalSeconds = amount * 3600;
  else if (unit.includes('min')) totalSeconds = amount * 60;
  else if (unit.includes('sec')) totalSeconds = amount;

  return totalSeconds;
};

const matchIngredientsForStep = (stepText, ingredients) => {
  const stepLower = stepText.toLowerCase();
  return ingredients.filter(ing => {
    const ingNameLower = ing.name.toLowerCase();
    return stepLower.includes(ingNameLower);
  });
};

export default function CookMode({ steps, ingredients, title, onExit }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerIntervalRef = useRef(null);

  const step = steps[currentStep];
  const stepTimeTotal = extractTimeFromText(step.step);
  const relevantIngredients = matchIngredientsForStep(step.step, ingredients);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === ' ') {
        e.preventDefault();
        handleTimerToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, isTimerRunning]);

  // Touch swipe support
  const touchStartRef = useRef(0);
  useEffect(() => {
    const handleTouchStart = (e) => {
      touchStartRef.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e) => {
      const touchEnd = e.changedTouches[0].clientX;
      const diff = touchStartRef.current - touchEnd;

      if (Math.abs(diff) > 50) {
        if (diff > 0) handleNext();
        else handlePrev();
      }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [currentStep]);

  // Timer logic
  useEffect(() => {
    if (!isTimerRunning || timerSeconds <= 0) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isTimerRunning, timerSeconds]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setIsTimerRunning(false);
      setTimerSeconds(0);
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleNext = useCallback(() => {
    setIsTimerRunning(false);
    setTimerSeconds(0);

    if (currentStep === steps.length - 1) {
      setIsCompleted(true);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, steps.length]);

  const handleStartTimer = useCallback(() => {
    if (stepTimeTotal && timerSeconds === 0) {
      setTimerSeconds(stepTimeTotal);
    }
    setIsTimerRunning(!isTimerRunning);
  }, [isTimerRunning, stepTimeTotal, timerSeconds]);

  const handleResetTimer = useCallback(() => {
    setIsTimerRunning(false);
    setTimerSeconds(stepTimeTotal || 0);
  }, [stepTimeTotal]);

  const progressPercent = ((currentStep + 1) / steps.length) * 100;
  const timerMinutes = Math.floor(timerSeconds / 60);
  const timerSecs = timerSeconds % 60;

  // Completion screen
  if (isCompleted) {
    return (
      <div className="cook-mode-overlay">
        <div className="completion-screen">
          <div className="completion-content">
            <div className="completion-icon">✓</div>
            <h1 className="completion-title">You did it! 🎉</h1>
            <p className="completion-subtitle">{title}</p>
            <button className="btn-back-recipe" onClick={() => onExit()}>
              Back to Recipe
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cook-mode-overlay">
      {/* Top Bar */}
      <div className="cook-top-bar">
        <button className="cook-exit-btn" onClick={onExit}>
          <X size={24} />
        </button>
        <h2 className="cook-title">{title}</h2>
        <div className="cook-step-counter">
          Step {currentStep + 1} of {steps.length}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="cook-progress-container">
        <div
          className="cook-progress-bar"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Content */}
      <div className="cook-main-content">
        <div className="cook-content-inner" key={currentStep}>
          {/* Step Number Circle */}
          <div className="cook-step-circle">{currentStep + 1}</div>

          {/* Step Text */}
          <p className="cook-step-text">{step.step}</p>

          {/* Timer */}
          {stepTimeTotal && (
            <div className="cook-timer-section">
              <div className="cook-timer-display">
                <div className="timer-ring-container">
                  <svg className="timer-ring" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" className="timer-ring-bg" />
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      className="timer-ring-progress"
                      style={{
                        strokeDasharray: `${2 * Math.PI * 45}`,
                        strokeDashoffset: `${
                          2 *
                          Math.PI *
                          45 *
                          (1 - timerSeconds / stepTimeTotal)
                        }`,
                      }}
                    />
                  </svg>
                  <div className="timer-text">
                    {String(timerMinutes).padStart(2, '0')}:
                    {String(timerSecs).padStart(2, '0')}
                  </div>
                </div>
              </div>

              <div className="cook-timer-controls">
                <button
                  className="timer-btn timer-toggle"
                  onClick={handleStartTimer}
                  disabled={timerSeconds === 0}
                >
                  {isTimerRunning ? (
                    <>
                      <Pause size={18} /> Pause
                    </>
                  ) : (
                    <>
                      <Play size={18} /> Start
                    </>
                  )}
                </button>
                <button
                  className="timer-btn timer-reset"
                  onClick={handleResetTimer}
                  disabled={timerSeconds === 0 || timerSeconds === stepTimeTotal}
                >
                  <RotateCcw size={18} /> Reset
                </button>
              </div>
            </div>
          )}

          {/* Relevant Ingredients */}
          {relevantIngredients.length > 0 && (
            <div className="cook-ingredients-section">
              <h3 className="cook-ingredients-title">Ingredients for this step</h3>
              <div className="cook-ingredients-chips">
                {relevantIngredients.map((ing, i) => (
                  <span
                    key={i}
                    className={`cook-ingredient-chip ${
                      ing.have ? 'have' : 'missing'
                    }`}
                  >
                    {ing.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="cook-nav-buttons">
        <button
          className="cook-nav-btn cook-prev"
          onClick={handlePrev}
          disabled={currentStep === 0}
        >
          <ChevronLeft size={28} />
          Previous
        </button>

        <button
          className="cook-nav-btn cook-next"
          onClick={handleNext}
        >
          {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
          <ChevronRight size={28} />
        </button>
      </div>
    </div>
  );
}
