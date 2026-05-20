/**
 * Analytics Routes
 * Provides endpoints for statistics, reporting, and data analysis
 */

const express = require('express');
const router = express.Router();
const procedures = require('./procedures');

// ============================================================================
// COMMAND STATISTICS
// ============================================================================

/**
 * GET /api/analytics/command-stats
 * Get command execution statistics
 */
router.get('/command-stats', async (req, res) => {
  try {
    const { timeWindow = 60 } = req.query;
    const stats = await procedures.getCommandStats(parseInt(timeWindow));
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// DEVICE STATISTICS
// ============================================================================

/**
 * GET /api/analytics/device-stats
 * Get device statistics
 */
router.get('/device-stats', async (req, res) => {
  try {
    const stats = await procedures.getDeviceStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/device/:deviceId
 * Get detailed device information
 */
router.get('/device/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const deviceInfo = await procedures.getDetailedDeviceInfo(deviceId);
    res.json({ success: true, deviceInfo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// AI MODEL METRICS
// ============================================================================

/**
 * GET /api/analytics/ai-metrics
 * Get AI model performance metrics
 */
router.get('/ai-metrics', async (req, res) => {
  try {
    const metrics = await procedures.getAIModelMetrics();
    res.json({ success: true, metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// LOG STATISTICS
// ============================================================================

/**
 * GET /api/analytics/log-stats
 * Get log statistics by type
 */
router.get('/log-stats', async (req, res) => {
  try {
    const stats = await procedures.getLogStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/logs-filtered
 * Get logs with advanced filtering
 */
router.get('/logs-filtered', async (req, res) => {
  try {
    const { type, sessionId, searchTerm, startDate, endDate, limit } = req.query;
    const filters = {
      type,
      sessionId,
      searchTerm,
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : 100
    };
    
    const logs = await procedures.getLogsWithFilters(filters);
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// VLA SESSION MANAGEMENT
// ============================================================================

/**
 * POST /api/analytics/vla-session/create
 * Create a new VLA session
 */
router.post('/vla-session/create', async (req, res) => {
  try {
    const { model } = req.body;
    if (!model) {
      return res.status(400).json({ success: false, error: 'Model is required' });
    }
    
    const sessionId = await procedures.createVLASession(model);
    res.json({ success: true, sessionId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/analytics/vla-session/end
 * End a VLA session
 */
router.post('/vla-session/end', async (req, res) => {
  try {
    const { sessionId, commandsExecuted, successCount } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID is required' });
    }
    
    await procedures.endVLASession(sessionId, commandsExecuted || 0, successCount || 0);
    res.json({ success: true, message: 'Session ended' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/vla-sessions
 * Get VLA session history
 */
router.get('/vla-sessions', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const sessions = await procedures.getVLASessionHistory(parseInt(limit));
    res.json({ success: true, sessions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// COMMAND HISTORY
// ============================================================================

/**
 * POST /api/analytics/command-history/record
 * Record command execution
 */
router.post('/command-history/record', async (req, res) => {
  try {
    const commandData = req.body;
    const recordId = await procedures.recordCommandExecution(commandData);
    res.json({ success: true, recordId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/command-history
 * Get command execution history with filtering
 */
router.get('/command-history', async (req, res) => {
  try {
    const { aiModel, userConfirmed, limit } = req.query;
    const filters = {
      aiModel,
      userConfirmed: userConfirmed === 'true',
      limit: limit ? parseInt(limit) : 100
    };
    
    const history = await procedures.getCommandExecutionHistory(filters);
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// REPORTING & EXPORT
// ============================================================================

/**
 * GET /api/analytics/report
 * Generate execution report
 */
router.get('/report', async (req, res) => {
  try {
    const { timeWindow = 60, sessionLimit = 10 } = req.query;
    const report = await procedures.generateExecutionReport({
      timeWindow: parseInt(timeWindow),
      sessionLimit: parseInt(sessionLimit)
    });
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/export/logs
 * Export logs as CSV
 */
router.get('/export/logs', async (req, res) => {
  try {
    const { type, limit = 100 } = req.query;
    const filters = { type, limit: parseInt(limit) };
    const logs = await procedures.getLogsWithFilters(filters);
    
    const csv = procedures.exportLogsToCSV(logs);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="davclaw-logs-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// LOG MANAGEMENT
// ============================================================================

/**
 * POST /api/analytics/logs/archive
 * Archive old logs
 */
router.post('/logs/archive', async (req, res) => {
  try {
    const { daysOld = 30 } = req.body;
    const archivedCount = await procedures.archiveOldLogs(daysOld);
    res.json({ success: true, archivedCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
