import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const api = axios.create({
  baseURL: process.env.EMBIPAY_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Validate an MCP API key with the backend
 * @param {string} apiKey - Plaintext API key
 * @returns {Promise<{success: boolean, allowed_tools?: string[]}>}
 */
export async function validateApiKey(apiKey) {
  try {
    const response = await api.post('/api/mcp/validate-key', {
      api_key: apiKey
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw {
        status: error.response.status,
        message: error.response.data?.error || error.response.statusText
      };
    }
    throw {
      status: 500,
      message: error.message
    };
  }
}

/**
 * Call EmbiPay REST API endpoint with MCP API key
 * @param {string} method - HTTP method
 * @param {string} path - API path
 * @param {object|null} data - Request body
 * @param {string} apiKey - MCP API key for authentication
 * @returns {Promise<any>}
 */
export async function callApi(method, path, data = null, apiKey = null) {
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    const response = await api({
      method,
      url: path,
      data,
      headers
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw {
        status: error.response.status,
        message: error.response.data?.error || error.response.statusText
      };
    }
    throw {
      status: 500,
      message: error.message
    };
  }
}
