import { select } from '@quanxiaoxiao/datav';
import request from '@quanxiaoxiao/http-request';
import {
  decodeContentEncoding,
  decodeContentToJSON,
  parseHttpPath,
  parseHttpUrl,
} from '@quanxiaoxiao/http-utils';
import { template } from '@quanxiaoxiao/utils';
import Ajv from 'ajv';

import schema from './schema.mjs';

const ajv = new Ajv();

const validateOptions = (options, actionName, index) => {
  const operationValidate = ajv.compile(schema);
  if (!operationValidate(options)) {
    const errorMessage = JSON.stringify(operationValidate.errors);
    const prefix = actionName ? `\`${actionName}[${index}]\`` : '';
    throw new Error(prefix ? `${prefix} \`${errorMessage}\`` : errorMessage);
  }
};

const createActionError = (error, actionName, index) => {
  if (actionName) {
    return new Error(`\`${actionName}[${index}]\`\n${error.message}`);
  }
  return new Error(error.message);
};

const buildHeaders = (
  headers,
  headerKeys,
  ctx,
  hostname,
  port,
) => {
  const processedHeaders = headerKeys.reduce((acc, key) => {
    acc[key] = template(headers[key])(ctx);
    return acc;
  }, {});

  const hasHostHeader = headerKeys.some(key => /^host$/i.test(key));
  if (!hasHostHeader) {
    processedHeaders.Host = `${hostname}:${port}`;
  }

  return processedHeaders;
};

const buildRequestConfig = (
  options,
  ctx,
  headerKeys,
  requestBodySelect,
) => {
  const {
    protocol,
    hostname,
    port,
    path,
  } = parseHttpUrl(template(options.url)(ctx));
  const requestOptions = {
    path,
    method: options.method || 'GET',
    headers: buildHeaders(options.headers || {}, headerKeys, ctx, hostname, port),
  };

  if (requestBodySelect) {
    requestOptions.headers['Content-Type'] = 'application/json';
    requestOptions.body = JSON.stringify(requestBodySelect(ctx));
  }
  if (options.onRequest) {
    const [httpPathname, httpQuerystring, httpQuery] = parseHttpPath(path);
    const customConfig = options.onRequest({
      ...requestOptions,
      path,
      pathname: httpPathname,
      querystring: httpQuerystring,
      query: httpQuery,
    });
    if (customConfig) {
      return {
        protocol,
        hostname,
        port,
        requestOptions: customConfig,
      };
    }
  }
  return {
    requestOptions,
    path,
    protocol,
    hostname,
    port,
  };
};

const createChunkHandler = (bufList, debug) => {
  return (chunk) => {
    bufList.push(chunk);
    if (debug) {
      console.log(chunk.toString());
    }
  };
};

const executeRequest = async (options, { requestOptions, protocol, hostname, port }) => {
  const bufList = [];

  const requestConfig = {
    ...requestOptions,
    onChunkIncoming: createChunkHandler(bufList, options.debug),
    onChunkOutgoing: createChunkHandler(bufList, options.debug),
  };

  const connectionOptions = {
    protocol,
    hostname,
    port,
    ...(options.rejectUnauthorized !== null && {
      rejectUnauthorized: options.rejectUnauthorized,
    }),
  };

  const responseItem = await request(requestConfig, connectionOptions);

  if (options.onlyStatusCodeWithOk !== false && responseItem.statusCode !== 200) {
    throw new Error(Buffer.concat(bufList).toString());
  }

  return responseItem;
};

const processResponse = (
  options,
  response,
  responseBodyValidate,
  responseBodySelect,
  requestPath,
) => {
  const responseData = options.parseResponseBody
    ? options.parseResponseBody(decodeContentEncoding(response.body, response.headers['content-encoding']))
    : decodeContentToJSON(response.body, response.headers);

  if (responseBodyValidate && !responseBodyValidate(responseData)) {
    const errors = JSON.stringify(responseBodyValidate.errors);
    const data = JSON.stringify(responseData);
    throw new Error(`\`${requestPath || 'unknown'}\` response body invalidate \`${errors}\` \`${data}\``);
  }

  if (responseBodySelect) {
    return responseBodySelect(responseData);
  }

  if (responseData == null && response.body != null) {
    return response.body.toString();
  }

  return responseData;
};

export default (options, actionName, index) => {
  validateOptions(options, actionName, index);

  const requestBodySelect = options.body ? select(options.body) : null;
  const responseBodyValidate = options.validate ? (new Ajv().compile(options.validate)) : null;
  const responseBodySelect = options.select ? select(options.select) : null;

  const headerKeys = Object.keys(options.headers || {});

  return async (ctx) => {
    const requestConfig = buildRequestConfig(options, ctx, headerKeys, requestBodySelect);
    try {
      const response = await executeRequest(options, requestConfig);
      return processResponse(
        options,
        response,
        responseBodyValidate,
        responseBodySelect,
        requestConfig.path,
      );
    } catch (error) {
      throw createActionError(error, actionName, index);
    }
  };
};
