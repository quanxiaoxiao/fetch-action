import createActionFn from './createActionFn.mjs';

export const fetchActions = (arr, actionName) => {
  const pipeline = [];
  for (let i = 0; i < arr.length; i++) {
    pipeline.push(createActionFn(arr[i], actionName, i));
  }
  return async (ctx) => {
    ctx._ = [];
    await pipeline.reduce(async (acc, action) => {
      await acc;
      const v = await action(ctx);
      ctx._.push(v);
    }, Promise.resolve);
    const len = ctx._.length;
    if (len === 0) {
      return null;
    }
    return ctx._[len - 1];
  };
};

export default (providers) => {
  const actionNames = Object.keys(providers);

  const result = [];

  for (let i = 0; i < actionNames.length; i++) {
    const actionName = actionNames[i];
    const op = {
      name: actionName,
      pipeline: providers[actionName],
    };
    result.push(op);
  }

  return result.reduce((acc, cur) => ({
    ...acc,
    [cur.name]: (ctx = {}) => fetchActions(cur.pipeline, cur.name)(ctx),
  }), {});
};
