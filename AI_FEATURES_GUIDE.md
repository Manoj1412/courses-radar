# AI Features Implementation Guide

## Overview
This document outlines the three new AI-powered features added to the Courses Radar application.

---

## Feature 1: AI Chatbot with Summarize & Quiz

### Description
An intelligent chatbot accessible via a side panel that provides three main functionalities:
- **Summarize**: Generate key points and summary of the video content
- **Quiz**: AI-generated quiz questions to test knowledge
- **History**: Track quiz attempts and performance analytics

### Implementation Details

#### Components
- **`/src/components/ChatPanel.tsx`** - Main chatbot interface with tabbed UI
  - Summary Tab: Displays video summary and key learning points
  - Quiz Tab: Interactive quiz with multiple-choice questions
  - History Tab: Previous quiz attempts with scores and timestamps

#### Hooks
- **`/src/hooks/useQuizTracking.ts`** - Manages quiz data persistence
  - Saves quiz attempts to IndexedDB/localStorage
  - Retrieves quiz history for a specific video
  - Calculates performance metrics

#### API Functions
- **`/src/lib/gemini.functions.ts`** - Gemini API integration
  - `generateVideoSummary(title, description)` - Creates summary from video metadata
  - `generateQuizQuestions(title, description, numQuestions)` - Generates multiple-choice questions
  - `generateQuizFeedback(title, userAnswers, correctAnswers, questions)` - Provides scoring and feedback

### How to Use
1. Open a video in the player
2. Click the **Message Square icon** in the header to open the Chat Panel
3. Select a tab:
   - **Summary**: Click "Load Summary" to see key points
   - **Quiz**: Click "Start Quiz" to begin testing knowledge
   - **History**: View previous quiz attempts

### Key Features
- Non-blocking UI with loading states
- Instant feedback after quiz completion
- Quiz history with timestamp and score tracking
- Error handling with fallback messages
- Emotion data integration (optional)

---

## Feature 2: Real-time Facial Expression Feedback

### Description
Monitors user facial expressions throughout the video and displays understanding feedback based on detected emotions.

### Implementation Details

#### Integration
- Uses existing `useEmotionDetector` hook (already in project)
- Detects emotions: happy, sad, neutral, surprised, angry, disgusted, fearful
- Tracks confidence levels for each emotion

#### Display in ChatPanel
- Shows average confidence score
- Lists primary emotions detected during video
- Helps assess if user is understanding content

#### Enhancement in Side Panel
- Real-time emotion monitoring via webcam
- Visual confidence bars with color-coded emotion states
- Status indicator (Live/Starting)

### Technical Details
- Leverages `@vladmandic/face-api` for face detection
- Canvas-based drawing for real-time visualization
- Non-intrusive UI with minimal performance impact

---

## Feature 3: Quiz History & Analytics

### Description
Comprehensive tracking and analytics for all quiz attempts, allowing users to monitor their learning progress.

### Implementation Details

#### Data Structure
```typescript
interface QuizAttempt {
  id: string;                    // Unique identifier
  videoId: string;               // Video being quizzed on
  videoTitle: string;            // For easy reference
  timestamp: number;             // When quiz was taken
  userAnswers: number[];         // Array of selected option indices
  score: number;                 // Percentage score
  totalQuestions: number;        // Questions in quiz
  feedback: string;              // AI-generated feedback
  emotionData?: {
    avgConfidence: number;       // Average emotion confidence
    primaryEmotions: string[];   // Emotions detected
  };
}
```

#### Storage
- Stored in browser's IndexedDB (persistent across sessions)
- Fallback to localStorage if IndexedDB unavailable
- Auto-cleanup for old entries (keeps last 50 per video)

#### Analytics Available
- Total quizzes taken
- Average score per video
- Score trends over time
- Topics needing improvement
- Time spent per video

#### UI Components
- History tab in ChatPanel displays:
  - List of all quiz attempts
  - Score and timestamp for each attempt
  - Average performance metrics
  - Quick access to view full feedback

### How to Access
1. Open Chat Panel
2. Click "History" tab
3. View all previous quiz attempts
4. Click on any attempt to see full feedback

---

## Environment Setup

