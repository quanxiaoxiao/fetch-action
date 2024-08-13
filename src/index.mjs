import createActionFn from './createActionFn.mjs';

export default (providers) => {
  const actionNames = Object.keys(providers);

  const result = [];

  for (let i = 0; i < actionNames.length; i++) {
    const actionName = actionNames[i];
    const pipeline = providers[actionName];

    const op = {
      name: actionName,
      pipeline: [],
    };

    for (let j = 0; j < pipeline.length; j++) {
      op.pipeline.push(createActionFn(pipeline[j], actionName, j));
    }

    result.push(op);
  }

  return result.reduce((acc, cur) => ({
    ...acc,
    [cur.name]: async (ctx = {}) => {
      ctx._ = [];
      await cur.pipeline.reduce(async (acc, action) => {
        await acc;
        const v = await action(ctx);
        ctx._.push(v);
      }, Promise.resolve);
      const len = ctx._.length;
      if (len === 0) {
        return null;
      }
      return ctx._[len - 1];
    },
  }), {});
};

export const fetchAction = createActionFn;
