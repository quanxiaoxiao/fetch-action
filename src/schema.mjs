export default {
  type: 'object',
  properties: {
    debug: {
      type: 'boolean',
    },
    onlyStatusCodeWithOk: {
      type: 'boolean',
    },
    url: {
      type: 'string',
    },
    method: {
      enum: ['GET', 'POST', 'DELETE', 'PUT'],
    },
    rejectUnauthorized: {
      type: 'boolean',
    },
    validate: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
        },
      },
      required: ['type'],
    },
    headers: {
      type: 'object',
    },
    body: {
      oneOf: [
        {
          type: 'array',
        },
        {
          type: 'object',
        },
        {
          type: 'null',
        },
      ],
    },
    select: {
      oneOf: [
        {
          type: 'array',
        },
        {
          type: 'object',
        },
        {
          type: 'null',
        },
      ],
    },
  },
  required: ['url'],
  additionalProperties: true,
};
