import createActionFn from './createActionFn.mjs';

export const fetchActions = (arr, actionName) => {
  const pipeline = arr.map((item, index) => createActionFn(item, actionName, index));

  return async (ctx) => {
    ctx._ = [];

    await pipeline.reduce(async (acc, action) => {
      await acc;
      const v = await action(ctx);
      ctx._.push(v);
    }, Promise.resolve);

    return ctx._.length > 0 ? ctx._.at(-1) : null;
  };
};

export default (providers) => {
  const actionNames = Object.keys(providers);

  const actionList = [];

  for (let i = 0; i < actionNames.length; i++) {
    const actionName = actionNames[i];
    const op = {
      name: actionName,
      pipeline: providers[actionName],
    };
    actionList.push(op);
  }

  return actionList.reduce((acc, cur) => ({
    ...acc,
    [cur.name]: (ctx = {}) => fetchActions(cur.pipeline, cur.name)(ctx),
  }), {});
};
