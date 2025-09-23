# CSV QA Tool

A client-side React application for reviewing and quality assurance of CSV data with Q&A pairs.

## Installation

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Setup

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```
4. Open your browser to `http://localhost:3000`

## Quick Start

1. **Upload CSV**: Click "Upload CSV" and select your file
2. **Map Columns**: The app will auto-detect common column names, or use the dropdowns to map manually
3. **Review Data**: Use the Row QA tab for focused review or Table tab for overview
4. **Mark Status**: Click Pass/Fail/Invalid/Discuss buttons to mark each row
5. **Export**: Download your reviewed data with the updated status

## Features

- ✅ **Client-side only** - your data never leaves your browser
- 🔍 **Dual view modes** - Row QA for detailed review, Table for bulk editing
- 🎯 **Smart column detection** - automatically finds question, answer, and status columns
- 📊 **Status tracking** - Pass/Fail/Invalid/Discuss with visual chips
- 💾 **Flexible export** - multiple download options to suit your workflow
- 🎨 **Color-coded fields** - easy visual distinction between question, expected answer, and response

Perfect for reviewing LLM outputs, chatbot responses, or any Q&A datasets.