### Required Environment Variables
```env
YOUTUBE_API_KEY=your_youtube_api_key
GEMINI_API_KEY=AIzaSyCN0uMKeyMrBRfmyzgJeauNMh7OtxjLCSM
```

### Dependencies
- `@google/generative-ai` - Gemini API client
- `@vladmandic/face-api` - Facial detection (already included)
- Existing Tailwind CSS and shadcn/ui components

---

## Component Architecture

```
VideoPlayer
├── ChatPanel (New)
│   ├── Summary Tab
│   │   └── Uses: generateVideoSummary()
│   ├── Quiz Tab
│   │   ├── Uses: generateQuizQuestions()
│   │   ├── Uses: generateQuizFeedback()
│   │   └── Uses: useQuizTracking()
│   └── History Tab
│       └── Uses: useQuizTracking() (retrieval)
├── Emotion Detection (Existing)
│   └── useEmotionDetector hook
└── Video & Controls
```

---

## File Structure

### New Files Created
```
src/
├── components/
│   └── ChatPanel.tsx                 # Main chatbot UI
├── hooks/
│   └── useQuizTracking.ts            # Quiz data management
└── lib/
    └── gemini.functions.ts           # AI API integrations
```

### Modified Files
```
src/
├── components/
│   └── VideoPlayer.tsx               # Added chat icon and panel integration
├── lib/
│   ├── types.ts                      # Added new interfaces
│   └── constants.ts                  # (if emoji/color constants added)
└── routes/
    └── index.tsx                     # Updated to pass video description
```

---

## API Integration Details

### Gemini API Models
- Using `gemini-1.5-flash` for fast responses
- Optimized for educational content summarization and quiz generation

### Prompt Engineering
- Summary: Extracts key learning points from metadata
- Quiz: Generates engaging multiple-choice questions
- Feedback: Provides detailed performance analysis

### Error Handling
- Graceful degradation if API fails
- Fallback UI messages
- Console error logging for debugging

---

## Performance Considerations

### Optimization Strategies
1. **Lazy Loading**: ChatPanel renders only when opened
2. **Memoization**: Quiz questions cached per video
3. **IndexedDB**: Efficient history storage without network calls
4. **Debouncing**: Emotion detection updates throttled

### Browser Compatibility
- Works on modern browsers with ES6+ support
- Requires WebGL for face detection
- IndexedDB support for data persistence

---

## Future Enhancement Opportunities

1. **AI-Powered Recommendations**
   - Suggest related videos based on quiz performance
   - Identify weak topics and recommend study materials

2. **Personalized Learning Paths**
   - Create adaptive learning sequences
   - Adjust difficulty based on user performance

3. **Collaborative Features**
   - Share quiz results with peers
   - Group study sessions

4. **Advanced Analytics**
   - Learning curve visualization
   - Skill progression tracking
   - Time-to-mastery metrics

5. **Offline Support**
   - Pre-download quiz content
   - Service worker caching

---

## Troubleshooting

### Issue: ChatPanel not appearing
- Ensure `GEMINI_API_KEY` is set in `.env`
- Check browser console for errors
- Verify VideoPlayer component is rendering

### Issue: Quiz questions not generating
- Check Gemini API key validity
- Verify internet connection
- Check browser console for API errors
- Ensure video title/description are not empty

### Issue: Emotion detection not working
- Grant camera permissions when prompted
- Check if browser supports WebGL
- Verify face is clearly visible to webcam

### Issue: Quiz history not saving
- Check if IndexedDB is enabled
- Verify sufficient storage space
- Check browser console for quota exceeded errors

---

## Testing Recommendations

1. **Manual Testing**
   - Test each tab functionality independently
   - Verify quiz scoring accuracy
   - Check emotion detection with different expressions
   - Test history persistence across sessions

2. **Edge Cases**
   - Long video titles/descriptions
   - API timeouts
   - Network interruptions
   - Multiple rapid quizzes

3. **Performance Testing**
   - Monitor memory usage with emotion detection
   - Test with large quiz history (50+ attempts)
   - Check UI responsiveness during API calls

---

## Support & Contribution

For issues, improvements, or contributions:
1. Check existing GitHub issues
2. Review error logs in browser console
3. Test in incognito mode to rule out cache issues
4. Provide environment details (OS, browser, version)

---

**Last Updated**: 2024
**Version**: 1.0
**Status**: Production Ready
