import { z } from 'zod'
import { createAlertSchema, markAlertReadSchema } from '@/modules/alerts/validation'
import { clientCreateSchema, clientPatchSchema } from '@/modules/clients/validation'
import { createInvoiceSchema, deleteInvoiceSchema, updateInvoiceSchema } from '@/modules/invoices/invoice.validation'
import { createProjectSchema, updateProjectSchema } from '@/modules/projects/validation'
import { createTaskSchema, updateTaskSchema } from '@/modules/tasks/task.validation'

type HttpMethod = 'get' | 'post' | 'patch' | 'delete'
type JsonSchema = Record<string, unknown>

type RouteContract = {
  auth: 'required' | 'none'
  dataSchemaRef: string
  description?: string
  idempotency?: 'optional' | 'required'
  method: HttpMethod
  operationId: string
  parameters?: Array<Record<string, unknown>>
  path: string
  permission?: string
  requestSchema?: z.ZodType
  requestSchemaName?: string
  responseDescription?: string
  status?: number
  summary: string
  tags: string[]
}

const commonErrorResponses = {
  '400': { $ref: '#/components/responses/BadRequest' },
  '401': { $ref: '#/components/responses/Unauthorized' },
  '403': { $ref: '#/components/responses/Forbidden' },
  '404': { $ref: '#/components/responses/NotFound' },
  '409': { $ref: '#/components/responses/Conflict' },
  '429': { $ref: '#/components/responses/RateLimited' },
  '500': { $ref: '#/components/responses/ServerError' },
} as const

const idParameter = {
  in: 'path',
  name: 'id',
  required: true,
  schema: { type: 'string' },
}

const pageParameter = {
  in: 'query',
  name: 'page',
  schema: { default: 1, minimum: 1, type: 'integer' },
}

const pageSizeParameter = {
  in: 'query',
  name: 'pageSize',
  schema: { default: 30, maximum: 100, minimum: 1, type: 'integer' },
}

