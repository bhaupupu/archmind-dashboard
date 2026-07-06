# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Core Navigation**: Replaced dead sidebar buttons with functional Next.js routing (`<Link>`).
- **Analyses History Page**: Created `/analyses` page to browse past architectural analyses.
- **Analysis Persistence**: Updated the `/api/v1/analyses` endpoint to persist all Gemini-powered analyses to the SQLite database. Added `/api/v1/analyses/history` to fetch them.
- **Repositories Page**: Created `/repositories` page to view and search all codebases imported during onboarding.
- **Graph Page**: Created a dedicated fullscreen `/graph` page for exploring the architecture dependency graph.
- **Dashboard Dynamic KPIs**: Replaced hardcoded dashboard numbers for "Analyses Run" and "Repositories" with dynamic counts fetched from the database.
- **Database Schema**: Added `createdAt` and `updatedAt` timestamps to the `Repository` model.

### Changed
- Dashboard widgets that do not yet have backend implementations (e.g. Agents, Open PRs) now gracefully display empty states (0) instead of misleading hardcoded mock data.
