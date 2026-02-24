import express from 'express';
import dotenv from 'dotenv';
import { tools, handleTool } from './tools.js';
import { validateApiKey } from './client.js';
import { checkRateLimit } from './rateLimiter.js';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4001;

app.post('/mcp', async (req, res) => {
  try {
    // Require X-API-Key header
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const trimmedKey = apiKey.trim();

    // Validate API key with backend
    let keyValidation;
    try {
      keyValidation = await validateApiKey(trimmedKey);
    } catch (error) {
      if (error.status === 401) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized'
        });
      }
      throw error;
    }

    if (!keyValidation.success || !Array.isArray(keyValidation.allowed_tools)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const allowedTools = keyValidation.allowed_tools;

    // Check rate limit
    const rateLimitResult = checkRateLimit(trimmedKey);
    if (!rateLimitResult.allowed) {
      const responseStatus = 429;
      console.log({
        time: new Date().toISOString(),
        tool: req.body?.tool || 'unknown',
        apiKeyPrefix: trimmedKey.slice(0, 6),
        status: responseStatus
      });
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        retry_after: rateLimitResult.retryAfter
      });
    }

    // Validate request body
    const { tool, input } = req.body;

    if (!tool) {
      return res.status(400).json({
        success: false,
        error: 'tool is required'
      });
    }

    // Check if tool exists
    const toolExists = tools.some(t => t.name === tool);
    if (!toolExists) {
      return res.status(400).json({
        success: false,
        error: 'Unknown tool'
      });
    }

    // Check if tool is permitted for this API key
    if (!allowedTools.includes(tool)) {
      return res.status(403).json({
        success: false,
        error: 'Tool not permitted'
      });
    }

    // Execute tool (pass API key for backend authentication)
    const result = await handleTool(tool, input || {}, trimmedKey);
    const responseStatus = result.success ? 200 : (result.status || 500);
    
    // Log request (minimal - no full API key, no full payload)
    console.log({
      time: new Date().toISOString(),
      tool,
      apiKeyPrefix: trimmedKey.slice(0, 6),
      status: responseStatus
    });
    
    return res.status(responseStatus).json(result);
  } catch (error) {
    const status = error.status || 500;
    const message = error.message || 'Internal server error';
    return res.status(status).json({
      success: false,
      status,
      error: message
    });
  }
});

app.listen(PORT, () => {
  console.log(`EmbiPay Economic Control Plane (MCP) running on port ${PORT}`);
});
