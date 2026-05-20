# DAVClaw - Local Web App (No Simulation)

DAVClaw is a SOMA-architecture driven AI agent control center for Android devices. It bridges a local web frontend with a Node.js backend to provide real-time ADB control, VLA (Vision-Language-Action) loops, and a cyberpunk-themed TUI interface.

## 🚀 Features

- **ADB Bridge Service:** Real-time execution of ADB commands on physical devices.
- **VLA Loop Integration:** Vision-Language-Action sløjfe supporting Gemini, Claude, Ollama, and Groq.
- **Cyberpunk TUI:** Dark mode React interface with real-time WebSocket log streaming.
- **DAVSI DAEMON:** Visual AI companion reacting to system states.
- **CLI Shortcuts:** Direct terminal access via the web interface.

## 🛠 Tech Stack

- **Backend:** Node.js, Express, Socket.io, SQLite.
- **Frontend:** React, Tailwind CSS, Framer Motion, Lucide React.
- **Communication:** WebSockets for real-time data streaming.

## 📦 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/cptleftnut/DAVTui.git
   cd DAVTui
   ```

2. **Install dependencies:**
   ```bash
   npm run install:all
   ```

3. **Configure Environment:**
   Create a `.env` file in the `backend` directory:
   ```env
   PORT=3001
   PROJECT_DIR=/path/to/your/project
   GEMINI_API_KEY=your_key
   CLAUDE_API_KEY=your_key
   ```

4. **Run the application:**
   ```bash
   npm run dev
   ```
   - Frontend: `http://localhost:3000`
   - Backend: `http://localhost:3001`

## 🎯 Usage

- **ADB Commands:** Use `/shell <command>` in the terminal input (e.g., `/shell shell input tap 500 500`).
- **AI Processing:** Select your preferred model from the dropdown and trigger the VLA loop.
- **Logs:** Monitor real-time ADB and AI logs in the terminal window.

## 🛡 Security Note

This application runs locally and requires access to your filesystem and ADB. Ensure you only run it in a trusted environment.
