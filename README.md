# FlashLearn

AI-powered flashcard learning app. Upload source material, generate multiple-choice questions with Claude, then study and track your progress.

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt

# Set your Anthropic API key
set ANTHROPIC_API_KEY=your-key-here    # Windows
# export ANTHROPIC_API_KEY=your-key-here  # macOS/Linux

uvicorn app.main:app --reload
```

Backend runs on http://localhost:8000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173 (proxies API calls to backend)
