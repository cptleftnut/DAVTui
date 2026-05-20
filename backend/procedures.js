/**
 * DAVClaw Advanced Procedures
 * Handles VLA sessions, analytics, and advanced device operations
 */

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./davclaw.db');

// ============================================================================
// VLA SESSION MANAGEMENT
// ============================================================================

/**
 * Create a new VLA session
 * @param {string} model - AI model used
 * @returns {Promise<string>} - Session ID
 */
const createVLASession = (model) => {
  return new Promise((resolve, reject) => {
    const sessionId = `vla_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    db.run(
      `INSERT INTO vla_sessions (session_id, model, start_time)
       VALUES (?, ?, datetime('now'))`,
      [sessionId, model],
      function(err) {
        if (err) reject(err);
        else resolve(sessionId);
      }
    );
  });
};

/**
 * End a VLA session and calculate success rate
 * @param {string} sessionId - Session ID
 * @param {number} commandsExecuted - Number of commands executed
 * @param {number} successCount - Number of successful commands
 * @returns {Promise<void>}
 */
const endVLASession = (sessionId, commandsExecuted, successCount) => {
  return new Promise((resolve, reject) => {
    const successRate = commandsExecuted > 0 ? (successCount / commandsExecuted) * 100 : 0;
    
    db.run(
      `UPDATE vla_sessions 
       SET end_time = datetime('now'), 
           commands_executed = ?, 
           success_rate = ?
       WHERE session_id = ?`,
      [commandsExecuted, successRate, sessionId],
      function(err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

/**
 * Get VLA session history
 * @param {number} limit - Number of sessions to retrieve
 * @returns {Promise<Array>} - Array of VLA sessions
 */
const getVLASessionHistory = (limit = 20) => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM vla_sessions 
       ORDER BY start_time DESC 
       LIMIT ?`,
      [limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
};

// ============================================================================
// ANALYTICS & STATISTICS
// ============================================================================

/**
 * Get command execution statistics
 * @param {number} timeWindowMinutes - Time window in minutes (default: 60)
 * @returns {Promise<Object>} - Statistics object
 */
const getCommandStats = (timeWindowMinutes = 60) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        COUNT(*) as total_commands,
        SUM(CASE WHEN error IS NULL THEN 1 ELSE 0 END) as successful_commands,
        SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) as failed_commands,
        AVG(execution_time) as avg_execution_time,
        MIN(execution_time) as min_execution_time,
        MAX(execution_time) as max_execution_time
      FROM adb_commands
      WHERE timestamp > datetime('now', '-' || ? || ' minutes')
    `;
    
    db.get(query, [timeWindowMinutes], (err, row) => {
      if (err) reject(err);
      else resolve(row || {});
    });
  });
};

/**
 * Get device statistics
 * @returns {Promise<Object>} - Device statistics
 */
const getDeviceStats = () => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        device_id,
        model,
        android_version,
        battery_level,
        is_connected,
        last_seen
       FROM device_state
       ORDER BY last_seen DESC`,
      (err, rows) => {
        if (err) reject(err);
        else {
          const stats = {
            total_devices: rows ? rows.length : 0,
            connected_devices: rows ? rows.filter((d: any) => d.is_connected).length : 0,
            devices: rows || []
          };
          resolve(stats);
        }
      }
    );
  });
};

/**
 * Get AI model performance metrics
 * @returns {Promise<Object>} - Performance metrics by model
 */
const getAIModelMetrics = () => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        model,
        COUNT(*) as total_interactions,
        AVG(confidence) as avg_confidence,
        SUM(CASE WHEN execution_result IS NOT NULL THEN 1 ELSE 0 END) as successful_predictions
       FROM ai_interactions
       GROUP BY model
       ORDER BY total_interactions DESC`,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
};

/**
 * Get log statistics
 * @returns {Promise<Object>} - Log statistics by type
 */
const getLogStats = () => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        type,
        COUNT(*) as count
       FROM logs
       GROUP BY type`,
      (err, rows) => {
        if (err) reject(err);
        else {
          const stats: { [key: string]: number } = {};
          rows?.forEach((row: any) => {
            stats[row.type] = row.count;
          });
          resolve(stats);
        }
      }
    );
  });
};

// ============================================================================
// DEVICE OPERATIONS
// ============================================================================

/**
 * Get detailed device information
 * @param {string} deviceId - Device ID
 * @returns {Promise<Object>} - Detailed device info
 */
