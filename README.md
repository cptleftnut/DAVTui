# DAVClaw Coding Agent - VLA Loop Implementation

DAVClaw is an advanced Android automation platform powered by Visual Language Agents (VLA). It combines ADB (Android Debug Bridge) control with AI-driven visual analysis to automate complex device interactions.

## Features

### Phase 1: Backend Infrastructure ✅
- **Database Schema**: SQLite database with tables for logs, ADB commands, device state, AI interactions, and VLA sessions
- **ADB Bridge Service**: Robust command execution with timeout handling and error management
- **WebSocket Server**: Real-time log streaming and device status updates
- **AI Integration**: Support for Gemini, Claude, and Ollama APIs with fallback to mock responses
- **Filesystem API**: Secure file tree browsing and reading with directory traversal protection

### Phase 2: Frontend-Backend Integration ✅
- **WebSocket Connection**: Real-time communication with automatic reconnection
- **Device Selection**: Multi-device support with device selector in header
- **Screenshot Capture**: Real-time device screen capture and display
- **CLI Command Input**: Terminal-like interface for manual ADB commands
- **Model Selector**: Choose between different AI models (Gemini, Claude, Ollama)

### Phase 3: VLA Loop Implementation ✅
- **VLA Trigger Button**: One-click AI analysis of current device state
- **AI Prediction Display**: Shows AI-predicted command with confidence score
- **Command Confirmation UI**: User approval before executing AI-predicted commands
- **Execution Result Streaming**: Real-time feedback of command execution
- **DAVSI Companion**: Visual indicator of system state and AI processing status

### Phase 4: Real-Time Features ✅
- **Log Persistence**: All logs stored in SQLite database
- **Log Filtering**: Filter logs by type (system, adb, ai, error)
- **Log Search**: Full-text search across log messages
- **Device Monitoring Dashboard**: Real-time battery, model, and Android version display
- **Command History**: Searchable history of executed commands with execution times
- **Export Functionality**: Download logs as text files

### Phase 5: Testing & Deployment (In Progress)
- **Vitest Test Suite**: Comprehensive backend API tests
- **WebSocket Testing**: Real-time communication verification
- **End-to-End VLA Loop Testing**: Full workflow validation
- **Production Readiness**: Error handling, logging, and monitoring

## Architecture

```
DAVTui/
├── backend/
│   ├── index.js              # Main Express server with all endpoints
│   ├── package.json          # Backend dependencies
│   ├── .env.example          # Environment variables template
│   └── tests/
│       └── procedures.test.js # Vitest test suite
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Main application component
│   │   ├── components/       # React components
│   │   │   ├── DeviceMonitor.tsx
│   │   │   ├── LogViewer.tsx
│   │   │   └── CommandHistory.tsx
│   │   ├── services/
│   │   │   └── api.ts        # API client with axios
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts
│   │   └── utils/
│   │       └── cn.ts         # Utility functions
│   ├── package.json          # Frontend dependencies
│   └── vite.config.ts        # Vite configuration
└── package.json              # Monorepo root
```

## Installation

### Prerequisites
- Node.js 18+ and npm/pnpm
- Android device with ADB enabled
- API keys for AI services (optional, mock responses available)

### Setup

1. **Clone the repository**
```bash
gh repo clone cptleftnut/DAVTui
cd DAVTui
```

2. **Install dependencies**
```bash
npm run install:all
```

3. **Configure environment variables**
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys
```

4. **Start the development servers**
```bash
npm run dev
```

This will start:
- Backend: http://localhost:3001
- Frontend: http://localhost:5173

## Usage

### Manual ADB Commands
1. Select a device from the device dropdown
2. Enter commands in the CLI input field using `/shell` prefix
3. Example: `/shell shell input tap 500 500`

### VLA Loop (AI-Powered Automation)
1. Take a screenshot using the "REFRESH" button
2. Click "TRIGGER VLA LOOP" to analyze the device state
3. Review the AI-predicted command and confidence score
4. Click "Execute" to run the command or "Reject" to dismiss

### Monitoring
- **Device Monitor**: Real-time battery, model, and Android version
- **System Logs**: View all system, ADB, AI, and error logs
- **Command History**: Browse previously executed commands
- **Log Export**: Download logs for analysis

## API Endpoints

### ADB Endpoints
- `GET /api/adb/devices` - List connected devices
- `POST /api/adb/execute` - Execute ADB command
- `GET /api/adb/screenshot` - Capture device screenshot
- `GET /api/adb/device-info` - Get device information
- `GET /api/adb/command-history` - Get command execution history

### AI Endpoints
- `POST /api/ai/process` - Process screenshot with AI model

### Filesystem Endpoints
- `GET /api/fs/tree` - Get project directory tree
- `GET /api/fs/read` - Read file contents

### Logging Endpoints
- `GET /api/logs` - Get system logs with filtering
- `GET /api/device-state` - Get connected device states

## Environment Variables

```env
# Server Configuration
PORT=3001
NODE_ENV=development
PROJECT_DIR=/home/ubuntu/DAVTui

