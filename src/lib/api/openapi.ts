const canonicalResponse = (schemaRef: string, description = 'Successful response') => ({
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
})

const canonicalErrorResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ApiErrorResponse' },
    },
  },
})

const canonicalListResponse = (itemRef: string, description = 'Successful list response') => ({
  description,
  content: {
    'application/json': {
      schema: {
        allOf: [
          { $ref: '#/components/schemas/ApiResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { $ref: itemRef },
              },
            },
          },
        ],
      },
    },
  },
})

const errorResponses = {
  '400': { $ref: '#/components/responses/BadRequest' },
  '401': { $ref: '#/components/responses/Unauthorized' },
  '403': { $ref: '#/components/responses/Forbidden' },
  '404': { $ref: '#/components/responses/NotFound' },
  '500': { $ref: '#/components/responses/ServerError' },
} as const

export const openApiV1Spec = {
  openapi: '3.1.0',
  info: {
    title: 'TASKIT OS API',
    version: '1.0.0',
    description: 'Versioned canonical API contract for progressively migrated TASKIT OS endpoints.',
  },
  servers: [{ url: '/api/v1' }],
  paths: {
    '/alerts': {
      get: {
        operationId: 'listAlerts',
        summary: 'List alerts for the current user',
        tags: ['Alerts'],
        responses: {
          '200': canonicalListResponse('#/components/schemas/Alert'),
          ...errorResponses,
        },
      },
      post: {
        operationId: 'createAlert',
        summary: 'Send an alert',
        tags: ['Alerts'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateAlertRequest' },
            },
          },
        },
        responses: {
          '201': canonicalResponse('#/components/schemas/Alert', 'Alert created'),
          ...errorResponses,
        },
      },
      patch: {
        operationId: 'markAlertRead',
        summary: 'Mark an alert as read',
        tags: ['Alerts'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MarkAlertReadRequest' },
            },
          },
        },
        responses: {
          '200': canonicalResponse('#/components/schemas/Alert'),
          ...errorResponses,
        },
      },
    },
    '/clients': {
      get: {
        operationId: 'listClients',
        summary: 'List clients',
        tags: ['Clients'],
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
          { in: 'query', name: 'status', schema: { enum: ['active', 'inactive'], type: 'string' } },
          { in: 'query', name: 'q', schema: { type: 'string' } },
        ],
        responses: {
          '200': canonicalResponse('#/components/schemas/ClientsListResponse'),
          ...errorResponses,
        },
      },
      post: {
        operationId: 'createClient',
        summary: 'Create a client',
        tags: ['Clients'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ClientMutationRequest' },
            },
          },
        },
        responses: {
          '201': canonicalResponse('#/components/schemas/Client', 'Client created'),
          ...errorResponses,
        },
      },
    },
    '/tasks': {
      get: {
        operationId: 'listTasks',
        summary: 'List tasks',
        tags: ['Tasks'],
        parameters: [
          {
            in: 'query',
            name: 'projectId',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': canonicalListResponse('#/components/schemas/Task'),
          ...errorResponses,
        },
      },
      post: {
        operationId: 'createTask',
        summary: 'Create a task',
        tags: ['Tasks'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TaskMutationRequest' },
            },
          },
        },
        responses: {
          '201': canonicalResponse('#/components/schemas/Task', 'Task created'),
          ...errorResponses,
        },
      },
    },
    '/tasks/{id}': {
      patch: {
        operationId: 'updateTask',
        summary: 'Update a task',
        tags: ['Tasks'],
        parameters: [{ $ref: '#/components/parameters/Id' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TaskMutationRequest' },
            },
          },
        },
        responses: {
          '200': canonicalResponse('#/components/schemas/Task'),
          ...errorResponses,
        },
      },
      delete: {
        operationId: 'deleteTask',
        summary: 'Delete a task',
        tags: ['Tasks'],
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': canonicalResponse('#/components/schemas/DeleteTaskResponse'),
          ...errorResponses,
        },
      },
    },
    '/invoices': {
      get: {
        operationId: 'listInvoices',
        summary: 'List invoices',
        tags: ['Invoices'],
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
          { in: 'query', name: 'status', schema: { type: 'string' } },
          { in: 'query', name: 'q', schema: { type: 'string' } },
          { in: 'query', name: 'clientId', schema: { type: 'string' } },
          { in: 'query', name: 'campaignId', schema: { type: 'string' } },
          { in: 'query', name: 'briefId', schema: { type: 'string' } },
        ],
        responses: {
          '200': canonicalResponse('#/components/schemas/InvoicesListResponse'),
          ...errorResponses,
        },
      },
      post: {
        operationId: 'createInvoice',
        summary: 'Create an invoice',
        tags: ['Invoices'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/InvoiceMutationRequest' },
            },
          },
        },
        responses: {
          '201': canonicalResponse('#/components/schemas/Invoice', 'Invoice created'),
          ...errorResponses,
        },
      },
    },
    '/invoices/{id}': {
      get: {
        operationId: 'getInvoice',
        summary: 'Get an invoice',
        tags: ['Invoices'],
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': canonicalResponse('#/components/schemas/Invoice'),
          ...errorResponses,
        },
      },
      patch: {
        operationId: 'updateInvoice',
        summary: 'Update an invoice',
        tags: ['Invoices'],
        parameters: [{ $ref: '#/components/parameters/Id' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/InvoiceMutationRequest' },
            },
          },
        },
        responses: {
          '200': canonicalResponse('#/components/schemas/Invoice'),
          ...errorResponses,
        },
      },
      delete: {
        operationId: 'deleteInvoice',
        summary: 'Delete an invoice',
        tags: ['Invoices'],
        parameters: [{ $ref: '#/components/parameters/Id' }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DeleteInvoiceRequest' },
            },
          },
        },
        responses: {
          '200': canonicalResponse('#/components/schemas/DeleteInvoiceResponse'),
          ...errorResponses,
        },
      },
    },
  },
  components: {
    parameters: {
      Id: {
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string' },
      },
      Page: {
        in: 'query',
        name: 'page',
        schema: { default: 1, minimum: 1, type: 'integer' },
      },
      PageSize: {
        in: 'query',
        name: 'pageSize',
        schema: { default: 30, maximum: 100, minimum: 1, type: 'integer' },
      },
    },
    responses: {
      BadRequest: canonicalErrorResponse('Bad request'),
      Unauthorized: canonicalErrorResponse('Unauthorized'),
      Forbidden: canonicalErrorResponse('Forbidden'),
      NotFound: canonicalErrorResponse('Not found'),
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
      NullData: { type: 'null' },
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
      ClientMutationRequest: {
        type: 'object',
        required: ['companyName'],
        properties: {
          companyName: { type: 'string' },
          contactPerson: { type: ['string', 'null'] },
          email: { type: ['string', 'null'] },
          phone: { type: ['string', 'null'] },
          country: { type: ['string', 'null'] },
          address: { type: ['string', 'null'] },
          notes: { type: ['string', 'null'] },
          avatarUrl: { type: ['string', 'null'] },
          status: { enum: ['active', 'inactive'], type: 'string' },
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
      CreateAlertRequest: {
        type: 'object',
        required: ['title', 'message', 'recipientId'],
        properties: {
          type: { type: 'string' },
          title: { type: 'string' },
          message: { type: 'string' },
          recipientId: { type: 'string' },
        },
      },
      MarkAlertReadRequest: {
        type: 'object',
        required: ['alertId'],
        properties: {
          alertId: { type: 'string' },
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
      TaskMutationRequest: {
        type: 'object',
        additionalProperties: true,
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
      InvoiceMutationRequest: {
        type: 'object',
        additionalProperties: true,
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
      DeleteInvoiceRequest: {
        type: 'object',
        properties: {
          confirmation: {},
        },
      },
      DeleteInvoiceResponse: {
        type: 'object',
        required: ['ok'],
        properties: {
          ok: { type: 'boolean' },
        },
      },
    },
  },
} as const