const getDetailedDeviceInfo = (deviceId) => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM device_state WHERE device_id = ?`,
      [deviceId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row || {});
      }
    );
  });
};

/**
 * Update device state in database
 * @param {string} deviceId - Device ID
 * @param {Object} state - Device state object
 * @returns {Promise<void>}
 */
const updateDeviceState = (deviceId, state) => {
  return new Promise((resolve, reject) => {
    const { model, androidVersion, batteryLevel, screenState } = state;
    
    db.run(
      `INSERT OR REPLACE INTO device_state 
       (device_id, model, android_version, battery_level, screen_state, is_connected, last_seen)
       VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`,
      [deviceId, model, androidVersion, batteryLevel, screenState],
      function(err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

// ============================================================================
// COMMAND HISTORY & TRACKING
// ============================================================================

/**
 * Record command execution in history
 * @param {Object} commandData - Command data object
 * @returns {Promise<number>} - Record ID
 */
const recordCommandExecution = (commandData) => {
  return new Promise((resolve, reject) => {
    const { userCommand, aiModel, predictedAction, userConfirmed, executionResult } = commandData;
    
    db.run(
      `INSERT INTO command_history 
       (user_command, ai_model, predicted_action, user_confirmed, execution_result)
       VALUES (?, ?, ?, ?, ?)`,
      [userCommand, aiModel, predictedAction, userConfirmed ? 1 : 0, executionResult],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};

/**
 * Get command execution history with filtering
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} - Filtered command history
 */
const getCommandExecutionHistory = (filters = {}) => {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM command_history WHERE 1=1';
    const params: any[] = [];

    if (filters.aiModel) {
      query += ' AND ai_model = ?';
      params.push(filters.aiModel);
    }

    if (filters.userConfirmed !== undefined) {
      query += ' AND user_confirmed = ?';
      params.push(filters.userConfirmed ? 1 : 0);
    }

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    } else {
      query += ' LIMIT 100';
    }

    query += ' ORDER BY timestamp DESC';

    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// ============================================================================
// LOG MANAGEMENT
// ============================================================================

/**
 * Archive old logs (older than specified days)
 * @param {number} daysOld - Number of days to keep
 * @returns {Promise<number>} - Number of archived logs
 */
const archiveOldLogs = (daysOld = 30) => {
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM logs 
       WHERE timestamp < datetime('now', '-' || ? || ' days')`,
      [daysOld],
      function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
};

/**
 * Get logs with advanced filtering
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} - Filtered logs
 */
const getLogsWithFilters = (filters = {}) => {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM logs WHERE 1=1';
    const params: any[] = [];

    if (filters.type) {
      query += ' AND type = ?';
      params.push(filters.type);
    }

    if (filters.sessionId) {
      query += ' AND session_id = ?';
      params.push(filters.sessionId);
    }

    if (filters.searchTerm) {
      query += ' AND (message LIKE ? OR result LIKE ?)';
      const searchTerm = `%${filters.searchTerm}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.startDate) {
      query += ' AND timestamp >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND timestamp <= ?';
      params.push(filters.endDate);
    }

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    } else {
      query += ' LIMIT 100';
    }

    query += ' ORDER BY timestamp DESC';

    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// ============================================================================
// EXPORT & REPORTING
// ============================================================================

/**
 * Generate execution report
 * @param {Object} options - Report options
 * @returns {Promise<Object>} - Report data
 */
const generateExecutionReport = async (options = {}) => {
  try {
    const commandStats = await getCommandStats(options.timeWindow || 60);
    const deviceStats = await getDeviceStats();
    const aiMetrics = await getAIModelMetrics();
    const logStats = await getLogStats();
    const vlaHistory = await getVLASessionHistory(options.sessionLimit || 10);

    return {
      timestamp: new Date().toISOString(),
      commandStats,
      deviceStats,
      aiMetrics,
      logStats,
      vlaHistory
    };
  } catch (error) {
    throw new Error(`Failed to generate report: ${error.message}`);
  }
};

/**
 * Export logs to CSV format
 * @param {Array} logs - Array of log entries
 * @returns {string} - CSV formatted string
 */
const exportLogsToCSV = (logs) => {
  const headers = ['ID', 'Type', 'Message', 'Result', 'Timestamp', 'Session ID'];
  const rows = logs.map(log => [
    log.id,
    log.type,
    `"${log.message.replace(/"/g, '""')}"`,
    log.result ? `"${log.result.replace(/"/g, '""')}"` : '',
    log.timestamp,
    log.session_id || ''
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csv;
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // VLA Session Management
  createVLASession,
  endVLASession,
  getVLASessionHistory,

  // Analytics & Statistics
  getCommandStats,
  getDeviceStats,
  getAIModelMetrics,
  getLogStats,

  // Device Operations
  getDetailedDeviceInfo,
  updateDeviceState,

  // Command History & Tracking
  recordCommandExecution,
  getCommandExecutionHistory,

  // Log Management
  archiveOldLogs,
  getLogsWithFilters,

  // Export & Reporting
  generateExecutionReport,
  exportLogsToCSV
};
