module.exports = function handler(req, res) {
  res.status(200).json({
    hasKey: !!process.env.OPENROUTER_API_KEY,
    keyPrefix: process.env.OPENROUTER_API_KEY
      ? process.env.OPENROUTER_API_KEY.slice(0, 8) + '...'
      : 'not set',
    nodeEnv: process.env.NODE_ENV,
  });
};
