# sample-repo

A tiny fixture repository used by the Atlas ingestion spike
(`services/indexer-spike`). It intentionally contains **planted fake secrets**
in `src/auth.ts` and `src/billing.py` so the test harness can prove that secret
scanning removes them before any content is chunked, hashed, or embedded.

Nothing here is a real credential.
