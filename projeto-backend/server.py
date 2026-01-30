# Entry point for the application
# Run with: uvicorn server:app --reload --port 8000

from app.main import app

# This allows running with: python server.py
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
