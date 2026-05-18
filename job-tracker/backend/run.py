import uvicorn

if __name__ == "__main__":
    # Bind to localhost only — this is a local-only tool with no authentication.
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
