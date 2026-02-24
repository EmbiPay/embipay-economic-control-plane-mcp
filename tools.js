import Ajv from 'ajv';
import { callApi } from './client.js';

const ajv = new Ajv({ allErrors: true, strict: false });

export const tools = [
  {
    name: 'get_fleet_status',
    description: 'Returns fleet economic authority status including allocated and remaining capital.',
    input_schema: {
      type: 'object',
      properties: {
        fleet_id: {
          type: 'string',
          description: 'UUID of the fleet budget'
        }
      },
      required: ['fleet_id'],
      additionalProperties: false
    },
    output_schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string' },
            total_capital: { type: 'number' },
            allocated: { type: 'number' },
            remaining: { type: 'number' },
            policy_template_id: { type: ['string', 'null'] }
          }
        }
      }
    },
    examples: [
      {
        input: { fleet_id: '123e4567-e89b-12d3-a456-426614174000' },
        output: {
          success: true,
          data: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            status: 'active',
            total_capital: 10000,
            allocated: 7500,
            remaining: 2500,
            policy_template_id: null
          }
        }
      }
    ]
  },
  {
    name: 'request_wallet_increase',
    description: 'Request a wallet balance increase (subject to fleet cap and overage policy).',
    input_schema: {
      type: 'object',
      properties: {
        agent_id: { type: 'integer', minimum: 1 },
        balance: { type: 'number' },
        note: { type: 'string', maxLength: 500 }
      },
      required: ['agent_id', 'balance'],
      additionalProperties: false
    },
    output_schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: ['object', 'null'] },
        error: { type: ['string', 'null'] }
      }
    },
    examples: [
      {
        input: { agent_id: 123, balance: 1000, note: 'MCP request' },
        output: {
          success: true,
          data: { success: true, message: 'Wallet balance updated successfully', agent_id: 123, balance: 1000 }
        }
      }
    ]
  },
  {
    name: 'request_reallocation',
    description: 'Reallocate balance between two agent wallets (same fleet or both non-fleet).',
    input_schema: {
      type: 'object',
      properties: {
        from_agent_id: { type: 'integer', minimum: 1 },
        to_agent_id: { type: 'integer', minimum: 1 },
        amount: { type: 'number', exclusiveMinimum: 0 },
        note: { type: 'string', maxLength: 500 }
      },
      required: ['from_agent_id', 'to_agent_id', 'amount'],
      additionalProperties: false
    },
    output_schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: ['object', 'null'] },
        error: { type: ['string', 'null'] }
      }
    },
    examples: [
      {
        input: { from_agent_id: 123, to_agent_id: 456, amount: 500, note: 'MCP reallocation' },
        output: {
          success: true,
          data: { success: true, message: 'Reallocation completed', from_agent_id: 123, to_agent_id: 456, amount: 500 }
        }
      }
    ]
  },
  {
    name: 'approve_overage',
    description: 'Approve a pending fleet overage request.',
    input_schema: {
      type: 'object',
      properties: {
        overage_request_id: { type: 'string' }
      },
      required: ['overage_request_id'],
      additionalProperties: false
    },
    output_schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: ['object', 'null'] },
        error: { type: ['string', 'null'] }
      }
    },
    examples: [
      {
        input: { overage_request_id: '123e4567-e89b-12d3-a456-426614174000' },
        output: {
          success: true,
          data: { success: true, message: 'Overage approved', overage_request_id: '123e4567-e89b-12d3-a456-426614174000' }
        }
      }
    ]
  },
  {
    name: 'get_fleet_policies',
    description: 'Get all available fleet policy templates.',
    input_schema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    },
    output_schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            policies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: ['string', 'null'] },
                  config: { type: 'object' }
                }
              }
            }
          }
        }
      }
    },
    examples: [
      {
        input: {},
        output: {
          success: true,
          data: {
            policies: [
              {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Conservative Enterprise',
                description: 'Block overage, no reallocation, auto-pause at 90% allocated',
                config: { overage_policy: 'block', allow_reallocate: false, auto_pause_threshold: 0.9 }
              }
            ]
          }
        }
      }
    ]
  }
];

export async function handleTool(toolName, input, apiKey = null) {
  // Find tool definition
  const tool = tools.find(t => t.name === toolName);
  if (!tool) {
    return {
      success: false,
      status: 400,
      error: 'Unknown tool'
    };
  }

  // Validate input against schema
  const validate = ajv.compile(tool.input_schema);
  const valid = validate(input);
  
  if (!valid) {
    return {
      success: false,
      status: 400,
      error: 'Invalid input',
      details: validate.errors
    };
  }

  // Execute tool logic
  try {
    switch (toolName) {
      case 'get_fleet_status': {
        const data = await callApi('GET', `/api/fleet/get?id=${input.fleet_id}`, null, apiKey);
        return { success: true, data };
      }

      case 'request_wallet_increase': {
        const body = {
          agent_id: input.agent_id,
          balance: input.balance,
          note: input.note || 'MCP wallet increase request'
        };
        const data = await callApi('POST', '/api/admin/updateWalletBalance', body, apiKey);
        return { success: true, data };
      }

      case 'request_reallocation': {
        const body = {
          from_agent_id: input.from_agent_id,
          to_agent_id: input.to_agent_id,
          amount: input.amount,
          note: input.note || 'MCP reallocation request'
        };
        const data = await callApi('POST', '/api/admin/reallocate', body, apiKey);
        return { success: true, data };
      }

      case 'approve_overage': {
        const body = {
          overage_request_id: input.overage_request_id
        };
        const data = await callApi('POST', '/api/fleet/approve-overage', body, apiKey);
        return { success: true, data };
      }

      case 'get_fleet_policies': {
        const data = await callApi('GET', '/api/fleet/policies', null, apiKey);
        return { success: true, data };
      }

      default:
        return {
          success: false,
          status: 400,
          error: 'Unknown tool'
        };
    }
  } catch (error) {
    return {
      success: false,
      status: error.status || 500,
      error: error.message || 'Internal server error'
    };
  }
}