export const apiRouteContracts = [
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/AlertList',
    method: 'get',
    operationId: 'listAlerts',
    path: '/alerts',
    permission: 'alerts:read',
    summary: 'List alerts for the current user',
    tags: ['Alerts'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/Alert',
    idempotency: 'optional',
    method: 'post',
    operationId: 'createAlert',
    path: '/alerts',
    permission: 'alerts:create',
    requestSchema: createAlertSchema,
    requestSchemaName: 'CreateAlertRequest',
    responseDescription: 'Alert created',
    status: 201,
    summary: 'Send an alert',
    tags: ['Alerts'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/Alert',
    idempotency: 'optional',
    method: 'patch',
    operationId: 'markAlertRead',
    path: '/alerts',
    permission: 'alerts:update',
    requestSchema: markAlertReadSchema,
    requestSchemaName: 'MarkAlertReadRequest',
    summary: 'Mark an alert as read',
    tags: ['Alerts'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/ClientsListResponse',
    method: 'get',
    operationId: 'listClients',
    parameters: [
      pageParameter,
      pageSizeParameter,
      { in: 'query', name: 'status', schema: { enum: ['active', 'inactive'], type: 'string' } },
      { in: 'query', name: 'q', schema: { type: 'string' } },
    ],
    path: '/clients',
    permission: 'clients:read',
    summary: 'List clients',
    tags: ['Clients'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/Client',
    idempotency: 'optional',
    method: 'post',
    operationId: 'createClient',
    path: '/clients',
    permission: 'clients:create',
    requestSchema: clientCreateSchema,
    requestSchemaName: 'ClientMutationRequest',
    responseDescription: 'Client created',
    status: 201,
    summary: 'Create a client',
    tags: ['Clients'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/TaskList',
    method: 'get',
    operationId: 'listTasks',
    parameters: [{ in: 'query', name: 'projectId', schema: { type: 'string' } }],
    path: '/tasks',
    permission: 'tasks:read',
    summary: 'List tasks',
    tags: ['Tasks'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/Task',
    idempotency: 'optional',
    method: 'post',
    operationId: 'createTask',
    path: '/tasks',
    permission: 'tasks:create',
    requestSchema: createTaskSchema,
    requestSchemaName: 'CreateTaskRequest',
    responseDescription: 'Task created',
    status: 201,
    summary: 'Create a task',
    tags: ['Tasks'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/Task',
    method: 'patch',
    operationId: 'updateTask',
    parameters: [idParameter],
    path: '/tasks/{id}',
    permission: 'tasks:update',
    requestSchema: updateTaskSchema,
    requestSchemaName: 'UpdateTaskRequest',
    summary: 'Update a task',
    tags: ['Tasks'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/DeleteTaskResponse',
    idempotency: 'optional',
    method: 'delete',
    operationId: 'deleteTask',
    parameters: [idParameter],
    path: '/tasks/{id}',
    permission: 'tasks:delete',
    summary: 'Delete a task',
    tags: ['Tasks'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/InvoicesListResponse',
    method: 'get',
    operationId: 'listInvoices',
    parameters: [
      pageParameter,
      pageSizeParameter,
      { in: 'query', name: 'status', schema: { type: 'string' } },
      { in: 'query', name: 'q', schema: { type: 'string' } },
      { in: 'query', name: 'clientId', schema: { type: 'string' } },
      { in: 'query', name: 'campaignId', schema: { type: 'string' } },
      { in: 'query', name: 'briefId', schema: { type: 'string' } },
    ],
    path: '/invoices',
    permission: 'finance:read',
    summary: 'List invoices',
    tags: ['Invoices'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/Invoice',
    idempotency: 'optional',
    method: 'post',
    operationId: 'createInvoice',
    path: '/invoices',
    permission: 'finance:write',
    requestSchema: createInvoiceSchema,
    requestSchemaName: 'CreateInvoiceRequest',
    responseDescription: 'Invoice created',
    status: 201,
    summary: 'Create an invoice',
    tags: ['Invoices'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/Invoice',
    method: 'get',
    operationId: 'getInvoice',
    parameters: [idParameter],
    path: '/invoices/{id}',
    permission: 'finance:read',
    summary: 'Get an invoice',
    tags: ['Invoices'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/Invoice',
    idempotency: 'optional',
    method: 'patch',
    operationId: 'updateInvoice',
    parameters: [idParameter],
    path: '/invoices/{id}',
    permission: 'finance:write',
    requestSchema: updateInvoiceSchema,
    requestSchemaName: 'UpdateInvoiceRequest',
    summary: 'Update an invoice',
    tags: ['Invoices'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/DeleteInvoiceResponse',
    idempotency: 'optional',
    method: 'delete',
    operationId: 'deleteInvoice',
    parameters: [idParameter],
    path: '/invoices/{id}',
    permission: 'finance:write',
    requestSchema: deleteInvoiceSchema,
    requestSchemaName: 'DeleteInvoiceRequest',
    summary: 'Delete an invoice',
    tags: ['Invoices'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/ProjectList',
    method: 'get',
    operationId: 'listProjects',
    path: '/projects',
    permission: 'projects:read',
    summary: 'List projects',
    tags: ['Projects'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/Project',
    idempotency: 'optional',
    method: 'post',
    operationId: 'createProject',
    path: '/projects',
    permission: 'projects:create',
    requestSchema: createProjectSchema,
    requestSchemaName: 'CreateProjectRequest',
    responseDescription: 'Project created',
    status: 201,
    summary: 'Create a project',
    tags: ['Projects'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/Project',
    method: 'get',
    operationId: 'getProject',
    parameters: [idParameter],
    path: '/projects/{id}',
    permission: 'projects:read',
    summary: 'Get a project',
    tags: ['Projects'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/Project',
    idempotency: 'optional',
    method: 'patch',
    operationId: 'updateProject',
    parameters: [idParameter],
    path: '/projects/{id}',
    permission: 'projects:update',
    requestSchema: updateProjectSchema,
    requestSchemaName: 'UpdateProjectRequest',
    summary: 'Update a project',
    tags: ['Projects'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/DeleteProjectResponse',
    idempotency: 'optional',
    method: 'delete',
    operationId: 'deleteProject',
    parameters: [idParameter],
    path: '/projects/{id}',
    permission: 'projects:delete',
    summary: 'Delete a project',
    tags: ['Projects'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/ClientDetailResponse',
    method: 'get',
    operationId: 'getClient',
    parameters: [idParameter],
    path: '/clients/{id}',
    permission: 'clients:read',
    summary: 'Get a client with related projects, invoices, activities',
    tags: ['Clients'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/Client',
    idempotency: 'optional',
    method: 'patch',
    operationId: 'updateClient',
    parameters: [idParameter],
    path: '/clients/{id}',
    permission: 'clients:update',
    requestSchema: clientPatchSchema,
    requestSchemaName: 'UpdateClientRequest',
    summary: 'Update a client',
    tags: ['Clients'],
  },
  {
    auth: 'required',
    dataSchemaRef: '#/components/schemas/DeleteClientResponse',
    idempotency: 'optional',
    method: 'delete',
    operationId: 'deleteClient',
    parameters: [idParameter],
    path: '/clients/{id}',
    permission: 'clients:delete',
    summary: 'Delete a client',
    tags: ['Clients'],
  },
] satisfies RouteContract[]

function schemaFromZod(schema: z.ZodType): JsonSchema {
  const jsonSchema = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema
  const { $schema: _schema, ...rest } = jsonSchema
  return rest
}

function canonicalResponse(schemaRef: string, description = 'Successful response') {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          allOf: [
            { $ref: '#/components/schemas/ApiResponse' },
            {
              type: 'object',
              properties: {
                data: { $ref: schemaRef },
              },
            },
          ],
        },
      },
    },
  }
}

function canonicalErrorResponse(description: string) {
  return {
    description,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ApiErrorResponse' },
      },
    },
  }
}

function operationFromContract(contract: RouteContract) {
  return {
    operationId: contract.operationId,
    summary: contract.summary,
    description: contract.description,
    tags: contract.tags,
    security: contract.auth === 'required' ? [{ sessionAuth: [] }] : [],
    parameters: [
      ...(contract.parameters ?? []),
      ...(contract.idempotency
        ? [
            {
              in: 'header',
              name: 'Idempotency-Key',
              required: contract.idempotency === 'required',
              schema: { maxLength: 255, type: 'string' },
            },
          ]
        : []),
    ],
    requestBody: contract.requestSchemaName
      ? {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${contract.requestSchemaName}` },
            },
          },
        }
      : undefined,
    responses: {
      [String(contract.status ?? 200)]: canonicalResponse(contract.dataSchemaRef, contract.responseDescription),
      ...commonErrorResponses,
    },
    'x-auth-required': contract.auth === 'required',
    'x-idempotency': contract.idempotency ?? 'none',
    'x-required-permission': contract.permission,
  }
}

function buildPaths(contracts: readonly RouteContract[]) {
  return contracts.reduce<Record<string, Partial<Record<HttpMethod, ReturnType<typeof operationFromContract>>>>>((paths, contract) => {
    paths[contract.path] = {
      ...(paths[contract.path] ?? {}),
      [contract.method]: operationFromContract(contract),
    }
    return paths
  }, {})
}

function buildRequestSchemas(contracts: readonly RouteContract[]) {
  return contracts.reduce<Record<string, JsonSchema>>((schemas, contract) => {
    if (contract.requestSchema && contract.requestSchemaName) {
      schemas[contract.requestSchemaName] = schemaFromZod(contract.requestSchema)
    }
    return schemas
  }, {})
}

export function generateOpenApiV1Spec(contracts: readonly RouteContract[] = apiRouteContracts) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'TASKIT OS API',
      version: '1.0.0',
      description: 'Versioned canonical API contract generated from TASKIT route contracts and Zod schemas.',
    },
    servers: [{ url: '/api/v1' }],
    tags: [
      { name: 'Alerts' },
      { name: 'Clients' },
      { name: 'Projects' },
      { name: 'Tasks' },
      { name: 'Invoices' },
    ],
    paths: buildPaths(contracts),
    components: {
      securitySchemes: {
        sessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'next-auth.session-token',
        },
      },
      responses: {
        BadRequest: canonicalErrorResponse('Bad request'),
        Unauthorized: canonicalErrorResponse('Unauthorized'),
        Forbidden: canonicalErrorResponse('Forbidden'),
        NotFound: canonicalErrorResponse('Not found'),
        Conflict: canonicalErrorResponse('Conflict'),
        RateLimited: canonicalErrorResponse('Rate limited'),
        ServerError: canonicalErrorResponse('Server error'),
      },
      schemas: {
        ApiPagination: {
          type: 'object',
          required: ['page', 'pageSize', 'total', 'pageCount'],
          properties: {
            page: { type: 'integer' },
            pageSize: { type: 'integer' },
            total: { type: 'integer' },
            pageCount: { type: 'integer' },
          },
        },
        ApiResponse: {
          type: 'object',
          required: ['success', 'data', 'error', 'meta', 'requestId', 'timestamp'],
          properties: {
            success: { const: true },
            data: {},
            error: { type: 'null' },
            meta: {
              type: 'object',
              additionalProperties: true,
              properties: {
                pagination: { $ref: '#/components/schemas/ApiPagination' },
              },
            },
            requestId: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ApiErrorResponse: {
          type: 'object',
          required: ['success', 'data', 'error', 'meta', 'requestId', 'timestamp'],
          properties: {
            success: { const: false },
            data: { type: 'null' },
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: {},
              },
            },
            meta: {
              type: 'object',
              additionalProperties: true,
            },
            requestId: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        Alert: {
          type: 'object',
          additionalProperties: true,
          required: ['id', 'type', 'title', 'message', 'read', 'createdAt'],
          properties: {
            id: { type: 'string' },
            type: { type: 'string' },
            title: { type: 'string' },
            message: { type: 'string' },
            read: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AlertList: {
          type: 'array',
          items: { $ref: '#/components/schemas/Alert' },
        },
        Client: {
          type: 'object',
          additionalProperties: true,
          required: ['id', 'companyName', 'status'],
          properties: {
            id: { type: 'string' },
            companyName: { type: 'string' },
            contactPerson: { type: ['string', 'null'] },
            email: { type: ['string', 'null'] },
            status: { enum: ['active', 'inactive'], type: 'string' },
            unpaidTotal: { type: 'number' },
          },
        },
        ClientsListResponse: {
          type: 'object',
          required: ['items', 'pagination'],
          properties: {
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/Client' },
            },
            pagination: { $ref: '#/components/schemas/ApiPagination' },
            summary: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
        Task: {
          type: 'object',
          additionalProperties: true,
          required: ['id', 'title'],
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            stage: { type: 'string' },
            priority: { type: 'string' },
            projectId: { type: ['string', 'null'] },
          },
        },
        TaskList: {
          type: 'array',
          items: { $ref: '#/components/schemas/Task' },
        },
        DeleteTaskResponse: {
          type: 'object',
          required: ['success'],
          properties: {
            success: { type: 'boolean' },
          },
        },
        Invoice: {
          type: 'object',
          additionalProperties: true,
          required: ['id', 'invoiceNumber', 'status', 'currency', 'total'],
          properties: {
            id: { type: 'string' },
            invoiceNumber: { type: 'string' },
            status: { type: 'string' },
            currency: { type: 'string' },
            total: { type: ['number', 'string'] },
          },
        },
        InvoicesListResponse: {
          type: 'object',
          required: ['items', 'pagination'],
          properties: {
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/Invoice' },
            },
            pagination: { $ref: '#/components/schemas/ApiPagination' },
            summary: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
        DeleteInvoiceResponse: {
          type: 'object',
          required: ['ok'],
          properties: {
            ok: { type: 'boolean' },
          },
        },
        Project: {
          type: 'object',
          additionalProperties: true,
          required: ['id', 'title'],
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: ['string', 'null'] },
            roomId: { type: ['string', 'null'] },
            managerId: { type: ['string', 'null'] },
            hasCamera: { type: 'boolean' },
            cameraType: { enum: ['device', 'external'], type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ProjectList: {
          type: 'array',
          items: { $ref: '#/components/schemas/Project' },
        },
        DeleteProjectResponse: {
          type: 'object',
          required: ['success', 'projectId'],
          properties: {
            success: { type: 'boolean' },
            projectId: { type: 'string' },
          },
        },
        ClientDetailResponse: {
          type: 'object',
          required: ['client'],
          properties: {
            client: { $ref: '#/components/schemas/Client' },
            stats: { type: 'object', additionalProperties: true },
            recentDeliverables: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
        DeleteClientResponse: {
          type: 'object',
          required: ['ok'],
          properties: {
            ok: { type: 'boolean' },
          },
        },
        ...buildRequestSchemas(contracts),
      },
    },
  }
}

export const openApiV1Spec = generateOpenApiV1Spec()