# AI API Keys
GEMINI_API_KEY=your_gemini_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434

# Database
DATABASE_PATH=./davclaw.db
```

## Testing

### Run Backend Tests
```bash
cd backend
npm test
```

### Run Tests with UI
```bash
cd backend
npm run test:ui
```

### Generate Coverage Report
```bash
cd backend
npm run test:coverage
```

## Development

### Backend Development
```bash
cd backend
npm run dev
```

### Frontend Development
```bash
cd frontend
npm run dev
```

### Full Stack Development
```bash
npm run dev
```

## Database Schema

### logs
- `id` (INTEGER PRIMARY KEY)
- `type` (TEXT) - system, adb, ai, error
- `message` (TEXT)
- `result` (TEXT)
- `timestamp` (DATETIME)
- `session_id` (TEXT)

### adb_commands
- `id` (INTEGER PRIMARY KEY)
- `command` (TEXT)
- `result` (TEXT)
- `error` (TEXT)
- `execution_time` (INTEGER)
- `timestamp` (DATETIME)
- `device_id` (TEXT)

### device_state
- `id` (INTEGER PRIMARY KEY)
- `device_id` (TEXT UNIQUE)
- `model` (TEXT)
- `android_version` (TEXT)
- `battery_level` (INTEGER)
- `screen_state` (TEXT)
- `last_seen` (DATETIME)
- `is_connected` (BOOLEAN)

### ai_interactions
- `id` (INTEGER PRIMARY KEY)
- `model` (TEXT)
- `prompt` (TEXT)
- `screenshot_path` (TEXT)
- `predicted_command` (TEXT)
- `confidence` (REAL)
- `execution_result` (TEXT)
- `timestamp` (DATETIME)

### command_history
- `id` (INTEGER PRIMARY KEY)
- `user_command` (TEXT)
- `ai_model` (TEXT)
- `predicted_action` (TEXT)
- `user_confirmed` (BOOLEAN)
- `execution_result` (TEXT)
- `timestamp` (DATETIME)

### vla_sessions
- `id` (INTEGER PRIMARY KEY)
- `session_id` (TEXT UNIQUE)
- `model` (TEXT)
- `start_time` (DATETIME)
- `end_time` (DATETIME)
- `commands_executed` (INTEGER)
- `success_rate` (REAL)

## WebSocket Events

### Client → Server
- `log` - Log event
- `disconnect` - Client disconnection

### Server → Client
- `log` - System/ADB/AI/Error log
- `adb_status` - Device connection status
- `agent_state` - Agent processing state (idle, processing, confirming)

## Troubleshooting

### ADB Connection Issues
1. Ensure Android device has USB debugging enabled
2. Run `adb devices` to verify connection
3. Check firewall settings if using network ADB

### AI API Errors
1. Verify API keys in `.env` file
2. Check API rate limits and quota
3. Fallback to mock responses for testing

### WebSocket Connection Failed
1. Verify backend is running on port 3001
2. Check CORS settings in backend
3. Ensure frontend URL matches backend CORS origin

## Performance Optimization

- Log retention: Last 100 logs displayed in UI
- Device polling: Every 5 seconds
- Device info refresh: Every 10 seconds
- Command history limit: 50 most recent commands
- Screenshot compression: Base64 PNG encoding

## Security Considerations

- Directory traversal protection on filesystem API
- Input validation on all endpoints
- CORS configuration for production
- Environment variables for sensitive data
- Database queries use parameterized statements

## Future Enhancements

- [ ] Multi-device VLA loop orchestration
- [ ] Advanced gesture recognition
- [ ] Custom AI model training
- [ ] Performance profiling dashboard
- [ ] Batch command execution
- [ ] Mobile app for remote control
- [ ] Cloud storage integration
- [ ] Team collaboration features

## License

ISC

## Support

For issues, feature requests, or contributions, please visit the GitHub repository.

## Changelog

### v2.0-BETA
- Implemented Phase 1-4 of VLA loop
- Added comprehensive logging system
- Implemented device monitoring
- Added command history and export
- Integrated multiple AI models
- Enhanced error handling

### v1.0.4-ALPHA
- Initial ADB bridge implementation
- Basic WebSocket support
- Simple UI with device screenshot
- Mock AI responses

---

**DAVClaw** - Autonomous Android Automation with Visual Language Agents
