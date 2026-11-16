import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { toolLogExercise, toolUpsertBlueprint } from './mcp-tools.ts';
import { ExerciseBlueprint } from './types.ts';

export const VASCO_MCP_TOOL_DEFINITIONS = [
  {
    name: 'log_exercise',
    description:
      'Logs an exercise instance into V.A.S.C.O. following the Blueprint & Instance Model. Supports single metrics (Time in seconds, Reps) and compound metrics (Weight + Reps), plus Modifier values (e.g. Band Assistance: None/Light/Medium/Heavy; Deficit: Floor/Parallettes/Blocks; Additional Weight: +10kg; Form Quality: 1-5) and Session Tags (Fresh, Sore, Heavy).',
    inputSchema: {
      type: 'object',
      properties: {
        exercise_id: {
          type: 'string',
          description:
            'Blueprint ID: muscle_up_transition_pulses, fat_grip_pullups, weighted_pullups, dips, sphinx_pushups, pike_presses, deadlift, or squat',
        },
        metric_values: {
          type: 'object',
          description:
            'Key-value object of measured metrics e.g. {"Time": 15} or {"Reps": 12} or {"Weight": 25, "Reps": 5}',
        },
        modifier_value: {
          type: 'string',
          description:
            'Modifier value e.g. "Light" (band), "Parallettes" (deficit), "+15kg" (dip load), or "5" (form quality 1-5)',
        },
        session_tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Contextual recovery/session tags e.g. ["Fresh"], ["Sore"], ["Heavy"]',
        },
        notes: {
          type: 'string',
          description: 'Optional notes about the set or feel',
        },
      },
      required: ['exercise_id', 'metric_values'],
    },
  },
  {
    name: 'upsert_exercise_blueprint',
    description: 'Creates or updates an Exercise Blueprint definition in V.A.S.C.O.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        is_active_focus: { type: 'boolean' },
        metrics: { type: 'array' },
        modifier: { type: 'object' },
      },
      required: ['id', 'name', 'metrics'],
    },
  },
];

async function runMcpServer() {
  const server = new Server(
    {
      name: 'vasco-mcp-server',
      version: '2.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: VASCO_MCP_TOOL_DEFINITIONS,
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
      let result: unknown;
      switch (name) {
        case 'log_exercise':
          result = await toolLogExercise(args as Parameters<typeof toolLogExercise>[0]);
          break;
        case 'upsert_exercise_blueprint':
          result = await toolUpsertBlueprint(args as unknown as ExerciseBlueprint);
          break;
        default:
          throw new Error(`Unknown V.A.S.C.O. MCP tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[V.A.S.C.O. MCP] Server v2.0 (Blueprint & Instance Model) running on stdio');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMcpServer().catch((err) => {
    console.error('[V.A.S.C.O. MCP] Fatal error:', err);
    process.exit(1);
  });
}
