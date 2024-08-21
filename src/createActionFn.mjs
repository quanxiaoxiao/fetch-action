import Ajv from 'ajv';
import request from '@quanxiaoxiao/http-request';
import {
  parseHttpUrl,
  decodeContentToJSON,
} from '@quanxiaoxiao/http-utils';
import { template } from '@quanxiaoxiao/utils';
import { select } from '@quanxiaoxiao/datav';
import schema from './schema.mjs';

export default (options, actionName, index) => {
  const operationValidate = (new Ajv()).compile(schema);
  if (!operationValidate(options)) {
    throw new Error(actionName ? `\`${actionName}[${index}]\` \`${JSON.stringify(operationValidate.errors)}\`` : JSON.stringify(operationValidate.errors));
  }
  const requestBodySelect = options.body ? select(options.body) : null;
  const responseBodyValidate = options.validate ? (new Ajv().compile(options.validate)) : null;
  const responseBodySelect = options.select ? select(options.select) : null;
  const headerKeys = Object.keys(options.headers || {});

  return async (ctx) => {
    try {
      const {
        protocol,
        hostname,
        port,
        path,
      } = parseHttpUrl(template(options.url)(ctx));
      const requestOptions = {
        path,
        method: options.method,
        headers: options.headers || {},
      };
      requestOptions.headers = headerKeys.reduce((acc, key) => ({
        ...acc,
        [key]: template(requestOptions.headers[key])(ctx),
      }), {});

      if (!headerKeys.some((key) => /^host$/i.test(key))) {
        requestOptions.headers.Host = `${hostname}:${port}`;
      }
      if (requestBodySelect) {
        requestOptions.headers['Content-Type'] = 'application/json';
        requestOptions.body = JSON.stringify(requestBodySelect(ctx));
      }
      const bufList = [];
      const responseItem = await request(
        {
          ...requestOptions,
          onChunkIncoming: (chunk) => {
            bufList.push(chunk);
          },
          onChunkOutgoing: (chunk) => {
            bufList.push(chunk);
          },
        },
        {
          protocol,
          hostname,
          port,
          ...options.rejectUnauthorized !== null ? {
            rejectUnauthorized: options.rejectUnauthorized,
          } : {},
        },
      );
      if (responseItem.statusCode !== 200) {
        throw new Error(Buffer.concat(bufList).toString());
      }
      const responseData = decodeContentToJSON(responseItem.body, responseItem.headers);
      if (responseBodyValidate && !responseBodyValidate(responseData)) {
        throw new Error(`\`${path}\` response body invalidate \`${JSON.stringify(responseBodyValidate.errors)}\` \`${JSON.stringify(responseData)}\``);
      }
      if (responseBodySelect) {
        return responseBodySelect(responseData);
      }
      return responseData;
    } catch (error) {
      throw new Error(actionName ? `\`${actionName}[${index}]\`\n${error.message}` : error.message);
    }
  };
};
